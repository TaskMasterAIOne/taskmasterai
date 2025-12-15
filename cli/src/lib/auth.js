import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawn } from 'child_process';

const FIREBASE_PROJECT_ID = 'taskmaster-ai-e2302';
const AUTH_BASE_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const TOKEN_REFRESH_URL = `https://securetoken.googleapis.com/v1/token`;

const FUNCTIONS_BASE_URL = process.env.TASKMASTER_FUNCTIONS_URL || 
  'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net';

// Cache for Firebase API key
let FIREBASE_API_KEY_CACHE = null;

/**
 * Get Firebase API key - fetches from backend if not in env
 */
async function getFirebaseApiKey() {
  // First check env var
  if (process.env.TASKMASTER_FIREBASE_API_KEY) {
    return process.env.TASKMASTER_FIREBASE_API_KEY;
  }

  // Check cache
  if (FIREBASE_API_KEY_CACHE) {
    return FIREBASE_API_KEY_CACHE;
  }

  // Fetch from backend
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getFirebaseConfig`);
    const data = await response.json();
    
    if (data.success && data.config?.apiKey) {
      FIREBASE_API_KEY_CACHE = data.config.apiKey;
      return FIREBASE_API_KEY_CACHE;
    }
  } catch (error) {
    console.error('Failed to fetch Firebase config from backend:', error.message);
  }

  throw new Error('Firebase API key not available. Please contact support.');
}

export function getAuthFilePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }
  return path.join(taskmasterDir, 'auth.json');
}

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

export function writeAuthData(authData) {
  const authPath = getAuthFilePath();
  fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), 'utf-8');
}

export function clearAuthData() {
  const authPath = getAuthFilePath();
  if (fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
  }
}

function isTokenExpired(authData) {
  if (!authData?.expiresAt) return true;
  const expiresAt = new Date(authData.expiresAt);
  const now = new Date();
  return now >= new Date(expiresAt.getTime() - 5 * 60 * 1000);
}

async function refreshAuthToken(refreshToken) {
  try {
    const apiKey = await getFirebaseApiKey();
    const response = await fetch(`${TOKEN_REFRESH_URL}?key=${apiKey}`, {
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

export async function getValidAuthToken() {
  const authData = readStoredAuth();

  if (!authData) {
    return null;
  }

  if (isTokenExpired(authData)) {
    try {
      const newAuth = await refreshAuthToken(authData.refreshToken);
      
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

export async function loginWithEmail(email, password) {
  try {
    const apiKey = await getFirebaseApiKey();
    const response = await fetch(`${AUTH_BASE_URL}:signInWithPassword?key=${apiKey}`, {
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

    const expiresAt = new Date(Date.now() + parseInt(data.expiresIn) * 1000);

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

export async function loginWithGoogle() {
  try {
    const localPort = 8788;
    const callbackUrl = `http://localhost:${localPort}/callback`;
    
    const webBaseUrl = process.env.TASKMASTER_WEB_URL || 'https://www.taskmaster.one';
    const loginUrl = `${webBaseUrl}/cli-login?callback=${encodeURIComponent(callbackUrl)}`;
    
    console.log('\n🌐 Opening browser for Google login...\n');
    
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : 
                       platform === 'win32' ? 'start' : 'xdg-open';
    
    spawn(openCommand, [loginUrl], { detached: true, stdio: 'ignore' }).unref();

    return new Promise((resolve) => {
      let timeoutId;
      const server = http.createServer(async (req, res) => {
        if (req.url.startsWith('/callback')) {
          const url = new URL(req.url, `http://localhost:${localPort}`);
          const token = url.searchParams.get('token');
          const userId = url.searchParams.get('userId');
          const email = url.searchParams.get('email');

          if (token && userId) {
            const expiresAt = new Date(Date.now() + 3600 * 1000);
            
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

            const licenseResult = await fetchAndActivateLicense(token, userId);

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

            clearTimeout(timeoutId);
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
            clearTimeout(timeoutId);
            server.close();
            resolve({ success: false, error: 'Invalid callback' });
          }
        }
      });

      server.listen(localPort, () => {
        console.log(`Waiting for login... (Timeout in 2 minutes)\n`);
      });

      timeoutId = setTimeout(() => {
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
      userId: userId,
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

export async function getCurrentUser() {
  const authData = readStoredAuth();

  if (!authData) {
    return null;
  }

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

export async function logout() {
  try {
    clearAuthData();
    
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

export async function isLoggedIn() {
  const token = await getValidAuthToken();
  return !!token;
}

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
    const response = await fetch(`${FUNCTIONS_BASE_URL}/activateLicense`, {
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

    if (result.success) {
      // Update stored license info
      const { writeLicenseData } = await import('./license.js');
      writeLicenseData({
        licenseKey: licenseKey,
        plan: result.plan,
        planName: result.planName,
        tasksPerMonth: result.tasksPerMonth,
        status: result.status,
        lastValidated: new Date().toISOString(),
        userId: authData.userId
      });
    }

    return {
      valid: result.success === true,
      error: result.error,
      plan: result.plan,
      planName: result.planName,
      tasksPerMonth: result.tasksPerMonth
    };

  } catch (error) {
    return {
      valid: false,
      error: `Activation failed: ${error.message}`
    };
  }
}
