import React, { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Send, CheckCircle, AlertTriangle, GraduationCap, Mail, User, Sparkles } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { useScrollLock } from '../hooks/useScrollLock';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

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
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'verifying'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  // Lock body scroll when modal is open
  useScrollLock(isOpen);
  const [isConfigReady, setIsConfigReady] = useState(false);
  const [isEduEmail, setIsEduEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [sentVerificationCode, setSentVerificationCode] = useState('');

  useEffect(() => {
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      setIsConfigReady(true);
    } else {
      setIsConfigReady(false);
      console.error("EmailJS configuration is missing or incorrect in StudentEmailModal.tsx.");
    }
  }, []);

  // Debug effect to track isVerificationSent changes
  useEffect(() => {
    console.log('isVerificationSent changed to:', isVerificationSent);
  }, [isVerificationSent]);

  // Debug effect to track currentUser changes and auto-grant if they log in
  useEffect(() => {
    console.log('currentUser changed:', {
      currentUser: currentUser,
      uid: currentUser?.uid,
      email: currentUser?.email,
      isAuthenticated: !!currentUser?.uid
    });
    
    // If user becomes authenticated and we have pending verification, auto-grant access
    if (currentUser?.uid && status === 'success') {
      const pendingVerification = localStorage.getItem('pendingStudentVerification');
      if (pendingVerification) {
        console.log('User logged in with pending verification - attempting to grant access');
        const verificationData = JSON.parse(pendingVerification);
        
        // Call the Firebase function to grant access
        const grantAccessForLoggedInUser = async () => {
          try {
            const functions = getFunctions();
            const grantStudentAccessFunc = httpsCallable(functions, 'grantStudentAccess');
            
            const result = await grantStudentAccessFunc({
              email: verificationData.email,
              verificationCode: verificationData.code,
              sentCode: verificationData.code
            });
            
            if (result.data && result.data.success) {
              console.log('Auto-granted access for newly logged in user');
              localStorage.removeItem('pendingStudentVerification');
              // Force a refresh of the success state to show the correct message
              setStatus('idle');
              setTimeout(() => setStatus('success'), 100);
            }
          } catch (error) {
            console.error('Error auto-granting access:', error);
          }
        };
        
        grantAccessForLoggedInUser();
      }
    }
  }, [currentUser, status]);

  // List of known invalid .edu domains that are commonly used for testing
  const invalidEduDomains = [
    'gmail.edu',
    'yahoo.edu', 
    'hotmail.edu',
    'outlook.edu',
    'aol.edu',
    'icloud.edu',
    'test.edu',
    'fake.edu',
    'example.edu',
    'demo.edu',
    'sample.edu',
    'tempmail.edu',
    'mailinator.edu',
    '123.edu',
    'abc.edu',
    "gmai.edu",
    'xx.edu',
    'university.edu'
  ];

  // International academic domain patterns
  const academicDomainPatterns = [
    // US and Americas
    '.edu',         // United States
    '.edu.au',      // Australia
    '.edu.ar',      // Argentina
    '.edu.br',      // Brazil
    '.edu.co',      // Colombia
    '.edu.pe',      // Peru
    '.edu.mx',      // Mexico
    '.edu.ve',      // Venezuela
    '.edu.eg',      // Egypt
    '.edu.ng',      // Nigeria
    '.edu.gh',      // Ghana
    '.edu.pk',      // Pakistan
    '.edu.my',      // Malaysia
    '.edu.sg',      // Singapore
    '.edu.vn',      // Vietnam
    '.edu.ph',      // Philippines
    '.edu.sa',      // Saudi Arabia
    '.edu.iq',      // Iraq
    '.edu.jo',      // Jordan
    '.edu.lb',      // Lebanon
    '.edu.sy',      // Syria
    '.edu.kw',      // Kuwait
    '.edu.om',      // Oman
    '.edu.tr',      // Turkey
    '.edu.pl',      // Poland
    '.edu.cn',      // China
    
    // Academic (.ac) domains
    '.ac.uk',       // United Kingdom
    '.ac.jp',       // Japan
    '.ac.in',       // India
    '.ac.za',       // South Africa
    '.ac.nz',       // New Zealand
    '.ac.kr',       // South Korea
    '.ac.bd',       // Bangladesh
    '.ac.lk',       // Sri Lanka
    '.ac.id',       // Indonesia
    '.ac.th',       // Thailand
    '.ac.ke',       // Kenya
    '.ac.ae',       // UAE
    '.ac.il',       // Israel
    '.ac.ir',       // Iran
    '.ac.cn',       // China (research)
  ];

  // Check if email is from a valid college/university (international support)
  const isCollegeEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase().trim();
    
    
    // Extract domain from email
    const domain = emailLower.split('@')[1];
    if (!domain) {
      return false;
    }
    
    // Check if it's a known invalid domain first
    if (invalidEduDomains.includes(domain)) {
      return false;
    }
    
    // Check if domain ends with any valid academic pattern
    const isAcademicDomain = academicDomainPatterns.some(pattern => domain.endsWith(pattern));
    if (!isAcademicDomain) {
      return false;
    }
    
    // Extract institution name (everything before the academic domain suffix)
    let institutionName = '';
    for (const pattern of academicDomainPatterns) {
      if (domain.endsWith(pattern)) {
        institutionName = domain.substring(0, domain.length - pattern.length);
        break;
      }
    }
    
    // Remove any trailing dots
    institutionName = institutionName.replace(/\.$/, '');
    
    // Institution name validation
    if (!institutionName) {
      return false;
    }
    
    // Handle subdomains (e.g., "dept.university" from "dept.university.edu")
    const institutionParts = institutionName.split('.');
    const mainInstitution = institutionParts[institutionParts.length - 1]; // Get the last part
    
    // Main institution validation
    if (mainInstitution.length < 2) {
      return false;
    }
    
    // Cannot be purely numeric
    if (/^\d+$/.test(mainInstitution)) {
      return false;
    }
    
    // Cannot contain consecutive special characters or start/end with hyphen
    if (/--/.test(mainInstitution) || mainInstitution.startsWith('-') || mainInstitution.endsWith('-')) {
      return false;
    }
    
    // Should only contain letters, numbers, and hyphens
    if (!/^[a-z0-9-]+$/.test(mainInstitution)) {
      return false;
    }
    
    return true;
  };

  // Handle email change and verification
  useEffect(() => {
    if (senderEmail) {
      const isEdu = isCollegeEmail(senderEmail);
      setIsEduEmail(isEdu);
      if (!isEdu && senderEmail.includes('@')) {
        setErrorMsg('Please use your college email address ending with .edu');
      } else {
        setErrorMsg(null);
      }
    }
  }, [senderEmail]);

  // Generate random verification code
  const generateVerificationCode = (): string => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated code with timestamp:', code, new Date().toISOString());
    return code;
  };

  // Send verification email
  const sendVerificationEmail = async () => {
    if (!isConfigReady || !isEduEmail) {
      setStatus('error');
      setErrorMsg('Please enter a valid .edu email address first.');
      return;
    }

    setStatus('verifying');
    setErrorMsg(null);

    const code = generateVerificationCode();
    setSentVerificationCode(code);
    
    console.log('Generated verification code:', code);
    console.log('Template params being sent:', {
      name: name,
      sender_email: senderEmail,
      verification_code: code,
      code: code,
      student_code: code
    });

    const templateParams = {
      name: name,
      sender_email: senderEmail,
      verification_code: code,
      code: code,
      student_code: code,
      message_html: `
        <p>Hello ${name},</p>
        <p>Thank you for requesting your student discount for TaskMaster AI!</p>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>Please enter this code in the modal to verify your student status and claim your 2 months of PRO for free.</p>
        <p>Best regards,<br>TaskMaster AI Team</p>
      `,
    };

    try {
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      // Check if email was actually sent successfully
      console.log('EmailJS response:', response);
      if (response.status === 200) {
        console.log('Email sent successfully, setting isVerificationSent to true');
        // Force state update with callback to ensure it happens
        setIsVerificationSent(() => {
          console.log('State update callback: setting isVerificationSent to true');
          return true;
        });
        setStatus('idle');
        // Force a small delay to ensure state updates
        setTimeout(() => {
          console.log('Timeout check - isVerificationSent should be true now');
        }, 100);
      } else {
        console.error('EmailJS returned non-200 status:', response.status);
        throw new Error('Email service returned an error');
      }
    } catch (err: any) {
      console.error('EMAILJS SEND ERROR:', err);
      setStatus('error');
      setErrorMsg(err.text || err.message || 'Failed to send verification email. Please check that your email address is valid and try again.');
      setIsVerificationSent(false);
      setSentVerificationCode('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Clear any previous errors
    setErrorMsg(null);
    
    // Validate name and email are filled
    if (!name.trim()) {
      setStatus('error');
      setErrorMsg('Please enter your full name.');
      return;
    }
    
    if (!senderEmail.trim()) {
      setStatus('error');
      setErrorMsg('Please enter your email address.');
      return;
    }
    
    if (!isEduEmail) {
      setStatus('error');
      
      // Check if they used a fake academic domain
      const domain = senderEmail.toLowerCase().split('@')[1];
      if (domain && invalidEduDomains.includes(domain)) {
        setErrorMsg(`"${domain}" is not a valid educational institution domain. Please use your official college/university email address.`);
      } else {
        // Check if they used any academic-looking pattern
        const hasAcademicPattern = academicDomainPatterns.some(pattern => domain?.endsWith(pattern));
        if (hasAcademicPattern) {
          setErrorMsg('This academic domain appears to be invalid. Please use your official college/university email address.');
        } else {
          setErrorMsg('Please use a valid academic email address (.edu, .ac.uk, .edu.au, etc.) to verify your student status.');
        }
      }
      return;
    }

    if (!isVerificationSent) {
      // Send verification email
      await sendVerificationEmail();
      return;
    }

    // Handle verification code submission
    setStatus('sending');

    // Validate the entered code
    if (!verificationCode || verificationCode.trim() === '') {
      setStatus('error');
      setErrorMsg('Please enter the verification code sent to your email.');
      return;
    }
    
    // Clean the entered code (remove spaces) for length validation
    const cleanCode = verificationCode.replace(/\s+/g, '').trim();
    if (cleanCode.length !== 6) {
      setStatus('error');
      setErrorMsg('Verification code must be exactly 6 digits.');
      return;
    }

    // Clean both codes by removing any spaces and normalizing
    const cleanEnteredCode = verificationCode.replace(/\s+/g, '').trim();
    const cleanStoredCode = sentVerificationCode.replace(/\s+/g, '').trim();

    // Debug logging
    console.log('Verification Debug:', {
      enteredCode: verificationCode,
      cleanEnteredCode,
      storedCode: sentVerificationCode,
      cleanStoredCode,
      match: cleanEnteredCode === cleanStoredCode
    });

    // Check if the entered code matches the sent code (after cleaning)
    if (cleanEnteredCode !== cleanStoredCode) {
      setStatus('error');
      setErrorMsg(`Invalid verification code. Expected: ${cleanStoredCode}, Got: ${cleanEnteredCode}`);
      return;
    }

    // Call Firebase function to grant student access
    try {
      console.log('Current user check:', {
        currentUser: currentUser,
        uid: currentUser?.uid,
        email: currentUser?.email,
        isAuthenticated: !!currentUser?.uid
      });
      
      if (!currentUser?.uid) {
        // User is not logged in - store verification info and show success message
        const verificationData = {
          email: senderEmail,
          verifiedAt: new Date().toISOString(),
          code: cleanEnteredCode
        };
        localStorage.setItem('pendingStudentVerification', JSON.stringify(verificationData));
        
        setStatus('success');
        console.log('User not logged in - stored verification and showing success with signup prompt');
        return;
      }

      const functions = getFunctions();
      const grantStudentAccessFunc = httpsCallable(functions, 'grantStudentAccess');
      
      console.log('Calling Firebase function with:', {
        email: senderEmail,
        verificationCode,
        sentCode: sentVerificationCode
      });

      const result = await grantStudentAccessFunc({
        email: senderEmail,
        verificationCode,
        sentCode: sentVerificationCode
      });

      console.log('Firebase function result:', result);

      if (result.data && result.data.success) {
        console.log('Setting status to success - user is authenticated and access granted');
        setStatus('success');
      } else {
        console.log('Firebase function failed:', result);
        setStatus('error');
        setErrorMsg('Failed to grant student access. Please try again.');
      }
    } catch (error: any) {
      console.error('Error granting student access:', error);
      setStatus('error');
      if (error.code === 'permission-denied') {
        setErrorMsg('Invalid verification code or email domain.');
      } else if (error.code === 'unauthenticated') {
        setErrorMsg('Authentication required. Please log in and try again.');
      } else if (error.code === 'already-exists') {
        setErrorMsg('Premium users are not eligible for student discount. You already have access to all features!');
      } else {
        setErrorMsg('Failed to grant student access. Please try again.');
      }
    }
  };
  
  useEffect(() => {
    if (isOpen) {
        // Only reset error and verification code when modal opens, preserve isVerificationSent
        if (status === 'idle' && !isVerificationSent) {
            setErrorMsg(null);
            setVerificationCode('');
        }
    } else {
        // Reset everything when modal closes
        setStatus('idle');
        setErrorMsg(null);
        setIsVerificationSent(false);
        setVerificationCode('');
        setSentVerificationCode('');
    }
  }, [isOpen]); // Only depend on isOpen

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
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
          className="fixed inset-0 bg-[var(--overlay-dark)] backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[100] [will-change:opacity]"
          onClick={() => status !== 'sending' && onClose()}
        >
          <motion.div
            variants={modalVariants}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-[var(--bg-primary)] p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-2xl text-[var(--text-primary)] border border-[var(--border-primary)] [will-change:transform,opacity] relative overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient background */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[var(--bg-accent)]/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex justify-between items-start mb-4 sm:mb-5">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[var(--bg-accent)] to-[var(--bg-accent-secondary)] rounded-xl sm:rounded-2xl flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-white)]" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] font-heading">
                      Student Discount
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1">
                      Get 2 months PRO absolutely free
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-200 p-2 hover:bg-[var(--bg-highlight)] rounded-xl disabled:opacity-50"
                  disabled={status === 'sending'}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Benefits section */}
              <div className="bg-[var(--bg-card)] rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 border border-[var(--border-primary)]">
                <div className="flex items-center space-x-2 mb-2 sm:mb-3">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--bg-accent)]" />
                  <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">What you'll get:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-[var(--bg-accent)] rounded-full"></div>
                    <span>25 PDF & Text Notes/month</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-[var(--bg-accent)] rounded-full"></div>
                    <span>15 YouTube Notes/month</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-[var(--bg-accent)] rounded-full"></div>
                    <span>500 Chat Messages/month</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-[var(--bg-accent)] rounded-full"></div>
                    <span>Smart Daily Brief access</span>
                  </div>
                </div>
              </div>
            </div>

            {status === 'success' ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                  className="relative mb-6"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-[var(--status-success)] to-[var(--status-success)]/80 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-[var(--text-white)]" />
                  </div>
                  {/* Success confetti effect */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="w-2 h-2 bg-[var(--bg-accent)] rounded-full"
                    />
                  </div>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2 font-heading">
                    Student Status Verified! 🎓
                  </h3>
                  
                  {currentUser?.uid ? (
                    // User is logged in - access granted
                    <>
                      <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Congratulations! Your .edu email has been verified. You now have access to 2 months of PRO features completely free!
                      </p>
                      
                      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-primary)] mb-4">
                        <div className="flex items-center justify-center space-x-2 text-sm text-[var(--text-secondary)]">
                          <div className="w-2 h-2 bg-[var(--status-success)] rounded-full animate-pulse"></div>
                          <span>Your PRO access is now active!</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={onClose}
                        className="w-full py-3 px-6 bg-[var(--bg-card)] hover:bg-[var(--bg-highlight)] text-[var(--text-primary)] font-semibold rounded-xl transition-all duration-200 border border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    // User is not logged in - prompt to sign up
                    <>
                      <p className="text-[var(--text-secondary)] mb-4 leading-relaxed">
                        Great! Your student status has been verified. To claim your 2 months of FREE PRO access, please create an account or log in.
                      </p>
                      
                      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-primary)] mb-4">
                        <div className="flex items-center justify-center space-x-2 text-sm text-[var(--text-secondary)]">
                          <div className="w-2 h-2 bg-[var(--bg-accent)] rounded-full animate-pulse"></div>
                          <span>Sign up to activate your student discount!</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            onClose();
                            // Navigate to signup
                            window.location.href = '/signup';
                          }}
                          className="w-full py-3 px-6 bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)] text-white font-semibold rounded-xl transition-all duration-200"
                        >
                          Create Account & Claim Discount
                        </button>
                        
                        <button
                          onClick={() => {
                            onClose();
                            // Navigate to login
                            window.location.href = '/login';
                          }}
                          className="w-full py-3 px-6 bg-[var(--bg-card)] hover:bg-[var(--bg-highlight)] text-[var(--text-primary)] font-semibold rounded-xl transition-all duration-200 border border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                        >
                          Already Have Account? Log In
                        </button>
                        
                        <button
                          onClick={() => {
                            onClose();
                            // Navigate to dashboard
                            window.location.href = '/dashboard';
                          }}
                          className="w-full py-3 px-6 bg-[var(--bg-card)] hover:bg-[var(--bg-highlight)] text-[var(--text-primary)] font-semibold rounded-xl transition-all duration-200 border border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
                        >
                          Go to Dashboard
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {!isConfigReady && (
                    <div className="p-3 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-xl text-[var(--status-warning)] text-xs sm:text-sm flex items-center gap-3">
                        <AlertTriangle size={16} className="sm:w-4 sm:h-4" /> 
                        <span>Email sending is temporarily unavailable. Please try again later.</span>
                    </div>
                )}
                
                <div className="space-y-3 sm:space-y-4">
                  {/* Name and Email in a row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="relative">
                      <label htmlFor="name" className="block text-xs sm:text-sm font-semibold text-[var(--text-primary)] mb-1.5 sm:mb-2 flex items-center gap-2">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--bg-accent)]" />
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 sm:py-3 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 focus:ring-transparent focus:border-[var(--bg-accent)] focus:shadow-[0_0_0_3px_rgba(138,133,255,0.2)] placeholder-[var(--text-muted)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-secondary)] text-sm sm:text-base"
                        placeholder="Enter your full name"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        onFocus={(e) => e.target.style.outline = 'none'}
                      />
                    </div>
                    
                    <div className="relative">
                      <label htmlFor="senderEmail" className="block text-xs sm:text-sm font-semibold text-[var(--text-primary)] mb-1.5 sm:mb-2 flex items-center gap-2">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--bg-accent)]" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="senderEmail"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 sm:py-3 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 focus:ring-transparent focus:border-[var(--bg-accent)] focus:shadow-[0_0_0_3px_rgba(138,133,255,0.2)] placeholder-[var(--text-muted)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-secondary)] text-sm sm:text-base"
                        placeholder="your.email@university.edu (or .ac.uk, .edu.au, etc.)"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        onFocus={(e) => e.target.style.outline = 'none'}
                      />
                      
                      {/* Real-time email validation feedback */}
                      {senderEmail && (
                        <div className="mt-2">
                          {isEduEmail ? (
                            <div className="flex items-center gap-2 text-[var(--status-success)] text-xs">
                              <div className="w-2 h-2 bg-[var(--status-success)] rounded-full"></div>
                              <span>Valid academic email detected</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[var(--status-error)] text-xs">
                              <div className="w-2 h-2 bg-[var(--status-error)] rounded-full"></div>
                              <span>
                                {(() => {
                                  const domain = senderEmail.toLowerCase().split('@')[1];
                                  if (domain && invalidEduDomains.includes(domain)) {
                                    return `"${domain}" is not a valid educational domain`;
                                  } else {
                                    const hasAcademicPattern = academicDomainPatterns.some(pattern => domain?.endsWith(pattern));
                                    if (hasAcademicPattern) {
                                      return 'This academic domain appears invalid';
                                    } else {
                                      return 'Must be a valid academic email (.edu, .ac.uk, etc.)';
                                    }
                                  }
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] -mt-1 sm:-mt-2">
                    <div className={`w-2 h-2 rounded-full ${isEduEmail ? 'bg-[var(--status-success)]' : 'bg-[var(--bg-accent)]'}`}></div>
                    <span>{isEduEmail ? 'Valid academic email detected!' : 'Use your college/university academic email address'}</span>
                  </div>
                  
                  
                  {isVerificationSent && (
                    <div className="relative">
                      <label htmlFor="verificationCode" className="block text-xs sm:text-sm font-semibold text-[var(--text-primary)] mb-1.5 sm:mb-2 flex items-center gap-2">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--bg-accent)]" />
                        Verification Code
                      </label>
                      <input
                        type="text"
                        id="verificationCode"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        maxLength={6}
                        required
                        className="w-full px-3 py-2.5 sm:py-3 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 focus:ring-transparent focus:border-[var(--bg-accent)] focus:shadow-[0_0_0_3px_rgba(138,133,255,0.2)] placeholder-[var(--text-muted)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-secondary)] text-sm sm:text-base text-center tracking-wider font-mono text-lg"
                        placeholder="Enter 6-digit code"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        onFocus={(e) => e.target.style.outline = 'none'}
                      />
                      <div className="mt-2 text-center">
                        <p className="text-xs text-[var(--text-secondary)]">
                          We sent a verification code to <span className="font-semibold">{senderEmail}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsVerificationSent(false);
                            setVerificationCode('');
                            setSentVerificationCode('');
                            setErrorMsg(null);
                            setStatus('idle');
                          }}
                          className="text-xs text-[var(--bg-accent)] hover:text-[var(--bg-accent-secondary)] mt-1 underline transition-colors"
                        >
                          Didn't receive it? Send again
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {!isVerificationSent && (
                    <div className="mt-2 sm:mt-3 p-3 sm:p-4 bg-[var(--bg-card)] rounded-lg sm:rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[var(--bg-accent)] rounded-full"></div>
                        <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">How it works:</p>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
                        We'll send a verification code to your .edu email to confirm your student status automatically!
                      </p>
                    </div>
                  )}
                </div>

                {status === 'error' && errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 rounded-xl text-[var(--status-error)] text-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle size={20} className="shrink-0" /> 
                      <span>{errorMsg}</span>
                    </div>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setErrorMsg(null);
                        setIsVerificationSent(false);
                        setSentVerificationCode('');
                        setVerificationCode('');
                      }}
                      className="w-full py-2 px-4 bg-[var(--status-error)] hover:bg-[var(--status-error)]/80 text-white font-medium rounded-lg transition-all duration-200 text-sm"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}

                <div className="pt-2 sm:pt-3">
                  <button
                    type="submit"
                    disabled={status === 'sending' || status === 'verifying' || !isConfigReady || (!isEduEmail && !isVerificationSent)}
                    className="w-full flex items-center justify-center py-3 sm:py-3.5 px-4 sm:px-6 bg-gradient-to-r from-[var(--bg-accent)] to-[var(--bg-accent-secondary)] hover:from-[var(--bg-accent-secondary)] hover:to-[var(--bg-accent)] text-[var(--text-white)] font-bold rounded-xl sm:rounded-2xl transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none text-sm sm:text-base"
                  >
                    {status === 'verifying' ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 animate-spin" /> 
                        <span>Sending Code...</span>
                      </>
                    ) : status === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 animate-spin" /> 
                        <span>Verifying Code...</span>
                      </>
                    ) : isVerificationSent ? (
                      <>
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" /> 
                        <span>Verify & Claim Discount</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" /> 
                        <span>Send Verification Code</span>
                      </>
                    )}
                  </button>
                  
                  <div className="mt-2 sm:mt-3 text-center">
                    <p className="text-xs text-[var(--text-muted)]">
                      {isVerificationSent ? 'Check your email for the verification code' : 'Instant verification with your .edu email'}
                    </p>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(StudentEmailModal);
