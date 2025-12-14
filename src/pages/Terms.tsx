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
          <p className="text-text-muted mb-8">Last updated: December 12, 2025</p>

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
              <h2 className="text-xl font-semibold text-text mb-3">7. Subscription and Payments</h2>
              <p className="mb-3">
                Certain features of the Service require a paid subscription. By subscribing:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You authorize us to charge your payment method on a recurring basis</li>
                <li>You can cancel your subscription at any time</li>
                <li>Refunds are provided in accordance with our refund policy</li>
                <li>Prices may change with 30 days notice</li>
              </ul>
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
