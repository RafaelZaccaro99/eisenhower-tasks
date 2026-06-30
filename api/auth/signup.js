const { cors } = require('../_lib')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  try {
    const { email, password, name } = req.body
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: { name } }),
    })
    const data = await r.json()
    if (!r.ok) return res.status(400).json({ error: data.error_description || data.msg || 'Erro ao cadastrar' })
    // Supabase may require email confirmation — check if session was returned
    if (!data.access_token) {
      return res.status(200).json({ confirmation_required: true })
    }
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
