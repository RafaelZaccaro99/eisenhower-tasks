const { sb, cors, requireAuth } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const token = requireAuth(req, res)
  if (!token) return

  try {
    if (req.method === 'GET') {
      const rows = await sb('/people?order=created_at.asc', 'GET', undefined, token)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const d = req.body
      const row = {
        name: d.name,
        role: d.role || null,
        sector: d.sector || null,
        hierarchy: d.hierarchy || null,
        slackId: d.slackId || null,
        whatsapp: d.whatsapp || null,
      }
      const created = await sb('/people', 'POST', row, token)
      return res.status(201).json(Array.isArray(created) ? created[0] : created)
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
