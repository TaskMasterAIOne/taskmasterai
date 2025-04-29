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
  subscriptionPlan: string;
  planQuestion: string; // Keeping original fields
  cancellationIssue: string;
  billingIssue: string;
  planChange: string;
  message: string;
}

// --- Initial Form State (Matches original structure) ---
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
  const { loading } = useAuth(); // Use 'loading' from original context
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false); // Keep original nav toggle state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null); // Add error state

  const toggleMenu = () => setIsOpen(!isOpen); // Keep original nav toggle function

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      // Pre-fill email/name logic from refined version
      if (firebaseUser && !formData.email) {
          setFormData(prev => ({ ...prev, email: firebaseUser.email || '' }));
      }
       if (firebaseUser && !formData.name && firebaseUser.displayName) {
          setFormData(prev => ({ ...prev, name: firebaseUser.displayName }));
       }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keep dependency array minimal

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
    if (submitError) setSubmitError(null); // Clear error on change
  };

  // nextStep/prevStep logic kept from refined version
  const nextStep = () => {
    if (!formData.name || !formData.email || !formData.inquiryType) return; // Simple validation
    setFormData(prev => ({ ...prev, step: prev.step + 1 }));
  };

  const prevStep = () => {
    setFormData(prev => ({ ...prev, step: prev.step - 1 }));
  };

  // handleSubmit logic kept from refined version
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     // Basic validation for step 2 message field
    if (formData.step === 2 && !formData.message && formData.inquiryType !== 'subscription') {
        setSubmitError("Please provide details in the message field.");
        return;
    }
     // Example: More specific validation for subscription step if needed
     if (formData.step === 2 && formData.inquiryType === 'subscription' && !formData.subscriptionPlan) {
        setSubmitError("Please select your subscription plan for subscription inquiries.");
        return;
     }

    setIsSubmitting(true);
    setIsSuccess(false);
    setSubmitError(null);

    try {
      await saveContactMessage({
        ...formData,
        userId: user?.uid || null,
        timestamp: new Date() // Keep timestamp
      });
      setIsSuccess(true);
      // Don't reset form data here, let the success message button do it
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // resetForm logic kept from refined version
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

  // --- Framer Motion Variants (Same as refined version, matches Pricing's style) ---
  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  // Adjusted delay to match original Pricing page feel if needed
  const mainContentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1, ease: 'easeOut' } } // Slightly faster delay
  };

  // Using similar success animation
  const successVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'backOut' } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2, ease: 'easeIn' } }
  };

  // Simple scale effect for buttons like OLD pricing
  const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  // Step transition variants
   const stepVariants = {
     hidden: (direction: number) => ({ opacity: 0, x: direction > 0 ? 50 : -50 }),
     visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
     exit: (direction: number) => ({ opacity: 0, x: direction < 0 ? 50 : -50, transition: { duration: 0.3, ease: 'easeInOut' } })
   };

  // --- Revert to ORIGINAL styles ---
  const inputBaseClasses = "w-full bg-gray-900 border border-gray-700 rounded-full px-6 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"; // Original
  const textareaClasses = "w-full bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"; // Original
  const selectClasses = inputBaseClasses; // Original used same style

  // --- Render Form Steps (Using original structure/fields/styles) ---
  const renderStep1 = () => (
     <motion.div
       key="step1"
       custom={1} // Direction for animation
       variants={stepVariants}
       initial="hidden"
       animate="visible"
       exit="exit"
     >
      {/* Original structure and classes */}
      <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm text-gray-300 mb-2">Name <span className="text-red-500">*</span></label>
            <input type="text" id="name" value={formData.name} onChange={handleChange} className={inputBaseClasses} placeholder="Your Name" required disabled={isSubmitting}/>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm text-gray-300 mb-2">Email <span className="text-red-500">*</span></label>
            <input type="email" id="email" value={formData.email} onChange={handleChange} className={inputBaseClasses} placeholder="Your Email" required disabled={isSubmitting}/>
          </div>
          <div>
            <label htmlFor="inquiryType" className="block text-sm text-gray-300 mb-2">Inquiry Type <span className="text-red-500">*</span></label>
            <select id="inquiryType" value={formData.inquiryType} onChange={handleChange} className={selectClasses} required disabled={isSubmitting}>
              {/* Original options */}
              <option value="" disabled>Select Inquiry Type</option>
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
     <motion.div
       key="step2"
       custom={1} // Direction for animation
       variants={stepVariants}
       initial="hidden"
       animate="visible"
       exit="exit"
     >
       {/* Original structure and classes */}
       <div className="space-y-6">
          {formData.inquiryType === 'subscription' && (
            <>
              <div>
                <label htmlFor="subscriptionPlan" className="block text-sm text-gray-300 mb-2">Subscription Plan <span className="text-red-500">*</span></label>
                <select id="subscriptionPlan" value={formData.subscriptionPlan} onChange={handleChange} className={selectClasses} required={formData.inquiryType === 'subscription'} disabled={isSubmitting}>
                  <option value="">Select Your Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="premium">Premium Plan</option>
                  <option value="not-subscribed">Not Currently Subscribed</option> {/* Added this option based on refinement */}
                  <option value="not-sure">Not Sure</option>
                </select>
              </div>
               {/* Reverted back to individual optional fields as per original UI */}
               <div>
                 <label htmlFor="planQuestion" className="block text-sm text-gray-300 mb-2">Question about plan? (Optional)</label>
                 <textarea id="planQuestion" value={formData.planQuestion} onChange={handleChange} className={textareaClasses} rows={3} disabled={isSubmitting}/>
               </div>
               <div>
                 <label htmlFor="cancellationIssue" className="block text-sm text-gray-300 mb-2">Cancellation Issue? (Optional)</label>
                 <select id="cancellationIssue" value={formData.cancellationIssue} onChange={handleChange} className={selectClasses} disabled={isSubmitting}>
                   <option value="">Select Issue (if applicable)</option>
                   <option value="find-cancel">Unable to find the cancel option</option>
                   <option value="not-processed">Cancel request not processed</option>
                   <option value="unexpected-charges">Unexpected charges after cancellation</option>
                 </select>
               </div>
               <div>
                 <label htmlFor="billingIssue" className="block text-sm text-gray-300 mb-2">Billing/Payment Issue? (Optional)</label>
                 <select id="billingIssue" value={formData.billingIssue} onChange={handleChange} className={selectClasses} disabled={isSubmitting}>
                   <option value="">Select Billing Issue (if applicable)</option>
                   <option value="failed-payment">Failed Payments</option>
                   <option value="incorrect-charge">Incorrect Charges</option>
                   <option value="refund">Refund Request</option>
                   <option value="invoice">Invoice/Receipt Request</option>
                 </select>
               </div>
               <div>
                 <label htmlFor="planChange" className="block text-sm text-gray-300 mb-2">Plan Change Request? (Optional)</label>
                 <select id="planChange" value={formData.planChange} onChange={handleChange} className={selectClasses} disabled={isSubmitting}>
                   <option value="">Select Plan Change (if applicable)</option>
                   <option value="upgrade-premium">Upgrade from Pro to Premium</option>
                   <option value="downgrade-pro">Downgrade from Premium to Pro</option>
                   <option value="switch-annual">Switch from Monthly to Annual Billing</option>
                   <option value="switch-monthly">Switch from Annual to Monthly Billing</option>
                 </select>
               </div>
            </>
          )}

          {/* Original Message Field */}
          <div>
            <label htmlFor="message" className="block text-sm text-gray-300 mb-2">
                {formData.inquiryType === 'subscription' ? 'Additional Details' : 'Your Message'} <span className="text-red-500">*</span>
            </label>
            <textarea id="message" value={formData.message} onChange={handleChange} className={textareaClasses} rows={6} placeholder="Please provide any additional details..." required disabled={isSubmitting}/>
          </div>
       </div>
     </motion.div>
  );

  // --- Loading State (Original) ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // --- Main Component Return ---
  return (
    // Base structure and classes from ORIGINAL code
    <div className="flex flex-col min-h-screen bg-gray-900 font-poppins">
      {/* --- START: NAV (Animated like Pricing, Original Structure) --- */}
      <motion.header
        className="fixed w-full bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 z-50"
        variants={headerVariants} // Use the shared variants
        initial="hidden"
        animate="visible"
      >
        {/* Original Nav Structure */}
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <a href="/">
              <Logo />
            </a>
            {/* Hamburger Menu Button */}
            <button className="md:hidden text-gray-300 hover:text-indigo-400 focus:outline-none" onClick={toggleMenu} aria-label="Toggle menu">
              <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            {/* Desktop Navigation (Original structure) */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors">Features</a>
              <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors">Pricing</a>
              <a href="/contact" className="text-gray-300 hover:text-indigo-400 transition-colors">Pricing</a>
              {/* Use motion.a for hover/tap effect, original classes */}
              <motion.a
                href={user ? "/dashboard" : "/signup"}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full transition-all transform" // Removed hover:scale-105, handled by motion
                variants={buttonVariants} whileHover="hover" whileTap="tap"
              >
                {user ? "Dashboard" : "Get Started Today"}
              </motion.a>
            </div>
            {/* Mobile Navigation (Original structure, animated container) */}
             {/* Using AnimatePresence for smoother toggle */}
             <AnimatePresence>
                 {isOpen && (
                   <motion.div
                     initial={{ opacity: 0, y: -10 }} // Simple fade/slide down
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     transition={{ duration: 0.2 }}
                     // Original classes for positioning and style
                     className={`absolute top-full left-0 right-0 bg-gray-900/95 border-b border-gray-800 md:hidden`}
                   >
                     <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
                       <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors" onClick={toggleMenu}>Features</a>
                       <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors" onClick={toggleMenu}>Pricing</a>
                       <a href="/contact" className="font-semibold text-indigo-400" onClick={toggleMenu}>Contact</a>
                       <a href={user ? "/dashboard" : "/signup"} className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-center transition-all transform hover:scale-105" onClick={toggleMenu}>
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

      {/* --- START: Main Content (Animated like Pricing, Original Structure) --- */}
      {/* Added motion.main wrapper */}
      <motion.main
        className="flex-grow container mx-auto px-4 pt-28 pb-12" // Original classes
        variants={mainContentVariants} // Use shared variants
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-3xl mx-auto"> {/* Original max-width */}
          {/* Original Heading */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-indigo-400 mb-2">Contact Us</h1>
            <p className="text-gray-300">We're here to help with any questions or concerns.</p>
          </div>

          {/* --- Form/Success Container --- */}
          {/* Using AnimatePresence for the switch between form and success */}
          <AnimatePresence mode="wait">
            {isSuccess ? (
              // --- Success Message (Animated, Original Styling) ---
              <motion.div
                key="success"
                variants={successVariants} // Use success animation
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-gray-800 rounded-2xl p-8 text-center" // Original container style
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-white mb-2">Message Sent Successfully!</h2>
                <p className="text-gray-300 mb-6">We'll get back to you as soon as possible.</p>
                {/* Button styled like original form buttons */}
                <motion.button
                  onClick={resetForm}
                  className="px-6 py-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors" // Original button style
                  variants={buttonVariants} whileHover="hover" whileTap="tap"
                >
                  Send Another Message
                </motion.button>
              </motion.div>
            ) : (
              // --- Form (Original structure, animated steps) ---
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="bg-gray-800 rounded-2xl p-8" // Original container style
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }} // Fade out form on success
              >
                 {/* Use AnimatePresence for step transitions */}
                 <AnimatePresence mode="wait" custom={formData.step === 1 ? 1 : -1}>
                    {formData.step === 1 ? renderStep1() : renderStep2()}
                 </AnimatePresence>


                 {/* Submission Error Display (kept from refined, styled subtly) */}
                 {submitError && (
                   <motion.div
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     className="mt-4 text-center text-sm text-red-400"
                   >
                     {submitError}
                   </motion.div>
                 )}


                {/* --- Navigation Buttons (Original structure/styles, motion effects) --- */}
                <div className="flex justify-between mt-8">
                  {/* Previous Button - Conditionally rendered */}
                   <div className="w-1/3"> {/* Add placeholder div to maintain spacing */}
                      {formData.step > 1 && (
                        <motion.button
                          type="button"
                          onClick={prevStep}
                          // Original classes + flex for icon
                          className="flex items-center px-6 py-3 text-gray-300 hover:text-white transition-colors disabled:opacity-50 rounded-full" // Rounded added
                          disabled={isSubmitting}
                          variants={buttonVariants} whileHover="hover" whileTap="tap"
                        >
                          <ArrowLeft className="w-5 h-5 mr-2" /> {/* Original icon placement */}
                          Previous
                        </motion.button>
                      )}
                   </div>

                  {/* Next / Submit Button */}
                   <div className="w-1/3 flex justify-end"> {/* Use flex-end for right alignment */}
                     {formData.step === 1 ? (
                       <motion.button
                         type="button"
                         onClick={nextStep}
                         // Original classes + flex for icon
                         className="flex items-center px-6 py-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors disabled:opacity-50"
                         disabled={!formData.name || !formData.email || !formData.inquiryType || isSubmitting}
                         variants={buttonVariants} whileHover="hover" whileTap="tap"
                       >
                         Next
                         <ArrowRight className="w-5 h-5 ml-2" /> {/* Original icon placement */}
                       </motion.button>
                     ) : (
                       <motion.button
                         type="submit"
                         // Original classes + flex for icon
                         className="flex items-center justify-center px-6 py-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors disabled:opacity-50 min-w-[160px]" // min-width to prevent jump
                         disabled={isSubmitting || (formData.step === 2 && !formData.message && formData.inquiryType !== 'subscription') || (formData.step === 2 && formData.inquiryType === 'subscription' && !formData.subscriptionPlan)}
                         variants={buttonVariants} whileHover="hover" whileTap="tap"
                       >
                         {isSubmitting ? (
                           <>
                             <Loader2 className="w-5 h-5 mr-2 animate-spin" /> {/* Original icon placement */}
                             Sending...
                           </>
                         ) : (
                           'Send Message'
                         )}
                       </motion.button>
                     )}
                   </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.main>
      {/* --- END: Main Content --- */}


      {/* --- START: FOOTER (Original Structure/Style) --- */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-auto"> {/* Added mt-auto */}
        <div className="container mx-auto px-4 py-6">
          {/* Original flex layout */}
          <div className="flex flex-col md:flex-row items-center justify-between">
            {/* Original links structure */}
            <div className="flex items-center space-x-4">
              <a href="/privacy-policy" className="text-sm text-gray-400 hover:text-indigo-400">Privacy Policy</a>
              <span className="text-gray-600">|</span>
              <a href="/terms" className="text-sm text-gray-400 hover:text-indigo-400">Terms & Conditions</a>
            </div>
            {/* Original copyright text */}
            <p className="text-sm text-gray-400 mt-4 md:mt-0">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved. {/* Dynamic Year */}
            </p>
          </div>
        </div>
      </footer>
      {/* --- END: FOOTER --- */}
    </div>
  );
}

export default Contact;
