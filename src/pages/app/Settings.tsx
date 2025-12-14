import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faUser,
  faPalette,
  faSun,
  faMoon,
  faDesktop,
  faEnvelope,
  faCalendar,
  faKey,
  faCreditCard,
  faCheckCircle,
  faExclamationTriangle,
  faPen,
  faCamera,
  faCircleExclamation,
  faTrash,
  faSpinner,
  faCopy,
  faCheck,
  faTerminal,
  faReceipt,
  faStar,
  faRocket,
  faExternalLink,
  faXmark,
  faBuilding,
  faPaperPlane,
  faRightFromBracket
} from '@fortawesome/free-solid-svg-icons'
import { createCheckout, openCustomerPortal, PlanType } from '../../lib/stripe'
import { sendContactEmail } from '../../lib/emailjs'

const FUNCTIONS_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net'

const plans = [
  {
    id: 'plus' as PlanType,
    name: 'Plus',
    price: 29,
    priceSuffix: '/mo',
    description: 'For individual developers getting started with AI-powered task management.',
    features: [
      'Up to 100 tasks/month',
      '$0.20 per extra task',
      'Use your own API keys',
      'Secure API key vault',
      'All AI providers supported',
      'Task expansion & analysis',
      'Research mode',
      'Email support',
    ],
  },
  {
    id: 'pro' as PlanType,
    name: 'Pro',
    price: 199,
    priceSuffix: '/mo',
    description: 'For professional developers and power users with higher volume needs.',
    features: [
      '🔥 Hosted API keys included',
      'Up to 1,000 tasks/month',
      '$0.15 per extra task',
      'No API key management needed',
      'Everything in Plus',
      'Priority support',
      'Advanced analytics',
      'Usage insights',
    ],
    popular: true,
  },
  {
    id: 'enterprise' as PlanType,
    name: 'Enterprise',
    price: 599,
    priceSuffix: '+',
    description: 'For teams and organizations with high-volume requirements.',
    features: [
      '🔥 Hosted API keys included',
      '5,000+ tasks/month',
      'Volume discounts available',
      'Everything in Pro',
      'Dedicated support',
      'Custom integrations',
      'Team management',
      'SLA guarantees',
    ],
  },
]

