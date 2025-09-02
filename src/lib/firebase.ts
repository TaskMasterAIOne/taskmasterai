import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { FIREBASE_CONFIG } from "../config/constants";

// Firebase configuration from central constants file
const firebaseConfig = FIREBASE_CONFIG;

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and get Firebase service instances
const auth = getAuth(app);

// Set persistence to local to maintain auth state across page reloads
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting auth persistence:", error);
});

const db = getFirestore(app);
const functions = getFunctions(app); // Initialize Functions service for calling deployed functions
const storage = getStorage(app);


// Export the initialized services
export { app, auth, db, functions, storage };


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
