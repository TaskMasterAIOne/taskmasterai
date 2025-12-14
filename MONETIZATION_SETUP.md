# TaskMaster AI Monetization Setup Guide

This guide explains how to set up the license key monetization system for TaskMaster AI.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Web App       │────▶│   Stripe     │────▶│  Firebase       │
│  (React + Vite) │     │  Checkout    │     │  Functions      │
└────────┬────────┘     └──────────────┘     └────────┬────────┘
         │                                            │
         │                                            ▼
         │                                   ┌─────────────────┐
         │                                   │   Firestore     │
         │                                   │  (licenses)     │
         │                                   └────────┬────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────┐                         ┌─────────────────┐
│  User Dashboard │◀────────────────────────│   Validate      │
│  (License Key)  │                         │   License API   │
└─────────────────┘                         └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  TaskMaster CLI │
                                            │  / MCP Server   │
                                            └─────────────────┘
```

## Setup Steps

### Step 1: Stripe Configuration

1. **Create Stripe Account**: Go to [stripe.com](https://stripe.com) and sign up
2. **Create Products**: In Stripe Dashboard → Products, create:
   - **TaskMaster AI Plus**: $29/month (recurring)
   - **TaskMaster AI Pro**: $199/month (recurring)
   - **TaskMaster AI Enterprise**: $599/month (recurring)
3. **Copy Price IDs**: Each product has a Price ID (starts with `price_`)
4. **Set up Webhook**: 
   - Go to Developers → Webhooks
   - Add endpoint URL: `https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/handleStripeWebhook`
   - Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`
   - Copy the webhook signing secret

### Step 2: Firebase Functions Setup

1. **Install dependencies**:
```bash
cd backend/functions
npm install
```

2. **Set Firebase Secrets** (for production):
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Enter your Stripe secret key

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Enter your webhook signing secret

firebase functions:secrets:set STRIPE_PRICE_PLUS
# Enter your Plus plan price ID

firebase functions:secrets:set STRIPE_PRICE_PRO
# Enter your Pro plan price ID

firebase functions:secrets:set STRIPE_PRICE_ENTERPRISE
# Enter your Enterprise plan price ID
```

3. **Deploy Functions**:
```bash
firebase deploy --only functions
```

4. **Update Webhook URL**: Go back to Stripe Dashboard and update the webhook URL with your deployed function URL.

### Step 3: Frontend Configuration

1. **Create `.env` file** in the web app root:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net
```

2. **Build and Deploy**:
```bash
npm run build
# Deploy to your hosting provider
```

### Step 4: TaskMaster CLI Configuration

1. **Update the License API URL** in `scripts/modules/license-manager.js`:
```javascript
const LICENSE_API_URL = 'https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/validateLicense';
```

2. **Build TaskMaster**:
```bash
npm run build
```

3. **Publish to npm** (or install locally):
```bash
npm publish
```

## User Flow

1. **User visits website** → Sees pricing page
2. **User selects plan** → Redirected to Stripe Checkout
3. **User completes payment** → Stripe sends webhook
4. **Webhook generates license key** → Stored in Firestore, linked to user
5. **User views dashboard** → Sees license key with copy button
6. **User runs CLI command**:
```bash
taskmaster activate tm_live_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
7. **License validated** → Stored locally in `~/.taskmaster/license.json`
8. **User uses TaskMaster** → License checked on each command (cached for 24 hours)

## License Key Format

License keys follow this format:
- **Live**: `tm_live_<uuid>` (e.g., `tm_live_a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **Test**: `tm_test_<uuid>` (for development/testing)

## Environment Variables

### Web App (`.env`)
| Variable | Description |
|----------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_... or pk_live_...) |
| `VITE_FIREBASE_FUNCTIONS_URL` | Base URL for Firebase Functions |

### Firebase Functions
| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_PLUS` | Price ID for Plus plan |
| `STRIPE_PRICE_PRO` | Price ID for Pro plan |
| `STRIPE_PRICE_ENTERPRISE` | Price ID for Enterprise plan |

### TaskMaster CLI/MCP
| Variable | Description |
|----------|-------------|
| `TASKMASTER_LICENSE_API_URL` | License validation endpoint URL |

## Files Modified/Created

### Web App
- `src/lib/stripe.ts` - Stripe utilities
- `src/contexts/AuthContext.tsx` - Added license info
- `src/pages/Pricing.tsx` - Connected to Stripe checkout
- `src/pages/app/Billing.tsx` - License key display and management

### Backend (Firebase Functions)
- `backend/functions/index.js` - Stripe checkout, webhooks, license validation
- `backend/firestore.rules` - Security rules for licenses
- `backend/firestore.indexes.json` - Database indexes

### TaskMaster CLI/MCP
- `scripts/modules/license-manager.js` - License validation and storage
- `scripts/modules/commands.js` - Added activate, license, deactivate commands
- `mcp-server/src/index.js` - Added license check on server start

## Testing

### Local Testing with Stripe CLI
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local function
stripe listen --forward-to localhost:5001/YOUR-PROJECT/us-central1/handleStripeWebhook

# Trigger test events
stripe trigger checkout.session.completed
```

### Test License Activation
```bash
# Create a test license manually in Firestore for testing
# Or complete a test checkout with Stripe test mode

# Activate license
taskmaster activate tm_test_your-test-license-key

# Check license status
taskmaster license

# Deactivate
taskmaster deactivate
```

## Troubleshooting

### "License Required" Error
- Run `taskmaster license` to check current status
- Run `taskmaster activate <key>` with your license key
- Check if your subscription is active at https://www.taskmaster.one/app/billing

### Webhook Not Working
- Verify webhook URL is correct in Stripe Dashboard
- Check Firebase Functions logs: `firebase functions:log`
- Ensure webhook secret is correctly set

### Payment Completed but No License
- Check Stripe Dashboard for successful payment
- Check Firebase Functions logs for errors
- Manually trigger webhook: `stripe events resend evt_xxxxx`

## Security Considerations

1. **Never expose secret keys** in frontend code
2. **Use Firebase Security Rules** to protect license data
3. **Validate webhooks** using Stripe's signing secret
4. **Cache license validation** to reduce API calls (24-hour cache)
5. **Allow offline grace period** for network issues (3 days)
