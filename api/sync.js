const { sb, calcQuadrant, cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  try {
    const { tasks = [], people = [], blocks = [] } = req.body

    const results = { tasks: 0, people: 0, blocks: 0 }

    for (const t of tasks) {
      await sb('/tasks', 'POST', {
        id: t.id,
        title: t.title,
        description: t.description || '',
        urgent: !!t.urgent,
        important: !!t.important,
        quadrant: t.quadrant || calcQuadrant(t.urgent, t.important),
        status: t.status || 'pending',
        due_date: t.due_date || null,
        category: t.category || 'geral',
        delegated_to: t.delegated_to || null,
        created_at: t.created_at || new Date().toISOString(),
      })
      results.tasks++
    }

    for (const p of people) {
      await sb('/people', 'POST', {
        id: p.id,
        name: p.name,
        role: p.role || null,
        sector: p.sector || null,
        hierarchy: p.hierarchy || null,
        slackId: p.slackId || null,
        whatsapp: p.whatsapp || null,
        created_at: p.created_at || new Date().toISOString(),
      })
      results.people++
    }

    for (const b of blocks) {
      await sb('/blocks', 'POST', {
        id: b.id,
        title: b.title,
        task_id: b.task_id || null,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        color: b.color || 'blue',
        locked: !!b.locked,
        recurrence: b.recurrence || null,
        recurrence_end: b.recurrence_end || null,
        created_at: b.created_at || new Date().toISOString(),
      })
      results.blocks++
    }

    res.status(200).json({ ok: true, synced: results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
