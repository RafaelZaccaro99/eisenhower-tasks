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

  const { integration_id, title, date, description, project_key, issue_type } = req.body || {}
  if (!integration_id || !title) {
    return res.status(400).json({ error: 'missing_required_fields' })
  }

  try {
    const list = await sb(
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.jira`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = await getAccessToken(integration, token)
    const cloudId = integration.config?.cloud_id
    const pKey = project_key || integration.config?.default_project_key

    if (!cloudId) return res.status(400).json({ error: 'missing cloud_id' })
    if (!pKey) return res.status(400).json({ error: 'missing project_key' })

    const jiraRes = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
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
      },
    )
    const created = await jiraRes.json()
    if (created.errorMessages?.length) throw new Error(created.errorMessages[0])

    res.json({ id: created.id, key: created.key })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
