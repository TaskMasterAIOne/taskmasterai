// src/pages/auth/handler.tsx
import React, { useEffect } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
// Import the firebaseConfig from your main Firebase setup file
// Adjust the path based on the location of your firebase.ts
// If firebase.ts is in src/lib/, then from src/pages/auth/ the path is ../../lib/firebase
import { firebaseConfig as globalFirebaseConfig } from '../../lib/firebase';

const AUTH_HANDLER_APP_NAME = 'Firebase Auth Handler App'; // Unique name for this app instance

function AuthHandler() {
  useEffect(() => {
    let appInstance: FirebaseApp;
    const existingApps = getApps();
    const alreadyInitializedApp = existingApps.find(app => app.name === AUTH_HANDLER_APP_NAME);

    // Ensure the config used for this handler has the correct custom authDomain
    const configForAuthHandler = {
      ...globalFirebaseConfig, // Use the base config from your main firebase file
      authDomain: "taskmaster.one", // Explicitly ensure the custom domain is set
    };

    if (alreadyInitializedApp) {
      appInstance = alreadyInitializedApp;
    } else {
      appInstance = initializeApp(configForAuthHandler, AUTH_HANDLER_APP_NAME);
    }
    
    // Get the Auth instance for this specific, named app
    const authForHandler: Auth = getAuth(appInstance);

    // The Firebase SDK, when getAuth() is called for an app initialized
    // with the correct authDomain (matching the page's domain) on the redirect page,
    // will automatically process the OAuth response.
    // The user should be redirected by Firebase Auth after it processes the sign-in.
    // No explicit call to signInWithRedirectResult is usually needed here if using signInWithRedirect.
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#f4f4f5', // A neutral background
      fontFamily: 'Arial, sans-serif',
      color: '#333'
    }}>
      <svg width="50" height="50" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="#4f46e5">
        <g fill="none" fillRule="evenodd">
            <g transform="translate(1 1)" strokeWidth="2">
                <circle strokeOpacity=".5" cx="18" cy="18" r="18"/>
                <path d="M36 18c0-9.94-8.06-18-18-18">
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 18 18"
                        to="360 18 18"
                        dur="1s"
                        repeatCount="indefinite"/>
                </path>
            </g>
        </g>
      </svg>
      <p style={{ marginTop: '20px', fontSize: '1.1em' }}>Authentication in progress...</p>
      <p style={{ fontSize: '0.9em', color: '#666' }}>Please wait, you will be redirected shortly.</p>
    </div>
  );
}

export default AuthHandler;
