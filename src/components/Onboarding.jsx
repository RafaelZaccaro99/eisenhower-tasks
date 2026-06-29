import React, { useState } from 'react'
import { ChevronRight, ChevronLeft, Check, X } from 'lucide-react'

const STEPS = [
  { id: 'welcome',    title: 'Bem-vindo ao Eisenhower' },
  { id: 'urgency',   title: 'O que é urgente para você?' },
  { id: 'important', title: 'O que é importante para você?' },
  { id: 'delegate',  title: 'O que você delega?' },
  { id: 'done',      title: 'Tudo pronto!' },
]

const URGENCY_DEADLINE_OPTIONS = [
  { value: 0, label: 'Só o que vence hoje' },
  { value: 1, label: 'Hoje ou amanhã' },
  { value: 2, label: 'Nos próximos 2 dias' },
  { value: 7, label: 'Esta semana' },
]

const URGENCY_TRIGGER_SUGGESTIONS = [
  'hoje', 'urgente', 'agora', 'prazo', 'vence', 'entrega',
  'cliente', 'reunião', 'aprovação', 'pagamento', 'deadline',
]

const IMPORTANCE_TRIGGER_SUGGESTIONS = [
  'meta', 'estratégia', 'planejamento', 'crescimento', 'objetivo',
  'resultado', 'receita', 'produto', 'time', 'lançamento', 'OKR',
]

const DELEGATE_CATEGORY_SUGGESTIONS = [
  'operacional', 'administrativo', 'relatório', 'pesquisa',
  'agendamento', 'suporte', 'formatação', 'cadastro',
]

