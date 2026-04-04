import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithEmailAndPassword
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faEnvelope, 
  faLock, 
  faEye, 
  faEyeSlash, 
  faCircleExclamation,
  faCheckCircle,
  faTerminal
} from '@fortawesome/free-solid-svg-icons'
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

type AuthState = 'waiting' | 'authenticating' | 'fetching-token' | 'success' | 'error' | 'redirecting'

export default function CliLogin() {
  const [searchParams] = useSearchParams()
  const callbackUrl = searchParams.get('callback')
  
  const [authState, setAuthState] = useState<AuthState>('waiting')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Validate callback URL
  const isValidCallback = callbackUrl && callbackUrl.startsWith('http://localhost:')

  useEffect(() => {
    if (!isValidCallback) {
      setError('Invalid callback URL. This page is for CLI authentication only.')
      setAuthState('error')
    }
  }, [isValidCallback])

  const handleAuthSuccess = async (user: { uid: string; email: string | null }, idToken: string, refreshToken: string) => {
    setAuthState('fetching-token')

    try {
      // Ensure user document exists
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          plan: null,
          createdAt: serverTimestamp(),
        })
      }

      // Fetch license info
      const licenseDocRef = doc(db, 'users', user.uid, 'license', 'current')
      const licenseDoc = await getDoc(licenseDocRef)
      
      let licenseData = {}
      if (licenseDoc.exists()) {
        const data = licenseDoc.data()
        licenseData = {
          hasLicense: data.status === 'active' || data.status === 'grace_period',
          plan: data.plan,
          planName: data.planName,
          tasksPerMonth: data.tasksPerMonth,
          status: data.status,
        }
      }

      // Redirect to CLI with tokens
      setAuthState('redirecting')
      
      const redirectUrl = new URL(callbackUrl!)
      redirectUrl.searchParams.set('token', idToken)
      redirectUrl.searchParams.set('refreshToken', refreshToken)
      redirectUrl.searchParams.set('userId', user.uid)
      redirectUrl.searchParams.set('email', user.email || '')
      
      // Add license info
      if (licenseData && Object.keys(licenseData).length > 0) {
        redirectUrl.searchParams.set('license', JSON.stringify(licenseData))
      }

      // Small delay to show success state
      setTimeout(() => {
        window.location.href = redirectUrl.toString()
      }, 500)

      setAuthState('success')
    } catch (err) {
      console.error('Error during CLI auth:', err)
      setError('Failed to complete authentication. Please try again.')
      setAuthState('error')
    }
  }

  const handleGoogleSignIn = async () => {
    if (!isValidCallback) return
    
    setError('')
    setLoading(true)
    setAuthState('authenticating')

    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      
      // Get the ID token
      const idToken = await result.user.getIdToken()
      const refreshToken = result.user.refreshToken

      await handleAuthSuccess(
        { uid: result.user.uid, email: result.user.email },
        idToken,
        refreshToken
      )
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string }
      console.error('Google sign-in error:', error)
      
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled')
      } else if (error.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.')
      } else {
        setError('Failed to sign in with Google. Please try again.')
      }
      setAuthState('error')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidCallback) return
    
    setError('')
    setLoading(true)
    setAuthState('authenticating')

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      
      // Get the ID token
      const idToken = await result.user.getIdToken()
      const refreshToken = result.user.refreshToken

      await handleAuthSuccess(
        { uid: result.user.uid, email: result.user.email },
        idToken,
        refreshToken
      )
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string }
      console.error('Email sign-in error:', error)
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password')
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to sign in. Please try again.')
      }
      setAuthState('error')
    } finally {
      setLoading(false)
    }
  }

  // Show error state
  if (!isValidCallback && authState === 'error') {
    return (
      <div className="marketing-page app-cruip relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-[1] w-full max-w-sm text-center"
        >
          <div className="marketing-panel rounded-2xl border p-7 shadow-xl">
            <FontAwesomeIcon icon={faCircleExclamation} className="mb-4 h-12 w-12 text-status-error" />
            <h1 className="marketing-gradient-text font-display mb-2 text-xl font-semibold">Invalid Request</h1>
            <p className="mb-6 text-open-sm text-marketing-muted">
              This page is for CLI authentication only. Please use the CLI to initiate login.
            </p>
            <Link to="/signin" className="btn-marketing-primary block w-full py-2.5 text-center">
              Go to Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // Show success state
  if (authState === 'success' || authState === 'redirecting') {
    return (
      <div className="marketing-page app-cruip relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-[1] w-full max-w-sm text-center"
        >
          <div className="marketing-panel rounded-2xl border p-7 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <FontAwesomeIcon icon={faCheckCircle} className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
            </div>
            <h1 className="marketing-gradient-text font-display mb-2 text-xl font-semibold">Authentication Successful!</h1>
            <p className="mb-4 text-open-sm text-marketing-muted">Sending credentials to CLI...</p>
            <div className="flex items-center justify-center gap-2 text-sm text-marketing-muted">
              <FontAwesomeIcon icon={faTerminal} className="w-4 h-4" />
              <span>You can close this window</span>
            </div>
          </div>
        </motion.div>
      </div>
    )
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
        <div className="marketing-panel rounded-2xl border p-7 shadow-xl">
          <div className="mb-7 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faTerminal} className="h-5 w-5 text-indigo-500 dark:text-accent-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-accent-primary">
                CLI Login
              </span>
            </div>
            <h1 className="marketing-gradient-text font-display mb-1 text-2xl font-semibold tracking-tight">Sign in to CLI</h1>
            <p className="text-open-sm text-marketing-muted">
              Authenticate to use TaskMaster in your terminal
            </p>
          </div>

          {/* Error message */}
          {error && authState === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-status-error bg-marketing-surface text-status-error text-sm mb-5">
              <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Loading state */}
          {(authState === 'authenticating' || authState === 'fetching-token') && (
            <div className="flex items-center justify-center gap-3 p-4 mb-5">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-marketing-muted">
                {authState === 'authenticating' ? 'Signing in...' : 'Fetching credentials...'}
              </span>
            </div>
          )}

          {/* Auth buttons - only show when waiting or error */}
          {(authState === 'waiting' || authState === 'error') && (
            <>
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

              {/* Email/Password Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
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
                      disabled={loading}
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
                      disabled={loading}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-marketing-primary w-full py-2.5"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          )}
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
