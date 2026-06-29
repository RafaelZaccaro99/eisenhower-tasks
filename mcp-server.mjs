import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const API = 'http://localhost:3001/api'

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

const TOOLS = [
  {
    name: 'get_context',
    description: 'Retorna o contexto completo do Eisenhower Tasks: resumo da matriz, todas as tarefas e pessoas cadastradas. Use isto primeiro para entender a situação atual do usuário.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tasks',
    description: 'Lista tarefas. Pode filtrar por quadrante (q1–q4) ou status (pending/completed).',
    inputSchema: {
      type: 'object',
      properties: {
        quadrant: { type: 'string', enum: ['q1', 'q2', 'q3', 'q4'] },
        status:   { type: 'string', enum: ['pending', 'completed'] },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Cria uma nova tarefa na matriz de Eisenhower.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title:       { type: 'string',  description: 'Título da tarefa' },
        description: { type: 'string' },
        urgent:      { type: 'boolean', default: false, description: 'É urgente?' },
        important:   { type: 'boolean', default: false, description: 'É importante?' },
        due_date:    { type: 'string',  description: 'Prazo no formato YYYY-MM-DD' },
        category:    { type: 'string',  description: 'Ex: trabalho, pessoal, saúde' },
        delegated_to:{ type: 'string',  description: 'ID da pessoa para delegar (Q3)' },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Atualiza campos de uma tarefa existente. Use o ID retornado por list_tasks ou create_task.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:          { type: 'string' },
        title:       { type: 'string' },
        description: { type: 'string' },
        urgent:      { type: 'boolean' },
        important:   { type: 'boolean' },
        status:      { type: 'string', enum: ['pending', 'completed'] },
        due_date:    { type: 'string' },
        category:    { type: 'string' },
        delegated_to:{ type: 'string' },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'Remove permanentemente uma tarefa.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'list_people',
    description: 'Lista as pessoas cadastradas no sistema (para delegação, contatos, etc.).',
    inputSchema: { type: 'object', properties: {} },
  },
]

const server = new Server(
  { name: 'eisenhower-tasks', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      case 'get_context': {
        const ctx = await api('/context')
        const byQ = (q, label) => {
          const tasks = ctx.pending.filter(t => t.quadrant === q)
          if (!tasks.length) return ''
          return `\n### ${label} (${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''})\n` +
            tasks.map(t => `- **${t.title}**${t.due_date ? ` · prazo: ${t.due_date}` : ''}${t.category !== 'geral' ? ` · [${t.category}]` : ''} (id: ${t.id})`).join('\n')
        }
        const text = [
          `# Eisenhower Tasks — Contexto atual`,
          `**${ctx.summary.pending} tarefas pendentes** · ${ctx.summary.completed} concluídas · ${ctx.summary.total} total`,
          `\n## Matriz de Eisenhower`,
          byQ('q1', '🔴 Q1 — Fazer Agora (Urgente + Importante)'),
          byQ('q2', '🔵 Q2 — Agendar (Importante, não urgente)'),
          byQ('q3', '🟡 Q3 — Delegar (Urgente, não importante)'),
          byQ('q4', '⚪ Q4 — Eliminar (Não urgente, não importante)'),
          ctx.people.length
            ? `\n## Pessoas cadastradas (${ctx.people.length})\n` +
              ctx.people.map(p => `- **${p.name}** · ${p.role ?? '—'} · ${p.hierarchy ?? '—'} (id: ${p.id})`).join('\n')
            : '',
          ctx.completed.length
            ? `\n## Concluídas recentemente (${Math.min(ctx.completed.length, 5)})\n` +
              ctx.completed.slice(-5).map(t => `- ~~${t.title}~~`).join('\n')
            : '',
        ].filter(Boolean).join('\n')
        return { content: [{ type: 'text', text }] }
      }

      case 'list_tasks': {
        let tasks = await api('/tasks')
        if (args.quadrant) tasks = tasks.filter(t => t.quadrant === args.quadrant)
        if (args.status)   tasks = tasks.filter(t => t.status   === args.status)
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] }
      }

      case 'create_task': {
        const task = await api('/tasks', 'POST', args)
        return { content: [{ type: 'text', text: `✅ Tarefa criada:\n**${task.title}** → ${task.quadrant.toUpperCase()} (id: ${task.id})` }] }
      }

      case 'update_task': {
        const { id, ...patch } = args
        const task = await api(`/tasks/${id}`, 'PUT', patch)
        return { content: [{ type: 'text', text: `✅ Tarefa atualizada: **${task.title}** → ${task.quadrant.toUpperCase()}` }] }
      }

      case 'delete_task': {
        await api(`/tasks/${args.id}`, 'DELETE')
        return { content: [{ type: 'text', text: `🗑️ Tarefa ${args.id} removida.` }] }
      }

      case 'list_people': {
        const people = await api('/people')
        const text = people.length
          ? people.map(p => `- **${p.name}** · ${p.role ?? '—'} · ${p.hierarchy ?? '—'} (id: ${p.id})`).join('\n')
          : 'Nenhuma pessoa cadastrada.'
        return { content: [{ type: 'text', text }] }
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`)
    }
  } catch (err) {
    const msg = err.message.includes('ECONNREFUSED')
      ? 'Servidor de dados offline. Inicie com: node data-server.mjs'
      : err.message
    return { content: [{ type: 'text', text: `❌ Erro: ${msg}` }], isError: true }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
