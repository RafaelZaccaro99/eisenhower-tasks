import React, { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, CalendarDays, Users, Settings as SettingsIcon, Plus, Clock, LogOut, MessageCircle } from 'lucide-react'
import Matrix from './components/Matrix'
import Agenda from './components/Agenda'
import People from './components/People'
import Settings from './components/Settings'
import History from './components/History'
import TaskModal from './components/TaskModal'
import ChatPanel from './components/ChatPanel'
import Onboarding from './components/Onboarding'
import AuthScreen from './components/AuthScreen'
import { useTasks } from './hooks/useTasks'
import { usePeople } from './hooks/usePeople'
import { useSettings } from './hooks/useSettings'
import { useAuth } from './hooks/useAuth'
import { useNotifications } from './hooks/useNotifications'
import { useIntegrations } from './hooks/useIntegrations'
import { isServerUp, dataApi, setUnauthorizedHandler } from './utils/dataApi'
import { setProxyToken } from './utils/aiProxy'
import { v4 as uuidv4 } from 'uuid'

const VIEWS = [
  { key: 'matrix',   label: 'Matriz',        icon: LayoutGrid   },
  { key: 'agenda',   label: 'Agenda',        icon: CalendarDays },
  { key: 'people',   label: 'Pessoas',       icon: Users        },
  { key: 'history',  label: 'Histórico',     icon: Clock        },
  { key: 'settings', label: 'Config',        icon: SettingsIcon },
]

