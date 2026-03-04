import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faBook, faTag } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../contexts/ThemeContext'
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8'

export default function NotFound() {
  const { mode, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm pt-4">
        <nav className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src={LOGO_URL} 
                alt="TaskMaster AI" 
                className="w-7 h-7 rounded-lg object-contain invert dark:invert-0"
              />
              <span className="pixel-text text-sm mt-0.5">TASKMASTER AI</span>
            </Link>

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
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center max-w-md"
        >
          {/* 404 Number */}
          <div className="text-[8rem] md:text-[10rem] font-bold leading-none shimmer-heading select-none">
            404
          </div>

          {/* Message */}
          <h1 className="text-xl md:text-2xl font-semibold text-text mb-3 mt-6">
            Page Not Found
          </h1>
          <p className="text-text-muted mb-8">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>

          {/* Primary CTA */}
          <Link to="/" className="btn-primary text-base px-6 py-3 inline-flex items-center gap-2">
            <FontAwesomeIcon icon={faHome} className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Secondary Links */}
          <div className="flex items-center justify-center gap-6 mt-8">
            <Link 
              to="/docs" 
              className="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faBook} className="w-4 h-4" />
              Documentation
            </Link>
            <Link 
              to="/pricing" 
              className="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTag} className="w-4 h-4" />
              Pricing
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-sm text-text-subtle">
          © 2026 TaskMaster AI LLC. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
