// StudentEmailModal.tsx
import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Send, CheckCircle, AlertTriangle } from 'lucide-react';

interface StudentEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StudentEmailModal: React.FC<StudentEmailModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);

    // --- !!! REPLACE WITH ACTUAL BACKEND API CALL !!! ---
    // Example:
    // try {
    //   const response = await fetch('/api/send-student-email', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ name, senderEmail, message }),
    //   });
    //   if (!response.ok) throw new Error('Failed to send email.');
    //   setStatus('success');
    //   setName(''); setSenderEmail(''); setMessage(''); // Clear form
    //   setTimeout(onClose, 2000); // Auto-close after success
    // } catch (err: any) {
    //   setStatus('error');
    //   setErrorMsg(err.message || 'An unexpected error occurred.');
    // }

    // --- SIMULATED BACKEND CALL (REMOVE THIS IN PRODUCTION) ---
    console.log("Simulating email send:", { name, senderEmail, message });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    if (name && senderEmail && message && senderEmail.includes('@')) {
      setStatus('success');
      setName(''); setSenderEmail(''); setMessage('');
      setTimeout(() => {
        onClose();
        setStatus('idle'); // Reset status after closing
      }, 2000);
    } else {
      setStatus('error');
      setErrorMsg('Please fill all fields correctly.');
    }
    // --- END SIMULATION ---
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md text-white border border-gray-700"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-indigo-400">Claim Student Offer</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {status === 'success' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">Email Sent Successfully!</p>
                <p className="text-sm text-gray-300">We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500"
                    placeholder="Your Name"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="senderEmail" className="block text-sm font-medium text-gray-300 mb-1">Your Email</label>
                  <input
                    type="email"
                    id="senderEmail"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">Message (Optional)</label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-500"
                    placeholder="e.g., Attaching student ID proof."
                  ></textarea>
                   <p className="text-xs text-gray-400 mt-1">Please mention you're attaching proof or provide your .edu email.</p>
                </div>

                {status === 'error' && errorMsg && (
                  <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm flex items-center gap-2">
                    <AlertTriangle size={18} /> {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md transition-colors disabled:opacity-70"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" /> Send Request
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
