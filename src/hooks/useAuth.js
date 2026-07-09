import { useState, useEffect, useCallback } from 'react'
import { setAuthToken, resetServerStatus } from '../utils/dataApi'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const LS_KEY = 'eisenhower-session'

function readSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}
function saveSession(s) {
  if (s) localStorage.setItem(LS_KEY, JSON.stringify(s))
  else localStorage.removeItem(LS_KEY)
}
function isExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]))
    return exp * 1000 < Date.now()
  } catch { return true }
}

async function sbAuth(path, body, { method = 'POST', token } = {}) {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro de autenticação')
  return data
}

// Sessão de recuperação de senha: Supabase redireciona pro app com
// #access_token=...&refresh_token=...&type=recovery na URL.
export function parseRecoveryHash(hash) {
  if (!hash || !hash.includes('type=recovery')) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  return accessToken ? { accessToken, refreshToken } : null
}

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback((s) => {
    setSession(s)
    saveSession(s)
    setAuthToken(s?.access_token || null)
    resetServerStatus()
  }, [])

  const refresh = useCallback(async (refreshToken) => {
    try {
      const data = await sbAuth('/token?grant_type=refresh_token', { refresh_token: refreshToken })
      applySession(data)
      return data
    } catch {
      applySession(null)
      return null
    }
  }, [applySession])

  useEffect(() => {
    const stored = readSession()
    if (!stored) { setLoading(false); return }
    if (isExpired(stored.access_token)) {
      refresh(stored.refresh_token).finally(() => setLoading(false))
    } else {
      applySession(stored)
      setLoading(false)
    }
  }, [applySession, refresh])

  const signIn = useCallback(async (email, password) => {
    const data = await sbAuth('/token?grant_type=password', { email, password })
    applySession(data)
    return data
  }, [applySession])

  const signUp = useCallback(async (email, password, name) => {
    const data = await sbAuth('/signup', { email, password, data: { name } })
    if (!data.access_token) return { confirmation_required: true }
    applySession(data)
    return data
  }, [applySession])

  const signOut = useCallback(async () => {
    if (session?.access_token) {
      fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.access_token}` },
      }).catch(() => {})
    }
    applySession(null)
  }, [session, applySession])

  const refreshSession = useCallback(async () => {
    const stored = readSession()
    if (!stored?.refresh_token) return null
    return refresh(stored.refresh_token)
  }, [refresh])

  const requestPasswordReset = useCallback(async (email) => {
    await sbAuth('/recover', { email, options: { redirect_to: window.location.origin + '/' } })
  }, [])

  const confirmPasswordReset = useCallback(async ({ accessToken, refreshToken }, newPassword) => {
    await sbAuth('/user', { password: newPassword }, { method: 'PUT', token: accessToken })
    applySession({ access_token: accessToken, refresh_token: refreshToken })
  }, [applySession])

  return {
    user: session?.user || null, accessToken: session?.access_token || null, loading,
    signIn, signUp, signOut, refreshSession, requestPasswordReset, confirmPasswordReset,
  }
}
