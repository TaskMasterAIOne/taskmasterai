import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
    LayoutDashboard, NotebookText, CalendarDays, Users, Globe2, FolderKanban,
    Eye, BrainCircuit, Settings, CheckCircle, AlertTriangle, X, Send,
    Loader2, History, Clock, Sparkles
} from 'lucide-react';

// Assuming API Key is accessible
import { getGeminiApiKey } from '../lib/dashboard-firebase'; // Adjust path as needed

// --- AI Helper Functions (Unchanged) ---

const streamResponse = async (
  url: string,
  options: RequestInit,
  onStreamUpdate: (textChunk: string) => void,
) => {
    try {
        const response = await fetch(url, { ...options });

        if (!response.ok) {
            let errorBody = '';
            try {
                errorBody = await response.text();
                const errorJson = JSON.parse(errorBody);
                if (errorJson?.error?.message) {
                    throw new Error(`API Error (${response.status}): ${errorJson.error.message}`);
                }
            } catch (parseError) { /* Ignore */ }
            throw new Error(`API Request Failed (${response.status}): ${response.statusText} ${errorBody || ''}`);
        }

        if (!response.body) {
            const text = await response.text();
            onStreamUpdate(text);
            return text;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let accumulatedRawText = "";

        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (value) {
                const rawChunk = decoder.decode(value, { stream: !done });
                accumulatedRawText += rawChunk;
                onStreamUpdate(accumulatedRawText);
            }
        }
        return accumulatedRawText;

    } catch (error) {
        console.error("Streaming Error:", error);
        throw error;
    }
};

const extractCandidateText = (rawResponseText: string): string => {
    try {
        let extractedText = "";
        let potentialJson = "";
        const lines = rawResponseText.trim().split('\n');
        const lastDataLine = lines.filter(line => line.startsWith('data:')).pop();

        if (lastDataLine) {
             potentialJson = lastDataLine.substring(5).trim();
        } else if (rawResponseText.trim().startsWith('{')) {
            potentialJson = rawResponseText.trim();
        }

        if (potentialJson) {
            try {
                const parsedJson = JSON.parse(potentialJson);
                if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                    extractedText = parsedJson.candidates[0].content.parts[0].text;
                } else if (parsedJson.error?.message) {
                    console.error("Gemini API Error in response:", parsedJson.error.message);
                    return `Error: ${parsedJson.error.message}`;
                } else {
                    const anyTextPart = parsedJson.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
                    extractedText = anyTextPart || "";
                }
            } catch (e) {
                 const textMatch = rawResponseText.match(/"text":\s*"((?:\\.|[^"\\])*)"/);
                 extractedText = textMatch ? JSON.parse(`"${textMatch[1]}"`) : "";
            }
        } else {
             if (rawResponseText.includes('"error":')) {
                 try {
                     const parsedError = JSON.parse(rawResponseText);
                     if (parsedError.error?.message) {
                         console.error("Gemini API Error (direct):", parsedError.error.message);
                         return `Error: ${parsedError.error.message}`;
                     }
                 } catch (e) { /* ignore */ }
             }
             extractedText = rawResponseText.replace(/^data:\s*/, '').trim();
        }
        return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return "";
    }
};

// --- Component Data & Constants (Unchanged) ---
const Logo = () => (
  <Link to="/" className="flex items-center space-x-2 group" aria-label="Go to Homepage">
    <svg
      className="w-8 h-8 text-indigo-500 group-hover:text-indigo-400 transition-colors"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="currentColor"/>
    </svg>
    <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
      Status
    </span>
  </Link>
);

const serviceStatus = [
  { name: "Dashboard", icon: LayoutDashboard, uptime: "99.99%", majorIssue: null, description: "Core application interface and widgets." },
  { name: "Notes", icon: NotebookText, uptime: "99.98%", majorIssue: null, description: "Note-taking, editing, and organization features." },
  { name: "Folders", icon: FolderKanban, uptime: "100.00%", majorIssue: null, description: "File and note organization using folders." },
  {
    name: "Focus",
    icon: Eye,
    uptime: "100.00%",
    majorIssue: null,
    description: "Distraction-free work environment feature. Now available for all users!",
    isNewFeature: true,
  },
  { name: "AI Chat", icon: BrainCircuit, uptime: "99.87%", majorIssue: null, description: "In-app AI chat, summarization, and generation." },
  { name: "Settings", icon: Settings, uptime: "99.96%", majorIssue: null, description: "User account and application preferences." },
];

