import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faKey,
  faGear,
  faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons'

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
  const { user } = useAuth()

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
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-muted">1</span>
              </div>
              <div>
                <p className="text-base font-medium">Add your API keys</p>
                <p className="text-sm text-text-muted">Configure at least one AI provider</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-subtle">2</span>
              </div>
              <div>
                <p className="text-base font-medium text-text-muted">Configure models</p>
                <p className="text-sm text-text-muted">Select main, research, and fallback models</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-text-subtle">3</span>
              </div>
              <div>
                <p className="text-base font-medium text-text-muted">Start a project</p>
                <p className="text-sm text-text-muted">
                  Run <code className="px-1.5 py-0.5 rounded bg-surface-highlight text-xs font-mono">task-master init</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
