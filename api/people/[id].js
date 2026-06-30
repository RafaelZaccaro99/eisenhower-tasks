const { sb, cors } = require('../_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id } = req.query

  try {
    if (req.method === 'PUT') {
      const d = req.body
      const patch = {
        name: d.name,
        role: d.role || null,
        sector: d.sector || null,
        hierarchy: d.hierarchy || null,
        slackId: d.slackId || null,
        whatsapp: d.whatsapp || null,
      }
      const updated = await sb(`/people?id=eq.${id}`, 'PATCH', patch)
      return res.status(200).json(Array.isArray(updated) ? updated[0] : updated)
    }

    if (req.method === 'DELETE') {
      await sb(`/people?id=eq.${id}`, 'DELETE')
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
