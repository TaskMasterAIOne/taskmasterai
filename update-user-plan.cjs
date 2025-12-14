const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials (uses gcloud auth)
admin.initializeApp({
  projectId: 'taskmaster-ai-e2302'
});

const db = admin.firestore();

async function updateUserPlan() {
  // To update by user ID:
  // const userId = 'your-user-id-here';
  
  // To update by email (recommended for testing):
  const email = 'fugegate@gmail.com';
  
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      console.log(`No user found with email: ${email}`);
      process.exit(1);
      return;
    }
    
    const userId = usersSnapshot.docs[0].id;
    console.log(`Found user: ${userId} (${email})`);
    
    // Update to PRO plan
    await db.collection('users').doc(userId).update({
      plan: 'pro'
    });
    
    console.log(`✅ Successfully updated user ${userId} (${email}) to PRO plan`);
    console.log(`\nThe user now has PRO features including:`);
    console.log(`  - Hosted API keys (no need to provide their own)`);
    console.log(`  - Up to 1,000 tasks/month`);
    console.log(`  - Priority support`);
    console.log(`  - Advanced analytics`);
    
  } catch (error) {
    console.error('Error updating user:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

updateUserPlan();
