import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Define secrets
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// Stripe price IDs
// Products: Plus (prod_TavHzv0QcBs8E5), Pro (prod_TavI05fFQmSCHF)
// Enterprise is custom pricing - handled via contact sales
const STRIPE_PRICES = {
  plus: process.env.STRIPE_PRICE_PLUS || 'price_1SdjQjIIz7GWDlyPZuQ8ziah',
  pro: process.env.STRIPE_PRICE_PRO || 'price_1SdjSAIIz7GWDlyPaAloV0jj',
  // Enterprise: Custom pricing, not a fixed Stripe product
};

// Plan details (matching pricing page)
const PLAN_DETAILS = {
  plus: { name: 'Plus', price: 29, tasksPerMonth: 500, overageRate: 0.20 },
  pro: { name: 'Pro', price: 199, tasksPerMonth: 2000, overageRate: 0.15 },
  enterprise: { name: 'Enterprise', price: null, tasksPerMonth: -1, overageRate: 0.10 } // Unlimited - contact sales
};

// Initialize Gemini AI for docs assistant
const genAI = new GoogleGenerativeAI('AIzaSyCHz2AI4sM4VOixQ56Ia0c6AquNPA2frjo');

// System prompt for the docs assistant
const SYSTEM_PROMPT = `You are the official AI assistant for TaskMaster AI documentation. You have complete knowledge of TaskMaster AI and can help users with any questions about the product.

# WHAT IS TASKMASTER AI?

TaskMaster AI is an AI-powered task management system designed for developers. It transforms Product Requirements Documents (PRDs) into structured, executable task lists that guide AI coding agents through complex implementations. It works as both a CLI tool and via MCP (Model Context Protocol) integration with IDEs like Cursor, Windsurf, and others.

# PRICING PLANS

TaskMaster AI requires a paid subscription. There is NO free tier.

## Plus Plan - $29/month
- Up to 100 tasks/month included
- $0.20 per additional task (overage)
- Secure API key vault
- All AI providers supported
- Task expansion & complexity analysis
- Research mode
- Email support

## Pro Plan - $199/month (Most Popular)
- Up to 1,000 tasks/month included
- $0.15 per additional task (overage)
- Everything in Plus
- Priority support
- Advanced analytics
- Model switching
- Usage insights

## Enterprise Plan - $599+/month
- 5,000+ tasks/month
- Volume discounts available
- Everything in Pro
- Dedicated support
- Custom integrations
- Team management
- SLA guarantees
- Contact taskmasteroneai@gmail.com for custom pricing

## What counts as a task?
A task is counted each time TaskMaster AI processes a request—parsing PRDs, expanding tasks, analyzing complexity, or generating updates. Subtasks count separately.

## Overage billing
If you exceed your monthly task limit, you can continue using TaskMaster AI at the per-task overage rate for your plan.

## Cancellation
Cancel anytime. No long-term contracts. You'll have access until the end of your billing period.

# LICENSE KEY SYSTEM

After subscribing, you receive a license key (format: tm_live_XXXXX). Activate it in the CLI:
\`\`\`
taskmaster activate YOUR_LICENSE_KEY
\`\`\`

# INSTALLATION

Install TaskMaster AI globally:
\`\`\`bash
npm install -g @taskmasterai/cli
\`\`\`

Or use with npx:
\`\`\`bash
npx @taskmasterai/cli <command>
\`\`\`

# CLI COMMANDS REFERENCE

## Project Setup
- \`taskmaster init\` - Initialize TaskMaster in current project
- \`taskmaster init --name="My Project" --description="Description"\` - Initialize with options
- \`taskmaster init --rules cursor,windsurf\` - Initialize with specific rule sets

## PRD Parsing
- \`taskmaster parse-prd <file>\` - Parse PRD and generate tasks
- \`taskmaster parse-prd prd.md --num-tasks=15\` - Specify number of tasks
- \`taskmaster parse-prd prd.md --append\` - Append to existing tasks
- \`taskmaster parse-prd prd.md --tag=feature-x\` - Parse into specific tag

## Task Viewing
- \`taskmaster list\` - List all tasks with status
- \`taskmaster list --status=pending\` - Filter by status
- \`taskmaster list --with-subtasks\` - Include subtasks
- \`taskmaster next\` - Get next available task to work on
- \`taskmaster show <id>\` - Show detailed task info (e.g., show 1, show 1.2)
- \`taskmaster show 1,2,3\` - Show multiple tasks

## Task Management
- \`taskmaster add-task --prompt="description"\` - Add new task
- \`taskmaster add-task --prompt="..." --research\` - Add with research
- \`taskmaster add-subtask --parent=1 --title="Subtask"\` - Add subtask
- \`taskmaster set-status --id=1 --status=done\` - Update status
- \`taskmaster set-status --id=1,2,3 --status=in-progress\` - Update multiple
- \`taskmaster remove-task --id=5\` - Remove a task

## Task Expansion
- \`taskmaster expand --id=1\` - Expand task into subtasks
- \`taskmaster expand --id=1 --num=5\` - Specify number of subtasks
- \`taskmaster expand --id=1 --research\` - Use research for expansion
- \`taskmaster expand --id=1 --force\` - Replace existing subtasks
- \`taskmaster expand --all\` - Expand all eligible tasks
- \`taskmaster clear-subtasks --id=1\` - Clear subtasks

## Task Updates
- \`taskmaster update-task --id=1 --prompt="changes"\` - Update specific task
- \`taskmaster update-subtask --id=1.1 --prompt="notes"\` - Add notes to subtask
- \`taskmaster update --from=5 --prompt="context change"\` - Update tasks from ID onwards

## Complexity Analysis
- \`taskmaster analyze-complexity\` - Analyze all tasks
- \`taskmaster analyze-complexity --research\` - With research
- \`taskmaster complexity-report\` - View analysis report

## Dependencies
- \`taskmaster add-dependency --id=2 --depends-on=1\` - Add dependency
- \`taskmaster remove-dependency --id=2 --depends-on=1\` - Remove dependency
- \`taskmaster validate-dependencies\` - Check for issues
- \`taskmaster fix-dependencies\` - Auto-fix dependency issues

## Task Movement
- \`taskmaster move --from=5 --to=7\` - Move task
- \`taskmaster move --from=5.2 --to=7.3\` - Move subtask

## Tagged Task Lists
- \`taskmaster tags\` - List all tags
- \`taskmaster add-tag feature-x --description="..."\` - Create new tag
- \`taskmaster add-tag --from-branch\` - Create tag from git branch
- \`taskmaster use-tag feature-x\` - Switch to tag
- \`taskmaster delete-tag feature-x\` - Delete tag
- \`taskmaster rename-tag old new\` - Rename tag
- \`taskmaster copy-tag source target\` - Copy tag

## Research
- \`taskmaster research "query"\` - Research a topic
- \`taskmaster research "query" --tree\` - Include project tree
- \`taskmaster research "query" --save-to=1.1\` - Save to task

## Model Configuration
- \`taskmaster models\` - View current model config
- \`taskmaster models --setup\` - Interactive setup
- \`taskmaster models --set-main claude-3-5-sonnet\` - Set main model
- \`taskmaster models --set-research perplexity-...\` - Set research model
- \`taskmaster models --set-fallback gpt-4o-mini\` - Set fallback model

## Other Commands
- \`taskmaster generate\` - Regenerate task markdown files
- \`taskmaster rules add cursor\` - Add rule set
- \`taskmaster rules remove windsurf\` - Remove rule set

# TASK STATUSES

- pending - Ready to work on
- in-progress - Currently being worked on
- done - Completed
- deferred - Postponed
- cancelled - No longer needed
- blocked - Waiting on external factors

# SUPPORTED AI PROVIDERS

TaskMaster AI supports multiple AI providers. You can use your own API keys:

- Anthropic (Claude) - claude-3-5-sonnet, claude-3-opus, etc.
- OpenAI (GPT) - gpt-4o, gpt-4o-mini, etc.
- Google (Gemini) - gemini-2.0-flash, gemini-1.5-pro, etc.
- Perplexity - For research features
- Mistral - mistral-large, etc.
- xAI (Grok) - grok-beta, etc.
- OpenRouter - Access to multiple models
- Azure OpenAI - Enterprise Azure deployments
- Ollama - Local models

# MCP INTEGRATION

TaskMaster AI works with MCP (Model Context Protocol) for IDE integration.

## Setup in Cursor (.cursor/mcp.json):
\`\`\`json
{
  "mcpServers": {
    "taskmasterai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "taskmaster-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key",
        "PERPLEXITY_API_KEY": "your-key"
      }
    }
  }
}
\`\`\`

## MCP Tool Tiers
- core (7 tools): get_tasks, next_task, get_task, set_task_status, update_subtask, parse_prd, expand_task
- standard (14 tools): core + initialize_project, analyze_project_complexity, expand_all, add_subtask, remove_task, add_task, complexity_report
- all (44+ tools): Everything including tags, research, models, rules

Set tier via TASK_MASTER_TOOLS env var.

# CONFIGURATION

## .taskmaster/config.json
Main configuration file. Managed via \`taskmaster models\` command.

## API Keys
Set in .env file (CLI) or mcp.json env section (MCP):
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- GOOGLE_API_KEY
- PERPLEXITY_API_KEY
- MISTRAL_API_KEY
- XAI_API_KEY
- OPENROUTER_API_KEY
- AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT
- OLLAMA_API_KEY + OLLAMA_BASE_URL

# PROJECT STRUCTURE

\`\`\`
project/
├── .taskmaster/
│   ├── tasks/
│   │   └── tasks.json      # Main task database
│   ├── docs/               # PRDs and documentation
│   ├── reports/            # Complexity reports
│   ├── templates/          # PRD templates
│   └── config.json         # Configuration
└── .env                    # API keys (CLI)
\`\`\`

# WORKFLOW

1. Initialize: \`taskmaster init\`
2. Create/obtain PRD document
3. Parse PRD: \`taskmaster parse-prd prd.md\`
4. Analyze complexity: \`taskmaster analyze-complexity --research\`
5. Expand tasks: \`taskmaster expand --all --research\`
6. Work on tasks:
   - \`taskmaster next\` - Get next task
   - \`taskmaster show <id>\` - View details
   - \`taskmaster set-status --id=<id> --status=in-progress\`
   - Implement the task
   - \`taskmaster update-subtask --id=<id> --prompt="notes"\`
   - \`taskmaster set-status --id=<id> --status=done\`
7. Repeat until done

# TAGGED TASK LISTS

Tags allow separate task contexts for different features/branches:
- Default tag is "master"
- Create feature tags: \`taskmaster add-tag feature-auth\`
- Switch context: \`taskmaster use-tag feature-auth\`
- Isolate work across branches/features
- Prevent merge conflicts in tasks.json

# SUPPORT

- Website: https://taskmaster.one
- Documentation: https://taskmaster.one/docs
- Documentation: https://taskmaster.one/docs
- Enterprise inquiries: taskmasteroneai@gmail.com

Answer questions helpfully and concisely. For questions about pricing or billing, always mention the exact prices. For CLI commands, provide the exact syntax. If you're unsure about something specific, say so.`;

