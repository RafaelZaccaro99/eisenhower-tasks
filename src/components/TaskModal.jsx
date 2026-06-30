import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Check, Zap, ZapOff, ChevronDown, Loader2, RefreshCw, MessageSquare } from 'lucide-react'
import { classifyTask, quadrantLabel } from '../utils/classifier'
import { classifyTaskWithAI } from '../utils/aiClassifier'
import { sendSlackMessage, buildBlocks } from '../utils/slack'
import { STATUS_CONFIG, STATUS_TRANSITIONS } from '../utils/statusConfig'

const CATEGORIES = ['geral', 'trabalho', 'pessoal', 'saúde', 'financeiro', 'estudo']
const RECURRENCES = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
]

const Q_LABELS = {
  q1: { label: 'Fazer agora',  color: 'text-red-500'          },
  q2: { label: 'Agendar',      color: 'text-blue-500'         },
  q3: { label: 'Delegar',      color: 'text-amber-500'        },
  q4: { label: 'Eliminar',     color: 'text-notion-muted'     },
}

const Q_SUGGESTION_STYLE = {
  q1: 'border-red-300 bg-red-50 text-red-600',
  q2: 'border-blue-300 bg-blue-50 text-blue-600',
  q3: 'border-amber-300 bg-amber-50 text-amber-600',
  q4: 'border-notion-border bg-notion-surface text-notion-sub',
}

function calcQ(urgent, important) {
  if (urgent && important) return 'q1'
  if (!urgent && important) return 'q2'
  if (urgent && !important) return 'q3'
  return 'q4'
}

