import React, { useState } from 'react'
import { Check, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { format, startOfWeek, endOfWeek, parseISO, addWeeks, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const Q_INFO = {
  q1: { label: 'Fez agora',  color: 'text-red-500',         bg: 'bg-red-50',          dot: 'bg-red-400'         },
  q2: { label: 'Agendou',    color: 'text-blue-500',        bg: 'bg-blue-50',         dot: 'bg-blue-400'        },
  q3: { label: 'Delegou',    color: 'text-amber-500',       bg: 'bg-amber-50',        dot: 'bg-amber-400'       },
  q4: { label: 'Eliminou',   color: 'text-notion-muted',    bg: 'bg-notion-surface',  dot: 'bg-notion-border2'  },
}

function StatCard({ label, value, color = 'text-notion-text', dot }) {
  return (
    <div className="bg-notion-surface rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        {dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />}
        <p className="text-xs text-notion-muted">{label}</p>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function WeekGroup({ weekLabel, tasks, onRestore, onDelete }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-1.5 text-xs font-medium text-notion-muted uppercase tracking-wide mb-2 hover:text-notion-sub transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {weekLabel} · {tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}
      </button>
      {open && tasks.map(task => {
        const q = Q_INFO[task.quadrant] || Q_INFO.q4
        return (
          <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-notion-surface group transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${q.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-notion-muted line-through truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${q.bg} ${q.color}`}>{q.label}</span>
                {task.category && task.category !== 'geral' && (
                  <span className="text-xs text-notion-muted">{task.category}</span>
                )}
                {task.due_date && (
                  <span className="text-xs text-notion-muted">
                    prazo: {format(new Date(task.due_date + 'T00:00:00'), "d MMM", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onRestore(task)}
                title="Reabrir tarefa"
                className="p-1 text-notion-muted hover:text-blue-500 transition-colors"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                title="Excluir permanentemente"
                className="p-1 text-notion-muted hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function History({ tasks, onDelete, onToggle }) {
  const completed = tasks.filter(t => t.status === 'completed')
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const thisWeek = completed.filter(t => {
    try {
      const d = parseISO(t.created_at)
      return d >= weekStart
    } catch { return false }
  })

  const byQ = q => completed.filter(t => t.quadrant === q)

  // Group by week (last 8 weeks)
  const weeks = []
  for (let i = 0; i < 8; i++) {
    const wStart = addWeeks(weekStart, -i)
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 })
    const wTasks = completed
      .filter(t => {
        try {
          return isWithinInterval(parseISO(t.created_at), { start: wStart, end: wEnd })
        } catch { return i === 0 }
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    if (wTasks.length > 0) {
      const label = i === 0
        ? 'Esta semana'
        : i === 1
        ? 'Semana passada'
        : format(wStart, "'Semana de' d 'de' MMMM", { locale: ptBR })
      weeks.push({ label, tasks: wTasks })
    }
  }

  // Tasks older than 8 weeks
  const cutoff = addWeeks(weekStart, -8)
  const older = completed.filter(t => {
    try { return parseISO(t.created_at) < cutoff }
    catch { return false }
  })
  if (older.length > 0) {
    weeks.push({ label: 'Mais antigas', tasks: older })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-notion-text">Histórico</h2>
          <p className="text-xs text-notion-muted">{completed.length} tarefa{completed.length !== 1 ? 's' : ''} concluída{completed.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-notion-border flex-shrink-0">
        <StatCard label="Total" value={completed.length} />
        <StatCard label="Esta semana" value={thisWeek.length} color="text-green-600" />
        {['q1', 'q2', 'q3', 'q4'].map(q => (
          <StatCard
            key={q}
            label={Q_INFO[q].label}
            value={byQ(q).length}
            color={Q_INFO[q].color}
            dot={Q_INFO[q].dot}
          />
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Check size={32} className="text-notion-border2" />
            <p className="text-sm text-notion-muted">Nenhuma tarefa concluída ainda</p>
            <p className="text-xs text-notion-muted">Conclua tarefas na Matriz para vê-las aqui</p>
          </div>
        ) : (
          weeks.map(week => (
            <WeekGroup
              key={week.label}
              weekLabel={week.label}
              tasks={week.tasks}
              onRestore={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
