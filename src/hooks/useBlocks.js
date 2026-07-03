import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isServerUp, dataApi } from '../utils/dataApi'
import { expandOccurrences } from '../utils/recurrence'

const ipc = window.api?.agenda

function lsRead() {
  try { return JSON.parse(localStorage.getItem('eisenhower-blocks') || '[]') } catch { return [] }
}
function lsWrite(blocks) { localStorage.setItem('eisenhower-blocks', JSON.stringify(blocks)) }

const BLOCK_DEFAULTS = {
  task_id: '', title: '', start_time: '09:00', end_time: '10:00',
  color: '#60a5fa', locked: false, recurrence: 'none', recurrence_end: '',
  participants: [], recurrence_exceptions: [], client_id: null,
}

export function useBlocks() {
  const [blocks, setBlocks] = useState([])
  const [serverMode, setServerMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      if (ipc) {
        // IPC getByDate é por dia; para a visão semanal carregamos tudo via getAll se existir
        const all = ipc.getAll ? await ipc.getAll() : []
        setBlocks(all)
        return
      }
      const up = await isServerUp()
      setServerMode(up)
      setBlocks(up ? await dataApi.blocks.list() : lsRead())
    } catch {
      setServerMode(false)
      setBlocks(lsRead())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Ocorrências (séries expandidas) no intervalo — para visão dia use from === to
  const occurrencesFor = useCallback((fromStr, toStr) => {
    return expandOccurrences(blocks, fromStr, toStr)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }, [blocks])

  const persistCreate = useCallback(async (block) => {
    if (ipc) await ipc.create(block)
    else if (serverMode) await dataApi.blocks.create(block)
    else lsWrite([...lsRead(), block])
  }, [serverMode])

  const persistPatch = useCallback(async (id, patch) => {
    if (ipc) {
      const all = ipc.getAll ? await ipc.getAll() : []
      const existing = all.find(b => b.id === id)
      if (existing) await ipc.update({ ...existing, ...patch })
    } else if (serverMode) {
      await dataApi.blocks.update(id, patch)
    } else {
      const all = lsRead()
      const idx = all.findIndex(b => b.id === id)
      if (idx !== -1) { all[idx] = { ...all[idx], ...patch }; lsWrite(all) }
    }
  }, [serverMode])

  const createBlock = useCallback(async (data) => {
    const block = { id: uuidv4(), ...BLOCK_DEFAULTS, ...data }
    await persistCreate(block)
    await reload()
    return block
  }, [persistCreate, reload])

  const isRecurring = b => b.recurrence && b.recurrence !== 'none'

  // scope: 'series' (padrão) altera a série/bloco inteiro.
  // scope: 'single' destaca a ocorrência de `date`: adiciona exceção na série
  // e cria um bloco avulso com o patch aplicado (padrão iCal EXDATE).
  const updateBlock = useCallback(async (block, patch, { scope = 'series', date } = {}) => {
    if (scope === 'single' && isRecurring(block) && date) {
      const exceptions = [...new Set([...(block.recurrence_exceptions || []), date])]
      await persistPatch(block.id, { recurrence_exceptions: exceptions })
      try {
        const detached = {
          ...block, ...patch,
          id: uuidv4(),
          date: patch.date || date, // ocorrência movida pode trocar de dia
          recurrence: 'none', recurrence_end: '', recurrence_exceptions: [],
        }
        delete detached.created_at; delete detached.seriesDate; delete detached.user_id
        await persistCreate(detached)
      } catch (e) {
        // rollback best-effort da exceção
        await persistPatch(block.id, { recurrence_exceptions: block.recurrence_exceptions || [] })
        throw e
      }
    } else {
      const clean = { ...patch }
      delete clean.seriesDate
      delete clean.id
      await persistPatch(block.id, clean)
    }
    await reload()
  }, [persistCreate, persistPatch, reload])

  const deleteBlock = useCallback(async (block, { scope = 'series', date } = {}) => {
    if (scope === 'single' && isRecurring(block) && date) {
      const exceptions = [...new Set([...(block.recurrence_exceptions || []), date])]
      await persistPatch(block.id, { recurrence_exceptions: exceptions })
    } else {
      if (ipc) await ipc.delete(block.id)
      else if (serverMode) await dataApi.blocks.delete(block.id)
      else {
        const all = lsRead()
        const found = all.find(b => b.id === block.id)
        if (found?.locked) return
        lsWrite(all.filter(b => b.id !== block.id))
      }
    }
    await reload()
  }, [persistPatch, reload, serverMode])

  return { blocks, serverMode, loading, reload, occurrencesFor, createBlock, updateBlock, deleteBlock }
}