export default function Settings() {
  const { user, userData, licenseInfo, updateUserProfile, logout, refreshLicenseInfo } = useAuth()
  const { mode, setMode } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [imageError, setImageError] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Billing state
  const [copied, setCopied] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', title: '', message: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const paymentSuccess = searchParams.get('success') === 'true'

  // Refresh license info on mount and after successful payment
  useEffect(() => {
    if (paymentSuccess) {
      const timer = setTimeout(() => {
        refreshLicenseInfo()
        setSuccess('Payment successful! Your license key is ready below.')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [paymentSuccess, refreshLicenseInfo])

  const handleCopyLicense = async () => {
    if (licenseInfo?.licenseKey) {
      await navigator.clipboard.writeText(licenseInfo.licenseKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelectPlan = async (planId: PlanType) => {
    if (!user || !userData) return
    setError('')

    if (planId === 'enterprise') {
      setShowContactModal(true)
      return
    }

    setLoadingPlan(planId)
    try {
      await createCheckout({
        plan: planId,
        userId: user.uid,
        email: userData.email || user.email || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    if (!user) return
    setLoadingPortal(true)
    try {
      await openCustomerPortal(user.uid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setLoadingPortal(false)
    }
  }

  const currentPlan = plans.find(p => p.id === userData?.plan)
  const hasLicense = licenseInfo?.hasLicense

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateUserProfile({ photoFile: file })
      setSuccess('Profile photo updated')
      setImageError(false)
    } catch (err) {
      console.error('Error updating photo:', err)
      setError('Failed to update profile photo')
    } finally {
      setSaving(false)
    }
  }

  const handleNameSave = async () => {
    if (!newDisplayName.trim()) {
      setError('Name cannot be empty')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateUserProfile({ displayName: newDisplayName.trim() })
      setSuccess('Name updated')
      setIsEditingName(false)
    } catch (err) {
      console.error('Error updating name:', err)
      setError('Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

    if (!user?.uid) {
      setError('User not found')
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`${FUNCTIONS_URL}/deleteAccount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete account')
      }

      // Sign out and redirect to home
      await logout()
      navigate('/')
    } catch (err) {
      console.error('Error deleting account:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  const themeOptions = [
    { id: 'light', label: 'Light', icon: faSun },
    { id: 'dark', label: 'Dark', icon: faMoon },
    { id: 'system', label: 'System', icon: faDesktop },
  ] as const

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-text-muted">Manage your account and preferences</p>
      </motion.div>

      {/* Status messages */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-error text-status-error text-sm mb-5">
          <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-success text-status-success text-sm mb-5">
          <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 flex-shrink-0" />
          {success}
        </motion.div>
      )}

      {/* Profile Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h2 className="text-base font-semibold mb-4">Profile</h2>
        <div className="card p-5">
          <div className="flex items-start gap-4">
            {/* Profile Photo */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user?.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="w-16 h-16 rounded-full object-cover"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <FontAwesomeIcon icon={faUser} className="w-6 h-6 text-text-muted" />
                )}
              </div>
              <button
                onClick={handlePhotoClick}
                disabled={saving}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <FontAwesomeIcon icon={faCamera} className="w-5 h-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 space-y-3">
              {/* Editable Name */}
              <div>
                <p className="text-xs text-text-subtle uppercase tracking-wide mb-1">Name</p>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="input text-sm py-1.5 flex-1"
                      placeholder="Enter your name"
                      autoFocus
                    />
                    <button
                      onClick={handleNameSave}
                      disabled={saving}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {saving ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false)
                        setNewDisplayName(user?.displayName || '')
                      }}
                      className="btn-ghost text-sm py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{user?.displayName || 'Not set'}</p>
                    <button
                      onClick={() => {
                        setNewDisplayName(user?.displayName || '')
                        setIsEditingName(true)
                      }}
                      className="p-1 text-text-subtle hover:text-text transition-colors"
                    >
                      <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-text-subtle" />
                <p className="text-sm text-text-muted">{user?.email}</p>
              </div>
              {userData?.createdAt && (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCalendar} className="w-3.5 h-3.5 text-text-subtle" />
                  <p className="text-sm text-text-muted">
                    Joined {new Date(userData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Appearance Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h2 className="text-base font-semibold mb-4">Appearance</h2>
        <div className="card p-5">
          <div className="flex items-start gap-4 mb-4">
            <FontAwesomeIcon icon={faPalette} className="w-5 h-5 text-text-muted mt-0.5" />
            <div>
              <p className="text-base font-medium">Theme</p>
              <p className="text-sm text-text-muted">Choose how TaskMaster AI looks to you</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  mode === option.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface hover:border-border-light'
                }`}
              >
                <FontAwesomeIcon 
                  icon={option.icon} 
                  className={`w-5 h-5 ${mode === option.id ? 'text-accent' : 'text-text-muted'}`} 
                />
                <span className={`text-sm font-medium ${mode === option.id ? 'text-accent' : 'text-text-muted'}`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Billing & Subscription Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h2 className="text-base font-semibold mb-4">Billing & Subscription</h2>
        
        {/* License Key - Only show if user has a license */}
        {hasLicense && licenseInfo?.licenseKey && (
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <FontAwesomeIcon icon={faKey} className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Your License Key</span>
            </div>
            
            {/* License key display */}
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 px-4 py-3 bg-background rounded-lg font-mono text-sm text-accent border border-theme-primary overflow-x-auto">
                {licenseInfo.licenseKey}
              </code>
              <button
                onClick={handleCopyLicense}
                className="p-3 bg-surface-highlight rounded-lg border border-theme-primary hover:border-accent transition-colors"
                title="Copy to clipboard"
              >
                <FontAwesomeIcon 
                  icon={copied ? faCheck : faCopy} 
                  className={`w-4 h-4 ${copied ? 'text-green-400' : 'text-text-muted'}`} 
                />
              </button>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                licenseInfo.status === 'active' 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : licenseInfo.status === 'grace_period'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {licenseInfo.status === 'active' ? 'Active' : 
                 licenseInfo.status === 'grace_period' ? 'Grace Period' : 'Expired'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent">
                {licenseInfo.planName} Plan
              </span>
              {licenseInfo.tasksPerMonth && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-highlight text-text-muted border border-theme-primary">
                  {licenseInfo.tasksPerMonth.toLocaleString()} tasks/month
                </span>
              )}
            </div>

            {/* CLI Instructions */}
            <div className="p-4 bg-background rounded-lg border border-theme-primary">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faTerminal} className="w-4 h-4 text-text-muted" />
                <span className="text-sm font-medium">Activate in CLI</span>
              </div>
              <code className="block px-3 py-2 bg-surface rounded-lg font-mono text-xs text-text-secondary border border-theme-primary">
                taskmaster activate {licenseInfo.licenseKey}
              </code>
            </div>

            {/* Grace period warning */}
            {licenseInfo.status === 'grace_period' && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 mr-2" />
                  Your payment is past due. Please update your payment method.
                </p>
              </div>
            )}

            {/* Cancellation notice */}
            {licenseInfo.cancelAtPeriodEnd && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 mr-2" />
                  Cancels on {licenseInfo.currentPeriodEnd ? new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your billing period'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Usage Stats */}
        {hasLicense && licenseInfo?.tasksPerMonth && licenseInfo.tasksPerMonth > 0 && (
          <div className="card p-5 mb-4">
            <p className="text-sm font-medium mb-3">Usage This Month</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold">{licenseInfo.tasksUsed || 0}</p>
                <p className="text-xs text-text-muted">tasks used</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{licenseInfo.tasksPerMonth.toLocaleString()}</p>
                <p className="text-xs text-text-muted">included</p>
              </div>
            </div>
            <div className="w-full h-3 bg-surface-highlight rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  ((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth) > 0.9 
                    ? 'bg-red-500' 
                    : ((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth) > 0.7 
                      ? 'bg-amber-500' 
                      : 'bg-accent'
                }`}
                style={{ 
                  width: `${Math.min(100, ((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth) * 100)}%` 
                }}
              />
            </div>
            <p className="text-xs text-text-muted mt-2">
              {((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth * 100).toFixed(1)}% used
              {licenseInfo.currentPeriodEnd && (
                <span className="ml-2">· Resets {new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
            </p>
          </div>
        )}

        {/* Current Plan & Manage */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FontAwesomeIcon icon={faCreditCard} className="w-5 h-5 text-text-muted" />
              {currentPlan || licenseInfo?.hasLicense ? (
                <div>
                  <p className="text-base font-medium">{licenseInfo?.planName || currentPlan?.name} Plan</p>
                  <p className="text-sm text-text-muted">
                    ${licenseInfo?.planPrice || currentPlan?.price}/month
                    {licenseInfo?.currentPeriodEnd && !licenseInfo?.cancelAtPeriodEnd && (
                      <span className="ml-2">
                        · Renews {new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-medium text-text-muted">No active plan</p>
                  <p className="text-sm text-text-muted">Choose a plan below to get started</p>
                </div>
              )}
            </div>
            {(currentPlan || licenseInfo?.hasLicense) && (
              <button
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                {loadingPortal ? (
                  <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faExternalLink} className="w-3 h-3" />
                )}
                Manage
              </button>
            )}
          </div>
        </div>

        {/* Plans Grid - Show if no current plan */}
        {!licenseInfo?.hasLicense && !currentPlan && (
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            {plans.map((plan) => {
              const isLoading = loadingPlan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-5 ${
                    plan.popular ? 'border-accent bg-surface-elevated' : 'border-theme-primary bg-surface'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-accent rounded-full text-xs font-medium text-white">
                        <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                        Popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-base font-semibold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-bold">${plan.price}</span>
                    <span className="text-sm text-text-muted">{plan.priceSuffix}</span>
                  </div>
                  <p className="text-xs text-text-muted mb-4 line-clamp-2">{plan.description}</p>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isLoading || loadingPlan !== null}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.popular
                        ? 'bg-accent text-white hover:bg-accent-hover'
                        : 'bg-surface-highlight border border-theme-primary hover:border-accent'
                    }`}
                  >
                    {isLoading ? (
                      <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                    ) : (
                      plan.id === 'enterprise' ? 'Contact Sales' : 'Get Started'
                    )}
                  </button>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs">
                        <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5 text-status-success flex-shrink-0 mt-0.5" />
                        <span className="text-text-muted">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {/* Invoices */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faReceipt} className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-base font-medium">Invoices</p>
                <p className="text-sm text-text-muted">
                  {currentPlan || hasLicense ? 'View and download invoices' : 'No invoices yet'}
                </p>
              </div>
            </div>
            {(currentPlan || hasLicense) && (
              <button
                onClick={handleManageSubscription}
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                View →
              </button>
            )}
          </div>
        </div>

        {/* Enterprise Contact */}
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faRocket} className="w-5 h-5 text-text-muted" />
            <div>
              <p className="text-base font-medium">Need more?</p>
              <p className="text-sm text-text-muted">Contact us for custom enterprise pricing</p>
            </div>
          </div>
          <button onClick={() => setShowContactModal(true)} className="btn-secondary">Contact Sales</button>
        </div>
      </motion.div>

      {/* Account Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}>
        <h2 className="text-base font-semibold mb-4">Account</h2>
        
        {/* Sign Out */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-base font-medium">Sign Out</p>
                <p className="text-sm text-text-muted">Sign out of your account on this device</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                await logout()
                navigate('/')
              }}
              className="btn-secondary text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-status-error">Delete Account</p>
              <p className="text-sm text-text-muted">Permanently delete your account and data</p>
            </div>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="text-sm px-3 py-1.5 rounded-lg border border-status-error text-status-error hover:bg-status-error/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-surface-elevated rounded-2xl shadow-xl border border-border overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-status-error/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrash} className="w-5 h-5 text-status-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-status-error">Delete Account</h3>
                    <p className="text-sm text-text-muted">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/20">
                  <p className="text-sm text-text">
                    <strong>Warning:</strong> Deleting your account will:
                  </p>
                  <ul className="text-sm text-text-muted mt-2 space-y-1 list-disc list-inside">
                    <li>Cancel your active subscription</li>
                    <li>Delete all your API keys</li>
                    <li>Remove all your data permanently</li>
                    <li>Revoke your license key</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type <span className="font-mono text-status-error">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    disabled={deleting}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmText('')
                  }}
                  disabled={deleting}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                  className="flex-1 py-2.5 px-4 rounded-lg font-medium transition-all bg-status-error text-white hover:bg-status-error/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      Delete Account
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Sales Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!sendingEmail) {
                setShowContactModal(false)
                setEmailSent(false)
                setEmailError(null)
                setContactForm({ name: '', email: '', title: '', message: '' })
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-surface border border-theme-primary rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-theme-primary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={faBuilding} className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Contact Sales</h3>
                    <p className="text-xs text-text-muted">Enterprise & custom plans</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setEmailSent(false)
                    setEmailError(null)
                    setContactForm({ name: '', email: '', title: '', message: '' })
                  }}
                  disabled={sendingEmail}
                  className="p-2 rounded-lg hover:bg-surface-highlight transition-colors disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faXmark} className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {emailSent ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <FontAwesomeIcon icon={faCheckCircle} className="w-8 h-8 text-green-400" />
                    </div>
                    <h4 className="text-lg font-semibold mb-2">Message Sent!</h4>
                    <p className="text-sm text-text-muted">
                      Thank you for reaching out. We'll get back to you within 24-48 hours.
                    </p>
                    <button
                      onClick={() => {
                        setShowContactModal(false)
                        setEmailSent(false)
                        setContactForm({ name: '', email: '', title: '', message: '' })
                      }}
                      className="mt-6 btn-primary"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary">
                      Looking for custom pricing, volume discounts, or team features? 
                      Fill out the form below and we'll get back to you.
                    </p>

                    {emailError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-red-400" />
                        <p className="text-sm text-red-400">{emailError}</p>
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setSendingEmail(true)
                        setEmailError(null)
                        try {
                          await sendContactEmail(contactForm)
                          setEmailSent(true)
                        } catch (err) {
                          setEmailError(err instanceof Error ? err.message : 'Failed to send message')
                        } finally {
                          setSendingEmail(false)
                        }
                      }}
                      className="space-y-3"
                    >
                      {/* Name & Email - 2 columns */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Name *
                          </label>
                          <div className="relative">
                            <FontAwesomeIcon 
                              icon={faUser} 
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" 
                            />
                            <input
                              type="text"
                              value={contactForm.name}
                              onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Your name"
                              required
                              className="input pl-10"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Email *
                          </label>
                          <div className="relative">
                            <FontAwesomeIcon 
                              icon={faEnvelope} 
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" 
                            />
                            <input
                              type="email"
                              value={contactForm.email}
                              onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="you@company.com"
                              required
                              className="input pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Subject *
                        </label>
                        <input
                          type="text"
                          value={contactForm.title}
                          onChange={(e) => setContactForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Enterprise Plan Inquiry"
                          required
                          className="input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Message *
                        </label>
                        <textarea
                          value={contactForm.message}
                          onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Tell us about your needs (team size, estimated usage, etc.)"
                          required
                          rows={3}
                          className="input resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingEmail}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingEmail ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faPaperPlane} className="w-4 h-4" />
                            Send Message
                          </>
                        )}
                      </button>
                    </form>

                    <div className="p-4 bg-surface-highlight rounded-xl border border-theme-primary">
                      <p className="text-xs text-text-muted mb-2">Enterprise features include:</p>
                      <ul className="space-y-1.5">
                        {[
                          '5,000+ tasks/month with volume discounts',
                          'Dedicated account manager',
                          'Custom integrations & API access',
                          'Team management & SSO',
                          'Priority support with SLA'
                        ].map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-xs text-text-secondary">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-accent" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
