import React, { useState } from 'react'
import { Plus, Pencil, Trash2, X, Briefcase, Mail, Phone, Building2, Search, ChevronDown, ChevronRight, Check, Archive } from 'lucide-react'
import { DONE_STATUSES, STATUS_CONFIG, Q_COLORS } from '../utils/statusConfig'

function ClientModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', notes: '', color: '#8b5cf6',
    ...(initial || {}),
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm max-h-[92dvh] overflow-y-auto"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)' }}>
        <div className="px-5 pt-4 pb-3 border-b border-notion-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-notion-text">{isEdit ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button type="button" onClick={onClose} className="text-notion-muted hover:text-notion-text"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.name} required autoFocus
              onChange={e => set('name', e.target.value)} placeholder="Ex: Maria Souza" />
          </div>
          <div>
            <label className="label">Empresa</label>
            <input className="input" value={form.company || ''}
              onChange={e => set('company', e.target.value)} placeholder="Ex: Acme Ltda" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-mail</label>
              <input type="email" className="input" value={form.email || ''}
                onChange={e => set('email', e.target.value)} placeholder="email@..." />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.phone || ''}
                onChange={e => set('phone', e.target.value)} placeholder="+55..." />
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex items-center gap-2">
              <input type="color" className="w-8 h-8 rounded cursor-pointer border border-notion-border"
                value={form.color} onChange={e => set('color', e.target.value)} />
              <span className="text-xs text-notion-muted">{form.color}</span>
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input min-h-[70px] resize-y" value={form.notes || ''}
              onChange={e => set('notes', e.target.value)} placeholder="Contexto, contratos, preferências..." />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-notion-border bg-notion-surface flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary">{isEdit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </form>
    </div>
  )
}

