import { loadStripe, Stripe } from '@stripe/stripe-js';
// Import functions related types/functions correctly
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase';
import { getIdToken } from 'firebase/auth';
// FirebaseError is often the base class or has common properties
import { FirebaseError } from 'firebase/app';

// --- USE YOUR **TEST** PUBLISHABLE KEY ---
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QdhwgIdgEonJvEbYZYASetFGNVWiSHN68N3FtLpybd4QIhEjfXQxk3XJoxhEDor4gaT7hZxjN4HSDAz1fAQiuFV00Q4nb1AlL'; // PASTE TEST KEY HERE

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error(
    'Stripe Publishable Key is not set! Checkout will not function.'
  );
}

let stripePromise: Promise<Stripe | null>;

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

  try {
    await getIdToken(user, false);
  } catch (error) {
     console.error("Error verifying Firebase ID token:", error);
     throw new Error("Could not verify authentication.");
  }

  const functionsInstance = getFunctions(app);
  const createStripeCheckoutSessionCallable = httpsCallable(
    functionsInstance,
    'createStripeCheckoutSession'
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

    // Check if it conforms to FirebaseError structure or standard Error
    if (error instanceof FirebaseError) {
        message = error.message;
        code = error.code; // Firebase specific error code
    } else if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error && 'message' in error) {
      // Fallback for objects with a message property
      message = String((error as { message: string }).message);
      if ('code' in error) { // Check if it also has a code property
          code = String((error as { code: string }).code);
      }
    }

    console.error(`Backend Call Error - Code: ${code}, Message: ${message}`);

    // Provide specific feedback based on common Firebase function error codes
    if (code === 'unauthenticated') {
      message = "Authentication failed. Please log in again.";
    } else if (code === 'invalid-argument') {
      message = "Invalid data sent to server. " + message;
    } else if (code === 'internal') {
      message = "Server error during checkout. " + message;
    } // Add other specific Firebase error codes if needed

    throw new Error(`Checkout failed: ${message} (Code: ${code})`);
  }
};
