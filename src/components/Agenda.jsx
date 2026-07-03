import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Lock, Repeat, Pencil, ExternalLink as ExternalLinkIcon, User, Users, AlertCircle } from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DONE_STATUSES, STATUS_CONFIG } from '../utils/statusConfig'

const Q_COLORS = { q1: '#f87171', q2: '#60a5fa', q3: '#fbbf24', q4: '#9b9a97' }
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const pad = n => String(n).padStart(2, '0')

const RECURRENCE_LABELS = {
  none: 'Não repete',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function isRecurring(block) {
  return block.recurrence && block.recurrence !== 'none'
}

function ParticipantBubbles({ ids, people, max = 3 }) {
  const matched = ids.map(id => people.find(p => p.id === id)).filter(Boolean)
  if (!matched.length) return null
  const shown = matched.slice(0, max)
  const rest = matched.length - max
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold border border-white flex-shrink-0"
          style={{ backgroundColor: '#6b7280', marginLeft: i > 0 ? -4 : 0, zIndex: i }}
        >
          {initials(p.name)}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[8px] font-bold border border-white flex-shrink-0" style={{ marginLeft: -4 }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

// Pergunta se a ação vale só para a ocorrência do dia ou para a série inteira
function ScopeDialog({ mode, blockTitle, onSingle, onSeries, onClose }) {
  const isDelete = mode === 'delete'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12)' }}>
        <div className="flex items-center gap-2">
          <Repeat size={15} className="text-notion-muted" />
          <h3 className="text-sm font-semibold text-notion-text">
            {isDelete ? 'Excluir bloco recorrente' : 'Editar bloco recorrente'}
          </h3>
        </div>
        <p className="text-xs text-notion-muted">
          "{blockTitle}" se repete. {isDelete ? 'O que você quer excluir?' : 'Onde aplicar a alteração?'}
        </p>
        <button onClick={onSingle} className="btn-ghost justify-start border border-notion-border rounded-md px-3 py-2 text-sm">
          Somente esta ocorrência
        </button>
        <button onClick={onSeries} className={`btn-ghost justify-start border border-notion-border rounded-md px-3 py-2 text-sm ${isDelete ? 'text-red-500 hover:text-red-600' : ''}`}>
          Toda a série
        </button>
        <button onClick={onClose} className="text-xs text-notion-muted hover:text-notion-text mt-1">Cancelar</button>
      </div>
    </div>
  )
}

