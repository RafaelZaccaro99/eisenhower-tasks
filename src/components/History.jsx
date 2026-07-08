import React, { useState, useMemo } from 'react'
import { Check, Trash2, RotateCcw, ChevronDown, ChevronRight, Download, Timer, TrendingUp, AlertTriangle } from 'lucide-react'
import { format, startOfWeek, endOfWeek, parseISO, addWeeks, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { STATUS_CONFIG, DONE_STATUSES } from '../utils/statusConfig'
import { computeSLA } from '../utils/sla'

const Q_INFO = {
  q1: { label: 'Fez agora',  color: 'text-red-500',         bg: 'bg-red-50',          dot: 'bg-red-400'         },
  q2: { label: 'Agendou',    color: 'text-blue-500',        bg: 'bg-blue-50',         dot: 'bg-blue-400'        },
  q3: { label: 'Delegou',    color: 'text-amber-500',       bg: 'bg-amber-50',        dot: 'bg-amber-400'       },
  q4: { label: 'Eliminou',   color: 'text-notion-muted',    bg: 'bg-notion-surface',  dot: 'bg-notion-border2'  },
}

function exportCSV(tasks, slaByTask) {
  const headers = ['Título', 'Status', 'Quadrante', 'Categoria', 'Prazo', 'Criada em', 'Lead Time (dias)', 'Cycle Time (dias)', 'SLA']
  const rows = tasks.map(t => {
    const sla = slaByTask[t.id] || {}
    return [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status || 'completed',
      Q_INFO[t.quadrant]?.label || t.quadrant,
      t.category || 'geral',
      t.due_date || '',
      t.created_at ? t.created_at.split('T')[0] : '',
      sla.leadTime !== null ? sla.leadTime : '',
      sla.cycleTime !== null ? sla.cycleTime : '',
      sla.slaOk === true ? 'No prazo' : sla.slaOk === false ? `Atrasada ${sla.daysLate}d` : '',
    ]
  })
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eisenhower-historico-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, color = 'text-notion-text', dot, sub }) {
  return (
    <div className="bg-notion-surface rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        {dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />}
        <p className="text-xs text-notion-muted">{label}</p>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-notion-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function WeekGroup({ weekLabel, tasks, slaByTask, onRestore, onDelete }) {
  const [open, setOpen] = useState(true)
  const [expandedTask, setExpandedTask] = useState(null)

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
        const sla = slaByTask[task.id] || {}
        const isCancelled = task.status === 'cancelled'
        const isExpanded = expandedTask === task.id

        return (
          <div key={task.id}>
            <div className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-notion-surface group transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${isCancelled ? 'bg-gray-300' : q.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isCancelled ? 'text-notion-muted' : 'text-notion-muted line-through'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {isCancelled ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">Cancelada</span>
                  ) : (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${q.bg} ${q.color}`}>{q.label}</span>
                  )}
                  {task.category && task.category !== 'geral' && (
                    <span className="text-xs text-notion-muted">{task.category}</span>
                  )}
                  {task.due_date && (
                    <span className="text-xs text-notion-muted">
                      prazo: {format(new Date(task.due_date + 'T00:00:00'), "d MMM", { locale: ptBR })}
                    </span>
                  )}
                  {/* SLA inline */}
                  {sla.leadTime !== null && (
                    <span className="text-xs text-notion-muted flex items-center gap-0.5">
                      <Timer size={10} /> {sla.leadTime}d
                    </span>
                  )}
                  {sla.slaOk === true && (
                    <span className="text-xs text-green-600 font-medium">✓ no prazo</span>
                  )}
                  {sla.slaOk === false && (
                    <span className="text-xs text-red-500 font-medium">+{sla.daysLate}d atrasada</span>
                  )}
                  {sla.history.length > 0 && (
                    <button
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      className="text-[10px] text-notion-muted hover:text-notion-sub flex items-center gap-0.5 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      histórico
                    </button>
                  )}
                </div>

                {/* Status history timeline */}
                {isExpanded && (
                  <div className="mt-2 pl-1 border-l-2 border-notion-border flex flex-col gap-1">
                    {sla.history.map((entry, i) => {
                      const fromCfg = STATUS_CONFIG[entry.from_status]
                      const toCfg   = STATUS_CONFIG[entry.to_status]
                      return (
                        <div key={entry.id || i} className="flex items-start gap-2 text-xs text-notion-muted pl-2">
                          <span className="text-[10px] text-notion-placeholder flex-shrink-0 pt-px">
                            {format(parseISO(entry.changed_at), "d MMM HH:mm", { locale: ptBR })}
                          </span>
                          <span className={`flex-shrink-0 ${fromCfg?.color || ''}`}>{fromCfg?.label || entry.from_status || '—'}</span>
                          <span className="flex-shrink-0 text-notion-placeholder">→</span>
                          <span className={`flex-shrink-0 font-medium ${toCfg?.color || ''}`}>{toCfg?.label || entry.to_status}</span>
                          {entry.note && <span className="italic text-notion-placeholder">({entry.note})</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
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
          </div>
        )
      })}
    </div>
  )
}

export default function History({ tasks, statusHistory = [], members = [], currentUserId = null, isManager = false, onDelete, onToggle }) {
  const [filterAssignee, setFilterAssignee] = useState('')
  const showTeamFeatures = isManager && members.length > 1
  const done = tasks.filter(t =>
    DONE_STATUSES.includes(t.status) && (!filterAssignee || t.assigned_to === filterAssignee)
  )
  const completed = done.filter(t => t.status === 'completed')
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const slaByTask = useMemo(() => {
    const map = {}
    done.forEach(t => { map[t.id] = computeSLA(t, statusHistory) })
    return map
  }, [done, statusHistory])

  const thisWeek = completed.filter(t => {
    try { return parseISO(t.created_at) >= weekStart } catch { return false }
  })

  const byQ = q => completed.filter(t => t.quadrant === q)

  // SLA aggregates
  const withDue      = completed.filter(t => t.due_date)
  const onTimeTasks  = withDue.filter(t => slaByTask[t.id]?.slaOk === true)
  const compliance   = withDue.length > 0 ? Math.round((onTimeTasks.length / withDue.length) * 100) : null

  const leadTimes    = completed.map(t => slaByTask[t.id]?.leadTime).filter(v => v !== null)
  const avgLead      = leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null

  const cycleTimes   = completed.map(t => slaByTask[t.id]?.cycleTime).filter(v => v !== null)
  const avgCycle     = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : null

  const weeks = []
  for (let i = 0; i < 8; i++) {
    const wStart = addWeeks(weekStart, -i)
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 })
    const wTasks = done
      .filter(t => {
        try { return isWithinInterval(parseISO(t.created_at), { start: wStart, end: wEnd }) }
        catch { return i === 0 }
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

  const cutoff = addWeeks(weekStart, -8)
  const older = done.filter(t => {
    try { return parseISO(t.created_at) < cutoff } catch { return false }
  })
  if (older.length > 0) {
    weeks.push({ label: 'Mais antigas', tasks: older })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-notion-text">Histórico</h2>
          <p className="text-xs text-notion-muted">{done.length} tarefa{done.length !== 1 ? 's' : ''} encerrada{done.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {showTeamFeatures && (
            <select
              className="text-xs border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none"
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">Responsável</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user_id === currentUserId ? `${m.name} (você)` : m.name}</option>
              ))}
            </select>
          )}
          {done.length > 0 && (
            <button
              onClick={() => exportCSV(done, slaByTask)}
              className="btn-ghost text-xs"
              title="Exportar histórico como CSV"
            >
              <Download size={13} />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Volume stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 px-4 md:px-6 py-4 border-b border-notion-border flex-shrink-0">
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

      {/* SLA stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 md:px-6 py-4 border-b border-notion-border flex-shrink-0">
        <StatCard
          label="Conformidade SLA"
          value={compliance !== null ? `${compliance}%` : '—'}
          color={compliance !== null ? (compliance >= 80 ? 'text-green-600' : compliance >= 50 ? 'text-amber-500' : 'text-red-500') : 'text-notion-muted'}
          sub={withDue.length > 0 ? `${onTimeTasks.length}/${withDue.length} com prazo` : 'sem prazo definido'}
        />
        <StatCard
          label="Lead time médio"
          value={avgLead !== null ? `${avgLead}d` : '—'}
          color="text-blue-600"
          sub="criação → conclusão"
        />
        <StatCard
          label="Cycle time médio"
          value={avgCycle !== null ? `${avgCycle}d` : '—'}
          color="text-purple-600"
          sub="início → conclusão"
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {done.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Check size={32} className="text-notion-border2" />
            <p className="text-sm text-notion-muted">Nenhuma tarefa encerrada ainda</p>
            <p className="text-xs text-notion-muted">Conclua ou cancele tarefas na Matriz para vê-las aqui</p>
          </div>
        ) : (
          weeks.map(week => (
            <WeekGroup
              key={week.label}
              weekLabel={week.label}
              tasks={week.tasks}
              slaByTask={slaByTask}
              onRestore={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
