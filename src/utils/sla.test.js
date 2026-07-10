import { describe, it, expect } from 'vitest'
import { daysBetween, computeSLA, computeMetrics } from './sla'

describe('daysBetween', () => {
  it('computa a diferença em dias entre duas datas', () => {
    expect(daysBetween('2026-01-01', '2026-01-05')).toBe(4)
  })
})

describe('computeSLA', () => {
  const task = { id: 't1', created_at: '2026-01-01T09:00:00Z', due_date: '2026-01-10' }

  it('calcula leadTime e cycleTime e marca slaOk quando concluído no prazo', () => {
    const history = [
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't1', to_status: 'completed', changed_at: '2026-01-06T09:00:00Z' },
    ]
    const result = computeSLA(task, history)
    expect(result.leadTime).toBe(5)
    expect(result.cycleTime).toBe(4)
    expect(result.slaOk).toBe(true)
    expect(result.daysLate).toBeNull()
  })

  it('marca slaOk false e calcula daysLate quando concluído após o prazo', () => {
    const history = [
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't1', to_status: 'completed', changed_at: '2026-01-13T09:00:00Z' },
    ]
    const result = computeSLA(task, history)
    expect(result.slaOk).toBe(false)
    expect(result.daysLate).toBeGreaterThan(0)
  })

  it('acumula tempo bloqueado a partir de entradas blocked seguidas de outra entrada', () => {
    const history = [
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't1', to_status: 'blocked', changed_at: '2026-01-03T09:00:00Z' },
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-05T09:00:00Z' },
      { task_id: 't1', to_status: 'completed', changed_at: '2026-01-06T09:00:00Z' },
    ]
    const result = computeSLA(task, history)
    expect(result.timeBlockedDays).toBe(2)
  })

  it('conta tempo bloqueado até agora quando a tarefa nunca saiu do estado blocked', () => {
    const history = [
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't1', to_status: 'blocked', changed_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ]
    const result = computeSLA(task, history)
    expect(result.timeBlockedDays).toBeGreaterThanOrEqual(3)
  })

  it('retorna leadTime/cycleTime/slaOk nulos quando a tarefa nunca foi concluída', () => {
    const result = computeSLA(task, [])
    expect(result.leadTime).toBeNull()
    expect(result.cycleTime).toBeNull()
    expect(result.slaOk).toBeNull()
  })
})

describe('computeMetrics', () => {
  it('agrega total concluído, compliance e médias de lead/cycle', () => {
    const tasks = [
      { id: 't1', status: 'completed', created_at: '2026-01-01T09:00:00Z', due_date: '2026-01-10' },
      { id: 't2', status: 'completed', created_at: '2026-01-01T09:00:00Z', due_date: '2026-01-05' },
      { id: 't3', status: 'pending', created_at: '2026-01-01T09:00:00Z', due_date: '2026-01-10' },
    ]
    const statusHistory = [
      { task_id: 't1', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't1', to_status: 'completed', changed_at: '2026-01-06T09:00:00Z' },
      { task_id: 't2', to_status: 'in_progress', changed_at: '2026-01-02T09:00:00Z' },
      { task_id: 't2', to_status: 'completed', changed_at: '2026-01-08T09:00:00Z' },
    ]
    const result = computeMetrics(tasks, statusHistory)
    expect(result.totalCompleted).toBe(2)
    expect(result.compliance).toBe(50)
    expect(result.avgLead).not.toBeNull()
    expect(result.avgCycle).not.toBeNull()
  })

  it('retorna compliance nula quando nenhuma tarefa concluída tem due_date avaliável', () => {
    const result = computeMetrics([], [])
    expect(result.totalCompleted).toBe(0)
    expect(result.compliance).toBeNull()
  })
})
