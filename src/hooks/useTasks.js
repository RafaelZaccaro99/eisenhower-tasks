import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isServerUp, dataApi } from '../utils/dataApi'
import { calcQuadrant } from '../utils/statusConfig'
import { nextDueDate } from '../utils/recurrence'

const ipc = window.api?.tasks

function lsRead() {
  try { return JSON.parse(localStorage.getItem('eisenhower-tasks') || '[]') } catch { return [] }
}
function lsWrite(tasks) {
  localStorage.setItem('eisenhower-tasks', JSON.stringify(tasks))
}
function lsReadHistory() {
  try { return JSON.parse(localStorage.getItem('eisenhower-status-history') || '[]') } catch { return [] }
}
function lsWriteHistory(entries) {
  localStorage.setItem('eisenhower-status-history', JSON.stringify(entries))
}

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [serverMode, setServerMode] = useState(false)
  const tasksRef = useRef([])
  const serverModeRef = useRef(false)

  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { serverModeRef.current = serverMode }, [serverMode])

  const load = useCallback(async () => {
    try {
      if (ipc) {
        const all = await ipc.getAll()
        setTasks(all.map(t => ({ ...t, urgent: !!t.urgent, important: !!t.important })))
        setStatusHistory(lsReadHistory())
        return
      }
      const up = await isServerUp()
      setServerMode(up)
      serverModeRef.current = up
      if (up) {
        const serverTasks = await dataApi.tasks.list()
        if (serverTasks.length > 0) {
          setTasks(serverTasks)
        } else {
          const lsTasks = lsRead()
          if (lsTasks.length > 0) {
            try {
              const lsBlocks = JSON.parse(localStorage.getItem('eisenhower-blocks') || '[]')
              await dataApi.sync(lsTasks, null, lsBlocks)
              const afterSync = await dataApi.tasks.list()
              setTasks(afterSync.length > 0 ? afterSync : lsTasks)
            } catch {
              setTasks(lsTasks)
            }
          } else {
            setTasks([])
          }
        }
        try {
          const serverHistory = await dataApi.status_history.list()
          setStatusHistory(Array.isArray(serverHistory) ? serverHistory : [])
        } catch {
          setStatusHistory(lsReadHistory())
        }
      } else {
        setTasks(lsRead())
        setStatusHistory(lsReadHistory())
      }
    } catch {
      setServerMode(false)
      serverModeRef.current = false
      setTasks(lsRead())
      setStatusHistory(lsReadHistory())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createTask = useCallback(async (data) => {
    const base = {
      title: data.title,
      description: data.description || '',
      urgent: !!data.urgent,
      important: !!data.important,
      quadrant: calcQuadrant(data.urgent, data.important),
      status: 'pending',
      due_date: data.due_date || null,
      category: data.category || 'geral',
      delegated_to: data.delegated_to || null,
      assigned_to: data.assigned_to || null,
      recurrence: data.recurrence || null,
      recurrence_end: data.recurrence_end || null,
    }
    if (ipc) {
      await ipc.create({ ...base, id: uuidv4(), created_at: new Date().toISOString(), urgent: base.urgent ? 1 : 0, important: base.important ? 1 : 0 })
    } else if (serverModeRef.current) {
      await dataApi.tasks.create(base)
    } else {
      const all = lsRead()
      lsWrite([...all, { ...base, id: uuidv4(), created_at: new Date().toISOString() }])
    }
    await load()
  }, [load])

  const updateTask = useCallback(async (data, note = '') => {
    const patch = {
      ...data,
      urgent: !!data.urgent,
      important: !!data.important,
      quadrant: calcQuadrant(data.urgent, data.important),
      recurrence: data.recurrence || null,
      recurrence_end: data.recurrence_end || null,
    }
    // Não sobrescrever o responsável com valor vazio
    if (!patch.assigned_to) delete patch.assigned_to

    // Record status transition if status changed
    const existing = tasksRef.current.find(t => t.id === data.id)
    const statusChanged = existing && data.status && existing.status !== data.status
    if (statusChanged) {
      const entry = {
        id: uuidv4(),
        task_id: data.id,
        from_status: existing.status,
        to_status: data.status,
        changed_at: new Date().toISOString(),
        note: note || '',
      }
      if (serverModeRef.current) {
        try { await dataApi.status_history.create(entry) } catch {}
      } else {
        lsWriteHistory([...lsReadHistory(), entry])
      }
    }

    if (ipc) {
      await ipc.update({ ...patch, urgent: patch.urgent ? 1 : 0, important: patch.important ? 1 : 0 })
    } else if (serverModeRef.current) {
      await dataApi.tasks.update(patch.id, patch)
    } else {
      const all = lsRead()
      const idx = all.findIndex(t => t.id === patch.id)
      if (idx !== -1) all[idx] = patch
      lsWrite(all)
    }

    if (statusChanged && data.status === 'completed') {
      await maybeSpawnNextRecurrence(patch)
    }
    await load()
  }, [load])

  // Gera a próxima instância de uma tarefa recorrente ao concluí-la.
  // Base do cálculo: due_date da tarefa, ou hoje quando não há prazo.
  const maybeSpawnNextRecurrence = useCallback(async (task) => {
    if (!task.recurrence || task.recurrence === 'none') return
    const today = new Date().toISOString().split('T')[0]
    const nextDate = nextDueDate(task.due_date || today, task.recurrence)
    const withinEnd = !task.recurrence_end || nextDate <= task.recurrence_end
    if (!withinEnd) return
    await createTask({
      ...task,
      id: undefined,
      status: 'pending',
      due_date: nextDate,
      created_at: undefined,
    })
  }, [createTask])

  const deleteTask = useCallback(async (id) => {
    if (ipc) {
      await ipc.delete(id)
    } else if (serverModeRef.current) {
      await dataApi.tasks.delete(id)
    } else {
      lsWrite(lsRead().filter(t => t.id !== id))
    }
    await load()
  }, [load])

  const toggleStatus = useCallback(async (task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed'
    await updateTask({ ...task, status: next })
  }, [updateTask])

  return { tasks, loading, serverMode, statusHistory, createTask, updateTask, deleteTask, toggleStatus }
}
