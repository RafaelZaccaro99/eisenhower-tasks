const { cors, requireAuth, sb } = require('../_lib')
const { decrypt } = require('../_crypto')

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
      `/calendar_integrations?id=eq.${integration_id}&provider=eq.clickup`,
      'GET', undefined, token,
    )
    const integration = list[0]
    if (!integration) return res.status(404).json({ error: 'integration_not_found' })

    const accessToken = decrypt(integration.access_token)
    const teamId = integration.config?.team_id

    if (!teamId) return res.status(400).json({ error: 'missing team_id in config' })

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const dueAfter = now.getTime()
    const dueBefore = now.getTime() + 90 * 24 * 3600 * 1000

    const cuRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?due_date_gt=${dueAfter}&due_date_lt=${dueBefore}&include_closed=false&page=0`,
      { headers: { Authorization: accessToken } },
    )
    const cuData = await cuRes.json()
    if (cuData.err) throw new Error(cuData.err)

    const rows = (cuData.tasks || []).map(task => {
      const dueDateMs = parseInt(task.due_date)
      const date = dueDateMs ? new Date(dueDateMs).toISOString().split('T')[0] : todayStr
      return {
        integration_id,
        external_id: task.id,
        title: task.name || '(sem título)',
        date,
        start_time: null,
        end_time: null,
        all_day: true,
        url: task.url || '',
        provider: 'clickup',
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
