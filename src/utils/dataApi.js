let _serverUp = null
let _authToken = null

export function setAuthToken(token) { _authToken = token }

export async function isServerUp() {
  if (_serverUp !== null) return _serverUp
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(800) })
    _serverUp = res.ok
  } catch {
    _serverUp = false
  }
  return _serverUp
}

export function resetServerStatus() { _serverUp = null }

async function call(path, method = 'GET', body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    resetServerStatus()
    throw new Error(`HTTP ${res.status}`)
  }
  if (method === 'DELETE' || res.status === 204) return { ok: true }
  return res.json()
}

export const dataApi = {
  tasks: {
    list:   ()         => call('/tasks'),
    create: (body)     => call('/tasks',       'POST',   body),
    update: (id, body) => call(`/tasks/${id}`, 'PUT',    body),
    delete: (id)       => call(`/tasks/${id}`, 'DELETE'),
  },
  people: {
    list:   ()         => call('/people'),
    create: (body)     => call('/people',       'POST',  body),
    update: (id, body) => call(`/people/${id}`, 'PUT',   body),
    delete: (id)       => call(`/people/${id}`, 'DELETE'),
  },
  blocks: {
    list:   ()         => call('/blocks'),
    create: (body)     => call('/blocks',       'POST',   body),
    update: (id, body) => call(`/blocks/${id}`, 'PUT',    body),
    delete: (id)       => call(`/blocks/${id}`, 'DELETE'),
  },
  sync: (tasks, people, blocks) => call('/sync', 'POST', {
    tasks: tasks || [],
    people: people || [],
    blocks: blocks || [],
  }),
}
