import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase';
import { getIdToken } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

// --- USE YOUR **LIVE** PUBLISHABLE KEY ---
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51QdhwgIdgEonJvEbYZYASetFGNVWiSHN68N3FtLpybd4QIhEjfXQxk3XJoxhEDor4gaT7hZxjN4HSDAz1fAQiuFV00Q4nb1AlL'; // YOUR LIVE KEY

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('Stripe Publishable Key is not set!');
}

let stripePromise: Promise<Stripe | null>;

export const getStripe = (): Promise<Stripe | null> => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.error("Cannot load Stripe without publishable key.");
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

  if (!STRIPE_PUBLISHABLE_KEY) { throw new Error("Stripe key missing."); }

  const user = auth.currentUser;
  if (!user) { throw new Error("User not logged in. Please sign in."); }

  try { await getIdToken(user, false); }
  catch (error) {
    console.error("Error verifying ID token:", error);
    throw new Error("Could not verify authentication.");
  }

  const functionsInstance = getFunctions(app);
  const createStripeCheckoutSessionCallable = httpsCallable(
    functionsInstance, 'createStripeCheckoutSession'
  );

  const successUrl = `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/pricing`;

  try {
    console.log(`Calling LIVE function for priceId: ${priceId}`);
    const result: any = await createStripeCheckoutSessionCallable({
      priceId, successUrl, cancelUrl,
    });

    if (result.data?.sessionId) {
       console.log("LIVE function returned sessionId:", result.data.sessionId);
       return { sessionId: result.data.sessionId };
    } else {
       console.error("LIVE response missing sessionId:", result);
       throw new Error("Invalid response from server.");
    }
  } catch (error: unknown) {
    console.error("Error calling LIVE function:", error);
    let message = "Unknown backend error.";
    let code = 'unknown';
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        code = String((error as {code: string}).code);
        message = String((error as {message: string}).message);
    } else if (error instanceof FirebaseError) {
        message = error.message; code = error.code;
    } else if (error instanceof Error) { message = error.message; }
    console.error(`Backend Call Error - Code: ${code}, Msg: ${message}`);
    throw new Error(`Checkout failed: ${message} (Code: ${code})`);
  }
};

// --- NEW function to create Portal Session ---
export const createPortalSession = async (): Promise<{ portalUrl: string }> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not logged in. Please sign in.");
  }

  try { await getIdToken(user, false); }
  catch (error) {
     console.error("Error verifying ID token for portal:", error);
     throw new Error("Could not verify authentication.");
  }

  const functionsInstance = getFunctions(app);
  const createStripePortalSessionCallable = httpsCallable(
    functionsInstance,
    'createStripePortalSession'
  );

  try {
    console.log("Calling backend function 'createStripePortalSession'...");
    const result: any = await createStripePortalSessionCallable();

    if (result.data?.portalUrl) {
       console.log("Backend returned portal URL:", result.data.portalUrl);
       return { portalUrl: result.data.portalUrl };
    } else {
       console.error("Backend response missing portalUrl:", result);
       throw new Error("Invalid response creating portal link.");
    }
  } catch (error: unknown) {
    console.error("Error calling 'createStripePortalSession':", error);
    let message = "Could not load billing management page.";
    let code = 'unknown';
     if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        code = String((error as {code: string}).code);
        message = String((error as {message: string}).message);
    } else if (error instanceof FirebaseError) {
        message = error.message; code = error.code;
    } else if (error instanceof Error) { message = error.message; }

    console.error(`Portal Call Error - Code: ${code}, Msg: ${message}`);
    if (code === 'not-found') { message = "No subscription details found."; }
    else if (code === 'internal') { message = "Server error creating portal link."; }

    throw new Error(`Failed to load billing page: ${message} (Code: ${code})`);
  }
};
