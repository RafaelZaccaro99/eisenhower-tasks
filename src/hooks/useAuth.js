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

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro de autenticação')
  return data
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

  return { user: session?.user || null, accessToken: session?.access_token || null, loading, signIn, signUp, signOut }
}
