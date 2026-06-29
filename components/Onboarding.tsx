'use client'

import { useEffect, useState } from 'react'

const KEY = 'bolao_onboarded_v1'

const TIPS: { icon: string; title: string; body: string }[] = [
  { icon: '👆', title: 'Toque num nome', body: 'Veja os palpites, a posição e a pontuação detalhada de cada participante.' },
  { icon: '↔️', title: 'Deslize entre as abas', body: 'No card do participante, arraste pros lados pra trocar entre Jogados, Seleções e Próximos.' },
  { icon: '⬇️', title: 'Puxe pra atualizar', body: 'Na classificação, puxe a tela pra baixo a partir do topo pra atualizar os pontos.' },
  { icon: '⭐', title: 'Marque "Sou eu"', body: 'No seu card, toque em ☆ Sou eu pra destacar sua linha e receber avisos quando subir/cair.' },
]

export function Onboarding() {
  const [show, setShow] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true) } catch {}
  }, [])

  function close() {
    try { localStorage.setItem(KEY, '1') } catch {}
    setShow(false)
  }

  if (!show) return null
  const tip = TIPS[i]
  const last = i === TIPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-5 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">{tip.icon}</div>
          <h3 className="text-lg font-bold text-white">{tip.title}</h3>
          <p className="text-sm text-gray-400 mt-1.5">{tip.body}</p>
        </div>

        <div className="flex justify-center gap-1.5 mt-4">
          {TIPS.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-[#00bf63]' : 'w-1.5 bg-gray-700'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-5">
          <button onClick={close} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1">Pular</button>
          <button
            onClick={() => (last ? close() : setI(i + 1))}
            className="bg-[#00bf63] hover:bg-[#00a854] text-white font-semibold text-sm px-5 py-2 rounded-xl transition-colors"
          >
            {last ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}
