import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Lock, Repeat, Pencil, X, ExternalLink as ExternalLinkIcon } from 'lucide-react'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SNAP = 15 // minutos
const pad = n => String(n).padStart(2, '0')

export const minutesToHHMM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
export const hhmmToMinutes = s => {
  const [h, m] = (s || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}

function snapMin(m) {
  return Math.max(0, Math.min(24 * 60, Math.round(m / SNAP) * SNAP))
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const PROVIDER_ICONS = { google: '🔵', clickup: '🟣', jira: '🔷', ical: '📅' }

function ParticipantBubbles({ ids, people, max = 3 }) {
  const matched = ids.map(id => people.find(p => p.id === id)).filter(Boolean)
  if (!matched.length) return null
  const shown = matched.slice(0, max)
  const rest = matched.length - max
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} title={p.name}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold border border-white flex-shrink-0"
          style={{ backgroundColor: '#6b7280', marginLeft: i > 0 ? -4 : 0, zIndex: i }}>
          {initials(p.name)}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[8px] font-bold border border-white flex-shrink-0" style={{ marginLeft: -4 }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

function ExternalEventChip({ event, hourHeight }) {
  const startMin = hhmmToMinutes(event.start_time || '00:00')
  const endMin = event.end_time ? hhmmToMinutes(event.end_time) : startMin + 60
  const top = (startMin / 60) * hourHeight
  const height = Math.max(((endMin - startMin) / 60) * hourHeight, 24)
  return (
    <a
      href={event.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-xs overflow-hidden"
      style={{ top, height, border: '1.5px dashed #9b9a97', background: 'rgba(155,154,151,0.07)', color: '#6b7280' }}
      title={`${PROVIDER_ICONS[event.provider] || '📅'} ${event.title}${event.url ? ' — abrir' : ''}`}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px]">{PROVIDER_ICONS[event.provider] || '📅'}</span>
        <p className="font-medium truncate leading-tight flex-1">{event.title}</p>
        {event.url && <ExternalLinkIcon size={9} className="flex-shrink-0 opacity-60" />}
      </div>
      <p className="opacity-60 text-[11px]">{event.start_time} – {event.end_time}</p>
    </a>
  )
}

function NowLine({ hourHeight }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const top = (now.getHours() + now.getMinutes() / 60) * hourHeight
  return (
    <div className="absolute left-0 right-0 pointer-events-none" style={{ top, zIndex: 20 }}>
      <div className="relative h-[2px] bg-red-400">
        <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-400" />
      </div>
    </div>
  )
}

// Grade de horários multi-coluna.
// days: [{ date: Date, dateStr, blocks, externalEvents }] — 1 item = dia, 7 = semana.
// Interações de mouse: arrastar em célula vazia cria, arrastar bloco move,
// alça inferior redimensiona. HTML5 DnD aceita tarefas do TaskPanel.
// placingTask: modo "posicionar" (tap na grade agenda a tarefa) — fallback touch.
export default function TimeGrid({
  days, people = [], hourHeight = 56,
  onEditBlock, onDeleteBlock,
  onCreateAt, onMoveBlock, onResizeBlock,
  onDropTask, placingTask, onPlaceTask,
}) {
  const [drag, setDrag] = useState(null)
  const [dropGhost, setDropGhost] = useState(null)
  const colRefs = useRef({})
  const suppressClickRef = useRef(false)
  const scrollRef = useRef(null)
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })()

  // Rola para 7h na montagem (evita abrir a grade em 00:00)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * hourHeight
  }, [hourHeight])

  const yToMinutes = useCallback((clientY, colEl) => {
    const rect = colEl.getBoundingClientRect()
    return snapMin(((clientY - rect.top) / hourHeight) * 60)
  }, [hourHeight])

  const columnUnder = useCallback((clientX) => {
    for (const [dateStr, el] of Object.entries(colRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) return { dateStr, el }
    }
    return null
  }, [])

  // Listeners globais enquanto há drag ativo
  useEffect(() => {
    if (!drag) return

    function onMove(e) {
      setDrag(d => {
        if (!d) return d
        if (d.type === 'create') {
          const colEl = colRefs.current[d.dateStr]
          if (!colEl) return d
          const m = yToMinutes(e.clientY, colEl)
          const startMin = Math.min(d.anchorMin, m)
          const endMin = Math.max(d.anchorMin + SNAP, m)
          return { ...d, startMin, endMin: Math.max(endMin, startMin + SNAP), moved: d.moved || Math.abs(m - d.anchorMin) >= SNAP }
        }
        if (d.type === 'move') {
          const col = columnUnder(e.clientX) || { dateStr: d.dateStr, el: colRefs.current[d.dateStr] }
          if (!col.el) return d
          const cursorMin = yToMinutes(e.clientY, col.el)
          const startMin = snapMin(Math.max(0, Math.min(24 * 60 - d.durMin, cursorMin - d.grabOffsetMin)))
          const moved = d.moved || Math.abs(e.clientY - d.startClientY) > 5 || col.dateStr !== d.origDateStr
          return { ...d, dateStr: col.dateStr, startMin, endMin: startMin + d.durMin, moved }
        }
        if (d.type === 'resize') {
          const colEl = colRefs.current[d.dateStr]
          if (!colEl) return d
          const m = yToMinutes(e.clientY, colEl)
          return { ...d, endMin: Math.max(d.startMin + SNAP, m), moved: true }
        }
        return d
      })
    }

    function onUp() {
      setDrag(d => {
        if (!d) return null
        if (d.type === 'create' && d.moved) {
          onCreateAt?.({ dateStr: d.dateStr, start_time: minutesToHHMM(d.startMin), end_time: minutesToHHMM(d.endMin) })
        } else if (d.type === 'move' && d.moved) {
          suppressClickRef.current = true
          onMoveBlock?.(d.block, d.dateStr, d.startMin)
        } else if (d.type === 'resize' && d.moved) {
          suppressClickRef.current = true
          onResizeBlock?.(d.block, d.endMin)
        }
        return null
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag !== null, yToMinutes, columnUnder, onCreateAt, onMoveBlock, onResizeBlock])

  function armCreate(e, dateStr) {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return // só célula vazia
    if (placingTask) return
    const m = yToMinutes(e.clientY, e.currentTarget)
    setDrag({ type: 'create', dateStr, anchorMin: m, startMin: m, endMin: m + 60, moved: false })
  }

  function armMove(e, block, dateStr) {
    if (e.button !== 0 || block.locked) return
    e.stopPropagation()
    const colEl = colRefs.current[dateStr]
    const cursorMin = yToMinutes(e.clientY, colEl)
    const startMin = hhmmToMinutes(block.start_time)
    const durMin = Math.max(SNAP, hhmmToMinutes(block.end_time) - startMin)
    setDrag({
      type: 'move', block, dateStr, origDateStr: dateStr,
      startMin, endMin: startMin + durMin, durMin,
      grabOffsetMin: cursorMin - startMin, startClientY: e.clientY, moved: false,
    })
  }

  function armResize(e, block, dateStr) {
    if (e.button !== 0 || block.locked) return
    e.stopPropagation()
    e.preventDefault()
    const startMin = hhmmToMinutes(block.start_time)
    setDrag({ type: 'resize', block, dateStr, startMin, endMin: hhmmToMinutes(block.end_time), moved: false })
  }

  function handleBlockClick(block) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    onEditBlock?.(block)
  }

  function handleColumnClick(e, dateStr) {
    if (!placingTask || !onPlaceTask) return
    const colEl = colRefs.current[dateStr]
    const m = yToMinutes(e.clientY, colEl)
    onPlaceTask(dateStr, m)
  }

  const isWeek = days.length > 1

  return (
    <div ref={scrollRef} className="relative overflow-y-auto flex-1">
      <div className="flex" style={{ height: 24 * hourHeight }}>
        {/* Gutter de horas */}
        <div className="w-14 flex-shrink-0 relative select-none">
          {HOURS.map(h => (
            <span key={h} className="absolute right-3 text-xs text-notion-muted" style={{ top: h * hourHeight + 2 }}>
              {pad(h)}:00
            </span>
          ))}
        </div>

        {/* Colunas de dias */}
        {days.map(day => {
          const ghost =
            drag && drag.dateStr === day.dateStr && (drag.type === 'create' || (drag.moved && (drag.type === 'move' || drag.type === 'resize')))
              ? drag
              : null
          const dndGhost = dropGhost && dropGhost.dateStr === day.dateStr ? dropGhost : null
          return (
            <div
              key={day.dateStr}
              ref={el => { colRefs.current[day.dateStr] = el }}
              className={`flex-1 relative border-l border-notion-border ${placingTask ? 'cursor-copy' : ''}`}
              onMouseDown={e => armCreate(e, day.dateStr)}
              onClick={e => handleColumnClick(e, day.dateStr)}
              onDragOver={e => {
                if (!onDropTask) return
                e.preventDefault()
                const m = yToMinutes(e.clientY, e.currentTarget)
                setDropGhost({ dateStr: day.dateStr, startMin: m })
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropGhost(null)
              }}
              onDrop={e => {
                e.preventDefault()
                setDropGhost(null)
                const taskId = e.dataTransfer.getData('application/x-task-id')
                if (taskId && onDropTask) {
                  const m = yToMinutes(e.clientY, e.currentTarget)
                  onDropTask(taskId, day.dateStr, m)
                }
              }}
            >
              {/* Linhas de hora */}
              {HOURS.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-notion-border pointer-events-none" style={{ top: h * hourHeight }} />
              ))}

              {/* Eventos externos */}
              {(day.externalEvents || []).filter(ev => !ev.all_day && ev.start_time).map(ev => (
                <ExternalEventChip key={ev.id} event={ev} hourHeight={hourHeight} />
              ))}

              {/* Blocos */}
              {day.blocks.map(block => {
                const beingDragged = drag?.type === 'move' && drag.moved && drag.block.id === block.id && drag.block.date === block.date
                const beingResized = drag?.type === 'resize' && drag.moved && drag.block.id === block.id && drag.block.date === block.date
                if (beingDragged) return null
                const startMin = hhmmToMinutes(block.start_time)
                const endMin = beingResized ? drag.endMin : hhmmToMinutes(block.end_time)
                const top = (startMin / 60) * hourHeight
                const height = Math.max(((endMin - startMin) / 60) * hourHeight, 24)
                const participants = Array.isArray(block.participants) ? block.participants : []
                const recurring = block.recurrence && block.recurrence !== 'none'
                return (
                  <div
                    key={block.id + block.date}
                    data-block
                    className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-white text-xs overflow-hidden group cursor-pointer select-none"
                    style={{ top, height, backgroundColor: block.color || '#60a5fa', opacity: block.locked ? 1 : 0.9, zIndex: 10 }}
                    onMouseDown={e => armMove(e, block, day.dateStr)}
                    onClick={e => { e.stopPropagation(); handleBlockClick(block) }}
                  >
                    <div className="flex items-center gap-1">
                      {block.locked && <Lock size={9} className="flex-shrink-0 opacity-80" />}
                      {recurring && <Repeat size={9} className="flex-shrink-0 opacity-80" />}
                      <p className="font-medium truncate leading-tight flex-1">{block.title}</p>
                      {!isWeek && participants.length > 0 && (
                        <ParticipantBubbles ids={participants} people={people} max={3} />
                      )}
                    </div>
                    <p className="opacity-70 text-[11px]">
                      {block.start_time} – {beingResized ? minutesToHHMM(endMin) : block.end_time}
                    </p>
                    {!isWeek && participants.length > 0 && height >= 48 && (
                      <p className="opacity-70 text-[10px] truncate">
                        {participants.map(id => people.find(p => p.id === id)?.name?.split(' ')[0]).filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); suppressClickRef.current = false; onEditBlock?.(block) }}
                        className="hover:opacity-80"
                      >
                        <Pencil size={10} />
                      </button>
                      {!block.locked && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); onDeleteBlock?.(block) }}
                          className="hover:opacity-80"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    {block.locked && (
                      <span className="absolute bottom-0.5 right-1.5 opacity-40 text-[10px]">travado</span>
                    )}
                    {/* Alça de redimensionamento */}
                    {!block.locked && (
                      <div
                        className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize"
                        onMouseDown={e => armResize(e, block, day.dateStr)}
                      />
                    )}
                  </div>
                )
              })}

              {/* Ghost do drag (criar/mover/redimensionar) */}
              {ghost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/60 px-2 py-1 text-xs text-blue-600 pointer-events-none"
                  style={{
                    top: (ghost.startMin / 60) * hourHeight,
                    height: Math.max(((ghost.endMin - ghost.startMin) / 60) * hourHeight, 20),
                    zIndex: 30,
                  }}
                >
                  {ghost.type === 'move' ? ghost.block.title : ''}
                  <span className="block font-medium">
                    {minutesToHHMM(ghost.startMin)} – {minutesToHHMM(ghost.endMin)}
                  </span>
                </div>
              )}

              {/* Ghost do drop de tarefa */}
              {dndGhost && (
                <div
                  className="absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-amber-400 bg-amber-50/60 px-2 py-1 text-xs text-amber-600 pointer-events-none"
                  style={{ top: (dndGhost.startMin / 60) * hourHeight, height: hourHeight, zIndex: 30 }}
                >
                  <span className="font-medium">{minutesToHHMM(dndGhost.startMin)} – {minutesToHHMM(dndGhost.startMin + 60)}</span>
                </div>
              )}

              {/* Linha "agora" */}
              {day.dateStr === todayStr && <NowLine hourHeight={hourHeight} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
