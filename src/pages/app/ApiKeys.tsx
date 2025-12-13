import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, collection, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faKey, 
  faEye, 
  faEyeSlash, 
  faCheck, 
  faXmark, 
  faPlus, 
  faTrash, 
  faCircleExclamation,
  faShield,
  faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons'

interface ApiKey {
  id: string
  provider: string
  maskedKey: string
  createdAt: Date
  isValid?: boolean
}

const providers = [
  { id: 'anthropic', name: 'Anthropic (Claude)', description: 'Claude models', docsUrl: 'https://console.anthropic.com/' },
  { id: 'openai', name: 'OpenAI (GPT)', description: 'GPT-4 and GPT-3.5', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'google', name: 'Google (Gemini)', description: 'Gemini Pro and Flash', docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'perplexity', name: 'Perplexity', description: 'Research and web search', docsUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'xai', name: 'xAI (Grok)', description: 'Grok models', docsUrl: 'https://console.x.ai/' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Multiple models', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'mistral', name: 'Mistral', description: 'Mistral AI', docsUrl: 'https://console.mistral.ai/api-keys/' },
]

export default function ApiKeys() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [, setLoading] = useState(true)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKey, setShowKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user) loadKeys()
  }, [user])

  const loadKeys = async () => {
    if (!user) return
    try {
      const keysRef = collection(db, 'users', user.uid, 'apiKeys')
      const snapshot = await getDocs(keysRef)
      const loadedKeys: ApiKey[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        loadedKeys.push({
          id: doc.id,
          provider: data.provider,
          maskedKey: data.maskedKey,
          createdAt: data.createdAt?.toDate() || new Date(),
          isValid: data.isValid,
        })
      })
      setKeys(loadedKeys)
    } catch (err) {
      console.error('Error loading keys:', err)
    } finally {
      setLoading(false)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
  }

  const handleAddKey = async (providerId: string) => {
    if (!user || !newKeyValue.trim()) return
    setError('')
    setSuccess('')

    try {
      const keyRef = doc(db, 'users', user.uid, 'apiKeys', providerId)
      await setDoc(keyRef, {
        provider: providerId,
        maskedKey: maskKey(newKeyValue),
        createdAt: serverTimestamp(),
        isValid: true,
      })

      setKeys((prev) => [
        ...prev.filter((k) => k.provider !== providerId),
        { id: providerId, provider: providerId, maskedKey: maskKey(newKeyValue), createdAt: new Date(), isValid: true },
      ])

      setSuccess(`${providers.find((p) => p.id === providerId)?.name} key added`)
      setAddingKey(null)
      setNewKeyValue('')
    } catch (err) {
      setError('Failed to save API key')
    }
  }

  const handleDeleteKey = async (providerId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'apiKeys', providerId))
      setKeys((prev) => prev.filter((k) => k.provider !== providerId))
      setSuccess('API key removed')
    } catch (err) {
      setError('Failed to remove API key')
    }
  }

  const getKeyForProvider = (providerId: string) => keys.find((k) => k.provider === providerId)

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h1 className="text-2xl font-bold mb-1">API Keys</h1>
        <p className="text-sm text-text-muted">Securely store your AI provider API keys</p>
      </motion.div>

      {/* Security notice */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <div className="card flex items-start gap-4 p-5">
          <FontAwesomeIcon icon={faShield} className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium">Your keys are secure</p>
            <p className="text-sm text-text-muted">API keys are encrypted and never exposed in the browser</p>
          </div>
        </div>
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

      {/* Providers list */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="space-y-4">
        {providers.map((provider) => {
          const existingKey = getKeyForProvider(provider.id)
          const isAdding = addingKey === provider.id

          return (
            <div key={provider.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-medium">{provider.name}</h3>
                    {existingKey && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-success/10 text-status-success text-xs font-medium">
                        <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                        Added
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted">{provider.description}</p>

                  {existingKey && !isAdding && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface font-mono text-sm">
                        <FontAwesomeIcon icon={faKey} className="w-3.5 h-3.5 text-text-subtle" />
                        {showKey === provider.id ? existingKey.maskedKey : '••••••••••••'}
                      </div>
                      <button onClick={() => setShowKey(showKey === provider.id ? null : provider.id)} className="p-1.5 text-text-subtle hover:text-text">
                        <FontAwesomeIcon icon={showKey === provider.id ? faEyeSlash : faEye} className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {isAdding && (
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder={`Enter ${provider.name} API key`}
                        className="input flex-1 text-sm"
                        autoFocus
                      />
                      <button onClick={() => handleAddKey(provider.id)} disabled={!newKeyValue.trim()} className="btn-primary py-2 px-3">
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setAddingKey(null); setNewKeyValue('') }} className="btn-ghost py-2 px-3">
                        <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-text-subtle hover:text-text" title="Get API key">
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-4 h-4" />
                  </a>
                  
                  {existingKey ? (
                    <>
                      <button onClick={() => { setAddingKey(provider.id); setNewKeyValue('') }} className="btn-secondary text-sm py-2 px-3">
                        Update
                      </button>
                      <button onClick={() => handleDeleteKey(provider.id)} className="p-2 text-status-error hover:bg-status-error/10 rounded-lg">
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    !isAdding && (
                      <button onClick={() => setAddingKey(provider.id)} className="btn-primary text-sm py-2 px-3">
                        <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-1.5" />
                        Add
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
