// Rota dinâmica única para todos os endpoints de integração de calendário
// (sync + create por provedor, e o disparador do cron). Consolidada para
// caber no limite de 12 funções serverless do plano Hobby da Vercel.
// Preserva as URLs originais: /api/integrations/{provider}-sync,
// /api/integrations/{provider}-create e /api/integrations/cron-sync.
const { cors, requireAuth, sb, sbService } = require('../_lib')
const { decrypt, encrypt } = require('../_crypto')

const NOW = () => new Date()
const todayStr = () => NOW().toISOString().split('T')[0]
const inDays = (n) => new Date(Date.now() + n * 24 * 3600 * 1000)

async function refreshOAuthToken(integration, token, { tokenUrl, body, grantIsJson }) {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: grantIsJson ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: grantIsJson ? JSON.stringify(body) : new URLSearchParams(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null
  await sb(`/calendar_integrations?id=eq.${integration.id}`, 'PATCH',
    { access_token: encrypt(data.access_token), expires_at: expiresAt }, token)
  return data.access_token
}

async function getAccessToken(integration, token, refreshOpts) {
  if (integration.expires_at && new Date(integration.expires_at) > new Date(Date.now() + 60_000)) {
    return decrypt(integration.access_token)
  }
  return refreshOAuthToken(integration, token, refreshOpts)
}

async function findIntegration(integrationId, provider, token) {
  const list = await sb(`/calendar_integrations?id=eq.${integrationId}&provider=eq.${provider}`, 'GET', undefined, token)
  return list[0] || null
}

async function upsertEvents(integrationId, rows, token) {
  if (rows.length > 0) await sb('/external_events', 'POST', rows, token, true)
  await sb(`/external_events?integration_id=eq.${integrationId}&date=lt.${todayStr()}`, 'DELETE', undefined, token)
  await sb(`/calendar_integrations?id=eq.${integrationId}`, 'PATCH', { last_sync: new Date().toISOString() }, token)
}

// ── Google ──────────────────────────────────────────────────
async function googleAccessToken(integration, token) {
  return getAccessToken(integration, token, {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    body: {
      refresh_token: decrypt(integration.refresh_token),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  })
}

async function googleSync(req, res, token) {
  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })
  const integration = await findIntegration(integration_id, 'google', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = await googleAccessToken(integration, token)
  const timeMin = NOW().toISOString()
  const timeMax = inDays(90).toISOString()
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '500' })

  const gcalRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const gcalData = await gcalRes.json()
  if (gcalData.error) throw new Error(gcalData.error.message)

  const rows = (gcalData.items || []).map(ev => {
    const startRaw = ev.start?.dateTime || ev.start?.date || ''
    const endRaw = ev.end?.dateTime || ev.end?.date || ''
    const allDay = !!ev.start?.date
    return {
      integration_id,
      external_id: ev.id,
      title: ev.summary || '(sem título)',
      date: startRaw.slice(0, 10),
      start_time: allDay ? null : startRaw.slice(11, 16),
      end_time: allDay ? null : endRaw.slice(11, 16),
      all_day: allDay,
      url: ev.htmlLink || '',
      provider: 'google',
    }
  })
  await upsertEvents(integration_id, rows, token)
  res.json({ synced: rows.length })
}

