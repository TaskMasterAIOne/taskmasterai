import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const PRICING_DISABLED = false
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
      'Use your own API keys',
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
      'Everything in Plus',
      'Hosted API keys included',
      'Up to 1,000 tasks/month',
      '$0.15 per extra task',
      'No API key management needed',
      'Priority support',
      'Advanced analytics',
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
      'Everything in Pro',
      'Hosted API keys included',
      '5,000+ tasks/month',
      'Volume discounts available',
      'Dedicated support',
      'Custom integrations',
      'Team management',
      'SLA guarantees',
    ],
    cta: 'Email us',
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
    a: 'You can continue using TaskMaster AI at the per-task overage rate for your plan ($0.20/task for Plus, $0.15/task for Pro). NOTE: Enterprise plans may exceed $1,000 with continued usage.',
  },
  {
    q: 'Do I need my own API keys?',
    a: 'Not with Pro or Enterprise! These plans include hosted API keys so you can start immediately. Plus plan users can bring their own keys and use our secure API key vault.',
  },
  {
    q: 'What AI providers are supported?',
    a: 'We support Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Perplexity, xAI (Grok), Mistral, OpenRouter, and Ollama (local models).',
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
    <div className="marketing-page open-sample relative px-4 py-12 sm:py-20">
      {/* Header */}
      <div className="relative z-[1] mx-auto mb-10 max-w-5xl text-center sm:mb-14">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-400/50" />
            <span className="bg-gradient-to-r from-indigo-500 to-violet-400 bg-clip-text text-sm font-medium text-transparent">
              Pricing
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-400/50" />
          </div>
          <h1 className="marketing-gradient-text font-display mb-4 text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-marketing-muted">
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

      {/* Pricing cards - or disabled message */}
      {PRICING_DISABLED ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="marketing-panel mx-auto max-w-lg rounded-xl border p-8 text-center sm:p-12"
        >
          <p className="text-lg text-marketing-muted">
            Pricing is temporarily unavailable. Please check back soon or contact us at{' '}
            <a href="mailto:taskmasteroneai@gmail.com" className="text-indigo-500 hover:underline dark:text-indigo-400">
              taskmasteroneai@gmail.com
            </a>{' '}
            for assistance.
          </p>
        </motion.div>
      ) : (
      <div className="relative z-[1] mx-auto max-w-5xl">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((tier, index) => {
            const isCurrentPlan = userData?.plan === tier.id
            const isLoading = loadingPlan === tier.id

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
                className={`relative flex flex-col rounded-2xl p-6 ${
                  tier.popular
                    ? 'border-2 border-indigo-500/60 bg-marketing-panel shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/25 dark:border-indigo-400/50'
                    : 'marketing-panel border shadow-lg shadow-black/5 dark:shadow-black/20'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                      <FontAwesomeIcon icon={faStar} className="w-3 h-3" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="flex flex-1 flex-col pt-2">
                  <h3 className="mb-1 font-display text-lg font-semibold text-marketing-text">{tier.name}</h3>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tabular-nums text-marketing-text">{tier.priceLabel}</span>
                    <span className="text-sm text-marketing-muted">{tier.priceSuffix}</span>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-marketing-muted">{tier.description}</p>

                  {isCurrentPlan ? (
                    <div className="w-full rounded-xl border border-marketing-border bg-marketing-surface px-4 py-3 text-center text-sm font-medium text-marketing-muted">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(tier.id)}
                      disabled={isLoading || loadingPlan !== null}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        tier.popular ? 'btn-marketing-primary' : 'btn-marketing-secondary'
                      }`}
                    >
                      {isLoading ? (
                        <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        tier.cta
                      )}
                    </button>
                  )}

                  <div className="mt-8 flex flex-1 flex-col">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-marketing-muted">
                      What&apos;s included
                    </p>
                    <ul className="space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500 dark:text-emerald-400"
                          />
                          <span className="text-sm leading-snug text-marketing-muted">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      )}

      {/* FAQs */}
      <div className="relative z-[1] mx-auto mt-12 max-w-2xl sm:mt-20">
        <div className="open-sample-section-divider mb-8 sm:mb-10" aria-hidden />
        <h2 className="mb-8 text-center font-display text-xl font-bold text-marketing-text sm:mb-10 sm:text-2xl">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
              className="marketing-panel rounded-xl border p-5 shadow-md shadow-black/5 dark:shadow-black/15"
            >
              <h3 className="mb-2 text-base font-semibold text-marketing-text">{faq.q}</h3>
              <p className="text-sm text-marketing-muted">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
