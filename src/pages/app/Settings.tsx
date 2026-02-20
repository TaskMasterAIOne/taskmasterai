import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  faSpinner,
  faCopy,
  faCheck,
  faTerminal,
  faExternalLink,
  faRightFromBracket
} from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { openCustomerPortal } from '../../lib/stripe'

// Plan labels for display only (pricing/plans UI lives on /pricing)
const PLAN_LABELS: Record<string, { name: string; price: number | null }> = {
  plus: { name: 'Plus', price: 29 },
  pro: { name: 'Pro', price: 199 },
  enterprise: { name: 'Enterprise', price: null },
}

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
  
  // Billing state
  const [copied, setCopied] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

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

  const currentPlanLabel = userData?.plan ? PLAN_LABELS[userData.plan] : null
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

  const themeOptions = [
    { id: 'light', label: 'Light', icon: faSun },
    { id: 'dark', label: 'Dark', icon: faMoon },
    { id: 'system', label: 'System', icon: faDesktop },
  ] as const

  return (
    <div className="p-4 sm:p-5 lg:p-8 max-w-3xl mx-auto overflow-x-hidden">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Settings</h1>
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="mb-6 sm:mb-8">
        <h2 className="text-base font-semibold mb-4">Profile</h2>
        <div className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
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

            <div className="flex-1 space-y-3 w-full sm:w-auto text-center sm:text-left">
              {/* Editable Name */}
              <div>
                <p className="text-xs text-text-subtle uppercase tracking-wide mb-1">Name</p>
                {isEditingName ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="input py-1.5 flex-1"
                      placeholder="Enter your name"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                    <button
                      onClick={handleNameSave}
                      disabled={saving}
                        className="btn-primary text-sm py-1.5 px-3 flex-1 sm:flex-none"
                    >
                      {saving ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false)
                        setNewDisplayName(user?.displayName || '')
                      }}
                        className="btn-ghost text-sm py-1.5 px-3 flex-1 sm:flex-none"
                    >
                      Cancel
                    </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
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

              <div className="flex items-center justify-center sm:justify-start gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="w-3.5 h-3.5 text-text-subtle" />
                <p className="text-sm text-text-muted truncate">{user?.email}</p>
              </div>
              {userData?.createdAt && (
                <div className="flex items-center justify-center sm:justify-start gap-2">
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mb-6 sm:mb-8">
        <h2 className="text-base font-semibold mb-4">Appearance</h2>
        <div className="card p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4 mb-4">
            <FontAwesomeIcon icon={faPalette} className="w-5 h-5 text-text-muted mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-base font-medium">Theme</p>
              <p className="text-xs sm:text-sm text-text-muted">Choose how TaskMaster AI looks to you</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border transition-all ${
                  mode === option.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface hover:border-border-light'
                }`}
              >
                <FontAwesomeIcon 
                  icon={option.icon} 
                  className={`w-4 sm:w-5 h-4 sm:h-5 ${mode === option.id ? 'text-accent' : 'text-text-muted'}`} 
                />
                <span className={`text-xs sm:text-sm font-medium ${mode === option.id ? 'text-accent' : 'text-text-muted'}`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Billing & Subscription Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }} className="mb-6 sm:mb-8">
        <h2 className="text-base font-semibold mb-4">Billing & Subscription</h2>
        
        {/* License Key - Only show if user has a license */}
        {hasLicense && licenseInfo?.licenseKey && (
          <div className="card p-4 sm:p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <FontAwesomeIcon icon={faKey} className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Your License Key</span>
            </div>
            
            {/* License key display */}
            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <code className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-background rounded-lg font-mono text-xs sm:text-sm text-accent border border-theme-primary overflow-x-auto min-w-0">
                {licenseInfo.licenseKey}
              </code>
              <button
                onClick={handleCopyLicense}
                className="p-2.5 sm:p-3 bg-surface-highlight rounded-lg border border-theme-primary hover:border-accent transition-colors flex-shrink-0"
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
            <div className="p-3 sm:p-4 bg-background rounded-lg border border-theme-primary">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faTerminal} className="w-4 h-4 text-text-muted" />
                <span className="text-sm font-medium">Login via CLI</span>
              </div>
              <code className="block px-3 py-2 bg-surface rounded-lg font-mono text-xs text-text-secondary border border-theme-primary overflow-x-auto">
                taskmaster login
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
          <div className="card p-4 sm:p-5 mb-4">
            <p className="text-sm font-medium mb-3">Usage This Month</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xl sm:text-2xl font-bold">{licenseInfo.tasksUsed || 0}</p>
                <p className="text-xs text-text-muted">tasks used</p>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold">{licenseInfo.tasksPerMonth.toLocaleString()}</p>
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
        <div className="card p-4 sm:p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <FontAwesomeIcon icon={faCreditCard} className="w-5 h-5 text-text-muted flex-shrink-0" />
              {currentPlanLabel || licenseInfo?.hasLicense ? (
                <div>
                  <p className="text-base font-medium">{licenseInfo?.planName || currentPlanLabel?.name} Plan</p>
                  <p className="text-sm text-text-muted">
                    {licenseInfo?.planPrice != null ? `$${licenseInfo.planPrice}` : currentPlanLabel?.price != null ? `$${currentPlanLabel.price}` : ''}
                    {(licenseInfo?.planPrice != null || currentPlanLabel?.price != null) && '/month'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-medium text-text-muted">No active plan</p>
                  <p className="text-sm text-text-muted">
                    <Link to="/pricing" className="text-accent hover:underline">Visit the Pricing page</Link> to choose a plan.
                  </p>
                </div>
              )}
            </div>
            {(currentPlanLabel || licenseInfo?.hasLicense) && user?.email !== 'patrick@envoymobile.com' && (
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

      </motion.div>

      {/* Account Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}>
        <h2 className="text-base font-semibold mb-4">Account</h2>
        
        {/* Sign Out */}
        <div className="card p-4 sm:p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5 text-text-muted flex-shrink-0" />
              <div>
                <p className="text-base font-medium">Sign Out</p>
                <p className="text-xs sm:text-sm text-text-muted">Sign out of your account on this device</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                await logout()
                navigate('/')
              }}
              className="btn-secondary text-sm w-full sm:w-auto"
            >
              Sign Out
            </button>
          </div>
        </div>
      </motion.div>

    </div>
  )
}
