import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, RotateCcw } from 'lucide-react'

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

Responda em português de forma direta e objetiva. Seja conciso.`
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
    case 'groq': {
      const base = provider === 'groq' ? 'https://api.groq.com/openai' : 'https://api.openai.com'
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
  'Quais são minhas tarefas de Q1?',
  'Resuma o estado atual do time',
]

export default function ChatPanel({ tasks, people, aiConfig, onClose }) {
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

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const reply = await callAI(newMessages, systemPrompt, aiConfig)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
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
                Pergunte sobre suas tarefas e equipe. Tenho contexto completo de{' '}
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

          {messages.map((m, i) => (
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
          ))}

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
              placeholder="Pergunte sobre tarefas e equipe..."
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
