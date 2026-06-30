import React, { useState, useRef } from 'react'
import { Check, Plus, Trash2, User, Search, X, Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const QUADRANTS = [
  { key: 'q1', label: 'Fazer agora',  sub: 'Urgente · Importante',         dot: 'bg-red-400',        chip: 'bg-red-50 text-red-500',             urgent: true,  important: true  },
  { key: 'q2', label: 'Agendar',      sub: 'Não urgente · Importante',     dot: 'bg-blue-400',       chip: 'bg-blue-50 text-blue-500',            urgent: false, important: true  },
  { key: 'q3', label: 'Delegar',      sub: 'Urgente · Não importante',     dot: 'bg-amber-400',      chip: 'bg-amber-50 text-amber-600',          urgent: true,  important: false },
  { key: 'q4', label: 'Eliminar',     sub: 'Não urgente · Não importante', dot: 'bg-notion-border2', chip: 'bg-notion-surface text-notion-muted', urgent: false, important: false },
]

function TaskRow({ task, q, person, onEdit, onDelete, onToggle, onDragStart }) {
  const done = task.status === 'completed'
  return (
    <div
      className="task-row group cursor-grab active:cursor-grabbing select-none"
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={() => onEdit(task)}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(task) }}
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
          done ? 'bg-notion-text border-notion-text' : 'border-notion-border2 hover:border-notion-sub'
        }`}
      >
        {done && <Check size={10} strokeWidth={3} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm leading-5 ${done ? 'line-through text-notion-muted' : 'text-notion-text'}`}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.due_date && (
            <span className="text-xs text-notion-muted">
              {format(new Date(task.due_date + 'T00:00:00'), "d MMM", { locale: ptBR })}
            </span>
          )}
          {task.category && task.category !== 'geral' && (
            <span className={`chip ${q.chip}`}>{task.category}</span>
          )}
          {person && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              <User size={10} /> {person.name.split(' ')[0]}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(task.id) }}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-notion-muted hover:text-red-400 transition-all p-0.5"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function Matrix({ tasks, people = [], onNew, onEdit, onDelete, onToggle, onMoveTask }) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPerson, setFilterPerson] = useState('')
  const [showCompleted, setShowCompleted] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [dragOverKey, setDragOverKey] = useState(null)
  const [mobileQ, setMobileQ] = useState('q1')
  const dragTask = useRef(null)
  const searchRef = useRef(null)

  if (typeof window !== 'undefined') {
    window.__matrixFocusSearch = () => searchRef.current?.focus()
  }

  const findPerson = id => people.find(p => p.id === id)
  const categories = [...new Set(tasks.map(t => t.category).filter(c => c && c !== 'geral'))]
  const hasFilters = search || filterCategory || filterPerson || !showCompleted

  function filterTasks(qKey) {
    return tasks.filter(t => {
      if (t.quadrant !== qKey) return false
      if (!showCompleted && t.status === 'completed') return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCategory && t.category !== filterCategory) return false
      if (filterPerson && t.delegated_to !== filterPerson) return false
      return true
    })
  }

  function handleDragStart(e, task) {
    dragTask.current = task
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, targetKey) {
    e.preventDefault()
    setDragOverKey(null)
    const task = dragTask.current
    dragTask.current = null
    if (!task || task.quadrant === targetKey) return
    const q = QUADRANTS.find(q => q.key === targetKey)
    onMoveTask({ ...task, urgent: q.urgent, important: q.important })
  }

  function clearFilters() {
    setSearch(''); setFilterCategory(''); setFilterPerson(''); setShowCompleted(true)
  }

  function QuadrantContent({ q }) {
    const qTasks = filterTasks(q.key)
    const isDropTarget = dragOverKey === q.key
    return (
      <>
        {isDropTarget && <div className="mx-1 mb-1.5 h-0.5 rounded-full bg-blue-300/70" />}
        {qTasks.length === 0 ? (
          <p className="text-xs text-notion-placeholder px-3 py-2 cursor-pointer hover:text-notion-muted transition-colors"
            onClick={() => onNew(q.key)}>
            + Adicionar tarefa
          </p>
        ) : (
          qTasks.map(t => (
            <TaskRow
              key={t.id} task={t} q={q}
              person={t.delegated_to ? findPerson(t.delegated_to) : null}
              onEdit={onEdit} onDelete={onDelete} onToggle={onToggle}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="flex flex-col gap-1.5 px-3 md:px-4 py-2 border-b border-notion-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search — full width on mobile */}
          <div className="relative flex-1 md:flex-none">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-muted pointer-events-none" />
            <input
              ref={searchRef}
              id="matrix-search"
              className="w-full md:w-52 pl-8 pr-7 py-1.5 text-sm border border-notion-border rounded-md bg-notion-surface focus:outline-none focus:border-notion-border2 text-notion-text placeholder-notion-placeholder"
              placeholder="Buscar tarefas…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-muted hover:text-notion-text">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Desktop filters inline */}
          {categories.length > 0 && (
            <select className="hidden md:block text-sm border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none"
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">Categoria</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {people.length > 0 && (
            <select className="hidden md:block text-sm border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none"
              value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
              <option value="">Pessoa</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
            </select>
          )}
          <button onClick={() => setShowCompleted(v => !v)}
            className={`hidden md:flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
              !showCompleted ? 'border-notion-border2 text-notion-sub bg-notion-hover' : 'border-notion-border text-notion-muted hover:border-notion-border2 hover:text-notion-sub'
            }`}>
            {showCompleted ? <Eye size={13} /> : <EyeOff size={13} />}
            Concluídas
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="hidden md:flex text-notion-muted hover:text-red-400 transition-colors p-1" title="Limpar filtros">
              <X size={13} />
            </button>
          )}

          {/* Mobile: filter toggle button */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition-colors ${
              (showFilters || hasFilters) ? 'border-notion-border2 text-notion-sub bg-notion-hover' : 'border-notion-border text-notion-muted'
            }`}
          >
            <SlidersHorizontal size={13} />
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-notion-text" />}
          </button>
        </div>

        {/* Mobile expanded filters */}
        {showFilters && (
          <div className="md:hidden flex flex-wrap gap-2">
            {categories.length > 0 && (
              <select className="text-sm border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none flex-1"
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">Categoria</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {people.length > 0 && (
              <select className="text-sm border border-notion-border rounded-md px-2 py-1.5 bg-notion-surface text-notion-sub focus:outline-none flex-1"
                value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
                <option value="">Pessoa</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name.split(' ')[0]}</option>)}
              </select>
            )}
            <button onClick={() => setShowCompleted(v => !v)}
              className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
                !showCompleted ? 'border-notion-border2 text-notion-sub bg-notion-hover' : 'border-notion-border text-notion-muted'
              }`}>
              {showCompleted ? <Eye size={13} /> : <EyeOff size={13} />}
              Concluídas
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-md border border-notion-border text-notion-muted hover:text-red-400">
                <X size={13} /> Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── MOBILE: tab bar + single quadrant ── */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Quadrant tabs */}
        <div className="flex flex-shrink-0 border-b border-notion-border">
          {QUADRANTS.map(q => {
            const pending = tasks.filter(t => t.quadrant === q.key && t.status !== 'completed').length
            const active = mobileQ === q.key
            return (
              <button key={q.key} onClick={() => setMobileQ(q.key)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 border-b-2 transition-colors ${
                  active ? 'border-notion-text text-notion-text' : 'border-transparent text-notion-muted'
                }`}>
                <span className={`w-2 h-2 rounded-full ${q.dot}`} />
                <span className="text-[10px] font-medium leading-tight">{q.label.split(' ')[0]}</span>
                {pending > 0 && (
                  <span className={`text-[10px] tabular-nums font-semibold ${active ? 'text-notion-text' : 'text-notion-muted'}`}>{pending}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Single quadrant view */}
        {(() => {
          const q = QUADRANTS.find(q => q.key === mobileQ)
          return (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-notion-text">{q.label}</h3>
                  <p className="text-xs text-notion-muted">{q.sub}</p>
                </div>
                <button onClick={() => onNew(q.key)} className="btn-ghost py-2 px-3">
                  <Plus size={15} /> Adicionar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                <QuadrantContent q={q} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── DESKTOP: 2×2 grid ── */}
      <div className="hidden md:grid flex-1 min-h-0 grid-cols-2 grid-rows-2 divide-x divide-y divide-notion-border overflow-hidden">
        {QUADRANTS.map(q => {
          const pending = tasks.filter(t => t.quadrant === q.key && t.status !== 'completed').length
          const isDropTarget = dragOverKey === q.key
          return (
            <div key={q.key}
              className={`flex flex-col min-h-0 overflow-hidden transition-colors duration-100 ${isDropTarget ? 'bg-blue-50/50' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverKey(q.key) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverKey(null) }}
              onDrop={e => handleDrop(e, q.key)}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.dot}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-notion-text leading-tight">{q.label}</h3>
                    <p className="text-xs text-notion-muted">{q.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pending > 0 && <span className="text-xs text-notion-muted tabular-nums">{pending}</span>}
                  <button onClick={() => onNew(q.key)} className="text-notion-muted hover:text-notion-text transition-colors">
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-3">
                <QuadrantContent q={q} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
