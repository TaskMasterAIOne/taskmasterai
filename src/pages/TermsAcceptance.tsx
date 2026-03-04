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

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/taskmaster_ai_new_logo-removebg.png?alt=media&token=29e7f6a0-f33d-4ec9-84bd-abf3ddbb78b8'

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="py-4 px-4 sm:px-6">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          <span className="text-sm">Back to signup</span>
        </button>
      </header>

      <main className="flex flex-grow items-center justify-center px-4 py-4 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-3xl"
        >
          <div className="card-elevated p-4 sm:p-6 md:p-8">
            <div className="text-center mb-4 sm:mb-6">
              {/* Logo */}
              <Link to="/" className="flex items-center justify-center gap-1.5 mb-4">
                <img 
                  src={LOGO_URL} 
                  alt="TaskMaster AI" 
                  className="w-10 h-10 rounded-lg object-contain invert dark:invert-0"
                />
              </Link>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-text">
                Terms & Privacy Policy
              </h2>
              <p className="text-text-muted text-sm mt-2">
                Please review and accept our terms to create your account
              </p>

              {!hasScrolledToBottom ? (
                <div className="mt-3 p-2 bg-primary/10 rounded-lg">
                  <p className="text-primary text-xs sm:text-sm font-medium text-center">
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
              className="h-[45vh] sm:h-[50vh] overflow-y-auto bg-surface border border-border rounded-lg p-4 sm:p-6 text-sm text-text-muted leading-relaxed mb-4 sm:mb-6"
            >
              <div className="space-y-8">
                {/* Terms of Service Section */}
                <div>
                  <h3 className="text-xl font-bold text-text mb-4">
                    Terms of Service
                  </h3>
                  <p className="text-xs text-text-subtle mb-4">Last updated: April 2025</p>

                  <div className="space-y-6">
                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        1. Acceptance of Terms
                      </h4>
                      <p>
                        By accessing and using TaskMaster AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service. 
                        If you do not agree to these terms, please do not use the Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        2. Description of Service
                      </h4>
                      <p>
                        TaskMaster AI is an AI-powered task management tool designed for developers. The Service helps transform 
                        Product Requirements Documents (PRDs) into structured, executable tasks with intelligent breakdown and 
                        multi-model support.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        3. User Accounts
                      </h4>
                      <p className="mb-2">To use certain features of the Service, you must create an account. You are responsible for:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Maintaining the confidentiality of your account credentials</li>
                        <li>All activities that occur under your account</li>
                        <li>Notifying us immediately of any unauthorized use of your account</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        4. API Keys and Third-Party Services
                      </h4>
                      <p className="mb-2">
                        The Service allows you to connect your own API keys from third-party AI providers (such as Anthropic, 
                        OpenAI, Google, etc.). You are responsible for:
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Complying with the terms of service of these third-party providers</li>
                        <li>Any charges incurred through your use of third-party API keys</li>
                        <li>Keeping your API keys secure and confidential</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        5. Acceptable Use
                      </h4>
                      <p className="mb-2">You agree not to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Use the Service for any illegal or unauthorized purpose</li>
                        <li>Attempt to gain unauthorized access to the Service or its systems</li>
                        <li>Interfere with or disrupt the Service or servers</li>
                        <li>Transmit any malware, viruses, or harmful code</li>
                        <li>Reverse engineer or attempt to extract the source code of the Service</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        6. Intellectual Property
                      </h4>
                      <p>
                        The Service and its original content, features, and functionality are owned by TaskMaster AI and are 
                        protected by international copyright, trademark, and other intellectual property laws. Content you create 
                        using the Service remains your property. By using the Service, you grant us a limited license to store and 
                        process your content as necessary to provide the Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        7. Pricing, Payments, and Billing
                      </h4>
                      <p className="mb-2">
                        Certain features of the Service require a paid subscription. Payments are processed securely through 
                        Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis. Prices 
                        may change with 30 days&apos; notice.
                      </p>

                      <h5 className="text-sm font-medium text-text mt-4 mb-2">No-Refund Policy</h5>
                      <p>
                        All sales are final. We do not offer refunds or credits for subscription plans (Plus, Pro, or 
                        Enterprise) under any circumstances. Once a payment is made, you will not be eligible for a refund. 
                        This applies including but not limited to: accidental purchase, dissatisfaction with the Service, 
                        forgetting to cancel before renewal, or unauthorized use of your account or payment method. You are 
                        responsible for the security of your account and payment information. By completing a purchase, you 
                        acknowledge that you have read, understood, and agree to this no-refund policy.
                      </p>

                      <h5 className="text-sm font-medium text-text mt-4 mb-2">Billing Issues and Disputes — Contact Us First</h5>
                      <p>
                        All billing questions or issues—including claims of cancellation, renewal, duplicate charges, 
                        unexpected charges, plan changes, access issues, or any other payment-related concern—must be 
                        submitted to us via email at taskmasteroneai@gmail.com as your required first step. You are 
                        responsible for promptly notifying us so we can investigate, verify account status, and provide a 
                        resolution. If you do not contact us by email, issues may persist (including continued renewals) 
                        because we may not be aware of the problem.
                      </p>
                      <p className="mt-2">
                        You agree to make a good-faith effort to resolve billing concerns with us directly before initiating 
                        a bank dispute, chargeback, or payment reversal. If you initiate a dispute or chargeback without 
                        first emailing us and providing reasonable details (such as account email, invoice/receipt details, 
                        dates, and the nature of the issue), we reserve the right to suspend or terminate your access to the 
                        Service and/or restrict future purchases, to the extent permitted by law.
                      </p>
                      <p className="mt-2">
                        In the event of a payment dispute or chargeback initiated by you or your bank, we will provide our 
                        payment processor (Stripe) and the card issuer with evidence demonstrating that the purchase was 
                        made and that you accepted these Terms, including this billing and refund policy, prior to the 
                        purchase. This may include account records, login and usage indicators, subscription status, 
                        cancellation timestamps (if any), and confirmation screens or emails. The final outcome of any 
                        dispute is determined by the card issuer; we cannot guarantee the result.
                      </p>

                      <h5 className="text-sm font-medium text-text mt-4 mb-2">Delivery and Cancellation</h5>
                      <p>
                        Upon successful payment, access to the corresponding subscription features is granted promptly, 
                        typically within minutes. You will receive an email confirmation. You may cancel your subscription 
                        at any time through your account settings or by contacting us. Cancellation takes effect at the end 
                        of your current billing period; you will not be charged for subsequent periods and will retain 
                        access until the end of that term. No refunds are issued for the remaining period upon cancellation.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        8. Limitation of Liability
                      </h4>
                      <p>
                        To the maximum extent permitted by law, TaskMaster AI shall not be liable for any indirect, incidental, 
                        special, consequential, or punitive damages, including loss of profits, data, or other intangible losses.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        9. Disclaimer of Warranties
                      </h4>
                      <p>
                        The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or 
                        implied, including but not limited to implied warranties of merchantability, fitness for a particular 
                        purpose, and non-infringement.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        10. Termination
                      </h4>
                      <p>
                        We may terminate or suspend your account and access to the Service immediately, without prior notice, 
                        for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        11. Changes to Terms
                      </h4>
                      <p>
                        We reserve the right to modify these terms at any time. We will notify users of any material changes 
                        via email or through the Service. Continued use of the Service after changes constitutes acceptance 
                        of the new terms.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        12. Contact Information
                      </h4>
                      <p>
                        If you have any questions about these Terms of Service, please contact us at: taskmasteroneai@gmail.com
                      </p>
                    </section>
                  </div>
                </div>

                {/* Privacy Policy Section */}
                <div className="pt-8 border-t-2 border-border">
                  <h3 className="text-xl font-bold text-text mb-4">
                    Privacy Policy
                  </h3>
                  <p className="text-xs text-text-subtle mb-4">Last updated: April 2025</p>

                  <div className="space-y-6">
                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        1. Introduction
                      </h4>
                      <p>
                        TaskMaster AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy 
                        explains how we collect, use, disclose, and safeguard your information when you use our Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        2. Information We Collect
                      </h4>
                      
                      <h5 className="text-sm font-medium text-text mt-3 mb-2">2.1 Information You Provide</h5>
                      <ul className="list-disc pl-5 space-y-1 mb-4">
                        <li><strong>Account Information:</strong> Email address, name, and password when you create an account</li>
                        <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe)</li>
                        <li><strong>API Keys:</strong> Third-party API keys you choose to store in our secure vault</li>
                        <li><strong>Content:</strong> PRDs, tasks, and other content you create using the Service</li>
                      </ul>

                      <h5 className="text-sm font-medium text-text mt-3 mb-2">2.2 Information Collected Automatically</h5>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Usage Data:</strong> How you interact with the Service, features used, and actions taken</li>
                        <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                        <li><strong>Log Data:</strong> IP address, access times, and pages viewed</li>
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
                        5. Data Sharing and Disclosure
                      </h4>
                      <p className="mb-2">We do not sell your personal information. We may share your information:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>With Service Providers:</strong> Third parties that help us operate the Service (hosting, payment processing)</li>
                        <li><strong>For Legal Reasons:</strong> When required by law or to protect rights and safety</li>
                        <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                        <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
                      </ul>

                      <h5 className="text-sm font-medium text-text mt-4 mb-2">Payment and Billing Disputes</h5>
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
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
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
                      <h4 className="text-base font-semibold text-text mb-2">
                        10. Children&apos;s Privacy
                      </h4>
                      <p>
                        The Service is not intended for children under 13 years of age. We do not knowingly collect personal 
                        information from children under 13. If we learn we have collected such information, we will delete 
                        it promptly.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        11. International Data Transfers
                      </h4>
                      <p>
                        Your information may be transferred to and processed in countries other than your own. We ensure 
                        appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
                        12. Changes to This Policy
                      </h4>
                      <p>
                        We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                        the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. Material changes will be 
                        communicated via email or through the Service.
                      </p>
                    </section>

                    <section>
                      <h4 className="text-base font-semibold text-text mb-2">
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
                        ? 'text-text-subtle'
                        : 'text-text'
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
                className="flex-1 py-3 sm:py-3.5 text-sm sm:text-base bg-surface border border-border text-text font-medium rounded-lg transition-all duration-200 hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Go Back
              </button>
              <button
                onClick={handleAcceptAndContinue}
                disabled={loading}
                className="flex-1 py-3 sm:py-3.5 text-sm sm:text-base bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
