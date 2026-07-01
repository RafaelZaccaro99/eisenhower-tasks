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

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const existing = await sbService(`/calendar_integrations?user_id=eq.${userId}&provider=eq.google`)

    const record = {
      user_id: userId,
      provider: 'google',
      name: 'Google Calendar',
      color: '#4285F4',
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : (existing[0]?.refresh_token || ''),
      expires_at: expiresAt,
      config: {},
      enabled: true,
    }

    if (existing.length > 0) {
      await sbService(`/calendar_integrations?id=eq.${existing[0].id}`, 'PATCH', record)
    } else {
      await sbService('/calendar_integrations', 'POST', record)
    }

    res.writeHead(302, { Location: `${APP_URL}?connected=google` })
    res.end()
  } catch (e) {
    res.writeHead(302, { Location: `${APP_URL}?error=${encodeURIComponent(e.message)}` })
    res.end()
  }
}
