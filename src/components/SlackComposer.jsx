import React, { useState, useEffect } from 'react'
import { X, Send, ChevronDown, CheckSquare, AtSign, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { sendSlackMessage, buildBlocks, taskQuadrant } from '../utils/slack'

const Q_LABEL = { q1: '🔴 Fazer agora', q2: '🔵 Agendar', q3: '🟡 Delegar', q4: '⚪ Eliminar' }

function SlackIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

export default function SlackComposer({ person, tasks = [], people = [], slackBotToken, onClose }) {
  const [message, setMessage] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [mentionInput, setMentionInput] = useState('')
  const [mentions, setMentions] = useState([])
  const [showMentions, setShowMentions] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const mentionablePeople = people.filter(p => p.id !== person.id && p.slackId)

  const initials = person.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  function addMention(p) {
    if (!mentions.find(m => m.id === p.id)) {
      setMentions(prev => [...prev, p])
    }
    setMentionInput('')
    setShowMentions(false)
  }

  function removeMention(id) {
    setMentions(prev => prev.filter(m => m.id !== id))
  }

  function buildFullMessage() {
    const mentionStr = mentions.map(m => `<@${m.slackId}>`).join(' ')
    return [mentionStr, message].filter(Boolean).join(' ')
  }

  async function handleSend() {
    if (!message.trim() || !slackBotToken) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const fullText = buildFullMessage()
      const blocks = buildBlocks(fullText, selectedTask ? { ...selectedTask, quadrant: taskQuadrant(selectedTask) } : null)
      await sendSlackMessage(slackBotToken, person.slackId, fullText, blocks)
      setStatus('success')
      setTimeout(onClose, 1800)
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err.message === 'user_not_found'
          ? `ID do membro "${person.slackId}" não encontrado. Edite a pessoa e cole o ID correto (perfil no Slack → ··· → Copiar ID do membro).`
          : err.message === 'not_in_channel'
          ? 'Bot não está no canal. Adicione o bot ao workspace.'
          : err.message === 'invalid_auth'
          ? 'Token inválido. Verifique o Bot Token nas Configurações.'
          : err.message === 'missing_scope'
          ? 'Permissão faltando. Adicione o scope "im:write" no seu Slack App e reinstale.'
          : err.message
      )
    }
  }

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const canSend = message.trim() && slackBotToken && status === 'idle'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-notion-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#4A154B]/10 flex items-center justify-center flex-shrink-0">
              <SlackIcon size={15} />
            </div>
            <div>
              <p className="text-sm font-semibold text-notion-text">Mensagem via Slack</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-notion-hover flex items-center justify-center text-[10px] font-semibold text-notion-sub">
                  {initials}
                </div>
                <span className="text-xs text-notion-muted">{person.name}</span>
                <span className="text-xs text-notion-muted">·</span>
                <span className="text-xs text-notion-muted font-mono">{person.slackId}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-notion-muted hover:text-notion-text p-1">
            <X size={16} />
          </button>
        </div>

        {/* No token warning */}
        {!slackBotToken && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Configure o <strong>Slack Bot Token</strong> em Configurações → Integrações para enviar mensagens.</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Mentions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AtSign size={13} className="text-notion-muted" />
              <label className="label">Marcar pessoas</label>
            </div>
            {mentions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mentions.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 bg-[#4A154B]/8 text-[#4A154B] text-xs px-2 py-1 rounded-md font-medium">
                    @{m.name.split(' ')[0]}
                    <button onClick={() => removeMention(m.id)} className="hover:text-red-500 ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                className="input text-xs w-full"
                placeholder={mentionablePeople.length === 0 ? 'Cadastre pessoas com Slack ID para mencionar' : 'Buscar pessoa para marcar...'}
                value={mentionInput}
                disabled={mentionablePeople.length === 0}
                onChange={e => { setMentionInput(e.target.value); setShowMentions(true) }}
                onFocus={() => setShowMentions(true)}
              />
              {showMentions && mentionablePeople.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white rounded-lg border border-notion-border shadow-lg overflow-hidden">
                  {mentionablePeople
                    .filter(p => !mentions.find(m => m.id === p.id) && p.name.toLowerCase().includes(mentionInput.toLowerCase()))
                    .slice(0, 5)
                    .map(p => (
                      <button key={p.id} type="button"
                        onMouseDown={() => addMention(p)}
                        className="w-full text-left px-3 py-2 text-sm text-notion-text hover:bg-notion-surface flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-notion-hover text-[10px] font-semibold text-notion-sub flex items-center justify-center flex-shrink-0">
                          {p.name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                        </span>
                        {p.name}
                        <span className="text-notion-muted text-xs ml-auto font-mono">{p.slackId}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          <div onClick={() => setShowMentions(false)}>
            <label className="label mb-2">Mensagem *</label>
            <textarea
              autoFocus
              className="input w-full resize-none text-sm leading-relaxed"
              rows={5}
              placeholder={`Escreva sua mensagem para ${person.name.split(' ')[0]}...`}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          {/* Attach task */}
          <div onClick={() => setShowMentions(false)}>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckSquare size={13} className="text-notion-muted" />
              <label className="label">Tarefa relacionada</label>
              <span className="text-xs text-notion-muted">(opcional)</span>
            </div>
            <select
              className="input text-sm w-full"
              value={selectedTask?.id ?? ''}
              onChange={e => {
                const t = pendingTasks.find(t => t.id === e.target.value) || null
                setSelectedTask(t)
              }}
            >
              <option value="">— nenhuma —</option>
              {pendingTasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}{t.due_date ? ` · ${t.due_date}` : ''}
                </option>
              ))}
            </select>

            {selectedTask && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-notion-surface border border-notion-border text-xs text-notion-sub flex flex-col gap-0.5">
                <span className="font-medium text-notion-text">{selectedTask.title}</span>
                <span>{Q_LABEL[taskQuadrant(selectedTask)]}{selectedTask.due_date ? ` · prazo ${selectedTask.due_date}` : ''}</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {(message.trim() || mentions.length > 0) && (
            <div onClick={() => setShowMentions(false)}>
              <p className="label mb-2">Pré-visualização</p>
              <div className="px-3 py-2.5 rounded-lg bg-[#1A1D21] text-xs font-mono text-[#D1D2D3] leading-relaxed whitespace-pre-wrap break-words">
                {mentions.map(m => `@${m.name.split(' ')[0]}`).join(' ')}{mentions.length > 0 && message.trim() ? ' ' : ''}{message}
                {selectedTask && (
                  <span className="block mt-2 pt-2 border-t border-white/10 text-[#ABABAD]">
                    {`📌 ${selectedTask.title}\n${Q_LABEL[taskQuadrant(selectedTask)]}${selectedTask.due_date ? ` · ${selectedTask.due_date}` : ''}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-notion-border bg-notion-surface flex justify-between items-center flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`btn-primary flex items-center gap-2 transition-all ${
              status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {status === 'sending' && <Loader2 size={14} className="animate-spin" />}
            {status === 'success' && <CheckCircle size={14} />}
            {status === 'idle' || status === 'error' ? <Send size={14} /> : null}
            {status === 'sending' ? 'Enviando...' : status === 'success' ? 'Enviado!' : 'Enviar mensagem'}
          </button>
        </div>
      </div>
    </div>
  )
}
