import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCodeBranch, 
  faMicrochip, 
  faCircleCheck,
  faCode,
  faTerminal,
  faBrain,
  faDiagramProject,
  faBook
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../contexts/AuthContext'

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/TaskMaster_AI%20Logo%20(1).png?alt=media&token=c309f276-a8a7-438f-a3a0-75576d1fa4d8'

const features = [
  {
    icon: faBrain,
    title: 'PRD-First Development',
    description: 'Transform Product Requirement Documents into structured, executable task lists.',
  },
  {
    icon: faCodeBranch,
    title: 'Automatic Dependencies',
    description: 'Smart dependency detection ensures tasks are completed in the optimal order.',
  },
  {
    icon: faMicrochip,
    title: 'Multi-Model Support',
    description: 'Use Claude, GPT-4, Gemini, Perplexity, Ollama, and more. Switch models as needed.',
  },
  {
    icon: faDiagramProject,
    title: 'Task Expansion',
    description: 'Break down complex tasks into manageable subtasks with AI-powered decomposition.',
  },
  {
    icon: faTerminal,
    title: 'CLI & MCP Integration',
    description: 'Works seamlessly with your terminal and Model Context Protocol.',
  },
  {
    icon: faCode,
    title: 'Code-Aware Context',
    description: 'Understands your codebase structure to generate contextually relevant tasks.',
  },
]

// Provider SVG components - all using provider-logo class for consistent styling
const GeminiLogo = () => (
  <div className="provider-logo flex-shrink-0">
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/geminnoi.png?alt=media&token=8ddab5a2-41cb-4cde-9741-856d456812b9" 
      alt="Gemini" 
    />
  </div>
)

