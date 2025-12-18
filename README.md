<p align="center">
  <a href="https://www.taskmaster.one"><img src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/Screenshot%202025-12-13%20at%203.19.00%E2%80%AFPM.png?alt=media&token=ae78a619-1943-45a1-aa2b-1be8dc35dc7a" alt="TaskMaster AI" height="60"></a>
</p>

<p align="center">
<b>Transform PRDs into Executable Tasks</b>
</p>

<p align="center">
TaskMaster AI intelligently breaks down your product requirements into structured, dependency-aware tasks that guide AI coding agents through complex implementations.
</p>

<p align="center">
  <a href="https://www.taskmaster.one" target="_blank">Website</a> |
  <a href="https://www.taskmaster.one/docs" target="_blank">Docs</a> |
  <a href="https://www.taskmaster.one/pricing" target="_blank">Pricing</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@taskmasterai/cli"><img src="https://img.shields.io/npm/v/@taskmasterai/cli?color=blue&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@taskmasterai/cli"><img src="https://img.shields.io/npm/dt/@taskmasterai/cli?color=green" alt="NPM Downloads"></a>
  <a href="https://www.taskmaster.one"><img src="https://img.shields.io/badge/license-Proprietary-blue.svg" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js"></a>
</p>

---

## ✨ Features

- 🤖 **AI-Powered Task Generation** - Parse PRDs and automatically generate structured tasks
- 📋 **Intelligent Breakdown** - Break down complex tasks into manageable steps using AI
- 📊 **Complexity Analysis** - AI analyzes task complexity and recommends step counts
- 🔄 **Status Tracking** - Track task progress with intuitive status management
- 🔗 **Task Linking** - Define task dependencies with circular dependency prevention
- ☁️ **Cloud Sync** - Tasks automatically sync to web dashboard in real-time
- 📈 **Usage Dashboard** - Monitor your AI operations in real-time
- 🔑 **Hosted API Keys** - Pro/Enterprise users get hosted keys (no API keys needed!)
- 🧠 **Multi-Model Support** - Use Claude, GPT, Gemini, DeepSeek, Grok, and 10+ providers
- 🔧 **MCP Integration** - Works with Cursor, Windsurf, VS Code, and other AI editors

## 📦 Installation

```bash
npm install -g @taskmasterai/cli
```

## 🚀 Quick Start

### 1. Login to TaskMaster AI

```bash
# Interactive login with email & password
taskmaster login

# Or login with Google (opens browser)
taskmaster login --google

# Or provide credentials directly
taskmaster login --email your@email.com
```

> Don't have an account? Sign up at [taskmaster.one/signup](https://www.taskmaster.one/signup)

**What happens on login:**
- ✅ Your identity is verified
- ✅ Your license is automatically activated
- ✅ API keys are synced from dashboard
- ✅ Hosted keys configured (Pro/Enterprise)

### 2. Initialize a project

```bash
taskmaster init
```

The init command will:
- ✓ Verify your authentication & license
- ✓ Set up project structure
- ✓ Configure AI models
- ✓ Sync API keys from dashboard

### 3. Generate tasks from your PRD

```bash
taskmaster plan my-project-prd.md
```

### 4. Start working

```bash
taskmaster next
taskmaster breakdown --id 1
taskmaster set-status --id 1 --status in-progress
```

## 🔐 Authentication & Security

TaskMaster AI uses secure Firebase authentication to protect your data and ensure only you can access your license.

### Login Methods

**Email & Password:**
```bash
# Interactive login
taskmaster login

# Direct login
taskmaster login --email your@email.com --password yourpassword
```

**Google Account:**
```bash
# Opens browser for OAuth
taskmaster login --google
```

### Session Management

```bash
# Check who's logged in
taskmaster whoami

# Logout
taskmaster logout
```

**Your session:**
- ✅ Stored securely in `~/.taskmaster-ai/auth.json`
- ✅ Tokens auto-refresh before expiring
- ✅ License automatically activated on login
- ✅ API keys synced from dashboard

