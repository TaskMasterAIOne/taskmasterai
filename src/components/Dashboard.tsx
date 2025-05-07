/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play, Pause, PlusCircle, Edit, Trash, Sparkles, CheckCircle, MessageCircle, Crown, RotateCcw, Square, X, TimerIcon, Send, ChevronLeft, ChevronRight, Moon, Sun, Star, Calendar, Clock, MoreHorizontal, ArrowUpRight, Bookmark, BookOpen, Lightbulb, Flame, Award, TrendingUp, Rocket, Target, Layers, Clipboard, AlertCircle, ThumbsUp, ThumbsDown, BrainCircuit, ArrowRight, Flag, Bell, Filter, Tag, BarChart, PieChart, ChevronDown
} from 'lucide-react';
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
  // addCustomTimer, // REMOVED as per new code's intention
  onCustomTimersSnapshot, // This was present in new code, but customTimers state was removed. If custom timers are fully removed, this should go. Keeping for now if other parts rely on it.
  updateItem,
  deleteItem,
  markItemComplete,
  // updateCustomTimer, // REMOVED
  // deleteCustomTimer, // REMOVED
  hfApiKey,
  geminiApiKey,
} from '../lib/dashboard-firebase';

import {
    UserTier,
    getUserTier,
    getCurrentMonthUserChatUsage,
    incrementUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';

import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { getCurrentUser } from '../lib/settings-firebase';
import { SmartInsight as SmartInsightComponent } from './SmartInsight';
import { PriorityBadge } from './PriorityBadge';
import { TaskAnalytics } from './TaskAnalytics';


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
            } catch (parseError) {}
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
                }
                else if (parsedJson.error?.message) return `Error: ${parsedJson.error.message}`;
                else if (parsedJson.candidates?.[0]?.finishReason && parsedJson.candidates?.[0]?.finishReason !== 'STOP') {
                    return `Error: Generation stopped (${parsedJson.candidates[0].finishReason})`;
                }
                else extractedText = "";
            } catch (e) {
                extractedText = "";
            }
        } else {
            extractedText = "";
        }
        return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return "";
    }
};

// Helper function to format date as YYYY-MM-DD
const formatDateForComparison = (date: Date): string => {
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().split('T')[0];
};


