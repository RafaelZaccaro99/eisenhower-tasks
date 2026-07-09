import React, { useState } from 'react'
import { Users, UserPlus, Trash2, Loader2, Check, Pencil, Mail, AlertCircle } from 'lucide-react'

const ROLE_LABELS = { admin: 'Admin', manager: 'Gestor', member: 'Membro' }
const ROLE_DESC = {
  admin: 'Gerencia equipe e workspace',
  manager: 'Vê e delega tarefas de todos',
  member: 'Vê apenas as próprias tarefas',
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Seção "Equipe" nas configurações — gestão do workspace e membros.
export default function TeamSettings({
  workspace, members = [], role, currentUserId,
  onInvite, onUpdateMemberRole, onRemoveMember, onRename,
}) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  if (!workspace) return null
  const isAdmin = role === 'admin'
  const active = members.filter(m => m.status === 'active')
  const invited = members.filter(m => m.status === 'invited')

  async function handleInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setError('Informe um e-mail válido'); return }
    if (members.some(m => (m.email || m.invited_email || '').toLowerCase() === email)) {
      setError('Este e-mail já é membro ou já foi convidado')
      return
    }
    setError('')
    setInviting(true)
    try {
      await onInvite(email, inviteRole)
      setInviteEmail('')
    } catch (err) {
      setError(err.message || 'Erro ao convidar')
    } finally {
      setInviting(false)
    }
  }

  async function saveName() {
    const name = nameDraft.trim()
    if (name && name !== workspace.name) await onRename(name)
    setEditingName(false)
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-notion-muted" />
        <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Equipe</h3>
      </div>

      <div className="bg-notion-surface rounded-xl px-4 py-3 flex flex-col gap-3">
        {/* Nome do workspace */}
        <div className="flex items-center gap-2">
          {editingName ? (
            <>
              <input
                className="input flex-1 text-sm"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), saveName())}
                autoFocus
              />
              <button onClick={saveName} className="btn-primary py-1.5 px-2.5"><Check size={13} /></button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-notion-text flex-1">{workspace.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-notion-hover text-notion-sub">
                {ROLE_LABELS[role] || role}
              </span>
              {isAdmin && (
                <button
                  onClick={() => { setNameDraft(workspace.name); setEditingName(true) }}
                  className="text-notion-muted hover:text-notion-text p-1"
                  title="Renomear workspace"
                >
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Membros ativos */}
        <div className="flex flex-col gap-1.5">
          {active.map(m => {
            const isSelf = m.user_id === currentUserId
            return (
              <div key={m.member_id} className="flex items-center gap-2.5 py-1">
                <span className="w-7 h-7 rounded-full bg-notion-hover flex items-center justify-center text-[10px] font-semibold text-notion-sub flex-shrink-0">
                  {initials(m.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-notion-text truncate">
                    {m.name} {isSelf && <span className="text-notion-muted">(você)</span>}
                  </p>
                  <p className="text-xs text-notion-muted truncate">{m.email}</p>
                </div>
                {isAdmin && !isSelf ? (
                  <select
                    className="text-xs border border-notion-border rounded-md px-1.5 py-1 bg-white text-notion-sub focus:outline-none"
                    value={m.role}
                    onChange={e => onUpdateMemberRole(m.member_id, e.target.value)}
                    title={ROLE_DESC[m.role]}
                  >
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-notion-muted" title={ROLE_DESC[m.role]}>{ROLE_LABELS[m.role] || m.role}</span>
                )}
                {isAdmin && !isSelf && (
                  <button
                    onClick={() => onRemoveMember(m.member_id)}
                    className="text-notion-muted hover:text-red-500 p-1"
                    title="Remover do workspace"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Convites pendentes */}
        {invited.length > 0 && (
          <div className="border-t border-notion-border pt-2 flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-wide text-notion-muted font-medium">Convites pendentes</p>
            {invited.map(m => (
              <div key={m.member_id} className="flex items-center gap-2.5 py-0.5">
                <Mail size={13} className="text-notion-muted flex-shrink-0" />
                <p className="text-sm text-notion-sub flex-1 truncate">{m.invited_email}</p>
                <span className="text-xs text-notion-muted">{ROLE_LABELS[m.role]}</span>
                {isAdmin && (
                  <button
                    onClick={() => onRemoveMember(m.member_id)}
                    className="text-notion-muted hover:text-red-500 p-1"
                    title="Cancelar convite"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <p className="text-xs text-notion-muted">
              Enviamos um e-mail com o convite (se o envio estiver configurado). De qualquer forma, a pessoa entra no workspace automaticamente ao criar conta ou logar com o e-mail convidado.
            </p>
          </div>
        )}

        {/* Form de convite (admin) */}
        {isAdmin && (
          <form onSubmit={handleInvite} className="border-t border-notion-border pt-3 flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-notion-muted font-medium flex items-center gap-1">
              <UserPlus size={11} /> Convidar membro
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                className="input flex-1 text-sm"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <select
                className="text-xs border border-notion-border rounded-md px-2 bg-white text-notion-sub focus:outline-none"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="submit" className="btn-primary py-1.5 px-3" disabled={inviting}>
                {inviting ? <Loader2 size={13} className="animate-spin" /> : 'Convidar'}
              </button>
            </div>
            <p className="text-xs text-notion-muted">{ROLE_DESC[inviteRole]}</p>
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-md">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
