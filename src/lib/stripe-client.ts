import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable, FunctionsHttpsError } from 'firebase/functions'; // Import HttpsError type
import { app, auth } from './firebase'; // Ensure 'auth' is exported from firebase.ts
import { getIdToken } from 'firebase/auth';

// --- USE YOUR **TEST** PUBLISHABLE KEY ---
// Replace with your actual TEST key from Stripe Dashboard > Developers > API Keys
// Consider using Environment Variables (e.g., VITE_STRIPE_PUBLISHABLE_KEY) for production
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QdhwgIdgEonJvEbYZYASetFGNVWiSHN68N3FtLpybd4QIhEjfXQxk3XJoxhEDor4gaT7hZxjN4HSDAz1fAQiuFV00Q4nb1AlL'; // PASTE TEST KEY HERE

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error(
    'Stripe Publishable Key is not set! Checkout will not function.'
  );
}

let stripePromise: Promise<Stripe | null>;

/**
 * Loads the Stripe.js library asynchronously.
 * @returns {Promise<Stripe | null>}
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.error("Cannot load Stripe without a publishable key.");
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};


/**
 * Calls the DEPLOYED Firebase Function ('createStripeCheckoutSession' via onCall)
 * to create a Stripe Checkout Session.
 * @param {string} priceId - The Stripe Price ID for the item.
 * @returns {Promise<{ sessionId: string }>} Resolves with the Session ID.
 * @throws Will throw an error if authentication fails or the backend call fails.
 */
export const createCheckoutSession = async (
  priceId: string
): Promise<{ sessionId: string }> => {

  if (!STRIPE_PUBLISHABLE_KEY) {
    throw new Error("Stripe key is missing.");
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not logged in. Please sign in.");
  }

  // Verify token is fresh before calling function (optional but good practice)
  try {
    await getIdToken(user, /*forceRefresh*/ false);
  } catch (error) {
     console.error("Error verifying Firebase ID token:", error);
     throw new Error("Could not verify authentication.");
  }

  const functionsInstance = getFunctions(app); // Get specific instance if needed, or use default 'functions' export
  const createStripeCheckoutSessionCallable = httpsCallable(
    functionsInstance,
    'createStripeCheckoutSession' // Must match deployed function name
  );

  const successUrl = `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/pricing`;

  try {
    console.log(`Calling DEPLOYED function 'createStripeCheckoutSession' for priceId: ${priceId}`);

    const result: any = await createStripeCheckoutSessionCallable({
      priceId,
      successUrl,
      cancelUrl,
    });

    if (result.data && result.data.sessionId) {
       console.log("Deployed function returned sessionId:", result.data.sessionId);
       return { sessionId: result.data.sessionId };
    } else {
       console.error("Deployed function response missing sessionId:", result);
       throw new Error("Invalid response from server.");
    }
  } catch (error: unknown) {
    console.error("Error calling deployed function:", error);

    let message = "An unknown error occurred calling the backend.";
    let code: string = 'unknown';

    // Check if it's an HttpsError from Firebase Functions
    if (error instanceof FunctionsHttpsError) {
      message = error.message;
      code = error.code;
    } else if (error instanceof Error) { // Standard JS error
      message = error.message;
    }

    console.error(`Backend Call Error - Code: ${code}, Message: ${message}`);
    throw new Error(`Checkout failed: ${message} (Code: ${code})`);
  }
};
