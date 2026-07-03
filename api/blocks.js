const { sb, cors, requireAuth, getUserId } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const token = requireAuth(req, res)
  if (!token) return

  try {
    if (req.method === 'GET') {
      const { date, start, end } = req.query
      let path = '/blocks?order=date.asc,start_time.asc'
      if (date) path += `&date=eq.${date}`
      else if (start && end) path += `&date=gte.${start}&date=lte.${end}`
      const rows = await sb(path, 'GET', undefined, token)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const d = req.body
      const row = {
        user_id: getUserId(token),
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
      }
      const created = await sb('/blocks', 'POST', row, token)
      return res.status(201).json(Array.isArray(created) ? created[0] : created)
    }

    res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
