const { sb, cors, requireAuth } = require('../_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const token = requireAuth(req, res)
  if (!token) return
  const { id } = req.query

  try {
    if (req.method === 'PUT') {
      const d = req.body
      const patch = {
        title: d.title,
        task_id: d.task_id || null,
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time,
        color: d.color || '#60a5fa',
        locked: !!d.locked,
        recurrence: d.recurrence || null,
        recurrence_end: d.recurrence_end || null,
        participants: Array.isArray(d.participants) ? d.participants : [],
        recurrence_exceptions: Array.isArray(d.recurrence_exceptions) ? d.recurrence_exceptions : [],
      }
      const updated = await sb(`/blocks?id=eq.${id}`, 'PATCH', patch, token)
      return res.status(200).json(Array.isArray(updated) ? updated[0] : updated)
    }

    if (req.method === 'DELETE') {
      await sb(`/blocks?id=eq.${id}`, 'DELETE', undefined, token)
      return res.status(200).json({ ok: true })
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
