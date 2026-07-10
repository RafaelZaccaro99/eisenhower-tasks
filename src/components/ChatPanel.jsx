import React, { useState, useRef, useEffect, useMemo } from 'react'
import { X, Send, Bot, Loader2, RotateCcw, CheckCircle2, AlertCircle, Mic, MicOff, Sun, Sparkles } from 'lucide-react'
import { callViaProxy } from '../utils/aiProxy'
import { DONE_STATUSES } from '../utils/statusConfig'
import { computeMetrics } from '../utils/sla'
import { useSpeech } from '../hooks/useSpeech'

const MAX_TASKS_IN_CONTEXT = 80

function buildSystemPrompt({ tasks, people, clients, agendaOccurrences, metrics, anamnesis }) {
  const today = new Date().toISOString().split('T')[0]
  const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]))
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]))

  const pending = tasks.filter(t => !DONE_STATUSES.includes(t.status))
  const overdue = pending.filter(t => t.due_date && t.due_date < today)

  const byPerson = {}
  pending.forEach(t => {
    if (!t.delegated_to) return
    const name = peopleMap[t.delegated_to] || 'Desconhecido'
    if (!byPerson[name]) byPerson[name] = { total: 0, overdue: 0 }
    byPerson[name].total++
    if (t.due_date && t.due_date < today) byPerson[name].overdue++
  })

  // Truncamento: todas as pendentes primeiro, depois as encerradas mais recentes
  const done = tasks.filter(t => DONE_STATUSES.includes(t.status))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const contextTasks = [...pending, ...done].slice(0, MAX_TASKS_IN_CONTEXT)

  const taskLines = contextTasks.map(t => {
    const who = t.delegated_to ? ` → ${peopleMap[t.delegated_to] || t.delegated_to}` : ''
    const clientTag = t.client_id && clientMap[t.client_id] ? ` [cliente: ${clientMap[t.client_id]}]` : ''
    const deadline = t.due_date ? ` | prazo: ${t.due_date}` : ''
    const late = t.due_date && t.due_date < today && !DONE_STATUSES.includes(t.status) ? ' [ATRASADA]' : ''
    const status = t.status === 'completed' ? '[CONCLUÍDA]'
      : t.status === 'cancelled' ? '[CANCELADA]'
      : t.status !== 'pending' ? `[${(t.quadrant || '?').toUpperCase()}·${t.status}]`
      : `[${(t.quadrant || '?').toUpperCase()}]`
    return `${status} ${t.title}${deadline}${who}${clientTag}${late} (id: ${t.id})`
  }).join('\n')

  const personStats = Object.entries(byPerson)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .map(([name, s]) => `  ${name}: ${s.total} pendente(s), ${s.overdue} atrasada(s)`)
    .join('\n')

  const agendaLines = agendaOccurrences.map(b => {
    const parts = (b.participants || []).map(id => peopleMap[id]).filter(Boolean)
    return `- ${b.date} ${b.start_time}-${b.end_time} ${b.title}${parts.length ? ` [${parts.join(', ')}]` : ''}`
  }).join('\n')

  const openByClient = c => pending.filter(t => t.client_id === c.id).length
  const clientLines = clients.map(c =>
    `  ${c.name}${c.company ? ` (${c.company})` : ''}: ${openByClient(c)} tarefa(s) aberta(s)`,
  ).join('\n')

  const metricsBlock = [
    `- Concluídas no total: ${metrics.totalCompleted} | Concluídas nos últimos 7 dias: ${metrics.completedThisWeek}`,
    metrics.compliance !== null ? `- Conformidade com prazos (SLA): ${metrics.compliance}%` : null,
    metrics.avgLead !== null ? `- Lead time médio (criação→conclusão): ${metrics.avgLead} dias` : null,
    metrics.avgCycle !== null ? `- Cycle time médio (início→conclusão): ${metrics.avgCycle} dias` : null,
  ].filter(Boolean).join('\n')

  const anamnesisBlock = [
    anamnesis.businessContext?.trim() ? `- Sobre o usuário e seu trabalho (escrito por ele): ${anamnesis.businessContext.trim()}` : null,
    anamnesis.importanceAreas?.length ? `- Áreas de foco do usuário: ${anamnesis.importanceAreas.join(', ')}` : null,
    anamnesis.urgencyTriggers?.length ? `- Palavras que indicam urgência para o usuário: ${anamnesis.urgencyTriggers.slice(0, 8).join(', ')}` : null,
    anamnesis.importanceTriggers?.length ? `- Palavras que indicam importância: ${anamnesis.importanceTriggers.slice(0, 8).join(', ')}` : null,
    anamnesis.hasDelegation ? '- O usuário delega tarefas para outras pessoas da equipe.' : null,
  ].filter(Boolean).join('\n')

  return `Você é o assistente pessoal de produtividade do usuário, dentro de um gestor de tarefas com Matriz de Eisenhower, agenda e clientes. Hoje é ${today}. Você analisa, cadastra, atualiza, conclui tarefas e gera relatórios.

RESUMO GERAL:
- Total de tarefas: ${tasks.length} (${pending.length} pendentes, ${overdue.length} atrasadas)${tasks.length > MAX_TASKS_IN_CONTEXT ? ` — listando as ${MAX_TASKS_IN_CONTEXT} mais relevantes` : ''}

TAREFAS:
${taskLines || 'Nenhuma tarefa cadastrada.'}

AGENDA (hoje + próximos 7 dias):
${agendaLines || 'Nenhum compromisso na agenda.'}

PESSOAS/CONTATOS (${people.length}):
${people.map(p => `  ${p.name}${p.role ? ` · ${p.role}` : ''}${p.hierarchy ? ` · ${p.hierarchy}` : ''}`).join('\n') || 'Nenhuma pessoa cadastrada.'}

TAREFAS PENDENTES POR PESSOA:
${personStats || 'Nenhuma tarefa delegada.'}

CLIENTES (${clients.length}):
${clientLines || 'Nenhum cliente cadastrado.'}

MÉTRICAS DE PRODUTIVIDADE:
${metricsBlock}

PERFIL DO USUÁRIO:
${anamnesisBlock || '(sem preferências configuradas)'}

AÇÕES DISPONÍVEIS:
Quando o usuário pedir para criar/alterar/concluir/excluir algo, você DEVE:
1. Responder em português confirmando o que será feito.
2. Incluir OBRIGATORIAMENTE um bloco de ação no formato exato abaixo (sem markdown, sem código, sem explicação extra):

Criar tarefa:
[ACTION]{"type":"create_task","data":{"title":"Título","urgent":true,"important":true,"due_date":"YYYY-MM-DD","category":"geral","delegated_to_name":"Nome opcional","client_name":"Cliente opcional"}}[/ACTION]

Atualizar campos de uma tarefa existente (use o id que aparece no contexto):
[ACTION]{"type":"update_task","data":{"task_id":"id-da-tarefa","title":"Novo título opcional","due_date":"YYYY-MM-DD","urgent":false,"important":true,"category":"trabalho","delegated_to_name":"Nome opcional","client_name":"Cliente opcional"}}[/ACTION]

Mudar status (concluir, cancelar, iniciar, bloquear...):
[ACTION]{"type":"set_task_status","data":{"task_id":"id-da-tarefa","status":"completed"}}[/ACTION]

Excluir tarefa (SOMENTE se o usuário pedir explicitamente para excluir/apagar):
[ACTION]{"type":"delete_task","data":{"task_id":"id-da-tarefa"}}[/ACTION]

Criar pessoa:
[ACTION]{"type":"create_person","data":{"name":"Nome Completo","role":"Cargo","hierarchy":"Subordinado"}}[/ACTION]

Criar cliente:
[ACTION]{"type":"create_client","data":{"name":"Nome","company":"Empresa opcional","email":"opcional","phone":"opcional","notes":"opcional"}}[/ACTION]

Criar evento na agenda:
[ACTION]{"type":"create_block","data":{"title":"Título","date":"YYYY-MM-DD","start_time":"09:00","end_time":"10:00","task_title":"título de tarefa para vincular, opcional","participants_names":["Nome 1","Nome 2"]}}[/ACTION]

REGRAS:
- status deve ser: pending, in_progress, review, blocked, completed ou cancelled
- hierarchy deve ser exatamente: Superior, Par, Subordinado ou Externo
- category deve ser: geral, trabalho, pessoal, saúde, financeiro ou estudo
- due_date: formato YYYY-MM-DD — omitir o campo se não mencionado
- Em update_task, inclua APENAS os campos que devem mudar (além de task_id)
- NÃO use markdown, blocos de código ou aspas ao redor do [ACTION]
- Pode incluir múltiplos [ACTION] na mesma resposta se o usuário pedir várias coisas
- Para relatórios e análises, use as MÉTRICAS e os dados acima — responda em texto, sem [ACTION]
- Responda sempre em português de forma direta e concisa.`
}

