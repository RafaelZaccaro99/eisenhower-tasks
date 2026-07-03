// Chama o Supabase REST diretamente do navegador (sem intermediário Vercel).
// O token JWT do usuário é enviado como Authorization — o RLS do Supabase
// garante que cada usuário acessa apenas os dados do próprio workspace.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let _authToken = null
let _onUnauthorized = null
let _workspaceId = null

export function setAuthToken(token) { _authToken = token }
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn }
export function setWorkspaceId(id) { _workspaceId = id }

function getUserId() {
  if (!_authToken) return null
  try { return JSON.parse(atob(_authToken.split('.')[1])).sub } catch { return null }
}

// Filtro de workspace nos SELECTs (o RLS protege; o filtro evita misturar
// dados quando o usuário pertence a mais de um workspace)
const wsFilter = () => (_workspaceId ? `&workspace_id=eq.${_workspaceId}` : '')

// Carimba user_id e workspace_id nos INSERTs
const stamp = (body) => ({
  ...body,
  user_id: getUserId(),
  ...(_workspaceId ? { workspace_id: _workspaceId } : {}),
})

async function sbOnce(path, method, body, upsert) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }
  if (method !== 'DELETE') {
    headers['Prefer'] = upsert
      ? 'resolution=merge-duplicates,return=representation'
      : 'return=representation'
  }
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function sb(path, method = 'GET', body, upsert = false) {
  let res = await sbOnce(path, method, body, upsert)

  if (res.status === 401 && _onUnauthorized) {
    await _onUnauthorized()
    res = await sbOnce(path, method, body, upsert)
  }

  if (method === 'DELETE' || res.status === 204) return { ok: true }
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`)
  return data
}

let _statusCache = null
let _statusAt = 0

// Ping leve ao Supabase para confirmar que está acessível. Resultado cacheado 30s.
export async function isServerUp() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !_authToken) return false
  if (_statusCache !== null && Date.now() - _statusAt < 30_000) return _statusCache
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?limit=0`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${_authToken}` },
      signal: AbortSignal.timeout(4000),
    })
    _statusCache = res.status < 500
  } catch {
    _statusCache = false
  }
  _statusAt = Date.now()
  return _statusCache
}

export function resetServerStatus() { _statusCache = null }

export const dataApi = {
  tasks: {
    list:   ()         => sb(`/tasks?order=created_at.asc${wsFilter()}`),
    create: (body) => {
      const row = stamp(body)
      row.created_by = getUserId()
      row.assigned_to = body.assigned_to || getUserId()
      return sb('/tasks', 'POST', row)
    },
    update: (id, body) => sb(`/tasks?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/tasks?id=eq.${id}`, 'DELETE'),
  },
  people: {
    list:   ()         => sb(`/people?order=created_at.asc${wsFilter()}`),
    create: (body)     => sb('/people', 'POST', stamp(body)),
    update: (id, body) => sb(`/people?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/people?id=eq.${id}`, 'DELETE'),
  },
  blocks: {
    list:   ()         => sb(`/blocks?order=date.asc,start_time.asc${wsFilter()}`),
    create: (body)     => sb('/blocks', 'POST', stamp(body)),
    update: (id, body) => sb(`/blocks?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/blocks?id=eq.${id}`, 'DELETE'),
  },
  status_history: {
    list:   ()     => sb(`/status_history?order=changed_at.asc&limit=2000${wsFilter()}`),
    create: (body) => sb('/status_history', 'POST', stamp(body)),
  },
  integrations: {
    // Integrações de calendário continuam por usuário (não são dados de equipe)
    list:   ()         => sb('/calendar_integrations?order=created_at.asc'),
    create: (body)     => sb('/calendar_integrations', 'POST', { ...body, user_id: getUserId() }),
    update: (id, body) => sb(`/calendar_integrations?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/calendar_integrations?id=eq.${id}`, 'DELETE'),
  },
  external_events: {
    listByIntegrations: (ids) => {
      if (!ids.length) return Promise.resolve([])
      return sb(`/external_events?integration_id=in.(${ids.join(',')})&order=date.asc,start_time.asc`)
    },
    deleteByIntegration: (id) => sb(`/external_events?integration_id=eq.${id}`, 'DELETE'),
  },
  workspaces: {
    bootstrap: ()    => sb('/rpc/bootstrap_workspace', 'POST', {}),
    directory: (ws)  => sb('/rpc/workspace_directory', 'POST', { ws }),
    invite: (wsId, email, role) => sb('/workspace_members', 'POST', {
      workspace_id: wsId,
      invited_email: email.toLowerCase().trim(),
      role,
      status: 'invited',
      invited_by: getUserId(),
    }),
    updateMember: (id, patch) => sb(`/workspace_members?id=eq.${id}`, 'PATCH', patch),
    removeMember: (id)        => sb(`/workspace_members?id=eq.${id}`, 'DELETE'),
    rename: (wsId, name)      => sb(`/workspaces?id=eq.${wsId}`, 'PATCH', { name }),
  },
  sync: async (tasks, people, blocks) => {
    const uid = getUserId()
    if (!uid) return { ok: true }
    const upsertTable = (rows, table) =>
      rows?.length
        ? sb(`/${table}`, 'POST', rows.map(r => stamp(r)), true)
        : Promise.resolve({ ok: true })
    await Promise.all([
      upsertTable(tasks,  'tasks'),
      upsertTable(people, 'people'),
      upsertTable(blocks, 'blocks'),
    ])
    return { ok: true }
  },
}
