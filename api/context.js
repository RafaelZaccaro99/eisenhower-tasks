const { sb, cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  try {
    const [tasks, people] = await Promise.all([
      sb('/tasks?order=created_at.asc'),
      sb('/people?order=created_at.asc'),
    ])

    const pending = tasks.filter(t => t.status !== 'completed')
    const byQ = q => pending.filter(t => t.quadrant === q)

    res.status(200).json({
      summary: {
        total: tasks.length,
        pending: pending.length,
        completed: tasks.length - pending.length,
        q1: byQ('q1').length,
        q2: byQ('q2').length,
        q3: byQ('q3').length,
        q4: byQ('q4').length,
      },
      tasks,
      people,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
