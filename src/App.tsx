import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'

// Public Pages
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import Docs from './pages/Docs'
import Signin from './pages/Signin'
import Signup from './pages/Signup'
import TermsAcceptance from './pages/TermsAcceptance'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import CliLogin from './pages/CliLogin'
import NotFound from './pages/NotFound'

// Protected Pages
import Dashboard from './pages/app/Dashboard'
import Tasks from './pages/app/Tasks'
import ApiKeys from './pages/app/ApiKeys'
import Models from './pages/app/Models'
import Settings from './pages/app/Settings'

// Loading component
function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-marketing-bg font-inter text-marketing-text">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/25 border-t-indigo-600 dark:border-t-indigo-400"
          aria-hidden
        />
        <p className="text-sm text-marketing-muted">Loading...</p>
      </div>
    </div>
  )
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return <>{children}</>
}

// Auth route wrapper (redirect to app if logged in)
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Auth routes */}
      <Route
        path="/signin"
        element={
          <AuthRoute>
            <Signin />
          </AuthRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthRoute>
            <Signup />
          </AuthRoute>
        }
      />
      <Route
        path="/terms-acceptance"
        element={
          <AuthRoute>
            <TermsAcceptance />
          </AuthRoute>
        }
      />

      {/* CLI Login - special route for CLI OAuth flow */}
      <Route path="/cli-login" element={<CliLogin />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="models" element={<Models />} />
        <Route path="billing" element={<Navigate to="/app/settings" replace />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