export default function App() {
  const [view, setView] = useState('matrix')
  const [modal, setModal] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)

  const { user, accessToken, loading: authLoading, signIn, signUp, signOut, refreshSession } = useAuth()
  useEffect(() => { setProxyToken(accessToken || '') }, [accessToken])
  useEffect(() => { setUnauthorizedHandler(refreshSession) }, [refreshSession])
  const { tasks, loading, serverMode, statusHistory, createTask, updateTask, deleteTask, toggleStatus } = useTasks()
  const { people, createPerson, updatePerson, deletePerson } = usePeople()
  const { settings, save, saveAnamnesis } = useSettings(accessToken)
  useNotifications(tasks, loading)
  const {
    integrations, externalEvents, loading: integrationsLoading,
    createIntegration, deleteIntegration, syncIntegration, updateIntegration,
    connectOAuth, createGoogleEvent, createClickupTask, createJiraIssue,
  } = useIntegrations(accessToken)

  // Handle OAuth callback redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('error')
    if (connected || oauthError) {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (modal) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (view !== 'matrix') setView('matrix')
        setTimeout(() => window.__matrixFocusSearch?.(), 50)
        return
      }

      switch (e.key) {
        case 'n': case 'N':
          if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); openNew('q2') }
          break
        case '1': setView('matrix');   break
        case '2': setView('agenda');   break
        case '3': setView('people');   break
        case '4': setView('history');  break
        case '5': setView('settings'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, view])

  const createBlock = useCallback(async (data) => {
    const block = { id: uuidv4(), recurrence: 'none', recurrence_end: '', color: '#60a5fa', locked: false, task_id: '', ...data }
    const ipc = window.api?.agenda
    if (ipc) {
      await ipc.create(block)
      return
    }
    const up = await isServerUp()
    if (up) {
      await dataApi.blocks.create(block)
    } else {
      const all = JSON.parse(localStorage.getItem('eisenhower-blocks') || '[]')
      localStorage.setItem('eisenhower-blocks', JSON.stringify([...all, block]))
    }
  }, [])

  if (authLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-notion-muted text-sm">
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />
  }

  if (!settings.onboardingCompleted) {
    return <Onboarding onComplete={data => saveAnamnesis(data)} />
  }

  function openNew(defaultQuadrant) {
    const presets = {
      q1: { urgent: true,  important: true  },
      q2: { urgent: false, important: true  },
      q3: { urgent: true,  important: false },
      q4: { urgent: false, important: false },
    }
    setModal({ task: presets[defaultQuadrant] || {} })
  }

  async function handleSave(form) {
    if (form.id) await updateTask(form)
    else await createTask(form)
    setModal(null)
  }

  const pending = tasks.filter(t => !['completed', 'cancelled'].includes(t.status)).length
  const showNewButton = view !== 'people' && view !== 'settings' && view !== 'history'
  const aiConfig = {
    enabled:  settings.aiEnabled,
    provider: settings.aiProvider  || 'anthropic',
    model:    settings.aiModel     || 'claude-haiku-4-5',
    apiKey:   (settings.aiKeys     || {})[settings.aiProvider] || '',
  }
  const aiReady = settings.aiEnabled && !!aiConfig.apiKey

  return (
    <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 md:px-6 h-12 border-b border-notion-border flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-sm font-semibold text-notion-text tracking-tight">Eisenhower</span>
          <span className="hidden sm:inline text-xs text-notion-muted">{pending} pendente{pending !== 1 ? 's' : ''}</span>
          {serverMode ? (
            <span className="hidden sm:inline text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-medium">
              ⬡ MCP
            </span>
          ) : !authLoading && user && (
            <span className="hidden sm:inline text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
              ⚡ offline
            </span>
          )}
          {settings.assistantEnabled && (
            <span className="hidden sm:inline text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
              {settings.aiEnabled && (settings.aiKeys || {})[settings.aiProvider] ? '✦ IA' : '⚡'}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {VIEWS.map(v => {
            const Icon = v.icon
            return (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-100 ${
                  view === v.key
                    ? 'bg-notion-hover text-notion-text'
                    : 'text-notion-muted hover:bg-notion-surface hover:text-notion-sub'
                }`}
              >
                <Icon size={14} />
                {v.label}
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {showNewButton ? (
            <button onClick={() => openNew('q2')} className="btn-primary">
              <Plus size={14} />
              <span className="hidden sm:inline">Nova tarefa</span>
            </button>
          ) : (
            <div className="hidden md:block w-28" />
          )}
          <div className="flex items-center gap-1 pl-1">
            <span className="hidden sm:inline text-xs text-notion-muted max-w-[140px] truncate">
              {user.user_metadata?.name || user.email}
            </span>
            <button
              onClick={() => setView('settings')}
              title="Configurações"
              className={`text-notion-muted hover:text-notion-text transition-colors p-1.5 rounded-md hover:bg-notion-surface flex-shrink-0 ${view === 'settings' ? 'text-notion-text bg-notion-hover' : ''}`}
            >
              <SettingsIcon size={15} />
            </button>
            <button
              onClick={signOut}
              title={`Sair (${user.email})`}
              className="text-notion-muted hover:text-notion-text transition-colors p-1.5 rounded-md hover:bg-notion-surface flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-notion-muted text-sm">Carregando...</div>
        ) : view === 'matrix' ? (
          <Matrix
            tasks={tasks} people={people}
            onNew={openNew}
            onEdit={task => setModal({ task })}
            onDelete={deleteTask}
            onToggle={toggleStatus}
            onMoveTask={updateTask}
          />
        ) : view === 'agenda' ? (
          <Agenda
            tasks={tasks}
            people={people}
            externalEvents={externalEvents}
            onCreateGoogleEvent={integrations.some(i => i.provider === 'google') ? createGoogleEvent : null}
            onEditTask={task => setModal({ task })}
          />
        ) : view === 'people' ? (
          <People
            people={people} tasks={tasks}
            slackBotToken={settings.slackBotToken}
            onCreate={createPerson} onUpdate={updatePerson} onDelete={deletePerson}
          />
        ) : view === 'history' ? (
          <History tasks={tasks} statusHistory={statusHistory} onDelete={deleteTask} onToggle={toggleStatus} />
        ) : (
          <Settings
            settings={settings}
            onSave={(patch, overrides) => {
              if (overrides !== undefined) {
                saveAnamnesis(patch, overrides)
              } else if ('assistantEnabled' in patch || 'aiEnabled' in patch) {
                save(patch)
              } else {
                saveAnamnesis(patch)
              }
            }}
            onRestartOnboarding={() => save({ onboardingCompleted: false })}
            integrations={integrations}
            integrationsLoading={integrationsLoading}
            onAddIntegration={createIntegration}
            onDeleteIntegration={deleteIntegration}
            onSyncIntegration={syncIntegration}
            onConnectOAuth={connectOAuth}
            onUpdateIntegrationConfig={(id, configPatch) =>
              updateIntegration(id, { config: { ...(integrations.find(i => i.id === id)?.config || {}), ...configPatch } })
            }
          />
        )}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden flex-shrink-0 border-t border-notion-border bg-white flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {VIEWS.map(v => {
          const Icon = v.icon
          return (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                view === v.key ? 'text-notion-text' : 'text-notion-muted'
              }`}
            >
              <Icon size={20} strokeWidth={view === v.key ? 2.2 : 1.7} />
              <span className="text-[10px] font-medium">{v.label}</span>
            </button>
          )
        })}
      </nav>

      {modal && (
        <TaskModal
          task={modal.task}
          people={people}
          assistantEnabled={settings.assistantEnabled}
          aiConfig={aiConfig}
          anamnesis={settings.anamnesis}
          slackBotToken={settings.slackBotToken}
          integrations={integrations}
          onPushExternal={async (integration, payload) => {
            if (integration.provider === 'clickup') return createClickupTask(integration, payload)
            if (integration.provider === 'jira') return createJiraIssue(integration, payload)
          }}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* AI floating action button */}
      {aiReady && (
        <button
          onClick={() => setChatOpen(v => !v)}
          title="Assistente IA"
          className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            chatOpen
              ? 'bg-amber-500 text-white shadow-amber-200 scale-95'
              : 'bg-white border border-notion-border text-notion-muted hover:text-amber-500 hover:border-amber-300 hover:shadow-amber-100 hover:scale-105'
          }`}
        >
          <MessageCircle size={20} />
        </button>
      )}

      {chatOpen && aiReady && (
        <ChatPanel
          tasks={tasks}
          people={people}
          aiConfig={aiConfig}
          onClose={() => setChatOpen(false)}
          onCreateTask={createTask}
          onCreatePerson={createPerson}
          onCreateBlock={createBlock}
        />
      )}
    </div>
  )
}
