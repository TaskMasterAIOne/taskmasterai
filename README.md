# TaskMaster AI Web Application

A modern, production-ready web application for **TaskMaster AI** - the AI-powered task management system for developers.

![TaskMaster AI](https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/TaskMaster_AI%20Logo.png)

## Features

- 🔐 **Authentication** - Firebase Auth with email/password and Google OAuth
- 💳 **Subscription Management** - Stripe integration with Free, Pro, and Team tiers
- 🔑 **API Key Vault** - Securely store and manage AI provider API keys
- ⚙️ **Model Configuration** - Configure main, research, and fallback AI models
- 📊 **Dashboard** - Overview of projects, tasks, and usage statistics
- 🎨 **Modern UI** - Dark-first design inspired by Cursor, Linear, and Vercel

## Tech Stack

- **React 18** with TypeScript
- **Vite** for blazing fast development
- **TailwindCSS** for utility-first styling
- **Framer Motion** for animations
- **Firebase** (Auth, Firestore, Analytics)
- **Stripe** for payments
- **React Router** for navigation

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project (already configured)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── App.tsx              # Main app with routing
├── main.tsx             # Entry point
├── index.css            # Global styles & Tailwind
├── contexts/
│   └── AuthContext.tsx  # Firebase auth context
├── layouts/
│   ├── PublicLayout.tsx # Layout for public pages
│   └── AppLayout.tsx    # Layout for authenticated pages
├── lib/
│   └── firebase.ts      # Firebase configuration
└── pages/
    ├── Landing.tsx      # Landing page
    ├── Pricing.tsx      # Pricing tiers
    ├── Docs.tsx         # Documentation
    ├── Login.tsx        # Sign in
    ├── Register.tsx     # Sign up
    └── app/
        ├── Dashboard.tsx  # User dashboard
        ├── ApiKeys.tsx    # API key management
        ├── Models.tsx     # Model configuration
        └── Billing.tsx    # Subscription management
```

## Firebase Configuration

The app is pre-configured with Firebase:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDNWlikkR9ji9lstwOYlBoCDR2PiT2fb3Y",
  authDomain: "taskmaster-ai-e2302.firebaseapp.com",
  projectId: "taskmaster-ai-e2302",
  storageBucket: "taskmaster-ai-e2302.firebasestorage.app",
  messagingSenderId: "795400978174",
  appId: "1:795400978174:web:27ed00f5ecd8920e042faf",
  measurementId: "G-G6193BH8YH"
};
```

## Stripe Integration

For production, configure Stripe:

1. Create a Stripe account
2. Add your keys to `.env`:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   ```
3. Set up webhooks for subscription events

## Firestore Data Models

### Users Collection
```json
{
  "uid": "string",
  "email": "string",
  "plan": "free | pro | team",
  "createdAt": "timestamp"
}
```

### API Keys Subcollection
```json
{
  "provider": "anthropic | openai | google | ...",
  "maskedKey": "string",
  "createdAt": "timestamp"
}
```

## Security

- API keys are masked and never exposed to the frontend
- Firebase security rules protect user data
- Stripe webhooks validate subscription state
- All sensitive operations happen server-side

## Related

- [TaskMaster AI CLI](https://taskmaster.one/docs) - Official CLI documentation
- [Documentation](https://taskmaster.one/docs) - Full documentation

## License

Proprietary - TaskMaster AI LLC. All rights reserved.

