const { sb, calcQuadrant, cors } = require('../_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const { id } = req.query
  const token = (req.headers.authorization || '').replace('Bearer ', '')

  try {
    if (req.method === 'PUT') {
      const d = req.body
      const patch = {
        title: d.title,
        description: d.description || '',
        urgent: !!d.urgent,
        important: !!d.important,
        quadrant: calcQuadrant(d.urgent, d.important),
        status: d.status,
        due_date: d.due_date || null,
        category: d.category || 'geral',
        delegated_to: d.delegated_to || null,
      }
      const updated = await sb(`/tasks?id=eq.${id}`, 'PATCH', patch, token)
      return res.status(200).json(Array.isArray(updated) ? updated[0] : updated)
    }

    if (req.method === 'DELETE') {
      await sb(`/tasks?id=eq.${id}`, 'DELETE', undefined, token)
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
