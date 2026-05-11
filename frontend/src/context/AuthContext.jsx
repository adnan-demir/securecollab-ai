/**
 * AuthContext – global authentication state for SecureCollab AI.
 *
 * Stores:
 *   - JWT token (persisted in localStorage)
 *   - Current user profile (id, email, username, role)
 *
 * Provides:
 *   - login(token)    – store token and fetch user profile
 *   - logout()        – clear token and user
 *   - user            – current user object (null if unauthenticated)
 *   - loading         – true while fetching initial profile
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from /api/auth/me using the stored token
  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    try {
      const { data } = await api.get('/api/auth/me')
      setUser(data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // On mount: restore session from localStorage
  useEffect(() => { fetchMe() }, [fetchMe])

  const login = async (token) => {
    localStorage.setItem('token', token)
    await fetchMe()
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
