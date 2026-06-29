import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isServerUp, dataApi } from '../utils/dataApi'

function lsRead() {
  try { return JSON.parse(localStorage.getItem('eisenhower-people') || '[]') } catch { return [] }
}
function lsWrite(data) { localStorage.setItem('eisenhower-people', JSON.stringify(data)) }

export function usePeople() {
  const [people, setPeople] = useState([])
  const [serverMode, setServerMode] = useState(false)

  const load = useCallback(async () => {
    const up = await isServerUp()
    setServerMode(up)
    if (up) {
      const serverPeople = await dataApi.people.list()
      if (serverPeople.length === 0) {
        const lsPeople = lsRead()
        if (lsPeople.length > 0) await dataApi.sync(null, lsPeople)
      }
      setPeople(await dataApi.people.list())
    } else {
      setPeople(lsRead())
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createPerson = useCallback(async (data) => {
    if (serverMode) {
      await dataApi.people.create(data)
    } else {
      const all = lsRead()
      lsWrite([...all, { id: uuidv4(), created_at: new Date().toISOString(), ...data }])
    }
    await load()
  }, [load, serverMode])

  const updatePerson = useCallback(async (data) => {
    if (serverMode) {
      await dataApi.people.update(data.id, data)
    } else {
      const all = lsRead()
      const idx = all.findIndex(p => p.id === data.id)
      if (idx !== -1) all[idx] = data
      lsWrite(all)
    }
    await load()
  }, [load, serverMode])

  const deletePerson = useCallback(async (id) => {
    if (serverMode) {
      await dataApi.people.delete(id)
    } else {
      lsWrite(lsRead().filter(p => p.id !== id))
    }
    await load()
  }, [load, serverMode])

  return { people, createPerson, updatePerson, deletePerson }
}
