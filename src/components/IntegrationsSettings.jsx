import React, { useState } from 'react'
import { X, RefreshCw, Trash2, Plus, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const PROVIDER_META = {
  ical:    { label: 'iCal / CalDAV',     color: '#6B7280', emoji: '📅' },
  google:  { label: 'Google Calendar',   color: '#4285F4', emoji: '🔵' },
  clickup: { label: 'ClickUp',           color: '#7B68EE', emoji: '🟣' },
  jira:    { label: 'Jira',              color: '#0052CC', emoji: '🔷' },
}

function ProviderButton({ provider, label, emoji, connected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || connected}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
        connected
          ? 'border-green-200 bg-green-50 text-green-700 cursor-default'
          : 'border-notion-border hover:border-notion-border2 text-notion-sub hover:bg-notion-surface'
      } disabled:opacity-50`}
    >
      <span>{emoji}</span>
      {connected ? `${label} conectado` : `Conectar ${label}`}
      {connected && <CheckCircle2 size={13} className="ml-auto text-green-600" />}
    </button>
  )
}

function ICalModal({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState('#60a5fa')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return
    setLoading(true)
    setError('')
    try {
      await onAdd({ provider: 'ical', name, color, config: { ical_url: url }, access_token: '', refresh_token: '' })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-full max-w-md p-5 flex flex-col gap-4"
        style={{ boxShadow: '0 8px 40px rgba(15,15,15,0.12)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-notion-text">Adicionar calendário iCal</h3>
          <button type="button" onClick={onClose}><X size={15} /></button>
        </div>

        <div>
          <label className="label mb-1">Nome</label>
          <input className="input w-full" placeholder="Ex: Calendário de Trabalho" value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div>
          <label className="label mb-1">URL do feed iCal</label>
          <input className="input w-full font-mono text-xs" placeholder="https://calendar.google.com/calendar/ical/..." value={url} onChange={e => setUrl(e.target.value)} required />
          <p className="text-xs text-notion-muted mt-1">Google Calendar: Configurações → agenda → URL pública em formato iCal</p>
        </div>

        <div>
          <label className="label mb-1">Cor</label>
          <input type="color" className="w-8 h-8 rounded cursor-pointer border border-notion-border" value={color} onChange={e => setColor(e.target.value)} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Adicionar
          </button>
        </div>
      </form>
    </div>
  )
}

function ClickUpListModal({ integration, onSave, onClose }) {
  const [listId, setListId] = useState(integration.config?.list_id || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-notion-text">Configurar lista padrão do ClickUp</h3>
        <p className="text-xs text-notion-muted">ID da lista onde tarefas serão criadas. Encontre na URL: <code className="bg-notion-hover px-1 rounded">/l/XXXXXXXX</code></p>
        <input className="input font-mono text-xs" placeholder="ID da lista" value={listId} onChange={e => setListId(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => { onSave(listId); onClose() }} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function JiraProjectModal({ integration, onSave, onClose }) {
  const [projectKey, setProjectKey] = useState(integration.config?.default_project_key || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,15,15,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-notion-text">Configurar projeto padrão do Jira</h3>
        <p className="text-xs text-notion-muted">Chave do projeto (ex: <code className="bg-notion-hover px-1 rounded">PROJ</code>) para criação de issues.</p>
        <input className="input font-mono text-xs" placeholder="PROJ" value={projectKey} onChange={e => setProjectKey(e.target.value.toUpperCase())} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => { onSave(projectKey); onClose() }} className="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsSettings({
  integrations, loading, onAdd, onDelete, onSync, onConnect, onUpdateConfig,
}) {
  const [showICalModal, setShowICalModal] = useState(false)
  const [syncingId, setSyncingId] = useState(null)
  const [syncErrors, setSyncErrors] = useState({})
  const [configModal, setConfigModal] = useState(null) // { integration, type }

  const connectedProviders = new Set(integrations.map(i => i.provider))

  async function handleSync(integration) {
    setSyncingId(integration.id)
    setSyncErrors(prev => ({ ...prev, [integration.id]: null }))
    try {
      await onSync(integration)
    } catch (e) {
      setSyncErrors(prev => ({ ...prev, [integration.id]: e.message }))
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🔗</span>
        <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Integrações de Calendário</h3>
      </div>

      {/* Connected integrations */}
      {integrations.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {integrations.map(integration => {
            const meta = PROVIDER_META[integration.provider] || {}
            const isSyncing = syncingId === integration.id
            const error = syncErrors[integration.id]
            return (
              <div key={integration.id} className="bg-notion-surface rounded-xl px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-notion-text truncate">{integration.name}</p>
                    <p className="text-xs text-notion-muted">
                      {meta.label}
                      {integration.last_sync && ` · sync ${new Date(integration.last_sync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(integration.provider === 'clickup') && (
                      <button
                        type="button"
                        title="Configurar lista padrão"
                        onClick={() => setConfigModal({ integration, type: 'clickup' })}
                        className="p-1.5 text-notion-muted hover:text-notion-sub rounded-md hover:bg-notion-hover"
                      >
                        <span className="text-xs">⚙</span>
                      </button>
                    )}
                    {(integration.provider === 'jira') && (
                      <button
                        type="button"
                        title="Configurar projeto padrão"
                        onClick={() => setConfigModal({ integration, type: 'jira' })}
                        className="p-1.5 text-notion-muted hover:text-notion-sub rounded-md hover:bg-notion-hover"
                      >
                        <span className="text-xs">⚙</span>
                      </button>
                    )}
                    <button
                      type="button"
                      title="Sincronizar agora"
                      onClick={() => handleSync(integration)}
                      disabled={isSyncing}
                      className="p-1.5 text-notion-muted hover:text-notion-sub rounded-md hover:bg-notion-hover disabled:opacity-40"
                    >
                      <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                    <button
                      type="button"
                      title="Remover integração"
                      onClick={() => onDelete(integration.id)}
                      className="p-1.5 text-notion-muted hover:text-red-500 rounded-md hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md">
                    <AlertCircle size={11} /> {error}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add new integration */}
      <div className="bg-notion-surface rounded-xl px-4 py-3 flex flex-col gap-2">
        <p className="text-xs text-notion-muted mb-1">Conectar novo calendário ou gerenciador</p>

        <button
          type="button"
          onClick={() => setShowICalModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-notion-border hover:border-notion-border2 text-sm text-notion-sub hover:bg-white transition-all"
        >
          <span>📅</span> Adicionar iCal / CalDAV
          <Plus size={12} className="ml-auto text-notion-muted" />
        </button>

        {(['google', 'clickup', 'jira']).map(provider => (
          <ProviderButton
            key={provider}
            provider={provider}
            label={PROVIDER_META[provider].label}
            emoji={PROVIDER_META[provider].emoji}
            connected={connectedProviders.has(provider)}
            disabled={loading}
            onClick={() => onConnect(provider)}
          />
        ))}

        <p className="text-xs text-notion-muted pt-1 border-t border-notion-border">
          Google, ClickUp e Jira requerem configurar as variáveis de ambiente{' '}
          <code className="bg-notion-hover px-1 rounded">GOOGLE_CLIENT_ID</code>,{' '}
          <code className="bg-notion-hover px-1 rounded">CLICKUP_CLIENT_ID</code>,{' '}
          <code className="bg-notion-hover px-1 rounded">JIRA_CLIENT_ID</code> etc. no painel da Vercel.
        </p>
      </div>

      {showICalModal && (
        <ICalModal
          onAdd={onAdd}
          onClose={() => setShowICalModal(false)}
        />
      )}

      {configModal?.type === 'clickup' && (
        <ClickUpListModal
          integration={configModal.integration}
          onSave={listId => onUpdateConfig(configModal.integration.id, { list_id: listId })}
          onClose={() => setConfigModal(null)}
        />
      )}

      {configModal?.type === 'jira' && (
        <JiraProjectModal
          integration={configModal.integration}
          onSave={key => onUpdateConfig(configModal.integration.id, { default_project_key: key })}
          onClose={() => setConfigModal(null)}
        />
      )}
    </section>
  )
}
