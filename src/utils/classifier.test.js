import { describe, it, expect } from 'vitest'
import { classifyTask, quadrantLabel } from './classifier'

describe('classifyTask', () => {
  it('marca como urgente quando o prazo já venceu ou é hoje', () => {
    const today = new Date().toISOString().split('T')[0]
    const result = classifyTask('Revisar contrato', today, {})
    expect(result.urgent).toBe(true)
    expect(result.reasons.some(r => r.includes('Prazo vencido ou hoje'))).toBe(true)
  })

  it('marca como urgente quando o título contém uma palavra-gatilho de urgência', () => {
    const anamnesis = { urgencyTriggers: ['urgente'] }
    const result = classifyTask('Isso é urgente, resolver já', null, anamnesis)
    expect(result.urgent).toBe(true)
  })

  it('marca como importante quando o título contém uma área de foco', () => {
    const anamnesis = { importanceAreas: ['financeiro'] }
    const result = classifyTask('Fechar relatório financeiro do mês', null, anamnesis)
    expect(result.important).toBe(true)
  })

  it('sem prazo e sem match de anamnesis cai no quadrante q4', () => {
    const result = classifyTask('Organizar mesa', null, {})
    expect(result.urgent).toBe(false)
    expect(result.important).toBe(false)
    expect(result.quadrant).toBe('q4')
  })

  it('urgente e importante juntos caem no quadrante q1', () => {
    const anamnesis = { urgencyTriggers: ['urgente'], importanceAreas: ['financeiro'] }
    const result = classifyTask('Urgente: fechar financeiro', null, anamnesis)
    expect(result.quadrant).toBe('q1')
  })
})

describe('quadrantLabel', () => {
  it('traduz os quatro quadrantes conhecidos', () => {
    expect(quadrantLabel('q1')).toBe('Fazer agora')
    expect(quadrantLabel('q2')).toBe('Agendar')
    expect(quadrantLabel('q3')).toBe('Delegar')
    expect(quadrantLabel('q4')).toBe('Eliminar')
  })

  it('repassa chaves desconhecidas sem alterar', () => {
    expect(quadrantLabel('qX')).toBe('qX')
  })
})
