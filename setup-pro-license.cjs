const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'taskmaster-ai-e2302'
});

const db = admin.firestore();

async function setupProLicense() {
  const email = 'fugegate@gmail.com';
  
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      console.log(`❌ No user found with email: ${email}`);
      process.exit(1);
      return;
    }
    
    const userId = usersSnapshot.docs[0].id;
    const userData = usersSnapshot.docs[0].data();
    console.log(`✅ Found user: ${userId} (${email})`);
    console.log(`   Current plan: ${userData.plan || 'none'}`);
    
    // Update user document to PRO (if not already)
    if (userData.plan !== 'pro') {
      await db.collection('users').doc(userId).update({
        plan: 'pro'
      });
      console.log(`✅ Updated user plan to PRO`);
    } else {
      console.log(`✅ User plan is already PRO`);
    }
    
    // Create/Update license document
    const licenseRef = db.collection('users').doc(userId).collection('license').doc('current');
    
    const now = new Date();
    const monthFromNow = new Date(now);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    
    const licenseData = {
      hasLicense: true,
      plan: 'pro',
      planName: 'Pro',
      planPrice: 199,
      status: 'active',
      tasksPerMonth: 1000,
      tasksUsed: 0,
      overageRate: 0.15,
      licenseKey: `TM-PRO-${userId.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      currentPeriodStart: admin.firestore.Timestamp.fromDate(now),
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(monthFromNow),
      cancelAtPeriodEnd: false,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    };
    
    await licenseRef.set(licenseData, { merge: true });
    
    console.log(`\n✅ Successfully set up PRO license for ${email}!`);
    console.log(`\nLicense Details:`);
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Plan: ${licenseData.planName}`);
    console.log(`  - Status: ${licenseData.status}`);
    console.log(`  - Tasks/Month: ${licenseData.tasksPerMonth}`);
    console.log(`  - License Key: ${licenseData.licenseKey}`);
    console.log(`  - Current Period: ${now.toLocaleDateString()} - ${monthFromNow.toLocaleDateString()}`);
    console.log(`\n✨ The dashboard should now show PRO status correctly!`);
    
  } catch (error) {
    console.error('❌ Error setting up license:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

setupProLicense();