async function googleCreate(req, res, token) {
  const { integration_id, title, date, start_time, end_time, description } = req.body || {}
  if (!integration_id || !title || !date) return res.status(400).json({ error: 'missing_required_fields' })
  const integration = await findIntegration(integration_id, 'google', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = await googleAccessToken(integration, token)
  const event = start_time
    ? {
        summary: title, description: description || '',
        start: { dateTime: `${date}T${start_time}:00`, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: `${date}T${end_time || start_time}:00`, timeZone: 'America/Sao_Paulo' },
      }
    : { summary: title, description: description || '', start: { date }, end: { date } }

  const gcalRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  const created = await gcalRes.json()
  if (created.error) throw new Error(created.error.message)
  res.json({ id: created.id, url: created.htmlLink })
}

// ── ClickUp ─────────────────────────────────────────────────
async function clickupSync(req, res, token) {
  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })
  const integration = await findIntegration(integration_id, 'clickup', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = decrypt(integration.access_token)
  const teamId = integration.config?.team_id
  if (!teamId) return res.status(400).json({ error: 'missing team_id in config' })

  const dueAfter = Date.now()
  const dueBefore = Date.now() + 90 * 24 * 3600 * 1000
  const cuRes = await fetch(
    `https://api.clickup.com/api/v2/team/${teamId}/task?due_date_gt=${dueAfter}&due_date_lt=${dueBefore}&include_closed=false&page=0`,
    { headers: { Authorization: accessToken } },
  )
  const cuData = await cuRes.json()
  if (cuData.err) throw new Error(cuData.err)

  const rows = (cuData.tasks || []).map(task => {
    const dueDateMs = parseInt(task.due_date)
    return {
      integration_id,
      external_id: task.id,
      title: task.name || '(sem título)',
      date: dueDateMs ? new Date(dueDateMs).toISOString().split('T')[0] : todayStr(),
      start_time: null, end_time: null, all_day: true,
      url: task.url || '', provider: 'clickup',
    }
  })
  await upsertEvents(integration_id, rows, token)
  res.json({ synced: rows.length })
}

async function clickupCreate(req, res, token) {
  const { integration_id, title, date, description } = req.body || {}
  if (!integration_id || !title) return res.status(400).json({ error: 'missing_required_fields' })
  const integration = await findIntegration(integration_id, 'clickup', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = decrypt(integration.access_token)
  const listId = integration.config?.list_id
  if (!listId) return res.status(400).json({ error: 'missing list_id in config — set in integration settings' })

  const dueDate = date ? new Date(date).getTime() : undefined
  const cuRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: 'POST',
    headers: { Authorization: accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: title, description: description || '', due_date: dueDate, due_date_time: false }),
  })
  const created = await cuRes.json()
  if (created.err) throw new Error(created.err)
  res.json({ id: created.id, url: created.url })
}

// ── Jira ────────────────────────────────────────────────────
async function jiraAccessToken(integration, token) {
  return getAccessToken(integration, token, {
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    grantIsJson: true,
    body: {
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: decrypt(integration.refresh_token),
    },
  })
}

async function jiraSync(req, res, token) {
  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })
  const integration = await findIntegration(integration_id, 'jira', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = await jiraAccessToken(integration, token)
  const cloudId = integration.config?.cloud_id
  if (!cloudId) return res.status(400).json({ error: 'missing cloud_id in config' })

  const cutoffStr = inDays(90).toISOString().split('T')[0]
  const jql = `duedate >= "${todayStr()}" AND duedate <= "${cutoffStr}" ORDER BY duedate ASC`
  const jiraRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jql, maxResults: 200, fields: ['summary', 'duedate', 'status'] }),
  })
  const jiraData = await jiraRes.json()
  if (jiraData.errorMessages?.length) throw new Error(jiraData.errorMessages[0])

  const baseUrl = integration.config?.site_url || `https://${integration.name.toLowerCase().replace(/\s/g, '')}.atlassian.net`
  const rows = (jiraData.issues || []).map(issue => ({
    integration_id,
    external_id: issue.id,
    title: issue.fields.summary || '(sem título)',
    date: issue.fields.duedate || todayStr(),
    start_time: null, end_time: null, all_day: true,
    url: `${baseUrl}/browse/${issue.key}`, provider: 'jira',
  }))
  await upsertEvents(integration_id, rows, token)
  res.json({ synced: rows.length })
}

async function jiraCreate(req, res, token) {
  const { integration_id, title, date, description, project_key, issue_type } = req.body || {}
  if (!integration_id || !title) return res.status(400).json({ error: 'missing_required_fields' })
  const integration = await findIntegration(integration_id, 'jira', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const accessToken = await jiraAccessToken(integration, token)
  const cloudId = integration.config?.cloud_id
  const pKey = project_key || integration.config?.default_project_key
  if (!cloudId) return res.status(400).json({ error: 'missing cloud_id' })
  if (!pKey) return res.status(400).json({ error: 'missing project_key' })

  const jiraRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: pKey },
        summary: title,
        description: description
          ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] }
          : undefined,
        issuetype: { name: issue_type || 'Task' },
        duedate: date || undefined,
      },
    }),
  })
  const created = await jiraRes.json()
  if (created.errorMessages?.length) throw new Error(created.errorMessages[0])
  res.json({ id: created.id, key: created.key })
}

