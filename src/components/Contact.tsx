import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Adjust path if needed
import { Loader2, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { subscribeToAuthState } from '../lib/pricing-firebase'; // Adjust path if needed
import { Logo } from './Logo'; // Adjust path if needed
import { saveContactMessage } from '../lib/contact-firebase'; // Adjust path if needed
import { motion, AnimatePresence } from 'framer-motion'; // Import motion and AnimatePresence

interface FormData {
  step: number;
  name: string;
  email: string;
  inquiryType: string;
  subscriptionPlan: string; // Keep these specific fields for subscription type
  planQuestion: string;
  cancellationIssue: string;
  billingIssue: string;
  planChange: string;
  message: string; // Generic message for other types
}

// --- Initial Form State ---
const initialFormData: FormData = {
  step: 1,
  name: '',
  email: '',
  inquiryType: '',
  subscriptionPlan: '',
  planQuestion: '',
  cancellationIssue: '',
  billingIssue: '',
  planChange: '',
  message: ''
};

function Contact() {
  const { loading } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null); // Add error state

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      // Pre-fill email if user is logged in and email is empty
      if (firebaseUser && !formData.email) {
          setFormData(prev => ({ ...prev, email: firebaseUser.email || '' }));
      }
       // Pre-fill name if user is logged in and name is empty (if displayName exists)
       if (firebaseUser && !formData.name && firebaseUser.displayName) {
          setFormData(prev => ({ ...prev, name: firebaseUser.displayName }));
       }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Rerun if user changes (e.g., logs in after page load)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
    // Clear submission error when user types
    if (submitError) setSubmitError(null);
  };

  const nextStep = () => {
    // Basic validation for step 1
    if (!formData.name || !formData.email || !formData.inquiryType) return; // Or show inline errors
    setFormData(prev => ({ ...prev, step: prev.step + 1 }));
  };

  const prevStep = () => {
    setFormData(prev => ({ ...prev, step: prev.step - 1 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation for step 2
    if (!formData.message && formData.inquiryType !== 'subscription') {
        setSubmitError("Please provide details in the message field.");
        return;
    }
     // Add more specific validation for subscription step if needed
     if (formData.inquiryType === 'subscription' && !formData.subscriptionPlan) {
        setSubmitError("Please select your subscription plan.");
        return;
     }

    setIsSubmitting(true);
    setIsSuccess(false);
    setSubmitError(null); // Clear previous errors

    try {
      await saveContactMessage({
        ...formData,
        userId: user?.uid || null,
        timestamp: new Date() // Add timestamp for sorting/reference
      });
      setIsSuccess(true);
      // Reset form fields *after* showing success, or let the 'Send Another' button do it.
      // setFormData(initialFormData); - Moved to resetForm function
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setFormData(initialFormData);
    // Re-populate email/name if user is logged in
    if (user) {
        setFormData(prev => ({
            ...prev,
            email: user.email || '',
            name: user.displayName || ''
        }));
    }
  };

  // --- Framer Motion Variants (Similar to Pricing.tsx) ---
  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const mainContentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2, ease: 'easeOut' } }
  };

  const successVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'backOut' } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2, ease: 'easeIn' } }
  };

  const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  // --- Input/Select/Textarea Base Classes ---
  const inputBaseClasses = "w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-600/50 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors placeholder-gray-500";
  const selectClasses = `${inputBaseClasses} appearance-none`; // Add appearance-none for custom arrow maybe later
  const textareaClasses = `${inputBaseClasses} rounded-xl`; // Slightly different rounding for textarea

  // --- Render Form Steps ---
  const renderStep1 = () => (
    <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
      <div className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input type="text" id="name" value={formData.name} onChange={handleChange} className={inputBaseClasses} placeholder="Your Full Name" required disabled={isSubmitting} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input type="email" id="email" value={formData.email} onChange={handleChange} className={inputBaseClasses} placeholder="your.email@example.com" required disabled={isSubmitting} />
        </div>
        <div>
          <label htmlFor="inquiryType" className="block text-sm font-medium text-gray-300 mb-1">
            Inquiry Type <span className="text-red-500">*</span>
          </label>
          <select id="inquiryType" value={formData.inquiryType} onChange={handleChange} className={selectClasses} required disabled={isSubmitting}>
            <option value="" disabled>Select an inquiry type...</option>
            <option value="general">General Inquiry</option>
            <option value="subscription">Subscription/Payment Help</option>
            <option value="technical">Technical Support</option>
            <option value="feature">Feature Request</option>
            <option value="feedback">Feedback/Suggestions</option>
          </select>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <div className="space-y-6">
        {/* Conditionally render subscription fields */}
        {formData.inquiryType === 'subscription' && (
          <>
            <div>
              <label htmlFor="subscriptionPlan" className="block text-sm font-medium text-gray-300 mb-1">
                Which Subscription Plan? <span className="text-red-500">*</span>
              </label>
              <select id="subscriptionPlan" value={formData.subscriptionPlan} onChange={handleChange} className={selectClasses} required disabled={isSubmitting}>
                <option value="" disabled>Select your plan...</option>
                <option value="pro">Pro Plan</option>
                <option value="premium">Premium Plan</option>
                <option value="not-subscribed">Not Currently Subscribed</option>
                <option value="not-sure">Not Sure / Other</option>
              </select>
            </div>

            {/* Combined "Issue" field for subscription */}
            <div>
              <label htmlFor="subscriptionIssue" className="block text-sm font-medium text-gray-300 mb-1">
                What is the issue regarding your subscription?
              </label>
              <select id="subscriptionIssue" value={formData.cancellationIssue || formData.billingIssue || formData.planChange} // Use combined value or separate states? Let's stick to original fields for now, just group UI
                onChange={(e) => {
                    // Reset other subscription issues when one is selected
                    const value = e.target.value;
                    const isCancellation = ['find-cancel', 'not-processed', 'unexpected-charges'].includes(value);
                    const isBilling = ['failed-payment', 'incorrect-charge', 'refund', 'invoice'].includes(value);
                    const isPlanChange = ['upgrade-premium', 'downgrade-pro', 'switch-annual', 'switch-monthly'].includes(value);

                    setFormData(prev => ({
                        ...prev,
                        cancellationIssue: isCancellation ? value : '',
                        billingIssue: isBilling ? value : '',
                        planChange: isPlanChange ? value : '',
                    }));
                }}
                className={selectClasses} disabled={isSubmitting}>
                <option value="">Select the main issue (optional)...</option>
                <optgroup label="Cancellation">
                  <option value="find-cancel">Unable to find the cancel option</option>
                  <option value="not-processed">Cancel request not processed</option>
                  <option value="unexpected-charges">Unexpected charges after cancellation</option>
                </optgroup>
                 <optgroup label="Billing & Payments">
                  <option value="failed-payment">Failed Payments</option>
                  <option value="incorrect-charge">Incorrect Charges</option>
                  <option value="refund">Refund Request</option>
                  <option value="invoice">Invoice/Receipt Request</option>
                 </optgroup>
                 <optgroup label="Plan Changes">
                  <option value="upgrade-premium">Upgrade from Pro to Premium</option>
                  <option value="downgrade-pro">Downgrade from Premium to Pro</option>
                  <option value="switch-annual">Switch from Monthly to Annual Billing</option>
                  <option value="switch-monthly">Switch from Annual to Monthly Billing</option>
                 </optgroup>
                 <option value="other-sub">Other Subscription Issue</option>
              </select>
            </div>
             {/* Decided against the separate planQuestion field to simplify, user can put details in main message */}
          </>
        )}

        {/* Main Message Field */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
            {formData.inquiryType === 'subscription' ? 'Additional Details' : 'Your Message'} <span className="text-red-500">*</span>
          </label>
          <textarea id="message" value={formData.message} onChange={handleChange} className={textareaClasses} rows={6} placeholder="Please provide as much detail as possible..." required disabled={isSubmitting} />
        </div>
      </div>
    </motion.div>
  );


  // --- Main Component Return ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 font-poppins text-gray-200">
      {/* --- START: NAV (Animated like Pricing) --- */}
      <motion.header
        className="fixed w-full bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 z-50"
        variants={headerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <a href="/">
              <Logo />
            </a>
            {/* Hamburger Menu Button */}
            <button className="md:hidden text-gray-300 hover:text-indigo-400 focus:outline-none" onClick={toggleMenu} aria-label="Toggle menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors">Features</a>
              <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors">Pricing</a>
              <a href="/contact" className="font-semibold text-indigo-400">Contact</a> {/* Highlight current page */}
              <motion.a
                href={user ? "/dashboard" : "/signup"}
                className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-medium"
                variants={buttonVariants} whileHover="hover" whileTap="tap"
              >
                {user ? "Dashboard" : "Get Started"}
              </motion.a>
            </div>
            {/* Mobile Navigation */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className={`absolute top-full left-0 right-0 bg-gray-900/95 border-b border-gray-800 md:hidden overflow-hidden`}
                >
                  <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
                    <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors block px-2 py-1" onClick={toggleMenu}>Features</a>
                    <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors block px-2 py-1" onClick={toggleMenu}>Pricing</a>
                    <a href="/contact" className="font-semibold text-indigo-400 block px-2 py-1" onClick={toggleMenu}>Contact</a>
                    <a href={user ? "/dashboard" : "/signup"} className="mt-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-center transition-all transform hover:scale-105 block" onClick={toggleMenu}>
                      {user ? "Dashboard" : "Get Started Today"}
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </div>
      </motion.header>
      {/* --- END: NAV --- */}

      {/* --- START: Main Content (Animated) --- */}
      <main className="flex-grow container mx-auto px-4 pt-28 sm:pt-32 pb-12">
        <motion.div
          className="max-w-2xl mx-auto" // Slightly narrower for contact form
          variants={mainContentVariants}
          initial="hidden"
          animate="visible"
        >
          {/* --- Page Heading --- */}
          <div className="text-center mb-10">
            <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 mb-3">Get In Touch</h1>
            <p className="text-gray-400 text-lg">We're here to help. Fill out the form below.</p>
          </div>

          {/* --- Form/Success Container --- */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/90 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-700/50">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                // --- Success Message (Animated) ---
                <motion.div
                  key="success"
                  variants={successVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-center py-8"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-5" />
                  <h2 className="text-2xl font-semibold text-white mb-2">Message Sent!</h2>
                  <p className="text-gray-300 mb-8">Thanks for reaching out. We'll review your message and get back to you shortly.</p>
                  <motion.button
                    onClick={resetForm}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    variants={buttonVariants} whileHover="hover" whileTap="tap"
                  >
                    Send Another Message
                  </motion.button>
                </motion.div>
              ) : (
                // --- Form (Animated Steps) ---
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 1 }} /* No need for entry animation here, step handles it */
                  exit={{ opacity: 0 }}
                >
                  {/* Step Indicator (Optional but helpful) */}
                  <div className="mb-6 text-center text-sm text-gray-400">
                    Step {formData.step} of 2
                  </div>

                  {/* Animated Steps */}
                  <AnimatePresence mode="wait">
                    {formData.step === 1 ? renderStep1() : renderStep2()}
                  </AnimatePresence>

                  {/* Submission Error */}
                   {submitError && (
                     <motion.div
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="mt-4 text-center text-sm text-red-400 bg-red-900/30 border border-red-800/50 rounded-lg p-3"
                     >
                       {submitError}
                     </motion.div>
                   )}


                  {/* --- Navigation Buttons --- */}
                  <div className={`flex mt-8 ${formData.step > 1 ? 'justify-between' : 'justify-end'}`}>
                    {formData.step > 1 && (
                      <motion.button
                        type="button"
                        onClick={prevStep}
                        className="flex items-center gap-2 px-6 py-3 text-gray-300 hover:text-white transition-colors disabled:opacity-50 rounded-full font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                        disabled={isSubmitting}
                        variants={buttonVariants} whileHover="hover" whileTap="tap"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Previous
                      </motion.button>
                    )}

                    {formData.step === 1 ? (
                      <motion.button
                        type="button"
                        onClick={nextStep}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                        // Basic client-side validation for enabling next
                        disabled={!formData.name || !formData.email || !formData.inquiryType || isSubmitting}
                        variants={buttonVariants} whileHover="hover" whileTap="tap"
                      >
                        Next
                        <ArrowRight className="w-5 h-5" />
                      </motion.button>
                    ) : (
                      <motion.button
                        type="submit"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-800 min-w-[150px]" // Min width to prevent size jump
                        disabled={isSubmitting || (!formData.message && formData.inquiryType !== 'subscription') || (formData.inquiryType === 'subscription' && !formData.subscriptionPlan) }
                        variants={buttonVariants} whileHover="hover" whileTap="tap"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send Message'
                        )}
                      </motion.button>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
      {/* --- END: Main Content --- */}


      {/* --- START: FOOTER (Matches Pricing) --- */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-auto py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <div className="mb-4">
            <a href="/privacy-policy" className="text-sm hover:text-indigo-400 px-3 transition-colors">Privacy Policy</a>
            <span className="text-gray-600">|</span>
            <a href="/terms" className="text-sm hover:text-indigo-400 px-3 transition-colors">Terms & Conditions</a>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
          </p>
        </div>
      </footer>
      {/* --- END: FOOTER --- */}
    </div>
  );
}

export default Contact;