const ClaudeLogo = () => (
  <svg fill="none" viewBox="0 0 184 40" xmlns="http://www.w3.org/2000/svg" className="provider-logo flex-shrink-0">
    <path d="m7.75 26.27 7.77-4.36.13-.38-.13-.21h-.38l-1.3-.08-4.44-.12-3.85-.16-3.73-.2-.94-.2-.88-1.16.09-.58.79-.53 1.13.1 2.5.17 3.75.26 2.72.16 4.03.42h.64l.09-.26-.22-.16-.17-.16-3.88-2.63-4.2-2.78-2.2-1.6-1.19-.81-.6-.76-.26-1.66 1.08-1.19 1.45.1.37.1 1.47 1.13 3.14 2.43 4.1 3.02.6.5.24-.17.03-.12-.27-.45-2.23-4.03-2.38-4.1-1.06-1.7-.28-1.02c-.1-.42-.17-.77-.17-1.2l1.23-1.67.68-.22 1.64.22.69.6 1.02 2.33 1.65 3.67 2.56 4.99.75 1.48.4 1.37.15.42h.26v-.24l.21-2.81.39-3.45.38-4.44.13-1.25.62-1.5 1.23-.81.96.46.79 1.13-.11.73-.47 3.05-.92 4.78-.6 3.2h.35l.4-.4 1.62-2.15 2.72-3.4 1.2-1.35 1.4-1.49.9-.71h1.7l1.25 1.86-.56 1.92-1.75 2.22-1.45 1.88-2.08 2.8-1.3 2.24.12.18.31-.03 4.7-1 2.54-.46 3.03-.52 1.37.64.15.65-.54 1.33-3.24.8-3.8.76-5.66 1.34-.07.05.08.1 2.55.24 1.09.06h2.67l4.97.37 1.3.86.78 1.05-.13.8-2 1.02-2.7-.64-6.3-1.5-2.16-.54h-.3v.18l1.8 1.76 3.3 2.98 4.13 3.84.21.95-.53.75-.56-.08-3.63-2.73-1.4-1.23-3.17-2.67h-.21v.28l.73 1.07 3.86 5.8.2 1.78-.28.58-1 .35-1.1-.2-2.26-3.17-2.33-3.57-1.88-3.2-.23.13-1.11 11.95-.52.61-1.2.46-1-.76-.53-1.23.53-2.43.64-3.17.52-2.52.47-3.13.28-1.04-.02-.07-.23.03-2.36 3.24-3.59 4.85-2.84 3.04-.68.27-1.18-.61.11-1.09.66-.97 3.93-5 2.37-3.1 1.53-1.79-.01-.26h-.09l-10.44 6.78-1.86.24-.8-.75.1-1.23.38-.4 3.14-2.16z" fill="currentColor"/>
    <path d="m64.48 33.54c-5.02 0-8.45-2.8-10.07-7.11a19.191 19.191 0 0 1 -1.23-7.03c0-7.23 3.24-12.25 10.4-12.25 4.81 0 7.78 2.1 9.47 7.11h2.06l-.28-6.91c-2.88-1.86-6.48-2.8-10.86-2.8-6.17 0-11.42 2.76-14.34 7.74a16.77 16.77 0 0 0 -2.22 8.65c0 5.53 2.61 10.43 7.51 13.15a17.51 17.51 0 0 0 8.73 2.06c4.78 0 8.57-.91 11.93-2.5l.87-7.62h-2.1c-1.26 3.48-2.76 5.57-5.25 6.68-1.22.55-2.76.83-4.62.83zm21.65-26.39.2-3.4h-1.42l-6.32 1.9v1.03l2.8 1.3v23.78c0 1.62-.83 1.98-3 2.25v1.74h10.75v-1.74c-2.18-.27-3-.63-3-2.25v-24.6zm42.75 29h.83l7.27-1.38v-1.78l-1.02-.08c-1.7-.16-2.14-.51-2.14-1.9v-12.68l.2-4.07h-1.15l-6.87.99v1.74l.67.12c1.86.27 2.41.79 2.41 2.09v11.3c-1.78 1.38-3.48 2.25-5.5 2.25-2.24 0-3.63-1.14-3.63-3.8v-10.61l.2-4.07h-1.18l-6.88.99v1.74l.71.12c1.86.27 2.41.79 2.41 2.09v10.43c0 4.42 2.5 6.52 6.48 6.52 3.04 0 5.53-1.62 7.4-3.87l-.2 3.87zm-19.98-14.07c0-5.65-3-7.82-8.42-7.82-4.78 0-8.25 1.98-8.25 5.26 0 .98.35 1.73 1.06 2.25l3.64-.48c-.16-1.1-.24-1.77-.24-2.05 0-1.86.99-2.8 3-2.8 2.97 0 4.47 2.09 4.47 5.45v1.1l-7.5 2.25c-2.5.68-3.92 1.27-4.87 2.65a5 5 0 0 0 -.7 2.8c0 3.2 2.2 5.46 5.96 5.46 2.72 0 5.13-1.23 7.23-3.56.75 2.33 1.9 3.56 3.95 3.56 1.66 0 3.16-.67 4.5-1.98l-.4-1.38c-.58.16-1.14.24-1.73.24-1.15 0-1.7-.91-1.7-2.69zm-9.6 10.87c-2.05 0-3.32-1.19-3.32-3.28 0-1.42.67-2.25 2.1-2.73l6.08-1.93v5.84c-1.94 1.47-3.08 2.1-4.86 2.1zm63.3 1.82v-1.78l-1.03-.08c-1.7-.16-2.13-.51-2.13-1.9v-23.86l.2-3.4h-1.43l-6.32 1.9v1.03l2.8 1.3v7.82a8.828 8.828 0 0 0 -5.37-1.54c-6.28 0-11.18 4.78-11.18 11.93 0 5.89 3.52 9.96 9.32 9.96 3 0 5.61-1.46 7.23-3.72l-.2 3.72h.84zm-13.16-18.14c3 0 5.25 1.74 5.25 4.94v9a7.196 7.196 0 0 1 -5.21 2.1c-4.3 0-6.48-3.4-6.48-7.94 0-5.1 2.49-8.1 6.44-8.1zm28.53 4.5c-.56-2.64-2.18-4.14-4.43-4.14-3.36 0-5.69 2.53-5.69 6.16 0 5.37 2.84 8.85 7.43 8.85a8.6 8.6 0 0 0 7.39-4.35l1.34.36c-.6 4.66-4.82 8.14-10 8.14-6.08 0-10.27-4.5-10.27-10.9 0-6.45 4.55-10.99 10.63-10.99 4.54 0 7.74 2.73 8.77 7.47l-15.84 4.86v-2.14l10.67-3.31z" fill="currentColor"/>
  </svg>
)