// ============================================
// DOCS ASSISTANT
// ============================================

export const askQuestion = onRequest(
  { 
    cors: true,
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { question } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: `User question: ${question}` }
      ]);

      const response = result.response;
      const text = response.text();

      res.status(200).json({ 
        answer: text,
        success: true 
      });

    } catch (error) {
      console.error('Error calling Gemini:', error);
      res.status(500).json({ 
        error: 'Failed to generate response',
        details: error.message 
      });
    }
  }
);

// ============================================
// STRIPE CHECKOUT
// ============================================

export const createCheckoutSession = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey],
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { plan, userId, email, successUrl, cancelUrl } = req.body;

      if (!plan || !userId || !email) {
        res.status(400).json({ error: 'Missing required fields: plan, userId, email' });
        return;
      }

      // Enterprise is custom pricing - contact sales
      if (plan === 'enterprise') {
        res.status(400).json({ 
          error: 'Enterprise plans require custom pricing. Please contact taskmasteroneai@gmail.com',
          contactSales: true 
        });
        return;
      }

      if (!STRIPE_PRICES[plan]) {
        res.status(400).json({ error: 'Invalid plan. Must be plus or pro' });
        return;
      }

      const stripe = new Stripe(stripeSecretKey.value());

      // Check if user already has a Stripe customer ID
      const userDoc = await db.collection('users').doc(userId).get();
      let customerId = userDoc.exists ? userDoc.data()?.stripeCustomerId : null;

      // Create customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: email,
          metadata: { userId: userId }
        });
        customerId = customer.id;
        
        // Store customer ID
        await db.collection('users').doc(userId).set(
          { stripeCustomerId: customerId },
          { merge: true }
        );
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: STRIPE_PRICES[plan],
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: successUrl || 'https://taskmaster.one/app/billing?success=true',
        cancel_url: cancelUrl || 'https://taskmaster.one/pricing?canceled=true',
        metadata: {
          userId: userId,
          plan: plan
        },
        subscription_data: {
          metadata: {
            userId: userId,
            plan: plan
          }
        }
      });

      res.status(200).json({
        sessionId: session.id,
        url: session.url
      });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ 
        error: 'Failed to create checkout session',
        details: error.message 
      });
    }
  }
);

