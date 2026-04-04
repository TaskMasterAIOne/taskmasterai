import { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react'
import { ALL_DOCS_TEXT } from '../lib/docsText'
import { motion, AnimatePresence } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faChevronRight,
  faChevronDown,
  faLightbulb,
  faTerminal, 
  faGear, 
  faFileLines, 
  faRocket,
  faBook,
  faCubes,
  faKey,
  faQuestionCircle,
  faBolt,
  faListCheck,
  faComments,
  faInfoCircle,
  faCopy,
  faCheck,
  faSearch,
  faBars,
  faArrowUp,
  faTimes,
  faSpinner,
  faTrash,
  faGripLinesVertical,
  faRobot,
  faEnvelope,
  faClipboard
} from '@fortawesome/free-solid-svg-icons'
// Function to call the ask question endpoint
const FUNCTION_URL = import.meta.env.VITE_ASK_QUESTION_URL || 'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/askQuestion'

const askQuestionAPI = async (question: string): Promise<string> => {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to get response')
  }
  
  const data = await response.json()
  return data.answer
}

// Sidebar navigation structure
const navigation = [
  {
    title: 'Welcome',
    items: [
      { id: 'introduction', label: 'Introduction', icon: faBook }
    ]
  },
  {
    title: 'Getting Started',
    items: [
      { 
        id: 'quick-start', 
        label: 'Quick Start', 
        icon: faRocket,
        children: [
          { id: 'requirements', label: 'Requirements' },
          { id: 'installation', label: 'Installation' },
          { id: 'configuration', label: 'Configuration' },
          { id: 'prd-creation', label: 'PRD Creation and Parsing' },
          { id: 'tasks-setup', label: 'Tasks Setup' },
          { id: 'executing-tasks', label: 'Executing Tasks' },
        ]
      },
      { id: 'api-keys', label: 'API Keys', icon: faKey },
      { id: 'license-usage', label: 'License & Usage', icon: faKey },
      { id: 'faq', label: 'FAQ', icon: faQuestionCircle },
      { id: 'contribute', label: 'Feedback & Support', icon: faComments },
    ]
  },
  {
    title: 'Best Practices',
    items: [
      { id: 'advanced-usage', label: 'Advanced Usage', icon: faBolt },
      { id: 'advanced-configuration', label: 'Advanced Configuration', icon: faGear },
      { id: 'advanced-tasks', label: 'Advanced Tasks', icon: faListCheck },
    ]
  },
  {
    title: 'Technical Capabilities',
    items: [
      { id: 'mcp-tools', label: 'MCP Tools', icon: faCubes },
      { id: 'cli-commands', label: 'CLI Commands', icon: faTerminal },
      { id: 'task-structure', label: 'Task Structure', icon: faFileLines },
    ]
  },
  {
    title: 'TDD Workflow (Autopilot)',
    items: [
      { id: 'tdd-quick-start', label: 'Quick Start', icon: faRobot },
      { id: 'agent-integration', label: 'AI Agent Integration', icon: faCubes },
    ]
  },
]

