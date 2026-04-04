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
import { TaskMasterAILogo } from '../components/TaskMasterAILogo'

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
  const { user, licenseInfo, logout } = useAuth()
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
        return 'bg-marketing-elevated text-status-success border-status-success'
      case 'pro':
        return 'bg-marketing-elevated border-accent-primary/35 text-accent-primary'
      case 'enterprise':
        return 'bg-marketing-elevated text-status-info border-status-info'
      default:
        return null // No badge when no plan
    }
  }
  
  const getPlanLabel = (plan: string | undefined | null) => {
    if (!plan) return null
    return plan.toUpperCase()
  }

  /** Only after license loads; label from licenseInfo.plan (not stale userData.plan). */
  const showSidebarPlanBadge =
    licenseInfo != null &&
    licenseInfo.hasLicense === true &&
    (licenseInfo.status === 'active' || licenseInfo.status === 'grace_period')

  const sidebarPlanForBadge = licenseInfo?.plan

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all ${
      isActive
        ? 'border-indigo-500/30 bg-indigo-500/10 font-medium text-marketing-link'
        : 'text-marketing-muted hover:bg-marketing-elevated hover:text-marketing-text'
    }`

  return (
    <div className="app-cruip flex min-h-screen bg-marketing-bg font-inter text-marketing-text antialiased">
      {/* Sidebar - Desktop */}
      <aside className="hidden border-r border-marketing-border bg-marketing-surface lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col">
        {/* Logo */}
        <div className="px-4 pb-3 pt-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <TaskMasterAILogo className="h-6 w-6 rounded-md" />
            <span className="pixel-text mt-0.5 text-[11px] leading-none">TASKMASTER AI</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 pb-5 pt-2">
          {sidebarLinks.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={navLinkClass(isActive)}
              >
                <FontAwesomeIcon icon={link.icon} className="h-4 w-4" />
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
              className="flex w-full items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-marketing-elevated"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-marketing-elevated">
                {user?.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="h-8 w-8 rounded-full object-cover"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-medium text-marketing-muted">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium">{user?.displayName || user?.email?.split('@')[0]}</p>
                {showSidebarPlanBadge && getPlanLabel(sidebarPlanForBadge) && (
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${getPlanBadgeStyle(sidebarPlanForBadge)}`}>
                    {getPlanLabel(sidebarPlanForBadge)}
                  </span>
                )}
              </div>
              <FontAwesomeIcon icon={faChevronDown} className={`h-3 w-3 flex-shrink-0 text-marketing-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-marketing-border bg-marketing-elevated shadow-lg"
              >
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-status-error transition-colors hover:bg-marketing-surface"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile header - hidden when sidebar is open */}
      {!sidebarOpen && (
        <div className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 lg:hidden">
          <div className="marketing-pill-border relative flex h-14 items-center justify-between gap-3 rounded-2xl px-3 shadow-lg">
            <Link to="/" className="inline-flex flex-shrink-0 items-center gap-2">
              <TaskMasterAILogo className="h-6 w-6 rounded-md" />
              <span className="pixel-text mt-0.5 text-[11px] leading-none">TASKMASTER AI</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-marketing-muted transition-colors hover:bg-marketing-elevated hover:text-marketing-text"
              aria-label="Open menu"
            >
              <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

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
          className="fixed bottom-0 left-0 top-0 z-50 flex max-h-screen w-60 flex-col border-r border-marketing-border bg-marketing-surface shadow-xl lg:hidden"
        >
          {/* Sidebar header with logo and close button */}
          <div className="flex h-14 flex-shrink-0 items-center justify-between px-4">
            <Link to="/" className="inline-flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
              <TaskMasterAILogo className="h-6 w-6 rounded-md" />
              <span className="pixel-text mt-0.5 text-[11px] leading-none">TASKMASTER AI</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-marketing-muted hover:bg-marketing-elevated hover:text-marketing-text"
              aria-label="Close menu"
            >
              <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {sidebarLinks.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setSidebarOpen(false)}
                  className={navLinkClass(isActive)}
                >
                  <FontAwesomeIcon icon={link.icon} className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex-shrink-0 border-t border-marketing-border p-3 pb-6">
            <div className="flex items-center gap-3 p-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-marketing-elevated">
                {user?.photoURL && !imageError ? (
                  <img 
                    src={user.photoURL} 
                    alt="" 
                    className="h-8 w-8 rounded-full object-cover"
                    onError={() => setImageError(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs font-medium text-marketing-muted">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{user?.displayName || user?.email?.split('@')[0]}</p>
                {showSidebarPlanBadge && getPlanLabel(sidebarPlanForBadge) && (
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${getPlanBadgeStyle(sidebarPlanForBadge)}`}>
                    {getPlanLabel(sidebarPlanForBadge)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-status-error transition-colors hover:bg-marketing-elevated"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </motion.aside>
      )}

      {/* Main content — pt accounts for floating pill header on mobile */}
      <main className="flex-1 overflow-x-hidden pt-24 lg:pl-60 lg:pt-0">
        <div className="min-h-screen w-full max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
