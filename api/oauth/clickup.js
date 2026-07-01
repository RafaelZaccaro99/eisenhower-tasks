const { cors, requireAuth, getUserId, makeState } = require('../_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const token = requireAuth(req, res)
  if (!token) return

  const userId = getUserId(token)
  const state = makeState(userId)

  const params = new URLSearchParams({
    client_id: process.env.CLICKUP_CLIENT_ID || '',
    redirect_uri: process.env.CLICKUP_REDIRECT_URI || '',
    response_type: 'code',
    state,
  })

  res.json({ url: `https://app.clickup.com/api?${params}` })
}