// ============================================
// STRIPE WEBHOOK
// ============================================

export const handleStripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret],
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          await handleCheckoutComplete(session);
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          await handleSubscriptionUpdate(subscription);
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await handleSubscriptionCanceled(subscription);
          break;
        }
        
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          await handlePaymentFailed(invoice);
          break;
        }
        
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          await handlePaymentSucceeded(invoice);
          break;
        }
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Helper: Handle successful checkout
async function handleCheckoutComplete(session) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  // Generate unique license key
  const licenseKey = `tm_live_${uuidv4()}`;
  const now = admin.firestore.Timestamp.now();
  
  // Calculate expiry (1 month from now)
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  // Create license document
  await db.collection('licenses').doc(licenseKey).set({
    userId: userId,
    plan: plan,
    status: 'active',
    createdAt: now,
    expiresAt: expiresAt,
    lastValidated: now,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId
  });

  // Update user document
  await db.collection('users').doc(userId).set({
    plan: plan,
    licenseKey: licenseKey,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: 'active',
    updatedAt: now
  }, { merge: true });

  console.log(`License ${licenseKey} created for user ${userId} on plan ${plan}`);
}

// Helper: Handle subscription update
async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata.userId;
  const plan = subscription.metadata.plan;
  const status = subscription.status;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Map Stripe status to our status
  let subscriptionStatus = 'active';
  if (status === 'past_due') subscriptionStatus = 'past_due';
  if (status === 'canceled' || status === 'unpaid') subscriptionStatus = 'canceled';

  await db.collection('users').doc(userId).update({
    plan: plan,
    subscriptionStatus: subscriptionStatus,
    updatedAt: admin.firestore.Timestamp.now()
  });

  // Update license status
  const userDoc = await db.collection('users').doc(userId).get();
  const licenseKey = userDoc.data()?.licenseKey;
  
  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      plan: plan,
      status: subscriptionStatus === 'active' ? 'active' : 'expired',
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}

