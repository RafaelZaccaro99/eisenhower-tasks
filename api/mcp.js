// Resource server MCP — exposto em /api/mcp. Autenticado via Bearer token
// emitido por api/mcp-auth/[[...action]].js (OAuth 2.1 + PKCE). Cada tool
// replica a regra de negócio equivalente do frontend (ver comentários).
const { createHash } = require('crypto')
const { z } = require('zod')
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js')
const { sbService, calcQuadrant } = require('./_lib')
const { expandOccurrences, nextDueDate } = require('./_recurrence')

const APP_URL = process.env.APP_URL || 'https://eisenhower-tasks.vercel.app'
const sha256hex = (s) => createHash('sha256').update(s).digest('hex')

async function authenticate(req, res) {
  const unauthorized = () => {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"`)
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return unauthorized()
  const token = auth.slice(7).trim()
  const rows = await sbService(`/mcp_tokens?access_token_hash=eq.${sha256hex(token)}&revoked=eq.false`)
  const row = rows[0]
  if (!row || new Date(row.access_token_expires_at) < new Date()) return unauthorized()

  const members = await sbService(`/workspace_members?user_id=eq.${row.user_id}&workspace_id=eq.${row.workspace_id}&status=eq.active`)
  if (!members.length) return unauthorized() // usuário saiu do workspace após consentir

  sbService(`/mcp_tokens?id=eq.${row.id}`, 'PATCH', { last_used_at: new Date().toISOString() }).catch(() => {})
  return { userId: row.user_id, workspaceId: row.workspace_id, role: members[0].role }
}

// Replica a visibilidade de tasks_select (RLS de 20260710_workspaces.sql):
// admin/manager veem tudo do workspace; member só o que é dele.
function taskVisibilityFilter(ctx) {
  if (ctx.role === 'admin' || ctx.role === 'manager') return ''
  return `&or=(assigned_to.eq.${ctx.userId},created_by.eq.${ctx.userId},user_id.eq.${ctx.userId})`
}
// Replica blocks_select: dono sempre; admin/manager leem a agenda do time toda.
function blockVisibilityFilter(ctx) {
  if (ctx.role === 'admin' || ctx.role === 'manager') return ''
  return `&user_id=eq.${ctx.userId}`
}

function buildServer(ctx) {
  const server = new McpServer({ name: 'eisenhower-tasks', version: '1.0.0' }, { capabilities: { tools: {} } })

  server.registerTool('list_tasks', {
    description: 'Lista tarefas do workspace atual, com filtros opcionais.',
    inputSchema: {
      status: z.enum(['pending', 'in_progress', 'review', 'blocked', 'completed', 'cancelled']).optional(),
      quadrant: z.enum(['q1', 'q2', 'q3', 'q4']).optional(),
      overdue_only: z.boolean().optional().describe('Só tarefas com due_date no passado e não concluídas/canceladas'),
      mine_only: z.boolean().optional().describe('Só tarefas atribuídas a mim'),
    },
  }, async (args) => {
    let path = `/tasks?workspace_id=eq.${ctx.workspaceId}${taskVisibilityFilter(ctx)}`
    if (args.status) path += `&status=eq.${args.status}`
    if (args.quadrant) path += `&quadrant=eq.${args.quadrant}`
    if (args.mine_only) path += `&assigned_to=eq.${ctx.userId}`
    let tasks = await sbService(path)
    if (args.overdue_only) {
      const today = new Date().toISOString().slice(0, 10)
      tasks = tasks.filter(t => t.due_date && t.due_date < today && !['completed', 'cancelled'].includes(t.status))
    }
    return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] }
  })

  server.registerTool('create_task', {
    description: 'Cria uma nova tarefa no workspace atual.',
    inputSchema: {
      title: z.string(),
      description: z.string().optional(),
      urgent: z.boolean().optional(),
      important: z.boolean().optional(),
      due_date: z.string().optional().describe('YYYY-MM-DD'),
      category: z.string().optional(),
      delegated_to: z.string().optional().describe('uuid de people'),
      client_id: z.string().optional(),
      recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
      recurrence_end: z.string().optional(),
    },
  }, async (args) => {
    const base = {
      title: args.title,
      description: args.description || '',
      urgent: !!args.urgent,
      important: !!args.important,
      quadrant: calcQuadrant(args.urgent, args.important),
      status: 'pending',
      due_date: args.due_date || null,
      category: args.category || 'geral',
      delegated_to: args.delegated_to || null,
      client_id: args.client_id || null,
      recurrence: args.recurrence && args.recurrence !== 'none' ? args.recurrence : null,
      recurrence_end: args.recurrence_end || null,
      workspace_id: ctx.workspaceId,
      created_by: ctx.userId,
      assigned_to: ctx.userId,
      user_id: ctx.userId, // caminho legado
    }
    const [task] = await sbService('/tasks', 'POST', base)
    return { content: [{ type: 'text', text: `Tarefa criada: **${task.title}** → ${task.quadrant.toUpperCase()} (id: ${task.id})` }] }
  })

  server.registerTool('update_task_status', {
    description: 'Atualiza o status de uma tarefa. Gera a próxima ocorrência automaticamente se a tarefa for recorrente e for concluída.',
    inputSchema: {
      id: z.string(),
      status: z.enum(['pending', 'in_progress', 'review', 'blocked', 'completed', 'cancelled']),
      note: z.string().optional(),
    },
  }, async (args) => {
    const [existing] = await sbService(`/tasks?id=eq.${args.id}&workspace_id=eq.${ctx.workspaceId}${taskVisibilityFilter(ctx)}`)
    if (!existing) return { content: [{ type: 'text', text: 'Tarefa não encontrada ou sem permissão.' }], isError: true }

    const [updated] = await sbService(`/tasks?id=eq.${args.id}`, 'PATCH', { status: args.status })
    if (existing.status !== args.status) {
      await sbService('/status_history', 'POST', {
        task_id: args.id, from_status: existing.status, to_status: args.status,
        changed_at: new Date().toISOString(), note: args.note || '',
        user_id: ctx.userId, workspace_id: ctx.workspaceId,
      }).catch(() => {})
    }

    // Réplica de maybeSpawnNextRecurrence (useTasks.js)
    if (args.status === 'completed' && existing.status !== 'completed' && existing.recurrence && existing.recurrence !== 'none') {
      const today = new Date().toISOString().slice(0, 10)
      const nextDate = nextDueDate(existing.due_date || today, existing.recurrence)
      const withinEnd = !existing.recurrence_end || nextDate <= existing.recurrence_end
      if (withinEnd) {
        const spawn = { ...existing, status: 'pending', due_date: nextDate }
        delete spawn.id
        delete spawn.created_at
        await sbService('/tasks', 'POST', spawn)
      }
    }
    return { content: [{ type: 'text', text: `Tarefa atualizada: **${updated.title}** → ${updated.status}` }] }
  })

  server.registerTool('list_agenda', {
    description: 'Lista blocos de agenda (expandindo recorrência) e tarefas com prazo num intervalo de datas.',
    inputSchema: { from: z.string().describe('YYYY-MM-DD'), to: z.string().describe('YYYY-MM-DD') },
  }, async (args) => {
    const blocks = await sbService(`/blocks?workspace_id=eq.${ctx.workspaceId}${blockVisibilityFilter(ctx)}`)
    const occurrences = expandOccurrences(blocks, args.from, args.to)
    const tasks = await sbService(
      `/tasks?workspace_id=eq.${ctx.workspaceId}${taskVisibilityFilter(ctx)}&due_date=gte.${args.from}&due_date=lte.${args.to}`,
    )
    return { content: [{ type: 'text', text: JSON.stringify({ blocks: occurrences, tasks_due: tasks }, null, 2) }] }
  })

  server.registerTool('create_agenda_block', {
    description: 'Cria um bloco de agenda.',
    inputSchema: {
      date: z.string(), start_time: z.string(), end_time: z.string(),
      title: z.string().optional(), task_id: z.string().optional(), client_id: z.string().optional(),
      recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
      recurrence_end: z.string().optional(),
    },
  }, async (args) => {
    // Normaliza '' -> null em date/uuid (mesmo bug já corrigido em useBlocks.js/normalizeBlock).
    const clean = { ...args }
    if (clean.task_id === '') clean.task_id = null
    if (clean.client_id === '') clean.client_id = null
    if (clean.recurrence_end === '') clean.recurrence_end = null
    const [block] = await sbService('/blocks', 'POST', {
      ...clean, title: clean.title || '', recurrence: clean.recurrence || 'none',
      workspace_id: ctx.workspaceId, user_id: ctx.userId,
    })
    return { content: [{ type: 'text', text: `Bloco criado em ${block.date} ${block.start_time}-${block.end_time} (id: ${block.id})` }] }
  })

  server.registerTool('list_people', {
    description: 'Lista pessoas cadastradas no workspace (para delegação/contatos).',
    inputSchema: {},
  }, async () => {
    const people = await sbService(`/people?workspace_id=eq.${ctx.workspaceId}`)
    return { content: [{ type: 'text', text: JSON.stringify(people, null, 2) }] }
  })

  server.registerTool('list_clients', {
    description: 'Lista clientes cadastrados no workspace.',
    inputSchema: {},
  }, async () => {
    const clients = await sbService(`/clients?workspace_id=eq.${ctx.workspaceId}`)
    return { content: [{ type: 'text', text: JSON.stringify(clients, null, 2) }] }
  })

  return server
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Mcp-Session-Id')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const ctx = await authenticate(req, res)
  if (!ctx) return

  const server = buildServer(ctx)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}) })

  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
}
