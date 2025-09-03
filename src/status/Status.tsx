import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
    LayoutDashboard, Notebook, Folders,
    ZapOff, MessageCircle, Settings, X, Send,
    Loader2, History, Sparkles, BrainCircuit
} from 'lucide-react';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { Logo } from '../components/Logo';

// --- REMOVED: Old AI helper functions no longer needed ---

const serviceStatus = [
  { name: "Dashboard", icon: LayoutDashboard, uptime: "99.99%", majorIssue: null, description: "Core application interface and widgets." },
  { name: "Notes", icon: Notebook, uptime: "99.98%", majorIssue: null, description: "Note-taking, editing, and organization features." },
  { name: "Folders", icon: Folders, uptime: "100.00%", majorIssue: null, description: "File and note organization using folders." },
  {
    name: "Focus",
    icon: ZapOff,
    uptime: "99.95%",
    majorIssue: null,
    description: "Distraction-free work environment feature for enhanced productivity.",
    isNewFeature: false,
  },
  { name: "AI Chat", icon: MessageCircle, uptime: "99.87%", majorIssue: null, description: "In-app AI chat, summarization, and generation." },
  { name: "Settings", icon: Settings, uptime: "99.96%", majorIssue: null, description: "User account and application preferences." },
];

const incidentHistory = [
    {
        date: "August 28, 11:30 AM EST",
        title: "Focus Mode Maintenance",
        description: "Focus Mode went offline for maintenance updates and changes and upgrades for better user experience. The feature has been enhanced with improved performance optimizations and new productivity tools.",
        resolvedDate: "August 31, 2025",
        status: "Resolved"
    },
    {
        date: "March 4, 2:59 PM EST",
        title: "Major Outage - Notes Feature",
        description: "We experienced a major outage affecting the Notes feature. Due to performance issues with underlying AI models, the system was unable to generate notes reliably during this time. Our team identified the root cause and implemented a fix to restore full functionality. We apologize for the inconvenience and appreciate your patience.",
        resolvedDate: "April 13, 2025",
        status: "Resolved"
    },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } } };

