const { cors, requireAuth, sb } = require('../_lib')
const { decrypt } = require('../_crypto')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  const { integration_id, title, date, description } = req.body || {}
  if (!integration_id || !title) {
    return res.status(400).json({ error: 'missing_required_fields' })
  }

  try {
    const list = await sb(
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.clickup`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = decrypt(integration.access_token)
    const listId = integration.config?.list_id

    if (!listId) return res.status(400).json({ error: 'missing list_id in config — set in integration settings' })

    const dueDate = date ? new Date(date).getTime() : undefined

    const cuRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: title,
        description: description || '',
        due_date: dueDate,
        due_date_time: false,
      }),
    })
    const created = await cuRes.json()
    if (created.err) throw new Error(created.err)

    res.json({ id: created.id, url: created.url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
