
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play, Pause, PlusCircle, Edit, Trash, Sparkles, CheckCircle, MessageCircle, Crown, RotateCcw,
  Square, X, TimerIcon, Send, ChevronLeft, ChevronRight, Moon, Sun, Star, /*Wind, Droplets, Zap,*/ // Removed weather icons
  Calendar, Clock, MoreHorizontal, ArrowUpRight, Bookmark, BookOpen, Lightbulb, Flame, Award,
  TrendingUp, Rocket, Target, Layers, Clipboard, AlertCircle, ThumbsUp, ThumbsDown, BrainCircuit,
  ArrowRight, Flag, Bell, Filter, Tag, BarChart, PieChart, ChevronDown, Info, Eye, EyeOff,
} from 'lucide-react'; // Added Info, Eye, EyeOff for insights toggle
import { Sidebar } from './Sidebar';
import { Timer } from './Timer';
import { FlashcardsQuestions } from './FlashcardsQuestions';
import { getTimeBasedGreeting, getRandomQuote } from '../lib/greetings';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  onFirebaseAuthStateChanged,
  onCollectionSnapshot,
  createTask,
  createGoal,
  createProject,
  updateDashboardLastSeen,
  createPlan,
  addCustomTimer,
  onCustomTimersSnapshot,
  updateItem,
  deleteItem,
  markItemComplete,
  updateCustomTimer,
  deleteCustomTimer,
  // weatherApiKey, // Removed
  // hfApiKey, // Unused
  geminiApiKey,
} from '../lib/dashboard-firebase';

