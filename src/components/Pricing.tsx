import { useEffect, useState } from 'react';
import { useAuth as useGlobalAuth } from '../contexts/AuthContext';
import { Loader2, Check, AlertCircle, GraduationCap } from 'lucide-react';
import { subscribeToAuthState } from '../lib/pricing-firebase';
import { Logo } from './Logo';
import { createCheckoutSession } from '../lib/stripe-client';
import { motion } from 'framer-motion';
import {
    UserTier,
    getUserTier,
} from '../lib/current-paying-user';
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

type PlanName = 'PREMIUM' | 'PRO' | 'BASIC';

interface ButtonInfo {
    text: string;
    disabled: boolean;
    isCurrent: boolean;
    isLoading: boolean;
    actionType: 'subscribe' | 'redirect' | 'none';
    redirectTo?: string;
}

const FeatureItem = ({ text }: { text: string }) => (
  <li className="flex items-start">
    <Check className="w-4 h-4 text-[var(--text-primary)] mr-3 flex-shrink-0 mt-0.5" />
    <span className="text-[var(--text-secondary)] text-sm text-optimized">{text}</span>
  </li>
);

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
        className="fixed -z-10 top-[-25vh] left-[-25vw] w-[100vw] h-[100vh] bg-purple-500 rounded-full"
        style={{
          filter: 'blur(180px)',
          animation: 'subtleFloat1 35s infinite ease-in-out',
        }}
      />
      <div
        className="fixed -z-10 top-[20vh] right-[-30vw] w-[90vw] h-[90vh] bg-indigo-500 rounded-full"
        style={{
          filter: 'blur(150px)',
          animation: 'subtleFloat2 45s infinite ease-in-out 5s',
        }}
      />
      <div
        className="fixed -z-10 bottom-[-20vh] left-[10vw] w-[80vw] h-[80vh] bg-pink-400 rounded-full"
        style={{
          filter: 'blur(130px)',
          animation: 'subtleFloat3 40s infinite ease-in-out 10s',
        }}
      />
    </>
  );
};


