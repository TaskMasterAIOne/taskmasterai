import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faGauge, 
  faKey, 
  faMicrochip, 
  faGear,
  faRightFromBracket,
  faBars,
  faXmark,
  faChevronDown,
  faListCheck
} from '@fortawesome/free-solid-svg-icons'

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8'

const sidebarLinks = [
  { path: '/app/dashboard', label: 'Dashboard', icon: faGauge },
  { path: '/app/tasks', label: 'Tasks', icon: faListCheck },
  { path: '/app/api-keys', label: 'API Keys', icon: faKey },
  { path: '/app/models', label: 'Models', icon: faMicrochip },
  { path: '/app/settings', label: 'Settings', icon: faGear },
]

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, userData, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const getPlanBadgeStyle = (plan: string | undefined | null) => {
    switch (plan) {
      case 'plus':
        return 'bg-surface-elevated text-status-success border-status-success'
      case 'pro':
        return 'bg-surface-elevated text-accent border-accent'
      case 'enterprise':
        return 'bg-surface-elevated text-status-info border-status-info'
      default:
        return null // No badge when no plan
    }
  }
  
  const getPlanLabel = (plan: string | undefined | null) => {
    if (!plan) return null
    return plan.toUpperCase()
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-surface">
        {/* Logo */}
        <div className="pt-6 pb-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src={LOGO_URL} 
              alt="TaskMaster AI" 
              className="w-6 h-6 rounded-md object-contain invert dark:invert-0"
            />
            <span className="pixel-text text-[11px]">TASKMASTER AI</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-2 pb-5 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-surface-highlight text-text'
                    : 'text-text-muted hover:text-text hover:bg-surface-elevated'
                }`}
              >
                <FontAwesomeIcon icon={link.icon} className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-surface-highlight flex items-center justify-center overflow-hidden">
                {user?.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="w-8 h-8 rounded-full object-cover"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-medium text-text-muted">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-medium truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                {getPlanLabel(userData?.plan) && (
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${getPlanBadgeStyle(userData?.plan)}`}>
                    {getPlanLabel(userData?.plan)}
                  </span>
                )}
              </div>
              <FontAwesomeIcon icon={faChevronDown} className={`w-3 h-3 text-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-surface-elevated border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-status-error hover:bg-surface transition-colors"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-surface z-50 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src={LOGO_URL} 
            alt="TaskMaster AI" 
            className="w-6 h-6 rounded-md object-contain invert dark:invert-0 mt-0.5"
          />
          <span className="pixel-text text-[11px]">TASKMASTER AI</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-text-muted hover:text-text"
        >
          <FontAwesomeIcon icon={sidebarOpen ? faXmark : faBars} className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="lg:hidden fixed inset-y-0 left-0 w-60 bg-surface z-50 flex flex-col pt-14"
        >
          <nav className="flex-1 px-3 py-5 space-y-1">
            {sidebarLinks.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-surface-highlight text-text'
                      : 'text-text-muted hover:text-text hover:bg-surface-elevated'
                  }`}
                >
                  <FontAwesomeIcon icon={link.icon} className="w-4 h-4" />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="p-3">
            <div className="flex items-center gap-3 p-2.5">
              <div className="w-8 h-8 rounded-full bg-surface-highlight flex items-center justify-center overflow-hidden">
                {user?.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="w-8 h-8 rounded-full object-cover"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-medium text-text-muted">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                {getPlanLabel(userData?.plan) && (
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${getPlanBadgeStyle(userData?.plan)}`}>
                    {getPlanLabel(userData?.plan)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm text-status-error hover:bg-surface-elevated transition-colors"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </motion.aside>
      )}

      {/* Main content */}
      <main className="flex-1 lg:pl-60 pt-14 lg:pt-0">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
