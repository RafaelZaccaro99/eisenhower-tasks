import { useState, useEffect, useCallback } from 'react'
import { isServerUp, dataApi, setWorkspaceId, getAuthToken } from '../utils/dataApi'

const LS_KEY = 'eisenhower-workspace'

// Workspace atual, papel do usuário e gestão de membros.
// Server-only: em modo offline/Electron retorna workspace null e o app
// esconde os recursos de equipe (fallback localStorage preservado).
export function useWorkspace(user) {
  const [workspaces, setWorkspaces] = useState([])
  const [workspace, setWorkspace] = useState(null) // { id, name, role, memberCount }
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const selectWorkspace = useCallback((ws) => {
    setWorkspace(ws)
    setWorkspaceId(ws?.id || null)
    if (ws?.id) localStorage.setItem(LS_KEY, ws.id)
  }, [])

  const reloadMembers = useCallback(async (wsId) => {
    const id = wsId || workspace?.id
    if (!id) return
    try {
      const dir = await dataApi.workspaces.directory(id)
      setMembers(Array.isArray(dir) ? dir : [])
    } catch { /* non-critical */ }
  }, [workspace?.id])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!user) { setLoading(false); return }
      try {
        const up = await isServerUp()
        if (!up) { setLoading(false); return }
        // Aceita convites pendentes e garante workspace próprio — 1 round-trip
        const rows = await dataApi.workspaces.bootstrap()
        if (cancelled) return
        const list = (Array.isArray(rows) ? rows : []).map(r => ({
          id: r.workspace_id, name: r.workspace_name, role: r.role, memberCount: Number(r.member_count) || 1,
        }))
        setWorkspaces(list)
        const savedId = localStorage.getItem(LS_KEY)
        const chosen = list.find(w => w.id === savedId) || list[0] || null
        if (chosen) {
          setWorkspace(chosen)
          setWorkspaceId(chosen.id)
          localStorage.setItem(LS_KEY, chosen.id)
          try {
            const dir = await dataApi.workspaces.directory(chosen.id)
            if (!cancelled) setMembers(Array.isArray(dir) ? dir : [])
          } catch { /* non-critical */ }
        }
      } catch { /* offline ou migração não rodada — segue sem equipe */ }
      if (!cancelled) setLoading(false)
    }
    bootstrap()
    return () => { cancelled = true }
  }, [user?.id])

  const switchWorkspace = useCallback(async (id) => {
    const ws = workspaces.find(w => w.id === id)
    if (!ws) return
    selectWorkspace(ws)
    await reloadMembers(id)
  }, [workspaces, selectWorkspace, reloadMembers])

  const invite = useCallback(async (email, role) => {
    if (!workspace) return
    await dataApi.workspaces.invite(workspace.id, email, role)
    await reloadMembers()
    // E-mail é conveniência, não fonte da verdade — o convite já existe mesmo
    // se isso falhar (ex: RESEND_API_KEY ainda não configurada).
    fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ kind: 'workspace_invite', workspace_id: workspace.id, invited_email: email }),
    }).catch(() => {})
  }, [workspace, reloadMembers])

  const updateMemberRole = useCallback(async (memberId, role) => {
    await dataApi.workspaces.updateMember(memberId, { role })
    await reloadMembers()
  }, [reloadMembers])

  const removeMember = useCallback(async (memberId) => {
    await dataApi.workspaces.removeMember(memberId)
    await reloadMembers()
  }, [reloadMembers])

  const renameWorkspace = useCallback(async (name) => {
    if (!workspace) return
    await dataApi.workspaces.rename(workspace.id, name)
    setWorkspace(w => ({ ...w, name }))
    setWorkspaces(list => list.map(w => (w.id === workspace.id ? { ...w, name } : w)))
  }, [workspace])

  const role = workspace?.role || null
  const isManager = role === 'admin' || role === 'manager'

  return {
    workspace, workspaces, role, isManager, members, loading,
    switchWorkspace, invite, updateMemberRole, removeMember, renameWorkspace, reloadMembers,
  }
}
