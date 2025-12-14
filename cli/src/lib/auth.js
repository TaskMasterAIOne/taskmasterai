/**
 * Authentication Manager for TaskMaster AI CLI
 * Handles Firebase authentication (Email/Password and Google)
 * Stores auth tokens and manages session
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn } from 'child_process';

// Firebase Auth REST API endpoints
// Note: Firebase web API keys are designed to be public and protected by security rules
// However, we use environment variable for flexibility
const FIREBASE_API_KEY = process.env.TASKMASTER_FIREBASE_API_KEY || 'AIzaSyDNWlikkR9ji9lstwOYlBoCDR2PiT2fb3Y';
const FIREBASE_PROJECT_ID = 'taskmaster-ai-e2302';
const AUTH_BASE_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const TOKEN_REFRESH_URL = `https://securetoken.googleapis.com/v1/token`;

// Functions URL for license fetching
const FUNCTIONS_BASE_URL = process.env.TASKMASTER_FUNCTIONS_URL || 
  'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net';

/**
 * Get the path to the auth token file
 * @returns {string} Path to ~/.taskmaster-ai/auth.json
 */
export function getAuthFilePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }
  return path.join(taskmasterDir, 'auth.json');
}

/**
 * Read stored auth data
 * @returns {Object|null} Auth data or null if not found
 */
export function readStoredAuth() {
  const authPath = getAuthFilePath();
  
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(authPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading auth data:', error.message);
    return null;
  }
}

/**
 * Write auth data to file
 * @param {Object} authData - Auth data to store
 */
export function writeAuthData(authData) {
  const authPath = getAuthFilePath();
  fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), 'utf-8');
}

/**
 * Clear stored auth data
 */
export function clearAuthData() {
  const authPath = getAuthFilePath();
  if (fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
  }
}

/**
 * Check if auth token is expired
 * @param {Object} authData - Stored auth data
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(authData) {
  if (!authData?.expiresAt) return true;
  const expiresAt = new Date(authData.expiresAt);
  const now = new Date();
  // Add 5 minute buffer
  return now >= new Date(expiresAt.getTime() - 5 * 60 * 1000);
}

/**
 * Refresh the auth token
 * @param {string} refreshToken - Firebase refresh token
 * @returns {Promise<Object>} New auth data
 */
async function refreshAuthToken(refreshToken) {
  try {
    const response = await fetch(`${TOKEN_REFRESH_URL}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to refresh token');
    }

    const expiresAt = new Date(Date.now() + parseInt(data.expires_in) * 1000);

    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Get valid auth token (refreshes if needed)
 * @returns {Promise<string|null>} Valid ID token or null
 */
export async function getValidAuthToken() {
  const authData = readStoredAuth();

  if (!authData) {
    return null;
  }

  // If token is expired, refresh it
  if (isTokenExpired(authData)) {
    try {
      const newAuth = await refreshAuthToken(authData.refreshToken);
      
      // Update stored auth
      const updatedAuth = {
        ...authData,
        ...newAuth,
        lastRefreshed: new Date().toISOString()
      };
      writeAuthData(updatedAuth);

      return newAuth.idToken;
    } catch (error) {
      console.error('Failed to refresh token:', error.message);
      return null;
    }
  }

  return authData.idToken;
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login result
 */
export async function loginWithEmail(email, password) {
  try {
    // Sign in with Firebase
    const response = await fetch(`${AUTH_BASE_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || 'Login failed';
      return {
        success: false,
        error: errorMessage === 'INVALID_LOGIN_CREDENTIALS' || errorMessage === 'INVALID_PASSWORD'
          ? 'Invalid email or password'
          : errorMessage
      };
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + parseInt(data.expiresIn) * 1000);

    // Store auth data
    const authData = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email,
      userId: data.localId,
      expiresAt: expiresAt.toISOString(),
      loginMethod: 'email',
      loginAt: new Date().toISOString()
    };

    writeAuthData(authData);

    // Fetch and activate license
    const licenseResult = await fetchAndActivateLicense(data.idToken, data.localId);

    return {
      success: true,
      email: data.email,
      userId: data.localId,
      license: licenseResult
    };

  } catch (error) {
    return {
      success: false,
      error: `Login failed: ${error.message}`
    };
  }
}

