// src/pages/auth/handler.tsx
import React, { useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase config:
// IMPORTANT: This configuration is specific to the AuthHandler.
// It ensures that Firebase operations on this page (like handling OAuth redirects)
// are associated with your custom domain.
const firebaseConfigForAuthHandler = {
  apiKey: "AIzaSyDaMAlQRMXiDsZ4P0b06P18id3y5xBiZ1k", // Replace with your actual apiKey
  authDomain: "taskmaster.one", // CRITICAL: Must be your custom domain
  projectId: "deepworkai-c3419", // Replace with your actual projectId
  storageBucket: "deepworkai-c3419.appspot.com", // Replace with your actual storageBucket
  messagingSenderId: "367439182644", // Replace with your actual messagingSenderId
  appId: "1:367439182644:web:304216430df97eff68c361" // Replace with your actual appId
};

function AuthHandler() {
  useEffect(() => {
    let app;
    // Initialize Firebase App for this handler page
    // This ensures that the auth operations are correctly scoped to the custom domain context.
    if (!getApps().find(app => app.name === 'AuthHandlerApp')) { // Use a named app to avoid conflict if default is used elsewhere
        app = initializeApp(firebaseConfigForAuthHandler, 'AuthHandlerApp');
    } else {
        app = getApp('AuthHandlerApp');
    }
    
    const auth = getAuth(app);

    // The Firebase SDK, when initialized on this page (which is served from your custom domain
    // e.g., https://taskmaster.one/_/auth/handler, rewritten to /auth/handler),
    // and configured with authDomain: "taskmaster.one",
    // will automatically process the OAuth response from Google.
    // No explicit call to signInWithRedirectResult or similar is typically needed here,
    // as the SDK handles the redirect result upon initialization if this is the redirect URL.
    // The user should be redirected away by Firebase after processing.
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
      {/* You can add a simple loading spinner here if you like */}
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
