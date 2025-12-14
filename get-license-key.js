/**
 * Get the license key for a specific user email
 * Usage: node get-license-key.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const email = 'srinibaj10@gmail.com';
const userId = 'vdtbGdR7BWgceqbz1g8bOKJm1hk2';

async function getLicenseKey() {
  try {
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('User not found');
      return;
    }

    const userData = userDoc.data();
    
    console.log('\n=== User License Information ===');
    console.log('Email:', email);
    console.log('User ID:', userId);
    console.log('License Key:', userData.licenseKey || 'None');
    console.log('Plan:', userData.plan || 'None');
    console.log('Subscription Status:', userData.subscriptionStatus || 'None');
    console.log('Stripe Customer ID:', userData.stripeCustomerId || 'None');
    console.log('Stripe Subscription ID:', userData.stripeSubscriptionId || 'None');
    
    if (userData.licenseKey) {
      console.log('\n✓ Use this command to activate:');
      console.log(`taskmaster activate ${userData.licenseKey}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getLicenseKey();