// Component Start
const Status = () => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([
     { id: 'ai-status-greet', role: 'assistant', content: "Hi! I'm the Status Page Assistant. Ask me about the current status of our services (including newly launched ones!) or past incidents." }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- Theme Management ---
  useEffect(() => {
    window.scrollTo(0, 0);
    const applyTheme = () => {
        const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
        if (isIlluminateEnabled) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        } else {
            document.documentElement.classList.remove('light');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', applyTheme);
    }
  }, []);




  // Determine overall status
  const hasMajorOutage = serviceStatus.some(service => service.majorIssue);
  const overallStatusText = hasMajorOutage ? "Major Outage" : "All Systems Operational";
  const lastUpdated = "August 31, 2025; 7:00 AM EST";

// src/components/Status.tsx -> inside the Status() component

   const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();



    if (!chatMessage.trim() || isChatLoading) return;

    const currentMessage = chatMessage;
    setChatMessage('');
    const userMsg: any = { id: `user-${Date.now()}`, role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);
    const assistantMsgId = `assistant-${Date.now()}`;
    const placeholderMsg: any = { id: assistantMsgId, role: 'assistant', content: "..." };
    setChatHistory(prev => [...prev, placeholderMsg]);

    const statusContext = serviceStatus.map(s => {
        let statusString = '';
        const serviceWithType = s as typeof s & { isNewFeature?: boolean };
        if (serviceWithType.majorIssue) {
            statusString = `Major Outage (Issue: ${serviceWithType.majorIssue})`;
        } else {
            statusString = `Operational (Uptime: ${serviceWithType.uptime || 'N/A'})`;
            if (serviceWithType.isNewFeature) {
                statusString += " - Newly Launched!";
            }
        }
        return `- ${serviceWithType.name}: Status ${statusString}`;
    }).join('\n');

    const historyContext = incidentHistory.map(inc =>
        `- Date: ${inc.date}, Title: ${inc.title}, Status: ${inc.status}${inc.resolvedDate ? `, Resolved: ${inc.resolvedDate}` : ''}. Summary: ${inc.description.substring(0, 150)}...`
    ).join('\n');

    const prompt = `
You are the TaskMaster Status Page AI Assistant. Your knowledge includes the current service status and past incident history provided below. You cannot access user data or any other part of the TaskMaster application.

**Current Service Status (as of ${lastUpdated}):**
${statusContext}

**Past Incident History:**
${historyContext}

**Your Task:**
1.  Answer user questions about the **current status** of the services listed.
2.  Answer user questions about **past incidents** listed in the history.
3.  If asked about something not in your knowledge base, state you don't have information on it.
4.  If asked for help with specific account issues or anything beyond status, politely state you cannot help and suggest contacting support.
5.  Keep responses concise and based *strictly* on the provided information.

**Conversation History (Last few turns):**
${chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}

**New User Message:**
user: ${currentMessage}

**Response:**
Assistant:`;



    try {
        // --- THIS IS THE NEW LOGIC ---
        const taskMasterProxyCallable = httpsCallable(getFunctions(), 'taskMasterProxy');
        
        const apiRequestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
            tools: [],
            systemInstruction: undefined,
            isImageGen: false
        };

        const result = await taskMasterProxyCallable(apiRequestBody);
        const responseData = result.data as any; // The data is now the direct response from Gemini

        // Extract the text from the response
        const finalExtracted = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't fetch the status details.";
        
        setChatHistory(prev => prev.map(msg =>
             msg.id === assistantMsgId ? { ...msg, content: finalExtracted } : msg
         ));

    } catch (err: any) {
        console.error('Status Chat Submit Error:', err);
        const errorMsgContent = `Sorry, I encountered an error retrieving status information${err.message ? ': ' + err.message : '.'}`;
        setChatHistory(prev => prev.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: errorMsgContent, error: true } : msg
        ));
    } finally {
        setIsChatLoading(false);
    }
   }, [chatMessage, isChatLoading, chatHistory, lastUpdated]);

  return (
    <div className="min-h-screen flex flex-col font-clarika bg-[var(--bg-primary)] text-[var(--text-primary)] illuminate-override selection:bg-[var(--bg-accent)] selection:text-white">
      {/* Static Header */}
      <header className="w-full py-5 sm:py-6 bg-[var(--bg-primary)] illuminate-override ">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <Link to="/">
              <Logo />
            </Link>
            <Link
              to="/dashboard"
              className="px-6 py-2.5 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-[var(--bg-accent)]/50 illuminate-button-override"
            >
              Go to Dashboard
            </Link>
          </nav>
        </div>
      </header>
      
      {/* Main Status Content */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                System Status
                <span className={`px-3 py-1 text-sm font-semibold rounded-full w-fit mb-1 ${
                    hasMajorOutage
                        ? 'bg-[var(--status-error)] text-white border border-[var(--status-error)]'
                        : 'bg-[var(--status-success)] text-white border border-[var(--status-success)]'
                }`}>
                    {overallStatusText}
                </span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-10">Last updated: {lastUpdated}</p>
            <hr className="border-[var(--border-primary)] mb-10"/>

            {/* Service Status Grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
            >
              {serviceStatus.map((service) => {
                const typedService = service as typeof service & { isNewFeature?: boolean };
                const IconComponent = typedService.icon;
                const isOutage = Boolean(typedService.majorIssue);

                const displayStatusText = isOutage ? "Major Outage" : "Operational";
                const displayStatusColorClass = isOutage 
                    ? "text-white bg-[var(--status-error)] border-[var(--status-error)]"
                    : "text-white bg-[var(--status-success)] border-[var(--status-success)]";

                const iconColorClass = typedService.isNewFeature ? 'text-[var(--status-info)]' : 'text-[var(--bg-accent)]';

                return (
                  <motion.div
                    key={typedService.name}
                    variants={itemVariants}
                    className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-[var(--bg-accent)]/50 transition-all duration-300 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <IconComponent className={`w-6 h-6 ${iconColorClass}`} />
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{typedService.name}</h3>
                        {typedService.isNewFeature && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-[var(--status-info)]/10 text-[var(--status-info)] border border-[var(--status-info)]/20 rounded-full shadow-sm flex items-center gap-1">
                               <Sparkles className="w-3 h-3 inline-block opacity-80" /> New
                            </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${displayStatusColorClass} flex items-center gap-1`}>
                        {displayStatusText}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-4 flex-grow">
                      {typedService.description}
                      <span className="block text-xs text-[var(--text-muted)] mt-1">Uptime: {typedService.uptime}</span>
                    </p>
                    {isOutage && (
                      <div className="bg-[var(--status-error)]/5 border border-[var(--status-error)]/20 p-3 rounded-lg text-sm text-[var(--status-error)] mt-auto">
                         <p className="font-semibold mb-1">Current Issue:</p>
                         <p>{typedService.majorIssue}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Incident History Section */}
            <motion.div
                className="mt-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
            >
                 <h2 className="text-3xl font-semibold text-[var(--text-primary)] mb-6 flex items-center gap-3">
                     <History className="w-7 h-7 text-[var(--bg-accent)]"/>
                     Past Incidents
                 </h2>
                 {incidentHistory.length === 0 ? (
                     <p className="text-[var(--text-muted)] italic">No past incidents reported recently.</p>
                 ) : (
                     <div className="space-y-6">
                         {incidentHistory.map((incident, index) => (
                             <motion.div
                                 key={index}
                                 className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border-primary)] shadow-sm"
                                 variants={itemVariants}
                                 initial="hidden"
                                 animate="visible"
                                 transition={{delay: 0.6 + index * 0.1, type: 'spring' as const, stiffness: 100}}
                             >
                                 <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
                                     <h3 className="text-lg font-semibold text-[var(--bg-accent)] mb-1 sm:mb-0">{incident.title}</h3>
                                     <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                                         incident.status === 'Resolved' 
                                            ? 'bg-[var(--status-success)] text-white border-[var(--status-success)]' 
                                            : 'bg-[var(--status-warning)] text-white border-[var(--status-warning)]'
                                     }`}>{incident.status}</span>
                                 </div>
                                 <p className="text-xs text-[var(--text-muted)] mb-3">
                                     Reported: {incident.date} {incident.resolvedDate && `| Resolved: ${incident.resolvedDate}`}
                                 </p>
                                 <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                     {incident.description}
                                 </p>
                             </motion.div>
                         ))}
                     </div>
                 )}
            </motion.div>
        </div>
      </main>


      {/* Footer */}
      <footer className="bg-[var(--bg-primary)] mt-auto illuminate-override illuminate-border-override">
        <div className="container mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4 text-sm">
              <Link to="/privacy-policy" className="text-[var(--text-secondary)] hover:text-[var(--bg-accent)] transition-colors">
                Privacy Policy
              </Link>
              <span className="text-[var(--text-muted)]">|</span>
              <Link to="/terms" className="text-[var(--text-secondary)] hover:text-[var(--bg-accent)] transition-colors">
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-4 md:mt-0">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>


       {/* AI Chat Sidebar */}
        <div
            aria-hidden={!isAiSidebarOpen}
            className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-[60] transform transition-transform duration-300 ease-in-out ${ isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full' } bg-[var(--bg-primary)]/80 backdrop-blur-lg border-l border-[var(--border-primary)] flex flex-col shadow-2xl`}
            role="complementary"
            aria-labelledby="ai-sidebar-title-status"
        >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center flex-shrink-0 sticky top-0 bg-[var(--bg-primary)]/70 z-10">
                <h3 id="ai-sidebar-title-status" className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--bg-accent)]">
                    <BrainCircuit className="w-5 h-5" />
                    Status Assistant
                </h3>
                <button onClick={() => setIsAiSidebarOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-highlight)] p-1 rounded-full transition-colors transform hover:scale-110 active:scale-100" title="Close Chat" aria-label="Close Status AI Sidebar">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Chat History Area */}
            <div ref={chatEndRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((message, index) => (
                    <motion.div
                      key={message.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' }`}
                    >
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-md break-words ${ message.role === 'user' ? 'bg-[var(--bg-solid-button)] text-white' : message.error ? 'bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/20' : 'bg-[var(--bg-highlight)] text-[var(--text-primary)] border border-[var(--border-primary)]' }`}>
                        {message.content && message.content !== "..." && (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                    a: ({node, ...props}) => <a className="text-[var(--bg-accent)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                    code({node, className, children, ...props}) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return match ? (
                                          <pre className="bg-[var(--bg-highlight)] p-2 rounded my-2 overflow-x-auto text-xs"><code className={className} {...props}>{children}</code></pre>
                                        ) : (
                                          <code className="bg-[var(--bg-card)] px-1 rounded text-xs" {...props}>{children}</code>
                                        )
                                    },
                                    ul: ({node, ...props}) => <ul className="list-disc list-inside my-1" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal list-inside my-1" {...props} />,
                                    li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                        {message.content === "..." && isChatLoading && index === chatHistory.length - 1 && (
                            <div className="flex space-x-1.5 py-1">
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-70"></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150 opacity-70"></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-300 opacity-70"></div>
                            </div>
                        )}
                    </div>
                    </motion.div>
                ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleChatSubmit} className="p-3 border-t border-[var(--border-primary)] flex-shrink-0 sticky bottom-0 bg-[var(--bg-primary)]/90">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Ask about service status..."
                        className="flex-1 bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-full px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-1 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-colors duration-150 disabled:opacity-60"
                        disabled={isChatLoading}
                        aria-label="Chat input for status assistant"
                    />
                    <button
                        type="submit"
                        disabled={isChatLoading || !chatMessage.trim()}
                        className="bg-[var(--bg-solid-button)] text-white p-2 rounded-full hover:bg-[var(--bg-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] focus:ring-[var(--bg-accent)]"
                        title="Send Message"
                        aria-label="Send chat message"
                    >
                    {isChatLoading ? (<Loader2 className="w-5 h-5 animate-spin"/>) : (<Send className="w-5 h-5" />)}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default Status;
