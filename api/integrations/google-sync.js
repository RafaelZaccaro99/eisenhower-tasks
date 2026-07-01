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

  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })

  try {
    const list = await sb(
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.google`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = await getAccessToken(integration, token)

    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString()

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500',
    })

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const gcalData = await gcalRes.json()
    if (gcalData.error) throw new Error(gcalData.error.message)

    const todayStr = now.toISOString().split('T')[0]

    const rows = (gcalData.items || []).map(ev => {
      const startRaw = ev.start?.dateTime || ev.start?.date || ''
      const endRaw = ev.end?.dateTime || ev.end?.date || ''
      const allDay = !!ev.start?.date
      const date = startRaw.slice(0, 10)
      const startTime = allDay ? null : startRaw.slice(11, 16)
      const endTime = allDay ? null : endRaw.slice(11, 16)
      return {
        integration_id,
        external_id: ev.id,
        title: ev.summary || '(sem título)',
        date,
        start_time: startTime,
        end_time: endTime,
        all_day: allDay,
        url: ev.htmlLink || '',
        provider: 'google',
      }
    })

    if (rows.length > 0) {
      await sb('/external_events', 'POST', rows, token, true)
    }

    await sb(
      `/external_events?integration_id=eq.${integration_id}&date=lt.${todayStr}`,
      'DELETE', undefined, token,
    )

    await sb(
      `/calendar_integrations?id=eq.${integration_id}`,
      'PATCH', { last_sync: new Date().toISOString() }, token,
    )

    res.json({ synced: rows.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
