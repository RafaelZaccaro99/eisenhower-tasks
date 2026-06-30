import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isServerUp, dataApi } from '../utils/dataApi'

const ipc = window.api?.people

function lsRead() {
  try { return JSON.parse(localStorage.getItem('eisenhower-people') || '[]') } catch { return [] }
}
function lsWrite(data) { localStorage.setItem('eisenhower-people', JSON.stringify(data)) }

export function usePeople() {
  const [people, setPeople] = useState([])
  const [serverMode, setServerMode] = useState(false)

  const load = useCallback(async () => {
    try {
      if (ipc) {
        setPeople(await ipc.getAll())
        return
      }
      const up = await isServerUp()
      setServerMode(up)
      if (up) {
        const serverPeople = await dataApi.people.list()
        if (serverPeople.length > 0) {
          setPeople(serverPeople)
        } else {
          const lsPeople = lsRead()
          if (lsPeople.length > 0) {
            try {
              await dataApi.sync(null, lsPeople)
              const afterSync = await dataApi.people.list()
              setPeople(afterSync.length > 0 ? afterSync : lsPeople)
            } catch {
              setPeople(lsPeople)
            }
          } else {
            setPeople([])
          }
        }
      } else {
        setPeople(lsRead())
      }
    } catch {
      setServerMode(false)
      setPeople(lsRead())
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createPerson = useCallback(async (data) => {
    if (ipc) {
      await ipc.create({ id: uuidv4(), created_at: new Date().toISOString(), ...data })
    } else if (serverMode) {
      await dataApi.people.create(data)
    } else {
      lsWrite([...lsRead(), { id: uuidv4(), created_at: new Date().toISOString(), ...data }])
    }
    await load()
  }, [load, serverMode])

  const updatePerson = useCallback(async (data) => {
    if (ipc) {
      await ipc.update(data)
    } else if (serverMode) {
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
    if (ipc) {
      await ipc.delete(id)
    } else if (serverMode) {
      await dataApi.people.delete(id)
    } else {
      lsWrite(lsRead().filter(p => p.id !== id))
    }
    await load()
  }, [load, serverMode])

  return { people, createPerson, updatePerson, deletePerson }
}
