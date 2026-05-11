/**
 * Verify 2FA page – step 2 of the authentication flow.
 *
 * Supports two modes:
 *   1. OTP mode (default) – enter the 6-digit code from the demo display or email/SMS.
 *   2. Recovery code mode  – enter one of the pre-generated backup recovery codes.
 *
 * The OTP is delivered here via React Router state (passed from the Login page).
 * The demo OTP display (data-testid="otp-demo-code") is shown only for
 * demonstration/testing. In a real deployment, the OTP would be sent via email/SMS
 * and would never appear in the browser.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Verify2FA() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuth()

  const state = location.state || {}
  const email      = state.email      || ''
  const otpForDemo = state.otpForDemo || ''

  const [otp, setOtp]             = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  // Guard: if no email in state, go back to login
  useEffect(() => {
    if (!email) navigate('/login', { replace: true })
  }, [email, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (useRecovery) {
        // Recovery code path
        const res = await api.post('/api/auth/verify-recovery-code', {
          email,
          code: recoveryCode.trim(),
        })
        data = res.data
      } else {
        // Normal OTP path
        const res = await api.post('/api/auth/verify-2fa', { email, otp })
        data = res.data
      }
      await login(data.access_token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || '2FA verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setUseRecovery(!useRecovery)
    setError('')
    setOtp('')
    setRecoveryCode('')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955
                   11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824
                   10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 data-testid="verify-title" className="text-3xl font-bold text-gray-900">
            Two-Factor Auth
          </h1>
          <p className="mt-2 text-gray-500">
            {useRecovery
              ? 'Enter a backup recovery code'
              : <>Enter the 6-digit code sent to <strong>{email}</strong></>}
          </p>
        </div>

        <div className="card">
          {/* Demo OTP display – REMOVE IN PRODUCTION (OTP mode only) */}
          {!useRecovery && otpForDemo && (
            <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                Demo Mode – Your OTP Code
              </p>
              <p className="text-xs text-amber-600 mb-2">
                In production this code is sent via email/SMS and never shown here.
              </p>
              <div className="flex items-center justify-between">
                <code
                  data-testid="otp-demo-code"
                  className="text-3xl font-mono font-bold text-amber-800 tracking-[0.4em]"
                >
                  {otpForDemo}
                </code>
                <button
                  type="button"
                  onClick={() => setOtp(otpForDemo)}
                  className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800
                             font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          )}

          {/* Recovery code info banner */}
          {useRecovery && (
            <div className="mb-5 p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800">
              <strong>Backup Recovery Code</strong>
              <p className="mt-1 text-purple-700">
                Enter one of the 10-character codes you saved when generating recovery codes.
                Each code can only be used once.
              </p>
              <p className="mt-1 text-purple-600 italic">
                Demo: generate recovery codes from your Dashboard after logging in.
              </p>
            </div>
          )}

          {error && (
            <div data-testid="error-message"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {useRecovery ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recovery Code
                </label>
                <input
                  data-testid="recovery-code-input"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  className="input-field text-center text-lg tracking-[0.3em] font-mono"
                  placeholder="XXXXXXXXXX"
                  maxLength={10}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  data-testid="otp-input"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="······"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </div>
            )}

            <button
              data-testid="verify-button"
              type="submit"
              disabled={loading || (useRecovery ? recoveryCode.length < 1 : otp.length !== 6)}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              {useRecovery ? '' : 'OTP expires in 5 minutes.'}{' '}
              <button
                data-testid="use-recovery-toggle"
                onClick={toggleMode}
                className="text-blue-600 font-semibold hover:underline"
              >
                {useRecovery ? 'Use OTP instead' : 'Use recovery code instead'}
              </button>
            </span>
            <button
              onClick={() => navigate('/login')}
              className="text-gray-400 hover:text-gray-600 hover:underline ml-2"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
