// Builds the "you moved" notification for the identified participant.
// Shared by the client (in-app toast / OS notification) and the server (push).
export function positionMessage(prev: number, rank: number, total: number): { title: string; body: string } | null {
  if (prev === rank) return null
  const up = rank < prev
  const pos = ` — agora ${rank}º`

  if (up && rank === 1) return { title: '👑 Liderança!', body: 'Você é o líder do Bolão!' + pos }
  if (up && rank === 2) return { title: '🥈 2ª posição', body: 'Você assumiu a 2ª posição!' + pos }
  if (up && rank === 3) return { title: '🥉 3ª posição', body: 'Você assumiu a 3ª posição!' + pos }
  if (up && rank >= 4 && rank <= 7 && prev > 7) return { title: '🎯 Zona de classificação', body: 'Você entrou na zona de classificação (Top 7)!' + pos }

  // Red zone = bottom 7 positions
  const redStart = total - 6
  if (total >= 7 && rank >= redStart && prev < redStart) return { title: '🟥 Zona dos pagões', body: 'Você entrou na zona dos pagões!' + pos }

  const d = prev - rank
  if (d > 0) return { title: '🔼 Você subiu', body: `Subiu ${d} posiç${d > 1 ? 'ões' : 'ão'}${pos}` }
  return { title: '🔽 Você caiu', body: `Caiu ${Math.abs(d)} posiç${Math.abs(d) > 1 ? 'ões' : 'ão'}${pos}` }
}
