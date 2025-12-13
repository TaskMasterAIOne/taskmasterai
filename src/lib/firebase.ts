import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyDNWlikkR9ji9lstwOYlBoCDR2PiT2fb3Y",
  authDomain: "taskmaster-ai-e2302.firebaseapp.com",
  projectId: "taskmaster-ai-e2302",
  storageBucket: "taskmaster-ai-e2302.firebasestorage.app",
  messagingSenderId: "795400978174",
  appId: "1:795400978174:web:27ed00f5ecd8920e042faf",
  measurementId: "G-G6193BH8YH"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Initialize analytics only in browser and production
export const initAnalytics = async () => {
  if (await isSupported()) {
    return getAnalytics(app)
  }
  return null
}

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectFirestoreEmulator(db, 'localhost', 8080)
}

