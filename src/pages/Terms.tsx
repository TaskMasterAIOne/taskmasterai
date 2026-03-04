import { motion } from 'framer-motion'

export default function Terms() {
  return (
    <div className="relative py-12 sm:py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-text-muted mb-8">Last updated: April 2025</p>

          <div className="space-y-8 text-text-muted">
            <section>
              <h2 className="text-xl font-semibold text-text mb-3">1. Acceptance of Terms</h2>
              <p className="mb-3">
                By accessing and using TaskMaster AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Service.
              </p>
              <p className="mb-3">
                These Terms apply to all users of the Service, including visitors, registered users, and paying subscribers. If you use the Service on behalf of a company or other legal entity, you represent that you have the authority to bind that entity to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">2. Description of Service</h2>
              <p className="mb-3">
                TaskMaster AI is an AI-powered task management platform designed for developers. The Service helps transform Product Requirements Documents (PRDs) into structured, dependency-aware tasks and workflows that assist AI coding agents and development processes.
              </p>
              <p className="mb-3">
                Features and functionality of the Service may change or improve over time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">3. User Accounts</h2>
              <p className="mb-3">
                To access certain features of the Service, you must create an account.
              </p>
              <p className="mb-3">You are responsible for:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Maintaining the confidentiality of your login credentials</li>
                <li>All activities that occur under your account</li>
                <li>Promptly notifying us of any unauthorized access to your account</li>
              </ul>
              <p className="mb-3 mt-3">
                You must provide accurate information when creating an account.
              </p>
              <p className="mb-3">
                We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent or abusive activity.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">4. API Keys and Third-Party Services</h2>
              <p className="mb-3">
                The Service may allow you to connect your own API keys from third-party providers such as OpenAI, Anthropic, Google, or other AI services.
              </p>
              <p className="mb-3">You are responsible for:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Complying with the terms of those providers</li>
                <li>Any costs incurred through your use of those services</li>
                <li>Securing your API keys and account credentials</li>
              </ul>
              <p className="mb-3 mt-3">
                TaskMaster AI is not responsible for charges generated through third-party APIs connected to your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">5. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use the Service for illegal or unauthorized purposes</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Upload malicious code or malware</li>
                <li>Reverse engineer or attempt to extract the source code of the Service</li>
              </ul>
              <p className="mb-3 mt-3">
                Violation of these rules may result in account suspension or termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">6. Intellectual Property</h2>
              <p className="mb-3">
                The Service and all associated software, content, and features are owned by TaskMaster AI and protected by intellectual property laws.
              </p>
              <p className="mb-3">
                You may not copy, distribute, modify, or create derivative works from the Service without permission.
              </p>
              <p className="mb-3">
                Content created by users remains the property of the user. By using the Service, you grant TaskMaster AI a limited license to process and store that content for the purpose of providing the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">7. Pricing, Payments, and Billing</h2>
              <p className="mb-3">
                Certain features of the Service require a paid subscription.
              </p>
              <p className="mb-3">
                Payments are processed securely through Stripe or other authorized payment providers.
              </p>
              <p className="mb-3">
                By purchasing a subscription, you authorize TaskMaster AI to charge your payment method on a recurring basis according to the billing cycle selected at the time of purchase.
              </p>
              <p className="mb-3">
                Prices may change from time to time. If prices change, the updated price will apply to future billing periods.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Subscription Renewal</h3>
              <p className="mb-3">
                Subscriptions automatically renew at the end of each billing period unless canceled before the renewal date.
              </p>
              <p className="mb-3">
                By maintaining an active subscription, you authorize recurring charges for future billing periods until the subscription is canceled.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Cancellation</h3>
              <p className="mb-3">
                You may cancel your subscription at any time.
              </p>
              <p className="mb-3">
                Cancellation stops future billing but does not refund the current billing period.
              </p>
              <p className="mb-3">
                After cancellation, your subscription will remain active until the end of the current billing term, after which access to paid features may be limited.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Refund Policy</h3>
              <p className="mb-3">
                Except where required by law, payments for subscription plans are non-refundable.
              </p>
              <p className="mb-3">
                We generally do not provide refunds for:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Accidental purchases</li>
                <li>Unused subscription time</li>
                <li>Forgetting to cancel before renewal</li>
                <li>Dissatisfaction with the Service after purchase</li>
              </ul>
              <p className="mb-3 mt-3">
                However, we may review billing issues on a case-by-case basis at our discretion.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Billing Issues and Support</h3>
              <p className="mb-3">
                If you believe a charge was made in error, you must contact us first at:
              </p>
              <p className="font-semibold mb-3">taskmasteroneai@gmail.com</p>
              <p className="mb-3">
                Providing your account email, invoice details, and description of the issue will help us resolve the matter quickly.
              </p>
              <p className="mb-3">
                Most billing issues can be resolved directly through our support team.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Chargebacks and Payment Disputes</h3>
              <p className="mb-3">
                By purchasing a subscription, you agree to make a good-faith effort to resolve billing concerns with TaskMaster AI before initiating a chargeback or payment dispute with your bank.
              </p>
              <p className="mb-3">
                If a chargeback or dispute is initiated, we may provide the payment processor and card issuer with evidence related to the transaction, including:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Account records</li>
                <li>Login activity</li>
                <li>Usage logs</li>
                <li>Subscription status</li>
                <li>Cancellation timestamps</li>
                <li>Acceptance of these Terms</li>
              </ul>
              <p className="mb-3 mt-3">
                We reserve the right to suspend or terminate accounts associated with fraudulent or abusive disputes.
              </p>
              <p className="mb-3">
                The final outcome of any dispute is determined by the card issuer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">8. Delivery of Digital Services</h2>
              <p className="mb-3">
                Access to subscription features is typically granted immediately after successful payment.
              </p>
              <p className="mb-3">
                Because the Service is a digital product delivered instantly, access may begin immediately upon purchase.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">9. Limitation of Liability</h2>
              <p className="mb-3">
                To the maximum extent permitted by law, TaskMaster AI shall not be liable for indirect, incidental, special, or consequential damages resulting from the use of the Service.
              </p>
              <p className="mb-3">
                This includes but is not limited to loss of profits, data, or business opportunities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">10. Disclaimer of Warranties</h2>
              <p className="mb-3">
                The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
              </p>
              <p className="mb-3">We do not guarantee that:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The Service will always be uninterrupted</li>
                <li>The Service will be error-free</li>
                <li>Outputs generated by AI will always be accurate</li>
              </ul>
              <p className="mb-3 mt-3">
                Users are responsible for verifying outputs and using the Service appropriately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">11. Termination</h2>
              <p className="mb-3">We may suspend or terminate accounts that:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Violate these Terms</li>
                <li>Engage in fraudulent activity</li>
                <li>Abuse the Service or payment systems</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">12. Changes to Terms</h2>
              <p className="mb-3">
                We may modify these Terms from time to time.
              </p>
              <p className="mb-3">
                Continued use of the Service after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">13. Governing Law</h2>
              <p className="mb-3">
                These Terms shall be governed by the laws of the State of Texas, United States, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">14. Contact Information</h2>
              <p className="mb-3">
                If you have questions regarding these Terms, please contact:
              </p>
              <p className="text-text">taskmasteroneai@gmail.com</p>
            </section>

            <section>
              <p className="text-text text-sm">© 2026 TaskMaster AI LLC. All rights reserved.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
