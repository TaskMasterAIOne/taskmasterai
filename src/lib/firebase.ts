// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDaMAlQRMXiDsZ4P0b06P18id3y5xBiZ1k",
  authDomain: "taskmaster.one", // CRITICAL: Updated to custom domain
  projectId: "deepworkai-c3419",
  storageBucket: "deepworkai-c3419.appspot.com",
  messagingSenderId: "367439182644",
  appId: "1:367439182644:web:304216430df97eff68c361",
};

let app: FirebaseApp;
const apps = getApps();

if (apps.length === 0) {
  // No apps initialized, initialize the default app
  app = initializeApp(firebaseConfig);
} else {
  // Get the already initialized default app
  // (Firebase JS SDK v9+ typically initializes the default app if config is provided at top level)
  app = getApp(); // Gets the [DEFAULT] app
}

// Initialize and get Firebase service instances
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const functions: Functions = getFunctions(app);
const storage: FirebaseStorage = getStorage(app);

// Export the initialized services and the config (for AuthHandler)
export { app, auth, db, functions, storage, firebaseConfig };

// --- File Type Pricing (Your existing data) ---
export const pricing = {
  "Basic": {
    "pdf": 50, "png": 40, "jpg": 40, "jpeg": 40, "mp3": 60, "wav": 60,
    "mp4": 100, "mov": 100, "docx": 50, "zip": 80, "*": 70,
  },
  "Pro": {
    "pdf": 30, "png": 25, "jpg": 25, "jpeg": 25, "mp3": 40, "wav": 40,
    "mp4": 75, "mov": 75, "docx": 30, "zip": 60, "*": 50,
  },
  "Premium": {
    "pdf": 20, "png": 15, "jpg": 15, "jpeg": 15, "mp3": 25, "wav": 25,
    "mp4": 50, "mov": 50, "docx": 20, "zip": 40, "*": 30,
  },
};