function BlockModal({ date, tasks, people, initialBlock, onSave, onUpdate, onClose }) {
  const isEdit = !!initialBlock?.id
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => {
    const base = {
      task_id: '', title: '', start_time: '09:00', end_time: '10:00',
      color: '#60a5fa', locked: false, recurrence: 'none', recurrence_end: '',
      participants: [],
    }
    if (!initialBlock) return base
    return {
      ...base,
      ...initialBlock,
      participants: Array.isArray(initialBlock.participants) ? initialBlock.participants : [],
    }
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleTaskChange(e) {
    const t = tasks.find(t => t.id === e.target.value)
    setForm(f => ({
      ...f, task_id: e.target.value,
      title: t ? t.title : f.title,
      color: t ? Q_COLORS[t.quadrant] : f.color,
    }))
  }

  function toggleParticipant(id) {
    setForm(f => {
      const list = f.participants || []
      return { ...f, participants: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (form.start_time >= form.end_time) {
      setError('O horário final deve ser depois do inicial')
      return
    }
    setError('')
    if (isEdit) {
      onUpdate({ ...form })
    } else {
      onSave({ ...form, date: format(date, 'yyyy-MM-dd') })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm max-h-[92dvh] overflow-y-auto"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)' }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-notion-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-notion-text">
            {isEdit ? 'Editar bloco' : 'Novo bloco'}
          </h2>
          <button type="button" onClick={onClose} className="text-notion-muted hover:text-notion-text"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="label">Vincular tarefa</label>
            <select className="input" value={form.task_id} onChange={handleTaskChange}>
              <option value="">— bloco livre —</option>
              {tasks.filter(t => !DONE_STATUSES.includes(t.status)).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Título *</label>
            <input className="input" value={form.title} required
              onChange={e => set('title', e.target.value)} placeholder="Ex: Reunião de equipe" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Início</label>
              <input type="time" className="input" value={form.start_time}
                onChange={e => set('start_time', e.target.value)} />
            </div>
            <div>
              <label className="label">Fim</label>
              <input type="time" className="input" value={form.end_time}
                onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {/* Participants */}
          {people.length > 0 && (
            <div>
              <label className="label flex items-center gap-1"><Users size={12} /> Participantes</label>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto border border-notion-border rounded-md px-3 py-2">
                {people.map(p => {
                  const checked = (form.participants || []).includes(p.id)
                  return (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParticipant(p.id)}
                        className="rounded border-notion-border2 accent-notion-text"
                      />
                      <span className="text-sm text-notion-text">{p.name}</span>
                      {p.role && <span className="text-xs text-notion-muted ml-auto">{p.role}</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="label">Cor</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-8 h-8 rounded cursor-pointer border border-notion-border"
                value={form.color} onChange={e => set('color', e.target.value)} />
              <span className="text-xs text-notion-muted">{form.color}</span>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1"><Repeat size={12} /> Recorrência</label>
            <select className="input" value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
              {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {form.recurrence !== 'none' && (
            <div>
              <label className="label">Repetir até (opcional)</label>
              <input type="date" className="input" value={form.recurrence_end}
                onChange={e => set('recurrence_end', e.target.value)} />
            </div>
          )}

          <button
            type="button"
            onClick={() => set('locked', !form.locked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
              form.locked
                ? 'border-notion-text bg-notion-surface text-notion-text'
                : 'border-notion-border text-notion-muted hover:border-notion-border2'
            }`}
          >
            <Lock size={13} />
            {form.locked ? 'Horário travado' : 'Travar horário'}
            <span className="text-xs text-notion-muted ml-auto">
              {form.locked ? 'Não pode ser deletado acidentalmente' : ''}
            </span>
          </button>
        </div>

        <div className="px-5 py-3 border-t border-notion-border bg-notion-surface flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary">
            {isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  )
}

const PROVIDER_ICONS = { google: '🔵', clickup: '🟣', jira: '🔷', ical: '📅' }

function ExternalEventChip({ event }) {
  const [sh, sm] = (event.start_time || '00:00').split(':').map(Number)
  const [eh, em] = (event.end_time || `${sh + 1}:00`).split(':').map(Number)
  const top = (sh + sm / 60) * 56
  const height = Math.max(((eh + em / 60) - (sh + sm / 60)) * 56, 24)
  return (
    <a
      href={event.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-16 right-3 rounded-md px-2.5 py-1 text-xs overflow-hidden"
      style={{ top, height, border: '1.5px dashed #9b9a97', background: 'rgba(155,154,151,0.07)', color: '#6b7280' }}
      title={`${PROVIDER_ICONS[event.provider] || '📅'} ${event.title}${event.url ? ' — abrir' : ''}`}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px]">{PROVIDER_ICONS[event.provider] || '📅'}</span>
        <p className="font-medium truncate leading-tight flex-1">{event.title}</p>
        {event.url && <ExternalLinkIcon size={9} className="flex-shrink-0 opacity-60" />}
      </div>
      {!event.all_day && (
        <p className="opacity-60 text-[11px]">{event.start_time} – {event.end_time}</p>
      )}
    </a>
  )
}

function TimeGrid({ blocks, externalEvents, people, onDeleteBlock, onEditBlock }) {
  return (
    <div className="relative overflow-y-auto flex-1">
      {HOURS.map(h => (
        <div key={h} className="flex" style={{ height: 56 }}>
          <span className="w-14 flex-shrink-0 text-xs text-notion-muted text-right pr-3 pt-1 select-none">
            {pad(h)}:00
          </span>
          <div className="flex-1 border-t border-notion-border relative" />
        </div>
      ))}
      {externalEvents.filter(e => !e.all_day && e.start_time).map(event => (
        <ExternalEventChip key={event.id} event={event} />
      ))}
      {blocks.map(block => {
        const [sh, sm] = block.start_time.split(':').map(Number)
        const [eh, em] = block.end_time.split(':').map(Number)
        const top = (sh + sm / 60) * 56
        const height = Math.max(((eh + em / 60) - (sh + sm / 60)) * 56, 24)
        const participants = Array.isArray(block.participants) ? block.participants : []
        return (
          <div
            key={block.id + block.date}
            className="absolute left-16 right-3 rounded-md px-2.5 py-1 text-white text-xs overflow-hidden group cursor-pointer"
            style={{ top, height, backgroundColor: block.color || '#60a5fa', opacity: block.locked ? 1 : 0.9 }}
            onClick={() => onEditBlock(block)}
          >
            <div className="flex items-center gap-1">
              {block.locked && <Lock size={9} className="flex-shrink-0 opacity-80" />}
              {isRecurring(block) && <Repeat size={9} className="flex-shrink-0 opacity-80" />}
              <p className="font-medium truncate leading-tight flex-1">{block.title}</p>
              {participants.length > 0 && (
                <ParticipantBubbles ids={participants} people={people} max={3} />
              )}
            </div>
            <p className="opacity-70 text-[11px]">{block.start_time} – {block.end_time}</p>
            {participants.length > 0 && height >= 48 && (
              <p className="opacity-70 text-[10px] truncate">
                {participants.map(id => people.find(p => p.id === id)?.name?.split(' ')[0]).filter(Boolean).join(', ')}
              </p>
            )}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); onEditBlock(block) }}
                className="hover:opacity-80"
              >
                <Pencil size={10} />
              </button>
              {!block.locked && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteBlock(block) }}
                  className="hover:opacity-80"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            {block.locked && (
              <span className="absolute bottom-0.5 right-1.5 opacity-40 text-[10px]">travado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Agenda({ tasks, people = [], externalEvents = [], blocksApi, onCreateGoogleEvent, onEditTask }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [modal, setModal] = useState(null)          // null | 'new' | occurrence (edição)
  const [scopeAsk, setScopeAsk] = useState(null)    // null | { mode: 'edit'|'delete', block, patch? }

  const { occurrencesFor, createBlock, updateBlock, deleteBlock } = blocksApi

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const dayBlocks = occurrencesFor(selectedDateStr, selectedDateStr)

  async function handleSaveNew(form) {
    await createBlock(form)
    setModal(null)
  }

  // Edição vinda do modal: se a série é recorrente, pergunta o escopo
  function handleUpdateRequest(form) {
    const occurrence = modal
    if (isRecurring(occurrence)) {
      setModal(null)
      setScopeAsk({ mode: 'edit', block: occurrence, patch: form })
    } else {
      updateBlock(occurrence, form).then(() => setModal(null))
    }
  }

  function handleDeleteRequest(occurrence) {
    if (isRecurring(occurrence)) {
      setScopeAsk({ mode: 'delete', block: occurrence })
    } else {
      deleteBlock(occurrence)
    }
  }

  async function resolveScope(scope) {
    const { mode, block, patch } = scopeAsk
    setScopeAsk(null)
    if (mode === 'edit') {
      if (scope === 'single') {
        await updateBlock(block, patch, { scope: 'single', date: block.date })
      } else {
        const seriesPatch = { ...patch }
        delete seriesPatch.id
        delete seriesPatch.date // preserva a data de origem da série
        await updateBlock(block, seriesPatch)
      }
    } else {
      if (scope === 'single') {
        await deleteBlock(block, { scope: 'single', date: block.date })
      } else {
        await deleteBlock(block)
      }
    }
  }

  const dayExternalEvents = externalEvents.filter(e => e.date === selectedDateStr)
  const allDayEvents = dayExternalEvents.filter(e => e.all_day || !e.start_time)
  const timedExternalEvents = dayExternalEvents.filter(e => !e.all_day && e.start_time)

  const dueTasks = tasks.filter(t => t.due_date === selectedDateStr && !DONE_STATUSES.includes(t.status))

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="h-full flex flex-col">
      {/* Week strip */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-notion-border flex-shrink-0">
        <button onClick={() => setWeekStart(w => addDays(w, -7))} className="btn-ghost p-1.5">
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 gap-1">
          {weekDays.map(day => {
            const ds = format(day, 'yyyy-MM-dd')
            const hasTasks = tasks.some(t => t.due_date === ds && !DONE_STATUSES.includes(t.status))
            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`flex-1 rounded-md py-1.5 text-center transition-colors relative ${
                  isSameDay(day, selectedDate)
                    ? 'bg-notion-text text-white'
                    : isToday(day)
                    ? 'bg-notion-hover text-notion-text font-semibold'
                    : 'hover:bg-notion-surface text-notion-sub'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide opacity-70">
                  {format(day, 'EEE', { locale: ptBR })}
                </div>
                <div className="text-sm font-semibold">{format(day, 'd')}</div>
                {hasTasks && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSameDay(day, selectedDate) ? 'bg-white/60' : 'bg-blue-400'}`} />
                )}
              </button>
            )
          })}
        </div>
        <button onClick={() => setWeekStart(w => addDays(w, 7))} className="btn-ghost p-1.5">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-notion-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-notion-text capitalize">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <p className="text-xs text-notion-muted">
            {dayBlocks.length} bloco{dayBlocks.length !== 1 ? 's' : ''}
            {dueTasks.length > 0 && ` · ${dueTasks.length} tarefa${dueTasks.length !== 1 ? 's' : ''}`}
            {dayExternalEvents.length > 0 && ` · ${dayExternalEvents.length} externo${dayExternalEvents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCreateGoogleEvent && (
            <button
              onClick={() => onCreateGoogleEvent({ date: selectedDateStr, title: '' })}
              className="btn-ghost py-1.5 px-3 text-xs"
              title="Criar evento no Google Calendar"
            >
              🔵 Google
            </button>
          )}
          <button onClick={() => setModal('new')} className="btn-ghost py-2 px-4">
            <Plus size={13} /> Bloco
          </button>
        </div>
      </div>

      {/* Tasks due today */}
      {dueTasks.length > 0 && (
        <div className="px-6 py-2 border-b border-notion-border flex-shrink-0 flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wide text-notion-muted font-medium">Tarefas do dia</p>
          <div className="flex flex-wrap gap-1.5">
            {dueTasks.map(task => {
              const statusCfg = STATUS_CONFIG[task.status]
              const delegatedPerson = task.delegated_to ? people.find(p => p.id === task.delegated_to) : null
              return (
                <button
                  key={task.id}
                  onClick={() => onEditTask?.(task)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-notion-border hover:border-notion-border2 hover:bg-notion-surface transition-colors text-notion-text"
                  style={{ borderLeft: `3px solid ${Q_COLORS[task.quadrant] || '#9b9a97'}` }}
                >
                  <span className="truncate max-w-[160px]">{task.title}</span>
                  {statusCfg && task.status !== 'pending' && (
                    <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  )}
                  {delegatedPerson && (
                    <span className="flex items-center gap-0.5 text-notion-muted">
                      <User size={9} /> {delegatedPerson.name.split(' ')[0]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* All-day external events banner */}
      {allDayEvents.length > 0 && (
        <div className="px-6 py-1.5 border-b border-notion-border flex-shrink-0 flex flex-wrap gap-1.5">
          {allDayEvents.map(ev => (
            <a
              key={ev.id}
              href={ev.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md text-notion-sub hover:text-notion-text"
              style={{ border: '1px dashed #d1d0ce', background: 'rgba(155,154,151,0.07)' }}
            >
              <span>{PROVIDER_ICONS[ev.provider] || '📅'}</span>
              <span className="truncate max-w-[140px]">{ev.title}</span>
              {ev.url && <ExternalLinkIcon size={9} className="flex-shrink-0 opacity-50" />}
            </a>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <TimeGrid
          blocks={dayBlocks}
          externalEvents={timedExternalEvents}
          people={people}
          onDeleteBlock={handleDeleteRequest}
          onEditBlock={block => setModal(block)}
        />
      </div>

      {modal && (
        <BlockModal
          date={selectedDate}
          tasks={tasks}
          people={people}
          initialBlock={modal === 'new' ? null : modal}
          onSave={handleSaveNew}
          onUpdate={handleUpdateRequest}
          onClose={() => setModal(null)}
        />
      )}

      {scopeAsk && (
        <ScopeDialog
          mode={scopeAsk.mode}
          blockTitle={scopeAsk.block.title}
          onSingle={() => resolveScope('single')}
          onSeries={() => resolveScope('series')}
          onClose={() => setScopeAsk(null)}
        />
      )}
    </div>
  )
}
