import React, { useState } from 'react'
import { LogIn, UserPlus, Loader } from 'lucide-react'

export default function AuthScreen({ onSignIn, onSignUp }) {
  const [tab, setTab] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await onSignIn(email, password)
      } else {
        const result = await onSignUp(email, password, name)
        if (result?.confirmation_required) {
          setInfo('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
          setTab('login')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-notion-text tracking-tight">Eisenhower Tasks</h1>
          <p className="text-sm text-notion-muted mt-1">Gerencie o que importa de verdade</p>
        </div>

        {/* Tabs */}
        <div className="flex border border-notion-border rounded-lg overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); setInfo('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-notion-hover text-notion-text' : 'text-notion-muted hover:text-notion-sub'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(''); setInfo('') }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'signup' ? 'bg-notion-hover text-notion-text' : 'text-notion-muted hover:text-notion-sub'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {tab === 'signup' && (
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-notion-border rounded-lg bg-white focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
            />
          )}
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 text-sm border border-notion-border rounded-lg bg-white focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 text-sm border border-notion-border rounded-lg bg-white focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
          />

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          {info && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 bg-notion-text text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader size={14} className="animate-spin" />
            ) : tab === 'login' ? (
              <><LogIn size={14} /> Entrar</>
            ) : (
              <><UserPlus size={14} /> Criar conta</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
