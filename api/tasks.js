const { sb, calcQuadrant, cors, requireAuth, getUserId } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const token = requireAuth(req, res)
  if (!token) return

  try {
    if (req.method === 'GET') {
      const rows = await sb('/tasks?order=created_at.asc', 'GET', undefined, token)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const d = req.body
      const row = {
        user_id: getUserId(token),
        title: d.title,
        description: d.description || '',
        urgent: !!d.urgent,
        important: !!d.important,
        quadrant: calcQuadrant(d.urgent, d.important),
        status: d.status || 'pending',
        due_date: d.due_date || null,
        category: d.category || 'geral',
        delegated_to: d.delegated_to || null,
        client_id: d.client_id || null,
        recurrence: d.recurrence || null,
        recurrence_end: d.recurrence_end || null,
      }
      const created = await sb('/tasks', 'POST', row, token)
      return res.status(201).json(Array.isArray(created) ? created[0] : created)
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
