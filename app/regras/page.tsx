export default function RegrasPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Regras e Pontuação</h2>
        <p className="text-sm text-gray-500 mt-1">Como funciona o Bolão Copa do Mundo 2026</p>
      </div>

      {/* Match scoring */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="bg-green-800 px-4 py-2.5">
          <h3 className="font-bold text-white text-sm uppercase tracking-wide">⚽ Pontuação por Jogo</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-800 bg-gray-950/40">
              <th className="px-4 py-2 text-left">Acerto</th>
              <th className="px-4 py-2 text-right w-24">Pontos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              ['✅', 'Resultado certo (vitória/empate/derrota)', '4 pts'],
              ['⚽', 'Gols exatos do time mandante', '+1 pt'],
              ['⚽', 'Gols exatos do time visitante', '+1 pt'],
              ['🎯', 'Placar exato completo', '+2 pts'],
              ['🔥', 'Gols de um time ≥ 4 e você acertou quantos', '+2 pts/time'],
              ['📊', 'Classificação completa do grupo (1º, 2º, 3º e 4º lugar todos certos)', '+2 pts/grupo'],
            ].map(([icon, desc, pts]) => (
              <tr key={desc}>
                <td className="px-4 py-3 text-gray-300">
                  <span className="mr-2">{icon}</span>{desc}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400 whitespace-nowrap">{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-950/20 border-t border-gray-800 text-xs text-yellow-700 dark:text-yellow-500">
          Máximo por jogo: 4 + 1 + 1 + 2 = <strong>8 pontos</strong> (+ até 4 bônus se algum time fizer ≥4 gols)
        </div>
      </section>

      {/* Example */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-800">
          <h3 className="font-semibold text-gray-300 text-sm">📋 Exemplo</h3>
        </div>
        <div className="px-4 py-4 space-y-2 text-sm text-gray-400">
          <p>Resultado real: <strong className="text-white">Brasil 3 × 1 Argentina</strong></p>
          <div className="grid grid-cols-1 gap-1 mt-2">
            {[
              { pred: 'Palpite: 2×0 (Brasil vence)', pts: '+4', reason: 'resultado certo' },
              { pred: 'Palpite: 3×0 (Brasil vence, 3 gols certos)', pts: '+4 +1', reason: 'resultado + gols do Brasil' },
              { pred: 'Palpite: 3×1 (placar exato!)', pts: '+4 +1 +1 +2', reason: 'resultado + ambos os gols + bônus exato' },
              { pred: 'Palpite: 1×1 (achei que empataria)', pts: '0', reason: 'resultado errado' },
            ].map(({ pred, pts, reason }) => (
              <div key={pred} className="flex items-start gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                <span className="text-gray-300 flex-1">{pred}</span>
                <span className="text-green-600 dark:text-green-400 font-bold shrink-0">{pts} pts</span>
                <span className="text-gray-600 text-xs shrink-0 hidden sm:block">({reason})</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phase advancement */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="bg-yellow-700 px-4 py-2.5">
          <h3 className="font-bold text-white text-sm uppercase tracking-wide">🏆 Classificação no Mata-Mata</h3>
        </div>
        <p className="px-4 py-3 text-xs text-gray-500 border-b border-gray-800">
          Pontos ganhos por cada time que você previu avançar em cada fase (baseado nos seus palpites de jogos anteriores).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-800 bg-gray-950/40">
              <th className="px-4 py-2 text-left">Fase</th>
              <th className="px-4 py-2 text-right w-36">Pts por time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[
              ['16 avos (classificados da fase de grupos)', '3 pts'],
              ['Oitavas de Final', '4 pts'],
              ['Quartas de Final', '6 pts'],
              ['Semifinal', '8 pts'],
              ['Final', '10 pts'],
              ['Campeão 🏆', '+12 pts'],
            ].map(([phase, pts]) => (
              <tr key={phase}>
                <td className="px-4 py-3 text-gray-300">{phase}</td>
                <td className="px-4 py-3 text-right font-bold text-yellow-600 dark:text-yellow-400">{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Penalties */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 space-y-2">
        <h3 className="font-semibold text-gray-200">🟡 Pênaltis e Prorrogação</h3>
        <p className="text-sm text-gray-400">
          Em jogos do mata-mata que terminam empatados, você também pode indicar qual time avança
          (por pênaltis ou prorrogação). Esse acerto serve como <strong className="text-gray-200">critério de desempate</strong> na
          classificação — não soma pontos extras.
        </p>
      </section>

      {/* Zone */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 space-y-2">
        <h3 className="font-semibold text-gray-200">💸 Zona de Rebaixamento</h3>
        <p className="text-sm text-gray-400">
          Os <strong className="text-red-600 dark:text-red-400">7 últimos colocados</strong> ao final do torneio ficam na zona de rebaixamento (💸).
          Os <strong className="text-yellow-600 dark:text-yellow-400">2 acima</strong> estão em alerta (⚠️).
        </p>
      </section>

      {/* Tips */}
      <section className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl px-4 py-4 space-y-1.5">
        <h3 className="font-semibold text-green-700 dark:text-green-300 text-sm">💡 Dicas</h3>
        <ul className="text-sm text-green-700 dark:text-green-400/80 space-y-1 list-disc list-inside">
          <li>Apostar no placar exato vale muito mais — priorize jogos onde você tem convicção</li>
          <li>Os pontos de classificação no mata-mata podem virar o jogo no final do torneio</li>
          <li>Acertar o campeão vale 12 pontos extras!</li>
        </ul>
      </section>
    </div>
  )
}
