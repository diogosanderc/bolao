// 4-letter chip code for a participant name, matching the match-predictions modal.
// Special cases disambiguate collisions on the first 4 letters
// (LUCILIO vs LUCIO, MORELLI vs MOREATICO).
export function chipCode(name: string): string {
  if (name === 'LUCILIO') return 'LCLI'
  if (name === 'MORELLI') return 'MRLI'
  return name.substring(0, 4).toUpperCase()
}
