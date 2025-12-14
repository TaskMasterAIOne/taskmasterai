# TaskMaster AI Terminology Guide

This document defines the unique terminology used by TaskMaster AI to distinguish it from similar tools.

## Brand Identity

| Aspect | TaskMaster AI | Similar Tools |
|--------|---------------|---------------|
| **Product Name** | TaskMaster AI | Task Master, Claude Task Master |
| **Package Name** | `@taskmasterai/cli` | `task-master-ai` |
| **CLI Command** | `taskmaster` / `tm` | `task-master` |
| **Config Directory** | `.taskmaster-ai` | `.taskmaster` |

## Command Naming

### Core Task Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `init` | Initialize new project | `init` |
| `plan` | Generate tasks from PRD | `parse-prd` |
| `list` | Show all tasks | `list` |
| `show` | Display task details | `show` |
| `next` | Get next task to work on | `next` |
| `set-status` | Update task status | `set-status` |

### Task Modification Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `new` | Add a new task | `add-task` |
| `remove-task` | Delete a task | `remove-task` |
| `move` | Reorder/move tasks | `move` |
| `edit` | Update task details | `update-task` |
| `update` | Batch update tasks | `update` |

### Step (Subtask) Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `add-step` | Add a single step | `add-subtask` |
| `log` | Update step with notes | `update-subtask` |
| `remove-step` | Remove a specific step | `remove-subtask` |
| `remove-step --convert` | Convert step to task | `remove-subtask --convert` |
| `clear-steps` | Remove all steps from task(s) | `clear-subtasks` |
| `clear-steps --all` | Clear steps from all tasks | `clear-subtasks --all` |
| `breakdown` | Break task into steps | `expand` |

### Complexity Analysis Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `assess` | Analyze task complexity | `analyze-complexity` |
| `report` | View assessment report | `complexity-report` |

### Link (Dependency) Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `link` | Add dependency | `add-dependency` |
| `unlink` | Remove dependency | `remove-dependency` |
| `check-links` | Validate dependencies | `validate-dependencies` |
| `fix-links` | Fix broken dependencies | `fix-dependencies` |

### Context (Tag) Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `contexts` | List all contexts | `tags` |
| `context` | Switch context | `use-tag` |
| `context-add` | Create new context | `add-tag` |
| `context-add --from-branch` | Create context from git branch | `add-tag --from-branch` |
| `delete-context` | Delete context | `delete-tag` |
| `rename-context` | Rename context | `rename-tag` |
| `clone` | Copy context | `copy-tag` |

### AI & Research Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `ask` | AI research query | `research` |
| `models` | Configure AI models | `models` |

### Scope Adjustment Commands (Unique to TaskMaster AI)

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `scope-up` | Increase task complexity | (unique feature) |
| `scope-down` | Decrease task complexity | (unique feature) |

### Utility Commands

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| `generate` | Create task markdown files | `generate` |
| `sync-readme` | Sync tasks to README.md | `sync-readme` |
| `usage` | View API usage | (unique feature) |
| `autopilot` | Automated task execution | (unique feature) |
| `set-language` | Set AI response language | `set-response-language` |
| `migrate` | Migrate project structure | `migrate` |

## Concept Terminology

| TaskMaster AI | Description | Similar Alternative |
|---------------|-------------|---------------------|
| **Steps** | Sub-items of a task | Subtasks |
| **Links** | Task dependencies | Dependencies |
| **Contexts** | Isolated task workspaces | Tags |
| **Assessment** | Task complexity analysis | Complexity |
| **Breakdown** | Breaking task into steps | Expansion |
| **Plan** | PRD to tasks conversion | Parse |
| **Scope** | Task complexity/effort level | (no direct equivalent) |

## Data Structure Fields

### Task Object
```javascript
{
  id: 1,
  title: "Task title",
  description: "What this task does",
  status: "pending",      // pending, in-progress, done, blocked, cancelled
  priority: "high",       // high, medium, low
  details: "Implementation details",
  testStrategy: "How to verify completion",
  steps: [],              // NOT "subtasks"
  dependencies: [],       // Also supports "links"
}
```

### Step Object (formerly Subtask)
```javascript
{
  id: 1,
  title: "Step title",
  description: "What this step does",
  status: "pending",
  details: "Implementation notes",
  dependencies: [],       // Also supports "links"
}
```

### Assessment Report (formerly Complexity Report)
```javascript
{
  meta: {
    generatedAt: "2025-01-01T00:00:00.000Z",
    tasksAnalyzed: 10,
    thresholdScore: 5
  },
  assessment: [           // NOT "complexityAnalysis"
    {
      taskId: 1,
      taskTitle: "Task title",
      assessmentScore: 7,        // NOT "complexityScore"
      recommendedSteps: 5,       // NOT "recommendedSubtasks"
      breakdownPrompt: "...",    // NOT "expansionPrompt"
      reasoning: "Why this score"
    }
  ]
}
```

