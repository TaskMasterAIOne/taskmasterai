# Stripe Setup Guide for TaskMaster AI

## Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete the onboarding process

## Step 2: Get API Keys

1. Go to **Developers** → **API Keys** in Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_`)
3. Copy your **Secret key** (starts with `sk_`)

## Step 3: Create Products & Prices

In Stripe Dashboard, go to **Products** and create the following:

### Product 1: TaskMaster AI Plus
- Name: `TaskMaster AI Plus`
- Price: `$29.00 USD` / month (recurring)
- After creating, copy the **Price ID** (starts with `price_`)

### Product 2: TaskMaster AI Pro
- Name: `TaskMaster AI Pro`
- Price: `$199.00 USD` / month (recurring)
- After creating, copy the **Price ID** (starts with `price_`)

### Product 3: TaskMaster AI Enterprise
- Name: `TaskMaster AI Enterprise`
- Price: `$599.00 USD` / month (recurring)
- After creating, copy the **Price ID** (starts with `price_`)

## Step 4: Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/handleStripeWebhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

## Step 5: Configure Firebase Functions

Set the environment variables in Firebase:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set STRIPE_PRICE_PLUS
firebase functions:secrets:set STRIPE_PRICE_PRO
firebase functions:secrets:set STRIPE_PRICE_ENTERPRISE
```

Or for local development, create a `.env` file in `backend/functions/`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

## Step 6: Update Frontend

Add to your frontend `.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Price IDs Reference

After creating products, update the `STRIPE_PRICES` object in `functions/index.js`:

```javascript
const STRIPE_PRICES = {
  plus: 'price_xxxxxxxxxxxxx',      // Replace with your Plus price ID
  pro: 'price_xxxxxxxxxxxxx',       // Replace with your Pro price ID
  enterprise: 'price_xxxxxxxxxxxxx' // Replace with your Enterprise price ID
};
```
