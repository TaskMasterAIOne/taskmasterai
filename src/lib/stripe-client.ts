// src/lib/stripe-client.ts

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase'; // Ensure 'auth' is exported from your firebase setup
import { getIdToken } from 'firebase/auth';

// WARNING: Using LIVE Publishable Key directly in code.
// MOVE THIS TO AN ENVIRONMENT VARIABLE for security and flexibility.
// Example for Vercel (Vite): import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
// Example for Vercel (CRA): process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QdhwgIdgEonJvEbYZYASetFGNVWiSHN68N3FtLpybd4QIhEjfXQxk3XJoxhEDor4gaT7hZxjN4HSDAz1fAQiuFV00Q4nb1AlL';

if (!STRIPE_PUBLISHABLE_KEY) {
  // In a real app, you might want to disable checkout functionality if the key is missing.
  console.error(
    'Stripe Publishable Key is not set! Checkout will not function.'
  );
}

// Singleton promise to load Stripe.js only once per page load
let stripePromise: Promise<Stripe | null>;

/**
 * Loads the Stripe.js library asynchronously.
 * @returns {Promise<Stripe | null>} A promise that resolves with the Stripe instance or null if the key is missing.
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
 * Calls the backend Firebase Function (an onRequest wrapper) to create a Stripe Checkout Session.
 * Uses httpsCallable which automatically handles sending the Firebase Auth ID token.
 * @param {string} priceId - The Stripe Price ID for the item being purchased.
 * @returns {Promise<{ sessionId: string }>} A promise that resolves with the Checkout Session ID.
 * @throws Will throw an error if authentication fails, the backend call fails, or the response is invalid.
 */
export const createCheckoutSession = async (
  priceId: string
): Promise<{ sessionId: string }> => {

  if (!STRIPE_PUBLISHABLE_KEY) {
    // Prevent attempting checkout if key is missing
    throw new Error("Stripe key is missing, cannot create checkout session.");
  }

  // 1. Check if user is authenticated (client-side check first)
  const user = auth.currentUser;
  if (!user) {
    // This should ideally be caught by the UI before calling this function,
    // but added here as a safeguard.
    console.error("User not logged in.");
    throw new Error("User not logged in. Please sign in to subscribe.");
  }

  // 2. Get the Firebase ID token (httpsCallable needs this, but handles sending it)
  // We get it here primarily to ensure the user session is still valid.
  try {
    await getIdToken(user); // This verifies the token is fresh/valid
  } catch (error) {
     console.error("Error getting or verifying Firebase ID token:", error);
     throw new Error("Could not verify user authentication. Please try logging in again.");
  }

  // 3. Get Firebase Functions instance and reference the callable function
  // The name 'createStripeCheckoutSession' must match the exported function name in index.ts
  const functions = getFunctions(app);
  const createStripeCheckoutSessionCallable = httpsCallable(
    functions,
    'createStripeCheckoutSession'
  );

  // 4. Define redirect URLs
  const successUrl = `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/pricing`;

  // 5. Call the Cloud Function
  try {
    console.log(
      `Calling backend function 'createStripeCheckoutSession' ` +
      `(onRequest wrapper) for priceId: ${priceId}`
    );

    // httpsCallable wraps the data in { data: ... } automatically
    // and expects the backend onRequest function to return { data: ... } or { error: ... }
    const result: any = await createStripeCheckoutSessionCallable({
      priceId,
      successUrl,
      cancelUrl,
    });

    // 6. Process the response
    // Successful response from our wrapped onRequest should be in result.data.data
    if (result.data && result.data.sessionId) {
       console.log("Backend returned sessionId:", result.data.sessionId);
       return { sessionId: result.data.sessionId }; // Return the expected structure
    } else {
       // Check if the backend explicitly sent an error structure
       if (result.data && result.data.error) {
           console.error("Backend returned error object:", result.data.error);
           throw new Error(
             `Checkout failed: ${result.data.error.message || 'Unknown server error'}`
           );
       }
       // Otherwise, the response format was unexpected
       console.error("Backend response missing sessionId or error:", result);
       throw new Error(
         "Failed to create checkout session: Invalid response format from server."
       );
    }
  } catch (error) {
    // Handle errors thrown by httpsCallable itself (network, permissions, etc.)
    console.error(
      "Error calling 'createStripeCheckoutSession' httpsCallable:", error
    );
    const code = (error as any).code;
    const message = (error as any).message || "An unknown error occurred.";

    // Provide more specific feedback based on common Firebase error codes
    if (code === 'unauthenticated') {
         throw new Error(
           "Authentication failed. Ensure you are logged in. Message: " + message
          );
    }
    if (code === 'internal') {
         throw new Error(
           "Server error during checkout. Please try again later. Message: " + message
          );
    }
    if (code === 'functions/unavailable' || code === 'unavailable') {
         throw new Error(
           "Checkout service is temporarily unavailable. Please try again soon."
         );
    }
    // Throw a generic error for other cases
    throw new Error(`Failed to create checkout session: ${message}`);
  }
}; // End of createCheckoutSession function
