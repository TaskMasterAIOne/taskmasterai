import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Adjust path if needed
import { Loader2, Crown, Gem, Check, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { subscribeToAuthState } from '../lib/pricing-firebase'; // Adjust path if needed
import { Logo } from './Logo'; // Adjust path if needed
import { createCheckoutSession, getStripe } from '../lib/stripe-client'; // Added from NEW
import { motion } from 'framer-motion';
// --- IMPORT NEW TIER/USAGE FUNCTIONS AND TYPES ---
import {
    UserTier, // Import the type
    getUserTier, // <<< THIS IS THE ASYNC FUNCTION
} from '../lib/current-paying-user'; // Correct path to the new file

// --- USE YOUR **LIVE** PRICE IDs --- (From NEW code)
const STRIPE_PRICE_IDS = {
  PREMIUM: {
    yearly: 'price_1Qe2OnIdgEonJvEbSDwoNCuH', // LIVE ID
    monthly: 'price_1Qe2JWIdgEonJvEbGUYEkTu6' // LIVE ID
  },
  PRO: {
    yearly: 'price_1Qe2QaIdgEonJvEbaq1M4CQs', // LIVE ID
    monthly: 'price_1Qe2NXIdgEonJvEbxSUK8dMB' // LIVE ID
  }
};

// Helper type for plan names
type PlanName = 'PREMIUM' | 'PRO' | 'BASIC';

function Pricing() {
  const { loading } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [isYearly, setIsYearly] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [userCurrentTier, setUserCurrentTier] = useState<UserTier>('loading');

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      setUser(firebaseUser);
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
        setUserCurrentTier('loading');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubscribe = async (priceId: string, targetPlan: PlanName) => {
    if (!user) {
      setCheckoutError('Please login or sign up to subscribe.');
      return;
    }
    if (isCheckingOut) return;

    if (
        (targetPlan === 'PREMIUM' && userCurrentTier === 'premium') ||
        (targetPlan === 'PRO' && userCurrentTier === 'pro')
    ) {
        console.log("Attempted to subscribe to current plan.");
        return;
    }

    setIsCheckingOut(priceId);
    setCheckoutError(null);

    try {
      console.log(`Initiating LIVE checkout for priceId: ${priceId}`);
      const { sessionId } = await createCheckoutSession(priceId);
      console.log(`Received LIVE sessionId: ${sessionId}`);

      const stripe = await getStripe();
      if (!stripe) { throw new Error('Stripe.js failed to load.'); }
      console.log("Stripe.js loaded, redirecting to LIVE checkout...");

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error("Stripe redirection error:", error);
        setCheckoutError(error.message || 'Could not redirect to Stripe.');
      }
    } catch (error: any) {
      console.error("LIVE Subscription handling error:", error);
      setCheckoutError(error.message || 'Failed to initiate LIVE subscription.');
       setIsCheckingOut(null);
    }
  };

  const getButtonInfo = (planName: PlanName, targetPriceId: string) => {
    const isLoadingThisButton = isCheckingOut === targetPriceId;

    if (isLoadingThisButton) {
        return { text: "Processing...", disabled: true, isCurrent: false, isLoading: true };
    }

    if (userCurrentTier === 'loading') {
        return { text: "Loading Plans...", disabled: true, isCurrent: false, isLoading: false };
    }

    switch (planName) {
        case 'PREMIUM':
            if (userCurrentTier === 'premium') return { text: "Current Plan", disabled: true, isCurrent: true, isLoading: false };
            if (userCurrentTier === 'pro' || userCurrentTier === 'basic') return { text: "Upgrade to Premium", disabled: false, isCurrent: false, isLoading: false };
            break;
        case 'PRO':
            if (userCurrentTier === 'pro') return { text: "Current Plan", disabled: true, isCurrent: true, isLoading: false };
            if (userCurrentTier === 'premium') return { text: "Manage Subscription", disabled: false, isCurrent: false, isDowngrade: true, isLoading: false };
            if (userCurrentTier === 'basic') return { text: "Upgrade to Pro", disabled: false, isCurrent: false, isLoading: false };
            break;
        default:
            break;
    }
    return { text: "Subscribe Now", disabled: false, isCurrent: false, isLoading: false };
  };


  if (loading && userCurrentTier === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const premiumPriceText = isYearly ? '$7.99 per month' : '$9.99 per month';
  const proPriceText = isYearly ? '$4.99 per month' : '$6.99 per month';
  const premiumBillingText = isYearly ? 'Billed yearly' : 'Billed monthly';
  const proBillingText = isYearly ? 'Billed yearly' : 'Billed monthly';

  const premiumMonthlySavings = (9.99 - 7.99).toFixed(2);
  const premiumAnnualSavings = (Number(premiumMonthlySavings) * 12).toFixed(2);
  const recommendationText = `Recommended – Save $${premiumMonthlySavings}/month ($${premiumAnnualSavings}/year)`;

  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.2 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  const renderFeatureItem = (text: string) => (
    <li className="flex items-center">
      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );

  const bannerHeightClass = "h-10";

  const premiumStripePriceId = STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'];
  const proStripePriceId = STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'];

  const premiumButtonInfo = getButtonInfo('PREMIUM', premiumStripePriceId);
  const proButtonInfo = getButtonInfo('PRO', proStripePriceId);


  return (
    <div className="flex flex-col min-h-screen bg-gray-900 font-poppins">
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
            <button
              className="md:hidden text-gray-300 hover:text-indigo-400 focus:outline-none"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="hidden md:flex items-center space-x-8">
              <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors">Features</a>
              <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors">Pricing</a>
              <a href="/contact" className="text-gray-300 hover:text-indigo-400 transition-colors">Contact</a>
              <a
                href={user ? "/dashboard" : "/signup"}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full transition-all transform hover:scale-105"
              >
                {user ? "Dashboard" : "Get Started Today"}
              </a>
            </div>
            <div
              className={`absolute top-full left-0 right-0 bg-gray-900/95 border-b border-gray-800 md:hidden transition-all duration-300 ease-in-out ${ isOpen ? 'opacity-100 visible' : 'opacity-0 invisible' }`}
            >
              <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
                <a href="/#features" className="text-gray-300 hover:text-indigo-400 transition-colors" onClick={toggleMenu}>Features</a>
                <a href="/pricing" className="text-gray-300 hover:text-indigo-400 transition-colors" onClick={toggleMenu}>Pricing</a>
                <a href="/contact" className="text-gray-300 hover:text-indigo-400 transition-colors" onClick={toggleMenu}>Contact</a>
                <a href={user ? "/dashboard" : "/signup"} className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-center transition-all transform hover:scale-105" onClick={toggleMenu}>
                  {user ? "Dashboard" : "Get Started Today"}
                </a>
              </div>
            </div>
          </nav>
        </div>
      </motion.header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 text-white w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-indigo-400 mb-2">Choose Your Perfect Plan</h1>
          <p className="text-gray-300">Select a plan that works best for you.</p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex justify-center mb-8"
        >
          <div className="bg-gray-800 rounded-full flex">
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className={`px-4 py-2 rounded-full transition-colors duration-300 ${isYearly ? 'bg-indigo-500 text-white' : 'text-gray-300'}`}
              onClick={() => { setIsYearly(true); setCheckoutError(null); }}
            >
              Yearly
            </motion.button>
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className={`px-4 py-2 rounded-full transition-colors duration-300 ${!isYearly ? 'bg-indigo-500 text-white' : 'text-gray-300'}`}
              onClick={() => { setIsYearly(false); setCheckoutError(null); }}
            >
              Monthly
            </motion.button>
          </div>
        </motion.div>

        {checkoutError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm flex items-center justify-center gap-3 max-w-2xl mx-auto shadow-md"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-300" />
            <span>{checkoutError}</span>
          </motion.div>
        )}

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch"
        >

          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col overflow-hidden border border-gray-800 hover:shadow-lg hover:shadow-indigo-500/30 transition-shadow duration-300"
          >
             <div className={`${bannerHeightClass} invisible`}></div>
             <div className="p-6 flex flex-col flex-grow">
                <div className="flex-grow mb-6">
                    <h2 className="text-2xl font-bold mb-4">Basic</h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">Free</p>
                    <p className="text-sm text-gray-400 mb-4">Forever free</p>
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("2 PDF and Text Notes per month")}
                        {renderFeatureItem("1 YouTube Notes per month")}
                        {renderFeatureItem("10 AI Chat Interactions per month")}
                        {renderFeatureItem("500 Tokens Included")}
                        {renderFeatureItem("Add Up to 3 Friends")}
                    </ul>
                </div>
                <div className="mt-auto">
                    <motion.a
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        href={user ? "/dashboard" : "/signup"}
                        className={`block w-full text-center py-3 rounded-full font-semibold transition-transform ${userCurrentTier === 'basic' ? 'bg-gray-600 text-gray-400 cursor-default' : 'bg-indigo-500 text-white'}`}
                    >
                        {userCurrentTier === 'basic' ? 'Current Plan' : (user ? 'Access Dashboard' : 'Sign Up Free')}
                    </motion.a>
                </div>
             </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col border-2 border-indigo-500 overflow-hidden hover:shadow-xl hover:shadow-indigo-400/40 transition-shadow duration-300 relative"
          >
            <div className={`${bannerHeightClass} flex items-center justify-center`}>
             {isYearly && (
                <div className="bg-yellow-500 text-black text-xs font-bold w-full h-full flex items-center justify-center px-4 text-center truncate">
                 {recommendationText}
                </div>
             )}
             {!isYearly && <div className="w-full h-full invisible"></div>}
            </div>
            <div className="p-6 flex flex-col flex-grow">
                <div className="flex-grow mb-6">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                        <Crown className="w-6 h-6 text-yellow-400" />
                        Premium
                    </h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">{premiumPriceText}</p>
                    <p className="text-sm text-gray-400 mb-4">{premiumBillingText}</p>
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("Unlimited PDF and Text Notes")}
                        {renderFeatureItem("Unlimited YouTube Notes")}
                        {renderFeatureItem("Unlimited AI Chat Interactions")}
                        {renderFeatureItem("2,500 Tokens Included")}
                        {renderFeatureItem("Add Unlimited Friends")}
                        {renderFeatureItem("Unlimited Access to Smart Overview")}
                    </ul>
                </div>
                <div className="mt-auto">
                    {user ? (
                        <motion.button
                            variants={buttonVariants}
                            whileHover={premiumButtonInfo.disabled ? "" : "hover"}
                            whileTap={premiumButtonInfo.disabled ? "" : "tap"}
                            onClick={() => {
                                if(premiumButtonInfo.isDowngrade){ // Should not happen for premium
                                    window.location.href = '/settings';
                                } else if (!premiumButtonInfo.disabled) {
                                    handleSubscribe(premiumStripePriceId, 'PREMIUM');
                                }
                            }}
                            disabled={premiumButtonInfo.disabled || (!!isCheckingOut && !premiumButtonInfo.isLoading)}
                            className={`w-full text-center py-3 rounded-full font-semibold transition-transform flex items-center justify-center gap-2 ${
                                premiumButtonInfo.disabled && premiumButtonInfo.isCurrent ? 'bg-gray-600 text-gray-400 cursor-default' :
                                'bg-white text-indigo-600 hover:bg-gray-100'
                            } ${(!!isCheckingOut && !premiumButtonInfo.isLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {premiumButtonInfo.isLoading ? (
                                <> <Loader2 className="w-5 h-5 animate-spin" /> {premiumButtonInfo.text} </>
                            ) : (
                                premiumButtonInfo.text
                            )}
                        </motion.button>
                    ) : (
                        <motion.a
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                            href="/signup"
                            className="block w-full text-center py-3 rounded-full font-semibold bg-white text-indigo-600 transition-transform"
                        >
                            Sign Up to Subscribe
                        </motion.a>
                    )}
                </div>
            </div>
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col overflow-hidden border border-gray-800 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow duration-300"
          >
             <div className={`${bannerHeightClass} invisible`}></div>
             <div className="p-6 flex flex-col flex-grow">
                <div className="flex-grow mb-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <Gem className="w-6 h-6 text-purple-400" />
                        Pro
                    </h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">{proPriceText}</p>
                    <p className="text-sm text-gray-400 mb-4">{proBillingText}</p>
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("10 PDF and Text Notes per month")}
                        {renderFeatureItem("5 YouTube Notes per month")}
                        {renderFeatureItem("200 AI Chat Interactions per Month")}
                        {renderFeatureItem("1,000 Tokens Included")}
                        {renderFeatureItem("Add Up to 10 Friends")}
                        {renderFeatureItem("Limited Access to Smart Overview")}
                    </ul>
                </div>
                <div className="mt-auto">
                     {user ? (
                        <motion.button
                            variants={buttonVariants}
                            whileHover={proButtonInfo.disabled ? "" : "hover"}
                            whileTap={proButtonInfo.disabled ? "" : "tap"}
                            onClick={() => {
                                if(proButtonInfo.isDowngrade){
                                     window.location.href = '/settings'; // Or Stripe portal directly
                                } else if (!proButtonInfo.disabled) {
                                    handleSubscribe(proStripePriceId, 'PRO');
                                }
                            }}
                            disabled={proButtonInfo.disabled || (!!isCheckingOut && !proButtonInfo.isLoading)}
                            className={`w-full text-center py-3 rounded-full font-semibold transition-transform flex items-center justify-center gap-2 ${
                                proButtonInfo.disabled && proButtonInfo.isCurrent ? 'bg-gray-600 text-gray-400 cursor-default' :
                                proButtonInfo.isDowngrade ? 'bg-purple-600 text-white hover:bg-purple-700' :
                                'bg-indigo-500 text-white hover:bg-indigo-600'
                            } ${(!!isCheckingOut && !proButtonInfo.isLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                           {proButtonInfo.isLoading ? (
                                <> <Loader2 className="w-5 h-5 animate-spin" /> {proButtonInfo.text} </>
                            ) : (
                                proButtonInfo.text
                            )}
                        </motion.button>
                    ) : (
                        <motion.a
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                            href="/signup"
                            className="block w-full text-center py-3 rounded-full font-semibold bg-indigo-500 text-white transition-transform"
                        >
                            Sign Up to Subscribe
                        </motion.a>
                    )}
                </div>
             </div>
          </motion.div>
        </motion.div>
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-4">
              <a href="/privacy-policy" className="text-sm text-gray-400 hover:text-indigo-400">
                Privacy Policy
              </a>
              <span className="text-gray-600">|</span>
              <a href="/terms" className="text-sm text-gray-400 hover:text-indigo-400">
                Terms & Conditions
              </a>
            </div>
            <p className="text-sm text-gray-400 mt-4 md:mt-0">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Pricing;
