import React, { useState, useEffect } from 'react'
import { Loader, ShieldCheck } from 'lucide-react'
import AuthScreen from './AuthScreen'
import { useAuth } from '../hooks/useAuth'
import { useWorkspace } from '../hooks/useWorkspace'

// Tela de consentimento OAuth para o conector MCP remoto. O Claude redireciona
// o navegador pra cá (via /api/mcp-auth/authorize) depois de o usuário clicar
// "Add custom connector" no claude.ai.
export default function ConnectClaude({ requestId }) {
  const { user, accessToken, loading: authLoading, signIn, signUp, requestPasswordReset } = useAuth()
  const ws = useWorkspace(user)
  const [pending, setPending] = useState(null)
  const [chosenWs, setChosenWs] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/mcp-auth/pending?request_id=${encodeURIComponent(requestId)}`)
      .then(r => r.json())
      .then(d => (d.error ? setError(d.error) : setPending(d)))
      .catch(() => setError('server_error'))
  }, [requestId])

  useEffect(() => {
    if (ws.workspace && !chosenWs) setChosenWs(ws.workspace.id)
  }, [ws.workspace, chosenWs])

  async function respond(approve) {
    setBusy(true)
    try {
      const res = await fetch('/api/mcp-auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ request_id: requestId, workspace_id: chosenWs, approve }),
      })
      const data = await res.json()
      if (data.redirect_uri) window.location.href = data.redirect_uri
      else setError(data.error || 'server_error')
    } catch {
      setError('server_error')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white px-4">
        <p className="text-sm text-red-500 text-center max-w-sm">
          Link de autorização inválido ou expirado. Volte ao Claude e tente conectar novamente.
        </p>
      </div>
    )
  }

  if (authLoading || !pending) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white text-notion-muted text-sm gap-2">
        <Loader size={14} className="animate-spin" /> Carregando…
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} onRequestReset={requestPasswordReset} />
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-notion-hover flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={22} className="text-notion-text" />
        </div>
        <h1 className="text-lg font-semibold text-notion-text mb-2">
          Autorizar "{pending.client_name}"?
        </h1>
        <p className="text-sm text-notion-muted mb-5">
          Isso vai permitir criar e listar tarefas e agenda em nome de <strong>{user.email}</strong>.
        </p>

        {ws.loading ? (
          <p className="text-xs text-notion-muted mb-4">Carregando workspaces…</p>
        ) : ws.workspaces.length > 1 ? (
          <select
            value={chosenWs}
            onChange={e => setChosenWs(e.target.value)}
            className="w-full mb-4 border border-notion-border rounded-lg px-3 py-2 text-sm text-notion-text bg-white focus:outline-none focus:border-notion-border2"
          >
            {ws.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        ) : ws.workspaces.length === 1 ? (
          <p className="text-xs text-notion-muted mb-4">Workspace: <strong>{ws.workspaces[0].name}</strong></p>
        ) : (
          <p className="text-xs text-red-500 mb-4">Nenhum workspace encontrado — abra o app pelo menos uma vez antes de conectar.</p>
        )}

        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => respond(false)}
            className="flex-1 py-2 border border-notion-border rounded-lg text-sm text-notion-sub hover:bg-notion-surface disabled:opacity-50"
          >
            Negar
          </button>
          <button
            disabled={busy || !chosenWs}
            onClick={() => respond(true)}
            className="flex-1 py-2 bg-notion-text text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Autorizando…' : 'Autorizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