// Helper: Handle subscription canceled
async function handleSubscriptionCanceled(subscription) {
  const userId = subscription.metadata.userId;
  
  if (!userId) return;

  const userDoc = await db.collection('users').doc(userId).get();
  const licenseKey = userDoc.data()?.licenseKey;

  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'canceled',
    updatedAt: admin.firestore.Timestamp.now()
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'expired',
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}

// Helper: Handle payment failed
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  
  // Find user by customer ID
  const usersSnapshot = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) return;

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const licenseKey = userDoc.data().licenseKey;

  // Set grace period (3 days)
  const gracePeriodEnd = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  );

  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'past_due',
    gracePeriodEnd: gracePeriodEnd,
    updatedAt: admin.firestore.Timestamp.now()
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'grace_period',
      gracePeriodEnd: gracePeriodEnd,
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}

// Helper: Handle payment succeeded
async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  
  const usersSnapshot = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) return;

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const licenseKey = userDoc.data().licenseKey;

  // Extend license by 1 month
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
    gracePeriodEnd: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.Timestamp.now()
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'active',
      expiresAt: expiresAt,
      gracePeriodEnd: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now()
    });
  }
}

// ============================================
// LICENSE VALIDATION (Called by CLI/MCP)
// ============================================

export const validateLicense = onRequest(
  {
    cors: true,
    maxInstances: 50
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        res.status(400).json({ 
          valid: false, 
          error: 'License key is required' 
        });
        return;
      }

      // Look up license
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();

      if (!licenseDoc.exists) {
        res.status(404).json({ 
          valid: false, 
          error: 'License key not found' 
        });
        return;
      }

      const license = licenseDoc.data();
      const now = new Date();
      const expiresAt = license.expiresAt.toDate();
      const gracePeriodEnd = license.gracePeriodEnd?.toDate();

      // Check if license is valid
      let isValid = false;
      let status = license.status;

      if (license.status === 'active') {
        isValid = true;
      } else if (license.status === 'grace_period' && gracePeriodEnd && now < gracePeriodEnd) {
        isValid = true;
        status = 'grace_period';
      } else if (license.status === 'expired' || license.status === 'revoked') {
        isValid = false;
      }

      // Update last validated timestamp
      await db.collection('licenses').doc(licenseKey).update({
        lastValidated: admin.firestore.Timestamp.now()
      });

      if (isValid) {
        const planDetails = PLAN_DETAILS[license.plan] || {};
        
        res.status(200).json({
          valid: true,
          status: status,
          plan: license.plan,
          planName: planDetails.name,
          tasksPerMonth: planDetails.tasksPerMonth,
          expiresAt: expiresAt.toISOString(),
          gracePeriodEnd: gracePeriodEnd?.toISOString() || null
        });
      } else {
        res.status(403).json({
          valid: false,
          status: license.status,
          error: license.status === 'revoked' 
            ? 'License has been revoked' 
            : 'License has expired. Please renew your subscription.'
        });
      }

    } catch (error) {
      console.error('Error validating license:', error);
      res.status(500).json({ 
        valid: false,
        error: 'Failed to validate license',
        details: error.message 
      });
    }
  }
);

