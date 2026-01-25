'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import { SPECIAL_HAND_LABELS } from '@/lib/constants'
import type { SpecialHandType } from '@/types'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface PlayerStats {
  userId: string
  userName: string
  totalBuyIns: number
  totalCashOut: number
  netGainLoss: number
  sessionsPlayed: number
  totalSessions: number
  avgGainLoss: number
  winRate: number
  attendanceRate: number
  biggestWin: number
  biggestLoss: number
}

interface AsteriskStats {
  playerId: string
  playerName: string
  totalAsterisks: number
  hands: {
    handType: SpecialHandType
    count: number
    bestStrength: number
  }[]
  strongestHand: SpecialHandType
  strongestHandStrength: number
}

interface SpecialHandDetail {
  id: string
  playerId: string
  playerName: string
  handType: string
  cards: string
  description: string | null
  sessionId: string
  sessionDate: string
  createdAt: string
}

interface StatsData {
  year: number
  totalSessions: number
  playerStats: PlayerStats[]
  cumulativeData: Array<{ date: string; [key: string]: number | string }>
  asteriskStats: AsteriskStats[]
  specialHandsDetails: SpecialHandDetail[]
  piggyBankTotal: number
}

const COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchYears()
  }, [])

  useEffect(() => {
    fetchStats()
  }, [selectedYear])

  const fetchYears = async () => {
    try {
      const res = await fetch('/api/stats/years')
      const data = await res.json()
      setYears(data.years || [new Date().getFullYear()])
    } catch (error) {
      console.error('Failed to fetch years:', error)
    }
  }

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/stats?year=${selectedYear}`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  const leaderboardData = stats?.playerStats
    .filter((p) => p.sessionsPlayed > 0)
    .map((p) => ({
      name: p.userName,
      earnings: p.netGainLoss,
      sessions: p.sessionsPlayed,
    })) ?? []

  const winRateData = stats?.playerStats
    .filter((p) => p.sessionsPlayed > 0)
    .map((p) => ({
      name: p.userName,
      winRate: p.winRate,
    })) ?? []

  const attendanceData = stats?.playerStats
    .filter((p) => p.attendanceRate > 0)
    .map((p) => ({
      name: p.userName,
      value: p.attendanceRate,
    })) ?? []

  const playerNames = stats?.playerStats
    .filter((p) => p.sessionsPlayed > 0)
    .map((p) => p.userName) ?? []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100">Statistics</h1>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-400">Total Sessions</p>
          <p className="text-2xl font-bold text-gray-100">
            {stats?.totalSessions ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Active Players</p>
          <p className="text-2xl font-bold text-gray-100">
            {stats?.playerStats.filter((p) => p.sessionsPlayed > 0).length ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Top Winner</p>
          <p className="text-2xl font-bold text-emerald-400">
            {stats?.playerStats[0]?.userName ?? '-'}
          </p>
          <p className="text-sm text-gray-500">
            +${stats?.playerStats[0]?.netGainLoss ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Most Sessions</p>
          <p className="text-2xl font-bold text-blue-400">
            {stats?.playerStats.sort((a, b) => b.sessionsPlayed - a.sessionsPlayed)[0]?.userName ?? '-'}
          </p>
          <p className="text-sm text-gray-500">
            {stats?.playerStats.sort((a, b) => b.sessionsPlayed - a.sessionsPlayed)[0]?.sessionsPlayed ?? 0} sessions
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* YTD Earnings Leaderboard */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            YTD Earnings Leaderboard
          </h3>
          {leaderboardData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leaderboardData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`$${value}`, 'Earnings']}
                />
                <Bar dataKey="earnings" fill="#10b981">
                  {leaderboardData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.earnings >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Cumulative Earnings Over Time */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Cumulative Earnings Over Time
          </h3>
          {(stats?.cumulativeData?.length ?? 0) === 0 ? (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`$${value}`, '']}
                />
                <Legend />
                {playerNames.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Win Rate by Player */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Win Rate by Player
          </h3>
          {winRateData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={winRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Win Rate']}
                />
                <Bar dataKey="winRate" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Attendance Rate */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Attendance Rate
          </h3>
          {attendanceData.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {attendanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Detailed Stats Table */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">
          Player Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">
                  Player
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Sessions
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Buy-ins
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Cash-outs
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Net
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Avg/Session
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Win Rate
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Best
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">
                  Worst
                </th>
              </tr>
            </thead>
            <tbody>
              {stats?.playerStats
                .filter((p) => p.sessionsPlayed > 0)
                .map((player, index) => (
                  <tr
                    key={player.userId}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{index + 1}.</span>
                        <span className="font-medium text-gray-100">
                          {player.userName}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {player.sessionsPlayed}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      ${player.totalBuyIns}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      ${player.totalCashOut}
                    </td>
                    <td
                      className={`text-right py-3 px-4 font-medium ${
                        player.netGainLoss >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {player.netGainLoss >= 0 ? '+' : ''}${player.netGainLoss}
                    </td>
                    <td
                      className={`text-right py-3 px-4 ${
                        player.avgGainLoss >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {player.avgGainLoss >= 0 ? '+' : ''}$
                      {player.avgGainLoss.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-300">
                      {player.winRate.toFixed(0)}%
                    </td>
                    <td className="text-right py-3 px-4 text-emerald-400">
                      +${player.biggestWin}
                    </td>
                    <td className="text-right py-3 px-4 text-red-400">
                      -${player.biggestLoss}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Asterisk Leaderboard */}
      <Card className="border-amber-700/50 bg-gradient-to-br from-amber-900/20 to-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-2xl">*</span>
            <h3 className="text-lg font-semibold text-gray-100">
              Asterisk Leaderboard
            </h3>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 rounded-lg border border-amber-700/50">
            <span className="text-sm text-gray-400">Piggy Bank Total:</span>
            <span className="text-xl font-bold text-amber-400">
              ${stats?.piggyBankTotal ?? 0}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Players earn asterisks for royal four of a kind (J, Q, K, A) or above.
          The player with the most asterisks at year-end wins the piggy bank.
          Ties broken by strongest hand.
        </p>
        {(stats?.asteriskStats?.length ?? 0) === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No special hands recorded yet this year.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Player
                  </th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium">
                    Asterisks
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Strongest Hand
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Hands Breakdown
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats?.asteriskStats.map((player, index) => (
                  <tr
                    key={player.playerId}
                    className={`border-b border-gray-800 hover:bg-gray-800/50 ${
                      index === 0 ? 'bg-amber-900/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      {index === 0 ? (
                        <span className="text-amber-400 font-bold text-lg">1st</span>
                      ) : index === 1 ? (
                        <span className="text-gray-300 font-medium">2nd</span>
                      ) : index === 2 ? (
                        <span className="text-amber-700 font-medium">3rd</span>
                      ) : (
                        <span className="text-gray-500">{index + 1}th</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-100">
                        {player.playerName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-amber-400 font-bold text-lg">
                        {'*'.repeat(player.totalAsterisks)}
                      </span>
                      <span className="text-gray-500 ml-2">
                        ({player.totalAsterisks})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded bg-amber-900/30 text-amber-400 text-xs">
                        {SPECIAL_HAND_LABELS[player.strongestHand] || player.strongestHand}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {player.hands.map((hand) => (
                          <span
                            key={hand.handType}
                            className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 text-xs"
                          >
                            {SPECIAL_HAND_LABELS[hand.handType] || hand.handType}: {hand.count}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Special Hands History */}
      {(stats?.specialHandsDetails?.length ?? 0) > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Special Hands History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Player
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Hand
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Cards
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats?.specialHandsDetails
                  .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
                  .map((hand) => (
                    <tr
                      key={hand.id}
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(hand.sessionDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-amber-400 mr-1">*</span>
                        <span className="font-medium text-gray-100">
                          {hand.playerName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-amber-900/30 text-amber-400 text-xs">
                          {SPECIAL_HAND_LABELS[hand.handType as SpecialHandType] || hand.handType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {hand.cards || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {hand.description || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
