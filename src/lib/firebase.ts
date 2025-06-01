// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Your Firebase project configuration
// IMPORTANT: Consider using environment variables for security, especially apiKey
const firebaseConfig = {
  apiKey: "AIzaSyDaMAlQRMXiDsZ4P0b06P18id3y5xBiZ1k", // Replace if different
  authDomain: "taskmaster.one", // <--- UPDATED for custom auth domain
  projectId: "deepworkai-c3419",
  storageBucket: "deepworkai-c3419.appspot.com",
  messagingSenderId: "367439182644",
  appId: "1:367439182644:web:304216430df97eff68c361",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and get Firebase service instances
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); // Initialize Functions service for calling deployed functions
const storage = getStorage(app);


// Export the initialized services
export { app, auth, db, functions, storage, firebaseConfig }; // Also exporting firebaseConfig for the AuthHandler page


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
