import React from 'react'
import { Check, Plus, Trash2, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const QUADRANTS = [
  { key: 'q1', label: 'Fazer agora',  sub: 'Urgente · Importante',         dot: 'bg-red-400',          chip: 'bg-red-50 text-red-500' },
  { key: 'q2', label: 'Agendar',      sub: 'Não urgente · Importante',     dot: 'bg-blue-400',         chip: 'bg-blue-50 text-blue-500' },
  { key: 'q3', label: 'Delegar',      sub: 'Urgente · Não importante',     dot: 'bg-amber-400',        chip: 'bg-amber-50 text-amber-600' },
  { key: 'q4', label: 'Eliminar',     sub: 'Não urgente · Não importante', dot: 'bg-notion-border2',   chip: 'bg-notion-surface text-notion-muted' },
]

function TaskRow({ task, q, person, onEdit, onDelete, onToggle }) {
  const done = task.status === 'completed'
  return (
    <div className="task-row group" onClick={() => onEdit(task)}>
      <button
        onClick={e => { e.stopPropagation(); onToggle(task) }}
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
          done ? 'bg-notion-text border-notion-text' : 'border-notion-border2 hover:border-notion-sub'
        }`}
      >
        {done && <Check size={10} strokeWidth={3} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm leading-5 ${done ? 'line-through text-notion-muted' : 'text-notion-text'}`}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.due_date && (
            <span className="text-xs text-notion-muted">
              {format(new Date(task.due_date + 'T00:00:00'), "d MMM", { locale: ptBR })}
            </span>
          )}
          {task.category && task.category !== 'geral' && (
            <span className={`chip ${q.chip}`}>{task.category}</span>
          )}
          {person && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              <User size={10} /> {person.name.split(' ')[0]}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(task.id) }}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-notion-muted hover:text-red-400 transition-all p-0.5"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function Matrix({ tasks, people = [], onNew, onEdit, onDelete, onToggle }) {
  const byQ = key => tasks.filter(t => t.quadrant === key)
  const findPerson = id => people.find(p => p.id === id)

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 divide-x divide-y divide-notion-border">
      {QUADRANTS.map(q => {
        const qTasks = byQ(q.key)
        const pending = qTasks.filter(t => t.status !== 'completed').length
        return (
          <div key={q.key} className="flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.dot}`} />
                <div>
                  <h3 className="text-sm font-semibold text-notion-text leading-tight">{q.label}</h3>
                  <p className="text-xs text-notion-muted">{q.sub}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pending > 0 && <span className="text-xs text-notion-muted tabular-nums">{pending}</span>}
                <button onClick={() => onNew(q.key)} className="text-notion-muted hover:text-notion-text transition-colors">
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {qTasks.length === 0 ? (
                <p className="text-xs text-notion-placeholder px-3 py-2 cursor-pointer hover:text-notion-muted transition-colors"
                  onClick={() => onNew(q.key)}>
                  + Adicionar tarefa
                </p>
              ) : (
                qTasks.map(t => (
                  <TaskRow
                    key={t.id} task={t} q={q}
                    person={t.delegated_to ? findPerson(t.delegated_to) : null}
                    onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
