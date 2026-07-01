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

    // Fetch user's team/workspace ID
    const teamRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: tokens.access_token },
    })
    const teamData = await teamRes.json()
    const teamId = teamData.teams?.[0]?.id || ''

    const existing = await sbService(`/calendar_integrations?user_id=eq.${userId}&provider=eq.clickup`)

    const record = {
      user_id: userId,
      provider: 'clickup',
      name: 'ClickUp',
      color: '#7B68EE',
      access_token: encrypt(tokens.access_token),
      refresh_token: '',
      expires_at: null,
      config: { team_id: teamId },
      enabled: true,
    }

    if (existing.length > 0) {
      await sbService(`/calendar_integrations?id=eq.${existing[0].id}`, 'PATCH', record)
    } else {
      await sbService('/calendar_integrations', 'POST', record)
    }

    res.writeHead(302, { Location: `${APP_URL}?connected=clickup` })
    res.end()
  } catch (e) {
    res.writeHead(302, { Location: `${APP_URL}?error=${encodeURIComponent(e.message)}` })
    res.end()
  }
}
