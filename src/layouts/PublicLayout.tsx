import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faXmark, faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'
import { faNpm } from '@fortawesome/free-brands-svg-icons'

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8'

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/docs', label: 'Docs' },
]

export default function PublicLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const { mode, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-background/90 backdrop-blur-sm pt-4">
        <nav className="max-w-5xl mx-auto px-4">
          <div className="relative flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="inline-flex items-center gap-2 group">
              <img 
                src={LOGO_URL} 
                alt="TaskMaster AI" 
                className="w-7 h-7 rounded-lg object-contain invert dark:invert-0 flex-shrink-0"
              />
              <span className="pixel-text text-sm leading-none mt-0.5">TASKMASTER AI</span>
            </Link>

            {/* Desktop Navigation - Centered */}
            <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm transition-colors ${
                    location.pathname === link.path
                      ? 'text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-highlight transition-colors"
                aria-label={`Current: ${mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}. Click to switch.`}
              >
                <FontAwesomeIcon 
                  icon={mode === 'system' ? faDesktop : mode === 'dark' ? faMoon : faSun} 
                  className="w-4 h-4" 
                />
              </button>
              
              {user ? (
                <Link to="/app/dashboard" className="btn-primary">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signin" className="btn-ghost">
                    Sign in
                  </Link>
                  <Link to="/signup" className="btn-primary">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center text-text-muted hover:text-text"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-surface relative z-[100]"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-3 py-2.5 rounded-lg text-sm ${
                    location.pathname === link.path
                      ? 'bg-surface-elevated text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 space-y-2">
                {/* Theme Toggle for Mobile */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors text-sm"
                >
                  <FontAwesomeIcon 
                    icon={mode === 'system' ? faDesktop : mode === 'dark' ? faMoon : faSun} 
                    className="w-4 h-4" 
                  />
                  {mode === 'system' ? 'System Theme' : mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </button>
                
                {user ? (
                  <Link
                    to="/app/dashboard"
                    className="btn-primary w-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/signin"
                      className="btn-secondary w-full"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/signup"
                      className="btn-primary w-full"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Mobile menu overlay - click outside to close */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="relative pt-20">
        <Outlet />
      </main>

      {/* Footer - Hidden on docs page */}
      {location.pathname !== '/docs' && (
        <footer className="relative mt-20">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <Link to="/" className="inline-flex items-center gap-2 mb-4">
                  <img 
                    src={LOGO_URL} 
                    alt="TaskMaster AI" 
                    className="w-7 h-7 rounded-lg object-contain invert dark:invert-0 flex-shrink-0"
                  />
                  <span className="pixel-text text-sm leading-none">TASKMASTER AI</span>
                </Link>
                <p className="text-text-muted text-sm max-w-sm">
                  AI-powered task management for developers. Transform PRDs into executable tasks with intelligent breakdown and multi-model support.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><Link to="/pricing" className="text-sm text-text-muted hover:text-text">Pricing</Link></li>
                  <li><Link to="/docs" className="text-sm text-text-muted hover:text-text">Documentation</Link></li>
                  <li><a href="https://www.npmjs.com/package/@taskmasterai/cli" target="_blank" rel="noopener noreferrer" className="text-sm text-text-muted hover:text-text">NPM Package</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><Link to="/privacy" className="text-sm text-text-muted hover:text-text">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="text-sm text-text-muted hover:text-text">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-text-subtle">
                © 2025 TaskMaster AI LLC. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a href="https://www.npmjs.com/package/@taskmasterai/cli" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text transition-colors" title="View on NPM">
                  <FontAwesomeIcon icon={faNpm} className="w-8 h-8" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
