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

// Provider logos as inline SVG components
const ProviderLogos: { [key: string]: React.ReactNode } = {
  anthropic: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918Zm-10.608 0L0 20.459h3.744l1.37-3.553h6.478l1.37 3.553h3.744L10.008 3.541H6.696Zm.422 10.592 2.247-5.822 2.247 5.822h-4.494Z"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  perplexity: (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z" fill="#22B8CD" fillRule="nonzero"/>
    </svg>
  ),
  xai: (
    <svg viewBox="0 0 841.89 595.28" className="w-6 h-6" fill="currentColor">
      <polygon points="557.09,211.99 565.4,538.36 631.96,538.36 640.28,93.18"/>
      <polygon points="640.28,56.91 538.72,56.91 379.35,284.53 430.13,357.05"/>
      <polygon points="201.61,538.36 303.17,538.36 353.96,465.84 303.17,393.31"/>
      <polygon points="201.61,211.99 430.13,538.36 531.69,538.36 303.17,211.99"/>
    </svg>
  ),
  openrouter: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" fillRule="evenodd">
      <path d="M16.804 1.957l7.22 4.105v.087L16.73 10.21l.017-2.117-.821-.03c-1.059-.028-1.611.002-2.268.11-1.064.175-2.038.577-3.147 1.352L8.345 11.03c-.284.195-.495.336-.68.455l-.515.322-.397.234.385.23.53.338c.476.314 1.17.796 2.701 1.866 1.11.775 2.083 1.177 3.147 1.352l.3.045c.694.091 1.375.094 2.825.033l.022-2.159 7.22 4.105v.087L16.589 22l.014-1.862-.635.022c-1.386.042-2.137.002-3.138-.162-1.694-.28-3.26-.926-4.881-2.059l-2.158-1.5a21.997 21.997 0 00-.755-.498l-.467-.28a55.927 55.927 0 00-.76-.43C2.908 14.73.563 14.116 0 14.116V9.888l.14.004c.564-.007 2.91-.622 3.809-1.124l1.016-.58.438-.274c.428-.28 1.072-.726 2.686-1.853 1.621-1.133 3.186-1.78 4.881-2.059 1.152-.19 1.974-.213 3.814-.138l.02-1.907z"/>
    </svg>
  ),
  mistral: (
    <svg viewBox="0 0 129 91" className="w-5 h-5" style={{ fillRule: 'evenodd', clipRule: 'evenodd' }}>
      <rect x="18.292" y="0" width="18.293" height="18.123" fill="#ffd800"/>
      <rect x="91.473" y="0" width="18.293" height="18.123" fill="#ffd800"/>
      <rect x="18.292" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
      <rect x="73.181" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
      <rect x="18.292" y="36.243" width="91.476" height="18.122" fill="#ff8205"/>
      <rect x="18.292" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="54.883" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="91.473" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="0" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
      <rect x="73.181" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
    </svg>
  ),
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
        fullKey: newKeyValue.trim(), // Store full key for CLI sync
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
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Provider Logo */}
                  <div className="w-10 h-10 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0 text-text-secondary">
                    {ProviderLogos[provider.id]}
                  </div>
                  
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
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleAddKey(provider.id) }}
                      className="flex items-center gap-2 mt-3"
                    >
                      <input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder={`Enter ${provider.name} API key`}
                        className="input flex-1 text-sm"
                        autoComplete="off"
                        autoFocus
                      />
                      <button type="submit" disabled={!newKeyValue.trim()} className="btn-primary py-2 px-3">
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => { setAddingKey(null); setNewKeyValue('') }} className="btn-ghost py-2 px-3">
                        <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
                      </button>
                    </form>
                  )}
                  </div>
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
