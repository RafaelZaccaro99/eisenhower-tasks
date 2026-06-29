import React, { useState } from 'react'
import { Plus, Pencil, Trash2, X, User, MessageCircle } from 'lucide-react'
import SlackComposer from './SlackComposer'

const HIERARQUIAS = ['Superior', 'Par', 'Subordinado', 'Externo']
const SETORES = ['Tecnologia', 'Marketing', 'Vendas', 'Financeiro', 'RH', 'Operações', 'Jurídico', 'Diretoria', 'Outro']

const HIER_STYLE = {
  Superior:    'bg-purple-50 text-purple-600',
  Par:         'bg-blue-50 text-blue-600',
  Subordinado: 'bg-green-50 text-green-600',
  Externo:     'bg-amber-50 text-amber-600',
}


// Open WhatsApp: strip non-digits and open wa.me link
function openWhatsApp(phone) {
  if (!phone) return
  const digits = phone.replace(/\D/g, '')
  window.open(`https://wa.me/${digits}`, '_blank')
}

function SlackIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

function PersonModal({ person, onSave, onClose }) {
  const isEdit = !!person?.id
  const [form, setForm] = useState({
    name: '', role: '', sector: '', hierarchy: 'Subordinado',
    slackId: '', whatsapp: '',
    ...person,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }}
      onClick={onClose}
    >
      <form
        onSubmit={e => { e.preventDefault(); if (form.name.trim()) onSave(form) }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12), 0 0 0 1px rgba(15,15,15,0.06)' }}
      >
        <div className="px-6 pt-5 pb-3 border-b border-notion-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-notion-text">
            {isEdit ? 'Editar pessoa' : 'Nova pessoa'}
          </h2>
          <button type="button" onClick={onClose} className="text-notion-muted hover:text-notion-text">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="label">Nome *</label>
            <input className="input" autoFocus placeholder="Nome completo"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Função / Cargo</label>
            <input className="input" placeholder="Ex: Gerente de Projetos"
              value={form.role} onChange={e => set('role', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Setor</label>
              <select className="input" value={form.sector} onChange={e => set('sector', e.target.value)}>
                <option value="">— selecionar —</option>
                {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hierarquia</label>
              <select className="input" value={form.hierarchy} onChange={e => set('hierarchy', e.target.value)}>
                {HIERARQUIAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-notion-border pt-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Contato rápido</p>

            <div>
              <label className="label flex items-center gap-1.5">
                <SlackIcon size={12} />
                Slack Member ID
              </label>
              <input className="input font-mono text-xs" placeholder="U01234ABCDE"
                value={form.slackId} onChange={e => set('slackId', e.target.value)} />
              <p className="text-xs text-notion-muted mt-1">
                No Slack: perfil da pessoa → ⋯ → Copiar ID do membro
              </p>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <MessageCircle size={12} />
                WhatsApp
              </label>
              <input className="input" placeholder="+55 11 99999-9999"
                value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
              <p className="text-xs text-notion-muted mt-1">
                Com código do país. Ex: +55 11 99999-9999
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-notion-border bg-notion-surface flex justify-between">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary">
            {isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PersonCard({ person, onEdit, onDelete, onSlack }) {
  const initials = person.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-notion-surface transition-colors group">
      <div className="w-9 h-9 rounded-full bg-notion-hover flex items-center justify-center flex-shrink-0 text-sm font-semibold text-notion-sub">
        {initials || <User size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-notion-text truncate">{person.name}</p>
        <p className="text-xs text-notion-muted truncate">
          {[person.role, person.sector].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Quick contact buttons — always visible if configured */}
      <div className="flex items-center gap-1">
        {person.slackId && (
          <button
            onClick={() => onSlack(person)}
            title={`Enviar mensagem no Slack · ${person.name}`}
            className="p-1.5 rounded-md text-[#4A154B] bg-[#4A154B]/8 hover:bg-[#4A154B]/15 transition-colors"
          >
            <SlackIcon size={13} />
          </button>
        )}
        {person.whatsapp && (
          <button
            onClick={() => openWhatsApp(person.whatsapp)}
            title={`Abrir WhatsApp · ${person.whatsapp}`}
            className="p-1.5 rounded-md text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageCircle size={13} />
          </button>
        )}
      </div>

      <span className={`chip text-xs ${HIER_STYLE[person.hierarchy] || 'bg-notion-surface text-notion-muted'}`}>
        {person.hierarchy}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(person)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
        <button onClick={() => onDelete(person.id)} className="btn-danger p-1.5"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export default function People({ people, tasks = [], slackBotToken = '', onCreate, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null)
  const [slackTarget, setSlackTarget] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.role?.toLowerCase().includes(search.toLowerCase()) ||
    p.sector?.toLowerCase().includes(search.toLowerCase())
  )

  const byHierarchy = hier => filtered.filter(p => p.hierarchy === hier)

  function handleSave(form) {
    if (form.id) onUpdate(form)
    else onCreate(form)
    setModal(null)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-notion-text">Pessoas</h2>
          <p className="text-xs text-notion-muted">{people.length} cadastrada{people.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-48 text-xs"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setModal({})} className="btn-primary">
            <Plus size={14} /> Pessoa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <User size={32} className="text-notion-border2" />
            <p className="text-sm text-notion-muted">Nenhuma pessoa cadastrada</p>
            <button onClick={() => setModal({})} className="btn-ghost text-xs">
              <Plus size={12} /> Adicionar pessoa
            </button>
          </div>
        ) : (
          HIERARQUIAS.map(hier => {
            const group = byHierarchy(hier)
            if (group.length === 0) return null
            return (
              <div key={hier} className="mb-4">
                <p className="text-xs font-medium text-notion-muted px-4 mb-1 uppercase tracking-wide">{hier}</p>
                {group.map(p => (
                  <PersonCard key={p.id} person={p} onEdit={p => setModal(p)} onDelete={onDelete} onSlack={setSlackTarget} />
                ))}
              </div>
            )
          })
        )}
      </div>

      {modal && (
        <PersonModal person={modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      {slackTarget && (
        <SlackComposer
          person={slackTarget}
          tasks={tasks}
          people={people}
          slackBotToken={slackBotToken}
          onClose={() => setSlackTarget(null)}
        />
      )}
    </div>
  )
}
