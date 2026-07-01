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
    audience: 'api.atlassian.com',
    client_id: process.env.JIRA_CLIENT_ID || '',
    scope: 'read:jira-work write:jira-work offline_access',
    redirect_uri: process.env.JIRA_REDIRECT_URI || '',
    response_type: 'code',
    prompt: 'consent',
    state,
  })

  res.json({ url: `https://auth.atlassian.com/authorize?${params}` })
}
