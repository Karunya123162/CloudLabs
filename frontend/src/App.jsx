import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RegionProvider } from './context/RegionContext'
import Dashboard from './pages/Dashboard'
import AWSPortal from './pages/AWSPortal'

function App() {
  return (
    <ThemeProvider>
      <RegionProvider>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/aws-portal" element={<AWSPortal />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
      </RegionProvider>
    </ThemeProvider>
  )
}

export default App