/**
 * Login with Google (opens browser for OAuth)
 * @returns {Promise<Object>} Login result
 */
export async function loginWithGoogle() {
  try {
    // For CLI, we'll use a custom OAuth flow
    // 1. Open browser to web app login page with callback
    // 2. User logs in with Google on web
    // 3. Web app sends token back to CLI via localhost server
    
    // Start local server to receive token
    const localPort = 8788;
    const callbackUrl = `http://localhost:${localPort}/callback`;
    
    // Open browser to web app login with CLI callback
    // Use TASKMASTER_WEB_URL for local development, defaults to production
    const webBaseUrl = process.env.TASKMASTER_WEB_URL || 'https://taskmaster.one';
    const loginUrl = `${webBaseUrl}/cli-login?callback=${encodeURIComponent(callbackUrl)}`;
    
    console.log('\n🌐 Opening browser for Google login...\n');
    
    // Open browser based on platform
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : 
                       platform === 'win32' ? 'start' : 'xdg-open';
    
    spawn(openCommand, [loginUrl], { detached: true, stdio: 'ignore' }).unref();

    // Wait for callback from web app
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        if (req.url.startsWith('/callback')) {
          const url = new URL(req.url, `http://localhost:${localPort}`);
          const token = url.searchParams.get('token');
          const userId = url.searchParams.get('userId');
          const email = url.searchParams.get('email');

          if (token && userId) {
            // Store auth data
            const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
            
            const authData = {
              idToken: token,
              refreshToken: url.searchParams.get('refreshToken'),
              email,
              userId,
              expiresAt: expiresAt.toISOString(),
              loginMethod: 'google',
              loginAt: new Date().toISOString()
            };

            writeAuthData(authData);

            // Fetch and activate license
            const licenseResult = await fetchAndActivateLicense(token, userId);

            // Send success response to browser
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Login Successful - TaskMaster AI</title>
                  <style>
                    :root {
                      --bg: #ffffff;
                      --text: #0a0a0a;
                      --text-muted: #71717a;
                      --success: #10b981;
                      --card-bg: #f4f4f5;
                      --border: #e4e4e7;
                    }
                    @media (prefers-color-scheme: dark) {
                      :root {
                        --bg: #0a0a0a;
                        --text: #fafafa;
                        --text-muted: #a1a1aa;
                        --success: #10b981;
                        --card-bg: #18181b;
                        --border: #27272a;
                      }
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      background: var(--bg);
                      color: var(--text);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 20px;
                    }
                    .card {
                      background: var(--card-bg);
                      border: 1px solid var(--border);
                      border-radius: 16px;
                      padding: 48px;
                      text-align: center;
                      max-width: 400px;
                    }
                    .icon {
                      width: 64px;
                      height: 64px;
                      background: rgba(16, 185, 129, 0.1);
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0 auto 24px;
                      font-size: 32px;
                    }
                    h1 {
                      color: var(--success);
                      font-size: 24px;
                      font-weight: 700;
                      margin-bottom: 12px;
                    }
                    p {
                      color: var(--text-muted);
                      font-size: 14px;
                      line-height: 1.5;
                    }
                    .terminal {
                      display: inline-flex;
                      align-items: center;
                      gap: 8px;
                      margin-top: 24px;
                      padding: 8px 16px;
                      background: var(--bg);
                      border: 1px solid var(--border);
                      border-radius: 8px;
                      font-size: 13px;
                      color: var(--text-muted);
                    }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <div class="icon">✓</div>
                    <h1>Login Successful!</h1>
                    <p>Your CLI has been authenticated. You can close this window and return to your terminal.</p>
                    <div class="terminal">
                      <span>⌘</span>
                      <span>Return to terminal</span>
                    </div>
                  </div>
                </body>
              </html>
            `);

            server.close();
            
            resolve({
              success: true,
              email,
              userId,
              license: licenseResult
            });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid callback parameters');
            server.close();
            resolve({ success: false, error: 'Invalid callback' });
          }
        }
      });

      server.listen(localPort, () => {
        console.log(`Waiting for login... (Timeout in 2 minutes)\n`);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        resolve({ success: false, error: 'Login timeout - please try again' });
      }, 120000);
    });

  } catch (error) {
    return {
      success: false,
      error: `Google login failed: ${error.message}`
    };
  }
}

/**
 * Fetch user's license and activate it
 * @param {string} idToken - Firebase ID token
 * @param {string} userId - User ID
 * @returns {Promise<Object>} License info
 */
async function fetchAndActivateLicense(idToken, userId) {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getUserLicense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ userId })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        hasLicense: false,
        error: result.error || 'No active license found'
      };
    }

    // Store license data locally (like the old activate command did)
    const { getLicenseFilePath } = await import('./license.js');
    const licenseFilePath = getLicenseFilePath();
    
    const licenseData = {
      licenseKey: result.licenseKey,
      plan: result.plan,
      planName: result.planName,
      tasksPerMonth: result.tasksPerMonth,
      status: result.status,
      expiresAt: result.expiresAt,
      activatedAt: new Date().toISOString(),
      lastValidated: new Date().toISOString(),
      userId: userId, // Track which user owns this license
    };

    fs.writeFileSync(licenseFilePath, JSON.stringify(licenseData, null, 2), 'utf-8');

    return {
      hasLicense: true,
      plan: result.plan,
      planName: result.planName,
      tasksPerMonth: result.tasksPerMonth,
      licenseKey: result.licenseKey
    };

  } catch (error) {
    return {
      hasLicense: false,
      error: `Failed to fetch license: ${error.message}`
    };
  }
}

/**
 * Get current logged in user
 * @returns {Promise<Object|null>} User data or null
 */
export async function getCurrentUser() {
  const authData = readStoredAuth();

  if (!authData) {
    return null;
  }

  // Get valid token (refreshes if needed)
  const token = await getValidAuthToken();

  if (!token) {
    return null;
  }

  return {
    email: authData.email,
    userId: authData.userId,
    loginMethod: authData.loginMethod,
    loginAt: authData.loginAt
  };
}

/**
 * Logout - clear auth and license data
 * @returns {Promise<Object>} Logout result
 */
export async function logout() {
  try {
    clearAuthData();
    
    // Also clear license data
    const { getLicenseFilePath } = await import('./license.js');
    const licenseFilePath = getLicenseFilePath();
    if (fs.existsSync(licenseFilePath)) {
      fs.unlinkSync(licenseFilePath);
    }

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: `Logout failed: ${error.message}`
    };
  }
}

/**
 * Check if user is logged in
 * @returns {Promise<boolean>} True if logged in
 */
export async function isLoggedIn() {
  const token = await getValidAuthToken();
  return !!token;
}

/**
 * Verify user owns a specific license
 * @param {string} licenseKey - License key to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyLicenseOwnership(licenseKey) {
  const authData = readStoredAuth();
  
  if (!authData) {
    return {
      valid: false,
      error: 'Not logged in'
    };
  }

  const token = await getValidAuthToken();
  
  if (!token) {
    return {
      valid: false,
      error: 'Session expired - please login again'
    };
  }

  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/verifyLicenseOwnership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        licenseKey,
        userId: authData.userId 
      })
    });

    const result = await response.json();

    return {
      valid: result.valid === true,
      error: result.error
    };

  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error.message}`
    };
  }
}
