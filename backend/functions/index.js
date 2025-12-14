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

// Hosted API Keys (for PRO plan users) - stored as Firebase secrets
const hostedAnthropicKey = defineSecret('HOSTED_ANTHROPIC_API_KEY');
const hostedOpenaiKey = defineSecret('HOSTED_OPENAI_API_KEY');
const hostedGoogleKey = defineSecret('HOSTED_GOOGLE_API_KEY');
const hostedPerplexityKey = defineSecret('HOSTED_PERPLEXITY_API_KEY');
const hostedDeepseekKey = defineSecret('HOSTED_DEEPSEEK_API_KEY');
const hostedXaiKey = defineSecret('HOSTED_XAI_API_KEY');
const hostedOpenrouterKey = defineSecret('HOSTED_OPENROUTER_API_KEY');
const hostedMistralKey = defineSecret('HOSTED_MISTRAL_API_KEY');
const hostedMoonshotKey = defineSecret('HOSTED_MOONSHOT_API_KEY');
const hostedZhipuKey = defineSecret('HOSTED_ZHIPU_API_KEY');
const hostedOllamaKey = defineSecret('HOSTED_OLLAMA_API_KEY');

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
  plus: { name: 'Plus', price: 29, tasksPerMonth: 100, overageRate: 0.20 },
  pro: { name: 'Pro', price: 199, tasksPerMonth: 1000, overageRate: 0.15 },
  enterprise: { name: 'Enterprise', price: 599, tasksPerMonth: 5000, overageRate: 0.10 }
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
- Perplexity - Search, Reasoning, and Research models:
  - Search: sonar (lightweight), sonar-pro (advanced queries)
  - Reasoning: sonar-reasoning (problem-solving), sonar-reasoning-pro (DeepSeek-R1 powered)
  - Research: sonar-deep-research (expert-level comprehensive research)
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

## .taskmaster-ai/config.json
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
├── .taskmaster-ai/
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
  
  // Get plan details
  const planDetails = PLAN_DETAILS[plan] || {};
  
  // Calculate expiry (1 month from now)
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  // Create license document in licenses collection
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
    tasksUsed: 0,
    updatedAt: now
  }, { merge: true });

  // Create/update user's license subcollection for real-time frontend listening
  await db.collection('users').doc(userId).collection('license').doc('current').set({
    licenseKey: licenseKey,
    plan: plan,
    planName: planDetails.name || plan,
    planPrice: planDetails.price || 0,
    tasksPerMonth: planDetails.tasksPerMonth || 0,
    overageRate: planDetails.overageRate || 0,
    status: 'active',
    createdAt: now,
    expiresAt: expiresAt,
    currentPeriodEnd: expiresAt,
    cancelAtPeriodEnd: false,
    updatedAt: now
  });

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

  // Get plan details
  const planDetails = PLAN_DETAILS[plan] || {};
  const now = admin.firestore.Timestamp.now();

  // Map Stripe status to our status
  let subscriptionStatus = 'active';
  if (status === 'past_due') subscriptionStatus = 'past_due';
  if (status === 'canceled' || status === 'unpaid') subscriptionStatus = 'canceled';

  await db.collection('users').doc(userId).update({
    plan: plan,
    subscriptionStatus: subscriptionStatus,
    updatedAt: now
  });

  // Update license status
  const userDoc = await db.collection('users').doc(userId).get();
  const licenseKey = userDoc.data()?.licenseKey;
  
  if (licenseKey) {
    const licenseStatus = subscriptionStatus === 'active' ? 'active' : 'expired';
    
    await db.collection('licenses').doc(licenseKey).update({
      plan: plan,
      status: licenseStatus,
      updatedAt: now
    });

    // Update user's license subcollection
    await db.collection('users').doc(userId).collection('license').doc('current').update({
      plan: plan,
      planName: planDetails.name || plan,
      planPrice: planDetails.price || 0,
      tasksPerMonth: planDetails.tasksPerMonth || 0,
      overageRate: planDetails.overageRate || 0,
      status: licenseStatus,
      updatedAt: now
    });
  }
}

// Helper: Handle subscription canceled
async function handleSubscriptionCanceled(subscription) {
  const userId = subscription.metadata.userId;
  
  if (!userId) return;

  const now = admin.firestore.Timestamp.now();
  const userDoc = await db.collection('users').doc(userId).get();
  const licenseKey = userDoc.data()?.licenseKey;

  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'canceled',
    updatedAt: now
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'expired',
      updatedAt: now
    });

    // Update user's license subcollection
    await db.collection('users').doc(userId).collection('license').doc('current').update({
      status: 'expired',
      cancelAtPeriodEnd: true,
      updatedAt: now
    });
  }
}

