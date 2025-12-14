import { motion } from 'framer-motion'

export default function Privacy() {
  return (
    <div className="relative py-12 sm:py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-text-muted mb-8">Last updated: December 12, 2024</p>

          <div className="space-y-8 text-text-muted">
            <section>
              <h2 className="text-xl font-semibold text-text mb-3">1. Introduction</h2>
              <p className="mb-3">
                TaskMaster AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-text mt-4 mb-2">2.1 Information You Provide</h3>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Email address, name, and password when you create an account</li>
                <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe)</li>
                <li><strong>API Keys:</strong> Third-party API keys you choose to store in our secure vault</li>
                <li><strong>Content:</strong> PRDs, tasks, and other content you create using the Service</li>
              </ul>

              <h3 className="text-lg font-medium text-text mt-4 mb-2">2.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Usage Data:</strong> How you interact with the Service, features used, and actions taken</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                <li><strong>Log Data:</strong> IP address, access times, and pages viewed</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">3. How We Use Your Information</h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-2">
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
              <h2 className="text-xl font-semibold text-text mb-3">4. Data Security</h2>
              <p className="mb-3">
                We implement appropriate technical and organizational security measures to protect your data:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Encryption:</strong> All data is encrypted in transit (TLS) and at rest</li>
                <li><strong>API Key Security:</strong> Your API keys are encrypted using industry-standard encryption</li>
                <li><strong>Access Controls:</strong> Strict access controls and authentication mechanisms</li>
                <li><strong>Regular Audits:</strong> Security practices are regularly reviewed and updated</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">5. Data Sharing and Disclosure</h2>
              <p className="mb-3">We do not sell your personal information. We may share your information:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>With Service Providers:</strong> Third parties that help us operate the Service (hosting, payment processing)</li>
                <li><strong>For Legal Reasons:</strong> When required by law or to protect rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">6. Third-Party AI Providers</h2>
              <p className="mb-3">
                When you use third-party AI providers through our Service (e.g., Anthropic, OpenAI, Google):
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Your prompts and content are sent to these providers to process your requests</li>
                <li>Each provider has their own privacy policy governing how they handle your data</li>
                <li>We recommend reviewing each provider's privacy policy</li>
                <li>We do not store the content of your AI interactions beyond what's necessary to provide the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">7. Your Rights and Choices</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Export:</strong> Export your data in a portable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, contact us at taskmasteroneai@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">8. Data Retention</h2>
              <p className="mb-3">
                We retain your information for as long as your account is active or as needed to provide you services. 
                We will retain and use your information as necessary to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Comply with legal obligations</li>
                <li>Resolve disputes</li>
                <li>Enforce our agreements</li>
              </ul>
              <p className="mt-3">
                When you delete your account, we will delete or anonymize your data within 30 days, except where 
                retention is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">9. Cookies and Tracking</h2>
              <p className="mb-3">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Understand how you use the Service</li>
                <li>Improve the Service</li>
              </ul>
              <p className="mt-3">
                You can control cookies through your browser settings, though some features may not work properly 
                if you disable them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">10. Children's Privacy</h2>
              <p className="mb-3">
                The Service is not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13. If we learn we have collected such information, we will delete 
                it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">11. International Data Transfers</h2>
              <p className="mb-3">
                Your information may be transferred to and processed in countries other than your own. We ensure 
                appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">12. Changes to This Policy</h2>
              <p className="mb-3">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                the new Privacy Policy on this page and updating the "Last updated" date. Material changes will be 
                communicated via email or through the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text mb-3">13. Contact Us</h2>
              <p className="mb-3">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none space-y-1">
                <li><strong>Email:</strong> taskmasteroneai@gmail.com</li>
                <li><strong>Address:</strong> TaskMaster AI LLC</li>
              </ul>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
