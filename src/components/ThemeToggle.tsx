import { useTheme } from '../contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { mode, toggleTheme } = useTheme()

  const getIcon = () => {
    switch (mode) {
      case 'light':
        return faSun
      case 'dark':
        return faMoon
      case 'system':
      default:
        return faDesktop
    }
  }

  const getLabel = () => {
    switch (mode) {
      case 'light':
        return 'Light Mode'
      case 'dark':
        return 'Dark Mode'
      case 'system':
      default:
        return 'System'
    }
  }

  const getNextMode = () => {
    switch (mode) {
      case 'system':
        return 'light'
      case 'light':
        return 'dark'
      case 'dark':
      default:
        return 'system'
    }
  }

  if (showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-highlight transition-colors text-sm w-full ${className}`}
        aria-label={`Current: ${getLabel()}. Click to switch to ${getNextMode()} mode`}
        title={`Current: ${getLabel()}. Click to switch to ${getNextMode()} mode`}
      >
        <FontAwesomeIcon icon={getIcon()} className="w-4 h-4" />
        {getLabel()}
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors hover:bg-surface-highlight ${className}`}
      aria-label={`Current: ${getLabel()}. Click to switch to ${getNextMode()} mode`}
      title={`Current: ${getLabel()}. Click to switch to ${getNextMode()} mode`}
    >
      <FontAwesomeIcon 
        icon={getIcon()} 
        className="w-5 h-5 text-text-muted hover:text-text transition-colors" 
      />
    </button>
  )
}

export default ThemeToggle