### Contexts Structure (formerly Tags)
```javascript
{
  // Each key is a context name
  "main": {               // Default context (NOT "master")
    tasks: [],
    metadata: {
      created: "2025-01-01T00:00:00.000Z",
      updated: "2025-01-01T00:00:00.000Z",
      description: "Main project context"
    }
  },
  "feature-auth": {
    tasks: [],
    metadata: {
      created: "2025-01-01T00:00:00.000Z",
      updated: "2025-01-01T00:00:00.000Z",
      description: "Context created from git branch feature/auth"
    }
  }
}
```

## File Structure

```
.taskmaster-ai/                 # Config directory
├── config.json                 # Project configuration
├── state.json                  # Current context state
├── tasks/
│   └── tasks.json              # Task data (with contexts)
├── reports/
│   └── assessment-report.json  # NOT complexity-report
├── templates/
│   └── example_prd.txt         # PRD template
└── docs/
    ├── prd.txt                 # Project PRD
    └── research/               # Saved research sessions
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TASKMASTER_LOG_LEVEL` | Logging level (error, warn, info, debug) |
| `TASKMASTER_AI_API_KEY` | API key for TaskMaster AI cloud services |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `PERPLEXITY_API_KEY` | Perplexity API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `XAI_API_KEY` | xAI API key |
| `OLLAMA_BASE_URL` | Ollama server URL |

## Status Values

| Status | Description | Icon |
|--------|-------------|------|
| `pending` | Not yet started | ⏳ |
| `in-progress` | Currently being worked on | 🔄 |
| `done` | Completed | ✅ |
| `blocked` | Waiting on external dependency | 🚫 |
| `cancelled` | No longer needed | ❌ |
| `deferred` | Postponed for later | 📅 |

## Priority Values

| Priority | Description | Icon |
|----------|-------------|------|
| `high` | Critical/urgent | 🔴 |
| `medium` | Normal priority | 🟡 |
| `low` | Nice to have | 🟢 |

## Scope Strengths (for scope-up/scope-down)

| Strength | Description |
|----------|-------------|
| `minimal` | Slight adjustment |
| `moderate` | Medium adjustment (default) |
| `significant` | Major adjustment |
| `comprehensive` | Complete restructure |

## Backward Compatibility

The codebase supports legacy field names for backward compatibility:
- `subtasks` → automatically treated as `steps`
- `tags` → automatically treated as `contexts`
- `complexityAnalysis` → automatically treated as `assessment`
- `complexityScore` → automatically treated as `assessmentScore`
- `recommendedSubtasks` → automatically treated as `recommendedSteps`
- `expansionPrompt` → automatically treated as `breakdownPrompt`
- `master` context → treated same as `main`

## Module Functions Mapping

| Module | TaskMaster AI Function | Similar Alternative |
|--------|------------------------|---------------------|
| context-manager | `createContext` | `createTag` |
| context-manager | `deleteContext` | `deleteTag` |
| context-manager | `renameContext` | `renameTag` |
| context-manager | `cloneContext` | `copyTag` |
| context-manager | `useContext` | `useTag` |
| context-manager | `listContexts` | `tags` |
| context-manager | `createContextFromBranch` | `createTagFromBranch` |
| link-manager | `addLink` | `addDependency` |
| link-manager | `removeLink` | `removeDependency` |
| link-manager | `validateLinks` | `validateDependencies` |
| link-manager | `fixLinksCommand` | `fixDependencies` |
| task-manager | `logStep` | `updateSubtask` |
| task-manager | `addStep` | `addSubtask` |
| task-manager | `clearSteps` | `clearSubtasks` |
| task-manager | `breakdownTask` | `expandTask` |
| task-manager | `breakdownAll` | `expandAll` |
| task-manager | `assessComplexity` | `analyzeComplexity` |
| task-manager | `showAssessmentReport` | `complexityReport` |
| task-manager | `ask` | `research` |
| task-manager | `plan` | `parsePrd` |
| task-manager | `syncReadme` | `syncReadme` |
| task-manager | `clearSteps` | `clearSubtasks` |
| task-manager | `clearAllSteps` | `clearAllSubtasks` |
| task-manager | `removeStep` | `removeSubtask` |
| task-manager | `removeMultipleSteps` | (bulk remove) |
| task-manager | `setResponseLanguage` | `setResponseLanguage` |
| task-manager | `getResponseLanguage` | `getResponseLanguage` |
| task-manager | `migrateProject` | `migrateProject` |
| utils | `formatError` | (error formatting) |
| utils | `displayError` | (error display) |
| utils | `createBridgeLogger` | (MCP/CLI bridging) |

---
Copyright (c) 2025 TaskMaster AI LLC
