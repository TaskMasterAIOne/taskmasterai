// Static markdown text for all documentation - used for copy functionality
// This is the complete TaskMaster AI documentation in plain text format

export const ALL_DOCS_TEXT = `# TaskMaster AI Documentation

## Introduction

Welcome to v1 of the TaskMaster AI Docs. Expect weekly updates as we expand and refine each section.

We've organized the docs into three sections depending on your experience level and goals:

### Getting Started - Quick Start
Designed for first-time users. Get set up, configure your subscription, create your first PRD, and run your first task.

### Best Practices
Covers common workflows, strategic usage of commands, model configuration tips, and real-world usage patterns. Recommended for active subscribers.

### Technical Capabilities
A detailed glossary of every root command and available capability — meant for power users and contributors.

---

## Quick Start

This guide is for new subscribers who want to start using TaskMaster AI with minimal setup time. Make sure you have an active subscription before proceeding.

It covers:
- Requirements: You will need Node.js, an active subscription, and an AI model API Key.
- Installation: How to install and activate TaskMaster AI.
- Configuration: Setting up your API Key, MCP, and subscription.
- PRD: Writing and parsing your first PRD.
- Task Setup: Preparing your tasks for execution.
- Executing Tasks: Using TaskMaster AI to execute tasks.
- Rules & Context: Learn how and why to build context in your project over time.

By the end of this guide, you'll have everything you need to begin working productively with TaskMaster AI. Each task processed counts toward your monthly plan limit.

---

## Requirements

Before you can start using TaskMaster AI, you'll need an active subscription, Node.js installed, and at least one model API Key configured.

TaskMaster AI requires an active subscription. Plans start at $29/month for Plus. Visit the Pricing page to choose a plan.

### 1. Node.js

TaskMaster AI is built with Node.js and requires it to run. npm (Node Package Manager) comes bundled with Node.js.

**Install Node.js**

Option 1: Download from official website
1. Visit nodejs.org
2. Download the LTS (Long Term Support) version for your operating system
3. Run the installer and follow the setup wizard

Option 2: Use a package manager
\`\`\`bash
# macOS (using Homebrew)
brew install node

# Windows (using Chocolatey)
choco install nodejs

# Windows (using winget)
winget install OpenJS.NodeJS.LTS
\`\`\`

### 2. Model API Key

TaskMaster AI utilizes AI across several commands, and those require a separate API key. For the purpose of a Quick Start we recommend setting up an API Key with Anthropic for your main model and Perplexity for your ask model (optional but recommended).

TaskMaster AI shows API costs per command used. Most users load $5-10 on their keys and don't have to top it off for a few months.

At least one (1) of the following is required:
1. Anthropic API key (Claude API) - recommended for Quick Start
2. OpenAI API key
3. Google Gemini API key
4. Perplexity API key (for ask model)
5. xAI API Key (for ask or main model)
6. OpenRouter API Key (for ask or main model)
7. Claude Code (no API key required - requires Claude Code CLI)

---

## Installation

Now that you have an active subscription, Node.js, and your first API Key, you are ready to begin installing TaskMaster AI.

**Subscription Required:** Make sure you have an active TaskMaster AI subscription before installing.

### Quick Install for Cursor 1.0+ (One-Click)

Use the deep link or copy this URL into your browser:
\`\`\`
cursor://anysphere.cursor-deeplink/mcp/install?name=taskmasterai&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB0YXNrbWFzdGVyYWkvY2xpIiwidGFza21hc3Rlci1tY3AiXSwiZW52Ijp7IkFOVEhST1BJQ19BUElfS0VZIjoiWU9VUl9BTlRIUk9QSUNfQVBJX0tFWV9IRVJFIiwiUEVSUExFWElUWV9BUElfS0VZIjoiWU9VUl9QRVJQTEVYSVRZX0FQSV9LRVlfSEVSRSIsIk9QRU5BSV9BUElfS0VZIjoiWU9VUl9PUEVOQUlfS0VZX0hFUkUiLCJHT09HTEVfQVBJX0tFWSI6IllPVVJfR09PR0xFX0tFWV9IRVJFIiwiTUlTVFJBTF9BUElfS0VZIjoiWU9VUl9NSVNUUkFMX0tFWV9IRVJFIiwiT1BFTlJPVVRFUl9BUElfS0VZIjoiWU9VUl9PUEVOUk9VVEVSX0tFWV9IRVJFIiwiWEFJX0FQSV9LRVkiOiJZT1VSX1hBSV9LRVlfSEVSRSJ9fQ==
\`\`\`

After clicking the link, you'll still need to add your API keys to the configuration.

### Claude Code Quick Install

For Claude Code users:
\`\`\`bash
claude mcp add taskmasterai -- npx -y @taskmasterai/cli taskmaster-mcp
\`\`\`

Don't forget to add your API keys to the configuration:
- in the root .env of your Project
- in the "env" section of your mcp config for taskmasterai

### Option 1: MCP (Recommended)

MCP (Model Control Protocol) lets you run TaskMaster AI directly from your editor.

Add your MCP config at the following path depending on your editor:

| Editor | Scope | Linux/macOS Path | Windows Path |
|--------|-------|------------------|--------------|
| Cursor | Global | ~/.cursor/mcp.json | %USERPROFILE%\\.cursor\\mcp.json |
| Cursor | Project | <project_folder>/.cursor/mcp.json | <project_folder>\\.cursor\\mcp.json |
| Windsurf | Global | ~/.codeium/windsurf/mcp_config.json | %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json |
| VS Code | Project | <project_folder>/.vscode/mcp.json | <project_folder>\\.vscode\\mcp.json |

**Manual Configuration (Cursor & Windsurf):**
\`\`\`json
{
  "mcpServers": {
    "taskmasterai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "taskmaster-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE"
      }
    }
  }
}
\`\`\`

Replace YOUR_*_KEY_HERE with your real API keys. You can remove keys you don't use.

### Option 2: Using Command Line

**Step 1: CLI Installation**
\`\`\`bash
# Install globally (recommended)
npm install -g @taskmasterai/cli

# OR install locally within your project
npm install @taskmasterai/cli
\`\`\`

**Step 2: Login to TaskMaster AI**

The CLI now uses secure authentication - no more manual license key copying!

\`\`\`bash
# Login with email & password
taskmaster login

# Or login with Google
taskmaster login --google

# Or provide credentials directly
taskmaster login --email your@email.com --password yourpassword

# Check login status
taskmaster whoami
\`\`\`

When you login:
✓ Your identity is verified
✓ Your license is automatically fetched and activated
✓ Your API keys are synced from the dashboard (if you're Plus)
✓ Hosted API keys are configured (if you're Pro/Enterprise)

**Step 3: Initialize a New Project**

The init command now includes a beautiful auth check:

\`\`\`bash
# Initialize (will prompt to login if needed)
taskmaster init
\`\`\`

The init flow will:
1. Check if you're logged in
2. Verify your active license
3. Show your plan and remaining tasks
4. Set up your project structure

**Step 4: Start Building**
\`\`\`bash
# If installed globally
taskmaster init

# If installed locally
npx taskmaster init

# Initialize project with specific rules
taskmaster init --rules cursor,windsurf,vscode
\`\`\`

### License Management

| Command | Description |
|---------|-------------|
| taskmaster login | Login with email/password or Google |
| taskmaster login --google | Login with Google account |
| taskmaster whoami | Show current user and license status |
| taskmaster logout | Logout and clear session |
| taskmaster license | Show current license status and plan details |
| taskmaster usage | View AI operations usage and remaining limits |
| taskmaster sync-keys | Sync API keys and model config from your dashboard |

---

## Authentication & Security

TaskMaster AI CLI uses secure Firebase authentication to verify your identity and ensure only you can access your license and API keys.

### Login Methods

**Option 1: Email & Password**
\`\`\`bash
# Interactive login
taskmaster login

# Or provide credentials directly
taskmaster login --email your@email.com --password yourpassword
\`\`\`

**Option 2: Google Account**
\`\`\`bash
# Opens browser for Google OAuth
taskmaster login --google
\`\`\`

### Session Management

Your login session is stored securely in \`~/.taskmaster-ai/auth.json\` and automatically refreshes tokens as needed.

\`\`\`bash
# Check who's logged in
taskmaster whoami

# Logout
taskmaster logout
\`\`\`

### Security Features

✓ **Token Auto-Refresh** - Tokens automatically refresh before expiring
✓ **Secure Storage** - Auth data stored in your home directory
✓ **License Verification** - Only the license owner can activate
✓ **API Key Sync** - Encrypted keys synced from dashboard
✓ **Hosted Keys (Pro/Enterprise)** - No key management needed

### What Happens on Login?

1. ✓ Your credentials are verified with Firebase
2. ✓ Your license is fetched from your account
3. ✓ License is automatically activated locally
4. ✓ API keys are synced (Plus users)
5. ✓ Hosted API keys are configured (Pro/Enterprise users)

---

## Configuration

After installation you must set up MCP connection then API keys, and restart your editor.

**MCP Connection Requirements**
- Your mcp.json file should be placed in the correct location for your editor
- Must include at least one valid API key (e.g., ANTHROPIC_API_KEY)
- The "command" and "args" fields must match exactly

**MCP Config Example:**
\`\`\`json
{
  "mcpServers": {
    "taskmasterai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "taskmaster-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
\`\`\`

**If AI tasks fail or don't respond, check:**
1. API key is valid and has credits
2. Model is correctly set via "models" command
3. No typos in the environment variable names
4. mcp.json is in the correct location

---

## PRD Creation and Parsing

The Product Requirements Document (PRD) is the blueprint for your project. It describes what you want to build and is used to generate tasks.

### Getting Started

Write a natural language document describing your project. This can include features, technical requirements, user stories, or any context.

### PRD Best Practices:
1. Be specific about technologies, frameworks, and libraries
2. Include user stories or feature descriptions
3. Mention any constraints or requirements
4. Describe the expected behavior of each feature
5. Use clear sections and headers

### Parsing Your PRD

Once you've written your PRD, you can parse it to generate tasks:

\`\`\`bash
# Parse a PRD file
taskmaster parse-prd your-prd.txt

# Parse with a specific number of tasks
taskmaster parse-prd your-prd.txt --num-tasks 15

# Force overwrite existing tasks
taskmaster parse-prd your-prd.txt --force
\`\`\`

Or use the MCP tool:
\`\`\`
parse_prd with input="path/to/prd.txt"
\`\`\`

---

## Tasks Setup

After parsing your PRD, you'll have a set of tasks in .taskmaster/tasks/tasks.json. Before executing, you should review and prepare them.

### Reviewing Tasks

\`\`\`bash
# List all tasks
taskmaster list

# Show details for a specific task
taskmaster show 1

# Show next recommended task
taskmaster next
\`\`\`

### Task Complexity Analysis

For better planning, analyze task complexity:

\`\`\`bash
# Analyze complexity of all tasks
taskmaster analyze-complexity

# View the complexity report
taskmaster complexity-report
\`\`\`

### Expanding Tasks

Complex tasks should be broken down into subtasks:

\`\`\`bash
# Expand a specific task into subtasks
taskmaster expand --id 1

# Expand with research for better context
taskmaster expand --id 1 --research

# Expand all pending tasks
taskmaster expand --all
\`\`\`

---

## Executing Tasks

Now you're ready to start working on your tasks. The workflow is simple: pick a task, implement it, mark it done.

### Basic Workflow

1. Find the next task: \`taskmaster next\`
2. View task details: \`taskmaster show <id>\`
3. Implement the task
4. Mark as done: \`taskmaster set-status --id <id> --status done\`

### Updating Tasks

As you implement, you may need to update task details:

\`\`\`bash
# Update a specific task with new context
taskmaster update-task --id 1 --prompt "Changed approach to use React Query"

# Update multiple future tasks
taskmaster update --from 5 --prompt "Now using PostgreSQL instead of MongoDB"
\`\`\`

### Managing Dependencies

\`\`\`bash
# Add a dependency
taskmaster add-dependency --id 3 --depends-on 1

# Remove a dependency
taskmaster remove-dependency --id 3 --depends-on 1

# Validate all dependencies
taskmaster validate-dependencies
\`\`\`

---

## API Keys Configuration

TaskMaster AI supports multiple AI providers. Configure your API keys either through the Dashboard or in your mcp.json file.

### Supported Providers

| Provider | Environment Variable | Notes |
|----------|---------------------|-------|
| Anthropic | ANTHROPIC_API_KEY | Recommended for main model |
| OpenAI | OPENAI_API_KEY | GPT models |
| Google | GOOGLE_API_KEY | Gemini models |
| Perplexity | PERPLEXITY_API_KEY | Recommended for research |
| Mistral | MISTRAL_API_KEY | Mistral models |
| OpenRouter | OPENROUTER_API_KEY | Access to multiple models |
| xAI | XAI_API_KEY | Grok models |

### Getting API Keys

**Anthropic (Claude):**
1. Go to console.anthropic.com
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key

**Perplexity:**
1. Go to perplexity.ai
2. Sign in and go to Settings
3. Navigate to API section
4. Generate an API key

### Configuring Models

\`\`\`bash
# View current model configuration
taskmaster models

# Set the main model
taskmaster models --set-main claude-sonnet-4-20250514

# Set the research model
taskmaster models --set-research perplexity/sonar-pro

# Interactive setup
taskmaster models --setup
\`\`\`

---

## License & Usage

### Subscription Plans

**Plus ($29/mo)**
- 100 AI operations/month
- $0.20 per additional operation
- Email support

**Pro ($199/mo)**
- 1,000 AI operations/month
- $0.15 per additional operation
- Priority support

**Enterprise ($599+/mo)**
- 5,000+ AI operations/month
- Volume discounts
- Dedicated support

### Checking Usage

\`\`\`bash
# View current usage
taskmaster usage

# View license details
taskmaster license
\`\`\`

### What Counts as an AI Operation?

Each of these counts as one AI operation:
- Parsing a PRD
- Expanding a task
- Updating a task with AI
- Adding a task with AI
- Analyzing complexity
- Research queries

Non-AI operations (don't count):
- Listing tasks
- Showing task details
- Setting task status
- Managing dependencies
- Validating dependencies

---

## FAQ

**Q: How do I update TaskMaster AI?**
A: Run \`npm update -g @taskmasterai/cli\` for global installations.

**Q: Can I use multiple AI providers?**
A: Yes! Configure different models for main, research, and fallback roles.

**Q: What happens when I exceed my monthly limit?**
A: You'll be charged the overage rate for your plan. You can also upgrade your plan.

**Q: How do I use TaskMaster AI on another machine?**
A: Run \`taskmaster logout\` on the old machine, then \`taskmaster login\` on the new one.

**Q: Can I use TaskMaster AI offline?**
A: No, AI operations require an internet connection. Non-AI commands work offline.

---

## Feedback & Support

We'd love to hear from you! Here's how to reach us:

**Email:** taskmasteroneai@gmail.com

**For bug reports or feature requests:**
- Email us with details about the issue
- Include your TaskMaster AI version (\`taskmaster --version\`)
- Include any error messages

**For billing questions:**
- Contact us at taskmasteroneai@gmail.com
- Include your account email

---

## CLI Commands

### Task Management

| Command | Description |
|---------|-------------|
| taskmaster list | List all tasks |
| taskmaster show <id> | Show task details |
| taskmaster next | Show next recommended task |
| taskmaster set-status --id <id> --status <status> | Update task status |
| taskmaster add-task --prompt "<description>" | Add a new task |

### Task Operations

| Command | Description |
|---------|-------------|
| taskmaster expand --id <id> | Break task into subtasks |
| taskmaster expand --all | Expand all pending tasks |
| taskmaster update-task --id <id> --prompt "<context>" | Update a task |
| taskmaster update --from <id> --prompt "<context>" | Update multiple tasks |
| taskmaster remove-task --id <id> | Remove a top-level task |
| taskmaster remove-subtask --id <id> | Remove a subtask (--convert to promote to task) |

### PRD & Project

| Command | Description |
|---------|-------------|
| taskmaster init | Initialize a new project |
| taskmaster parse-prd <file> | Parse a PRD into tasks |
| taskmaster analyze-complexity | Analyze task complexity |
| taskmaster complexity-report | View complexity report |

### Dependencies

| Command | Description |
|---------|-------------|
| taskmaster add-dependency --id <id> --depends-on <id> | Add dependency |
| taskmaster remove-dependency --id <id> --depends-on <id> | Remove dependency |
| taskmaster validate-dependencies | Check for issues |
| taskmaster fix-dependencies | Auto-fix issues |

### License & Config

| Command | Description |
|---------|-------------|
| taskmaster login | Login to your account |
| taskmaster logout | Logout from your account |
| taskmaster whoami | Show current user info |
| taskmaster license | Show license info |
| taskmaster usage | Show usage stats |
| taskmaster models | View/set AI models |
| taskmaster sync-keys | Sync config from dashboard |

---

## MCP Tools

MCP tools are available when using TaskMaster AI through an MCP-compatible editor like Cursor or Windsurf.

### Available Tools

| Tool | Description |
|------|-------------|
| get_tasks | List all tasks |
| get_task | Get task details |
| next_task | Get next recommended task |
| set_task_status | Update task status |
| add_task | Add a new task |
| add_subtask | Add a subtask |
| update_task | Update a task |
| update_subtask | Update a subtask |
| expand_task | Break task into subtasks |
| expand_all | Expand all pending tasks |
| parse_prd | Parse a PRD file |
| analyze_project_complexity | Analyze task complexity |
| complexity_report | View complexity report |
| add_dependency | Add a dependency |
| remove_dependency | Remove a dependency |
| remove_subtask | Remove a subtask (or convert to standalone task) |
| validate_dependencies | Check dependencies |
| fix_dependencies | Fix dependency issues |
| research | Perform AI research |
| models | View/set AI models |
| initialize_project | Initialize new project |

---

## Task Structure

Tasks are stored in .taskmaster/tasks/tasks.json with the following structure:

\`\`\`json
{
  "tasks": [
    {
      "id": 1,
      "title": "Task title",
      "description": "What this task accomplishes",
      "status": "pending",
      "priority": "high",
      "dependencies": [],
      "details": "Implementation details and notes",
      "testStrategy": "How to verify completion",
      "subtasks": []
    }
  ]
}
\`\`\`

### Task Fields

| Field | Description |
|-------|-------------|
| id | Unique task identifier |
| title | Short descriptive title |
| description | What the task accomplishes |
| status | pending, in-progress, done, blocked, cancelled |
| priority | high, medium, low |
| dependencies | Array of task IDs that must complete first |
| details | Implementation notes and context |
| testStrategy | How to verify the task is complete |
| subtasks | Array of subtask objects |

### Subtask Structure

\`\`\`json
{
  "id": 1,
  "title": "Subtask title",
  "description": "Subtask description",
  "status": "pending",
  "dependencies": []
}
\`\`\`

---

## Advanced Usage

### Rules & Context

TaskMaster AI uses rule files to understand your project context. These are stored in .cursor/rules/ or similar directories.

To include rules during initialization:
\`\`\`bash
taskmaster init --rules cursor,windsurf
\`\`\`

To add rules later:
\`\`\`bash
taskmaster rules add cursor
taskmaster rules add windsurf
\`\`\`

### Research Tool

Use the research tool to get AI-powered insights:

\`\`\`bash
# Research a topic
taskmaster research "Best practices for React Query v5"

# Research with file context
taskmaster research "How to improve this API" --files src/api.js

# Research with task context
taskmaster research "Implementation approach" --id 5

# Include project tree
taskmaster research "Architecture overview" --tree
\`\`\`

### Tagged Task Lists

Organize tasks into separate contexts:

\`\`\`bash
# List all tags
taskmaster tags

# Create a new tag
taskmaster add-tag feature-auth

# Switch to a tag
taskmaster use-tag feature-auth

# Copy a tag
taskmaster copy-tag main feature-backup
\`\`\`

---

## Advanced Configuration

### Model Configuration

Configure different models for different purposes:

\`\`\`bash
# Set main model (used for most operations)
taskmaster models --set-main claude-sonnet-4-20250514

# Set research model (used for research queries)
taskmaster models --set-research perplexity/sonar-pro

# Set fallback model
taskmaster models --set-fallback gpt-4o-mini

# Interactive setup
taskmaster models --setup
\`\`\`

### Configuration File

Settings are stored in .taskmaster/config.json:

\`\`\`json
{
  "models": {
    "main": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4-20250514"
    },
    "research": {
      "provider": "perplexity",
      "modelId": "sonar-pro"
    }
  }
}
\`\`\`

---

## Advanced Tasks

### Moving Tasks

Reorganize your task hierarchy:

\`\`\`bash
# Move a task to become a subtask
taskmaster move --from 5 --to 3

# Move a subtask to a different parent
taskmaster move --from 3.2 --to 5

# Move multiple tasks
taskmaster move --from 10,11,12 --to 20,21,22
\`\`\`

### Clearing Subtasks

\`\`\`bash
# Clear subtasks from a specific task
taskmaster clear-subtasks --id 5

# Clear all subtasks
taskmaster clear-subtasks --all
\`\`\`

### Removing Tasks

\`\`\`bash
# Remove a top-level task
taskmaster remove-task --id 5

# Remove without confirmation
taskmaster remove-task --id 5 --yes

# Remove a subtask
taskmaster remove-subtask --id 5.2

# Remove and promote subtask to standalone task
taskmaster remove-subtask --id 5.2 --convert
\`\`\`

---

## TDD Workflow Quick Start

TaskMaster AI includes an experimental Test-Driven Development (TDD) workflow called Autopilot.

### Getting Started

1. Initialize TDD mode:
\`\`\`bash
taskmaster tdd init
\`\`\`

2. Write a test for your next task
3. Run the TDD cycle:
\`\`\`bash
taskmaster tdd run
\`\`\`

### TDD Commands

| Command | Description |
|---------|-------------|
| taskmaster tdd init | Initialize TDD workflow |
| taskmaster tdd run | Run TDD cycle |
| taskmaster tdd status | Check TDD status |
| taskmaster tdd validate | Validate tests |

---

## AI Agent Integration Guide

TaskMaster AI can be integrated with AI agents for automated task execution.

### MCP Integration

When using MCP, AI agents can:
1. Query available tasks
2. Understand task dependencies
3. Execute tasks in order
4. Update task status
5. Log progress

### Agent Best Practices

1. Always check task dependencies before starting
2. Update subtask details with progress
3. Mark tasks as in-progress when starting
4. Log implementation decisions
5. Mark tasks as done when verified complete

### Example Agent Workflow

1. Get next task: \`next_task\`
2. Read task details: \`get_task with id="1"\`
3. If complex, expand: \`expand_task with id="1"\`
4. Update status: \`set_task_status with id="1" status="in-progress"\`
5. Implement the task
6. Log progress: \`update_subtask with id="1.1" prompt="Completed implementation"\`
7. Mark done: \`set_task_status with id="1" status="done"\`

---

## Support

For any questions or issues:

**Email:** taskmasteroneai@gmail.com

**Include:**
- TaskMaster AI version
- Error messages
- Steps to reproduce

Thank you for using TaskMaster AI!
`;
