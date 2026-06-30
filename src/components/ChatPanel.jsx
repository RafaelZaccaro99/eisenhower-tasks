import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'

function buildSystemPrompt(tasks, people) {
  const today = new Date().toISOString().split('T')[0]
  const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]))

  const pending = tasks.filter(t => t.status !== 'completed')
  const overdue = pending.filter(t => t.due_date && t.due_date < today)

  const byPerson = {}
  pending.forEach(t => {
    if (!t.delegated_to) return
    const name = peopleMap[t.delegated_to] || 'Desconhecido'
    if (!byPerson[name]) byPerson[name] = { total: 0, overdue: 0 }
    byPerson[name].total++
    if (t.due_date && t.due_date < today) byPerson[name].overdue++
  })

  const taskLines = tasks.map(t => {
    const who = t.delegated_to ? ` → ${peopleMap[t.delegated_to] || t.delegated_to}` : ''
    const deadline = t.due_date ? ` | prazo: ${t.due_date}` : ''
    const late = t.due_date && t.due_date < today && t.status !== 'completed' ? ' [ATRASADA]' : ''
    const status = t.status === 'completed' ? '[CONCLUÍDA]' : `[${(t.quadrant || '?').toUpperCase()}]`
    return `${status} ${t.title}${deadline}${who}${late}`
  }).join('\n')

  const personStats = Object.entries(byPerson)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .map(([name, s]) => `  ${name}: ${s.total} pendente(s), ${s.overdue} atrasada(s)`)
    .join('\n')

  return `Você é um assistente de produtividade para a Matriz de Eisenhower. Hoje é ${today}.

RESUMO GERAL:
- Total de tarefas: ${tasks.length} (${pending.length} pendentes, ${overdue.length} atrasadas)

TAREFAS:
${taskLines || 'Nenhuma tarefa cadastrada.'}

PESSOAS/SUBORDINADOS (${people.length}):
${people.map(p => `  ${p.name}${p.slackId ? ` [Slack: ${p.slackId}]` : ''}`).join('\n') || 'Nenhuma pessoa cadastrada.'}

TAREFAS PENDENTES POR PESSOA:
${personStats || 'Nenhuma tarefa delegada.'}

INSTRUÇÕES CRÍTICAS PARA CRIAÇÃO:
Quando o usuário pedir para criar uma tarefa, pessoa ou evento, você DEVE:
1. Responder em português confirmando o que será criado.
2. Incluir OBRIGATORIAMENTE um bloco de ação no formato exato abaixo (sem markdown, sem código, sem explicação extra):

Para criar tarefa:
[ACTION]{"type":"create_task","data":{"title":"Título da tarefa","urgent":true,"important":true,"due_date":"YYYY-MM-DD","category":"geral","delegated_to_name":"Nome opcional"}}[/ACTION]

Para criar pessoa:
[ACTION]{"type":"create_person","data":{"name":"Nome Completo","role":"Cargo","hierarchy":"Subordinado"}}[/ACTION]

Para criar evento na agenda:
[ACTION]{"type":"create_block","data":{"title":"Título do evento","date":"YYYY-MM-DD","start_time":"09:00","end_time":"10:00"}}[/ACTION]

REGRAS:
- hierarchy deve ser exatamente: Superior, Par, Subordinado ou Externo
- category deve ser: geral, trabalho, pessoal, saúde, financeiro ou estudo
- due_date: formato YYYY-MM-DD — omitir o campo se não mencionado
- NÃO use markdown, blocos de código ou aspas ao redor do [ACTION]
- Inclua [ACTION] SOMENTE para criar — nunca para consultas ou respostas informativas
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
  const d = action.data
  if (action.type === 'create_task')   return `Tarefa criada: "${d.title}"`
  if (action.type === 'create_person') return `Pessoa criada: "${d.name}"`
  if (action.type === 'create_block')  return `Evento criado: "${d.title}" em ${d.date}`
  return 'Ação executada'
}

async function callAI(messages, systemPrompt, { provider, model, apiKey }) {
  switch (provider) {
    case 'anthropic': {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.content?.[0]?.text
    }
    case 'openai':
    case 'groq':
    case 'xai': {
      const base = provider === 'groq' ? 'https://api.groq.com/openai'
        : provider === 'xai' ? 'https://api.x.ai'
        : 'https://api.openai.com'
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, max_tokens: 1024,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.choices?.[0]?.message?.content
    }
    case 'google': {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 1024 },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      return data.candidates?.[0]?.content?.parts?.[0]?.text
    }
    default:
      throw new Error(`Provedor desconhecido: ${provider}`)
  }
}

const SUGGESTIONS = [
  'Quem tem mais tarefas atrasadas?',
  'Criar tarefa urgente: Ligar para o cliente hoje',
  'Adicionar João Silva como subordinado',
  'Criar reunião de equipe amanhã às 10h',
]

export default function ChatPanel({ tasks, people, aiConfig, onClose, onCreateTask, onCreatePerson, onCreateBlock }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const systemPrompt = buildSystemPrompt(tasks, people)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [])

  async function executeAction(action) {
    if (action.__parseError) throw new Error(`Formato inválido retornado pela IA: ${action.raw}`)
    const { type, data } = action
    if (type === 'create_task') {
      const person = data.delegated_to_name
        ? people.find(p => p.name.toLowerCase().includes(data.delegated_to_name.toLowerCase()))
        : null
      await onCreateTask({
        title: data.title,
        urgent: !!data.urgent,
        important: !!data.important,
        due_date: data.due_date || null,
        category: data.category || 'geral',
        description: '',
        delegated_to: person?.id || null,
      })
    } else if (type === 'create_person') {
      await onCreatePerson({
        name: data.name,
        role: data.role || '',
        sector: data.sector || '',
        hierarchy: data.hierarchy || 'Subordinado',
        slackId: '',
        whatsapp: '',
      })
    } else if (type === 'create_block') {
      await onCreateBlock({
        title: data.title,
        date: data.date,
        start_time: data.start_time || '09:00',
        end_time: data.end_time || '10:00',
      })
    } else {
      throw new Error(`Ação desconhecida: ${type}`)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

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
      const reply = await callAI(newHistory, systemPrompt, aiConfig)
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

      setMessages(prev => [...prev, ...batch])
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
            <span className="text-sm font-semibold text-notion-text">Chat com IA</span>
            <span className="text-xs text-notion-muted bg-notion-surface px-2 py-0.5 rounded-md truncate max-w-[120px]">
              {aiConfig.model}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null) }}
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
                Pergunte ou peça para criar tarefas, pessoas e eventos. Contexto de{' '}
                <strong className="text-notion-sub">{tasks.length} tarefas</strong> e{' '}
                <strong className="text-notion-sub">{people.length} pessoas</strong>.
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
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ou peça para criar algo..."
              rows={1}
              className="input flex-1 resize-none py-2 text-sm"
              style={{ minHeight: '38px', maxHeight: '96px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
              }}
            />
            <button
              onClick={send}
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
