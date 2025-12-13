import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faStar, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../contexts/AuthContext'
import { createCheckout, PlanType } from '../lib/stripe'

const tiers = [
  {
    id: 'plus' as PlanType,
    name: 'Plus',
    price: 29,
    priceLabel: '$29',
    priceSuffix: '/mo',
    description: 'For individual developers getting started with AI-powered task management.',
    features: [
      'Up to 100 tasks/month',
      '$0.20 per extra task',
      'Secure API key vault',
      'All AI providers supported',
      'Task expansion & analysis',
      'Research mode',
      'Email support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'pro' as PlanType,
    name: 'Pro',
    price: 199,
    priceLabel: '$199',
    priceSuffix: '/mo',
    description: 'For professional developers and power users with higher volume needs.',
    features: [
      'Up to 1,000 tasks/month',
      '$0.15 per extra task',
      'Everything in Plus',
      'Priority support',
      'Advanced analytics',
      'Model switching',
      'Usage insights',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    id: 'enterprise' as PlanType,
    name: 'Enterprise',
    price: 599,
    priceLabel: '$599',
    priceSuffix: '+',
    description: 'For teams and organizations with high-volume requirements.',
    features: [
      '5,000+ tasks/month',
      'Volume discounts available',
      'Everything in Pro',
      'Dedicated support',
      'Custom integrations',
      'Team management',
      'SLA guarantees',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

const faqs = [
  {
    q: 'What counts as a task?',
    a: 'A task is counted each time TaskMaster AI processes a request—parsing PRDs, expanding tasks, analyzing complexity, or generating updates. Subtasks count separately.',
  },
  {
    q: 'What happens if I exceed my monthly limit?',
    a: 'You can continue using TaskMaster AI at the per-task overage rate for your plan ($0.20/task for Plus, $0.15/task for Pro). Enterprise plans have volume discounts.',
  },
  {
    q: 'Can I use my own API keys?',
    a: 'Yes! All plans support using your own API keys. Our secure API key vault makes it easy to manage keys for multiple providers.',
  },
  {
    q: 'What AI providers are supported?',
    a: 'We support Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Perplexity, xAI (Grok), Mistral, and OpenRouter.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. No long-term contracts. Cancel anytime and you\'ll have access until the end of your billing period.',
  },
]

export default function Pricing() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canceled = searchParams.get('canceled') === 'true'

  const handleSelectPlan = async (planId: PlanType) => {
    setError(null)

    // If not logged in, redirect to signup with plan
    if (!user || !userData) {
      navigate(`/signup?plan=${planId}`)
      return
    }

    // If enterprise, redirect to contact (or handle differently)
    if (planId === 'enterprise') {
      window.location.href = 'mailto:taskmasteroneai@gmail.com?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    // Start checkout
    setLoadingPlan(planId)
    try {
      await createCheckout({
        plan: planId,
        userId: user.uid,
        email: userData.email || user.email || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="relative py-20 px-4">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-14">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 shimmer-heading">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-text-muted max-w-lg mx-auto">
            Choose the plan that fits your workflow. Get started in minutes.
          </p>
        </motion.div>
      </div>

      {/* Canceled notice */}
      {canceled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center"
        >
          <p className="text-sm text-amber-400">Checkout canceled. Try again when you're ready.</p>
        </motion.div>
      )}

      {/* Error notice */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center"
        >
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Pricing cards */}
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {tiers.map((tier, index) => {
            const isCurrentPlan = userData?.plan === tier.id
            const isLoading = loadingPlan === tier.id

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
                className={`relative rounded-xl p-6 ${
                  tier.popular
                    ? 'bg-surface-elevated border-2 border-accent'
                    : 'bg-surface border border-border'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-accent rounded-full text-xs font-medium text-white">
                      <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold">{tier.priceLabel}</span>
                    <span className="text-sm text-text-muted">{tier.priceSuffix}</span>
                  </div>
                  <p className="text-sm text-text-muted mb-5">{tier.description}</p>

                  {isCurrentPlan ? (
                    <div className="w-full py-2.5 px-4 rounded-lg bg-surface-highlight border border-border text-text-muted text-sm text-center">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(tier.id)}
                      disabled={isLoading || loadingPlan !== null}
                      className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        tier.popular
                          ? 'bg-accent text-white hover:bg-accent-hover'
                          : 'bg-surface-highlight border border-border hover:border-border-light'
                      }`}
                    >
                      {isLoading ? (
                        <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                      ) : (
                        tier.cta
                      )}
                    </button>
                  )}

                  <div className="mt-6 space-y-3">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-status-success flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-text-muted">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* FAQs */}
      <div className="max-w-2xl mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-10 shimmer-heading">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
              className="card p-5"
            >
              <h3 className="text-base font-semibold mb-2">{faq.q}</h3>
              <p className="text-sm text-text-muted">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
