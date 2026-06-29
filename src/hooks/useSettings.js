import { useState, useCallback } from 'react'

const DEFAULTS = {
  assistantEnabled: true,
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiModel: 'claude-haiku-4-5',
  aiKeys: {},
  slackBotToken: '',
  onboardingCompleted: false,
  anamnesis: {
    // Urgência
    urgencyDeadlineDays: 2,
    urgencyTriggers: ['hoje', 'urgente', 'agora', 'prazo', 'vence', 'entrega', 'cliente', 'reunião'],
    urgencyContexts: [],          // ex: ['cliente X', 'chefe pede']

    // Importância
    importanceAreas: [],          // ex: ['vendas', 'produto', 'time']
    importanceTriggers: ['meta', 'estratégia', 'planejamento', 'crescimento', 'objetivo', 'resultado'],
    importanceContexts: [],

    // Delegação
    hasDelegation: true,
    delegatableTriggers: ['relatório', 'planilha', 'enviar', 'agendar', 'pesquisar', 'organizar'],
    delegatableCategories: ['operacional', 'administrativo'],
  }
}

function lsRead() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('eisenhower-settings') || '{}') } }
  catch { return DEFAULTS }
}
function lsWrite(data) { localStorage.setItem('eisenhower-settings', JSON.stringify(data)) }

export function useSettings() {
  const [settings, setSettings] = useState(lsRead)

  const save = useCallback((patch) => {
    const next = { ...lsRead(), ...patch }
    lsWrite(next)
    setSettings(next)
  }, [])

  const saveAnamnesis = useCallback((anamnesisPatch) => {
    const current = lsRead()
    const { __aiProvider, __aiModel, __aiKeys, __slackBotToken, ...rest } = anamnesisPatch
    const next = {
      ...current,
      anamnesis: { ...current.anamnesis, ...rest },
      onboardingCompleted: true,
      ...(typeof __aiProvider      !== 'undefined' ? { aiProvider:     __aiProvider      } : {}),
      ...(typeof __aiModel         !== 'undefined' ? { aiModel:        __aiModel         } : {}),
      ...(typeof __aiKeys          !== 'undefined' ? { aiKeys:         __aiKeys          } : {}),
      ...(typeof __slackBotToken   !== 'undefined' ? { slackBotToken:  __slackBotToken   } : {}),
    }
    lsWrite(next)
    setSettings(next)
  }, [])

  const toggleAssistant = useCallback(() => {
    const current = lsRead()
    save({ assistantEnabled: !current.assistantEnabled })
  }, [save])

  return { settings, save, saveAnamnesis, toggleAssistant }
}