// Helper function to scroll to top - works across different browsers
const scrollToTop = () => {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

// Navigation Context for clickable section links
const NavigationContext = createContext<{
  navigateToSection: (sectionId: string) => void
} | null>(null)

// Section Link Component - clickable links that navigate to sections
function SectionLink({ sectionId, children, className = '' }: { sectionId: string; children: React.ReactNode; className?: string }) {
  const context = useContext(NavigationContext)
  
  return (
    <button
      onClick={() => context?.navigateToSection(sectionId)}
      className={`text-marketing-text font-medium underline hover:text-marketing-link-hover transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  )
}

// Collapsible Accordion Component
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border border-marketing-border rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-marketing-surface hover:bg-marketing-elevated transition-colors text-left"
      >
        <FontAwesomeIcon 
          icon={isOpen ? faChevronDown : faChevronRight} 
          className="w-3 h-3 text-marketing-muted" 
        />
        <span className="text-marketing-text font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-marketing-bg border-t border-marketing-border overflow-x-auto">
          {children}
      </div>
      )}
    </div>
  )
}

// Code Block Component with Copy
function CodeBlock({ code, filename, language = 'bash' }: { code: string; filename?: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="marketing-panel border rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-marketing-surface">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          {filename && <span className="text-xs text-marketing-muted ml-2 font-mono">{filename}</span>}
        </div>
        <button 
          onClick={handleCopy}
          className="text-marketing-muted hover:text-marketing-text transition-colors p-1"
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5" />
        </button>
      </div>
      <pre className="p-4 font-mono text-sm overflow-x-auto bg-marketing-bg">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  )
}

// Tip/Info Box Component
function TipBox({ children, type = 'tip' }: { children: React.ReactNode; type?: 'tip' | 'info' | 'warning' | 'success' }) {
  const styles = {
    tip: 'bg-marketing-link/10 border-marketing-link text-marketing-link',
    info: 'bg-status-info/10 border-status-info text-status-info',
    warning: 'bg-status-warning/10 border-status-warning text-status-warning',
    success: 'bg-green-500/10 border-green-500 text-green-400'
  }
  
  return (
    <div className={`border rounded-lg p-4 mb-6 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <FontAwesomeIcon icon={type === 'info' ? faInfoCircle : type === 'success' ? faCheck : faLightbulb} className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

// Documentation content
const docContent: Record<string, { title: string; breadcrumb?: string; content: React.ReactNode }> = {
  'introduction': {
    title: 'Introduction',
    breadcrumb: 'Welcome',
    content: (
      <>
        <TipBox>
          Welcome to v1 of the TaskMaster AI Docs. Expect weekly updates as we expand and refine each section.
        </TipBox>
        
        <p className="text-marketing-muted mb-8">
          We've organized the docs into three sections depending on your experience level and goals:
        </p>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2">
              Getting Started - Jump in to <SectionLink sectionId="quick-start" className="text-marketing-link">Quick Start</SectionLink>
            </h3>
            <p className="text-marketing-muted">
              Designed for first-time users. Get set up, configure your subscription, create your first PRD, and run your first task.
            </p>
              </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Best Practices</h3>
            <p className="text-marketing-muted">
              Covers common workflows, strategic usage of commands, model configuration tips, and real-world usage patterns. Recommended for active subscribers.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Technical Capabilities</h3>
            <p className="text-marketing-muted">
              A detailed glossary of every root command and available capability — meant for power users and contributors.
            </p>
        </div>
      </div>

        <hr className="border-marketing-border my-10" />

        <p className="text-marketing-muted">
          Need support? Contact us at{' '}
          <a href="mailto:taskmasteroneai@gmail.com" className="text-marketing-text hover:text-marketing-link-hover underline">
            taskmasteroneai@gmail.com
          </a>{' '}
          and we'll get back to you as soon as possible.
        </p>
      </>
    )
  },
  'quick-start': {
    title: 'Quick Start',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          This guide is for new subscribers who want to start using TaskMaster AI with minimal setup time. Make sure you have an active subscription before proceeding.
        </p>

        <p className="text-marketing-muted mb-4">It covers:</p>

        <ul className="space-y-3 mb-8">
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="requirements">Requirements</SectionLink>: You will need Node.js, an active subscription, and an AI model API Key.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="installation">Installation</SectionLink>: How to install and login to TaskMaster AI.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="configuration">Configuration</SectionLink>: Setting up your API Key, MCP, and subscription.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="prd-creation">PRD</SectionLink>: Writing and parsing your first PRD.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="tasks-setup">Task Setup</SectionLink>: Preparing your tasks for execution.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="executing-tasks">Executing Tasks</SectionLink>: Using TaskMaster AI to execute tasks.</span>
          </li>
          <li className="flex items-start gap-2 text-marketing-muted">
            <span>•</span>
            <span><SectionLink sectionId="advanced-usage">Rules & Context</SectionLink>: Learn how and why to build context in your project over time.</span>
          </li>
        </ul>

        <TipBox>
          By the end of this guide, you'll have everything you need to begin working productively with TaskMaster AI. Each task processed counts toward your monthly plan limit.
        </TipBox>
      </>
    )
  },
  'requirements': {
    title: 'Requirements',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-8">
          Before you can start using TaskMaster AI, you'll need an active subscription, Node.js installed, and at least one model API Key configured.
        </p>

        <TipBox type="info">
          TaskMaster AI requires an active subscription. Plans start at $29/month for Plus. Visit the <a href="/pricing" className="text-marketing-link underline">Pricing page</a> to choose a plan.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4">1. Node.js</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster AI is built with Node.js and requires it to run. npm (Node Package Manager) comes bundled with Node.js.
        </p>
        
        <Accordion title="Install Node.js">
          <h4 className="text-lg font-semibold mb-3">Installation</h4>
          
          <p className="font-medium mb-3">Option 1: Download from official website</p>
          <ol className="list-decimal list-inside space-y-2 text-marketing-muted mb-6">
            <li>Visit <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-marketing-text underline hover:text-marketing-link-hover">nodejs.org</a></li>
            <li>Download the <span className="text-marketing-link font-medium">LTS (Long Term Support)</span> version for your operating system</li>
            <li>Run the installer and follow the setup wizard</li>
          </ol>
          
          <p className="font-medium mb-3">Option 2: Use a package manager</p>
          <CodeBlock 
            code="# macOS (using Homebrew)
brew install node

# Windows (using Chocolatey)
choco install nodejs

# Windows (using winget)
winget install OpenJS.NodeJS.LTS"
            filename="Terminal"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">2. Model API Key</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster AI utilizes AI across several commands, and those require a separate API key. For the purpose of a Quick Start we recommend setting up an API Key with Anthropic for your main model and Perplexity for your ask model (optional but recommended).
        </p>

        <TipBox>
          TaskMaster AI shows API costs per command used. Most users load $5-10 on their keys and don't have to top it off for a few months.
        </TipBox>

        <p className="text-marketing-muted mb-4">At least one (1) of the following is required:</p>
        
        <ol className="list-decimal list-inside space-y-2 text-marketing-muted">
          <li>Anthropic API key (Claude API) - <span className="text-marketing-text font-medium">recommended for Quick Start</span></li>
          <li>OpenAI API key</li>
          <li>Google Gemini API key</li>
          <li>Perplexity API key (for ask model)</li>
          <li>xAI API Key (for ask or main model)</li>
          <li>OpenRouter API Key (for ask or main model)</li>
          <li>Claude Code (no API key required - requires Claude Code CLI)</li>
        </ol>
      </>
    )
  },
  'installation': {
    title: 'Installation',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Now that you have an active subscription, Node.js, and your first API Key, you are ready to begin installing TaskMaster AI.
        </p>

        <TipBox type="info">
          <strong>Subscription Required:</strong> Make sure you have an active TaskMaster AI subscription before installing. Cursor users can use the one-click install below.
        </TipBox>

        <Accordion title="Quick Install for Cursor 1.0+ (One-Click)" defaultOpen>
          <a 
            href="cursor://anysphere.cursor-deeplink/mcp/install?name=taskmasterai&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB0YXNrbWFzdGVyYWkvY2xpIiwidGFza21hc3Rlci1tY3AiXSwiZW52Ijp7IkFOVEhST1BJQ19BUElfS0VZIjoiWU9VUl9BTlRIUk9QSUNfQVBJX0tFWV9IRVJFIiwiUEVSUExFWElUWV9BUElfS0VZIjoiWU9VUl9QRVJQTEVYSVRZX0FQSV9LRVlfSEVSRSIsIk9QRU5BSV9BUElfS0VZIjoiWU9VUl9PUEVOQUlfS0VZX0hFUkUiLCJHT09HTEVfQVBJX0tFWSI6IllPVVJfR09PR0xFX0tFWV9IRVJFIiwiTUlTVFJBTF9BUElfS0VZIjoiWU9VUl9NSVNUUkFMX0tFWV9IRVJFIiwiT1BFTlJPVVRFUl9BUElfS0VZIjoiWU9VUl9PUEVOUk9VVEVSX0tFWV9IRVJFIiwiWEFJX0FQSV9LRVkiOiJZT1VSX1hBSV9LRVlfSEVSRSJ9fQ=="
            className="inline-block mb-4 hover:opacity-90 transition-opacity"
          >
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/mcp-install-dark.png?alt=media&token=b30404bf-1596-4bf6-8fd2-0978c6c92826" 
              alt="Add to Cursor" 
              className="h-12"
            />
          </a>
          
          <p className="text-marketing-muted text-sm mb-4">
            Or click the copy button (top-right of code block) then paste into your browser:
          </p>
          
          <CodeBlock 
            code="cursor://anysphere.cursor-deeplink/mcp/install?name=taskmasterai&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB0YXNrbWFzdGVyYWkvY2xpIiwidGFza21hc3Rlci1tY3AiXSwiZW52Ijp7IkFOVEhST1BJQ19BUElfS0VZIjoiWU9VUl9BTlRIUk9QSUNfQVBJX0tFWV9IRVJFIiwiUEVSUExFWElUWV9BUElfS0VZIjoiWU9VUl9QRVJQTEVYSVRZX0FQSV9LRVlfSEVSRSIsIk9QRU5BSV9BUElfS0VZIjoiWU9VUl9PUEVOQUlfS0VZX0hFUkUiLCJHT09HTEVfQVBJX0tFWSI6IllPVVJfR09PR0xFX0tFWV9IRVJFIiwiTUlTVFJBTF9BUElfS0VZIjoiWU9VUl9NSVNUUkFMX0tFWV9IRVJFIiwiT1BFTlJPVVRFUl9BUElfS0VZIjoiWU9VUl9PUEVOUk9VVEVSX0tFWV9IRVJFIiwiWEFJX0FQSV9LRVkiOiJZT1VSX1hBSV9LRVlfSEVSRSJ9fQ=="
            filename="URL"
          />
          
          <blockquote className="border-l-2 border-marketing-border pl-4 text-marketing-muted text-sm my-4">
            <strong>Note:</strong> After clicking the link, you'll still need to add your API keys to the configuration. The link installs the MCP server with placeholder keys that you'll need to replace with your actual API keys.
          </blockquote>

          <h4 className="text-lg font-semibold mt-6 mb-3">Claude Code Quick Install</h4>
          <p className="text-marketing-muted text-sm mb-3">For Claude Code users:</p>
          
          <CodeBlock 
            code="claude mcp add taskmasterai -- npx -y @taskmasterai/cli taskmaster-mcp"
            filename="Terminal"
          />
          
          <p className="text-marketing-muted text-sm mt-4">Don't forget to add your API keys to the configuration:</p>
          <ul className="list-disc list-inside text-marketing-muted text-sm space-y-1 mt-2">
            <li>in the root .env of your Project</li>
            <li>in the "env" section of your mcp config for taskmasterai</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4">Installation Options</h3>

        <Accordion title="Option 1: MCP (Recommended)">
          <p className="text-marketing-muted mb-4">
            MCP (Model Control Protocol) lets you run TaskMaster AI directly from your editor.
          </p>

          <h4 className="font-semibold mb-3">1. Add your MCP config at the following path depending on your editor</h4>
          
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marketing-border">
                  <th className="text-left py-2 pr-4 text-marketing-muted font-medium">Editor</th>
                  <th className="text-left py-2 pr-4 text-marketing-muted font-medium">Scope</th>
                  <th className="text-left py-2 pr-4 text-marketing-muted font-medium">Linux/macOS Path</th>
                  <th className="text-left py-2 text-marketing-muted font-medium">Windows Path</th>
                </tr>
              </thead>
              <tbody className="text-marketing-muted">
                <tr className="border-b border-marketing-border">
                  <td className="py-2 pr-4">Cursor</td>
                  <td className="py-2 pr-4">Global</td>
                  <td className="py-2 pr-4 font-mono text-xs">~/.cursor/mcp.json</td>
                  <td className="py-2 font-mono text-xs">%USERPROFILE%\.cursor\mcp.json</td>
                </tr>
                <tr className="border-b border-marketing-border">
                  <td className="py-2 pr-4"></td>
                  <td className="py-2 pr-4">Project</td>
                  <td className="py-2 pr-4 font-mono text-xs">&lt;project_folder&gt;/.cursor/mcp.json</td>
                  <td className="py-2 font-mono text-xs">&lt;project_folder&gt;\.cursor\mcp.json</td>
                </tr>
                <tr className="border-b border-marketing-border">
                  <td className="py-2 pr-4">Windsurf</td>
                  <td className="py-2 pr-4">Global</td>
                  <td className="py-2 pr-4 font-mono text-xs">~/.codeium/windsurf/mcp_config.json</td>
                  <td className="py-2 font-mono text-xs">%USERPROFILE%\.codeium\windsurf\mcp_config.json</td>
                </tr>
                <tr className="border-b border-marketing-border">
                  <td className="py-2 pr-4">VS Code</td>
                  <td className="py-2 pr-4">Project</td>
                  <td className="py-2 pr-4 font-mono text-xs">&lt;project_folder&gt;/.vscode/mcp.json</td>
                  <td className="py-2 font-mono text-xs">&lt;project_folder&gt;\.vscode\mcp.json</td>
                </tr>
              </tbody>
            </table>
            </div>

          <h4 className="font-semibold mb-3">Manual Configuration</h4>
          <p className="text-marketing-muted text-sm mb-3">Cursor & Windsurf ( <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">mcpServers</code> )</p>
          
          <CodeBlock 
            code={`{
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
}`}
            filename="mcp.json"
            language="json"
          />

          <p className="text-marketing-muted text-sm mt-4">
            🔑 Replace <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">YOUR_*_KEY_HERE</code> with your real API keys. You can remove keys you don't use.
          </p>
        </Accordion>

        <Accordion title="Option 2: Using Command Line">
          <h4 className="text-lg font-semibold mb-4">Step 1: CLI Installation</h4>
          
          <CodeBlock 
            code={`# Install globally (recommended)
npm install -g @taskmasterai/cli

# OR install locally within your project
npm install @taskmasterai/cli`}
            filename="Terminal"
          />

          <h4 className="text-lg font-semibold mt-6 mb-4">Step 2: Login to TaskMaster AI</h4>
          <p className="text-marketing-muted mb-4">
            Before you can use TaskMaster AI, you need to login with your account credentials. This will automatically verify your license and sync your settings.
          </p>
          
          <CodeBlock 
            code={`# Interactive login
taskmaster login

# Or login with Google
taskmaster login --google

# Or provide credentials directly
taskmaster login --email your@email.com --password yourpassword`}
            filename="Terminal"
          />

          <TipBox type="info">
            Use the same email and password you used to sign up on the website. Your license is automatically verified during login.
          </TipBox>

          <h4 className="text-lg font-semibold mt-6 mb-4">Step 3: Verify Login</h4>
          <p className="text-marketing-muted mb-4">
            After logging in, verify your authentication and license status:
          </p>
          
          <CodeBlock 
            code="taskmaster whoami"
            filename="Terminal"
          />

          <p className="text-marketing-muted text-sm mt-4">
            This will show your email, user ID, login method, plan details, and license status.
          </p>

          <TipBox type="success">
            <strong>Pro/Enterprise Users:</strong> Hosted API keys are automatically configured - no additional setup needed!<br/>
            <strong>Plus Users:</strong> Configure your API keys in the <a href="/app/api-keys" className="text-marketing-link underline">Dashboard</a> and they'll sync automatically on login.
          </TipBox>

          <h4 className="text-lg font-semibold mt-6 mb-4">Step 4: Initialize a New Project</h4>
          
          <CodeBlock 
            code={`# If installed globally
taskmaster init

# If installed locally
npx taskmaster init

# Initialize project with specific rules
taskmaster init --rules cursor,windsurf,vscode`}
            filename="Terminal"
          />

          <p className="text-marketing-muted text-sm mt-4">
            This will prompt you for project details and set up a new project with the necessary files and structure.
          </p>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Authentication & License Management</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster AI uses secure authentication to verify your identity and automatically manage your license. Here are the authentication commands:
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marketing-border">
                <th className="text-left py-2 pr-4 text-marketing-muted font-medium">Command</th>
                <th className="text-left py-2 text-marketing-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-marketing-muted">
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login</td>
                <td className="py-2">Login with email/password (interactive)</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login --google</td>
                <td className="py-2">Login with Google (opens browser)</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster whoami</td>
                <td className="py-2">Show current user and license status</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster logout</td>
                <td className="py-2">Logout and clear session</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster usage</td>
                <td className="py-2">View AI operations usage and remaining limits</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster sync-keys</td>
                <td className="py-2">Sync API keys and hosted keys from your dashboard</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TipBox>
          Your license is automatically verified during login. Auth tokens are stored securely and auto-refresh before expiring. Upgrade your plan at any time from your <a href="/app/billing" className="text-marketing-link underline">Dashboard → Billing</a> page.
        </TipBox>
      </>
    )
  },
  'configuration': {
    title: 'Configuration',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Configure TaskMaster AI by setting up your API keys and model preferences.
        </p>

        <h3 className="text-xl font-semibold mb-4">Environment Variables</h3>
        <p className="text-marketing-muted mb-4">
          Create a <code className="text-marketing-text bg-marketing-elevated px-2 py-1 rounded">.env</code> file in your project root:
        </p>

        <CodeBlock 
          code={`ANTHROPIC_API_KEY=your_anthropic_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
OPENAI_API_KEY=your_openai_key_here`}
          filename=".env"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Configure Models</h3>
        <p className="text-marketing-muted mb-4">
          Run the interactive model setup:
        </p>

        <CodeBlock 
          code="taskmaster models --setup"
          filename="Terminal"
        />

        <p className="text-marketing-muted mb-4 mt-6">Or set models directly:</p>

        <CodeBlock 
          code={`# Set main model
taskmaster models --set-main claude-sonnet-4-20250514

# Set ask model
taskmaster models --set-research sonar-pro

# Set fallback model
taskmaster models --set-fallback gpt-4o-mini`}
          filename="Terminal"
        />
      </>
    )
  },
  'prd-creation': {
    title: 'PRD Creation and Parsing',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          A Product Requirements Document (PRD) outlines what you're building and why. TaskMaster AI parses your PRD and creates structured tasks automatically.
        </p>

        <h3 className="text-xl font-semibold mb-4">1. Write a PRD</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster provides two templates in <code className="text-marketing-text bg-marketing-elevated px-2 py-1 rounded">.taskmaster-ai/templates/</code>:
        </p>
        <ul className="list-disc list-inside text-marketing-muted space-y-1 mb-6">
          <li><code className="bg-marketing-elevated px-1.5 py-0.5 rounded">example_prd.txt</code> - Suitable for straightforward projects</li>
          <li><code className="bg-marketing-elevated px-1.5 py-0.5 rounded">example_prd_rpg.txt</code> - Designed for complex projects with multiple modules</li>
        </ul>

        <p className="text-marketing-muted mb-4">Create your PRD with the following structure:</p>

        <CodeBlock 
          code={`# Project Name

## Overview
Brief description of your project and its goals.

## Core Features
1. **Feature 1**: Description of what it does
2. **Feature 2**: Description of what it does
3. **Feature 3**: Description of what it does

## Technical Requirements
- Node.js backend with Express
- React frontend with TypeScript
- PostgreSQL database
- JWT authentication

## User Stories
- As a user, I want to...
- As an admin, I want to...

## API Endpoints
- POST /api/auth/login
- GET /api/users
- etc.`}
          filename="prd.md"
          language="markdown"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">2. Save the PRD</h3>
        <p className="text-marketing-muted mb-4">
          Place your PRD file in the <code className="text-marketing-text bg-marketing-elevated px-2 py-1 rounded">.taskmaster-ai/docs</code> folder. You can have multiple PRDs per project; ensure each is clearly named.
        </p>

        <h3 className="text-xl font-semibold mb-4 mt-8">3. Parse the PRD into Tasks</h3>
        <p className="text-marketing-muted mb-4">Run the parse command to generate tasks:</p>

        <CodeBlock 
          code={`# Parse PRD and generate tasks
taskmaster plan .taskmaster-ai/docs/prd.md

# Limit number of generated tasks
taskmaster plan .taskmaster-ai/docs/prd.md --num-tasks=10

# Append to existing tasks (for additional PRDs)
taskmaster plan .taskmaster-ai/docs/new-feature.md --append`}
          filename="Terminal"
        />

        <p className="text-marketing-muted my-4">
          This generates a structured <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">tasks.json</code> file containing:
        </p>
        <ul className="list-disc list-inside text-marketing-muted space-y-1 mb-6">
          <li>Tasks with clear titles and descriptions</li>
          <li>Dependencies between tasks</li>
          <li>Priority levels</li>
          <li>Test strategies for verification</li>
        </ul>

        <TipBox>
          TaskMaster will strictly adhere to specific requirements in the PRD (libraries, frameworks, tech stack) while filling in gaps where needed. Tasks are designed for the most direct implementation path.
        </TipBox>
      </>
    )
  },
  'tasks-setup': {
    title: 'Tasks Setup',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          After parsing your PRD, you'll want to analyze and break down your tasks before executing them. This involves two key steps: analyzing task complexity and breaking tasks down into steps.
        </p>

        <h3 className="text-xl font-semibold mb-4">1. Analyze Task Complexity</h3>
        <p className="text-marketing-muted mb-4">
          Understanding the complexity of each task helps determine which tasks need further breakdown. TaskMaster AI uses AI to assess complexity on a scale of 1-10 and recommends the optimal number of steps.
        </p>

        <CodeBlock 
          code={`# Basic complexity analysis
taskmaster assess

# With ask model for more informed analysis
taskmaster assess --ask`}
          filename="Terminal"
        />

        <p className="text-marketing-muted my-4">
          The generated report contains:
        </p>
        <ul className="list-disc list-inside text-marketing-muted space-y-1 mb-6">
          <li>Complexity analysis for each task (1-10 scale)</li>
          <li>Recommended number of steps</li>
          <li>AI-generated expansion prompts</li>
          <li>Ready-to-run expansion commands</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">2. View the Complexity Report</h3>
        <p className="text-marketing-muted mb-4">
          After generating the report, view it in a formatted display:
        </p>

        <CodeBlock 
          code="taskmaster report"
          filename="Terminal"
        />

        <p className="text-marketing-muted my-4">
          This shows tasks organized by complexity score, distribution statistics, and ready-to-use breakdown commands for each complex task.
        </p>

        <h3 className="text-xl font-semibold mb-4">3. Break Down Tasks into Steps</h3>
        <p className="text-marketing-muted mb-4">
          Break down complex tasks into manageable steps. It's recommended to break down all tasks at once:
        </p>

        <CodeBlock 
          code={`# Break down all pending tasks (recommended)
taskmaster breakdown --all

# Break down a specific task
taskmaster breakdown --id=5

# Break down with specific number of steps
taskmaster breakdown --id=5 --num=3

# Break down with additional context
taskmaster breakdown --id=5 --prompt="Focus on performance optimization"

# Force regenerate existing steps
taskmaster breakdown --id=5 --force

# Use ask model for better steps
taskmaster breakdown --id=5 --ask`}
          filename="Terminal"
        />

        <TipBox>
          When a complexity report exists, the <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">breakdown --all</code> command automatically uses the recommended step count and processes tasks in order of complexity (highest first).
        </TipBox>
      </>
    )
  },
  'executing-tasks': {
    title: 'Executing Tasks',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Now you're ready to start executing tasks. TaskMaster AI helps you work through tasks efficiently by managing dependencies, priorities, and progress tracking.
        </p>

        <h3 className="text-xl font-semibold mb-4">Daily Workflow</h3>
        <p className="text-marketing-muted mb-4">
          Follow this workflow cycle for efficient task execution:
        </p>

        <h4 className="text-lg font-medium mb-3 mt-6">1. View All Tasks</h4>
        <CodeBlock 
          code={`# List all tasks
taskmaster list

# Filter by status
taskmaster list --status=pending

# Include steps
taskmaster list --with-steps

# Show only tasks whose dependencies are satisfied
taskmaster list --ready

# Show only tasks that block others
taskmaster list --blocking

# Combine: high-impact tasks ready to work on
taskmaster list --ready --blocking

# List ready tasks across all tags
taskmaster list --ready --all-tags`}
          filename="Terminal" 
        />

        <h4 className="text-lg font-medium mb-3 mt-6">2. Find the Next Task</h4>
        <p className="text-marketing-muted mb-4">
          This command identifies the next task considering dependencies and priorities:
        </p>
        <CodeBlock code="taskmaster next" filename="Terminal" />

        <h4 className="text-lg font-medium mb-3 mt-6">3. View Task Details</h4>
        <p className="text-marketing-muted mb-4">
          Get comprehensive details about a specific task including status, priority, dependencies, and implementation notes:
        </p>
        <CodeBlock code="taskmaster show --id=1.1" filename="Terminal" />

        <h4 className="text-lg font-medium mb-3 mt-6">4. Execute the Task</h4>
        <p className="text-marketing-muted mb-4">
          Implement the task according to the provided details and guidelines. As you work, log your progress:
        </p>
        <CodeBlock 
          code={`# Add implementation notes
taskmaster log --id=1.1 --prompt="Implemented the database schema with the following tables..."

# Use ask for AI-powered insights
taskmaster log --id=1.1 --prompt="Need to optimize query performance" --ask`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">5. Mark Task Complete</h4>
        <p className="text-marketing-muted mb-4">
          After completing and verifying the task, update its status:
        </p>
        <CodeBlock 
          code={`# Mark as done
taskmaster set-status --id=1.1 --status=done

# Other status options: pending, in-progress, blocked, deferred`}
          filename="Terminal" 
        />

        <h4 className="text-lg font-medium mb-3 mt-6">6. Handle Implementation Changes</h4>
        <p className="text-marketing-muted mb-4">
          If your implementation differs from the original plan, update future tasks:
        </p>
        <CodeBlock 
          code={`# Update tasks from a specific ID onwards
taskmaster update --from=5 --prompt="We switched from MongoDB to PostgreSQL"`}
          filename="Terminal" 
        />

        <TipBox>
          Repeat this cycle: <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">next</code> → <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">show</code> → implement → <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">log</code> → <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">set-status</code>
        </TipBox>
      </>
    )
  },
  'api-keys': {
    title: 'API Keys Configuration',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          TaskMaster AI requires both an active subscription and API keys from your preferred AI providers. The subscription covers TaskMaster's orchestration and management features, while API keys provide access to AI model providers.
        </p>

        <TipBox type="warning">
          <strong>Note:</strong> API provider costs are separate from your TaskMaster AI subscription. You'll be billed directly by the AI provider (Anthropic, OpenAI, etc.) for model usage.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4">Required API Keys</h3>
        
        <Accordion title="ANTHROPIC_API_KEY (Recommended)" defaultOpen>
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Anthropic Claude models</li>
            <li>• <strong>Format:</strong> <code className="bg-marketing-elevated px-1 rounded">sk-ant-api03-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Models:</strong> Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus</li>
            <li>• <strong>Get Key:</strong> <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-marketing-link underline">Anthropic Console</a></li>
          </ul>
          <CodeBlock code="ANTHROPIC_API_KEY=sk-ant-api03-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="PERPLEXITY_API_KEY (Highly Recommended for Research)">
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Perplexity AI (Research features)</li>
            <li>• <strong>Format:</strong> <code className="bg-marketing-elevated px-1 rounded">pplx-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Purpose:</strong> Enables ask-backed task expansions and updates</li>
            <li>• <strong>Models:</strong> Perplexity Sonar models</li>
            <li>• <strong>Get Key:</strong> <a href="https://www.perplexity.ai/" target="_blank" rel="noopener noreferrer" className="text-marketing-link underline">Perplexity API</a></li>
          </ul>
          <CodeBlock code="PERPLEXITY_API_KEY=pplx-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="OPENAI_API_KEY">
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> OpenAI GPT models</li>
            <li>• <strong>Format:</strong> <code className="bg-marketing-elevated px-1 rounded">sk-proj-...</code> or <code className="bg-marketing-elevated px-1 rounded">sk-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Models:</strong> GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, O1 models</li>
            <li>• <strong>Get Key:</strong> <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="text-marketing-link underline">OpenAI Platform</a></li>
          </ul>
          <CodeBlock code="OPENAI_API_KEY=sk-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="GOOGLE_API_KEY">
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Google Gemini models</li>
            <li>• <strong>Models:</strong> Gemini Pro, Gemini Ultra</li>
            <li>• <strong>Get Key:</strong> <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-marketing-link underline">Google AI Studio</a></li>
          </ul>
          <CodeBlock code="GOOGLE_API_KEY=your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="DEEPSEEK_API_KEY">
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li className="flex items-center gap-2">
              <span>•</span>
              <strong>Provider:</strong>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 57.86 43.38" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4d6bfe" d="M57.26,3.65c-.61-.31-.88.27-1.24.57-.12.09-.22.22-.33.33-.89.98-1.94,1.62-3.31,1.54-1.99-.11-3.7.53-5.21,2.08-.32-1.92-1.39-3.06-3.01-3.8-.85-.38-1.7-.76-2.3-1.59-.41-.6-.53-1.26-.73-1.91-.14-.39-.27-.79-.71-.86-.48-.07-.67.34-.86.68-.75,1.41-1.05,2.96-1.02,4.52.07,3.53,1.53,6.34,4.43,8.34.33.22.42.45.31.79-.19.69-.43,1.35-.64,2.04-.13.44-.33.54-.79.35-1.59-.68-2.97-1.68-4.19-2.9-2.06-2.03-3.93-4.28-6.26-6.04-.54-.41-1.09-.79-1.66-1.15-2.37-2.35.32-4.28.94-4.51.65-.24.22-1.06-1.88-1.06-2.1.01-4.02.73-6.48,1.69-.35.14-.73.25-1.12.33-2.22-.43-4.53-.52-6.95-.25-4.54.52-8.17,2.71-10.84,6.44C.2,13.77-.55,18.88.37,24.2c.97,5.61,3.78,10.25,8.1,13.88,4.48,3.77,9.64,5.61,15.52,5.26,3.58-.21,7.56-.7,12.04-4.57,1.14.57,2.32.8,4.29.98,1.52.14,2.98-.08,4.12-.32,1.77-.38,1.65-2.05,1-2.36-5.19-2.46-4.05-1.46-5.09-2.27,2.64-3.19,6.62-6.49,8.18-17.2.12-.85.02-1.39,0-2.08-.01-.42.08-.58.55-.63,1.31-.15,2.57-.51,3.73-1.16,3.36-1.88,4.72-4.95,5.04-8.64.05-.57,0-1.15-.59-1.44ZM27.92,36.84c-5.03-4.03-7.47-5.36-8.48-5.3-.94.06-.78,1.15-.57,1.87.22.71.5,1.2.9,1.82.27.41.46,1.02-.28,1.48-1.62,1.02-4.44-.35-4.57-.41-3.28-1.97-6.02-4.57-7.96-8.13-1.86-3.42-2.95-7.09-3.13-11-.04-.95.23-1.28,1.15-1.46,1.22-.22,2.47-.27,3.69-.09,5.14.76,9.51,3.1,13.18,6.81,2.1,2.11,3.68,4.64,5.31,7.1,1.74,2.62,3.6,5.11,5.98,7.16.84.72,1.51,1.26,2.15,1.66-1.93.22-5.16.27-7.37-1.51ZM30.34,21.03c0-.42.33-.76.74-.76.1,0,.18.02.26.05.1.04.2.1.27.18.13.14.21.33.21.53,0,.42-.33.75-.75.75s-.73-.33-.73-.75ZM37.83,24.94c-.48.21-.96.38-1.42.4-.72.03-1.5-.26-1.92-.62-.66-.57-1.13-.88-1.33-1.87-.09-.42-.04-1.07.04-1.44.17-.8-.02-1.32-.58-1.79-.45-.38-1.03-.49-1.66-.49-.23,0-.45-.1-.61-.19-.27-.13-.48-.46-.28-.88.07-.13.39-.45.47-.51.85-.5,1.84-.34,2.76.04.85.35,1.49,1,2.41,1.92.95,1.11,1.12,1.41,1.65,2.24.43.65.81,1.32,1.08,2.09.16.47-.05.87-.61,1.1Z"/>
                </svg>
                DeepSeek models
              </span>
            </li>
            <li>• <strong>Format:</strong> <code className="bg-marketing-elevated px-1 rounded">sk-...</code></li>
            <li>• <strong>Models:</strong> DeepSeek-V3, DeepSeek-R1, DeepSeek Coder</li>
            <li>• <strong>Get Key:</strong> <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-marketing-link underline">DeepSeek Platform</a></li>
          </ul>
          <CodeBlock code="DEEPSEEK_API_KEY=sk-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="Other Providers (OpenRouter, xAI, Azure, Ollama, Mistral)">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">OPENROUTER_API_KEY</p>
              <CodeBlock code="OPENROUTER_API_KEY=your-key-here" filename=".env" />
            </div>
            <div>
              <p className="font-medium mb-2">MISTRAL_API_KEY</p>
              <CodeBlock code="MISTRAL_API_KEY=your-key-here" filename=".env" />
            </div>
            <div>
              <p className="font-medium mb-2">XAI_API_KEY (Grok)</p>
              <CodeBlock code="XAI_API_KEY=your-key-here" filename=".env" />
            </div>
            <div>
              <p className="font-medium mb-2">AZURE_OPENAI_API_KEY</p>
              <CodeBlock code={`AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/`} filename=".env" />
            </div>
            <div>
              <p className="font-medium mb-2">OLLAMA_API_KEY (Local)</p>
              <CodeBlock code="OLLAMA_BASE_URL=http://localhost:11434/api" filename=".env" />
            </div>
          </div>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Configuration Methods</h3>
        
        <Accordion title="Method 1: Environment File (.env)" defaultOpen>
          <p className="text-marketing-muted mb-4">Create a <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">.env</code> file in your project root:</p>
          <CodeBlock 
            code={`# Required - at least one
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
PERPLEXITY_API_KEY=pplx-your-key-here

# Optional - add as needed
OPENAI_API_KEY=sk-your-key-here
GOOGLE_API_KEY=your-key-here`}
            filename=".env"
          />
        </Accordion>

        <Accordion title="Method 2: System Environment Variables">
          <p className="text-marketing-muted mb-4">Set environment variables in your shell profile:</p>
          <CodeBlock 
            code={`# Add to ~/.bashrc, ~/.zshrc, or equivalent
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
export PERPLEXITY_API_KEY="pplx-your-key-here"`}
            filename="Shell"
          />
        </Accordion>

        <Accordion title="Method 3: MCP Server Configuration">
          <p className="text-marketing-muted mb-4">Add keys to your MCP config file:</p>
          <CodeBlock 
            code={`{
  "mcpServers": {
    "taskmasterai": {
      "command": "npx",
      "args": ["-y", "@taskmasterai/cli", "taskmaster-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here",
        "PERPLEXITY_API_KEY": "your-key-here"
      }
    }
  }
}`}
            filename="mcp.json"
            language="json"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Key Requirements</h3>
        
        <TipBox type="info">
          <strong>Minimum Requirement:</strong> At least one API key from any supported provider is required to use TaskMaster AI's AI-powered features.
        </TipBox>

        <TipBox type="warning">
          <strong>Security Best Practices:</strong> Never commit API keys to version control. Add <code className="bg-marketing-elevated px-1 rounded">.env</code> to your <code className="bg-marketing-elevated px-1 rounded">.gitignore</code> file.
        </TipBox>
      </>
    )
  },
  'license-usage': {
    title: 'License & Usage',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          TaskMaster AI requires a valid license to use AI-powered features. Your license determines your monthly AI operation limits.
        </p>

        <h3 className="text-xl font-semibold mb-4">License Activation</h3>
        <p className="text-marketing-muted mb-4">
          After purchasing a subscription, login to your TaskMaster AI account to activate your license:
        </p>

        <CodeBlock 
          code={`# Login to TaskMaster AI
taskmaster login

# Verify login and license status
taskmaster whoami`}
          filename="Terminal"
        />

        <TipBox type="info">
          Your license is automatically fetched and activated when you login. Use the same email and password you used to sign up on the website.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Authentication & License Commands</h3>
        
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marketing-border">
                <th className="text-left py-2 pr-4 text-marketing-muted font-medium">Command</th>
                <th className="text-left py-2 text-marketing-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-marketing-muted">
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login</td>
                <td className="py-2">Login with email/password (interactive)</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login --google</td>
                <td className="py-2">Login with Google (opens browser)</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster whoami</td>
                <td className="py-2">Show current user and license status</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster logout</td>
                <td className="py-2">Logout and clear session</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster usage</td>
                <td className="py-2">View current AI operations count and remaining limits for the billing period</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster sync-keys</td>
                <td className="py-2">Sync API keys and hosted keys from your dashboard</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-8">Usage Tracking</h3>
        <p className="text-marketing-muted mb-4">
          Each AI-powered operation counts toward your monthly limit. Check your usage anytime:
        </p>

        <CodeBlock 
          code="taskmaster usage"
          filename="Terminal"
        />

        <p className="text-marketing-muted mb-4 mt-4">
          AI operations that count toward your limit include:
        </p>

        <ul className="list-disc list-inside space-y-2 text-marketing-muted mb-6">
          <li><code className="bg-marketing-elevated px-1 rounded">plan</code> - Parsing a PRD to generate tasks</li>
          <li><code className="bg-marketing-elevated px-1 rounded">breakdown</code> - Breaking down tasks into steps</li>
          <li><code className="bg-marketing-elevated px-1 rounded">new</code> - Adding a task with AI-generated content</li>
          <li><code className="bg-marketing-elevated px-1 rounded">edit</code> - Updating a task with AI assistance</li>
          <li><code className="bg-marketing-elevated px-1 rounded">log</code> - Updating a step with AI assistance</li>
          <li><code className="bg-marketing-elevated px-1 rounded">assess</code> - Analyzing task complexity</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-8">Dashboard Sync</h3>
        <p className="text-marketing-muted mb-4">
          Configure your API keys and model preferences in your dashboard, then sync them to the CLI:
        </p>

        <CodeBlock 
          code={`# Configure keys in dashboard, then sync
taskmaster sync-keys

# This syncs:
# - API keys from your dashboard
# - Hosted keys (Pro/Enterprise)
# - Model configuration`}
          filename="Terminal"
        />

        <TipBox>
          Dashboard sync is optional. You can also configure API keys directly via environment variables or <code className="bg-marketing-elevated px-1 rounded">.env</code> files.
        </TipBox>

        <p className="text-marketing-muted">
          Upgrade your plan anytime from your <a href="/app/billing" className="text-marketing-link underline">Dashboard → Billing</a> page. Usage resets at the start of each billing cycle.
        </p>
      </>
    )
  },
  'faq': {
    title: 'FAQ',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <div className="space-y-6">
          <Accordion title="What is TaskMaster AI?">
            <p className="text-marketing-muted">
              TaskMaster AI is an AI-powered task management system that helps developers break down complex projects into manageable tasks and execute them efficiently using AI assistance.
            </p>
          </Accordion>
          
          <Accordion title="Which AI models are supported?">
            <p className="text-marketing-muted">
              TaskMaster AI supports Claude (Anthropic), GPT (OpenAI), Gemini (Google), Perplexity, Grok (xAI), Mistral, DeepSeek, OpenRouter, Azure OpenAI, and local Ollama models.
            </p>
          </Accordion>
          
          <Accordion title="How much does it cost?">
            <p className="text-marketing-muted">
              TaskMaster AI is a paid service with affordable subscription plans. Check our <a href="/pricing" className="text-marketing-link hover:underline">pricing page</a> for current plans and features. You'll also pay for AI API usage (most users spend $5-10 per month on API costs). TaskMaster AI shows the cost of each command after it runs.
            </p>
          </Accordion>
          
          <Accordion title="Can I use it with my IDE?">
            <p className="text-marketing-muted">
              Yes! TaskMaster AI integrates with IDEs via the MCP (Model Context Protocol). It works great with Cursor, VS Code with Copilot, Windsurf, and other compatible editors.
            </p>
          </Accordion>

          <Accordion title="Do I need multiple API keys?">
            <p className="text-marketing-muted">
              No, you only need one API key to get started. However, we recommend using Anthropic for the main model and Perplexity for ask operations for the best experience.
            </p>
          </Accordion>
          </div>
      </>
    )
  },
  'contribute': {
    title: 'Feedback & Support',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          We're committed to making TaskMaster AI the best AI-powered development tool. Your feedback helps us improve the product for everyone.
        </p>

        <h3 className="text-xl font-semibold mb-4">💬 Get in Touch</h3>
        <p className="text-marketing-muted mb-6">
          Have questions, feedback, or need help? We'd love to hear from you.
        </p>

        <div className="marketing-panel border rounded-xl hover:border-marketing-border/60 p-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <FontAwesomeIcon icon={faComments} className="w-6 h-6 text-marketing-link" />
            <span className="font-semibold text-lg">Contact Support</span>
          </div>
          <p className="text-marketing-muted mb-4">
            Reach out to our team for any questions, bug reports, or feature requests.
          </p>
          <a 
            href="mailto:taskmasteroneai@gmail.com"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors"
          >
            <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
            <span>taskmasteroneai@gmail.com</span>
          </a>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-10">🐛 Report an Issue</h3>
        
        <Accordion title="Bug Reports" defaultOpen>
          <p className="text-marketing-muted mb-3">
            When reporting a bug, please include the following information to help us resolve it quickly:
          </p>
          <ul className="text-marketing-muted space-y-2">
            <li>• <strong>TaskMaster version:</strong> Run <code className="bg-marketing-elevated px-1 rounded">taskmaster --version</code></li>
            <li>• <strong>Node.js version:</strong> Run <code className="bg-marketing-elevated px-1 rounded">node --version</code></li>
            <li>• <strong>Operating System:</strong> macOS, Windows, or Linux</li>
            <li>• <strong>Steps to reproduce:</strong> What you did before the error occurred</li>
            <li>• <strong>Expected behavior:</strong> What you expected to happen</li>
            <li>• <strong>Actual behavior:</strong> What actually happened</li>
            <li>• <strong>Error messages:</strong> Any error logs or screenshots</li>
          </ul>
        </Accordion>

        <Accordion title="Feature Requests">
          <p className="text-marketing-muted mb-3">
            We love hearing ideas for new features! When suggesting a feature, please include:
          </p>
          <ul className="text-marketing-muted space-y-2">
            <li>• <strong>Clear description:</strong> What the feature should do</li>
            <li>• <strong>Use case:</strong> Why you need this feature</li>
            <li>• <strong>Expected workflow:</strong> How you envision using it</li>
            <li>• <strong>Priority:</strong> How important this is to your workflow</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-10">📋 Frequently Asked Questions</h3>

        <Accordion title="How do I upgrade my plan?">
          <p className="text-marketing-muted">
            Visit the <strong>Billing</strong> section in your dashboard to view and upgrade your subscription plan. You can upgrade at any time and the change takes effect immediately.
          </p>
        </Accordion>

        <Accordion title="How do I get my API key?">
          <p className="text-marketing-muted">
            After signing up, go to the <strong>API Keys</strong> section in your dashboard. You can generate a new API key there. Keep your API key secure and don't share it publicly.
          </p>
        </Accordion>

        <Accordion title="Can I request a custom enterprise plan?">
          <p className="text-marketing-muted">
            Yes! For custom enterprise solutions, volume licensing, or special requirements, please contact our sales team at <a href="mailto:taskmasteroneai@gmail.com" className="text-marketing-link hover:underline">taskmasteroneai@gmail.com</a>.
          </p>
        </Accordion>

        <Accordion title="What AI providers are supported?">
          <p className="text-marketing-muted">
            TaskMaster AI supports multiple AI providers including Anthropic (Claude), OpenAI, Google (Gemini), Mistral, OpenRouter, xAI, and local Ollama models. You can configure your preferred models in the settings.
          </p>
        </Accordion>

        <div className="mt-10">
          <TipBox type="info">
            <strong>We typically respond within 24-48 hours.</strong> For urgent issues affecting your production workflow, please mark your email as urgent.
          </TipBox>
        </div>
      </>
    )
  },
  'cli-commands': {
    title: 'CLI Commands',
    breadcrumb: 'Technical Capabilities',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Complete reference of all TaskMaster AI CLI commands organized by category.
        </p>

        <h3 className="text-xl font-semibold mb-4">Project Setup</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster init [-n, --name] [-d, --description] [-y, --yes]</code>
            <p className="text-sm text-marketing-muted mt-1">Initialize TaskMaster AI in the current project. Creates .taskmaster-ai directory with config and tasks files.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster plan &lt;file&gt; [-n, --num-tasks] [-f, --force] [--append] [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Parse a PRD file to generate tasks. Use --append to add to existing tasks, --force to overwrite.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster sync-keys</code>
            <p className="text-sm text-marketing-muted mt-1">Sync API keys and hosted keys from your TaskMaster dashboard.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Viewing</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster list [-s, --status] [--with-steps] [--ready] [--blocking] [--all-tags]</code>
            <p className="text-sm text-marketing-muted mt-1">Display all tasks in a table format. Filter by status (comma-separated), include steps, show only ready tasks (dependencies satisfied), show only blocking tasks (that others depend on), or list across all tags.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster next</code>
            <p className="text-sm text-marketing-muted mt-1">Show the next task to work on based on dependencies and priorities.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster show &lt;id&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Display detailed information for a task or step (e.g., 1 or 1.2 for step).</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Management</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster new -p, --prompt &lt;text&gt; [-d, --dependencies] [--priority] [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Create a new task using AI. Specify dependencies and priority level.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster set-status -i, --id &lt;id&gt; -s, --status &lt;status&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Update task status (pending, in-progress, done, blocked, cancelled, deferred). Supports comma-separated IDs.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster log -i, --id &lt;id&gt; -p, --prompt &lt;notes&gt; [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Append timestamped notes to a step (e.g., 1.2). Useful for tracking implementation progress.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster edit -i, --id &lt;id&gt; -p, --prompt &lt;text&gt; [--append] [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Update a task with new information. Use --append to add notes instead of regenerating.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster update --from &lt;id&gt; -p, --prompt &lt;changes&gt; [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Batch update multiple tasks from a specific ID onwards with new context.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster remove-task -i, --id &lt;id&gt; [-y, --yes]</code>
            <p className="text-sm text-marketing-muted mt-1">Remove a task or step permanently. Use -y to skip confirmation.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Expansion</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster breakdown -i, --id &lt;id&gt; [-n, --num] [-p, --prompt] [--force] [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Break down a task into steps using AI. Use --force to replace existing steps.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster breakdown --all [-n, --num] [-p, --prompt] [--force] [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Break down all pending tasks at once that don't have steps.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster assess [--ask]</code>
            <p className="text-sm text-marketing-muted mt-1">Analyze task complexity and generate recommendations for step counts. Saves report to .taskmaster-ai/reports/.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster report [-f, --file]</code>
            <p className="text-sm text-marketing-muted mt-1">Display the task complexity analysis report in a readable table format.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster clear-steps -i, --id &lt;id&gt; | --all</code>
            <p className="text-sm text-marketing-muted mt-1">Remove all steps from a specific task or all tasks.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster scope-up -i, --id &lt;id&gt; [-s, --strength] [-p, --prompt] [-r, --research]</code>
            <p className="text-sm text-marketing-muted mt-1">Increase the scope of a task via AI. Strength: light, regular, aggressive.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster scope-down -i, --id &lt;id&gt; [-s, --strength] [-p, --prompt]</code>
            <p className="text-sm text-marketing-muted mt-1">Decrease the scope of a task by removing pending subtasks. Strength controls how aggressively to trim.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Organization</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster move --from &lt;id&gt; --to &lt;id&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Move a task or step to a new position. Supports comma-separated IDs for batch moves.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster add-step -p, --parent &lt;id&gt; -t, --title &lt;text&gt; [-d, --description] [--details] [--dependencies] [-s, --status]</code>
            <p className="text-sm text-marketing-muted mt-1">Add a step to a parent task manually without AI.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster generate [-o, --output]</code>
            <p className="text-sm text-marketing-muted mt-1">Generate individual markdown files for each task.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Dependencies</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster link -i, --id &lt;id&gt; -d, --depends-on &lt;id&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Add a dependency between tasks.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster unlink -i, --id &lt;id&gt; -d, --depends-on &lt;id&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Remove a dependency between tasks.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster check-links</code>
            <p className="text-sm text-marketing-muted mt-1">Validate all task dependencies for issues like circular references or missing tasks.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster fix-links</code>
            <p className="text-sm text-marketing-muted mt-1">Automatically fix dependency issues in your tasks.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Contexts (Tags)</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster contexts [--show-metadata]</code>
            <p className="text-sm text-marketing-muted mt-1">List all contexts with task counts and completion status.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster context-add &lt;name&gt; [--from-branch] [--copy-from-current] [--copy-from &lt;context&gt;] [-d, --description]</code>
            <p className="text-sm text-marketing-muted mt-1">Create a new context. Use --from-branch to derive name from current git branch.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster context &lt;name&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Switch to a different context.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster delete-context &lt;name&gt; [-y, --yes]</code>
            <p className="text-sm text-marketing-muted mt-1">Delete a context and all its tasks. Use -y to skip confirmation.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster rename-context &lt;oldName&gt; &lt;newName&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Rename an existing context.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster clone &lt;source&gt; &lt;target&gt; [-d, --description]</code>
            <p className="text-sm text-marketing-muted mt-1">Copy a context with all its tasks to a new context.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">AI Research</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster ask &lt;query&gt; [--save-to &lt;id&gt;] [--tree] [--files &lt;paths&gt;] [--detail &lt;level&gt;]</code>
            <p className="text-sm text-marketing-muted mt-1">Perform AI-powered research. Save results to a task or include project context.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Usage & Configuration</h3>
        <div className="space-y-3 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster usage</code>
            <p className="text-sm text-marketing-muted mt-1">View AI operations usage count, plan limits, and dashboard sync status.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster models</code>
            <p className="text-sm text-marketing-muted mt-1">Display current AI model configuration (main, ask, fallback) and API key status.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster models --set-main &lt;model&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Set the main AI model for task generation.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster models --set-research &lt;model&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Set the ask model for research-backed operations.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster models --set-fallback &lt;model&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Set the fallback model if primary fails.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster lang [--response &lt;code&gt;] [--setup]</code>
            <p className="text-sm text-marketing-muted mt-1">View or set the response language for AI output (e.g. en, es, ja).</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster sync-readme [--with-subtasks] [-s, --status]</code>
            <p className="text-sm text-marketing-muted mt-1">Sync task list into your project README.md between marker comments.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster rules &lt;add|remove&gt; &lt;cursor|windsurf|vscode&gt; [-f, --force]</code>
            <p className="text-sm text-marketing-muted mt-1">Add or remove IDE rule profiles for Cursor, Windsurf, or VS Code.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster migrate [-f, --force] [-y, --yes] [--dry-run]</code>
            <p className="text-sm text-marketing-muted mt-1">Migrate project layout from legacy .taskmaster to .taskmaster-ai directory.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster --no-banner &lt;command&gt;</code>
            <p className="text-sm text-marketing-muted mt-1">Suppress the startup ASCII banner (useful in scripts and CI).</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Autopilot (TDD Workflow)</h3>
        <div className="space-y-3">
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot start &lt;taskId&gt; [--max-attempts] [--force] [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Start a TDD workflow for a task. Creates a git branch and begins the red-green-refactor cycle.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot next [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Get the next action to perform in the current TDD phase.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot status [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Get current workflow status including phase, progress, and current step.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot resume [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Resume an interrupted workflow from where you left off.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot complete --results &lt;json&gt; [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Complete the current TDD phase with test results.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot commit [--message] [--files] [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Commit changes and advance to the next step.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot finalize [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Finalize the workflow after all steps are complete.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <code className="text-sm text-marketing-link font-mono">taskmaster autopilot abort [--force] [--json]</code>
            <p className="text-sm text-marketing-muted mt-1">Abort the current workflow. Use --force to skip confirmation.</p>
          </div>
        </div>
      </>
    )
  },
  'mcp-tools': {
    title: 'MCP Tools',
    breadcrumb: 'Technical Capabilities',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          This document provides an overview of the MCP (Model Context Protocol) interface for TaskMaster AI. The MCP interface exposes the application's core functionalities as a set of tools that can be called by AI editors like Cursor, Windsurf, and Claude Code.
        </p>

        <h3 className="text-xl font-semibold mb-4">Core Concepts</h3>
        <p className="text-marketing-muted mb-4">
          The MCP interface is built on top of the <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">fastmcp</code> library and registers a set of tools that correspond to the core functionalities of TaskMaster AI.
        </p>
        <p className="text-marketing-muted mb-6">
          Each tool is defined with a name, description, and parameters validated using the <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">zod</code> library. The <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">execute</code> function of each tool calls the corresponding core logic function.
        </p>

        <h3 className="text-xl font-semibold mb-4">Configurable Tool Loading</h3>
        <p className="text-marketing-muted mb-4">
          To optimize LLM context usage, you can control which tools are loaded using the <code className="text-marketing-text bg-marketing-elevated px-2 py-1 rounded">TASK_MASTER_TOOLS</code> environment variable. This is particularly useful when working with LLMs that have context limits.
        </p>

        <h4 className="text-lg font-medium mb-3">Configuration Modes</h4>

        <div className="space-y-4 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">core</span>
              <span className="text-xs bg-marketing-link/20 text-marketing-link px-2 py-0.5 rounded">7 tools - Default/Lean Mode</span>
            </div>
            <p className="text-sm text-marketing-muted mb-2">Essential tools for daily development. Ideal for minimal context usage.</p>
            <ul className="text-sm text-marketing-muted space-y-1">
              <li>• <code className="bg-marketing-elevated px-1 rounded">list</code> - List all tasks</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">next</code> - Find the next task to work on</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">show</code> - Get detailed task information</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">set_status</code> - Update task status</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">log</code> - Add implementation notes</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">plan</code> - Generate tasks from PRD</li>
              <li>• <code className="bg-marketing-elevated px-1 rounded">breakdown</code> - Break down tasks into steps</li>
            </ul>
            <p className="text-xs text-marketing-muted mt-3">You can also use "lean" as an alias for "core". If TASK_MASTER_TOOLS is not set, core tools are loaded by default.</p>
          </div>

          <div className="marketing-panel border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">standard</span>
              <span className="text-xs bg-marketing-elevated text-marketing-muted px-2 py-0.5 rounded">15 tools</span>
            </div>
            <p className="text-sm text-marketing-muted mb-2">Core tools plus frequently used operations.</p>
            <p className="text-sm text-marketing-muted">All core tools plus: <code className="bg-marketing-elevated px-1 rounded">init</code>, <code className="bg-marketing-elevated px-1 rounded">assess</code>, <code className="bg-marketing-elevated px-1 rounded">breakdown_all</code>, <code className="bg-marketing-elevated px-1 rounded">add_step</code>, <code className="bg-marketing-elevated px-1 rounded">remove_task</code>, <code className="bg-marketing-elevated px-1 rounded">new</code>, <code className="bg-marketing-elevated px-1 rounded">report</code>, <code className="bg-marketing-elevated px-1 rounded">link</code></p>
          </div>
          
          <div className="marketing-panel border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">all</span>
              <span className="text-xs bg-marketing-elevated text-marketing-muted px-2 py-0.5 rounded">45 tools - Full Mode</span>
            </div>
            <p className="text-sm text-marketing-muted mb-2">Full functionality including all task management, analysis, contexts, and autopilot tools.</p>
            <p className="text-sm text-marketing-muted">Includes all standard tools plus: context/tag management, dependency validation, research, autopilot (TDD workflow), and configuration tools.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Choosing the Right Configuration</h3>
        <ul className="space-y-2 text-marketing-muted mb-6">
          <li>• Use <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">core</code>: Default setting, ideal for basic task management or when context limits are strict</li>
          <li>• Use <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">standard</code>: When you need full functionality including task creation and analysis</li>
          <li>• Use <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">all</code>: When you need full functionality including contexts, autopilot, and advanced features</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-8">Tool Categories</h3>
        <p className="text-marketing-muted mb-4">The MCP tools are organized into the following categories:</p>

        <Accordion title="1. Task Information and Status" defaultOpen>
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">list</code> - Lists all tasks with optional status filter</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">show</code> - Shows the details of a specific task or step</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">next</code> - Shows the next task to work on based on dependencies</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">set_status</code> - Sets the status of a task or step</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">log</code> - Appends timestamped notes to a step</li>
          </ul>
        </Accordion>

        <Accordion title="2. Task Management">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">new</code> - Creates a new task with AI assistance</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">edit</code> - Updates a task with new information</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">update</code> - Batch updates multiple tasks from a specific ID</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">remove_task</code> - Removes a task or step</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">add_step</code> - Adds a step to a parent task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">remove_step</code> - Removes a step from a task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">clear_steps</code> - Clears all steps from a task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">move</code> - Moves a task to a new position in the hierarchy</li>
          </ul>
        </Accordion>

        <Accordion title="3. Task Analysis and Breakdown">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">plan</code> - Parses a PRD to generate tasks</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">breakdown</code> - Breaks down a task into steps using AI</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">breakdown --all</code> - Breaks down all pending tasks at once</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">assess</code> - Analyzes task complexity</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">report</code> - Displays the complexity analysis report</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">ask</code> - Performs AI-powered research with project context</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">generate</code> - Generates individual task markdown files</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">init</code> - Initializes a new TaskMaster AI project</li>
          </ul>
        </Accordion>

        <Accordion title="4. Links (Dependencies)">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">link</code> - Adds a dependency link to a task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">unlink</code> - Removes a dependency link from a task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">check_links</code> - Validates all task dependencies for issues</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">fix_links</code> - Automatically fixes dependency issues</li>
          </ul>
        </Accordion>

        <Accordion title="5. Contexts">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">contexts</code> - Lists all available contexts</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">context-add</code> - Creates a new context</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">delete-context</code> - Deletes a context and all its tasks</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">context</code> - Switches to a different context</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">rename-context</code> - Renames an existing context</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">clone</code> - Copies a context with all its tasks</li>
          </ul>
        </Accordion>

        <Accordion title="6. Autopilot (TDD Workflow)">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_start</code> - Starts a TDD workflow for a task</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_resume</code> - Resumes an interrupted workflow</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_next</code> - Gets the next action to perform</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_status</code> - Gets current workflow status</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_complete</code> - Completes the current TDD phase</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_commit</code> - Commits changes and advances to next step</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_finalize</code> - Finalizes the workflow</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_abort</code> - Aborts the current workflow</li>
          </ul>
        </Accordion>

        <Accordion title="7. Configuration">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">models</code> - Views or configures AI model settings</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">get_config</code> - Retrieves current project configuration</li>
          </ul>
        </Accordion>
      </>
    )
  },
  'task-structure': {
    title: 'Task Structure',
    breadcrumb: 'Technical Capabilities',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Tasks in TaskMaster AI are structured with several key fields to effectively manage and execute projects. These fields are defined in the <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">tasks.json</code> file.
        </p>

        <h3 className="text-xl font-semibold mb-4">Task Fields in tasks.json</h3>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-marketing-border">
                <th className="text-left py-2 pr-4 text-marketing-text font-medium">Field</th>
                <th className="text-left py-2 text-marketing-text font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-marketing-muted">
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">id</td>
                <td className="py-2">Unique identifier for the task</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">title</td>
                <td className="py-2">Brief, descriptive title of the task</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">description</td>
                <td className="py-2">Overview of what the task involves</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">status</td>
                <td className="py-2">Current state (pending, done, in-progress, etc.)</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">dependencies</td>
                <td className="py-2">Array of prerequisite task IDs that must be completed first</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">priority</td>
                <td className="py-2">Importance level: high, medium, or low</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">details</td>
                <td className="py-2">Implementation instructions and additional information</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">testStrategy</td>
                <td className="py-2">How to verify successful completion of the task</td>
              </tr>
              <tr className="border-b border-marketing-border">
                <td className="py-2 pr-4 font-mono text-marketing-link">steps</td>
                <td className="py-2">Array of nested steps related to the main task</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold mb-4">Example Task Structure</h3>

        <CodeBlock 
          code={`{
  "id": 1,
  "title": "Initialize Repository",
  "description": "Create a new repository, set up initial structure.",
  "status": "pending",
  "dependencies": [],
  "priority": "high",
  "details": "Use GitHub client ID/secret, handle callback...",
  "testStrategy": "Deploy and confirm 'Hello World' response.",
  "steps": [
    {
      "id": 1,
      "title": "Configure OAuth",
      "description": "Set up OAuth for authentication.",
      "status": "pending",
      "dependencies": [],
      "details": "Use OAuth 2.0 protocol...",
      "testStrategy": "Test login flow with OAuth."
    }
  ]
}`}
          filename="tasks.json"
          language="json"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Task ID Format</h3>
        <ul className="space-y-2 text-marketing-muted mb-6">
          <li>• <strong>Main tasks:</strong> <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">1</code>, <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">2</code>, <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">3</code></li>
          <li>• <strong>Steps:</strong> <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">1.1</code>, <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">1.2</code>, <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">2.1</code></li>
          <li>• <strong>Nested steps:</strong> <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">1.1.1</code>, <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">1.1.2</code></li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">Status Values</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[
            { status: 'pending', desc: 'Ready to work on' },
            { status: 'in-progress', desc: 'Currently being worked on' },
            { status: 'done', desc: 'Completed and verified' },
            { status: 'blocked', desc: 'Waiting on external factors' },
            { status: 'deferred', desc: 'Postponed' },
            { status: 'cancelled', desc: 'No longer needed' },
          ].map(({ status, desc }) => (
            <div key={status} className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <code className="text-sm text-marketing-link">{status}</code>
              <p className="text-xs text-marketing-muted mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">Task File Format</h3>
        <p className="text-marketing-muted mb-4">
          Individual task files follow this format:
        </p>
        <CodeBlock 
          code={`# Task ID: 1
# Title: Initialize Repository
# Status: pending
# Dependencies: None
# Priority: high
# Description: Create a new repository, set up initial structure.

# Details:
Use GitHub client ID/secret, handle callback...

# Test Strategy:
Deploy and confirm 'Hello World' response.`}
          filename="task-001.txt"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Features in Detail</h3>

        <Accordion title="Analyzing Task Complexity">
          <p className="text-marketing-muted mb-3">The <code className="bg-marketing-elevated px-1 rounded">assess</code> command:</p>
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• Analyzes each task using AI to assess complexity on a scale of 1-10</li>
            <li>• Recommends optimal number of steps based on configured DEFAULT_STEPS</li>
            <li>• Generates tailored prompts for breaking down each task</li>
            <li>• Creates a comprehensive JSON report with ready-to-use commands</li>
            <li>• Saves the report to <code className="bg-marketing-elevated px-1 rounded">scripts/task-report.json</code> by default</li>
          </ul>
          <p className="text-marketing-muted mb-2">The generated report contains:</p>
          <ul className="text-marketing-muted space-y-1">
            <li>• Complexity analysis for each task (scored 1-10)</li>
            <li>• Recommended number of steps based on complexity</li>
            <li>• AI-generated expansion prompts customized for each task</li>
            <li>• Ready-to-run expansion commands</li>
          </ul>
        </Accordion>

        <Accordion title="Viewing Complexity Report">
          <p className="text-marketing-muted mb-3">The <code className="bg-marketing-elevated px-1 rounded">report</code> command:</p>
          <ul className="text-marketing-muted space-y-1">
            <li>• Displays a formatted, easy-to-read version of the complexity analysis report</li>
            <li>• Shows tasks organized by complexity score (highest to lowest)</li>
            <li>• Provides complexity distribution statistics (low, medium, high)</li>
            <li>• Highlights tasks recommended for expansion based on threshold score</li>
            <li>• Includes ready-to-use expansion commands for each complex task</li>
            <li>• If no report exists, offers to generate one on the spot</li>
          </ul>
        </Accordion>

        <Accordion title="Smart Task Expansion">
          <p className="text-marketing-muted mb-3">The <code className="bg-marketing-elevated px-1 rounded">breakdown</code> command automatically checks for and uses the complexity report:</p>
          <p className="text-marketing-muted mb-3"><strong>When a complexity report exists:</strong></p>
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• Tasks are automatically broken down using the recommended step count and prompts</li>
            <li>• When breaking down all tasks, they're processed in order of complexity (highest first)</li>
            <li>• Research-backed generation is preserved from the complexity analysis</li>
            <li>• You can still override recommendations with explicit command-line options</li>
          </ul>
          <p className="text-marketing-muted mb-2"><strong>Example workflow:</strong></p>
          <CodeBlock 
            code={`# Generate the complexity analysis report with ask
taskmaster assess --ask

# Review the report in a readable format
taskmaster report

# Break down tasks using the optimized recommendations
taskmaster breakdown --id=8
# or break down all tasks
taskmaster breakdown --all`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="Finding the Next Task">
          <p className="text-marketing-muted mb-3">The <code className="bg-marketing-elevated px-1 rounded">next</code> command:</p>
          <ul className="text-marketing-muted space-y-1 mb-4">
            <li>• Identifies tasks that are pending/in-progress and have all dependencies satisfied</li>
            <li>• Prioritizes tasks by priority level, dependency count, and task ID</li>
            <li>• Displays comprehensive information about the selected task</li>
          </ul>
          <p className="text-marketing-muted mb-2">Information displayed includes:</p>
          <ul className="text-marketing-muted space-y-1">
            <li>• Basic task details (ID, title, priority, dependencies)</li>
            <li>• Implementation details</li>
            <li>• Steps (if they exist)</li>
            <li>• Contextual suggested actions</li>
          </ul>
        </Accordion>

        <Accordion title="Viewing Specific Task Details">
          <p className="text-marketing-muted mb-3">The <code className="bg-marketing-elevated px-1 rounded">show</code> command:</p>
          <ul className="text-marketing-muted space-y-1">
            <li>• Displays comprehensive details about a specific task or step</li>
            <li>• Shows task status, priority, dependencies, and detailed implementation notes</li>
            <li>• For parent tasks, displays all steps and their status</li>
            <li>• For steps, shows parent task relationship</li>
            <li>• Provides contextual action suggestions based on the task's state</li>
            <li>• Works with both regular tasks and steps (using the format <code className="bg-marketing-elevated px-1 rounded">taskId.stepId</code>)</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Best Practices for AI-Driven Development</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">📝 Detailed PRD</p>
            <p className="text-sm text-marketing-muted">The more detailed your PRD, the better the generated tasks will be.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">👀 Review Tasks</p>
            <p className="text-sm text-marketing-muted">After parsing the PRD, review tasks to ensure they make sense and have appropriate dependencies.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">📊 Analyze Complexity</p>
            <p className="text-sm text-marketing-muted">Use complexity analysis to identify which tasks should be broken down further.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">⛓️ Follow Dependencies</p>
            <p className="text-sm text-marketing-muted">Always respect task dependencies - the agent will help with this.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">🔄 Update As You Go</p>
            <p className="text-sm text-marketing-muted">If implementation diverges from the plan, use update command to keep future tasks aligned.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">📦 Break Down Tasks</p>
            <p className="text-sm text-marketing-muted">Use breakdown command to break down complex tasks into manageable steps.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">🔄 Regenerate Files</p>
            <p className="text-sm text-marketing-muted">After updates to tasks.json, regenerate task files to keep them in sync.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">💬 Provide Context</p>
            <p className="text-sm text-marketing-muted">When asking the agent for help with a task, provide context about what you're achieving.</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="font-medium text-marketing-link mb-2">✅ Validate Dependencies</p>
            <p className="text-sm text-marketing-muted">Periodically run check-links to check for invalid or circular dependencies.</p>
          </div>
        </div>
      </>
    )
  },
  'advanced-usage': {
    title: 'Advanced Usage',
    breadcrumb: 'Best Practices',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Advanced patterns and workflows for power users to maximize productivity with TaskMaster AI.
        </p>

        <h3 className="text-xl font-semibold mb-4">Dashboard Sync Workflow</h3>
        <p className="text-marketing-muted mb-4">
          Configure your API keys and model preferences once in the dashboard, then sync them across all your projects:
        </p>
        
        <CodeBlock 
          code={`# After configuring keys in https://taskmaster.one/app/api-keys
taskmaster sync-keys

# This syncs:
# - All your API keys (Anthropic, OpenAI, Google, etc.)
# - Hosted keys (Pro/Enterprise - no API keys needed!)
# - Model configuration`}
          filename="Terminal"
        />

        <TipBox>
          Dashboard sync is especially useful when working across multiple machines or projects. Configure once, sync everywhere.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Usage Monitoring</h3>
        <p className="text-marketing-muted mb-4">
          Keep track of your AI operations to stay within your plan limits:
        </p>
        
        <CodeBlock 
          code={`# Check your current usage
taskmaster usage

# View breakdown of operations:
# - Tasks from PRD
# - Tasks broken down  
# - Tasks added
# - Complexity analyses`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">AI-Driven Development Workflow</h3>
        
        <Accordion title="1. Task Discovery and Selection">
          <p className="text-marketing-muted mb-3">Inquire about available tasks:</p>
          <CodeBlock 
            code={`taskmaster list
taskmaster next`}
            filename="Terminal"
          />
          <p className="text-marketing-muted mt-3">The agent analyzes dependencies and priorities to suggest the next tasks.</p>
        </Accordion>

        <Accordion title="2. Task Implementation">
          <p className="text-marketing-muted mb-3">Before starting, request implementation details:</p>
          <CodeBlock 
            code="taskmaster show --id=<task_id>"
            filename="Terminal"
          />
          <p className="text-marketing-muted mt-3">This provides specifics including dependencies and coding standards.</p>
        </Accordion>

        <Accordion title="3. Verification and Completion">
          <p className="text-marketing-muted mb-3">After implementation, verify according to the test strategy:</p>
          <CodeBlock 
            code="taskmaster set-status --id=<task_id> --status=done"
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="4. Handling Implementation Changes">
          <p className="text-marketing-muted mb-3">If changes arise during implementation:</p>
          <CodeBlock 
            code={`taskmaster update --from=<task_id> --prompt="Update to reflect new implementation choices."`}
            filename="Terminal"
          />
        </Accordion>
      </>
    )
  },
  'advanced-configuration': {
    title: 'Advanced Configuration',
    breadcrumb: 'Best Practices',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Advanced configuration options for customizing TaskMaster AI behavior and model selection.
        </p>
        
        <h3 className="text-xl font-semibold mb-4">Configuration File</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster stores configuration in <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">.taskmaster-ai-ai/config.json</code>. Use the models command to modify it:
        </p>
        
        <CodeBlock 
          code={`{
  "models": {
    "main": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4-20250514",
      "maxTokens": 8000,
      "temperature": 0.7
    },
    "ask": {
      "provider": "perplexity",
      "modelId": "sonar-pro"
    },
    "fallback": {
      "provider": "openai",
      "modelId": "gpt-4o-mini"
    }
  },
  "global": {
    "logLevel": "info",
    "defaultSteps": 5,
    "defaultPriority": "medium",
    "defaultContext": "main"
  }
}`}
          filename=".taskmaster-ai-ai/config.json"
          language="json"
        />

        <TipBox type="warning">
          Do not manually edit the config file. Use <code className="bg-marketing-elevated px-1 rounded">taskmaster models</code> commands to modify configuration.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Model Configuration</h3>
        <CodeBlock 
          code={`# Interactive setup (recommended)
taskmaster models --setup

# View current configuration
taskmaster models

# Set specific models
taskmaster models --set-main claude-sonnet-4-20250514
taskmaster models --set-research sonar-pro
taskmaster models --set-fallback gpt-4o-mini

# Use custom Ollama model
taskmaster models --set-main llama3 --ollama

# Use custom OpenRouter model
taskmaster models --set-main gpt-4-turbo --openrouter`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Context System Configuration</h3>
        <p className="text-marketing-muted mb-4">
          Configure the default context and behavior in the global settings:
        </p>
        <CodeBlock 
          code={`"global": {
  "defaultContext": "main"
}`}
          filename="config.json snippet"
          language="json"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Project Structure</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster stores all data in the <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">.taskmaster-ai</code> directory:
        </p>
        <CodeBlock 
          code={`{
  ".taskmaster-ai/": {
    "config.json": "Project configuration",
    "tasks/tasks.json": "All tasks data",
    "reports/": "Complexity reports"
  }
}`}
          filename=".taskmaster-ai/"
          language="json"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Environment Variables</h3>
        <p className="text-marketing-muted mb-4">
          API keys are stored in environment variables, not in config files:
        </p>
        <CodeBlock 
          code={`# .env file in project root (for CLI)
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
OPENAI_API_KEY=sk-...

# Or in MCP config env section (for IDE integration)
"env": {
  "ANTHROPIC_API_KEY": "sk-ant-..."
}`}
          filename=".env"
        />
      </>
    )
  },
  'advanced-tasks': {
    title: 'Advanced Tasks',
    breadcrumb: 'Best Practices',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Advanced task management techniques for complex projects and team workflows.
        </p>
        
        <h3 className="text-xl font-semibold mb-4">Updating Tasks</h3>
        <p className="text-marketing-muted mb-4">
          When implementation changes affect tasks, update them with new context:
        </p>
        <CodeBlock 
          code={`# Update a task with new information
taskmaster edit --id=5 --prompt="We're now using PostgreSQL instead of MongoDB"

# Append notes without replacing (like log)
taskmaster edit --id=5 --prompt="Added migration scripts" --append

# Update with ask for more informed changes
taskmaster edit --id=5 --prompt="Switching to TypeScript" --ask`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Breaking Down Complex Tasks</h3>
        <p className="text-marketing-muted mb-4">
          For complex tasks, generate steps with specific counts or context:
        </p>
        <CodeBlock 
          code={`# Break down with specific number of steps
taskmaster breakdown --id=7 --num=5

# Expand with additional context
taskmaster breakdown --id=7 --prompt="Focus on error handling and edge cases"

# Force regenerate existing steps
taskmaster breakdown --id=7 --force --ask`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Dependency Management</h3>
        <CodeBlock 
          code={`# Add a dependency
taskmaster link --id=5 --depends-on=3

# Remove a dependency
taskmaster unlink --id=5 --depends-on=3`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Manual Task Creation</h3>
        <CodeBlock 
          code={`# Add a new task with AI structuring
taskmaster new --prompt="Implement user authentication with JWT"

# Add with dependencies and priority
taskmaster new --prompt="Add rate limiting" --dependencies=3,4 --priority=high

# Use ask model for more informed task creation
taskmaster new --prompt="Implement caching layer" --ask`}
          filename="Terminal"
        />
      </>
    )
  },
  'tdd-quick-start': {
    title: 'TDD Workflow Quick Start',
    breadcrumb: 'TDD Workflow (Autopilot)',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          TaskMaster AI's Autopilot is an autonomous Test-Driven Development (TDD) workflow system that helps AI agents implement features following strict TDD practices.
        </p>
        
        <div className="mb-8">
          <TipBox>
            Autopilot manages workflow state, Git operations, test validation, and progress tracking automatically.
          </TipBox>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-8">Key Features</h3>
        <ul className="space-y-2 text-marketing-muted mb-8">
          <li>• <strong>TDD State Machine:</strong> Enforces the RED → GREEN → COMMIT cycle</li>
          <li>• <strong>Git Integration:</strong> Automates branch creation and commits with metadata</li>
          <li>• <strong>Test Validation:</strong> Ensures RED phase has failures and GREEN phase passes</li>
          <li>• <strong>Progress Tracking:</strong> Monitors step completion and attempt counts</li>
          <li>• <strong>State Persistence:</strong> Automatically manages workflow state for resumability</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-10">Prerequisites</h3>
        <ul className="list-disc list-inside text-marketing-muted space-y-2 mb-8">
          <li>An initialized TaskMaster project with defined steps</li>
          <li>A clean Git repository</li>
          <li>A configured test framework (e.g., Vitest, Jest)</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-10">Quick Start</h3>

        <h4 className="text-lg font-medium mb-3">1. Initialize Workflow</h4>
        <p className="text-marketing-muted mb-3">Start the TDD workflow for a task with defined steps:</p>
        <CodeBlock 
          code="taskmaster autopilot start 7"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">2. Check Next Action</h4>
        <p className="text-marketing-muted mb-3">Get instructions for what to do next:</p>
        <CodeBlock 
          code="taskmaster autopilot next"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">3. Write Failing Test (RED Phase)</h4>
        <p className="text-marketing-muted mb-3">Create a test file that initially fails. Run your tests and report the results:</p>
        <CodeBlock 
          code={`# Run your tests (e.g., npm test, vitest, jest)
# Then report results:
taskmaster autopilot complete --results '{"total":1,"passed":0,"failed":1,"skipped":0}'`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">4. Implement Code (GREEN Phase)</h4>
        <p className="text-marketing-muted mb-3">Write the minimum implementation to pass the tests, then report results:</p>
        <CodeBlock 
          code={`# Implement your code
# Run tests again, then report:
taskmaster autopilot complete --results '{"total":1,"passed":1,"failed":0,"skipped":0}'`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">5. Commit Changes</h4>
        <p className="text-marketing-muted mb-3">Commit your work and advance to the next step:</p>
        <CodeBlock 
          code="taskmaster autopilot commit"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">6. Repeat for Next Step</h4>
        <p className="text-marketing-muted mb-3">The workflow automatically advances to the next step. Repeat the cycle:</p>
        <CodeBlock 
          code="taskmaster autopilot next"
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-6 mt-10">Workflow Phases</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {[
            { phase: 'PREFLIGHT', desc: 'Validates prerequisites' },
            { phase: 'BRANCH_SETUP', desc: 'Creates workflow branch' },
            { phase: 'RED', desc: 'Write failing test' },
            { phase: 'GREEN', desc: 'Implement to pass' },
            { phase: 'COMMIT', desc: 'Commit changes' },
            { phase: 'COMPLETE', desc: 'Workflow finished' },
          ].map(({ phase, desc }) => (
            <div key={phase} className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <code className="text-sm text-marketing-link">{phase}</code>
              <p className="text-xs text-marketing-muted mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">Common Patterns</h3>

        <Accordion title="Parse Test Output">
          <p className="text-marketing-muted mb-3">Your test runner outputs human-readable format - convert to JSON:</p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Vitest:</p>
              <p className="text-sm text-marketing-muted font-mono mb-1">Tests  2 failed | 8 passed | 10 total</p>
              <p className="text-sm text-marketing-muted">→ <code className="bg-marketing-elevated px-1 rounded">{`{"total":10,"passed":8,"failed":2,"skipped":0}`}</code></p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Jest:</p>
              <p className="text-sm text-marketing-muted font-mono mb-1">Tests:  2 failed, 8 passed, 10 total</p>
              <p className="text-sm text-marketing-muted">→ <code className="bg-marketing-elevated px-1 rounded">{`{"total":10,"passed":8,"failed":2,"skipped":0}`}</code></p>
            </div>
          </div>
        </Accordion>

        <Accordion title="Handle Errors">
          <p className="text-marketing-muted mb-3"><strong>Problem:</strong> RED phase won't complete - "no test failures"</p>
          <p className="text-marketing-muted mb-3"><strong>Solution:</strong> Your test isn't testing new behavior. Make sure it fails:</p>
          <CodeBlock 
            code={`// Bad - test passes immediately
it('should exist', () => {
  expect(StartCommand).toBeDefined(); // Always passes
});

// Good - test fails until feature exists
it('should initialize workflow', async () => {
  const result = await new StartCommand().execute({ taskId: '7' });
  expect(result.success).toBe(true); // Fails until implemented
});`}
            filename="Test Example"
            language="typescript"
          />

          <p className="text-marketing-muted mt-4 mb-3"><strong>Problem:</strong> GREEN phase won't complete - "tests still failing"</p>
          <p className="text-marketing-muted"><strong>Solution:</strong> Fix your implementation until all tests pass, then try again.</p>
        </Accordion>

        <Accordion title="Resume Interrupted Work">
          <CodeBlock 
            code={`# If you interrupted the workflow
taskmaster autopilot resume

✓ Workflow resumed
✓ Task 7 - step 3/5
✓ Current phase: GREEN
→ Continue from where you left off`}
            filename="Terminal"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-6 mt-10">JSON Output Mode</h3>
        <p className="text-marketing-muted mb-4">
          All commands support <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">--json</code> flag for programmatic use:
        </p>
        <CodeBlock 
          code={`$ taskmaster autopilot start 7 --json | jq .
{
  "success": true,
  "taskId": "7",
  "branchName": "task-7",
  "phase": "SUBTASK_LOOP",
  "tddPhase": "RED",
  "progress": { ... },
  "currentSubtask": { ... },
  "nextAction": "generate_test"
}`}
          filename="Terminal"
        />
        <p className="text-marketing-muted mt-4">Perfect for: CI/CD integration, custom tooling, automated workflows, progress monitoring.</p>

        <h3 className="text-xl font-semibold mb-6 mt-10">MCP Integration</h3>
        <p className="text-marketing-muted mb-4">
          For AI agents (Claude Code, etc.), use MCP tools:
        </p>
        <CodeBlock 
          code={`// Start workflow
await mcp.call('autopilot_start', {
  taskId: '7',
  projectRoot: '/path/to/project'
});

// Get next action
const next = await mcp.call('autopilot_next', {
  projectRoot: '/path/to/project'
});

// Complete phase
await mcp.call('autopilot_complete_phase', {
  projectRoot: '/path/to/project',
  testResults: { total: 1, passed: 0, failed: 1, skipped: 0 }
});

// Commit
await mcp.call('autopilot_commit', {
  projectRoot: '/path/to/project'
});`}
          filename="MCP Integration"
          language="javascript"
        />

        <TipBox>
          <strong>Note:</strong> <code className="bg-marketing-elevated px-1 rounded">tm</code> is an alias for <code className="bg-marketing-elevated px-1 rounded">taskmaster</code>. Both commands work identically.
        </TipBox>

        <h3 className="text-xl font-semibold mb-6 mt-10">Cheat Sheet</h3>
        <CodeBlock 
          code={`# Start
taskmaster autopilot start <taskId>    # Initialize workflow

# Workflow Control
taskmaster autopilot next              # What's next?
taskmaster autopilot status            # Current state
taskmaster autopilot resume            # Continue interrupted work
taskmaster autopilot abort             # Cancel and cleanup

# TDD Cycle
taskmaster autopilot complete --results '{...}'   # Advance phase
taskmaster autopilot commit                       # Save progress

# Finalization
taskmaster autopilot finalize          # Complete workflow, mark task done

# Options
--json                              # Machine-readable output
--max-attempts <n>                  # Max retries per step (default: 3)
--force                             # Override safety checks`}
          filename="Cheat Sheet"
        />

        <h3 className="text-xl font-semibold mb-6 mt-10">Tips</h3>
        <ol className="list-decimal list-inside text-marketing-muted space-y-2">
          <li><strong>Always let tests fail first</strong> - That's the RED phase</li>
          <li><strong>Write minimal code</strong> - Just enough to pass</li>
          <li><strong>Commit frequently</strong> - After each step</li>
          <li><strong>Use --json</strong> - Better for programmatic use</li>
          <li><strong>Check status often</strong> - Know where you are</li>
          <li><strong>Trust the workflow</strong> - It enforces TDD rules</li>
        </ol>

        <TipBox type="info">
          <strong>Ready to start?</strong> Run <code className="bg-marketing-elevated px-1 rounded">tm autopilot start {"<taskId>"}</code> and begin your TDD journey!
        </TipBox>
      </>
    )
  },
  'agent-integration': {
    title: 'AI Agent Integration Guide',
    breadcrumb: 'TDD Workflow (Autopilot)',
    content: (
      <>
        <p className="text-marketing-muted mb-6">
          Complete guide for integrating AI agents with TaskMaster's autonomous TDD workflow system.
        </p>

        <h3 className="text-xl font-semibold mb-4">Overview</h3>
        <p className="text-marketing-muted mb-4">
          TaskMaster provides a complete TDD workflow orchestration system that enables AI agents to autonomously implement features following strict Test-Driven Development practices. The system manages workflow state, git operations, test validation, and progress tracking.
        </p>

        <h4 className="text-lg font-medium mb-3">Key Features</h4>
        <ul className="text-marketing-muted space-y-1 mb-6">
          <li>• <strong>TDD State Machine:</strong> Enforces RED → GREEN → COMMIT cycle</li>
          <li>• <strong>Git Integration:</strong> Automated branch creation, commits with metadata</li>
          <li>• <strong>Test Validation:</strong> Ensures RED phase has failures, GREEN phase passes</li>
          <li>• <strong>Progress Tracking:</strong> Step completion, attempt counting, error logging</li>
          <li>• <strong>State Persistence:</strong> Automatic workflow state management</li>
          <li>• <strong>Dual Interface:</strong> CLI commands and MCP tools for flexibility</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">Architecture</h3>
        <CodeBlock 
          code={`┌─────────────────────────────────────────────────────┐
│                   AI Agent                          │
│  (Claude Code, Cursor, Custom Agent, etc.)          │
└─────────────┬───────────────────────────────────────┘
              │ Uses CLI or MCP
┌─────────────▼───────────────────────────────────────┐
│            TaskMaster Interface                      │
│  ┌──────────────┐         ┌──────────────┐         │
│  │ CLI Commands │         │  MCP Tools   │         │
│  └──────┬───────┘         └──────┬───────┘         │
└─────────┼────────────────────────┼─────────────────┘
          │                        │
┌─────────▼────────────────────────▼─────────────────┐
│         WorkflowOrchestrator (Core)                 │
│  ┌─────────────────────────────────────────────┐   │
│  │  State Machine: RED → GREEN → COMMIT        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │GitAdapter│  │TestResult│  │CommitMessage │    │
│  │          │  │Validator │  │Generator     │    │
│  └──────────┘  └──────────┘  └──────────────┘    │
└────────────────────────────────────────────────────┘
          │
          │ Persists to
          ▼
┌────────────────────────────────────────────────────┐
│  .taskmaster-ai-ai/workflow-state.json                    │
└────────────────────────────────────────────────────┘`}
          filename="Architecture"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">Component Responsibilities</h4>
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">WorkflowOrchestrator</code>
            <p className="text-xs text-marketing-muted mt-1">Manages TDD state machine transitions, tracks progress, enforces workflow rules, emits events</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">GitAdapter</code>
            <p className="text-xs text-marketing-muted mt-1">Creates/manages workflow branches, stages files, creates commits, validates repository state</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">TestResultValidator</code>
            <p className="text-xs text-marketing-muted mt-1">Validates RED phase has failures, GREEN phase passes, parses test results</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">CommitMessageGenerator</code>
            <p className="text-xs text-marketing-muted mt-1">Generates conventional commit messages with workflow metadata</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-12">Workflow Phases</h3>
        <CodeBlock 
          code={`PREFLIGHT → BRANCH_SETUP → SUBTASK_LOOP → FINALIZE → COMPLETE
                                   ↓
                          RED → GREEN → COMMIT
                           ↑              ↓
                           └──────────────┘
                             (Next Step)`}
          filename="Phase Flow"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">Phase Descriptions</h4>
        <div className="space-y-3 mb-8">
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">PREFLIGHT</code>
            <p className="text-sm text-marketing-muted mt-1">Validates task has steps, checks git repository state, verifies preconditions</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">BRANCH_SETUP</code>
            <p className="text-sm text-marketing-muted mt-1">Creates workflow branch (task-{'{taskId}'}), checks out new branch, initializes workflow context</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">SUBTASK_LOOP</code>
            <p className="text-sm text-marketing-muted mt-1">Main development cycle containing RED → GREEN → COMMIT phases for each step</p>
            <div className="mt-2 ml-4 space-y-1">
              <p className="text-xs text-marketing-muted"><strong>RED:</strong> Write failing tests. Action: generate_test. Validation: At least one test must fail.</p>
              <p className="text-xs text-marketing-muted"><strong>GREEN:</strong> Implement code. Action: implement_code. Validation: All tests must pass.</p>
              <p className="text-xs text-marketing-muted"><strong>COMMIT:</strong> Create commit. Action: commit_changes. Auto-generates message, advances to next step.</p>
            </div>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">FINALIZE</code>
            <p className="text-sm text-marketing-muted mt-1">All steps complete, workflow ready for review/merge</p>
          </div>
          <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
            <code className="text-sm text-marketing-link font-semibold">COMPLETE</code>
            <p className="text-sm text-marketing-muted mt-1">Workflow finished, state can be cleaned up</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-12">Responsibility Matrix</h3>
        <p className="text-marketing-muted mb-6">Clear division of responsibilities between AI Agent and TaskMaster.</p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="marketing-panel border rounded-xl p-4">
            <h4 className="font-medium text-marketing-link mb-3">AI Agent Responsibilities</h4>
            <ul className="text-sm text-marketing-muted space-y-1">
              <li>• Read and understand step requirements</li>
              <li>• Write test code that validates requirements</li>
              <li>• Run test suite using project's test command</li>
              <li>• Parse test output into JSON format</li>
              <li>• Report results to TaskMaster for validation</li>
              <li>• Write implementation to satisfy tests</li>
              <li>• Request commits when GREEN phase complete</li>
              <li>• Handle errors and retry within attempt limits</li>
            </ul>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <h4 className="font-medium text-marketing-link mb-3">TaskMaster Responsibilities</h4>
            <ul className="text-sm text-marketing-muted space-y-1">
              <li>• Manage workflow state machine</li>
              <li>• Enforce TDD rules (RED must fail, GREEN must pass)</li>
              <li>• Track progress (completed, current, attempts)</li>
              <li>• Create Git commits with enhanced messages</li>
              <li>• Manage Git branches and repository safety</li>
              <li>• Validate transitions between phases</li>
              <li>• Persist state for resumability</li>
              <li>• Generate reports and activity logs</li>
            </ul>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-12">Complete TDD Cycle Example</h3>
        <p className="text-marketing-muted mb-6">A complete walkthrough of implementing a feature using the TDD workflow:</p>

        <Accordion title="1. Start Workflow" defaultOpen>
          <CodeBlock 
            code={`$ taskmaster autopilot start 7 --json
{
  "success": true,
  "taskId": "7",
  "branchName": "task-7",
  "tddPhase": "RED",
  "currentSubtask": {
    "id": "1",
    "title": "Implement start command",
    "status": "in-progress"
  },
  "nextAction": "generate_test"
}`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="2. Get Next Action">
          <CodeBlock 
            code={`$ taskmaster autopilot next --json
{
  "action": "generate_test",
  "actionDescription": "Write a failing test for the current step",
  "tddPhase": "RED",
  "currentSubtask": {
    "id": "1",
    "title": "Implement start command"
  }
}`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="3. Write Failing Test (AI Agent)">
          <p className="text-marketing-muted mb-3">AI Agent creates the test file:</p>
          <CodeBlock 
            code={`import { describe, it, expect } from 'vitest';
import { StartCommand } from '../src/commands/start.js';

describe('StartCommand', () => {
  it('should initialize workflow and create branch', async () => {
    const command = new StartCommand();
    const result = await command.execute({ taskId: '7' });
    expect(result.success).toBe(true);
    expect(result.branchName).toBe('task-7');
  });
});`}
            filename="tests/start.test.ts"
            language="typescript"
          />
        </Accordion>

        <Accordion title="4. Run Tests & Complete RED Phase">
          <p className="text-marketing-muted mb-3">Run tests (should fail), then report results:</p>
          <CodeBlock 
            code={`# Run tests
$ npm test
# Output: 1 test failed (expected)

# Report results to TaskMaster
$ taskmaster autopilot complete --results '{"total":1,"passed":0,"failed":1,"skipped":0}' --json
{
  "success": true,
  "message": "Completed RED phase",
  "previousPhase": "RED",
  "currentPhase": "GREEN",
  "nextAction": "implement_code"
}`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="5. Implement Code (AI Agent)">
          <p className="text-marketing-muted mb-3">AI Agent creates implementation:</p>
          <CodeBlock 
            code={`export class StartCommand {
  async execute(options: { taskId: string }) {
    // Implementation that makes test pass
    return {
      success: true,
      branchName: \`task-\${options.taskId}\`
    };
  }
}`}
            filename="src/commands/start.ts"
            language="typescript"
          />
        </Accordion>

        <Accordion title="6. Run Tests & Complete GREEN Phase">
          <p className="text-marketing-muted mb-3">Run tests (should pass), then report results:</p>
          <CodeBlock 
            code={`# Run tests
$ npm test
# Output: 1 test passed

# Report results to TaskMaster
$ taskmaster autopilot complete --results '{"total":1,"passed":1,"failed":0,"skipped":0}' --json
{
  "success": true,
  "previousPhase": "GREEN",
  "currentPhase": "COMMIT",
  "nextAction": "commit_changes"
}`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="7. Commit Changes">
          <CodeBlock 
            code={`$ taskmaster autopilot commit --json
{
  "success": true,
  "commit": {
    "hash": "abc123",
    "message": "feat(autopilot): implement start command (Task 7.1)\\n\\n..."
  },
  "subtaskCompleted": "1",
  "currentSubtask": {
    "id": "2",
    "title": "Implement resume command"
  },
  "nextAction": "generate_test"
}`}
            filename="Terminal"
          />
          <p className="text-marketing-muted mt-3">Workflow automatically advances to next step. Repeat the cycle!</p>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-12">CLI Commands</h3>
        <p className="text-marketing-muted mb-6">
          All commands support <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">--json</code> flag for machine-readable output. 
          Use <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">taskmaster</code> or the shorter alias <code className="bg-marketing-elevated px-1.5 py-0.5 rounded">tm</code>.
        </p>
        
        <Accordion title="taskmaster autopilot start <taskId>">
          <p className="text-marketing-muted mb-3">Initialize a new TDD workflow for a task.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-marketing-muted space-y-1 mb-3">
            <li>• <code className="bg-marketing-elevated px-1 rounded">--max-attempts {"<number>"}</code>: Maximum attempts per step (default: 3)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--force</code>: Force start even if workflow exists</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--json</code>: Output JSON</li>
          </ul>
          <CodeBlock 
            code={`$ taskmaster autopilot start 7 --max-attempts 5 --json
{
  "success": true,
  "message": "Workflow started for task 7",
  "taskId": "7",
  "branchName": "task-7",
  "phase": "SUBTASK_LOOP",
  "tddPhase": "RED",
  "progress": {
    "completed": 0,
    "total": 5,
    "percentage": 0
  },
  "currentSubtask": {
    "id": "1",
    "title": "Implement start command",
    "status": "in-progress",
    "attempts": 0
  },
  "nextAction": "generate_test"
}`}
            filename="Example with JSON Output"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot resume">
          <p className="text-marketing-muted mb-3">Resume a previously started workflow from saved state.</p>
          <CodeBlock 
            code={`$ taskmaster autopilot resume --json
{
  "success": true,
  "message": "Workflow resumed",
  "taskId": "7",
  "branchName": "task-7",
  "tddPhase": "GREEN",
  "progress": {
    "completed": 2,
    "total": 5,
    "percentage": 40
  }
}`}
            filename="Example"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot next">
          <p className="text-marketing-muted mb-3">Get the next action to perform with detailed context.</p>
          <CodeBlock 
            code={`$ taskmaster autopilot next --json
{
  "action": "generate_test",
  "actionDescription": "Write a failing test for the current step",
  "phase": "SUBTASK_LOOP",
  "tddPhase": "RED",
  "taskId": "7",
  "branchName": "task-7",
  "progress": {
    "completed": 0,
    "total": 5,
    "current": 1,
    "percentage": 0
  },
  "currentSubtask": {
    "id": "1",
    "title": "Implement start command",
    "status": "in-progress",
    "attempts": 0,
    "maxAttempts": 3
  },
  "expectedFiles": ["test file"],
  "context": {
    "canProceed": false,
    "errors": []
  }
}`}
            filename="Example with JSON Output"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot status">
          <p className="text-marketing-muted mb-3">Get comprehensive workflow progress and state information.</p>
          <CodeBlock 
            code={`$ taskmaster autopilot status --json
{
  "taskId": "7",
  "branchName": "task-7",
  "phase": "SUBTASK_LOOP",
  "tddPhase": "GREEN",
  "progress": {
    "completed": 2,
    "total": 5,
    "percentage": 40
  },
  "currentSubtask": {
    "id": "3",
    "title": "Add validation",
    "status": "in-progress"
  },
  "subtasks": [
    { "id": "1", "title": "Implement start command", "status": "done" },
    { "id": "2", "title": "Implement resume command", "status": "done" },
    { "id": "3", "title": "Add validation", "status": "in-progress" },
    { "id": "4", "title": "Error handling", "status": "pending" },
    { "id": "5", "title": "Tests", "status": "pending" }
  ],
  "errors": [],
  "canProceed": true
}`}
            filename="Example with JSON Output"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot complete">
          <p className="text-marketing-muted mb-3">Complete the current TDD phase with test result validation.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-marketing-muted space-y-1 mb-3">
            <li>• <code className="bg-marketing-elevated px-1 rounded">--results {"<json>"}</code>: Test results JSON string (required)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--json</code>: Output JSON</li>
          </ul>
          <CodeBlock 
            code={`$ taskmaster autopilot complete --results '{"total":10,"passed":9,"failed":1,"skipped":0}' --json
{
  "success": true,
  "message": "Completed RED phase",
  "previousPhase": "RED",
  "currentPhase": "GREEN",
  "nextAction": "implement_code"
}`}
            filename="Example"
          />
          <p className="text-sm text-marketing-muted mt-3"><strong>Validation Rules:</strong></p>
          <ul className="text-sm text-marketing-muted space-y-1">
            <li>• <strong>RED Phase:</strong> Must have at least one failing test</li>
            <li>• <strong>GREEN Phase:</strong> All tests must pass (failed === 0)</li>
          </ul>
        </Accordion>

        <Accordion title="taskmaster autopilot commit">
          <p className="text-marketing-muted mb-3">Create a git commit with enhanced message generation.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-marketing-muted space-y-1 mb-3">
            <li>• <code className="bg-marketing-elevated px-1 rounded">--message {"<text>"}</code>: Custom commit message (optional)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--files {"<paths...>"}</code>: Specific files to stage (optional)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--json</code>: Output JSON</li>
          </ul>
          <CodeBlock 
            code={`$ taskmaster autopilot commit --json
{
  "success": true,
  "commit": {
    "hash": "a1b2c3d",
    "message": "feat(autopilot): implement start command (Task 7.1)"
  },
  "subtaskCompleted": "1",
  "isComplete": false,
  "currentSubtask": {
    "id": "2",
    "title": "Implement resume command"
  },
  "nextAction": "generate_test"
}`}
            filename="Example"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot finalize">
          <p className="text-marketing-muted mb-3">Finalize the workflow after all steps are complete.</p>
          <CodeBlock 
            code={`$ taskmaster autopilot finalize --json
{
  "success": true,
  "taskId": "7",
  "message": "Workflow finalized. Task 7 marked as done."
}`}
            filename="Example"
          />
        </Accordion>

        <Accordion title="taskmaster autopilot abort">
          <p className="text-marketing-muted mb-3">Abort the workflow and clean up state (preserves git branch and code).</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-marketing-muted space-y-1 mb-3">
            <li>• <code className="bg-marketing-elevated px-1 rounded">--force</code>: Skip confirmation prompt</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">--json</code>: Output JSON</li>
          </ul>
          <CodeBlock 
            code={`$ taskmaster autopilot abort --force --json
{
  "success": true,
  "message": "Workflow aborted. Branch and code preserved.",
  "taskId": "7",
  "branchName": "task-7"
}`}
            filename="Example"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-12">MCP Tools</h3>
        <p className="text-marketing-muted mb-6">MCP tools provide the same functionality as CLI commands for programmatic integration.</p>

        <Accordion title="autopilot_start">
          <p className="text-marketing-muted mb-3">Initialize a new TDD workflow for a task.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Parameters:</strong></p>
          <CodeBlock 
            code={`{
  taskId: string;          // Required: Task ID (e.g., "7", "2.3")
  projectRoot: string;     // Required: Absolute path to project
  tag?: string;            // Optional: Tag context
  maxAttempts?: number;    // Optional: Default 3
  force?: boolean;         // Optional: Default false
}`}
            filename="Parameters"
            language="typescript"
          />
          <p className="text-sm text-marketing-muted mt-3 mb-2"><strong>Returns:</strong></p>
          <CodeBlock 
            code={`{
  success: boolean;
  message: string;
  taskId: string;
  branchName: string;
  phase: WorkflowPhase;
  tddPhase: TDDPhase;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  currentSubtask: SubtaskInfo | null;
  nextAction: string;
}`}
            filename="Response"
            language="typescript"
          />
        </Accordion>

        <Accordion title="autopilot_next">
          <p className="text-marketing-muted mb-3">Get the next action to perform with detailed context.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Parameters:</strong></p>
          <CodeBlock 
            code={`{
  projectRoot: string;  // Required: Absolute path to project
}`}
            filename="Parameters"
            language="typescript"
          />
          <p className="text-sm text-marketing-muted mt-3 mb-2"><strong>Returns:</strong></p>
          <CodeBlock 
            code={`{
  action: string;              // 'generate_test' | 'implement_code' | 'commit_changes'
  actionDescription: string;
  phase: WorkflowPhase;
  tddPhase: TDDPhase;
  taskId: string;
  branchName: string;
  progress: ProgressInfo;
  currentSubtask: SubtaskInfo | null;
  expectedFiles: string[];
  context: {
    canProceed: boolean;
    errors: string[];
  };
}`}
            filename="Response"
            language="typescript"
          />
        </Accordion>

        <Accordion title="autopilot_complete_phase">
          <p className="text-marketing-muted mb-3">Complete the current TDD phase with test result validation.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Parameters:</strong></p>
          <CodeBlock 
            code={`{
  projectRoot: string;  // Required: Absolute path to project
  testResults: {
    total: number;      // Required: Total tests
    passed: number;     // Required: Passing tests
    failed: number;     // Required: Failing tests
    skipped?: number;   // Optional: Skipped tests
  };
}`}
            filename="Parameters"
            language="typescript"
          />
        </Accordion>

        <Accordion title="autopilot_commit">
          <p className="text-marketing-muted mb-3">Create a git commit with enhanced message generation.</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Parameters:</strong></p>
          <CodeBlock 
            code={`{
  projectRoot: string;     // Required: Absolute path to project
  files?: string[];        // Optional: Files to stage
  customMessage?: string;  // Optional: Custom commit message
}`}
            filename="Parameters"
            language="typescript"
          />
        </Accordion>

        <Accordion title="Other MCP Tools">
          <ul className="text-marketing-muted space-y-2">
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_resume</code> - Resume previously started workflow (params: projectRoot)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_status</code> - Get workflow status (params: projectRoot)</li>
            <li>• <code className="bg-marketing-elevated px-1 rounded">autopilot_abort</code> - Abort workflow (params: projectRoot)</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-6 mt-12">MCP Integration Example</h3>
        <CodeBlock 
          code={`// AI Agent using MCP tools
async function implementTask(taskId: string) {
  // Start workflow
  const start = await mcp.call('autopilot_start', {
    taskId,
    projectRoot: '/path/to/project'
  });
  console.log(\`Started task \${start.taskId} on branch \${start.branchName}\`);

  while (true) {
    // Get next action
    const next = await mcp.call('autopilot_next', {
      projectRoot: '/path/to/project'
    });
    console.log(\`Next action: \${next.action}\`);

    if (next.action === 'generate_test') {
      // AI generates test
      const testCode = await generateTest(next.currentSubtask);
      await writeFile(testCode);

      // Run tests
      const results = await runTests();

      // Complete RED phase
      await mcp.call('autopilot_complete_phase', {
        projectRoot: '/path/to/project',
        testResults: results
      });

    } else if (next.action === 'implement_code') {
      // AI generates implementation
      const implCode = await generateImplementation(next.currentSubtask);
      await writeFile(implCode);

      // Run tests
      const results = await runTests();

      // Complete GREEN phase
      await mcp.call('autopilot_complete_phase', {
        projectRoot: '/path/to/project',
        testResults: results
      });

    } else if (next.action === 'commit_changes') {
      // Commit
      const commit = await mcp.call('autopilot_commit', {
        projectRoot: '/path/to/project'
      });
      console.log(\`Committed: \${commit.commit.hash}\`);

      if (commit.isComplete) {
        console.log('Task complete!');
        break;
      }
    }
  }
}`}
          filename="MCP Integration Example"
          language="javascript"
        />

        <h3 className="text-xl font-semibold mb-6 mt-12">Error Handling</h3>

        <Accordion title="Common Errors and Solutions" defaultOpen>
          <div className="space-y-4">
            <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <p className="font-medium text-marketing-link mb-1">Workflow Already Exists</p>
              <CodeBlock 
                code={`{
  "error": "Workflow already in progress",
  "suggestion": "Use autopilot_resume to continue the existing workflow"
}`}
                filename="Error"
                language="json"
              />
              <p className="text-sm text-marketing-muted mt-2"><strong>Solution:</strong> Use <code className="bg-marketing-elevated px-1 rounded">taskmaster autopilot resume</code> or <code className="bg-marketing-elevated px-1 rounded">--force</code> flag.</p>
            </div>
            <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <p className="font-medium text-marketing-link mb-1">RED Phase Validation Failed</p>
              <CodeBlock 
                code={`{
  "error": "RED phase validation failed",
  "reason": "At least one test must be failing in RED phase",
  "actual": { "passed": 10, "failed": 0 },
  "suggestion": "Ensure you have written a failing test before proceeding"
}`}
                filename="Error"
                language="json"
              />
              <p className="text-sm text-marketing-muted mt-2"><strong>Solution:</strong> The test isn't actually testing the new feature. Write a test that fails until the feature is implemented.</p>
            </div>
            <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <p className="font-medium text-marketing-link mb-1">GREEN Phase Validation Failed</p>
              <CodeBlock 
                code={`{
  "error": "GREEN phase validation failed",
  "reason": "All tests must pass in GREEN phase",
  "actual": { "passed": 9, "failed": 1 },
  "suggestion": "Fix the implementation to make all tests pass"
}`}
                filename="Error"
                language="json"
              />
              <p className="text-sm text-marketing-muted mt-2"><strong>Solution:</strong> Debug failing test and fix implementation.</p>
            </div>
            <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <p className="font-medium text-marketing-link mb-1">No Staged Changes</p>
              <p className="text-sm text-marketing-muted"><strong>Solution:</strong> Ensure you've created/modified files before committing.</p>
            </div>
            <div className="bg-marketing-surface border border-marketing-border rounded-lg p-3">
              <p className="font-medium text-marketing-link mb-1">Git Working Tree Not Clean</p>
              <p className="text-sm text-marketing-muted"><strong>Solution:</strong> Commit or stash changes before starting workflow: <code className="bg-marketing-elevated px-1 rounded">git status && git add . && git commit -m "chore: save work"</code></p>
            </div>
          </div>
        </Accordion>

        <Accordion title="Error Recovery Patterns">
          <p className="text-marketing-muted mb-3"><strong>Retry Pattern:</strong></p>
          <CodeBlock 
            code={`async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(\`Attempt \${attempt} failed, retrying...\`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
  throw new Error('Should not reach here');
}

// Usage
const results = await withRetry(async () => {
  const output = await runTests();
  return parseTestResults(output);
});`}
            filename="Retry Pattern"
            language="typescript"
          />
          <p className="text-marketing-muted mt-4 mb-3"><strong>Graceful Degradation:</strong></p>
          <CodeBlock 
            code={`async function completePhase(projectRoot: string, results: TestResults) {
  try {
    return await mcp.call('autopilot_complete_phase', {
      projectRoot,
      testResults: results
    });
  } catch (error) {
    console.error('Phase completion failed:', error);

    // Log error for debugging
    await logError(error);

    // Attempt manual recovery
    console.log('Attempting manual state recovery...');
    const status = await mcp.call('autopilot_status', { projectRoot });
    console.log('Current state:', status);

    // Provide user guidance
    console.log('Manual intervention required:');
    console.log('1. Check test results are correct');
    console.log('2. Verify current phase allows transition');
    console.log('3. Run: taskmaster autopilot status');

    throw error;
  }
}`}
            filename="Graceful Degradation"
            language="typescript"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-6 mt-12">Troubleshooting</h3>

        <Accordion title="Workflow State Issues">
          <p className="text-marketing-muted mb-2"><strong>Problem:</strong> State file corrupted or inconsistent</p>
          <CodeBlock 
            code={`# Check state file
cat .taskmaster-ai-ai/workflow-state.json

# If corrupted, abort and restart
taskmaster autopilot abort --force
taskmaster autopilot start 7`}
            filename="Solution"
          />
        </Accordion>

        <Accordion title="Test Results Parsing">
          <p className="text-marketing-muted mb-2"><strong>Problem:</strong> Test output format not recognized</p>
          <p className="text-sm text-marketing-muted mb-2"><strong>Solution:</strong> Ensure test results JSON has required fields:</p>
          <CodeBlock 
            code={`{
  "total": 10,    // Required
  "passed": 8,    // Required
  "failed": 2,    // Required
  "skipped": 0    // Optional
}`}
            filename="Required Format"
            language="json"
          />
        </Accordion>

        <Accordion title="Branch Conflicts">
          <p className="text-marketing-muted mb-2"><strong>Problem:</strong> Workflow branch already exists</p>
          <CodeBlock 
            code={`# Check branches
git branch

# Delete old workflow branch if safe
git branch -D task-7

# Start workflow again
taskmaster autopilot start 7`}
            filename="Solution"
          />
        </Accordion>

        <Accordion title="Permission Issues">
          <p className="text-marketing-muted mb-2"><strong>Problem:</strong> Cannot write to .taskmaster-ai directory</p>
          <CodeBlock 
            code={`# Check directory permissions
ls -la .taskmaster-ai/

# Fix permissions
chmod -R u+w .taskmaster-ai/`}
            filename="Solution"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-12">Working with AI Agents</h3>
        <p className="text-marketing-muted mb-6">Example prompts for AI agents (Claude Code, Cursor, etc.):</p>
        
        <div className="space-y-4">
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">Starting a Task</p>
            <p className="text-sm text-marketing-muted italic">"I want to implement Task 7 using TDD workflow. Please: 1) Start the autopilot workflow, 2) Show me the first step to implement, 3) Begin the RED-GREEN-COMMIT cycle"</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">RED Phase - Writing Failing Tests</p>
            <p className="text-sm text-marketing-muted italic">"We're in RED phase for step [STEP_TITLE]. Please: 1) Read the step requirements, 2) Write a test that validates the behavior, 3) The test MUST fail because the feature doesn't exist yet, 4) Run the tests and report results to complete the RED phase"</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">GREEN Phase - Implementing</p>
            <p className="text-sm text-marketing-muted italic">"We're in GREEN phase. The test is failing with: [ERROR_MESSAGE]. Please: 1) Implement the minimal code to make this test pass, 2) Don't over-engineer or add untested features, 3) Run tests and report results to complete the GREEN phase"</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">Handling Errors</p>
            <p className="text-sm text-marketing-muted italic">"The RED phase validation failed - no test failures detected. Please: 1) Review the test I just wrote, 2) Identify why it's not actually testing new behavior, 3) Rewrite the test to properly fail until the feature is implemented"</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">Checking Progress</p>
            <p className="text-sm text-marketing-muted italic">"What's the current state of the workflow? Please show: - Which subtask we're on, - Current TDD phase (RED/GREEN/COMMIT), - Progress percentage, - Next action required"</p>
          </div>
          <div className="marketing-panel border rounded-xl p-4">
            <p className="text-sm font-medium text-marketing-link mb-2">Resuming Work</p>
            <p className="text-sm text-marketing-muted italic">"I have an in-progress workflow. Please: 1) Resume the autopilot workflow, 2) Show current status, 3) Continue from where we left off"</p>
          </div>
        </div>

        <div className="mt-8">
          <TipBox type="info">
            The autopilot system automatically handles Git branch creation, state persistence, and workflow transitions. Your AI agent just needs to focus on writing tests and implementation code.
          </TipBox>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-12">Additional Resources</h3>
        <ul className="text-marketing-muted space-y-2">
          <li>• <SectionLink sectionId="tdd-quick-start">TDD Quick Start</SectionLink> - Get started in 5 minutes</li>
          <li>• <SectionLink sectionId="cli-commands">CLI Command Reference</SectionLink> - Complete CLI documentation</li>
          <li>• <SectionLink sectionId="mcp-tools">MCP Tools</SectionLink> - MCP integration details</li>
          <li>• <SectionLink sectionId="task-structure">Task Structure</SectionLink> - Understanding TaskMaster's task system</li>
        </ul>
      </>
    )
  },
}

// Sidebar Item Component
function SidebarItem({ 
  item, 
  activeSection, 
  setActiveSection,
  expandedItems,
  toggleExpanded
}: { 
  item: { id: string; label: string; icon?: any; children?: { id: string; label: string }[] }
  activeSection: string
  setActiveSection: (id: string) => void
  expandedItems: Set<string>
  toggleExpanded: (id: string) => void
}) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedItems.has(item.id)
  const isActive = activeSection === item.id || item.children?.some(child => child.id === activeSection)

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            toggleExpanded(item.id)
          }
          setActiveSection(item.id)
          scrollToTop()
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive 
            ? 'bg-marketing-link/10 text-marketing-link' 
            : 'text-marketing-muted hover:text-marketing-text hover:bg-marketing-surface'
        }`}
      >
        {item.icon && <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5" />}
        <span className="flex-1 text-left">{item.label}</span>
        {hasChildren && (
          <FontAwesomeIcon 
            icon={isExpanded ? faChevronDown : faChevronRight} 
            className="w-3 h-3 text-marketing-muted" 
          />
        )}
      </button>
      
      {hasChildren && isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {item.children!.map((child) => (
            <button
              key={child.id}
              onClick={() => {
                setActiveSection(child.id)
                scrollToTop()
              }}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                activeSection === child.id
                  ? 'text-marketing-link'
                  : 'text-marketing-muted hover:text-marketing-text'
              }`}
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Chat message type
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: string
}

// Search result type
interface SearchResult {
  id: string
  label: string
  description?: string
  breadcrumb: string[]
  icon?: typeof faBook
  keywords: string[]
}

// Keywords for each doc section to enable comprehensive searching
const docKeywords: Record<string, string[]> = {
  'introduction': ['welcome', 'getting started', 'overview', 'pricing', 'plans', 'plus', 'pro', 'enterprise', 'support', 'email'],
  'quick-start': ['setup', 'install', 'configuration', 'prd', 'requirements', 'node.js', 'npm', 'api key'],
  'requirements': ['node.js', 'npm', 'api key', 'anthropic', 'openai', 'google', 'gemini', 'perplexity', 'xai', 'openrouter', 'claude code'],
  'installation': ['npm install', 'mcp', 'cursor', 'windsurf', 'vscode', 'claude code', 'global', 'project', 'npx', 'taskmasterai', 'one-click'],
  'configuration': ['mcp.json', 'api key', 'environment', 'config', 'anthropic_api_key', 'openai_api_key', 'perplexity_api_key'],
  'prd-creation': ['product requirements', 'prd', 'template', 'scope', 'constraints', 'user stories', 'plan', 'parse'],
  'tasks-setup': ['breakdown', 'steps', 'complexity', 'analyze', 'assess'],
  'executing-tasks': ['next', 'show', 'set-status', 'done', 'in-progress', 'pending', 'log', 'workflow'],
  'api-keys': ['api key', 'dashboard', 'anthropic', 'openai', 'google', 'perplexity', 'sync', 'security', 'provider'],
  'license-usage': ['license', 'activation', 'activate', 'deactivate', 'usage', 'limits', 'billing', 'subscription'],
  'faq': ['troubleshoot', 'error', 'help', 'support', 'common', 'questions', 'problem', 'fix'],
  'contribute': ['feedback', 'support', 'contact', 'email', 'bug', 'feature request', 'community'],
  'advanced-usage': ['rules', 'context', 'mdc', 'cursor rules', 'prompts', 'workflow', 'best practices'],
  'advanced-configuration': ['models', 'config', 'main model', 'ask model', 'fallback', 'temperature', 'parameters'],
  'advanced-tasks': ['dependencies', 'priority', 'steps', 'subtasks', 'update', 'batch', 'move', 'organization'],
  'mcp-tools': ['mcp', 'tools', 'core', 'standard', 'all', 'list', 'next', 'breakdown', 'plan', 'set_status', 'autopilot'],
  'cli-commands': ['taskmaster', 'init', 'plan', 'list', 'show', 'next', 'set-status', 'breakdown', 'new', 'edit', 'log', 'update', 'assess', 'report', 'link', 'unlink', 'contexts', 'context', 'switch', 'clone', 'ask', 'usage', 'models', 'sync-keys', 'activate', 'autopilot', 'move', 'add-step', 'generate', 'check-links', 'fix-links', 'remove-task', 'clear-steps', 'delete-context', 'rename-context', 'cloud sync', 'hosted keys'],
  'task-structure': ['id', 'title', 'description', 'status', 'dependencies', 'priority', 'details', 'steps', 'testStrategy', 'tasks.json'],
  'tdd-quick-start': ['tdd', 'test driven', 'autopilot', 'red green refactor', 'testing', 'workflow', 'git branch'],
  'agent-integration': ['ai agent', 'cursor', 'automation', 'mcp tools', 'autopilot_start', 'autopilot_next', 'autopilot_status', 'autopilot_commit'],
}

// Build searchable index from navigation and docContent
const buildSearchIndex = (): SearchResult[] => {
  const results: SearchResult[] = []
  
  navigation.forEach(section => {
    section.items.forEach(item => {
      const doc = docContent[item.id]
      results.push({
        id: item.id,
        label: item.label,
        description: doc?.title || item.label,
        breadcrumb: ['Documentation', section.title, item.label],
        icon: item.icon,
        keywords: docKeywords[item.id] || []
      })
      
      if (item.children) {
        item.children.forEach(child => {
          const childDoc = docContent[child.id]
          results.push({
            id: child.id,
            label: child.label,
            description: childDoc?.title || child.label,
            breadcrumb: ['Documentation', section.title, item.label, child.label],
            icon: item.icon,
            keywords: docKeywords[child.id] || []
          })
        })
      }
    })
  })
  
  return results
}

const searchIndex = buildSearchIndex()

export default function Docs() {
  const [activeSection, setActiveSection] = useState('introduction')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['quick-start']))
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>(() => {
    const saved = localStorage.getItem('taskmaster-docs-recent-searches')
    return saved ? JSON.parse(saved) : []
  })
  
  // Ask a question state - with chat history
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isAsking, setIsAsking] = useState(false)
  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const questionInputRef = useRef<HTMLInputElement>(null)
  const sidebarInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const searchModalInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // Copy section/all docs state
  const [copiedSection, setCopiedSection] = useState(false)
  const [copiedAllDocs, setCopiedAllDocs] = useState(false)
  
  // Detect if user is on Mac
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  // Search results based on query - searches label, description, breadcrumb, and keywords
  const searchResults = searchQuery.trim() 
    ? searchIndex.filter(item => {
        const query = searchQuery.toLowerCase()
        const queryWords = query.split(/\s+/).filter(w => w.length > 0)
        
        // Check if any query word matches
        return queryWords.some(word => 
          item.label.toLowerCase().includes(word) ||
          item.description?.toLowerCase().includes(word) ||
          item.breadcrumb.some(b => b.toLowerCase().includes(word)) ||
          item.keywords.some(k => k.toLowerCase().includes(word))
        )
      }).sort((a, b) => {
        // Prioritize exact label matches
        const query = searchQuery.toLowerCase()
        const aLabelMatch = a.label.toLowerCase().includes(query)
        const bLabelMatch = b.label.toLowerCase().includes(query)
        if (aLabelMatch && !bLabelMatch) return -1
        if (!aLabelMatch && bLabelMatch) return 1
        return 0
      })
    : []

  // Handle selecting a search result
  const handleSelectSearchResult = (result: SearchResult) => {
    setActiveSection(result.id)
    setShowSearchModal(false)
    setSearchQuery('')
    
    // Add to recent searches
    const newRecent = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 5)
    setRecentSearches(newRecent)
    localStorage.setItem('taskmaster-docs-recent-searches', JSON.stringify(newRecent))
    
    // Expand parent if it's a child item
    navigation.forEach(section => {
      section.items.forEach(item => {
        if (item.children?.some(child => child.id === result.id)) {
          setExpandedItems(prev => new Set([...prev, item.id]))
        }
      })
    })
    
    // Instantly scroll to top
    scrollToTop()
  }

  // Focus search modal input when opened
  useEffect(() => {
    if (showSearchModal && searchModalInputRef.current) {
      searchModalInputRef.current.focus()
    }
  }, [showSearchModal])

  // Close search modal on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSearchModal) {
        setShowSearchModal(false)
        setSearchQuery('')
      }
      if (e.key === 'Escape' && showContactModal) {
        setShowContactModal(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showSearchModal, showContactModal])

  // Reset feedback and copy state when navigating to a different page
  useEffect(() => {
    setFeedbackGiven(null)
    setCopiedSection(false)
  }, [activeSection])

  // Reset chat function
  const resetChat = () => {
    setQuestion('')
    setChatHistory([])
  }

  // Helper function to extract text from a DOM element
  const extractTextFromElement = useCallback((element: HTMLElement): string => {
    let text = ''
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    )
    
    let node: Node | null = walker.currentNode
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent?.trim()
        if (content) {
          text += content + ' '
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const tagName = el.tagName.toLowerCase()
        
        // Add line breaks for block elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(tagName)) {
          text = text.trimEnd() + '\n'
        }
        
        // Add extra line break after headers
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          text = text.trimEnd() + '\n'
        }
        
        // Handle code blocks specially
        if (tagName === 'pre' || tagName === 'code') {
          const codeContent = el.textContent?.trim()
          if (codeContent && tagName === 'pre') {
            text += '\n```\n' + codeContent + '\n```\n'
            // Skip children since we've handled the content
            node = walker.nextSibling() || walker.parentNode()
            while (node && !walker.nextNode()) {
              node = walker.parentNode()
            }
            node = walker.currentNode
            continue
          }
        }
      }
      node = walker.nextNode()
    }
    
    // Clean up multiple newlines
    return text.replace(/\n{3,}/g, '\n\n').trim()
  }, [])

  // Copy current section content
  const handleCopySection = useCallback(async () => {
    if (contentRef.current) {
      const text = extractTextFromElement(contentRef.current)
      const currentDoc = docContent[activeSection] || docContent['introduction']
      const sectionTitle = currentDoc?.title || 'Documentation'
      const formattedText = `# ${sectionTitle}\n\n${text}`
      
      try {
        await navigator.clipboard.writeText(formattedText)
        setCopiedSection(true)
        setTimeout(() => setCopiedSection(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }, [activeSection, extractTextFromElement])

  // Copy all documentation - uses static text file (no rendering needed)
  const handleCopyAllDocs = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ALL_DOCS_TEXT)
      setCopiedAllDocs(true)
      setTimeout(() => setCopiedAllDocs(false), 2000)
    } catch (err) {
      console.error('Failed to copy all docs:', err)
    }
  }, [])

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory, isAsking])

  // Sidebar resize handlers
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.min(Math.max(200, newWidth), 500))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Enhanced markdown renderer with table support
  const renderMarkdown = (text: string) => {
    if (!text) return null
    
    const elements: React.ReactNode[] = []
    
    // Split by code blocks and tables
    const parts = text.split(/(```[\s\S]*?```)/g)
    
    parts.forEach((part, partIndex) => {
      // Code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3)
        const firstLineEnd = codeContent.indexOf('\n')
        // Remove language identifier from first line if present
        const code = firstLineEnd > 0 ? codeContent.slice(firstLineEnd + 1) : codeContent
        elements.push(
          <pre key={partIndex} className="bg-marketing-elevated rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
            <code>{code}</code>
          </pre>
        )
        return
      }
      
      // Check for tables in this part
      const lines = part.split('\n')
      let i = 0
      
      while (i < lines.length) {
        const line = lines[i]
        
        // Check if this is the start of a table
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          // Collect all table rows
          const tableRows: string[] = []
          while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
            tableRows.push(lines[i])
            i++
          }
          
          if (tableRows.length >= 2) {
            // Parse table
            const headerRow = tableRows[0]
            const separatorRow = tableRows[1]
            const bodyRows = tableRows.slice(2)
            
            // Check if second row is separator (contains dashes)
            const isSeparator = separatorRow.includes('---') || separatorRow.includes('- -')
            
            const parseRow = (row: string) => {
              return row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(cell => cell.trim())
            }
            
            const headers = parseRow(headerRow)
            const rows = (isSeparator ? bodyRows : tableRows.slice(1)).map(parseRow)
            
            elements.push(
              <div key={`table-${partIndex}-${i}`} className="overflow-x-auto my-3">
                <table className="min-w-full text-xs border border-marketing-border rounded-lg overflow-hidden">
                  <thead className="bg-marketing-elevated">
                    <tr>
                      {headers.map((header, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-semibold text-marketing-text border-b border-marketing-border">
                          {renderInlineFormatting(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-marketing-bg' : 'bg-marketing-surface'}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 text-marketing-muted border-b border-marketing-border">
                            {renderInlineFormatting(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
            continue
          }
        }
        
        // Headers
        if (line.startsWith('#### ')) {
          elements.push(<h5 key={`${partIndex}-${i}`} className="font-semibold text-marketing-text text-sm mt-3 mb-1">{line.slice(5)}</h5>)
        } else if (line.startsWith('### ')) {
          elements.push(<h4 key={`${partIndex}-${i}`} className="font-semibold text-marketing-text mt-3 mb-1">{line.slice(4)}</h4>)
        } else if (line.startsWith('## ')) {
          elements.push(<h3 key={`${partIndex}-${i}`} className="font-semibold text-marketing-text mt-3 mb-1">{line.slice(3)}</h3>)
        } else if (line.startsWith('# ')) {
          elements.push(<h2 key={`${partIndex}-${i}`} className="font-bold text-marketing-text mt-3 mb-1">{line.slice(2)}</h2>)
        }
        // Numbered lists
        else if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)/)
          if (match) {
            elements.push(
              <div key={`${partIndex}-${i}`} className="flex gap-2 my-0.5">
                <span className="text-marketing-link font-medium min-w-[1.5rem]">{match[1]}.</span>
                <span>{renderInlineFormatting(match[2])}</span>
              </div>
            )
          }
        }
        // Bullet points
        else if (line.startsWith('- ') || line.startsWith('* ')) {
          elements.push(
            <div key={`${partIndex}-${i}`} className="flex gap-2 my-0.5">
              <span className="text-marketing-link">•</span>
              <span>{renderInlineFormatting(line.slice(2))}</span>
            </div>
          )
        }
        // Blockquote
        else if (line.startsWith('> ')) {
          elements.push(
            <blockquote key={`${partIndex}-${i}`} className="border-l-2 border-marketing-link pl-3 my-2 text-marketing-muted italic">
              {renderInlineFormatting(line.slice(2))}
            </blockquote>
          )
        }
        // Horizontal rule
        else if (line.trim() === '---' || line.trim() === '***') {
          elements.push(<hr key={`${partIndex}-${i}`} className="border-marketing-border my-3" />)
        }
        // Empty line
        else if (!line.trim()) {
          elements.push(<div key={`${partIndex}-${i}`} className="h-2" />)
        }
        // Regular paragraph
        else {
          elements.push(<p key={`${partIndex}-${i}`} className="my-1">{renderInlineFormatting(line)}</p>)
        }
        
        i++
      }
    })
    
    return elements
  }

  const renderInlineFormatting = (text: string): React.ReactNode => {
    if (!text) return null
    
    // Process inline formatting
    let html = text
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-marketing-text">$1</strong>')
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-marketing-elevated px-1 py-0.5 rounded text-xs font-mono text-marketing-link">$1</code>')
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-marketing-link hover:underline">$1</a>')
    
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + I - Focus ask question input
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        if (showAnswerModal && sidebarInputRef.current) {
          sidebarInputRef.current.focus()
        } else {
          questionInputRef.current?.focus()
        }
      }
      // Cmd/Ctrl + K - Open search modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearchModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAnswerModal])

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || isAsking) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question.trim()
    }
    
    // Add user message to history
    setChatHistory(prev => [...prev, userMessage])
    setQuestion('')
    setIsAsking(true)
    setShowAnswerModal(true)

    // Create placeholder assistant message
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: ''
    }
    setChatHistory(prev => [...prev, assistantMessage])

    try {
      const response = await askQuestionAPI(userMessage.content)
      
      // Remove thinking indicator as soon as we have the response
      setIsAsking(false)
      
      // Stream the response character by character
      let currentIndex = 0
      const streamText = () => {
        if (currentIndex < response.length) {
          // Add characters in chunks for smoother streaming
          const chunkSize = Math.ceil(Math.random() * 3) + 1 // 1-4 characters at a time
          currentIndex += chunkSize
          
          setChatHistory(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: response.slice(0, currentIndex) }
                : msg
            )
          )
          
          // Continue streaming with slight delay
          setTimeout(streamText, 15) // 15ms delay between chunks for smooth effect
        }
      }
      
      streamText()
    } catch (error) {
      console.error('Error asking question:', error)
      setChatHistory(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: '',
                error: error instanceof Error ? error.message : 'Failed to get response'
              }
            : msg
        )
      )
      setIsAsking(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Navigate to a section and expand parent if needed
  const navigateToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    // Expand parent if it's a child item
    navigation.forEach(section => {
      section.items.forEach(item => {
        if (item.children?.some(child => child.id === sectionId)) {
          setExpandedItems(prev => new Set([...prev, item.id]))
        }
      })
    })
    // Instantly scroll to top
    scrollToTop()
  }

  const currentContent = docContent[activeSection] || docContent['introduction']

  // Find prev/next for navigation
  const allItems = navigation.flatMap(section => 
    section.items.flatMap(item => 
      item.children ? [item.id, ...item.children.map(c => c.id)] : [item.id]
    )
  )
  const currentIndex = allItems.indexOf(activeSection)
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

  const getItemLabel = (id: string): string => {
    for (const section of navigation) {
      for (const item of section.items) {
        if (item.id === id) return item.label
        if (item.children) {
          const child = item.children.find(c => c.id === id)
          if (child) return child.label
        }
      }
    }
    return id
  }

  return (
    <div className="marketing-page flex min-h-screen flex-col bg-marketing-bg font-inter text-marketing-text">
      {/* Frosted top band: docs body scrolls underneath; blur hides text behind nav + search (z below both) */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[30] h-[10.5rem] bg-marketing-bg/75 backdrop-blur-md supports-[backdrop-filter]:bg-marketing-bg/55 sm:h-[11rem]"
        aria-hidden
      />

      {/* Mobile menu button - Hidden when sidebar is open */}
      {!showMobileMenu && (
        <button 
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="fixed left-4 top-28 z-50 rounded-lg border border-marketing-border bg-marketing-elevated p-2 text-marketing-muted shadow-lg hover:text-marketing-text lg:hidden"
        >
          <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
        </button>
      )}

      {/* Search Bar - Centered below navbar (opens modal on click) */}
      <div className="fixed left-1/2 top-28 z-40 w-full max-w-[280px] -translate-x-1/2 px-4 lg:max-w-sm">
        <div className="relative">
          {/* Blur backdrop - Hidden on mobile */}
          <div className="absolute -inset-2 -z-10 rounded-full bg-marketing-bg/80 max-lg:bg-marketing-bg max-lg:backdrop-blur-none lg:backdrop-blur-md" />
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex w-full items-center gap-3 rounded-full border border-marketing-border bg-marketing-elevated py-2.5 pl-4 pr-4 text-sm text-marketing-muted shadow-lg backdrop-blur-sm transition-colors hover:border-indigo-500/40"
          >
            <FontAwesomeIcon icon={faSearch} className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Search docs...</span>
            <span className="rounded bg-marketing-surface px-1.5 py-0.5 text-xs">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </span>
          </button>
        </div>
      </div>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[101]"
              onClick={() => {
                setShowSearchModal(false)
                setSearchQuery('')
              }}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[102] flex items-start justify-center pt-[15vh] px-4"
              onClick={() => {
                setShowSearchModal(false)
                setSearchQuery('')
              }}
            >
              <div 
                className="marketing-panel w-full max-w-xl border rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-marketing-border">
                  <FontAwesomeIcon icon={faSearch} className="w-4 h-4 text-marketing-muted" />
                  <input
                    ref={searchModalInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-marketing-text placeholder:text-marketing-muted outline-none text-base"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-marketing-muted hover:text-marketing-text transition-colors"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                  {/* Recent Searches - shown when no query */}
                  {!searchQuery.trim() && recentSearches.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs text-marketing-muted uppercase tracking-wider px-2 py-2">Recent searches</p>
                      {recentSearches.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-marketing-elevated transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-marketing-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FontAwesomeIcon icon={result.icon || faFileLines} className="w-4 h-4 text-marketing-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-marketing-muted mb-0.5">
                              {result.breadcrumb.join(' › ')}
                            </p>
                            <p className="text-sm font-medium text-marketing-text truncate">{result.label}</p>
                            {result.description && result.description !== result.label && (
                              <p className="text-xs text-marketing-muted truncate mt-0.5">{result.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No recent searches message */}
                  {!searchQuery.trim() && recentSearches.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-marketing-muted">Start typing to search the documentation</p>
                    </div>
                  )}

                  {/* Search Results */}
                  {searchQuery.trim() && searchResults.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs text-marketing-muted uppercase tracking-wider px-2 py-2">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-marketing-elevated transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-marketing-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FontAwesomeIcon icon={result.icon || faFileLines} className="w-4 h-4 text-marketing-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-marketing-muted mb-0.5">
                              {result.breadcrumb.join(' › ')}
                            </p>
                            <p className="text-sm font-medium text-marketing-text truncate">{result.label}</p>
                            {result.description && result.description !== result.label && (
                              <p className="text-xs text-marketing-muted truncate mt-0.5">{result.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {searchQuery.trim() && searchResults.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-marketing-muted">No results found for "{searchQuery}"</p>
                      <p className="text-xs text-marketing-muted mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-marketing-border bg-marketing-elevated/50">
                  <div className="flex items-center gap-3 text-xs text-marketing-muted">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-marketing-surface rounded border border-marketing-border text-[10px]">↵</kbd>
                      to select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-marketing-surface rounded border border-marketing-border text-[10px]">esc</kbd>
                      to close
                    </span>
                  </div>
                  <span className="text-xs text-marketing-muted">TaskMaster AI Docs</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
              onClick={() => setShowContactModal(false)}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[71] flex items-center justify-center px-4"
              onClick={() => setShowContactModal(false)}
            >
              <div 
                className="marketing-panel w-full max-w-md border rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-marketing-border">
                  <h2 className="text-lg font-semibold text-marketing-text">Contact Support</h2>
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="text-marketing-muted hover:text-marketing-text transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-marketing-muted mb-6">
                    Have questions, found a bug, or want to request a feature? We'd love to hear from you!
                  </p>

                  <div className="space-y-4">
                    <a 
                      href="mailto:taskmasteroneai@gmail.com"
                      className="flex items-center gap-4 p-4 bg-marketing-elevated rounded-lg hover:bg-marketing-elevated/80 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-marketing-link/20 flex items-center justify-center">
                        <FontAwesomeIcon icon={faEnvelope} className="w-5 h-5 text-marketing-link" />
                      </div>
                      <div>
                        <p className="font-medium text-marketing-text group-hover:text-marketing-link-hover transition-colors">Email Us</p>
                        <p className="text-sm text-marketing-muted">taskmasteroneai@gmail.com</p>
                      </div>
                    </a>

                    <button 
                      onClick={() => {
                        setShowContactModal(false)
                        setActiveSection('contribute')
                        scrollToTop()
                      }}
                      className="flex items-center gap-4 p-4 bg-marketing-elevated rounded-lg hover:bg-marketing-elevated/80 transition-colors group w-full text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-marketing-link/20 flex items-center justify-center">
                        <FontAwesomeIcon icon={faQuestionCircle} className="w-5 h-5 text-marketing-link" />
                      </div>
                      <div>
                        <p className="font-medium text-marketing-text group-hover:text-marketing-link-hover transition-colors">View FAQ & Support</p>
                        <p className="text-sm text-marketing-muted">Common questions and how to report issues</p>
                      </div>
                    </button>
                  </div>

                  <p className="text-xs text-marketing-muted mt-6 text-center">
                    We typically respond within 24-48 hours.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex pt-3">
        {/* Left Sidebar */}
        <aside className={`w-64 border-r border-marketing-border bg-marketing-bg fixed top-0 lg:top-28 bottom-0 overflow-y-auto overscroll-contain z-[110] lg:z-30 transition-transform lg:translate-x-0 left-0 lg:left-[max(0px,calc((100vw-1024px)/2))] ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4">
            {/* Tab for Documentation */}
            <div className="border-b border-marketing-border mb-4 -mx-4 px-4 pb-3">
              <span className="text-sm font-medium text-marketing-text border-b-2 border-marketing-link pb-3">
                TaskMaster AI Documentation
              </span>
            </div>
            
            {/* External Links */}
            <div className="flex gap-4 mb-6 px-1">
              <button 
                onClick={() => setShowContactModal(true)}
                className="flex items-center gap-2 text-marketing-muted hover:text-marketing-text transition-colors text-sm"
              >
                <FontAwesomeIcon icon={faComments} className="w-4 h-4" />
                <span>Support</span>
              </button>
            </div>

            {/* Navigation */}
            <nav className="space-y-6">
              {navigation.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-marketing-muted uppercase tracking-wider px-3 mb-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <SidebarItem
                        key={item.id}
                        item={item}
                        activeSection={activeSection}
                        setActiveSection={(id) => {
                          setActiveSection(id)
                          setShowMobileMenu(false)
                        }}
                        expandedItems={expandedItems}
                        toggleExpanded={toggleExpanded}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile overlay */}
        {showMobileMenu && (
          <div 
            className="fixed inset-0 bg-black/50 z-[105] lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-[calc(max(0px,(100vw-1024px)/2)+256px)] lg:mr-[max(0px,calc((100vw-1024px)/2))] overflow-x-hidden">
          <div className="px-4 md:px-8 pt-11 lg:pt-14 pb-32 lg:pb-24 max-w-full overflow-x-hidden">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              {/* Breadcrumb */}
              <p className="text-sm text-marketing-link mb-2">{currentContent.breadcrumb || 'Documentation'}</p>
              
              {/* Title with Copy Buttons */}
              <div className="flex items-start justify-between gap-4 mb-8">
                <h1 className="text-3xl font-bold">{currentContent.title}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Copy Section Button */}
                  <button
                    onClick={handleCopySection}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-marketing-border rounded-lg text-marketing-muted hover:text-marketing-text hover:border-marketing-link transition-colors"
                    title="Copy this section"
                  >
                    <FontAwesomeIcon icon={copiedSection ? faCheck : faCopy} className={`w-3.5 h-3.5 ${copiedSection ? 'text-marketing-link' : ''}`} />
                    <span className="hidden sm:inline">{copiedSection ? 'Copied!' : 'Copy Section'}</span>
                  </button>
                  {/* Copy All Docs Button */}
                  <button
                    onClick={handleCopyAllDocs}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-marketing-border rounded-lg text-marketing-muted hover:text-marketing-text hover:border-marketing-link transition-colors"
                    title="Copy all documentation"
                  >
                    <FontAwesomeIcon 
                      icon={copiedAllDocs ? faCheck : faClipboard} 
                      className={`w-3.5 h-3.5 ${copiedAllDocs ? 'text-marketing-link' : ''}`} 
                    />
                    <span className="hidden sm:inline">
                      {copiedAllDocs ? 'Copied!' : 'Copy All Docs'}
                    </span>
                  </button>
                </div>
              </div>
              
              <NavigationContext.Provider value={{ navigateToSection }}>
                <div ref={contentRef} data-section-id={activeSection} className="prose prose-invert max-w-full overflow-x-hidden [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_code]:break-words [&_.marketing-panel]:overflow-hidden [&_.marketing-panel]:max-w-full [&_img]:max-w-full [&>*]:max-w-full">
                  {currentContent.content}
                </div>
              </NavigationContext.Provider>

              {/* Feedback */}
              <div className="flex items-center gap-4 mt-10 pt-6 border-t border-marketing-border">
                {feedbackGiven ? (
                  <span className="text-marketing-muted text-sm flex items-center gap-2">
                    <span className="text-marketing-link">✓</span> Thanks for your feedback!
                  </span>
                ) : (
                  <>
                    <span className="text-marketing-muted text-sm">Was this page helpful?</span>
                    <button 
                      onClick={() => setFeedbackGiven('yes')}
                      className="flex items-center gap-2 px-3 py-1.5 border border-marketing-border rounded-lg text-sm text-marketing-muted hover:border-marketing-link hover:text-marketing-link-hover transition-colors"
                    >
                      👍 Yes
                    </button>
                    <button 
                      onClick={() => setFeedbackGiven('no')}
                      className="flex items-center gap-2 px-3 py-1.5 border border-marketing-border rounded-lg text-sm text-marketing-muted hover:border-marketing-link hover:text-marketing-link-hover transition-colors"
                    >
                      👎 No
                    </button>
                  </>
                )}
              </div>

              {/* Prev/Next Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-marketing-border">
                {prevItem ? (
                  <button
                    onClick={() => {
                      setActiveSection(prevItem)
                      scrollToTop()
                    }}
                    className="flex items-center gap-2 text-marketing-muted hover:text-marketing-text transition-colors"
                  >
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 rotate-180" />
                    <span>{getItemLabel(prevItem)}</span>
                  </button>
                ) : <div />}
                
                {nextItem && (
                  <button
                    onClick={() => {
                      setActiveSection(nextItem)
                      scrollToTop()
                    }}
                    className="flex items-center gap-2 text-marketing-muted hover:text-marketing-text transition-colors"
                  >
                    <span>{getItemLabel(nextItem)}</span>
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                  </button>
                )}
              </div>
        </motion.div>

          </div>
        </main>

        {/* Floating Ask a Question Bar - Hidden when sidebar is open */}
        {!showAnswerModal && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-[280px] lg:max-w-none lg:w-auto">
            <motion.form 
              onSubmit={handleAskQuestion}
              initial={false}
              animate={{ 
                width: window.innerWidth >= 1024 ? (isInputFocused ? 400 : 300) : '100%'
              }}
              whileHover={{ scale: window.innerWidth >= 1024 ? 1.03 : 1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex items-center gap-2 px-4 py-2.5 bg-marketing-surface border rounded-full text-sm shadow-xl backdrop-blur-sm transition-colors ${isInputFocused ? 'border-marketing-link' : 'border-marketing-border'}`}
            >
              <input
                ref={questionInputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-marketing-text text-base placeholder:text-marketing-muted outline-none min-w-0"
                disabled={isAsking}
                data-gramm="true"
                data-gramm_editor="true"
                data-enable-grammarly="true"
                autoComplete="off"
                autoCorrect="on"
                spellCheck="true"
              />
              <span className="text-xs bg-marketing-elevated px-1.5 py-0.5 rounded text-marketing-muted flex-shrink-0">{isMac ? '⌘I' : 'Ctrl+I'}</span>
              <button 
                type="submit"
                disabled={!question.trim() || isAsking}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isAsking ? (
                  <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faArrowUp} className="w-3.5 h-3.5" />
                )}
              </button>
            </motion.form>
          </div>
        )}

        {/* AI Assistant Sidebar */}
        <AnimatePresence>
          {showAnswerModal && (
            <>
              {/* Click-away area (transparent, below navbar) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed top-28 left-0 right-0 bottom-0 z-[60]"
                onClick={() => setShowAnswerModal(false)}
              />
              
              {/* Sidebar - Desktop: slides from right, Mobile: slides from bottom */}
              <motion.div
                initial={window.innerWidth >= 1024 ? { x: '100%' } : { y: '100%' }}
                animate={window.innerWidth >= 1024 ? { x: 0 } : { y: 0 }}
                exit={window.innerWidth >= 1024 ? { x: '100%' } : { y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed z-[61] bg-marketing-bg border-marketing-border shadow-[0_0_40px_rgba(0,0,0,0.15)] flex flex-col
                           lg:top-28 lg:right-0 lg:bottom-0 lg:border-l lg:border-t lg:rounded-tl-2xl lg:bg-marketing-bg/95 lg:backdrop-blur-xl 
                           max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:top-auto max-lg:rounded-t-2xl max-lg:border-t max-lg:h-[75vh] max-lg:w-full max-lg:pb-safe"
                style={{ width: window.innerWidth >= 1024 ? sidebarWidth : '100%' }}
              >
                {/* Resize Handle */}
                <div
                  onMouseDown={startResizing}
                  className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-500/50 transition-colors group flex items-center justify-center"
                >
                  <div className="absolute left-0 w-4 h-full" />
                  <FontAwesomeIcon 
                    icon={faGripLinesVertical} 
                    className="w-2 h-4 text-border group-hover:text-marketing-link-hover transition-colors opacity-0 group-hover:opacity-100" 
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 ">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-marketing-link/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faComments} className="text-marketing-link w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-sm">Assistant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={resetChat}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-marketing-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Clear chat"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowAnswerModal(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-marketing-muted hover:text-marketing-text hover:bg-marketing-elevated transition-colors"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chat Messages */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                  {/* Welcome message when no conversation */}
                  {chatHistory.length === 0 && !isAsking && (
                    <div className="text-sm text-marketing-muted">
                      Hi there! How can I help you with TaskMaster AI today?
                    </div>
                  )}

                  {/* Chat History */}
                  {chatHistory.map((message) => (
                    <div key={message.id}>
                      {message.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="max-w-full text-sm text-marketing-muted">
                            {message.error ? (
                              <div className="text-red-400">
                                <p>Sorry, there was an error getting a response.</p>
                                <p className="text-xs mt-1 opacity-70">{message.error}</p>
                              </div>
                            ) : (
                              <div className="prose-sm">
                                {renderMarkdown(message.content)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isAsking && (
                    <div className="flex justify-start">
                      <div className="text-sm text-marketing-muted flex items-center gap-2">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin w-3.5 h-3.5" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area - Same style as floating */}
                <div className="p-3 pb-safe">
                  <form onSubmit={handleAskQuestion} className="flex items-center gap-2 px-4 py-2.5 bg-marketing-surface border border-marketing-border rounded-full">
                    <input
                      ref={sidebarInputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question..."
                      className="flex-1 bg-transparent text-marketing-text text-base placeholder:text-marketing-muted outline-none min-w-0"
                      disabled={isAsking}
                      data-gramm="true"
                      data-gramm_editor="true"
                      data-enable-grammarly="true"
                      autoComplete="off"
                      autoCorrect="on"
                      spellCheck="true"
                    />
                    <button
                      type="submit"
                      disabled={!question.trim() || isAsking}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {isAsking ? (
                        <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faArrowUp} className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>


      </div>
    </div>
  )
}









