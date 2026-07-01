const { createHmac, randomBytes } = require('crypto')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
const STATE_SECRET = process.env.STATE_SECRET || 'dev-state-secret'

async function sb(path, method = 'GET', body, authToken, upsert = false) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  }
  if (method !== 'DELETE') {
    headers['Prefer'] = upsert
      ? 'resolution=merge-duplicates,return=representation'
      : 'return=representation'
  }
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
  const origin = process.env.ALLOWED_ORIGIN ||
    (process.env.NODE_ENV === 'production' ? 'https://eisenhower-tasks.vercel.app' : 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function requireAuth(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  return token
}

function getUserId(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub } catch { return null }
}

// Supabase call using service role key (for OAuth callbacks without user JWT)
async function sbService(path, method = 'GET', body, upsert = false) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
  if (method !== 'DELETE') {
    headers['Prefer'] = upsert
      ? 'resolution=merge-duplicates,return=representation'
      : 'return=representation'
  }
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

// HMAC-signed state for OAuth CSRF protection
function makeState(userId) {
  const nonce = randomBytes(16).toString('hex')
  const payload = Buffer.from(JSON.stringify({ userId, nonce })).toString('base64url')
  const sig = createHmac('sha256', STATE_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyState(state) {
  const dotIdx = (state || '').lastIndexOf('.')
  if (dotIdx === -1) throw new Error('invalid_state')
  const payload = state.slice(0, dotIdx)
  const sig = state.slice(dotIdx + 1)
  const expected = createHmac('sha256', STATE_SECRET).update(payload).digest('base64url')
  if (sig !== expected) throw new Error('invalid_state')
  return JSON.parse(Buffer.from(payload, 'base64url').toString())
}

module.exports = { sb, sbService, calcQuadrant, cors, requireAuth, getUserId, makeState, verifyState }
