import React, { useState, useEffect } from 'react'
import { LayoutGrid, CalendarDays, Users, Settings as SettingsIcon, Plus, Clock } from 'lucide-react'
import Matrix from './components/Matrix'
import Agenda from './components/Agenda'
import People from './components/People'
import Settings from './components/Settings'
import History from './components/History'
import TaskModal from './components/TaskModal'
import Onboarding from './components/Onboarding'
import { useTasks } from './hooks/useTasks'
import { usePeople } from './hooks/usePeople'
import { useSettings } from './hooks/useSettings'

const VIEWS = [
  { key: 'matrix',   label: 'Matriz',        icon: LayoutGrid   },
  { key: 'agenda',   label: 'Agenda',        icon: CalendarDays },
  { key: 'people',   label: 'Pessoas',       icon: Users        },
  { key: 'history',  label: 'Histórico',     icon: Clock        },
  { key: 'settings', label: 'Configurações', icon: SettingsIcon },
]

export default function App() {
  const [view, setView] = useState('matrix')
  const [modal, setModal] = useState(null)

  const { tasks, loading, serverMode, createTask, updateTask, deleteTask, toggleStatus } = useTasks()
  const { people, createPerson, updatePerson, deletePerson } = usePeople()
  const { settings, save, saveAnamnesis, toggleAssistant } = useSettings()

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      // Don't fire while typing in an input/textarea or while a modal is open
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (modal) return

      // Ctrl+K / Cmd+K → focus search in matrix
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

  const pending = tasks.filter(t => t.status !== 'completed').length
  const showNewButton = view !== 'people' && view !== 'settings' && view !== 'history'

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-12 border-b border-notion-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-notion-text tracking-tight">Eisenhower</span>
          <span className="text-xs text-notion-muted">{pending} pendente{pending !== 1 ? 's' : ''}</span>
          {serverMode && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-medium">
              ⬡ MCP ativo
            </span>
          )}
          {settings.assistantEnabled && (
            <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
              {settings.aiEnabled && (settings.aiKeys || {})[settings.aiProvider] ? '✦ IA ativa' : '⚡ assistente ativo'}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-1">
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

        {showNewButton ? (
          <button onClick={() => openNew('q2')} className="btn-primary">
            <Plus size={14} /> Nova tarefa
          </button>
        ) : (
          <div className="w-28" />
        )}
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
          <Agenda tasks={tasks} />
        ) : view === 'people' ? (
          <People
            people={people}
            tasks={tasks}
            slackBotToken={settings.slackBotToken}
            onCreate={createPerson}
            onUpdate={updatePerson}
            onDelete={deletePerson}
          />
        ) : view === 'history' ? (
          <History
            tasks={tasks}
            onDelete={deleteTask}
            onToggle={toggleStatus}
          />
        ) : (
          <Settings
            settings={settings}
            onSave={patch => {
              if ('assistantEnabled' in patch || 'aiEnabled' in patch) save(patch)
              else saveAnamnesis(patch)
            }}
            onRestartOnboarding={() => save({ onboardingCompleted: false })}
          />
        )}
      </main>

      {modal && (
        <TaskModal
          task={modal.task}
          people={people}
          assistantEnabled={settings.assistantEnabled}
          aiConfig={{
            enabled:  settings.aiEnabled,
            provider: settings.aiProvider  || 'anthropic',
            model:    settings.aiModel     || 'claude-haiku-4-5',
            apiKey:   (settings.aiKeys     || {})[settings.aiProvider] || '',
          }}
          anamnesis={settings.anamnesis}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
