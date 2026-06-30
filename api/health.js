const { cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const configured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  if (!configured) return res.status(503).json({ ok: false, reason: 'supabase_not_configured' })
  res.status(200).json({ ok: true, ts: Date.now() })
}
