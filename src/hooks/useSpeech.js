import { useState, useRef, useEffect, useCallback } from 'react'

// Ditado por voz via Web Speech API (nativa do navegador — Chrome/Edge/Safari).
// Sem serviços externos. Em navegadores sem suporte (Firefox), supported=false
// e o botão de microfone não deve ser renderizado.
const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useSpeech({ lang = 'pt-BR', onFinal } = {}) {
  const supported = !!SpeechRecognitionImpl
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    if (!supported || listening) return
    setError('')
    const rec = new SpeechRecognitionImpl()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) onFinalRef.current?.(text)
        } else {
          interimText += result[0].transcript
        }
      }
      setInterim(interimText)
    }

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Permissão de microfone negada — libere o acesso nas configurações do navegador.')
      }
      // 'no-speech' e 'aborted' são silenciosos (usuário parou de falar / fechou)
      setListening(false)
      setInterim('')
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [supported, listening, lang])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  return { supported, listening, interim, error, start, stop, toggle }
}
