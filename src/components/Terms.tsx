import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Logo } from './Logo'; // Import the Logo component

function Terms() {
  const { user } = useAuth();

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
    <div className="min-h-screen flex flex-col font-poppins bg-white text-gray-800 dark:bg-[#0C0E1A] dark:text-gray-200 illuminate-override">
      {/* Simple Non-Floating Header with Logo */}
      <header className="w-full py-5 sm:py-6 bg-white dark:bg-[#0C0E1A] illuminate-override">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <Link to="/" aria-label="TaskMaster AI Home">
              <Logo />
            </Link>
            <a
              href={headerButtonLink}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-indigo-500/50 illuminate-button-override"
            >
              {headerButtonText}
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-grow pt-8 sm:pt-10 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 illuminate-text-override">Terms of Service</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 illuminate-subtext-override">Last updated: March 10, 2024</p>
          <hr className="border-gray-200 dark:border-gray-700 mb-10 illuminate-border-override"/>

          <article className="prose prose-lg lg:prose-xl dark:prose-invert max-w-none
                              prose-p:leading-relaxed prose-p:text-gray-700 prose-p:dark:text-gray-300 prose-p:illuminate-prose-text-override
                              prose-strong:font-semibold prose-strong:text-gray-900 prose-strong:dark:text-white prose-strong:illuminate-prose-text-override
                              prose-a:text-indigo-600 prose-a:dark:text-purple-400 prose-a:no-underline hover:prose-a:underline
                              prose-ul:list-disc prose-ul:pl-5 
                              prose-li:marker:text-indigo-500 prose-li:dark:marker:text-purple-500 prose-li:mb-3
                              prose-p:mb-6 prose-h2:mb-6 prose-h3:mb-5
                              illuminate-prose-override">

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Acceptance of Terms</h2>
            <p>Welcome to <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> ("we," "us," or "our"). By accessing or using our website, services, and applications (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, please do not use our Services. We may update these Terms from time to time, and your continued use of the Services constitutes acceptance of those changes.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Description of Service</h2>
            <p><strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> provides AI-powered tools for task management, note-taking, content summarization, and other productivity features. The specific features and functionalities may evolve over time.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">User Accounts</h2>
            <ul>
              <li>
                <p><strong>Registration:</strong> To access certain features of the Services, you may be required to create an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account.</p>
              </li>
              <li>
                <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for any activity that occurs under your account. You agree to notify us immediately of any unauthorized use of your account.</p>
              </li>
            </ul>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Recording Policy</h2>
            <p><strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> emphasizes the importance of upholding legal and institutional regulations concerning the recording and sharing of any content. We require our users to strictly observe the following guidelines:</p>
            <ul>
              <li>
                <p><strong>Compliance with Organizational Policies:</strong> Users must not record or upload any material that contravenes the policies set by their school, college, workplace, university, or instructor, or any other organizational context. It is the responsibility of each user to be fully informed about and comply with their institution’s or organization's rules regarding the recording and distribution of materials.</p>
              </li>
              <li>
                <p><strong>Adherence to Copyright Law:</strong> Users must refrain from recording or uploading any material that is protected by copyright unless they have obtained explicit permission from the copyright holder to do so. This includes text, images, graphics, audio, video, and any other form of copyrighted material.</p>
              </li>
              <li>
                <p><strong>Respecting Privacy and Sensitive Conversations:</strong> Users are prohibited from recording or sharing any sensitive conversations or information that would breach privacy laws and regulations in their jurisdiction, including but not to the United States. This includes private discussions, confidential communications, or any other exchanges that are legally protected against unauthorized recording and dissemination.</p>
              </li>
            </ul>
            <p><strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> does not condone and is not liable for the recording or uploading of any content that is prohibited by institutional policies, copyright law, or privacy laws. Users assume full responsibility for ensuring their conduct on the platform is in full compliance with these laws and policies.</p>
            <p>By utilizing our platform, users agree to indemnify <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> against any legal action taken due to the unauthorized recording or sharing of material. We trust our users to respect intellectual property, privacy, and policy restrictions.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">License to Use TaskMaster AI Content & Services</h2>
            <p>Subject to your adherence to these Terms, <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> grants you a limited, personal, non-exclusive, non-commercial, revocable, and non-transferable license to access and use the content and services provided by <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> ("TaskMaster Content"). The use of the Services is strictly for your personal, non-commercial, or internal business purposes only, as applicable to your subscription or usage tier.</p>
            <p>You agree not to access, copy, record, or procure content or information from the Services through any automated means, including but not to scripts, bots, spiders, crawlers, or scrapers, or employ any data mining technology or processes to frame, mask, extract data, or otherwise obtain materials from the TaskMaster Content, unless you have been specifically permitted to do so in a written agreement with <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong>.</p>
            <p>If you purchase a subscription or a license to access any TaskMaster Content or features, such access is for your individual use (or as defined by your specific license type, e.g., team license) and should not be shared with unauthorized others. <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> may establish reasonable boundaries on your scope of access, which can include limits on time, the number of materials processed, or the number of devices used, to prevent unauthorized use.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">User Conduct and Responsibilities</h2>
            <p>You agree not to use the Services for any unlawful purpose or in any way that interrupts, damages, or impairs the service. Prohibited activities include, but are not to:</p>
            <ul>
              <li>Violating any applicable local, state, national, or international law.</li>
              <li>Transmitting any material that is defamatory, offensive, or otherwise objectionable.</li>
              <li>Attempting to gain unauthorized access to any part of the Services or its related systems or networks.</li>
              <li>Using the Services to store or transmit malicious code.</li>
            </ul>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Intellectual Property Rights</h2>
            <ul>
              <li>
                <p><strong>Our Intellectual Property:</strong> All rights, title, and interest in and to the Services (excluding content provided by users) are and will remain the exclusive property of <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> and its licensors. The Services are protected by copyright, trademark, and other laws of both the United States and foreign countries.</p>
              </li>
              <li>
                <p><strong>User Content:</strong> You retain ownership of any intellectual property rights that you hold in the content you submit to the Services ("User Content"). By submitting User Content, you grant <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> a worldwide, non-exclusive, royalty-free license to use, copy, reproduce, process, adapt, modify, publish, transmit, display, and distribute such User Content in connection with providing and promoting the Services.</p>
              </li>
            </ul>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Fulfillment Policy</h2>
            <p>At <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong>, we are committed to providing our customers with clear and transparent policies regarding refunds, delivery, returns, and cancellations. Our aim is to build trust through fairness and clarity, ensuring a seamless experience for all our users.</p>
            <ul>
              <li>
                <p><strong>Refund Policy:</strong> Our policy permits refunds only if a customer experiences a technical malfunction or issue with our service that we are unable to resolve within a reasonable timeframe. To request a refund, please contact our support team at <a href="mailto:taskmasteroneai@gmail.com">taskmasteroneai@gmail.com</a> within 30 days of your purchase or the occurrence of the unresolved issue, providing detailed information.</p>
              </li>
              <li>
                <p><strong>Delivery of Services:</strong> Upon successful payment for subscription services, access to the corresponding features will be granted promptly, typically within minutes. You will receive an email confirmation of your subscription and access details.</p>
              </li>
              <li>
                <p><strong>Cancellation Policy:</strong> You can cancel your subscription at any time through your account settings or by contacting support. Cancellations will take effect at the end of your current billing period. You will retain access to the paid features until then. No partial refunds are provided for cancellations made mid-billing cycle, except as outlined in our Refund Policy.</p>
              </li>
            </ul>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Termination</h2>
            <p>We may terminate or suspend your access to our Services immediately, without prior notice or liability, for any reason whatsoever, including, without limitation, if you breach the Terms. Upon termination, your right to use the Services will cease immediately.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Disclaimers and Limitation of Liability</h2>
            <p>THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TASKMASTER AI</strong> MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE SERVICES, INCLUDING BUT NOT TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
            <p>IN NO EVENT SHALL <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TASKMASTER AI</strong>, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES, BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICES.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Indemnification</h2>
            <p>You agree to defend, indemnify and hold harmless <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> and its licensee and licensors, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not to attorney's fees), resulting from or arising out of a) your use and access of the Service, by you or any person using your account and password; b) a breach of these Terms, or c) Content posted on the Service.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which <strong className="text-indigo-600 dark:text-purple-400 illuminate-link-override">TaskMaster AI</strong> is based, without regard to its conflict of law provisions.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Changes to Terms</h2>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>

            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white illuminate-text-override mt-12">Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at <a href="mailto:taskmasteroneai@gmail.com">taskmasteroneai@gmail.com</a>.</p>

          </article>
        </div>
      </main>

      <footer className="bg-white dark:bg-[#0C0E1A]  dark:border-gray-800/60 illuminate-override illuminate-border-override">
        <div className="container mx-auto px-5 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4">
              <Link
                to="/privacy-policy"
                className="text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors illuminate-subtext-override dark:illuminate-link-override"
              >
                Privacy Policy
              </Link>
              <span className="text-gray-400 dark:text-gray-700 hidden sm:inline illuminate-subtext-override">|</span>
              <Link
                to="/terms"
                className="text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors illuminate-subtext-override dark:illuminate-link-override"
              >
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-right illuminate-subtext-override">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Terms;