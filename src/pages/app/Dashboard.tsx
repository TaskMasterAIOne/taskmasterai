import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faKey,
  faGear,
  faArrowUpRightFromSquare,
  faChartLine,
  faSpinner,
  faCreditCard,
  faTerminal,
  faCheckCircle,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'

// Plan limits for fallback when license document doesn't have tasksPerMonth
const PLAN_LIMITS: { [key: string]: { tasksPerMonth: number; overageRate: number } } = {
  plus: { tasksPerMonth: 100, overageRate: 0.20 },
  pro: { tasksPerMonth: 1000, overageRate: 0.15 },
  enterprise: { tasksPerMonth: 5000, overageRate: 0.10 },
}

interface UsageStats {
  tasksUsed: number
  tasksPerMonth: number
  remaining: number
  percentUsed: number
  isOverage: boolean
  overageCount: number
  overageRate: number
  estimatedOverageCost: number
  lastTaskAt: string | null
  plan: string
  planName: string
}

interface OperationBreakdown {
  [key: string]: number
}

interface UsageData {
  stats: UsageStats
  operationBreakdown: OperationBreakdown
  dailyUsage: { [date: string]: number }
  recentActivity: Array<{
    operation: string
    count: number
    timestamp: string
    totalAfter: number
  }>
}

const quickActions = [
  {
    title: 'Configure API Keys',
    description: 'Add your AI provider API keys',
    icon: faKey,
    href: '/app/api-keys',
  },
  {
    title: 'Set Up Models',
    description: 'Choose your preferred AI models',
    icon: faGear,
    href: '/app/models',
  },
]

