const { sb, cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const rows = await sb('/people?order=created_at.asc')
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const d = req.body
      const row = {
        id: d.id || undefined,
        name: d.name,
        role: d.role || null,
        sector: d.sector || null,
        hierarchy: d.hierarchy || null,
        slackId: d.slackId || null,
        whatsapp: d.whatsapp || null,
      }
      const created = await sb('/people', 'POST', row)
      return res.status(201).json(Array.isArray(created) ? created[0] : created)
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