function ClientCard({ client, tasks, canManage, onEdit, onArchive, onDelete, onEditTask, onToggleTask, onNewTask }) {
  const [expanded, setExpanded] = useState(false)
  const clientTasks = tasks.filter(t => t.client_id === client.id)
  const open = clientTasks.filter(t => !DONE_STATUSES.includes(t.status))
  const doneCount = clientTasks.length - open.length

  return (
    <div className="rounded-lg hover:bg-notion-surface transition-colors group">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
          style={{ backgroundColor: client.color || '#8b5cf6' }}>
          {client.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </span>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-notion-text truncate">{client.name}</p>
            {clientTasks.length > 0 && (expanded ? <ChevronDown size={12} className="text-notion-muted" /> : <ChevronRight size={12} className="text-notion-muted" />)}
          </div>
          <p className="text-xs text-notion-muted truncate">
            {client.company && <span className="inline-flex items-center gap-0.5"><Building2 size={9} /> {client.company}</span>}
            {client.company && (open.length > 0 || doneCount > 0) && ' · '}
            {open.length > 0 && `${open.length} aberta${open.length !== 1 ? 's' : ''}`}
            {open.length > 0 && doneCount > 0 && ' · '}
            {doneCount > 0 && `${doneCount} concluída${doneCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {client.email && (
            <a href={`mailto:${client.email}`} title={client.email}
              className="p-1.5 text-notion-muted hover:text-blue-500 transition-colors md:opacity-0 md:group-hover:opacity-100">
              <Mail size={13} />
            </a>
          )}
          {client.phone && (
            <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title={client.phone}
              className="p-1.5 text-notion-muted hover:text-green-600 transition-colors md:opacity-0 md:group-hover:opacity-100">
              <Phone size={13} />
            </a>
          )}
          <button onClick={() => onNewTask(client)} title="Nova tarefa para este cliente"
            className="p-1.5 text-notion-muted hover:text-notion-text transition-colors md:opacity-0 md:group-hover:opacity-100">
            <Plus size={14} />
          </button>
          {canManage && (
            <>
              <button onClick={() => onEdit(client)} title="Editar"
                className="p-1.5 text-notion-muted hover:text-notion-text transition-colors md:opacity-0 md:group-hover:opacity-100">
                <Pencil size={13} />
              </button>
              <button onClick={() => onArchive(client.id)} title="Arquivar"
                className="p-1.5 text-notion-muted hover:text-amber-500 transition-colors md:opacity-0 md:group-hover:opacity-100">
                <Archive size={13} />
              </button>
              <button onClick={() => { if (confirm(`Excluir o cliente "${client.name}"? As tarefas dele NÃO serão excluídas.`)) onDelete(client.id) }} title="Excluir"
                className="p-1.5 text-notion-muted hover:text-red-400 transition-colors md:opacity-0 md:group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {client.notes && (
            <p className="text-xs text-notion-muted whitespace-pre-wrap border-l-2 border-notion-border pl-2 ml-1">{client.notes}</p>
          )}
          {open.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {open.map(t => {
                const statusCfg = STATUS_CONFIG[t.status]
                return (
                  <div key={t.id} className="flex items-center gap-2 pl-2 py-1 rounded hover:bg-notion-hover cursor-pointer"
                    onClick={() => onEditTask(t)}>
                    <button
                      onClick={e => { e.stopPropagation(); onToggleTask(t) }}
                      className="w-3.5 h-3.5 rounded border border-notion-border2 hover:border-notion-sub flex items-center justify-center flex-shrink-0"
                    >
                      {t.status === 'completed' && <Check size={9} strokeWidth={3} />}
                    </button>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: Q_COLORS[t.quadrant] || '#9b9a97' }} />
                    <span className="text-xs text-notion-text truncate flex-1">{t.title}</span>
                    {statusCfg && t.status !== 'pending' && (
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    )}
                    {t.due_date && <span className="text-[10px] text-notion-muted">{t.due_date.split('-').reverse().slice(0, 2).join('/')}</span>}
                  </div>
                )
              })}
            </div>
          )}
          {open.length === 0 && !client.notes && (
            <p className="text-xs text-notion-placeholder pl-2">Sem tarefas abertas</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Clients({ clients, tasks, canManage, serverMode, onCreate, onUpdate, onDelete, onArchive, onEditTask, onToggleTask, onNewTaskForClient }) {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | {} (novo) | client (edição)

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(form) {
    if (form.id) await onUpdate(form.id, form)
    else await onCreate(form)
    setModal(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border flex-shrink-0 gap-3">
        <div>
          <h2 className="text-sm font-semibold text-notion-text">Clientes</h2>
          <p className="text-xs text-notion-muted">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-muted pointer-events-none" />
            <input
              className="w-44 pl-8 pr-2 py-1.5 text-sm border border-notion-border rounded-md bg-notion-surface focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
              placeholder="Buscar…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {canManage && (
            <button onClick={() => setModal({})} className="btn-primary">
              <Plus size={14} /> <span className="hidden sm:inline">Novo cliente</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-4 py-3">
        {!serverMode ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Briefcase size={32} className="text-notion-border2" />
            <p className="text-sm text-notion-muted">Clientes exigem conexão com o servidor</p>
            <p className="text-xs text-notion-muted">Verifique sua conexão e recarregue a página</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Briefcase size={32} className="text-notion-border2" />
            <p className="text-sm text-notion-muted">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
            {canManage && !search && (
              <button onClick={() => setModal({})} className="btn-ghost text-xs">
                <Plus size={12} /> Cadastrar o primeiro cliente
              </button>
            )}
          </div>
        ) : (
          filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              tasks={tasks}
              canManage={canManage}
              onEdit={c => setModal(c)}
              onArchive={onArchive}
              onDelete={onDelete}
              onEditTask={onEditTask}
              onToggleTask={onToggleTask}
              onNewTask={onNewTaskForClient}
            />
          ))
        )}
      </div>

      {modal && (
        <ClientModal
          initial={modal.id ? modal : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
