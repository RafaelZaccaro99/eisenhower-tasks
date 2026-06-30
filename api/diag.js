const { cors } = require('./_lib')

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  const result = {
    env: {
      SUPABASE_URL: url ? `${url.slice(0, 30)}...` : 'NÃO DEFINIDA',
      SUPABASE_ANON_KEY: key ? `${key.slice(0, 20)}...` : 'NÃO DEFINIDA',
    },
    supabase_reachable: false,
    supabase_status: null,
    supabase_error: null,
    people_table: null,
    people_error: null,
  }

  if (!url || !key) {
    return res.status(200).json({ ...result, diagnosis: 'Variáveis de ambiente não configuradas no Vercel' })
  }

  // Test 1: can we reach Supabase at all?
  try {
    const r = await fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key },
      signal: AbortSignal.timeout(5000),
    })
    result.supabase_reachable = true
    result.supabase_status = r.status
  } catch (e) {
    result.supabase_error = e.message
    return res.status(200).json({ ...result, diagnosis: 'Supabase inacessível — projeto provavelmente PAUSADO. Acesse supabase.com e clique em Restore project.' })
  }

  // Test 2: can we query the people table?
  try {
    const r = await fetch(`${url}/rest/v1/people?limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
    })
    const body = await r.json()
    result.people_table = { status: r.status, body }
  } catch (e) {
    result.people_error = e.message
  }

  const diagnosis = result.people_table?.status === 200
    ? 'Supabase OK — tabela people acessível'
    : result.people_table?.status === 401 || result.people_table?.status === 403
    ? 'RLS bloqueando acesso anônimo (esperado — o erro de cadastro é outro)'
    : `Status inesperado: ${result.people_table?.status}`

  return res.status(200).json({ ...result, diagnosis })
}
