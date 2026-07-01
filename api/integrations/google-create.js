const { cors, requireAuth, sb } = require('../_lib')
const { decrypt, encrypt } = require('../_crypto')

async function refreshGoogleToken(integration, token) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: decrypt(integration.refresh_token),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await sb(
    `/calendar_integrations?id=eq.${integration.id}`,
    'PATCH',
    { access_token: encrypt(data.access_token), expires_at: expiresAt },
    token,
  )
  return data.access_token
}

async function getAccessToken(integration, token) {
  if (integration.expires_at && new Date(integration.expires_at) > new Date(Date.now() + 60_000)) {
    return decrypt(integration.access_token)
  }
  return refreshGoogleToken(integration, token)
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  const { integration_id, title, date, start_time, end_time, description } = req.body || {}
  if (!integration_id || !title || !date) {
    return res.status(400).json({ error: 'missing_required_fields' })
  }

  try {
    const list = await sb(
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.google`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = await getAccessToken(integration, token)

    const event = start_time
      ? {
          summary: title,
          description: description || '',
          start: { dateTime: `${date}T${start_time}:00`, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: `${date}T${end_time || start_time}:00`, timeZone: 'America/Sao_Paulo' },
        }
      : {
          summary: title,
          description: description || '',
          start: { date },
          end: { date },
        }

    const gcalRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    )
    const created = await gcalRes.json()
    if (created.error) throw new Error(created.error.message)

    res.json({ id: created.id, url: created.htmlLink })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
