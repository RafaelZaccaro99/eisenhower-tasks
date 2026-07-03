import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Repeat, ExternalLink as ExternalLinkIcon, User, ListTodo } from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, isToday, differenceInCalendarDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DONE_STATUSES, STATUS_CONFIG, Q_COLORS } from '../utils/statusConfig'
import TimeGrid, { minutesToHHMM, hhmmToMinutes } from './agenda/TimeGrid'
import BlockModal from './agenda/BlockModal'
import TaskPanel from './agenda/TaskPanel'

const PROVIDER_ICONS = { google: '🔵', clickup: '🟣', jira: '🔷', ical: '📅' }

function isRecurring(block) {
  return block.recurrence && block.recurrence !== 'none'
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

export default function Agenda({ tasks, people = [], clients = [], externalEvents = [], blocksApi, onCreateGoogleEvent, onEditTask }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('eisenhower-agenda-view') || 'day')
  const [showPanel, setShowPanel] = useState(() => localStorage.getItem('eisenhower-agenda-panel') === '1')
  const [placingTask, setPlacingTask] = useState(null)
  const [filterClient, setFilterClient] = useState('')
  const [modal, setModal] = useState(null)          // null | {type:'new', prefill?} | {type:'edit', block}
  const [scopeAsk, setScopeAsk] = useState(null)    // null | { mode: 'edit'|'delete', block, patch? }

  useEffect(() => { localStorage.setItem('eisenhower-agenda-view', viewMode) }, [viewMode])
  useEffect(() => { localStorage.setItem('eisenhower-agenda-panel', showPanel ? '1' : '0') }, [showPanel])

  const { occurrencesFor, createBlock, updateBlock, deleteBlock } = blocksApi

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekDays[0], 'yyyy-MM-dd')
  const weekEndStr = format(weekDays[6], 'yyyy-MM-dd')

  const isWeek = viewMode === 'week'
  const rangeStart = isWeek ? weekStartStr : selectedDateStr
  const rangeEnd = isWeek ? weekEndStr : selectedDateStr

  const occurrences = occurrencesFor(rangeStart, rangeEnd)
    .filter(b => !filterClient || b.client_id === filterClient)

  const days = (isWeek ? weekDays : [selectedDate]).map(d => {
    const ds = format(d, 'yyyy-MM-dd')
    return {
      date: d,
      dateStr: ds,
      blocks: occurrences.filter(b => b.date === ds),
      externalEvents: externalEvents.filter(e => e.date === ds),
    }
  })

  // ── Ações ────────────────────────────────────────────────
  async function handleSaveNew(form) {
    await createBlock(form)
    setModal(null)
  }

  function handleUpdateRequest(form) {
    const occurrence = modal.block
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

  function handleMoveBlock(occurrence, newDateStr, startMin) {
    const dur = Math.max(15, hhmmToMinutes(occurrence.end_time) - hhmmToMinutes(occurrence.start_time))
    const patch = {
      date: newDateStr,
      start_time: minutesToHHMM(startMin),
      end_time: minutesToHHMM(Math.min(24 * 60, startMin + dur)),
    }
    if (isRecurring(occurrence)) setScopeAsk({ mode: 'edit', block: occurrence, patch })
    else updateBlock(occurrence, patch)
  }

  function handleResizeBlock(occurrence, endMin) {
    const patch = { end_time: minutesToHHMM(endMin) }
    if (isRecurring(occurrence)) setScopeAsk({ mode: 'edit', block: occurrence, patch })
    else updateBlock(occurrence, patch)
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
        if (seriesPatch.date && seriesPatch.date !== block.date) {
          // mover a série inteira: desloca a origem pelo mesmo nº de dias
          const delta = differenceInCalendarDays(parseISO(seriesPatch.date), parseISO(block.date))
          const origin = parseISO(block.seriesDate || block.date)
          seriesPatch.date = format(addDays(origin, delta), 'yyyy-MM-dd')
        } else {
          delete seriesPatch.date // preserva a data de origem da série
        }
        await updateBlock(block, seriesPatch)
      }
    } else {
      if (scope === 'single') await deleteBlock(block, { scope: 'single', date: block.date })
      else await deleteBlock(block)
    }
  }

  function scheduleTask(taskId, dateStr, startMin) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    createBlock({
      task_id: task.id,
      title: task.title,
      color: Q_COLORS[task.quadrant] || '#60a5fa',
      date: dateStr,
      start_time: minutesToHHMM(startMin),
      end_time: minutesToHHMM(Math.min(24 * 60, startMin + 60)),
    })
  }

  function handlePlaceTask(dateStr, startMin) {
    if (!placingTask) return
    scheduleTask(placingTask.id, dateStr, startMin)
    setPlacingTask(null)
  }

  // ── Dados derivados (visão dia) ──────────────────────────
  const dayExternalEvents = externalEvents.filter(e => e.date === selectedDateStr)
  const allDayEvents = dayExternalEvents.filter(e => e.all_day || !e.start_time)
  const dueTasks = tasks.filter(t => t.due_date === selectedDateStr && !DONE_STATUSES.includes(t.status))
  const dayBlockCount = days.reduce((n, d) => n + d.blocks.length, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Week strip / navegação */}
      <div className="flex items-center gap-1 px-4 md:px-6 py-3 border-b border-notion-border flex-shrink-0">
        <button onClick={() => setWeekStart(w => addDays(w, -7))} className="btn-ghost p-1.5">
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 gap-1">
          {weekDays.map(day => {
            const ds = format(day, 'yyyy-MM-dd')
            const hasTasks = tasks.some(t => t.due_date === ds && !DONE_STATUSES.includes(t.status))
            const active = !isWeek && isSameDay(day, selectedDate)
            return (
              <button
                key={day.toString()}
                onClick={() => { setSelectedDate(day); if (isWeek) setViewMode('day') }}
                className={`flex-1 rounded-md py-1.5 text-center transition-colors relative ${
                  active
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
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${active ? 'bg-white/60' : 'bg-blue-400'}`} />
                )}
              </button>
            )
          })}
        </div>
        <button onClick={() => setWeekStart(w => addDays(w, 7))} className="btn-ghost p-1.5">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Header do dia/semana */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-notion-border flex-shrink-0 gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-notion-text capitalize truncate">
            {isWeek
              ? `${format(weekDays[0], 'd MMM', { locale: ptBR })} – ${format(weekDays[6], "d 'de' MMMM", { locale: ptBR })}`
              : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <p className="text-xs text-notion-muted">
            {dayBlockCount} bloco{dayBlockCount !== 1 ? 's' : ''}
            {!isWeek && dueTasks.length > 0 && ` · ${dueTasks.length} tarefa${dueTasks.length !== 1 ? 's' : ''}`}
            {!isWeek && dayExternalEvents.length > 0 && ` · ${dayExternalEvents.length} externo${dayExternalEvents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {clients.length > 0 && (
            <select
              className="hidden sm:block text-xs border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="">Cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {/* Toggle Dia | Semana */}
          <div className="flex rounded-md border border-notion-border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('day')}
              className={`px-2.5 py-1.5 font-medium transition-colors ${!isWeek ? 'bg-notion-text text-white' : 'text-notion-muted hover:bg-notion-surface'}`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1.5 font-medium transition-colors ${isWeek ? 'bg-notion-text text-white' : 'text-notion-muted hover:bg-notion-surface'}`}
            >
              Semana
            </button>
          </div>
          <button
            onClick={() => setShowPanel(v => !v)}
            title="Painel de tarefas"
            className={`btn-ghost p-1.5 ${showPanel ? 'bg-notion-hover text-notion-text' : ''}`}
          >
            <ListTodo size={14} />
          </button>
          {onCreateGoogleEvent && (
            <button
              onClick={() => onCreateGoogleEvent({ date: selectedDateStr, title: '' })}
              className="btn-ghost py-1.5 px-2.5 text-xs hidden sm:flex"
              title="Criar evento no Google Calendar"
            >
              🔵 Google
            </button>
          )}
          <button onClick={() => setModal({ type: 'new' })} className="btn-ghost py-1.5 px-3">
            <Plus size={13} /> <span className="hidden sm:inline">Bloco</span>
          </button>
        </div>
      </div>

      {/* Tarefas do dia (visão dia) — arrastáveis para a grade */}
      {!isWeek && dueTasks.length > 0 && (
        <div className="px-4 md:px-6 py-2 border-b border-notion-border flex-shrink-0 flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wide text-notion-muted font-medium">Tarefas do dia</p>
          <div className="flex flex-wrap gap-1.5">
            {dueTasks.map(task => {
              const statusCfg = STATUS_CONFIG[task.status]
              const delegatedPerson = task.delegated_to ? people.find(p => p.id === task.delegated_to) : null
              return (
                <button
                  key={task.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/x-task-id', task.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => onEditTask?.(task)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-notion-border hover:border-notion-border2 hover:bg-notion-surface transition-colors text-notion-text cursor-grab active:cursor-grabbing"
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

      {/* Eventos externos de dia inteiro (visão dia) */}
      {!isWeek && allDayEvents.length > 0 && (
        <div className="px-4 md:px-6 py-1.5 border-b border-notion-border flex-shrink-0 flex flex-wrap gap-1.5">
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

      {/* Corpo: grade (+ painel lateral no desktop) */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className={`flex-1 min-w-0 overflow-x-auto flex flex-col ${isWeek ? '' : ''}`}>
          <div className={`h-full flex flex-col ${isWeek ? 'min-w-[640px]' : ''}`}>
            {/* Cabeçalho das colunas (semana) */}
            {isWeek && (
              <div className="flex border-b border-notion-border flex-shrink-0">
                <div className="w-14 flex-shrink-0" />
                {days.map(day => {
                  const dayAllDay = (day.externalEvents || []).filter(e => e.all_day || !e.start_time)
                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => { setSelectedDate(day.date); setViewMode('day') }}
                      className={`flex-1 border-l border-notion-border px-1 py-1.5 text-center hover:bg-notion-surface transition-colors ${
                        isToday(day.date) ? 'bg-notion-hover' : ''
                      }`}
                    >
                      <span className={`text-[11px] uppercase tracking-wide ${isToday(day.date) ? 'text-notion-text font-semibold' : 'text-notion-muted'}`}>
                        {format(day.date, 'EEE d', { locale: ptBR })}
                      </span>
                      {dayAllDay.length > 0 && (
                        <span className="block text-[9px] text-notion-muted truncate">
                          {dayAllDay.length} dia inteiro
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <TimeGrid
              days={days}
              people={people}
              onEditBlock={block => setModal({ type: 'edit', block })}
              onDeleteBlock={handleDeleteRequest}
              onCreateAt={({ dateStr, start_time, end_time }) => setModal({ type: 'new', prefill: { date: dateStr, start_time, end_time } })}
              onMoveBlock={handleMoveBlock}
              onResizeBlock={handleResizeBlock}
              onDropTask={scheduleTask}
              placingTask={placingTask}
              onPlaceTask={handlePlaceTask}
            />
          </div>
        </div>

        {/* Painel lateral de tarefas (desktop) */}
        {showPanel && (
          <div className="hidden md:flex">
            <TaskPanel
              tasks={tasks}
              placingTask={placingTask}
              onStartPlacing={setPlacingTask}
              onCancelPlacing={() => setPlacingTask(null)}
              onClose={() => setShowPanel(false)}
            />
          </div>
        )}
      </div>

      {/* Painel de tarefas mobile — bottom sheet */}
      {showPanel && (
        <div className="md:hidden">
          <TaskPanel
            variant="sheet"
            tasks={tasks}
            placingTask={placingTask}
            onStartPlacing={t => { setPlacingTask(t); setShowPanel(false) }}
            onCancelPlacing={() => setPlacingTask(null)}
            onClose={() => setShowPanel(false)}
          />
        </div>
      )}

      {/* Banner de posicionamento (mobile, painel fechado) */}
      {placingTask && !showPanel && (
        <div className="md:hidden fixed bottom-16 inset-x-3 z-40 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2 shadow-lg">
          <span className="flex-1">Toque na grade para agendar "{placingTask.title}"</span>
          <button onClick={() => setPlacingTask(null)} className="text-amber-500 font-medium">Cancelar</button>
        </div>
      )}

      {modal && (
        <BlockModal
          defaultDate={selectedDateStr}
          prefill={modal.prefill}
          tasks={tasks}
          people={people}
          clients={clients}
          initialBlock={modal.type === 'edit' ? modal.block : null}
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