const ChatGPTLogo = () => (
  <div className="provider-logo provider-logo-lg flex-shrink-0">
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/pngimg.com%20-%20chatgpt_PNG2.png?alt=media&token=727845a2-03cc-48ac-9781-8aa781b85faf" 
      alt="ChatGPT" 
    />
  </div>
)

const MistralLogo = () => (
  <div className="provider-logo flex-shrink-0">
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/image-removebg-preview%20(4).png?alt=media&token=271919f1-3b7d-4b6e-9ba1-748fe0cba7ae" 
      alt="Mistral" 
    />
  </div>
)

const PerplexityLogo = () => (
  <svg viewBox="0 0 150 36" xmlns="http://www.w3.org/2000/svg" className="provider-logo flex-shrink-0">
    <path fill="none" stroke="currentColor" strokeMiterlimit="10" d="m23.566,1.398l-9.495,9.504h9.495V1.398v2.602V1.398Zm-9.496,9.504L4.574,1.398v9.504h9.496Zm-.021-10.902v36m9.517-15.596l-9.495-9.504v13.625l9.495,9.504v-13.625Zm-18.991,0l9.496-9.504v13.625l-9.496,9.504v-13.625ZM.5,10.9v13.57h4.074v-4.066l9.496-9.504H.5Zm13.57,0l9.495,9.504v4.066h4.075v-13.57h-13.57Z"/>
    <path fill="currentColor" d="m55.46,13.028c.593-1.109,1.422-1.963,2.491-2.564,1.067-.599,2.319-.899,3.755-.899s2.625.295,3.62.886c.996.591,1.741,1.374,2.234,2.349.493.976.74,2.045.74,3.207v1.61h-11.171c.09,1.396.561,2.506,1.413,3.329.852.824,1.996,1.235,3.433,1.235,1.166,0,2.06-.237,2.678-.711.62-.474,1.072-1.131,1.36-1.973h2.558c-.341,1.306-1.036,2.439-2.086,3.396-1.049.958-2.553,1.436-4.509,1.436-1.472,0-2.769-.3-3.891-.899-1.121-.599-1.988-1.454-2.598-2.564-.61-1.11-.915-2.416-.915-3.92s.296-2.809.889-3.919h-.001Zm10.149,2.576c0-1.217-.314-2.169-.942-2.859-.628-.689-1.615-1.033-2.962-1.033-1.256,0-2.284.335-3.082,1.006-.799.671-1.288,1.634-1.467,2.886h8.453Zm6.047-5.637v2.228c0,.126.063.188.189.188.072,0,.125-.018.162-.054.037-.036.072-.107.107-.214.466-1.467,1.624-2.201,3.473-2.201h1.184v2.415h-1.535c-1.203,0-2.1.286-2.693.859-.593.573-.889,1.512-.889,2.819v7.919h-2.423v-13.96h2.425Zm19.342,11.019c-.637,1.118-1.463,1.955-2.477,2.509-1.014.554-2.105.832-3.271.832-2.297,0-3.913-.912-4.846-2.738-.072-.142-.162-.214-.269-.214s-.162.054-.162.161v7.489h-2.423V9.968h2.423v2.389c0,.107.054.161.162.161s.197-.072.269-.214c.933-1.826,2.549-2.738,4.846-2.738,1.166,0,2.257.278,3.271.832,1.014.554,1.839,1.391,2.477,2.51.637,1.118.956,2.466.956,4.039s-.319,2.921-.956,4.04Zm-2.8-7.892c-.889-.922-2.06-1.383-3.513-1.383s-2.625.461-3.513,1.383c-.889.922-1.215,2.206-1.215,3.852s.326,2.931,1.215,3.852c.889.922,2.06,1.383,3.513,1.383s2.625-.46,3.513-1.383c.889-.922,1.333-2.206,1.333-3.852s-.444-2.93-1.333-3.852Zm7.272-8.496v19.327h-2.423V4.6h2.423Zm1.995,8.429c.592-1.109,1.422-1.963,2.491-2.564,1.067-.599,2.319-.899,3.754-.899s2.626.295,3.621.886c.996.591,1.741,1.374,2.234,2.349.494.976.74,2.045.74,3.207v1.61h-11.171c.09,1.396.561,2.506,1.413,3.329.852.824,1.996,1.235,3.433,1.235,1.166,0,2.059-.237,2.678-.711.62-.474,1.072-1.131,1.36-1.973h2.558c-.341,1.306-1.037,2.439-2.086,3.396-1.049.958-2.553,1.436-4.509,1.436-1.472,0-2.769-.3-3.891-.899-1.121-.599-1.988-1.454-2.598-2.564-.61-1.11-.915-2.416-.915-3.92s.296-2.809.889-3.919h-.001Zm10.149,2.576c0-1.217-.314-2.169-.942-2.859-.628-.689-1.615-1.033-2.962-1.033-1.255,0-2.284.335-3.082,1.006-.799.671-1.287,1.634-1.467,2.886h8.453Zm1.613,7.785l5.545-6.846-4.549-6.039v-.537h2.665l3.797,5.207,4.092-5.207h2.718v.564l-5.222,6.416,4.819,6.442v.537h-2.611l-4.119-5.61-4.414,5.61h-2.719v-.537h-.002Zm17.786-17.965v3.021h-2.83v-3.021h2.83Zm-.147,18.503h-2.424v-13.959h2.424v13.959Zm.764-13.959h2.636v-3.758h2.424v3.758h2.774l.681,2.046h-3.455v6.678c0,.912-.023,1.588-.068,2.027-.045.439-.067.703-.067.792,0,.126.035.224.107.295.072.072.17.107.297.107.089,0,.354-.022.794-.067.439-.045,1.117-.067,2.033-.067h.942v2.147h-1.884c-1.544,0-2.693-.375-3.446-1.128-.753-.752-1.131-1.896-1.131-3.436v-7.349h-2.635v-2.046h-.002Zm8.564,0h2.47l4.011,11.711c.055.144.14.333.415.333s.36-.19.414-.333l4.011-11.711h2.304v.537l-5.018,15.059c-.431,1.289-1.036,2.188-1.816,2.698-.781.51-1.688.765-3.197.765h-2.584v-2.147h1.966c.628,0,1.139.022,1.534.067.394.045.646.067.754.067.305,0,.511-.134.62-.402l.754-2.04c.09-.214.098-.375.027-.484-.036-.072-.08-.117-.134-.134-.054-.018-.135-.027-.242-.027h-1.642l-4.645-13.958h-.002Zm-83.162,11.042c-.637,1.118-1.463,1.955-2.477,2.509-1.014.554-2.105.832-3.271.832-2.297,0-3.913-.912-4.846-2.738-.072-.142-.162-.214-.269-.214s-.162.054-.162.161v7.489h-2.423V9.991h2.423v2.389c0,.107.054.161.162.161s.197-.072.269-.214c.932-1.826,2.549-2.738,4.846-2.738,1.166,0,2.257.278,3.271.832,1.014.554,1.839,1.391,2.477,2.509.637,1.118.956,2.466.956,4.04s-.319,2.921-.956,4.039Zm-2.8-7.892c-.889-.922-2.06-1.383-3.513-1.383s-2.625.461-3.513,1.383c-.889.922-1.215,2.206-1.215,3.852s.326,2.931,1.215,3.852c.889.922,2.06,1.383,3.513,1.383s2.625-.46,3.513-1.383c.889-.922,1.333-2.206,1.333-3.852s-.444-2.93-1.333-3.852Z"/>
  </svg>
)