const incidentHistory = [
    {
        date: "March 4, 2:59 PM EST",
        title: "Major Outage - Notes Feature",
        description: "We experienced a major outage affecting the Notes feature. Due to performance issues with underlying AI models, the system was unable to generate notes reliably during this time. Our team identified the root cause and implemented a fix to restore full functionality. We apologize for the inconvenience and appreciate your patience.",
        resolvedDate: "April 13, 2025",
        status: "Resolved"
    },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } } };

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


      const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the key when the component mounts, as the chat is a core feature of this page.
    const fetchKey = async () => {
      const key = await getGeminiApiKey();
      if (key && !key.startsWith("ERROR_")) {
        setGeminiApiKey(key);
      } else {
        console.error("Critical: Failed to load Gemini API key for the Status component.");
        // We can disable the AI chat button or show an error if the key fails to load.
        // For now, we'll log the error. The handleChatSubmit function will prevent submission.
      }
    };

    fetchKey();
  }, []); // Empty dependency array means this runs once on mount
  // --- END OF NEW CODE ---

  // Determine overall status
  const hasMajorOutage = serviceStatus.some(service => service.majorIssue);
  const overallStatusText = hasMajorOutage ? "Major Outage" : "All Systems Operational";
  const lastUpdated = "May 22, 2025; 10:20 AM EST";

