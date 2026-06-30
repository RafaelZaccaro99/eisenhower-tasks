const { cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ ok: false, error: 'missing_token' })

  const { slackMethod, ...body } = req.body || {}
  if (!slackMethod) return res.status(400).json({ ok: false, error: 'missing_slack_method' })

  try {
    const slackRes = await fetch(`https://slack.com/api/${slackMethod}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await slackRes.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
