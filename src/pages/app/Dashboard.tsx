import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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

const USAGE_API_URL = 'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/getUsageStats'

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

  const hasLicense = licenseInfo?.hasLicense

  // Fetch usage stats for paid users
  useEffect(() => {
    async function fetchUsageStats() {
      if (!user?.uid || !hasLicense) return

      setLoadingUsage(true)
      setUsageError(null)

      try {
        const response = await fetch(USAGE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        })

        const data = await response.json()

        if (data.success) {
          setUsageData(data)
        } else {
          setUsageError(data.error || 'Failed to load usage stats')
        }
      } catch (err) {
        setUsageError('Failed to connect to server')
      } finally {
        setLoadingUsage(false)
      }
    }

    fetchUsageStats()
  }, [user?.uid, hasLicense])

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
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold mb-1">
          Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-text-muted">
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
            <FontAwesomeIcon icon={faChartLine} className="w-4 h-4 text-accent" />
            Usage This Month
          </h2>

          {loadingUsage ? (
            <div className="card p-8 flex items-center justify-center">
              <FontAwesomeIcon icon={faSpinner} className="w-5 h-5 animate-spin text-text-muted" />
              <span className="ml-3 text-text-muted">Loading usage data...</span>
            </div>
          ) : usageError ? (
            <div className="card p-5 bg-red-500/5 border-red-500/20">
              <p className="text-sm text-red-400">{usageError}</p>
            </div>
          ) : usageData?.stats ? (
            <div className="space-y-4">
              {/* Main usage card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-3xl font-bold">{usageData.stats.tasksUsed}</p>
                    <p className="text-sm text-text-muted">tasks used this month</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-text-secondary">
                      {usageData.stats.tasksPerMonth > 0 
                        ? usageData.stats.tasksPerMonth.toLocaleString() 
                        : 'Unlimited'}
                    </p>
                    <p className="text-sm text-text-muted">included in plan</p>
                  </div>
                </div>

                {/* Progress bar */}
                {usageData.stats.tasksPerMonth > 0 && (
                  <>
                    <div className="w-full h-3 bg-surface-highlight rounded-full overflow-hidden">
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
                    <div className="flex justify-between mt-2 text-xs text-text-muted">
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
                <div className="card p-5">
                  <h3 className="text-sm font-medium mb-3">Usage by Operation</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(usageData.operationBreakdown)
                      .filter(([op]) => op !== 'unknown')
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([operation, count]) => (
                        <div key={operation} className="p-3 bg-surface-highlight rounded-lg">
                          <p className="text-lg font-semibold">{count}</p>
                          <p className="text-xs text-text-muted truncate">{formatOperationName(operation)}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Recent activity */}
              {usageData.recentActivity && usageData.recentActivity.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
                  <div className="space-y-2">
                    {usageData.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <FontAwesomeIcon icon={faTerminal} className="w-3 h-3 text-text-subtle" />
                          <span className="text-sm">{formatOperationName(activity.operation)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-text-muted">
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
            <div className="card p-5 text-center">
              <FontAwesomeIcon icon={faChartLine} className="w-8 h-8 text-text-subtle mx-auto mb-3" />
              <p className="text-sm text-text-muted">No usage data yet</p>
              <p className="text-xs text-text-subtle mt-1">
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
          <div className="card p-5 border-accent/30 bg-accent/5">
            <div className="flex items-start gap-4">
              <FontAwesomeIcon icon={faCreditCard} className="w-5 h-5 text-accent mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium mb-1">Get Started with TaskMaster AI</h3>
                <p className="text-sm text-text-muted mb-4">
                  Subscribe to a plan to start using AI-powered task management
                </p>
                <Link 
                  to="/app/billing" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  View Plans
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 h-3" />
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
              className="card group hover:border-border-light flex items-start gap-4 p-5"
            >
              <FontAwesomeIcon icon={action.icon} className="w-5 h-5 text-text-muted mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-medium flex items-center gap-2">
                  {action.title}
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 h-3 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-text-muted">{action.description}</p>
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
        <div className="card p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                hasLicense ? 'bg-green-500/20' : 'bg-surface-highlight'
              }`}>
                {hasLicense ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 text-green-400" />
                ) : (
                  <span className="text-xs font-semibold text-text-muted">1</span>
                )}
              </div>
              <div>
                <p className={`text-base font-medium ${hasLicense ? 'text-green-400' : ''}`}>
                  Subscribe to a plan
                </p>
                <p className="text-sm text-text-muted">
                  {hasLicense 
                    ? `Active: ${licenseInfo?.planName} Plan`
                    : 'Choose a plan to get your license key'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-muted">2</span>
              </div>
              <div>
                <p className="text-base font-medium">Add your API keys</p>
                <p className="text-sm text-text-muted">Configure at least one AI provider</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-subtle">3</span>
              </div>
              <div>
                <p className="text-base font-medium text-text-muted">Configure models</p>
                <p className="text-sm text-text-muted">Select main, research, and fallback models</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-subtle">4</span>
              </div>
              <div>
                <p className="text-base font-medium text-text-muted">Start a project</p>
                <p className="text-sm text-text-muted">
                  Run <code className="px-1.5 py-0.5 rounded bg-surface-highlight text-xs font-mono">taskmaster init</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
