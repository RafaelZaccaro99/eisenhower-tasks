import React, { useState } from 'react'
import { X, Lock, Repeat, Users, AlertCircle } from 'lucide-react'
import { DONE_STATUSES, Q_COLORS } from '../../utils/statusConfig'

const RECURRENCE_LABELS = {
  none: 'Não repete',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
}

// Modal de criação/edição de bloco.
// defaultDate: 'YYYY-MM-DD' usado na criação; prefill pode trazer date/start/end (drag na grade).
export default function BlockModal({ defaultDate, prefill, tasks, people, initialBlock, onSave, onUpdate, onClose }) {
  const isEdit = !!initialBlock?.id
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => {
    const base = {
      task_id: '', title: '', start_time: '09:00', end_time: '10:00',
      color: '#60a5fa', locked: false, recurrence: 'none', recurrence_end: '',
      participants: [], date: defaultDate,
    }
    if (initialBlock) {
      return {
        ...base,
        ...initialBlock,
        participants: Array.isArray(initialBlock.participants) ? initialBlock.participants : [],
      }
    }
    return { ...base, ...(prefill || {}) }
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
    if (isEdit) onUpdate({ ...form })
    else onSave({ ...form })
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

          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={form.date}
              onChange={e => set('date', e.target.value)} required />
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