function parseActions(text) {
  const actions = []
  const cleanText = text.replace(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/g, (_, json) => {
    try {
      actions.push(JSON.parse(json.trim()))
    } catch {
      actions.push({ __parseError: true, raw: json.trim().slice(0, 120) })
    }
    return ''
  }).trim()
  return { cleanText, actions }
}

function actionLabel(action) {
  const d = action.data || {}
  if (action.type === 'create_task')     return `Tarefa criada: "${d.title}"`
  if (action.type === 'update_task')     return `Tarefa atualizada${d.title ? `: "${d.title}"` : ''}`
  if (action.type === 'set_task_status') return `Status alterado para "${d.status}"`
  if (action.type === 'delete_task')     return 'Tarefa excluída'
  if (action.type === 'create_person')   return `Pessoa criada: "${d.name}"`
  if (action.type === 'create_client')   return `Cliente criado: "${d.name}"`
  if (action.type === 'create_block')    return `Evento criado: "${d.title}" em ${d.date}`
  return 'Ação executada'
}

// Briefing determinístico do dia — montado localmente, sem custo de API
function buildBriefing(tasks, agendaOccurrences, metrics) {
  const today = new Date().toISOString().split('T')[0]
  const pending = tasks.filter(t => !DONE_STATUSES.includes(t.status))
  const overdue = pending.filter(t => t.due_date && t.due_date < today)
  const dueToday = pending.filter(t => t.due_date === today)
  const todayBlocks = agendaOccurrences
    .filter(b => b.date === today)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  const lines = []
  if (overdue.length > 0) {
    lines.push(`⚠️ ${overdue.length} tarefa${overdue.length > 1 ? 's' : ''} atrasada${overdue.length > 1 ? 's' : ''}:`)
    overdue.slice(0, 5).forEach(t => lines.push(`   • ${t.title} (prazo ${t.due_date})`))
    if (overdue.length > 5) lines.push(`   … e mais ${overdue.length - 5}`)
  }
  if (dueToday.length > 0) {
    lines.push(`📌 Vence hoje:`)
    dueToday.slice(0, 5).forEach(t => lines.push(`   • ${t.title}`))
  }
  if (todayBlocks.length > 0) {
    lines.push(`📅 Agenda de hoje:`)
    todayBlocks.slice(0, 6).forEach(b => lines.push(`   • ${b.start_time} ${b.title}`))
  }
  if (overdue.length === 0 && dueToday.length === 0 && todayBlocks.length === 0) {
    lines.push('Nenhuma pendência urgente nem compromisso hoje. Bom dia pra avançar no importante (Q2). ✨')
  }
  if (metrics.completedThisWeek > 0) {
    lines.push(`✅ ${metrics.completedThisWeek} tarefa${metrics.completedThisWeek > 1 ? 's' : ''} concluída${metrics.completedThisWeek > 1 ? 's' : ''} nos últimos 7 dias${metrics.compliance !== null ? ` · SLA ${metrics.compliance}%` : ''}.`)
  }
  return lines.join('\n')
}

