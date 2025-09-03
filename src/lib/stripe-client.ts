import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebase';
import { getIdToken } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

/**
 * Stripe Client - Server-Side Integration
 * 
 * This module handles Stripe operations through Firebase Functions only.
 * No client-side Stripe.js is used - all Stripe operations happen server-side
 * for better security and consistency with the rest of the codebase.
 */

/**
 * Creates a Stripe checkout session and redirects user to Stripe Checkout.
 * This function handles the entire checkout flow server-side through Firebase Functions.
 * No client-side Stripe.js library is required.
 */
export const createCheckoutSession = async (priceId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) { 
    throw new Error("User not logged in. Please sign in."); 
  }

  try { 
    await getIdToken(user, false); 
  } catch (error) {
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
    const result: any = await createStripeCheckoutSessionCallable({
      priceId, successUrl, cancelUrl,
    });

    if (result.data?.sessionUrl) {
       // Redirect to Stripe Checkout using the session URL from server
       // This is the proper server-side integration approach
       window.location.href = result.data.sessionUrl;
    } else {
       console.error("Backend response missing sessionUrl:", result);
       throw new Error("Invalid response from server.");
    }
  } catch (error: unknown) {
    console.error("Error calling backend function:", error);
    let message = "Unknown backend error.";
    let code = 'unknown';
    
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        code = String((error as {code: string}).code);
        message = String((error as {message: string}).message);
    } else if (error instanceof FirebaseError) {
        message = error.message; 
        code = error.code;
    } else if (error instanceof Error) { 
        message = error.message; 
    }
    
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
    const result: any = await createStripePortalSessionCallable();

    if (result.data?.portalUrl) {
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
