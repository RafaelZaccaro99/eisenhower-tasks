// Chama o Supabase REST diretamente do navegador (sem intermediário Vercel).
// O token JWT do usuário é enviado como Authorization — o RLS do Supabase
// garante que cada usuário acessa apenas seus próprios dados.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let _authToken = null

export function setAuthToken(token) { _authToken = token }

function getUserId() {
  if (!_authToken) return null
  try { return JSON.parse(atob(_authToken.split('.')[1])).sub } catch { return null }
}

async function sb(path, method = 'GET', body, upsert = false) {
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

  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (method === 'DELETE' || res.status === 204) return { ok: true }
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`)
  return data
}

// isServerUp agora verifica se as credenciais do Supabase estão disponíveis
// e se há um usuário autenticado — sem fazer nenhuma chamada de rede extra.
export async function isServerUp() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && _authToken)
}

// Mantido para compatibilidade — não precisa mais limpar cache
export function resetServerStatus() {}

export const dataApi = {
  tasks: {
    list:   ()         => sb('/tasks?order=created_at.asc'),
    create: (body)     => sb('/tasks', 'POST', { ...body, user_id: getUserId() }),
    update: (id, body) => sb(`/tasks?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/tasks?id=eq.${id}`, 'DELETE'),
  },
  people: {
    list:   ()         => sb('/people?order=created_at.asc'),
    create: (body)     => sb('/people', 'POST', { ...body, user_id: getUserId() }),
    update: (id, body) => sb(`/people?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/people?id=eq.${id}`, 'DELETE'),
  },
  blocks: {
    list:   ()         => sb('/blocks?order=date.asc,start_time.asc'),
    create: (body)     => sb('/blocks', 'POST', { ...body, user_id: getUserId() }),
    update: (id, body) => sb(`/blocks?id=eq.${id}`, 'PATCH', body),
    delete: (id)       => sb(`/blocks?id=eq.${id}`, 'DELETE'),
  },
  sync: async (tasks, people, blocks) => {
    const uid = getUserId()
    if (!uid) return { ok: true }
    const upsertTable = (rows, table) =>
      rows?.length
        ? sb(`/${table}`, 'POST', rows.map(r => ({ ...r, user_id: uid })), true)
        : Promise.resolve({ ok: true })
    await Promise.all([
      upsertTable(tasks,  'tasks'),
      upsertTable(people, 'people'),
      upsertTable(blocks, 'blocks'),
    ])
    return { ok: true }
  },
}