const AzureLogo = () => (
  <div className="provider-logo flex-shrink-0">
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/azure.png?alt=media&token=a5a2e96b-0262-42a8-8c71-e22cd76e978d" 
      alt="Azure" 
    />
  </div>
)

const OpenRouterLogo = () => (
  <div className="flex items-center gap-2.5 provider-logo provider-logo-xl flex-shrink-0">
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="logo-icon-xl">
      <path d="M16.804 1.957l7.22 4.105v.087L16.73 10.21l.017-2.117-.821-.03c-1.059-.028-1.611.002-2.268.11-1.064.175-2.038.577-3.147 1.352L8.345 11.03c-.284.195-.495.336-.68.455l-.515.322-.397.234.385.23.53.338c.476.314 1.17.796 2.701 1.866 1.11.775 2.083 1.177 3.147 1.352l.3.045c.694.091 1.375.094 2.825.033l.022-2.159 7.22 4.105v.087L16.589 22l.014-1.862-.635.022c-1.386.042-2.137.002-3.138-.162-1.694-.28-3.26-.926-4.881-2.059l-2.158-1.5a21.997 21.997 0 00-.755-.498l-.467-.28a55.927 55.927 0 00-.76-.43C2.908 14.73.563 14.116 0 14.116V9.888l.14.004c.564-.007 2.91-.622 3.809-1.124l1.016-.58.438-.274c.428-.28 1.072-.726 2.686-1.853 1.621-1.133 3.186-1.78 4.881-2.059 1.152-.19 1.974-.213 3.814-.138l.02-1.907z"/>
    </svg>
    <span className="text-xl font-medium">OpenRouter</span>
  </div>
)

