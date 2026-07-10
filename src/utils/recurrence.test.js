import { describe, it, expect } from 'vitest'
import { occursOn, expandOccurrences, nextDueDate } from './recurrence'

describe('occursOn', () => {
  it('recurrence none só ocorre na data exata do bloco', () => {
    const block = { date: '2026-01-05', recurrence: 'none' }
    expect(occursOn(block, '2026-01-05')).toBe(true)
    expect(occursOn(block, '2026-01-06')).toBe(false)
  })

  it('daily ocorre em qualquer data a partir da origem', () => {
    const block = { date: '2026-01-05', recurrence: 'daily' }
    expect(occursOn(block, '2026-01-05')).toBe(true)
    expect(occursOn(block, '2026-01-20')).toBe(true)
    expect(occursOn(block, '2026-01-04')).toBe(false)
  })

  it('weekly só ocorre no mesmo dia da semana da origem', () => {
    const block = { date: '2026-01-05', recurrence: 'weekly' } // segunda-feira
    expect(occursOn(block, '2026-01-12')).toBe(true) // segunda seguinte
    expect(occursOn(block, '2026-01-13')).toBe(false) // terça
  })

  it('monthly cai no último dia do mês quando o mês é mais curto que o dia de origem', () => {
    const block = { date: '2026-01-31', recurrence: 'monthly' }
    expect(occursOn(block, '2026-02-28')).toBe(true) // 2026 não é bissexto
    expect(occursOn(block, '2026-02-27')).toBe(false)
    expect(occursOn(block, '2026-03-31')).toBe(true)
  })

  it('respeita recurrence_exceptions', () => {
    const block = { date: '2026-01-05', recurrence: 'daily', recurrence_exceptions: ['2026-01-06'] }
    expect(occursOn(block, '2026-01-06')).toBe(false)
    expect(occursOn(block, '2026-01-07')).toBe(true)
  })

  it('respeita recurrence_end', () => {
    const block = { date: '2026-01-05', recurrence: 'daily', recurrence_end: '2026-01-10' }
    expect(occursOn(block, '2026-01-10')).toBe(true)
    expect(occursOn(block, '2026-01-11')).toBe(false)
  })
})

describe('expandOccurrences', () => {
  it('expande um bloco diário no intervalo, mantendo seriesDate como origem', () => {
    const blocks = [{ id: 'b1', date: '2026-01-05', recurrence: 'daily' }]
    const result = expandOccurrences(blocks, '2026-01-05', '2026-01-07')
    expect(result).toHaveLength(3)
    expect(result.map(o => o.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
    expect(result.every(o => o.seriesDate === '2026-01-05')).toBe(true)
  })

  it('não gera ocorrências para bloco fora do intervalo', () => {
    const blocks = [{ id: 'b1', date: '2026-02-01', recurrence: 'none' }]
    const result = expandOccurrences(blocks, '2026-01-05', '2026-01-07')
    expect(result).toHaveLength(0)
  })
})

describe('nextDueDate', () => {
  it('daily soma um dia', () => {
    expect(nextDueDate('2026-01-05', 'daily')).toBe('2026-01-06')
  })

  it('weekly soma sete dias', () => {
    expect(nextDueDate('2026-01-05', 'weekly')).toBe('2026-01-12')
  })

  it('monthly com dia 31 cai no último dia de fevereiro (não bissexto)', () => {
    expect(nextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28')
  })
})
