import { useState, useCallback, useEffect } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const LS_KEY = 'eisenhower-settings'

const DEFAULTS = {
  assistantEnabled: true,
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiModel: 'claude-haiku-4-5',
  aiKeys: {},
  slackBotToken: '',
  onboardingCompleted: false,
  anamnesis: {
    urgencyDeadlineDays: 2,
    urgencyTriggers: ['hoje', 'urgente', 'agora', 'prazo', 'vence', 'entrega', 'cliente', 'reunião'],
    urgencyContexts: [],
    importanceAreas: [],
    importanceTriggers: ['meta', 'estratégia', 'planejamento', 'crescimento', 'objetivo', 'resultado'],
    importanceContexts: [],
    hasDelegation: true,
    delegatableTriggers: ['relatório', 'planilha', 'enviar', 'agendar', 'pesquisar', 'organizar'],
    delegatableCategories: ['operacional', 'administrativo'],
  }
}

function lsRead() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') } }
  catch { return { ...DEFAULTS } }
}
function lsWrite(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)) }

async function sbGet(accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.user_metadata?.eisenhower_settings || null
  } catch { return null }
}

function stripSecrets(s) {
  const { aiKeys, slackBotToken, ...rest } = s
  return rest
}

async function sbSave(settings, accessToken) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { eisenhower_settings: settings } }),
    })
  } catch { /* non-critical */ }
}

export function useSettings(accessToken) {
  const [settings, setSettings] = useState(lsRead)

  // On login: pull remote settings and merge (keys are local-only, never fetched from remote)
  useEffect(() => {
    if (!accessToken) return
    sbGet(accessToken).then(remote => {
      if (!remote) return
      const local = lsRead()
      const merged = {
        ...DEFAULTS,
        ...remote,
        // Prefer local secrets; fall back to remote for one-time migration from old behavior
        aiKeys: (local.aiKeys && Object.keys(local.aiKeys).length > 0) ? local.aiKeys : (remote.aiKeys || {}),
        slackBotToken: local.slackBotToken || remote.slackBotToken || '',
      }
      lsWrite(merged)
      setSettings(merged)
    })
  }, [accessToken])

  const save = useCallback((patch) => {
    const next = { ...lsRead(), ...patch }
    lsWrite(next)
    setSettings(next)
    if (accessToken) sbSave(stripSecrets(next), accessToken)
  }, [accessToken])

  const saveAnamnesis = useCallback((anamnesisPatch, overrides = {}) => {
    const current = lsRead()
    const next = {
      ...current,
      anamnesis: { ...current.anamnesis, ...anamnesisPatch },
      onboardingCompleted: true,
      ...overrides,
    }
    lsWrite(next)
    setSettings(next)
    if (accessToken) sbSave(stripSecrets(next), accessToken)
  }, [accessToken])

  const toggleAssistant = useCallback(() => {
    const current = lsRead()
    save({ assistantEnabled: !current.assistantEnabled })
  }, [save])

  return { settings, save, saveAnamnesis, toggleAssistant }
}
