// Authorization Server do conector MCP (RFC 7591 Dynamic Client Registration
// + RFC 6749/7636 PKCE). Namespace separado de api/oauth/[provider]/... —
// aquele é OAuth OUTBOUND (o app se autenticando no Google/ClickUp/Jira);
// este é o INVERSO: o app agindo como Authorization Server pro Claude.
const { randomBytes, createHash } = require('crypto')
const { sb, sbService, requireAuth, getUserId } = require('../_lib')

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const SCOPES = 'tasks:read tasks:write agenda:read agenda:write people:read clients:read'
const DCR_RATE_LIMIT = 5 // registros de cliente por IP por hora

const genToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
const sha256hex = (s) => createHash('sha256').update(s).digest('hex')
const sha256b64url = (s) => createHash('sha256').update(s).digest('base64url')

function openCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return fwd ? fwd.split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown')
}

function currentHourWindow() {
  const d = new Date()
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

// Sem Redis/KV disponível — instâncias serverless são efêmeras, então o
// contador persiste numa tabela do Supabase (dcr_rate_limits), keyed por
// hash do IP + janela de 1h.
async function checkDcrRateLimit(req) {
  const ipHash = sha256hex(getClientIp(req))
  const windowStart = currentHourWindow()
  const existing = await sbService(`/dcr_rate_limits?ip_hash=eq.${ipHash}&window_start=eq.${encodeURIComponent(windowStart)}`)
  const row = existing[0]
  if (row && row.count >= DCR_RATE_LIMIT) return false
  if (row) {
    await sbService(`/dcr_rate_limits?ip_hash=eq.${ipHash}&window_start=eq.${encodeURIComponent(windowStart)}`, 'PATCH', { count: row.count + 1 })
  } else {
    await sbService('/dcr_rate_limits', 'POST', { ip_hash: ipHash, window_start: windowStart, count: 1 })
  }
  return true
}

// -- POST /register (RFC 7591 DCR, cliente público) ------------------------
async function register(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'invalid_request' })
  const body = req.body || {}
  const redirectUris = body.redirect_uris
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris obrigatório' })
  }
  for (const uri of redirectUris) {
    try { new URL(uri) } catch { return res.status(400).json({ error: 'invalid_redirect_uri' }) }
  }

  const allowed = await checkDcrRateLimit(req).catch(() => true) // fail-open: erro no rate limiter nunca bloqueia registro legítimo
  if (!allowed) {
    return res.status(429).json({
      error: 'too_many_requests',
      error_description: `Limite de ${DCR_RATE_LIMIT} registros de cliente por hora excedido para este IP. Tente novamente mais tarde.`,
    })
  }

  const clientId = `mcp_${genToken(16)}`
  const record = {
    client_id: clientId,
    client_name: body.client_name || 'MCP Client',
    redirect_uris: redirectUris,
    grant_types: body.grant_types?.length ? body.grant_types : ['authorization_code', 'refresh_token'],
    response_types: body.response_types?.length ? body.response_types : ['code'],
    scope: body.scope || SCOPES,
  }
  await sbService('/mcp_clients', 'POST', record)
  return res.status(201).json({
    client_id: clientId,
    client_name: record.client_name,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: record.grant_types,
    response_types: record.response_types,
    scope: record.scope,
    client_id_issued_at: Math.floor(Date.now() / 1000),
  })
}

// -- GET /authorize (entrada) ----------------------------------------------
async function authorize(req, res) {
  if (req.method !== 'GET') return res.status(405).send('method_not_allowed')
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope, resource } = req.query

  if (response_type !== 'code') return res.status(400).send('unsupported_response_type')
  if (!code_challenge || code_challenge_method !== 'S256') {
    return res.status(400).send('invalid_request: code_challenge_method deve ser S256')
  }
  if (!client_id || !redirect_uri) return res.status(400).send('invalid_request')

  const clients = await sbService(`/mcp_clients?client_id=eq.${encodeURIComponent(client_id)}`)
  const client = clients[0]
  if (!client) return res.status(400).send('invalid_client')
  if (!client.redirect_uris.includes(redirect_uri)) return res.status(400).send('invalid_redirect_uri')

  const [pending] = await sbService('/mcp_authorization_requests', 'POST', {
    client_id, redirect_uri, state: state || null,
    code_challenge, code_challenge_method,
    scope: scope || client.scope, resource: resource || null,
  })

  res.writeHead(302, { Location: `${APP_URL}/connect-claude?request_id=${pending.id}` })
  return res.end()
}

// -- GET /pending?request_id= (a tela de consentimento busca detalhes) -----
async function pending(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const { request_id } = req.query
  const rows = await sbService(`/mcp_authorization_requests?id=eq.${request_id}&consumed=eq.false`)
  const row = rows[0]
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: 'expired_or_invalid_request' })
  }
  const clients = await sbService(`/mcp_clients?client_id=eq.${row.client_id}`)
  return res.status(200).json({
    request_id: row.id,
    client_name: clients[0]?.client_name || 'Aplicativo desconhecido',
    scope: row.scope,
  })
}

