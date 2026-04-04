import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faCircleNotch,
  faCircleExclamation,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons'
import {
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { TaskMasterAILogo } from '../components/TaskMasterAILogo'

interface SignupData {
  method: 'email' | 'google'
  // For email signup
  email?: string
  password?: string
  // For Google signup
  googleUser?: User
}

export default function TermsAcceptance() {
  const navigate = useNavigate()
  const location = useLocation()
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToTermsError, setAgreedToTermsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  // Get signup data from navigation state
  const signupData = location.state?.signupData as SignupData | undefined

  // Redirect if no signup data
  useEffect(() => {
    if (!signupData) {
      navigate('/signup', { replace: true })
    }
  }, [signupData, navigate])

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current
      // Consider "scrolled" if user is within 50px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 50) {
        setHasScrolledToBottom(true)
      }
    }
  }

  const handleAcceptAndContinue = async () => {
    // Check if terms are agreed
    if (!agreedToTerms) {
      setAgreedToTermsError(true)
      return
    }

    if (!signupData) return

    setError('')
    setLoading(true)

    try {
      if (signupData.method === 'email') {
        // Create email/password account
        const result = await createUserWithEmailAndPassword(
          auth,
          signupData.email!,
          signupData.password!
        )
        const user = result.user

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          plan: null,
          createdAt: serverTimestamp(),
          acceptedTermsAt: serverTimestamp(),
        })

        navigate('/app/dashboard')
      } else if (signupData.method === 'google') {
        // Google user is already signed in at this point
        const user = signupData.googleUser!

        // Check if user document exists (it might have been created during Google sign-in)
        const userDocRef = doc(db, 'users', user.uid)
        await setDoc(
          userDocRef,
          {
            uid: user.uid,
            email: user.email,
            plan: null,
            createdAt: serverTimestamp(),
            acceptedTermsAt: serverTimestamp(),
          },
          { merge: true }
        )

        navigate('/app/dashboard')
      }
    } catch (err: unknown) {
      console.error('Error creating account:', err)
      const authError = err as { code?: string; message?: string }
      if (authError.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please try logging in instead.')
      } else {
        setError('Failed to create account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = async () => {
    // Sign out if Google user before going back
    if (signupData?.method === 'google' && signupData.googleUser) {
      await signOut(auth)
    }
    navigate('/signup')
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAgreedToTerms(e.target.checked)
    if (e.target.checked) {
      setAgreedToTermsError(false)
    }
  }

  if (!signupData) {
    return null
  }

  return (
    <div className="marketing-page app-cruip relative flex min-h-screen flex-col bg-marketing-bg text-marketing-text">
      <header className="relative z-[1] border-b border-marketing-border bg-marketing-bg/90 px-4 py-4 backdrop-blur-sm sm:px-6">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-marketing-muted transition-colors hover:text-marketing-link"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          <span className="text-sm">Back to signup</span>
        </button>
      </header>

      <main className="flex flex-grow items-center justify-center px-4 py-4 sm:py-8 relative z-[1]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-3xl"
        >
          <div className="marketing-panel rounded-2xl border p-4 shadow-xl sm:p-6 md:p-8">
            <div className="mb-4 text-center sm:mb-6">
              {/* Logo */}
              <Link
                to="/"
                className="mb-4 flex items-center justify-center gap-1.5"
                aria-label="TaskMaster AI home"
              >
                <TaskMasterAILogo className="h-10 w-10 rounded-lg" />
              </Link>
              <h2 className="marketing-gradient-text font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Terms & Privacy Policy
              </h2>
              <p className="mt-2 text-open-sm text-marketing-muted">
                Please review and accept our terms to create your account
              </p>

              {!hasScrolledToBottom ? (
                <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2">
                  <p className="text-center text-xs font-medium text-indigo-700 dark:text-accent-primary sm:text-sm">
                    Please scroll to the bottom to continue
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-status-success text-sm font-semibold flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4" />
                  You&apos;ve read everything! Check the box below to continue
                </p>
              )}
            </div>

            {/* Combined Terms and Privacy Policy */}
            <div
              ref={contentRef}
              onScroll={handleScroll}
              className="mb-4 h-[45vh] overflow-y-auto rounded-lg border border-marketing-border bg-marketing-surface p-4 text-sm leading-relaxed text-marketing-muted sm:mb-6 sm:h-[50vh] sm:p-6"
            >
              <div className="space-y-8">
                {/* Terms of Service Section */}
                <div>
                  <h3 className="text-xl font-bold text-marketing-text mb-4">
                    Terms of Service
                  </h3>
                  <p className="text-xs text-marketing-muted mb-4">Last updated: April 2025</p>

                  <div className="space-y-6">
                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        1. Acceptance of Terms
                      </h4>
                      <p className="mb-2">
                        By accessing and using TaskMaster AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Service.
                      </p>
                      <p className="mb-2">
                        These Terms apply to all users of the Service, including visitors, registered users, and paying subscribers. If you use the Service on behalf of a company or other legal entity, you represent that you have the authority to bind that entity to these Terms.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        2. Description of Service
                      </h4>
                      <p className="mb-2">
                        TaskMaster AI is an AI-powered task management platform designed for developers. The Service helps transform Product Requirements Documents (PRDs) into structured, dependency-aware tasks and workflows that assist AI coding agents and development processes.
                      </p>
                      <p className="mb-2">
                        Features and functionality of the Service may change or improve over time.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        3. User Accounts
                      </h4>
                      <p className="mb-2">To access certain features of the Service, you must create an account.</p>
                      <p className="mb-2">You are responsible for:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Maintaining the confidentiality of your login credentials</li>
                        <li>All activities that occur under your account</li>
                        <li>Promptly notifying us of any unauthorized access to your account</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        You must provide accurate information when creating an account.
                      </p>
                      <p className="mb-2">
                        We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent or abusive activity.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        4. API Keys and Third-Party Services
                      </h4>
                      <p className="mb-2">
                        The Service may allow you to connect your own API keys from third-party providers such as OpenAI, Anthropic, Google, or other AI services.
                      </p>
                      <p className="mb-2">You are responsible for:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Complying with the terms of those providers</li>
                        <li>Any costs incurred through your use of those services</li>
                        <li>Securing your API keys and account credentials</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        TaskMaster AI is not responsible for charges generated through third-party APIs connected to your account.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        5. Acceptable Use
                      </h4>
                      <p className="mb-2">You agree not to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Use the Service for illegal or unauthorized purposes</li>
                        <li>Attempt to gain unauthorized access to our systems</li>
                        <li>Interfere with or disrupt the Service or servers</li>
                        <li>Upload malicious code or malware</li>
                        <li>Reverse engineer or attempt to extract the source code of the Service</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        Violation of these rules may result in account suspension or termination.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        6. Intellectual Property
                      </h4>
                      <p className="mb-2">
                        The Service and all associated software, content, and features are owned by TaskMaster AI and protected by intellectual property laws.
                      </p>
                      <p className="mb-2">
                        You may not copy, distribute, modify, or create derivative works from the Service without permission.
                      </p>
                      <p className="mb-2">
                        Content created by users remains the property of the user. By using the Service, you grant TaskMaster AI a limited license to process and store that content for the purpose of providing the Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        7. Pricing, Payments, and Billing
                      </h4>
                      <p className="mb-2">
                        Certain features of the Service require a paid subscription.
                      </p>
                      <p className="mb-2">
                        Payments are processed securely through Stripe or other authorized payment providers.
                      </p>
                      <p className="mb-2">
                        By purchasing a subscription, you authorize TaskMaster AI to charge your payment method on a recurring basis according to the billing cycle selected at the time of purchase.
                      </p>
                      <p className="mb-2">
                        Prices may change from time to time. If prices change, the updated price will apply to future billing periods.
                      </p>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">Subscription Renewal</h5>
                      <p className="mb-2">
                        Subscriptions automatically renew at the end of each billing period unless canceled before the renewal date.
                      </p>
                      <p className="mb-2">
                        By maintaining an active subscription, you authorize recurring charges for future billing periods until the subscription is canceled.
                      </p>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">Cancellation</h5>
                      <p className="mb-2">
                        You may cancel your subscription at any time.
                      </p>
                      <p className="mb-2">
                        Cancellation stops future billing but does not refund the current billing period.
                      </p>
                      <p className="mb-2">
                        After cancellation, your subscription will remain active until the end of the current billing term, after which access to paid features may be limited.
                      </p>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">Refund Policy</h5>
                      <p className="mb-2">
                        Except where required by law, payments for subscription plans are non-refundable.
                      </p>
                      <p className="mb-2">
                        We generally do not provide refunds for:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Accidental purchases</li>
                        <li>Unused subscription time</li>
                        <li>Forgetting to cancel before renewal</li>
                        <li>Dissatisfaction with the Service after purchase</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        However, we may review billing issues on a case-by-case basis at our discretion.
                      </p>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">Billing Issues and Support</h5>
                      <p className="mb-2">
                        If you believe a charge was made in error, you must contact us first at:
                      </p>
                      <p className="font-semibold mb-2">taskmasteroneai@gmail.com</p>
                      <p className="mb-2">
                        Providing your account email, invoice details, and description of the issue will help us resolve the matter quickly.
                      </p>
                      <p className="mb-2">
                        Most billing issues can be resolved directly through our support team.
                      </p>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">Chargebacks and Payment Disputes</h5>
                      <p className="mb-2">
                        By purchasing a subscription, you agree to make a good-faith effort to resolve billing concerns with TaskMaster AI before initiating a chargeback or payment dispute with your bank.
                      </p>
                      <p className="mb-2">
                        If a chargeback or dispute is initiated, we may provide the payment processor and card issuer with evidence related to the transaction, including:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Account records</li>
                        <li>Login activity</li>
                        <li>Usage logs</li>
                        <li>Subscription status</li>
                        <li>Cancellation timestamps</li>
                        <li>Acceptance of these Terms</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        We reserve the right to suspend or terminate accounts associated with fraudulent or abusive disputes.
                      </p>
                      <p className="mb-2">
                        The final outcome of any dispute is determined by the card issuer.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        8. Delivery of Digital Services
                      </h4>
                      <p className="mb-2">
                        Access to subscription features is typically granted immediately after successful payment.
                      </p>
                      <p className="mb-2">
                        Because the Service is a digital product delivered instantly, access may begin immediately upon purchase.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        9. Limitation of Liability
                      </h4>
                      <p className="mb-2">
                        To the maximum extent permitted by law, TaskMaster AI shall not be liable for indirect, incidental, special, or consequential damages resulting from the use of the Service.
                      </p>
                      <p className="mb-2">
                        This includes but is not limited to loss of profits, data, or business opportunities.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        10. Disclaimer of Warranties
                      </h4>
                      <p className="mb-2">
                        The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
                      </p>
                      <p className="mb-2">We do not guarantee that:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>The Service will always be uninterrupted</li>
                        <li>The Service will be error-free</li>
                        <li>Outputs generated by AI will always be accurate</li>
                      </ul>
                      <p className="mb-2 mt-2">
                        Users are responsible for verifying outputs and using the Service appropriately.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        11. Termination
                      </h4>
                      <p className="mb-2">We may suspend or terminate accounts that:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Violate these Terms</li>
                        <li>Engage in fraudulent activity</li>
                        <li>Abuse the Service or payment systems</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        12. Changes to Terms
                      </h4>
                      <p className="mb-2">
                        We may modify these Terms from time to time.
                      </p>
                      <p className="mb-2">
                        Continued use of the Service after updates constitutes acceptance of the revised Terms.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        13. Governing Law
                      </h4>
                      <p className="mb-2">
                        These Terms shall be governed by the laws of the State of Texas, United States, without regard to conflict of law principles.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        14. Contact Information
                      </h4>
                      <p className="mb-2">
                        If you have questions regarding these Terms, please contact:
                      </p>
                      <p className="text-marketing-text">taskmasteroneai@gmail.com</p>
                    </section>

                    <section>
                      <p className="text-marketing-text text-xs">© 2026 TaskMaster AI LLC. All rights reserved.</p>
                    </section>
                  </div>
                </div>

                {/* Privacy Policy Section */}
                <div className="pt-8 border-t-2 border-border">
                  <h3 className="text-xl font-bold text-marketing-text mb-4">
                    Privacy Policy
                  </h3>
                  <p className="text-xs text-marketing-muted mb-4">Last updated: April 2025</p>

                  <div className="space-y-6">
                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        1. Introduction
                      </h4>
                      <p>
                        TaskMaster AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy 
                        explains how we collect, use, disclose, and safeguard your information when you use our Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        2. Information We Collect
                      </h4>
                      
                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">2.1 Information You Provide</h5>
                      <ul className="list-disc pl-5 space-y-1 mb-4">
                        <li><strong>Account Information:</strong> Email address, name, and password when you create an account</li>
                        <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe)</li>
                        <li><strong>API Keys:</strong> Third-party API keys you choose to store in our secure vault</li>
                        <li><strong>Content:</strong> PRDs, tasks, and other content you create using the Service</li>
                      </ul>

                      <h5 className="text-sm font-medium text-marketing-text mt-3 mb-2">2.2 Information Collected Automatically</h5>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Usage Data:</strong> How you interact with the Service, features used, and actions taken</li>
                        <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                        <li><strong>Log Data:</strong> IP address, access times, and pages viewed</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        3. How We Use Your Information
                      </h4>
                      <p className="mb-2">We use the information we collect to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Provide, maintain, and improve the Service</li>
                        <li>Process transactions and send related information</li>
                        <li>Send technical notices, updates, and support messages</li>
                        <li>Respond to your comments, questions, and requests</li>
                        <li>Monitor and analyze trends, usage, and activities</li>
                        <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
                        <li>Personalize and improve your experience</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        4. Data Security
                      </h4>
                      <p className="mb-2">
                        We implement appropriate technical and organizational security measures to protect your data:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Encryption:</strong> All data is encrypted in transit (TLS) and at rest</li>
                        <li><strong>API Key Security:</strong> Your API keys are encrypted using industry-standard encryption</li>
                        <li><strong>Access Controls:</strong> Strict access controls and authentication mechanisms</li>
                        <li><strong>Regular Audits:</strong> Security practices are regularly reviewed and updated</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        5. Data Sharing and Disclosure
                      </h4>
                      <p className="mb-2">We do not sell your personal information. We may share your information:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>With Service Providers:</strong> Third parties that help us operate the Service (hosting, payment processing)</li>
                        <li><strong>For Legal Reasons:</strong> When required by law or to protect rights and safety</li>
                        <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                        <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
                      </ul>

                      <h5 className="text-sm font-medium text-marketing-text mt-4 mb-2">Payment and Billing Disputes</h5>
                      <p>
                        Our payments are processed by Stripe. For any billing questions, refund requests, or payment 
                        disputes, you must contact us first at taskmasteroneai@gmail.com before initiating a chargeback 
                        or bank dispute. We use the information you provide (e.g., account email, invoice details, dates) 
                        to investigate and resolve issues. In the event of a chargeback or dispute, we may share relevant 
                        account and transaction information with our payment processor (Stripe) and the card issuer as 
                        necessary to resolve the dispute, in accordance with our Terms of Service and applicable law.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        6. Third-Party AI Providers
                      </h4>
                      <p className="mb-2">
                        When you use third-party AI providers through our Service (e.g., Anthropic, OpenAI, Google):
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Your prompts and content are sent to these providers to process your requests</li>
                        <li>Each provider has their own privacy policy governing how they handle your data</li>
                        <li>We recommend reviewing each provider&apos;s privacy policy</li>
                        <li>We do not store the content of your AI interactions beyond what&apos;s necessary to provide the Service</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        7. Your Rights and Choices
                      </h4>
                      <p className="mb-2">You have the right to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Access:</strong> Request a copy of your personal data</li>
                        <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                        <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                        <li><strong>Export:</strong> Export your data in a portable format</li>
                        <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                      </ul>
                      <p className="mt-2">
                        To exercise these rights, contact us at taskmasteroneai@gmail.com
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        8. Data Retention
                      </h4>
                      <p className="mb-2">
                        We retain your information for as long as your account is active or as needed to provide you services. 
                        We will retain and use your information as necessary to:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Comply with legal obligations</li>
                        <li>Resolve disputes</li>
                        <li>Enforce our agreements</li>
                      </ul>
                      <p className="mt-2">
                        When you delete your account, we will delete or anonymize your data within 30 days, except where 
                        retention is required by law.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        9. Cookies and Tracking
                      </h4>
                      <p className="mb-2">
                        We use cookies and similar technologies to:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Keep you logged in</li>
                        <li>Remember your preferences</li>
                        <li>Understand how you use the Service</li>
                        <li>Improve the Service</li>
                      </ul>
                      <p className="mt-2">
                        You can control cookies through your browser settings, though some features may not work properly 
                        if you disable them.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        10. Children&apos;s Privacy
                      </h4>
                      <p>
                        The Service is not intended for children under 13 years of age. We do not knowingly collect personal 
                        information from children under 13. If we learn we have collected such information, we will delete 
                        it promptly.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        11. International Data Transfers
                      </h4>
                      <p>
                        Your information may be transferred to and processed in countries other than your own. We ensure 
                        appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        12. Changes to This Policy
                      </h4>
                      <p>
                        We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                        the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. Material changes will be 
                        communicated via email or through the Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-marketing-text mb-2">
                        13. Contact Us
                      </h4>
                      <p className="mb-2">
                        If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                      </p>
                      <ul className="list-none space-y-1">
                        <li><strong>Email:</strong> taskmasteroneai@gmail.com</li>
                        <li><strong>Address:</strong> TaskMaster AI LLC</li>
                      </ul>
                    </section>
                  </div>

                  <div className="mt-8 p-4 bg-status-success/10 border border-status-success/20 rounded-lg text-center">
                    <p className="text-status-success font-semibold flex items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4" />
                      You&apos;ve reached the end! Check the box below to continue
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <div className="mb-4 sm:mb-6">
              <label
                className={`flex items-start gap-3 cursor-pointer group p-3 sm:p-4 bg-surface border-2 rounded-lg transition-colors ${
                  agreedToTermsError
                    ? 'border-status-error bg-status-error/5'
                    : 'border-border hover:border-primary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={handleCheckboxChange}
                  disabled={!hasScrolledToBottom}
                  className="w-5 h-5 mt-0.5 flex-shrink-0 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                />
                <div className="flex-1">
                  <span
                    className={`text-xs sm:text-sm leading-relaxed ${
                      !hasScrolledToBottom
                        ? 'text-marketing-muted'
                        : 'text-marketing-text'
                    } transition-colors`}
                  >
                    I have read and agree to the{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>
                  </span>
                  {agreedToTermsError && (
                    <p className="text-status-error text-xs mt-1 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCircleExclamation} className="w-3 h-3" />
                      You must read and agree to the terms to create an account
                    </p>
                  )}
                </div>
              </label>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-status-error/10 border border-status-error/20 rounded-lg">
                <p className="text-status-error text-sm flex items-center gap-2">
                  <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4" />
                  {error}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleGoBack}
                disabled={loading}
                className="btn-marketing-secondary flex-1 rounded-lg py-3 text-sm font-medium sm:py-3.5 sm:text-base"
              >
                Go Back
              </button>
              <button
                onClick={handleAcceptAndContinue}
                disabled={loading}
                className="btn-marketing-primary flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold sm:py-3.5 sm:text-base disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      className="animate-spin h-4 w-4"
                    />
                    Creating Account...
                  </>
                ) : (
                  'Accept and Create Account'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
