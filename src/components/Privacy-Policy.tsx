import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Logo } from './Logo'; // Import the Logo component

function PrivacyPolicy() {
  const { user } = useAuth(); // Re-added for header button

  useEffect(() => {
    // Instantly scroll to the top of the page on component mount
    window.scrollTo(0, 0);

    const applyTheme = () => {
        const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
        if (isIlluminateEnabled) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        } else {
            document.documentElement.classList.remove('light');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', applyTheme);
    }
  }, []);

  const headerButtonText = user ? "Dashboard" : "Start today - It's Free";
  const headerButtonLink = user ? "/dashboard" : "/signup";

  return (
    <div className="min-h-screen flex flex-col font-clarika bg-[var(--bg-primary)] text-[var(--text-primary)] illuminate-override selection:bg-[var(--bg-accent)] selection:text-white">
      {/* Simple Non-Floating Header with Logo */}
      <header className="w-full py-5 sm:py-6 bg-[var(--bg-primary)] illuminate-override">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <Link to="/" aria-label="TaskMaster AI Home">
              <Logo />
            </Link>
            <a
              href={headerButtonLink}
              className="px-6 py-2.5 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md illuminate-button-override"
            >
              {headerButtonText}
            </a>
          </nav>
        </div>
      </header>
      
      <main className="flex-grow pt-8 sm:pt-10 pb-16"> {/* Adjusted top padding */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] mb-4 illuminate-text-override">Privacy Policy</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-10 illuminate-subtext-override">Last updated: March 10, 2024</p>
          <hr className="border-[var(--border-primary)] mb-10 illuminate-border-override"/>

          <article className="prose prose-lg lg:prose-xl dark:prose-invert max-w-none 
                              prose-p:leading-relaxed prose-p:text-[var(--text-secondary)] prose-p:illuminate-prose-text-override
                              prose-strong:font-semibold prose-strong:text-[var(--text-primary)] prose-strong:illuminate-prose-text-override
                              prose-a:text-[var(--bg-solid-button)] prose-a:no-underline hover:prose-a:underline
                              prose-li:marker:text-[var(--bg-solid-button)]
                              prose-p:mb-6 prose-h2:mb-6 prose-h3:mb-5
                              illuminate-prose-override">
            
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Our Commitment to Privacy</h2>
            <p>At <strong className="text-[var(--bg-solid-button)] illuminate-link-override">TaskMaster AI</strong> ("we," "us," or "our"), we prioritize the privacy of our users. This Privacy Policy outlines how we collect, use, disclose, and safeguard your information when you use our website, services, and applications (collectively, the "Services"). Our goal is to collect only what is necessary to deliver and improve our services effectively while safeguarding your personal details.</p>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--bg-solid-button)] illuminate-link-override mt-10">Minimal Information Collection Philosophy</h3>
            <p>We are committed to a principle of minimal data collection. We aim to gather only the personal information essential for delivering our exceptional services, for legitimate operational purposes, and for improving user experience. Your private information remains confidential within the <strong className="text-[var(--bg-solid-button)] illuminate-link-override">TaskMaster AI</strong> ecosystem and is shielded from unauthorized external entities. We avoid third-party tracking cookies for advertising purposes and ensure that any first-party cookies used are strictly for essential functionality and analytics, without storing unnecessary personal information.</p>
            
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">What Information Does TaskMaster AI Collect?</h2>
            <p>The nature of personal information <strong className="text-[var(--bg-solid-button)] illuminate-link-override">TaskMaster AI</strong> collects varies based on your interactions with our platform:</p>
            <ul>
                <li><strong>Account Information:</strong> When you create an account, we collect information such as your name, email address, password (hashed), and account settings/preferences.</li>
                <li><strong>Contact Information:</strong> If you contact us for support or other inquiries, we collect your name, email address, and the content of your communication.</li>
                <li><strong>Payment and Transaction Information:</strong> If you subscribe to paid services, we (or our third-party payment processors) collect details necessary to process your payment, such as billing address, payment method details, and transaction history. We do not store full credit card numbers on our servers.</li>
                <li><strong>Content You Provide ("User Content"):</strong> Any files (audio, video, PDF), text, tasks, notes, or other data you upload, input, or generate while using the Services (e.g., for note generation, summarization, flashcards, quizzes, chatbot interaction).</li>
                <li><strong>Usage Information:</strong> Data on how you engage with our Services, such as features used, actions taken, session duration, interaction patterns, performance metrics, error reports, and diagnostic information. This helps us understand service usage and improve functionality.</li>
                <li><strong>Device and Technical Information:</strong> IP address, browser type and version, operating system, device identifiers, screen resolution, language preferences, and other technical data collected automatically when you access our Services.</li>
                <li><strong>Cookies and Similar Technologies:</strong> Information collected through cookies and other tracking technologies as described in Section 4.</li>
                <li><strong>Other Provided Information:</strong> Any additional details you voluntarily convey to us, including through surveys, customer support interactions, or feedback forms.</li>
            </ul>
            <p><em>Note: Providing personal information is not always obligatory, but a lack of it may affect our ability to offer you certain services or respond to your inquiries effectively.</em></p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">How We Use Your Information</h2>
            <p>We use the information we collect for various purposes, including:</p>
            <ul>
                <li><strong>To Provide and Maintain Our Services:</strong> To operate our platform, process your inputs, generate outputs, authenticate users, and fulfill your requests.</li>
                <li><strong>To Improve and Personalize Our Services:</strong> To understand user needs, customize content and features, develop new offerings, and enhance user experience.</li>
                <li><strong>To Communicate With You:</strong> To send service-related announcements, updates, security alerts, support messages, and respond to your inquiries. We may also send marketing communications if you opt-in.</li>
                <li><strong>To Process Transactions:</strong> To manage subscriptions, process payments, and prevent fraudulent transactions.</li>
                <li><strong>For Security and Compliance:</strong> To protect the security and integrity of our Services, prevent abuse, enforce our Terms of Service, and comply with legal obligations.</li>
                <li><strong>For Analytics and Research:</strong> To analyze trends, monitor usage patterns, and conduct research to improve our Services. Aggregated and anonymized data may be used for these purposes.</li>
            </ul>
            
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Cookies and Other Tracking Technologies</h2>
            <p><strong className="text-[var(--bg-solid-button)] illuminate-link-override">TaskMaster AI</strong>'s digital ecosystem—spanning our website, online services, and interactive applications—may use "cookies" and other technologies like pixel tags or web beacons for functionality, analytics, and user experience enhancement. We avoid third-party cookies for cross-site tracking or advertising.</p>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--bg-solid-button)] illuminate-link-override mt-10">Types of Cookies We Use:</h3>
            <ul>
                <li><strong>Essential Cookies:</strong> Necessary for the basic functioning of the Services, such as session management and security.</li>
                <li><strong>Performance and Analytics Cookies:</strong> Help us understand how users interact with our Services, allowing us to improve performance and user experience (e.g., Google Analytics). These cookies collect information in an aggregated and anonymous form.</li>
                <li><strong>Functionality Cookies:</strong> Remember your preferences (like language or theme settings) to provide a more personalized experience.</li>
            </ul>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--bg-solid-button)] illuminate-link-override mt-10">Your Choices Regarding Cookies:</h3>
            <p>Most web browsers are set to accept cookies by default. You can usually modify your browser settings to decline cookies or to alert you when cookies are being sent. However, if you disable cookies, some parts of our Services may not function properly.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information in the following limited circumstances:</p>
            <ul>
                <li><strong>With Service Providers:</strong> We may share information with third-party vendors, consultants, and other service providers who perform services on our behalf (e.g., payment processing, data hosting, analytics, customer support). These providers are contractually obligated to protect your information and use it only for the purposes for which it was disclosed.</li>
                <li><strong>For Legal Reasons:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency), or if we believe in good faith that disclosure is necessary to protect our rights, protect your safety or the safety of others, investigate fraud, or respond to a government request.</li>
                <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, reorganization, bankruptcy, or sale of all or a portion of our assets, your information may be transferred as part of that transaction. We will notify you via email and/or a prominent notice on our Services of any change in ownership or uses of your personal information.</li>
                <li><strong>With Your Consent:</strong> We may share your information with third parties when we have your explicit consent to do so.</li>
                <li><strong>Aggregated or Anonymized Data:</strong> We may share aggregated or anonymized information that does not directly identify you for research, marketing, analytics, or other purposes.</li>
            </ul>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Data Security</h2>
            <p>We implement reasonable administrative, technical, and physical security measures designed to protect your personal information from unauthorized access, use, alteration, and disclosure. These measures include encryption, access controls, and secure development practices. However, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Data Retention</h2>
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. This includes retaining information to provide you with the Services, comply with our legal obligations, resolve disputes, and enforce our agreements. User Content is generally retained as long as your account is active or as needed to provide you services, and may be deleted upon account closure or inactivity according to our policies.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Your Rights and Choices</h2>
            <p>Depending on your jurisdiction, you may have certain rights regarding your personal information, including:</p>
            <ul>
                <li><strong>Access:</strong> The right to request access to the personal information we hold about you.</li>
                <li><strong>Correction:</strong> The right to request correction of inaccurate or incomplete personal information.</li>
                <li><strong>Deletion:</strong> The right to request deletion of your personal information, subject to certain exceptions.</li>
                <li><strong>Opt-out of Communications:</strong> You can opt-out of receiving promotional emails from us by following the unsubscribe instructions in those emails. You may still receive transactional or service-related communications.</li>
                <li><strong>Cookie Controls:</strong> As described in Section 4, you can manage your cookie preferences through your browser settings.</li>
            </ul>
            <p>To exercise these rights, please contact us using the details provided in Section 11.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">International Data Transfers</h2>
            <p>Your information, including personal data, may be transferred to — and maintained on — computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those in your jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we transfer the data, including personal data, to the United States and process it there. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Children's Privacy</h2>
            <p>Our Services are not directed to individuals under the age of 13 (or a higher age threshold depending on applicable law). We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information without parental consent, we will take steps to delete such information. If you believe we might have any information from or about a child, please contact us.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] illuminate-text-override mt-12">Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at: <a href="mailto:taskmasteroneai@gmail.com" className="illuminate-link-override">taskmasteroneai@gmail.com</a></p>

          </article>
        </div>
      </main>

      <footer className="bg-[var(--bg-primary)] illuminate-override illuminate-border-override">
        <div className="container mx-auto px-5 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4">
              <Link 
                to="/privacy-policy" 
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--bg-solid-button)] transition-colors illuminate-subtext-override dark:illuminate-link-override"
              >
                Privacy Policy
              </Link>
              <span className="text-[var(--border-primary)] hidden sm:inline illuminate-subtext-override">|</span>
              <Link 
                to="/terms" 
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--bg-solid-button)] transition-colors illuminate-subtext-override dark:illuminate-link-override"
              >
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-[var(--text-secondary)] text-center md:text-right">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PrivacyPolicy;
