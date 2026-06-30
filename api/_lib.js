const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

async function sb(path, method = 'GET', body) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
  if (method !== 'DELETE') headers['Prefer'] = 'return=representation'
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'DELETE' || res.status === 204) return { ok: true }
  const data = await res.json()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${JSON.stringify(data)}`)
  return data
}

function calcQuadrant(urgent, important) {
  if (urgent && important) return 'q1'
  if (!urgent && important) return 'q2'
  if (urgent && !important) return 'q3'
  return 'q4'
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

module.exports = { sb, calcQuadrant, cors }
