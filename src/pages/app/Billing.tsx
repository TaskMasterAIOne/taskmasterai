import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCreditCard, 
  faCheck, 
  faReceipt,
  faStar,
  faRocket,
  faKey,
  faCopy,
  faCheckCircle,
  faExclamationTriangle,
  faSpinner,
  faTerminal,
  faExternalLink
} from '@fortawesome/free-solid-svg-icons'
import { createCheckout, openCustomerPortal, cancelSubscription, PlanType } from '../../lib/stripe'

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
      'Up to 1,000 tasks/month',
      '$0.15 per extra task',
      'Everything in Plus',
      'Priority support',
      'Advanced analytics',
      'Model switching',
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

export default function Billing() {
  const { user, userData, licenseInfo, refreshLicenseInfo } = useAuth()
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingCancel, setLoadingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const success = searchParams.get('success') === 'true'

  // Refresh license info on mount and after successful payment
  useEffect(() => {
    if (success) {
      // Wait a moment for webhook to process, then refresh
      const timer = setTimeout(() => {
        refreshLicenseInfo()
        setSuccessMessage('Payment successful! Your license key is ready below.')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [success, refreshLicenseInfo])

  const handleCopyLicense = async () => {
    if (licenseInfo?.licenseKey) {
      await navigator.clipboard.writeText(licenseInfo.licenseKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelectPlan = async (planId: PlanType) => {
    if (!user || !userData) return
    setError(null)

    if (planId === 'enterprise') {
      window.location.href = 'mailto:taskmasteroneai@gmail.com?subject=Enterprise%20Plan%20Inquiry'
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

  const handleCancelSubscription = async () => {
    if (!user) return
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return
    }
    
    setLoadingCancel(true)
    try {
      await cancelSubscription(user.uid)
      setSuccessMessage('Subscription will be canceled at the end of your billing period.')
      refreshLicenseInfo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setLoadingCancel(false)
    }
  }

  const currentPlan = plans.find(p => p.id === userData?.plan)
  const hasLicense = licenseInfo?.hasLicense

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Billing</h1>
        <p className="text-sm text-text-muted">Manage your subscription and license key</p>
      </motion.div>

      {/* Success message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
        >
          <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400">{successMessage}</p>
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
        >
          <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {/* License Key Section - Only show if user has a license */}
      {hasLicense && licenseInfo?.licenseKey && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.4, ease: 'easeOut' }} className="mb-8">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faKey} className="w-4 h-4 text-accent" />
            Your License Key
          </h2>
          <div className="card p-5 space-y-4">
            {/* License key display */}
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-background rounded-lg font-mono text-sm text-accent border border-border overflow-x-auto">
                {licenseInfo.licenseKey}
              </code>
              <button
                onClick={handleCopyLicense}
                className="p-3 bg-surface-highlight rounded-lg border border-border hover:border-accent transition-colors"
                title="Copy to clipboard"
              >
                <FontAwesomeIcon 
                  icon={copied ? faCheck : faCopy} 
                  className={`w-4 h-4 ${copied ? 'text-green-400' : 'text-text-muted'}`} 
                />
              </button>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
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
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/30">
                {licenseInfo.planName} Plan
              </span>
              {licenseInfo.tasksPerMonth && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-highlight text-text-muted border border-border">
                  {licenseInfo.tasksPerMonth.toLocaleString()} tasks/month
                </span>
              )}
            </div>

            {/* CLI Instructions */}
            <div className="mt-4 p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faTerminal} className="w-4 h-4 text-text-muted" />
                <span className="text-sm font-medium">Activate in CLI</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-text-muted mb-2">Run this command to activate TaskMaster AI:</p>
                <code className="block px-3 py-2 bg-surface rounded-lg font-mono text-xs text-text-secondary border border-border">
                  taskmaster activate {licenseInfo.licenseKey}
                </code>
              </div>
            </div>

            {/* Grace period warning */}
            {licenseInfo.status === 'grace_period' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 mr-2" />
                  Your payment is past due. Please update your payment method to avoid service interruption.
                </p>
              </div>
            )}

            {/* Cancellation notice */}
            {licenseInfo.cancelAtPeriodEnd && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 mr-2" />
                  Your subscription is set to cancel on {licenseInfo.currentPeriodEnd ? new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'the end of your billing period'}. 
                  You'll continue to have access until then.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Usage Stats */}
      {hasLicense && licenseInfo?.tasksPerMonth && licenseInfo.tasksPerMonth > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08, duration: 0.4, ease: 'easeOut' }} className="mb-8">
          <h2 className="text-base font-semibold mb-4">Usage This Month</h2>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold">{licenseInfo.tasksUsed || 0}</p>
                <p className="text-sm text-text-muted">tasks used</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{licenseInfo.tasksPerMonth.toLocaleString()}</p>
                <p className="text-sm text-text-muted">included in plan</p>
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
              {((licenseInfo.tasksUsed || 0) / licenseInfo.tasksPerMonth * 100).toFixed(1)}% of monthly limit used
              {(licenseInfo.tasksUsed || 0) > licenseInfo.tasksPerMonth && (
                <span className="text-amber-400 ml-2">
                  ({(licenseInfo.tasksUsed || 0) - licenseInfo.tasksPerMonth} overage tasks)
                </span>
              )}
            </p>
            {licenseInfo.currentPeriodEnd && (
              <p className="text-xs text-text-muted mt-1">
                Resets on {new Date(licenseInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Current Plan */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h2 className="text-base font-semibold mb-4">Current Plan</h2>
        <div className="card p-5">
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
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Plans Grid - Show if no current plan or for upgrade options */}
      {!licenseInfo?.hasLicense && !currentPlan && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mb-8">
          <h2 className="text-base font-semibold mb-4">Choose a Plan</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isLoading = loadingPlan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-5 ${
                    plan.popular ? 'border-accent bg-surface-elevated' : 'border-border bg-surface'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-accent rounded-full text-xs font-medium text-white">
                        <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                        Most Popular
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
                        : 'bg-surface-highlight border border-border hover:border-border-light'
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
        </motion.div>
      )}

      {/* Invoices */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}>
        <h2 className="text-base font-semibold mb-4">Invoices</h2>
        <div className="card text-center py-8">
          <FontAwesomeIcon icon={faReceipt} className="w-6 h-6 text-text-subtle mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            {currentPlan 
              ? 'Manage your invoices in the Stripe billing portal'
              : 'No invoices yet'}
          </p>
          {currentPlan && (
            <button
              onClick={handleManageSubscription}
              className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View Invoices →
            </button>
          )}
        </div>
      </motion.div>

      {/* Enterprise / Cancel */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }} className="mt-8 space-y-4">
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faRocket} className="w-5 h-5 text-text-muted" />
            <div>
              <p className="text-base font-medium">Need more?</p>
              <p className="text-sm text-text-muted">Contact us for custom enterprise pricing</p>
            </div>
          </div>
          <a href="mailto:taskmasteroneai@gmail.com" className="btn-secondary">Contact Sales</a>
        </div>

        {currentPlan && userData?.subscriptionStatus !== 'canceling' && (
          <div className="text-center pt-4">
            <button
              onClick={handleCancelSubscription}
              disabled={loadingCancel}
              className="text-sm text-text-muted hover:text-red-400 transition-colors"
            >
              {loadingCancel ? (
                <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 animate-spin mr-2" />
              ) : null}
              Cancel subscription
            </button>
          </div>
        )}

        {userData?.subscriptionStatus === 'canceling' && (
          <div className="text-center pt-4">
            <p className="text-sm text-amber-400">
              Your subscription is set to cancel at the end of the billing period.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