### Security Features

| Feature | Description |
|---------|-------------|
| **Token Auto-Refresh** | Tokens refresh automatically before expiring |
| **Secure Storage** | Auth data encrypted in your home directory |
| **License Verification** | Only license owner can activate |
| **API Key Sync** | Dashboard keys synced securely |
| **Hosted Keys** | Pro/Enterprise get hosted keys automatically |

## 📚 Command Reference

### Project Management

| Command | Description |
|---------|-------------|
| `taskmaster init` | Initialize TaskMaster AI in the current project |
| `taskmaster plan <file>` | Parse a PRD file and generate tasks |
| `taskmaster generate` | Regenerate task markdown files |

### Task Management

| Command | Description |
|---------|-------------|
| `taskmaster list` | List all tasks |
| `taskmaster show <id>` | Show detailed information for a task |
| `taskmaster next` | Show the next task to work on |
| `taskmaster set-status --id <id> --status <status>` | Update task status |
| `taskmaster new --prompt "description"` | Add a new task with AI |
| `taskmaster remove-task --id <id>` | Remove a task or step |
| `taskmaster move --from <id> --to <id>` | Move tasks in the hierarchy |

### AI Operations

| Command | Description |
|---------|-------------|
| `taskmaster breakdown --id <id>` | Break down a task into steps using AI |
| `taskmaster breakdown --all` | Break down all pending tasks |
| `taskmaster assess` | Analyze task complexity with AI |
| `taskmaster report` | View the complexity analysis report |
| `taskmaster edit --id <id> --prompt "info"` | Update task with AI |
| `taskmaster log --id <id> --prompt "notes"` | Log progress on a step |
| `taskmaster ask "question"` | AI-powered research with project context |
| `taskmaster update --from <id> --prompt "info"` | Update multiple tasks from an ID |

### Steps (Subtasks)

| Command | Description |
|---------|-------------|
| `taskmaster add-step --parent <id> --title "Step title"` | Add a step to a task |
| `taskmaster clear-steps --id <id>` | Clear all steps from a task |

### Task Linking

| Command | Description |
|---------|-------------|
| `taskmaster link --id <id> --depends-on <id>` | Link tasks together |
| `taskmaster unlink --id <id> --depends-on <id>` | Remove a task link |
| `taskmaster check-links` | Validate all task links |
| `taskmaster fix-links` | Auto-fix broken links |

### Contexts (Workspaces)

| Command | Description |
|---------|-------------|
| `taskmaster contexts` | List all contexts |
| `taskmaster context-add <name>` | Create a new context |
| `taskmaster context <name>` | Switch to a different context |
| `taskmaster clone <source> <target>` | Clone a context with all tasks |
| `taskmaster delete-context <name>` | Delete a context |
| `taskmaster rename-context <old> <new>` | Rename a context |

### Authentication

| Command | Description |
|---------|-------------|
| `taskmaster login` | Login with email/password or Google |
| `taskmaster login --email <email>` | Login with email (will prompt for password) |
| `taskmaster login --google` | Login with Google (opens browser) |
| `taskmaster whoami` | Show current user and license status |
| `taskmaster logout` | Logout and clear session |

### License & Usage

| Command | Description |
|---------|-------------|
| `taskmaster activate <key>` | Activate a license key |
| `taskmaster usage` | View usage and plan limits |
| `taskmaster sync-keys` | Sync API keys and hosted keys from dashboard |

### Configuration

| Command | Description |
|---------|-------------|
| `taskmaster models` | View AI model configuration |
| `taskmaster models --set-main <model>` | Set main AI model |

### Autopilot Mode

| Command | Description |
|---------|-------------|
| `taskmaster autopilot start` | Start autopilot workflow |
| `taskmaster autopilot status` | Check autopilot status |
| `taskmaster autopilot complete` | Mark current step complete |
| `taskmaster autopilot commit` | Commit autopilot changes |
| `taskmaster autopilot resume` | Resume paused autopilot |
| `taskmaster autopilot finalize` | Finalize autopilot session |
| `taskmaster autopilot abort` | Abort autopilot session |

