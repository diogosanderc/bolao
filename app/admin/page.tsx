'use client'

import { useEffect, useState } from 'react'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById, groupById } from '@/lib/copa2026'
import { Participant, Match, PHASE_LABELS, KNOCKOUT_PHASES } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { computeFullBracket } from '@/lib/bracket'

const ADMIN_KEY_STORAGE = 'bolao_admin_key'

type ResultMap = Record<string, { score1?: number; score2?: number; advancingTeamId?: string }>

function useAdminKey() {
  const [key, setKey] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE)
    if (stored) {
      fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: stored }),
      }).then(r => {
        if (r.ok) { setKey(stored); setConfirmed(true) }
        else localStorage.removeItem(ADMIN_KEY_STORAGE)
      })
    }
  }, [])

  async function confirm(k: string) {
    setVerifying(true)
    setError('')
    const r = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: k }),
    })
    setVerifying(false)
    if (!r.ok) { setError('Chave incorreta. Tente novamente.'); return }
    localStorage.setItem(ADMIN_KEY_STORAGE, k)
    setKey(k)
    setConfirmed(true)
  }
  return { key, confirmed, confirm, setKey, verifying, error }
}

export default function AdminPage() {
  const { key, confirmed, confirm, verifying, error } = useAdminKey()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [results, setResults] = useState<ResultMap>({})
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
      const m: ResultMap = {}
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
    if (!window.confirm('Remover participante?')) return
    await fetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  async function clearResult(matchId: string) {
    setSaving(true)
    const r = await fetch('/api/results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: key, matchId }),
    })
    if (r.ok) {
      setResults(prev => { const n = { ...prev }; delete n[matchId]; return n })
      showToast('Resultado removido.')
    } else {
      showToast('Erro: chave de admin incorreta?')
    }
    setSaving(false)
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

  if (!confirmed) {
    return (
      <div className="max-w-sm mx-auto mt-20 space-y-4">
        <h2 className="text-2xl font-bold text-center text-yellow-600 dark:text-yellow-400">Acesso Admin</h2>
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
          disabled={verifying || !inputKey}
          className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-white rounded-lg px-4 py-2 font-semibold transition-colors"
        >
          {verifying ? 'Verificando...' : 'Entrar'}
        </button>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
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

  // Compute bracket from actual results so knockout matches show real teams
  const resolvedBracket = computeFullBracket(results as any)

  const knockoutByPhase = KNOCKOUT_MATCHES.reduce((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = []
    acc[m.phase].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const groupsDone = GROUPS.filter(g =>
    (groupMatchesByGroup[g.id] ?? []).every(m => results[m.id]?.score1 !== undefined)
  ).length

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Painel Administrativo</h2>
          <span className="text-xs text-gray-400 sm:hidden">{groupsDone}/12 grupos completos</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="hidden sm:inline">{groupsDone}/12 grupos completos</span>
          <button onClick={() => { localStorage.removeItem(ADMIN_KEY_STORAGE); location.reload() }} className="hover:text-gray-200">Sair</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {(['participants', 'results', 'knockout'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {tab === 'participants' ? '👥 Participantes' : tab === 'results' ? '⚽ Grupos' : '🏆 Mata-Mata'}
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
                    <a href={`/palpite/${p.token}`} className="text-blue-400 hover:underline" target="_blank">
                      /palpite/{p.token}
                    </a>
                  </p>
                </div>
                <a
                  href={`/palpite/${p.token}?admin=1`}
                  target="_blank"
                  className="text-xs bg-blue-800 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                >
                  Editar palpites
                </a>
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
          {/* Group selector */}
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
                matchId={m.id}
                team1Id={m.team1Id}
                team2Id={m.team2Id}
                isKnockout={false}
                current={results[m.id]}
                onSave={saveResult}
                onDelete={clearResult}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* KNOCKOUT RESULTS */}
      {activeTab === 'knockout' && (
        <div className="space-y-8 max-w-2xl">
          {groupsDone < 12 && (
            <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-200">
              ⚠️ {groupsDone}/12 grupos com resultados completos. Os times do mata-mata são calculados automaticamente conforme os grupos são preenchidos.
            </div>
          )}

          {KNOCKOUT_PHASES.map(phase => {
            const matches = knockoutByPhase[phase] ?? []
            if (matches.length === 0) return null
            const doneCount = matches.filter(m => results[m.id]?.score1 !== undefined).length
            return (
              <div key={phase}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-bold text-lg text-yellow-300">{PHASE_LABELS[phase]}</h3>
                  <span className="text-xs text-gray-500">{doneCount}/{matches.length}</span>
                </div>
                <div className="space-y-3">
                  {matches.map(m => {
                    const resolved = resolvedBracket[m.id] ?? { team1Id: 'TBD', team2Id: 'TBD' }
                    return (
                      <ResultInput
                        key={m.id}
                        matchId={m.id}
                        team1Id={resolved.team1Id}
                        team2Id={resolved.team2Id}
                        isKnockout={true}
                        current={results[m.id]}
                        onSave={saveResult}
                        onDelete={clearResult}
                        saving={saving}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResultInput({
  matchId,
  team1Id,
  team2Id,
  isKnockout,
  current,
  onSave,
  onDelete,
  saving,
}: {
  matchId: string
  team1Id: string
  team2Id: string
  isKnockout: boolean
  current?: { score1?: number; score2?: number; advancingTeamId?: string }
  onSave: (matchId: string, s1: number, s2: number, adv?: string) => void
  onDelete: (matchId: string) => void
  saving: boolean
}) {
  const [s1, setS1] = useState(current?.score1 !== undefined ? String(current.score1) : '')
  const [s2, setS2] = useState(current?.score2 !== undefined ? String(current.score2) : '')
  const [adv, setAdv] = useState(current?.advancingTeamId ?? '')

  // Sync when current changes from outside (e.g. initial load)
  useEffect(() => {
    if (current?.score1 !== undefined) setS1(String(current.score1))
    if (current?.score2 !== undefined) setS2(String(current.score2))
    if (current?.advancingTeamId) setAdv(current.advancingTeamId)
  }, [current?.score1, current?.score2, current?.advancingTeamId])

  const team1 = teamById[team1Id]
  const team2 = teamById[team2Id]
  const isTBD = team1Id === 'TBD' || team2Id === 'TBD'
  const isDraw = s1 !== '' && s2 !== '' && Number(s1) === Number(s2)
  const saved = current?.score1 !== undefined

  if (isTBD) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-600 italic">
        Aguardando classificação dos grupos...
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 border rounded-lg px-4 py-3 space-y-2 transition-colors ${saved ? 'border-green-800/60' : 'border-gray-700'}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm flex-1 flex items-center gap-2 min-w-0">
          <Flag teamId={team1Id} size={20} />
          <span className="truncate font-medium">{team1?.name}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number" min="0" max="20" value={s1}
            onChange={e => setS1(e.target.value)}
            className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500"
          />
          <span className="text-gray-500 text-sm">×</span>
          <input
            type="number" min="0" max="20" value={s2}
            onChange={e => setS2(e.target.value)}
            className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500"
          />
        </div>
        <span className="text-sm flex-1 text-right flex items-center justify-end gap-2 min-w-0">
          <span className="truncate font-medium">{team2?.name}</span>
          <Flag teamId={team2Id} size={20} />
        </span>
        <button
          onClick={() => onSave(matchId, Number(s1), Number(s2), isKnockout && isDraw ? adv || undefined : undefined)}
          disabled={saving || s1 === '' || s2 === ''}
          className="shrink-0 text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white rounded px-3 py-1.5 font-semibold transition-colors"
        >
          {saved ? 'Atualizar' : 'Salvar'}
        </button>
        {saved && (
          <button
            onClick={() => onDelete(matchId)}
            disabled={saving}
            title="Remover resultado"
            className="shrink-0 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 px-1.5 py-1.5 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {isKnockout && isDraw && (
        <div className="flex items-center gap-2 text-sm bg-blue-950/40 border border-blue-800 rounded p-2">
          <span className="text-blue-300 text-xs">Empate — quem avançou (pênaltis/prorrogação)?</span>
          <select
            value={adv}
            onChange={e => setAdv(e.target.value)}
            className="ml-auto bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
          >
            <option value="">Selecione...</option>
            <option value={team1Id}>{team1?.flag} {team1?.name}</option>
            <option value={team2Id}>{team2?.flag} {team2?.name}</option>
          </select>
        </div>
      )}

      {saved && (
        <p className="text-xs text-green-500">
          ✓ {current!.score1} × {current!.score2}
          {current?.advancingTeamId && ` — avança: ${teamById[current.advancingTeamId]?.name}`}
        </p>
      )}
    </div>
  )
}