const OllamaLogo = () => (
  <div className="provider-logo flex-shrink-0" style={{ height: '40px' }}>
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/ollama-logo.png?alt=media&token=d082c9e2-28c6-4cf5-a523-08451c9d3fb0" 
      alt="Ollama" 
      style={{ height: '40px' }}
    />
  </div>
)

const steps = [
  {
    step: '01',
    title: 'Write Your PRD',
    description: 'Create a Product Requirements Document describing your project goals.',
  },
  {
    step: '02',
    title: 'Parse & Generate',
    description: 'TaskMaster AI analyzes your PRD and generates a structured task breakdown.',
  },
  {
    step: '03',
    title: 'Expand & Refine',
    description: 'Use AI to expand complex tasks into subtasks with clear implementation steps.',
  },
  {
    step: '04',
    title: 'Execute & Track',
    description: 'Work through tasks systematically with dependency-aware ordering.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, duration: 0.4 },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
}

export default function Landing() {
  const { user } = useAuth()
  const isLoggedIn = !!user

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center px-4 py-20">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface mb-8">
              <span className="text-sm text-text-muted">AI-Powered Task Management</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5 shimmer-heading">
              Transform PRDs into
              <br />
              Executable Tasks
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10">
              TaskMaster AI intelligently breaks down your product requirements into structured, 
              dependency-aware tasks that guide AI coding agents through complex implementations.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isLoggedIn ? (
                <Link to="/app" className="btn-primary text-base px-6 py-3">
                  Go to Dashboard
                </Link>
              ) : (
                <Link to="/signup?plan=pro" className="btn-primary text-base px-6 py-3">
                  Get Started
                </Link>
              )}
              <Link to="/docs" className="btn-secondary text-base px-6 py-3">
                <FontAwesomeIcon icon={faBook} className="w-4 h-4 mr-2" />
                View Documentation
              </Link>
            </div>
          </motion.div>

          {/* Terminal Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="mt-14"
          >
            <div className="card-elevated overflow-hidden max-w-2xl mx-auto text-left">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-surface">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className="text-xs text-text-subtle ml-2 font-mono">taskmaster</span>
              </div>
              {/* Terminal content */}
              <div className="p-5 font-mono text-sm space-y-2 bg-background">
                <div className="text-text-subtle">$ taskmaster parse-prd ./docs/prd.md</div>
                <div className="text-status-success">✓ Parsed PRD successfully</div>
                <div className="text-text-muted">  Generated 12 tasks with dependencies</div>
                <div className="mt-4 text-text-subtle">$ taskmaster next</div>
                <div className="text-text">
                  <span className="text-text-muted">Task 1.1:</span> Set up project structure
                </div>
                <div className="text-text-subtle ml-4">Status: pending | Priority: high</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Providers Section - Infinite Carousel */}
      <section className="py-12 bg-surface/30">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-center text-text-subtle text-sm mb-8">
            Works with your favorite AI providers
          </p>
          <div className="carousel-wrapper">
            {/* Carousel container */}
            <div className="infinite-carousel">
              {/* First set of logos */}
              <div className="carousel-set">
                <ClaudeLogo />
                <ChatGPTLogo />
                <GeminiLogo />
                <MistralLogo />
                <PerplexityLogo />
                <AzureLogo />
                <OpenRouterLogo />
                <OllamaLogo />
              </div>
              {/* Duplicate set for seamless loop */}
              <div className="carousel-set">
                <ClaudeLogo />
                <ChatGPTLogo />
                <GeminiLogo />
                <MistralLogo />
                <PerplexityLogo />
                <AzureLogo />
                <OpenRouterLogo />
                <OllamaLogo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 shimmer-heading">
              Everything you need for AI-assisted development
            </h2>
            <p className="text-text-muted text-base max-w-xl mx-auto text-center">
              TaskMaster AI provides the structure and context that AI coding agents need to tackle complex projects.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="card hover:border-border-light p-5"
              >
                <FontAwesomeIcon icon={feature.icon} className="w-5 h-5 text-text-muted mb-4" />
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 shimmer-heading">How It Works</h2>
            <p className="text-text-muted text-base">
              From requirements to implementation in four steps
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {steps.map((step) => (
              <motion.div
                key={step.step}
                variants={itemVariants}
                className="relative"
              >
                <div className="text-5xl font-bold text-border mb-4">{step.step}</div>
                <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-text-muted">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="card-elevated p-8"
          >
            <div className="text-center">
              <img 
                src={LOGO_URL} 
                alt="TaskMaster AI" 
                className="w-16 h-16 rounded-xl object-contain mx-auto mb-5 invert dark:invert-0"
              />
              <h2 className="text-2xl md:text-3xl font-bold mb-4 shimmer-heading">
                Ready to supercharge your development?
              </h2>
              <p className="text-text-muted text-base mb-8 max-w-md mx-auto text-center">
                Join developers using TaskMaster AI to break down complex projects and ship faster.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isLoggedIn ? (
                  <Link to="/app" className="btn-primary text-base px-6 py-3">
                    Go to Dashboard
                  </Link>
                ) : (
                  <Link to="/signup?plan=pro" className="btn-primary text-base px-6 py-3">
                    Get Started
                  </Link>
                )}
                <Link to="/pricing" className="btn-ghost text-base">
                  View Pricing
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-text-muted">
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-status-success" />
                  Instant access
                </span>
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCircleCheck} className="w-4 h-4 text-status-success" />
                  Cancel anytime
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
