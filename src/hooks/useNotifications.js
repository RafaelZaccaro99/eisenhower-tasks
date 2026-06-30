import { useEffect, useCallback, useMemo } from 'react'
import { DONE_STATUSES } from '../utils/statusConfig'

const LS_KEY = 'eisenhower-notified'

function getNotifiedMap() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

function wasNotifiedToday(taskId) {
  return getNotifiedMap()[taskId] === new Date().toDateString()
}

function markNotified(ids) {
  const map = getNotifiedMap()
  const today = new Date().toDateString()
  ids.forEach(id => { map[id] = today })
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

export function useNotifications(tasks, loading) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const overdueIds = useMemo(
    () => tasks
      .filter(t => !DONE_STATUSES.includes(t.status) && t.due_date && t.due_date < today)
      .map(t => t.id),
    [tasks, today]
  )

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied'
    if (Notification.permission !== 'default') return Notification.permission
    return Notification.requestPermission()
  }, [])

  useEffect(() => {
    if (loading || !tasks.length) return

    const pending = tasks.filter(t => !DONE_STATUSES.includes(t.status))
    const toNotify = pending.filter(t => {
      if (!t.due_date) return false
      const overdue = t.due_date < today
      const dueToday = t.due_date === today
      return (overdue || dueToday) && !wasNotifiedToday(t.id)
    })

    if (!toNotify.length) return

    requestPermission().then(perm => {
      if (perm !== 'granted') return

      const overdue = toNotify.filter(t => t.due_date < today)
      const dueToday = toNotify.filter(t => t.due_date === today)

      if (overdue.length === 1) {
        new Notification(`Tarefa atrasada: ${overdue[0].title}`, {
          body: `Prazo era ${overdue[0].due_date}`,
          tag: 'overdue-batch',
        })
      } else if (overdue.length > 1) {
        new Notification(`${overdue.length} tarefas atrasadas`, {
          body: overdue.map(t => t.title).slice(0, 3).join(', '),
          tag: 'overdue-batch',
        })
      }

      dueToday.slice(0, 2).forEach(t => {
        new Notification(`Prazo hoje: ${t.title}`, {
          body: 'Esta tarefa vence hoje',
          tag: `due-today-${t.id}`,
        })
      })

      markNotified(toNotify.map(t => t.id))
    })
  }, [tasks, loading, today, requestPermission])

  return { overdueCount: overdueIds.length, requestPermission }
}
