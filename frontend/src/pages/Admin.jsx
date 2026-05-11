/**
 * Admin Dashboard – restricted to users with role "admin".
 *
 * Tabs:
 *   1. Users      – list all users, change roles, enable/disable accounts
 *   2. Activity   – security audit log
 *   3. Risk AI    – AI-computed threat scores per user
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const TABS = ['Users', 'Activity Log', 'AI Risk Scores']
const ROLES = ['student', 'researcher', 'admin']

const ROLE_BADGE = {
  student:    'badge-student',
  researcher: 'badge-researcher',
  admin:      'badge-admin',
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [pendingRole, setPending] = useState({})  // {userId: newRole}
  const [saving, setSaving]     = useState(null)
  const [msg, setMsg]           = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/users')
      setUsers(data)
      const init = {}
      data.forEach(u => { init[u.id] = u.role })
      setPending(init)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const saveRole = async (userId) => {
    setSaving(userId)
    setMsg('')
    try {
      await api.put('/api/admin/users/role', {
        user_id:  userId,
        new_role: pendingRole[userId],
      })
      setMsg(`Role updated successfully.`)
      fetchUsers()
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to update role.')
    } finally {
      setSaving(null)
    }
  }

  const toggleUser = async (userId) => {
    try {
      const { data } = await api.put(`/api/admin/users/${userId}/toggle`)
      setMsg(data.message)
      fetchUsers()
    } catch {
      setMsg('Failed to toggle user.')
    }
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading users…</div>

  return (
    <div>
      {msg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {msg}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table data-testid="users-table" className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              {['ID', 'Username', 'Email', 'Role', 'Status', 'Failed Logins', 'Auth', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-400">{u.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    data-testid={`role-select-${u.id}`}
                    value={pendingRole[u.id] || u.role}
                    onChange={(e) => setPending(p => ({ ...p, [u.id]: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${u.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'}`}>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={u.failed_login_count > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                    {u.failed_login_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.is_social_login ? `${u.social_provider || 'Social'}` : '2FA'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      data-testid={`save-role-btn-${u.id}`}
                      onClick={() => saveRole(u.id)}
                      disabled={saving === u.id}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white
                                 font-semibold px-2.5 py-1 rounded-lg transition-colors
                                 disabled:opacity-50"
                    >
                      {saving === u.id ? '…' : 'Save'}
                    </button>
                    <button
                      data-testid={`toggle-user-btn-${u.id}`}
                      onClick={() => toggleUser(u.id)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors
                        ${u.is_active
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : 'bg-green-100 hover:bg-green-200 text-green-700'}`}
                    >
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Activity log tab ─────────────────────────────────────────────────────────

function ActivityTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/activity-logs')
      .then(({ data }) => setLogs(data))
      .finally(() => setLoading(false))
  }, [])

  const EVENT_BADGE = {
    login:               'bg-green-100 text-green-700',
    failed_login:        'bg-red-100 text-red-700',
    failed_2fa:          'bg-orange-100 text-orange-700',
    unauthorized_access: 'bg-red-200 text-red-800',
    social_login:        'bg-blue-100 text-blue-700',
    role_change:         'bg-purple-100 text-purple-700',
    logout:              'bg-gray-100 text-gray-600',
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Loading logs…</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            {['Time', 'Event', 'User ID', 'Details', 'IP'].map(h => (
              <th key={h} className="px-4 py-3 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-gray-400">No activity yet</td></tr>
          ) : logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${EVENT_BADGE[log.event_type] || 'bg-gray-100 text-gray-600'}`}>
                  {log.event_type}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{log.user_id ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.details || '—'}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">{log.ip_address || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Risk scores tab ──────────────────────────────────────────────────────────

function RiskTab() {
  const [scores, setScores]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/admin/risk-scores')
      .then(({ data }) => setScores(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-10 text-center text-gray-400">Calculating risk scores…</div>

  return (
    <div>
      {/* Algorithm explanation */}
      <div className="mb-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
        <strong>AI Risk Scoring Algorithm</strong>
        <p className="mt-1 text-indigo-700">
          Score = (Failed Logins × 15) + (Unauthorized Access × 20) + (Failed 2FA × 10), capped at 100.
          <br/>
          <span className="text-green-700 font-semibold">LOW</span> &lt; 30 &nbsp;·&nbsp;
          <span className="text-yellow-700 font-semibold">MEDIUM</span> 30–59 &nbsp;·&nbsp;
          <span className="text-red-700 font-semibold">HIGH</span> 60+
        </p>
      </div>

      <div className="space-y-3">
        {scores.map((s) => (
          <div key={s.user_id}
            className="card border border-gray-100 flex items-center gap-4">
            {/* Score bar */}
            <div className="flex-shrink-0 w-16 text-center">
              <div className={`text-2xl font-bold
                ${s.risk_level === 'HIGH' ? 'text-red-600' :
                  s.risk_level === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}`}>
                {s.risk_score}
              </div>
              <span className={`badge-${s.risk_level.toLowerCase()}`}>
                {s.risk_level}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{s.username}</span>
                <span className="text-xs text-gray-400">{s.email}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all
                    ${s.risk_level === 'HIGH' ? 'bg-red-500' :
                      s.risk_level === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${s.risk_score}%` }}
                />
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                <span>Failed logins: <strong>{s.failed_logins}</strong></span>
                <span>Unauthorized: <strong>{s.unauthorized_attempts}</strong></span>
                <span>Failed 2FA: <strong>{s.unusual_activity}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Admin page ──────────────────────────────────────────────────────────

export default function Admin() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0
                   01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622
                   5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 data-testid="admin-title" className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-500">User management · Security logs · AI threat detection</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            data-testid={`admin-tab-${i}`}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === i
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 0 && <UsersTab />}
        {activeTab === 1 && <ActivityTab />}
        {activeTab === 2 && <RiskTab />}
      </div>
    </div>
  )
}
