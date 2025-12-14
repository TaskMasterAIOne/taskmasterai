/**
 * Sync License Data
 * Fixes the users/{uid}/license/current subcollection to match the main user document
 * This ensures the Settings page displays the correct license key
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Check if already initialized
if (!admin.apps.length) {
  try {
    // Try to load service account key
    const serviceAccount = JSON.parse(
      readFileSync('./serviceAccountKey.json', 'utf-8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    // Fallback to default credentials
    admin.initializeApp();
  }
}

const db = admin.firestore();

const email = 'srinibaj10@gmail.com';
const userId = 'vdtbGdR7BWgceqbz1g8bOKJm1hk2';

async function syncLicenseData() {
  try {
    console.log('\n=== Syncing License Data ===');
    console.log('Email:', email);
    console.log('User ID:', userId);
    
    // 1. Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found');
      return;
    }

    const userData = userDoc.data();
    console.log('\n📄 User Document Data:');
    console.log('  License Key:', userData.licenseKey || 'None');
    console.log('  Plan:', userData.plan || 'None');
    console.log('  Subscription Status:', userData.subscriptionStatus || 'None');
    
    if (!userData.licenseKey) {
      console.log('\n❌ No license key found in user document');
      return;
    }

    // 2. Get license document
    const licenseDoc = await db.collection('licenses').doc(userData.licenseKey).get();
    
    if (!licenseDoc.exists) {
      console.log('\n❌ License document not found:', userData.licenseKey);
      console.log('The license key in the user document does not exist in the licenses collection.');
      return;
    }

    const licenseData = licenseDoc.data();
    console.log('\n📋 License Document Data:');
    console.log('  Plan:', licenseData.plan);
    console.log('  Status:', licenseData.status);
    console.log('  Expires:', licenseData.expiresAt?.toDate().toISOString());
    
    // 3. Get plan details
    const PLAN_DETAILS = {
      plus: { name: 'Plus', price: 29, tasksPerMonth: 100, overageRate: 0.20 },
      pro: { name: 'Pro', price: 199, tasksPerMonth: 1000, overageRate: 0.15 },
      enterprise: { name: 'Enterprise', price: 599, tasksPerMonth: 5000, overageRate: 0.10 }
    };
    
    const planDetails = PLAN_DETAILS[licenseData.plan] || {};
    
    // 4. Update/create the license subcollection document
    console.log('\n🔄 Updating license subcollection...');
    
    const licenseSubcollectionRef = db.collection('users').doc(userId).collection('license').doc('current');
    
    await licenseSubcollectionRef.set({
      licenseKey: userData.licenseKey,
      plan: licenseData.plan,
      planName: planDetails.name || licenseData.plan,
      planPrice: planDetails.price || 0,
      tasksPerMonth: planDetails.tasksPerMonth || 0,
      overageRate: planDetails.overageRate || 0,
      status: licenseData.status,
      createdAt: licenseData.createdAt,
      expiresAt: licenseData.expiresAt,
      currentPeriodEnd: licenseData.expiresAt,
      cancelAtPeriodEnd: false,
      tasksUsed: userData.tasksUsed || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ License subcollection updated successfully!');
    console.log('\n✓ Your Settings page should now show:');
    console.log(`  License Key: ${userData.licenseKey}`);
    console.log(`  Plan: ${planDetails.name} (${licenseData.plan})`);
    console.log(`  Status: ${licenseData.status}`);
    console.log('\nYou can now use this command:');
    console.log(`  taskmaster activate ${userData.licenseKey}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

syncLicenseData();
