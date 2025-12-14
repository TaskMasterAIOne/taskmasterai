# TaskMaster AI CLI

AI-powered task management for developers. Transform PRDs into actionable task lists with AI-generated subtasks, complexity analysis, and intelligent task expansion.

## Features

- 🤖 **AI-Powered Task Generation** - Parse PRDs and automatically generate structured tasks
- 📋 **Task Expansion** - Break down complex tasks into manageable subtasks using AI
- 📊 **Complexity Analysis** - AI analyzes task complexity and recommends subtask counts
- 🔄 **Status Tracking** - Track task progress with intuitive status management
- 🔗 **Dependency Management** - Define task dependencies with circular dependency prevention
- 📈 **Usage Tracking** - Monitor your AI operations against plan limits

## Installation

```bash
npm install -g @taskmasterai/cli
```

## Quick Start

1. **Activate your license**:
```bash
taskmaster activate tm_live_your_license_key
```

2. **Initialize a project**:
```bash
taskmaster init
```

3. **Create a PRD file** and generate tasks:
```bash
taskmaster parse-prd my-project-prd.md
```

4. **View your tasks**:
```bash
taskmaster list
```

5. **Expand tasks into subtasks**:
```bash
taskmaster expand --id 1
```

## Command Reference

### Project Management
| Command | Description |
|---------|-------------|
| `taskmaster init` | Initialize TaskMaster AI in the current project |
| `taskmaster parse-prd <file>` | Parse a PRD file and generate tasks |

### Task Management
| Command | Description |
|---------|-------------|
| `taskmaster list` | List all tasks |
| `taskmaster show <id>` | Show detailed information for a task |
| `taskmaster next` | Show the next task to work on |
| `taskmaster set-status --id <id> --status <status>` | Update task status |
| `taskmaster add-task --prompt "description"` | Add a new task with AI |
| `taskmaster remove-task --id <id>` | Remove a task or subtask |

### AI Operations
| Command | Description |
|---------|-------------|
| `taskmaster expand --id <id>` | Expand a task into subtasks using AI |
| `taskmaster expand --all` | Expand all pending tasks |
| `taskmaster analyze-complexity` | Analyze task complexity with AI |
| `taskmaster update-task --id <id> --prompt "info"` | Update task with AI |
| `taskmaster update-subtask --id <id> --prompt "notes"` | Append notes to subtask |

### Dependencies
| Command | Description |
|---------|-------------|
| `taskmaster add-dependency --id <id> --depends-on <id>` | Add task dependency |
| `taskmaster remove-dependency --id <id> --depends-on <id>` | Remove task dependency |

### License & Usage
| Command | Description |
|---------|-------------|
| `taskmaster activate <license-key>` | Activate your license |
| `taskmaster deactivate` | Deactivate current license |
| `taskmaster license` | Show license status |
| `taskmaster usage` | View usage and plan limits |
| `taskmaster sync` | Sync API keys and models from dashboard |

### Configuration
| Command | Description |
|---------|-------------|
| `taskmaster models` | View AI model configuration |
| `taskmaster models --set-main <model>` | Set main AI model |

## Task Statuses

- `pending` - Ready to be worked on
- `in-progress` - Currently being worked on
- `done` - Completed
- `blocked` - Waiting on external factors
- `cancelled` - No longer needed
- `deferred` - Postponed

## API Key Configuration

### Option 1: Dashboard Sync (Recommended)
Configure your API keys in the TaskMaster dashboard and they'll automatically sync to your CLI:

1. Go to [https://www.taskmaster.one/app/api-keys](https://www.taskmaster.one/app/api-keys)
2. Add your API keys for the providers you want to use
3. Run `taskmaster sync` to pull the keys to your CLI

### Option 2: Environment Variables
Set API keys directly in your shell (takes priority over dashboard sync):

```bash
export ANTHROPIC_API_KEY="your-key"     # For Claude models (recommended)
export OPENAI_API_KEY="your-key"        # For GPT models
export GOOGLE_API_KEY="your-key"        # For Gemini models
export PERPLEXITY_API_KEY="your-key"    # For research features
```

## Pricing Plans

| Plan | Price | AI Operations/Month |
|------|-------|---------------------|
| **Plus** | $29/month | 500 |
| **Pro** | $199/month | 2,000 |
| **Enterprise** | Custom | Unlimited |

Get your license at: https://www.taskmaster.one/pricing

## Project Structure

TaskMaster AI creates a `.taskmaster` directory in your project:

```
.taskmaster/
├── config.json       # Project configuration
├── tasks/
│   └── tasks.json    # Task data
├── docs/             # Documentation
└── reports/          # Complexity reports
```

## Example Workflow

```bash
# 1. Initialize project
taskmaster init --name "My App"

# 2. Generate tasks from PRD
taskmaster parse-prd requirements.md --num-tasks 15

# 3. Analyze complexity
taskmaster analyze-complexity --research

# 4. Expand complex tasks
taskmaster expand --all --research

# 5. Start working
taskmaster next
taskmaster set-status --id 1 --status in-progress

# 6. Log progress
taskmaster update-subtask --id 1.1 --prompt "Completed database schema design"

# 7. Mark complete
taskmaster set-status --id 1.1 --status done
```

## License

Proprietary software. Requires valid license.

Get your license at: https://www.taskmaster.one/pricing

© 2025 TaskMaster AI LLC. All rights reserved.
