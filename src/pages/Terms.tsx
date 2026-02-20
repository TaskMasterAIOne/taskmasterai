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
                By accessing and using TaskMaster AI ("the Service"), you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">2. Description of Service</h2>
              <p className="mb-3">
                TaskMaster AI is an AI-powered task management tool designed for developers. The Service helps transform 
                Product Requirements Documents (PRDs) into structured, executable tasks with intelligent breakdown and 
                multi-model support.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">3. User Accounts</h2>
              <p className="mb-3">
                To use certain features of the Service, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">4. API Keys and Third-Party Services</h2>
              <p className="mb-3">
                The Service allows you to connect your own API keys from third-party AI providers (such as Anthropic, 
                OpenAI, Google, etc.). You are responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Complying with the terms of service of these third-party providers</li>
                <li>Any charges incurred through your use of third-party API keys</li>
                <li>Keeping your API keys secure and confidential</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">5. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Transmit any malware, viruses, or harmful code</li>
                <li>Reverse engineer or attempt to extract the source code of the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">6. Intellectual Property</h2>
              <p className="mb-3">
                The Service and its original content, features, and functionality are owned by TaskMaster AI and are 
                protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                Content you create using the Service remains your property. By using the Service, you grant us a 
                limited license to store and process your content as necessary to provide the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">7. Pricing, Payments, and Billing</h2>
              <p className="mb-3">
                Certain features of the Service require a paid subscription. Payments are processed securely through 
                Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis. Prices 
                may change with 30 days' notice.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">No-Refund Policy</h3>
              <p className="mb-3">
                All sales are final. We do not offer refunds or credits for subscription plans (Plus, Pro, or 
                Enterprise) under any circumstances. Once a payment is made, you will not be eligible for a refund. 
                This applies including but not limited to: accidental purchase, dissatisfaction with the Service, 
                forgetting to cancel before renewal, or unauthorized use of your account or payment method. You are 
                responsible for the security of your account and payment information. By completing a purchase, you 
                acknowledge that you have read, understood, and agree to this no-refund policy.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Billing Issues and Disputes — Contact Us First</h3>
              <p className="mb-3">
                All billing questions or issues—including claims of cancellation, renewal, duplicate charges, 
                unexpected charges, plan changes, access issues, or any other payment-related concern—must be 
                submitted to us via email at taskmasteroneai@gmail.com as your required first step. You are 
                responsible for promptly notifying us so we can investigate, verify account status, and provide a 
                resolution. If you do not contact us by email, issues may persist (including continued renewals) 
                because we may not be aware of the problem.
              </p>
              <p className="mb-3">
                You agree to make a good-faith effort to resolve billing concerns with us directly before initiating 
                a bank dispute, chargeback, or payment reversal. If you initiate a dispute or chargeback without 
                first emailing us and providing reasonable details (such as account email, invoice/receipt details, 
                dates, and the nature of the issue), we reserve the right to suspend or terminate your access to the 
                Service and/or restrict future purchases, to the extent permitted by law.
              </p>
              <p className="mb-3">
                In the event of a payment dispute or chargeback initiated by you or your bank, we will provide our 
                payment processor (Stripe) and the card issuer with evidence demonstrating that the purchase was 
                made and that you accepted these Terms, including this billing and refund policy, prior to the 
                purchase. This may include account records, login and usage indicators, subscription status, 
                cancellation timestamps (if any), and confirmation screens or emails. The final outcome of any 
                dispute is determined by the card issuer; we cannot guarantee the result.
              </p>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">Delivery and Cancellation</h3>
              <p className="mb-3">
                Upon successful payment, access to the corresponding subscription features is granted promptly, 
                typically within minutes. You will receive an email confirmation. You may cancel your subscription 
                at any time through your account settings or by contacting us. Cancellation takes effect at the end 
                of your current billing period; you will not be charged for subsequent periods and will retain 
                access until the end of that term. No refunds are issued for the remaining period upon cancellation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">8. Limitation of Liability</h2>
              <p className="mb-3">
                To the maximum extent permitted by law, TaskMaster AI shall not be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including loss of profits, data, or other intangible losses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">9. Disclaimer of Warranties</h2>
              <p className="mb-3">
                The Service is provided "as is" and "as available" without warranties of any kind, either express or 
                implied, including but not limited to implied warranties of merchantability, fitness for a particular 
                purpose, and non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">10. Termination</h2>
              <p className="mb-3">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, 
                for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">11. Changes to Terms</h2>
              <p className="mb-3">
                We reserve the right to modify these terms at any time. We will notify users of any material changes 
                via email or through the Service. Continued use of the Service after changes constitutes acceptance 
                of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">12. Contact Information</h2>
              <p className="mb-3">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-text">taskmasteroneai@gmail.com</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
