import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faLock, faEye, faEyeSlash, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { TaskMasterAILogo } from '../components/TaskMasterAILogo'

// Colored Google Logo SVG
const GoogleLogo = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function Signin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, signInWithGoogle, resetPassword } = useAuth()
  
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/app/dashboard')
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string }
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password')
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      await signInWithGoogle()
      navigate('/app/dashboard')
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string }
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed popup
      } else {
        setError('Failed to sign in with Google')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }
    
    try {
      await resetPassword(email)
      setResetSent(true)
      setError('')
    } catch {
      setError('Failed to send reset email')
    }
  }

  return (
    <div className="marketing-page app-cruip relative flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-[1] w-full max-w-sm"
      >
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-1.5">
          <TaskMasterAILogo className="h-7 w-7 rounded-lg" />
          <span className="pixel-text text-[10px] text-marketing-text">TASKMASTER AI</span>
        </Link>

        {/* Card */}
        <div className="marketing-panel rounded-2xl border p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
          <div className="mb-7 text-center">
            <h1 className="marketing-gradient-text font-display mb-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-open-sm text-marketing-muted">Sign in to your account</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-status-error bg-marketing-surface text-status-error text-sm mb-5">
              <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Reset sent message */}
          {resetSent && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-status-success bg-marketing-surface text-status-success text-sm mb-5">
              Password reset email sent!
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-marketing-border bg-marketing-surface px-4 py-2.5 text-sm font-medium text-marketing-text transition-colors hover:bg-marketing-bg disabled:opacity-50"
          >
            <GoogleLogo />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-marketing-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-marketing-surface px-3 text-marketing-muted">or</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <FontAwesomeIcon icon={faEnvelope} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-marketing-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <FontAwesomeIcon icon={faLock} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-marketing-muted" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-marketing-muted hover:text-marketing-text"
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-marketing-muted hover:text-marketing-link"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-marketing-primary w-full py-2.5"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="mt-5 text-center text-sm text-marketing-muted">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-marketing-link hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