// Helper: Handle payment failed
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const now = admin.firestore.Timestamp.now();
  
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
    updatedAt: now
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'grace_period',
      gracePeriodEnd: gracePeriodEnd,
      updatedAt: now
    });

    // Update user's license subcollection
    await db.collection('users').doc(userId).collection('license').doc('current').update({
      status: 'grace_period',
      gracePeriodEnd: gracePeriodEnd,
      updatedAt: now
    });
  }
}

// Helper: Handle payment succeeded
async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const now = admin.firestore.Timestamp.now();
  
  const usersSnapshot = await db.collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) return;

  const userDoc = usersSnapshot.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();
  const licenseKey = userData.licenseKey;
  const plan = userData.plan;
  const planDetails = PLAN_DETAILS[plan] || {};

  // Extend license by 1 month
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  // Reset tasks used on successful payment (new billing period)
  await db.collection('users').doc(userId).update({
    subscriptionStatus: 'active',
    tasksUsed: 0,
    usageResetDate: now,
    gracePeriodEnd: admin.firestore.FieldValue.delete(),
    updatedAt: now
  });

  if (licenseKey) {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'active',
      expiresAt: expiresAt,
      gracePeriodEnd: admin.firestore.FieldValue.delete(),
      updatedAt: now
    });

    // Update user's license subcollection
    await db.collection('users').doc(userId).collection('license').doc('current').update({
      status: 'active',
      expiresAt: expiresAt,
      currentPeriodEnd: expiresAt,
      tasksUsed: 0,
      cancelAtPeriodEnd: false,
      gracePeriodEnd: admin.firestore.FieldValue.delete(),
      updatedAt: now
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

      // SECURITY: Validate count is a positive integer
      const validatedCount = Math.max(1, Math.floor(Number(count) || 1));
      if (validatedCount > 1000) {
        res.status(400).json({
          success: false,
          error: 'Count cannot exceed 1000 per request'
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
      let needsPeriodUpdate = false;
      
      // SECURITY FIX: Only reset if past period end AND we haven't already reset for this period
      if (currentPeriodEnd && new Date() > currentPeriodEnd) {
        // Check if we already reset for this expired period
        const lastResetTime = lastResetDate?.getTime() || 0;
        const periodEndTime = currentPeriodEnd.getTime();
        
        // Only reset if we haven't reset since the period ended
        if (lastResetTime < periodEndTime) {
          currentTasksUsed = 0;
          needsPeriodUpdate = true;
          console.log(`Usage reset for user ${userId}: period ended ${currentPeriodEnd.toISOString()}`);
        }
      }

      // Increment usage with VALIDATED count
      const newTasksUsed = currentTasksUsed + validatedCount;
      const planDetails = PLAN_DETAILS[license.plan] || {};
      const tasksPerMonth = planDetails.tasksPerMonth || 0;
      const isOverage = tasksPerMonth > 0 && newTasksUsed > tasksPerMonth;
      const overageCount = isOverage ? newTasksUsed - tasksPerMonth : 0;

      // Update user document - include period reset tracking if needed
      const userUpdate = {
        tasksUsed: newTasksUsed,
        lastTaskAt: now,
        updatedAt: now
      };
      
      // If we reset the period, update the reset date
      if (needsPeriodUpdate) {
        userUpdate.usageResetDate = now;
        // Extend current period by 30 days from now
        userUpdate.currentPeriodEnd = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        );
      }
      
      await userRef.set(userUpdate, { merge: true });

      // Update user's license subcollection for real-time Dashboard updates
      // Using set with merge to handle cases where document might not exist
      const licenseUpdate = {
        tasksUsed: newTasksUsed,
        lastTaskAt: now,
        updatedAt: now
      };
      
      if (needsPeriodUpdate) {
        licenseUpdate.usageResetDate = now;
        licenseUpdate.currentPeriodEnd = userUpdate.currentPeriodEnd;
      }
      
      await db.collection('users').doc(userId).collection('license').doc('current').set(licenseUpdate, { merge: true });

      // Log usage event for analytics with validated count
      await db.collection('users').doc(userId).collection('usageLog').add({
        operation: operation || 'unknown',
        count: validatedCount,
        timestamp: now,
        licenseKey: licenseKey,
        totalAfter: newTasksUsed,
        wasReset: needsPeriodUpdate
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

// ============================================
// FIX MISSING LICENSES (Admin utility)
// Fixes customers who paid but webhook failed
// ============================================

export const fixMissingLicenses = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey],
    maxInstances: 1
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

    // Simple admin key check (you can make this more secure)
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    if (adminKey !== 'taskmaster-fix-licenses-2024') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const stripe = new Stripe(stripeSecretKey.value());
      const results = {
        checked: 0,
        fixed: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      // Find all users with stripeCustomerId but no licenseKey
      const usersSnapshot = await db.collection('users')
        .where('stripeCustomerId', '!=', null)
        .get();

      for (const userDoc of usersSnapshot.docs) {
        results.checked++;
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Skip if already has license
        if (userData.licenseKey) {
          results.skipped++;
          results.details.push({
            userId,
            email: userData.email,
            status: 'skipped',
            reason: 'Already has license'
          });
          continue;
        }

        try {
          // Get customer's subscriptions from Stripe
          const subscriptions = await stripe.subscriptions.list({
            customer: userData.stripeCustomerId,
            status: 'all',
            limit: 1
          });

          if (subscriptions.data.length === 0) {
            results.skipped++;
            results.details.push({
              userId,
              email: userData.email,
              status: 'skipped',
              reason: 'No subscriptions found'
            });
            continue;
          }

          const subscription = subscriptions.data[0];
          
          // Only fix active or trialing subscriptions
          if (!['active', 'trialing'].includes(subscription.status)) {
            results.skipped++;
            results.details.push({
              userId,
              email: userData.email,
              status: 'skipped',
              reason: `Subscription status: ${subscription.status}`
            });
            continue;
          }

          // Determine plan from subscription metadata or price
          let plan = subscription.metadata?.plan;
          
          if (!plan) {
            // Try to determine from price ID
            const priceId = subscription.items.data[0]?.price?.id;
            if (priceId === STRIPE_PRICES.plus) {
              plan = 'plus';
            } else if (priceId === STRIPE_PRICES.pro) {
              plan = 'pro';
            } else {
              plan = 'plus'; // Default to plus
            }
          }

          // Generate license key
          const licenseKey = `tm_live_${uuidv4()}`;
          const now = admin.firestore.Timestamp.now();
          const expiresAt = admin.firestore.Timestamp.fromDate(
            new Date(subscription.current_period_end * 1000)
          );

          // Create license document
          await db.collection('licenses').doc(licenseKey).set({
            userId: userId,
            plan: plan,
            status: 'active',
            createdAt: now,
            expiresAt: expiresAt,
            lastValidated: now,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: userData.stripeCustomerId,
            fixedByAdmin: true,
            fixedAt: now
          });

          // Update user document
          await db.collection('users').doc(userId).update({
            plan: plan,
            licenseKey: licenseKey,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: 'active',
            updatedAt: now
          });

          results.fixed++;
          results.details.push({
            userId,
            email: userData.email,
            status: 'fixed',
            licenseKey,
            plan,
            subscriptionId: subscription.id
          });

          console.log(`Fixed license for user ${userId}: ${licenseKey}`);

        } catch (userError) {
          results.errors.push({
            userId,
            email: userData.email,
            error: userError.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Fixed ${results.fixed} of ${results.checked} users`,
        results
      });

    } catch (error) {
      console.error('Error fixing licenses:', error);
      res.status(500).json({ 
        error: 'Failed to fix licenses',
        details: error.message 
      });
    }
  }
);

// ============================================================================
// DELETE ACCOUNT ENDPOINT
// ============================================================================

export const deleteAccount = onRequest(
  { 
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      const stripe = new Stripe(stripeSecretKey.value(), { apiVersion: '2024-04-10' });
      
      console.log(`Starting account deletion for user: ${userId}`);

      // 1. Get user data to find Stripe customer ID
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      // 2. Cancel Stripe subscription if exists
      if (userData?.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
          if (subscription && subscription.status !== 'canceled') {
            await stripe.subscriptions.cancel(userData.stripeSubscriptionId);
            console.log(`Canceled Stripe subscription: ${userData.stripeSubscriptionId}`);
          }
        } catch (stripeError) {
          // Subscription might already be canceled or not exist
          console.log(`Stripe subscription cancellation note: ${stripeError.message}`);
        }
      }

      // 3. Delete license document from licenses collection
      if (userData?.licenseKey) {
        try {
          await db.collection('licenses').doc(userData.licenseKey).delete();
          console.log(`Deleted license document: ${userData.licenseKey}`);
        } catch (licenseError) {
          console.log(`License deletion note: ${licenseError.message}`);
        }
      }

      // 4. Delete user's license subcollection
      try {
        const licenseSubcollection = await db.collection('users').doc(userId).collection('license').get();
        const batch = db.batch();
        licenseSubcollection.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted user license subcollection`);
      } catch (subError) {
        console.log(`License subcollection deletion note: ${subError.message}`);
      }

      // 5. Delete user's API keys subcollection
      try {
        const apiKeysSubcollection = await db.collection('users').doc(userId).collection('apiKeys').get();
        const batch = db.batch();
        apiKeysSubcollection.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted user API keys subcollection`);
      } catch (subError) {
        console.log(`API keys subcollection deletion note: ${subError.message}`);
      }

      // 6. Delete user's usage logs subcollection
      try {
        const usageLogsSubcollection = await db.collection('users').doc(userId).collection('usageLogs').get();
        const batch = db.batch();
        usageLogsSubcollection.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted user usage logs subcollection`);
      } catch (subError) {
        console.log(`Usage logs subcollection deletion note: ${subError.message}`);
      }

      // 7. Delete user document from Firestore
      await db.collection('users').doc(userId).delete();
      console.log(`Deleted user document: ${userId}`);

      // 8. Delete Firebase Auth user
      try {
        await admin.auth().deleteUser(userId);
        console.log(`Deleted Firebase Auth user: ${userId}`);
      } catch (authError) {
        console.error(`Error deleting Firebase Auth user: ${authError.message}`);
        // Continue anyway - Firestore data is already deleted
      }

      console.log(`Account deletion completed for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ 
        error: 'Failed to delete account',
        details: error.message 
      });
    }
  }
);

// ============================================
// TASK SYNC ENDPOINTS
// Sync tasks between CLI and web dashboard
// ============================================

/**
 * Sync tasks from CLI to Firestore
 * Called by CLI after any task changes
 */
export const syncTasks = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { licenseKey, projectId, tasks, tag, metadata } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
      }

      if (!tasks) {
        return res.status(400).json({ error: 'Tasks data is required' });
      }

      // Validate license and get user
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      if (!licenseDoc.exists) {
        return res.status(401).json({ error: 'Invalid license key' });
      }

      const licenseData = licenseDoc.data();
      if (licenseData.status !== 'active' && licenseData.status !== 'grace_period') {
        return res.status(401).json({ error: 'License is not active' });
      }

      const userId = licenseData.userId;
      const projectName = projectId || 'default';
      const tagName = tag || 'master';

      // Store tasks in Firestore under user's projects subcollection
      const projectRef = db.collection('users').doc(userId)
        .collection('projects').doc(projectName);

      await projectRef.set({
        name: projectName,
        lastSynced: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Store tasks for this tag
      await projectRef.collection('tags').doc(tagName).set({
        tasks: tasks,
        metadata: metadata || {},
        syncedAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Calculate stats
      const taskStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        done: tasks.filter(t => t.status === 'done').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
      };

      // Update project stats
      await projectRef.update({
        [`stats.${tagName}`]: taskStats,
      });

      console.log(`Synced ${tasks.length} tasks for user ${userId}, project ${projectName}, tag ${tagName}`);

      res.status(200).json({
        success: true,
        message: 'Tasks synced successfully',
        stats: taskStats,
        syncedAt: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error syncing tasks:', error);
      res.status(500).json({ 
        error: 'Failed to sync tasks',
        details: error.message 
      });
    }
  }
);

/**
 * Get tasks from Firestore
 * Called by web dashboard to display tasks
 */
export const getTasks = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Support both query params (GET) and body (POST)
      const licenseKey = req.query.licenseKey || req.body?.licenseKey;
      const projectId = req.query.projectId || req.body?.projectId || 'default';
      const tag = req.query.tag || req.body?.tag || 'master';

      if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
      }

      // Validate license and get user
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      if (!licenseDoc.exists) {
        return res.status(401).json({ error: 'Invalid license key' });
      }

      const licenseData = licenseDoc.data();
      const userId = licenseData.userId;

      // Get tasks from Firestore
      const tagDoc = await db.collection('users').doc(userId)
        .collection('projects').doc(projectId)
        .collection('tags').doc(tag).get();

      if (!tagDoc.exists) {
        return res.status(200).json({
          success: true,
          tasks: [],
          metadata: {},
          syncedAt: null,
        });
      }

      const tagData = tagDoc.data();

      res.status(200).json({
        success: true,
        tasks: tagData.tasks || [],
        metadata: tagData.metadata || {},
        syncedAt: tagData.syncedAt,
      });

    } catch (error) {
      console.error('Error getting tasks:', error);
      res.status(500).json({ 
        error: 'Failed to get tasks',
        details: error.message 
      });
    }
  }
);

/**
 * Get all projects for a user
 */
export const getProjects = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const licenseKey = req.query.licenseKey || req.body?.licenseKey;

      if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
      }

      // Validate license and get user
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      if (!licenseDoc.exists) {
        return res.status(401).json({ error: 'Invalid license key' });
      }

      const licenseData = licenseDoc.data();
      const userId = licenseData.userId;

      // Get all projects
      const projectsSnapshot = await db.collection('users').doc(userId)
        .collection('projects').get();

      const projects = [];
      for (const doc of projectsSnapshot.docs) {
        const projectData = doc.data();
        
        // Get tags for this project
        const tagsSnapshot = await doc.ref.collection('tags').get();
        const tags = tagsSnapshot.docs.map(tagDoc => ({
          name: tagDoc.id,
          taskCount: tagDoc.data().tasks?.length || 0,
          syncedAt: tagDoc.data().syncedAt,
        }));

        projects.push({
          id: doc.id,
          name: projectData.name || doc.id,
          lastSynced: projectData.lastSynced,
          stats: projectData.stats || {},
          tags,
        });
      }

      res.status(200).json({
        success: true,
        projects,
      });

    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({ 
        error: 'Failed to get projects',
        details: error.message 
      });
    }
  }
);

// ============================================
// RATE LIMITING & SECURITY HELPERS
// ============================================

// Rate limit configuration
const RATE_LIMITS = {
  hostedKeysAccess: {
    maxRequests: 10,      // Max key fetches per window
    windowMs: 60 * 1000,  // 1 minute window
  },
  hostedKeyUsage: {
    maxRequests: 100,     // Max AI operations per hour using hosted keys
    windowMs: 60 * 60 * 1000,  // 1 hour window
  },
  dailyHostedUsage: {
    maxRequests: 500,     // Max AI operations per day using hosted keys
    windowMs: 24 * 60 * 60 * 1000,  // 24 hour window
  }
};

/**
 * Check and update rate limit for a user
 * @param {string} userId - User ID
 * @param {string} limitType - Type of rate limit to check
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: Date }
 */
async function checkRateLimit(userId, limitType) {
  const config = RATE_LIMITS[limitType];
  if (!config) {
    return { allowed: true, remaining: 999, resetAt: null };
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  const rateLimitRef = db.collection('rateLimits').doc(`${userId}_${limitType}`);
  
  try {
    const doc = await rateLimitRef.get();
    const data = doc.exists ? doc.data() : null;
    
    // If no data or window expired, reset
    if (!data || data.windowStart < windowStart) {
      await rateLimitRef.set({
        userId,
        limitType,
        count: 1,
        windowStart: now,
        updatedAt: admin.firestore.Timestamp.now()
      });
      return { 
        allowed: true, 
        remaining: config.maxRequests - 1, 
        resetAt: new Date(now + config.windowMs) 
      };
    }
    
    // Check if limit exceeded
    if (data.count >= config.maxRequests) {
      const resetAt = new Date(data.windowStart + config.windowMs);
      return { 
        allowed: false, 
        remaining: 0, 
        resetAt,
        retryAfterMs: resetAt.getTime() - now
      };
    }
    
    // Increment count
    await rateLimitRef.update({
      count: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    return { 
      allowed: true, 
      remaining: config.maxRequests - data.count - 1, 
      resetAt: new Date(data.windowStart + config.windowMs) 
    };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow but log
    return { allowed: true, remaining: 999, resetAt: null, error: true };
  }
}

/**
 * Log security event for audit trail
 */
async function logSecurityEvent(userId, eventType, details) {
  try {
    await db.collection('securityLogs').add({
      userId,
      eventType,
      details,
      timestamp: admin.firestore.Timestamp.now(),
      ip: details.ip || 'unknown'
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// ============================================
// GET HOSTED API KEYS (PRO Plan Only)
// Returns hosted API keys for PRO plan subscribers
// WITH RATE LIMITING & SECURITY
// ============================================

export const getHostedApiKeys = onRequest(
  {
    cors: true,
    secrets: [
      hostedAnthropicKey,
      hostedOpenaiKey,
      hostedGoogleKey,
      hostedPerplexityKey,
      hostedDeepseekKey,
      hostedXaiKey,
      hostedOpenrouterKey,
      hostedMistralKey,
      hostedMoonshotKey,
      hostedZhipuKey,
      hostedOllamaKey
    ],
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

    // Get client IP for logging
    const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        res.status(400).json({ 
          success: false, 
          error: 'License key is required' 
        });
        return;
      }

      // Validate the license
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();

      if (!licenseDoc.exists) {
        // Log suspicious activity - invalid license attempts
        await logSecurityEvent('unknown', 'invalid_license_attempt', {
          licenseKey: licenseKey.substring(0, 10) + '...',
          ip: clientIp
        });
        res.status(404).json({ 
          success: false, 
          error: 'License key not found' 
        });
        return;
      }

      const license = licenseDoc.data();
      const userId = license.userId;
      
      // Check if license is active
      if (license.status !== 'active' && license.status !== 'grace_period') {
        res.status(403).json({ 
          success: false, 
          error: 'License is not active' 
        });
        return;
      }

      // CRITICAL: Only PRO plan users get hosted API keys
      if (license.plan !== 'pro') {
        res.status(403).json({ 
          success: false, 
          error: 'Hosted API keys are only available for Pro plan subscribers',
          upgrade: true,
          currentPlan: license.plan
        });
        return;
      }

      // ===== RATE LIMITING =====
      const rateCheck = await checkRateLimit(userId, 'hostedKeysAccess');
      
      if (!rateCheck.allowed) {
        // Log rate limit hit
        await logSecurityEvent(userId, 'rate_limit_exceeded', {
          limitType: 'hostedKeysAccess',
          ip: clientIp
        });
        
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Too many requests.',
          retryAfterMs: rateCheck.retryAfterMs,
          resetAt: rateCheck.resetAt?.toISOString()
        });
        return;
      }

      // ===== CHECK FOR ABUSE PATTERNS =====
      // Check if user has exceeded daily usage limits
      const dailyCheck = await checkRateLimit(userId, 'dailyHostedUsage');
      if (!dailyCheck.allowed) {
        await logSecurityEvent(userId, 'daily_limit_exceeded', {
          ip: clientIp
        });
        res.status(429).json({
          success: false,
          error: 'Daily hosted API usage limit exceeded. Resets at midnight UTC.',
          resetAt: dailyCheck.resetAt?.toISOString()
        });
        return;
      }

      // Build the hosted API keys object
      const hostedKeys = {};

      try {
        const anthropicValue = hostedAnthropicKey.value();
        if (anthropicValue) hostedKeys.anthropic = anthropicValue;
      } catch (e) { /* Key not configured */ }

      try {
        const openaiValue = hostedOpenaiKey.value();
        if (openaiValue) hostedKeys.openai = openaiValue;
      } catch (e) { /* Key not configured */ }

      try {
        const googleValue = hostedGoogleKey.value();
        if (googleValue) hostedKeys.google = googleValue;
      } catch (e) { /* Key not configured */ }

      try {
        const perplexityValue = hostedPerplexityKey.value();
        if (perplexityValue) hostedKeys.perplexity = perplexityValue;
      } catch (e) { /* Key not configured */ }

      try {
        const deepseekValue = hostedDeepseekKey.value();
        if (deepseekValue) hostedKeys.deepseek = deepseekValue;
      } catch (e) { /* Key not configured */ }

      try {
        const xaiValue = hostedXaiKey.value();
        if (xaiValue) hostedKeys.xai = xaiValue;
      } catch (e) { /* Key not configured */ }

      try {
        const openrouterValue = hostedOpenrouterKey.value();
        if (openrouterValue) hostedKeys.openrouter = openrouterValue;
      } catch (e) { /* Key not configured */ }

      try {
        const mistralValue = hostedMistralKey.value();
        if (mistralValue) hostedKeys.mistral = mistralValue;
      } catch (e) { /* Key not configured */ }

      try {
        const moonshotValue = hostedMoonshotKey.value();
        if (moonshotValue) hostedKeys.moonshot = moonshotValue;
      } catch (e) { /* Key not configured */ }

      try {
        const zhipuValue = hostedZhipuKey.value();
        if (zhipuValue) hostedKeys.zhipu = zhipuValue;
      } catch (e) { /* Key not configured */ }

      try {
        const ollamaValue = hostedOllamaKey.value();
        if (ollamaValue) hostedKeys.ollama = ollamaValue;
      } catch (e) { /* Key not configured */ }

      // Log access for audit
      console.log(`Hosted API keys accessed by user ${userId}, plan: ${license.plan}, providers: ${Object.keys(hostedKeys).join(', ')}`);

      // Update license with access info
      await db.collection('licenses').doc(licenseKey).update({
        lastHostedKeysAccess: admin.firestore.Timestamp.now(),
        hostedKeysAccessCount: admin.firestore.FieldValue.increment(1)
      });

      res.status(200).json({
        success: true,
        hostedKeys,
        providers: Object.keys(hostedKeys),
        plan: license.plan,
        fetchedAt: new Date().toISOString(),
        rateLimit: {
          remaining: rateCheck.remaining,
          resetAt: rateCheck.resetAt?.toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting hosted API keys:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get hosted API keys',
        details: error.message 
      });
    }
  }
);

// ============================================
// TRACK HOSTED KEY USAGE
// Called by CLI when using hosted keys for AI operations
// ============================================

export const trackHostedKeyUsage = onRequest(
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

    const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

    try {
      const { licenseKey, provider, operation, inputTokens, outputTokens } = req.body;

      if (!licenseKey || !provider) {
        res.status(400).json({ 
          success: false, 
          error: 'License key and provider are required' 
        });
        return;
      }

      // Validate license
      const licenseDoc = await db.collection('licenses').doc(licenseKey).get();
      if (!licenseDoc.exists) {
        res.status(404).json({ success: false, error: 'Invalid license' });
        return;
      }

      const license = licenseDoc.data();
      const userId = license.userId;

      // Verify PRO plan
      if (license.plan !== 'pro') {
        res.status(403).json({ 
          success: false, 
          error: 'Hosted keys require Pro plan' 
        });
        return;
      }

      // Check hourly rate limit
      const hourlyCheck = await checkRateLimit(userId, 'hostedKeyUsage');
      if (!hourlyCheck.allowed) {
        await logSecurityEvent(userId, 'hourly_usage_limit', {
          provider,
          ip: clientIp
        });
        res.status(429).json({
          success: false,
          error: 'Hourly hosted API usage limit exceeded',
          resetAt: hourlyCheck.resetAt?.toISOString()
        });
        return;
      }

      // Check daily rate limit
      const dailyCheck = await checkRateLimit(userId, 'dailyHostedUsage');
      if (!dailyCheck.allowed) {
        res.status(429).json({
          success: false,
          error: 'Daily hosted API usage limit exceeded',
          resetAt: dailyCheck.resetAt?.toISOString()
        });
        return;
      }

      const now = admin.firestore.Timestamp.now();

      // Log the usage
      await db.collection('users').doc(userId).collection('hostedKeyUsage').add({
        provider,
        operation: operation || 'unknown',
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        totalTokens: (inputTokens || 0) + (outputTokens || 0),
        timestamp: now,
        ip: clientIp
      });

      // Update user's hosted usage stats
      await db.collection('users').doc(userId).set({
        hostedKeyStats: {
          totalOperations: admin.firestore.FieldValue.increment(1),
          totalTokens: admin.firestore.FieldValue.increment((inputTokens || 0) + (outputTokens || 0)),
          lastUsed: now,
          [`providers.${provider}`]: admin.firestore.FieldValue.increment(1)
        }
      }, { merge: true });

      // Update license subcollection for dashboard display
      await db.collection('users').doc(userId).collection('license').doc('current').set({
        hostedKeyStats: {
          totalOperations: admin.firestore.FieldValue.increment(1),
          lastUsed: now
        }
      }, { merge: true });

      res.status(200).json({
        success: true,
        rateLimit: {
          hourly: {
            remaining: hourlyCheck.remaining,
            resetAt: hourlyCheck.resetAt?.toISOString()
          },
          daily: {
            remaining: dailyCheck.remaining,
            resetAt: dailyCheck.resetAt?.toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Error tracking hosted key usage:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to track usage'
      });
    }
  }
);

// ============================================
// GET HOSTED KEY USAGE STATS
// For dashboard display
// ============================================

export const getHostedKeyStats = onRequest(
  {
    cors: true,
    maxInstances: 20
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
      
      // Check if user is on PRO plan
      if (userData.plan !== 'pro') {
        res.status(200).json({
          success: true,
          available: false,
          message: 'Hosted API keys are available on Pro plan'
        });
        return;
      }

      // Get recent usage (last 50 entries)
      const usageSnapshot = await db.collection('users').doc(userId)
        .collection('hostedKeyUsage')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const recentUsage = [];
      usageSnapshot.forEach(doc => {
        const data = doc.data();
        recentUsage.push({
          provider: data.provider,
          operation: data.operation,
          tokens: data.totalTokens,
          timestamp: data.timestamp?.toDate()?.toISOString()
        });
      });

      // Get current rate limits
      const hourlyLimit = await checkRateLimit(userId, 'hostedKeyUsage');
      const dailyLimit = await checkRateLimit(userId, 'dailyHostedUsage');

      // Calculate provider breakdown
      const providerBreakdown = {};
      recentUsage.forEach(usage => {
        providerBreakdown[usage.provider] = (providerBreakdown[usage.provider] || 0) + 1;
      });

      res.status(200).json({
        success: true,
        available: true,
        stats: userData.hostedKeyStats || {},
        recentUsage: recentUsage.slice(0, 10),
        providerBreakdown,
        rateLimits: {
          hourly: {
            limit: RATE_LIMITS.hostedKeyUsage.maxRequests,
            remaining: hourlyLimit.remaining,
            resetAt: hourlyLimit.resetAt?.toISOString()
          },
          daily: {
            limit: RATE_LIMITS.dailyHostedUsage.maxRequests,
            remaining: dailyLimit.remaining,
            resetAt: dailyLimit.resetAt?.toISOString()
          }
        },
        providers: ['anthropic', 'openai', 'google', 'perplexity', 'deepseek', 'xai', 'openrouter', 'mistral', 'moonshot', 'zhipu']
      });

    } catch (error) {
      console.error('Error getting hosted key stats:', error);
      res.status(500).json({ 
        error: 'Failed to get stats',
        details: error.message 
      });
    }
  }
);

// Setup PRO License (for testing purposes)
export const setupProLicense = onRequest(
  { 
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    try {
      const { email, userId, setPassword } = req.body;

      if (!email && !userId) {
        return res.status(400).json({ 
          error: 'Email or userId required',
          message: 'Provide either email or userId in request body'
        });
      }

      let targetUserId = userId;
      let targetEmail = email;

      // If email provided, find user
      if (email && !userId) {
        const usersSnapshot = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();

        if (usersSnapshot.empty) {
          return res.status(404).json({ 
            error: 'User not found',
            message: `No user found with email: ${email}`
          });
        }

        targetUserId = usersSnapshot.docs[0].id;
        targetEmail = email;
      } else if (userId) {
        // Get email from user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists()) {
          targetEmail = userDoc.data().email;
        }
      }

      // Set password if requested (for testing)
      if (setPassword) {
        try {
          await admin.auth().updateUser(targetUserId, {
            password: setPassword
          });
          console.log(`✅ Password updated for user: ${targetUserId}`);
        } catch (error) {
          console.log(`⚠️ Could not update password: ${error.message}`);
          // Continue anyway - license setup is more important
        }
      }

      // Update user document to PRO
      await db.collection('users').doc(targetUserId).update({
        plan: 'pro',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create license document
      const now = new Date();
      const monthFromNow = new Date(now);
      monthFromNow.setMonth(monthFromNow.getMonth() + 1);

      const licenseKey = `tm_live_${uuidv4().replace(/-/g, '')}`;

      // License data for user subcollection (used by web app)
      const userLicenseData = {
        hasLicense: true,
        plan: 'pro',
        planName: 'Pro',
        planPrice: 199,
        status: 'active',
        tasksPerMonth: 1000,
        tasksUsed: 0,
        overageRate: 0.15,
        licenseKey: licenseKey,
        currentPeriodStart: admin.firestore.Timestamp.fromDate(now),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(monthFromNow),
        cancelAtPeriodEnd: false,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      };

      // License data for global licenses collection (used by CLI)
      const globalLicenseData = {
        userId: targetUserId,
        email: email || null,
        plan: 'pro',
        status: 'active',
        expiresAt: admin.firestore.Timestamp.fromDate(monthFromNow),
        gracePeriodEnd: null,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        lastValidated: admin.firestore.Timestamp.fromDate(now),
      };

      // Create both license documents:
      // 1. User subcollection (for web app)
      await db.collection('users')
        .doc(targetUserId)
        .collection('license')
        .doc('current')
        .set(userLicenseData, { merge: true });

      // 2. Global licenses collection (for CLI validation)
      await db.collection('licenses')
        .doc(licenseKey)
        .set(globalLicenseData, { merge: true });

      console.log(`✅ PRO license set up for user: ${targetUserId}`);
      console.log(`   Web app license: /users/${targetUserId}/license/current`);
      console.log(`   CLI license: /licenses/${licenseKey}`);

      res.status(200).json({
        success: true,
        message: 'PRO license setup complete',
        userId: targetUserId,
        email: targetEmail || 'N/A',
        passwordUpdated: !!setPassword,
        license: {
          plan: 'Pro',
          status: 'active',
          tasksPerMonth: 1000,
          licenseKey: licenseKey,
          currentPeriodEnd: monthFromNow.toISOString()
        },
        cliLogin: setPassword ? {
          message: 'You can now login with:',
          command: `taskmaster login --email ${targetEmail} --password ${setPassword}`
        } : null
      });

    } catch (error) {
      console.error('Error setting up PRO license:', error);
      res.status(500).json({ 
        error: 'Failed to setup license',
        details: error.message 
      });
    }
  }
);

// Get User License (for CLI login flow)
export const getUserLicense = onRequest(
  { 
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false,
          error: 'Authentication required' 
        });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      // Verify the token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid authentication token' 
        });
      }

      const userId = req.body.userId || decodedToken.uid;

      // Verify the user is requesting their own license
      if (userId !== decodedToken.uid) {
        return res.status(403).json({ 
          success: false,
          error: 'Cannot access another user\'s license' 
        });
      }

      // Get license from user's subcollection
      const licenseDoc = await db.collection('users')
        .doc(userId)
        .collection('license')
        .doc('current')
        .get();

      if (!licenseDoc.exists) {
        return res.status(404).json({ 
          success: false,
          error: 'No license found. Please subscribe to a plan.' 
        });
      }

      const license = licenseDoc.data();

      // Check if license is active
      if (license.status !== 'active') {
        return res.status(403).json({ 
          success: false,
          error: `License is ${license.status}. Please check your subscription.` 
        });
      }

      res.status(200).json({
        success: true,
        licenseKey: license.licenseKey,
        plan: license.plan,
        planName: license.planName || 'Pro',
        tasksPerMonth: license.tasksPerMonth || 1000,
        status: license.status,
        expiresAt: license.currentPeriodEnd?.toDate()?.toISOString(),
        userId: userId
      });

    } catch (error) {
      console.error('Error getting user license:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get license',
        details: error.message 
      });
    }
  }
);
