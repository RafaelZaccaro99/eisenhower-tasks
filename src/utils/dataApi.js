// Client for the local data server (localhost:3001 proxied via /api)
// Falls back to localStorage if the server is not running.

let _serverUp = null

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

// Reset cached status (called after server errors to retry)
export function resetServerStatus() { _serverUp = null }

async function call(path, method = 'GET', body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    resetServerStatus()
    throw new Error(`HTTP ${res.status}`)
  }
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
  sync: (tasks, people) => call('/sync', 'POST', { tasks, people }),
}
