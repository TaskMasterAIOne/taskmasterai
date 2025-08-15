import React, { useState, useEffect } from 'react';
import {
  NotebookPen,
  Bot,
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
  Gem
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser } from '../lib/settings-firebase';
// MODIFICATION: Import getUserContext to fetch existing user data.
import { saveUserContext, getUserContext, UserContext } from '../lib/ai-context-firebase';
import { createCheckoutSession, getStripe } from '../lib/stripe-client';
// NOTE: You need to have these files and functions available in your project.
// This is a placeholder for the actual import.
import { getUserTier, UserTier } from '../lib/current-paying-user';


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
          <stop offset="0%" style={{ stopColor: '#635BFF' }} />
          <stop offset="100%" style={{ stopColor: '#8A85FF' }} />
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
  <button onClick={() => onSelect(option.id)} className={`w-full text-left p-4 sm:p-5 border-2 rounded-xl transition-all duration-200 ${selected ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
    <div className="flex items-start gap-4">
      <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-gray-600'}`}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{option.title}</h3>
        {hasDescription && option.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>}
      </div>
    </div>
  </button>
);

const FeatureItem = ({ text }: { text: string }) => (
  <li className="flex items-start">
    <Check className="w-4 h-4 text-indigo-500 dark:text-indigo-400 mr-2 flex-shrink-0 mt-1" />
    <span className="text-gray-600 dark:text-gray-400 text-sm">{text}</span>
  </li>
);

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    learningGoal: [] as string[],
    motivation: '', otherMotivation: '', experienceLevel: '', usageStyle: '',
    role: '', shortTermFocus: '', longTermGoals: '', otherContext: ''
  });
  const [currentGoalInput, setCurrentGoalInput] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('basic');
  const [isYearly, setIsYearly] = useState(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<UserTier>('loading');

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
      case 2: return !formData.motivation.trim() || (formData.motivation === 'other' && !formData.otherMotivation.trim());
      case 3: return !formData.experienceLevel.trim();
      case 4: return !formData.usageStyle.trim();
      default: return false;
    }
  };

  const getSummaryItem = (id: string) => {
    switch (id) {
        case 'motivation':
            const mot = motivationOptions.find(o => o.id === formData.motivation);
            return formData.motivation === 'other' ? formData.otherMotivation : mot?.title;
        case 'experienceLevel':
            return experienceLevels.find(o => o.id === formData.experienceLevel)?.title;
        case 'usageStyle':
            return usageStyles.find(o => o.id === formData.usageStyle)?.title;
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
        const motivationText = formData.motivation === 'other'
            ? formData.otherMotivation
            : motivationOptions.find(o => o.id === formData.motivation)?.title || 'Not set';
        const experienceText = experienceLevels.find(o => o.id === formData.experienceLevel)?.title || 'Not set';
        const usageStyleText = usageStyles.find(o => o.id === formData.usageStyle)?.title || 'Not set';

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
        
        const { sessionId } = await createCheckoutSession(priceId, user.uid);
        const stripe = await getStripe();
        if (!stripe) throw new Error('Stripe.js failed to load.');
        
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
            throw error;
        }

    } catch (error) {
        console.error("Failed during finish process:", error);
        setCheckoutError("An error occurred. Please try again or continue to the dashboard.");
        setIsFinishing(false);
        setTimeout(() => navigate('/dashboard'), 3000);
    }
  };
  
  const plans = [
    { id: 'basic', name: 'Basic', price: 'Free', priceSuffix: '/ forever', features: [ "2 PDF and Text Notes per month", "1 YouTube Notes per month", "10 AI Chat Interactions per month" ] },
    { id: 'premium', name: 'Premium', icon: Crown, priceYearly: '$9.99', priceMonthly: '$14.99', recommended: true, billingTextYearly: "Billed yearly", billingTextMonthly: "Billed monthly", features: [ "Unlimited PDF and Text Notes", "Unlimited YouTube Notes", "Unlimited AI Chat Interactions", "Unlimited Smart Daily Brief", "Unlimited Podcasts", "Priority Support" ] },
    { id: 'pro', name: 'Pro', icon: Gem, priceYearly: '$7.99', priceMonthly: '$11.99', billingTextYearly: "Billed yearly", billingTextMonthly: "Billed monthly", features: [ "10 PDF and Text Notes per month", "5 YouTube Notes per month", "200 AI Chat Interactions per Month", "Limited Access to Smart Daily Brief" ] }
  ];

  const progressPercentage = (step / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0C0E1A] font-poppins text-gray-800 dark:text-gray-100 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-5xl flex-grow flex flex-col">
        <header className="py-4 mb-6 sm:mb-8 flex items-center gap-4">
          <LogoIcon className="w-8 h-8" />
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
            <motion.div className="bg-indigo-500 h-2 rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} transition={{ ease: "easeInOut", duration: 0.5 }} />
          </div>
        </header>
        
        <main className="flex flex-col items-center justify-center flex-grow">
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="w-full">
              
              {step === 0 && (
                 <div className="text-center max-w-3xl mx-auto">
                  <h1 className="text-3xl sm:text-4xl font-semibold mb-3">Welcome to TaskMaster AI</h1>
                  <p className="text-gray-500 dark:text-gray-400 mx-auto mb-8 sm:mb-12">Your personal AI learning companion for any subject.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-[#161922] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-shrink-0 bg-indigo-100 dark:bg-indigo-500/10 p-3 rounded-lg"><LayoutDashboard className="w-7 h-7 text-indigo-500" /></div>
                        <div className="text-left flex-grow">
                           <h3 className="font-semibold text-gray-800 dark:text-gray-100">Dashboard</h3>
                           <p className="text-sm text-gray-500 dark:text-gray-400">Your command center for tasks, goals, events, and tracking productivity trends.</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50 text-left"><div className="bg-indigo-100 dark:bg-indigo-500/10 p-3 rounded-lg w-fit mb-3"><Folder className="w-6 h-6 text-indigo-500" /></div><h3 className="font-semibold text-gray-800 dark:text-gray-100">Folders</h3><p className="text-sm text-gray-500 dark:text-gray-400">Organize study materials with flashcards and quizzes per subject.</p></div>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50 text-left"><div className="bg-indigo-100 dark:bg-indigo-500/10 p-3 rounded-lg w-fit mb-3"><NotebookPen className="w-6 h-6 text-indigo-500" /></div><h3 className="font-semibold text-gray-800 dark:text-gray-100">Notes</h3><p className="text-sm text-gray-500 dark:text-gray-400">Beautiful notes from any source, complete with learning materials.</p></div>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50 text-left"><div className="bg-indigo-100 dark:bg-indigo-500/10 p-3 rounded-lg w-fit mb-3"><Focus className="w-6 h-6 text-indigo-500" /></div><h3 className="font-semibold text-gray-800 dark:text-gray-100">Focus</h3><p className="text-sm text-gray-500 dark:text-gray-400">Block distractions and stay focused.</p></div>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700/50 text-left md:col-span-2 lg:col-span-3"><div className="bg-indigo-100 dark:bg-indigo-500/10 p-3 rounded-lg w-fit mb-3"><Bot className="w-6 h-6 text-indigo-500" /></div><h3 className="font-semibold text-gray-800 dark:text-gray-100">AI Chat</h3><p className="text-sm text-gray-500 dark:text-gray-400">Your personal AI agent that is personalized for you and can take action to supercharge your learning.</p></div>
                  </div>
                </div>
              )}

              {[1, 2, 3, 4, 5, 7].includes(step) && <div className="max-w-3xl mx-auto w-full">
                {step === 1 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">What do you want to learn?</h1>
                    <p className="text-gray-500 dark:text-gray-400 mx-auto mb-8">This will help us tailor your experience. Select one or more goals.</p>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-700/50 space-y-6">
                      <div className="text-left">
                        <label htmlFor="learningGoal" className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Your learning goals</label>
                        <div className="relative">
                          <input id="learningGoal" type="text" value={currentGoalInput} onChange={(e) => setCurrentGoalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomGoal())} placeholder="Type a goal and press Enter..." className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"/>
                        </div>
                        {formData.learningGoal.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {formData.learningGoal.map(goal => (
                              <span key={goal} className="flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium px-3 py-1 rounded-full">
                                {goal}
                                <button onClick={() => handleLearningGoalToggle(goal)} className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"><X className="w-3.5 h-3.5" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div><p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 text-left">Popular choices</p><div className="flex flex-wrap gap-2 sm:gap-3">{popularChoices.map(choice => <button key={choice} onClick={() => handleLearningGoalToggle(choice)} className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-200 ${formData.learningGoal.includes(choice) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{choice}</button>)}</div></div>
                    </div>
                  </div>
                )}
                {[2, 3, 4].includes(step) && (
                  <div className="text-center">
                      <h1 className="text-2xl sm:text-4xl font-semibold mb-3">{step === 2 ? 'Why are you learning this?' : step === 3 ? 'What level are you at?' : 'How do you plan to use TaskMaster?'}</h1>
                      <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8">{step === 2 ? "Understanding your 'why' helps us personalize your journey." : step === 3 ? `Help us understand your current knowledge level in your subjects.` : 'Understanding your style helps make a better learning companion.'}</p>
                      <div className="bg-white dark:bg-[#161922] p-4 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-700/50 space-y-4">
                          {step === 2 && motivationOptions.map(option => (<div key={option.id}><RadioCard option={option} selected={formData.motivation === option.id} onSelect={(id) => handleChange('motivation', id)} hasDescription={false} />{option.id === 'other' && formData.motivation === 'other' && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 ml-10"><input type="text" value={formData.otherMotivation} onChange={(e) => handleChange('otherMotivation', e.target.value)} placeholder="Please specify your motivation" className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" /></motion.div>}</div>))}
                          {step === 3 && experienceLevels.map(option => <RadioCard key={option.id} option={option} selected={formData.experienceLevel === option.id} onSelect={(id) => handleChange('experienceLevel', id)} />)}
                          {step === 4 && usageStyles.map(option => <RadioCard key={option.id} option={option} selected={formData.usageStyle === option.id} onSelect={(id) => handleChange('usageStyle', id)} />)}
                      </div>
                  </div>
                )}
                {step === 5 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Set Your Universal Context</h1>
                    <p className="text-gray-500 dark:text-gray-400 mx-auto mb-8">This helps TaskMaster provide perfectly aligned responses without you repeating yourself.</p>
                     <div className="bg-white dark:bg-[#161922] p-4 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-700/50 space-y-5 text-left">
                       <div><label htmlFor="role" className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Your Role / Primary Area of Study</label><textarea id="role" value={formData.role} onChange={e => handleChange('role', e.target.value)} placeholder="e.g., College student majoring in CS..." rows={2} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"></textarea></div>
                       <div><label htmlFor="shortTermFocus" className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Current Short-Term Focus</label><textarea id="shortTermFocus" value={formData.shortTermFocus} onChange={e => handleChange('shortTermFocus', e.target.value)} placeholder="e.g., Preparing for SATs and final exams..." rows={2} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"></textarea></div>
                       <div><label htmlFor="longTermGoals" className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Main Long-Term Ambitions or Goals</label><textarea id="longTermGoals" value={formData.longTermGoals} onChange={e => handleChange('longTermGoals', e.target.value)} placeholder="e.g., Get a job at a top tech company..." rows={2} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"></textarea></div>
                       <div><label htmlFor="otherContext" className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 block">Other (Learning style, preferences, etc.)</label><textarea id="otherContext" value={formData.otherContext} onChange={e => handleChange('otherContext', e.target.value)} placeholder="e.g., I learn best with real-world examples..." rows={2} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"></textarea></div>
                     </div>
                  </div>
                )}
                 {step === 7 && (
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Your Learning Style is Ready!</h1>
                    <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8">We've crafted a personalized experience based on your preferences.</p>
                    <div className="bg-white dark:bg-[#161922] p-4 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-700/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          {[{ icon: GoalIcon, label: "Learning Goals", value: formData.learningGoal.join(', '), key: "learningGoal" }, { icon: Sparkles, label: "Motivation", value: getSummaryItem('motivation'), key: "motivation" }, { icon: BarChart, label: "Experience Level", value: getSummaryItem('experienceLevel'), key: "experienceLevel" }, { icon: SlidersHorizontal, label: "Learning Style", value: getSummaryItem('usageStyle'), key: "usageStyle" }].map(item => (<div key={item.key} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-left"><div className="flex items-center gap-3 mb-1.5"><item.icon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /><h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</h4></div><p className="font-semibold text-gray-800 dark:text-gray-100 truncate" title={item.value as string}>{item.value || 'Not set'}</p></div>))}
                      </div>
                    </div>
                  </div>
                )}
              </div>}
              
              {step === 6 && (
                <div className="text-center">
                    <h1 className="text-2xl sm:text-4xl font-semibold mb-3">Complete Your TaskMaster Experience</h1>
                    <p className="text-gray-500 dark:text-gray-400 mx-auto mb-8"></p>
                    <div className="flex justify-center mb-8">
                        <div className="bg-gray-200 dark:bg-[#161922] p-1.5 rounded-full flex border border-gray-300 dark:border-gray-700/60">
                            <button onClick={() => setIsYearly(true)} className={`px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium focus:outline-none ${isYearly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100'}`}>Yearly (Save 33%)</button>
                            <button onClick={() => setIsYearly(false)} className={`px-5 py-2 rounded-full transition-all duration-300 text-sm font-medium focus:outline-none ${!isYearly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100'}`}>Monthly</button>
                        </div>
                    </div>
                    {checkoutError && <p className="text-red-500 text-sm mb-4">{checkoutError}</p>}
                    <div className="grid grid-cols-1 text-left lg:grid-cols-3 gap-6 items-stretch">
                        {plans.map((plan) => {
                            const Icon = plan.icon;
                            return (
                                <div key={plan.id} onClick={() => setSelectedPlan(plan.id as any)} className={`relative bg-white dark:bg-[#161922] rounded-2xl p-6 flex flex-col border-2 transition-all cursor-pointer ${selectedPlan === plan.id ? 'border-indigo-500 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400/50'}`}>
                                    {plan.recommended && isYearly && <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-black text-xs font-semibold px-3 py-1 rounded-full z-10">RECOMMENDED</div>}
                                    <div className="flex-grow">
                                      <h3 className={`text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2 ${plan.recommended && isYearly ? 'pt-2' : ''}`}>
                                        {Icon && <Icon className={plan.id === 'premium' ? "text-yellow-500 dark:text-yellow-400" : "text-purple-500 dark:text-purple-400"} />}
                                        {plan.name}
                                      </h3>
                                      <div className="my-4">
                                          <span className="text-4xl font-semibold text-left text-gray-800 dark:text-white">
                                              {plan.id === 'basic' ? plan.price : (isYearly ? plan.priceYearly : plan.priceMonthly)}
                                          </span>
                                          <span className="text-gray-500 text-left dark:text-gray-400 text-sm"> {plan.id === 'basic' ? plan.priceSuffix : '/ month'}</span>
                                          {plan.id !== 'basic' && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{isYearly ? plan.billingTextYearly : plan.billingTextMonthly}</p>}
                                      </div>
                                      <ul className="space-y-2.5 my-6 text-left">
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
                      <button onClick={handleBack} className="flex items-center gap-1.5 px-6 py-3 text-sm font-semibold rounded-full transition-colors duration-200 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-700">
                          <ArrowLeft className="w-4 h-4" />
                          Back
                      </button>
                  )}
                  {(step > 0 && step < TOTAL_STEPS - 1) && (
                       <button onClick={handleNext} className="text-sm font-medium text-gray-500 hover:text-indigo-500 transition-colors">
                          Skip
                      </button>
                  )}
                   {step === 0 && (
                      <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-gray-500 hover:text-indigo-500 transition-colors">
                          Skip All
                      </button>
                  )}
              </div>

              {step < TOTAL_STEPS - 1 ? (
                <button onClick={handleNext} disabled={isNextDisabled()} className="w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed shadow-sm">
                  {step === 0 ? "Let's Get Started" : "Continue"}
                </button>
              ) : (
                <button onClick={handleFinish} disabled={isFinishing} className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-green-600 rounded-full hover:bg-green-700 transition-colors duration-200 shadow-sm flex items-center justify-center min-w-[170px]">
                  {isFinishing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Learning Now"}
                </button>
              )}
          </div>
        </footer>
      </div>
    </div>
  );
}
