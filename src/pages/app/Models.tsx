import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleExclamation, faMicrochip, faMagnifyingGlass, faBolt } from '@fortawesome/free-solid-svg-icons'

interface ModelConfig {
  main: string
  research: string
  fallback: string
}

const modelOptions = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous gen' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Complex tasks' },
  ],
  perplexity: [
    { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large', description: 'Web search' },
    { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small', description: 'Fast queries' },
  ],
}

const modelRoles = [
  { id: 'main', label: 'Main Model', description: 'Primary operations, PRD parsing, task expansion', icon: faMicrochip, recommended: 'claude-sonnet-4-20250514' },
  { id: 'research', label: 'Research Model', description: 'Web-aware responses with --research flag', icon: faMagnifyingGlass, recommended: 'llama-3.1-sonar-large-128k-online' },
  { id: 'fallback', label: 'Fallback Model', description: 'Used when main model fails or rate limits', icon: faBolt, recommended: 'gpt-4o-mini' },
]

export default function Models() {
  const { user } = useAuth()
  const [config, setConfig] = useState<ModelConfig>({ main: 'claude-sonnet-4-20250514', research: 'llama-3.1-sonar-large-128k-online', fallback: 'gpt-4o-mini' })
  const [, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) loadConfig()
  }, [user])

  const loadConfig = async () => {
    if (!user) return
    try {
      const configRef = doc(db, 'users', user.uid, 'settings', 'models')
      const snapshot = await getDoc(configRef)
      if (snapshot.exists()) setConfig(snapshot.data() as ModelConfig)
    } catch (err) {
      console.error('Error loading config:', err)
    } finally {
      setLoading(false)
    }
  }

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
    for (const [, models] of Object.entries(modelOptions)) {
      const found = models.find((m) => m.id === modelId)
      if (found) return found.name
    }
    return modelId
  }

  const isPro = userData?.plan === 'pro' || userData?.plan === 'team'

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Model Configuration</h1>
        <p className="text-sm text-text-muted">Configure AI models for different operations</p>
      </motion.div>

      {/* Status messages */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-error text-status-error text-sm mb-5">
          <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-success text-status-success text-sm mb-5">
          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 flex-shrink-0" />
          {success}
        </motion.div>
      )}

      {/* Model roles */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="space-y-5">
        {modelRoles.map((role) => (
          <div key={role.id} className="card p-5">
            <div className="flex items-start gap-4 mb-4">
              <FontAwesomeIcon icon={role.icon} className="w-5 h-5 text-text-muted mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-medium">{role.label}</h3>
                <p className="text-sm text-text-muted">{role.description}</p>
              </div>
            </div>

            <div className="relative">
              <select
                value={config[role.id as keyof ModelConfig]}
                onChange={(e) => setConfig((prev) => ({ ...prev, [role.id]: e.target.value }))}
                className="input appearance-none cursor-pointer pr-10 text-sm"
                disabled={!isPro && role.id !== 'main'}
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
                <svg className="w-4 h-4 text-text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <p className="text-xs text-text-subtle mt-2">Recommended: {getModelName(role.recommended)}</p>
          </div>
        ))}
      </motion.div>

      {/* Save button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mt-8 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </motion.div>

      {/* CLI equivalent */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }} className="mt-10">
        <h2 className="text-base font-semibold mb-4">CLI Equivalent</h2>
        <div className="card-elevated overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-surface">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            <span className="text-xs text-text-subtle ml-2 font-mono">terminal</span>
          </div>
          <pre className="p-4 font-mono text-sm overflow-x-auto bg-background text-text-muted">
{`$ task-master models --setup

# Or set individual models:
$ task-master models --set-main ${config.main}
$ task-master models --set-research ${config.research}
$ task-master models --set-fallback ${config.fallback}`}
          </pre>
        </div>
      </motion.div>
    </div>
  )
}
