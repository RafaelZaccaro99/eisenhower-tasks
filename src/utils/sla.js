// Métricas de SLA/tempo de ciclo de tarefas — usadas no Histórico e no
// assistente de IA (relatórios). Extraído de History.jsx sem mudança de lógica.

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function computeSLA(task, allHistory) {
  const h = allHistory
    .filter(e => e.task_id === task.id)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))

  const completedEntry = h.find(e => e.to_status === 'completed')
  const startedEntry   = h.find(e => e.to_status === 'in_progress')

  const completedAt = completedEntry?.changed_at
  const startedAt   = startedEntry?.changed_at
  const createdAt   = task.created_at
  const dueDate     = task.due_date

  const leadTime  = completedAt && createdAt ? daysBetween(createdAt, completedAt) : null
  const cycleTime = completedAt && startedAt ? daysBetween(startedAt, completedAt) : null

  let slaOk = null
  let daysLate = null
  if (completedAt && dueDate) {
    slaOk = completedAt.split('T')[0] <= dueDate
    if (!slaOk) daysLate = daysBetween(dueDate + 'T23:59:59', completedAt)
  }

  let blockedMs = 0
  h.forEach((entry, idx) => {
    if (entry.to_status === 'blocked' && h[idx + 1]) {
      blockedMs += new Date(h[idx + 1].changed_at) - new Date(entry.changed_at)
    }
  })
  const timeBlockedDays = blockedMs > 0 ? Math.round(blockedMs / 86400000) : 0

  return { leadTime, cycleTime, slaOk, daysLate, timeBlockedDays, history: h }
}

// Agregados de produtividade para relatórios (assistente de IA).
export function computeMetrics(tasks, statusHistory) {
  const completed = tasks.filter(t => t.status === 'completed')
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const completedThisWeek = statusHistory.filter(
    e => e.to_status === 'completed' && e.changed_at >= weekAgo,
  ).length

  const slas = completed.map(t => computeSLA(t, statusHistory))
  const withDue = slas.filter(s => s.slaOk !== null)
  const onTime = withDue.filter(s => s.slaOk === true)
  const compliance = withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : null

  const leads = slas.map(s => s.leadTime).filter(v => v !== null)
  const avgLead = leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null

  const cycles = slas.map(s => s.cycleTime).filter(v => v !== null)
  const avgCycle = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null

  return { totalCompleted: completed.length, completedThisWeek, compliance, avgLead, avgCycle }
}
