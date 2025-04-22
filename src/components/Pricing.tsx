import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Crown, Gem, Check, AlertCircle } from 'lucide-react';
import { subscribeToAuthState } from '../lib/pricing-firebase';
import { Logo } from './Logo';
import { createCheckoutSession, getStripe } from '../lib/stripe-client'; // Ensure this path is correct
import { motion } from 'framer-motion';

// --- USE YOUR **TEST** PRICE IDs ---
// Replace with your actual TEST IDs from Stripe Dashboard > Products
const STRIPE_PRICE_IDS = {
  PREMIUM: {
    yearly: 'price_1Qe2OnIdgEonJvEbSDwoNCuH',
    monthly: 'price_1Qe2JWIdgEonJvEbGUYEkTu6'
  },
  PRO: {
    yearly: 'price_1Qe2QaIdgEonJvEbaq1M4CQs',
    monthly: 'price_1Qe2NXIdgEonJvEbxSUK8dMB'
  }
};

function Pricing() {
  const { loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null); // Use Firebase User type if available
  const [isYearly, setIsYearly] = useState(true);
  const [isOpen, setIsOpen] = useState(false); // Mobile menu state

  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null); // Track which Price ID is loading
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      setIsCheckingOut(null); // Reset state on auth change
      setCheckoutError(null);
    });
    return () => unsubscribe();
  }, []);

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      setCheckoutError('Please login or sign up to subscribe.');
      return;
    }
    if (isCheckingOut) return; // Prevent double clicks

    setIsCheckingOut(priceId);
    setCheckoutError(null);

    try {
      console.log(`Initiating checkout for priceId: ${priceId}`);
      // Calls stripe-client, which now calls the DEPLOYED function
      const { sessionId } = await createCheckoutSession(priceId);
      console.log(`Received sessionId: ${sessionId}`);

      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe.js failed to load.');
      }
      console.log("Stripe.js loaded, redirecting to checkout...");

      // Redirect customer to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error("Stripe redirection error:", error);
        setCheckoutError(error.message || 'Could not redirect to Stripe.');
      }
    } catch (error: any) { // Catch errors from createCheckoutSession or getStripe
      console.error("Subscription handling error:", error);
      setCheckoutError(error.message || 'Failed to initiate subscription.');
    } finally {
      setIsCheckingOut(null); // Reset loading state
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Pricing text logic
  const premiumPriceText = isYearly ? '$7.99 / mo' : '$9.99 / mo';
  const proPriceText = isYearly ? '$4.99 / mo' : '$6.99 / mo';
  const premiumBillingText = isYearly ? 'Billed annually' : 'Billed monthly';
  const proBillingText = isYearly ? 'Billed annually' : 'Billed monthly';
  const premiumMonthlySavings = (9.99 - 7.99).toFixed(2);
  const premiumAnnualSavings = (Number(premiumMonthlySavings) * 12).toFixed(2);
  const recommendationText = `Recommended – Save $${premiumMonthlySavings}/mo ($${premiumAnnualSavings}/yr)`; // Abbreviated year

  // Framer Motion Variants
  const headerVariants = { hidden: { opacity: 0, y: -50 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } };
  const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.2 } } };
  const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };
  const buttonVariants = { hover: { scale: 1.05 }, tap: { scale: 0.95 } };

  const renderFeatureItem = (text: string) => (
    <li className="flex items-center text-sm"> {/* Adjusted text size */}
      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" /> {/* Adjusted icon size */}
      <span>{text}</span>
    </li>
  );

  const bannerHeightClass = "h-10";

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 font-poppins text-gray-200"> {/* Default text color */}
      {/* --- START: NAV --- */}
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
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
                {user ? "Dashboard" : "Get Started"}
              </a>
            </div>
            {/* Mobile Nav */}
            <div className={`absolute top-full left-0 right-0 bg-gray-900/95 border-b border-gray-800 md:hidden transition-all duration-300 ease-in-out ${ isOpen ? 'opacity-100 visible' : 'opacity-0 invisible' }`}>
              <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
                <a href="/#features" className="text-gray-300 hover:text-indigo-400" onClick={toggleMenu}>Features</a>
                <a href="/pricing" className="text-gray-300 hover:text-indigo-400" onClick={toggleMenu}>Pricing</a>
                <a href="/contact" className="text-gray-300 hover:text-indigo-400" onClick={toggleMenu}>Contact</a>
                <a href={user ? "/dashboard" : "/signup"} className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-center" onClick={toggleMenu}>
                  {user ? "Dashboard" : "Get Started"}
                </a>
              </div>
            </div>
          </nav>
        </div>
      </motion.header>
      {/* --- END: NAV --- */}

      {/* --- START: Main Pricing Content --- */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 text-white w-full"> {/* Increased bottom padding */}
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 mb-3">Choose Your Perfect Plan</h1> {/* Gradient Title */}
          <p className="text-gray-400 text-lg">Select a plan that works best for you.</p>
        </motion.div>

        {/* Toggle */}
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex justify-center mb-10"> {/* Increased bottom margin */}
          <div className="bg-gray-800 rounded-full flex p-1 shadow-inner">
            <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className={`px-5 py-2 rounded-full transition-colors duration-200 text-sm font-medium ${isYearly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`} onClick={() => setIsYearly(true)}>Yearly</motion.button>
            <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className={`px-5 py-2 rounded-full transition-colors duration-200 text-sm font-medium ${!isYearly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`} onClick={() => setIsYearly(false)}>Monthly</motion.button>
          </div>
        </motion.div>

        {/* Checkout Error Display */}
        {checkoutError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm flex items-center justify-center gap-3 max-w-2xl mx-auto shadow-md">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-300" />
            <span>{checkoutError}</span>
          </motion.div>
        )}

        {/* Pricing Cards */}
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch"> {/* Increased gap */}
          {/* Basic Card */}
          <motion.div variants={cardVariants} className="bg-gradient-to-br from-gray-800 to-gray-800/90 rounded-xl flex flex-col overflow-hidden border border-gray-700 shadow-lg hover:shadow-indigo-500/30 transition-shadow duration-300">
             <div className={`${bannerHeightClass} invisible`}></div> {/* Placeholder */}
             <div className="p-6 lg:p-8 flex flex-col flex-grow">
                <div className="flex-grow mb-6">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-100">Basic</h2>
                    <p className="text-4xl font-extrabold text-indigo-400 mb-1">Free</p>
                    <p className="text-sm text-gray-400 mb-8">Forever free</p>
                    <ul className="space-y-3 text-gray-300"> {/* Increased spacing */}
                        {renderFeatureItem("2 PDF/Text Notes per month")}
                        {renderFeatureItem("1 YouTube Notes per month")}
                        {renderFeatureItem("10 AI Chats per month")}
                        {renderFeatureItem("500 Tokens Included")}
                        {renderFeatureItem("Up to 3 Friends")}
                    </ul>
                </div>
                <div className="mt-auto">
                    <motion.a variants={buttonVariants} whileHover="hover" whileTap="tap" href={user ? "/dashboard" : "/signup"} className="block w-full text-center py-3 rounded-lg font-semibold bg-indigo-600 text-white transition-all hover:bg-indigo-700 transform hover:scale-[1.03]">
                        {user ? 'Go to Dashboard' : 'Sign Up Free'}
                    </motion.a>
                </div>
             </div>
          </motion.div>

          {/* Premium Card */}
          <motion.div variants={cardVariants} className="bg-gradient-to-br from-gray-800 to-gray-800/90 rounded-xl flex flex-col border-2 border-indigo-500 shadow-xl hover:shadow-indigo-400/40 transition-shadow duration-300 relative overflow-hidden"> {/* Added relative */}
             {/* Glowing effect */}
             <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-radial from-indigo-500/20 via-transparent to-transparent animate-spin-slow opacity-50"></div>
             <div className="relative z-10 flex flex-col flex-grow"> {/* Content above glow */}
                 <div className={`${bannerHeightClass} flex items-center justify-center`}>
                    {isYearly && (<div className="bg-yellow-400 text-gray-900 text-xs font-bold w-full h-full flex items-center justify-center px-4 text-center truncate uppercase tracking-wider shadow-sm">{recommendationText}</div>)}
                    {!isYearly && <div className="w-full h-full invisible"></div>}
                 </div>
                 <div className="p-6 lg:p-8 flex flex-col flex-grow">
                    <div className="flex-grow mb-6">
                        <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2 text-gray-100"><Crown className="w-6 h-6 text-yellow-400" /> Premium</h2>
                        <p className="text-4xl font-extrabold text-indigo-400 mb-1">{premiumPriceText}</p>
                        <p className="text-sm text-gray-400 mb-8">{premiumBillingText}</p>
                        <ul className="space-y-3 text-gray-300">
                            {renderFeatureItem("Unlimited PDF/Text Notes")}
                            {renderFeatureItem("Unlimited YouTube Notes")}
                            {renderFeatureItem("Unlimited AI Chats")}
                            {renderFeatureItem("2,500 Tokens Included")}
                            {renderFeatureItem("Unlimited Friends")}
                            {renderFeatureItem("Smart Overview Access")}
                        </ul>
                    </div>
                    <div className="mt-auto">
                        {user ? (
                            <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" onClick={() => handleSubscribe(STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'])} disabled={!!isCheckingOut} className="w-full text-center py-3 rounded-lg font-semibold bg-white text-indigo-700 transition-all hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.03]">
                                {isCheckingOut === STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'] ? (<><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>) : ("Subscribe Now")}
                            </motion.button>
                        ) : (
                            <motion.a variants={buttonVariants} whileHover="hover" whileTap="tap" href="/signup" className="block w-full text-center py-3 rounded-lg font-semibold bg-white text-indigo-700 transition-all hover:bg-gray-100 transform hover:scale-[1.03]">
                                Sign Up to Subscribe
                            </motion.a>
                        )}
                    </div>
                 </div>
             </div>
          </motion.div>

          {/* Pro Card */}
          <motion.div variants={cardVariants} className="bg-gradient-to-br from-gray-800 to-gray-800/90 rounded-xl flex flex-col overflow-hidden border border-gray-700 shadow-lg hover:shadow-purple-500/30 transition-shadow duration-300">
             <div className={`${bannerHeightClass} invisible`}></div> {/* Placeholder */}
             <div className="p-6 lg:p-8 flex flex-col flex-grow">
                <div className="flex-grow mb-6">
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-gray-100"><Gem className="w-5 h-5 text-purple-400" /> Pro</h2>
                    <p className="text-4xl font-extrabold text-indigo-400 mb-1">{proPriceText}</p>
                    <p className="text-sm text-gray-400 mb-8">{proBillingText}</p>
                    <ul className="space-y-3 text-gray-300">
                        {renderFeatureItem("10 PDF/Text Notes per month")}
                        {renderFeatureItem("5 YouTube Notes per month")}
                        {renderFeatureItem("200 AI Chats per Month")}
                        {renderFeatureItem("1,000 Tokens Included")}
                        {renderFeatureItem("Up to 10 Friends")}
                        {renderFeatureItem("Limited Smart Overview")}
                    </ul>
                </div>
                <div className="mt-auto">
                    {user ? (
                        <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" onClick={() => handleSubscribe(STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'])} disabled={!!isCheckingOut} className="w-full text-center py-3 rounded-lg font-semibold bg-indigo-600 text-white transition-all hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.03]">
                           {isCheckingOut === STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'] ? (<><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>) : ("Subscribe Now")}
                        </motion.button>
                    ) : (
                         <motion.a variants={buttonVariants} whileHover="hover" whileTap="tap" href="/signup" className="block w-full text-center py-3 rounded-lg font-semibold bg-indigo-600 text-white transition-all hover:bg-indigo-700 transform hover:scale-[1.03]">
                             Sign Up to Subscribe
                         </motion.a>
                    )}
                </div>
             </div>
          </motion.div>
        </motion.div>
      </main>
      {/* --- END: Main Pricing Content --- */}

      {/* --- START: FOOTER --- */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-auto py-8"> {/* Increased padding */}
        <div className="container mx-auto px-4 text-center text-gray-500">
          <div className="mb-4"> {/* Links */}
            <a href="/privacy-policy" className="text-sm hover:text-indigo-400 transition-colors px-3">Privacy Policy</a>
            <span className="text-gray-600">|</span>
            <a href="/terms" className="text-sm hover:text-indigo-400 transition-colors px-3">Terms & Conditions</a>
          </div>
          <p className="text-sm"> {/* Copyright */}
            © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
          </p>
        </div>
      </footer>
      {/* --- END: FOOTER --- */}
    </div>
  );
}

export default Pricing;