// ============================================
// GET LICENSE INFO (For dashboard)
// ============================================

export const getLicenseInfo = onRequest(
  {
    cors: true,
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      // Get user document
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = userDoc.data();
      const licenseKey = userData.licenseKey;

      if (!licenseKey) {
        res.status(200).json({
          hasLicense: false,
          message: 'No active license. Please subscribe to a plan.'
        });
        return;
      }

      // Get license details
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      
      if (!licenseDoc.exists) {
        res.status(200).json({
          hasLicense: false,
          message: 'License not found. Please contact support.'
        });
        return;
      }

      const license = licenseDoc.data();
      const planDetails = PLAN_DETAILS[license.plan] || {};

      // Get subscription details from Stripe if available
      let currentPeriodEnd = null;
      let cancelAtPeriodEnd = false;
      
      if (userData.stripeSubscriptionId) {
        try {
          const stripe = new Stripe(stripeSecretKey.value());
          const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
          currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
          cancelAtPeriodEnd = subscription.cancel_at_period_end;
        } catch (stripeError) {
          console.error('Error fetching subscription from Stripe:', stripeError);
        }
      }

      res.status(200).json({
        hasLicense: true,
        licenseKey: licenseKey,
        plan: license.plan,
        planName: planDetails.name,
        planPrice: planDetails.price,
        tasksPerMonth: planDetails.tasksPerMonth,
        tasksUsed: userData.tasksUsed || 0,
        status: license.status,
        expiresAt: license.expiresAt.toDate().toISOString(),
        currentPeriodEnd: currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        subscriptionStatus: userData.subscriptionStatus
      });

    } catch (error) {
      console.error('Error getting license info:', error);
      res.status(500).json({ 
        error: 'Failed to get license info',
        details: error.message 
      });
    }
  }
);

// ============================================
// CANCEL SUBSCRIPTION
// ============================================

export const cancelSubscription = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey],
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = userDoc.data();
      const subscriptionId = userData.stripeSubscriptionId;

      if (!subscriptionId) {
        res.status(400).json({ error: 'No active subscription found' });
        return;
      }

      const stripe = new Stripe(stripeSecretKey.value());

      // Cancel at period end (user keeps access until subscription ends)
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      await db.collection('users').doc(userId).update({
        subscriptionStatus: 'canceling',
        updatedAt: admin.firestore.Timestamp.now()
      });

      res.status(200).json({
        success: true,
        message: 'Subscription will be canceled at the end of the billing period'
      });

    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ 
        error: 'Failed to cancel subscription',
        details: error.message 
      });
    }
  }
);

