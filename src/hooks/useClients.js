import { useState, useEffect, useCallback } from 'react'
import { isServerUp, dataApi } from '../utils/dataApi'

// Clientes do workspace — server-only (sem fallback localStorage/Electron).
// Offline retorna lista vazia e a UI esconde a view.
export function useClients(workspace) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!workspace) { setClients([]); setLoading(false); return }
    try {
      const up = await isServerUp()
      if (up) setClients(await dataApi.clients.list())
    } catch { /* migração não rodada ou offline */ }
    setLoading(false)
  }, [workspace?.id])

  useEffect(() => { reload() }, [reload])

  const createClient = useCallback(async (data) => {
    const created = await dataApi.clients.create(data)
    await reload()
    return Array.isArray(created) ? created[0] : created
  }, [reload])

  const updateClient = useCallback(async (id, patch) => {
    await dataApi.clients.update(id, patch)
    await reload()
  }, [reload])

  const deleteClient = useCallback(async (id) => {
    await dataApi.clients.delete(id)
    setClients(prev => prev.filter(c => c.id !== id))
  }, [])

  const archiveClient = useCallback(async (id) => {
    await dataApi.clients.update(id, { archived: true })
    setClients(prev => prev.filter(c => c.id !== id))
  }, [])

  return { clients, loading, reload, createClient, updateClient, deleteClient, archiveClient }
}
