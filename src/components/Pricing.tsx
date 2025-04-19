import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Crown, Gem, Check, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { subscribeToAuthState } from '../lib/pricing-firebase'; // Assuming this gives Firebase User
import { Logo } from './Logo';
import { createCheckoutSession, getStripe } from '../lib/stripe-client'; // Import new functions
import { motion } from 'framer-motion';

// WARNING: Using LIVE Price IDs directly in code. Consider managing these more securely.
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
  // Renamed loading from useAuth to avoid conflict
  const { loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null); // Consider using Firebase User type: import { User } from 'firebase/auth';
  const [isYearly, setIsYearly] = useState(true);
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu

  // --- NEW: Checkout State ---
  // Moved state declarations inside the component function
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null); // Stores Price ID being checked out
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      // Reset checkout state if user logs in/out to prevent stale errors/loaders
      setIsCheckingOut(null);
      setCheckoutError(null);
    });
    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- REPLACED handleSubscribe ---
  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      setCheckoutError('Please login or sign up to subscribe.');
      // Consider adding a redirect to login/signup here if desired
      return;
    }
    // Prevent multiple simultaneous checkout attempts
    if (isCheckingOut) return;

    setIsCheckingOut(priceId); // Indicate loading state for the clicked button
    setCheckoutError(null); // Clear any previous errors

    try {
      // 1. Call backend function via stripe-client to create the session
      console.log(`Initiating checkout for priceId: ${priceId}`);
      const { sessionId } = await createCheckoutSession(priceId);
      console.log(`Received sessionId: ${sessionId}`);

      // 2. Get Stripe.js instance
      const stripe = await getStripe();
      if (!stripe) {
        // This error means the publishable key might be wrong or Stripe.js didn't load
        throw new Error('Stripe.js failed to load. Check configuration.');
      }
      console.log("Stripe.js loaded, redirecting to checkout...");

      // 3. Redirect customer to Stripe Checkout page
      const { error } = await stripe.redirectToCheckout({ sessionId });

      // This point is only reached if `redirectToCheckout` fails immediately (rare)
      if (error) {
        console.error("Stripe redirection error:", error);
        setCheckoutError(error.message || 'Could not redirect to Stripe. Please try again.');
      }
      // If redirection succeeds, the browser navigates away.

    } catch (error: any) {
      console.error("Subscription handling error:", error);
      // Display error messages originating from createCheckoutSession (backend call) or getStripe
      setCheckoutError(error.message || 'Failed to initiate subscription. Please check connection or try again later.');
    } finally {
      // Always reset loading state, whether success or failure before redirect
      setIsCheckingOut(null);
    }
  };

  // Display loading indicator during initial authentication check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // --- Pricing text calculation logic ---
  const premiumPriceText = isYearly ? '$7.99 / mo' : '$9.99 / mo';
  const proPriceText = isYearly ? '$4.99 / mo' : '$6.99 / mo';
  const premiumBillingText = isYearly ? 'Billed annually' : 'Billed monthly';
  const proBillingText = isYearly ? 'Billed annually' : 'Billed monthly';
  const premiumMonthlySavings = (9.99 - 7.99).toFixed(2);
  const premiumAnnualSavings = (Number(premiumMonthlySavings) * 12).toFixed(2);
  const recommendationText = `Recommended – Save $${premiumMonthlySavings}/month ($${premiumAnnualSavings}/year)`;

  // --- Framer Motion Animation Variants ---
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

  // --- Helper to render feature list items ---
  const renderFeatureItem = (text: string) => (
    <li className="flex items-center">
      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );

  // --- Banner height class ---
  const bannerHeightClass = "h-10";

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 font-poppins">
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
            {/* Hamburger Menu Button */}
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
            {/* Desktop Navigation */}
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
            {/* Mobile Navigation */}
            <div
              className={`absolute top-full left-0 right-0 bg-gray-900/95 border-b border-gray-800 md:hidden transition-all duration-300 ease-in-out ${ isOpen ? 'opacity-100 visible' : 'opacity-0 invisible' }`}
            >
              <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
                <a
                  href="/#features"
                  className="text-gray-300 hover:text-indigo-400 transition-colors"
                  onClick={toggleMenu} // Close menu on click
                >
                  Features
                </a>
                <a
                  href="/pricing"
                  className="text-gray-300 hover:text-indigo-400 transition-colors"
                  onClick={toggleMenu} // Close menu on click
                >
                  Pricing
                </a>
                <a
                  href="/contact"
                  className="text-gray-300 hover:text-indigo-400 transition-colors"
                  onClick={toggleMenu} // Close menu on click
                >
                  Contact
                </a>
                <a
                  href={user ? "/dashboard" : "/signup"}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-center transition-all transform hover:scale-105"
                  onClick={toggleMenu} // Close menu on click
                >
                  {user ? "Dashboard" : "Get Started Today"}
                </a>
              </div>
            </div>
          </nav>
        </div>
      </motion.header>
      {/* --- END: NAV --- */}


      {/* --- START: Main Pricing Content --- */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 text-white w-full">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-indigo-400 mb-2">Choose Your Perfect Plan</h1>
          <p className="text-gray-300">Select a plan that works best for you.</p>
        </motion.div>

        {/* Monthly/Yearly Toggle Button */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants} // Use container variants for stagger effect if desired
          className="flex justify-center mb-8"
        >
          <div className="bg-gray-800 rounded-full flex p-1"> {/* Added padding for better visual */}
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className={`px-4 py-2 rounded-full transition-colors duration-300 text-sm font-medium ${isYearly ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-300 hover:text-white'}`}
              onClick={() => setIsYearly(true)}
            >
              Yearly
            </motion.button>
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className={`px-4 py-2 rounded-full transition-colors duration-300 text-sm font-medium ${!isYearly ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-300 hover:text-white'}`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </motion.button>
          </div>
        </motion.div>

        {/* --- Checkout Error Display Area --- */}
        {checkoutError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-red-900/60 border border-red-700/60 rounded-lg text-red-200 text-sm flex items-center justify-center gap-2 max-w-2xl mx-auto shadow-lg"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-300" />
            <span>{checkoutError}</span>
          </motion.div>
        )}

        {/* Pricing Cards Container */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" // Ensure cards stretch to equal height if content differs
        >

          {/* --- Basic Plan Card --- */}
          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col overflow-hidden border border-gray-700/50 shadow-lg" // Added border/shadow
          >
             {/* Banner Placeholder: keeps alignment with other cards */}
             <div className={`${bannerHeightClass} invisible`}></div>
             {/* Card Content Area */}
             <div className="p-6 flex flex-col flex-grow"> {/* Added flex-grow */}
                {/* Plan Details Area */}
                <div className="flex-grow"> {/* Allow content to push button down */}
                    <h2 className="text-2xl font-bold mb-4 text-gray-100">Basic</h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">Free</p>
                    <p className="text-sm text-gray-400 mb-6">Forever free</p> {/* Increased bottom margin */}
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("2 PDF and Text Notes per month")}
                        {renderFeatureItem("1 YouTube Notes per month")}
                        {renderFeatureItem("10 AI Chat Interactions per month")}
                        {renderFeatureItem("500 Tokens Included")}
                        {renderFeatureItem("Add Up to 3 Friends")}
                    </ul>
                </div>
                {/* Button Area - pushed to bottom */}
                <div className="mt-auto pt-4"> {/* Added padding top for spacing */}
                    <motion.a
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        href={user ? "/dashboard" : "/signup"}
                        className="block w-full text-center py-3 rounded-lg font-semibold bg-indigo-500 text-white transition-all hover:bg-indigo-600 transform hover:scale-[1.02]" // Slightly adjusted style
                    >
                        {user ? 'Access Dashboard' : 'Sign Up Free'}
                    </motion.a>
                </div>
             </div>
          </motion.div>

          {/* --- Premium Plan Card (Recommended) --- */}
          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col border-2 border-indigo-500 overflow-hidden shadow-2xl" // Enhanced shadow
          >
            {/* Recommendation Banner */}
            <div className={`${bannerHeightClass} flex items-center justify-center`}>
             {isYearly && (
                <div className="bg-yellow-400 text-black text-xs font-bold w-full h-full flex items-center justify-center px-4 text-center truncate uppercase tracking-wider"> {/* Adjusted style */}
                 {recommendationText}
                </div>
             )}
             {/* Keep the div for height even if not yearly */}
             {!isYearly && <div className="w-full h-full invisible"></div>}
            </div>
            {/* Card Content Area */}
            <div className="p-6 flex flex-col flex-grow">
                {/* Plan Details Area */}
                <div className="flex-grow">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-gray-100">
                        <Crown className="w-6 h-6 text-yellow-400" />
                        Premium
                    </h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">{premiumPriceText}</p>
                    <p className="text-sm text-gray-400 mb-6">{premiumBillingText}</p>
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("Unlimited PDF and Text Notes")}
                        {renderFeatureItem("Unlimited YouTube Notes")}
                        {renderFeatureItem("Unlimited AI Chat Interactions")}
                        {renderFeatureItem("2,500 Tokens Included")}
                        {renderFeatureItem("Add Unlimited Friends")}
                        {renderFeatureItem("Unlimited Access to Smart Overview")}
                    </ul>
                </div>
                {/* Button Area */}
                <div className="mt-auto pt-4">
                    {user ? (
                        <motion.button
                            variants={buttonVariants} whileHover="hover" whileTap="tap"
                            onClick={() => handleSubscribe(STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'])}
                            disabled={!!isCheckingOut}
                            className="w-full text-center py-3 rounded-lg font-semibold bg-white text-indigo-600 transition-all hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02]" // Adjusted style
                        >
                            {isCheckingOut === STRIPE_PRICE_IDS.PREMIUM[isYearly ? 'yearly' : 'monthly'] ? (
                                <> <Loader2 className="w-5 h-5 animate-spin" /> Processing... </>
                            ) : (
                                "Subscribe Now"
                            )}
                        </motion.button>
                    ) : (
                        <motion.a variants={buttonVariants} whileHover="hover" whileTap="tap" href="/signup"
                            className="block w-full text-center py-3 rounded-lg font-semibold bg-white text-indigo-600 transition-all hover:bg-gray-100 transform hover:scale-[1.02]">
                            Sign Up to Subscribe
                        </motion.a>
                    )}
                </div>
            </div>
          </motion.div>

          {/* --- Pro Plan Card --- */}
          <motion.div
            variants={cardVariants}
            className="bg-gray-800 rounded-xl flex flex-col overflow-hidden border border-gray-700/50 shadow-lg" // Added border/shadow
          >
             {/* Banner Placeholder */}
             <div className={`${bannerHeightClass} invisible`}></div>
             {/* Card Content Area */}
             <div className="p-6 flex flex-col flex-grow">
                {/* Plan Details Area */}
                <div className="flex-grow">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-100">
                        <Gem className="w-6 h-6 text-purple-400" />
                        Pro
                    </h2>
                    <p className="text-3xl font-extrabold text-indigo-400 mb-1">{proPriceText}</p>
                    <p className="text-sm text-gray-400 mb-6">{proBillingText}</p>
                    <ul className="mb-6 space-y-2 text-gray-300">
                        {renderFeatureItem("10 PDF and Text Notes per month")}
                        {renderFeatureItem("5 YouTube Notes per month")}
                        {renderFeatureItem("200 AI Chat Interactions per Month")}
                        {renderFeatureItem("1,000 Tokens Included")}
                        {renderFeatureItem("Add Up to 10 Friends")}
                        {renderFeatureItem("Limited Access to Smart Overview")}
                    </ul>
                </div>
                {/* Button Area */}
                <div className="mt-auto pt-4">
                    {user ? (
                        <motion.button
                            variants={buttonVariants} whileHover="hover" whileTap="tap"
                            onClick={() => handleSubscribe(STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'])}
                            disabled={!!isCheckingOut}
                            className="w-full text-center py-3 rounded-lg font-semibold bg-indigo-500 text-white transition-all hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02]" // Adjusted style
                        >
                            {isCheckingOut === STRIPE_PRICE_IDS.PRO[isYearly ? 'yearly' : 'monthly'] ? (
                                <> <Loader2 className="w-5 h-5 animate-spin" /> Processing... </>
                            ) : (
                                "Subscribe Now"
                            )}
                        </motion.button>
                    ) : (
                         <motion.a variants={buttonVariants} whileHover="hover" whileTap="tap" href="/signup"
                            className="block w-full text-center py-3 rounded-lg font-semibold bg-indigo-500 text-white transition-all hover:bg-indigo-600 transform hover:scale-[1.02]">
                             Sign Up to Subscribe
                         </motion.a>
                    )}
                </div>
             </div>
          </motion.div>
        </motion.div> {/* End Pricing Cards Grid */}
      </main>
      {/* --- END: Main Pricing Content --- */}


      {/* --- START: FOOTER --- */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-auto py-6"> {/* Added padding */}
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between text-center md:text-left">
            <div className="mb-4 md:mb-0"> {/* Footer Links */}
              <a href="/privacy-policy" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors duration-200 px-2">
                Privacy Policy
              </a>
              <span className="text-gray-600 mx-1">|</span>
              <a href="/terms" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors duration-200 px-2">
                Terms & Conditions
              </a>
            </div>
            {/* Copyright Notice */}
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
      {/* --- END: FOOTER --- */}
    </div>
  );
}

export default Pricing;