## 🔧 MCP Integration (Cursor, Windsurf, VS Code)

TaskMaster AI works seamlessly with AI-powered editors via MCP.

### Cursor & Windsurf

Add to your `~/.cursor/mcp.json` or `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "mcp"],
      "env": {
        "TASKMASTER_LICENSE_KEY": "tm_live_your_license_key"
      }
    }
  }
}
```

### VS Code

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "mcp"],
      "env": {
        "TASKMASTER_LICENSE_KEY": "tm_live_your_license_key"
      },
      "type": "stdio"
    }
  }
}
```

## 🔑 API Key Configuration

### Option 1: Dashboard Sync (Recommended)

Configure your API keys in the TaskMaster dashboard and they'll automatically sync:

1. Go to [taskmaster.one/app/api-keys](https://www.taskmaster.one/app/api-keys)
2. Add your API keys for the providers you want to use
3. Run `taskmaster sync-keys` to pull the keys to your CLI

### Supported Providers

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| Anthropic | `ANTHROPIC_API_KEY` | Claude Opus, Sonnet, Haiku |
| OpenAI | `OPENAI_API_KEY` | GPT-5.x, GPT-4.x, o3, o4 |
| Google | `GOOGLE_API_KEY` | Gemini 3, 2.5 Pro/Flash |
| Perplexity | `PERPLEXITY_API_KEY` | Sonar Pro, Sonar |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek R1, V3.x |
| xAI | `XAI_API_KEY` | Grok 4.x, Grok 3 |
| OpenRouter | `OPENROUTER_API_KEY` | Any model via OpenRouter |
| Mistral | `MISTRAL_API_KEY` | Mistral Large, Medium |
| Moonshot | `MOONSHOT_API_KEY` | Kimi K2 |
| Zhipu AI | `ZHIPU_API_KEY` | GLM-4.x |
| Meta | `META_API_KEY` | Llama 4, Llama 3.3 |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | Azure-hosted OpenAI models |
| Ollama | `OLLAMA_API_KEY` | Local models via Ollama |

### Option 2: Environment Variables

```bash
# Primary providers
export ANTHROPIC_API_KEY="your-key"     # Claude models
export OPENAI_API_KEY="your-key"        # GPT models
export GOOGLE_API_KEY="your-key"        # Gemini models
export PERPLEXITY_API_KEY="your-key"    # Research features
export DEEPSEEK_API_KEY="your-key"      # DeepSeek models
export XAI_API_KEY="your-key"           # Grok models

# Additional providers
export OPENROUTER_API_KEY="your-key"    # OpenRouter (any model)
export MISTRAL_API_KEY="your-key"       # Mistral models
export MOONSHOT_API_KEY="your-key"      # Kimi models
export ZHIPU_API_KEY="your-key"         # GLM models
export META_API_KEY="your-key"          # Llama models

# Azure & Local
export AZURE_OPENAI_API_KEY="your-key"  # Azure OpenAI
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export OLLAMA_API_KEY="your-key"        # Ollama (optional)
export OLLAMA_BASE_URL="http://localhost:11434/api"
```

## 💰 Pricing Plans

| Plan | Price | AI Operations/Month |
|------|-------|---------------------|
| **Plus** | $29/month | 100 |
| **Pro** | $199/month | 1,000 |
| **Enterprise** | $599/month | 5,000 |

Get your license at: [taskmaster.one/pricing](https://www.taskmaster.one/pricing)

## 📁 Project Structure

TaskMaster AI creates a `.taskmaster-ai` directory in your project:

```
.taskmaster-ai/
├── config.json       # Project configuration
├── tasks/
│   └── tasks.json    # Task data
├── docs/             # Documentation & PRDs
└── reports/          # Complexity reports
```

## 📋 Example Workflow

```bash
# 1. Activate your license
taskmaster activate tm_live_your_license_key