function Toggle({ label, active, onClick, activeClass }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${
        active ? `${activeClass} border-current` : 'border-notion-border text-notion-muted hover:border-notion-border2 hover:text-notion-sub'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${active ? 'bg-current border-current' : 'border-current'}`}>
        {active && <Check size={9} strokeWidth={3} className="text-white" />}
      </span>
      {label}
    </button>
  )
}

export default function TaskModal({ task, people = [], assistantEnabled = false, aiConfig = {}, anamnesis = {}, slackBotToken = '', onSave, onClose }) {
  const { enabled: aiEnabled = false, provider, model, apiKey: claudeApiKey = '' } = aiConfig
  const isEdit = !!task?.id
  const [form, setForm] = useState({
    title: '', description: '', urgent: false, important: false,
    due_date: '', category: 'geral', status: 'pending', delegated_to: '',
    recurrence: 'none', recurrence_end: '',
    ...task,
    recurrence: task?.recurrence || 'none',
    status: task?.status || 'pending',
  })
  const [useAssistant, setUseAssistant] = useState(assistantEnabled)
  const [suggestion, setSuggestion] = useState(null)
  const [showReasons, setShowReasons] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [notifySlack, setNotifySlack] = useState(false)
  const [slackStatus, setSlackStatus] = useState(null)
  const debounceRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const q = calcQ(form.urgent, form.important)
  const qInfo = Q_LABELS[q]

  const delegatee = form.delegated_to ? people.find(p => p.id === form.delegated_to) : null
  const canNotifySlack = q === 'q3' && delegatee?.slackId && slackBotToken

  const runClassifier = useCallback(() => {
    if (!useAssistant || !form.title.trim()) { setSuggestion(null); setAiError(null); return }

    const useAI = aiEnabled && claudeApiKey
    if (!useAI) {
      setSuggestion(classifyTask(form.title, form.due_date, anamnesis))
      return
    }

    clearTimeout(debounceRef.current)
    setAiLoading(true)
    setAiError(null)
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await classifyTaskWithAI(form.title, form.due_date, anamnesis, { provider, model, apiKey: claudeApiKey })
        setSuggestion(result)
      } catch {
        setAiError('Erro ao consultar IA. Usando classificação local.')
        setSuggestion(classifyTask(form.title, form.due_date, anamnesis))
      } finally {
        setAiLoading(false)
      }
    }, 700)
  }, [form.title, form.due_date, useAssistant, aiEnabled, claudeApiKey, anamnesis])

  useEffect(() => { runClassifier() }, [runClassifier])
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  function applySuggestion() {
    if (!suggestion) return
    setForm(f => ({ ...f, urgent: suggestion.urgent, important: suggestion.important }))
  }

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return

    if (notifySlack && canNotifySlack) {
      setSlackStatus('sending')
      try {
        const text = `📋 Tarefa delegada para você: *${form.title}*`
        await sendSlackMessage(slackBotToken, delegatee.slackId, text, buildBlocks(text, { ...form, quadrant: q }))
        setSlackStatus('sent')
      } catch {
        setSlackStatus('error')
      }
    }

    const cleanForm = {
      ...form,
      recurrence: form.recurrence === 'none' ? null : form.recurrence,
      recurrence_end: form.recurrence_end || null,
    }
    onSave(cleanForm)
  }

  const statusOptions = isEdit
    ? [form.status, ...(STATUS_TRANSITIONS[form.status] || [])]
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)' }}
      >
        {/* Title */}
        <div className="px-6 pt-5 pb-3 border-b border-notion-border">
          <div className="flex items-start justify-between gap-3">
            <input
              autoFocus
              className="flex-1 text-xl font-semibold text-notion-text placeholder-notion-placeholder bg-transparent outline-none"
              placeholder="Título da tarefa"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setUseAssistant(v => !v)}
              title={useAssistant ? 'Desativar assistente' : 'Ativar assistente'}
              className={`flex-shrink-0 p-1.5 rounded-md transition-colors mt-1 ${
                useAssistant ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-notion-muted hover:bg-notion-surface'
              }`}
            >
              {useAssistant ? <Zap size={15} /> : <ZapOff size={15} />}
            </button>
          </div>
          <span className={`text-xs font-medium mt-1 block ${qInfo.color}`}>{qInfo.label}</span>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-4">
          <textarea
            className="w-full text-sm text-notion-text placeholder-notion-placeholder bg-transparent outline-none resize-none"
            rows={2} placeholder="Adicionar descrição..."
            value={form.description} onChange={e => set('description', e.target.value)}
          />

          {/* AI loading */}
          {useAssistant && aiLoading && form.title.trim() && (
            <div className="rounded-lg border border-notion-border bg-notion-surface px-3 py-2.5 flex items-center gap-2 text-notion-muted">
              <Loader2 size={13} className="animate-spin flex-shrink-0" />
              <span className="text-xs">IA analisando sua tarefa...</span>
            </div>
          )}

          {/* AI suggestion */}
          {useAssistant && !aiLoading && suggestion && form.title.trim() && (
            <div className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 ${Q_SUGGESTION_STYLE[suggestion.quadrant]}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap size={13} className="flex-shrink-0" />
                  <span className="text-xs font-semibold">
                    {aiEnabled && claudeApiKey ? `✦ ${provider ?? 'IA'} · ` : ''}{quadrantLabel(suggestion.quadrant)}
                  </span>
                  <span className="text-xs opacity-60">· {suggestion.confidence}% confiança</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowReasons(v => !v)}
                    className="text-xs opacity-60 hover:opacity-100 flex items-center gap-0.5"
                  >
                    Por quê? <ChevronDown size={11} className={`transition-transform ${showReasons ? 'rotate-180' : ''}`} />
                  </button>
                  <button type="button" onClick={applySuggestion}
                    className="text-xs font-medium px-2 py-0.5 rounded bg-current/10 hover:bg-current/20 transition-colors ml-1">
                    Aplicar
                  </button>
                </div>
              </div>
              {aiError && <p className="text-xs opacity-60">{aiError}</p>}
              {showReasons && suggestion.reasons.length > 0 && (
                <ul className="text-xs opacity-70 flex flex-col gap-0.5 pl-1">
                  {suggestion.reasons.map((r, i) => <li key={i}>· {r}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Status — only when editing */}
          {isEdit && (
            <div>
              <p className="label mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(s => {
                  const cfg = STATUS_CONFIG[s]
                  if (!cfg) return null
                  const isCurrent = form.status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                        isCurrent
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : 'border-notion-border text-notion-muted hover:border-notion-border2 hover:text-notion-sub'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Classificação */}
          <div>
            <p className="label mb-2">Classificação</p>
            <div className="flex gap-2">
              <Toggle label="Urgente" active={form.urgent} onClick={() => set('urgent', !form.urgent)} activeClass="text-red-500" />
              <Toggle label="Importante" active={form.important} onClick={() => set('important', !form.important)} activeClass="text-blue-500" />
            </div>
          </div>

          {/* Delegar para */}
          <div>
            <p className="label mb-1">Delegar para</p>
            <select className="input" value={form.delegated_to || ''} onChange={e => set('delegated_to', e.target.value)}>
              <option value="">— selecionar pessoa —</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ''}</option>
              ))}
            </select>
            {people.length === 0 && (
              <p className="text-xs text-notion-muted mt-1">Cadastre pessoas na aba "Pessoas" primeiro.</p>
            )}

            {canNotifySlack && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  notifySlack ? 'bg-notion-text border-notion-text' : 'border-notion-border2 group-hover:border-notion-sub'
                }`} onClick={() => setNotifySlack(v => !v)}>
                  {notifySlack && <Check size={10} strokeWidth={3} className="text-white" />}
                </span>
                <span className="text-xs text-notion-sub flex items-center gap-1">
                  <MessageSquare size={11} />
                  Notificar {delegatee?.name?.split(' ')[0]} via Slack
                  {slackStatus === 'sending' && <Loader2 size={10} className="animate-spin ml-1" />}
                  {slackStatus === 'sent' && <span className="text-green-500 ml-1">enviado</span>}
                  {slackStatus === 'error' && <span className="text-red-400 ml-1">falhou</span>}
                </span>
              </label>
            )}
          </div>

          {/* Prazo + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prazo</label>
              <input type="date" className="input" value={form.due_date || ''}
                onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Recorrência */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1">
                <RefreshCw size={10} /> Recorrência
              </label>
              <select className="input" value={form.recurrence || 'none'} onChange={e => set('recurrence', e.target.value)}>
                {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {form.recurrence && form.recurrence !== 'none' && (
              <div>
                <label className="label">Repetir até</label>
                <input type="date" className="input" value={form.recurrence_end || ''}
                  onChange={e => set('recurrence_end', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-notion-border bg-notion-surface flex justify-between items-center">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary">
            {isEdit ? 'Salvar alterações' : 'Criar tarefa'}
          </button>
        </div>
      </form>
    </div>
  )
}
