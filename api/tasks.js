const { sb, calcQuadrant, cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const rows = await sb('/tasks?order=created_at.asc')
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const d = req.body
      const row = {
        id: d.id || undefined,
        title: d.title,
        description: d.description || '',
        urgent: !!d.urgent,
        important: !!d.important,
        quadrant: calcQuadrant(d.urgent, d.important),
        status: d.status || 'pending',
        due_date: d.due_date || null,
        category: d.category || 'geral',
        delegated_to: d.delegated_to || null,
      }
      const created = await sb('/tasks', 'POST', row)
      return res.status(201).json(Array.isArray(created) ? created[0] : created)
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
