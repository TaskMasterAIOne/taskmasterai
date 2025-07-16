import React, { useEffect, useState } from 'react';
import { useAuth as useGlobalAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { subscribeToAuthState } from '../lib/pricing-firebase';
import { Logo } from './Logo';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_92n9n5w';
const EMAILJS_TEMPLATE_ID = 'template_ra8alpk';
const EMAILJS_PUBLIC_KEY = 'uE6sEAu0ykEIf36_V';

interface FormData {
  step: number;
  name: string;
  email: string;
  inquiryType: string;
  subscriptionPlan: string;
  planQuestion: string;
  cancellationIssue: string;
  billingIssue: string;
  planChange: string;
  message: string;
}

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

const AnimatedBackground = () => {
  return (
    <>
      <style>{`
        @keyframes subtleFloat1 {
          0% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.05; }
          25% { transform: translate(30px, -40px) rotate(10deg); opacity: 0.07; }
          50% { transform: translate(-20px, 30px) rotate(-8deg); opacity: 0.04; }
          75% { transform: translate(40px, 20px) rotate(5deg); opacity: 0.08; }
          100% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.05; }
        }
        @keyframes subtleFloat2 {
          0% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.06; }
          25% { transform: translate(-35px, 25px) rotate(-12deg); opacity: 0.08; }
          50% { transform: translate(25px, -35px) rotate(10deg); opacity: 0.05; }
          75% { transform: translate(-15px, 40px) rotate(15deg); opacity: 0.07; }
          100% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.06; }
        }
         @keyframes subtleFloat3 {
          0% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.04; }
          25% { transform: translate(25px, 35px) rotate(8deg); opacity: 0.06; }
          50% { transform: translate(-30px, -25px) rotate(-12deg); opacity: 0.03; }
          75% { transform: translate(20px, -30px) rotate(18deg); opacity: 0.07; }
          100% { transform: translate(0px, 0px) rotate(0deg); opacity: 0.04; }
        }
      `}</style>
      <div
        className="fixed -z-10 top-[-25vh] left-[-25vw] w-[100vw] h-[100vh] bg-purple-600 rounded-full"
        style={{ filter: 'blur(180px)', animation: 'subtleFloat1 35s infinite ease-in-out' }}
      />
      <div
        className="fixed -z-10 top-[20vh] right-[-30vw] w-[90vw] h-[90vh] bg-indigo-500 rounded-full"
        style={{ filter: 'blur(150px)', animation: 'subtleFloat2 45s infinite ease-in-out 5s' }}
      />
      <div
        className="fixed -z-10 bottom-[-20vh] left-[10vw] w-[80vw] h-[80vh] bg-pink-400 rounded-full"
        style={{ filter: 'blur(130px)', animation: 'subtleFloat3 40s infinite ease-in-out 10s' }}
      />
    </>
  );
};

function Contact() {
  const { user: authUser, loading: authLoading } = useGlobalAuth();
  const [localUser, setLocalUser] = useState<any>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('appTheme') || 'system';
        document.documentElement.classList.remove('light', 'dark');

        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else if (savedTheme === 'light') {
            document.documentElement.classList.add('light');
            setIsDarkMode(false);
        } else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
                setIsDarkMode(true);
            } else {
                document.documentElement.classList.add('light');
                setIsDarkMode(false);
            }
        }
    };

    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'appTheme') applyTheme(); });
    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', (event) => { if (event.key === 'appTheme') applyTheme(); });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setLocalUser(firebaseUser);
      if (firebaseUser) {
        if (!formData.email) {
            setFormData(prev => ({ ...prev, email: firebaseUser.email || '' }));
        }
        if (!formData.name && firebaseUser.displayName) {
            setFormData(prev => ({ ...prev, name: firebaseUser.displayName || '' }));
        }
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
    if (submitError) setSubmitError(null);
  };

  const nextStep = () => {
    if (!formData.name || !formData.email || !formData.inquiryType) {
        setSubmitError("Please fill in all required fields: Name, Email, and Inquiry Type.");
        return;
    }
    setSubmitError(null);
    setFormData(prev => ({ ...prev, step: prev.step + 1 }));
  };

  const prevStep = () => {
    setFormData(prev => ({ ...prev, step: prev.step - 1 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.step === 2 && !formData.message && formData.inquiryType !== 'subscription') {
        setSubmitError("Please provide details in the message field.");
        return;
    }
     if (formData.step === 2 && formData.inquiryType === 'subscription' && !formData.subscriptionPlan) {
        setSubmitError("Please select your subscription plan for subscription inquiries.");
        return;
     }
    setSubmitError(null);
    setIsSubmitting(true);
    setIsSuccess(false);

    let message_html = `
        A new contact form submission has been received.<br><br>
        <strong>From:</strong> ${formData.name}<br>
        <strong>Email:</strong> ${formData.email}<br>
        <strong>User ID:</strong> ${localUser?.uid || 'Not logged in'}<br>
        <strong>Inquiry Type:</strong> ${formData.inquiryType}<br><br>
        <hr><br>
    `;

    if (formData.inquiryType === 'subscription') {
        message_html += `
            <strong>Subscription Details:</strong><br>
            <ul>
                <li><strong>Plan:</strong> ${formData.subscriptionPlan || 'Not specified'}</li>
                <li><strong>Plan Question:</strong> ${formData.planQuestion || 'N/A'}</li>
                <li><strong>Cancellation Issue:</strong> ${formData.cancellationIssue || 'N/A'}</li>
                <li><strong>Billing Issue:</strong> ${formData.billingIssue || 'N/A'}</li>
                <li><strong>Plan Change Request:</strong> ${formData.planChange || 'N/A'}</li>
            </ul><br>
        `;
    }

    message_html += `<strong>Message:</strong><br><p>${formData.message.replace(/\n/g, '<br />')}</p>`;

    const templateParams = {
        name: formData.name,
        sender_email: formData.email,
        message_html: message_html,
    };

    try {
        if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
            throw new Error("EmailJS configuration is missing.");
        }
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      setIsSuccess(true);
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
    if (localUser) {
        setFormData(prev => ({
            ...prev,
            email: localUser.email || '',
            name: localUser.displayName || ''
        }));
    }
  };

  const headerMotionVariants = {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  const mainContentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2, ease: 'easeOut' } }
  };

  const successVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'backOut' } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2, ease: 'easeIn' } }
  };

  const stepVariants = {
     hidden: (direction: number) => ({ opacity: 0, x: direction > 0 ? 30 : -30 }),
     visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeInOut' } },
     exit: (direction: number) => ({ opacity: 0, x: direction < 0 ? 30 : -30, transition: { duration: 0.3, ease: 'easeInOut' } })
   };

  const inputBaseClasses = "w-full bg-gray-100 dark:bg-[#1F2328] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const textareaClasses = "w-full bg-gray-100 dark:bg-[#1F2328] border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const selectClasses = inputBaseClasses;
  const labelClasses = "block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5";

  const buttonBaseStyle = "px-6 py-3 rounded-full font-semibold text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D]";
  const primaryButtonStyle = `${buttonBaseStyle} bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-[0_0_15px_2px_rgba(99,102,241,0.6)] focus:ring-indigo-500`;
  const secondaryButtonStyle = `${buttonBaseStyle} bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-300 hover:text-black dark:hover:text-white focus:ring-gray-500`;

  const renderStep1 = () => (
     <motion.div
       key="step1"
       custom={1}
       variants={stepVariants}
       initial="hidden"
       animate="visible"
       exit="exit"
     >
      <div className="space-y-5">
          <div>
            <label htmlFor="name" className={labelClasses}>Name <span className="text-red-500">*</span></label>
            <input type="text" id="name" value={formData.name} onChange={handleChange} className={inputBaseClasses} placeholder="Your Name" required disabled={isSubmitting}/>
          </div>
          <div>
            <label htmlFor="email" className={labelClasses}>Email <span className="text-red-500">*</span></label>
            <input type="email" id="email" value={formData.email} onChange={handleChange} className={inputBaseClasses} placeholder="Your Email" required disabled={isSubmitting}/>
          </div>
          <div>
            <label htmlFor="inquiryType" className={labelClasses}>Inquiry Type <span className="text-red-500">*</span></label>
            <select id="inquiryType" value={formData.inquiryType} onChange={handleChange} className={selectClasses} required disabled={isSubmitting}>
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
       custom={1}
       variants={stepVariants}
       initial="hidden"
       animate="visible"
       exit="exit"
     >
       <div className="space-y-5">
          {formData.inquiryType === 'subscription' && (
            <>
              <div>
                <label htmlFor="subscriptionPlan" className={labelClasses}>Subscription Plan <span className="text-red-500">*</span></label>
                <select id="subscriptionPlan" value={formData.subscriptionPlan} onChange={handleChange} className={selectClasses} required={formData.inquiryType === 'subscription'} disabled={isSubmitting}>
                  <option value="">Select Your Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="premium">Premium Plan</option>
                  <option value="not-subscribed">Not Currently Subscribed</option>
                  <option value="not-sure">Not Sure</option>
                </select>
              </div>
               <div>
                 <label htmlFor="planQuestion" className={labelClasses}>Question about plan? (Optional)</label>
                 <textarea id="planQuestion" value={formData.planQuestion} onChange={handleChange} className={textareaClasses} rows={3} disabled={isSubmitting}/>
               </div>
               <div>
                 <label htmlFor="cancellationIssue" className={labelClasses}>Cancellation Issue? (Optional)</label>
                 <select id="cancellationIssue" value={formData.cancellationIssue} onChange={handleChange} className={selectClasses} disabled={isSubmitting}>
                   <option value="">Select Issue (if applicable)</option>
                   <option value="find-cancel">Unable to find the cancel option</option>
                   <option value="not-processed">Cancel request not processed</option>
                   <option value="unexpected-charges">Unexpected charges after cancellation</option>
                 </select>
               </div>
               <div>
                 <label htmlFor="billingIssue" className={labelClasses}>Billing/Payment Issue? (Optional)</label>
                 <select id="billingIssue" value={formData.billingIssue} onChange={handleChange} className={selectClasses} disabled={isSubmitting}>
                   <option value="">Select Billing Issue (if applicable)</option>
                   <option value="failed-payment">Failed Payments</option>
                   <option value="incorrect-charge">Incorrect Charges</option>
                   <option value="refund">Refund Request</option>
                   <option value="invoice">Invoice/Receipt Request</option>
                 </select>
               </div>
               <div>
                 <label htmlFor="planChange" className={labelClasses}>Plan Change Request? (Optional)</label>
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
          <div>
            <label htmlFor="message" className={labelClasses}>
                {formData.inquiryType === 'subscription' ? 'Additional Details' : 'Your Message'} <span className="text-red-500">*</span>
            </label>
            <textarea id="message" value={formData.message} onChange={handleChange} className={textareaClasses} rows={5} placeholder="Please provide any additional details..." required disabled={isSubmitting}/>
          </div>
       </div>
     </motion.div>
  );

  if (authLoading) {
    return <div className="min-h-screen bg-white dark:bg-[#0C0E1A] flex items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0C0E1A] text-gray-800 dark:text-gray-200 font-poppins selection:bg-purple-600 selection:text-white relative overflow-hidden">
      <AnimatedBackground />
      <motion.header className="w-full py-5 sm:py-6 bg-transparent z-10" variants={headerMotionVariants} initial="hidden" animate="visible">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <a href="/" aria-label="TaskMaster AI Home"><Logo /></a>
            <div className="flex items-center">
              <a href={authUser ? "/dashboard" : "/signup"} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-[0_0_15px_2px_rgba(99,102,241,0.5)]">
                {authUser ? "Dashboard" : "Start today - It's Free"}
              </a>
            </div>
          </nav>
        </div>
      </motion.header>

      <motion.main
        className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full max-w-screen-2xl z-10"
        variants={mainContentVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 dark:from-purple-400 dark:via-indigo-400 dark:to-pink-400 mb-3">
              Contact Us
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              We're here to help with any questions or concerns.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                variants={successVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-white/80 dark:bg-[#16181D]/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 text-center border border-gray-200 dark:border-gray-700/50"
              >
                <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-5" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Message Sent Successfully!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">We'll get back to you as soon as possible.</p>
                <button
                  onClick={resetForm}
                  className={primaryButtonStyle}
                >
                  Send Another Message
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="bg-white/80 dark:bg-[#16181D]/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700/50"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                 <AnimatePresence mode="wait" custom={formData.step === 1 ? 1 : -1}>
                    {formData.step === 1 ? renderStep1() : renderStep2()}
                 </AnimatePresence>

                 {submitError && (
                   <motion.div
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="mt-6 p-3 bg-red-100/50 dark:bg-red-900/50 backdrop-blur-sm border border-red-500/30 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center justify-center gap-2.5"
                   >
                     <AlertCircle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                     <span>{submitError}</span>
                   </motion.div>
                 )}

                <div className="flex justify-between items-center mt-8">
                   <div className="w-1/3">
                      {formData.step > 1 && (
                        <button
                          type="button"
                          onClick={prevStep}
                          className={`${secondaryButtonStyle} flex items-center justify-center`}
                          disabled={isSubmitting}
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Previous
                        </button>
                      )}
                   </div>

                   <div className="w-1/3 flex justify-end">
                     {formData.step === 1 ? (
                       <button
                         type="button"
                         onClick={nextStep}
                         className={`${primaryButtonStyle} flex items-center justify-center`}
                         disabled={isSubmitting}
                       >
                         Next
                         <ArrowRight className="w-4 h-4 ml-2" />
                       </button>
                     ) : (
                       <button
                         type="submit"
                         className={`${primaryButtonStyle} flex items-center justify-center min-w-[170px]`}
                         disabled={isSubmitting || (formData.step === 2 && !formData.message && formData.inquiryType !== 'subscription') || (formData.step === 2 && formData.inquiryType === 'subscription' && !formData.subscriptionPlan)}
                       >
                         {isSubmitting ? (
                           <>
                             <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                             Sending...
                           </>
                         ) : (
                           'Send Message'
                         )}
                       </button>
                     )}
                   </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.main>

      <footer className="bg-transparent z-10 mt-auto">
        <div className="container mx-auto px-5 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4">
              <a href="/privacy-policy" className="text-sm text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Privacy Policy</a>
              <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">|</span>
              <a href="/terms" className="text-sm text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Terms & Conditions</a>
            </div>
            <p className="text-sm text-gray-500 text-center md:text-right">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Contact;