# 2. Initialize project
taskmaster init --name "My App"

# 3. Sync API keys from dashboard
taskmaster sync

# 4. Generate tasks from PRD
taskmaster plan requirements.md --num-tasks 15

# 5. Analyze complexity
taskmaster assess --research

# 6. Break down complex tasks
taskmaster breakdown --all --research

# 7. Start working
taskmaster next
taskmaster set-status --id 1 --status in-progress

# 8. Log progress
taskmaster log --id 1.1 --prompt "Completed database schema design"

# 9. Mark complete
taskmaster set-status --id 1.1 --status done
```

## 📊 Task Statuses

| Status | Description |
|--------|-------------|
| `pending` | Ready to be worked on |
| `in-progress` | Currently being worked on |
| `done` | Completed |
| `blocked` | Waiting on external factors |
| `cancelled` | No longer needed |
| `deferred` | Postponed |

## 🤖 Supported AI Providers & Models

### Anthropic (Claude)
Claude Opus 4.5, Claude 4.1 Opus, Claude Sonnet 4.5, Claude Sonnet 4.5 (Reasoning), Claude 4 Sonnet, Claude 4 Sonnet (Reasoning), Claude 3.7 Sonnet, Claude 3.7 Sonnet (Reasoning), Claude Haiku 4.5, Claude Haiku 4.5 (Reasoning)

### OpenAI (GPT)
GPT-5.2 (Instant), GPT-5.2 (Reasoning), GPT-5.1 (Instant), GPT-5.1 (Reasoning), GPT-5, GPT-5 (Reasoning), GPT-5 Mini, GPT-5 Nano, GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-4o, GPT-4o Mini, o3 Mini, o3 Pro, o4 Mini, GPT OSS 20B, GPT OSS 120B

### Google (Gemini)
Gemini 3 Pro, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash (Thinking), Gemini 2.5 Flash Lite (Thinking), Gemini 2.0 Flash, Gemini 2.0 Flash Lite

### DeepSeek
DeepSeek R1, DeepSeek V3, DeepSeek V3.2 Exp, DeepSeek V3.2 Exp (Thinking), DeepSeek V3.1, DeepSeek V3.1 (Thinking), DeepSeek V3.1 Terminus, DeepSeek V3.1 Terminus (Thinking)

### xAI (Grok)
Grok 4, Grok 4 Fast, Grok 4 Fast (Reasoning), Grok 4.1 Fast, Grok 4.1 Fast (Reasoning), Grok 3, Grok 3 Mini

### Meta (Llama)
Llama 4 Maverick, Llama 4 Scout, Llama 3.3 70B

### Zhipu AI (GLM)
GLM 4.6, GLM 4.6 (Thinking), GLM 4.5, GLM 4.5 (Thinking), GLM 4.5 Air, GLM 4.5 Air (Thinking), GLM 4.5V, GLM 4.5V (Thinking)

### Moonshot (Kimi)
Kimi K2, Kimi K2 (Thinking)

### Additional Providers
| Provider | Description |
|----------|-------------|
| **Mistral** | Mistral Large, Medium, Small |
| **Perplexity** | Sonar Pro, Sonar (for research) |
| **OpenRouter** | Access 100+ models via single API |
| **Azure OpenAI** | Azure-hosted GPT & embedding models |
| **Ollama** | Run models locally (Llama, Mistral, etc.) |

Configure models via the dashboard or `taskmaster models` command.

## 📞 Support

- **Documentation**: [taskmaster.one/docs](https://www.taskmaster.one/docs)
- **Dashboard**: [taskmaster.one/app](https://www.taskmaster.one/app)
- **Email**: [taskmasteroneai@gmail.com](mailto:taskmasteroneai@gmail.com)

## 📄 License

Proprietary software. Requires valid license.

Get your license at: [taskmaster.one/pricing](https://www.taskmaster.one/pricing)

---

<p align="center">
  <b>© 2025 TaskMaster AI LLC. All rights reserved.</b>
</p>
