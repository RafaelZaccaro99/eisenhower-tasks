const { sbService, verifyState, cors } = require('../../_lib')
const { encrypt } = require('../../_crypto')

const APP_URL = process.env.APP_URL || 'http://localhost:5173'

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

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

    // Get Atlassian cloud ID
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    })
    const resources = await resourcesRes.json()
    const cloudId = resources[0]?.id || ''
    const siteName = resources[0]?.name || 'Jira'

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const existing = await sbService(`/calendar_integrations?user_id=eq.${userId}&provider=eq.jira`)

    const record = {
      user_id: userId,
      provider: 'jira',
      name: siteName,
      color: '#0052CC',
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : '',
      expires_at: expiresAt,
      config: { cloud_id: cloudId },
      enabled: true,
    }

    if (existing.length > 0) {
      await sbService(`/calendar_integrations?id=eq.${existing[0].id}`, 'PATCH', record)
    } else {
      await sbService('/calendar_integrations', 'POST', record)
    }

    res.writeHead(302, { Location: `${APP_URL}?connected=jira` })
    res.end()
  } catch (e) {
    res.writeHead(302, { Location: `${APP_URL}?error=${encodeURIComponent(e.message)}` })
    res.end()
  }
}
