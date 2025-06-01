// src/firebase.ts
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Step 3: Update authDomain to your custom domain
const firebaseConfig = {
  apiKey: "AIzaSyDaMAlQRMXiDsZ4P0b06P18id3y5xBiZ1k",
  authDomain: "taskmaster.one", // Updated from deepworkai-c3419.firebaseapp.com
  projectId: "deepworkai-c3419",
  storageBucket: "deepworkai-c3419.appspot.com",
  messagingSenderId: "367439182644",
  appId: "1:367439182644:web:304216430df97eff68c361"
};

// It's good practice to export the config if other parts of the app might need it,
// especially the AuthHandler page if you choose to import it there.
export { firebaseConfig };

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export default firebase;
