/**
 * Register page – creates a new user account.
 * Passwords are validated client-side for UX, then hashed server-side with bcrypt.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'

const ROLES = [
  { value: 'student',    label: 'Student',    desc: 'Access own projects only' },
  { value: 'researcher', label: 'Researcher', desc: 'View shared research projects' },
  { value: 'admin',      label: 'Admin',      desc: 'Full platform access + management' },
]

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '', username: '', password: '', confirmPassword: '', role: 'student',
  })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/register', {
        email:    form.email,
        username: form.username,
        password: form.password,
        role:     form.role,
      })
      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 data-testid="register-title" className="text-3xl font-bold text-gray-900">Create account</h1>
          <p className="mt-2 text-gray-500">Join SecureCollab AI</p>
        </div>

        <div className="card">
          {error && (
            <div data-testid="error-message"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                data-testid="email-input"
                type="email" name="email"
                value={form.email} onChange={handleChange}
                className="input-field" placeholder="you@example.com"
                required autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                data-testid="username-input"
                type="text" name="username"
                value={form.username} onChange={handleChange}
                className="input-field" placeholder="johndoe"
                required autoComplete="username" minLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                data-testid="password-input"
                type="password" name="password"
                value={form.password} onChange={handleChange}
                className="input-field" placeholder="Min. 6 characters"
                required autoComplete="new-password" minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                data-testid="confirm-password-input"
                type="password" name="confirmPassword"
                value={form.confirmPassword} onChange={handleChange}
                className="input-field" placeholder="Repeat your password"
                required autoComplete="new-password"
              />
            </div>

            {/* Role picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <label key={r.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                      ${form.role === r.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={handleChange}
                      data-testid={`role-${r.value}`}
                      className="accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                      <p className="text-xs text-gray-500">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              data-testid="register-button"
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
