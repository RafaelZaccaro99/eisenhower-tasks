// Rota dinâmica única para OAuth de todos os provedores de calendário.
// Consolidada para caber no limite de 12 funções serverless do plano
// Hobby da Vercel (cada arquivo em api/ vira uma função). Preserva as
// URLs originais: /api/oauth/:provider (start) e /api/oauth/:provider/callback.
const { sbService, verifyState, cors, requireAuth, getUserId, makeState } = require('../../_lib')
const { encrypt } = require('../../_crypto')

const APP_URL = process.env.APP_URL || 'http://localhost:5173'

const PROVIDERS = {
  google: {
    color: '#4285F4',
    name: () => 'Google Calendar',
    authUrl: (state) => {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events openid',
        access_type: 'offline',
        prompt: 'consent',
        state,
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    },
    exchangeToken: async (code) => {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.error) throw new Error(tokens.error_description || tokens.error)
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        config: {},
      }
    },
  },
  clickup: {
    color: '#7B68EE',
    name: () => 'ClickUp',
    authUrl: (state) => {
      const params = new URLSearchParams({
        client_id: process.env.CLICKUP_CLIENT_ID || '',
        redirect_uri: process.env.CLICKUP_REDIRECT_URI || '',
        response_type: 'code',
        state,
      })
      return `https://app.clickup.com/api?${params}`
    },
    exchangeToken: async (code) => {
      const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.CLICKUP_CLIENT_ID,
          client_secret: process.env.CLICKUP_CLIENT_SECRET,
          code,
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.err) throw new Error(tokens.err)

      const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
        headers: { Authorization: tokens.access_token },
      })
      const teamData = await teamRes.json()
      const teamId = teamData.teams?.[0]?.id || ''

      return {
        access_token: tokens.access_token,
        refresh_token: '',
        expires_at: null,
        config: { team_id: teamId },
      }
    },
  },
  jira: {
    color: '#0052CC',
    name: () => 'Jira',
    authUrl: (state) => {
      const params = new URLSearchParams({
        audience: 'api.atlassian.com',
        client_id: process.env.JIRA_CLIENT_ID || '',
        scope: 'read:jira-work write:jira-work offline_access',
        redirect_uri: process.env.JIRA_REDIRECT_URI || '',
        response_type: 'code',
        prompt: 'consent',
        state,
      })
      return `https://auth.atlassian.com/authorize?${params}`
    },
    exchangeToken: async (code, existingConfig) => {
      const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: process.env.JIRA_CLIENT_ID,
          client_secret: process.env.JIRA_CLIENT_SECRET,
          code,
          redirect_uri: process.env.JIRA_REDIRECT_URI,
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.error) throw new Error(tokens.error_description || tokens.error)

      const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
      })
      const resources = await resourcesRes.json()
      const cloudId = resources[0]?.id || ''
      const siteName = resources[0]?.name || 'Jira'
      const siteUrl = resources[0]?.url || ''

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        config: { ...(existingConfig || {}), cloud_id: cloudId, site_url: siteUrl },
        siteName,
      }
    },
  },
}

async function handleStart(req, res, provider) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const token = requireAuth(req, res)
  if (!token) return

  const userId = getUserId(token)
  const state = makeState(userId)
  res.json({ url: provider.authUrl(state) })
}

async function handleCallback(req, res, provider, providerKey) {
  const { code, state, error } = req.query || {}

  if (error) {
    res.writeHead(302, { Location: `${APP_URL}?error=${encodeURIComponent(error)}` })
    return res.end()
  }

  let userId
  try {
    ;({ userId } = verifyState(state))
  } catch {
    res.writeHead(302, { Location: `${APP_URL}?error=invalid_state` })
    return res.end()
  }

  try {
    const existing = await sbService(`/calendar_integrations?user_id=eq.${userId}&provider=eq.${providerKey}`)
    const result = await provider.exchangeToken(code, existing[0]?.config)

    const record = {
      user_id: userId,
      provider: providerKey,
      name: result.siteName || provider.name(),
      color: provider.color,
      access_token: encrypt(result.access_token),
      refresh_token: result.refresh_token ? encrypt(result.refresh_token) : (existing[0]?.refresh_token || ''),
      expires_at: result.expires_at,
      config: result.config,
      enabled: true,
    }

    if (existing.length > 0) {
      await sbService(`/calendar_integrations?id=eq.${existing[0].id}`, 'PATCH', record)
    } else {
      await sbService('/calendar_integrations', 'POST', record)
    }

    res.writeHead(302, { Location: `${APP_URL}?connected=${providerKey}` })
    res.end()
  } catch (e) {
    res.writeHead(302, { Location: `${APP_URL}?error=${encodeURIComponent(e.message)}` })
    res.end()
  }
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { provider: providerKey, action } = req.query
  const provider = PROVIDERS[providerKey]
  if (!provider) return res.status(404).json({ error: 'unknown_provider' })

  const isCallback = Array.isArray(action) ? action[0] === 'callback' : action === 'callback'

  if (isCallback) return handleCallback(req, res, provider, providerKey)
  return handleStart(req, res, provider)
}
