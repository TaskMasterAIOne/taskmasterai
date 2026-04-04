import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleExclamation, faMicrochip, faMagnifyingGlass, faBolt } from '@fortawesome/free-solid-svg-icons'
import supportedModelsCatalog from '@cli-supported-models'

interface ModelConfig {
  main: string
  research: string
  fallback: string
}

type CatalogModel = {
  id: string
  name: string
  description: string
  supported?: boolean
}

const supportedModelsRaw = supportedModelsCatalog as Record<string, CatalogModel[]>

const modelOptions = Object.fromEntries(
  Object.entries(supportedModelsRaw).map(([provider, models]) => [
    provider,
    models.filter((m) => m.supported !== false).map((m) => ({ id: m.id, name: m.name, description: m.description })),
  ])
) as Record<string, { id: string; name: string; description: string }[]>

const modelRoles = [
  { id: 'main', label: 'Main Model', description: 'Primary operations, PRD parsing, task expansion', icon: faMicrochip, recommended: 'claude-sonnet-4-6' },
  { id: 'research', label: 'Research Model', description: 'Web-aware responses with --research flag', icon: faMagnifyingGlass, recommended: 'sonar-pro' },
  { id: 'fallback', label: 'Fallback Model', description: 'Used when main model fails or rate limits', icon: faBolt, recommended: 'gemini-2.5-flash' },
]

export default function Models() {
  const { user } = useAuth()
  const [config, setConfig] = useState<ModelConfig>({ main: 'claude-sonnet-4-6', research: 'sonar-pro', fallback: 'gemini-2.5-flash' })
  const [, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Real-time listener for model configuration
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const configRef = doc(db, 'users', user.uid, 'settings', 'models')
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as ModelConfig)
      }
      setLoading(false)
    }, (err) => {
      console.error('Error loading config:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const configRef = doc(db, 'users', user.uid, 'settings', 'models')
      await setDoc(configRef, config)
      setSuccess('Configuration saved')
    } catch (err) {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getModelName = (modelId: string) => {
    for (const models of Object.values(supportedModelsRaw)) {
      const found = models.find((m) => m.id === modelId)
      if (found) return found.name
    }
    return modelId
  }

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden p-4 sm:p-5 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-6 sm:mb-8">
        <h1 className="marketing-gradient-text font-display mb-1 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">Model Configuration</h1>
        <p className="text-open-sm text-marketing-muted">Configure AI models for different operations</p>
      </motion.div>

      {/* Status messages */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-marketing-elevated border border-status-error text-status-error text-sm mb-5">
          <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-marketing-elevated border border-status-success text-status-success text-sm mb-5">
          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 flex-shrink-0" />
          {success}
        </motion.div>
      )}

      {/* Model roles */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="space-y-4 sm:space-y-5">
        {modelRoles.map((role) => (
          <div key={role.id} className="card-marketing p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <FontAwesomeIcon icon={role.icon} className="w-5 h-5 text-marketing-muted mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium">{role.label}</h3>
                <p className="text-xs sm:text-sm text-marketing-muted">{role.description}</p>
              </div>
            </div>

            <div className="relative">
              <select
                value={config[role.id as keyof ModelConfig]}
                onChange={(e) => setConfig((prev) => ({ ...prev, [role.id]: e.target.value }))}
                className="input appearance-none cursor-pointer pr-10 text-xs sm:text-sm w-full"
              >
                {Object.entries(modelOptions).map(([provider, models]) => (
                  <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-marketing-muted/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <p className="text-xs text-marketing-muted/80 mt-2">Recommended: {getModelName(role.recommended)}</p>
          </div>
        ))}
      </motion.div>

      {/* Save button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mt-8 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-marketing-primary">
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </motion.div>

      {/* CLI equivalent */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }} className="mt-8 sm:mt-10">
        <h2 className="text-base font-semibold mb-4">CLI Equivalent</h2>
        <div className="card-marketing overflow-hidden border">
          <div className="flex items-center gap-2 bg-marketing-elevated px-3 py-3 sm:px-4">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            <span className="text-xs text-marketing-muted/80 ml-2 font-mono">terminal</span>
          </div>
          <pre className="overflow-x-auto bg-marketing-bg p-3 font-mono text-xs text-marketing-muted sm:p-4 sm:text-sm">
{`$ taskmaster models --setup

# Or set individual models:
$ taskmaster models --set-main ${config.main}
$ taskmaster models --set-research ${config.research}
$ taskmaster models --set-fallback ${config.fallback}`}
          </pre>
        </div>
      </motion.div>
    </div>
  )
}
