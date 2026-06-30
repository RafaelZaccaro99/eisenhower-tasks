import React, { useState } from 'react'
import { Plus, Pencil, Trash2, X, User, MessageCircle, ChevronDown, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import SlackComposer from './SlackComposer'

const HIERARQUIAS = ['Superior', 'Par', 'Subordinado', 'Externo']
const SETORES = ['Tecnologia', 'Marketing', 'Vendas', 'Financeiro', 'RH', 'Operações', 'Jurídico', 'Diretoria', 'Outro']

const HIER_STYLE = {
  Superior:    'bg-purple-50 text-purple-600',
  Par:         'bg-blue-50 text-blue-600',
  Subordinado: 'bg-green-50 text-green-600',
  Externo:     'bg-amber-50 text-amber-600',
}

const Q_DOT   = { q1: 'bg-red-400', q2: 'bg-blue-400', q3: 'bg-amber-400', q4: 'bg-gray-300' }
const Q_LABEL = { q1: 'Fazer agora', q2: 'Agendar', q3: 'Delegar', q4: 'Eliminar' }
const TODAY   = new Date().toISOString().split('T')[0]


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
    name: '', role: '', sector: '', hierarchy: '',
    slackId: '', whatsapp: '',
    ...person,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.4)' }}
      onClick={onClose}
    >
      <form
        onSubmit={e => { e.preventDefault(); if (form.name.trim()) onSave(form) }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto"
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
                <option value="">— selecionar —</option>
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

function PersonCard({ person, tasks = [], onEdit, onDelete, onSlack }) {
  const [expanded, setExpanded] = useState(false)
  const initials = person.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  // Subordinados: todas as tarefas pendentes delegadas a eles
  // Demais: apenas tarefas do quadrante "Delegar" (Q3) — envolvimento conjunto
  const relatedTasks = tasks.filter(t => {
    if (t.delegated_to !== person.id) return false
    if (t.status === 'completed') return false
    return person.hierarchy === 'Subordinado' ? true : t.quadrant === 'q3'
  })

  return (
    <div className="rounded-lg hover:bg-notion-surface transition-colors group">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-notion-hover flex items-center justify-center flex-shrink-0 text-sm font-semibold text-notion-sub">
          {initials || <User size={16} />}
        </div>

        {/* Name + role — clicking expands tasks */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => relatedTasks.length > 0 && setExpanded(v => !v)}
        >
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-notion-text truncate">{person.name}</p>
            {relatedTasks.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-notion-hover text-notion-sub flex-shrink-0">
                {relatedTasks.length}
              </span>
            )}
          </div>
          <p className="text-xs text-notion-muted truncate">
            {[person.role, person.sector].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Quick contact buttons */}
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

        <span className={`chip text-xs flex-shrink-0 ${HIER_STYLE[person.hierarchy] || 'bg-notion-surface text-notion-muted'}`}>
          {person.hierarchy || '—'}
        </span>

        {relatedTasks.length > 0 ? (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-notion-muted hover:text-notion-text transition-colors p-1"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(person)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
          <button onClick={() => onDelete(person.id)} className="btn-danger p-1.5"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Expandable task list */}
      {expanded && relatedTasks.length > 0 && (
        <div className="ml-16 mr-4 mb-2 flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-notion-muted uppercase tracking-wide mb-0.5">
            {person.hierarchy === 'Subordinado' ? 'Todas as tarefas' : 'Envolvimento conjunto'}
          </p>
          {relatedTasks.map(t => {
            const isOverdue = t.due_date && t.due_date < TODAY
            return (
              <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded-md bg-notion-surface">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${Q_DOT[t.quadrant]}`} />
                <span className="text-xs text-notion-text flex-1 truncate">{t.title}</span>
                {t.due_date && (
                  <span className={`text-[11px] flex-shrink-0 flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-notion-muted'}`}>
                    {isOverdue && <AlertCircle size={10} />}
                    {format(new Date(t.due_date + 'T00:00:00'), 'd MMM', { locale: ptBR })}
                  </span>
                )}
                <span className="text-[10px] text-notion-muted flex-shrink-0">{Q_LABEL[t.quadrant]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function People({ people, tasks = [], slackBotToken = '', onCreate, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null)
  const [slackTarget, setSlackTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [saveError, setSaveError] = useState(null)

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.role?.toLowerCase().includes(search.toLowerCase()) ||
    p.sector?.toLowerCase().includes(search.toLowerCase())
  )

  const byHierarchy = hier => filtered.filter(p => p.hierarchy === hier)

  async function handleSave(form) {
    setSaveError(null)
    try {
      if (form.id) await onUpdate(form)
      else await onCreate(form)
      setModal(null)
    } catch (e) {
      setSaveError(e.message || 'Erro ao salvar pessoa')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {saveError && (
        <div className="mx-4 md:mx-6 mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex-shrink-0">
          {saveError}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-4 border-b border-notion-border flex-shrink-0">
        <div className="flex-shrink-0">
          <h2 className="text-sm font-semibold text-notion-text">Pessoas</h2>
          <p className="text-xs text-notion-muted">{people.length} cadastrada{people.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <input
            className="input text-xs flex-1 max-w-[180px]"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setModal({})} className="btn-primary flex-shrink-0">
            <Plus size={14} /> <span className="hidden sm:inline">Pessoa</span>
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
          <>
            {HIERARQUIAS.map(hier => {
              const group = byHierarchy(hier)
              if (group.length === 0) return null
              return (
                <div key={hier} className="mb-4">
                  <p className="text-xs font-medium text-notion-muted px-4 mb-1 uppercase tracking-wide">{hier}</p>
                  {group.map(p => (
                    <PersonCard key={p.id} person={p} tasks={tasks} onEdit={p => setModal(p)} onDelete={onDelete} onSlack={setSlackTarget} />
                  ))}
                </div>
              )
            })}
            {(() => {
              const ungrouped = filtered.filter(p => !p.hierarchy || !HIERARQUIAS.includes(p.hierarchy))
              if (ungrouped.length === 0) return null
              return (
                <div className="mb-4">
                  <p className="text-xs font-medium text-notion-muted px-4 mb-1 uppercase tracking-wide">Sem hierarquia</p>
                  {ungrouped.map(p => (
                    <PersonCard key={p.id} person={p} tasks={tasks} onEdit={p => setModal(p)} onDelete={onDelete} onSlack={setSlackTarget} />
                  ))}
                </div>
              )
            })()}
          </>
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
