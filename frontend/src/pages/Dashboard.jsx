/**
 * Dashboard – personalized home page for authenticated users.
 * Displays user info, role-specific guidance, and quick navigation.
 */
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_CONFIG = {
  student: {
    color:   'blue',
    icon:    '🎓',
    title:   'Student Portal',
    message: 'You can create and manage your own research projects.',
    bg:      'bg-blue-50',
    border:  'border-blue-200',
    text:    'text-blue-800',
  },
  researcher: {
    color:   'purple',
    icon:    '🔬',
    title:   'Researcher Portal',
    message: 'You can view your own projects and all publicly shared research.',
    bg:      'bg-purple-50',
    border:  'border-purple-200',
    text:    'text-purple-800',
  },
  admin: {
    color:   'red',
    icon:    '🛡️',
    title:   'Admin Portal',
    message: 'You have full access to all projects, users, and security logs.',
    bg:      'bg-red-50',
    border:  'border-red-200',
    text:    'text-red-800',
  },
}

const QUICK_LINKS = [
  { to: '/projects', icon: '📁', label: 'My Projects', desc: 'View and manage research projects' },
  { to: '/admin',    icon: '⚙️', label: 'Admin Panel', desc: 'Users, roles, and security logs', adminOnly: true },
]

export default function Dashboard() {
  const { user } = useAuth()
  if (!user) return null

  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.student

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Welcome header */}
      <div className="mb-8">
        <h1 data-testid="dashboard-title"
          className="text-3xl font-bold text-gray-900">
          Welcome, {user.username} 👋
        </h1>
        <p className="mt-1 text-gray-500">
          Here's your SecureCollab AI overview
        </p>
      </div>

      {/* Role banner */}
      <div className={`card mb-6 flex items-start gap-4 border ${cfg.border} ${cfg.bg}`}>
        <span className="text-4xl">{cfg.icon}</span>
        <div>
          <h2 className={`font-bold text-lg ${cfg.text}`}>{cfg.title}</h2>
          <p className={`text-sm mt-0.5 ${cfg.text} opacity-80`}>{cfg.message}</p>
          <p className="mt-2 text-xs text-gray-500">
            Signed in as <strong>{user.email}</strong> ·{' '}
            Role: <span data-testid="user-role"
              className="font-semibold">{user.role}</span>
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Role',       value: user.role,              color: 'text-blue-600' },
          { label: 'Account',    value: user.is_active ? 'Active' : 'Disabled', color: 'text-green-600' },
          { label: 'Auth',       value: user.is_social_login ? `Google` : '2FA + Password', color: 'text-indigo-600' },
          { label: 'Failed Logins', value: user.failed_login_count, color: user.failed_login_count > 0 ? 'text-red-600' : 'text-gray-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_LINKS
          .filter((l) => !l.adminOnly || user.role === 'admin')
          .map((l) => (
            <Link key={l.to} to={l.to}
              className="card hover:border-blue-300 hover:shadow-md transition-all duration-200
                         group flex items-center gap-4 cursor-pointer border">
              <span className="text-3xl group-hover:scale-110 transition-transform">{l.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {l.label}
                </p>
                <p className="text-sm text-gray-500">{l.desc}</p>
              </div>
            </Link>
          ))}
      </div>

      {/* Security info */}
      <div className="mt-8 card border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04
                 A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03
                 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Security Status
        </h3>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> JWT authentication active
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            {user.is_social_login ? 'Google OAuth verified' : 'Two-factor authentication verified'}
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span> Role-based access control enforced
          </li>
          {user.failed_login_count > 0 && (
            <li className="flex items-center gap-2">
              <span className="text-amber-500">⚠</span>
              {user.failed_login_count} failed login attempt(s) detected
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
