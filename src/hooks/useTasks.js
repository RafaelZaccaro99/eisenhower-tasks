import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isServerUp, dataApi } from '../utils/dataApi'

function calcQuadrant(urgent, important) {
  if (urgent && important) return 'q1'
  if (!urgent && important) return 'q2'
  if (urgent && !important) return 'q3'
  return 'q4'
}

const ipc = window.api?.tasks

function lsRead() {
  try { return JSON.parse(localStorage.getItem('eisenhower-tasks') || '[]') } catch { return [] }
}
function lsWrite(tasks) {
  localStorage.setItem('eisenhower-tasks', JSON.stringify(tasks))
}

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [serverMode, setServerMode] = useState(false)

  const load = useCallback(async () => {
    if (ipc) {
      const all = await ipc.getAll()
      setTasks(all.map(t => ({ ...t, urgent: !!t.urgent, important: !!t.important })))
      setLoading(false)
      return
    }
    const up = await isServerUp()
    setServerMode(up)
    if (up) {
      // First boot: sync localStorage → server if server is empty
      const serverTasks = await dataApi.tasks.list()
      if (serverTasks.length === 0) {
        const lsTasks = lsRead()
        if (lsTasks.length > 0) await dataApi.sync(lsTasks, null)
      }
      setTasks(await dataApi.tasks.list())
    } else {
      setTasks(lsRead())
    }
    setLoading(false)
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
    }
    if (ipc) {
      await ipc.create({ ...base, id: uuidv4(), created_at: new Date().toISOString(), urgent: base.urgent ? 1 : 0, important: base.important ? 1 : 0 })
    } else if (serverMode) {
      await dataApi.tasks.create(base)
    } else {
      const all = lsRead()
      lsWrite([...all, { ...base, id: uuidv4(), created_at: new Date().toISOString() }])
    }
    await load()
  }, [load, serverMode])

  const updateTask = useCallback(async (data) => {
    const patch = {
      ...data,
      urgent: !!data.urgent,
      important: !!data.important,
      quadrant: calcQuadrant(data.urgent, data.important),
    }
    if (ipc) {
      await ipc.update({ ...patch, urgent: patch.urgent ? 1 : 0, important: patch.important ? 1 : 0 })
    } else if (serverMode) {
      await dataApi.tasks.update(patch.id, patch)
    } else {
      const all = lsRead()
      const idx = all.findIndex(t => t.id === patch.id)
      if (idx !== -1) all[idx] = patch
      lsWrite(all)
    }
    await load()
  }, [load, serverMode])

  const deleteTask = useCallback(async (id) => {
    if (ipc) {
      await ipc.delete(id)
    } else if (serverMode) {
      await dataApi.tasks.delete(id)
    } else {
      lsWrite(lsRead().filter(t => t.id !== id))
    }
    await load()
  }, [load, serverMode])

  const toggleStatus = useCallback(async (task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed'
    await updateTask({ ...task, status: next })
  }, [updateTask])

  return { tasks, loading, serverMode, createTask, updateTask, deleteTask, toggleStatus }
}
