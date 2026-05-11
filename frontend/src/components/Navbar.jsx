import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_BADGE = {
  student:    'badge-student',
  researcher: 'badge-researcher',
  admin:      'badge-admin',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
              SecureCollab AI
            </span>
          </Link>

          {/* Nav links */}
          {user && (
            <div className="hidden md:flex items-center gap-6">
              <Link to="/dashboard"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm">
                Dashboard
              </Link>
              <Link to="/projects"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm">
                Projects
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin"
                  data-testid="nav-admin"
                  className="text-gray-600 hover:text-red-600 font-medium transition-colors text-sm">
                  Admin
                </Link>
              )}
            </div>
          )}

          {/* User section */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-800">{user.username}</span>
                  <span className={ROLE_BADGE[user.role] || 'badge-student'}>
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="btn-danger"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-primary text-sm">Sign In</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
