import React, { useState, useEffect } from 'react';
import {
  NotebookPen,
  MessageCircle,
  Focus,
  LayoutDashboard,
  Folder,
  ArrowLeft,
  Target as GoalIcon,
  Sparkles,
  BarChart,
  SlidersHorizontal,
  Check,
  Loader2,
  X,
  Crown,
  Gem,
  GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser } from '../lib/settings-firebase';
// MODIFICATION: Import getUserContext to fetch existing user data.
import { saveUserContext, getUserContext, UserContext } from '../lib/ai-context-firebase';
import { createCheckoutSession } from '../lib/stripe-client';
// NOTE: You need to have these files and functions available in your project.
// This is a placeholder for the actual import.
import { getUserTier, UserTier } from '../lib/current-paying-user';
import StudentEmailModal from './StudentEmailModal';


const STRIPE_PRICE_IDS = {
  PREMIUM: {
    yearly: 'price_1RgUEnIdgEonJvEbAhkfqVPd',
    monthly: 'price_1RgULrIdgEonJvEbOM5n608H'
  },
  PRO: {
    yearly: 'price_1RgUI7IdgEonJvEbshTziusz',
    monthly: 'price_1RUFTSIdgEonJvEbDIcAvUQ6'
  }
};

const LogoIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-gradient-splash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--bg-header-secondary)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--bg-accent)' }} />
        </linearGradient>
      </defs>
      <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="url(#logo-gradient-splash)" />
    </svg>
);

const popularChoices = ["Data Science", "Web Development", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Computer Science", "Art & Design", "Philosophy", "Foreign Languages", "Business"];
const motivationOptions = [
  { id: 'academic', title: 'Academic success (homework, exams, grades)' },
  { id: 'test_prep', title: 'Test preparation (SAT, ACT, AP, etc.)' },
  { id: 'college_prep', title: 'College preparation & admissions' },
  { id: 'understanding', title: 'Understanding difficult concepts' },
  { id: 'curiosity', title: 'Personal curiosity & growth' },
  { id: 'career', title: 'Career preparation & skill development' },
  { id: 'other', title: 'Other (please specify)' },
];
const experienceLevels = [
  { id: 'new', title: "I'm completely new to it", description: 'Starting from scratch (pre-high school level)' },
  { id: 'basic', title: 'I have some basic understanding', description: 'Familiar with fundamentals (high school level)' },
  { id: 'experienced', title: 'I have some experience/knowledge', description: 'Looking to expand on existing skills (university/college level)' },
  { id: 'refresher', title: "I'm looking for a refresher", description: 'Knowledgeable but want to reinforce (graduate/professional level)' },
];
const usageStyles = [
  { id: 'quick', title: 'Quick Support & Clarifications', description: "For specific questions or quick explanations." },
  { id: 'focused', title: 'Focused Learning Sessions', description: "For dedicated deep dives into a topic." },
  { id: 'regular', title: 'Regular Check-ins & Review', description: "To periodically review and reinforce concepts." },
  { id: 'flexible', title: 'Flexible All-Rounder', description: "As needed for all types of learning." },
];
const TOTAL_STEPS = 8;

const stepVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2, ease: "easeIn" } },
};

const RadioCard = ({ option, selected, onSelect, hasDescription = true }: any) => (
  <button onClick={() => onSelect(option.id)} className={`w-full text-left p-4 sm:p-5 border-2 rounded-xl transition-all duration-200 bg-[var(--bg-primary)] ${selected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/10 shadow-sm' : 'border-[var(--border-primary)] hover:border-[var(--bg-accent)]/50 hover:bg-[var(--bg-accent)]/5'}`}>
    <div className="flex items-start gap-4">
      <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${selected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]' : 'border-[var(--border-primary)]'}`}>
        {selected && <Check className="w-3 h-3 text-[var(--text-white)]" />}
      </div>
      <div>
        <h3 className="font-semibold text-[var(--text-primary)]">{option.title}</h3>
        {hasDescription && option.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{option.description}</p>}
      </div>
    </div>
  </button>
);

