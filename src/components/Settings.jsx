import React, { useState } from 'react'
import { Zap, RotateCcw, X, ChevronRight, Eye, EyeOff, Bot, Hash } from 'lucide-react'
import { PROVIDERS } from '../utils/aiClassifier'
import IntegrationsSettings from './IntegrationsSettings'
import TeamSettings from './TeamSettings'

function SlackIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

const URGENCY_DEADLINE_OPTIONS = [
  { value: 0, label: 'Só o que vence hoje' },
  { value: 1, label: 'Hoje ou amanhã' },
  { value: 2, label: 'Nos próximos 2 dias' },
  { value: 7, label: 'Esta semana' },
]

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-notion-text">{label}</p>
        {description && <p className="text-xs text-notion-muted mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${checked ? 'bg-notion-text' : 'bg-notion-border2'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-sm mx-0.5 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function TagEditor({ label, tags, onChange, placeholder }) {
  const [input, setInput] = useState('')
  function add(val) {
    const v = val.trim().toLowerCase()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }
  return (
    <div className="py-3 border-b border-notion-border last:border-0">
      <p className="text-xs font-medium text-notion-muted mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-notion-hover text-notion-text text-xs px-2 py-0.5 rounded-md">
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-notion-muted hover:text-red-400">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1 text-xs" value={input} placeholder={placeholder}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }} />
        <button onClick={() => add(input)} className="btn-ghost text-xs">+ Add</button>
      </div>
    </div>
  )
}