// -- POST /consent (usuário logado aprova/nega) ----------------------------
async function consent(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const token = requireAuth(req, res) // JWT do Supabase do usuário logado no app
  if (!token) return
  const userId = getUserId(token)
  const { request_id, workspace_id, approve } = req.body || {}

  // Consome a pending request atomicamente — evita duplo-clique / replay.
  const consumedRows = await sbService(
    `/mcp_authorization_requests?id=eq.${request_id}&consumed=eq.false`, 'PATCH', { consumed: true },
  )
  const row = consumedRows[0]
  if (!row) return res.status(409).json({ error: 'already_used_or_not_found' })
  if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'expired' })

  if (!approve) {
    const url = new URL(row.redirect_uri)
    url.searchParams.set('error', 'access_denied')
    if (row.state) url.searchParams.set('state', row.state)
    return res.status(200).json({ redirect_uri: url.toString() })
  }

  // Confirma que o usuário é membro ativo do workspace escolhido usando o
  // JWT dele (sb(), não sbService()) — a RLS de workspace_members garante
  // isso sem eu precisar reimplementar a checagem manualmente.
  const memberships = await sb(
    `/workspace_members?user_id=eq.${userId}&workspace_id=eq.${workspace_id}&status=eq.active`,
    'GET', undefined, token,
  )
  if (!memberships.length) return res.status(403).json({ error: 'not_a_member_of_workspace' })

  const code = genToken(32)
  await sbService('/mcp_authorization_codes', 'POST', {
    code, client_id: row.client_id, redirect_uri: row.redirect_uri,
    code_challenge: row.code_challenge, code_challenge_method: row.code_challenge_method,
    user_id: userId, workspace_id, scope: row.scope,
  })

  const url = new URL(row.redirect_uri)
  url.searchParams.set('code', code)
  if (row.state) url.searchParams.set('state', row.state)
  return res.status(200).json({ redirect_uri: url.toString() })
}

// -- POST /token -------------------------------------------------------------
async function issueTokenPair(res, { client_id, user_id, workspace_id, scope }, existingRowId) {
  const accessToken = `mat_${genToken(32)}`
  const refreshToken = `mrt_${genToken(32)}`
  const record = {
    client_id, user_id, workspace_id, scope,
    access_token_hash: sha256hex(accessToken),
    access_token_expires_at: new Date(Date.now() + 3600_000).toISOString(), // 1h
    refresh_token_hash: sha256hex(refreshToken),
    refresh_token_expires_at: new Date(Date.now() + 90 * 24 * 3600_000).toISOString(), // 90d
    revoked: false,
  }
  if (existingRowId) await sbService(`/mcp_tokens?id=eq.${existingRowId}`, 'PATCH', record)
  else await sbService('/mcp_tokens', 'POST', record)

  return res.status(200).json({
    access_token: accessToken, token_type: 'Bearer', expires_in: 3600,
    refresh_token: refreshToken, scope,
  })
}

async function tokenFromCode(req, res, body) {
  const { code, redirect_uri, client_id, code_verifier } = body
  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return res.status(400).json({ error: 'invalid_request' })
  }
  // Marca used=true atomicamente via WHERE used=eq.false — só uma tentativa "ganha".
  const rows = await sbService(`/mcp_authorization_codes?code=eq.${encodeURIComponent(code)}&used=eq.false`, 'PATCH', { used: true })
  const codeRow = rows[0]
  if (!codeRow) return res.status(400).json({ error: 'invalid_grant' }) // já usado ou nunca existiu — mesma resposta

  if (new Date(codeRow.expires_at) < new Date()) return res.status(400).json({ error: 'invalid_grant', error_description: 'code_expired' })
  if (codeRow.client_id !== client_id) return res.status(400).json({ error: 'invalid_grant' })
  if (codeRow.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant' }) // RFC 6749 §4.1.3

  if (sha256b64url(code_verifier) !== codeRow.code_challenge) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'pkce_verification_failed' })
  }
  return issueTokenPair(res, { client_id, user_id: codeRow.user_id, workspace_id: codeRow.workspace_id, scope: codeRow.scope })
}

async function tokenFromRefresh(req, res, body) {
  const { refresh_token, client_id } = body
  if (!refresh_token || !client_id) return res.status(400).json({ error: 'invalid_request' })
  const rows = await sbService(`/mcp_tokens?refresh_token_hash=eq.${sha256hex(refresh_token)}&revoked=eq.false`)
  const row = rows[0]
  if (!row || row.client_id !== client_id) return res.status(400).json({ error: 'invalid_grant' })
  if (row.refresh_token_expires_at && new Date(row.refresh_token_expires_at) < new Date()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'refresh_token_expired' })
  }
  // Rotação in-place: o mesmo id de linha recebe novo par access+refresh.
  return issueTokenPair(res, { client_id, user_id: row.user_id, workspace_id: row.workspace_id, scope: row.scope }, row.id)
}

async function token(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'invalid_request' })
  const body = req.body || {}
  if (body.grant_type === 'authorization_code') return tokenFromCode(req, res, body)
  if (body.grant_type === 'refresh_token') return tokenFromRefresh(req, res, body)
  return res.status(400).json({ error: 'unsupported_grant_type' })
}

module.exports = async (req, res) => {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action
  openCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (action === 'register') return await register(req, res)
    if (action === 'authorize') return await authorize(req, res)
    if (action === 'pending') return await pending(req, res)
    if (action === 'consent') return await consent(req, res)
    if (action === 'token') return await token(req, res)
    return res.status(404).json({ error: 'not_found' })
  } catch (e) {
    return res.status(500).json({ error: 'server_error', error_description: e.message })
  }
}