function TagInput({ tags, onChange, suggestions, placeholder }) {
  const [input, setInput] = useState('')

  function add(val) {
    const v = val.trim().toLowerCase()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  function remove(tag) { onChange(tags.filter(t => t !== tag)) }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-notion-hover text-notion-text text-xs px-2 py-1 rounded-md">
            {t}
            <button type="button" onClick={() => remove(t)} className="text-notion-muted hover:text-red-400">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-xs"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
        />
        <button type="button" onClick={() => add(input)} className="btn-ghost text-xs">+ Add</button>
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
            <button
              key={s} type="button"
              onClick={() => onChange([...tags, s])}
              className="text-xs px-2 py-0.5 rounded-md border border-notion-border text-notion-muted hover:bg-notion-surface hover:text-notion-sub transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    urgencyDeadlineDays: 2,
    urgencyTriggers: ['hoje', 'urgente', 'prazo', 'cliente'],
    urgencyContexts: [],
    importanceAreas: [],
    importanceTriggers: ['meta', 'estratégia', 'objetivo', 'resultado'],
    importanceContexts: [],
    hasDelegation: true,
    delegatableTriggers: ['relatório', 'planilha', 'pesquisar', 'organizar'],
    delegatableCategories: ['operacional', 'administrativo'],
  })

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function next() { if (!isLast) setStep(s => s + 1) }
  function back() { if (step > 0) setStep(s => s - 1) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-xl px-6">
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-notion-text' : 'bg-notion-border'}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[320px] flex flex-col">

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-semibold text-notion-text">Bem-vindo ao Eisenhower Tasks</h1>
              <p className="text-notion-sub text-sm leading-relaxed">
                Vamos configurar o <strong>assistente de enquadramento</strong> com base no seu jeito de trabalhar.
                Responda 3 perguntas rápidas e o sistema vai aprender a sugerir o quadrante certo para cada tarefa.
              </p>
              <p className="text-xs text-notion-muted">
                Você pode alterar tudo isso depois em <strong>Configurações</strong>.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-notion-text mb-1">{current.title}</h2>
                <p className="text-xs text-notion-muted">Defina o que faz uma tarefa ser urgente no seu contexto.</p>
              </div>

              <div>
                <label className="label mb-2">Considero urgente quando o prazo é...</label>
                <div className="flex flex-col gap-2">
                  {URGENCY_DEADLINE_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-notion-border cursor-pointer hover:bg-notion-surface transition-colors">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${data.urgencyDeadlineDays === opt.value ? 'border-notion-text bg-notion-text' : 'border-notion-border2'}`}>
                        {data.urgencyDeadlineDays === opt.value && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      <input type="radio" className="sr-only" checked={data.urgencyDeadlineDays === opt.value}
                        onChange={() => set('urgencyDeadlineDays', opt.value)} />
                      <span className="text-sm text-notion-text">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label mb-2">Palavras que indicam urgência (no título da tarefa)</label>
                <TagInput
                  tags={data.urgencyTriggers}
                  onChange={v => set('urgencyTriggers', v)}
                  suggestions={URGENCY_TRIGGER_SUGGESTIONS}
                  placeholder="Ex: cliente, reunião, aprovação..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-notion-text mb-1">{current.title}</h2>
                <p className="text-xs text-notion-muted">O que define que uma tarefa realmente importa para seus objetivos?</p>
              </div>

              <div>
                <label className="label mb-2">Minhas principais áreas de foco (ex: vendas, produto, time)</label>
                <TagInput
                  tags={data.importanceAreas}
                  onChange={v => set('importanceAreas', v)}
                  placeholder="Ex: vendas, clientes, lançamento..."
                />
              </div>

              <div>
                <label className="label mb-2">Palavras que indicam importância estratégica</label>
                <TagInput
                  tags={data.importanceTriggers}
                  onChange={v => set('importanceTriggers', v)}
                  suggestions={IMPORTANCE_TRIGGER_SUGGESTIONS}
                  placeholder="Ex: meta, estratégia, OKR..."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-notion-text mb-1">{current.title}</h2>
                <p className="text-xs text-notion-muted">Ajuda o sistema a identificar tarefas que podem ir para o quadrante Q3.</p>
              </div>

              <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-notion-border cursor-pointer hover:bg-notion-surface transition-colors">
                <span className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${data.hasDelegation ? 'bg-notion-text' : 'bg-notion-border2'}`}>
                  <span className={`block w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${data.hasDelegation ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                <input type="checkbox" className="sr-only" checked={data.hasDelegation}
                  onChange={e => set('hasDelegation', e.target.checked)} />
                <span className="text-sm text-notion-text">Tenho pessoas para delegar tarefas</span>
              </label>

              {data.hasDelegation && (
                <>
                  <div>
                    <label className="label mb-2">Palavras que indicam que algo pode ser delegado</label>
                    <TagInput
                      tags={data.delegatableTriggers}
                      onChange={v => set('delegatableTriggers', v)}
                      suggestions={DELEGATE_CATEGORY_SUGGESTIONS}
                      placeholder="Ex: relatório, planilha, pesquisar..."
                    />
                  </div>
                  <div>
                    <label className="label mb-2">Categorias delegáveis</label>
                    <TagInput
                      tags={data.delegatableCategories}
                      onChange={v => set('delegatableCategories', v)}
                      placeholder="Ex: operacional, administrativo..."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center py-8">
              <div className="w-14 h-14 rounded-full bg-notion-hover flex items-center justify-center">
                <Check size={28} className="text-notion-text" />
              </div>
              <h2 className="text-xl font-semibold text-notion-text">Configuração concluída</h2>
              <p className="text-sm text-notion-sub max-w-sm leading-relaxed">
                O assistente vai sugerir o quadrante certo com base nas suas regras.
                Você pode refinar isso a qualquer momento em <strong>Configurações → Assistente</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-notion-border">
          <button
            type="button"
            onClick={back}
            className={`btn-ghost ${step === 0 ? 'invisible' : ''}`}
          >
            <ChevronLeft size={14} /> Voltar
          </button>

          {!isLast ? (
            <button type="button" onClick={next} className="btn-primary">
              {step === 0 ? 'Começar' : 'Próximo'} <ChevronRight size={14} />
            </button>
          ) : (
            <button type="button" onClick={() => onComplete(data)} className="btn-primary">
              Entrar no app <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
