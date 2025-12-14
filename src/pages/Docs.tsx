import { useState, useRef, useEffect, createContext, useContext } from 'react'
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
  faHandshake,
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
  faGripLinesVertical
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
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
      { id: 'contribute', label: 'Contribute', icon: faHandshake },
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
      className={`text-text font-medium underline hover:text-accent transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  )
}

// Collapsible Accordion Component
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border border-border rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-surface hover:bg-surface-highlight transition-colors text-left"
      >
        <FontAwesomeIcon 
          icon={isOpen ? faChevronDown : faChevronRight} 
          className="w-3 h-3 text-text-muted" 
        />
        <span className="text-text font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-background border-t border-border overflow-x-auto">
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
    <div className="card-elevated overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          {filename && <span className="text-xs text-text-subtle ml-2 font-mono">{filename}</span>}
        </div>
        <button 
          onClick={handleCopy}
          className="text-text-subtle hover:text-text transition-colors p-1"
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5" />
        </button>
      </div>
      <pre className="p-4 font-mono text-sm overflow-x-auto bg-background">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  )
}

// Tip/Info Box Component
function TipBox({ children, type = 'tip' }: { children: React.ReactNode; type?: 'tip' | 'info' | 'warning' }) {
  const styles = {
    tip: 'bg-accent/10 border-accent text-accent',
    info: 'bg-status-info/10 border-status-info text-status-info',
    warning: 'bg-status-warning/10 border-status-warning text-status-warning'
  }
  
  return (
    <div className={`border rounded-lg p-4 mb-6 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <FontAwesomeIcon icon={type === 'info' ? faInfoCircle : faLightbulb} className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
        
        <p className="text-text-muted mb-8">
          We've organized the docs into three sections depending on your experience level and goals:
        </p>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2">
              Getting Started - Jump in to <SectionLink sectionId="quick-start" className="text-accent">Quick Start</SectionLink>
            </h3>
            <p className="text-text-muted">
              Designed for first-time users. Get set up, configure your subscription, create your first PRD, and run your first task.
            </p>
              </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Best Practices</h3>
            <p className="text-text-muted">
              Covers common workflows, strategic usage of commands, model configuration tips, and real-world usage patterns. Recommended for active subscribers.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Technical Capabilities</h3>
            <p className="text-text-muted">
              A detailed glossary of every root command and available capability — meant for power users and contributors.
            </p>
        </div>
      </div>

        <hr className="border-border my-10" />

        <div className="bg-surface border border-border rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Pricing Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-border rounded-lg">
              <h4 className="font-semibold text-accent">Plus</h4>
              <p className="text-2xl font-bold mt-1">$29<span className="text-sm font-normal text-text-muted">/mo</span></p>
              <p className="text-sm text-text-muted mt-2">Up to 100 tasks/mo</p>
              <p className="text-xs text-text-subtle">$0.20 per extra task</p>
            </div>
            <div className="p-4 border border-accent rounded-lg bg-surface-elevated">
              <h4 className="font-semibold text-accent">Pro</h4>
              <p className="text-2xl font-bold mt-1">$199<span className="text-sm font-normal text-text-muted">/mo</span></p>
              <p className="text-sm text-text-muted mt-2">Up to 1,000 tasks/mo</p>
              <p className="text-xs text-text-subtle">$0.15 per extra task</p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <h4 className="font-semibold text-accent">Enterprise</h4>
              <p className="text-2xl font-bold mt-1">$599<span className="text-sm font-normal text-text-muted">+</span></p>
              <p className="text-sm text-text-muted mt-2">5,000+ tasks/mo</p>
              <p className="text-xs text-text-subtle">Volume discounts available</p>
            </div>
          </div>
        </div>

        <p className="text-text-muted mb-4">
          Have questions about pricing or need a custom plan? Contact our{' '}
          <a href="mailto:taskmasteroneai@gmail.com" className="text-text hover:text-accent underline">
            sales team
          </a>.
        </p>

        <p className="text-text-muted">
          Need support? Join our{' '}
          <a href="https://discord.gg/taskmaster" target="_blank" rel="noopener noreferrer" className="text-text hover:text-accent underline">
            Discord community
          </a>{' '}
          to connect with other users and get help from the team.
        </p>
      </>
    )
  },
  'quick-start': {
    title: 'Quick Start',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-text-muted mb-6">
          This guide is for new subscribers who want to start using TaskMaster AI with minimal setup time. Make sure you have an active subscription before proceeding.
        </p>

        <p className="text-text-muted mb-4">It covers:</p>

        <ul className="space-y-3 mb-8">
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="requirements">Requirements</SectionLink>: You will need Node.js, an active subscription, and an AI model API Key.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="installation">Installation</SectionLink>: How to install and activate TaskMaster AI.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="configuration">Configuration</SectionLink>: Setting up your API Key, MCP, and subscription.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="prd-creation">PRD</SectionLink>: Writing and parsing your first PRD.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="tasks-setup">Task Setup</SectionLink>: Preparing your tasks for execution.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
            <span>•</span>
            <span><SectionLink sectionId="executing-tasks">Executing Tasks</SectionLink>: Using TaskMaster AI to execute tasks.</span>
          </li>
          <li className="flex items-start gap-2 text-text-muted">
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
        <p className="text-text-muted mb-8">
          Before you can start using TaskMaster AI, you'll need an active subscription, Node.js installed, and at least one model API Key configured.
        </p>

        <TipBox type="info">
          TaskMaster AI requires an active subscription. Plans start at $29/month for Plus. Visit the <a href="/pricing" className="text-accent underline">Pricing page</a> to choose a plan.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4">1. Node.js</h3>
        <p className="text-text-muted mb-4">
          TaskMaster AI is built with Node.js and requires it to run. npm (Node Package Manager) comes bundled with Node.js.
        </p>
        
        <Accordion title="Install Node.js">
          <h4 className="text-lg font-semibold mb-3">Installation</h4>
          
          <p className="font-medium mb-3">Option 1: Download from official website</p>
          <ol className="list-decimal list-inside space-y-2 text-text-muted mb-6">
            <li>Visit <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-text underline hover:text-accent">nodejs.org</a></li>
            <li>Download the <span className="text-accent font-medium">LTS (Long Term Support)</span> version for your operating system</li>
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
        <p className="text-text-muted mb-4">
          TaskMaster AI utilizes AI across several commands, and those require a separate API key. For the purpose of a Quick Start we recommend setting up an API Key with Anthropic for your main model and Perplexity for your research model (optional but recommended).
        </p>

        <TipBox>
          TaskMaster AI shows API costs per command used. Most users load $5-10 on their keys and don't have to top it off for a few months.
        </TipBox>

        <p className="text-text-muted mb-4">At least one (1) of the following is required:</p>
        
        <ol className="list-decimal list-inside space-y-2 text-text-muted">
          <li>Anthropic API key (Claude API) - <span className="text-text font-medium">recommended for Quick Start</span></li>
          <li>OpenAI API key</li>
          <li>Google Gemini API key</li>
          <li>Perplexity API key (for research model)</li>
          <li>xAI API Key (for research or main model)</li>
          <li>OpenRouter API Key (for research or main model)</li>
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
        <p className="text-text-muted mb-6">
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
          
          <p className="text-text-muted text-sm mb-4">
            Or click the copy button (top-right of code block) then paste into your browser:
          </p>
          
          <CodeBlock 
            code="cursor://anysphere.cursor-deeplink/mcp/install?name=taskmasterai&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB0YXNrbWFzdGVyYWkvY2xpIiwidGFza21hc3Rlci1tY3AiXSwiZW52Ijp7IkFOVEhST1BJQ19BUElfS0VZIjoiWU9VUl9BTlRIUk9QSUNfQVBJX0tFWV9IRVJFIiwiUEVSUExFWElUWV9BUElfS0VZIjoiWU9VUl9QRVJQTEVYSVRZX0FQSV9LRVlfSEVSRSIsIk9QRU5BSV9BUElfS0VZIjoiWU9VUl9PUEVOQUlfS0VZX0hFUkUiLCJHT09HTEVfQVBJX0tFWSI6IllPVVJfR09PR0xFX0tFWV9IRVJFIiwiTUlTVFJBTF9BUElfS0VZIjoiWU9VUl9NSVNUUkFMX0tFWV9IRVJFIiwiT1BFTlJPVVRFUl9BUElfS0VZIjoiWU9VUl9PUEVOUk9VVEVSX0tFWV9IRVJFIiwiWEFJX0FQSV9LRVkiOiJZT1VSX1hBSV9LRVlfSEVSRSJ9fQ=="
            filename="URL"
          />
          
          <blockquote className="border-l-2 border-border pl-4 text-text-muted text-sm my-4">
            <strong>Note:</strong> After clicking the link, you'll still need to add your API keys to the configuration. The link installs the MCP server with placeholder keys that you'll need to replace with your actual API keys.
          </blockquote>

          <h4 className="text-lg font-semibold mt-6 mb-3">Claude Code Quick Install</h4>
          <p className="text-text-muted text-sm mb-3">For Claude Code users:</p>
          
          <CodeBlock 
            code="claude mcp add taskmasterai -- npx -y @taskmasterai/cli taskmaster-mcp"
            filename="Terminal"
          />
          
          <p className="text-text-muted text-sm mt-4">Don't forget to add your API keys to the configuration:</p>
          <ul className="list-disc list-inside text-text-muted text-sm space-y-1 mt-2">
            <li>in the root .env of your Project</li>
            <li>in the "env" section of your mcp config for taskmasterai</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4">Installation Options</h3>

        <Accordion title="Option 1: MCP (Recommended)">
          <p className="text-text-muted mb-4">
            MCP (Model Control Protocol) lets you run TaskMaster AI directly from your editor.
          </p>

          <h4 className="font-semibold mb-3">1. Add your MCP config at the following path depending on your editor</h4>
          
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Editor</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Scope</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Linux/macOS Path</th>
                  <th className="text-left py-2 text-text-muted font-medium">Windows Path</th>
                </tr>
              </thead>
              <tbody className="text-text-muted">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Cursor</td>
                  <td className="py-2 pr-4">Global</td>
                  <td className="py-2 pr-4 font-mono text-xs">~/.cursor/mcp.json</td>
                  <td className="py-2 font-mono text-xs">%USERPROFILE%\.cursor\mcp.json</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"></td>
                  <td className="py-2 pr-4">Project</td>
                  <td className="py-2 pr-4 font-mono text-xs">&lt;project_folder&gt;/.cursor/mcp.json</td>
                  <td className="py-2 font-mono text-xs">&lt;project_folder&gt;\.cursor\mcp.json</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Windsurf</td>
                  <td className="py-2 pr-4">Global</td>
                  <td className="py-2 pr-4 font-mono text-xs">~/.codeium/windsurf/mcp_config.json</td>
                  <td className="py-2 font-mono text-xs">%USERPROFILE%\.codeium\windsurf\mcp_config.json</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">VS Code</td>
                  <td className="py-2 pr-4">Project</td>
                  <td className="py-2 pr-4 font-mono text-xs">&lt;project_folder&gt;/.vscode/mcp.json</td>
                  <td className="py-2 font-mono text-xs">&lt;project_folder&gt;\.vscode\mcp.json</td>
                </tr>
              </tbody>
            </table>
            </div>

          <h4 className="font-semibold mb-3">Manual Configuration</h4>
          <p className="text-text-muted text-sm mb-3">Cursor & Windsurf ( <code className="bg-surface-highlight px-1.5 py-0.5 rounded">mcpServers</code> )</p>
          
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

          <p className="text-text-muted text-sm mt-4">
            🔑 Replace <code className="bg-surface-highlight px-1.5 py-0.5 rounded">YOUR_*_KEY_HERE</code> with your real API keys. You can remove keys you don't use.
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
          <p className="text-text-muted mb-4">
            Before you can use TaskMaster AI, you need to login. Use the same email and password from your dashboard account.
          </p>
          
          <CodeBlock 
            code={`# Login with email & password
taskmaster login

# Or login with Google
taskmaster login --google

# Check login status
taskmaster whoami`}
            filename="Terminal"
          />

          <TipBox type="info">
            When you login, your license is automatically activated and API keys are synced from your dashboard.
          </TipBox>

          <h4 className="text-lg font-semibold mt-6 mb-4">Step 3: Sync API Keys (Optional)</h4>
          <p className="text-text-muted mb-4">
            If you've configured API keys in your <a href="/app/api-keys" className="text-accent underline">Dashboard</a>, you can sync them to your CLI:
          </p>
          
          <CodeBlock 
            code="taskmaster sync"
            filename="Terminal"
          />

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

          <p className="text-text-muted text-sm mt-4">
            This will prompt you for project details and set up a new project with the necessary files and structure.
          </p>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">License Management</h3>
        <p className="text-text-muted mb-4">
          TaskMaster AI requires a valid license to use AI features. Here are the license management commands:
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-text-muted font-medium">Command</th>
                <th className="text-left py-2 text-text-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login</td>
                <td className="py-2">Login to your account (automatically activates license)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster logout</td>
                <td className="py-2">Logout and clear your session</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster whoami</td>
                <td className="py-2">Show current user and license status</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster usage</td>
                <td className="py-2">View AI operations usage and remaining limits</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster sync</td>
                <td className="py-2">Sync API keys and model config from your dashboard</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TipBox>
          Your license key is tied to your subscription plan. Upgrade your plan at any time from your <a href="/app/settings" className="text-accent underline">Dashboard → Settings</a> page.
        </TipBox>
      </>
    )
  },
  'configuration': {
    title: 'Configuration',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-text-muted mb-6">
          Configure TaskMaster AI by setting up your API keys and model preferences.
        </p>

        <h3 className="text-xl font-semibold mb-4">Environment Variables</h3>
        <p className="text-text-muted mb-4">
          Create a <code className="text-text bg-surface-highlight px-2 py-1 rounded">.env</code> file in your project root:
        </p>

        <CodeBlock 
          code={`ANTHROPIC_API_KEY=your_anthropic_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
OPENAI_API_KEY=your_openai_key_here`}
          filename=".env"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Configure Models</h3>
        <p className="text-text-muted mb-4">
          Run the interactive model setup:
        </p>

        <CodeBlock 
          code="taskmaster models --setup"
          filename="Terminal"
        />

        <p className="text-text-muted mb-4 mt-6">Or set models directly:</p>

        <CodeBlock 
          code={`# Set main model
taskmaster models --set-main claude-sonnet-4-20250514

# Set research model
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
        <p className="text-text-muted mb-6">
          A Product Requirements Document (PRD) outlines what you're building and why. TaskMaster AI parses your PRD and creates structured tasks automatically.
        </p>

        <h3 className="text-xl font-semibold mb-4">1. Write a PRD</h3>
        <p className="text-text-muted mb-4">
          TaskMaster provides two templates in <code className="text-text bg-surface-highlight px-2 py-1 rounded">.taskmaster/templates/</code>:
        </p>
        <ul className="list-disc list-inside text-text-muted space-y-1 mb-6">
          <li><code className="bg-surface-highlight px-1.5 py-0.5 rounded">example_prd.txt</code> - Suitable for straightforward projects</li>
          <li><code className="bg-surface-highlight px-1.5 py-0.5 rounded">example_prd_rpg.txt</code> - Designed for complex projects with multiple modules</li>
        </ul>

        <p className="text-text-muted mb-4">Create your PRD with the following structure:</p>

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
        <p className="text-text-muted mb-4">
          Place your PRD file in the <code className="text-text bg-surface-highlight px-2 py-1 rounded">.taskmaster/docs</code> folder. You can have multiple PRDs per project; ensure each is clearly named.
        </p>

        <h3 className="text-xl font-semibold mb-4 mt-8">3. Parse the PRD into Tasks</h3>
        <p className="text-text-muted mb-4">Run the parse command to generate tasks:</p>

        <CodeBlock 
          code={`# Parse PRD and generate tasks
taskmaster parse-prd .taskmaster/docs/prd.md

# Limit number of generated tasks
taskmaster parse-prd .taskmaster/docs/prd.md --num-tasks=10

# Append to existing tasks (for additional PRDs)
taskmaster parse-prd .taskmaster/docs/new-feature.md --append`}
          filename="Terminal"
        />

        <p className="text-text-muted my-4">
          This generates a structured <code className="bg-surface-highlight px-1.5 py-0.5 rounded">tasks.json</code> file containing:
        </p>
        <ul className="list-disc list-inside text-text-muted space-y-1 mb-6">
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
        <p className="text-text-muted mb-6">
          After parsing your PRD, you'll want to analyze and expand your tasks before executing them. This involves two key steps: analyzing task complexity and expanding tasks into subtasks.
        </p>

        <h3 className="text-xl font-semibold mb-4">1. Analyze Task Complexity</h3>
        <p className="text-text-muted mb-4">
          Understanding the complexity of each task helps determine which tasks need further breakdown. Task Master uses AI to assess complexity on a scale of 1-10 and recommends the optimal number of subtasks.
        </p>

        <CodeBlock 
          code={`# Basic complexity analysis
taskmaster analyze-complexity

# With research model for more informed analysis
taskmaster analyze-complexity --research`}
          filename="Terminal"
        />

        <p className="text-text-muted my-4">
          The generated report contains:
        </p>
        <ul className="list-disc list-inside text-text-muted space-y-1 mb-6">
          <li>Complexity analysis for each task (1-10 scale)</li>
          <li>Recommended number of subtasks</li>
          <li>AI-generated expansion prompts</li>
          <li>Ready-to-run expansion commands</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">2. View the Complexity Report</h3>
        <p className="text-text-muted mb-4">
          After generating the report, view it in a formatted display:
        </p>

        <CodeBlock 
          code="taskmaster complexity-report"
          filename="Terminal"
        />

        <p className="text-text-muted my-4">
          This shows tasks organized by complexity score, distribution statistics, and ready-to-use expansion commands for each complex task.
        </p>

        <h3 className="text-xl font-semibold mb-4">3. Expand Tasks into Subtasks</h3>
        <p className="text-text-muted mb-4">
          Break down complex tasks into manageable subtasks. It's recommended to expand all tasks at once:
        </p>

        <CodeBlock 
          code={`# Expand all pending tasks (recommended)
taskmaster expand --all

# Expand a specific task
taskmaster expand --id=5

# Expand with specific number of subtasks
taskmaster expand --id=5 --num=3

# Expand with additional context
taskmaster expand --id=5 --prompt="Focus on performance optimization"

# Force regenerate existing subtasks
taskmaster expand --id=5 --force

# Use research model for better subtasks
taskmaster expand --id=5 --research`}
          filename="Terminal"
        />

        <TipBox>
          When a complexity report exists, the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">expand --all</code> command automatically uses the recommended subtask count and processes tasks in order of complexity (highest first).
        </TipBox>
      </>
    )
  },
  'executing-tasks': {
    title: 'Executing Tasks',
    breadcrumb: 'Quick Start',
    content: (
      <>
        <p className="text-text-muted mb-6">
          Now you're ready to start executing tasks. TaskMaster AI helps you work through tasks efficiently by managing dependencies, priorities, and progress tracking.
        </p>

        <h3 className="text-xl font-semibold mb-4">Daily Workflow</h3>
        <p className="text-text-muted mb-4">
          Follow this workflow cycle for efficient task execution:
        </p>

        <h4 className="text-lg font-medium mb-3 mt-6">1. View All Tasks</h4>
        <CodeBlock 
          code={`# List all tasks
taskmaster list

# Filter by status
taskmaster list --status=pending

# Include subtasks
taskmaster list --with-subtasks`}
          filename="Terminal" 
        />

        <h4 className="text-lg font-medium mb-3 mt-6">2. Find the Next Task</h4>
        <p className="text-text-muted mb-4">
          This command identifies the next task considering dependencies and priorities:
        </p>
        <CodeBlock code="taskmaster next" filename="Terminal" />

        <h4 className="text-lg font-medium mb-3 mt-6">3. View Task Details</h4>
        <p className="text-text-muted mb-4">
          Get comprehensive details about a specific task including status, priority, dependencies, and implementation notes:
        </p>
        <CodeBlock code="taskmaster show --id=1.1" filename="Terminal" />

        <h4 className="text-lg font-medium mb-3 mt-6">4. Execute the Task</h4>
        <p className="text-text-muted mb-4">
          Implement the task according to the provided details and guidelines. As you work, log your progress:
        </p>
        <CodeBlock 
          code={`# Add implementation notes
taskmaster update-subtask --id=1.1 --prompt="Implemented the database schema with the following tables..."

# Use research for AI-powered insights
taskmaster update-subtask --id=1.1 --prompt="Need to optimize query performance" --research`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">5. Mark Task Complete</h4>
        <p className="text-text-muted mb-4">
          After completing and verifying the task, update its status:
        </p>
        <CodeBlock 
          code={`# Mark as done
taskmaster set-status --id=1.1 --status=done

# Other status options: pending, in-progress, blocked, deferred`}
          filename="Terminal" 
        />

        <h4 className="text-lg font-medium mb-3 mt-6">6. Handle Implementation Changes</h4>
        <p className="text-text-muted mb-4">
          If your implementation differs from the original plan, update future tasks:
        </p>
        <CodeBlock 
          code={`# Update tasks from a specific ID onwards
taskmaster update --from=5 --prompt="We switched from MongoDB to PostgreSQL"`}
          filename="Terminal" 
        />

        <TipBox>
          Repeat this cycle: <code className="bg-surface-highlight px-1.5 py-0.5 rounded">next</code> → <code className="bg-surface-highlight px-1.5 py-0.5 rounded">show</code> → implement → <code className="bg-surface-highlight px-1.5 py-0.5 rounded">update-subtask</code> → <code className="bg-surface-highlight px-1.5 py-0.5 rounded">set-status</code>
        </TipBox>
      </>
    )
  },
  'api-keys': {
    title: 'API Keys Configuration',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-text-muted mb-6">
          TaskMaster AI requires both an active subscription and API keys from your preferred AI providers. The subscription covers TaskMaster's orchestration and management features, while API keys provide access to AI model providers.
        </p>

        <TipBox type="warning">
          <strong>Note:</strong> API provider costs are separate from your TaskMaster AI subscription. You'll be billed directly by the AI provider (Anthropic, OpenAI, etc.) for model usage.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4">Required API Keys</h3>
        
        <Accordion title="ANTHROPIC_API_KEY (Recommended)" defaultOpen>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Anthropic Claude models</li>
            <li>• <strong>Format:</strong> <code className="bg-surface-highlight px-1 rounded">sk-ant-api03-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Models:</strong> Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus</li>
            <li>• <strong>Get Key:</strong> <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline">Anthropic Console</a></li>
          </ul>
          <CodeBlock code="ANTHROPIC_API_KEY=sk-ant-api03-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="PERPLEXITY_API_KEY (Highly Recommended for Research)">
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Perplexity AI (Research features)</li>
            <li>• <strong>Format:</strong> <code className="bg-surface-highlight px-1 rounded">pplx-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Purpose:</strong> Enables research-backed task expansions and updates</li>
            <li>• <strong>Models:</strong> Perplexity Sonar models</li>
            <li>• <strong>Get Key:</strong> <a href="https://www.perplexity.ai/" target="_blank" rel="noopener noreferrer" className="text-accent underline">Perplexity API</a></li>
          </ul>
          <CodeBlock code="PERPLEXITY_API_KEY=pplx-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="OPENAI_API_KEY">
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> OpenAI GPT models</li>
            <li>• <strong>Format:</strong> <code className="bg-surface-highlight px-1 rounded">sk-proj-...</code> or <code className="bg-surface-highlight px-1 rounded">sk-...</code></li>
            <li>• <strong>Required:</strong> ✅ Yes</li>
            <li>• <strong>Models:</strong> GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, O1 models</li>
            <li>• <strong>Get Key:</strong> <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline">OpenAI Platform</a></li>
          </ul>
          <CodeBlock code="OPENAI_API_KEY=sk-your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="GOOGLE_API_KEY">
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• <strong>Provider:</strong> Google Gemini models</li>
            <li>• <strong>Models:</strong> Gemini Pro, Gemini Ultra</li>
            <li>• <strong>Get Key:</strong> <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-accent underline">Google AI Studio</a></li>
          </ul>
          <CodeBlock code="GOOGLE_API_KEY=your-key-here" filename=".env" />
        </Accordion>

        <Accordion title="Other Providers (GROQ, OpenRouter, xAI, Azure, Ollama)">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">GROQ_API_KEY</p>
              <CodeBlock code="GROQ_API_KEY=your-key-here" filename=".env" />
            </div>
            <div>
              <p className="font-medium mb-2">OPENROUTER_API_KEY</p>
              <CodeBlock code="OPENROUTER_API_KEY=your-key-here" filename=".env" />
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
          <p className="text-text-muted mb-4">Create a <code className="bg-surface-highlight px-1.5 py-0.5 rounded">.env</code> file in your project root:</p>
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
          <p className="text-text-muted mb-4">Set environment variables in your shell profile:</p>
          <CodeBlock 
            code={`# Add to ~/.bashrc, ~/.zshrc, or equivalent
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
export PERPLEXITY_API_KEY="pplx-your-key-here"`}
            filename="Shell"
          />
        </Accordion>

        <Accordion title="Method 3: MCP Server Configuration">
          <p className="text-text-muted mb-4">Add keys to your MCP config file:</p>
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
          <strong>Security Best Practices:</strong> Never commit API keys to version control. Add <code className="bg-surface-highlight px-1 rounded">.env</code> to your <code className="bg-surface-highlight px-1 rounded">.gitignore</code> file.
        </TipBox>
      </>
    )
  },
  'license-usage': {
    title: 'License & Usage',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-text-muted mb-6">
          TaskMaster AI requires a valid license to use AI-powered features. Your license determines your monthly AI operation limits.
        </p>

        <h3 className="text-xl font-semibold mb-4">Authentication</h3>
        <p className="text-text-muted mb-4">
          After purchasing a subscription, login to your account from the CLI. Your license will be automatically activated.
        </p>

        <CodeBlock 
          code={`# Login to your account
taskmaster login

# Or login with Google
taskmaster login --google

# Check your login status
taskmaster whoami`}
          filename="Terminal"
        />

        <TipBox type="info">
          When you login, TaskMaster AI automatically syncs your license and API keys from your <a href="/app/settings" className="text-accent underline">Dashboard</a>.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Authentication Commands</h3>
        
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-text-muted font-medium">Command</th>
                <th className="text-left py-2 text-text-muted font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster login</td>
                <td className="py-2">Login to your account (automatically activates your license)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster logout</td>
                <td className="py-2">Logout and clear your session</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster whoami</td>
                <td className="py-2">Show current user, license status, and plan details</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster usage</td>
                <td className="py-2">View current AI operations count and remaining limits for the billing period</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">taskmaster sync</td>
                <td className="py-2">Sync API keys and model configuration from your dashboard</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-8">Usage Tracking</h3>
        <p className="text-text-muted mb-4">
          Each AI-powered operation counts toward your monthly limit. Check your usage anytime:
        </p>

        <CodeBlock 
          code="taskmaster usage"
          filename="Terminal"
        />

        <p className="text-text-muted mb-4 mt-4">
          AI operations that count toward your limit include:
        </p>

        <ul className="list-disc list-inside space-y-2 text-text-muted mb-6">
          <li><code className="bg-surface-highlight px-1 rounded">parse-prd</code> - Parsing a PRD to generate tasks</li>
          <li><code className="bg-surface-highlight px-1 rounded">expand</code> - Expanding tasks into subtasks</li>
          <li><code className="bg-surface-highlight px-1 rounded">add-task</code> - Adding a task with AI-generated content</li>
          <li><code className="bg-surface-highlight px-1 rounded">update-task</code> - Updating a task with AI assistance</li>
          <li><code className="bg-surface-highlight px-1 rounded">update-subtask</code> - Updating a subtask with AI assistance</li>
          <li><code className="bg-surface-highlight px-1 rounded">analyze-complexity</code> - Analyzing task complexity</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-8">Dashboard Sync</h3>
        <p className="text-text-muted mb-4">
          Configure your API keys and model preferences in your dashboard, then sync them to the CLI:
        </p>

        <CodeBlock 
          code={`# Configure keys in dashboard, then sync
taskmaster sync

# This syncs:
# - API keys from your dashboard
# - Model configuration (main, research, fallback)
# - Any updated settings`}
          filename="Terminal"
        />

        <TipBox>
          Dashboard sync is optional. You can also configure API keys directly via environment variables or <code className="bg-surface-highlight px-1 rounded">.env</code> files.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Plan Limits</h3>
        
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-text-muted font-medium">Plan</th>
                <th className="text-left py-2 pr-4 text-text-muted font-medium">Price</th>
                <th className="text-left py-2 text-text-muted font-medium">AI Operations/Month</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-medium">Plus</td>
                <td className="py-2 pr-4">$29/month</td>
                <td className="py-2">500</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-medium">Pro</td>
                <td className="py-2 pr-4">$199/month</td>
                <td className="py-2">2,000</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-medium">Enterprise</td>
                <td className="py-2 pr-4">Custom</td>
                <td className="py-2">Unlimited</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-text-muted">
          Upgrade your plan anytime from your <a href="/app/settings" className="text-accent underline">Dashboard → Settings</a> page. Usage resets at the start of each billing cycle.
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
            <p className="text-text-muted">
              TaskMaster AI is an AI-powered task management system that helps developers break down complex projects into manageable tasks and execute them efficiently using AI assistance.
            </p>
          </Accordion>
          
          <Accordion title="Which AI models are supported?">
            <p className="text-text-muted">
              TaskMaster AI supports Claude (Anthropic), GPT (OpenAI), Gemini (Google), Perplexity, Grok (xAI), Mistral, and models via OpenRouter.
            </p>
          </Accordion>
          
          <Accordion title="How much does it cost?">
            <p className="text-text-muted">
              TaskMaster AI is a paid service with affordable subscription plans. Check our <a href="/pricing" className="text-accent hover:underline">pricing page</a> for current plans and features. You'll also pay for AI API usage (most users spend $5-10 per month on API costs). TaskMaster AI shows the cost of each command after it runs.
            </p>
          </Accordion>
          
          <Accordion title="Can I use it with my IDE?">
            <p className="text-text-muted">
              Yes! TaskMaster AI integrates with IDEs via the MCP (Model Context Protocol). It works great with Cursor, VS Code with Copilot, Windsurf, and other compatible editors.
            </p>
          </Accordion>

          <Accordion title="Do I need multiple API keys?">
            <p className="text-text-muted">
              No, you only need one API key to get started. However, we recommend using Anthropic for the main model and Perplexity for research operations for the best experience.
            </p>
          </Accordion>
          </div>
      </>
    )
  },
  'contribute': {
    title: 'Contribute',
    breadcrumb: 'Getting Started',
    content: (
      <>
        <p className="text-text-muted mb-6">
          Thank you for your interest in contributing to TaskMaster AI! We're excited to work with you and appreciate your help in making this project better. 🚀
        </p>

        <h3 className="text-xl font-semibold mb-4">🤝 Our Collaborative Approach</h3>
        <p className="text-text-muted mb-4">We're a <strong>PR-friendly team</strong> that values collaboration:</p>
        <ul className="text-text-muted space-y-2 mb-6">
          <li>✅ <strong>We review PRs quickly</strong> - Usually within hours, not days</li>
          <li>✅ <strong>We're super reactive</strong> - Expect fast feedback and engagement</li>
          <li>✅ <strong>We sometimes take over PRs</strong> - If your contribution is valuable but needs cleanup, we might jump in to help finish it</li>
          <li>✅ <strong>We're open to all contributions</strong> - From bug fixes to major features</li>
        </ul>

        <p className="text-text-muted mb-4"><strong>We don't mind AI-generated code</strong>, but we do expect you to:</p>
        <ul className="text-text-muted space-y-1 mb-6">
          <li>✅ <strong>Review and understand</strong> what the AI generated</li>
          <li>✅ <strong>Test the code thoroughly</strong> before submitting</li>
          <li>✅ <strong>Ensure it's well-written</strong> and follows our patterns</li>
          <li>❌ <strong>Don't submit "AI slop"</strong> - untested, unreviewed AI output</li>
        </ul>

        <TipBox>
          <strong>Why this matters:</strong> We spend significant time reviewing PRs. Help us help you by submitting quality contributions that save everyone time!
        </TipBox>

        <div className="grid md:grid-cols-2 gap-4 mb-8 mt-8">
          <a
            href="mailto:taskmasteroneai@gmail.com"
            className="card hover:border-border-light p-5 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faComments} className="w-5 h-5" />
              <span className="font-medium">Contact Support</span>
            </div>
            <p className="text-sm text-text-muted">Report issues, suggest features, or get help</p>
          </a>
          
          <a 
            href="https://discord.gg/taskmaster" 
            target="_blank" 
            rel="noopener noreferrer"
            className="card hover:border-border-light p-5 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faDiscord} className="w-5 h-5" />
              <span className="font-medium">Discord Community</span>
            </div>
            <p className="text-sm text-text-muted">Join discussions and get help from the community</p>
          </a>
        </div>

        <h3 className="text-xl font-semibold mb-4">🚀 Getting Help</h3>
        
        <Accordion title="Report an Issue" defaultOpen>
          <p className="text-text-muted mb-3">
            If you encounter a bug or have a feature request, please reach out to us:
          </p>
          <ul className="text-text-muted space-y-2">
            <li>📧 Email: <a href="mailto:taskmasteroneai@gmail.com" className="text-accent hover:underline">taskmasteroneai@gmail.com</a></li>
            <li>💬 Discord: <a href="https://discord.gg/taskmaster" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Join our community</a></li>
          </ul>
        </Accordion>

        <Accordion title="2. Create a Feature Branch">
          <p className="text-text-muted mb-3"><strong>Important:</strong> Always target the <code className="bg-surface-highlight px-1 rounded">next</code> branch, not <code className="bg-surface-highlight px-1 rounded">main</code>:</p>
          <CodeBlock 
            code={`git checkout next
git pull origin next
git checkout -b feature/your-feature-name`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="3. Make Your Changes">
          <p className="text-text-muted">Follow the development guidelines below.</p>
        </Accordion>

        <Accordion title="4. Test Everything Yourself">
          <p className="text-text-muted mb-3"><strong>Before submitting your PR</strong>, ensure:</p>
          <CodeBlock 
            code={`# Run all tests
npm test

# Check formatting
npm run format-check

# Fix formatting if needed
npm run format`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="5. Create a Changeset">
          <p className="text-text-muted mb-3"><strong>Required for most changes:</strong></p>
          <CodeBlock code="npm run changeset" filename="Terminal" />
          <p className="text-text-muted mt-3">See Changeset Guidelines below for details.</p>
        </Accordion>

        <Accordion title="6. Submit Your PR">
          <ul className="text-text-muted space-y-1">
            <li>• Target the <code className="bg-surface-highlight px-1 rounded">next</code> branch</li>
            <li>• Write a clear description</li>
            <li>• Reference any related issues</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">📋 Development Guidelines</h3>

        <Accordion title="Branch Strategy">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">main</code>: Production-ready code</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">next</code>: Development branch - <strong>target this for PRs</strong></li>
            <li>• <strong>Feature branches:</strong> <code className="bg-surface-highlight px-1 rounded">feature/description</code> or <code className="bg-surface-highlight px-1 rounded">fix/description</code></li>
          </ul>
        </Accordion>

        <Accordion title="Code Quality Standards">
          <ol className="list-decimal list-inside text-text-muted space-y-2">
            <li><strong>Write tests</strong> for new functionality</li>
            <li><strong>Follow existing patterns</strong> in the codebase</li>
            <li><strong>Add JSDoc comments</strong> for functions</li>
            <li><strong>Keep functions focused</strong> and single-purpose</li>
          </ol>
        </Accordion>

        <Accordion title="Testing Requirements">
          <p className="text-text-muted mb-3">Your PR <strong>must pass all CI checks</strong>:</p>
          <ul className="text-text-muted space-y-1">
            <li>✅ <strong>Unit tests:</strong> <code className="bg-surface-highlight px-1 rounded">npm test</code></li>
            <li>✅ <strong>Format check:</strong> <code className="bg-surface-highlight px-1 rounded">npm run format-check</code></li>
          </ul>
          <p className="text-text-muted mt-3"><strong>Test your changes locally first</strong> - this saves review time and shows you care about quality.</p>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">📦 Changeset Guidelines</h3>
        <p className="text-text-muted mb-4">We use Changesets to manage versioning and generate changelogs.</p>

        <Accordion title="When to Create a Changeset">
          <p className="text-text-muted mb-3"><strong>Always create a changeset for:</strong></p>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>✅ New features</li>
            <li>✅ Bug fixes</li>
            <li>✅ Breaking changes</li>
            <li>✅ Performance improvements</li>
            <li>✅ User-facing documentation updates</li>
            <li>✅ Dependency updates that affect functionality</li>
          </ul>
          <p className="text-text-muted mb-3"><strong>Skip changesets for:</strong></p>
          <ul className="text-text-muted space-y-1">
            <li>❌ Internal documentation only</li>
            <li>❌ Test-only changes</li>
            <li>❌ Code formatting/linting</li>
            <li>❌ Development tooling that doesn't affect users</li>
          </ul>
        </Accordion>

        <Accordion title="How to Create a Changeset">
          <ol className="list-decimal list-inside text-text-muted space-y-3">
            <li><strong>After making your changes:</strong>
              <CodeBlock code="npm run changeset" filename="Terminal" />
            </li>
            <li><strong>Choose the bump type:</strong>
              <ul className="ml-6 mt-2 space-y-1">
                <li>• <strong>Major:</strong> Breaking changes</li>
                <li>• <strong>Minor:</strong> New features</li>
                <li>• <strong>Patch:</strong> Bug fixes, docs, performance improvements</li>
              </ul>
            </li>
            <li><strong>Write a clear summary</strong></li>
            <li><strong>Commit the changeset file</strong> with your changes</li>
          </ol>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">🔧 Development Setup</h3>

        <Accordion title="Prerequisites">
          <ul className="text-text-muted space-y-1">
            <li>• Node.js 20+</li>
            <li>• npm or yarn</li>
          </ul>
        </Accordion>

        <Accordion title="Environment Setup">
          <CodeBlock 
            code={`# Copy environment template
cp .env.example .env

# Add your API keys (for testing AI features)
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="Running Tests">
          <CodeBlock 
            code={`# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="Code Formatting">
          <p className="text-text-muted mb-3">We use Prettier for consistent formatting:</p>
          <CodeBlock 
            code={`# Check formatting
npm run format-check

# Fix formatting
npm run format`}
            filename="Terminal"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">📝 PR Guidelines</h3>

        <Accordion title="Before Submitting">
          <ul className="text-text-muted space-y-1">
            <li>• <strong>Target the <code className="bg-surface-highlight px-1 rounded">next</code> branch</strong></li>
            <li>• <strong>Test everything locally</strong></li>
            <li>• <strong>Run the full test suite</strong></li>
            <li>• <strong>Check code formatting</strong></li>
            <li>• <strong>Create a changeset</strong> (if needed)</li>
            <li>• <strong>Re-read your changes</strong> - ensure they're clean and well-thought-out</li>
          </ul>
        </Accordion>

        <Accordion title="What We Look For">
          <p className="text-text-muted mb-3">✅ <strong>Good PRs:</strong></p>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• Clear, focused changes</li>
            <li>• Comprehensive testing</li>
            <li>• Good commit messages</li>
            <li>• Proper changeset (when needed)</li>
            <li>• Self-reviewed code</li>
          </ul>
          <p className="text-text-muted mb-3">❌ <strong>Avoid:</strong></p>
          <ul className="text-text-muted space-y-1">
            <li>• Massive PRs that change everything</li>
            <li>• Untested code</li>
            <li>• Formatting issues</li>
            <li>• Missing changesets for user-facing changes</li>
            <li>• AI-generated code that wasn't reviewed</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">🏗️ TaskMaster Project Structure</h3>
        <CodeBlock 
          code={`your-project/
├── .taskmaster/
│   ├── tasks/
│   │   └── tasks.json     # Main task database
│   ├── docs/              # PRDs and documentation
│   ├── reports/           # Complexity reports
│   ├── templates/         # PRD templates
│   └── config.json        # Configuration
└── .env                   # API keys`}
          filename="Project Structure"
        />

        <p className="text-text-muted mt-4 mb-2"><strong>Key Areas for Contribution:</strong></p>
        <ul className="text-text-muted space-y-1">
          <li>• <strong>CLI Commands:</strong> <code className="bg-surface-highlight px-1 rounded">scripts/modules/commands.js</code></li>
          <li>• <strong>MCP Tools:</strong> <code className="bg-surface-highlight px-1 rounded">mcp-server/src/tools/</code></li>
          <li>• <strong>Core Logic:</strong> <code className="bg-surface-highlight px-1 rounded">scripts/modules/task-manager/</code></li>
          <li>• <strong>AI Providers:</strong> <code className="bg-surface-highlight px-1 rounded">src/ai-providers/</code></li>
          <li>• <strong>Tests:</strong> <code className="bg-surface-highlight px-1 rounded">tests/</code></li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-8">🐛 Reporting Issues</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="card p-4">
            <h4 className="font-medium text-accent mb-2">Bug Reports</h4>
            <p className="text-sm text-text-muted">Include: TaskMaster version, Node.js version, OS, steps to reproduce, expected vs actual behavior, error messages/logs</p>
          </div>
          <div className="card p-4">
            <h4 className="font-medium text-accent mb-2">Feature Requests</h4>
            <p className="text-sm text-text-muted">Include: Clear description, use case/motivation, proposed implementation (if you have ideas), willingness to contribute</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4 mt-8">📄 License</h3>
        <p className="text-text-muted">
          By contributing, you agree that your contributions will be licensed under the same license as the project (MIT with Commons Clause).
        </p>

        <TipBox type="info">
          <strong>Thank you for contributing to TaskMaster AI!</strong> 🎉 Your contributions help make AI-driven development more accessible and efficient for everyone.
        </TipBox>
      </>
    )
  },
  'cli-commands': {
    title: 'CLI Commands',
    breadcrumb: 'Technical Capabilities',
    content: (
      <>
        <p className="text-text-muted mb-6">
          Complete reference of all TaskMaster AI CLI commands organized by category.
        </p>

        <h3 className="text-xl font-semibold mb-4">Project Setup</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster init</code>
            <p className="text-sm text-text-muted mt-1">Initialize a new TaskMaster project with necessary directories and configuration files.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster parse-prd &lt;file&gt; [--num-tasks=N]</code>
            <p className="text-sm text-text-muted mt-1">Parse a PRD file to generate tasks. Use --num-tasks to limit the number of tasks generated.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models --setup</code>
            <p className="text-sm text-text-muted mt-1">Interactive setup for configuring AI models (main, research, fallback).</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Viewing</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster list [--status=STATUS] [--with-subtasks]</code>
            <p className="text-sm text-text-muted mt-1">Display all tasks. Filter by status or include subtasks in the listing.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster next</code>
            <p className="text-sm text-text-muted mt-1">Show the next task to work on based on dependencies and priorities.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster show --id=&lt;id&gt;</code>
            <p className="text-sm text-text-muted mt-1">Display comprehensive details about a specific task including implementation notes.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Management</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster add-task --prompt="&lt;description&gt;" [--research]</code>
            <p className="text-sm text-text-muted mt-1">Create a new task using AI. Use --research for more informed task creation.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster set-status --id=&lt;id&gt; --status=&lt;status&gt;</code>
            <p className="text-sm text-text-muted mt-1">Update task status (pending, in-progress, done, blocked, deferred).</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster update-subtask --id=&lt;id&gt; --prompt="&lt;notes&gt;"</code>
            <p className="text-sm text-text-muted mt-1">Add implementation notes or progress updates to a subtask.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster update --from=&lt;id&gt; --prompt="&lt;changes&gt;"</code>
            <p className="text-sm text-text-muted mt-1">Update multiple tasks from a specific ID onwards with new context.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Task Expansion</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster expand --id=&lt;id&gt; [--num=N] [--force] [--research]</code>
            <p className="text-sm text-text-muted mt-1">Break down a task into subtasks. Use --force to regenerate existing subtasks.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster expand --all [--research]</code>
            <p className="text-sm text-text-muted mt-1">Expand all pending tasks at once, processing by complexity order.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster analyze-complexity [--research]</code>
            <p className="text-sm text-text-muted mt-1">Analyze task complexity and generate recommendations for subtask counts.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster clear-subtasks --id=&lt;id&gt; | --all</code>
            <p className="text-sm text-text-muted mt-1">Clear subtasks from a specific task or all tasks.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster remove-task --id=&lt;id&gt; [-y]</code>
            <p className="text-sm text-text-muted mt-1">Remove a task or subtask. Use -y to skip confirmation.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Dependencies</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster add-dependency --id=&lt;id&gt; --depends-on=&lt;id&gt;</code>
            <p className="text-sm text-text-muted mt-1">Add a dependency between tasks.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster remove-dependency --id=&lt;id&gt; --depends-on=&lt;id&gt;</code>
            <p className="text-sm text-text-muted mt-1">Remove a dependency between tasks.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Authentication & Usage</h3>
        <div className="space-y-3 mb-8">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster login</code>
            <p className="text-sm text-text-muted mt-1">Login to your TaskMaster AI account (automatically activates your license).</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster logout</code>
            <p className="text-sm text-text-muted mt-1">Logout from your account and clear your session.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster whoami</code>
            <p className="text-sm text-text-muted mt-1">Display current user, license status, and plan details.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster usage</code>
            <p className="text-sm text-text-muted mt-1">View AI operations usage count and remaining limit for current billing period.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster sync</code>
            <p className="text-sm text-text-muted mt-1">Sync API keys and model configuration from your TaskMaster dashboard.</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Configuration</h3>
        <div className="space-y-3">
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models</code>
            <p className="text-sm text-text-muted mt-1">Display current AI model configuration (main, research, fallback).</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models --setup</code>
            <p className="text-sm text-text-muted mt-1">Interactive setup for configuring AI models.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models --set-main &lt;model&gt;</code>
            <p className="text-sm text-text-muted mt-1">Set the main AI model for task generation.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models --set-research &lt;model&gt;</code>
            <p className="text-sm text-text-muted mt-1">Set the research model for research-backed operations.</p>
          </div>
          <div className="card p-4">
            <code className="text-sm text-accent font-mono">taskmaster models --set-fallback &lt;model&gt;</code>
            <p className="text-sm text-text-muted mt-1">Set the fallback model if primary fails.</p>
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
        <p className="text-text-muted mb-6">
          This document provides an overview of the MCP (Machine-to-Machine Communication Protocol) interface for TaskMaster AI. The MCP interface exposes the application's core functionalities as a set of tools that can be called remotely.
        </p>

        <h3 className="text-xl font-semibold mb-4">Core Concepts</h3>
        <p className="text-text-muted mb-4">
          The MCP interface is built on top of the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">fastmcp</code> library and registers a set of tools that correspond to the core functionalities of TaskMaster. These tools are defined in the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">mcp-server/src/tools/</code> directory.
        </p>
        <p className="text-text-muted mb-6">
          Each tool is defined with a name, description, and parameters validated using the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">zod</code> library. The <code className="bg-surface-highlight px-1.5 py-0.5 rounded">execute</code> function of each tool calls the corresponding core logic function.
        </p>

        <h3 className="text-xl font-semibold mb-4">Configurable Tool Loading</h3>
        <p className="text-text-muted mb-4">
          To optimize LLM context usage, you can control which tools are loaded using the <code className="text-text bg-surface-highlight px-2 py-1 rounded">TASK_MASTER_TOOLS</code> environment variable. This is particularly useful when working with LLMs that have context limits.
        </p>

        <h4 className="text-lg font-medium mb-3">Configuration Modes</h4>

        <div className="space-y-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">core</span>
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">7 tools - Default/Lean Mode</span>
            </div>
            <p className="text-sm text-text-muted mb-2">Essential tools for daily development. Ideal for minimal context usage.</p>
            <ul className="text-sm text-text-muted space-y-1">
              <li>• <code className="bg-surface-highlight px-1 rounded">get_tasks</code> - List all tasks</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">next_task</code> - Find the next task to work on</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">get_task</code> - Get detailed task information</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">set_task_status</code> - Update task status</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">update_subtask</code> - Add implementation notes</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">parse_prd</code> - Generate tasks from PRD</li>
              <li>• <code className="bg-surface-highlight px-1 rounded">expand_task</code> - Break down tasks into subtasks</li>
            </ul>
            <p className="text-xs text-text-subtle mt-3">You can also use "lean" as an alias for "core". If TASK_MASTER_TOOLS is not set, core tools are loaded by default.</p>
          </div>
          
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">all</span>
              <span className="text-xs bg-surface-highlight text-text-muted px-2 py-0.5 rounded">Full Mode</span>
            </div>
            <p className="text-sm text-text-muted mb-2">Full functionality including all task management and analysis tools.</p>
            <p className="text-sm text-text-muted">All core tools plus: <code className="bg-surface-highlight px-1 rounded">init</code>, <code className="bg-surface-highlight px-1 rounded">analyze_complexity</code>, <code className="bg-surface-highlight px-1 rounded">expand_all</code>, <code className="bg-surface-highlight px-1 rounded">remove_task</code>, <code className="bg-surface-highlight px-1 rounded">add_task</code>, <code className="bg-surface-highlight px-1 rounded">add_dependency</code>, <code className="bg-surface-highlight px-1 rounded">remove_dependency</code></p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-4">Choosing the Right Configuration</h3>
        <ul className="space-y-2 text-text-muted mb-6">
          <li>• Use <code className="bg-surface-highlight px-1.5 py-0.5 rounded">core</code>: Default setting, ideal for basic task management or when context limits are strict</li>
          <li>• Use <code className="bg-surface-highlight px-1.5 py-0.5 rounded">all</code>: When you need full functionality including task creation, analysis, and dependencies</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4 mt-8">Tool Categories</h3>
        <p className="text-text-muted mb-4">The MCP tools are organized into the following categories:</p>

        <Accordion title="1. Task Management" defaultOpen>
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">add_task</code> - Creates a new task with AI assistance</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">remove_task</code> - Removes a task or subtask</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">update_task</code> - Updates a task with new information</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">update_subtask</code> - Appends timestamped notes to a subtask</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">clear_subtasks</code> - Clears all subtasks from a task</li>
          </ul>
        </Accordion>

        <Accordion title="2. Task Information and Status">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">get_tasks</code> - Lists all tasks</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">get_task</code> - Shows the details of a specific task</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">next_task</code> - Shows the next task to work on</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">set_task_status</code> - Sets the status of a task or subtask</li>
          </ul>
        </Accordion>

        <Accordion title="3. Task Analysis and Expansion">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">parse_prd</code> - Parses a PRD to generate tasks</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">expand_task</code> - Expands a task into subtasks</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">expand_all</code> - Expands all pending tasks</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">analyze_complexity</code> - Analyzes task complexity</li>
          </ul>
        </Accordion>

        <Accordion title="4. Dependencies">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">add_dependency</code> - Adds a dependency to a task</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">remove_dependency</code> - Removes a dependency from a task</li>
          </ul>
        </Accordion>

        <Accordion title="5. Project and Configuration">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">init</code> - Initializes a new project</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">models</code> - Manages AI model configurations</li>
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
        <p className="text-text-muted mb-6">
          Tasks in TaskMaster AI are structured with several key fields to effectively manage and execute projects. These fields are defined in the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">tasks.json</code> file.
        </p>

        <h3 className="text-xl font-semibold mb-4">Task Fields in tasks.json</h3>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-text font-medium">Field</th>
                <th className="text-left py-2 text-text font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">id</td>
                <td className="py-2">Unique identifier for the task</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">title</td>
                <td className="py-2">Brief, descriptive title of the task</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">description</td>
                <td className="py-2">Overview of what the task involves</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">status</td>
                <td className="py-2">Current state (pending, done, in-progress, etc.)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">dependencies</td>
                <td className="py-2">Array of prerequisite task IDs that must be completed first</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">priority</td>
                <td className="py-2">Importance level: high, medium, or low</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">details</td>
                <td className="py-2">Implementation instructions and additional information</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">testStrategy</td>
                <td className="py-2">How to verify successful completion of the task</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-accent">subtasks</td>
                <td className="py-2">Array of nested subtasks related to the main task</td>
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
  "subtasks": [
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
        <ul className="space-y-2 text-text-muted mb-6">
          <li>• <strong>Main tasks:</strong> <code className="bg-surface-highlight px-1.5 py-0.5 rounded">1</code>, <code className="bg-surface-highlight px-1.5 py-0.5 rounded">2</code>, <code className="bg-surface-highlight px-1.5 py-0.5 rounded">3</code></li>
          <li>• <strong>Subtasks:</strong> <code className="bg-surface-highlight px-1.5 py-0.5 rounded">1.1</code>, <code className="bg-surface-highlight px-1.5 py-0.5 rounded">1.2</code>, <code className="bg-surface-highlight px-1.5 py-0.5 rounded">2.1</code></li>
          <li>• <strong>Nested subtasks:</strong> <code className="bg-surface-highlight px-1.5 py-0.5 rounded">1.1.1</code>, <code className="bg-surface-highlight px-1.5 py-0.5 rounded">1.1.2</code></li>
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
            <div key={status} className="bg-surface border border-border rounded-lg p-3">
              <code className="text-sm text-accent">{status}</code>
              <p className="text-xs text-text-muted mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">Task File Format</h3>
        <p className="text-text-muted mb-4">
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
          <p className="text-text-muted mb-3">The <code className="bg-surface-highlight px-1 rounded">analyze-complexity</code> command:</p>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• Analyzes each task using AI to assess complexity on a scale of 1-10</li>
            <li>• Recommends optimal number of subtasks based on configured DEFAULT_SUBTASKS</li>
            <li>• Generates tailored prompts for expanding each task</li>
            <li>• Creates a comprehensive JSON report with ready-to-use commands</li>
            <li>• Saves the report to <code className="bg-surface-highlight px-1 rounded">scripts/task-complexity-report.json</code> by default</li>
          </ul>
          <p className="text-text-muted mb-2">The generated report contains:</p>
          <ul className="text-text-muted space-y-1">
            <li>• Complexity analysis for each task (scored 1-10)</li>
            <li>• Recommended number of subtasks based on complexity</li>
            <li>• AI-generated expansion prompts customized for each task</li>
            <li>• Ready-to-run expansion commands</li>
          </ul>
        </Accordion>

        <Accordion title="Viewing Complexity Report">
          <p className="text-text-muted mb-3">The <code className="bg-surface-highlight px-1 rounded">complexity-report</code> command:</p>
          <ul className="text-text-muted space-y-1">
            <li>• Displays a formatted, easy-to-read version of the complexity analysis report</li>
            <li>• Shows tasks organized by complexity score (highest to lowest)</li>
            <li>• Provides complexity distribution statistics (low, medium, high)</li>
            <li>• Highlights tasks recommended for expansion based on threshold score</li>
            <li>• Includes ready-to-use expansion commands for each complex task</li>
            <li>• If no report exists, offers to generate one on the spot</li>
          </ul>
        </Accordion>

        <Accordion title="Smart Task Expansion">
          <p className="text-text-muted mb-3">The <code className="bg-surface-highlight px-1 rounded">expand</code> command automatically checks for and uses the complexity report:</p>
          <p className="text-text-muted mb-3"><strong>When a complexity report exists:</strong></p>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• Tasks are automatically expanded using the recommended subtask count and prompts</li>
            <li>• When expanding all tasks, they're processed in order of complexity (highest first)</li>
            <li>• Research-backed generation is preserved from the complexity analysis</li>
            <li>• You can still override recommendations with explicit command-line options</li>
          </ul>
          <p className="text-text-muted mb-2"><strong>Example workflow:</strong></p>
          <CodeBlock 
            code={`# Generate the complexity analysis report with research
taskmaster analyze-complexity --research

# Review the report in a readable format
taskmaster complexity-report

# Expand tasks using the optimized recommendations
taskmaster expand --id=8
# or expand all tasks
taskmaster expand --all`}
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="Finding the Next Task">
          <p className="text-text-muted mb-3">The <code className="bg-surface-highlight px-1 rounded">next</code> command:</p>
          <ul className="text-text-muted space-y-1 mb-4">
            <li>• Identifies tasks that are pending/in-progress and have all dependencies satisfied</li>
            <li>• Prioritizes tasks by priority level, dependency count, and task ID</li>
            <li>• Displays comprehensive information about the selected task</li>
          </ul>
          <p className="text-text-muted mb-2">Information displayed includes:</p>
          <ul className="text-text-muted space-y-1">
            <li>• Basic task details (ID, title, priority, dependencies)</li>
            <li>• Implementation details</li>
            <li>• Subtasks (if they exist)</li>
            <li>• Contextual suggested actions</li>
          </ul>
        </Accordion>

        <Accordion title="Viewing Specific Task Details">
          <p className="text-text-muted mb-3">The <code className="bg-surface-highlight px-1 rounded">show</code> command:</p>
          <ul className="text-text-muted space-y-1">
            <li>• Displays comprehensive details about a specific task or subtask</li>
            <li>• Shows task status, priority, dependencies, and detailed implementation notes</li>
            <li>• For parent tasks, displays all subtasks and their status</li>
            <li>• For subtasks, shows parent task relationship</li>
            <li>• Provides contextual action suggestions based on the task's state</li>
            <li>• Works with both regular tasks and subtasks (using the format <code className="bg-surface-highlight px-1 rounded">taskId.subtaskId</code>)</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Best Practices for AI-Driven Development</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">📝 Detailed PRD</p>
            <p className="text-sm text-text-muted">The more detailed your PRD, the better the generated tasks will be.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">👀 Review Tasks</p>
            <p className="text-sm text-text-muted">After parsing the PRD, review tasks to ensure they make sense and have appropriate dependencies.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">📊 Analyze Complexity</p>
            <p className="text-sm text-text-muted">Use complexity analysis to identify which tasks should be broken down further.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">⛓️ Follow Dependencies</p>
            <p className="text-sm text-text-muted">Always respect task dependencies - the agent will help with this.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">🔄 Update As You Go</p>
            <p className="text-sm text-text-muted">If implementation diverges from the plan, use update command to keep future tasks aligned.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">📦 Break Down Tasks</p>
            <p className="text-sm text-text-muted">Use expand command to break down complex tasks into manageable subtasks.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">🔄 Regenerate Files</p>
            <p className="text-sm text-text-muted">After updates to tasks.json, regenerate task files to keep them in sync.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">💬 Provide Context</p>
            <p className="text-sm text-text-muted">When asking the agent for help with a task, provide context about what you're achieving.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-accent mb-2">✅ Validate Dependencies</p>
            <p className="text-sm text-text-muted">Periodically run validate-dependencies to check for invalid or circular dependencies.</p>
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
        <p className="text-text-muted mb-6">
          Advanced patterns and workflows for power users to maximize productivity with TaskMaster AI.
        </p>

        <h3 className="text-xl font-semibold mb-4">Dashboard Sync Workflow</h3>
        <p className="text-text-muted mb-4">
          Configure your API keys and model preferences once in the dashboard, then sync them across all your projects:
        </p>
        
        <CodeBlock 
          code={`# After configuring keys in https://www.taskmaster.one/app/api-keys
taskmaster sync

# This syncs:
# - All your API keys (Anthropic, OpenAI, Google, etc.)
# - Model configuration (main, research, fallback)
# - Any other dashboard settings`}
          filename="Terminal"
        />

        <TipBox>
          Dashboard sync is especially useful when working across multiple machines or projects. Configure once, sync everywhere.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4 mt-8">Usage Monitoring</h3>
        <p className="text-text-muted mb-4">
          Keep track of your AI operations to stay within your plan limits:
        </p>
        
        <CodeBlock 
          code={`# Check your current usage
taskmaster usage

# View breakdown of operations:
# - Tasks from PRD
# - Tasks expanded  
# - Tasks added
# - Complexity analyses`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">AI-Driven Development Workflow</h3>
        
        <Accordion title="1. Task Discovery and Selection">
          <p className="text-text-muted mb-3">Inquire about available tasks:</p>
          <CodeBlock 
            code={`taskmaster list
taskmaster next`}
            filename="Terminal"
          />
          <p className="text-text-muted mt-3">The agent analyzes dependencies and priorities to suggest the next tasks.</p>
        </Accordion>

        <Accordion title="2. Task Implementation">
          <p className="text-text-muted mb-3">Before starting, request implementation details:</p>
          <CodeBlock 
            code="taskmaster show --id=<task_id>"
            filename="Terminal"
          />
          <p className="text-text-muted mt-3">This provides specifics including dependencies and coding standards.</p>
        </Accordion>

        <Accordion title="3. Verification and Completion">
          <p className="text-text-muted mb-3">After implementation, verify according to the test strategy:</p>
          <CodeBlock 
            code="taskmaster set-status --id=<task_id> --status=done"
            filename="Terminal"
          />
        </Accordion>

        <Accordion title="4. Handling Implementation Changes">
          <p className="text-text-muted mb-3">If changes arise during implementation:</p>
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
        <p className="text-text-muted mb-6">
          Advanced configuration options for customizing TaskMaster AI behavior and model selection.
        </p>
        
        <h3 className="text-xl font-semibold mb-4">Configuration File</h3>
        <p className="text-text-muted mb-4">
          TaskMaster stores configuration in <code className="bg-surface-highlight px-1.5 py-0.5 rounded">.taskmaster/config.json</code>. Use the models command to modify it:
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
    "research": {
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
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "defaultTag": "master"
  }
}`}
          filename=".taskmaster/config.json"
          language="json"
        />

        <TipBox type="warning">
          Do not manually edit the config file. Use <code className="bg-surface-highlight px-1 rounded">taskmaster models</code> commands to modify configuration.
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

        <h3 className="text-xl font-semibold mb-4 mt-8">Tagged System Configuration</h3>
        <p className="text-text-muted mb-4">
          Configure the default tag and behavior in the global settings:
        </p>
        <CodeBlock 
          code={`"global": {
  "defaultTag": "master"
}`}
          filename="config.json snippet"
          language="json"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Project Structure</h3>
        <p className="text-text-muted mb-4">
          TaskMaster stores all data in the <code className="bg-surface-highlight px-1.5 py-0.5 rounded">.taskmaster</code> directory:
        </p>
        <CodeBlock 
          code={`{
  ".taskmaster/": {
    "config.json": "Project configuration",
    "tasks/tasks.json": "All tasks data",
    "reports/": "Complexity reports"
  }
}`}
          filename=".taskmaster/"
          language="json"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Environment Variables</h3>
        <p className="text-text-muted mb-4">
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
        <p className="text-text-muted mb-6">
          Advanced task management techniques for complex projects and team workflows.
        </p>
        
        <h3 className="text-xl font-semibold mb-4">Updating Tasks</h3>
        <p className="text-text-muted mb-4">
          When implementation changes affect tasks, update them with new context:
        </p>
        <CodeBlock 
          code={`# Update a task with new information
taskmaster update-task --id=5 --prompt="We're now using PostgreSQL instead of MongoDB"

# Append notes without replacing (like update-subtask)
taskmaster update-task --id=5 --prompt="Added migration scripts" --append

# Update with research for more informed changes
taskmaster update-task --id=5 --prompt="Switching to TypeScript" --research`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Breaking Down Complex Tasks</h3>
        <p className="text-text-muted mb-4">
          For complex tasks, generate subtasks with specific counts or context:
        </p>
        <CodeBlock 
          code={`# Expand with specific number of subtasks
taskmaster expand --id=7 --num=5

# Expand with additional context
taskmaster expand --id=7 --prompt="Focus on error handling and edge cases"

# Force regenerate existing subtasks
taskmaster expand --id=7 --force --research`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Dependency Management</h3>
        <CodeBlock 
          code={`# Add a dependency
taskmaster add-dependency --id=5 --depends-on=3

# Remove a dependency
taskmaster remove-dependency --id=5 --depends-on=3`}
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Manual Task Creation</h3>
        <CodeBlock 
          code={`# Add a new task with AI structuring
taskmaster add-task --prompt="Implement user authentication with JWT"

# Add with dependencies and priority
taskmaster add-task --prompt="Add rate limiting" --dependencies=3,4 --priority=high

# Use research model for more informed task creation
taskmaster add-task --prompt="Implement caching layer" --research`}
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
        <p className="text-text-muted mb-6">
          TaskMaster AI's Autopilot is an autonomous Test-Driven Development (TDD) workflow system that helps AI agents implement features following strict TDD practices.
        </p>
        
        <TipBox>
          Autopilot manages workflow state, Git operations, test validation, and progress tracking automatically.
        </TipBox>

        <h3 className="text-xl font-semibold mb-4">Key Features</h3>
        <ul className="space-y-2 text-text-muted mb-8">
          <li>• <strong>TDD State Machine:</strong> Enforces the RED → GREEN → COMMIT cycle</li>
          <li>• <strong>Git Integration:</strong> Automates branch creation and commits with metadata</li>
          <li>• <strong>Test Validation:</strong> Ensures RED phase has failures and GREEN phase passes</li>
          <li>• <strong>Progress Tracking:</strong> Monitors subtask completion and attempt counts</li>
          <li>• <strong>State Persistence:</strong> Automatically manages workflow state for resumability</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">Prerequisites</h3>
        <ul className="list-disc list-inside text-text-muted space-y-1 mb-8">
          <li>An initialized TaskMaster project with defined subtasks</li>
          <li>A clean Git repository</li>
          <li>A configured test framework (e.g., Vitest, Jest)</li>
        </ul>

        <h3 className="text-xl font-semibold mb-4">Quick Start</h3>

        <h4 className="text-lg font-medium mb-3">1. Initialize Workflow</h4>
        <CodeBlock 
          code="tm autopilot start 7"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">2. Check Next Action</h4>
        <CodeBlock 
          code="tm autopilot next"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">3. Write Failing Test (RED Phase)</h4>
        <p className="text-text-muted mb-3">Create a test file that initially fails, then run tests and complete the phase:</p>
        <CodeBlock 
          code={`tm autopilot complete --results '{"total":1,"passed":0,"failed":1,"skipped":0}'`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">4. Implement Code (GREEN Phase)</h4>
        <p className="text-text-muted mb-3">Write implementation code to pass the tests:</p>
        <CodeBlock 
          code={`tm autopilot complete --results '{"total":1,"passed":1,"failed":0,"skipped":0}'`}
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">5. Commit Changes</h4>
        <CodeBlock 
          code="tm autopilot commit"
          filename="Terminal"
        />

        <h4 className="text-lg font-medium mb-3 mt-6">6. Repeat for Next Subtask</h4>
        <CodeBlock 
          code="tm autopilot next"
          filename="Terminal"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Workflow Phases</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {[
            { phase: 'PREFLIGHT', desc: 'Validates prerequisites' },
            { phase: 'BRANCH_SETUP', desc: 'Creates workflow branch' },
            { phase: 'RED', desc: 'Write failing test' },
            { phase: 'GREEN', desc: 'Implement to pass' },
            { phase: 'COMMIT', desc: 'Commit changes' },
            { phase: 'COMPLETE', desc: 'Workflow finished' },
          ].map(({ phase, desc }) => (
            <div key={phase} className="bg-surface border border-border rounded-lg p-3">
              <code className="text-sm text-accent">{phase}</code>
              <p className="text-xs text-text-muted mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">Common Patterns</h3>

        <Accordion title="Parse Test Output">
          <p className="text-text-muted mb-3">Your test runner outputs human-readable format - convert to JSON:</p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Vitest:</p>
              <p className="text-sm text-text-muted font-mono mb-1">Tests  2 failed | 8 passed | 10 total</p>
              <p className="text-sm text-text-muted">→ <code className="bg-surface-highlight px-1 rounded">{`{"total":10,"passed":8,"failed":2,"skipped":0}`}</code></p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Jest:</p>
              <p className="text-sm text-text-muted font-mono mb-1">Tests:  2 failed, 8 passed, 10 total</p>
              <p className="text-sm text-text-muted">→ <code className="bg-surface-highlight px-1 rounded">{`{"total":10,"passed":8,"failed":2,"skipped":0}`}</code></p>
            </div>
          </div>
        </Accordion>

        <Accordion title="Handle Errors">
          <p className="text-text-muted mb-3"><strong>Problem:</strong> RED phase won't complete - "no test failures"</p>
          <p className="text-text-muted mb-3"><strong>Solution:</strong> Your test isn't testing new behavior. Make sure it fails:</p>
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

          <p className="text-text-muted mt-4 mb-3"><strong>Problem:</strong> GREEN phase won't complete - "tests still failing"</p>
          <p className="text-text-muted"><strong>Solution:</strong> Fix your implementation until all tests pass, then try again.</p>
        </Accordion>

        <Accordion title="Resume Interrupted Work">
          <CodeBlock 
            code={`# If you interrupted the workflow
tm autopilot resume

✓ Workflow resumed
✓ Task 7 - subtask 3/5
✓ Current phase: GREEN
→ Continue from where you left off`}
            filename="Terminal"
          />
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">JSON Output Mode</h3>
        <p className="text-text-muted mb-4">
          All commands support <code className="bg-surface-highlight px-1.5 py-0.5 rounded">--json</code> flag for programmatic use:
        </p>
        <CodeBlock 
          code={`$ tm autopilot start 7 --json | jq .
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
        <p className="text-text-muted mt-4">Perfect for: CI/CD integration, custom tooling, automated workflows, progress monitoring.</p>

        <h3 className="text-xl font-semibold mb-4 mt-8">MCP Integration</h3>
        <p className="text-text-muted mb-4">
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

        <h3 className="text-xl font-semibold mb-4 mt-8">Cheat Sheet</h3>
        <CodeBlock 
          code={`# Start
tm autopilot start <taskId>         # Initialize workflow

# Workflow Control
tm autopilot next                    # What's next?
tm autopilot status                  # Current state
tm autopilot resume                  # Continue interrupted work
tm autopilot abort                   # Cancel and cleanup

# TDD Cycle
tm autopilot complete --results '{...}'   # Advance phase
tm autopilot commit                       # Save progress

# Options
--json                              # Machine-readable output
--project-root <path>               # Specify project location
--force                             # Override safety checks`}
          filename="Cheat Sheet"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Tips</h3>
        <ol className="list-decimal list-inside text-text-muted space-y-2">
          <li><strong>Always let tests fail first</strong> - That's the RED phase</li>
          <li><strong>Write minimal code</strong> - Just enough to pass</li>
          <li><strong>Commit frequently</strong> - After each subtask</li>
          <li><strong>Use --json</strong> - Better for programmatic use</li>
          <li><strong>Check status often</strong> - Know where you are</li>
          <li><strong>Trust the workflow</strong> - It enforces TDD rules</li>
        </ol>

        <TipBox type="info">
          <strong>Ready to start?</strong> Run <code className="bg-surface-highlight px-1 rounded">tm autopilot start {"<taskId>"}</code> and begin your TDD journey!
        </TipBox>
      </>
    )
  },
  'agent-integration': {
    title: 'AI Agent Integration Guide',
    breadcrumb: 'TDD Workflow (Autopilot)',
    content: (
      <>
        <p className="text-text-muted mb-6">
          Complete guide for integrating AI agents with TaskMaster's autonomous TDD workflow system.
        </p>

        <h3 className="text-xl font-semibold mb-4">Overview</h3>
        <p className="text-text-muted mb-4">
          TaskMaster provides a complete TDD workflow orchestration system that enables AI agents to autonomously implement features following strict Test-Driven Development practices. The system manages workflow state, git operations, test validation, and progress tracking.
        </p>

        <h4 className="text-lg font-medium mb-3">Key Features</h4>
        <ul className="text-text-muted space-y-1 mb-6">
          <li>• <strong>TDD State Machine:</strong> Enforces RED → GREEN → COMMIT cycle</li>
          <li>• <strong>Git Integration:</strong> Automated branch creation, commits with metadata</li>
          <li>• <strong>Test Validation:</strong> Ensures RED phase has failures, GREEN phase passes</li>
          <li>• <strong>Progress Tracking:</strong> Subtask completion, attempt counting, error logging</li>
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
└────────────────────────────────────────────────────┘`}
          filename="Architecture"
        />

        <h3 className="text-xl font-semibold mb-4 mt-8">Responsibility Matrix</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="card p-4">
            <h4 className="font-medium text-accent mb-3">AI Agent Responsibilities</h4>
            <ul className="text-sm text-text-muted space-y-1">
              <li>• Read and understand subtask requirements</li>
              <li>• Write test code that validates requirements</li>
              <li>• Run test suite using project's test command</li>
              <li>• Parse test output into JSON format</li>
              <li>• Report results to TaskMaster for validation</li>
              <li>• Write implementation to satisfy tests</li>
              <li>• Request commits when GREEN phase complete</li>
              <li>• Handle errors and retry within attempt limits</li>
            </ul>
          </div>
          <div className="card p-4">
            <h4 className="font-medium text-accent mb-3">TaskMaster Responsibilities</h4>
            <ul className="text-sm text-text-muted space-y-1">
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

        <h3 className="text-xl font-semibold mb-4">CLI Commands</h3>
        <p className="text-text-muted mb-4">All commands support <code className="bg-surface-highlight px-1.5 py-0.5 rounded">--json</code> flag for machine-readable output.</p>
        
        <Accordion title="tm autopilot start <taskId>" defaultOpen>
          <p className="text-text-muted mb-3">Initialize a new TDD workflow for a task.</p>
          <p className="text-sm text-text-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-text-muted space-y-1 mb-3">
            <li>• <code className="bg-surface-highlight px-1 rounded">--max-attempts {"<number>"}</code>: Maximum attempts per subtask (default: 3)</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">--force</code>: Force start even if workflow exists</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">--project-root {"<path>"}</code>: Project root directory</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">--json</code>: Output JSON</li>
          </ul>
          <CodeBlock code="tm autopilot start 7 --max-attempts 5 --json" filename="Example" />
        </Accordion>

        <Accordion title="tm autopilot next">
          <p className="text-text-muted mb-3">Get the next action to perform with detailed context.</p>
          <p className="text-sm text-text-muted mb-2">Returns information about:</p>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• Current action to perform (generate_test, implement_code, commit_changes)</li>
            <li>• Current phase and TDD phase</li>
            <li>• Progress information</li>
            <li>• Current subtask details</li>
            <li>• Expected files</li>
          </ul>
        </Accordion>

        <Accordion title="tm autopilot complete">
          <p className="text-text-muted mb-3">Complete the current TDD phase with test result validation.</p>
          <CodeBlock 
            code={`tm autopilot complete --results '{"total":10,"passed":9,"failed":1,"skipped":0}' --json`}
            filename="Example"
          />
          <p className="text-sm text-text-muted mt-3"><strong>Validation Rules:</strong></p>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• <strong>RED Phase:</strong> Must have at least one failing test</li>
            <li>• <strong>GREEN Phase:</strong> All tests must pass (failed === 0)</li>
          </ul>
        </Accordion>

        <Accordion title="tm autopilot commit">
          <p className="text-text-muted mb-3">Create a git commit with enhanced message generation.</p>
          <p className="text-sm text-text-muted mb-2"><strong>Options:</strong></p>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• <code className="bg-surface-highlight px-1 rounded">--message {"<text>"}</code>: Custom commit message (optional)</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">--files {"<paths...>"}</code>: Specific files to stage (optional)</li>
          </ul>
        </Accordion>

        <Accordion title="Other Commands">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">tm autopilot resume</code> - Resume a previously started workflow</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">tm autopilot status</code> - Get comprehensive workflow progress</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">tm autopilot abort</code> - Abort workflow and clean up state (preserves git branch and code)</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">MCP Tools</h3>
        <p className="text-text-muted mb-4">MCP tools provide the same functionality as CLI commands for programmatic integration.</p>

        <Accordion title="Available MCP Tools">
          <ul className="text-text-muted space-y-2">
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_start</code> - Initialize workflow for a task</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_resume</code> - Resume previously started workflow</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_next</code> - Get next action with context</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_status</code> - Get workflow status</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_complete_phase</code> - Complete current phase</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_commit</code> - Create commit</li>
            <li>• <code className="bg-surface-highlight px-1 rounded">autopilot_abort</code> - Abort workflow</li>
          </ul>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Error Handling</h3>

        <Accordion title="Common Errors and Solutions">
          <div className="space-y-4">
            <div>
              <p className="font-medium text-accent mb-1">Workflow Already Exists</p>
              <p className="text-sm text-text-muted mb-2">Use <code className="bg-surface-highlight px-1 rounded">autopilot_resume</code> to continue the existing workflow, or <code className="bg-surface-highlight px-1 rounded">--force</code> to start new.</p>
            </div>
            <div>
              <p className="font-medium text-accent mb-1">RED Phase Validation Failed</p>
              <p className="text-sm text-text-muted mb-2">"At least one test must be failing" - Ensure your test validates new behavior that doesn't exist yet.</p>
            </div>
            <div>
              <p className="font-medium text-accent mb-1">GREEN Phase Validation Failed</p>
              <p className="text-sm text-text-muted mb-2">"All tests must pass" - Debug failing test and fix implementation.</p>
            </div>
            <div>
              <p className="font-medium text-accent mb-1">No Staged Changes</p>
              <p className="text-sm text-text-muted mb-2">Ensure you've created/modified files before committing.</p>
            </div>
            <div>
              <p className="font-medium text-accent mb-1">Git Working Tree Not Clean</p>
              <p className="text-sm text-text-muted mb-2">Commit or stash changes before starting workflow.</p>
            </div>
          </div>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Troubleshooting</h3>

        <Accordion title="Common Issues">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Workflow State Issues</p>
              <p className="text-sm text-text-muted">If state file is corrupted, run <code className="bg-surface-highlight px-1 rounded">tm autopilot abort --force</code> then restart.</p>
            </div>
            <div>
              <p className="font-medium mb-2">Test Results Parsing</p>
              <p className="text-sm text-text-muted">Ensure results JSON has required fields: <code className="bg-surface-highlight px-1 rounded">total</code>, <code className="bg-surface-highlight px-1 rounded">passed</code>, <code className="bg-surface-highlight px-1 rounded">failed</code> (skipped is optional).</p>
            </div>
            <div>
              <p className="font-medium mb-2">Branch Conflicts</p>
              <p className="text-sm text-text-muted">Delete old workflow branch with <code className="bg-surface-highlight px-1 rounded">git branch -D task-N</code> then restart.</p>
            </div>
          </div>
        </Accordion>

        <h3 className="text-xl font-semibold mb-4 mt-8">Working with AI Agents</h3>
        <p className="text-text-muted mb-4">Example prompts for AI agents (Claude Code, Cursor, etc.):</p>
        
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">Starting a Task</p>
            <p className="text-sm text-text-muted italic">"I want to implement Task 7 using TDD workflow. Please start the autopilot workflow, show me the first subtask, and begin the RED-GREEN-COMMIT cycle."</p>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">RED Phase - Writing Failing Tests</p>
            <p className="text-sm text-text-muted italic">"We're in RED phase. Please read the subtask requirements, write a test that validates the behavior, and the test MUST fail because the feature doesn't exist yet."</p>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">GREEN Phase - Implementing</p>
            <p className="text-sm text-text-muted italic">"We're in GREEN phase. Please implement the minimal code to make this test pass. Don't over-engineer or add untested features."</p>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">Handling Errors</p>
            <p className="text-sm text-text-muted italic">"The RED phase validation failed - no test failures detected. Please review the test, identify why it's not actually testing new behavior, and rewrite it."</p>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">Checking Progress</p>
            <p className="text-sm text-text-muted italic">"What's the current state of the workflow? Show which subtask we're on, current TDD phase, progress percentage, and next action required."</p>
          </div>
          <div className="card p-4">
            <p className="text-sm font-medium text-accent mb-2">Resuming Work</p>
            <p className="text-sm text-text-muted italic">"I have an in-progress workflow. Please resume the autopilot workflow, show current status, and continue from where we left off."</p>
          </div>
        </div>

        <TipBox type="info">
          The autopilot system automatically handles Git branch creation, state persistence, and workflow transitions. Your AI agent just needs to focus on writing tests and implementation code.
        </TipBox>
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
            ? 'bg-accent/10 text-accent' 
            : 'text-text-muted hover:text-text hover:bg-surface'
        }`}
      >
        {item.icon && <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5" />}
        <span className="flex-1 text-left">{item.label}</span>
        {hasChildren && (
          <FontAwesomeIcon 
            icon={isExpanded ? faChevronDown : faChevronRight} 
            className="w-3 h-3 text-text-subtle" 
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
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text'
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
        icon: item.icon
      })
      
      if (item.children) {
        item.children.forEach(child => {
          const childDoc = docContent[child.id]
          results.push({
            id: child.id,
            label: child.label,
            description: childDoc?.title || child.label,
            breadcrumb: ['Documentation', section.title, item.label, child.label],
            icon: item.icon
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
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const questionInputRef = useRef<HTMLInputElement>(null)
  const sidebarInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const searchModalInputRef = useRef<HTMLInputElement>(null)
  
  // Detect if user is on Mac
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  // Search results based on query
  const searchResults = searchQuery.trim() 
    ? searchIndex.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.breadcrumb.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
      )
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
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showSearchModal])

  // Reset chat function
  const resetChat = () => {
    setQuestion('')
    setChatHistory([])
  }

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
          <pre key={partIndex} className="bg-surface-highlight rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
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
                <table className="min-w-full text-xs border border-border rounded-lg overflow-hidden">
                  <thead className="bg-surface-highlight">
                    <tr>
                      {headers.map((header, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-semibold text-text border-b border-border">
                          {renderInlineFormatting(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-surface'}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 text-text-muted border-b border-border">
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
          elements.push(<h5 key={`${partIndex}-${i}`} className="font-semibold text-text text-sm mt-3 mb-1">{line.slice(5)}</h5>)
        } else if (line.startsWith('### ')) {
          elements.push(<h4 key={`${partIndex}-${i}`} className="font-semibold text-text mt-3 mb-1">{line.slice(4)}</h4>)
        } else if (line.startsWith('## ')) {
          elements.push(<h3 key={`${partIndex}-${i}`} className="font-semibold text-text mt-3 mb-1">{line.slice(3)}</h3>)
        } else if (line.startsWith('# ')) {
          elements.push(<h2 key={`${partIndex}-${i}`} className="font-bold text-text mt-3 mb-1">{line.slice(2)}</h2>)
        }
        // Numbered lists
        else if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)/)
          if (match) {
            elements.push(
              <div key={`${partIndex}-${i}`} className="flex gap-2 my-0.5">
                <span className="text-accent font-medium min-w-[1.5rem]">{match[1]}.</span>
                <span>{renderInlineFormatting(match[2])}</span>
              </div>
            )
          }
        }
        // Bullet points
        else if (line.startsWith('- ') || line.startsWith('* ')) {
          elements.push(
            <div key={`${partIndex}-${i}`} className="flex gap-2 my-0.5">
              <span className="text-accent">•</span>
              <span>{renderInlineFormatting(line.slice(2))}</span>
            </div>
          )
        }
        // Blockquote
        else if (line.startsWith('> ')) {
          elements.push(
            <blockquote key={`${partIndex}-${i}`} className="border-l-2 border-accent pl-3 my-2 text-text-muted italic">
              {renderInlineFormatting(line.slice(2))}
            </blockquote>
          )
        }
        // Horizontal rule
        else if (line.trim() === '---' || line.trim() === '***') {
          elements.push(<hr key={`${partIndex}-${i}`} className="border-border my-3" />)
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
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-text">$1</strong>')
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-surface-highlight px-1 py-0.5 rounded text-xs font-mono text-accent">$1</code>')
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">$1</a>')
    
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

    try {
      const response = await askQuestionAPI(userMessage.content)
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response
      }
      setChatHistory(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error asking question:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        error: error instanceof Error ? error.message : 'Failed to get response'
      }
      setChatHistory(prev => [...prev, errorMessage])
    } finally {
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
    <div className="flex flex-col min-h-screen">
      {/* Mobile menu button */}
      <button 
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="lg:hidden fixed top-20 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-text-muted hover:text-text shadow-lg"
      >
        <FontAwesomeIcon icon={faBars} className="w-5 h-5" />
      </button>

      {/* Search Bar - Centered below navbar (opens modal on click) */}
      {!showMobileMenu && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm pl-16 pr-4 lg:px-4" style={{ position: 'fixed' }}>
          <div className="relative">
            {/* Blur backdrop */}
            <div className="absolute -inset-2 bg-background/80 backdrop-blur-md rounded-full -z-10" />
            <button
              onClick={() => setShowSearchModal(true)}
              className="w-full flex items-center gap-3 pl-4 pr-4 py-2.5 bg-surface backdrop-blur-sm border border-border rounded-full text-sm text-text-subtle hover:border-accent transition-colors shadow-lg"
            >
              <FontAwesomeIcon icon={faSearch} className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search docs...</span>
              <span className="text-xs bg-surface-highlight px-1.5 py-0.5 rounded">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Search Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
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
              className="fixed inset-0 z-[71] flex items-start justify-center pt-[15vh] px-4"
              onClick={() => {
                setShowSearchModal(false)
                setSearchQuery('')
              }}
            >
              <div 
                className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <FontAwesomeIcon icon={faSearch} className="w-4 h-4 text-text-subtle" />
                  <input
                    ref={searchModalInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-text placeholder:text-text-subtle outline-none text-base"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-text-subtle hover:text-text transition-colors"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {/* Recent Searches - shown when no query */}
                  {!searchQuery.trim() && recentSearches.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs text-text-subtle uppercase tracking-wider px-2 py-2">Recent searches</p>
                      {recentSearches.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-highlight transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FontAwesomeIcon icon={result.icon || faFileLines} className="w-4 h-4 text-text-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-subtle mb-0.5">
                              {result.breadcrumb.join(' › ')}
                            </p>
                            <p className="text-sm font-medium text-text truncate">{result.label}</p>
                            {result.description && result.description !== result.label && (
                              <p className="text-xs text-text-muted truncate mt-0.5">{result.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No recent searches message */}
                  {!searchQuery.trim() && recentSearches.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-text-muted">Start typing to search the documentation</p>
                    </div>
                  )}

                  {/* Search Results */}
                  {searchQuery.trim() && searchResults.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs text-text-subtle uppercase tracking-wider px-2 py-2">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-highlight transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FontAwesomeIcon icon={result.icon || faFileLines} className="w-4 h-4 text-text-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-subtle mb-0.5">
                              {result.breadcrumb.join(' › ')}
                            </p>
                            <p className="text-sm font-medium text-text truncate">{result.label}</p>
                            {result.description && result.description !== result.label && (
                              <p className="text-xs text-text-muted truncate mt-0.5">{result.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {searchQuery.trim() && searchResults.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-text-muted">No results found for "{searchQuery}"</p>
                      <p className="text-xs text-text-subtle mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-highlight/50">
                  <div className="flex items-center gap-3 text-xs text-text-subtle">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border text-[10px]">↵</kbd>
                      to select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-surface rounded border border-border text-[10px]">esc</kbd>
                      to close
                    </span>
                  </div>
                  <span className="text-xs text-text-subtle">TaskMaster Docs</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex pt-6">
        {/* Left Sidebar */}
        <aside className={`w-64 border-r border-border bg-background fixed top-0 lg:top-16 bottom-0 overflow-y-auto z-50 transition-transform lg:translate-x-0 left-0 lg:left-[max(0px,calc((100vw-1024px)/2))] ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 pb-24 lg:pb-4">
            {/* Tab for Documentation */}
            <div className="border-b border-border mb-4 -mx-4 px-4 pb-3">
              <span className="text-sm font-medium text-text border-b-2 border-accent pb-3">
                TaskMaster AI Documentation
              </span>
            </div>
            
            {/* External Links */}
            <div className="flex gap-4 mb-6 px-1">
              <a 
                href="https://discord.gg/taskmaster" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm"
              >
                <FontAwesomeIcon icon={faDiscord} className="w-4 h-4" />
                <span>Discord</span>
              </a>
              <a 
                href="mailto:taskmasteroneai@gmail.com"
                className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm"
              >
                <FontAwesomeIcon icon={faComments} className="w-4 h-4" />
                <span>Support</span>
              </a>
            </div>

            {/* Navigation */}
            <nav className="space-y-6">
              {navigation.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-text-subtle uppercase tracking-wider px-3 mb-2">
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
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-[calc(max(0px,(100vw-1024px)/2)+256px)] lg:mr-[max(0px,calc((100vw-1024px)/2))] overflow-x-hidden">
          <div className="px-8 pt-20 pb-24 max-w-full overflow-x-hidden">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              {/* Breadcrumb */}
              <p className="text-sm text-accent mb-2">{currentContent.breadcrumb || 'Documentation'}</p>
              
              <h1 className="text-3xl font-bold mb-8">{currentContent.title}</h1>
              
              <NavigationContext.Provider value={{ navigateToSection }}>
                <div className="prose prose-invert max-w-full overflow-x-hidden [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_code]:break-words [&_.card]:overflow-hidden [&_.card]:max-w-full [&_img]:max-w-full [&>*]:max-w-full">
                  {currentContent.content}
                </div>
              </NavigationContext.Provider>

              {/* Feedback */}
              <div className="flex items-center gap-4 mt-10 pt-6 border-t border-border">
                <span className="text-text-muted text-sm">Was this page helpful?</span>
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:border-border-light hover:text-text transition-colors">
                  👍 Yes
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:border-border-light hover:text-text transition-colors">
                  👎 No
                </button>
              </div>

              {/* Prev/Next Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                {prevItem ? (
                  <button
                    onClick={() => {
                      setActiveSection(prevItem)
                      scrollToTop()
                    }}
                    className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
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
                    className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
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
        {!showAnswerModal && !showMobileMenu && (
          <div className="fixed left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[55]" style={{ position: 'fixed', bottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
            <form 
              onSubmit={handleAskQuestion}
              className={`flex items-center gap-2 px-4 py-2.5 bg-surface border rounded-full text-sm shadow-xl backdrop-blur-sm transition-all duration-200 w-full sm:w-[300px] ${isInputFocused ? 'border-accent sm:w-[400px]' : 'border-border'}`}
            >
              <input
                ref={questionInputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent text-text placeholder:text-text-muted outline-none min-w-0"
                disabled={isAsking}
                data-gramm="true"
                data-gramm_editor="true"
                data-enable-grammarly="true"
                autoComplete="off"
                autoCorrect="on"
                spellCheck="true"
              />
              <span className="text-xs bg-surface-highlight px-1.5 py-0.5 rounded text-text-muted flex-shrink-0">{isMac ? '⌘I' : 'Ctrl+I'}</span>
              <button 
                type="submit"
                disabled={!question.trim() || isAsking}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isAsking ? (
                  <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faArrowUp} className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
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
                className="fixed inset-0 bg-black/50 sm:bg-transparent sm:top-[72px] z-[60]"
                onClick={() => setShowAnswerModal(false)}
              />
              
              {/* Sidebar - Bottom sheet on mobile, right sidebar on desktop */}
              <motion.div
                initial={{ y: '100%', x: 0 }}
                animate={{ y: 0, x: 0 }}
                exit={{ y: '100%', x: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 right-0 bottom-0 sm:left-auto sm:right-0 sm:top-[72px] z-[61] bg-background sm:bg-background/95 sm:backdrop-blur-xl border-t sm:border-t-0 sm:border-l border-border shadow-[0_-8px_30px_rgba(0,0,0,0.3)] sm:shadow-[-8px_0_30px_rgba(0,0,0,0.3)] flex flex-col max-h-[85vh] sm:max-h-none rounded-t-2xl sm:rounded-none"
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 640 ? sidebarWidth : '100%', maxWidth: '100vw' }}
              >
                {/* Drag Handle - Mobile only */}
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                  <div className="w-10 h-1 bg-border rounded-full" />
                </div>

                {/* Resize Handle - Desktop only */}
                <div
                  onMouseDown={startResizing}
                  className="hidden sm:flex absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-accent/50 transition-colors group items-center justify-center"
                >
                  <div className="absolute left-0 w-4 h-full" />
                  <FontAwesomeIcon 
                    icon={faGripLinesVertical} 
                    className="w-2 h-4 text-border group-hover:text-accent transition-colors opacity-0 group-hover:opacity-100" 
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FontAwesomeIcon icon={faComments} className="text-accent w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-sm">Assistant</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={resetChat}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Clear chat"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowAnswerModal(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-highlight transition-colors"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chat Messages */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Welcome message when no conversation */}
                  {chatHistory.length === 0 && !isAsking && (
                    <div className="text-sm text-text-muted">
                      Hi there! How can I help you with TaskMaster AI today?
                    </div>
                  )}

                  {/* Chat History */}
                  {chatHistory.map((message) => (
                    <div key={message.id}>
                      {message.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-accent text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="max-w-full text-sm text-text-muted">
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
                      <div className="text-sm text-text-muted flex items-center gap-2">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin w-3.5 h-3.5" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area - Same style as floating */}
                <div className="p-3 ">
                  <form onSubmit={handleAskQuestion} className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-full">
                    <input
                      ref={sidebarInputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question..."
                      className="flex-1 bg-transparent text-text text-sm placeholder:text-text-muted outline-none min-w-0"
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
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
