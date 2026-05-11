import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import Login        from './pages/Login'
import Register     from './pages/Register'
import Verify2FA    from './pages/Verify2FA'
import Dashboard    from './pages/Dashboard'
import Projects     from './pages/Projects'
import Admin        from './pages/Admin'
import Unauthorized from './pages/Unauthorized'

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main>
          <Routes>
            {/* Public routes */}
            <Route path="/login"       element={<Login />} />
            <Route path="/register"    element={<Register />} />
            <Route path="/verify-2fa"  element={<Verify2FA />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes – any authenticated user */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            }/>
            <Route path="/projects" element={
              <ProtectedRoute><Projects /></ProtectedRoute>
            }/>

            {/* Admin-only */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}><Admin /></ProtectedRoute>
            }/>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}