const MultiSelectCard = ({ option, selected, onToggle, hasDescription = true }: any) => (
  <button onClick={() => onToggle(option.id)} className={`w-full text-left p-4 sm:p-5 border-2 rounded-xl transition-all duration-200 bg-[var(--bg-primary)] ${selected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]/10 shadow-sm' : 'border-[var(--border-primary)] hover:border-[var(--bg-accent)]/50 hover:bg-[var(--bg-accent)]/5'}`}>
    <div className="flex items-start gap-4">
      <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${selected ? 'border-[var(--bg-accent)] bg-[var(--bg-accent)]' : 'border-[var(--border-primary)]'}`}>
        {selected && <Check className="w-3 h-3 text-[var(--text-white)]" />}
      </div>
      <div>
        <h3 className="font-semibold text-[var(--text-primary)]">{option.title}</h3>
        {hasDescription && option.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{option.description}</p>}
      </div>
    </div>
  </button>
);

const FeatureItem = ({ text }: { text: string }) => (
  <li className="flex items-start">
    <Check className="w-4 h-4 text-[var(--text-primary)] mr-3 flex-shrink-0 mt-0.5" />
    <span className="text-[var(--text-secondary)] text-sm text-optimized">{text}</span>
  </li>
);

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    learningGoal: [] as string[],
    motivation: [] as string[], otherMotivation: '', experienceLevel: '', usageStyle: [] as string[],
    role: '', shortTermFocus: '', longTermGoals: '', otherContext: ''
  });
  const [currentGoalInput, setCurrentGoalInput] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('basic');
  const [isYearly, setIsYearly] = useState(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // MODIFICATION: This useEffect now fetches both user tier and any existing user context to pre-fill the form.
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.classList.remove('light', 'dark');
      const savedIlluminate = localStorage.getItem('isIlluminateEnabled');
      const savedBlackout = localStorage.getItem('isBlackoutEnabled');
      
      if (savedIlluminate === 'true') {
        document.documentElement.classList.remove('dark');
      } else if (savedBlackout === 'true') {
        document.documentElement.classList.add('dark');
      } else {
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

    const initializeUserData = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.uid) {
            setUserTier('basic');
            return; // No user, so no data to fetch
        }

        // Fetch user tier and context in parallel for performance.
        const tierPromise = currentUser.email 
            ? getUserTier(currentUser.uid, currentUser.email).catch(err => {
                console.error("Failed to get user tier", err);
                return 'basic' as UserTier;
              })
            : Promise.resolve('basic' as UserTier);
        
        const contextPromise = getUserContext(currentUser.uid).catch(err => {
            console.error("Failed to fetch existing user context:", err);
            return null; // Fail gracefully
        });

        const [tier, existingContext] = await Promise.all([tierPromise, contextPromise]);
        
        setUserTier(tier);

        // If context was found, pre-populate the form state.
        if (existingContext) {
            const rawOtherContext = existingContext.otherContext || '';
            const profileEndMarker = '--- END LEARNING STYLE/PROFILE ---';
            const markerIndex = rawOtherContext.lastIndexOf(profileEndMarker);
            
            let userSpecificOtherContext = rawOtherContext;
            if (markerIndex !== -1) {
                // Extract only the text entered by the user, after the auto-generated block.
                userSpecificOtherContext = rawOtherContext.substring(markerIndex + profileEndMarker.length).trim();
            }
            
            setFormData(prev => ({
                ...prev,
                role: existingContext.workDescription || '',
                shortTermFocus: existingContext.shortTermFocus || '',
                longTermGoals: existingContext.longTermGoals || '',
                otherContext: userSpecificOtherContext,
            }));
        }
    };

    initializeUserData();

    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
    };
  }, []);

  const handleNext = () => {
    setStep((s) => {
        let nextStep = s + 1;
        if (s === 5 && (userTier === 'pro' || userTier === 'premium')) {
            nextStep = 7; // Skip pricing step (6)
        }
        return Math.min(nextStep, TOTAL_STEPS - 1);
    });
  };

  const handleBack = () => {
    setStep((s) => {
        let prevStep = s - 1;
        if (s === 7 && (userTier === 'pro' || userTier === 'premium')) {
            prevStep = 5; // Skip back over pricing step (6)
        }
        return Math.max(prevStep, 0);
    });
  };

  const handleChange = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleLearningGoalToggle = (goal: string) => {
    setFormData(prev => {
        const newGoals = prev.learningGoal.includes(goal)
            ? prev.learningGoal.filter(g => g !== goal)
            : [...prev.learningGoal, goal];
        return { ...prev, learningGoal: newGoals };
    });
  };

  const handleMotivationToggle = (motivationId: string) => {
    setFormData(prev => {
        const newMotivations = prev.motivation.includes(motivationId)
            ? prev.motivation.filter(m => m !== motivationId)
            : [...prev.motivation, motivationId];
        return { ...prev, motivation: newMotivations };
    });
  };

  const handleUsageStyleToggle = (styleId: string) => {
    setFormData(prev => {
        const newStyles = prev.usageStyle.includes(styleId)
            ? prev.usageStyle.filter(s => s !== styleId)
            : [...prev.usageStyle, styleId];
        return { ...prev, usageStyle: newStyles };
    });
  };

  const handleAddCustomGoal = () => {
    const trimmedGoal = currentGoalInput.trim();
    if (trimmedGoal && !formData.learningGoal.includes(trimmedGoal)) {
      setFormData(prev => ({ ...prev, learningGoal: [...prev.learningGoal, trimmedGoal] }));
    }
    setCurrentGoalInput('');
  };

  const isNextDisabled = () => {
    switch (step) {
      case 1: return formData.learningGoal.length === 0;
      case 2: return formData.motivation.length === 0 || (formData.motivation.includes('other') && !formData.otherMotivation.trim());
      case 3: return !formData.experienceLevel.trim();
      case 4: return formData.usageStyle.length === 0;
      default: return false;
    }
  };

  const getSummaryItem = (id: string) => {
    switch (id) {
        case 'motivation':
            const motivationTexts = formData.motivation.map(motivationId => {
                if (motivationId === 'other') {
                    return formData.otherMotivation;
                }
                return motivationOptions.find(o => o.id === motivationId)?.title || motivationId;
            }).filter(Boolean);
            return motivationTexts.join(', ');
        case 'experienceLevel':
            return experienceLevels.find(o => o.id === formData.experienceLevel)?.title;
        case 'usageStyle':
            const usageTexts = formData.usageStyle.map(styleId => 
                usageStyles.find(o => o.id === styleId)?.title || styleId
            ).filter(Boolean);
            return usageTexts.join(', ');
        default: return '';
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    const user = getCurrentUser();
    if (!user) {
        console.error("No user found, cannot save context.");
        navigate('/dashboard');
        return;
    }

    try {
        const motivationText = formData.motivation.length > 0 
            ? getSummaryItem('motivation') 
            : 'Not set';
        const experienceText = experienceLevels.find(o => o.id === formData.experienceLevel)?.title || 'Not set';
        const usageStyleText = formData.usageStyle.length > 0 
            ? getSummaryItem('usageStyle') 
            : 'Not set';

        const learningProfileString = `--- LEARNING STYLE/PROFILE ---
Primary Goal: ${formData.learningGoal.join(', ') || 'Not set'}
Motivation: ${motivationText}
Experience Level: ${experienceText}
Preferred Usage Style: ${usageStyleText}
--- END LEARNING STYLE/PROFILE ---`;

        const finalOtherContext = [
            learningProfileString,
            formData.otherContext.trim()
        ].filter(Boolean).join('\n\n');

        const contextToSave: Partial<UserContext> = {
            workDescription: formData.role.trim(),
            shortTermFocus: formData.shortTermFocus.trim(),
            longTermGoals: formData.longTermGoals.trim(),
            otherContext: finalOtherContext,
        };

        await saveUserContext(user.uid, contextToSave);

        if (selectedPlan === 'basic' || userTier === 'pro' || userTier === 'premium') {
            navigate('/dashboard');
            return;
        }

        const planKey = selectedPlan.toUpperCase() as 'PRO' | 'PREMIUM';
        const priceId = STRIPE_PRICE_IDS[planKey][isYearly ? 'yearly' : 'monthly'];
        
        // The createCheckoutSession function now handles the redirect automatically
        await createCheckoutSession(priceId);
        // If we reach here, redirect was successful (though user will be navigated away)

    } catch (error) {
        console.error("Failed during finish process:", error);
        setCheckoutError("An error occurred. Please try again or continue to the dashboard.");
        setIsFinishing(false);
        setTimeout(() => navigate('/dashboard'), 3000);
    }
  };
  
  const plans = [
    { id: 'basic', name: 'Basic', price: 'Free', priceSuffix: '/ forever', features: [ "5 PDF and Text Notes per month", "3 YouTube Notes per month", "25 Chat Messages per month" ] },
    { id: 'premium', name: 'Premium',  priceYearly: '$9.99', priceMonthly: '$14.99', recommended: true, billingTextYearly: "Billed yearly", billingTextMonthly: "Billed monthly", features: [ "Unlimited PDF and Text Notes", "Unlimited YouTube Notes", "Unlimited Chat Messages", "Unlimited Smarter AI Responses", "Unlimited Smart Daily Brief", "Unlimited Podcasts", "Priority Support" ] },
    { id: 'pro', name: 'Pro', priceYearly: '$7.99', priceMonthly: '$11.99', billingTextYearly: "Billed yearly", billingTextMonthly: "Billed monthly", features: [ "25 PDF and Text Notes per month", "15 YouTube Notes per month", "500 Chat Messages per Month", "Limited Access to Smart Daily Brief" ] }
  ];

  const progressPercentage = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-clarika text-[var(--text-primary)] flex flex-col items-center p-4 sm:p-6 selection:bg-[var(--bg-accent)] selection:text-white">
      <div className="w-full max-w-5xl flex-grow flex flex-col">
        <header className="py-4 mb-6 sm:mb-8 flex items-center gap-4">
          <LogoIcon className="w-8 h-8" />
          <div className="w-full bg-[var(--bg-highlight)] rounded-full h-2 overflow-hidden">
            <motion.div className="bg-[var(--bg-accent)] h-2 rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} transition={{ ease: "easeInOut", duration: 0.5 }} />
          </div>
        </header>
        
        <main className="flex flex-col items-center justify-center flex-grow">
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="w-full">
              
              {step === 0 && (
                 <div className="text-center max-w-3xl mx-auto">
                  <h1 className="text-3xl sm:text-4xl font-semibold mb-3">Welcome to TaskMaster AI</h1>
                  <p className="text-[var(--text-secondary)] mx-auto mb-8 sm:mb-12">Your personal AI learning companion for any subject.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                         <div className="md:col-span-2 lg:col-span-3 bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-primary)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-shrink-0 bg-[var(--bg-primary)] p-3 rounded-lg"><LayoutDashboard className="w-7 h-7 text-[var(--bg-accent)]" /></div>
                        <div className="text-left flex-grow">
                           <h3 className="font-semibold text-[var(--text-primary)]">Dashboard</h3>
                           <p className="text-sm text-[var(--text-secondary)]">Your command center for tasks, goals, events, and tracking productivity trends.</p>
                        </div>
                    </div>
                                         <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-primary)] text-left"><div className="bg-[var(--bg-primary)] p-3 rounded-lg w-fit mb-3"><Folder className="w-6 h-6 text-[var(--bg-accent)]" /></div><h3 className="font-semibold text-[var(--text-primary)]">Folders</h3><p className="text-sm text-[var(--text-secondary)]">Organize study materials with flashcards and quizzes per subject.</p></div>
                     <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-primary)] text-left"><div className="bg-[var(--bg-primary)] p-3 rounded-lg w-fit mb-3"><NotebookPen className="w-6 h-6 text-[var(--bg-accent)]" /></div><h3 className="font-semibold text-[var(--text-primary)]">Notes</h3><p className="text-sm text-[var(--text-secondary)]">Beautiful notes from any source, complete with learning materials.</p></div>
                     <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-primary)] text-left"><div className="bg-[var(--bg-primary)] p-3 rounded-lg w-fit mb-3"><Focus className="w-6 h-6 text-[var(--bg-accent)]" /></div><h3 className="font-semibold text-[var(--text-primary)]">Focus</h3><p className="text-sm text-[var(--text-secondary)]">Block distractions and stay focused.</p></div>
                     <div className="bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl border border-[var(--border-primary)] text-left md:col-span-2 lg:col-span-3"><div className="bg-[var(--bg-primary)] p-3 rounded-lg w-fit mb-3"><MessageCircle className="w-6 h-6 text-[var(--bg-accent)]" /></div><h3 className="font-semibold text-[var(--text-primary)]">Chat</h3><p className="text-sm text-[var(--text-secondary)]">Your personal AI agent that is personalized for you and can take action to supercharge your learning.</p></div>
                  </div>
                </div>
              )}

              {[1, 2, 3, 4, 5, 7].includes(step) && <div className="max-w-3xl mx-auto w-full">
                {step === 1 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">What do you want to learn?</h1>
                    <p className="text-[var(--text-secondary)] mx-auto mb-8">This will help us tailor your experience. Select one or more goals.</p>
                    <div className="bg-[var(--bg-card)] p-4 sm:p-8 rounded-2xl border border-[var(--border-primary)] space-y-6">
                      <div className="text-left">
                        <label htmlFor="learningGoal" className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Your learning goals</label>
                        <div className="relative">
                          <input id="learningGoal" type="text" value={currentGoalInput} onChange={(e) => setCurrentGoalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomGoal())} placeholder="Type a goal and press Enter..." className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-colors"/>
                        </div>
                        {formData.learningGoal.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {formData.learningGoal.map(goal => (
                                                              <span key={goal} className="flex items-center gap-1.5 bg-[var(--bg-accent)]/20 text-[var(--bg-accent)] text-sm font-medium px-3 py-1 rounded-full">
                                {goal}
                                <button onClick={() => handleLearningGoalToggle(goal)} className="text-[var(--bg-accent)] hover:text-[var(--bg-accent-secondary)]"><X className="w-3.5 h-3.5" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div><p className="text-sm font-medium text-[var(--text-secondary)] mb-3 text-left">Popular choices</p><div className="flex flex-wrap gap-2 sm:gap-3">{popularChoices.map(choice => <button key={choice} onClick={() => handleLearningGoalToggle(choice)} className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-200 ${formData.learningGoal.includes(choice) ? 'bg-[var(--bg-accent)] text-[var(--text-white)]' : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-accent)]/20 text-[var(--text-primary)]'}`}>{choice}</button>)}</div></div>
                    </div>
                  </div>
                )}
                {[2, 3, 4].includes(step) && (
                  <div className="text-center">
                      <h1 className="text-2xl sm:text-4xl font-semibold mb-3">{step === 2 ? 'Why are you learning this?' : step === 3 ? 'What level are you at?' : 'How do you plan to use TaskMaster?'}</h1>
                      <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8">{step === 2 ? "Understanding your 'why' helps us personalize your journey. Select all that apply." : step === 3 ? `Help us understand your current knowledge level in your subjects.` : 'Understanding your style helps make a better learning companion.'}</p>
                      <div className="bg-[var(--bg-card)] p-4 sm:p-8 rounded-2xl border border-[var(--border-primary)] space-y-4">
                          {step === 2 && motivationOptions.map(option => (<div key={option.id}><MultiSelectCard option={option} selected={formData.motivation.includes(option.id)} onToggle={handleMotivationToggle} hasDescription={false} />{option.id === 'other' && formData.motivation.includes('other') && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 ml-10"><input type="text" value={formData.otherMotivation} onChange={(e) => handleChange('otherMotivation', e.target.value)} placeholder="Please specify your motivation" className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)]" /></motion.div>}</div>))}
                          {step === 3 && experienceLevels.map(option => <RadioCard key={option.id} option={option} selected={formData.experienceLevel === option.id} onSelect={(id: string) => handleChange('experienceLevel', id)} />)}
                          {step === 4 && usageStyles.map(option => <MultiSelectCard key={option.id} option={option} selected={formData.usageStyle.includes(option.id)} onToggle={handleUsageStyleToggle} />)}
                      </div>
                  </div>
                )}
                {step === 5 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Set Your Universal Context</h1>
                    <p className="text-[var(--text-secondary)] mx-auto mb-8">This helps TaskMaster provide perfectly aligned responses without you repeating yourself.</p>
                     <div className="bg-[var(--bg-card)] p-4 sm:p-8 rounded-2xl border border-[var(--border-primary)] space-y-5 text-left">
                       <div><label htmlFor="role" className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Your Role / Primary Area of Study</label><textarea id="role" value={formData.role} onChange={e => handleChange('role', e.target.value)} placeholder="e.g., College student majoring in CS..." rows={2} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] resize-none placeholder-[var(--text-muted)]"></textarea></div>
                       <div><label htmlFor="shortTermFocus" className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Current Short-Term Focus</label><textarea id="shortTermFocus" value={formData.shortTermFocus} onChange={e => handleChange('shortTermFocus', e.target.value)} placeholder="e.g., Preparing for SATs and final exams..." rows={2} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] resize-none placeholder-[var(--text-muted)]"></textarea></div>
                       <div><label htmlFor="longTermGoals" className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Main Long-Term Ambitions or Goals</label><textarea id="longTermGoals" value={formData.longTermGoals} onChange={e => handleChange('longTermGoals', e.target.value)} placeholder="e.g., Get a job at a top tech company..." rows={2} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] resize-none placeholder-[var(--text-muted)]"></textarea></div>
                       <div><label htmlFor="otherContext" className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">Other (Learning style, preferences, etc.)</label><textarea id="otherContext" value={formData.otherContext} onChange={e => handleChange('otherContext', e.target.value)} placeholder="e.g., I learn best with real-world examples..." rows={2} className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--bg-accent)] resize-none placeholder-[var(--text-muted)]"></textarea></div>
                     </div>
                  </div>
                )}
                 {step === 7 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Your Learning Style is Ready!</h1>
                    <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8">We've crafted a personalized experience based on your preferences.</p>
                    <div className="bg-[var(--bg-card)] p-4 sm:p-8 rounded-2xl border border-[var(--border-primary)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          {[{ icon: GoalIcon, label: "Learning Goals", value: formData.learningGoal.join(', '), key: "learningGoal" }, { icon: Sparkles, label: "Motivation", value: getSummaryItem('motivation'), key: "motivation" }, { icon: BarChart, label: "Experience Level", value: getSummaryItem('experienceLevel'), key: "experienceLevel" }, { icon: SlidersHorizontal, label: "Learning Style", value: getSummaryItem('usageStyle'), key: "usageStyle" }].map(item => (<div key={item.key} className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-primary)] text-left"><div className="flex items-center gap-3 mb-1.5"><item.icon className="w-5 h-5 text-[var(--bg-accent)]" /><h4 className="text-sm font-medium text-[var(--text-secondary)]">{item.label}</h4></div><p className="font-semibold text-[var(--text-primary)] truncate" title={item.value as string}>{item.value || 'Not set'}</p></div>))}
                      </div>
                    </div>
                  </div>
                )}
              </div>}
              
              {step === 6 && (
                <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Complete Your TaskMaster Experience</h1>
                    <p className="text-[var(--text-secondary)] mx-auto mb-8"></p>
                    <div className="flex justify-center mb-8">
                        <div className="bg-[var(--bg-highlight)] p-1.5 rounded-full flex border border-[var(--border-primary)]">
                            <button onClick={() => setIsYearly(true)} className={`px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium focus:outline-none ${isYearly ? 'bg-[var(--bg-accent)] text-[var(--text-white)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Yearly (Save 33%)</button>
                            <button onClick={() => setIsYearly(false)} className={`px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium focus:outline-none ${!isYearly ? 'bg-[var(--bg-accent)] text-[var(--text-white)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Monthly</button>
                        </div>
                    </div>
                    {checkoutError && <p className="text-[var(--status-error)] text-sm mb-4">{checkoutError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-7xl mx-auto">
                        {plans.map((plan) => {
                            const Icon = plan.icon;
                            const planCardBaseStyle = "bg-[var(--bg-card)] rounded-3xl flex flex-col border border-[var(--border-primary)] p-5 sm:p-6 transition-all duration-300 shadow-lg hover:shadow-xl";
                            const selectedStyle = selectedPlan === plan.id 
                                ? 'border-2 border-[var(--bg-accent)] shadow-2xl bg-[var(--bg-accent)]/5 ring-2 ring-[var(--bg-accent)]/20 scale-[1.02] transform' 
                                : 'hover:border-[var(--border-secondary)] hover:shadow-2xl hover:scale-[1.01] transform';
                            return (
                                <div key={plan.id} onClick={() => setSelectedPlan(plan.id as any)} className={`${planCardBaseStyle} ${selectedStyle} cursor-pointer relative`}>
                                    {selectedPlan === plan.id && (
                                        <div className="absolute top-4 right-4 z-20">
                                            <div className="bg-[var(--bg-accent)] text-[var(--text-white)] rounded-full p-1.5 shadow-lg">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        </div>
                                    )}
                                    {plan.recommended && isYearly && (
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                                            <span className="inline-block bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-md">
                                                Popular
                                            </span>
                                        </div>
                                    )}
                                    {plan.id === 'pro' && (
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                                            <div className="bg-[var(--bg-solid-button)] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
                                                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                                <span>Student? Get 2 Months PRO FREE!</span>
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEmailModalOpen(true);
                                                }} className="underline hover:text-yellow-300 focus:outline-none ml-1">Details</button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-grow">
                                      <h3 className={`text-2xl font-bold mb-3 flex items-center text-optimized transition-colors duration-200 ${selectedPlan === plan.id ? 'text-[var(--bg-accent)]' : 'text-[var(--text-primary)]'}`}>
                                        {Icon && <Icon className={`w-5 h-5 mr-2 transition-colors duration-200 ${selectedPlan === plan.id ? 'text-[var(--bg-accent)]' : plan.id === 'premium' ? "text-[var(--text-primary)]" : plan.id === 'pro' ? "text-[var(--text-primary)]" : "text-[var(--bg-accent)]"}`} />}
                                        {plan.name}
                                      </h3>
                                      <p className="text-[var(--text-secondary)] mb-6 text-sm text-optimized text-left">
                                        {plan.id === 'basic' ? 'For light users and trying things out.' : 
                                         plan.id === 'premium' ? 'Best value for unlimited access.' : 
                                         'For students and regular usage.'}
                                      </p>
                                      <div className="mb-8 text-left">
                                          <span className="text-price-large text-[var(--text-primary)]">
                                              {plan.id === 'basic' ? plan.price : (isYearly ? plan.priceYearly : plan.priceMonthly)}
                                          </span>
                                          <span className="text-[var(--text-secondary)] text-sm"> {plan.id === 'basic' ? plan.priceSuffix : '/ month'}</span>
                                          {plan.id !== 'basic' && <p className="text-xs text-[var(--text-secondary)] mt-1 text-left">{isYearly ? plan.billingTextYearly : plan.billingTextMonthly}</p>}
                                      </div>
                                      <ul className="space-y-4 mb-8">
                                          {plan.features.map(feature => <FeatureItem key={feature} text={feature} />)}
                                      </ul>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <footer className="w-full mt-auto pt-8 sm:pt-10">
          <div className="w-full flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-center sm:justify-start gap-6">
                  {step > 0 && (
                      <button onClick={handleBack} className="flex items-center gap-1.5 px-6 py-3 text-sm font-semibold rounded-full transition-colors duration-200 text-[var(--text-secondary)] bg-[var(--bg-highlight)] hover:bg-[var(--bg-accent)]/20">
                          <ArrowLeft className="w-4 h-4" />
                          Back
                      </button>
                  )}
                  {(step > 0 && step < TOTAL_STEPS - 1) && (
                       <button onClick={handleNext} className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--bg-accent)] transition-colors">
                          Skip
                      </button>
                  )}
                   {step === 0 && (
                      <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--bg-accent)] transition-colors">
                          Skip All
                      </button>
                  )}
              </div>

              {step < TOTAL_STEPS - 1 ? (
                <button onClick={handleNext} disabled={isNextDisabled()} className="w-full sm:w-auto px-8 py-3 text-sm font-semibold text-[var(--text-white)] bg-[var(--bg-accent)] rounded-full hover:bg-[var(--bg-accent-secondary)] transition-colors duration-200 disabled:bg-[var(--bg-highlight)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed shadow-sm">
                  {step === 0 ? "Let's Get Started" : "Continue"}
                </button>
              ) : (
                <button onClick={handleFinish} disabled={isFinishing} className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-[var(--text-white)] bg-[var(--status-success)] rounded-full hover:bg-[var(--status-success)]/80 transition-colors duration-200 shadow-sm flex items-center justify-center min-w-[170px]">
                  {isFinishing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Learning Now"}
                </button>
              )}
          </div>
        </footer>
      </div>
      <StudentEmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  );
}