// ============================================
// GET USER CONFIG (API Keys + Models for CLI)
// ============================================

export const getUserConfig = onRequest(
  {
    cors: true,
    maxInstances: 50
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        res.status(400).json({ 
          success: false, 
          error: 'License key is required' 
        });
        return;
      }

      // First validate the license
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();

      if (!licenseDoc.exists) {
        res.status(404).json({ 
          success: false, 
          error: 'License key not found' 
        });
        return;
      }

      const license = licenseDoc.data();
      
      // Check if license is active
      if (license.status !== 'active' && license.status !== 'grace_period') {
        res.status(403).json({ 
          success: false, 
          error: 'License is not active' 
        });
        return;
      }

      const userId = license.userId;

      // Get user's API keys
      const apiKeysRef = db.collection('users').doc(userId).collection('apiKeys');
      const apiKeysSnapshot = await apiKeysRef.get();
      
      const apiKeys = {};
      apiKeysSnapshot.forEach((doc) => {
        const data = doc.data();
        // Return the full key if stored, otherwise just indicate it's set
        // Note: In production, you should encrypt keys at rest and decrypt here
        if (data.fullKey) {
          apiKeys[data.provider] = data.fullKey;
        }
      });

      // Get user's model config
      const modelsRef = db.collection('users').doc(userId).collection('settings').doc('models');
      const modelsDoc = await modelsRef.get();
      
      let models = null;
      if (modelsDoc.exists) {
        models = modelsDoc.data();
      }

      // Update last synced timestamp
      await db.collection('licenses').doc(licenseKey).update({
        lastConfigSync: admin.firestore.Timestamp.now()
      });

      res.status(200).json({
        success: true,
        config: {
          apiKeys,
          models,
          syncedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting user config:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get user config',
        details: error.message 
      });
    }
  }
);

// ============================================
// INCREMENT USAGE (Called by CLI after AI operations)
// ============================================

export const incrementUsage = onRequest(
  {
    cors: true,
    maxInstances: 100
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { licenseKey, operation, count = 1 } = req.body;

      if (!licenseKey) {
        res.status(400).json({ 
          success: false, 
          error: 'License key is required' 
        });
        return;
      }

      // Validate license
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();

      if (!licenseDoc.exists) {
        res.status(404).json({ 
          success: false, 
          error: 'License key not found' 
        });
        return;
      }

      const license = licenseDoc.data();
      
      if (license.status !== 'active' && license.status !== 'grace_period') {
        res.status(403).json({ 
          success: false, 
          error: 'License is not active' 
        });
        return;
      }

      const userId = license.userId;
      const userRef = db.collection('users').doc(userId);
      const now = admin.firestore.Timestamp.now();

      // Get current usage
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // Check if we need to reset monthly usage (based on subscription period)
      let currentTasksUsed = userData.tasksUsed || 0;
      const lastResetDate = userData.usageResetDate?.toDate();
      const currentPeriodEnd = userData.currentPeriodEnd?.toDate();
      
      // Reset if we're past the current period end
      if (currentPeriodEnd && new Date() > currentPeriodEnd) {
        currentTasksUsed = 0;
      }

      // Increment usage
      const newTasksUsed = currentTasksUsed + count;
      const planDetails = PLAN_DETAILS[license.plan] || {};
      const tasksPerMonth = planDetails.tasksPerMonth || 0;
      const isOverage = tasksPerMonth > 0 && newTasksUsed > tasksPerMonth;
      const overageCount = isOverage ? newTasksUsed - tasksPerMonth : 0;

      // Update user document
      await userRef.set({
        tasksUsed: newTasksUsed,
        lastTaskAt: now,
        updatedAt: now
      }, { merge: true });

      // Log usage event for analytics
      await db.collection('users').doc(userId).collection('usageLog').add({
        operation: operation || 'unknown',
        count: count,
        timestamp: now,
        licenseKey: licenseKey,
        totalAfter: newTasksUsed
      });

      res.status(200).json({
        success: true,
        usage: {
          tasksUsed: newTasksUsed,
          tasksPerMonth: tasksPerMonth,
          remaining: Math.max(0, tasksPerMonth - newTasksUsed),
          isOverage: isOverage,
          overageCount: overageCount,
          overageRate: planDetails.overageRate || 0
        }
      });

    } catch (error) {
      console.error('Error incrementing usage:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to increment usage',
        details: error.message 
      });
    }
  }
);

