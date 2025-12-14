import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
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
    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Most powerful' },
    { id: 'claude-4.1-opus', name: 'Claude 4.1 Opus', description: 'Advanced reasoning' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Best balance' },
    { id: 'claude-sonnet-4.5-reasoning', name: 'Claude Sonnet 4.5 (Reasoning)', description: 'Enhanced reasoning' },
    { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', description: 'High capability' },
    { id: 'claude-4-sonnet-reasoning', name: 'Claude 4 Sonnet (Reasoning)', description: 'With reasoning' },
    { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', description: 'Previous gen' },
    { id: 'claude-3.7-sonnet-reasoning', name: 'Claude 3.7 Sonnet (Reasoning)', description: 'With reasoning' },
    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', description: 'Fast & efficient' },
    { id: 'claude-haiku-4.5-reasoning', name: 'Claude Haiku 4.5 (Reasoning)', description: 'Fast with reasoning' },
  ],
  openai: [
    { id: 'gpt-5', name: 'GPT 5', description: 'Most capable' },
    { id: 'gpt-5-reasoning', name: 'GPT 5 (Reasoning)', description: 'With reasoning' },
    { id: 'gpt-5.2-instant', name: 'GPT 5.2 (Instant)', description: 'Fast responses' },
    { id: 'gpt-5.2-reasoning', name: 'GPT 5.2 (Reasoning)', description: 'Enhanced reasoning' },
    { id: 'gpt-5.1-instant', name: 'GPT 5.1 (Instant)', description: 'Quick tasks' },
    { id: 'gpt-5.1-reasoning', name: 'GPT 5.1 (Reasoning)', description: 'Reasoning mode' },
    { id: 'gpt-5-mini', name: 'GPT 5 Mini', description: 'Compact & fast' },
    { id: 'gpt-5-nano', name: 'GPT 5 Nano', description: 'Ultra light' },
    { id: 'gpt-4.1', name: 'GPT 4.1', description: 'Stable release' },
    { id: 'gpt-4.1-mini', name: 'GPT 4.1 Mini', description: 'Cost-effective' },
    { id: 'gpt-4.1-nano', name: 'GPT 4.1 Nano', description: 'Lightweight' },
    { id: 'gpt-4o', name: 'GPT 4o', description: 'Multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT 4o Mini', description: 'Fast multimodal' },
    { id: 'o3-mini', name: 'O3 Mini', description: 'Reasoning model' },
    { id: 'o3-pro', name: 'O3 Pro', description: 'Advanced reasoning' },
    { id: 'o4-mini', name: 'O4 Mini', description: 'Latest reasoning' },
    { id: 'gpt-oss-20b', name: 'GPT OSS 20B', description: 'Open source' },
    { id: 'gpt-oss-120b', name: 'GPT OSS 120B', description: 'Large open source' },
  ],
  google: [
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Most powerful' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced tasks' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & capable' },
    { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', description: 'With reasoning' },
    { id: 'gemini-2.5-flash-lite-thinking', name: 'Gemini 2.5 Flash Lite (Thinking)', description: 'Light reasoning' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight' },
  ],
  deepseek: [
    { id: 'deepseek-v3', name: 'DeepSeek V3', description: 'Latest version' },
    { id: 'deepseek-v3.2-exp', name: 'DeepSeek V3.2 Exp', description: 'Experimental' },
    { id: 'deepseek-v3.2-exp-thinking', name: 'DeepSeek V3.2 Exp (Thinking)', description: 'With reasoning' },
    { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', description: 'Stable release' },
    { id: 'deepseek-v3.1-thinking', name: 'DeepSeek V3.1 (Thinking)', description: 'With reasoning' },
    { id: 'deepseek-v3.1-terminus', name: 'DeepSeek V3.1 Terminus', description: 'Terminal mode' },
    { id: 'deepseek-v3.1-terminus-thinking', name: 'DeepSeek V3.1 Terminus (Thinking)', description: 'Terminal reasoning' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning focused' },
  ],
  xai: [
    { id: 'grok-4', name: 'Grok 4', description: 'Latest Grok' },
    { id: 'grok-4-fast', name: 'Grok 4 Fast', description: 'Quick responses' },
    { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast (Reasoning)', description: 'Fast reasoning' },
    { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast', description: 'Updated fast' },
    { id: 'grok-4.1-fast-reasoning', name: 'Grok 4.1 Fast (Reasoning)', description: 'Updated reasoning' },
    { id: 'grok-3', name: 'Grok 3', description: 'Previous gen' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Compact' },
  ],
  meta: [
    { id: 'llama-4-maverick', name: 'Llama 4 Maverick', description: 'Most capable' },
    { id: 'llama-4-scout', name: 'Llama 4 Scout', description: 'Efficient' },
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Large model' },
  ],
  zhipu: [
    { id: 'glm-4.6', name: 'GLM 4.6', description: 'Latest GLM' },
    { id: 'glm-4.6-thinking', name: 'GLM 4.6 (Thinking)', description: 'With reasoning' },
    { id: 'glm-4.5', name: 'GLM 4.5', description: 'Standard' },
    { id: 'glm-4.5-thinking', name: 'GLM 4.5 (Thinking)', description: 'With reasoning' },
    { id: 'glm-4.5-air', name: 'GLM 4.5 Air', description: 'Lightweight' },
    { id: 'glm-4.5-air-thinking', name: 'GLM 4.5 Air (Thinking)', description: 'Light reasoning' },
    { id: 'glm-4.5v', name: 'GLM 4.5V', description: 'Vision model' },
    { id: 'glm-4.5v-thinking', name: 'GLM 4.5V (Thinking)', description: 'Vision reasoning' },
  ],
  moonshot: [
    { id: 'kimi-k2', name: 'Kimi K2', description: 'Latest Kimi' },
    { id: 'kimi-k2-thinking', name: 'Kimi K2 (Thinking)', description: 'With reasoning' },
  ],
  perplexity: [
    // Search Models - Quick information retrieval and synthesis
    { id: 'sonar', name: 'Sonar', description: 'Lightweight search with grounding' },
    { id: 'sonar-pro', name: 'Sonar Pro', description: 'Advanced search, complex queries' },
    // Reasoning Models - Complex multi-step problem solving
    { id: 'sonar-reasoning', name: 'Sonar Reasoning', description: 'Real-time reasoning with search' },
    { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', description: 'DeepSeek-R1 powered CoT' },
    // Research Models - In-depth analysis and reports
    { id: 'sonar-deep-research', name: 'Sonar Deep Research', description: 'Expert-level comprehensive research' },
  ],
}

const modelRoles = [
  { id: 'main', label: 'Main Model', description: 'Primary operations, PRD parsing, task expansion', icon: faMicrochip, recommended: 'claude-sonnet-4.5' },
  { id: 'research', label: 'Research Model', description: 'Web-aware responses with --research flag', icon: faMagnifyingGlass, recommended: 'sonar-pro' },
  { id: 'fallback', label: 'Fallback Model', description: 'Used when main model fails or rate limits', icon: faBolt, recommended: 'gemini-2.5-flash' },
]

export default function Models() {
  const { user } = useAuth()
  const [config, setConfig] = useState<ModelConfig>({ main: 'claude-sonnet-4.5', research: 'sonar-pro', fallback: 'gemini-2.5-flash' })
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
    for (const [, models] of Object.entries(modelOptions)) {
      const found = models.find((m) => m.id === modelId)
      if (found) return found.name
    }
    return modelId
  }

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