function Pricing() {
  const { user: authUser, loading: authLoading } = useGlobalAuth();
  const [localUser, setLocalUser] = useState<any>(null);
  const [isYearly, setIsYearly] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [userCurrentTier, setUserCurrentTier] = useState<UserTier>('loading');
  const [showStudentOfferOnProCard, setShowStudentOfferOnProCard] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
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
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      setLocalUser(firebaseUser);
      setIsCheckingOut(null);
      setCheckoutError(null);
      if (firebaseUser) {
        setUserCurrentTier('loading');
        try {
          const tier = await getUserTier(firebaseUser.uid, firebaseUser.email);
          setUserCurrentTier(tier);
        } catch (error) {
          console.error("Error fetching user tier:", error);
          setUserCurrentTier('basic');
        }
      } else {
        setUserCurrentTier('basic');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let canPotentiallyShowOffer = !localUser || userCurrentTier === 'basic';
    if (!canPotentiallyShowOffer) {
      setShowStudentOfferOnProCard(false);
      return;
    }
    const offerTimer = setTimeout(() => setShowStudentOfferOnProCard(true), 750);
    return () => clearTimeout(offerTimer);
  }, [localUser, userCurrentTier]);

  const handleSubscribe = async (priceId: string, targetPlan: PlanName) => {
    if (!localUser) {
      setCheckoutError('Please login or sign up to subscribe.');
      return;
    }
    if (isCheckingOut || (targetPlan === 'PREMIUM' && userCurrentTier === 'premium') || (targetPlan === 'PRO' && userCurrentTier === 'pro')) {
      return;
    }
    setIsCheckingOut(priceId);
    setCheckoutError(null);
    try {
      // The createCheckoutSession function now handles the redirect automatically
      await createCheckoutSession(priceId);
      // If we reach here, redirect was successful (though user will be navigated away)
    } catch (error: any) {
      setCheckoutError(error.message || 'Failed to initiate subscription.');
      setIsCheckingOut(null);
    }
  };

  const getButtonInfo = (planName: PlanName, targetPriceId?: string): ButtonInfo => {
    if (!localUser && (planName === 'PREMIUM' || planName === 'PRO')) {
      return { text: "Sign Up to Subscribe", disabled: false, isCurrent: false, isLoading: false, actionType: 'redirect', redirectTo: '/signup' };
    }

    if (targetPriceId && isCheckingOut === targetPriceId) return { text: "Processing...", disabled: true, isCurrent: false, isLoading: true, actionType: 'subscribe' };
    
    if (localUser && userCurrentTier === 'loading') return { text: "Loading...", disabled: true, isCurrent: false, isLoading: false, actionType: 'none' };

    switch (planName) {
      case 'PREMIUM':
        if (localUser && userCurrentTier === 'premium') return { text: "Current Plan", disabled: true, isCurrent: true, isLoading: false, actionType: 'none' };
        return { text: "Upgrade to Premium", disabled: false, isCurrent: false, isLoading: false, actionType: 'subscribe' };
      case 'PRO':
        if (localUser && userCurrentTier === 'pro') return { text: "Current Plan", disabled: true, isCurrent: true, isLoading: false, actionType: 'none' };
        if (localUser && userCurrentTier === 'premium') return { text: "Manage Subscription", disabled: false, isCurrent: false, isLoading: false, actionType: 'redirect', redirectTo: '/settings' };
        return { text: "Upgrade to Pro", disabled: false, isCurrent: false, isLoading: false, actionType: 'subscribe' };
      case 'BASIC':
        if (localUser && userCurrentTier === 'basic') return { text: "Current Plan", disabled: true, isCurrent: true, isLoading: false, actionType: 'redirect', redirectTo: '/dashboard' };
        if (localUser) return { text: "Go to Dashboard", disabled: false, isCurrent: false, isLoading: false, actionType: 'redirect', redirectTo: '/dashboard' };
        return { text: "Sign Up Free", disabled: false, isCurrent: false, isLoading: false, actionType: 'redirect', redirectTo: '/signup' };
      default:
        return { text: "Get Started", disabled: false, isCurrent: false, isLoading: false, actionType: 'none' };
    }
  };


  if (authLoading && !localUser && userCurrentTier === 'loading') {
    return <div className="min-h-screen bg-white dark:bg-[#0C0E1A] flex items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /></div>;
  }

  const premiumPriceText = isYearly ? '$9.99' : '$14.99';
  const proPriceText = isYearly ? '$7.99' : '$11.99';
  const priceSuffix = '/ month';
  const premiumBillingText = isYearly ? 'Billed yearly' : 'Billed monthly';
  const proBillingText = isYearly ? 'Billed yearly' : 'Billed monthly';

  const premiumAnnualSavings = ((14.99 * 12) - (9.99 * 12)).toFixed(2);
  const recommendationText = `Save $${premiumAnnualSavings} / year!`;

  const headerMotionVariants = { 
    hidden: { opacity: 0, y: -30 }, 
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } 
  };
  
  const premiumStripePriceId = STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'];
  const proStripePriceId = STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'];
  
  const premiumButtonInfo = getButtonInfo('PREMIUM', premiumStripePriceId);
  const proButtonInfo = getButtonInfo('PRO', proStripePriceId);
  const basicButtonInfo = getButtonInfo('BASIC');

  const planCardBaseStyle = "bg-[var(--bg-card)] rounded-3xl flex flex-col border border-[var(--border-primary)] p-5 sm:p-6 transition-all duration-300 shadow-lg hover:shadow-xl";
  const planButtonBaseStyle = "w-full block text-center py-3 px-6 rounded-2xl font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-clarika selection:bg-[var(--bg-accent)] selection:text-white relative overflow-hidden">
      <AnimatedBackground />
      <motion.header className="w-full py-5 sm:py-6 bg-transparent z-10" variants={headerMotionVariants} initial="hidden" animate="visible">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <a href="/" aria-label="TaskMaster AI Home"><Logo /></a>
            <div className="flex items-center">
              <a href={authUser ? "/dashboard" : "/signup"} className="px-6 py-2.5 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-lg">
                {authUser ? "Dashboard" : "Start today - It's Free"}
              </a>
            </div>
          </nav>
        </div>
      </motion.header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full max-w-screen-2xl z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4 text-optimized">
            Pricing Plans
          </h1>
        </div>

        <div className="flex justify-center mb-16">
          <div className="bg-[var(--bg-highlight)] p-1 rounded-3xl flex border border-[var(--border-primary)] shadow-md">
            <button
              className={`px-8 py-3 rounded-3xl transition-all duration-300 text-sm font-medium focus:outline-none text-optimized ${isYearly ? 'bg-[var(--bg-solid-button)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={() => { setIsYearly(true); setCheckoutError(null); }}
            >
              Yearly <span className="text-xs opacity-80">(Save 33%)</span>
            </button>
            <button
              className={`px-8 py-3 rounded-3xl transition-all duration-300 text-sm font-medium focus:outline-none text-optimized ${!isYearly ? 'bg-[var(--bg-solid-button)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={() => { setIsYearly(false); setCheckoutError(null); }}
            >
              Monthly
            </button>
          </div>
        </div>

        {checkoutError && (
          <div className="mb-8 p-4 bg-red-100/50 dark:bg-red-900/50 backdrop-blur-sm border border-red-500/30 rounded-2xl text-red-700 dark:text-red-300 text-sm flex items-center justify-center gap-3 max-w-xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
            <span>{checkoutError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-7xl mx-auto">
            <div className={`${planCardBaseStyle} hover:border-[var(--border-secondary)] hover:shadow-2xl`}>
                <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3 text-optimized">Basic</h3>
                    <p className="text-[var(--text-secondary)] mb-6 text-sm text-optimized">For light users and trying things out.</p>
                    <div className="mb-8">
                        <span className="text-price-large text-[var(--text-primary)]">Free</span>
                        <span className="text-[var(--text-secondary)] text-sm"> / forever</span>
                    </div>
                    <ul className="space-y-4 mb-8">
                        <FeatureItem text="5 PDF and Text Notes per month" />
                        <FeatureItem text="3 YouTube Notes per month" />
                        <FeatureItem text="25 Chat Messages per month" />
                    </ul>
                </div>
                <a href={basicButtonInfo.redirectTo || '#'}
                   className={`${planButtonBaseStyle} ${basicButtonInfo.disabled ? 'bg-[var(--bg-highlight)] text-[var(--text-muted)] cursor-default' : 'bg-[var(--bg-solid-button)] text-white hover:bg-[var(--bg-accent)] focus:ring-[var(--bg-accent)]'}`}>
                  {basicButtonInfo.text}
                </a>
            </div>

            <div className={`${planCardBaseStyle} border-2 border-[var(--bg-solid-button)] relative shadow-2xl hover:shadow-3xl`}>
                {isYearly && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                    <span className="inline-block bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-md">
                    Popular
                    </span>
                </div>
                )}
                <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3 text-optimized">Premium</h3>
                    <p className="text-[var(--text-secondary)] mb-6 text-sm text-optimized">Best value for unlimited access.</p>
                    <div className="mb-8">
                        <span className="text-price-large text-[var(--text-primary)]">{premiumPriceText}</span>
                        <span className="text-[var(--text-secondary)] text-sm">{priceSuffix}</span>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{premiumBillingText}</p>
                    </div>
                    <ul className="space-y-4 mb-8">
                        <FeatureItem text="Unlimited PDF and Text Notes" />
                        <FeatureItem text="Unlimited YouTube Notes" />
                        <FeatureItem text="Unlimited Chat Messages" />
                        <FeatureItem text="Unlimited Smarter AI Responses" />
                        <FeatureItem text="Unlimited Smart Daily Brief" />
                        <FeatureItem text="Unlimited Podcasts" />
                        <FeatureItem text="Priority Support"/>
                    </ul>
                </div>
                <button 
                    onClick={() => {
                        if (premiumButtonInfo.actionType === 'redirect' && premiumButtonInfo.redirectTo) {
                            window.location.href = premiumButtonInfo.redirectTo;
                        } else if (premiumButtonInfo.actionType === 'subscribe' && !premiumButtonInfo.disabled) {
                            handleSubscribe(premiumStripePriceId, 'PREMIUM');
                        }
                    }} 
                    disabled={premiumButtonInfo.disabled || (!!isCheckingOut && !premiumButtonInfo.isLoading)}
                    className={`${planButtonBaseStyle} ${premiumButtonInfo.disabled && premiumButtonInfo.isCurrent ? 'bg-[var(--bg-highlight)] text-[var(--text-muted)] cursor-default' : 'bg-[var(--bg-solid-button)] text-white hover:bg-[var(--bg-accent)] focus:ring-[var(--bg-accent)]'} ${(!!isCheckingOut && !premiumButtonInfo.isLoading) ? 'opacity-60 cursor-not-allowed' : ''} flex items-center justify-center gap-2`}
                >
                {premiumButtonInfo.isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> {premiumButtonInfo.text}</> : premiumButtonInfo.text}
                </button>
            </div>

            <div className={`${planCardBaseStyle} relative hover:border-[var(--border-secondary)] hover:shadow-2xl`}>
                {showStudentOfferOnProCard && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/3 z-10">
                    <div className="bg-[var(--bg-solid-button)] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span>Student? Get 2 Months PRO FREE!</span>
                        <button onClick={() => setIsEmailModalOpen(true)} className="underline hover:text-yellow-300 focus:outline-none ml-1">Details</button>
                    </div>
                </div>
                )}
                <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3 text-optimized">Pro</h3>
                    <p className="text-[var(--text-secondary)] mb-6 text-sm text-optimized">For students and regular usage.</p>
                    <div className="mb-8">
                        <span className="text-price-large text-[var(--text-primary)]">{proPriceText}</span>
                        <span className="text-[var(--text-secondary)] text-sm">{priceSuffix}</span>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{proBillingText}</p>
                    </div>
                    <ul className="space-y-4 mb-8">
                        <FeatureItem text="25 PDF and Text Notes per month" />
                        <FeatureItem text="15 YouTube Notes per month" />
                        <FeatureItem text="500 Chat Messages per Month" />
                        <FeatureItem text="Limited Access to Smart Daily Brief" />
                    </ul>
                </div>
                <button 
                    onClick={() => {
                        if (proButtonInfo.actionType === 'redirect' && proButtonInfo.redirectTo) {
                            window.location.href = proButtonInfo.redirectTo;
                        } else if (proButtonInfo.actionType === 'subscribe' && !proButtonInfo.disabled) {
                            handleSubscribe(proStripePriceId, 'PRO');
                        }
                    }} 
                    disabled={proButtonInfo.disabled || (!!isCheckingOut && !proButtonInfo.isLoading)}
                    className={`${planButtonBaseStyle} ${
                        proButtonInfo.disabled && proButtonInfo.isCurrent 
                            ? 'bg-[var(--bg-highlight)] text-[var(--text-muted)] cursor-default' 
                            : proButtonInfo.actionType === 'redirect' && proButtonInfo.redirectTo === '/settings'
                                ? 'bg-[var(--bg-solid-button)] text-white hover:bg-[var(--bg-accent)] focus:ring-[var(--bg-accent)]' 
                                : 'bg-[var(--bg-solid-button)] text-white hover:bg-[var(--bg-accent)] focus:ring-[var(--bg-accent)]'
                        } ${(!!isCheckingOut && !proButtonInfo.isLoading) ? 'opacity-60 cursor-not-allowed' : ''} flex items-center justify-center gap-2`}
                >
                {proButtonInfo.isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> {proButtonInfo.text}</> : proButtonInfo.text}
                </button>
            </div>
        </div>
      </main>

      <footer className="bg-transparent z-10">
        <div className="container mx-auto px-5 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4">
              <a href="/privacy-policy" className="text-sm text-[var(--text-secondary)] hover:text-[var(--bg-solid-button)] transition-colors">Privacy Policy</a>
              <span className="text-[var(--border-primary)] hidden sm:inline">|</span>
              <a href="/terms" className="text-sm text-[var(--text-secondary)] hover:text-[var(--bg-solid-button)] transition-colors">Terms & Conditions</a>
            </div>
            <p className="text-sm text-[var(--text-secondary)] text-center md:text-right">© {new Date().getFullYear()} TaskMaster AI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <StudentEmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  );
}

export default Pricing;
