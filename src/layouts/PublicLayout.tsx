import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faNpm } from '@fortawesome/free-brands-svg-icons'
import { faBars, faXmark, faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'
import { TaskMasterAILogo } from '../components/TaskMasterAILogo'

const NPM_CLI = 'https://www.npmjs.com/package/@taskmasterai/cli'

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

  const linkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'text-marketing-text'
        : 'text-marketing-muted hover:text-marketing-link'
    }`

  const footerLinkClass =
    'text-sm text-marketing-muted transition hover:text-marketing-link'
  const footerHeadingClass = 'mb-4 text-sm font-semibold text-marketing-text'

  return (
    <div className="min-h-screen bg-marketing-bg text-marketing-text supports-[overflow:clip]:overflow-clip">
      <header className="fixed top-0 left-0 right-0 z-[100] px-4 pt-4 sm:pt-5">
        <nav className="mx-auto max-w-6xl">
          <div className="marketing-pill-border relative flex h-14 items-center justify-between gap-3 rounded-2xl px-3 shadow-lg">
            <Link to="/" className="inline-flex flex-shrink-0 items-center gap-2">
              <TaskMasterAILogo className="h-7 w-7 rounded-lg" />
              <span className="pixel-text mt-0.5 text-[10px] leading-none sm:text-[11px]">TASKMASTER AI</span>
            </Link>

            <div className="absolute left-1/2 hidden -translate-x-1/2 md:flex md:items-center md:gap-8">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} className={linkClass(link.path)}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-marketing-muted transition-colors hover:bg-marketing-elevated/80 hover:text-marketing-text"
                aria-label={`Theme: ${mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}`}
              >
                <FontAwesomeIcon
                  icon={mode === 'system' ? faDesktop : mode === 'dark' ? faMoon : faSun}
                  className="h-4 w-4"
                />
              </button>
              {user ? (
                <Link to="/app/dashboard" className="btn-marketing-primary !py-[7px] text-sm">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signin" className="btn-marketing-secondary !py-[7px] text-sm">
                    Sign in
                  </Link>
                  <Link to="/signup" className="btn-marketing-primary !py-[7px] text-sm">
                    Get Started
                  </Link>
                </>
              )}
            </div>

            <button
              type="button"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-marketing-muted hover:bg-marketing-elevated/80 hover:text-marketing-text md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Menu"
            >
              <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-3 max-w-6xl rounded-xl border border-marketing-border bg-marketing-surface p-4 shadow-xl md:hidden"
          >
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block rounded-lg px-3 py-2.5 text-sm ${
                    location.pathname === link.path
                      ? 'bg-marketing-elevated text-marketing-text'
                      : 'text-marketing-muted hover:bg-marketing-elevated/60 hover:text-marketing-text'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 space-y-2 pt-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-marketing-muted hover:bg-marketing-elevated/60"
              >
                <FontAwesomeIcon
                  icon={mode === 'system' ? faDesktop : mode === 'dark' ? faMoon : faSun}
                  className="h-4 w-4 flex-shrink-0"
                />
                {mode === 'system' ? 'System theme' : mode === 'dark' ? 'Dark' : 'Light'}
              </button>
              {user ? (
                <Link
                  to="/app/dashboard"
                  className="btn-marketing-primary block w-full py-2.5 text-center text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="btn-marketing-secondary block w-full py-2.5 text-center text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="btn-marketing-primary block w-full py-2.5 text-center text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </header>

      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="relative pt-24 sm:pt-28">
        <Outlet />
      </main>

      {location.pathname !== '/docs' && (
        <footer className="relative mt-16 md:mt-20">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              <div className="md:col-span-2">
                <Link to="/" className="mb-4 inline-flex flex-shrink-0 items-center gap-2">
                  <TaskMasterAILogo className="h-7 w-7 rounded-lg" />
                  <span className="pixel-text mt-0.5 text-sm leading-none">TASKMASTER AI</span>
                </Link>
                <p className="max-w-sm text-sm text-marketing-muted">
                  AI-powered task management for developers. Transform PRDs into executable tasks with intelligent breakdown
                  and multi-model support.
                </p>
              </div>

              <div>
                <h3 className={footerHeadingClass}>Product</h3>
                <ul className="space-y-2">
                  <li>
                    <Link className={footerLinkClass} to="/pricing">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link className={footerLinkClass} to="/docs">
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <a className={footerLinkClass} href={NPM_CLI} target="_blank" rel="noopener noreferrer">
                      NPM Package
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className={footerHeadingClass}>Legal</h3>
                <ul className="space-y-2">
                  <li>
                    <Link className={footerLinkClass} to="/privacy">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link className={footerLinkClass} to="/terms">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 pt-8 md:flex-row md:justify-between">
              <p className="text-sm text-marketing-muted">© 2026 TaskMaster AI LLC. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <a
                  className="text-marketing-muted transition-colors hover:text-marketing-text"
                  href={NPM_CLI}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on NPM"
                  aria-label="@taskmasterai/cli on npm"
                >
                  <FontAwesomeIcon icon={faNpm} className="h-10 w-10" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
