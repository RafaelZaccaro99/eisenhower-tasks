import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Lock, Repeat } from 'lucide-react'
import { format, addDays, addWeeks, addMonths, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { v4 as uuidv4 } from 'uuid'

const Q_COLORS = { q1: '#f87171', q2: '#60a5fa', q3: '#fbbf24', q4: '#9b9a97' }
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const pad = n => String(n).padStart(2, '0')

const RECURRENCE_LABELS = {
  none: 'Não repete',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
}

// Checks if a recurring block applies to the given date
function recurrenceMatchesDate(block, dateStr) {
  if (!block.recurrence || block.recurrence === 'none') return block.date === dateStr
  const origin = parseISO(block.date)
  const target = parseISO(dateStr)
  if (target < origin) return false
  if (block.recurrence_end && dateStr > block.recurrence_end) return false
  if (block.recurrence === 'daily') return true
  if (block.recurrence === 'weekly') {
    return origin.getDay() === target.getDay()
  }
  if (block.recurrence === 'monthly') {
    return origin.getDate() === target.getDate()
  }
  return false
}

function BlockModal({ date, tasks, onSave, onClose }) {
  const [form, setForm] = useState({
    task_id: '', title: '', start_time: '09:00', end_time: '10:00',
    color: '#60a5fa', locked: false, recurrence: 'none', recurrence_end: '',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <form
        onSubmit={e => { e.preventDefault(); onSave({ id: uuidv4(), ...form, date: format(date, 'yyyy-MM-dd') }) }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)' }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-notion-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-notion-text">Novo bloco</h2>
          <button type="button" onClick={onClose} className="text-notion-muted hover:text-notion-text"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Task link */}
          <div>
            <label className="label">Vincular tarefa</label>
            <select className="input" value={form.task_id} onChange={handleTaskChange}>
              <option value="">— bloco livre —</option>
              {tasks.filter(t => t.status !== 'completed').map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="label">Título *</label>
            <input className="input" value={form.title} required
              onChange={e => set('title', e.target.value)} placeholder="Ex: Reunião de equipe" />
          </div>

          {/* Times */}
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

          {/* Recurrence */}
          <div>
            <label className="label">Recorrência</label>
            <select className="input" value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
              {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Recurrence end */}
          {form.recurrence !== 'none' && (
            <div>
              <label className="label">Repetir até (opcional)</label>
              <input type="date" className="input" value={form.recurrence_end}
                onChange={e => set('recurrence_end', e.target.value)} />
            </div>
          )}

          {/* Locked toggle */}
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
          <button type="submit" className="btn-primary">Adicionar</button>
        </div>
      </form>
    </div>
  )
}

function TimeGrid({ blocks, onDeleteBlock }) {
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
      {blocks.map(block => {
        const [sh, sm] = block.start_time.split(':').map(Number)
        const [eh, em] = block.end_time.split(':').map(Number)
        const top = (sh + sm / 60) * 56
        const height = Math.max(((eh + em / 60) - (sh + sm / 60)) * 56, 24)
        return (
          <div
            key={block.id + block.date}
            className="absolute left-16 right-3 rounded-md px-2.5 py-1 text-white text-xs overflow-hidden group"
            style={{ top, height, backgroundColor: block.color || '#60a5fa', opacity: block.locked ? 1 : 0.9 }}
          >
            <div className="flex items-center gap-1">
              {block.locked && <Lock size={9} className="flex-shrink-0 opacity-80" />}
              {(block.recurrence && block.recurrence !== 'none') && <Repeat size={9} className="flex-shrink-0 opacity-80" />}
              <p className="font-medium truncate leading-tight flex-1">{block.title}</p>
            </div>
            <p className="opacity-70 text-[11px]">{block.start_time} – {block.end_time}</p>
            {!block.locked && (
              <button
                onClick={() => onDeleteBlock(block.id)}
                className="absolute top-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} />
              </button>
            )}
            {block.locked && (
              <span className="absolute top-1 right-1.5 opacity-40 text-[10px]">travado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Agenda({ tasks }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [blocks, setBlocks] = useState([])
  const [showModal, setShowModal] = useState(false)

  const ipc = window.api?.agenda

  function lsReadBlocks() {
    try { return JSON.parse(localStorage.getItem('eisenhower-blocks') || '[]') } catch { return [] }
  }
  function lsWriteBlocks(b) { localStorage.setItem('eisenhower-blocks', JSON.stringify(b)) }

  async function loadBlocks(date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (ipc) {
      setBlocks(await ipc.getByDate(dateStr))
    } else {
      const all = lsReadBlocks()
      const matched = all.filter(b => recurrenceMatchesDate(b, dateStr))
      setBlocks(matched)
    }
  }

  useEffect(() => { loadBlocks(selectedDate) }, [selectedDate])

  async function handleSaveBlock(block) {
    if (ipc) await ipc.create(block)
    else lsWriteBlocks([...lsReadBlocks(), block])
    await loadBlocks(selectedDate)
    setShowModal(false)
  }

  async function handleDeleteBlock(id) {
    const all = lsReadBlocks()
    const block = all.find(b => b.id === id)
    if (block?.locked) return // safety: never delete locked
    if (ipc) await ipc.delete(id)
    else lsWriteBlocks(all.filter(b => b.id !== id))
    await loadBlocks(selectedDate)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="h-full flex flex-col">
      {/* Week strip */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-notion-border flex-shrink-0">
        <button onClick={() => setWeekStart(w => addDays(w, -7))} className="btn-ghost p-1.5">
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 gap-1">
          {weekDays.map(day => (
            <button
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={`flex-1 rounded-md py-1.5 text-center transition-colors ${
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
            </button>
          ))}
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
          <p className="text-xs text-notion-muted">{blocks.length} bloco{blocks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-ghost">
          <Plus size={13} /> Bloco
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <TimeGrid blocks={blocks} onDeleteBlock={handleDeleteBlock} />
      </div>

      {showModal && (
        <BlockModal date={selectedDate} tasks={tasks} onSave={handleSaveBlock} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