export default function Settings({
  settings, onSave, onRestartOnboarding,
  integrations = [], integrationsLoading, onAddIntegration, onDeleteIntegration, onSyncIntegration, onConnectOAuth, onUpdateIntegrationConfig,
  workspace, members = [], workspaceRole, currentUserId,
  onInviteMember, onUpdateMemberRole, onRemoveMember, onRenameWorkspace,
}) {
  const [local, setLocal] = useState(settings.anamnesis)
  const set = (k, v) => setLocal(d => ({ ...d, [k]: v }))
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState({})
  // Local copies of AI config (saved on button click)
  const [aiProvider, setAiProvider]     = useState(settings.aiProvider    || 'anthropic')
  const [aiModel, setAiModel]           = useState(settings.aiModel       || 'claude-haiku-4-5')
  const [aiKeys, setAiKeys]             = useState(settings.aiKeys        || {})
  const [slackBotToken, setSlackBotToken] = useState(settings.slackBotToken || '')
  const [showSlackToken, setShowSlackToken] = useState(false)

  const providerInfo = PROVIDERS[aiProvider]
  const currentKey   = aiKeys[aiProvider] || ''

  function handleProviderChange(p) {
    setAiProvider(p)
    const firstModel = PROVIDERS[p]?.models[0]?.id
    setAiModel(firstModel || '')
  }

  function setKeyForProvider(p, val) {
    setAiKeys(prev => ({ ...prev, [p]: val }))
  }

  function handleSave() {
    onSave(local, { aiProvider, aiModel, aiKeys, slackBotToken })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-notion-text">Configurações</h2>
          <p className="text-xs text-notion-muted">Personalize o comportamento do assistente</p>
        </div>
        <button onClick={handleSave} className={`btn-primary transition-all ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}>
          {saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">

        {/* Assistente */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-notion-sub" />
            <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Assistente de Enquadramento</h3>
          </div>
          <div className="bg-notion-surface rounded-xl px-4 divide-y divide-notion-border">
            <Toggle
              checked={settings.assistantEnabled}
              onChange={v => onSave({ assistantEnabled: v })}
              label="Ativar assistente"
              description="Sugere o quadrante automaticamente ao criar tarefas"
            />
            <Toggle
              checked={settings.aiEnabled}
              onChange={v => onSave({ aiEnabled: v })}
              label="Usar IA"
              description="Classificação inteligente via API de IA em vez de palavras-chave"
            />
            <Toggle
              checked={local.hasDelegation}
              onChange={v => set('hasDelegation', v)}
              label="Tenho pessoas para delegar"
              description="Habilita sugestão do quadrante Q3 (Delegar)"
            />
          </div>

          {/* AI Provider config */}
          {settings.aiEnabled && (
            <div className="bg-notion-surface rounded-xl px-4 py-4 mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Bot size={13} className="text-notion-muted" />
                <p className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Configuração de IA</p>
              </div>

              {/* Provider */}
              <div>
                <label className="label mb-1">Provedor</label>
                <select className="input" value={aiProvider} onChange={e => handleProviderChange(e.target.value)}>
                  {Object.entries(PROVIDERS).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="label mb-1">Modelo</label>
                <select className="input" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                  {providerInfo.models.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* API Key (per provider) */}
              <div>
                <label className="label mb-1">Chave de API · {providerInfo.label}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type={showKeys[aiProvider] ? 'text' : 'password'}
                    className="input flex-1 font-mono text-xs"
                    placeholder={providerInfo.keyPlaceholder}
                    value={currentKey}
                    onChange={e => setKeyForProvider(aiProvider, e.target.value)}
                  />
                  <button type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, [aiProvider]: !prev[aiProvider] }))}
                    className="p-2 text-notion-muted hover:text-notion-sub transition-colors flex-shrink-0">
                    {showKeys[aiProvider] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-xs text-notion-muted mt-1">
                  Obtenha em <span className="text-notion-sub font-medium">{providerInfo.keyHint}</span>
                  {' '}· salvo localmente no seu dispositivo
                </p>
              </div>

              {/* Keys status for other providers */}
              {Object.entries(PROVIDERS).filter(([id]) => id !== aiProvider && aiKeys[id]).length > 0 && (
                <div className="pt-2 border-t border-notion-border">
                  <p className="text-xs text-notion-muted mb-1.5">Outros provedores configurados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(PROVIDERS)
                      .filter(([id]) => id !== aiProvider && aiKeys[id])
                      .map(([id, p]) => (
                        <span key={id} className="text-xs px-2 py-0.5 rounded-md bg-notion-hover text-notion-sub flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          {p.label}
                        </span>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Prazo de urgência */}
        <section>
          <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide mb-3">Urgência por Prazo</h3>
          <div className="bg-notion-surface rounded-xl px-4 py-3">
            <p className="text-xs text-notion-muted mb-2">Considero urgente quando o prazo é...</p>
            <div className="flex flex-col gap-2">
              {URGENCY_DEADLINE_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${local.urgencyDeadlineDays === opt.value ? 'border-notion-text bg-notion-text' : 'border-notion-border2'}`}>
                    {local.urgencyDeadlineDays === opt.value && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                  <input type="radio" className="sr-only" checked={local.urgencyDeadlineDays === opt.value}
                    onChange={() => set('urgencyDeadlineDays', opt.value)} />
                  <span className="text-sm text-notion-text">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Palavras-chave */}
        <section>
          <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide mb-3">Palavras-chave</h3>
          <div className="bg-notion-surface rounded-xl px-4">
            <TagEditor label="Palavras que indicam URGÊNCIA" tags={local.urgencyTriggers ?? []}
              onChange={v => set('urgencyTriggers', v)} placeholder="Ex: cliente, prazo, hoje..." />
            <TagEditor label="Contextos de urgência (peso maior)" tags={local.urgencyContexts ?? []}
              onChange={v => set('urgencyContexts', v)} placeholder="Ex: diretor pediu, cliente VIP..." />
            <TagEditor label="Suas áreas de foco (indicam IMPORTÂNCIA)" tags={local.importanceAreas ?? []}
              onChange={v => set('importanceAreas', v)} placeholder="Ex: vendas, produto, time..." />
            <TagEditor label="Palavras que indicam IMPORTÂNCIA" tags={local.importanceTriggers ?? []}
              onChange={v => set('importanceTriggers', v)} placeholder="Ex: meta, estratégia, OKR..." />
            <TagEditor label="Palavras que indicam DELEGÁVEL" tags={local.delegatableTriggers ?? []}
              onChange={v => set('delegatableTriggers', v)} placeholder="Ex: relatório, planilha..." />
          </div>
        </section>

        {/* Slack */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <SlackIcon size={14} />
            <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide">Slack</h3>
          </div>
          <div className="bg-notion-surface rounded-xl px-4 py-4 flex flex-col gap-3">
            <div>
              <label className="label mb-1">Bot Token</label>
              <div className="flex gap-2 items-center">
                <input
                  type={showSlackToken ? 'text' : 'password'}
                  className="input flex-1 font-mono text-xs"
                  placeholder="xoxb-..."
                  value={slackBotToken}
                  onChange={e => setSlackBotToken(e.target.value)}
                />
                <button type="button"
                  onClick={() => setShowSlackToken(v => !v)}
                  className="p-2 text-notion-muted hover:text-notion-sub transition-colors flex-shrink-0">
                  {showSlackToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="text-xs text-notion-muted flex flex-col gap-1 pt-1 border-t border-notion-border">
              <p className="font-medium text-notion-sub">Como obter o Bot Token:</p>
              <ol className="list-decimal list-inside flex flex-col gap-0.5 pl-1">
                <li>Acesse <span className="font-medium text-notion-sub">api.slack.com/apps</span> → Create New App</li>
                <li>OAuth &amp; Permissions → Bot Token Scopes: adicione <code className="bg-notion-hover px-1 rounded">chat:write</code></li>
                <li>Install to Workspace → copie o <strong>Bot User OAuth Token</strong></li>
              </ol>
            </div>
          </div>
        </section>

        {/* Equipe */}
        <TeamSettings
          workspace={workspace}
          members={members}
          role={workspaceRole}
          currentUserId={currentUserId}
          onInvite={onInviteMember}
          onUpdateMemberRole={onUpdateMemberRole}
          onRemoveMember={onRemoveMember}
          onRename={onRenameWorkspace}
        />

        {/* Integrações */}
        <IntegrationsSettings
          integrations={integrations}
          loading={integrationsLoading}
          onAdd={onAddIntegration}
          onDelete={onDeleteIntegration}
          onSync={onSyncIntegration}
          onConnect={onConnectOAuth}
          onUpdateConfig={onUpdateIntegrationConfig}
        />

        {/* Refazer anamnese */}
        <section>
          <h3 className="text-xs font-semibold text-notion-sub uppercase tracking-wide mb-3">Redefinir</h3>
          <button
            onClick={onRestartOnboarding}
            className="flex items-center justify-between w-full px-4 py-3 bg-notion-surface rounded-xl text-sm text-notion-sub hover:bg-notion-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={14} />
              Refazer questionário de configuração
            </div>
            <ChevronRight size={14} />
          </button>
        </section>
      </div>
    </div>
  )
}
