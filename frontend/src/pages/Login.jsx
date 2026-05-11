/**
 * Login page – supports:
 *   1. Email + password login (→ /verify-2fa for OTP)
 *   2. Simulated Google OAuth social login (→ /dashboard directly)
 *   3. Simulated GitHub OAuth social login (→ /dashboard directly)
 *   4. Simulated Microsoft OAuth social login (→ /dashboard directly)
 *
 * Security notes:
 *   - Passwords are never logged or stored client-side
 *   - Errors use generic messages to avoid user enumeration
 *   - Social login simulates the OAuth flow for demo purposes only
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'

// ─── Provider config ──────────────────────────────────────────────────────────

const SOCIAL_PROVIDERS = {
  github: {
    label: 'GitHub',
    note: 'Simulated',
    defaultEmail: 'demo.github@github.com',
    defaultName: 'Demo GitHub User',
    defaultId: 'github_demo_001',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
                 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
                 -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
                 .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
                 -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
                 c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225
                 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3
                 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
    color: 'text-gray-900',
    bg: 'bg-gray-900',
    textColor: 'text-white',
  },
  microsoft: {
    label: 'Microsoft',
    note: 'Simulated',
    defaultEmail: 'demo.microsoft@outlook.com',
    defaultName: 'Demo Microsoft User',
    defaultId: 'microsoft_demo_001',
    icon: (
      <svg width="18" height="18" viewBox="0 0 21 21">
        <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
        <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
        <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
      </svg>
    ),
    color: 'text-blue-700',
    bg: 'bg-blue-600',
    textColor: 'text-white',
  },
}

export default function Login() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // ── Google modal state (unchanged to preserve existing E2E test IDs) ────────
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [googleForm, setGoogleForm] = useState({
    email: 'demo.google@gmail.com',
    name:  'Demo Google User',
    id:    'google_demo_001',
  })

  // ── Shared GitHub / Microsoft modal state ───────────────────────────────────
  const [activeSocialProvider, setActiveSocialProvider] = useState(null) // 'github' | 'microsoft'
  const [socialForm, setSocialForm] = useState({ email: '', name: '' })

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', form)
      navigate('/verify-2fa', {
        state: { email: data.email, otpForDemo: data.otp_for_demo },
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // ── Google login handler ──────────────────────────────────────────────────
  const handleGoogleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      /**
       * SIMULATED GOOGLE OAUTH FLOW
       * In production:
       *   1. Use Google Identity Services SDK to obtain an ID token.
       *   2. Send that token to the backend for server-side verification.
       *   3. Backend verifies with Google's public keys before trusting the identity.
       *
       * Here we skip steps 1-2 for demonstration purposes.
       */
      const { data } = await api.post('/api/auth/social-login', {
        provider:  'google',
        email:     googleForm.email,
        name:      googleForm.name,
        social_id: googleForm.id,
      })
      localStorage.setItem('token', data.access_token)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.response?.data?.detail || 'Google login failed.')
    } finally {
      setLoading(false)
      setShowGoogleModal(false)
    }
  }

  // ── GitHub / Microsoft login handler ─────────────────────────────────────
  const openSocialModal = (provider) => {
    const cfg = SOCIAL_PROVIDERS[provider]
    setSocialForm({ email: cfg.defaultEmail, name: cfg.defaultName })
    setActiveSocialProvider(provider)
  }

  const handleSocialLogin = async (e) => {
    e.preventDefault()
    if (!activeSocialProvider) return
    setError('')
    setLoading(true)
    const cfg = SOCIAL_PROVIDERS[activeSocialProvider]
    try {
      /**
       * SIMULATED OAUTH FLOW (GitHub / Microsoft)
       * In production, the frontend would use the provider's SDK to obtain an
       * authorization code or ID token, which the backend would then verify
       * server-side before issuing a JWT. This form simulates that exchange.
       */
      const { data } = await api.post('/api/auth/social-login', {
        provider:  activeSocialProvider,
        email:     socialForm.email,
        name:      socialForm.name,
        social_id: cfg.defaultId,
      })
      localStorage.setItem('token', data.access_token)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.response?.data?.detail || `${cfg.label} login failed.`)
    } finally {
      setLoading(false)
      setActiveSocialProvider(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 data-testid="login-title" className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-gray-500">Sign in to SecureCollab AI</p>
        </div>

        <div className="card">
          {/* Demo credentials notice */}
          <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>Demo accounts:</strong><br />
            admin@securecollab.ai / Admin@123<br />
            researcher@securecollab.ai / Research@123<br />
            student@securecollab.ai / Student@123
          </div>

          {/* Error */}
          {error && (
            <div data-testid="error-message"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                data-testid="email-input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="input-field"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                data-testid="password-input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              data-testid="login-button"
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-gray-200" />
            <span className="px-3 text-xs text-gray-400 font-medium">OR CONTINUE WITH</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Social login buttons */}
          <div className="space-y-2">
            {/* Google */}
            <button
              data-testid="google-login-button"
              onClick={() => setShowGoogleModal(true)}
              className="w-full flex items-center justify-center gap-3 border border-gray-300
                         rounded-lg py-2.5 px-4 text-sm font-medium text-gray-700
                         hover:bg-gray-50 transition-colors duration-200 focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.27 9c0-.53.09-1.04.24-1.52V5.41H1.88A8 8 0 001 9c0 1.29.31 2.51.88 3.59l2.63-2.07z"/>
                <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.88 5.4L4.51 7.48c.63-1.89 2.39-3.9 4.47-3.9z"/>
              </svg>
              Continue with Google
              <span className="ml-1 text-xs text-gray-400">(Simulated)</span>
            </button>

            {/* GitHub */}
            <button
              data-testid="github-login-button"
              onClick={() => openSocialModal('github')}
              className="w-full flex items-center justify-center gap-3 border border-gray-300
                         rounded-lg py-2.5 px-4 text-sm font-medium text-gray-700
                         hover:bg-gray-50 transition-colors duration-200 focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            >
              {SOCIAL_PROVIDERS.github.icon}
              Continue with GitHub
              <span className="ml-1 text-xs text-gray-400">(Simulated)</span>
            </button>

            {/* Microsoft */}
            <button
              data-testid="microsoft-login-button"
              onClick={() => openSocialModal('microsoft')}
              className="w-full flex items-center justify-center gap-3 border border-gray-300
                         rounded-lg py-2.5 px-4 text-sm font-medium text-gray-700
                         hover:bg-gray-50 transition-colors duration-200 focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
            >
              {SOCIAL_PROVIDERS.microsoft.icon}
              Continue with Microsoft
              <span className="ml-1 text-xs text-gray-400">(Simulated)</span>
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            No account?{' '}
            <Link data-testid="register-link" to="/register"
              className="text-blue-600 font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* ── Google OAuth modal ──────────────────────────────────────────────── */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                <svg width="20" height="20" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.88v2.07A8 8 0 008.98 17z"/>
                  <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.27 9c0-.53.09-1.04.24-1.52V5.41H1.88A8 8 0 001 9c0 1.29.31 2.51.88 3.59l2.63-2.07z"/>
                  <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.88 5.4L4.51 7.48c.63-1.89 2.39-3.9 4.47-3.9z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Sign in with Google</h3>
                <p className="text-xs text-gray-500">Simulated OAuth Demo</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Demo mode:</strong> In production, this would open Google's OAuth consent screen
              and verify the identity token server-side. This form simulates that flow.
            </div>

            <form onSubmit={handleGoogleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Google Email</label>
                <input
                  type="email"
                  value={googleForm.email}
                  onChange={(e) => setGoogleForm(p => ({ ...p, email: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={googleForm.name}
                  onChange={(e) => setGoogleForm(p => ({ ...p, name: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowGoogleModal(false)}
                  className="btn-secondary flex-1 text-sm">Cancel</button>
                <button data-testid="google-modal-submit" type="submit" disabled={loading}
                  className="btn-primary flex-1 text-sm">
                  {loading ? 'Signing in…' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GitHub / Microsoft shared modal ────────────────────────────────── */}
      {activeSocialProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            {(() => {
              const cfg = SOCIAL_PROVIDERS[activeSocialProvider]
              return (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shadow-sm">
                      <span className={cfg.color}>{cfg.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Sign in with {cfg.label}</h3>
                      <p className="text-xs text-gray-500">Simulated OAuth Demo</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Demo mode:</strong> In production, this would redirect to {cfg.label}'s OAuth
                    authorization page and verify the returned token server-side.
                    This form simulates that flow for demo purposes.
                  </div>

                  <form onSubmit={handleSocialLogin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {cfg.label} Email
                      </label>
                      <input
                        data-testid={`${activeSocialProvider}-modal-email`}
                        type="email"
                        value={socialForm.email}
                        onChange={(e) => setSocialForm(p => ({ ...p, email: e.target.value }))}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={socialForm.name}
                        onChange={(e) => setSocialForm(p => ({ ...p, name: e.target.value }))}
                        className="input-field text-sm"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setActiveSocialProvider(null)}
                        className="btn-secondary flex-1 text-sm">Cancel</button>
                      <button
                        data-testid={`${activeSocialProvider}-modal-submit`}
                        type="submit"
                        disabled={loading}
                        className="btn-primary flex-1 text-sm"
                      >
                        {loading ? 'Signing in…' : 'Continue'}
                      </button>
                    </div>
                  </form>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