// ── iCal ────────────────────────────────────────────────────
function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const events = []
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g
  let m
  while ((m = re.exec(unfolded)) !== null) {
    const block = m[1]
    const ev = {}
    const lineRe = /^([A-Z-]+)(?:;[^:]+)?:(.*)$/gm
    let lm
    while ((lm = lineRe.exec(block)) !== null) ev[lm[1]] = lm[2].trim()
    events.push(ev)
  }
  return events
}

function parseICSDate(val) {
  if (!val) return null
  const v = val.replace(/[TZ]/g, '')
  const allDay = v.length === 8
  const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  if (allDay) return { date, time: null, allDay: true }
  return { date, time: `${v.slice(8, 10)}:${v.slice(10, 12)}`, allDay: false }
}

async function icalSync(req, res, token) {
  const { integration_id } = req.body || {}
  if (!integration_id) return res.status(400).json({ error: 'missing integration_id' })
  const integration = await findIntegration(integration_id, 'ical', token)
  if (!integration) return res.status(404).json({ error: 'integration_not_found' })

  const icalUrl = integration.config?.ical_url
  if (!icalUrl) return res.status(400).json({ error: 'missing ical_url in config' })

  const icsRes = await fetch(icalUrl, { signal: AbortSignal.timeout(15_000) })
  if (!icsRes.ok) throw new Error(`fetch_failed: ${icsRes.status}`)
  const icsText = await icsRes.text()

  const cutoff = inDays(90)
  const rows = parseICS(icsText)
    .map(ev => {
      const start = parseICSDate(ev['DTSTART'])
      const end = parseICSDate(ev['DTEND'])
      if (!start) return null
      if (start.date < todayStr()) return null
      if (new Date(start.date) > cutoff) return null
      return {
        integration_id,
        external_id: ev['UID'] || `${integration_id}-${ev['DTSTART']}`,
        title: ev['SUMMARY'] || '(sem título)',
        date: start.date, start_time: start.time, end_time: end?.time || null,
        all_day: start.allDay, url: ev['URL'] || '', provider: 'ical',
      }
    })
    .filter(Boolean)
  await upsertEvents(integration_id, rows, token)
  res.json({ synced: rows.length })
}

// ── Cron (disparado pela Vercel 1x/dia — ver vercel.json) ────
const CRON_SYNC_ENDPOINTS = {
  ical: 'ical-sync', google: 'google-sync', clickup: 'clickup-sync', jira: 'jira-sync',
}

async function cronSync(req, res) {
  const authHeader = req.headers.authorization || ''
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const integrations = await sbService('/calendar_integrations?enabled=eq.true&select=id,provider,user_id')
    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const results = []

    for (const integration of integrations) {
      const endpoint = CRON_SYNC_ENDPOINTS[integration.provider]
      if (!endpoint) continue
      try {
        await fetch(`${appUrl}/api/integrations/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Cron-Key': process.env.CRON_SECRET || '' },
          body: JSON.stringify({ integration_id: integration.id }),
        })
        results.push({ id: integration.id, provider: integration.provider, ok: true })
      } catch (e) {
        results.push({ id: integration.id, provider: integration.provider, error: e.message })
      }
    }
    res.json({ synced: results.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── Dispatch ────────────────────────────────────────────────
const HANDLERS = {
  'google-sync': googleSync,
  'google-create': googleCreate,
  'clickup-sync': clickupSync,
  'clickup-create': clickupCreate,
  'jira-sync': jiraSync,
  'jira-create': jiraCreate,
  'ical-sync': icalSync,
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { endpoint } = req.query

  if (endpoint === 'cron-sync') return cronSync(req, res)

  const handler = HANDLERS[endpoint]
  if (!handler) return res.status(404).json({ error: 'unknown_endpoint' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  try {
    await handler(req, res, token)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