export default function Dashboard() {
  const { user, licenseInfo } = useAuth()
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [hasApiKeys, setHasApiKeys] = useState(false)
  const [hasModelsConfig, setHasModelsConfig] = useState(false)

  const hasLicense = licenseInfo?.hasLicense
  const gsPlan = hasLicense
  const gsApiKeys = hasApiKeys
  const gsModels = hasModelsConfig
  const gsProject = hasLicense && hasApiKeys && hasModelsConfig

  // Real-time listener for API keys (to track setup progress)
  useEffect(() => {
    if (!user?.uid) {
      setHasApiKeys(false)
      return
    }

    const keysRef = collection(db, 'users', user.uid, 'apiKeys')
    const unsubscribe = onSnapshot(keysRef, (snapshot) => {
      setHasApiKeys(!snapshot.empty)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // Real-time listener for model configuration (to track setup progress)
  useEffect(() => {
    if (!user?.uid) {
      setHasModelsConfig(false)
      return
    }

    const configRef = doc(db, 'users', user.uid, 'settings', 'models')
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      setHasModelsConfig(snapshot.exists())
    })

    return () => unsubscribe()
  }, [user?.uid])

  // Real-time listener for usage stats
  useEffect(() => {
    if (!user?.uid || !hasLicense) {
      setLoadingUsage(false)
      return
    }

    setLoadingUsage(true)
    setUsageError(null)

    // Listen to user document for basic usage stats
    const userDocRef = doc(db, 'users', user.uid)
    const licenseDocRef = doc(db, 'users', user.uid, 'license', 'current')
    const usageLogRef = collection(db, 'users', user.uid, 'usageLog')
    const recentUsageQuery = query(usageLogRef, orderBy('timestamp', 'desc'), limit(10))

    let userData: { tasksUsed?: number; lastTaskAt?: Date } = {}
    let licenseData: { plan?: string; tasksPerMonth?: number; overageRate?: number; planName?: string } = {}
    let usageLogData: { operation: string; count: number; timestamp: string; totalAfter: number }[] = []
    let operationBreakdown: { [key: string]: number } = {}

    const updateUsageData = () => {
      const tasksUsed = userData.tasksUsed || 0
      // Use plan limits as fallback if tasksPerMonth is not set in license document
      const planKey = licenseData.plan?.toLowerCase() || licenseInfo?.plan?.toLowerCase() || ''
      const planDefaults = PLAN_LIMITS[planKey] || { tasksPerMonth: 100, overageRate: 0.20 }
      const tasksPerMonth = licenseData.tasksPerMonth || planDefaults.tasksPerMonth
      const overageRate = licenseData.overageRate ?? planDefaults.overageRate
      const isOverage = tasksPerMonth > 0 && tasksUsed > tasksPerMonth
      const overageCount = isOverage ? tasksUsed - tasksPerMonth : 0
      const estimatedOverageCost = isOverage ? overageCount * overageRate : 0

      setUsageData({
        stats: {
          tasksUsed,
          tasksPerMonth,
          remaining: Math.max(0, tasksPerMonth - tasksUsed),
          percentUsed: tasksPerMonth > 0 ? Math.round((tasksUsed / tasksPerMonth) * 100) : 0,
          isOverage,
          overageCount,
          overageRate,
          estimatedOverageCost,
          lastTaskAt: userData.lastTaskAt?.toISOString() || null,
          plan: licenseData.plan || licenseInfo?.plan || '',
          planName: licenseData.planName || licenseInfo?.planName || '',
        },
        operationBreakdown,
        dailyUsage: {},
        recentActivity: usageLogData,
      })
      setLoadingUsage(false)
    }

    // Listen to user document
    const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        userData = {
          tasksUsed: data.tasksUsed || 0,
          lastTaskAt: data.lastTaskAt?.toDate(),
        }
        updateUsageData()
      }
    }, (err) => {
      console.error('Error listening to user document:', err)
      setUsageError('Failed to load usage stats')
      setLoadingUsage(false)
    })

    // Listen to license document
    const unsubscribeLicense = onSnapshot(licenseDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        licenseData = {
          plan: data.plan,
          tasksPerMonth: data.tasksPerMonth,
          overageRate: data.overageRate,
          planName: data.planName,
        }
      } else {
        // Fallback to licenseInfo from context if document doesn't exist
        const planKey = licenseInfo?.plan?.toLowerCase() || ''
        const planDefaults = PLAN_LIMITS[planKey] || { tasksPerMonth: 100, overageRate: 0.20 }
        licenseData = {
          plan: licenseInfo?.plan,
          tasksPerMonth: licenseInfo?.tasksPerMonth || planDefaults.tasksPerMonth,
          overageRate: licenseInfo?.overageRate || planDefaults.overageRate,
          planName: licenseInfo?.planName,
        }
      }
      updateUsageData()
    }, (err) => {
      console.error('Error listening to license document:', err)
    })

    // Listen to recent usage log
    const unsubscribeUsageLog = onSnapshot(recentUsageQuery, (snapshot) => {
      usageLogData = []
      operationBreakdown = {}
      
      snapshot.forEach((doc) => {
        const data = doc.data()
        const operation = data.operation || 'unknown'
        
        usageLogData.push({
          operation,
          count: data.count || 1,
          timestamp: data.timestamp?.toDate()?.toISOString() || '',
          totalAfter: data.totalAfter || 0,
        })
        
        operationBreakdown[operation] = (operationBreakdown[operation] || 0) + (data.count || 1)
      })
      
      updateUsageData()
    }, (err) => {
      console.error('Error listening to usage log:', err)
    })

    return () => {
      unsubscribeUser()
      unsubscribeLicense()
      unsubscribeUsageLog()
    }
  }, [user?.uid, hasLicense, licenseInfo?.plan, licenseInfo?.tasksPerMonth, licenseInfo?.overageRate, licenseInfo?.planName])

  // Format operation name for display
  const formatOperationName = (op: string) => {
    const names: { [key: string]: string } = {
      'parse-prd': 'Parse PRD',
      'expand': 'Expand Task',
      'add-task': 'Add Task',
      'analyze-complexity': 'Analyze Complexity',
      'update-task': 'Update Task',
      'update-subtask': 'Update Subtask',
      'aiOperations': 'AI Operations',
    }
    return names[op] || op.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-400/50" />
          <span className="bg-gradient-to-r from-indigo-500 to-violet-400 bg-clip-text text-sm font-medium text-transparent">
            Overview
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-400/50" />
        </div>
        <h1 className="marketing-gradient-text font-display mb-1 text-2xl font-semibold tracking-tight md:text-3xl">
          Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-open-sm text-marketing-muted">
          Overview of your TaskMaster AI workspace
        </p>
      </motion.div>

      {/* Usage Stats - Only for paid users */}
      {hasLicense && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="mb-8"
        >
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartLine} className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            Usage This Month
          </h2>

          {loadingUsage ? (
            <div className="card-marketing p-8 flex items-center justify-center">
              <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 animate-spin text-marketing-muted" />
              <span className="ml-3 text-marketing-muted">Loading usage data...</span>
            </div>
          ) : usageError ? (
            <div className="card-marketing p-5 bg-red-500/5 border-red-500/20">
              <p className="text-sm text-red-400">{usageError}</p>
            </div>
          ) : usageData?.stats ? (
            <div className="space-y-4">
              {/* Main usage card */}
              <div className="card-marketing p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">{usageData.stats.tasksUsed}</p>
                    <p className="text-sm text-marketing-muted">tasks used this month</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold text-marketing-text sm:text-xl">
                      {usageData.stats.tasksPerMonth > 0 
                        ? usageData.stats.tasksPerMonth.toLocaleString() 
                        : 'Unlimited'}
                    </p>
                    <p className="text-sm text-marketing-muted">included in plan</p>
                  </div>
                </div>

                {/* Progress bar */}
                {usageData.stats.tasksPerMonth > 0 && (
                  <>
                    <div className="w-full h-3 bg-marketing-elevated rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          usageData.stats.percentUsed > 90 
                            ? 'bg-red-500' 
                            : usageData.stats.percentUsed > 70 
                              ? 'bg-amber-500' 
                              : 'bg-accent'
                        }`}
                        style={{ width: `${Math.min(100, usageData.stats.percentUsed)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-marketing-muted">
                      <span>{usageData.stats.percentUsed}% used</span>
                      <span>{usageData.stats.remaining} remaining</span>
                    </div>
                  </>
                )}

                {/* Overage warning */}
                {usageData.stats.isOverage && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-amber-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Overage Alert</p>
                        <p className="text-xs text-amber-400/80">
                          You've used {usageData.stats.overageCount} extra tasks @ ${usageData.stats.overageRate}/task
                          = ${usageData.stats.estimatedOverageCost.toFixed(2)} estimated overage
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Operation breakdown */}
              {usageData.operationBreakdown && Object.keys(usageData.operationBreakdown).length > 0 && (
                <div className="card-marketing p-4 sm:p-5">
                  <h3 className="text-sm font-medium mb-3">Usage by Operation</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    {Object.entries(usageData.operationBreakdown)
                      .filter(([op]) => op !== 'unknown')
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([operation, count]) => (
                        <div key={operation} className="p-3 bg-marketing-elevated rounded-lg">
                          <p className="text-lg font-semibold">{count}</p>
                          <p className="text-xs text-marketing-muted truncate">{formatOperationName(operation)}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Recent activity */}
              {usageData.recentActivity && usageData.recentActivity.length > 0 && (
                <div className="card-marketing p-4 sm:p-5">
                  <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
                  <div className="space-y-2">
                    {usageData.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-marketing-border last:border-0 gap-1 sm:gap-3">
                        <div className="flex items-center gap-3">
                          <FontAwesomeIcon icon={faTerminal} className="w-3 h-3 text-marketing-muted/80 flex-shrink-0" />
                          <span className="text-sm">{formatOperationName(activity.operation)}</span>
                        </div>
                        <div className="text-left sm:text-right ml-6 sm:ml-0">
                          <span className="text-xs text-marketing-muted">
                            {activity.timestamp 
                              ? new Date(activity.timestamp).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card-marketing p-5 text-center">
              <FontAwesomeIcon icon={faChartLine} className="w-8 h-8 text-marketing-muted/80 mx-auto mb-3" />
              <p className="text-sm text-marketing-muted">No usage data yet</p>
              <p className="text-xs text-marketing-muted/80 mt-1">
                Start using TaskMaster AI CLI to see your usage here
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Plan Status - For non-subscribers */}
      {!hasLicense && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="card-marketing border border-indigo-500/25 bg-indigo-500/5 p-5">
            <div className="flex items-start gap-4">
              <FontAwesomeIcon icon={faCreditCard} className="mt-0.5 h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              <div className="flex-1">
                <h3 className="mb-1 font-medium">Get Started with TaskMaster AI</h3>
                <p className="mb-4 text-sm text-marketing-muted">
                  Subscribe to a plan to start using AI-powered task management
                </p>
                <Link 
                  to="/pricing" 
                  className="btn-marketing-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                >
                  View Plans
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        className="mb-8"
      >
        <h2 className="text-base font-semibold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.href}
              className="card-marketing group flex items-start gap-4 p-5 hover:border-indigo-500/35"
            >
              <FontAwesomeIcon icon={action.icon} className="w-5 h-5 text-marketing-muted mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-medium flex items-center gap-2">
                  {action.title}
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 h-3 text-marketing-muted/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-marketing-muted">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Getting Started */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4, ease: 'easeOut' }}
      >
        <h2 className="text-base font-semibold mb-4">Getting Started</h2>
        <div className="card-marketing p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gsPlan ? 'bg-green-500/20' : 'bg-marketing-elevated'
              }`}>
                {gsPlan ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 text-green-400" />
                ) : (
                  <span className="text-xs font-semibold text-marketing-muted">1</span>
                )}
              </div>
              <div>
                <p className={`text-base font-medium ${gsPlan ? 'text-green-400' : ''}`}>
                  Subscribe to a plan
                </p>
                <p className="text-sm text-marketing-muted">
                  {gsPlan
                    ? `Active: ${licenseInfo?.planName ?? 'Enterprise'} Plan`
                    : 'Choose a plan to get your license key'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gsApiKeys ? 'bg-green-500/20' : 'bg-marketing-elevated'
              }`}>
                {gsApiKeys ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 text-green-400" />
                ) : (
                  <span className="text-xs font-semibold text-marketing-muted">2</span>
                )}
              </div>
              <div>
                <p className={`text-base font-medium ${gsApiKeys ? 'text-green-400' : ''}`}>
                  Add your API keys
                </p>
                <p className="text-sm text-marketing-muted">
                  {gsApiKeys ? 'API key configured' : 'Configure at least one AI provider'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gsModels ? 'bg-green-500/20' : 'bg-marketing-elevated'
              }`}>
                {gsModels ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 text-green-400" />
                ) : (
                  <span className="text-xs font-semibold text-marketing-muted/80">3</span>
                )}
              </div>
              <div>
                <p className={`text-base font-medium ${gsModels ? 'text-green-400' : 'text-marketing-muted'}`}>
                  Configure models
                </p>
                <p className="text-sm text-marketing-muted">
                  {gsModels ? 'Models configured' : 'Select main, research, and fallback models'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gsProject ? 'bg-green-500/20' : 'bg-marketing-elevated'
              }`}>
                {gsProject ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 text-green-400" />
                ) : (
                  <span className="text-xs font-semibold text-marketing-muted/80">4</span>
                )}
              </div>
              <div>
                <p className={`text-base font-medium ${gsProject ? 'text-green-400' : 'text-marketing-muted'}`}>
                  Start a project
                </p>
                <p className="text-sm text-marketing-muted">
                  Run <code className="px-1.5 py-0.5 rounded bg-marketing-elevated text-xs font-mono">taskmaster init</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
