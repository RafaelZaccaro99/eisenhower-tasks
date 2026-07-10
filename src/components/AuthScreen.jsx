import React, { useState } from 'react'
import { LogIn, UserPlus, Loader, KeyRound } from 'lucide-react'

const inputClass = 'w-full px-3 py-2.5 text-sm border border-notion-border rounded-lg bg-white focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder'

export default function AuthScreen({ onSignIn, onSignUp, onRequestReset, mode, recoveryTokens, onConfirmReset }) {
  const [screen, setScreen] = useState(mode === 'reset' ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function goTo(next) {
    setScreen(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (screen === 'login') {
        await onSignIn(email, password)
      } else {
        const result = await onSignUp(email, password, name)
        if (result?.confirmation_required) {
          setInfo('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
          setScreen('login')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await onRequestReset(email)
    } catch {
      // não revela se o e-mail existe ou não — mesma mensagem em qualquer caso
    } finally {
      setInfo('Se esse e-mail existir, enviamos um link de redefinição de senha.')
      setLoading(false)
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await onConfirmReset(recoveryTokens, newPassword)
      window.location.assign('/')
    } catch (err) {
      setError(err.message)
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

        {screen === 'reset' && (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-notion-sub mb-1">Defina sua nova senha.</p>
            <input
              type="password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
            />
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 bg-notion-text text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader size={14} className="animate-spin" /> : <><KeyRound size={14} /> Salvar nova senha</>}
            </button>
          </form>
        )}

        {screen === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-notion-sub mb-1">Informe seu e-mail para receber o link de redefinição.</p>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            {info && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 bg-notion-text text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader size={14} className="animate-spin" /> : 'Enviar link'}
            </button>
            <button
              type="button"
              onClick={() => goTo('login')}
              className="text-xs text-notion-muted hover:text-notion-sub text-center mt-1"
            >
              Voltar para o login
            </button>
          </form>
        )}

        {(screen === 'login' || screen === 'signup') && (
          <>
            {/* Tabs */}
            <div className="flex border border-notion-border rounded-lg overflow-hidden mb-6">
              <button
                type="button"
                onClick={() => goTo('login')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  screen === 'login' ? 'bg-notion-hover text-notion-text' : 'text-notion-muted hover:text-notion-sub'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => goTo('signup')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  screen === 'signup' ? 'bg-notion-hover text-notion-text' : 'text-notion-muted hover:text-notion-sub'
                }`}
              >
                Cadastrar
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {screen === 'signup' && (
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className={inputClass}
                />
              )}
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />

              {screen === 'login' && (
                <button
                  type="button"
                  onClick={() => goTo('forgot')}
                  className="text-xs text-notion-muted hover:text-notion-sub text-left -mt-1"
                >
                  Esqueceu a senha?
                </button>
              )}

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
                ) : screen === 'login' ? (
                  <><LogIn size={14} /> Entrar</>
                ) : (
                  <><UserPlus size={14} /> Criar conta</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