import {
    UserTier,
    // ChatUsageData, // Not directly used, functions handle it
    getUserTier,
    getCurrentMonthUserChatUsage,
    incrementUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';

import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
// import { updateUserProfile, signOutUser, deleteUserAccount, AuthError, getCurrentUser } from '../lib/settings-firebase'; // Not directly used in Dashboard
import { SmartInsight as SmartInsightComponent } from './SmartInsight';
import { PriorityBadge } from './PriorityBadge';
import { TaskAnalytics } from './TaskAnalytics';


// ---------------------
// Helper functions for Gemini integration (Unchanged)
// ---------------------
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}&alt=sse`;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
         console.warn('Fetch timed out:', url);
         throw new Error('Request timed out');
    }
    throw error;
  }
};

const streamResponse = async (
  url: string,
  options: RequestInit,
  onStreamUpdate: (textChunk: string) => void,
  timeout = 45000
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
            } catch (parseError) { /* ignore */ }
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
                    return `Error: ${parsedJson.error.message}`;
                } else if (parsedJson.candidates?.[0]?.finishReason && parsedJson.candidates?.[0]?.finishReason !== 'STOP') {
                      return `Error: Generation stopped (${parsedJson.candidates[0].finishReason})`;
                 } else {
                    extractedText = "";
                }
            } catch (e) {
                extractedText = "";
            }
        }
        return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return "";
    }
};
// ---------------------
// Helper functions (Unchanged Dates/Priority)
// ---------------------
const getWeekDates = (date: Date): Date[] => {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    weekDates.push(day);
  }
  return weekDates;
};

const formatDateForComparison = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const calculatePriority = (item: any): 'high' | 'medium' | 'low' => {
  if (item.data.priority) return item.data.priority;
  if (!item.data.dueDate) return 'low';
  let dueDate: Date | null = null;
  if (item.data.dueDate?.toDate) { dueDate = item.data.dueDate.toDate(); }
  else if (item.data.dueDate instanceof Date) { dueDate = item.data.dueDate; }
  else if (typeof item.data.dueDate === 'string' || typeof item.data.dueDate === 'number') {
      try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) { dueDate = null; }} catch (e) { dueDate = null; }
  }
  if (!dueDate) return 'low';
  const now = new Date();
  dueDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'high';
  if (diffDays <= 1) return 'high';
  if (diffDays <= 3) return 'medium';
  return 'low';
};

interface SmartInsight {
  id: string;
  text: string;
  type: 'suggestion' | 'warning' | 'achievement';
  accepted?: boolean;
  rejected?: boolean;
  relatedItemId?: string;
  createdAt: Date;
}

export function Dashboard() {
  // ---------------------
  // 1. USER & GENERAL STATE
  // ---------------------
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("Loading...");
  const [quote, setQuote] = useState(getRandomQuote());
  const [greeting, setGreeting] = useState(getTimeBasedGreeting());

  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [chatCount, setChatCount] = useState(0);
  const [chatMonth, setChatMonth] = useState('');
  const [isChatLimitReached, setIsChatLimitReached] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'true'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled));
    if (isBlackoutEnabled && !isIlluminateEnabled) { document.body.classList.add('blackout-mode'); }
    else { document.body.classList.remove('blackout-mode'); }
  }, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
  useEffect(() => {
    localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled));
    if (isIlluminateEnabled) {
      document.body.classList.add('illuminate-mode');
      document.body.classList.remove('blackout-mode');
    } else {
      document.body.classList.remove('illuminate-mode');
      if (isBlackoutEnabled) { document.body.classList.add('blackout-mode'); }
    }
  }, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

  useEffect(() => {
    const checkAuth = async () => {
        const authUser = auth.currentUser; // Check auth.currentUser directly
        if (!authUser) { navigate('/login'); }
        else { updateDashboardLastSeen(authUser.uid).catch(err => console.warn("Failed to update last seen:", err));}
    };
    checkAuth();
  }, [navigate]);

  const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
  const [currentWeek, setCurrentWeek] = useState<Date[]>(getWeekDates(new Date()));
  const today = new Date();

  interface TimerMessage { type: 'timer'; duration: number; id: string; }
  interface FlashcardData { id: string; question: string; answer: string; topic: string; }
  interface QuestionData { id: string; question: string; options: string[]; correctAnswer: number; explanation: string; }
  interface FlashcardMessage { type: 'flashcard'; data: FlashcardData[]; }
  interface QuestionMessage { type: 'question'; data: QuestionData[]; }
  interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; timer?: TimerMessage; flashcard?: FlashcardMessage; question?: QuestionMessage; error?: boolean; }

  // ---------------------
  // CHAT FUNCTIONALITY
  // ---------------------
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([{ id: 'initial-greet', role: 'assistant', content: "👋 Hi I'm TaskMaster, How can I help you today? Need help with your items? Simply ask me!" }]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-complete-${timerId}`, role: 'assistant', content: `⏰ Timer (${timerId.substring(0,4)}...) finished!` }]);
  const parseTimerRequest = (message: string): number | null => {
    const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i;
    const match = message.match(timeRegex);
    if (!match) return null;
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (isNaN(amount) || amount <= 0) return null;
    if (unit.startsWith('hour') || unit.startsWith('hr')) return amount * 3600;
    if (unit.startsWith('min')) return amount * 60;
    if (unit.startsWith('sec')) return amount;
    return null;
  };
  useEffect(() => { if (chatEndRef.current && isAiSidebarOpen) { requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));}}, [chatHistory, isAiSidebarOpen]);
  const formatItemsForChat = () => {
    const lines: string[] = [];
    lines.push(`Current items for ${userName}:\n`);
    const formatLine = (item: any, type: string) => {
      const name = item.data[type] || 'Untitled';
      const due = item.data.dueDate?.toDate?.();
      const priority = item.data.priority || calculatePriority(item);
      const completed = item.data.completed ? 'Yes' : 'No';
      return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${name}${due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''} [Priority: ${priority}] [Completed: ${completed}]`;
    };
    const activeItems = [...tasks, ...goals, ...projects, ...plans];
    if (activeItems.length === 0) return `No active items found for ${userName}.`;
    activeItems.forEach((item) => {
        if (item.data.task) lines.push(formatLine(item, 'task'));
        else if (item.data.goal) lines.push(formatLine(item, 'goal'));
        else if (item.data.project) lines.push(formatLine(item, 'project'));
        else if (item.data.plan) lines.push(formatLine(item, 'plan'));
    });
    return lines.join('\n');
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading || !user) return;

    const currentMonthYear = new Date().toISOString().slice(0, 7);
    let limitReachedByCheck = false;
    const currentLimitNumber = getChatLimitForTier(userTier);

    if (userTier !== 'premium') {
        let currentUsageCount = chatCount;
        if (chatMonth !== currentMonthYear) {
            currentUsageCount = 0;
            // No need to update state here yet, incrementUserChatUsage will handle the reset or first increment
        }
        limitReachedByCheck = currentUsageCount >= currentLimitNumber;
    }
    // Update state based on the check before proceeding
    setIsChatLimitReached(limitReachedByCheck);


    if (limitReachedByCheck) {
          setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${currentLimitNumber} chat message limit for this month. Upgrade for more interactions!`, error: true }]);
          setChatMessage('');
          return;
    }

    const currentMessageText = chatMessage;
    setChatMessage('');
    const timerDuration = parseTimerRequest(currentMessageText);
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: currentMessageText };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    if (userTier !== 'premium' && user?.uid) {
        try {
            await incrementUserChatUsage(user.uid); // ATOMIC INCREMENT
            // After successful increment, update local state (optimistic or re-fetch)
            // For simplicity, let's optimistically update the local count if month matches
            if (chatMonth === currentMonthYear || chatMonth === '') { // Also handle initial empty month
                const newCount = chatCount + 1;
                setChatCount(newCount);
                setChatMonth(currentMonthYear); // Ensure month is set
                setIsChatLimitReached(newCount >= currentLimitNumber);
            } else {
                // Month changed, Firestore reset to 1, update local state
                setChatCount(1);
                setChatMonth(currentMonthYear);
                setIsChatLimitReached(1 >= currentLimitNumber);
            }
        } catch (err) {
            console.error("Failed to increment chat usage in Firestore:", err);
            setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage. Your message was sent, but the count might be inaccurate.", error: true }]);
        }
    }

    if (timerDuration) {
      const timerId = Math.random().toString(36).substring(2, 9);
      setChatHistory(prev => [...prev, { id: `timer-start-${timerId}`, role: 'assistant', content: `Okay, starting a timer for ${Math.round(timerDuration / 60)} minutes.`, timer: { type: 'timer', duration: timerDuration, id: timerId } }]);
      setIsChatLoading(false);
      return;
    }

    const conversationHistory = chatHistory.slice(-6).map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content}`).join('\n');
    const itemsText = formatItemsForChat();
    const now = new Date();
    const currentDateTime = { date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) };
    const prompt = `[CONTEXT]\nUser's Name: ${userName}\nCurrent Date: ${currentDateTime.date}\nCurrent Time: ${currentDateTime.time}\n\nUser's Current Items:\n${itemsText}\n\n[CONVERSATION HISTORY (Last few turns)]\n${conversationHistory}\n\n[NEW USER MESSAGE]\n${userName}: ${currentMessageText}\n\nYou are TaskMaster, a friendly and versatile AI productivity assistant. Engage in casual conversation, provide productivity advice, and discuss ${userName}'s items only when explicitly asked by ${userName}.\n\nGuidelines:\n\n1. General Conversation:\n   - Respond in a friendly, natural tone matching ${userName}'s style.\n   - Do not include any internal instructions, meta commentary, or explanations of your process.\n   - Do not include phrases such as "Here's my response to continue the conversation:"\n     or similar wording that introduces your reply.\n   - Do not include or reference code blocks for languages like Python, Bash, or any other\n     unless explicitly requested by ${userName}.\n   - Only reference ${userName}'s items if ${userName} explicitly asks about them.\n   - When discussing tasks, goals, projects, or plans, consider their priority levels and due dates.\n   - Provide specific advice based on item priorities and completion status.\n\n2. Educational Content (JSON):\n   - If ${userName} explicitly requests educational content (flashcards or quiz questions), provide exactly one JSON object.\n   - Wrap the JSON object in a single code block using triple backticks and the "json" language identifier.\n   - Use one of the following formats:\n\n     For flashcards:\n     {\n       "type": "flashcard",\n       "data": [\n         { "id": "unique-id-1", "question": "Question 1", "answer": "Answer 1", "topic": "Subject area" },\n         { "id": "unique-id-2", "question": "Question 2", "answer": "Answer 2", "topic": "Subject area" }\n       ]\n     }\n\n     For quiz questions:\n     {\n       "type": "question",\n       "data": [\n         { "id": "unique-id-1", "question": "Question 1", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correctAnswer": 0, "explanation": "Explanation 1" },\n         { "id": "unique-id-2", "question": "Question 2", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correctAnswer": 1, "explanation": "Explanation 2" }\n       ]\n     }\n\n   - Do not include any JSON unless ${userName} explicitly requests it.\n   - The JSON must be valid, complete, and include multiple items in its "data" array.\n\n3. Response Structure:\n   - Provide a direct response to ${userName} without any extraneous openings or meta-text.\n   - Do not mix JSON with regular text. JSON is only for requested educational content.\n   - Always address ${userName} in a friendly, helpful tone.\n\nFollow these instructions strictly.`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const placeholderMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: "..." };
    setChatHistory(prev => [...prev, placeholderMsg]);
    let accumulatedStreamedText = "";
    let finalRawResponseText = "";

    try {
      const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }] }) };
      await streamResponse(geminiEndpoint, geminiOptions, (rawChunkAccumulated) => {
          const currentExtractedText = extractCandidateText(rawChunkAccumulated);
          accumulatedStreamedText = extractCandidateText(rawChunkAccumulated); // Re-extract from full raw chunk
          if (accumulatedStreamedText) { setChatHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: accumulatedStreamedText || "..." } : msg )); }
          finalRawResponseText = rawChunkAccumulated;
      });
      setChatHistory(prev => prev.map(msg => {
          if (msg.id === assistantMsgId) {
              let finalExtractedAssistantText = extractCandidateText(finalRawResponseText);
              let parsedJson: any = null; let jsonType: 'flashcard' | 'question' | null = null;
              const finalJsonMatch = finalRawResponseText.match(/```json\s*([\s\S]*?)\s*```/);
              if (finalJsonMatch && finalJsonMatch[1]) {
                  try {
                      parsedJson = JSON.parse(finalJsonMatch[1].trim());
                      if ((parsedJson.type === 'flashcard' || parsedJson.type === 'question') && Array.isArray(parsedJson.data) && parsedJson.data.length > 0) {
                          finalExtractedAssistantText = finalExtractedAssistantText.replace(finalJsonMatch[0], '').trim();
                          jsonType = parsedJson.type;
                      } else { parsedJson = null; }
                  } catch (e) { parsedJson = null; }
              }
              if (!finalExtractedAssistantText && finalRawResponseText) {
                  finalExtractedAssistantText = finalRawResponseText.replace(/^data:\s*/gm, '').replace(/```json[\s\S]*?```/g, '').trim();
                  if (finalExtractedAssistantText.startsWith('{')) {
                      try {
                          const parsedFallback = JSON.parse(finalExtractedAssistantText);
                          if (parsedFallback?.error?.message) { finalExtractedAssistantText = `Error: ${parsedFallback.error.message}`; }
                          else {
                              const fallbackExtracted = extractCandidateText(finalExtractedAssistantText);
                              if (fallbackExtracted && !fallbackExtracted.startsWith('Error:')) { finalExtractedAssistantText = fallbackExtracted; }
                              else { finalExtractedAssistantText = "Error: Unexpected response format."; }
                          }
                      } catch { finalExtractedAssistantText = "Error: Could not process response."; }
                  }
              }
              return { ...msg, content: finalExtractedAssistantText || "...", flashcard: jsonType === 'flashcard' ? parsedJson : undefined, question: jsonType === 'question' ? parsedJson : undefined };
          }
          return msg;
      }));
    } catch (err: any) {
      setChatHistory(prev => {
          const errorMsgContent = `Sorry, I encountered an error${err.message ? ': ' + err.message : '.'} Please try again.`;
          let updated = false;
          const updatedHistory = prev.map(msg => { if (msg.id === assistantMsgId) { updated = true; return { ...msg, content: errorMsgContent, error: true }; } return msg; });
          if (!updated) { updatedHistory.push({ id: `error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true }); }
          return updatedHistory;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  // ---------------------
  // 2. COLLECTION STATES
  // ---------------------
  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);
  const [customTimers, setCustomTimers] = useState<Array<{ id: string; data: any }>>([]);

  const [smartInsights, setSmartInsights] = useState<SmartInsight[]>([]);
  const [showInsightsPanel, setShowInsightsPanel] = useState(true); // Default to expanded
  const insightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedItemsSigForInsights, setDebouncedItemsSigForInsights] = useState("");
  const createItemsSignatureForInsights = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}`).sort().join('|');
  useEffect(() => {
    if (!user) return;
    const currentSig = createItemsSignatureForInsights([tasks, goals, projects, plans]);
    if (insightTimeoutRef.current) { clearTimeout(insightTimeoutRef.current); }
    insightTimeoutRef.current = setTimeout(() => { setDebouncedItemsSigForInsights(currentSig); }, 2000);
    return () => { if (insightTimeoutRef.current) { clearTimeout(insightTimeoutRef.current); }};
  }, [user, tasks, goals, projects, plans]);
  useEffect(() => {
      if (!user || !debouncedItemsSigForInsights) return;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(item => !item.data.completed);
      let newInsights: SmartInsight[] = [];
      allActiveItems.forEach(item => {
          if (item.data.dueDate) {
               let dueDate: Date | null = null;
               if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate();
               else try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) dueDate = null; } catch { dueDate = null; }
               if (dueDate) {
                   dueDate.setHours(0, 0, 0, 0);
                   if (dueDate < now) {
                       const itemType = item.data.task ? 'task' : item.data.goal ? 'goal' : item.data.project ? 'project' : 'plan';
                       const itemName = item.data[itemType] || 'Untitled';
                       newInsights.push({ id: `overdue-${item.id}`, text: `"${itemName}" (${itemType}) is overdue. Reschedule or mark complete?`, type: 'warning', relatedItemId: item.id, createdAt: new Date() });
                   }
               }
          }
      });
      allActiveItems.forEach(item => {
           if (newInsights.some(ni => ni.relatedItemId === item.id && ni.type === 'warning')) return;
           if (item.data.dueDate) {
               let dueDate: Date | null = null;
               if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate();
               else try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) dueDate = null; } catch { dueDate = null; }
               if (dueDate) {
                   dueDate.setHours(0, 0, 0, 0);
                   const diffTime = dueDate.getTime() - now.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                   if (diffDays >= 0 && diffDays <= 2) {
                       const itemType = item.data.task ? 'task' : item.data.goal ? 'goal' : item.data.project ? 'project' : 'plan';
                       const itemName = item.data[itemType] || 'Untitled';
                       newInsights.push({ id: `upcoming-${item.id}`, text: `"${itemName}" (${itemType}) is due ${diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : 'in ' + diffDays + ' days'}. Plan time for it?`, type: 'suggestion', relatedItemId: item.id, createdAt: new Date() });
                   }
               }
          }
      });
      setSmartInsights(prev => {
          const existingActive = prev.filter(i => !i.accepted && !i.rejected);
          const combined = [...newInsights, ...existingActive];
          const uniqueMap = new Map<string, SmartInsight>();
          combined.forEach(insight => uniqueMap.set(insight.id, insight));
          return Array.from(uniqueMap.values()).slice(0, 5); // Limit to 5 active insights
      });
  }, [user, debouncedItemsSigForInsights]);
  const handleMarkComplete = async (itemId: string) => { if (!user) return; try { await markItemComplete(activeTab, itemId); } catch (error) { console.error("Error marking item as complete:", error); }};
  const handleSetPriority = async (itemId: string, priority: 'high' | 'medium' | 'low') => { if (!user) return; try { await updateItem(activeTab, itemId, { priority }); } catch (error) { console.error("Error updating priority:", error); }};

  // ---------------------
  // 3. GREETING UPDATE (Unchanged)
  // ---------------------
  useEffect(() => { const interval = setInterval(() => { setGreeting(getTimeBasedGreeting()); setQuote(getRandomQuote()); }, 60000); return () => clearInterval(interval); }, []);

  // ---------------------
  // 4. UI STATES (Unchanged)
  // ---------------------
  const [activeTab, setActiveTab] = useState<"tasks" | "goals" | "projects" | "plans">("tasks");
  const [newItemText, setNewItemText] = useState("");
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingPriority, setEditingPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [cardVisible, setCardVisible] = useState(false);
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
  const [editingTimerName, setEditingTimerName] = useState("");
  const [editingTimerMinutes, setEditingTimerMinutes] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setCardVisible(true), 100); return () => clearTimeout(timer); }, []);

  // ---------------------
  // 5. MAIN POMODORO TIMER (Unchanged)
  // ---------------------
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const pomodoroRef = useRef<NodeJS.Timer | null>(null);
  const pomodoroAudioRef = useRef<HTMLAudioElement | null>(null);
  const [pomodoroFinished, setPomodoroFinished] = useState(false);
  const handlePomodoroStart = () => {
    if (pomodoroRunning) return; setPomodoroRunning(true); setPomodoroFinished(false);
    if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; }
    if (pomodoroTimeLeft <= 0) { setPomodoroTimeLeft(25 * 60); }
    pomodoroRef.current = setInterval(() => {
      setPomodoroTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(pomodoroRef.current as NodeJS.Timer); setPomodoroRunning(false); setPomodoroFinished(true);
          if (!pomodoroAudioRef.current) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error("Error playing sound:", e)); pomodoroAudioRef.current = alarmAudio; } catch (e) { console.error("Could not create or play audio:", e) }}
          return 0;
        } return prev - 1;
      });
    }, 1000);
  };
  const handlePomodoroPause = () => { if (!pomodoroRunning) return; setPomodoroRunning(false); if (pomodoroRef.current) clearInterval(pomodoroRef.current); };
  const handlePomodoroReset = () => {
    setPomodoroRunning(false); setPomodoroFinished(false); if (pomodoroRef.current) clearInterval(pomodoroRef.current); pomodoroRef.current = null; setPomodoroTimeLeft(25 * 60);
    if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; }
  };
  const formatPomodoroTime = (timeInSeconds: number) => { const mins = Math.floor(timeInSeconds / 60); const secs = timeInSeconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; };
  useEffect(() => { return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current = null; }}; }, []);

  // ---------------------
  // 6. AUTH LISTENER & TIER/USAGE CHECK - *** UPDATED ***
  // ---------------------
  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
            const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
            let nameToSet = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User");
            if (docSnap.exists() && docSnap.data().name) { nameToSet = docSnap.data().name; }
            setUserName(nameToSet);
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserName(firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"));
        }

        setUserTier('loading'); // Set tier to loading first
        const fetchedTier = await getUserTier(firebaseUser.uid, firebaseUser.email); // Pass UID and EMAIL
        setUserTier(fetchedTier);

        if (fetchedTier !== 'premium') {
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            try {
                const usageData = await getCurrentMonthUserChatUsage(firebaseUser.uid, currentMonthYear);
                if (usageData) {
                    setChatCount(usageData.count);
                    setChatMonth(usageData.month);
                    const limit = getChatLimitForTier(fetchedTier);
                    setIsChatLimitReached(usageData.count >= limit);
                } else {
                    setChatCount(0);
                    setChatMonth(currentMonthYear);
                    setIsChatLimitReached(false);
                }
            } catch (err) {
                console.error("Error loading chat usage data:", err);
                setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false);
            }
        } else {
            setChatCount(0); setChatMonth(''); setIsChatLimitReached(false);
        }
      } else {
        setUserName("Loading...");
        setTasks([]); setGoals([]); setProjects([]); setPlans([]); setCustomTimers([]);
        setSmartOverview(""); setSmartInsights([]);
        setChatHistory([{ id: 'initial-greet-logout', role: 'assistant', content: "👋 Hi I'm TaskMaster, How can I help you today?" }]);
        setUserTier('loading'); setChatCount(0); setChatMonth(''); setIsChatLimitReached(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ---------------------
  // 7. COLLECTION SNAPSHOTS (Unchanged)
  // ---------------------
  useEffect(() => {
    if (!user?.uid) { setTasks([]); setGoals([]); setProjects([]); setPlans([]); setCustomTimers([]); return; };
    const unsubFunctions = [
        onCollectionSnapshot('tasks', user.uid, (items) => setTasks(items)),
        onCollectionSnapshot('goals', user.uid, (items) => setGoals(items)),
        onCollectionSnapshot('projects', user.uid, (items) => setProjects(items)),
        onCollectionSnapshot('plans', user.uid, (items) => setPlans(items)),
        onCustomTimersSnapshot(user.uid, (timers) => setCustomTimers(timers)),
    ];
    return () => { unsubFunctions.forEach(unsub => { try { unsub(); } catch (e) { console.warn("Error unsubscribing:", e); }}); };
  }, [user]);

  // ---------------------
  // 8. SMART OVERVIEW GENERATION (TIER-BASED)
  // ---------------------
  const [smartOverview, setSmartOverview] = useState<string>("");
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [lastGeneratedDataSig, setLastGeneratedDataSig] = useState<string>("");
  const [lastResponse, setLastResponse] = useState<string>("");
  const overviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedItemsSigForOverview, setDebouncedItemsSigForOverview] = useState("");
  const createItemsSignatureForOverview = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}-${item.data.priority || 'm'}-${item.data.task||item.data.goal||item.data.project||item.data.plan||''}`).sort().join('|');
  useEffect(() => {
      if (!user) return; const currentSig = createItemsSignatureForOverview([tasks, goals, projects, plans]);
      if (overviewTimeoutRef.current) { clearTimeout(overviewTimeoutRef.current); }
      overviewTimeoutRef.current = setTimeout(() => { setDebouncedItemsSigForOverview(currentSig); }, 1500);
      return () => { if (overviewTimeoutRef.current) { clearTimeout(overviewTimeoutRef.current); }};
  }, [user, tasks, goals, projects, plans]);
  useEffect(() => {
      if (!user || !geminiApiKey || !debouncedItemsSigForOverview || userTier === 'loading' || userTier === 'basic') {
          setSmartOverview(""); setOverviewLoading(userTier === 'loading'); setLastGeneratedDataSig(""); setLastResponse(""); return;
      }
      if (debouncedItemsSigForOverview === lastGeneratedDataSig && !overviewLoading) { return; }
      const generateOverview = async () => {
          if (overviewLoading) return;
          setOverviewLoading(true); setSmartOverview(""); setLastGeneratedDataSig(debouncedItemsSigForOverview);
          const formatItem = (item: any, type: string) => {
               let dueDate: Date | null = null;
               if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate();
               else if (item.data.dueDate) try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) dueDate = null; } catch { dueDate = null; }
              const title = item.data[type] || item.data.title || 'Untitled';
              const priority = item.data.priority || calculatePriority(item);
              const completed = item.data.completed ? 'Completed' : 'Pending';
              const dueDateFormatted = dueDate ? ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '';
              return `• ${title}${dueDateFormatted} [Priority: ${priority}] [Status: ${completed}]`;
          };
           const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(i => !i.data.completed);
           const formattedData = allActiveItems.length > 0 ? allActiveItems.map(item => { if (item.data.task) return formatItem(item, 'task'); if (item.data.goal) return formatItem(item, 'goal'); if (item.data.project) return formatItem(item, 'project'); if (item.data.plan) return formatItem(item, 'plan'); return null; }).filter(Boolean).join('\n') : "No pending items.";
          if (formattedData === "No pending items.") { setSmartOverview(`No pending items to generate overview from.`); setOverviewLoading(false); setLastResponse(""); return; }
          const firstName = userName.split(" ")[0];
          const prompt = `Analyze these pending items for user "${firstName}" and provide a *very concise* (1-2 sentences, max 80 tokens) Smart Overview focusing on the single most immediate priority or suggestion. Format as plain text. No greetings, no fluff.\n\n${formattedData}\n\nExample: Focus on high-priority 'Submit Report' due today. Next, tackle 'Plan Project Kickoff'.\nAnother Example: Check the overdue 'Draft Proposal' task first. Then review upcoming goals.\nAnother Example: Looks clear for today. Consider planning your next project step.\n\n`;
          try {
              const overviewEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
              const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 80, temperature: 0.5 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }] }) };
               const response = await fetchWithTimeout(overviewEndpoint, geminiOptions, 20000);
               if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} throw new Error(`Gemini API error (${response.status}): ${errorBody}`); }
              const resultJson = await response.json();
              const rawText = extractCandidateText(JSON.stringify(resultJson));
              const cleanText = rawText.trim();
              if (!cleanText || cleanText.toLowerCase().startsWith("error:") || cleanText.length < 5) { throw new Error("Received invalid overview response."); }
              if (cleanText !== lastResponse) { setLastResponse(cleanText); setSmartOverview(cleanText); }
              else { setSmartOverview(lastResponse); }
          } catch (error: any) {
              let errorMsg = "AI overview currently unavailable.";
               if (error.message.includes('429') || error.message.includes('rate limit')) { errorMsg = "Overview limit reached. Try again later."; }
               else if (error.message.includes('API key not valid')) { errorMsg = "Invalid AI config."; }
               else if (error.message.includes('timed out') || error.message === 'Request timed out') { errorMsg = "Overview request timed out."; }
               else if (error.message.includes("invalid overview response")) { errorMsg = "AI failed to generate a valid overview."; }
               else if (error.message.includes("API Error")) { errorMsg = "Overview generation failed (API)."; }
              setSmartOverview(errorMsg); setLastResponse(""); setLastGeneratedDataSig("");
          } finally { setOverviewLoading(false); }
      };
      generateOverview();
  }, [user, userTier, debouncedItemsSigForOverview, userName, geminiApiKey, lastResponse]);

  // ---------------------
  // 9. CREATE & EDIT & DELETE (Unchanged logic, but titleField/collectionName are dynamic)
  // ---------------------
  const handleTabChange = (tabName: "tasks" | "goals" | "projects" | "plans") => { setActiveTab(tabName); setEditingItemId(null); };
  const handleCreate = async () => {
    if (!user || !newItemText.trim()) return;
    let dateValue: Date | null = null;
    if (newItemDate) { try { const [year, month, day] = newItemDate.split('-').map(Number); dateValue = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); if (isNaN(dateValue.getTime())) dateValue = null; } catch { dateValue = null; }}
    const typeField = activeTab.slice(0, -1);
    const itemData = { [typeField]: newItemText, dueDate: dateValue, priority: newItemPriority, createdAt: new Date(), completed: false, userId: user.uid };
    try {
       if (activeTab === "tasks") await createTask(user.uid, itemData.task, itemData.dueDate, itemData.priority);
       else if (activeTab === "goals") await createGoal(user.uid, itemData.goal, itemData.dueDate, itemData.priority);
       else if (activeTab === "projects") await createProject(user.uid, itemData.project, itemData.dueDate, itemData.priority);
       else if (activeTab === "plans") await createPlan(user.uid, itemData.plan, itemData.dueDate, itemData.priority);
      setNewItemText(""); setNewItemDate(""); setNewItemPriority("medium");
    } catch (error) { console.error(`Error creating ${typeField}:`, error); alert(`Failed to create ${typeField}.`); }
  };
  let currentItems: Array<{ id: string; data: any }> = []; let titleField = "task"; let collectionName = activeTab;
  if (activeTab === "tasks") { currentItems = tasks; titleField = "task"; }
  else if (activeTab === "goals") { currentItems = goals; titleField = "goal"; }
  else if (activeTab === "projects") { currentItems = projects; titleField = "project"; }
  else if (activeTab === "plans") { currentItems = plans; titleField = "plan"; }
   const handleEditClick = (itemId: string, currentData: any) => {
        setEditingItemId(itemId); setEditingText(currentData[titleField] || "");
        let dateForInput = "";
        if (currentData.dueDate) { try { const dueDateObj = currentData.dueDate.toDate ? currentData.dueDate.toDate() : new Date(currentData.dueDate); if (!isNaN(dueDateObj.getTime())) { const tzOffset = dueDateObj.getTimezoneOffset() * 60000; const localDate = new Date(dueDateObj.getTime() - tzOffset); dateForInput = localDate.toISOString().split('T')[0]; }} catch (e) { console.warn("Error converting date for editing:", e);}}
        setEditingDate(dateForInput); setEditingPriority(currentData.priority || 'medium');
    };
  const handleEditSave = async (itemId: string) => {
    if (!user || !editingText.trim()) return;
    let dateValue: Date | null = null;
    if (editingDate) { try { const [year, month, day] = editingDate.split('-').map(Number); dateValue = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); if (isNaN(dateValue.getTime())) dateValue = null; } catch { dateValue = null; }}
    try {
        const dataToUpdate = { [titleField]: editingText, dueDate: dateValue, priority: editingPriority };
        await updateItem(collectionName, itemId, dataToUpdate);
      setEditingItemId(null);
    } catch (error) { console.error(`Error updating ${collectionName.slice(0, -1)}:`, error); alert(`Failed to update ${collectionName.slice(0, -1)}.`); }
  };
  const handleDelete = async (itemId: string) => {
    if (!user) return; const itemType = collectionName.slice(0, -1);
    if (!window.confirm(`Are you sure you want to delete this ${itemType}?`)) return;
    try {
      await deleteItem(collectionName, itemId);
       setSmartInsights(prev => prev.filter(i => i.relatedItemId !== itemId));
       if (editingItemId === itemId) { setEditingItemId(null); }
    } catch (error) { console.error(`Error deleting ${itemType}:`, error); alert(`Failed to delete ${itemType}.`); }
  };

  // ---------------------
  // 10. CUSTOM TIMERS (Unchanged)
  // ---------------------
  const [runningTimers, setRunningTimers] = useState<{ [id: string]: { isRunning: boolean; timeLeft: number; intervalRef: NodeJS.Timer | null; audio?: HTMLAudioElement | null; finished?: boolean; }; }>({});
  const handleAddCustomTimer = async () => {
    if (!user) return; try { const name = prompt("Enter timer name:", "Focus Block"); if (!name || !name.trim()) return; let durationMinutesStr = prompt("Enter duration in minutes:", "25"); if (durationMinutesStr === null) return; const durationMinutes = parseInt(durationMinutesStr, 10); if (isNaN(durationMinutes) || durationMinutes <= 0) { alert("Invalid duration."); return; } await addCustomTimer(name.trim(), durationMinutes * 60, user.uid); } catch (error) { console.error("Error adding custom timer:", error); alert("Failed to add custom timer."); }
  };
   useEffect(() => {
        setRunningTimers(prev => {
            const nextState: typeof prev = {};
            customTimers.forEach(timer => {
                 const sourceTime = timer.data.time;
                 if (prev[timer.id]) { const localState = prev[timer.id]; nextState[timer.id] = { ...localState, timeLeft: localState.isRunning ? localState.timeLeft : (sourceTime !== localState.timeLeft && !localState.finished) ? sourceTime : localState.timeLeft, finished: localState.isRunning ? localState.finished : (sourceTime > 0 ? false : localState.finished) };
                 } else { nextState[timer.id] = { isRunning: false, timeLeft: sourceTime, intervalRef: null, finished: sourceTime <= 0 }; }
            });
             Object.keys(prev).forEach(id => { if (!nextState[id]) { const timerState = prev[id]; if (timerState.intervalRef) { clearInterval(timerState.intervalRef); } if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; }}});
            return nextState;
        });
    }, [customTimers]);
  const formatCustomTime = (timeInSeconds: number): string => { if (timeInSeconds < 0) timeInSeconds = 0; const hours = Math.floor(timeInSeconds / 3600); const remainder = timeInSeconds % 3600; const mins = Math.floor(remainder / 60); const secs = remainder % 60; if (hours > 0) { return `${hours.toString()}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; } else { return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; }};
  const startCustomTimer = (timerId: string) => {
    setRunningTimers((prev) => {
        const timerState = prev[timerId]; if (!timerState || timerState.isRunning || timerState.timeLeft <= 0) return prev;
        const newState = { ...prev }; const newTimerState = { ...timerState };
        if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; }
        newTimerState.isRunning = true; newTimerState.finished = false;
        const intervalId = setInterval(() => {
            setRunningTimers((currentTimers) => {
                if (!currentTimers[timerId]) { clearInterval(intervalId); return currentTimers; }
                const updatedTimers = { ...currentTimers }; const tState = { ...updatedTimers[timerId] };
                 if (!tState.isRunning && tState.intervalRef) { clearInterval(tState.intervalRef); tState.intervalRef = null; updatedTimers[timerId] = tState; return updatedTimers; }
                 if (tState.timeLeft <= 0 && tState.isRunning) { clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.intervalRef = null; tState.timeLeft = 0; updatedTimers[timerId] = tState; return updatedTimers; }
                if (tState.timeLeft <= 1) {
                    clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.timeLeft = 0; tState.intervalRef = null;
                     if (!tState.audio) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error(`Error playing timer sound for ${timerId}:`, e)); tState.audio = alarmAudio; } catch(e) { console.error("Could not create/play audio:", e)}}
                } else { tState.timeLeft -= 1; }
                updatedTimers[timerId] = tState; return updatedTimers;
            });
        }, 1000);
        newTimerState.intervalRef = intervalId; newState[timerId] = newTimerState; return newState;
    });
  };
  const pauseCustomTimer = (timerId: string) => { setRunningTimers((prev) => { const timerState = prev[timerId]; if (!timerState || !timerState.isRunning) return prev; const newState = { ...prev }; const newTimerState = { ...timerState }; if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); newTimerState.intervalRef = null; } newTimerState.isRunning = false; newState[timerId] = newTimerState; return newState; }); };
  const resetCustomTimer = (timerId: string) => {
    const sourceTimerData = customTimers.find((t) => t.id === timerId)?.data; if (!sourceTimerData) { setRunningTimers(prev => { const { [timerId]: _, ...rest } = prev; return rest; }); return; }
    const defaultTime = sourceTimerData.time;
    setRunningTimers((prev) => {
        const timerState = prev[timerId]; const newState = { ...prev };
        const newTimerState = timerState ? { ...timerState } : { isRunning: false, timeLeft: defaultTime, intervalRef: null, finished: defaultTime <= 0, audio: undefined };
        if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); }
        newTimerState.isRunning = false; newTimerState.timeLeft = defaultTime; newTimerState.intervalRef = null; newTimerState.finished = defaultTime <= 0;
        if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; }
        newState[timerId] = newTimerState; return newState;
    });
  };
  const handleEditTimerClick = (timerId: string, currentName: string, currentTime: number) => { if (runningTimers[timerId]?.isRunning) { pauseCustomTimer(timerId); } setEditingTimerId(timerId); setEditingTimerName(currentName); setEditingTimerMinutes(String(Math.max(1, Math.floor(currentTime / 60)))); };
  const handleEditTimerSave = async (timerId: string) => { if (!editingTimerName.trim()) { alert("Please enter a timer name."); return; }; const minutes = parseInt(editingTimerMinutes, 10); if (isNaN(minutes) || minutes <= 0) { alert("Please enter a valid positive number for minutes."); return; } try { const newTimeSeconds = minutes * 60; await updateCustomTimer(timerId, editingTimerName.trim(), newTimeSeconds); setEditingTimerId(null); } catch (error) { console.error("Error updating timer:", error); alert("Failed to update timer."); }};
  const handleDeleteTimer = async (timerId: string) => { if (!window.confirm("Are you sure you want to delete this timer?")) return; try { setRunningTimers(prev => { const timerState = prev[timerId]; if (timerState) { if (timerState.intervalRef) clearInterval(timerState.intervalRef); if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; }} const { [timerId]: _, ...rest } = prev; return rest; }); await deleteCustomTimer(timerId); } catch (error) { console.error("Error deleting custom timer:", error); alert("Failed to delete timer."); }};

  // ---------------------
  // 11. PROGRESS BARS (Unchanged)
  // ---------------------
  const tasksProgress = useMemo(() => { const totalTasks = tasks.length; if (totalTasks === 0) return 0; const completedTasks = tasks.filter((t) => t.data.completed).length; return Math.round((completedTasks / totalTasks) * 100); }, [tasks]);
  const goalsProgress = useMemo(() => { const totalGoals = goals.length; if (totalGoals === 0) return 0; const completedGoals = goals.filter((g) => g.data.completed).length; return Math.round((completedGoals / totalGoals) * 100); }, [goals]);
  const projectsProgress = useMemo(() => { const totalProjects = projects.length; if (totalProjects === 0) return 0; const completedProjects = projects.filter((p) => p.data.completed).length; return Math.round((completedProjects / totalProjects) * 100); }, [projects]);
  const plansProgress = useMemo(() => { const totalPlans = plans.length; if (totalPlans === 0) return 0; const completedPlans = plans.filter((pl) => pl.data.completed).length; return Math.round((completedPlans / totalPlans) * 100); }, [plans]);

  // ---------------------
  // 12. Smart Insights handlers (Unchanged)
  // ---------------------
  const handleAcceptInsight = (insightId: string) => {
    const insight = smartInsights.find(i => i.id === insightId); if (!insight) return;
    setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: true, rejected: false } : i ));
    if (insight.relatedItemId) { const item = [...tasks, ...goals, ...projects, ...plans].find(i => i.id === insight.relatedItemId); if (item) { const itemType = item.data.task ? 'tasks' : item.data.goal ? 'goals' : item.data.project ? 'projects' : item.data.plan ? 'plans' : null; if (insight.type === 'warning' && insight.text.includes('overdue') && itemType) { if(activeTab !== itemType) { setActiveTab(itemType); } setTimeout(() => handleEditClick(item.id, item.data), 50); }}}
    if (!(insight.type === 'warning' && insight.text.includes('overdue'))) { setTimeout(() => { setSmartInsights(prev => prev.filter(i => i.id !== insightId)); }, 3000); }
  };
  const handleRejectInsight = (insightId: string) => { setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: false, rejected: true } : i )); setTimeout(() => { setSmartInsights(prev => prev.filter(i => i.id !== insightId || i.accepted)); }, 2000); };

  // ---------------------
  // 13. Theme & Style Variables
  // ---------------------
  const containerClass = isIlluminateEnabled ? "bg-slate-50 text-slate-900" : isBlackoutEnabled ? "bg-black text-slate-200" : "bg-slate-900 text-slate-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-slate-900 border border-slate-200/70 shadow-sm" : isBlackoutEnabled ? "bg-slate-900 text-slate-300 border border-slate-700/50 shadow-md shadow-black/20" : "bg-slate-800 text-slate-300 border border-slate-700/50 shadow-lg shadow-black/20";
  const headingClass = isIlluminateEnabled ? "text-slate-800" : "text-slate-100";
  const subheadingClass = isIlluminateEnabled ? "text-slate-600" : "text-slate-400";
  const inputBg = isIlluminateEnabled ? "bg-slate-100 hover:bg-slate-200/50 border-slate-300 focus:border-blue-500 focus:ring-blue-500" : "bg-slate-700 hover:bg-slate-600/50 border-slate-600 focus:border-blue-500 focus:ring-blue-500";
  const iconColor = isIlluminateEnabled ? "text-slate-500 hover:text-slate-700" : "text-slate-400 hover:text-slate-200";
  const interactiveIconColor = isIlluminateEnabled ? "text-slate-600 hover:text-blue-600" : "text-slate-400 hover:text-blue-400"; // For clickable icons like chevron

  const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

  return (
    <div className={`${containerClass} min-h-screen w-full overflow-x-hidden relative font-sans`}>
      <Sidebar
        userName={userName}
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled}
        isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled}
      />

      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'} z-40 p-2.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${isIlluminateEnabled ? 'bg-white border border-slate-300 text-blue-600 hover:bg-slate-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'} ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open TaskMaster AI Chat" aria-label="Open TaskMaster AI Chat">
        <BrainCircuit className="w-5 h-5" />
      </button>

      <main className={`transition-all duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} p-3 sm:p-4 md:p-5 lg:p-6 pt-16 md:pt-6`}>
        {/* Header Row */}
         <div className={`dashboard-header w-full mb-5 sm:mb-6 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-500 ease-out`}>
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 ${headingClass} break-words`}>
              {React.cloneElement(greeting.icon, { className: `w-5 h-5 lg:w-6 lg:h-6 inline-block align-middle mr-1.5 -translate-y-0.5 ${greeting.color ? `text-${greeting.color}-500` : (isIlluminateEnabled ? 'text-slate-600' : 'text-slate-400')}`})}
              {greeting.greeting},{' '}
              <span className="font-semibold">{userName ? userName.split(' ')[0] : '...'}</span>
            </h1>
            <p className={`italic text-xs md:text-sm ${subheadingClass}`}>"{quote.text}" - <span className={isIlluminateEnabled ? "text-purple-600" : "text-purple-400"}>{quote.author}</span></p>
          </header>

        {/* Calendar Card - Enlarged and Prominent */}
        <div className={`${cardClass} rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-100`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className={`text-lg sm:text-xl font-semibold flex items-center ${isIlluminateEnabled ? 'text-blue-700' : 'text-blue-400'}`}>
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    Weekly View
                </h2>
                <div className="flex items-center gap-1">
                    <button onClick={() => { const prevWeek = new Date(currentWeek[0]); prevWeek.setDate(prevWeek.getDate() - 7); setCurrentWeek(getWeekDates(prevWeek)); }} className={`p-1.5 rounded-full ${interactiveIconColor} ${isIlluminateEnabled ? 'hover:bg-slate-200' : 'hover:bg-slate-700'} transition-colors`} title="Previous Week">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => { const nextWeek = new Date(currentWeek[0]); nextWeek.setDate(nextWeek.getDate() + 7); setCurrentWeek(getWeekDates(nextWeek)); }} className={`p-1.5 rounded-full ${interactiveIconColor} ${isIlluminateEnabled ? 'hover:bg-slate-200' : 'hover:bg-slate-700'} transition-colors`} title="Next Week">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {currentWeek.map((date) => {
                    const dateStr = formatDateForComparison(date);
                    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
                    const allItems = [...tasks, ...goals, ...projects, ...plans];
                    const deadlinesOnDate = allItems.filter(item => {
                        if (!item?.data?.dueDate) return false;
                        try { const itemDate = item.data.dueDate.toDate ? item.data.dueDate.toDate() : new Date(item.data.dueDate); return formatDateForComparison(itemDate) === dateStr && !item.data.completed; } catch { return false; }
                    });
                    const hasDeadline = deadlinesOnDate.length > 0;
                    const isToday = dateStr === formatDateForComparison(today);
                    const dayCardBase = `p-2 sm:p-3 rounded-lg flex flex-col items-center justify-start min-h-[80px] sm:min-h-[100px] transition-all duration-200 ease-in-out`;
                    const todayClass = isIlluminateEnabled ? "bg-blue-100 border-blue-400" : "bg-blue-500/20 border-blue-500";
                    const defaultDayClass = isIlluminateEnabled ? "bg-slate-100 hover:bg-slate-200 border-slate-200" : "bg-slate-700/50 hover:bg-slate-700 border-slate-600/50";

                    return (
                        <div key={dateStr} className={`${dayCardBase} border ${isToday ? todayClass : defaultDayClass}`} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
                            <p className={`text-xs sm:text-sm font-medium mb-1 ${isToday ? (isIlluminateEnabled ? 'text-blue-700' : 'text-blue-300') : subheadingClass}`}>{dayName}</p>
                            <p className={`text-lg sm:text-xl font-bold ${isToday ? (isIlluminateEnabled ? 'text-blue-800' : 'text-blue-200') : headingClass}`}>{date.getDate()}</p>
                            {hasDeadline && (
                                <div className={`mt-auto flex items-center justify-center gap-0.5 pt-1 ${isIlluminateEnabled ? (isToday ? 'bg-blue-200' : 'bg-red-100/70') : (isToday ? 'bg-blue-600/30' : 'bg-red-700/30')} px-1 rounded-full`}>
                                    {deadlinesOnDate.slice(0,3).map((_, idx) => ( // Show max 3 dots
                                        <div key={idx} className={`w-1.5 h-1.5 rounded-full ${isIlluminateEnabled ? 'bg-red-500' : 'bg-red-400'}`}></div>
                                    ))}
                                    {deadlinesOnDate.length > 3 && <span className="text-[9px] text-red-500 ml-0.5">+{deadlinesOnDate.length - 3}</span>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* AI Insights Panel */}
        {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length > 0 && (
          <div className={`${cardClass} rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 animate-fadeIn relative overflow-hidden ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-200`}>
            <div className={`absolute inset-0 ${isIlluminateEnabled ? 'bg-gradient-to-r from-blue-50/20 to-purple-50/20' : 'bg-gradient-to-r from-blue-900/10 to-purple-900/10'} pointer-events-none opacity-30`}></div>
            <div className="flex items-center justify-between mb-2 z-10 relative">
              <h2 className={`text-base sm:text-lg font-semibold flex items-center ${isIlluminateEnabled ? 'text-blue-700' : 'text-blue-400'}`}>
                <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 animate-pulse" />
                AI Insights
                <span className={`ml-1.5 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full ${isIlluminateEnabled ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/30 text-blue-300'}`}>
                  {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length} New
                </span>
              </h2>
              <button onClick={() => setShowInsightsPanel(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${ isIlluminateEnabled ? 'hover:bg-slate-200' : 'hover:bg-slate-700' }`} title={showInsightsPanel ? "Hide Insights" : "Show Insights"}>
                 {showInsightsPanel ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
            <div className={`space-y-2 transition-all duration-300 ease-out overflow-hidden z-10 relative ${showInsightsPanel ? 'max-h-96 opacity-100 pt-1' : 'max-h-0 opacity-0'}`}>
                {smartInsights.filter(insight => !insight.accepted && !insight.rejected).map((insight, index) => (
                      <div key={insight.id} className={`p-2 rounded-lg flex items-center justify-between gap-2 animate-slideInRight ${ insight.type === 'warning' ? (isIlluminateEnabled ? 'bg-red-100/80 text-red-800' : 'bg-red-900/40 text-red-300') : insight.type === 'suggestion' ? (isIlluminateEnabled ? 'bg-blue-100/80 text-blue-800' : 'bg-blue-900/40 text-blue-300') : (isIlluminateEnabled ? 'bg-green-100/80 text-green-800' : 'bg-green-900/40 text-green-300')}`} style={{ animationDelay: `${index * 70}ms` }}>
                        <div className="flex items-center gap-1.5 flex-grow overflow-hidden">
                        {insight.type === 'warning' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        {insight.type === 'suggestion' && <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                        {insight.type === 'achievement' && <Award className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        <p className="text-xs sm:text-sm flex-grow truncate" title={insight.text}>{insight.text}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleAcceptInsight(insight.id)} className="p-1 rounded-full bg-green-500/80 text-white hover:bg-green-600 transition-colors" title="Accept"><ThumbsUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleRejectInsight(insight.id)} className="p-1 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors" title="Reject"><ThumbsDown className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* Smart Overview Card */}
        <div className={`${cardClass} rounded-xl p-3 sm:p-4 relative min-h-[80px] transition-all duration-300 ease-out animate-fadeIn mb-5 sm:mb-6 ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-300`}>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h2 className={`text-base sm:text-lg font-semibold mr-1 flex items-center ${isIlluminateEnabled ? 'text-blue-700' : 'text-blue-400'}`}>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 text-yellow-400 animate-pulse" /> Smart Overview
            </h2>
             {userTier === 'pro' && (<span className={`text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isIlluminateEnabled ? 'bg-teal-100 text-teal-700' : 'bg-teal-500/30 text-teal-300'}`}>PRO</span>)}
             {userTier === 'premium' && (<span className={`text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isIlluminateEnabled ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/30 text-amber-300'}`}>PREMIUM</span>)}
          </div>
          {userTier === 'loading' ? (<div className="animate-pulse space-y-1.5 pt-1"><div className={`h-3 rounded-full w-1/2 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-700'}`}></div></div>)
          : userTier === 'basic' ? (
            <div className={`text-xs italic flex items-center justify-start gap-1.5 py-2 ${isIlluminateEnabled ? 'text-slate-600' : 'text-slate-400'}`}>
                <Info className="w-3.5 h-3.5" />
                <span>Smart Overview is a Pro/Premium feature.</span>
                <Link to="/pricing" className={`font-medium ml-1 ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline not-italic`}>Upgrade now</Link>
            </div>
          ) : overviewLoading ? (
             <div className="space-y-1.5 animate-pulse pt-1"><div className={`h-3 rounded-full w-11/12 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-700'}`}></div><div className={`h-3 rounded-full w-3/4 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-700'}`}></div></div>
          ) : (
            <>
               <div className={`text-xs sm:text-sm prose-sm max-w-none animate-fadeIn ${isIlluminateEnabled ? 'text-slate-700' : 'text-slate-300'} leading-snug ${smartOverview.includes('unavailable') || smartOverview.includes('failed') || smartOverview.includes('limit') ? (isIlluminateEnabled ? 'text-yellow-700 italic' : 'text-yellow-500 italic') : ''}`}>
                 {smartOverview || "Add items for an overview."}
               </div>
               {smartOverview && !smartOverview.includes('unavailable') && !smartOverview.includes('failed') && !smartOverview.includes('limit') && !smartOverview.includes('No pending items') && (
                  <div className={`mt-1.5 text-left text-[10px] ${isIlluminateEnabled ? 'text-slate-500' : 'text-slate-500/80'}`}>AI responses may be inaccurate. Verify critical info.</div>
               )}
            </>
          )}
        </div>

        {/* Main Content Grid - Reordered for Productivity Focus */}
        <div className={`grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-400`}>
           {/* Primary Column: Tasks & Items Management (Takes more space) */}
           <div className="xl:col-span-2 flex flex-col gap-5 sm:gap-6">
             <div className={`${cardClass} rounded-xl p-3 sm:p-4 md:p-5 transition-all duration-300`}>
               <div className="overflow-x-auto no-scrollbar mb-4">
                 <div className={`flex space-x-1.5 w-full border-b pb-2 ${isIlluminateEnabled ? 'border-slate-200' : 'border-slate-700'}`}>
                   {["tasks", "goals", "projects", "plans"].map((tab) => (
                     <button key={tab} className={`px-3 py-1.5 rounded-lg transition-all duration-200 transform hover:scale-[1.03] text-xs sm:text-sm font-medium flex items-center whitespace-nowrap ${activeTab === tab ? (isIlluminateEnabled ? "bg-blue-600 text-white shadow-sm" : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm") : (isIlluminateEnabled ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}`} onClick={() => handleTabChange(tab as "tasks" | "goals" | "projects" | "plans")}>
                       {tab === "tasks" && <Clipboard className="w-4 h-4 mr-1.5" />}
                       {tab === "goals" && <Target className="w-4 h-4 mr-1.5" />}
                       {tab === "projects" && <Layers className="w-4 h-4 mr-1.5" />}
                       {tab === "plans" && <Rocket className="w-4 h-4 mr-1.5" />}
                       {tab.charAt(0).toUpperCase() + tab.slice(1)}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex flex-col md:flex-row gap-2 mb-4">
                 <input type="text" className={`flex-grow ${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3.5 py-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500`} placeholder={`Add a new ${activeTab.slice(0, -1)}...`} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                 <div className="flex gap-2 flex-shrink-0">
                   <input type="date" className={`${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${isIlluminateEnabled ? 'text-slate-700' : 'text-slate-300'}`} value={newItemDate} onChange={(e) => setNewItemDate(e.target.value)} title="Set due date" style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} />
                   <div className="relative">
                      <select className={`${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${isIlluminateEnabled ? 'text-slate-700' : 'text-slate-300'}`} value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value as 'high' | 'medium' | 'low')} title="Set priority">
                        <option value="high">High 🔥</option><option value="medium">Medium</option><option value="low">Low 🧊</option>
                      </select>
                      <ChevronDown className={`w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isIlluminateEnabled ? 'text-slate-500' : 'text-slate-400'}`} />
                   </div>
                   <button className={`p-2.5 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-100 min-w-[38px] min-h-[38px] ${isIlluminateEnabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-md hover:shadow-purple-500/20'}`} onClick={handleCreate} title={`Add new ${activeTab.slice(0,-1)}`}>
                     <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                 </div>
               </div>
               <ul className="space-y-2 sm:space-y-2.5">
                 {currentItems.length === 0 ? (<li className={`${subheadingClass} text-sm text-center py-8 italic`}>No {activeTab} here yet... Add one above!</li>)
                 : (currentItems.map((item, index) => {
                       const itemId = item.id; const { data } = item; const textValue = data[titleField] || 'Untitled'; const isCompleted = data.completed || false; const isEditing = editingItemId === itemId; const priority = data.priority || calculatePriority(item);
                       let dueDateStr = ''; let overdue = false;
                       if (data.dueDate) { try { const dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); if (!isNaN(dueDateObj.getTime())) { dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const todayDate = new Date(); todayDate.setHours(0,0,0,0); const itemDate = new Date(dueDateObj); itemDate.setHours(0,0,0,0); overdue = itemDate < todayDate && !isCompleted; }} catch {}}
                       return (
                         <li key={item.id} className={`group p-2.5 sm:p-3 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 transition-all duration-150 animate-slideInUp ${isCompleted ? (isIlluminateEnabled ? 'bg-green-100/60 opacity-70' : 'bg-green-900/20 opacity-60') : overdue ? (isIlluminateEnabled ? 'bg-red-100/70' : 'bg-red-900/30') : (isIlluminateEnabled ? 'bg-slate-100 hover:bg-slate-200/70' : 'bg-slate-700/40 hover:bg-slate-700/60')} ${isEditing ? (isIlluminateEnabled ? 'ring-2 ring-purple-400 bg-purple-50/60' : 'ring-2 ring-purple-500 bg-purple-900/30') : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
                           {!isEditing ? (
                             <>
                               <div className="flex items-center gap-2.5 flex-grow overflow-hidden mr-2">
                                 <button onClick={() => handleMarkComplete(itemId)} className={`flex-shrink-0 p-1 rounded-full transition-colors duration-150 border-2 ${isCompleted ? (isIlluminateEnabled ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600') : (isIlluminateEnabled ? 'border-slate-400 hover:border-green-500 hover:bg-green-100/50' : 'border-slate-500 hover:border-green-500 hover:bg-green-900/30')} `} title={isCompleted ? "Mark Pending" : "Mark Complete"}>
                                   <CheckCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${isCompleted ? 'text-white' : 'text-transparent'}`} />
                                 </button>
                                 <span className={`font-medium text-sm sm:text-base truncate ${isCompleted ? 'line-through text-slate-500 dark:text-slate-600' : (isIlluminateEnabled ? 'text-slate-800' : 'text-slate-100')}`} title={textValue}>{textValue}</span>
                                 <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="flex-shrink-0 ml-auto sm:ml-2" />
                                 {dueDateStr && (<span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 hidden sm:flex items-center ${overdue ? (isIlluminateEnabled ? 'bg-red-200 text-red-700' : 'bg-red-800/60 text-red-300') : (isIlluminateEnabled ? 'bg-slate-200 text-slate-600' : 'bg-slate-600/80 text-slate-300')}`}><Calendar className="w-3 h-3 mr-1" />{dueDateStr}</span>)}
                               </div>
                               <div className="flex gap-1.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                 <button className={`p-2 rounded-lg ${isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'} transition-colors`} onClick={() => handleEditClick(itemId, data)} title="Edit"><Edit className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                                 <button className={`p-2 rounded-lg ${isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'} transition-colors`} onClick={() => handleDelete(itemId)} title="Delete"><Trash className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                               </div>
                             </>
                           ) : (
                              <>
                                 <div className="flex flex-col sm:flex-row gap-2 w-full">
                                   <input className={`flex-grow ${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(itemId); if (e.key === 'Escape') setEditingItemId(null); }}/>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <input type="date" className={`${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${isIlluminateEnabled ? 'text-slate-700' : 'text-slate-300'}`} value={editingDate} onChange={(e) => setEditingDate(e.target.value)} style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }}/>
                                        <div className="relative">
                                            <select className={`${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg pl-3 pr-8 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${isIlluminateEnabled ? 'text-slate-700' : 'text-slate-300'}`} value={editingPriority} onChange={(e) => setEditingPriority(e.target.value as 'high' | 'medium' | 'low')}>
                                                <option value="high">High 🔥</option><option value="medium">Medium</option><option value="low">Low 🧊</option>
                                            </select>
                                             <ChevronDown className={`w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isIlluminateEnabled ? 'text-slate-500' : 'text-slate-400'}`} />
                                        </div>
                                    </div>
                                 </div>
                                 <div className="flex gap-1.5 flex-shrink-0 mt-2 sm:mt-0 self-end sm:self-center">
                                   <button className="bg-green-500 hover:bg-green-600 px-3.5 py-1.5 rounded-lg text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditSave(itemId)}>Save</button>
                                   <button className={`${isIlluminateEnabled ? 'bg-slate-500 hover:bg-slate-600' : 'bg-slate-600 hover:bg-slate-500'} px-3.5 py-1.5 rounded-lg text-white transition-colors text-xs sm:text-sm`} onClick={() => setEditingItemId(null)}>Cancel</button>
                                 </div>
                              </>
                           )}
                         </li>
                       );
                     }))}
               </ul>
             </div>
           </div>

           {/* Secondary Column: Productivity Tools */}
           <div className="xl:col-span-1 flex flex-col gap-5 sm:gap-6">
             {/* Productivity Card */}
             <div className={`${cardClass} rounded-xl p-3 sm:p-4 md:p-5 transition-all duration-300`}>
                <div className="flex justify-between items-center mb-3">
                 <h2 className={`text-base sm:text-lg font-semibold ${isIlluminateEnabled ? 'text-purple-700' : 'text-purple-400'} flex items-center`}>
                   <TrendingUp className="w-5 h-5 mr-1.5" /> Productivity
                 </h2>
                 <button onClick={() => setShowAnalytics(prev => !prev)} className={`p-1.5 rounded-lg transition-colors ${iconColor} ${ isIlluminateEnabled ? 'hover:bg-slate-200' : 'hover:bg-slate-700' } flex items-center gap-1 text-xs`} title={showAnalytics ? "Show Basic Progress" : "Show Analytics"}>
                    {showAnalytics ? <BarChart className="w-4 h-4" /> : <PieChart className="w-4 h-4" />}
                    <span>{showAnalytics ? 'Basic' : 'Analytics'}</span>
                  </button>
               </div>
               {showAnalytics ? (<div className="animate-fadeIn"><TaskAnalytics tasks={tasks} goals={goals} projects={projects} plans={plans} isIlluminateEnabled={isIlluminateEnabled}/></div>)
               : (<div className="space-y-3 animate-fadeIn">
                    {(tasks.length > 0 || goals.length > 0 || projects.length > 0 || plans.length > 0) ? (<>
                           {tasks.length > 0 && (<div><div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Clipboard className={`w-3.5 h-3.5 mr-1 ${isIlluminateEnabled ? 'text-slate-500':'text-slate-400'}`} /> Tasks</p><p className={`${isIlluminateEnabled ? 'text-green-600' : 'text-green-400'} font-semibold text-xs`}>{tasks.filter(t => t.data.completed).length}/{tasks.length} ({tasksProgress}%)</p></div><div className={`w-full h-2 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${tasksProgress}%` }} /></div></div>)}
                            {goals.length > 0 && (<div><div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Target className={`w-3.5 h-3.5 mr-1 ${isIlluminateEnabled ? 'text-slate-500':'text-slate-400'}`} /> Goals</p><p className={`${isIlluminateEnabled ? 'text-pink-600':'text-pink-400'} font-semibold text-xs`}>{goals.filter(g => g.data.completed).length}/{goals.length} ({goalsProgress}%)</p></div><div className={`w-full h-2 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${goalsProgress}%` }} /></div></div>)}
                             {projects.length > 0 && (<div><div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Layers className={`w-3.5 h-3.5 mr-1 ${isIlluminateEnabled ? 'text-slate-500':'text-slate-400'}`} /> Projects</p><p className={`${isIlluminateEnabled ? 'text-blue-600':'text-blue-400'} font-semibold text-xs`}>{projects.filter(p => p.data.completed).length}/{projects.length} ({projectsProgress}%)</p></div><div className={`w-full h-2 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${projectsProgress}%` }} /></div></div>)}
                             {plans.length > 0 && (<div><div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Rocket className={`w-3.5 h-3.5 mr-1 ${isIlluminateEnabled ? 'text-slate-500':'text-slate-400'}`} /> Plans</p><p className={`${isIlluminateEnabled ? 'text-yellow-600':'text-yellow-400'} font-semibold text-xs`}>{plans.filter(p => p.data.completed).length}/{plans.length} ({plansProgress}%)</p></div><div className={`w-full h-2 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${plansProgress}%` }} /></div></div>)}
                         </>)
                     : (<p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}><Lightbulb className="w-4 h-4 mr-1.5 text-yellow-400" /> Add items to track your progress.</p>)}
                 </div>)}
             </div>

             {/* Pomodoro Timer Card */}
             <div className={`${cardClass} rounded-xl p-3 sm:p-4 md:p-5 transition-all duration-300`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-base sm:text-lg font-semibold ${headingClass} flex items-center`}><Clock className="w-4 h-4 mr-1.5" /> Pomodoro</h2>
                  <button className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 text-xs sm:text-sm transition-all duration-150 transform hover:scale-105 active:scale-100 ${isIlluminateEnabled ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-md hover:shadow-purple-500/10'}`} onClick={handleAddCustomTimer} title="Add a new custom timer"><PlusCircle className="w-3.5 h-3.5" /> New Timer</button>
                </div>
                <div className={`text-4xl sm:text-5xl font-bold mb-3 text-center tabular-nums tracking-tight bg-clip-text text-transparent ${isIlluminateEnabled ? 'bg-gradient-to-r from-blue-600 to-purple-700' : 'bg-gradient-to-r from-blue-400 to-purple-500'} ${pomodoroRunning ? 'animate-pulse' : ''}`}>{formatPomodoroTime(pomodoroTimeLeft)}</div>
                <div className="flex justify-center gap-2">
                  <button className={`px-3 py-1.5 rounded-lg font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning || pomodoroFinished ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-md hover:shadow-green-500/10'}`} onClick={handlePomodoroStart} disabled={pomodoroRunning || pomodoroFinished} title="Start Timer">Start</button>
                  <button className={`px-3 py-1.5 rounded-lg font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${!pomodoroRunning ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:shadow-md hover:shadow-yellow-500/10'}`} onClick={handlePomodoroPause} disabled={!pomodoroRunning} title="Pause Timer">Pause</button>
                  <button className={`px-3 py-1.5 rounded-lg font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-md hover:shadow-red-500/10'}`} onClick={handlePomodoroReset} disabled={pomodoroRunning} title="Reset Timer">Reset</button>
                </div>
                {pomodoroFinished && (<p className="text-center text-xs text-red-500 mt-2 animate-bounce font-medium">Time's up!</p>)}
              </div>

             {/* Custom Timers List */}
             {customTimers.length > 0 && (
                <div className={`${cardClass} rounded-xl p-3 sm:p-4 md:p-5 transition-all duration-300`}>
                  <h2 className={`text-base sm:text-lg font-semibold mb-3 ${headingClass} flex items-center`}><TimerIcon className="w-4 h-4 mr-1.5" /> Timers</h2>
                  <ul className="space-y-2">
                    {customTimers.map((timer, index) => {
                            const timerId = timer.id; const runningState = runningTimers[timerId]; const timeLeft = runningState ? runningState.timeLeft : timer.data.time; const isRunning = runningState ? runningState.isRunning : false; const isFinished = runningState ? (runningState.finished ?? timeLeft <= 0) : timer.data.time <= 0; const isEditing = editingTimerId === timerId;
                            let itemBgClass = isIlluminateEnabled ? 'bg-slate-100/80' : 'bg-slate-700/40';
                            if (isFinished && !isEditing) itemBgClass = isIlluminateEnabled ? 'bg-yellow-100/70 opacity-80' : 'bg-yellow-900/30 opacity-70';
                            if (isEditing) itemBgClass = isIlluminateEnabled ? 'bg-purple-100/50 ring-1 ring-purple-400' : 'bg-purple-900/20 ring-1 ring-purple-500';
                            return (
                            <li key={timerId} className={`p-2 sm:p-2.5 rounded-lg transition-all duration-150 animate-slideInUp ${itemBgClass}`} style={{ animationDelay: `${index * 60}ms` }}>
                                <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3">
                                {isEditing ? ( <> <div className="flex flex-col sm:flex-row gap-1.5 w-full"> <input type="text" className={`flex-grow ${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingTimerName} onChange={(e) => setEditingTimerName(e.target.value)} placeholder="Timer name" autoFocus /> <input type="number" className={`w-20 ${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-lg px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none`} value={editingTimerMinutes} onChange={(e) => setEditingTimerMinutes(e.target.value)} placeholder="Min" min="1" onKeyDown={(e) => e.key === 'Enter' && handleEditTimerSave(timerId)} /> </div> <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center"> <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-lg text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditTimerSave(timerId)}> Save </button> <button className={`${isIlluminateEnabled ? 'bg-slate-500 hover:bg-slate-600':'bg-slate-600 hover:bg-slate-500'} px-3 py-1 rounded-lg text-white transition-colors text-xs sm:text-sm`} onClick={() => setEditingTimerId(null)}> Cancel </button> </div> </>)
                                : ( <> <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2"> <span className="font-medium text-sm sm:text-base truncate" title={timer.data.name}>{timer.data.name}</span> <span className={`text-xl sm:text-2xl font-semibold tabular-nums tracking-tight ${isIlluminateEnabled ? 'text-purple-700' : 'text-purple-400'} ${isRunning ? 'animate-pulse' : ''}`}>{formatCustomTime(timeLeft)}</span> </div> <div className="flex gap-1 sm:gap-1.5 flex-shrink-0"> <button className={`p-1.5 rounded-full text-white transition-colors ${isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : isFinished ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`} onClick={() => isRunning ? pauseCustomTimer(timerId) : startCustomTimer(timerId)} title={isRunning ? "Pause" : isFinished ? "Finished" : "Start"} disabled={isFinished && !isRunning}><{isRunning ? Pause : Play} className={`w-4 h-4 ${isFinished && !isRunning ? 'opacity-50' : ''}`} /></button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'bg-slate-400/50 text-slate-600/50 cursor-not-allowed' : isIlluminateEnabled ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`} onClick={() => resetCustomTimer(timerId)} title="Reset" disabled={isRunning}><RotateCcw className="w-4 h-4" /></button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-slate-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'}`} onClick={() => handleEditTimerClick(timerId, timer.data.name, timer.data.time)} title="Edit" disabled={isRunning}><Edit className={`w-4 h-4 ${isRunning ? 'opacity-50' : ''}`} /></button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-slate-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'}`} onClick={() => handleDeleteTimer(timerId)} title="Delete" disabled={isRunning}><Trash className={`w-4 h-4 ${isRunning ? 'opacity-50' : ''}`} /></button> </div> </> )}
                                </div>
                                {isFinished && !isEditing && (<p className={`text-center text-[10px] mt-1 ${isIlluminateEnabled ? 'text-yellow-600':'text-yellow-500'}`}>Timer finished!</p>)}
                            </li>);
                    })}
                  </ul>
                </div>
             )}
           </div>
         </div>
      </main>

      {/* AI Chat Sidebar */}
      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${isIlluminateEnabled ? 'border-slate-200' : 'border-slate-700'}`} role="complementary" aria-labelledby="ai-sidebar-title">
        <div className={`p-3 sm:p-4 border-b ${isIlluminateEnabled ? 'border-slate-200 bg-slate-100/80' : 'border-slate-700 bg-slate-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
          <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${isIlluminateEnabled ? 'text-blue-700' : 'text-blue-400'}`}><BrainCircuit className="w-5 h-5" /> Chat with TaskMaster</h3>
          <button onClick={() => setIsAiSidebarOpen(false)} className={`${isIlluminateEnabled ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'} p-1 rounded-full transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatEndRef}>
          {chatHistory.map((message, index) => (
            <div key={message.id || index} className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' } animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }}>
              <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-slate-100 text-slate-800 border border-slate-200/80' : 'bg-slate-700/80 text-slate-200 border border-slate-600/50')}`}>
                 {message.content && message.content !== "..." && (<ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />, ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, li: ({node, ...props}) => <li className="mb-0.5" {...props} />, a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />, code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); }, }}>{message.content}</ReactMarkdown>)}
                 {message.content === "..." && isChatLoading && index === chatHistory.length - 1 && (<div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-60"></div></div>)}
                {message.timer && (<div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-slate-800/60 border border-slate-600/50'}`}><TimerIcon className={`w-4 h-4 flex-shrink-0 ${isIlluminateEnabled ? 'text-blue-700':'text-blue-400'}`} /><Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div>)}
                {message.flashcard && (<div className="mt-1.5"><FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled}/></div>)}
                {message.question && (<div className="mt-1.5"><FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled}/></div>)}
              </div>
            </div>
          ))}
          {isChatLoading && chatHistory[chatHistory.length - 1]?.content !== "..." && (<div className="flex justify-start animate-fadeIn"><div className={`${ isIlluminateEnabled ? 'bg-slate-100 border border-slate-200/80' : 'bg-slate-700/80 border border-slate-600/50' } rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm`}><div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></div></div></div></div>)}
        </div>
         <div className={`px-2 sm:px-3 pt-1 border-t ${isIlluminateEnabled ? 'border-slate-200 bg-slate-100/80' : 'border-slate-700 bg-slate-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm`}>
             {userTier !== 'premium' && userTier !== 'loading' && (
                 <div className="pb-1.5 text-xs text-center">
                    <span className={isIlluminateEnabled ? 'text-slate-600' : 'text-slate-400'}>Messages this month: {chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit}</span>
                    {isChatLimitReached && (<span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>)}
                         {!isChatLimitReached && (userTier === 'basic' || userTier === 'pro') && (
                              <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}><Crown className="w-3 h-3 inline mr-0.5"/>Upgrade</Link>
                         )}
                     </div>
                 )}
            <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2">
                <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={isChatLimitReached ? "Monthly limit reached..." : "Ask TaskMaster AI..."} className={`flex-1 ${inputBg} border ${isIlluminateEnabled ? 'border-slate-300' : 'border-slate-600'} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 ${isChatLimitReached ? 'cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || userTier === 'loading'} aria-label="Chat input"/>
                <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatLimitReached || userTier === 'loading'} className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached ? 'cursor-not-allowed' : ''} ${isIlluminateEnabled ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`} title="Send Message" aria-label="Send chat message">
                    {isChatLoading ? (<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>) : (<Send className="w-4 h-4" />)}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