const SUGGESTIONS = [
  'Monte meu dia com base nos prazos e na agenda',
  'O que está atrasado e o que faço primeiro?',
  'Crie um relatório de produtividade da semana',
  'Criar tarefa urgente: Ligar para o cliente hoje',
]

const CHAT_LS_KEY = 'eisenhower-chat'
const BRIEFING_DATE_KEY = 'eisenhower-chat-briefing-date'
const CHAT_MAX = 50

export default function ChatPanel({
  tasks, people, clients = [], agendaOccurrences = [], statusHistory = [], anamnesis = {},
  aiConfig, onClose,
  onCreateTask, onCreatePerson, onCreateBlock,
  onUpdateTask, onDeleteTask, onCreateClient,
}) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_LS_KEY) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const speech = useSpeech({
    onFinal: text => setInput(prev => (prev ? prev.trimEnd() + ' ' : '') + text),
  })

  const metrics = useMemo(() => computeMetrics(tasks, statusHistory), [tasks, statusHistory])
  const systemPrompt = useMemo(
    () => buildSystemPrompt({ tasks, people, clients, agendaOccurrences, metrics, anamnesis }),
    [tasks, people, clients, agendaOccurrences, metrics, anamnesis],
  )

  function persist(next) {
    localStorage.setItem(CHAT_LS_KEY, JSON.stringify(next))
    return next
  }

  // Briefing do dia — uma vez por dia, ao abrir o painel
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    if (localStorage.getItem(BRIEFING_DATE_KEY) === today) return
    localStorage.setItem(BRIEFING_DATE_KEY, today)
    const content = buildBriefing(tasks, agendaOccurrences, metrics)
    setMessages(prev => persist([...prev, { role: 'briefing', content }].slice(-CHAT_MAX)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [])

  const findPersonByName = name =>
    name ? people.find(p => p.name.toLowerCase().includes(name.toLowerCase())) : null
  const findClientByName = name =>
    name ? clients.find(c => c.name.toLowerCase().includes(name.toLowerCase())) : null
  const findTaskById = id => tasks.find(t => t.id === id)

  async function executeAction(action) {
    if (action.__parseError) throw new Error(`Formato inválido retornado pela IA: ${action.raw}`)
    const { type, data } = action

    if (type === 'create_task') {
      const person = findPersonByName(data.delegated_to_name)
      const client = findClientByName(data.client_name)
      await onCreateTask({
        title: data.title,
        urgent: !!data.urgent,
        important: !!data.important,
        due_date: data.due_date || null,
        category: data.category || 'geral',
        description: '',
        delegated_to: person?.id || null,
        client_id: client?.id || null,
      })
    } else if (type === 'update_task') {
      const task = findTaskById(data.task_id)
      if (!task) throw new Error('Tarefa não encontrada — id inválido')
      const patch = { ...task }
      if (data.title !== undefined) patch.title = data.title
      if (data.due_date !== undefined) patch.due_date = data.due_date || null
      if (data.urgent !== undefined) patch.urgent = !!data.urgent
      if (data.important !== undefined) patch.important = !!data.important
      if (data.category !== undefined) patch.category = data.category
      if (data.delegated_to_name !== undefined) patch.delegated_to = findPersonByName(data.delegated_to_name)?.id || null
      if (data.client_name !== undefined) patch.client_id = findClientByName(data.client_name)?.id || null
      await onUpdateTask(patch)
    } else if (type === 'set_task_status') {
      const task = findTaskById(data.task_id)
      if (!task) throw new Error('Tarefa não encontrada — id inválido')
      await onUpdateTask({ ...task, status: data.status })
    } else if (type === 'delete_task') {
      const task = findTaskById(data.task_id)
      if (!task) throw new Error('Tarefa não encontrada — id inválido')
      await onDeleteTask(task.id)
    } else if (type === 'create_person') {
      await onCreatePerson({
        name: data.name,
        role: data.role || '',
        sector: data.sector || '',
        hierarchy: data.hierarchy || 'Subordinado',
        slackId: '',
        whatsapp: '',
      })
    } else if (type === 'create_client') {
      if (!onCreateClient) throw new Error('Cadastro de clientes indisponível offline')
      await onCreateClient({
        name: data.name,
        company: data.company || '',
        email: data.email || '',
        phone: data.phone || '',
        notes: data.notes || '',
        color: '#8b5cf6',
      })
    } else if (type === 'create_block') {
      const linkedTask = data.task_title
        ? tasks.find(t => t.title.toLowerCase().includes(data.task_title.toLowerCase()))
        : null
      const participants = (data.participants_names || [])
        .map(n => findPersonByName(n)?.id)
        .filter(Boolean)
      await onCreateBlock({
        title: data.title,
        date: data.date,
        start_time: data.start_time || '09:00',
        end_time: data.end_time || '10:00',
        task_id: linkedTask?.id || null,
        participants,
      })
    } else {
      throw new Error(`Ação desconhecida: ${type}`)
    }
  }

  async function send(presetText) {
    const text = (presetText ?? input).trim()
    if (!text || loading) return
    if (speech.listening) speech.stop()

    // Only send user/assistant messages to the API
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    const newHistory = [...history, { role: 'user', content: text }]
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const reply = await callViaProxy({ ...aiConfig, messages: newHistory, systemPrompt, maxTokens: 1024 })
      const { cleanText, actions } = parseActions(reply)

      const batch = []
      if (cleanText) batch.push({ role: 'assistant', content: cleanText })

      for (const action of actions) {
        try {
          await executeAction(action)
          batch.push({ role: 'action', action, success: true })
        } catch (e) {
          batch.push({ role: 'action', action, success: false, error: e.message })
        }
      }

      setMessages(prev => persist([...prev, ...batch].slice(-CHAT_MAX)))
    } catch (e) {
      setError(e.message)
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function useSuggestion(q) {
    setInput(q)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative flex flex-col w-full max-w-md bg-white shadow-2xl border-l border-notion-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-notion-text">Assistente</span>
            <span className="text-xs text-notion-muted bg-notion-surface px-2 py-0.5 rounded-md truncate max-w-[120px]">
              {aiConfig.model}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); localStorage.removeItem(CHAT_LS_KEY) }}
                title="Limpar conversa"
                className="p-1.5 text-notion-muted hover:text-notion-sub rounded-md hover:bg-notion-surface transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-notion-muted hover:text-notion-text rounded-md hover:bg-notion-surface transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-8">
              <Bot size={36} className="text-notion-border2" />
              <p className="text-sm text-notion-muted max-w-xs">
                Analiso, cadastro, atualizo e concluo tarefas, monto sua agenda e gero relatórios. Contexto de{' '}
                <strong className="text-notion-sub">{tasks.length} tarefas</strong>,{' '}
                <strong className="text-notion-sub">{people.length} pessoas</strong> e{' '}
                <strong className="text-notion-sub">{clients.length} clientes</strong>.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {SUGGESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => useSuggestion(q)}
                    className="text-xs text-left px-3 py-2.5 rounded-lg bg-notion-surface hover:bg-notion-hover text-notion-sub transition-colors border border-notion-border"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === 'briefing') {
              return (
                <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                  <div className="flex items-center gap-1.5 mb-1.5 font-semibold text-xs uppercase tracking-wide text-amber-600">
                    <Sun size={13} /> Briefing do dia
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.content}</p>
                  <button
                    onClick={() => send('Analise minhas prioridades de hoje considerando prazos, agenda e a matriz de Eisenhower. Diga por onde começar.')}
                    disabled={loading}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
                  >
                    <Sparkles size={12} /> Analisar prioridades
                  </button>
                </div>
              )
            }
            if (m.role === 'action') {
              return (
                <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                  m.success
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {m.success
                    ? <CheckCircle2 size={13} className="flex-shrink-0" />
                    : <AlertCircle size={13} className="flex-shrink-0" />}
                  <span>{m.success ? actionLabel(m.action) : `Erro: ${m.error}`}</span>
                </div>
              )
            }
            return (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-notion-text text-white rounded-br-sm'
                      : 'bg-notion-surface text-notion-text rounded-bl-sm border border-notion-border'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-notion-surface border border-notion-border rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 size={14} className="animate-spin text-notion-muted" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="px-4 pt-2 border-t border-notion-border flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {speech.listening && (
            <p className="text-xs text-amber-600 mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Ouvindo… {speech.interim && <span className="italic text-notion-muted truncate">{speech.interim}</span>}
            </p>
          )}
          {speech.error && (
            <p className="text-xs text-red-500 mb-1.5">{speech.error}</p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={speech.listening ? 'Fale agora…' : 'Pergunte, dite ou peça para criar algo...'}
              rows={1}
              className="input flex-1 resize-none py-2 text-sm"
              style={{ minHeight: '38px', maxHeight: '96px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
              }}
            />
            {speech.supported && (
              <button
                onClick={speech.toggle}
                title={speech.listening ? 'Parar de ouvir' : 'Ditar por voz'}
                className={`h-[38px] px-3 flex-shrink-0 rounded-md border transition-all ${
                  speech.listening
                    ? 'border-red-300 bg-red-50 text-red-500 animate-pulse'
                    : 'border-notion-border text-notion-muted hover:text-notion-text hover:border-notion-border2'
                }`}
              >
                {speech.listening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            )}
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="btn-primary h-[38px] px-3 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="hidden sm:block text-[10px] text-notion-muted mt-1.5">Enter para enviar · Shift+Enter para quebrar linha</p>
        </div>
      </div>
    </div>
  )
}
