const { cors, requireAuth, sb } = require('../_lib')
const { decrypt, encrypt } = require('../_crypto')

async function refreshJiraToken(integration, token) {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: decrypt(integration.refresh_token),
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null
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
  return refreshJiraToken(integration, token)
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
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.jira`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = await getAccessToken(integration, token)
    const cloudId = integration.config?.cloud_id
    if (!cloudId) return res.status(400).json({ error: 'missing cloud_id in config' })

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const cutoffStr = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0]

    const jql = `duedate >= "${todayStr}" AND duedate <= "${cutoffStr}" ORDER BY duedate ASC`
    const jiraRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ jql, maxResults: 200, fields: ['summary', 'duedate', 'status'] }),
      },
    )
    const jiraData = await jiraRes.json()
    if (jiraData.errorMessages?.length) throw new Error(jiraData.errorMessages[0])

    const baseUrl = `https://${integration.name.toLowerCase().replace(/\s/g, '')}.atlassian.net`

    const rows = (jiraData.issues || []).map(issue => ({
      integration_id,
      external_id: issue.id,
      title: issue.fields.summary || '(sem título)',
      date: issue.fields.duedate || todayStr,
      start_time: null,
      end_time: null,
      all_day: true,
      url: `${baseUrl}/browse/${issue.key}`,
      provider: 'jira',
    }))

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
