# PRO License & CLI Authentication

## 🎯 New Authentication Flow

Users now **login first** before using the CLI, which is more secure:

```bash
# Step 1: Login (Google or Email/Password)
taskmaster login              # Interactive login
taskmaster login --google     # Login with Google
taskmaster login --email user@example.com  # Email login

# Step 2: CLI automatically fetches and activates your license!
# No need to manually copy license keys

# Check login status
taskmaster whoami

# Logout
taskmaster logout
```

## 🚀 Deploy the Functions

```bash
cd backend/functions
firebase deploy --only functions:setupProLicense,functions:getUserLicense
```

## 📞 Call the Function

Once deployed, you can call it via:

### Option 1: Using curl (easiest)

```bash
curl -X POST https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/setupProLicense \
  -H "Content-Type: application/json" \
  -d '{"email": "fugegate@gmail.com"}'
```

### Option 2: Using the browser/Postman

**URL**: `https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/setupProLicense`  
**Method**: POST  
**Headers**: `Content-Type: application/json`  
**Body**:
```json
{
  "email": "fugegate@gmail.com"
}
```

Or by userId:
```json
{
  "userId": "t0N7aygUo5WrBnVim1At6sbf1fy1"
}
```

### Option 3: Using Node.js

```javascript
const response = await fetch('https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/setupProLicense', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'fugegate@gmail.com' })
});

const data = await response.json();
console.log(data);
```

## ✅ Expected Response

```json
{
  "success": true,
  "message": "PRO license setup complete",
  "userId": "t0N7aygUo5WrBnVim1At6sbf1fy1",
  "email": "fugegate@gmail.com",
  "license": {
    "plan": "Pro",
    "status": "active",
    "tasksPerMonth": 1000,
    "licenseKey": "TM-PRO-T0N7AYGU-...",
    "currentPeriodEnd": "2025-01-14T..."
  }
}
```

## 🎯 What This Does

This Cloud Function will:
1. ✅ Find the user by email or userId
2. ✅ Update their user document to `plan: 'pro'`
3. ✅ Create the `/users/{uid}/license/current` document with:
   - `hasLicense: true`
   - `plan: 'pro'`
   - `planName: 'Pro'`
   - `tasksPerMonth: 1000`
   - `status: 'active'`
   - Generated license key
   - Current period dates

## 🔄 After Running

1. The user will immediately see PRO status on the dashboard
2. Usage stats will appear
3. No more "Subscribe to a plan" message
4. Full PRO features enabled

## 🔒 Security Note

This function should only be used for testing. In production, licenses should only be created via Stripe webhooks after payment.

Consider adding authentication or removing this function before going live!