// ============================================
// GET USAGE STATS (For dashboard)
// ============================================

export const getUsageStats = onRequest(
  {
    cors: true,
    maxInstances: 50
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      // Get user data
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const userData = userDoc.data();
      const licenseKey = userData.licenseKey;

      if (!licenseKey) {
        res.status(200).json({
          hasLicense: false,
          message: 'No active license'
        });
        return;
      }

      // Get license details
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      const license = licenseDoc.exists ? licenseDoc.data() : {};
      const planDetails = PLAN_DETAILS[license.plan] || {};

      // Get recent usage log (last 30 entries)
      const usageLogRef = db.collection('users').doc(userId).collection('usageLog');
      const recentUsage = await usageLogRef
        .orderBy('timestamp', 'desc')
        .limit(30)
        .get();

      const usageLog = [];
      recentUsage.forEach(doc => {
        const data = doc.data();
        usageLog.push({
          operation: data.operation,
          count: data.count,
          timestamp: data.timestamp?.toDate()?.toISOString(),
          totalAfter: data.totalAfter
        });
      });

      // Get usage by operation type (for current period)
      const operationCounts = {};
      const allUsageRef = await usageLogRef.get();
      allUsageRef.forEach(doc => {
        const data = doc.data();
        const op = data.operation || 'unknown';
        operationCounts[op] = (operationCounts[op] || 0) + (data.count || 1);
      });

      // Calculate daily usage for the past 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const dailyUsage = {};
      allUsageRef.forEach(doc => {
        const data = doc.data();
        const date = data.timestamp?.toDate();
        if (date && date >= sevenDaysAgo) {
          const dateKey = date.toISOString().split('T')[0];
          dailyUsage[dateKey] = (dailyUsage[dateKey] || 0) + (data.count || 1);
        }
      });

      const tasksUsed = userData.tasksUsed || 0;
      const tasksPerMonth = planDetails.tasksPerMonth || 0;
      const isOverage = tasksPerMonth > 0 && tasksUsed > tasksPerMonth;

      res.status(200).json({
        success: true,
        stats: {
          tasksUsed: tasksUsed,
          tasksPerMonth: tasksPerMonth,
          remaining: Math.max(0, tasksPerMonth - tasksUsed),
          percentUsed: tasksPerMonth > 0 ? Math.round((tasksUsed / tasksPerMonth) * 100) : 0,
          isOverage: isOverage,
          overageCount: isOverage ? tasksUsed - tasksPerMonth : 0,
          overageRate: planDetails.overageRate || 0,
          estimatedOverageCost: isOverage ? (tasksUsed - tasksPerMonth) * (planDetails.overageRate || 0) : 0,
          lastTaskAt: userData.lastTaskAt?.toDate()?.toISOString() || null,
          plan: license.plan,
          planName: planDetails.name
        },
        operationBreakdown: operationCounts,
        dailyUsage: dailyUsage,
        recentActivity: usageLog.slice(0, 10)
      });

    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({ 
        error: 'Failed to get usage stats',
        details: error.message 
      });
    }
  }
);

// ============================================
// CREATE CUSTOMER PORTAL SESSION
// ============================================

export const createPortalSession = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey],
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId, returnUrl } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const customerId = userDoc.data().stripeCustomerId;

      if (!customerId) {
        res.status(400).json({ error: 'No Stripe customer found' });
        return;
      }

      const stripe = new Stripe(stripeSecretKey.value());

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || 'https://taskmaster.one/app/billing'
      });

      res.status(200).json({ url: session.url });

    } catch (error) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ 
        error: 'Failed to create portal session',
        details: error.message 
      });
    }
  }
);
