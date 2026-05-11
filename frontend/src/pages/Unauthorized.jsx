/**
 * Unauthorized page – shown when a user tries to access a route
 * they do not have the required role for.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Unauthorized() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636
                 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>

        <h1 data-testid="unauthorized-title"
          className="text-4xl font-bold text-gray-900 mb-3">403</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-2">
          You don't have permission to view this page.
        </p>
        {user && (
          <p className="text-sm text-gray-400 mb-6">
            Your current role is <strong className="text-gray-600">{user.role}</strong>.
            Contact an admin to request elevated access.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary">
            Go Back
          </button>
          <Link to="/dashboard" className="btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
