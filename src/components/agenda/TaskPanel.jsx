import React, { useState, useMemo } from 'react'
import { Search, X, GripVertical, AlertCircle } from 'lucide-react'
import { DONE_STATUSES, Q_COLORS } from '../../utils/statusConfig'

// Painel lateral de tarefas pendentes — arraste (desktop) ou toque (modo
// "posicionar") para agendar a tarefa como bloco na grade.
export default function TaskPanel({ tasks, placingTask, onStartPlacing, onCancelPlacing, onClose, variant = 'side' }) {
  const [search, setSearch] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const pending = useMemo(() => {
    const list = tasks.filter(t => !DONE_STATUSES.includes(t.status))
    const filtered = search
      ? list.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
      : list
    // atrasadas > hoje > com prazo > sem prazo
    const rank = t => {
      if (!t.due_date) return 3
      if (t.due_date < today) return 0
      if (t.due_date === today) return 1
      return 2
    }
    return [...filtered].sort((a, b) => rank(a) - rank(b) || (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  }, [tasks, search, today])

  const rootClass = variant === 'sheet'
    ? 'fixed inset-x-0 bottom-0 z-40 max-h-[50dvh] rounded-t-2xl border-t border-notion-border flex flex-col bg-white shadow-2xl'
    : 'w-64 border-l border-notion-border flex flex-col flex-shrink-0 bg-white'

  return (
    <div className={rootClass}>
      <div className="px-3 py-2 border-b border-notion-border flex items-center gap-2 flex-shrink-0">
        <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide flex-1">Tarefas</h3>
        <button onClick={onClose} className="text-notion-muted hover:text-notion-text p-0.5">
          <X size={13} />
        </button>
      </div>

      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-muted pointer-events-none" />
          <input
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-notion-border rounded-md bg-notion-surface focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {placingTask && (
        <div className="mx-3 mb-2 px-2.5 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-1.5 flex-shrink-0">
          <span className="flex-1">Toque na grade para agendar "{placingTask.title}"</span>
          <button onClick={onCancelPlacing} className="text-amber-500 hover:text-amber-700"><X size={12} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1">
        {pending.length === 0 && (
          <p className="text-xs text-notion-placeholder px-2 py-3">Nenhuma tarefa pendente</p>
        )}
        {pending.map(task => {
          const overdue = task.due_date && task.due_date < today
          const isPlacing = placingTask?.id === task.id
          return (
            <div
              key={task.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/x-task-id', task.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => (isPlacing ? onCancelPlacing() : onStartPlacing(task))}
              className={`flex items-start gap-1.5 px-2 py-1.5 rounded-md border text-xs cursor-grab active:cursor-grabbing select-none transition-colors ${
                isPlacing
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-notion-border hover:border-notion-border2 hover:bg-notion-surface'
              }`}
              style={{ borderLeft: `3px solid ${Q_COLORS[task.quadrant] || '#9b9a97'}` }}
              title="Arraste para a grade ou toque para posicionar"
            >
              <GripVertical size={11} className="text-notion-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-notion-text truncate leading-tight">{task.title}</p>
                {task.due_date && (
                  <p className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500' : 'text-notion-muted'}`}>
                    {overdue && <AlertCircle size={9} />}
                    {task.due_date === today ? 'hoje' : task.due_date.split('-').reverse().slice(0, 2).join('/')}
                    {overdue && ' · atrasada'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
