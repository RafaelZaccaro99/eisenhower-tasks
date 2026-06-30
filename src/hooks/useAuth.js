import { useState, useEffect, useCallback } from 'react'
import { setAuthToken, resetServerStatus } from '../utils/dataApi'

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
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) throw new Error('expired')
      const data = await res.json()
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
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao entrar')
    applySession(data)
    return data
  }, [applySession])

  const signUp = useCallback(async (email, password, name) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
    if (data.confirmation_required) return { confirmation_required: true }
    applySession(data)
    return data
  }, [applySession])

  const signOut = useCallback(async () => {
    if (session?.access_token) {
      fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      }).catch(() => {})
    }
    applySession(null)
  }, [session, applySession])

  return {
    user: session?.user || null,
    loading,
    signIn,
    signUp,
    signOut,
  }
}