// src/components/Status.tsx -> inside the Status() component

   const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // --- FIX #1: ADD GUARD CLAUSE FOR THE API KEY ---
    if (!geminiApiKey) {
        console.error("Gemini API Key is not available. Aborting chat submission.");
        const errorMsg: any = { 
            id: `error-no-key-${Date.now()}`, 
            role: 'assistant', 
            content: `The AI Assistant is currently unavailable due to a configuration error. Please try again later.`, 
            error: true,
        };
        setChatHistory(prev => [...prev, errorMsg]);
        setIsChatLoading(false);
        return;
    }
    // --- END OF FIX ---

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

    let accumulatedStreamedText = "";
    let finalRawResponseText = "";

    try {
        // --- FIX #2: USE THE GEMINI API KEY FROM STATE ---
        const geminiEndpointWithKey = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}&alt=sse`;

        const geminiOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                ],
            })
        };

        await streamResponse(geminiEndpointWithKey, geminiOptions, (rawChunkAccumulated) => {
            finalRawResponseText = rawChunkAccumulated;
            const currentExtractedText = extractCandidateText(rawChunkAccumulated);
            accumulatedStreamedText = currentExtractedText;
            setChatHistory(prev => prev.map(msg =>
                msg.id === assistantMsgId ? { ...msg, content: accumulatedStreamedText || "..." } : msg
            ));
        });

        const finalExtracted = extractCandidateText(finalRawResponseText);
        setChatHistory(prev => prev.map(msg =>
             msg.id === assistantMsgId ? { ...msg, content: finalExtracted || accumulatedStreamedText || "Sorry, I couldn't fetch the status details." } : msg
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
   }, [chatMessage, isChatLoading, chatHistory, lastUpdated, geminiApiKey]); // <-- FIX #3: Add geminiApiKey to dependency array

  return (
    <div className="min-h-screen flex flex-col font-poppins bg-white text-gray-800 dark:bg-[#0C0E1A] dark:text-gray-200 illuminate-override">
      {/* Static Header */}
      <header className="w-full py-5 sm:py-6 bg-white dark:bg-[#0C0E1A] illuminate-override ">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <Logo />
            <Link
              to="/dashboard"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-indigo-500/50 illuminate-button-override"
            >
              Go to Dashboard
            </Link>
          </nav>
        </div>
      </header>
      
      {/* Main Status Content */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                System Status
                <span className={`px-3 py-1 text-sm font-semibold rounded-full w-fit ${
                    hasMajorOutage
                        ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                }`}>
                    {overallStatusText}
                </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: {lastUpdated}</p>
            <hr className="border-gray-200 dark:border-gray-700/60 mb-10"/>

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
                    ? "text-red-800 bg-red-100 border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-700/50"
                    : "text-green-800 bg-green-100 border-green-200 dark:text-green-300 dark:bg-green-900/40 dark:border-green-700/50";

                const iconColorClass = typedService.isNewFeature ? 'text-teal-500 dark:text-teal-400' : 'text-indigo-600 dark:text-indigo-400';

                return (
                  <motion.div
                    key={typedService.name}
                    variants={itemVariants}
                    className="bg-white dark:bg-[#161A2C] border border-gray-200 dark:border-gray-700/60 rounded-xl p-5 shadow-sm hover:shadow-lg dark:hover:border-gray-600 transition-all duration-300 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <IconComponent className={`w-6 h-6 ${iconColorClass}`} />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{typedService.name}</h3>
                        {typedService.isNewFeature && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 rounded-full shadow-sm flex items-center gap-1">
                               <Sparkles className="w-3 h-3 inline-block opacity-80" /> New
                            </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${displayStatusColorClass} flex items-center gap-1`}>
                        {displayStatusText}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
                      {typedService.description}
                      <span className="block text-xs text-gray-500 mt-1">Uptime: {typedService.uptime}</span>
                    </p>
                    {isOutage && (
                      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg text-sm text-red-800 dark:text-red-200 mt-auto">
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
                 <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                     <History className="w-7 h-7 text-indigo-500 dark:text-indigo-400"/>
                     Past Incidents
                 </h2>
                 {incidentHistory.length === 0 ? (
                     <p className="text-gray-500 dark:text-gray-400 italic">No past incidents reported recently.</p>
                 ) : (
                     <div className="space-y-6">
                         {incidentHistory.map((incident, index) => (
                             <motion.div
                                 key={index}
                                 className="bg-white dark:bg-[#161A2C] p-5 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm"
                                 variants={itemVariants}
                                 initial="hidden"
                                 animate="visible"
                                 transition={{delay: 0.6 + index * 0.1}}
                             >
                                 <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
                                     <h3 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-1 sm:mb-0">{incident.title}</h3>
                                     <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                         incident.status === 'Resolved' 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' 
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/30 dark:text-yellow-300'
                                     }`}>{incident.status}</span>
                                 </div>
                                 <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                                     Reported: {incident.date} {incident.resolvedDate && `| Resolved: ${incident.resolvedDate}`}
                                 </p>
                                 <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
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
      <footer className="bg-white dark:bg-[#0C0E1A] mt-auto illuminate-override illuminate-border-override">
        <div className="container mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4 text-sm">
              <Link to="/privacy-policy" className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-400 dark:text-gray-700">|</span>
              <Link to="/terms" className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 md:mt-0">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>


       {/* AI Chat Sidebar */}
        <div
            aria-hidden={!isAiSidebarOpen}
            className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-[60] transform transition-transform duration-300 ease-in-out ${ isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full' } bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-l border-gray-200 dark:border-gray-700/50 flex flex-col shadow-2xl`}
            role="complementary"
            aria-labelledby="ai-sidebar-title-status"
        >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-200/80 dark:border-gray-700/50 flex justify-between items-center flex-shrink-0 sticky top-0 bg-white/70 dark:bg-gray-900/70 z-10">
                <h3 id="ai-sidebar-title-status" className="text-base sm:text-lg font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <BrainCircuit className="w-5 h-5" />
                    Status Assistant
                </h3>
                <button onClick={() => setIsAiSidebarOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 p-1 rounded-full transition-colors transform hover:scale-110 active:scale-100" title="Close Chat" aria-label="Close Status AI Sidebar">
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
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-md break-words ${ message.role === 'user' ? 'bg-indigo-600 text-white' : message.error ? 'bg-red-50 text-red-900 border border-red-200 dark:bg-red-800/50 dark:text-red-200 dark:border-red-700/50' : 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700/80 dark:text-gray-200 dark:border-gray-600/50' }`}>
                        {message.content && message.content !== "..." && (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                    a: ({node, ...props}) => <a className="text-indigo-500 dark:text-indigo-300 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                    code({node, inline, className, children, ...props}) {
                                        return !inline ? (
                                          <pre className="bg-gray-200 dark:bg-gray-900/50 p-2 rounded my-2 overflow-x-auto text-xs"><code className={className} {...props}>{children}</code></pre>
                                        ) : (
                                          <code className="bg-gray-300 dark:bg-gray-600/70 px-1 rounded text-xs" {...props}>{children}</code>
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
            <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-200/80 dark:border-gray-700/50 flex-shrink-0 sticky bottom-0 bg-white/90 dark:bg-gray-900/90">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Ask about service status..."
                        className="flex-1 bg-gray-100 border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-60"
                        disabled={isChatLoading}
                        aria-label="Chat input for status assistant"
                    />
                    <button
                        type="submit"
                        disabled={isChatLoading || !chatMessage.trim()}
                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-indigo-500"
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
