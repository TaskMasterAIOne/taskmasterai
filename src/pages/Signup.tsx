import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faLock, faEye, faEyeSlash, faCircleExclamation, faCheck } from '@fortawesome/free-solid-svg-icons'

// Colored Google Logo SVG
const GoogleLogo = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8'

export default function Signup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedPlan = searchParams.get('plan') || 'pro'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [alreadyExists, setAlreadyExists] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordRequirements = [
    { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
    { test: (p: string) => /[0-9]/.test(p), label: 'One number' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAlreadyExists(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const failedRequirement = passwordRequirements.find(req => !req.test(password))
    if (failedRequirement) {
      setError(`Password must have: ${failedRequirement.label.toLowerCase()}`)
      return
    }

    // Navigate to terms acceptance page with signup data
    navigate('/terms-acceptance', {
      state: {
        signupData: {
          method: 'email' as const,
          email,
          password,
        }
      }
    })
  }

  const handleGoogleSignUp = async () => {
    setError('')
    setAlreadyExists(false)
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Check if user document exists (user already signed up before)
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        // User already exists, just navigate to dashboard
        navigate('/app/dashboard')
        return
      }

      // New user - navigate to terms acceptance page
      navigate('/terms-acceptance', {
        state: {
          signupData: {
            method: 'google' as const,
            googleUser: user,
          }
        }
      })
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string }
      if (authError.code === 'auth/popup-closed-by-user') {
        // User closed popup
      } else if (authError.code === 'auth/account-exists-with-different-credential') {
        setAlreadyExists(true)
        setError('An account already exists with this email. Please sign in with your password.')
      } else {
        setError('Failed to sign up with Google')
      }
    } finally {
      setLoading(false)
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
          <img 
            src={LOGO_URL} 
            alt="TaskMaster AI" 
            className="h-7 w-7 rounded-lg object-contain invert dark:invert-0"
          />
          <span className="pixel-text text-[10px] text-marketing-text">TASKMASTER AI</span>
        </Link>

        {/* Card */}
        <div className="marketing-panel rounded-2xl border p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
          <div className="mb-7 text-center">
            <h1 className="marketing-gradient-text font-display mb-1 text-2xl font-semibold tracking-tight">Create account</h1>
            <p className="text-open-sm text-marketing-muted">
              Get started with {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-status-error bg-marketing-surface text-status-error text-sm">
                <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
              {alreadyExists && (
                <Link
                  to={email ? `/signin?email=${encodeURIComponent(email)}` : '/signin'}
                  className="btn-marketing-primary block w-full py-2.5 text-center text-sm"
                >
                  Sign in instead
                </Link>
              )}
            </div>
          )}

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
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
                  autoComplete="new-password"
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
              {/* Password requirements */}
              {password && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req) => (
                    <div
                      key={req.label}
                      className={`flex items-center gap-2 text-xs ${
                        req.test(password) ? 'text-status-success' : 'text-text-subtle'
                      }`}
                    >
                      <FontAwesomeIcon icon={faCheck} className={`w-3 h-3 ${req.test(password) ? 'opacity-100' : 'opacity-30'}`} />
                      {req.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm Password</label>
              <div className="relative">
                <FontAwesomeIcon icon={faLock} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-marketing-muted" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-status-error">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-marketing-primary mt-5 w-full py-2.5"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-marketing-muted">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="text-marketing-link hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-marketing-link hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Sign in link */}
        <p className="mt-5 text-center text-sm text-marketing-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-marketing-link hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
