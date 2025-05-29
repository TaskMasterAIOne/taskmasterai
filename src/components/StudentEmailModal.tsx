// StudentEmailModal.tsx
import React, { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import emailjs from '@emailjs/browser';

interface StudentEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- Hardcoded EmailJS Credentials ---
const EMAILJS_SERVICE_ID = 'service_92n9n5w';
const EMAILJS_TEMPLATE_ID = 'template_ra8alpk'; // Updated Template ID
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
      if (EMAILJS_TEMPLATE_ID === 'YOUR_EMAILJS_TEMPLATE_ID') {
        console.warn(
          "EmailJS TEMPLATE_ID is still the placeholder 'YOUR_EMAILJS_TEMPLATE_ID'. Please update it in StudentEmailModal.tsx if 'template_ra8alpk' is incorrect."
        );
      } else if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
        console.error("EmailJS Service ID or Public Key is missing.");
      }
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);

    if (!isConfigReady) {
      setStatus('error');
      setErrorMsg('Email sending configuration is incomplete. Please contact support or check console.');
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
        setStatus('idle');
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
    } else {
      if (status === 'error') {
        setStatus('idle');
      }
    }
  }, [isOpen]);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={() => status !== 'sending' && onClose()}
        >
          <motion.div
            variants={modalVariants}
            className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg text-slate-100 border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Claim Student Offer
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                disabled={status === 'sending'}
                aria-label="Close modal"
              >
                <X size={26} />
              </button>
            </div>

            {!isConfigReady && status !== 'success' && (
                 <div className="mb-4 p-3 bg-yellow-700/30 border border-yellow-600 rounded-md text-yellow-300 text-sm flex items-center gap-2">
                    <AlertTriangle size={18} /> Email sending is temporarily unavailable. (Admin: Check EmailJS config)
                </div>
            )}

            {status === 'success' ? (
              <div className="text-center py-10">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-5" />
                </motion.div>
                <p className="text-xl font-semibold text-slate-50 mb-1">Request Sent Successfully!</p>
                <p className="text-sm text-slate-300">We'll review your details and get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-500 text-slate-100 transition-colors"
                    placeholder="e.g., Ada Lovelace"
                  />
                </div>
                <div>
                  <label htmlFor="senderEmail" className="block text-sm font-medium text-slate-300 mb-1.5">Your Email Address</label>
                  <input
                    type="email"
                    id="senderEmail"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-500 text-slate-100 transition-colors"
                    placeholder="you@example.edu"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Student Verification Details
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-500 text-slate-100 transition-colors"
                    placeholder="e.g., Student at [University], ID: [Your ID]. My .edu email is [your .edu email if different from above]."
                  ></textarea>
                   <p className="text-xs text-slate-400 mt-1.5">
                     Provide clear information like your .edu email, student ID, or university affiliation.
                   </p>
                </div>

                {status === 'error' && errorMsg && (
                  <div className="p-3.5 bg-red-700/30 border border-red-600 rounded-lg text-red-300 text-sm flex items-center gap-2.5">
                    <AlertTriangle size={20} /> <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !isConfigReady}
                  className="w-full flex items-center justify-center px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-800 transform hover:scale-105 active:scale-100"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2.5 animate-spin" /> Sending Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2.5" /> Submit Student Offer Request
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

export default StudentEmailModal;
