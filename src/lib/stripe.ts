import { loadStripe } from '@stripe/stripe-js'

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51Sdfi2IIz7GWDlyPBfbbJiW8nDneJsEC42p1r9HsXMUkUl2yoNVJerTYGcRBTjzZGXuuKbFpxlSGn4IsgztIhnTB0060QTfc3G')

// Firebase Functions base URL - update this with your actual deployed functions URL
const FUNCTIONS_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net'

export type PlanType = 'plus' | 'pro' | 'enterprise'

export interface CheckoutParams {
  plan: PlanType
  userId: string
  email: string
  successUrl?: string
  cancelUrl?: string
}

export interface LicenseInfo {
  hasLicense: boolean
  licenseKey?: string
  plan?: PlanType
  planName?: string
  planPrice?: number
  tasksPerMonth?: number
  tasksUsed?: number
  overageRate?: number
  status?: string
  expiresAt?: string
  currentPeriodEnd?: string
  subscriptionStatus?: string
  cancelAtPeriodEnd?: boolean
  message?: string
}

/**
 * Create a Stripe checkout session and redirect to payment
 */
export async function createCheckout(params: CheckoutParams): Promise<void> {
  const { plan, userId, email, successUrl, cancelUrl } = params

  try {
    const response = await fetch(`${FUNCTIONS_URL}/createCheckoutSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan,
        userId,
        email,
        successUrl: successUrl || `${window.location.origin}/app/billing?success=true`,
        cancelUrl: cancelUrl || `${window.location.origin}/pricing?canceled=true`,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout session')
    }

    const { url } = await response.json()

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url
    }
  } catch (error) {
    console.error('Error creating checkout:', error)
    throw error
  }
}

/**
 * Get license info for the current user
 */
export async function getLicenseInfo(userId: string): Promise<LicenseInfo> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/getLicenseInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get license info')
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting license info:', error)
    throw error
  }
}

/**
 * Cancel the current subscription
 */
export async function cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/cancelSubscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to cancel subscription')
    }

    return await response.json()
  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

/**
 * Open Stripe Customer Portal for subscription management
 */
export async function openCustomerPortal(userId: string, returnUrl?: string): Promise<void> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/createPortalSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        returnUrl: returnUrl || `${window.location.origin}/app/billing`,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to open customer portal')
    }

    const { url } = await response.json()

    if (url) {
      window.location.href = url
    }
  } catch (error) {
    console.error('Error opening customer portal:', error)
    throw error
  }
}

export { stripePromise }