const calculatePriority = (item: any): 'high' | 'medium' | 'low' => {
  if (item.data.priority) return item.data.priority;
  if (!item.data.dueDate) return 'low';
  let dueDate: Date | null = null;
  if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate();
  else if (item.data.dueDate instanceof Date) dueDate = item.data.dueDate;
  else if (typeof item.data.dueDate === 'string' || typeof item.data.dueDate === 'number') {
      try {
          dueDate = new Date(item.data.dueDate);
           if (isNaN(dueDate.getTime())) dueDate = null;
      } catch (e) { dueDate = null; }
  }
  if (!dueDate) return 'low';
  const now = new Date();
  // Compare based on date part only by setting time to 00:00:00 for both
  const dueDateNormalized = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = dueDateNormalized.getTime() - nowDateNormalized.getTime();
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

  useEffect(() => localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)), [isSidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled));
    document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled);
  }, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)), [isSidebarBlackoutEnabled]);
  useEffect(() => {
    localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled));
    document.body.classList.toggle('illuminate-mode', isIlluminateEnabled);
    if (isIlluminateEnabled) document.body.classList.remove('blackout-mode');
    else if (isBlackoutEnabled) document.body.classList.add('blackout-mode');
  }, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)), [isSidebarIlluminateEnabled]);

  useEffect(() => {
    const checkAuth = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser) navigate('/login');
        else updateDashboardLastSeen(currentUser.uid).catch(err => console.warn("Failed to update last seen:", err));
    };
    checkAuth();
  }, [navigate]);

  const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const [currentDisplayMonth, setCurrentDisplayMonth] = useState(new Date());
  const today = new Date();

  interface TimerMessage { type: 'timer'; duration: number; id: string; }
  interface FlashcardData { id: string; question: string; answer: string; topic: string; }
  interface QuestionData { id: string; question: string; options: string[]; correctAnswer: number; explanation: string; }
  interface FlashcardMessage { type: 'flashcard'; data: FlashcardData[]; }
  interface QuestionMessage { type: 'question'; data: QuestionData[]; }
  interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; timer?: TimerMessage; flashcard?: FlashcardMessage; question?: QuestionMessage; error?: boolean; }

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

  useEffect(() => {
    if (chatEndRef.current && isAiSidebarOpen) requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }, [chatHistory, isAiSidebarOpen]);

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
    activeItems.forEach(item => {
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
    let limitReached = false;
    let currentLimit = getChatLimitForTier(userTier);

    if (userTier !== 'premium') {
        let currentCount = chatCount;
        if (chatMonth !== currentMonthYear) {
            currentCount = 0;
            setChatCount(0);
            setChatMonth(currentMonthYear);
            setIsChatLimitReached(false);
            limitReached = false;
        } else {
            limitReached = currentCount >= currentLimit;
            setIsChatLimitReached(limitReached);
        }
    }

    if (limitReached) {
          setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${currentLimit} chat message limit for this month. Upgrade for more interactions!`, error: true }]);
          setChatMessage('');
          return;
    }

    const currentMessage = chatMessage;
    setChatMessage('');
    const timerDuration = parseTimerRequest(currentMessage);
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    if (userTier !== 'premium' && user?.uid) {
        try {
            await incrementUserChatUsage(user.uid);
            const newLocalCount = chatCount + 1;
            setChatCount(newLocalCount);
            setIsChatLimitReached(newLocalCount >= currentLimit);
        } catch (err) {
            console.error("Failed to increment chat usage in Firestore:", err);
            setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]);
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
    const prompt = `[CONTEXT]\nUser's Name: ${userName}\nCurrent Date: ${currentDateTime.date}\nCurrent Time: ${currentDateTime.time}\nUser's Current Items:\n${itemsText}\n[CONVERSATION HISTORY (Last few turns)]\n${conversationHistory}\n[NEW USER MESSAGE]\n${userName}: ${currentMessage}\nYou are TaskMaster, a friendly and versatile AI productivity assistant. Engage in casual conversation, provide productivity advice, and discuss ${userName}'s items only when explicitly asked by ${userName}. Guidelines: 1. General Conversation: Respond in a friendly, natural tone. Do not include internal instructions or meta commentary. Only reference items if asked. 2. Educational Content (JSON): If requested, provide exactly one JSON object (flashcard or question type) wrapped in \`\`\`json ... \`\`\`. The JSON must be valid and include multiple items in its "data" array. Do not include JSON unless explicitly requested. 3. Response Structure: Direct response, no extraneous openings. Do not mix JSON with regular text. Follow instructions strictly.`;
    const assistantMsgId = `assistant-${Date.now()}`;
    setChatHistory(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: "..." }]);
    let accumulatedStreamedText = "";

    try {
      const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }] })};
      let finalRawResponseText = "";
      await streamResponse(geminiEndpoint, geminiOptions, (rawChunkAccumulated) => {
          accumulatedStreamedText = extractCandidateText(rawChunkAccumulated);
          if (accumulatedStreamedText) setChatHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: accumulatedStreamedText || "..." } : msg));
          finalRawResponseText = rawChunkAccumulated;
      });

      setChatHistory(prev => prev.map(msg => {
          if (msg.id === assistantMsgId) {
              let finalExtractedAssistantText = extractCandidateText(finalRawResponseText);
              let parsedJson: any = null;
              let jsonType: 'flashcard' | 'question' | null = null;
              const finalJsonMatch = finalRawResponseText.match(/```json\s*([\s\S]*?)\s*```/);
              if (finalJsonMatch && finalJsonMatch[1]) {
                  try {
                      parsedJson = JSON.parse(finalJsonMatch[1].trim());
                       if ((parsedJson.type === 'flashcard' || parsedJson.type === 'question') && Array.isArray(parsedJson.data) && parsedJson.data.length > 0) {
                           finalExtractedAssistantText = finalExtractedAssistantText.replace(finalJsonMatch[0], '').trim();
                           jsonType = parsedJson.type;
                       } else parsedJson = null;
                  } catch (e) { parsedJson = null; }
              }
              if (!finalExtractedAssistantText && finalRawResponseText) {
                  finalExtractedAssistantText = finalRawResponseText.replace(/^data:\s*/gm, '').replace(/```json[\s\S]*?```/g, '').trim();
                  if (finalExtractedAssistantText.startsWith('{')) {
                      try {
                          const parsedFallback = JSON.parse(finalExtractedAssistantText);
                          if (parsedFallback?.error?.message) finalExtractedAssistantText = `Error: ${parsedFallback.error.message}`;
                          else {
                              const fallbackExtracted = extractCandidateText(finalExtractedAssistantText);
                              finalExtractedAssistantText = (fallbackExtracted && !fallbackExtracted.startsWith('Error:')) ? fallbackExtracted : "Error: Unexpected response format.";
                          }
                      } catch { finalExtractedAssistantText = "Error: Could not process response."; }
                  }
              }
              return { ...msg, content: finalExtractedAssistantText || "...", flashcard: jsonType === 'flashcard' ? parsedJson : undefined, question: jsonType === 'question' ? parsedJson : undefined };
          }
          return msg;
      }));
    } catch (err: any) {
      console.error('Chat Submit Error:', err);
      setChatHistory(prev => {
         const errorMsgContent = `Sorry, I encountered an error${err.message ? ': ' + err.message : '.'} Please try again.`;
         let updated = false;
         const updatedHistory = prev.map(msg => {
             if (msg.id === assistantMsgId) { updated = true; return { ...msg, content: errorMsgContent, error: true }; }
             return msg;
         });
         if (!updated) updatedHistory.push({ id: `error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true });
         return updatedHistory;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);

  const [smartInsights, setSmartInsights] = useState<SmartInsight[]>([]);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const insightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedItemsSigForInsights, setDebouncedItemsSigForInsights] = useState("");

  const createItemsSignatureForInsights = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}`).sort().join('|');

  useEffect(() => {
    if (!user) return;
    const currentSig = createItemsSignatureForInsights([tasks, goals, projects, plans]);
    if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current);
    insightTimeoutRef.current = setTimeout(() => setDebouncedItemsSigForInsights(currentSig), 2000);
    return () => { if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current); };
  }, [user, tasks, goals, projects, plans]);

  useEffect(() => {
    if (!user || !debouncedItemsSigForInsights) return;
    const now = new Date();
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(item => !item.data.completed);
    let newInsights: SmartInsight[] = [];
    allActiveItems.forEach(item => {
        if (item.data.dueDate) {
            let dueDate: Date | null = null;
            if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate();
            else try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) dueDate = null; } catch { dueDate = null; }
            if (dueDate) {
                const dueDateNormalized = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                const itemType = item.data.task ? 'task' : item.data.goal ? 'goal' : item.data.project ? 'project' : 'plan';
                const itemName = item.data[itemType] || 'Untitled';
                if (dueDateNormalized < nowNormalized) newInsights.push({ id: `overdue-${item.id}`, text: `"${itemName}" (${itemType}) is overdue. Reschedule or mark complete?`, type: 'warning', relatedItemId: item.id, createdAt: new Date() });
                else {
                    const diffDays = Math.ceil((dueDateNormalized.getTime() - nowNormalized.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 2 && !newInsights.some(ni => ni.relatedItemId === item.id && ni.type === 'warning')) {
                        newInsights.push({ id: `upcoming-${item.id}`, text: `"${itemName}" (${itemType}) is due soon (${diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : 'in ' + diffDays + ' days'}). Plan time for it?`, type: 'suggestion', relatedItemId: item.id, createdAt: new Date() });
                    }
                }
            }
        }
    });
    setSmartInsights(prev => {
        const existingActive = prev.filter(i => !i.accepted && !i.rejected);
        const combined = [...newInsights, ...existingActive];
        const uniqueMap = new Map<string, SmartInsight>();
        combined.forEach(insight => uniqueMap.set(insight.id, insight));
        return Array.from(uniqueMap.values()).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
    });
  }, [user, debouncedItemsSigForInsights]);

  const handleMarkComplete = async (itemId: string) => { if (!user) return; try { await markItemComplete(activeTab, itemId); } catch (error) { console.error("Error marking item as complete:", error); } };
  const handleSetPriority = async (itemId: string, priority: 'high' | 'medium' | 'low') => { if (!user) return; try { await updateItem(activeTab, itemId, { priority }); } catch (error) { console.error("Error updating priority:", error); } };

  useEffect(() => { const interval = setInterval(() => { setGreeting(getTimeBasedGreeting()); setQuote(getRandomQuote()); }, 60000); return () => clearInterval(interval); }, []);

  const [activeTab, setActiveTab] = useState<"tasks" | "goals" | "projects" | "plans">("tasks");
  const [newItemText, setNewItemText] = useState("");
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingPriority, setEditingPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [cardVisible, setCardVisible] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setCardVisible(true), 100); return () => clearTimeout(timer); }, []);

  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
            const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
            let nameToSet = "User";
            if (docSnap.exists() && docSnap.data().name) nameToSet = docSnap.data().name;
            else if (firebaseUser.displayName) nameToSet = firebaseUser.displayName;
            else if (firebaseUser.email) nameToSet = firebaseUser.email.split('@')[0];
            setUserName(nameToSet);
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserName(firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"));
        }
        const resolvedTier = await getUserTier(firebaseUser.uid, firebaseUser.email);
        setUserTier(resolvedTier);
        if (resolvedTier !== 'premium') {
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            try {
                const usageData = await getCurrentMonthUserChatUsage(firebaseUser.uid, currentMonthYear);
                if (usageData) {
                    setChatCount(usageData.count);
                    setChatMonth(usageData.month);
                    setIsChatLimitReached(usageData.count >= getChatLimitForTier(resolvedTier));
                } else {
                    setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false);
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
        setTasks([]); setGoals([]); setProjects([]); setPlans([]);
        setSmartOverview(""); setSmartInsights([]);
        setChatHistory([ { id: 'initial-greet-logout', role: 'assistant', content: "👋 Hi I'm TaskMaster, How can I help you today?" } ]);
        setUserTier('loading'); setChatCount(0); setChatMonth(''); setIsChatLimitReached(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) { setTasks([]); setGoals([]); setProjects([]); setPlans([]); return; };
    const unsubFunctions = [
        onCollectionSnapshot('tasks', user.uid, setTasks),
        onCollectionSnapshot('goals', user.uid, setGoals),
        onCollectionSnapshot('projects', user.uid, setProjects),
        onCollectionSnapshot('plans', user.uid, setPlans),
        // onCustomTimersSnapshot(user.uid, setCustomTimers), // REMOVED Custom Timers logic
    ];
    return () => unsubFunctions.forEach(unsub => { try { unsub(); } catch (e) { console.warn("Error unsubscribing:", e); } });
  }, [user]);


  const [smartOverview, setSmartOverview] = useState<string>("");
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [lastGeneratedDataSig, setLastGeneratedDataSig] = useState<string>("");
  const [lastResponse, setLastResponse] = useState<string>("");
  const overviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedItemsSigForOverview, setDebouncedItemsSigForOverview] = useState("");

  const createItemsSignatureForOverview = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}-${item.data.priority || 'm'}-${item.data.task||item.data.goal||item.data.project||item.data.plan||''}`).sort().join('|');

  useEffect(() => {
    if (!user) return;
    const currentSig = createItemsSignatureForOverview([tasks, goals, projects, plans]);
    if (overviewTimeoutRef.current) clearTimeout(overviewTimeoutRef.current);
    overviewTimeoutRef.current = setTimeout(() => setDebouncedItemsSigForOverview(currentSig), 1500);
    return () => { if (overviewTimeoutRef.current) clearTimeout(overviewTimeoutRef.current); };
  }, [user, tasks, goals, projects, plans]);

  useEffect(() => {
    if (!user || !geminiApiKey || !debouncedItemsSigForOverview || userTier === 'loading' || userTier === 'basic') {
        setSmartOverview(""); setOverviewLoading(userTier === 'loading'); setLastGeneratedDataSig(""); setLastResponse(""); return;
    }
    if (debouncedItemsSigForOverview === lastGeneratedDataSig && !overviewLoading) return;

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
        const formattedData = allActiveItems.length > 0 ? allActiveItems.map(item => {
            if (item.data.task) return formatItem(item, 'task'); if (item.data.goal) return formatItem(item, 'goal'); if (item.data.project) return formatItem(item, 'project'); if (item.data.plan) return formatItem(item, 'plan'); return null;
        }).filter(Boolean).join('\n') : "No pending items.";

        if (formattedData === "No pending items.") {
            setSmartOverview(`No pending items to generate overview from.`); setOverviewLoading(false); setLastResponse(""); return;
        }
        const firstName = userName.split(" ")[0];
        const prompt = `Analyze the following goals, tasks, and plans for user "${firstName}". Synthesize these into an *extremely brief* (1 short sentence, max 60 tokens) actionable insight or guiding suggestion for the user. This overview should identify a key theme, a strategic next step, or an important connection between your items that will help you progress. Address the user directly as "you". Format as plain text. No greetings, no fluff. Items:\n${formattedData}`;
        try {
            const overviewEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
            const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 60, temperature: 0.5 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }] })};
            const response = await fetchWithTimeout(overviewEndpoint, geminiOptions, 20000);
            if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} throw new Error(`Gemini API error (${response.status}): ${errorBody}`); }
            const resultJson = await response.json();
            const rawText = extractCandidateText(JSON.stringify(resultJson));
            const cleanText = rawText.trim();
            if (!cleanText || cleanText.toLowerCase().startsWith("error:") || cleanText.length < 5) throw new Error("Received invalid overview response.");
            if (cleanText !== lastResponse) { setLastResponse(cleanText); setSmartOverview(cleanText); }
            else setSmartOverview(lastResponse);
        } catch (error: any) {
            console.error("Overview generation error:", error);
            let errorMsg = "AI overview currently unavailable.";
            if (error.message.includes('429') || error.message.includes('rate limit')) errorMsg = "Overview limit reached. Try again later.";
            else if (error.message.includes('API key not valid')) errorMsg = "Invalid AI config.";
            else if (error.message.includes('timed out')) errorMsg = "Overview request timed out.";
            else if (error.message.includes("invalid overview response")) errorMsg = "AI failed to generate a valid overview.";
            setSmartOverview(errorMsg); setLastResponse(""); setLastGeneratedDataSig("");
        } finally { setOverviewLoading(false); }
    };
    generateOverview();
  }, [user, userTier, debouncedItemsSigForOverview, userName, geminiApiKey, lastResponse]);

  const handleTabChange = (tabName: "tasks" | "goals" | "projects" | "plans") => { setActiveTab(tabName); setEditingItemId(null); };
  const handleCreate = async () => {
    if (!user || !newItemText.trim()) return;
    let dateValue: Date | null = null;
    if (newItemDate) { try { const [year, month, day] = newItemDate.split('-').map(Number); dateValue = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); if (isNaN(dateValue.getTime())) dateValue = null; } catch { dateValue = null; } }
    const typeField = activeTab.slice(0, -1);
    const itemData = { [typeField]: newItemText, dueDate: dateValue, priority: newItemPriority, createdAt: new Date(), completed: false, userId: user.uid };
    try {
       if (activeTab === "tasks") await createTask(user.uid, itemData.task, itemData.dueDate, itemData.priority);
       else if (activeTab === "goals") await createGoal(user.uid, itemData.goal, itemData.dueDate, itemData.priority);
       else if (activeTab === "projects") await createProject(user.uid, itemData.project, itemData.dueDate, itemData.priority);
       else if (activeTab === "plans") await createPlan(user.uid, itemData.plan, itemData.dueDate, itemData.priority);
      setNewItemText(""); setNewItemDate(""); setNewItemPriority("medium");
    } catch (error) { console.error(`Error creating ${typeField}:`, error); alert(`Failed to create ${typeField}. Please try again.`); }
  };

  let currentItems: Array<{ id: string; data: any }> = [];
  let titleField = "task";
  let collectionName = activeTab;
  if (activeTab === "tasks") { currentItems = tasks; titleField = "task"; }
  else if (activeTab === "goals") { currentItems = goals; titleField = "goal"; }
  else if (activeTab === "projects") { currentItems = projects; titleField = "project"; }
  else if (activeTab === "plans") { currentItems = plans; titleField = "plan"; }

  const handleEditClick = (itemId: string, currentData: any) => {
    setEditingItemId(itemId); setEditingText(currentData[titleField] || "");
    let dateForInput = "";
    if (currentData.dueDate) {
        try {
             const dueDateObj = currentData.dueDate.toDate ? currentData.dueDate.toDate() : new Date(currentData.dueDate);
             if (!isNaN(dueDateObj.getTime())) {
                 dateForInput = formatDateForComparison(dueDateObj); // Use helper
             }
         } catch (e) { console.warn("Error converting date for editing:", e); }
    }
    setEditingDate(dateForInput); setEditingPriority(currentData.priority || 'medium');
  };

  const handleEditSave = async (itemId: string) => {
    if (!user || !editingText.trim()) return;
    let dateValue: Date | null = null;
    if (editingDate) { try { const [year, month, day] = editingDate.split('-').map(Number); dateValue = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); if (isNaN(dateValue.getTime())) dateValue = null; } catch { dateValue = null; } }
    try {
        const dataToUpdate = { [titleField]: editingText, dueDate: dateValue, priority: editingPriority };
        await updateItem(collectionName, itemId, dataToUpdate);
      setEditingItemId(null);
    } catch (error) { console.error(`Error updating ${collectionName.slice(0, -1)}:`, error); alert(`Failed to update ${collectionName.slice(0, -1)}. Please try again.`); }
  };

  const handleDelete = async (itemId: string) => {
    if (!user) return;
    const itemType = collectionName.slice(0, -1);
    if (!window.confirm(`Are you sure you want to delete this ${itemType}? This action cannot be undone.`)) return;
    try {
      await deleteItem(collectionName, itemId);
      setSmartInsights(prev => prev.filter(i => i.relatedItemId !== itemId));
      if (editingItemId === itemId) setEditingItemId(null);
    } catch (error) { console.error(`Error deleting ${itemType}:`, error); alert(`Failed to delete ${itemType}. Please try again.`); }
  };

  const tasksProgress = useMemo(() => tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.data.completed).length / tasks.length) * 100), [tasks]);
  const goalsProgress = useMemo(() => goals.length === 0 ? 0 : Math.round((goals.filter(g => g.data.completed).length / goals.length) * 100), [goals]);
  const projectsProgress = useMemo(() => projects.length === 0 ? 0 : Math.round((projects.filter(p => p.data.completed).length / projects.length) * 100), [projects]);
  const plansProgress = useMemo(() => plans.length === 0 ? 0 : Math.round((plans.filter(pl => pl.data.completed).length / plans.length) * 100), [plans]);

  const handleAcceptInsight = (insightId: string) => {
    const insight = smartInsights.find(i => i.id === insightId); if (!insight) return;
    setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: true, rejected: false } : i));
    if (insight.relatedItemId) {
       const item = [...tasks, ...goals, ...projects, ...plans].find(i => i.id === insight.relatedItemId);
       if (item) {
           const itemType = item.data.task ? 'tasks' : item.data.goal ? 'goals' : item.data.project ? 'projects' : item.data.plan ? 'plans' : null;
           if (insight.type === 'warning' && insight.text.includes('overdue') && itemType) {
                if(activeTab !== itemType) setActiveTab(itemType);
                setTimeout(() => handleEditClick(item.id, item.data), 50);
           }
       }
    }
    if (!(insight.type === 'warning' && insight.text.includes('overdue'))) setTimeout(() => setSmartInsights(prev => prev.filter(i => i.id !== insightId)), 3000);
  };
  const handleRejectInsight = (insightId: string) => {
    setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: false, rejected: true } : i));
    setTimeout(() => setSmartInsights(prev => prev.filter(i => i.id !== insightId || i.accepted)), 2000);
  };

  const containerClass = isIlluminateEnabled
    ? "bg-slate-50 text-gray-900"
    : isBlackoutEnabled
      ? "bg-black text-gray-200"
      : "bg-gray-900 text-gray-200";

  const cardClass = isIlluminateEnabled
    ? "bg-white text-gray-900 border border-gray-200/80 shadow-sm"
    : isBlackoutEnabled
      ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" // Restored old blackout card style
      : "bg-gray-800 text-gray-300 border border-gray-700/60 shadow-lg shadow-black/20";

  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";

  const inputBg = isIlluminateEnabled
    ? "bg-gray-100 hover:bg-gray-200/70 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
    : isBlackoutEnabled
      ? "bg-gray-800 hover:bg-gray-700/80 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500"
      : "bg-gray-700 hover:bg-gray-600/70 border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500";

  const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
  const tabBorderColor = isIlluminateEnabled ? "border-gray-300" : "border-gray-700";

  const illuminateTextBlue = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
  const illuminateTextPurple = isIlluminateEnabled ? "text-purple-600" : "text-purple-400";
  const illuminateTextGreen = isIlluminateEnabled ? "text-green-600" : "text-green-400";
  const illuminateTextPink = isIlluminateEnabled ? "text-pink-600" : "text-pink-400";
  const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-600" : "text-yellow-400";

  const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

    const deadlinesByDate = useMemo(() => {
        const deadlines = new Map<string, { count: number, types: Set<string>, priorities: Set<string> }>();
        const allItems = [...tasks, ...goals, ...projects, ...plans];
        allItems.forEach(item => {
            if (item.data.dueDate && !item.data.completed) {
                let dateObj;
                if (item.data.dueDate.toDate) dateObj = item.data.dueDate.toDate();
                else try { dateObj = new Date(item.data.dueDate); if (isNaN(dateObj.getTime())) return; } catch { return; }
                
                const dateStr = formatDateForComparison(dateObj); // Use helper for consistent local date string
                const itemType = item.data.task ? 'Task' : item.data.goal ? 'Goal' : item.data.project ? 'Project' : 'Plan';
                const priority = calculatePriority(item);

                if (!deadlines.has(dateStr)) {
                    deadlines.set(dateStr, { count: 0, types: new Set(), priorities: new Set() });
                }
                deadlines.get(dateStr)!.count++;
                deadlines.get(dateStr)!.types.add(itemType);
                deadlines.get(dateStr)!.priorities.add(priority);
            }
        });
        return deadlines;
    }, [tasks, goals, projects, plans]);

    const handlePreviousMonth = () => setCurrentDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    const handleCalendarDateClick = (date: Date) => {
        setNewItemDate(formatDateForComparison(date)); // Use helper for YYYY-MM-DD
        // Optional: scroll to add item section or focus input
        const newItemTextInput = document.querySelector('input[placeholder^="Add a new"]');
        if (newItemTextInput instanceof HTMLInputElement) {
            newItemTextInput.focus();
            // Scroll to view if not visible
             if (!isElementInViewport(newItemTextInput)) {
                newItemTextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // Helper to check if element is in viewport
    const isElementInViewport = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    };

    const renderCalendarDays = () => {
        const year = currentDisplayMonth.getFullYear();
        const month = currentDisplayMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysArray = [];

        for (let i = 0; i < firstDayOfMonth; i++) {
            daysArray.push(<div key={`blank-${i}`} className="min-h-[4rem] sm:min-h-[5rem] border border-transparent"></div>); // Use min-h
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = formatDateForComparison(date);
            const isToday = dateStr === formatDateForComparison(today);
            const deadlineInfo = deadlinesByDate.get(dateStr);
            
            let dayClass = `${cardClass} p-1.5 text-xs sm:text-sm flex flex-col items-start justify-start min-h-[4rem] sm:min-h-[5rem] rounded-md transition-all duration-150 hover:shadow-md cursor-pointer `;
            if (isToday) dayClass += `${isIlluminateEnabled ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-blue-900/50 border-blue-500 ring-1 ring-blue-500'} `;
            else if (deadlineInfo) dayClass += `${isIlluminateEnabled ? 'bg-amber-50/70' : 'bg-amber-900/30'} `;
            else dayClass += `${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} `;

            let priorityIndicatorColor = '';
            if (deadlineInfo?.priorities.has('high')) priorityIndicatorColor = 'bg-red-500';
            else if (deadlineInfo?.priorities.has('medium')) priorityIndicatorColor = 'bg-yellow-500';
            else if (deadlineInfo?.priorities.has('low')) priorityIndicatorColor = 'bg-green-500';

            daysArray.push(
                <div key={day} className={dayClass} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => handleCalendarDateClick(date)}>
                    <span className={`font-semibold mb-0.5 ${isToday ? (isIlluminateEnabled ? 'text-blue-700' : 'text-blue-300') : ''}`}>{day}</span>
                    {deadlineInfo && (
                        <div className="mt-auto w-full">
                            {priorityIndicatorColor && <div className={`h-1 w-full rounded-full ${priorityIndicatorColor} mb-1`}></div>}
                            <div className="text-[9px] sm:text-[10px] leading-tight opacity-80">
                                {deadlineInfo.count} item{deadlineInfo.count > 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return daysArray;
    };


  return (
    <div className={`${containerClass} min-h-screen w-full overflow-x-hidden relative font-sans`}>
      <Sidebar userName={userName} isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />
      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'} z-40 p-2.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${isIlluminateEnabled ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'} ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open TaskMaster AI Chat" aria-label="Open TaskMaster AI Chat">
        <BrainCircuit className="w-5 h-5" />
      </button>

      <main className={`transition-all duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64'} p-3 md:p-4 lg:p-5 xl:p-6 overflow-x-hidden`}>
         <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <header className={`dashboard-header w-full lg:w-auto animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-500 ease-out pt-1 lg:pt-0`}>
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 ${headingClass} break-words`}>
              {React.cloneElement(greeting.icon, { className: `w-5 h-5 lg:w-6 lg:h-6 inline-block align-middle mr-1.5 -translate-y-0.5 ${greeting.color ? `text-${greeting.color}-500` : iconColor}` })}
              {greeting.greeting},{' '} <span className="font-semibold">{userName ? userName.split(' ')[0] : '...'}</span>
            </h1>
            <p className={`italic text-xs md:text-sm ${subheadingClass}`}>"{quote.text}" - <span className={illuminateTextPurple}>{quote.author}</span></p>
          </header>
        </div>

        {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length > 0 && (
          <div className={`${cardClass} rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 animate-fadeIn relative overflow-hidden ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-200`}>
            <div className={`absolute inset-0 ${isIlluminateEnabled ? 'bg-gradient-to-r from-blue-50/30 to-purple-50/30' : 'bg-gradient-to-r from-blue-900/10 to-purple-900/10'} pointer-events-none opacity-50`}></div>
            <div className="flex items-center justify-between mb-2 z-10 relative">
              <h2 className={`text-base sm:text-lg font-semibold flex items-center ${illuminateTextBlue}`}>
                <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 animate-pulse" /> AI Insights
                <span className="ml-1.5 text-[10px] sm:text-xs bg-gradient-to-r from-pink-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full">
                  {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length} New
                </span>
              </h2>
              <button onClick={() => setShowInsightsPanel(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-700'}`} title={showInsightsPanel ? "Collapse Insights" : "Expand Insights"}>
                 {showInsightsPanel ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
            <div className={`space-y-2 transition-all duration-300 ease-out overflow-hidden z-10 relative ${showInsightsPanel ? 'max-h-96 opacity-100 pt-1' : 'max-h-0 opacity-0'}`}>
                {smartInsights.filter(insight => !insight.accepted && !insight.rejected).map((insight, index) => (
                  <div key={insight.id} className={`p-2 rounded-lg flex items-center justify-between gap-2 animate-slideInRight ${insight.type === 'warning' ? (isIlluminateEnabled ? 'bg-red-100/80' : 'bg-red-900/40') : insight.type === 'suggestion' ? (isIlluminateEnabled ? 'bg-blue-100/80' : 'bg-blue-900/40') : (isIlluminateEnabled ? 'bg-green-100/80' : 'bg-green-900/40')}`} style={{ animationDelay: `${index * 70}ms` }}>
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

        <div className={`${cardClass} rounded-xl p-3 sm:p-4 relative min-h-[60px] transition-all duration-300 ease-out animate-fadeIn mb-4 sm:mb-5 ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-300`}>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h2 className={`text-base sm:text-lg font-semibold mr-1 flex items-center ${illuminateTextBlue}`}>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 text-yellow-400 animate-pulse" /> Smart Overview
            </h2>
            {userTier === 'pro' && <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-teal-400 to-cyan-500 text-white px-1.5 py-0.5 rounded-full font-medium">PRO</span>}
            {userTier === 'premium' && <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium">PREMIUM</span>}
          </div>
          {userTier === 'loading' ? <div className="animate-pulse space-y-1.5 pt-1"><div className={`h-3 rounded-full w-1/2 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div></div>
           : userTier === 'basic' ? <div className={`text-xs italic flex items-center justify-start gap-1.5 py-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}><span>Smart Overview is a Pro/Premium feature.</span><Link to="/pricing" className={`font-medium ml-1 ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline not-italic`}>Upgrade now</Link></div>
           : overviewLoading ? <div className="space-y-1.5 animate-pulse pt-1"><div className={`h-3 rounded-full w-11/12 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div><div className={`h-3 rounded-full w-3/4 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div></div>
           : <> <div className={`text-xs sm:text-sm prose-sm max-w-none animate-fadeIn ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} leading-snug ${smartOverview.includes('unavailable') || smartOverview.includes('failed') || smartOverview.includes('limit') ? (isIlluminateEnabled ? 'text-yellow-700 italic' : 'text-yellow-500 italic') : ''}`}>{smartOverview || "Add items for an overview."}</div>
                  {smartOverview && !smartOverview.includes('unavailable') && !smartOverview.includes('failed') && !smartOverview.includes('limit') && !smartOverview.includes('No pending items') && <div className="mt-1.5 text-left text-[10px] text-gray-500/80">AI responses may be inaccurate. Verify critical info.</div>} </>}
        </div>

        <div className={`grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-400`}>
           <div className="xl:col-span-3 flex flex-col gap-4 sm:gap-5">
            <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
                <div className="flex justify-between items-center mb-3">
                 <h2 className={`text-base sm:text-lg font-semibold ${illuminateTextPurple} flex items-center`}>
                   <TrendingUp className="w-5 h-5 mr-1.5" /> Productivity
                 </h2>
                 <button onClick={() => setShowAnalytics(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-700'} flex items-center gap-1 text-[10px] sm:text-xs`} title={showAnalytics ? "Show Basic Progress" : "Show Analytics"}>
                    {showAnalytics ? <BarChart className="w-3.5 h-3.5" /> : <PieChart className="w-3.5 h-3.5" />}
                    <span>{showAnalytics ? 'Basic' : 'Analytics'}</span>
                  </button>
               </div>
               {showAnalytics ? (
                 <div className="animate-fadeIn"><TaskAnalytics tasks={tasks} goals={goals} projects={projects} plans={plans} isIlluminateEnabled={isIlluminateEnabled} /></div>
               ) : (
                  <div className="space-y-3 animate-fadeIn">
                    {(tasks.length > 0 || goals.length > 0 || projects.length > 0 || plans.length > 0) ? (
                         <> {tasks.length > 0 && (<div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Clipboard className="w-3.5 h-3.5 mr-1 text-gray-400" /> Tasks</p><p className={`${illuminateTextGreen} font-semibold text-xs`}>{tasks.filter(t => t.data.completed).length}/{tasks.length} ({tasksProgress}%)</p></div><div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${tasksProgress}%` }} /></div></div>)}
                            {goals.length > 0 && (<div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Target className="w-3.5 h-3.5 mr-1 text-gray-400" /> Goals</p><p className={`${illuminateTextPink} font-semibold text-xs`}>{goals.filter(g => g.data.completed).length}/{goals.length} ({goalsProgress}%)</p></div><div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${goalsProgress}%` }} /></div></div>)}
                            {projects.length > 0 && (<div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Layers className="w-3.5 h-3.5 mr-1 text-gray-400" /> Projects</p><p className={`${illuminateTextBlue} font-semibold text-xs`}>{projects.filter(p => p.data.completed).length}/{projects.length} ({projectsProgress}%)</p></div><div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${projectsProgress}%` }} /></div></div>)}
                            {plans.length > 0 && (<div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"><p className="flex items-center font-medium"><Rocket className="w-3.5 h-3.5 mr-1 text-gray-400" /> Plans</p><p className={`${illuminateTextYellow} font-semibold text-xs`}>{plans.filter(p => p.data.completed).length}/{plans.length} ({plansProgress}%)</p></div><div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}><div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${plansProgress}%` }} /></div></div>)} </>
                    ) : <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}><Lightbulb className="w-4 h-4 mr-1.5 text-yellow-400" />Add items to track your progress.</p>}
                 </div> )}
            </div>

            {/* Upcoming Deadlines Card - RE-ADDED */}
            <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
               <h2 className={`text-base sm:text-lg font-semibold mb-3 ${illuminateTextBlue} flex items-center`}>
                 <Calendar className="w-5 h-5 mr-1.5" /> Upcoming
               </h2>
               {(() => {
                   const allItems = [...tasks, ...goals, ...projects, ...plans];
                   const now = new Date();
                   const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                   const upcomingDeadlines = allItems
                     .filter(item => {
                        const { dueDate, completed } = item.data;
                        if (!dueDate || completed) return false;
                         try {
                             const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
                             const dueDateNormalized = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
                             return dueDateNormalized >= nowDateNormalized;
                         } catch { return false; }
                     })
                      .sort((a, b) => {
                         try {
                             const aDate = a.data.dueDate.toDate ? a.data.dueDate.toDate() : new Date(a.data.dueDate);
                             const bDate = b.data.dueDate.toDate ? b.data.dueDate.toDate() : new Date(b.data.dueDate);
                             return aDate.getTime() - bDate.getTime();
                         } catch { return 0; }
                     })
                     .slice(0, 5);

                 if (!upcomingDeadlines.length) {
                   return (
                      <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}>
                       <CheckCircle className="w-4 h-4 mr-1.5 text-green-400" />
                       All caught up! No upcoming deadlines.
                     </p>
                   );
                 }
                 return (
                    <ul className="space-y-2">
                     {upcomingDeadlines.map((item, index) => {
                        const { id, data } = item;
                        const itemType = data.task ? 'Task' : data.goal ? 'Goal' : data.project ? 'Project' : 'Plan';
                        const dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
                        const dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        const itemName = data[itemType.toLowerCase()] || 'Untitled';
                        
                        const dueDateNormalized = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
                        const daysRemaining = Math.ceil((dueDateNormalized.getTime() - nowDateNormalized.getTime()) / (1000 * 60 * 60 * 24));

                        let urgencyColorClass = isIlluminateEnabled ? 'border-l-gray-300' : 'border-l-gray-600';
                        let urgencyText = `${daysRemaining} days`;
                        let urgencyTextClass = isIlluminateEnabled ? 'text-green-600' : 'text-green-400';
                        let urgencyBgClass = isIlluminateEnabled ? 'bg-green-100 text-green-600' : 'bg-green-900/50 text-green-400';

                        if (daysRemaining < 0) { /* Should not happen due to filter */ }
                        else if (daysRemaining === 0) { 
                            urgencyColorClass = 'border-l-red-500'; urgencyText = 'Today!'; 
                            urgencyTextClass = isIlluminateEnabled ? 'text-red-600' : 'text-red-400';
                            urgencyBgClass = isIlluminateEnabled ? 'bg-red-100 text-red-600' : 'bg-red-900/50 text-red-400';
                        } else if (daysRemaining === 1) { 
                            urgencyColorClass = 'border-l-orange-500'; urgencyText = 'Tomorrow!'; 
                            urgencyTextClass = isIlluminateEnabled ? 'text-orange-600' : 'text-orange-400';
                            urgencyBgClass = isIlluminateEnabled ? 'bg-orange-100 text-orange-600' : 'bg-orange-900/50 text-orange-400';
                        } else if (daysRemaining <= 3) { 
                            urgencyColorClass = 'border-l-yellow-500'; 
                            urgencyTextClass = isIlluminateEnabled ? 'text-yellow-700' : 'text-yellow-400';
                            urgencyBgClass = isIlluminateEnabled ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/50 text-yellow-400';
                        }
                       const priority = data.priority || calculatePriority(item);

                       return (
                         <li key={id} className={`${isIlluminateEnabled ? 'bg-gray-100/80 hover:bg-gray-200/60' : 'bg-gray-700/40 hover:bg-gray-700/60'} p-2.5 rounded-lg transition-colors duration-150 border-l-4 ${urgencyColorClass} animate-slideInRight flex items-center justify-between gap-2`} style={{ animationDelay: `${index * 60}ms` }}>
                            <div className="flex-grow overflow-hidden mr-2">
                               <div className="text-xs sm:text-sm font-medium flex items-center">
                                 <span className={`font-semibold mr-1 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{itemType}:</span>
                                 <span className="truncate" title={itemName}>{itemName}</span>
                                  <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="ml-1.5 flex-shrink-0" />
                               </div>
                            </div>
                            <div className={`text-[10px] sm:text-xs flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'} flex items-center whitespace-nowrap`}>
                               <Clock className={`w-3 h-3 mr-0.5 ${urgencyTextClass}`} />
                               <span className={`font-medium mr-1.5 ${urgencyTextClass}`}>{dueDateStr}</span>
                               {urgencyText && (<span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${urgencyBgClass}`}>{urgencyText}</span>)}
                            </div>
                         </li>);
                     })}
                   </ul>);
               })()}
             </div>


             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300 flex flex-col`}>
               <div className="overflow-x-auto no-scrollbar mb-4">
                 <div className={`flex space-x-1.5 w-full border-b pb-2 ${tabBorderColor}`}>
                   {["tasks", "goals", "projects", "plans"].map((tab) => (
                     <button key={tab} className={`px-3 py-1.5 rounded-full transition-all duration-200 transform hover:scale-[1.03] text-xs sm:text-sm font-medium flex items-center whitespace-nowrap ${activeTab === tab ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm" : isIlluminateEnabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} onClick={() => handleTabChange(tab as "tasks" | "goals" | "projects" | "plans")}>
                       {tab === "tasks" && <Clipboard className="w-3.5 h-3.5 mr-1" />} {tab === "goals" && <Target className="w-3.5 h-3.5 mr-1" />} {tab === "projects" && <Layers className="w-3.5 h-3.5 mr-1" />} {tab === "plans" && <Rocket className="w-3.5 h-3.5 mr-1" />}
                       {tab.charAt(0).toUpperCase() + tab.slice(1)}
                     </button>))}
                 </div>
               </div>
               <div className="flex flex-col md:flex-row gap-1.5 mb-4">
                 <input type="text" className={`flex-grow ${inputBg} rounded-full px-3.5 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} placeholder={`Add a new ${activeTab.slice(0, -1)}...`} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                 <div className="flex gap-1.5 flex-shrink-0">
                   <input type="date" className={`${inputBg} rounded-full px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${iconColor}`} value={newItemDate} onChange={(e) => setNewItemDate(e.target.value)} title="Set due date" style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} />
                   <div className="relative">
                      <select className={`${inputBg} rounded-full pl-3 pr-7 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value as 'high' | 'medium' | 'low')} title="Set priority">
                        <option value="high">High 🔥</option><option value="medium">Medium</option><option value="low">Low 🧊</option>
                      </select>
                      <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} />
                   </div>
                   <button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-full flex items-center justify-center hover:shadow-md hover:shadow-purple-500/20 transition-all duration-200 transform hover:scale-105 active:scale-100 min-w-[32px] min-h-[32px]" onClick={handleCreate} title={`Add new ${activeTab.slice(0,-1)}`}><PlusCircle className="w-4 h-4" /></button>
                 </div>
               </div>
               <ul className="space-y-1.5 sm:space-y-2 flex-grow overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 550px)', minHeight: '250px' }}> {/* Adjusted max-height for upcoming section */}
                 {currentItems.length === 0 ? <li className={`${subheadingClass} text-sm text-center py-6 italic`}>No {activeTab} here yet... Add one above!</li>
                 : currentItems.sort((a, b) => { const po = { high: 0, medium: 1, low: 2 }; const ap = po[calculatePriority(a)]; const bp = po[calculatePriority(b)]; if (ap !== bp) return ap - bp; const ad = a.data.dueDate?.toDate ? a.data.dueDate.toDate() : (a.data.dueDate ? new Date(a.data.dueDate) : null); const bd = b.data.dueDate?.toDate ? b.data.dueDate.toDate() : (b.data.dueDate ? new Date(b.data.dueDate) : null); if (ad && bd) return ad.getTime() - bd.getTime(); if (ad) return -1; if (bd) return 1; return (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0); })
                     .map((item, index) => {
                       const itemId = item.id; const { data } = item; const textValue = data[titleField] || 'Untitled'; const isCompleted = data.completed || false; const isEditing = editingItemId === itemId; const priority = data.priority || calculatePriority(item);
                       let dueDateStr = ''; let overdue = false;
                       if (data.dueDate) { try { const ddo = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); if (!isNaN(ddo.getTime())) { dueDateStr = ddo.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const td = new Date(); const todayNormalized = new Date(td.getFullYear(), td.getMonth(), td.getDate()); const itemDateNormalized = new Date(ddo.getFullYear(), ddo.getMonth(), ddo.getDate()); overdue = itemDateNormalized < todayNormalized && !isCompleted; }} catch {} }
                       return (
                         <li key={item.id} className={`group p-2 sm:p-2.5 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 transition-all duration-150 animate-slideInUp ${isCompleted ? (isIlluminateEnabled ? 'bg-green-100/50 opacity-60' : 'bg-green-900/20 opacity-50') : overdue ? (isIlluminateEnabled ? 'bg-red-100/60' : 'bg-red-900/30') : isIlluminateEnabled ? 'bg-gray-100/70 hover:bg-gray-200/50' : 'bg-gray-700/30 hover:bg-gray-700/50'} ${isEditing ? (isIlluminateEnabled ? 'ring-1 ring-purple-400 bg-purple-50/50' : 'ring-1 ring-purple-500 bg-purple-900/20') : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
                           {!isEditing ? (<> <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2">
                                 <button onClick={() => handleMarkComplete(itemId)} className={`flex-shrink-0 p-0.5 rounded-full transition-colors duration-150 ${isCompleted ? (isIlluminateEnabled ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600') : (isIlluminateEnabled ? 'border border-gray-400 hover:border-green-500 hover:bg-green-100/50' : 'border border-gray-500 hover:border-green-500 hover:bg-green-900/30')} `} title={isCompleted ? "Mark Pending" : "Mark Complete"}><CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-white' : 'text-transparent'}`} /></button>
                                 <span className={`font-medium text-sm sm:text-[0.9rem] truncate ${isCompleted ? 'line-through text-gray-500 dark:text-gray-600' : (isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100')}`} title={textValue}>{textValue}</span>
                                 <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="flex-shrink-0 ml-auto sm:ml-1.5" />
                                 {dueDateStr && <span className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 hidden sm:flex items-center ${overdue ? (isIlluminateEnabled ? 'bg-red-200 text-red-700' : 'bg-red-800/50 text-red-300') : (isIlluminateEnabled ? 'bg-gray-200 text-gray-600' : 'bg-gray-600/80 text-gray-300')}`}><Calendar className="w-2.5 h-2.5 mr-0.5" />{dueDateStr}</span>}
                               </div> <div className="flex gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                 <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'} transition-colors`} onClick={() => handleEditClick(itemId, data)} title="Edit"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                 <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'} transition-colors`} onClick={() => handleDelete(itemId)} title="Delete"><Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                               </div></>)
                           : (<> <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                                   <input className={`flex-grow ${inputBg} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(itemId); if (e.key === 'Escape') setEditingItemId(null); }}/>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        <input type="date" className={`${inputBg} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${iconColor}`} value={editingDate} onChange={(e) => setEditingDate(e.target.value)} style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }}/>
                                        <div className="relative">
                                            <select className={`${inputBg} rounded-full pl-3 pr-7 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={editingPriority} onChange={(e) => setEditingPriority(e.target.value as 'high' | 'medium' | 'low')}>
                                                <option value="high">High 🔥</option><option value="medium">Medium</option><option value="low">Low 🧊</option>
                                            </select> <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} />
                                        </div></div></div>
                                 <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center">
                                   <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditSave(itemId)}>Save</button>
                                   <button className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm" onClick={() => setEditingItemId(null)}>Cancel</button>
                                 </div> </>)}
                         </li>);
                     })}
               </ul>
             </div>
           </div>

           <div className="xl:col-span-2 flex flex-col gap-4 sm:gap-5">
                <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300 flex flex-col`} style={{ minHeight: '400px', maxHeight: 'calc(100vh - 200px)' }}> {/* Adjusted height and flex for growth */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0"> {/* No grow for header */}
                        <button onClick={handlePreviousMonth} className={`p-2 rounded-full ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`} title="Previous Month"><ChevronLeft className="w-5 h-5" /></button>
                        <h2 className={`text-lg sm:text-xl font-semibold text-center ${headingClass}`}>
                            {currentDisplayMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={handleNextMonth} className={`p-2 rounded-full ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`} title="Next Month"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs sm:text-sm font-medium mb-2 flex-shrink-0"> {/* No grow for labels */}
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => ( // Using S M T for smaller screens
                            <div key={day} className={subheadingClass}>{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-grow overflow-y-auto"> {/* Calendar days container will grow and scroll */}
                        {renderCalendarDays()}
                    </div>
                </div>
           </div>
         </div>
      </main>

      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`} role="complementary" aria-labelledby="ai-sidebar-title">
        <div className={`p-3 sm:p-4 border-b ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
          <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}><BrainCircuit className="w-5 h-5" />Chat with TaskMaster</h3>
          <button onClick={() => setIsAiSidebarOpen(false)} className={`${isIlluminateEnabled ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'} p-1 rounded-full transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatEndRef}>
          {chatHistory.map((message, index) => ( <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }}>
              <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')}`}>
                 {message.content && message.content !== "..." && <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />, ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, li: ({node, ...props}) => <li className="mb-0.5" {...props} />, a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />, code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); }, }}>{message.content}</ReactMarkdown>}
                 {message.content === "..." && isChatLoading && index === chatHistory.length - 1 && <div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-60"></div></div>}
                 {message.timer && <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}><TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} /><Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} /></div></div>}
                 {message.flashcard && <div className="mt-1.5"><FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>}
                 {message.question && <div className="mt-1.5"><FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>}
              </div> </div> ))}
          {isChatLoading && chatHistory[chatHistory.length - 1]?.content !== "..." && <div className="flex justify-start animate-fadeIn"><div className={`${isIlluminateEnabled ? 'bg-gray-100 border border-gray-200/80' : 'bg-gray-700/80 border border-gray-600/50'} rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm`}><div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div></div></div></div>}
        </div>
        <div className={`px-2 sm:px-3 pt-1 border-t ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm`}>
            {userTier !== 'premium' && userTier !== 'loading' && (<div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>Messages this month: {chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit}</span> {isChatLimitReached && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>} {!isChatLimitReached && userTier === 'basic' && <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}><Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade</Link>}</div>)}
            <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2">
                <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={isChatLimitReached ? "Monthly limit reached..." : "Ask TaskMaster AI..."} className={`flex-1 ${inputBg} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm disabled:opacity-60 ${isChatLimitReached ? 'cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || userTier === 'loading'} aria-label="Chat input"/>
                <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatLimitReached || userTier === 'loading'} className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached ? 'cursor-not-allowed' : ''}`} title="Send Message" aria-label="Send chat message">
                    {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
