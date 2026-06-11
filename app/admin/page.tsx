'use client'

import { useEffect, useState } from 'react'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById, groupById, matchById, ALL_MATCHES } from '@/lib/copa2026'
import { Participant, Match, PHASE_LABELS } from '@/lib/types'

const ADMIN_KEY_STORAGE = 'bolao_admin_key'

function useAdminKey() {
  const [key, setKey] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE)
    if (stored) { setKey(stored); setConfirmed(true) }
  }, [])

  function confirm(k: string) {
    localStorage.setItem(ADMIN_KEY_STORAGE, k)
    setKey(k)
    setConfirmed(true)
  }
  return { key, confirmed, confirm, setKey }
}

export default function AdminPage() {
  const { key, confirmed, confirm, setKey } = useAdminKey()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [results, setResults] = useState<Record<string, { score1?: number; score2?: number; advancingTeamId?: string }>>({})
  const [newName, setNewName] = useState('')
  const [activeTab, setActiveTab] = useState<'participants' | 'results' | 'knockout'>('participants')
  const [activeGroup, setActiveGroup] = useState('A')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [inputKey, setInputKey] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    if (!confirmed) return
    fetch('/api/participants').then(r => r.json()).then(setParticipants)
    fetch('/api/results').then(r => r.json()).then((res: Array<{ matchId: string; score1: number; score2: number; advancingTeamId?: string }>) => {
      const m: Record<string, typeof res[0]> = {}
      for (const r of res) m[r.matchId] = r
      setResults(m)
    })
  }, [confirmed])

  async function addParticipant() {
    if (!newName.trim()) return
    setSaving(true)
    const r = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const p = await r.json()
    if (!p.error) {
      setParticipants(prev => [...prev, p])
      setNewName('')
      showToast('Participante adicionado!')
    }
    setSaving(false)
  }

  async function removeParticipant(id: string) {
    if (!window.confirm(`Remover participante?`)) return
    await fetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  async function saveResult(matchId: string, score1: number, score2: number, advancingTeamId?: string) {
    setSaving(true)
    const r = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: key, matchId, score1, score2, advancingTeamId }),
    })
    if (r.ok) {
      setResults(prev => ({ ...prev, [matchId]: { score1, score2, advancingTeamId } }))
      showToast('Resultado salvo!')
    } else {
      showToast('Erro: chave de admin incorreta?')
    }
    setSaving(false)
  }

  async function updateKnockoutTeams(matchId: string, team1Id: string, team2Id: string) {
    // This would update the match teams (requires a different API, simplified here)
    showToast('Funcionalidade em desenvolvimento')
  }

  if (!confirmed) {
    return (
      <div className="max-w-sm mx-auto mt-20 space-y-4">
        <h2 className="text-2xl font-bold text-center text-yellow-400">Acesso Admin</h2>
        <p className="text-gray-400 text-sm text-center">Digite a chave de administrador para continuar.</p>
        <input
          type="password"
          value={inputKey}
          onChange={e => setInputKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirm(inputKey)}
          placeholder="Chave de admin..."
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-yellow-500"
        />
        <button
          onClick={() => confirm(inputKey)}
          className="w-full bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg px-4 py-2 font-semibold transition-colors"
        >
          Entrar
        </button>
        <p className="text-xs text-gray-600 text-center">Padrão: admin123 (configure via variável ADMIN_KEY)</p>
      </div>
    )
  }

  const groupMatchesByGroup = GROUP_MATCHES.reduce((acc, m) => {
    const g = m.groupId!
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const knockoutByPhase = KNOCKOUT_MATCHES.reduce((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = []
    acc[m.phase].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-400">Painel Administrativo</h2>
        <button onClick={() => { localStorage.removeItem(ADMIN_KEY_STORAGE); location.reload() }} className="text-xs text-gray-500 hover:text-gray-300">Sair</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {(['participants', 'results', 'knockout'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {tab === 'participants' ? '👥 Participantes' : tab === 'results' ? '⚽ Resultados (Grupos)' : '🏆 Mata-Mata'}
          </button>
        ))}
      </div>

      {/* PARTICIPANTS */}
      {activeTab === 'participants' && (
        <div className="space-y-4 max-w-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addParticipant()}
              placeholder="Nome do participante..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-yellow-500"
            />
            <button
              onClick={addParticipant}
              disabled={saving || !newName.trim()}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-white rounded-lg px-4 py-2 font-semibold transition-colors"
            >
              Adicionar
            </button>
          </div>

          {participants.length === 0 && (
            <p className="text-gray-500 text-sm">Nenhum participante cadastrado.</p>
          )}

          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Link:{' '}
                    <a
                      href={`/palpite/${p.token}`}
                      className="text-blue-400 hover:underline"
                      target="_blank"
                    >
                      /palpite/{p.token}
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/palpite/${p.token}`)}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                >
                  Copiar link
                </button>
                <button
                  onClick={() => removeParticipant(p.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded transition-colors"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GROUP RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => {
              const matches = groupMatchesByGroup[g.id] ?? []
              const done = matches.filter(m => results[m.id]?.score1 !== undefined).length
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                    activeGroup === g.id ? 'bg-yellow-600 border-yellow-500 text-white' :
                    done === 6 ? 'bg-green-900/40 border-green-700 text-green-300' :
                    'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {g.id} {done === 6 ? '✓' : `${done}/6`}
                </button>
              )
            })}
          </div>

          <div className="max-w-lg space-y-3">
            <h3 className="font-bold text-lg">{groupById[activeGroup]?.name}</h3>
            {(groupMatchesByGroup[activeGroup] ?? []).map(m => (
              <ResultInput
                key={m.id}
                match={m}
                current={results[m.id]}
                isKnockout={false}
                onSave={saveResult}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* KNOCKOUT RESULTS */}
      {activeTab === 'knockout' && (
        <div className="space-y-8 max-w-2xl">
          <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-3 text-sm text-blue-200">
            Para jogos do mata-mata, as seleções precisam ser configuradas no arquivo <code className="bg-gray-800 px-1 rounded">lib/copa2026.ts</code> conforme a classificação é definida.
          </div>
          {Object.entries(knockoutByPhase).map(([phase, matches]) => (
            <div key={phase}>
              <h3 className="font-bold text-lg text-yellow-300 mb-3">{PHASE_LABELS[phase as keyof typeof PHASE_LABELS]}</h3>
              <div className="space-y-3">
                {matches.map(m => (
                  <ResultInput
                    key={m.id}
                    match={m}
                    current={results[m.id]}
                    isKnockout={true}
                    onSave={saveResult}
                    saving={saving}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultInput({
  match,
  current,
  isKnockout,
  onSave,
  saving,
}: {
  match: Match
  current?: { score1?: number; score2?: number; advancingTeamId?: string }
  isKnockout: boolean
  onSave: (matchId: string, s1: number, s2: number, adv?: string) => void
  saving: boolean
}) {
  const [s1, setS1] = useState(current?.score1 ?? '')
  const [s2, setS2] = useState(current?.score2 ?? '')
  const [adv, setAdv] = useState(current?.advancingTeamId ?? '')

  const team1 = teamById[match.team1Id]
  const team2 = teamById[match.team2Id]
  const isTBD = match.team1Id === 'TBD' || match.team2Id === 'TBD'
  const isDraw = s1 !== '' && s2 !== '' && Number(s1) === Number(s2)

  if (isTBD) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-500 italic">
        Jogo {match.matchNumber} — Seleções a definir
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm flex-1">{team1?.flag} {team1?.name}</span>
        <input
          type="number" min="0" max="20" value={s1}
          onChange={e => setS1(e.target.value)}
          className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500"
        />
        <span className="text-gray-500">×</span>
        <input
          type="number" min="0" max="20" value={s2}
          onChange={e => setS2(e.target.value)}
          className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500"
        />
        <span className="text-sm flex-1 text-right">{team2?.name} {team2?.flag}</span>
        <button
          onClick={() => onSave(match.id, Number(s1), Number(s2), isKnockout && isDraw ? adv || undefined : undefined)}
          disabled={saving || s1 === '' || s2 === ''}
          className="text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white rounded px-3 py-1.5 font-semibold transition-colors"
        >
          Salvar
        </button>
      </div>
      {isKnockout && isDraw && (
        <div className="flex items-center gap-2 text-sm bg-blue-950/40 border border-blue-800 rounded p-2">
          <span className="text-blue-300 text-xs">Empate — quem avançou?</span>
          <select
            value={adv}
            onChange={e => setAdv(e.target.value)}
            className="ml-auto bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          >
            <option value="">Selecione...</option>
            <option value={match.team1Id}>{team1?.flag} {team1?.name}</option>
            <option value={match.team2Id}>{team2?.flag} {team2?.name}</option>
          </select>
        </div>
      )}
      {current?.score1 !== undefined && (
        <p className="text-xs text-green-400">✓ Salvo: {current.score1} × {current.score2}</p>
      )}
    </div>
  )
}
