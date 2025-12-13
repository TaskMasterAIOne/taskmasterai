import { motion } from 'framer-motion'
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
  faClock,
  faPen,
  faCamera,
  faCircleExclamation
} from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'

import { useState, useRef } from 'react'

export default function Settings() {
  const { user, userData, licenseInfo, updateUserProfile } = useAuth()
  const { mode, setMode } = useTheme()
  const [imageError, setImageError] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'grace_period': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'canceled':
      case 'expired': return 'text-red-400 bg-red-500/10 border-red-500/30'
      default: return 'text-text-muted bg-surface-highlight border-border'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return faCheckCircle
      case 'grace_period': return faClock
      case 'canceled':
      case 'expired': return faExclamationTriangle
      default: return faCreditCard
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

      {/* Subscription Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h2 className="text-base font-semibold mb-4">Subscription</h2>
        <div className="card p-5">
          <div className="space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faCreditCard} className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="text-base font-medium">
                    {licenseInfo?.planName 
                      ? `${licenseInfo.planName} Plan` 
                      : userData?.plan 
                        ? `${userData.plan.charAt(0).toUpperCase()}${userData.plan.slice(1)} Plan` 
                        : 'No active plan'}
                  </p>
                  {licenseInfo?.planPrice && (
                    <p className="text-sm text-text-muted">${licenseInfo.planPrice}/month</p>
                  )}
                </div>
              </div>
              <Link to="/app/billing" className="btn-secondary text-sm">
                {licenseInfo?.hasLicense ? 'Manage' : 'Upgrade'}
              </Link>
            </div>

            {/* Status Badge */}
            {licenseInfo?.hasLicense && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(licenseInfo.status)}`}>
                  <FontAwesomeIcon icon={getStatusIcon(licenseInfo.status)} className="w-3 h-3" />
                  {licenseInfo.status === 'active' ? 'Active' : 
                   licenseInfo.status === 'grace_period' ? 'Grace Period' : 
                   licenseInfo.cancelAtPeriodEnd ? 'Canceling' : 
                   licenseInfo.status || 'Unknown'}
                </span>
                {licenseInfo.cancelAtPeriodEnd && (
                  <span className="text-xs text-text-muted">
                    Ends {licenseInfo.currentPeriodEnd ? new Date(licenseInfo.currentPeriodEnd).toLocaleDateString() : 'soon'}
                  </span>
                )}
              </div>
            )}

            {/* Usage Stats */}
            {licenseInfo?.hasLicense && licenseInfo.tasksPerMonth && licenseInfo.tasksPerMonth > 0 && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-text-muted">Tasks this month</p>
                  <p className="text-sm font-medium">
                    {licenseInfo.tasksUsed || 0} / {licenseInfo.tasksPerMonth.toLocaleString()}
                  </p>
                </div>
                <div className="w-full h-2 bg-surface-highlight rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* License Key (mini) */}
            {licenseInfo?.licenseKey && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faKey} className="w-4 h-4 text-text-muted" />
                  <p className="text-sm text-text-muted">License:</p>
                  <code className="text-xs text-accent font-mono">
                    {licenseInfo.licenseKey.slice(0, 20)}...
                  </code>
                  <Link to="/app/billing" className="text-xs text-accent hover:underline ml-auto">
                    View full key
                  </Link>
                </div>
              </div>
            )}

            {/* Next billing date */}
            {licenseInfo?.currentPeriodEnd && !licenseInfo.cancelAtPeriodEnd && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCalendar} className="w-4 h-4 text-text-muted" />
                  <p className="text-sm text-text-muted">
                    Next billing: {new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Account Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}>
        <h2 className="text-base font-semibold mb-4">Account</h2>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-medium text-status-error">Delete Account</p>
              <p className="text-sm text-text-muted">Permanently delete your account and data</p>
            </div>
            <button className="text-sm px-3 py-1.5 rounded-lg border border-status-error text-status-error hover:bg-status-error/10 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
