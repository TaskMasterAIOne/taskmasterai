import React, { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import emailjs from '@emailjs/browser';

interface StudentEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAILJS_SERVICE_ID = 'service_92n9n5w';
const EMAILJS_TEMPLATE_ID = 'template_ra8alpk';
const EMAILJS_PUBLIC_KEY = 'uE6sEAu0ykEIf36_V';


const StudentEmailModal: React.FC<StudentEmailModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConfigReady, setIsConfigReady] = useState(false);

  useEffect(() => {
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY && EMAILJS_TEMPLATE_ID !== 'YOUR_EMAILJS_TEMPLATE_ID') {
      setIsConfigReady(true);
    } else {
      setIsConfigReady(false);
      console.error("EmailJS configuration is missing or incorrect in StudentEmailModal.tsx.");
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);

    if (!isConfigReady) {
      setStatus('error');
      setErrorMsg('Email sending configuration is incomplete. Please contact support.');
      return;
    }

    const templateParams = {
      name: name,
      sender_email: senderEmail,
      message_html: message.replace(/\n/g, '<br />'),
    };

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      setStatus('success');
      setName('');
      setSenderEmail('');
      setMessage('');
      setTimeout(() => {
        onClose();
        setTimeout(() => setStatus('idle'), 300);
      }, 2500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.text || 'Failed to send email. Please try again later.');
      console.error('EMAILJS SEND ERROR:', err);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
        if (status !== 'success') {
            setStatus('idle');
            setErrorMsg(null);
        }
    }
  }, [isOpen, status]);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15, ease: "easeIn" } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100] [will-change:opacity]"
          onClick={() => status !== 'sending' && onClose()}
        >
          <motion.div
            variants={modalVariants}
            className="bg-white dark:bg-[#16181D] p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700/60 [will-change:transform,opacity]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl sm:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 dark:from-purple-400 dark:via-indigo-400 dark:to-pink-400">
                Claim Student Offer
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                disabled={status === 'sending'}
                aria-label="Close modal"
              >
                <X size={24} />
              </button>
            </div>

            {status === 'success' ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
                </motion.div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Request Sent!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">We'll review your details and get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isConfigReady && (
                    <div className="p-3 bg-yellow-100/50 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-500/30 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm flex items-center gap-2">
                        <AlertTriangle size={18} /> Email sending is temporarily unavailable.
                    </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full text-sm px-4 py-2 bg-gray-100 dark:bg-[#0C0E1A] border border-gray-200 dark:border-gray-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                    placeholder="e.g., Ada Lovelace"
                  />
                </div>
                <div>
                  <label htmlFor="senderEmail" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Your Email Address</label>
                  <input
                    type="email"
                    id="senderEmail"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    required
                    className="w-full text-sm px-4 py-2 bg-gray-100 dark:bg-[#0C0E1A] border border-gray-200 dark:border-gray-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                    placeholder="you@example.edu"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Student Verification Details
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    className="w-full text-sm px-4 py-2 bg-gray-100 dark:bg-[#0C0E1A] border border-gray-200 dark:border-gray-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                    placeholder="e.g., Student at [University], ID: [Your ID]. My .edu email is [your .edu email if different from above]."
                  ></textarea>
                   <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                     Provide clear info like your .edu email, student ID, or university affiliation.
                   </p>
                </div>

                {status === 'error' && errorMsg && (
                  <div className="p-3 bg-red-100/50 dark:bg-red-900/50 border border-red-300 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center gap-2.5">
                    <AlertTriangle size={20} /> <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !isConfigReady}
                  className="w-full flex items-center justify-center py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D] shadow-md hover:shadow-[0_0_15px_2px_rgba(99,102,241,0.5)]"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" /> Submit Request
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(StudentEmailModal);
