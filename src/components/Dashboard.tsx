
// Dashbord.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Play, Pause, PlusCircle, Edit, Trash, Sparkles, CheckCircle, MessageCircle, RotateCcw, Square, X, TimerIcon, Send, ChevronLeft, ChevronRight, Moon, Sun, Star, Wind, Droplets, Zap, Calendar, Clock, MoreHorizontal, ArrowUpRight, Bookmark, BookOpen, Lightbulb, Flame, Award, TrendingUp, Rocket, Target, Layers, Clipboard, AlertCircle, ThumbsUp, ThumbsDown, BrainCircuit, ArrowRight, Flag, Bell, Filter, Tag, BarChart, PieChart, ChevronDown, Settings, LogOut, User as UserIcon, FolderPlus, FolderMinus, EyeOff, Eye, Hash
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
    createItem,
    updateDashboardLastSeen,
    addCustomTimer,
    onCustomTimersSnapshot,
    updateItem,
    deleteItem,
    markItemComplete,
    updateCustomTimer,
    deleteCustomTimer,
    weatherApiKey,
    hfApiKey, // Assuming hfApiKey might be needed elsewhere, keeping it
    geminiApiKey, // Ensure this is correctly configured
    createSection,
    updateSection,
    deleteSection,
    onSectionsSnapshot,
    ItemType,
    CollectionName,
} from '../lib/dashboard-firebase';
import {
    UserTier,
    ChatUsageData,
    getUserTier,
    getUserChatUsage,
    updateUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';
import {
    getUserContext,
    saveUserContext,
    UserContext,
    DeepInsightAction,
    createDeepInsightAction,
    updateDeepInsightActionStatus,
    voteOnDeepInsightAction, // Assuming this might be used elsewhere
    onDeepInsightActionsChange
} from '../lib/ai-context-firebase';
import {
    createChatConversation,
    saveChatMessage,
    onChatMessagesSnapshot,
    onChatConversationsSnapshot,
    updateChatConversationName, // Assuming this might be used elsewhere
    deleteChatConversation, // Assuming this might be used elsewhere
    ChatMessage as FirebaseChatMessage,
    findItemByName // Ensure this function is correctly implemented in ai-chat-firebase
} from '../lib/ai-chat-firebase';
import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDoc, doc, Timestamp } from 'firebase/firestore';
import { updateUserProfile, signOutUser, deleteUserAccount, AuthError, getCurrentUser } from '../lib/settings-firebase'; // Assuming these are used elsewhere
import { SmartInsight as SmartInsightComponent } from './SmartInsight'; // Assuming this might be used elsewhere
import { PriorityBadge } from './PriorityBadge';
import EnhancedTaskAnalytics from './EnhancedTaskAnalytics';
import AddTimerModal from './AddTimerModal';

// Gemini helper functions
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}&alt=sse`;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    // console.log("Fetching:", url, "Options:", options); // Debug log
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    // console.log("Fetch response status:", response.status); // Debug log
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
         console.warn('Fetch timed out:', url);
         throw new Error('Request timed out');
    }
    console.error("Fetch error:", error); // Debug log
    throw error;
  }
};

const streamResponse = async (
  url: string,
  options: RequestInit,
  onStreamUpdate: (textChunk: string) => void,
  timeout = 45000 // Increased timeout slightly
) => {
    try {
        // console.log("Streaming from:", url, "Options:", options); // Debug log
        const response = await fetchWithTimeout(url, options, timeout); // Use fetchWithTimeout
        // console.log("Stream response status:", response.status); // Debug log
        if (!response.ok) {
            let errorBody = '';
            try {
                errorBody = await response.text();
                // console.error("API Error Body:", errorBody); // Debug log
                const errorJson = JSON.parse(errorBody);
                if (errorJson?.error?.message) {
                    throw new Error(`API Error (${response.status}): ${errorJson.error.message}`);
                }
            } catch (parseError) {
                console.warn("Could not parse error body:", parseError);
            }
            throw new Error(`API Request Failed (${response.status}): ${response.statusText} ${errorBody || ''}`);
        }
        if (!response.body) {
            console.warn("Response body is null, reading text directly.");
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
                // console.log("Raw Stream Chunk:", rawChunk); // Debug log
                accumulatedRawText += rawChunk;
                onStreamUpdate(accumulatedRawText); // Call update with the *accumulated* raw text for parsing
            }
        }
        // console.log("Streaming finished. Accumulated Raw:", accumulatedRawText); // Debug log
        return accumulatedRawText;
    } catch (error) {
        console.error("Streaming Error:", error);
        throw error; // Re-throw to be caught by caller
    }
};


const extractCandidateText = (rawResponseText: string): string => {
    // console.log("Attempting to extract from raw:", rawResponseText); // Debug log
    try {
        let extractedText = "";
        let potentialJson = "";
        const lines = rawResponseText.trim().split('\n');
        const dataLines = lines.filter(line => line.startsWith('data:'));

        // Try parsing the JSON from the last 'data:' line (typical for SSE streams)
        if (dataLines.length > 0) {
            const lastDataLine = dataLines[dataLines.length - 1];
            potentialJson = lastDataLine.substring(5).trim();
            // console.log("Last data line JSON:", potentialJson); // Debug log
            try {
                const parsedJson = JSON.parse(potentialJson);
                if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                    extractedText = parsedJson.candidates[0].content.parts[0].text;
                    // console.log("Extracted text from last data line:", extractedText); // Debug log
                    return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
                } else if (parsedJson.error?.message) {
                    console.error("Gemini API Error in response:", parsedJson.error.message);
                    return `Error: ${parsedJson.error.message}`;
                } else if (parsedJson.candidates?.[0]?.finishReason && parsedJson.candidates?.[0]?.finishReason !== 'STOP') {
                     console.error("Gemini API finishReason error:", parsedJson.candidates[0].finishReason, "Safety Ratings:", parsedJson.candidates[0]?.safetyRatings);
                     // Provide more specific feedback if blocked
                     if (parsedJson.candidates[0]?.finishReason === 'SAFETY') {
                         return `Error: Generation stopped due to safety concerns.`;
                     } else if (parsedJson.candidates[0]?.finishReason === 'MAX_TOKENS') {
                         // Don't treat max_tokens as a hard error, just return what we have. The text should still be in the candidate.
                         if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                            extractedText = parsedJson.candidates[0].content.parts[0].text;
                            return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
                         } else {
                            return `Error: Generation stopped (${parsedJson.candidates[0].finishReason})`;
                         }
                     }
                     else {
                         return `Error: Generation stopped (${parsedJson.candidates[0].finishReason})`;
                     }
                }
            } catch (e) {
                // console.warn("Failed to parse last data line JSON, might be incomplete stream:", e); // Debug log
                // If parsing fails, maybe it's not JSON yet, try to extract from intermediate structure if possible
            }
        }

        // Fallback: If no valid text from 'data:' lines, try to parse the whole thing if it looks like JSON
        // This might happen if the response wasn't streamed correctly or is just a single JSON object
        if (!extractedText && rawResponseText.trim().startsWith('{')) {
            potentialJson = rawResponseText.trim();
             // console.log("Trying to parse entire response as JSON:", potentialJson); // Debug log
            try {
                const parsedJson = JSON.parse(potentialJson);
                 if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                    extractedText = parsedJson.candidates[0].content.parts[0].text;
                    // console.log("Extracted text from full JSON:", extractedText); // Debug log
                } else if (parsedJson.error?.message) {
                    console.error("Gemini API Error in full response:", parsedJson.error.message);
                    return `Error: ${parsedJson.error.message}`;
                } else {
                    extractedText = ""; // No usable text found
                }
            } catch (e) {
                 // console.warn("Failed to parse entire response as JSON:", e); // Debug log
                 extractedText = ""; // Not valid JSON
            }
        }

        // Clean up common prefixes if text was found
        if (extractedText) {
            return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
        }

        // If still no text, return empty string
        // console.log("Extraction failed, returning empty string."); // Debug log
        return "";

    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return ""; // Return empty string on error during extraction
    }
};


// Helper functions (getWeekDates, formatDateForComparison, calculatePriority) - remain unchanged
const getWeekDates = (date: Date): Date[] => {
  const sunday = new Date(date); sunday.setDate(date.getDate() - date.getDay()); const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) { const day = new Date(sunday); day.setDate(sunday.getDate() + i); weekDates.push(day); } return weekDates;
};
const formatDateForComparison = (date: Date): string => date.toISOString().split('T')[0];
const calculatePriority = (item: any): 'high' | 'medium' | 'low' => {
  if (item.data.priority) return item.data.priority; if (!item.data.dueDate) return 'low'; let dueDate: Date | null = null;
  if (item.data.dueDate?.toDate) { dueDate = item.data.dueDate.toDate(); } else if (item.data.dueDate instanceof Date) { dueDate = item.data.dueDate; } else if (typeof item.data.dueDate === 'string' || typeof item.data.dueDate === 'number') { try { const d = new Date(item.data.dueDate); if (!isNaN(d.getTime())) { dueDate = d; } } catch (e) { dueDate = null; } }
  if (!dueDate) return 'low'; const now = new Date(); dueDate.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); const diffTime = dueDate.getTime() - now.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'high'; if (diffDays <= 1) return 'high'; if (diffDays <= 3) return 'medium'; return 'low';
};

// Interface for Smart Insights (Client-side warnings/suggestions)
interface SmartInsight { id: string; text: string; type: 'suggestion' | 'warning' | 'achievement'; accepted?: boolean; rejected?: boolean; relatedItemId?: string; createdAt: Date; }
// Define tab types
type TabDefinition = { id: ItemType | string; name: string; icon: React.ElementType; type: 'default' | 'custom'; hidden?: boolean; isDefaultImmutable?: boolean; };
// Interface for AI Action Recommendations in Chat
interface AiActionRecommendation { type: 'actionRecommendation'; data: { id: string; action: 'create' | 'update' | 'delete'; itemType: ItemType; payload: any; reasoning: string; }; }
// Combine local chat message state with Firebase structure
interface DisplayChatMessage extends FirebaseChatMessage { id: string; error?: boolean; recommendation?: AiActionRecommendation['data']; }


// Parse timer requests from chat messages
const parseTimerRequest = (message: string): number | null => {
    const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i;
    const match = message.match(timeRegex);
    if (!match) return null;
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (isNaN(amount) || amount <= 0) return null;
    if (unit.startsWith('hour') || unit.startsWith('hr')) { return amount * 3600; }
    else if (unit.startsWith('min')) { return amount * 60; }
    else if (unit.startsWith('sec')) { return amount; }
    return null;
};

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
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'true'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const today = new Date(); today.setHours(0,0,0,0); // Normalize today once for comparisons
  const [currentWeek, setCurrentWeek] = useState<Date[]>(getWeekDates(new Date())); // Use normalized today

  // ---------------------
  // 2. AI CHAT SIDEBAR STATE
  // ---------------------
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentChatHistory, setCurrentChatHistory] = useState<DisplayChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [aiSidebarTab, setAiSidebarTab] = useState<'chat' | 'insights'>('chat');
  const [aiGeneratedInsights, setAiGeneratedInsights] = useState<{ score?: number; timeManagement?: string; conflicts?: string; other?: string; recommendations?: DeepInsightAction[]; error?: string | null; isLoading: boolean; lastGeneratedSig: string | null; }>({ isLoading: false, recommendations: [], lastGeneratedSig: null });
  const [pendingInsightActions, setPendingInsightActions] = useState<DeepInsightAction[]>([]);

  // ---------------------
  // 3. COLLECTION & TAB STATES
  // ---------------------
  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);
  const [userSections, setUserSections] = useState<Array<{ id: string; data: any }>>([]);
  const [activeTabId, setActiveTabId] = useState<string>('tasks');

  const availableTabs: TabDefinition[] = useMemo(() => {
      const defaultTabs: TabDefinition[] = [ { id: 'tasks', name: 'Tasks', icon: Clipboard, type: 'default', isDefaultImmutable: true }, { id: 'goals', name: 'Goals', icon: Target, type: 'default', isDefaultImmutable: true }, { id: 'projects', name: 'Projects', icon: Layers, type: 'default', hidden: false }, { id: 'plans', name: 'Plans', icon: Rocket, type: 'default', hidden: false }, ];
      const customTabs: TabDefinition[] = userSections.map(section => ({ id: section.id, name: section.data.name, icon: Hash, type: 'custom', hidden: section.data.hidden || false, }));
      const combined = defaultTabs.map(dt => { const storedState = userSections.find(us => us.id === dt.id); return { ...dt, hidden: storedState?.data?.hidden ?? dt.hidden ?? false }; // Ensure hidden has a default
      }).concat(customTabs);
      return combined.filter(tab => !tab.hidden);
  }, [userSections]);
  const activeTabDefinition = useMemo(() => availableTabs.find(tab => tab.id === activeTabId), [activeTabId, availableTabs]);
  const activeCollectionName: CollectionName | null = useMemo(() => { const tab = availableTabs.find(t => t.id === activeTabId); if (!tab) return null; if (tab.type === 'default') { return tab.id as ItemType; } else if (tab.type === 'custom') { return 'tasks'; // Custom tabs currently hold tasks
       } return null; }, [activeTabId, availableTabs]);

  // ---------------------
  // 4. ITEM EDITING & CREATION STATE
  // ---------------------
  const [newItemText, setNewItemText] = useState(""); const [newItemDate, setNewItemDate] = useState(""); const [newItemPriority, setNewItemPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editingItemId, setEditingItemId] = useState<string | null>(null); const [editingText, setEditingText] = useState(""); const [editingDate, setEditingDate] = useState(""); const [editingPriority, setEditingPriority] = useState<'high' | 'medium' | 'low'>('medium'); const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [isCreatingSection, setIsCreatingSection] = useState(false); const [newSectionName, setNewSectionName] = useState(""); const [editingSection, setEditingSection] = useState<TabDefinition | null>(null);

  // ---------------------
  // 5. TIMER STATES (POMODORO & CUSTOM)
  // ---------------------
  const [customTimers, setCustomTimers] = useState<Array<{ id: string; data: any }>>([]); const [editingTimerId, setEditingTimerId] = useState<string | null>(null); const [editingTimerName, setEditingTimerName] = useState(""); const [editingTimerMinutes, setEditingTimerMinutes] = useState(""); const [runningTimers, setRunningTimers] = useState<{ [id: string]: { isRunning: boolean; timeLeft: number; intervalRef: NodeJS.Timer | null; audio?: HTMLAudioElement | null; finished?: boolean; }; }>({}); const [isAddTimerModalOpen, setIsAddTimerModalOpen] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60); const [pomodoroRunning, setPomodoroRunning] = useState(false); const pomodoroRef = useRef<NodeJS.Timer | null>(null); const pomodoroAudioRef = useRef<HTMLAudioElement | null>(null); const [pomodoroFinished, setPomodoroFinished] = useState(false);

  // ---------------------
  // 6. UI STATES (Analytics, Insights Panel)
  // ---------------------
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [smartInsights, setSmartInsights] = useState<SmartInsight[]>([]); const [showInsightsPanel, setShowInsightsPanel] = useState(true); // Default to open
   const insightTimeoutRef = useRef<NodeJS.Timeout | null>(null); const [debouncedItemsSigForInsights, setDebouncedItemsSigForInsights] = useState("");

  // ---------------------
  // 7. WEATHER STATE
  // ---------------------
  const [weatherData, setWeatherData] = useState<any>(null); const [weatherLoading, setWeatherLoading] = useState<boolean>(true); const [weatherError, setWeatherError] = useState<string | null>(null);

  // ---------------------
  // EFFECT HOOKS
  // ---------------------

  // LocalStorage Sync Effects
  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); if (isBlackoutEnabled && !isIlluminateEnabled) { document.body.classList.add('blackout-mode'); } else { document.body.classList.remove('blackout-mode'); } }, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); if (isIlluminateEnabled) { document.body.classList.add('illuminate-mode'); document.body.classList.remove('blackout-mode'); } else { document.body.classList.remove('illuminate-mode'); if (isBlackoutEnabled) { document.body.classList.add('blackout-mode'); } } }, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

  // Card Visibility Animation Effect
  useEffect(() => { const timer = setTimeout(() => setCardVisible(true), 100); return () => clearTimeout(timer); }, []);

  // Auth Guard & Last Seen Update
  useEffect(() => { const checkAuth = async () => { const currentUser = getCurrentUser(); if (!currentUser) { navigate('/login'); } else { updateDashboardLastSeen(currentUser.uid).catch(err => console.warn("Failed to update last seen:", err)); } }; checkAuth(); }, [navigate]);

  // Auth Listener, Tier/Usage Check, Context Fetch
  useEffect(() => { const unsubscribeAuth = onFirebaseAuthStateChanged(async (firebaseUser) => { setUser(firebaseUser); if (firebaseUser) { setIsLoadingContext(true); setContextError(null); try { const docSnap = await getDoc(doc(db, "users", firebaseUser.uid)); let nameToSet = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"); if (docSnap.exists() && docSnap.data().name) { nameToSet = docSnap.data().name; } setUserName(nameToSet); } catch (error) { console.error("Error fetching user name:", error); setUserName(firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User")); } const tier = await getUserTier(firebaseUser.email); // Make sure getUserTier is async if needed
       setUserTier(tier); if (tier !== 'premium') { try { const currentMonthYear = new Date().toISOString().slice(0, 7); const usageData = await getUserChatUsage(firebaseUser.uid); if (usageData && usageData.month === currentMonthYear) { setChatCount(usageData.count); setChatMonth(usageData.month); const limit = getChatLimitForTier(tier); setIsChatLimitReached(usageData.count >= limit); } else { // Reset for new month or no data
             setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false); await updateUserChatUsage(firebaseUser.uid, 0, currentMonthYear); } } catch (err) { console.error("Error loading/updating usage data:", err); setChatCount(0); setChatMonth(new Date().toISOString().slice(0, 7)); setIsChatLimitReached(false); // Default to not limited on error
           } } else { setChatCount(0); setChatMonth(''); setIsChatLimitReached(false); // Premium has no limits tracked this way
       } try { const context = await getUserContext(firebaseUser.uid); setUserContext(context); } catch (error) { console.error("Error fetching user context:", error); setContextError("Failed to load user context."); setUserContext(null); } finally { setIsLoadingContext(false); } } else { // User logged out
         setUserName("Loading..."); setTasks([]); setGoals([]); setProjects([]); setPlans([]); setUserSections([]); setCustomTimers([]); setWeatherData(null); setSmartOverview(""); setSmartInsights([]); setCurrentChatHistory([]); setChatConversations([]); setSelectedConversationId(null); setUserTier('loading'); setChatCount(0); setChatMonth(''); setIsChatLimitReached(false); setUserContext(null); setIsLoadingContext(false); setContextError(null); setPendingInsightActions([]); navigate('/login'); // Redirect if logged out
       } }); return () => unsubscribeAuth(); }, [navigate]);

  // Collection Snapshot Listeners
  useEffect(() => { if (!user?.uid) { setTasks([]); setGoals([]); setProjects([]); setPlans([]); setCustomTimers([]); setUserSections([]); setPendingInsightActions([]); return; }; const unsubFunctions = [ onCollectionSnapshot('tasks', user.uid, setTasks), onCollectionSnapshot('goals', user.uid, setGoals), onCollectionSnapshot('projects', user.uid, setProjects), onCollectionSnapshot('plans', user.uid, setPlans), onCustomTimersSnapshot(user.uid, setCustomTimers), onSectionsSnapshot(user.uid, setUserSections), onDeepInsightActionsChange(user.uid, (actions) => { setPendingInsightActions(actions.filter(a => a.status === 'pending')); // Only keep pending ones
       }) ]; return () => { unsubFunctions.forEach(unsub => { try { unsub(); } catch (e) { console.warn("Error unsubscribing:", e); } }); }; }, [user]);

  // Chat Conversations Listener
  useEffect(() => { if (!user?.uid) { setChatConversations([]); setSelectedConversationId(null); setIsConversationsLoading(false); return; } setIsConversationsLoading(true); const unsubscribeConversations = onChatConversationsSnapshot(user.uid, (conversations) => { setChatConversations(conversations); // Automatically select the latest chat if none is selected or the selected one is gone
       if (conversations.length > 0 && (!selectedConversationId || !conversations.some(c => c.id === selectedConversationId))) { const sorted = [...conversations].sort((a, b) => (b.lastActivity?.seconds || 0) - (a.lastActivity?.seconds || 0)); setSelectedConversationId(sorted[0].id); } else if (conversations.length === 0) { setSelectedConversationId(null); } setIsConversationsLoading(false); }); return () => unsubscribeConversations(); }, [user]); // Removed selectedConversationId dependency to avoid loops on auto-selection

  // Chat Messages Listener
  useEffect(() => { if (!selectedConversationId) { setCurrentChatHistory([]); setIsMessagesLoading(false); return; } setIsMessagesLoading(true); const unsubscribeMessages = onChatMessagesSnapshot(selectedConversationId, (messages) => { const displayMessages = messages.map((msg, index) => ({ ...msg, id: `msg-${selectedConversationId}-${msg.createdAt?.seconds || Date.now()}-${index}` // More robust ID
        })); setCurrentChatHistory(displayMessages); setIsMessagesLoading(false); }); return () => unsubscribeMessages(); }, [selectedConversationId]);

  // Weather Fetch Effect
  useEffect(() => { if (!user || !weatherApiKey) { setWeatherLoading(false); setWeatherData(null); setWeatherError(null); return; } let isMounted = true; setWeatherLoading(true); setWeatherError(null); navigator.geolocation.getCurrentPosition( async (position) => { if (!isMounted) return; const { latitude, longitude } = position.coords; try { const response = await fetchWithTimeout( `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${latitude},${longitude}&days=3`, {}, 15000); if (!response.ok) { let errorMsg = `Weather fetch failed (${response.status})`; try { const errorData = await response.json(); errorMsg = errorData?.error?.message || errorMsg; } catch {} throw new Error(errorMsg); } const data = await response.json(); if (isMounted) { setWeatherData(data); setWeatherLoading(false); } } catch (error: any) { if (isMounted) { console.error("Failed to fetch weather:", error); setWeatherData(null); if (error.message === 'Request timed out') { setWeatherError("Weather request timed out."); } else { setWeatherError(error.message || "Failed to fetch weather data."); } setWeatherLoading(false); } } }, (error) => { if (isMounted) { console.error("Geolocation error:", error); setWeatherData(null); let geoErrorMsg = "Geolocation Error"; switch(error.code) { case error.PERMISSION_DENIED: geoErrorMsg = "Location permission denied."; break; case error.POSITION_UNAVAILABLE: geoErrorMsg = "Location information is unavailable."; break; case error.TIMEOUT: geoErrorMsg = "Geolocation request timed out."; break; default: geoErrorMsg = `Geolocation Error: ${error.message}`; } setWeatherError(geoErrorMsg); setWeatherLoading(false); } }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 } ); return () => { isMounted = false; }; }, [user]);

  // Greeting Update Effect
  useEffect(() => { const interval = setInterval(() => { setGreeting(getTimeBasedGreeting()); setQuote(getRandomQuote()); }, 60000); return () => clearInterval(interval); }, []);

  // Smart Overview Generation Effect
  const [smartOverview, setSmartOverview] = useState<string>(""); const [overviewLoading, setOverviewLoading] = useState(false); const [lastGeneratedDataSig, setLastGeneratedDataSig] = useState<string>(""); const [lastResponse, setLastResponse] = useState<string>(""); const overviewTimeoutRef = useRef<NodeJS.Timeout | null>(null); const [debouncedItemsSigForOverview, setDebouncedItemsSigForOverview] = useState(""); const createItemsSignatureForOverview = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}-${item.data.priority || 'm'}-${item.data.task||item.data.goal||item.data.project||item.data.plan||''}`).sort().join('|'); useEffect(() => { if (!user) return; const currentSig = createItemsSignatureForOverview([tasks, goals, projects, plans]); if (overviewTimeoutRef.current) clearTimeout(overviewTimeoutRef.current); overviewTimeoutRef.current = setTimeout(() => setDebouncedItemsSigForOverview(currentSig), 1500); return () => { if (overviewTimeoutRef.current) clearTimeout(overviewTimeoutRef.current); }; }, [user, tasks, goals, projects, plans]); useEffect(() => { if (!user || !geminiApiKey || !debouncedItemsSigForOverview || userTier === 'loading' || userTier === 'basic') { setSmartOverview(""); setOverviewLoading(userTier === 'loading'); setLastGeneratedDataSig(""); setLastResponse(""); return; } if (debouncedItemsSigForOverview === lastGeneratedDataSig && !overviewLoading) return; const generateOverview = async () => { if (overviewLoading) return; setOverviewLoading(true); setSmartOverview(""); setLastGeneratedDataSig(debouncedItemsSigForOverview); const formatItem = (item: any, type: string) => { let dueDate: Date | null = null; if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate(); else if (item.data.dueDate) try { const d = new Date(item.data.dueDate); if (!isNaN(d.getTime())) dueDate = d; } catch { dueDate = null; } const title = item.data[type] || item.data.title || 'Untitled'; const priority = item.data.priority || calculatePriority(item); const completed = item.data.completed ? 'Completed' : 'Pending'; const dueDateFormatted = dueDate ? ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''; return `• ${title}${dueDateFormatted} [Priority: ${priority}] [Status: ${completed}]`; }; const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(i => !i.data.completed); const formattedData = allActiveItems.length > 0 ? allActiveItems.map(item => { if (item.data.task) return formatItem(item, 'task'); if (item.data.goal) return formatItem(item, 'goal'); if (item.data.project) return formatItem(item, 'project'); if (item.data.plan) return formatItem(item, 'plan'); return null; }).filter(Boolean).join('\n') : "No pending items."; if (formattedData === "No pending items.") { setSmartOverview(`No pending items to generate overview from.`); setOverviewLoading(false); setLastResponse(""); return; } const firstName = userName.split(" ")[0]; const prompt = `Analyze these pending items for user "${firstName}" and provide a *very concise* (1-2 sentences, max 80 tokens) Smart Overview focusing on the single most immediate priority or suggestion. Format as plain text. No greetings, no fluff.\n\n${formattedData}\n\nExample: Focus on high-priority 'Submit Report' due today. Next, tackle 'Plan Project Kickoff'.\nAnother Example: Check the overdue 'Draft Proposal' task first. Then review upcoming goals.\nAnother Example: Looks clear for today. Consider planning your next project step.\n\n`; try { const overviewEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`; const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 80, temperature: 0.5 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ] }) }; const response = await fetchWithTimeout(overviewEndpoint, geminiOptions, 20000); if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} throw new Error(`Gemini API error (${response.status}): ${errorBody}`); } const resultJson = await response.json(); const rawText = extractCandidateText(JSON.stringify(resultJson)); const cleanText = rawText.trim(); if (!cleanText || cleanText.toLowerCase().startsWith("error:") || cleanText.length < 5) { console.warn("Received invalid overview response:", cleanText); throw new Error("Received invalid overview response."); } if (cleanText !== lastResponse) { setLastResponse(cleanText); setSmartOverview(cleanText); } else { // Avoid flickering if response is identical
               setSmartOverview(lastResponse); } } catch (error: any) { console.error("Overview generation error:", error); let errorMsg = "AI overview currently unavailable."; if (error.message.includes('429') || error.message.includes('rate limit')) { errorMsg = "Overview limit reached. Try again later."; } else if (error.message.includes('API key not valid')) { errorMsg = "Invalid AI config."; } else if (error.message.includes('timed out') || error.message === 'Request timed out') { errorMsg = "Overview request timed out."; } else if (error.message.includes("invalid overview response")) { errorMsg = "AI failed to generate a valid overview."; } else if (error.message.includes("API Error")) { errorMsg = "Overview generation failed (API)."; } setSmartOverview(errorMsg); setLastResponse(""); setLastGeneratedDataSig(""); // Reset sig so it tries again later
           } finally { setOverviewLoading(false); } }; generateOverview(); }, [user, userTier, debouncedItemsSigForOverview, userName, geminiApiKey, lastResponse, lastGeneratedDataSig, overviewLoading]); // Added dependencies

  // Client-Side Smart Insights Effect
  const createItemsSignatureForInsights = (items: any[][]): string => items.flat().map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}`).sort().join('|'); useEffect(() => { if (!user) return; const currentSig = createItemsSignatureForInsights([tasks, goals, projects, plans]); if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current); insightTimeoutRef.current = setTimeout(() => setDebouncedItemsSigForInsights(currentSig), 2000); return () => { if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current); }; }, [user, tasks, goals, projects, plans]); useEffect(() => { if (!user || !debouncedItemsSigForInsights) return; const now = new Date(); now.setHours(0, 0, 0, 0); const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(item => !item.data.completed); let newInsights: SmartInsight[] = []; allActiveItems.forEach(item => { if (item.data.dueDate) { let dueDate: Date | null = null; if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate(); else try { const d = new Date(item.data.dueDate); if (!isNaN(d.getTime())) dueDate = d; } catch { dueDate = null; } if (dueDate) { dueDate.setHours(0, 0, 0, 0); if (dueDate < now) { const itemType = item.data.task ? 'task' : item.data.goal ? 'goal' : item.data.project ? 'project' : 'plan'; const itemName = item.data[itemType] || 'Untitled'; const insightId = `overdue-${item.id}`; newInsights.push({ id: insightId, text: `"${itemName}" (${itemType}) is overdue. Reschedule or mark complete?`, type: 'warning', relatedItemId: item.id, createdAt: new Date() }); } } } }); allActiveItems.forEach(item => { if (newInsights.some(ni => ni.relatedItemId === item.id && ni.type === 'warning')) return; if (item.data.dueDate) { let dueDate: Date | null = null; if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate(); else try { const d = new Date(item.data.dueDate); if (!isNaN(d.getTime())) dueDate = d; } catch { dueDate = null; } if (dueDate) { dueDate.setHours(0, 0, 0, 0); const diffTime = dueDate.getTime() - now.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays >= 0 && diffDays <= 2) { const itemType = item.data.task ? 'task' : item.data.goal ? 'goal' : item.data.project ? 'project' : 'plan'; const itemName = item.data[itemType] || 'Untitled'; const insightId = `upcoming-${item.id}`; newInsights.push({ id: insightId, text: `"${itemName}" (${itemType}) is due soon (${diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : 'in ' + diffDays + ' days'}). Plan time for it?`, type: 'suggestion', relatedItemId: item.id, createdAt: new Date() }); } } } }); setSmartInsights(prev => { const existingActive = prev.filter(i => !i.accepted && !i.rejected); const combined = [...newInsights, ...existingActive]; const uniqueMap = new Map<string, SmartInsight>(); combined.forEach(insight => uniqueMap.set(insight.id, insight)); return Array.from(uniqueMap.values()) .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort newest first
       .slice(0, 10); }); }, [user, debouncedItemsSigForInsights]);

  // Pomodoro Timer Interval Effect
  useEffect(() => { if (pomodoroRunning && pomodoroTimeLeft > 0) { pomodoroRef.current = setInterval(() => { setPomodoroTimeLeft((prev) => { if (prev <= 1) { clearInterval(pomodoroRef.current as NodeJS.Timer); setPomodoroRunning(false); setPomodoroFinished(true); if (!pomodoroAudioRef.current) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error("Error playing sound:", e)); pomodoroAudioRef.current = alarmAudio; } catch (e) { console.error("Could not create or play audio:", e); } } return 0; } return prev - 1; }); }, 1000); } else { if (pomodoroRef.current) clearInterval(pomodoroRef.current); } return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); }; }, [pomodoroRunning, pomodoroTimeLeft]);
  useEffect(() => { return () => { if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current = null; } }; }, []);

  // Custom Timer State Sync Effect
  useEffect(() => { setRunningTimers(prev => { const nextState: typeof prev = {}; customTimers.forEach(timer => { const sourceTime = timer.data.time; if (prev[timer.id]) { const localState = prev[timer.id]; nextState[timer.id] = { ...localState, timeLeft: localState.isRunning ? localState.timeLeft : (sourceTime !== localState.timeLeft && !localState.finished) ? sourceTime : localState.timeLeft, finished: localState.isRunning ? localState.finished : (sourceTime > 0 ? false : localState.finished) }; } else { nextState[timer.id] = { isRunning: false, timeLeft: sourceTime, intervalRef: null, finished: sourceTime <= 0 }; } }); Object.keys(prev).forEach(id => { if (!nextState[id]) { // Timer was deleted
         const timerState = prev[id]; if (timerState.intervalRef) clearInterval(timerState.intervalRef); if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; } } }); return nextState; }); }, [customTimers]);

  // Chat Scroll Effect
  useEffect(() => { if (chatEndRef.current && isAiSidebarOpen && aiSidebarTab === 'chat') { requestAnimationFrame(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }); } }, [currentChatHistory, isAiSidebarOpen, aiSidebarTab]);

  // ---------------------
  // HANDLER FUNCTIONS
  // ---------------------

  const handleToggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const handleTabChange = (tabId: string) => { setActiveTabId(tabId); setEditingItemId(null); setEditingSection(null); setIsCreatingSection(false); };

  // Item Creation Handler
  const handleCreate = async () => { if (!user || !newItemText.trim() || !activeCollectionName) { console.warn("Cannot create item: Missing user, text, or active collection."); return; } let dateValue: Date | null = null; if (newItemDate) { try { // Append time to ensure UTC interpretation if only date is provided
         const d = new Date(newItemDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { dateValue = d; } } catch { dateValue = null; } } let itemTypeForCreate: ItemType; let sectionId: string | null = null; const activeTab = availableTabs.find(t => t.id === activeTabId); if (activeTab?.type === 'default') { itemTypeForCreate = activeTab.id as ItemType; } else if (activeTab?.type === 'custom') { itemTypeForCreate = 'tasks'; // Custom tabs hold tasks
       sectionId = activeTab.id; } else { console.error("Cannot create item: Invalid active tab."); alert("Error: Could not determine item type."); return; } const titleField = itemTypeForCreate.slice(0, -1); // e.g., 'task', 'goal'
     const itemData = { [titleField]: newItemText, // Use dynamic field name
      dueDate: dateValue, priority: newItemPriority, sectionId: sectionId, completed: false, createdAt: Timestamp.now() }; try { await createItem(user.uid, itemTypeForCreate, itemData); setNewItemText(""); setNewItemDate(""); setNewItemPriority("medium"); } catch (error) { console.error(`Error creating ${itemTypeForCreate}:`, error); alert(`Failed to create ${itemTypeForCreate}. Please try again.`); } };

  const getTitleField = (itemData: any): string => { if (itemData.task !== undefined) return 'task'; if (itemData.goal !== undefined) return 'goal'; if (itemData.project !== undefined) return 'project'; if (itemData.plan !== undefined) return 'plan'; return 'task'; // Default fallback
   };

  // Item Edit Click Handler
  const handleEditClick = (itemId: string, currentData: any) => { const titleField = getTitleField(currentData); setEditingItemId(itemId); setEditingText(currentData[titleField] || ""); let dateForInput = ""; if (currentData.dueDate) { try { const dueDateObj = currentData.dueDate.toDate ? currentData.dueDate.toDate() : new Date(currentData.dueDate); if (!isNaN(dueDateObj.getTime())) { // Format as YYYY-MM-DD for the input field
           dateForInput = dueDateObj.toISOString().split('T')[0]; } } catch (e) { console.warn("Error converting date for editing:", e); } } setEditingDate(dateForInput); setEditingPriority(currentData.priority || 'medium'); setEditingSectionId(currentData.sectionId || null); };

  // Item Edit Save Handler
  const handleEditSave = async (itemId: string) => { if (!user || !editingText.trim()) return; let dateValue: Date | null = null; if (editingDate) { try { const d = new Date(editingDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { dateValue = d; } } catch { dateValue = null; } } const allItems = [...tasks, ...goals, ...projects, ...plans]; const originalItem = allItems.find(item => item.id === itemId); if (!originalItem) { console.error("Cannot save edit: Original item not found."); alert("Error: Could not find the item to update."); return; } let collectionToUpdate: ItemType; let titleField: string; if (originalItem.data.task !== undefined) { collectionToUpdate = 'tasks'; titleField = 'task'; } else if (originalItem.data.goal !== undefined) { collectionToUpdate = 'goals'; titleField = 'goal'; } else if (originalItem.data.project !== undefined) { collectionToUpdate = 'projects'; titleField = 'project'; } else if (originalItem.data.plan !== undefined) { collectionToUpdate = 'plans'; titleField = 'plan'; } else { console.error("Cannot save edit: Unknown item type."); alert("Error: Could not determine item type."); return; } try { const dataToUpdate: any = { [titleField]: editingText, dueDate: dateValue, priority: editingPriority, sectionId: editingSectionId, // Only update sectionId if it's a task
           }; // Ensure completed status is preserved if not explicitly changed
         // dataToUpdate.completed = originalItem.data.completed; // Keep existing completion status
         await updateItem(collectionToUpdate, itemId, dataToUpdate); setEditingItemId(null); } catch (error) { console.error(`Error updating ${collectionToUpdate.slice(0, -1)}:`, error); alert(`Failed to update ${collectionToUpdate.slice(0, -1)}. Please try again.`); } };

  // Item Delete Handler
  const handleDelete = async (itemId: string) => { if (!user) return; const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemToDelete = allItems.find(item => item.id === itemId); let collectionToDelete: ItemType | null = null; let typeString: string | null = null; if (itemToDelete) { if (itemToDelete.data.task !== undefined) { collectionToDelete = 'tasks'; typeString = 'task'; } else if (itemToDelete.data.goal !== undefined) { collectionToDelete = 'goals'; typeString = 'goal'; } else if (itemToDelete.data.project !== undefined) { collectionToDelete = 'projects'; typeString = 'project'; } else if (itemToDelete.data.plan !== undefined) { collectionToDelete = 'plans'; typeString = 'plan'; } } else if (activeCollectionName && activeCollectionName !== 'customTimers' && activeCollectionName !== 'sections' && activeCollectionName !== 'users') { collectionToDelete = activeCollectionName; typeString = activeCollectionName.slice(0, -1); console.warn(`Item ${itemId} not found in local state, attempting delete from active tab collection: ${collectionToDelete}`); } if (!collectionToDelete || !typeString) { console.error("Cannot delete: Unknown item type or collection for item ID:", itemId); alert("Error: Could not determine the type of item to delete."); return; } const confirmDel = window.confirm(`Are you sure you want to delete this ${typeString}? This action cannot be undone.`); if (!confirmDel) return; try { await deleteItem(collectionToDelete, itemId); setSmartInsights(prev => prev.filter(i => i.relatedItemId !== itemId)); // Remove related client-side insights
       if (editingItemId === itemId) setEditingItemId(null); } catch (error) { console.error(`Error deleting ${typeString}:`, error); alert(`Failed to delete ${typeString}. Please try again.`); } };

  // Mark Complete Handler
  const handleMarkComplete = async (itemId: string) => { if (!user) return; const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemToMark = allItems.find(item => item.id === itemId); if (!itemToMark) { console.error("Cannot mark complete: Item not found."); alert("Error: Could not find item."); return; } let collectionToUpdate: ItemType; if (itemToMark.data.task !== undefined) collectionToUpdate = 'tasks'; else if (itemToMark.data.goal !== undefined) collectionToUpdate = 'goals'; else if (itemToMark.data.project !== undefined) collectionToUpdate = 'projects'; else if (itemToMark.data.plan !== undefined) collectionToUpdate = 'plans'; else { console.error("Cannot mark complete: Unknown item type."); alert("Error: Could not determine item type."); return; } try { // Toggle completed status
       await markItemComplete(collectionToUpdate, itemId, !itemToMark.data.completed); } catch (error) { console.error("Error marking item as complete:", error); alert("Failed to update completion status."); } };

  // Section/Tab CRUD Handlers
  const handleCreateSection = async () => { if (!user || !newSectionName.trim()) return; try { const maxOrder = userSections.reduce((max, sec) => Math.max(max, sec.data.order || 0), 0); await createSection(user.uid, newSectionName.trim(), maxOrder + 1); setNewSectionName(""); setIsCreatingSection(false); } catch (error) { console.error("Error creating section:", error); alert("Failed to create tab."); } };
  const handleUpdateSection = async (sectionId: string, updates: { name?: string; hidden?: boolean }) => { if (!user) return; try { await updateSection(user.uid, sectionId, updates); setEditingSection(null); } catch (error) { console.error("Error updating section:", error); alert("Failed to update tab."); } };
  const handleDeleteSection = async (sectionId: string) => { if (!user) return; const sectionToDelete = userSections.find(sec => sec.id === sectionId); if (!sectionToDelete) return; const confirmDel = window.confirm(`Are you sure you want to delete the "${sectionToDelete.data.name}" tab? Items currently in this tab will need to be reassigned manually (move to default 'Tasks' recommended).`); if (!confirmDel) return; try { await deleteSection(user.uid, sectionId); if (activeTabId === sectionId) { setActiveTabId('tasks'); // Fallback to default
       } } catch (error) { console.error("Error deleting section:", error); alert("Failed to delete tab."); } };
  const handleToggleSectionVisibility = (section: TabDefinition) => { if (!user || section.isDefaultImmutable) return; if (section.type === 'default' && !userSections.some(us => us.id === section.id)) { // Default tab being hidden for the first time
      const confirmHide = window.confirm(`Hide the default "${section.name}" tab? You can unhide it later from settings (feature pending implementation).`); if (!confirmHide) return; // Determine a sensible default order for hidden default tabs
      let defaultOrder = 100; if (section.id === 'goals') defaultOrder = 101; if (section.id === 'projects') defaultOrder = 102; if (section.id === 'plans') defaultOrder = 103; createSection(user.uid, section.name, defaultOrder, true) // Create a tracking doc in sections collection
       .then(() => { if (activeTabId === section.id) setActiveTabId('tasks'); }) .catch(err => { console.error("Error hiding default section:", err); alert("Failed to hide tab."); }); } else { // Custom tab or default tab already tracked
       handleUpdateSection(section.id, { hidden: !section.hidden }); if (!section.hidden && activeTabId === section.id) { // If hiding the active tab, switch to tasks
         setActiveTabId('tasks'); } } };

  // Pomodoro Handlers
  const handlePomodoroStart = () => { if (pomodoroRunning || pomodoroFinished) return; setPomodoroRunning(true); setPomodoroFinished(false); if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; } if (pomodoroTimeLeft <= 0) { setPomodoroTimeLeft(25 * 60); } };
  const handlePomodoroPause = () => { if (!pomodoroRunning) return; setPomodoroRunning(false); };
  const handlePomodoroReset = () => { setPomodoroRunning(false); setPomodoroFinished(false); if (pomodoroRef.current) clearInterval(pomodoroRef.current); pomodoroRef.current = null; setPomodoroTimeLeft(25 * 60); if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; } };
  const formatPomodoroTime = (timeInSeconds: number) => { const mins = Math.floor(timeInSeconds / 60); const secs = timeInSeconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; };

  // Custom Timer Handlers
  const handleAddCustomTimer = async (name: string, durationMinutes: number) => { if (!user || !name || durationMinutes <= 0) return; try { await addCustomTimer(name.trim(), durationMinutes * 60, user.uid); setIsAddTimerModalOpen(false); } catch (error) { console.error("Error adding custom timer:", error); alert("Failed to add custom timer. Please try again."); } };
  const formatCustomTime = (timeInSeconds: number): string => { if (timeInSeconds < 0) timeInSeconds = 0; const hours = Math.floor(timeInSeconds / 3600); const remainder = timeInSeconds % 3600; const mins = Math.floor(remainder / 60); const secs = remainder % 60; if (hours > 0) { return `${hours.toString()}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; } else { return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; } };
  const startCustomTimer = (timerId: string) => { setRunningTimers((prev) => { const timerState = prev[timerId]; if (!timerState || timerState.isRunning || timerState.timeLeft <= 0) return prev; const newState = { ...prev }; const newTimerState = { ...timerState }; if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; } newTimerState.isRunning = true; newTimerState.finished = false; const intervalId = setInterval(() => { setRunningTimers((currentTimers) => { if (!currentTimers[timerId]) { clearInterval(intervalId); return currentTimers; } const updatedTimers = { ...currentTimers }; const tState = { ...updatedTimers[timerId] }; // Check if it was paused externally
           if (!tState.isRunning && tState.intervalRef) { clearInterval(tState.intervalRef); tState.intervalRef = null; updatedTimers[timerId] = tState; return updatedTimers; } // Check if finished while running
           if (tState.timeLeft <= 0 && tState.isRunning) { clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.intervalRef = null; tState.timeLeft = 0; updatedTimers[timerId] = tState; return updatedTimers; } if (tState.timeLeft <= 1) { // Handle finish condition within interval
             clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.timeLeft = 0; tState.intervalRef = null; if (!tState.audio) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error(`Error playing timer sound for ${timerId}:`, e)); tState.audio = alarmAudio; } catch(e) { console.error("Could not create/play audio:", e)} } } else { tState.timeLeft -= 1; } updatedTimers[timerId] = tState; return updatedTimers; }); }, 1000); newTimerState.intervalRef = intervalId; newState[timerId] = newTimerState; return newState; }); };
  const pauseCustomTimer = (timerId: string) => { setRunningTimers((prev) => { const timerState = prev[timerId]; if (!timerState || !timerState.isRunning) return prev; const newState = { ...prev }; const newTimerState = { ...timerState }; if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); newTimerState.intervalRef = null; } newTimerState.isRunning = false; newState[timerId] = newTimerState; return newState; }); };
  const resetCustomTimer = (timerId: string) => { const sourceTimerData = customTimers.find((t) => t.id === timerId)?.data; if (!sourceTimerData) { // Clean up state if source is gone
      setRunningTimers(prev => { const { [timerId]: _, ...rest } = prev; return rest; }); return; } const defaultTime = sourceTimerData.time; setRunningTimers((prev) => { const timerState = prev[timerId]; const newState = { ...prev }; const newTimerState = timerState ? { ...timerState } : { isRunning: false, timeLeft: defaultTime, intervalRef: null, finished: defaultTime <= 0, audio: undefined }; if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); } newTimerState.isRunning = false; newTimerState.timeLeft = defaultTime; newTimerState.intervalRef = null; newTimerState.finished = defaultTime <= 0; if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; } newState[timerId] = newTimerState; return newState; }); };
  const handleEditTimerClick = (timerId: string, currentName: string, currentTime: number) => { if (runningTimers[timerId]?.isRunning) { pauseCustomTimer(timerId); } setEditingTimerId(timerId); setEditingTimerName(currentName); setEditingTimerMinutes(String(Math.max(1, Math.floor(currentTime / 60)))); };
  const handleEditTimerSave = async (timerId: string) => { if (!editingTimerName.trim()) { alert("Please enter a timer name."); return; }; const minutes = parseInt(editingTimerMinutes, 10); if (isNaN(minutes) || minutes <= 0) { alert("Please enter a valid positive number for minutes."); return; } try { const newTimeSeconds = minutes * 60; await updateCustomTimer(timerId, editingTimerName.trim(), newTimeSeconds); // Update local state immediately for responsiveness
       setRunningTimers(prev => ({ ...prev, [timerId]: { ...prev[timerId], timeLeft: newTimeSeconds, finished: newTimeSeconds <= 0 } })); setEditingTimerId(null); } catch (error) { console.error("Error updating timer:", error); alert("Failed to update timer. Please try again."); } };
  const handleDeleteTimer = async (timerId: string) => { const confirmDel = window.confirm("Are you sure you want to delete this timer?"); if (!confirmDel) return; try { // Stop timer and clean up audio/interval before deleting
      setRunningTimers(prev => { const timerState = prev[timerId]; if (timerState) { if (timerState.intervalRef) clearInterval(timerState.intervalRef); if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; } } const { [timerId]: _, ...rest } = prev; return rest; }); await deleteCustomTimer(timerId); } catch (error) { console.error("Error deleting custom timer:", error); alert("Failed to delete timer. Please try again."); } };

  // Smart Insight Handlers (Client-side ones)
  const handleAcceptInsight = (insightId: string) => { const insight = smartInsights.find(i => i.id === insightId); if (!insight) return; setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: true, rejected: false } : i)); // If it's an overdue warning, focus the item for editing
     if (insight.relatedItemId && insight.type === 'warning' && insight.text.includes('overdue')) { const item = [...tasks, ...goals, ...projects, ...plans].find(i => i.id === insight.relatedItemId); if (item) { let itemCollection: ItemType | null = null; if (item.data.task !== undefined) itemCollection = 'tasks'; else if (item.data.goal !== undefined) itemCollection = 'goals'; else if (item.data.project !== undefined) itemCollection = 'projects'; else if (item.data.plan !== undefined) itemCollection = 'plans'; if (itemCollection) { if(activeTabId !== itemCollection && !availableTabs.find(t => t.id === itemCollection)?.hidden) { // Ensure tab isn't hidden
                 setActiveTabId(itemCollection); } setTimeout(() => handleEditClick(item.id, item.data), 50); // Delay slightly for tab switch
             } } } // Fade out non-critical accepted insights after a delay
     if (!(insight.type === 'warning' && insight.text.includes('overdue'))) { setTimeout(() => { setSmartInsights(prev => prev.filter(i => i.id !== insightId)); }, 3000); } };
  const handleRejectInsight = (insightId: string) => { setSmartInsights(prev => prev.map(i => i.id === insightId ? { ...i, accepted: false, rejected: true } : i)); setTimeout(() => { setSmartInsights(prev => prev.filter(i => i.id !== insightId || i.accepted)); // Keep accepted ones visually for a bit
     }, 2000); };

  // Progress Bar Memos
  const tasksProgress = useMemo(() => { const total = tasks.length; return total === 0 ? 0 : Math.round((tasks.filter(t => t.data.completed).length / total) * 100); }, [tasks]);
  const goalsProgress = useMemo(() => { const total = goals.length; return total === 0 ? 0 : Math.round((goals.filter(g => g.data.completed).length / total) * 100); }, [goals]);
  const projectsProgress = useMemo(() => { const total = projects.length; return total === 0 ? 0 : Math.round((projects.filter(p => p.data.completed).length / total) * 100); }, [projects]);
  const plansProgress = useMemo(() => { const total = plans.length; return total === 0 ? 0 : Math.round((plans.filter(pl => pl.data.completed).length / total) * 100); }, [plans]);

  // Format items for chat context
  const formatItemsForChat = () => { const lines: string[] = []; lines.push(`Current items for ${userName}:\n`); const formatLine = (item: any, type: string, sectionName?: string) => { const name = item.data[type] || 'Untitled'; const due = item.data.dueDate?.toDate?.(); const priority = item.data.priority || calculatePriority(item); const completed = item.data.completed ? 'Yes' : 'No'; const sectionInfo = sectionName ? ` [Tab: ${sectionName}]` : ''; return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${name}${ due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '' } [Priority: ${priority}] [Completed: ${completed}]${sectionInfo}`; }; const allItems = [...tasks, ...goals, ...projects, ...plans]; if (allItems.length === 0) return `No active items found for ${userName}.`; availableTabs.forEach(tab => { lines.push(`\n--- Tab: ${tab.name} ---`); let itemsInTab: any[] = []; if (tab.type === 'default') { if (tab.id === 'tasks') itemsInTab = tasks.filter(t => !t.data.sectionId); if (tab.id === 'goals') itemsInTab = goals; if (tab.id === 'projects') itemsInTab = projects; if (tab.id === 'plans') itemsInTab = plans; } else { // Custom tab
           itemsInTab = tasks.filter(t => t.data.sectionId === tab.id); } if (itemsInTab.length === 0) { lines.push(" (No items in this tab)"); } else { itemsInTab.forEach((item) => { const itemType = getTitleField(item.data); // Use helper to get type
           lines.push(formatLine(item, itemType, tab.name)); }); } }); return lines.join('\n'); };

  // Execute AI Recommended Action (from Chat or Deep Insights)
  // *** CORRECTED DATE HANDLING ***
  const executeAiAction = async (recommendation: AiActionRecommendation['data']) => { if (!user) return; console.log("Executing AI action:", recommendation); const { action, itemType, payload } = recommendation; try { let confirmationMessage = ''; if (action === 'create') { let dateValue: Date | null = null; if (payload.dueDate) { try { const d = new Date(payload.dueDate + 'T12:00:00Z'); // Assume UTC noon
              if (!isNaN(d.getTime())) dateValue = d; } catch { console.warn("Invalid date format in AI payload:", payload.dueDate); } } const titleField = itemType.slice(0, -1); await createItem(user.uid, itemType, { [titleField]: payload.text || 'AI Generated Item', dueDate: dateValue, priority: payload.priority || 'medium', sectionId: payload.sectionId || null, completed: false, createdAt: Timestamp.now() }); confirmationMessage = `✅ Action complete: Created ${itemType.slice(0,-1)} "${payload.text || ''}".`; } else if (action === 'update') { let itemIdToUpdate = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToUpdate && payload.itemName) { // Try to find item by name if ID is missing
             console.log(`Attempting to find ${itemType} named "${payload.itemName}" for update...`); itemIdToUpdate = await findItemByName(itemType, user.uid, payload.itemName, titleField); console.log(`Found item ID: ${itemIdToUpdate}`); } if (!itemIdToUpdate) throw new Error(`Could not find ${itemType.slice(0,-1)} named "${payload.itemName || '(name not provided)'}" to update.`); const { itemId, itemName, ...updates } = payload; // Prepare updates, handle date
          if (updates.dueDate) { try { const d = new Date(updates.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { updates.dueDate = d; } else { delete updates.dueDate; // Remove invalid date
                  console.warn("Invalid date format in AI update payload, removing:", updates.dueDate); } } catch { delete updates.dueDate; console.warn("Invalid date format in AI update payload, removing:", updates.dueDate); } } else if (updates.dueDate === null) { // Allow explicitly setting date to null
              updates.dueDate = null; } // Remove fields that shouldn't be directly updated this way
          delete updates.itemId; delete updates.itemName; delete updates.text; // Text/title updates should probably use a different mechanism or specific payload field
          if (Object.keys(updates).length === 0) { throw new Error("No valid fields provided for update."); } console.log("Applying updates:", updates, "to item ID:", itemIdToUpdate); await updateItem(itemType, itemIdToUpdate, updates); confirmationMessage = `✅ Action complete: Updated ${itemType.slice(0,-1)}.`; } else if (action === 'delete') { let itemIdToDelete = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToDelete && payload.itemName) { // Try to find item by name if ID is missing
             console.log(`Attempting to find ${itemType} named "${payload.itemName}" for deletion...`); itemIdToDelete = await findItemByName(itemType, user.uid, payload.itemName, titleField); console.log(`Found item ID: ${itemIdToDelete}`); } if (!itemIdToDelete) throw new Error(`Could not find ${itemType.slice(0,-1)} named "${payload.itemName || '(name not provided)'}" to delete.`); // No confirmation needed here, assume AI recommendation implies intent
           await deleteItem(itemType, itemIdToDelete); confirmationMessage = `✅ Action complete: Deleted ${itemType.slice(0,-1)}.`; } // Add confirmation to chat ONLY if AI sidebar is open and on chat tab
       if (isAiSidebarOpen && aiSidebarTab === 'chat' && selectedConversationId) { const confirmMsg: DisplayChatMessage = { id: `action-confirm-${Date.now()}`, role: 'assistant', content: confirmationMessage }; setCurrentChatHistory(prev => [...prev, confirmMsg]); saveChatMessage(selectedConversationId, { role: 'assistant', content: confirmationMessage }).catch(e => console.error("Failed to save action confirmation message:", e)); } } catch (error: any) { console.error("Error executing AI action:", error); const errorMsgContent = `❌ Error executing action: ${error.message || 'Unknown error'}.`; // Add error to chat ONLY if AI sidebar is open and on chat tab
        if (isAiSidebarOpen && aiSidebarTab === 'chat' && selectedConversationId) { const errorMsg: DisplayChatMessage = { id: `action-error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true }; setCurrentChatHistory(prev => [...prev, errorMsg]); saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent }).catch(e => console.error("Failed to save action error message:", e)); } // Potentially show a more global notification as well
        alert(`Failed to execute AI action: ${error.message || 'Unknown error'}`); // Simple alert as fallback
       } };

  // Handle Chat Submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading || !user || !selectedConversationId) {
        console.warn("Chat submit blocked:", { chatMessage: chatMessage.trim(), isChatLoading, user: !!user, selectedConversationId });
        return;
    }

    const currentMonthYear = new Date().toISOString().slice(0, 7);
    let limitReached = false;
    let currentLimit = Infinity; // Default to infinity

    if (userTier !== 'premium') {
        currentLimit = getChatLimitForTier(userTier);
        let currentCount = chatCount;
        if (chatMonth !== currentMonthYear) {
            console.log("Resetting chat count for new month.");
            currentCount = 0;
            setChatCount(0);
            setChatMonth(currentMonthYear);
            setIsChatLimitReached(false);
            limitReached = false;
            updateUserChatUsage(user.uid, 0, currentMonthYear).catch(err => console.error("Failed to reset chat usage:", err));
        } else {
            limitReached = currentCount >= currentLimit;
            setIsChatLimitReached(limitReached);
            // console.log("Usage check:", { currentCount, currentLimit, limitReached }); // Debug log
        }
    }

    if (limitReached) {
        console.warn("Chat limit reached.");
        const limitMsg: DisplayChatMessage = { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${currentLimit} chat message limit for this month. Upgrade for more interactions!`, error: true };
        setCurrentChatHistory(prev => [...prev, limitMsg]);
        setChatMessage('');
        return;
    }

    const currentMessage = chatMessage;
    setChatMessage('');
    const timerDuration = parseTimerRequest(currentMessage); // Check for timer request

    const userMsgData: FirebaseChatMessage = { role: 'user', content: currentMessage, createdAt: Timestamp.now() };
    const userMsgId = `user-${Date.now()}`;
    const userMsgDisplay: DisplayChatMessage = { ...userMsgData, id: userMsgId };

    setCurrentChatHistory(prev => [...prev, userMsgDisplay]);
    setIsChatLoading(true);

    try {
        await saveChatMessage(selectedConversationId, userMsgData);
    } catch (error) {
        console.error("Failed to save user message:", error);
        const errorMsg: DisplayChatMessage = { id: `err-save-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving your message. Please try again.", error: true };
        setCurrentChatHistory(prev => [...prev.filter(m => m.id !== userMsgId), errorMsg]); // Remove optimistic message on save failure
        setIsChatLoading(false);
        return;
    }

    // Increment usage count *after* successfully saving user message
    let newCount = chatCount;
    if (userTier !== 'premium' && user?.uid) {
        newCount = chatCount + 1;
        setChatCount(newCount);
        setIsChatLimitReached(newCount >= currentLimit);
        updateUserChatUsage(user.uid, newCount, currentMonthYear).catch(err => {
            console.error("Failed to update chat usage count:", err);
            // Don't necessarily block the chat, but log the error
            // const usageErrorMsg: DisplayChatMessage = { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count.", error: true };
            // setCurrentChatHistory(prevHist => [...prevHist, usageErrorMsg]);
        });
    }

    // Handle Timer Request specifically
    if (timerDuration) {
        const timerId = Math.random().toString(36).substring(2, 9);
        const timerMsgContent = `Okay, starting a timer for ${Math.round(timerDuration / 60)} minutes.`;
        const timerMsgData: FirebaseChatMessage = { role: 'assistant', content: timerMsgContent, timer: { type: 'timer', duration: timerDuration, id: timerId }, createdAt: Timestamp.now() };
        const timerMsgDisplay: DisplayChatMessage = { ...timerMsgData, id: `timer-start-${timerId}` };

        setCurrentChatHistory(prev => [...prev, timerMsgDisplay]);
        try {
            await saveChatMessage(selectedConversationId, timerMsgData);
        } catch(e) {
            console.error("Failed to save timer message:", e);
            // Handle save error if necessary, maybe remove the optimistic message
        }
        setIsChatLoading(false);
        return; // Stop processing, handled as timer
    }

    // --- Proceed with AI Chat ---
    // Select a limited history for context (e.g., last 6 messages = 3 turns)
    const limitedHistory = currentChatHistory.slice(-6);
    const conversationHistory = limitedHistory
        .map((m) => `${m.role === 'user' ? (userName || 'User') : 'Assistant'}: ${m.content}`)
        .join('\n');

    const itemsText = formatItemsForChat();
    const userContextText = userContext ? `Work Description: ${userContext.workDescription || 'Not set'}\nShort Term Focus: ${userContext.shortTermFocus || 'Not set'}\nLong Term Goals: ${userContext.longTermGoals || 'Not set'}\nOther Context: ${userContext.otherContext || 'Not set'}` : "User context not available.";
    const now = new Date();
    const currentDateTime = {
        date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    const prompt = `
[CONTEXT]
User's Name: ${userName || 'User'}
Current Date: ${currentDateTime.date}
Current Time: ${currentDateTime.time}
User Context:\n${userContextText}
User's Current Items (Grouped by Tab):\n${itemsText}
[CONVERSATION HISTORY (Last few turns)]\n${conversationHistory}
[NEW USER MESSAGE]\n${userName || 'User'}: ${currentMessage}

You are TaskMaster, a friendly and helpful AI productivity assistant. Engage conversationally. Provide productivity advice based on the user's items, context, priorities, and due dates.
Guidelines:
1. General Conversation: Respond naturally and directly to the user. Do NOT include your own instructions or meta comments in the response. Only reference items/context if relevant to the user's message.
2. Action Recommendations (JSON): *If and only if* your analysis strongly suggests creating, updating, or deleting a specific item (task/goal/project/plan) would be helpful based on the conversation, *optionally* propose it using ONE JSON object in a \`\`\`json block format AFTER your main text response. Use this format:
   \`\`\`json
   { "type": "actionRecommendation", "data": { "id": "rec-${Date.now()}", "action": "create"|"update"|"delete", "itemType": "tasks"|"goals"|"projects"|"plans", "payload": { /* payload details below */ }, "reasoning": "Concise reason for this suggestion based on the chat." } }
   \`\`\`
   - Create Payload: { "text": "Item Name", "dueDate": "YYYY-MM-DD" | null, "priority": "high"|"medium"|"low", "sectionId": "tab_id" | null } (text is required)
   - Update Payload: { "itemId": "existing_item_id" | null, "itemName": "Item Name" | null, "completed": true|false, "priority": "high"|"medium"|"low", "dueDate": "YYYY-MM-DD" | null } (MUST include either itemId or itemName if known, provide at least one field to update)
   - Delete Payload: { "itemId": "existing_item_id" | null, "itemName": "Item Name" | null } (MUST include either itemId or itemName if known)
   - Important: Only recommend ONE action per response. Prioritize based on urgency/importance/conversation context. Do NOT include this JSON block unless you are confident it's a direct, relevant, and actionable suggestion based *specifically* on the user's last message or immediate context. Do not proactively suggest actions unrelated to the current turn.
3. Flashcards/Quizzes (JSON): If the user *explicitly asks* for educational content like flashcards or a quiz on a topic, provide the data in ONE \`\`\`json block using the specified format (e.g., { "type": "flashcard", "data": [...] }). Do NOT include JSON for this unless explicitly requested.
4. Response Structure: Provide your conversational text response first. If including a JSON block (Action or Educational), place it *after* your text. Do not mix JSON within your main text. Be helpful and concise.

Assistant:`; // Let the AI start its response here

    const assistantMsgId = `assistant-${Date.now()}`;
    const placeholderMsg: DisplayChatMessage = { id: assistantMsgId, role: 'assistant', content: "...", createdAt: Timestamp.now() };
    setCurrentChatHistory(prev => [...prev, placeholderMsg]);

    let finalRawResponseText = "";
    let accumulatedStreamedText = ""; // Store the cleanly extracted text as it streams

    try {
        // console.log("Sending prompt to Gemini:", prompt); // Debug log
        if (!geminiApiKey) throw new Error("Gemini API key is not configured.");

        const geminiOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            })
        };

        // Stream the response
        await streamResponse(geminiEndpoint, geminiOptions, (rawChunkAccumulated) => {
            const currentExtractedText = extractCandidateText(rawChunkAccumulated);
            // console.log("Stream Update - Extracted Text:", currentExtractedText); // Debug log
            if (currentExtractedText && currentExtractedText !== accumulatedStreamedText) {
                 accumulatedStreamedText = currentExtractedText; // Update accumulated *clean* text
                 // Update the placeholder message with the latest clean text
                 setCurrentChatHistory(prev => prev.map(msg =>
                    msg.id === assistantMsgId ? { ...msg, content: accumulatedStreamedText || "..." } : msg
                 ));
            }
            finalRawResponseText = rawChunkAccumulated; // Keep track of the full raw response
        });

        // --- Process Final Response ---
        // console.log("Final Raw Response Text:", finalRawResponseText); // Debug log
        let finalExtractedAssistantText = extractCandidateText(finalRawResponseText) || "..."; // Extract text one last time
        // console.log("Final Extracted Text:", finalExtractedAssistantText); // Debug log

        let parsedJsonData: any = null;
        let jsonType: 'flashcard' | 'question' | 'actionRecommendation' | null = null;
        let recommendationData: AiActionRecommendation['data'] | undefined = undefined;
        let textForDisplay = finalExtractedAssistantText; // Start with the extracted text

        // Look for JSON blocks specifically
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
        const finalJsonMatch = finalRawResponseText.match(jsonBlockRegex); // Use final raw text to find JSON block

        if (finalJsonMatch && finalJsonMatch[1]) {
             // console.log("Found JSON block:", finalJsonMatch[1]); // Debug log
            try {
                const potentialJson = JSON.parse(finalJsonMatch[1].trim());
                 // console.log("Parsed JSON block:", potentialJson); // Debug log

                // Check for Action Recommendation
                if (potentialJson.type === 'actionRecommendation' && potentialJson.data?.action && potentialJson.data?.itemType && potentialJson.data?.payload && potentialJson.data?.reasoning) {
                    jsonType = 'actionRecommendation';
                    recommendationData = potentialJson.data;
                    parsedJsonData = potentialJson; // Keep the full parsed JSON if needed later
                    // Remove the JSON block from the displayed text
                    textForDisplay = textForDisplay.replace(finalJsonMatch[0], '').trim();
                    // If text becomes empty after removing JSON, use reasoning as text
                    if (!textForDisplay && recommendationData.reasoning) {
                        textForDisplay = recommendationData.reasoning;
                    } else if (!textForDisplay) {
                         textForDisplay = "I have a suggestion:"; // Fallback text
                    }
                     // console.log("Identified Action Recommendation"); // Debug log
                }
                // Check for Flashcard/Question (assuming structure)
                else if ((potentialJson.type === 'flashcard' || potentialJson.type === 'question') && Array.isArray(potentialJson.data) && potentialJson.data.length > 0) {
                    jsonType = potentialJson.type;
                    parsedJsonData = potentialJson;
                    textForDisplay = textForDisplay.replace(finalJsonMatch[0], '').trim();
                     if (!textForDisplay) {
                         textForDisplay = `Here are the ${parsedJsonData.type}s:`; // Provide context if text is only JSON
                    }
                    // console.log(`Identified ${jsonType}`); // Debug log
                } else {
                    // console.log("JSON block found but doesn't match expected structures."); // Debug log
                }

            } catch (e) {
                console.error('Failed to parse JSON block:', e, "Content:", finalJsonMatch[1]);
                // Keep textForDisplay as is, don't process JSON
            }
        } else {
             // console.log("No JSON block found in final response."); // Debug log
        }

        // Ensure textForDisplay isn't just "..." if we got something
        if (textForDisplay === "..." && accumulatedStreamedText) {
             textForDisplay = accumulatedStreamedText;
        } else if (textForDisplay === "...") {
             textForDisplay = "Sorry, I couldn't generate a response."; // Fallback error
             console.warn("Final extracted text was empty or '...', using fallback.");
        }

        const assistantMsgData: FirebaseChatMessage = {
            role: 'assistant',
            content: textForDisplay, // Use the text possibly modified by JSON removal
            createdAt: Timestamp.now(),
            ...(jsonType === 'flashcard' && { flashcard: parsedJsonData }),
            ...(jsonType === 'question' && { question: parsedJsonData }),
            // We store the *recommendation data* separately in the DisplayChatMessage, not in Firebase
        };

        // Final update to the chat history with all processed data
        setCurrentChatHistory(prev => prev.map(msg =>
            msg.id === assistantMsgId ? {
                ...msg,
                content: textForDisplay, // Final text
                flashcard: jsonType === 'flashcard' ? parsedJsonData : undefined,
                question: jsonType === 'question' ? parsedJsonData : undefined,
                recommendation: recommendationData // Attach recommendation data for UI interaction
            } : msg
        ));

        // Save the assistant message (without recommendation data) to Firebase
        try {
            await saveChatMessage(selectedConversationId, assistantMsgData);
        } catch (error) {
            console.error("Failed to save assistant message:", error);
            const saveErrorMsg: DisplayChatMessage = { id: `err-save-assist-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving my response.", error: true };
            setCurrentChatHistory(prev => [...prev, saveErrorMsg]);
        }

    } catch (err: any) {
        console.error('Chat Submit Error:', err);
        // Construct a more informative error message
        let errorMsgContent = "Sorry, I encountered an error processing your request.";
        if (err.message) {
            if (err.message.includes('API key not valid')) {
                errorMsgContent = "Error: AI configuration issue (invalid API key). Please contact support.";
            } else if (err.message.includes('timed out')) {
                errorMsgContent = "Error: The request timed out. Please try again.";
            } else if (err.message.includes('API Error') || err.message.includes('API Request Failed')) {
                 // Try to extract a specific message from the API error if possible
                 const apiMsgMatch = err.message.match(/API Error \(\d+\): (.*)/) || err.message.match(/API Request Failed \(\d+\):.*?(\{.*\}|.*)/);
                 if (apiMsgMatch && apiMsgMatch[1]) {
                    try {
                        // Check if it's JSON within the message
                        const errorJson = JSON.parse(apiMsgMatch[1].trim());
                        errorMsgContent = `Error from AI service: ${errorJson.error?.message || apiMsgMatch[1].trim()}`;
                    } catch {
                         errorMsgContent = `Error from AI service: ${apiMsgMatch[1].trim()}`;
                    }
                 } else {
                    errorMsgContent = `Error communicating with AI service (${err.message}). Please try again.`;
                 }
            } else {
                 errorMsgContent = `Sorry, an unexpected error occurred: ${err.message}`;
            }
        }

        // Update the placeholder with the error or add a new error message
        setCurrentChatHistory(prev => {
            let updated = false;
            const updatedHistory = prev.map(msg => {
                if (msg.id === assistantMsgId) {
                    updated = true;
                    return { ...msg, content: errorMsgContent, error: true };
                }
                return msg;
            });
            // If placeholder wasn't found (e.g., error before placeholder was added), add new error message
            if (!updated) {
                updatedHistory.push({ id: `error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() });
            }
            // Attempt to save the error message to Firebase history
            saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, createdAt: Timestamp.now() })
                .catch(e => console.error("Failed to save error message to chat history:", e));
            return updatedHistory;
        });
    } finally {
        setIsChatLoading(false);
    }
};


  // Handle starting a new chat conversation
  const handleNewChat = async () => { if (!user) return; setIsChatLoading(true); // Use chat loading indicator for this too
     try { const newChatName = `Chat ${new Date().toLocaleString()}`; const newId = await createChatConversation(user.uid, newChatName); setSelectedConversationId(newId); // Switch to the new chat
       setCurrentChatHistory([]); // Clear history for the new chat
       setAiSidebarTab('chat'); // Ensure chat tab is active
     } catch (error) { console.error("Error creating new chat:", error); alert("Failed to start new chat."); } finally { setIsChatLoading(false); } };

  // Handle Generating AI Insights
  const generateAiInsights = async () => { if (!user || aiGeneratedInsights.isLoading || !geminiApiKey) { console.warn("Insight generation skipped:", { user: !!user, loading: aiGeneratedInsights.isLoading, key: !!geminiApiKey }); return; } setAiGeneratedInsights(prev => ({ ...prev, isLoading: true, error: null, recommendations: [] })); // Clear old recommendations
     const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemsSignature = createItemsSignatureForOverview(allItems); const itemsText = formatItemsForChat(); const userContextText = userContext ? `Work: ${userContext.workDescription || 'N/A'}\nFocus: ${userContext.shortTermFocus || 'N/A'}\nGoals: ${userContext.longTermGoals || 'N/A'}\nOther: ${userContext.otherContext || 'N/A'}` : "User context not available."; const prompt = ` Analyze the following user data for ${userName || 'User'} and provide productivity insights. Focus on actionable, concise info. Be realistic. [USER CONTEXT]\n${userContextText}\n[USER ITEMS]\n${itemsText}\n[INSTRUCTIONS] Generate a JSON object ONLY with the following structure: { "productivityScore": number (0-100, estimate based on completion, deadlines, priorities), "timeManagementAnalysis": string (brief analysis of potential bottlenecks or successes based on due dates/overdue items), "potentialConflicts": string (identify potential conflicts between items or lack of planning), "additionalInsights": string (any other relevant observation or encouragement), "recommendations": [ { "type": "tasks"|"goals"|"projects"|"plans", "action": "create"|"update"|"delete", "payload": { /* Follow payload structure from chat guidelines */ }, "description": string (what the user should do, e.g., "Create task for 'X'"), "reasoning": string (why this is recommended), "impact": string (expected positive outcome) } ] } Return ONLY the JSON object. No other text.`; try { const insightEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`; const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 1000, responseMimeType: "application/json" // Request JSON directly
          }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ] }) }; const response = await fetchWithTimeout(insightEndpoint, geminiOptions, 35000); if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} throw new Error(`Insights API error (${response.status}): ${errorBody}`); } // Gemini should return JSON directly due to responseMimeType
       const resultJson = await response.json(); let insightsData; if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) { try { insightsData = JSON.parse(resultJson.candidates[0].content.parts[0].text); } catch (parseError) { console.error("Failed to parse insights JSON from text:", parseError, "Raw Text:", resultJson.candidates[0].content.parts[0].text); throw new Error("AI returned invalid insight JSON format."); } } else { console.error("Unexpected insights response structure:", resultJson); throw new Error("Received unexpected insight data structure."); } const processedRecommendations: DeepInsightAction[] = []; if (Array.isArray(insightsData.recommendations)) { for (const rec of insightsData.recommendations) { try { // Validate recommendation structure before creating DB entry
             if (!rec.type || !rec.action || !rec.payload || !rec.description || !rec.reasoning || !rec.impact) { console.warn("Skipping invalid recommendation structure:", rec); continue; } const newAction = await createDeepInsightAction(user.uid, { type: rec.type, // Should match itemType
                actionPayload: { // Nest the AI payload here
                   action: rec.action, itemType: rec.type, payload: rec.payload }, description: rec.description, reasoning: rec.reasoning, impact: rec.impact, status: 'pending', // Ensure status is set
                createdAt: Timestamp.now() // Ensure timestamp
              }); processedRecommendations.push(newAction); } catch (recError) { console.error("Error creating DeepInsightAction in DB:", recError, rec); } } } setAiGeneratedInsights({ score: insightsData.productivityScore, timeManagement: insightsData.timeManagementAnalysis, conflicts: insightsData.potentialConflicts, other: insightsData.additionalInsights, recommendations: [], // Recommendations are now stored separately in pendingInsightActions
         isLoading: false, error: null, lastGeneratedSig: itemsSignature }); // Update pending state via the listener implicitly
      } catch (error: any) { console.error("Error generating AI insights:", error); setAiGeneratedInsights(prev => ({ ...prev, isLoading: false, error: `Failed to generate insights: ${error.message || 'Unknown error'}`, recommendations: [] })); } };

  // Handlers for accepting/declining DeepInsightActions
  // *** Ensure this calls the corrected executeAiAction ***
  const handleAcceptDeepInsight = async (action: DeepInsightAction) => { if (!user) return; try { console.log("Accepting Deep Insight:", action); await updateDeepInsightActionStatus(action.id, 'accepted'); // Mark as accepted first
       if (action.actionPayload?.action && action.actionPayload?.itemType && action.actionPayload?.payload) { // Prepare data for executeAiAction
         const recommendationForExecution: AiActionRecommendation['data'] = { id: `deepinsight-${action.id}`, action: action.actionPayload.action, itemType: action.actionPayload.itemType as ItemType, // Cast needed here
            payload: action.actionPayload.payload, reasoning: action.reasoning // Pass reasoning for context if needed by executeAiAction
          }; console.log("Calling executeAiAction for Deep Insight:", recommendationForExecution); await executeAiAction(recommendationForExecution); // Execute the action using the corrected function
        } else { console.warn("Cannot execute accepted DeepInsight: Invalid or missing actionPayload", action.actionPayload); alert("Insight accepted, but the action details were invalid. No changes made."); } } catch (error: any) { console.error("Error accepting DeepInsight:", error); alert(`Failed to accept insight action: ${error.message || 'Unknown error'}`); // Try to rollback status if execution failed? Maybe not needed.
       await updateDeepInsightActionStatus(action.id, 'pending').catch(rollbackError => console.error("Failed to rollback insight status:", rollbackError)); } };

  const handleDeclineDeepInsight = async (actionId: string) => { try { await updateDeepInsightActionStatus(actionId, 'declined'); } catch (error) { console.error("Error declining DeepInsight:", error); alert("Failed to decline insight action."); } };

  // Handle timer complete callback (from Timer component)
  const handleTimerComplete = (timerId: string) => { const completionMsgContent = `⏰ Timer finished!`; const completionMsg: DisplayChatMessage = { id: `timer-complete-${timerId}-${Date.now()}`, role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev, completionMsg]); if (selectedConversationId) { saveChatMessage(selectedConversationId, { role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() }) .catch(e => console.error("Failed to save timer completion message:", e)); } };

  // ---------------------
  // MEMOS & DERIVED STATE
  // ---------------------
  const currentItems: Array<{ id: string; data: any }> = useMemo(() => { const tab = availableTabs.find(t => t.id === activeTabId); if (!tab) return []; if (tab.type === 'default') { switch (tab.id) { case 'tasks': return tasks.filter(t => !t.data.sectionId); // Only show non-sectioned tasks here
         case 'goals': return goals; case 'projects': return projects; case 'plans': return plans; default: return []; } } else { // Custom tab (show tasks assigned to this section)
       return tasks.filter(t => t.data.sectionId === tab.id); } }, [activeTabId, tasks, goals, projects, plans, availableTabs]);

  const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

  // ---------------------
  // THEME & STYLE VARIABLES
  // ---------------------
  const headlineColor = isIlluminateEnabled ? "text-green-700" : "text-green-400"; const illuminateHighlightToday = isIlluminateEnabled ? "bg-blue-100 text-blue-700 font-semibold" : "bg-blue-500/30 text-blue-200 font-semibold"; const illuminateHighlightDeadline = isIlluminateEnabled ? "bg-red-100 hover:bg-red-200" : "bg-red-500/20 hover:bg-red-500/30"; const illuminateHoverGray = isIlluminateEnabled ? "hover:bg-gray-200/60" : "hover:bg-gray-700/50"; const illuminateTextBlue = isIlluminateEnabled ? "text-blue-700" : "text-blue-400"; const illuminateTextPurple = isIlluminateEnabled ? "text-purple-700" : "text-purple-400"; const illuminateTextGreen = isIlluminateEnabled ? "text-green-700" : "text-green-400"; const illuminateTextPink = isIlluminateEnabled ? "text-pink-700" : "text-pink-400"; const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-700" : "text-yellow-400"; const illuminateBorder = isIlluminateEnabled ? "border-gray-300" : "border-gray-600/80"; const illuminateIconColor = isIlluminateEnabled ? "text-gray-500" : "text-gray-400"; const illuminateBgHover = isIlluminateEnabled ? "hover:bg-gray-100" : "hover:bg-gray-700"; const containerClass = isIlluminateEnabled ? "bg-gray-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200"; const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/70 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/50 shadow-lg shadow-black/20"; const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100"; const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400"; const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/50 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 hover:bg-gray-600/50 border-gray-600 focus:border-blue-500 focus:ring-blue-500"; const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";

  // ---------------------
  // JSX STRUCTURE
  // ---------------------
  return (
    <div className={`${containerClass} min-h-screen w-full overflow-x-hidden relative font-sans`}>
      {/* Sidebar */}
      <Sidebar userName={userName} isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />

      {/* Add Timer Modal */}
      {isAddTimerModalOpen && ( <AddTimerModal isOpen={isAddTimerModalOpen} onClose={() => setIsAddTimerModalOpen(false)} onAddTimer={handleAddCustomTimer} isIlluminateEnabled={isIlluminateEnabled} /> )}

      {/* AI Sidebar Toggle Button */}
      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${ isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8' } z-40 p-2.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${ isIlluminateEnabled ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' } ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open TaskMaster AI Chat" aria-label="Open TaskMaster AI Chat" > <BrainCircuit className="w-5 h-5" /> </button>

      {/* Main Content Area */}
      <main className={`transition-all duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64'} p-3 md:p-4 lg:p-5 xl:p-6 overflow-x-hidden`} >
         {/* Header Row */}
         <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          {/* Greeting & Quote */}
          <header className={`dashboard-header w-full lg:w-auto animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-500 ease-out pt-1 lg:pt-0`}>
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 ${headingClass} break-words`} >
              {React.cloneElement(greeting.icon, { className: `w-5 h-5 lg:w-6 lg:h-6 inline-block align-middle mr-1.5 -translate-y-0.5 ${greeting.color ? `text-${greeting.color}-500` : illuminateIconColor}`, })}
              {greeting.greeting},{' '}
              <span className="font-semibold"> {userName ? userName.split(' ')[0] : '...'} </span>
            </h1>
            <p className={`italic text-xs md:text-sm ${subheadingClass}`}> "{quote.text}" -{' '} <span className={illuminateTextPurple}> {quote.author} </span> </p>
          </header>
          {/* Week Navigator */}
          <div className={`${cardClass} rounded-xl p-1.5 sm:p-2 min-w-[260px] sm:min-w-[300px] w-full max-w-full lg:max-w-[350px] h-[65px] sm:h-[70px] transform hover:scale-[1.01] transition-all duration-300 flex-shrink-0 overflow-hidden animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-100`} >
            <div className="grid grid-cols-9 gap-px sm:gap-0.5 h-full">
              <button onClick={() => { const prevWeek = new Date(currentWeek[0]); prevWeek.setDate(prevWeek.getDate() - 7); setCurrentWeek(getWeekDates(prevWeek)); }} className={`w-5 sm:w-6 h-full flex items-center justify-center ${iconColor} ${illuminateHoverGray} rounded-lg transition-colors`} title="Previous Week" > <ChevronLeft className="w-4 h-4" /> </button>
              <div className="col-span-7">
                 <div className="grid grid-cols-7 gap-px sm:gap-0.5 h-full">
                    {/* Day Labels */}
                    <div className="col-span-7 grid grid-cols-7 gap-px sm:gap-0.5"> {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map( (day, index) => ( <div key={index} className={`text-center text-[9px] font-medium ${subheadingClass} pt-0.5`}> {day} </div> ))} </div>
                    {/* Dates */}
                    {currentWeek.map((date) => {
                        const dateStr = formatDateForComparison(date);
                        const allItems = [...tasks, ...goals, ...projects, ...plans];
                        const hasDeadline = allItems.some((item) => {
                           if (!item?.data?.dueDate) return false;
                           try {
                                const itemDate = item.data.dueDate.toDate ? item.data.dueDate.toDate() : new Date(item.data.dueDate);
                                return formatDateForComparison(itemDate) === dateStr;
                           } catch { return false; }
                        });
                        const isToday = dateStr === formatDateForComparison(new Date()); // Compare with current date
                        const todayClass = illuminateHighlightToday;
                        const deadlineClass = illuminateHighlightDeadline;
                        const defaultHover = illuminateHoverGray;
                        return (
                           <div key={dateStr} className={`relative w-full h-5 text-center rounded transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] ${ isToday ? todayClass : `${subheadingClass} ${defaultHover}` } ${hasDeadline && !isToday ? `${deadlineClass} font-medium` : ''} `} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} >
                              <span>{date.getDate()}</span>
                              {hasDeadline && !isToday && ( <div className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${isIlluminateEnabled ? 'bg-red-500' : 'bg-red-400'}`}></div> )}
                           </div>
                        );
                    })}
                 </div>
              </div>
              <button onClick={() => { const nextWeek = new Date(currentWeek[0]); nextWeek.setDate(nextWeek.getDate() + 7); setCurrentWeek(getWeekDates(nextWeek)); }} className={`w-5 sm:w-6 h-full flex items-center justify-center ${iconColor} ${illuminateHoverGray} rounded-lg transition-colors`} title="Next Week" > <ChevronRight className="w-4 h-4" /> </button>
            </div>
          </div>
        </div>

        {/* AI Smart Insights (Client-side) */}
        {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length > 0 && (
           <div className={`${cardClass} rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 animate-fadeIn relative overflow-hidden ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-200`} >
             <div className={`absolute inset-0 ${isIlluminateEnabled ? 'bg-gradient-to-r from-blue-50/30 to-purple-50/30' : 'bg-gradient-to-r from-blue-900/10 to-purple-900/10'} pointer-events-none opacity-50`}></div>
             <div className="flex items-center justify-between mb-2 z-10 relative">
               <h2 className={`text-base sm:text-lg font-semibold flex items-center ${illuminateTextBlue}`}>
                 <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 animate-pulse" /> Local Insights
                 <span className="ml-1.5 text-[10px] sm:text-xs bg-gradient-to-r from-pink-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full">
                   {smartInsights.filter(insight => !insight.accepted && !insight.rejected).length} New
                 </span>
               </h2>
               <button onClick={() => setShowInsightsPanel(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${ isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-700' }`} title={showInsightsPanel ? "Collapse Insights" : "Expand Insights"} >
                 {showInsightsPanel ? <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
               </button>
             </div>
             <div className={`space-y-2 transition-all duration-300 ease-out overflow-hidden z-10 relative ${showInsightsPanel ? 'max-h-96 opacity-100 pt-1' : 'max-h-0 opacity-0'}`}>
                {smartInsights
                   .filter(insight => !insight.accepted && !insight.rejected)
                   .map((insight, index) => (
                      <div
                         key={insight.id}
                         className={`p-2 rounded-lg flex items-center justify-between gap-2 animate-slideInRight ${
                            insight.type === 'warning' ? isIlluminateEnabled ? 'bg-red-100/80' : 'bg-red-900/40' :
                            insight.type === 'suggestion' ? isIlluminateEnabled ? 'bg-blue-100/80' : 'bg-blue-900/40' :
                            isIlluminateEnabled ? 'bg-green-100/80' : 'bg-green-900/40'
                         }`}
                         style={{ animationDelay: `${index * 70}ms` }}
                      >
                         <div className="flex items-center gap-1.5 flex-grow overflow-hidden">
                            {insight.type === 'warning' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                            {insight.type === 'suggestion' && <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                            {insight.type === 'achievement' && <Award className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            <p className="text-xs sm:text-sm flex-grow truncate" title={insight.text}>{insight.text}</p>
                         </div>
                         <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => handleAcceptInsight(insight.id)} className="p-1 rounded-full bg-green-500/80 text-white hover:bg-green-600 transition-colors" title="Accept" >
                               <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRejectInsight(insight.id)} className="p-1 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors" title="Reject" >
                               <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>
                ))}
             </div>
           </div>
        )}

        {/* AI Smart Overview (Server-side) */}
        <div className={`${cardClass} rounded-xl p-3 sm:p-4 relative min-h-[80px] transition-all duration-300 ease-out animate-fadeIn mb-4 sm:mb-5 ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-300`} >
           <div className="flex flex-wrap items-center gap-2 mb-1.5">
             <h2 className={`text-base sm:text-lg font-semibold mr-1 flex items-center ${illuminateTextBlue}`}>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 text-yellow-400 animate-pulse" /> Smart Overview
             </h2>
             {userTier === 'pro' && ( <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-teal-400 to-cyan-500 text-white px-1.5 py-0.5 rounded-full font-medium"> PRO </span> )}
             {userTier === 'premium' && ( <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium"> PREMIUM </span> )}
           </div>
           {userTier === 'loading' ? (
              <div className="animate-pulse space-y-1.5 pt-1"> <div className={`h-3 rounded-full w-1/2 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> </div>
           ) : userTier === 'basic' ? (
              <div className={`text-xs italic flex items-center justify-start gap-1.5 py-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                 <span>Smart Overview is a Pro/Premium feature.</span>
                 <Link to="/pricing" className={`font-medium ml-1 ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline not-italic`} > Upgrade now </Link>
              </div>
           ) : overviewLoading ? (
              <div className="space-y-1.5 animate-pulse pt-1">
                 <div className={`h-3 rounded-full w-11/12 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                 <div className={`h-3 rounded-full w-3/4 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
              </div>
           ) : (
              <>
                 <div className={`text-xs sm:text-sm prose-sm max-w-none animate-fadeIn ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} leading-snug ${smartOverview.includes('unavailable') || smartOverview.includes('failed') || smartOverview.includes('limit') || smartOverview.toLowerCase().includes('error') ? (isIlluminateEnabled ? 'text-yellow-700 italic' : 'text-yellow-500 italic') : ''}`} >
                    {smartOverview || "Add items or check back later for an overview."}
                 </div>
                 {smartOverview && !smartOverview.includes('unavailable') && !smartOverview.includes('failed') && !smartOverview.includes('limit') && !smartOverview.includes('No pending items') && !smartOverview.toLowerCase().includes('error') && (
                    <div className="mt-1.5 text-left text-[10px] text-gray-500/80"> AI responses may be inaccurate. Verify critical info. </div>
                 )}
              </>
           )}
        </div>

        {/* Main Content Grid (Left/Right Columns) */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-400`}>

           {/* LEFT COLUMN */}
           <div className="flex flex-col gap-4 sm:gap-5">

             {/* Productivity/Analytics Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
                 <div className="flex justify-between items-center mb-3">
                    <h2 className={`text-base sm:text-lg font-semibold ${illuminateTextPurple} flex items-center`}>
                       <TrendingUp className="w-5 h-5 mr-1.5" /> Productivity
                    </h2>
                    <button onClick={() => setShowAnalytics(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${ isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-700' } flex items-center gap-1 text-[10px] sm:text-xs`} title={showAnalytics ? "Show Basic Progress" : "Show Analytics"} >
                       {showAnalytics ? <PieChart className="w-3.5 h-3.5" /> : <BarChart className="w-3.5 h-3.5" /> }
                       <span>{showAnalytics ? 'Analytics' : 'Progress'}</span>
                    </button>
                 </div>
                 {showAnalytics ? (
                    <div className="animate-fadeIn min-h-[150px]">
                       <EnhancedTaskAnalytics tasks={tasks} goals={goals} projects={projects} plans={plans} sections={userSections} isIlluminateEnabled={isIlluminateEnabled} />
                    </div>
                 ) : ( // Basic Progress Bars
                    <div className="space-y-3 animate-fadeIn">
                       {(tasks.length > 0 || goals.length > 0 || projects.length > 0 || plans.length > 0) ? (
                          <>
                             {tasks.length > 0 && (
                                <div>
                                   <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm">
                                      <p className="flex items-center font-medium"> <Clipboard className="w-3.5 h-3.5 mr-1 text-gray-400" /> Tasks </p>
                                      <p className={`${illuminateTextGreen} font-semibold text-xs`}> {tasks.filter(t => t.data.completed).length}/{tasks.length} ({tasksProgress}%) </p>
                                   </div>
                                   <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${tasksProgress}%` }} /> </div>
                                </div>
                             )}
                             {goals.length > 0 && (
                                <div>
                                   <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm">
                                      <p className="flex items-center font-medium"> <Target className="w-3.5 h-3.5 mr-1 text-gray-400" /> Goals </p>
                                      <p className={`${illuminateTextPink} font-semibold text-xs`}> {goals.filter(g => g.data.completed).length}/{goals.length} ({goalsProgress}%) </p>
                                   </div>
                                   <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${goalsProgress}%` }} /> </div>
                                </div>
                             )}
                              {/* Only show Projects/Plans progress if tab is visible */}
                             {!availableTabs.find(t => t.id === 'projects')?.hidden && projects.length > 0 && (
                                <div>
                                   <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm">
                                      <p className="flex items-center font-medium"> <Layers className="w-3.5 h-3.5 mr-1 text-gray-400" /> Projects </p>
                                      <p className={`${illuminateTextBlue} font-semibold text-xs`}> {projects.filter(p => p.data.completed).length}/{projects.length} ({projectsProgress}%) </p>
                                   </div>
                                   <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${projectsProgress}%` }} /> </div>
                                </div>
                             )}
                             {!availableTabs.find(t => t.id === 'plans')?.hidden && plans.length > 0 && (
                                <div>
                                   <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm">
                                      <p className="flex items-center font-medium"> <Rocket className="w-3.5 h-3.5 mr-1 text-gray-400" /> Plans </p>
                                      <p className={`${illuminateTextYellow} font-semibold text-xs`}> {plans.filter(p => p.data.completed).length}/{plans.length} ({plansProgress}%) </p>
                                   </div>
                                   <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${plansProgress}%` }} /> </div>
                                </div>
                             )}
                          </>
                       ) : (
                          <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}>
                             <Lightbulb className="w-4 h-4 mr-1.5 text-yellow-400" /> Add items to track your progress.
                          </p>
                       )}
                    </div>
                 )}
             </div>

             {/* Upcoming Deadlines Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
                <h2 className={`text-base sm:text-lg font-semibold mb-3 ${illuminateTextBlue} flex items-center`}>
                   <Calendar className="w-5 h-5 mr-1.5" /> Upcoming
                </h2>
                {(() => {
                   const allItems = [...tasks, ...goals, ...projects, ...plans];
                   const now = new Date(); now.setHours(0, 0, 0, 0); // Use normalized today

                   const upcomingDeadlines = allItems
                      .filter(item => {
                         const { dueDate, completed } = item.data;
                         if (!dueDate || completed) return false;
                         try {
                            const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
                            dueDateObj.setHours(0, 0, 0, 0); // Normalize deadline date
                            return dueDateObj >= now; // Due today or later
                         } catch { return false; }
                      })
                      .sort((a, b) => { // Sort by date ascending
                         try {
                            const aDate = a.data.dueDate.toDate ? a.data.dueDate.toDate() : new Date(a.data.dueDate);
                            const bDate = b.data.dueDate.toDate ? b.data.dueDate.toDate() : new Date(b.data.dueDate);
                            return aDate.getTime() - bDate.getTime();
                         } catch { return 0; }
                      })
                      .slice(0, 5); // Show top 5 upcoming

                   if (!upcomingDeadlines.length) {
                      return (
                         <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}>
                            <CheckCircle className="w-4 h-4 mr-1.5 text-green-400" /> All caught up! No upcoming deadlines.
                         </p>
                      );
                   }

                   return (
                      <ul className="space-y-2">
                         {upcomingDeadlines.map((item, index) => {
                            const { id, data } = item;
                            const itemType = getTitleField(data); // Use helper
                            const dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
                            const dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            const itemName = data[itemType.toLowerCase()] || 'Untitled';

                            // Calculate days remaining relative to normalized today
                            const normalizedDueDate = new Date(dueDateObj);
                            normalizedDueDate.setHours(0,0,0,0);
                            const daysRemaining = Math.ceil((normalizedDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                            let urgencyColor = isIlluminateEnabled ? 'border-l-gray-300' : 'border-l-gray-600';
                            let urgencyText = '';
                            let urgencyClass = '';

                            if (daysRemaining <= 0) { // Due Today
                               urgencyColor = 'border-l-red-500'; urgencyText = 'Today!'; urgencyClass = isIlluminateEnabled ? 'text-red-600' : 'text-red-400';
                            } else if (daysRemaining <= 1) { // Due Tomorrow
                               urgencyColor = 'border-l-orange-500'; urgencyText = 'Tomorrow'; urgencyClass = isIlluminateEnabled ? 'text-orange-600' : 'text-orange-400';
                            } else if (daysRemaining <= 3) { // Due within 3 days
                               urgencyColor = 'border-l-yellow-500'; urgencyText = `${daysRemaining} days`; urgencyClass = isIlluminateEnabled ? 'text-yellow-700' : 'text-yellow-500';
                            } else { // Due further out
                               urgencyColor = 'border-l-green-500'; urgencyText = `${daysRemaining} days`; urgencyClass = isIlluminateEnabled ? 'text-green-600' : 'text-green-400';
                            }
                            const priority = data.priority || calculatePriority(item);

                            return (
                               <li key={id} className={`${isIlluminateEnabled ? 'bg-gray-100/80 hover:bg-gray-200/60' : 'bg-gray-700/40 hover:bg-gray-700/60'} p-2.5 rounded-lg transition-colors duration-150 border-l-4 ${urgencyColor} animate-slideInRight flex items-center justify-between gap-2`} style={{ animationDelay: `${index * 60}ms` }} >
                                  <div className="flex-grow overflow-hidden mr-2">
                                      <div className="text-xs sm:text-sm font-medium flex items-center">
                                         <span className={`font-semibold mr-1 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{itemType.charAt(0).toUpperCase() + itemType.slice(1)}:</span>
                                         <span className="truncate" title={itemName}>{itemName}</span>
                                         <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="ml-1.5 flex-shrink-0" />
                                      </div>
                                  </div>
                                  <div className={`text-[10px] sm:text-xs flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'} flex items-center whitespace-nowrap`}>
                                      <Clock className={`w-3 h-3 mr-0.5 ${urgencyClass}`} />
                                      <span className={`font-medium mr-1.5 ${urgencyClass}`}>{dueDateStr}</span>
                                      {urgencyText && (
                                         <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                             daysRemaining <= 0 ? (isIlluminateEnabled ? 'bg-red-100 text-red-600' : 'bg-red-900/50 text-red-400') :
                                             daysRemaining <= 1 ? (isIlluminateEnabled ? 'bg-orange-100 text-orange-600' : 'bg-orange-900/50 text-orange-400') :
                                             daysRemaining <= 3 ? (isIlluminateEnabled ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/50 text-yellow-400') :
                                             (isIlluminateEnabled ? 'bg-green-100 text-green-600' : 'bg-green-900/50 text-green-400')
                                         }`}>
                                            {urgencyText}
                                         </span>
                                      )}
                                  </div>
                               </li>
                            );
                         })}
                      </ul>
                   );
                })()}
             </div>

             {/* Main Task/Goal/Project/Plan List Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
                {/* Tab Navigation */}
                <div className={`border-b pb-2 mb-4 ${illuminateBorder}`}>
                   <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                     {/* Render available tabs */}
                     {availableTabs.map((tab) => (
                        <div key={tab.id} className="relative group flex-shrink-0">
                           {editingSection?.id === tab.id ? (
                              <div className="flex items-center gap-1 p-1 bg-opacity-50 rounded-lg" style={{background: isIlluminateEnabled ? 'rgba(200,200,255,0.3)' : 'rgba(100,100,150,0.3)'}}>
                                 <input type="text" value={editingSection.name} onChange={(e) => setEditingSection(prev => prev ? {...prev, name: e.target.value} : null)} className={`${inputBg} border ${illuminateBorder} rounded-md px-2 py-0.5 text-xs sm:text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 w-28`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && editingSection.name.trim()) handleUpdateSection(tab.id, { name: editingSection.name.trim() }); if (e.key === 'Escape') setEditingSection(null); }} />
                                 <button onClick={() => {if (editingSection.name.trim()) handleUpdateSection(tab.id, { name: editingSection.name.trim() })}} disabled={!editingSection.name.trim()} className={`p-1 rounded hover:bg-green-600 disabled:opacity-50 ${editingSection.name.trim() ? 'bg-green-500 text-white' : 'bg-gray-400'}`}><CheckCircle className="w-3 h-3"/></button>
                                 <button onClick={() => setEditingSection(null)} className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"><X className="w-3 h-3"/></button>
                              </div>
                           ) : (
                              <button className={`px-3 py-1.5 rounded-full transition-all duration-200 transform hover:scale-[1.03] text-xs sm:text-sm font-medium flex items-center whitespace-nowrap ${ activeTabId === tab.id ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm" : isIlluminateEnabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-gray-700 text-gray-300 hover:bg-gray-600" }`} onClick={() => handleTabChange(tab.id)} >
                                 <tab.icon className="w-3.5 h-3.5 mr-1" /> {tab.name}
                              </button>
                           )}
                           {/* Edit/Hide/Delete controls for non-immutable tabs */}
                           {!tab.isDefaultImmutable && editingSection?.id !== tab.id && (
                              <div className="absolute top-0 right-0 -mt-1 -mr-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                                 <button onClick={() => setEditingSection(tab)} title="Rename Tab" className={`p-0.5 rounded-full ${isIlluminateEnabled ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-blue-900/70 text-blue-300 hover:bg-blue-800/70'}`}><Edit className="w-2.5 h-2.5"/></button>
                                 <button onClick={() => handleToggleSectionVisibility(tab)} title={tab.hidden ? "Show Tab" : "Hide Tab"} className={`p-0.5 rounded-full ${isIlluminateEnabled ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-600/70 text-gray-300 hover:bg-gray-500/70'}`}>{tab.hidden ? <Eye className="w-2.5 h-2.5"/> : <EyeOff className="w-2.5 h-2.5"/>}</button>
                                 <button onClick={() => handleDeleteSection(tab.id)} title="Delete Tab" className={`p-0.5 rounded-full ${isIlluminateEnabled ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-red-900/70 text-red-400 hover:bg-red-800/70'}`}><Trash className="w-2.5 h-2.5"/></button>
                              </div>
                           )}
                        </div>
                     ))}
                     {/* Add New Tab Button/Input */}
                     {isCreatingSection ? (
                        <div className="flex items-center gap-1 p-1 bg-opacity-50 rounded-lg flex-shrink-0" style={{background: isIlluminateEnabled ? 'rgba(200,255,200,0.3)' : 'rgba(100,150,100,0.3)'}}>
                           <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="New Tab Name" className={`${inputBg} border ${illuminateBorder} rounded-md px-2 py-0.5 text-xs sm:text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 w-28`} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSection(); if (e.key === 'Escape') setIsCreatingSection(false); }} />
                           <button onClick={handleCreateSection} disabled={!newSectionName.trim()} className={`p-1 rounded hover:bg-green-600 disabled:opacity-50 ${newSectionName.trim() ? 'bg-green-500 text-white' : 'bg-gray-400'}`}><CheckCircle className="w-3 h-3"/></button>
                           <button onClick={() => setIsCreatingSection(false)} className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"><X className="w-3 h-3"/></button>
                        </div>
                     ) : (
                        <button onClick={() => setIsCreatingSection(true)} className={`ml-2 px-2 py-1 rounded-full text-xs font-medium flex items-center flex-shrink-0 ${isIlluminateEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-600 text-gray-200 hover:bg-gray-500'}`} title="Add New Tab" >
                           <PlusCircle className="w-3 h-3 mr-0.5" /> Add Tab
                        </button>
                     )}
                   </div>
                </div>

                {/* Item Creation Input Row */}
                <div className="flex flex-col md:flex-row gap-1.5 mb-4">
                   <input type="text" className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3.5 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500`} placeholder={`Add a new ${activeTabDefinition?.name.slice(0,-1) || 'item'}...`} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                   <div className="flex gap-1.5 flex-shrink-0">
                      {/* Due Date Input */}
                      <input type="date" className={`${inputBg} border ${illuminateBorder} rounded-full px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${newItemDate ? (isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300') : iconColor }`} value={newItemDate} onChange={(e) => setNewItemDate(e.target.value)} title="Set due date" style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} />
                      {/* Priority Select */}
                      <div className="relative">
                         <select className={`${inputBg} border ${illuminateBorder} rounded-full pl-3 pr-7 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value as 'high' | 'medium' | 'low')} title="Set priority" >
                           <option value="high">High 🔥</option>
                           <option value="medium">Medium</option>
                           <option value="low">Low 🧊</option>
                         </select>
                         <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} />
                      </div>
                      {/* Add Button */}
                      <button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-full flex items-center justify-center hover:shadow-md hover:shadow-purple-500/20 transition-all duration-200 transform hover:scale-105 active:scale-100 min-w-[32px] min-h-[32px]" onClick={handleCreate} title={`Add new ${activeTabDefinition?.name.slice(0,-1) || 'item'}`} >
                         <PlusCircle className="w-4 h-4" />
                      </button>
                   </div>
                </div>

                {/* Item List */}
                <ul className="space-y-1.5 sm:space-y-2 min-h-[100px]"> {/* Min height prevents collapse */}
                   {currentItems.length === 0 ? (
                      <li className={`${subheadingClass} text-sm text-center py-6 italic`}>
                         No {activeTabDefinition?.name || 'items'} here yet... Add one above!
                      </li>
                   ) : (
                      currentItems
                         .sort((a, b) => { // Sort by completion status (incomplete first), then priority, then creation date
                            const completedDiff = (a.data.completed ? 1 : 0) - (b.data.completed ? 1 : 0);
                            if (completedDiff !== 0) return completedDiff;
                            const priorityMap = { high: 0, medium: 1, low: 2 };
                            const priorityA = priorityMap[calculatePriority(a)];
                            const priorityB = priorityMap[calculatePriority(b)];
                            if (priorityA !== priorityB) return priorityA - priorityB;
                            return (a.data.createdAt?.seconds || 0) - (b.data.createdAt?.seconds || 0); // Oldest first within same priority
                         })
                         .map((item, index) => {
                            const itemId = item.id;
                            const { data } = item;
                            const titleField = getTitleField(data);
                            const textValue = data[titleField] || 'Untitled';
                            const isCompleted = data.completed || false;
                            const isEditing = editingItemId === itemId;
                            const priority = calculatePriority(item); // Use calculated priority
                            let dueDateStr = '';
                            let overdue = false;
                            let dueDateObj: Date | null = null;
                            if (data.dueDate) {
                               try {
                                  dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
                                  if (!isNaN(dueDateObj.getTime())) {
                                     dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                     const itemDate = new Date(dueDateObj);
                                     itemDate.setHours(0,0,0,0);
                                     overdue = itemDate < today && !isCompleted; // Compare with normalized today
                                  } else { dueDateStr = ''; }
                               } catch { dueDateStr = ''; }
                            }
                            return (
                               <li
                                  key={item.id}
                                  className={`group p-2 sm:p-2.5 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 transition-all duration-150 animate-slideInUp ${
                                     isCompleted ? isIlluminateEnabled ? 'bg-green-100/50 opacity-60' : 'bg-green-900/20 opacity-50' :
                                     overdue ? isIlluminateEnabled ? 'bg-red-100/60' : 'bg-red-900/30' :
                                     isIlluminateEnabled ? 'bg-gray-100/70 hover:bg-gray-200/50' : 'bg-gray-700/30 hover:bg-gray-700/50'
                                  } ${isEditing ? (isIlluminateEnabled ? 'ring-1 ring-purple-400 bg-purple-50/50' : 'ring-1 ring-purple-500 bg-purple-900/20') : ''} `}
                                  style={{ animationDelay: `${index * 50}ms` }}
                               >
                                  {!isEditing ? ( // DISPLAY MODE
                                     <>
                                        <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2">
                                           {/* Complete Button */}
                                           <button
                                              onClick={() => handleMarkComplete(itemId)}
                                              className={`flex-shrink-0 p-0.5 rounded-full transition-colors duration-150 border ${
                                                 isCompleted ? (isIlluminateEnabled ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600')
                                                             : (isIlluminateEnabled ? 'border-gray-400 hover:border-green-500 hover:bg-green-100/50' : 'border-gray-500 hover:border-green-500 hover:bg-green-900/30')
                                              }`}
                                              title={isCompleted ? "Mark Pending" : "Mark Complete"}>
                                              <CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-white' : 'text-transparent'}`} />
                                           </button>
                                           {/* Item Text */}
                                           <span className={`font-medium text-sm sm:text-[0.9rem] truncate ${ isCompleted ? 'line-through text-gray-500 dark:text-gray-600' : (isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100') }`} title={textValue} >
                                              {textValue}
                                           </span>
                                            {/* Priority Badge */}
                                           <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="flex-shrink-0 ml-auto sm:ml-1.5" />
                                           {/* Due Date Badge */}
                                           {dueDateStr && (
                                              <span className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 hidden sm:flex items-center ${ overdue ? (isIlluminateEnabled ? 'bg-red-200 text-red-700' : 'bg-red-800/50 text-red-300') : (isIlluminateEnabled ? 'bg-gray-200 text-gray-600' : 'bg-gray-600/80 text-gray-300') }`} >
                                                 <Calendar className="w-2.5 h-2.5 mr-0.5" /> {dueDateStr}
                                              </span>
                                           )}
                                        </div>
                                         {/* Action Buttons (Edit/Delete) */}
                                        <div className="flex gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                           <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'} transition-colors`} onClick={() => handleEditClick(itemId, data)} title="Edit" >
                                              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                           </button>
                                           <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'} transition-colors`} onClick={() => handleDelete(itemId)} title="Delete" >
                                              <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                           </button>
                                        </div>
                                     </>
                                  ) : ( // EDITING MODE
                                     <>
                                        <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                                           {/* Text Input */}
                                           <input className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(itemId); if (e.key === 'Escape') setEditingItemId(null); }} />
                                           <div className="flex gap-1.5 flex-shrink-0">
                                              {/* Date Input */}
                                              <input type="date" className={`${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${editingDate ? (isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300') : iconColor}`} value={editingDate} onChange={(e) => setEditingDate(e.target.value)} style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} />
                                              {/* Priority Select */}
                                              <div className="relative">
                                                 <select className={`${inputBg} border ${illuminateBorder} rounded-full pl-3 pr-7 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={editingPriority} onChange={(e) => setEditingPriority(e.target.value as 'high' | 'medium' | 'low')} >
                                                    <option value="high">High 🔥</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="low">Low 🧊</option>
                                                 </select>
                                                 <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} />
                                              </div>
                                              {/* Section/Tab Select (only for Tasks) */}
                                              {titleField === 'task' && userSections.length > 0 && (
                                                 <div className="relative">
                                                    <select className={`${inputBg} border ${illuminateBorder} rounded-full pl-3 pr-7 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor} max-w-[120px]`} value={editingSectionId || ''} onChange={(e) => setEditingSectionId(e.target.value || null)} title="Assign to Tab" >
                                                      <option value="">Tasks (Default)</option>
                                                      {userSections.map(sec => ( <option key={sec.id} value={sec.id}>{sec.data.name}</option> ))}
                                                    </select>
                                                    <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} />
                                                 </div>
                                              )}
                                           </div>
                                        </div>
                                        {/* Save/Cancel Buttons */}
                                        <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center">
                                           <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditSave(itemId)} > Save </button>
                                           <button className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm" onClick={() => setEditingItemId(null)} > Cancel </button>
                                        </div>
                                     </>
                                  )}
                               </li>
                            );
                         })
                   )}
                </ul>
             </div>
           </div> {/* End Left Column */}

           {/* RIGHT COLUMN */}
           <div className="flex flex-col gap-4 sm:gap-5">

              {/* Weather Card */}
              <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}>
                 <h2 className={`text-base sm:text-lg font-semibold mb-2 ${headingClass} flex items-center`}>
                    <Sun className={`w-4 h-4 mr-1.5 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} /> Weather
                    {weatherData?.location?.name && !weatherLoading && <span className="text-sm font-normal ml-1.5 text-gray-500 truncate hidden sm:inline"> / {weatherData.location.name}</span>}
                 </h2>
                 {weatherLoading ? (
                    <div className="animate-pulse space-y-2 py-4">
                       <div className={`h-5 rounded w-1/2 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                       <div className={`h-4 rounded w-3/4 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                       <div className={`h-3 rounded w-1/3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                    </div>
                 ) : weatherError ? (
                    <p className="text-center text-xs text-red-500 py-4">{weatherError}</p>
                 ) : weatherData ? (
                    <>
                       {/* Current Weather */}
                       <div className={`flex items-center gap-2 sm:gap-3 mb-3 border-b ${illuminateBorder} pb-3`}>
                         <img src={weatherData.current.condition.icon ? `https:${weatherData.current.condition.icon}` : "/placeholder.svg"} alt={weatherData.current.condition.text} className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" loading="lazy" />
                         <div className="flex-grow">
                            <p className={`text-lg sm:text-xl font-bold ${headingClass} leading-tight`}>
                               {Math.round(weatherData.current.temp_f)}°F
                               <span className={`ml-1 text-xs sm:text-sm font-normal ${subheadingClass}`}> ({weatherData.current.condition.text}) </span>
                            </p>
                            <p className={`text-xs ${subheadingClass}`}> Feels like {Math.round(weatherData.current.feelslike_f)}°F </p>
                         </div>
                         <div className="flex flex-col items-end text-[10px] sm:text-xs gap-0.5 flex-shrink-0">
                            <div className="flex items-center" title={`Wind: ${weatherData.current.wind_dir} ${Math.round(weatherData.current.wind_mph)} mph`}> <Wind className="w-3 h-3 mr-0.5 text-blue-400" /> {Math.round(weatherData.current.wind_mph)} mph </div>
                            <div className="flex items-center" title={`Humidity: ${weatherData.current.humidity}%`}> <Droplets className="w-3 h-3 mr-0.5 text-cyan-400" /> {weatherData.current.humidity}% </div>
                            <div className="flex items-center" title={`UV Index: ${weatherData.current.uv}`}> <Zap className="w-3 h-3 mr-0.5 text-yellow-400" /> UV: {weatherData.current.uv} </div>
                         </div>
                       </div>
                       {/* Forecast */}
                       {weatherData.forecast?.forecastday?.length > 0 && (
                         <div className="space-y-1.5">
                            {(() => {
                               const now = new Date(); now.setHours(0, 0, 0, 0);
                               const validDays = weatherData.forecast.forecastday.filter((day: any) => {
                                  try { const d = new Date(day.date_epoch * 1000); d.setHours(0, 0, 0, 0); return d >= now; } catch { return false; }
                               });
                               return validDays.slice(0, 3).map((day: any, idx: number) => {
                                  const dateObj = new Date(day.date_epoch * 1000);
                                  const dayLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                                  const maxF = Math.round(day.day.maxtemp_f);
                                  const minF = Math.round(day.day.mintemp_f);
                                  const icon = day.day.condition.icon ? `https:${day.day.condition.icon}` : "/placeholder.svg";
                                  const forecastBg = isIlluminateEnabled ? 'bg-gray-100/70' : 'bg-gray-700/30';
                                  return (
                                     <div key={day.date_epoch} className={`flex items-center gap-2 ${forecastBg} p-1 rounded-md animate-slideInRight`} style={{ animationDelay: `${idx * 80}ms` }} >
                                        <img src={icon} alt={day.day.condition.text} className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" loading="lazy"/>
                                        <span className={`text-[10px] sm:text-xs font-medium w-7 sm:w-8 flex-shrink-0 text-center ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'}`}>{dayLabel}</span>
                                        <div className={`flex-grow h-1 rounded-full ${isIlluminateEnabled ? 'bg-gray-200': 'bg-gray-600'} overflow-hidden mx-1`}>
                                           <div className="h-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" style={{width: `${Math.max(0,Math.min(100, (maxF / 100) * 100))}%`}}></div> {/* Simple temp range visualization */}
                                        </div>
                                        <span className={`text-[10px] sm:text-xs w-12 text-right flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'}`}>
                                           <span className="font-semibold">{maxF}°</span> / {minF}°
                                        </span>
                                     </div>
                                  );
                               });
                            })()}
                         </div>
                       )}
                    </>
                 ) : (
                    <p className="text-center text-xs text-gray-500 py-4">Weather data unavailable.</p>
                 )}
              </div>

              {/* Pomodoro Timer Card */}
              <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}>
                 <div className="flex items-center justify-between mb-2">
                    <h2 className={`text-base sm:text-lg font-semibold ${headingClass} flex items-center`}>
                       <Clock className="w-4 h-4 mr-1.5" /> Pomodoro
                    </h2>
                    <button className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-1 rounded-full font-semibold flex items-center gap-1 hover:shadow-md hover:shadow-purple-500/10 transition-all duration-150 transform hover:scale-105 active:scale-100 text-[10px] sm:text-xs" onClick={() => setIsAddTimerModalOpen(true)} title="Add a new custom timer" >
                       <PlusCircle className="w-3 h-3" /> New Timer
                    </button>
                 </div>
                 <div className={`text-4xl sm:text-5xl font-bold mb-3 text-center tabular-nums tracking-tight bg-clip-text text-transparent ${ isIlluminateEnabled ? 'bg-gradient-to-r from-blue-600 to-purple-700' : 'bg-gradient-to-r from-blue-400 to-purple-500' } ${pomodoroRunning ? 'animate-pulse' : ''}`} >
                    {formatPomodoroTime(pomodoroTimeLeft)}
                 </div>
                 <div className="flex justify-center gap-2">
                    <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning || pomodoroFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-md hover:shadow-green-500/10'}`} onClick={handlePomodoroStart} disabled={pomodoroRunning || pomodoroFinished} title="Start Timer" > Start </button>
                    <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${!pomodoroRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:shadow-md hover:shadow-yellow-500/10'}`} onClick={handlePomodoroPause} disabled={!pomodoroRunning} title="Pause Timer" > Pause </button>
                    <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-md hover:shadow-red-500/10'}`} onClick={handlePomodoroReset} disabled={pomodoroRunning} title="Reset Timer" > Reset </button>
                 </div>
                 {pomodoroFinished && ( <p className="text-center text-xs text-red-500 mt-2 animate-bounce font-medium">Time's up!</p> )}
              </div>

              {/* Custom Timers List Card */}
              {customTimers.length > 0 && (
                 <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}>
                    <h2 className={`text-base sm:text-lg font-semibold mb-3 ${headingClass} flex items-center`}>
                       <TimerIcon className="w-4 h-4 mr-1.5" /> Timers
                    </h2>
                    <ul className="space-y-2">
                       {customTimers
                          .sort((a, b) => (a.data.createdAt?.seconds || 0) - (b.data.createdAt?.seconds || 0)) // Sort by creation time
                          .map((timer, index) => {
                             const timerId = timer.id;
                             const runningState = runningTimers[timerId];
                             const timeLeft = runningState ? runningState.timeLeft : timer.data.time;
                             const isRunning = runningState ? runningState.isRunning : false;
                             const isFinished = runningState ? (runningState.finished ?? timeLeft <= 0) : timer.data.time <= 0;
                             const isEditing = editingTimerId === timerId;

                             let itemBgClass = isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-700/40';
                             if (isFinished && !isEditing) itemBgClass = isIlluminateEnabled ? 'bg-yellow-100/70 opacity-80' : 'bg-yellow-900/30 opacity-70';
                             if (isEditing) itemBgClass = isIlluminateEnabled ? 'bg-purple-100/50 ring-1 ring-purple-400' : 'bg-purple-900/20 ring-1 ring-purple-500';

                             return (
                                <li key={timerId} className={`p-2 sm:p-2.5 rounded-lg transition-all duration-150 animate-slideInUp ${itemBgClass}`} style={{ animationDelay: `${index * 60}ms` }} >
                                   <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3">
                                      {isEditing ? ( // EDITING TIMER MODE
                                         <>
                                            <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                                               <input type="text" className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingTimerName} onChange={(e) => setEditingTimerName(e.target.value)} placeholder="Timer name" autoFocus />
                                               <input type="number" className={`w-20 ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-textfield [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} value={editingTimerMinutes} onChange={(e) => setEditingTimerMinutes(e.target.value)} placeholder="Min" min="1" onKeyDown={(e) => e.key === 'Enter' && handleEditTimerSave(timerId)} />
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center">
                                               <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditTimerSave(timerId)} > Save </button>
                                               <button className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm" onClick={() => setEditingTimerId(null)} > Cancel </button>
                                            </div>
                                         </>
                                      ) : ( // DISPLAY TIMER MODE
                                         <>
                                            <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2">
                                               <span className="font-medium text-sm sm:text-[0.9rem] truncate" title={timer.data.name}> {timer.data.name} </span>
                                               <span className={`text-xl sm:text-2xl font-semibold tabular-nums tracking-tight ${ isIlluminateEnabled ? 'text-purple-700' : 'text-purple-400' } ${isRunning ? 'animate-pulse' : ''}`} > {formatCustomTime(timeLeft)} </span>
                                            </div>
                                            <div className="flex gap-1 sm:gap-1.5 flex-shrink-0">
                                               {/* Play/Pause Button */}
                                               <button className={`p-1.5 rounded-full text-white transition-colors ${isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : isFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`} onClick={() => isRunning ? pauseCustomTimer(timerId) : startCustomTimer(timerId)} title={isRunning ? "Pause" : isFinished ? "Finished" : "Start"} disabled={isFinished && !isRunning} >
                                                  {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className={`w-3.5 h-3.5 ${isFinished ? 'opacity-50' : ''}`} />}
                                               </button>
                                               {/* Reset Button */}
                                               <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'bg-gray-400/50 text-gray-600/50 cursor-not-allowed' : isIlluminateEnabled ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`} onClick={() => resetCustomTimer(timerId)} title="Reset" disabled={isRunning} >
                                                  <RotateCcw className="w-3.5 h-3.5" />
                                               </button>
                                               {/* Edit Button */}
                                               <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-gray-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'}`} onClick={() => handleEditTimerClick(timerId, timer.data.name, timer.data.time)} title="Edit" disabled={isRunning} >
                                                  <Edit className={`w-3.5 h-3.5 ${isRunning ? 'opacity-50' : ''}`} />
                                               </button>
                                               {/* Delete Button */}
                                               <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-gray-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'}`} onClick={() => handleDeleteTimer(timerId)} title="Delete" disabled={isRunning} >
                                                  <Trash className={`w-3.5 h-3.5 ${isRunning ? 'opacity-50' : ''}`} />
                                               </button>
                                            </div>
                                         </>
                                      )}
                                   </div>
                                   {isFinished && !isEditing && (
                                      <p className="text-center text-[10px] text-yellow-600 dark:text-yellow-500 mt-1">Timer finished!</p>
                                   )}
                                </li>
                             );
                       })}
                    </ul>
                 </div>
              )}
           </div> {/* End Right Column */}
        </div> {/* End Main Content Grid */}
      </main> {/* End Main Content Area */}

      {/* AI Chat & Insights Sidebar */}
      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${ isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full' } ${cardClass} flex flex-col shadow-2xl border-l ${illuminateBorder}`} role="complementary" aria-labelledby="ai-sidebar-title" >
        {/* Sidebar Header */}
        <div className={`p-3 sm:p-4 border-b ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky top-0 backdrop-blur-sm z-20`} >
           {/* Title and Close Button */}
           <div className="flex justify-between items-center mb-2">
             <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}>
               <BrainCircuit className="w-5 h-5" /> TaskMaster AI
             </h3>
             <button onClick={() => setIsAiSidebarOpen(false)} className={`${ iconColor } p-1 rounded-full ${illuminateBgHover} transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar" >
               <X className="w-5 h-5" />
             </button>
           </div>
           {/* Conversation Selector and New Chat */}
           <div className="flex items-center gap-2">
             <select value={selectedConversationId || ''} onChange={(e) => setSelectedConversationId(e.target.value)} disabled={isConversationsLoading || chatConversations.length === 0} className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor} truncate`} title="Select Conversation" >
                {isConversationsLoading ? ( <option value="">Loading chats...</option> ) : chatConversations.length > 0 ? ( chatConversations.map(conv => ( <option key={conv.id} value={conv.id}>{conv.data?.chatName || `Chat ${new Date(conv.data?.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}`}</option> )) ) : ( <option value="">No chats yet</option> )}
             </select>
             <button onClick={handleNewChat} disabled={isChatLoading || isConversationsLoading} className={`bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 flex items-center gap-1 text-xs`} title="Start New Chat" >
               <PlusCircle className="w-3.5 h-3.5" /> New
             </button>
           </div>
           {/* Tab Switcher (Chat/Insights) */}
           <div className={`mt-3 flex border-b ${illuminateBorder} -mb-[1px]`}> {/* Negative margin to overlap border */}
              <button onClick={() => setAiSidebarTab('chat')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'chat' ? `border-blue-500 ${illuminateTextBlue}` : `border-transparent ${subheadingClass} hover:${illuminateTextBlue}`}`} >
                 Chat
              </button>
              <button onClick={() => setAiSidebarTab('insights')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'insights' ? `border-purple-500 ${illuminateTextPurple}` : `border-transparent ${subheadingClass} hover:${illuminateTextPurple}`}`} >
                 Insights
              </button>
           </div>
        </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto" ref={aiSidebarTab === 'chat' ? chatEndRef : null}>
            {/* CHAT TAB */}
            {aiSidebarTab === 'chat' && (
               <div className="p-3 space-y-3">
                  {isMessagesLoading && selectedConversationId && ( // Loading skeleton for messages
                     <div className="space-y-3 animate-pulse p-4">
                       <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                       <div className={`h-12 rounded w-2/3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                       <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                     </div>
                  )}
                  {!isMessagesLoading && currentChatHistory.map((message, index) => (
                     <div key={message.id} className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' } animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }} >
                        <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${
                              message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') :
                              message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') :
                              (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')
                           }`} >
                           {/* Render Markdown Content */}
                           {message.content && message.content !== "..." && (
                              <ReactMarkdown
                                 remarkPlugins={[remarkMath, remarkGfm]}
                                 rehypePlugins={[rehypeKatex]}
                                 components={{
                                    p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                    li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                                    a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                    code: ({ node, inline, className, children, ...props }) => {
                                      const match = /language-(\w+)/.exec(className || '');
                                      return !inline ? (
                                        <pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}>
                                          <code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code>
                                        </pre>
                                      ) : (
                                        <code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                 }}
                              >
                                 {message.content}
                              </ReactMarkdown>
                           )}
                           {/* Loading Indicator for Assistant */}
                           {message.content === "..." && isChatLoading && index === currentChatHistory.length - 1 && (
                              <div className="flex space-x-1 p-1">
                                 <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                 <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                 <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                              </div>
                           )}
                           {/* Render Timer Component */}
                           {message.timer && (
                              <div className="mt-1.5">
                                <div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}>
                                   <TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} />
                                   {/* Ensure Timer component is robust */}
                                   <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} />
                                </div>
                              </div>
                           )}
                           {/* Render Flashcards */}
                           {message.flashcard && (
                              <div className="mt-1.5">
                                 <FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} />
                              </div>
                           )}
                           {/* Render Questions */}
                           {message.question && (
                              <div className="mt-1.5">
                                 <FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} />
                              </div>
                           )}
                           {/* Render Action Recommendation Buttons */}
                           {message.recommendation && (
                             <div className={`mt-2 p-2 rounded-md border ${isIlluminateEnabled ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-700/50'}`}>
                                <p className={`text-xs font-medium mb-1 ${isIlluminateEnabled ? 'text-purple-800' : 'text-purple-300'}`}>AI Suggestion:</p>
                                <p className="text-xs mb-1.5">{message.recommendation.reasoning}</p>
                                <div className="flex justify-end gap-1.5">
                                   <button onClick={() => executeAiAction(message.recommendation!)} className="px-2 py-0.5 text-[10px] rounded bg-green-500 text-white hover:bg-green-600">Accept</button>
                                   <button onClick={() => { setCurrentChatHistory(prev => prev.map(m => m.id === message.id ? {...m, recommendation: undefined} : m)) }} className="px-2 py-0.5 text-[10px] rounded bg-red-500 text-white hover:bg-red-600">Reject</button>
                                </div>
                             </div>
                           )}
                        </div>
                     </div>
                  ))}
                  {/* Fallback loading indicator if history is empty but chat is loading */}
                  {isChatLoading && currentChatHistory.length === 0 && (
                     <div className="flex justify-start animate-fadeIn">
                        <div className={`${ isIlluminateEnabled ? 'bg-gray-100 border border-gray-200/80' : 'bg-gray-700/80 border border-gray-600/50' } rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm`}>
                           <div className="flex space-x-1 p-1">
                             <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                             <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                             <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                           </div>
                        </div>
                     </div>
                  )}
                  {/* Message if no conversation selected */}
                  {!selectedConversationId && !isConversationsLoading && (
                     <div className="text-center p-6 text-sm italic text-gray-500">
                        Select a conversation or start a new one.
                     </div>
                  )}
               </div>
            )}

            {/* INSIGHTS TAB */}
            {aiSidebarTab === 'insights' && (
               <div className="p-3 sm:p-4 space-y-4">
                  {/* Generate Button */}
                  <button onClick={generateAiInsights} disabled={aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading'} className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors transform hover:scale-[1.02] active:scale-100 shadow-md ${aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading' ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`} >
                     {aiGeneratedInsights.isLoading ? (
                        <> <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating... </>
                     ) : userTier === 'basic' || userTier === 'loading' ? (
                         <> <Lock className="w-4 h-4" /> Insights (Pro/Premium)</>
                     ) : (
                         <> <Sparkles className="w-4 h-4" /> Generate Insights </>
                     )}
                  </button>

                  {/* Error Message */}
                  {aiGeneratedInsights.error && (
                     <p className="text-center text-sm text-red-500 p-4 border border-red-500/30 rounded-lg">{aiGeneratedInsights.error}</p>
                  )}

                  {/* Display Generated Insights */}
                  {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (aiGeneratedInsights.score !== undefined || aiGeneratedInsights.timeManagement || aiGeneratedInsights.conflicts || aiGeneratedInsights.other) && (
                     <div className="space-y-3 animate-fadeIn">
                        {aiGeneratedInsights.score !== undefined && (
                           <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-green-500' : 'border-green-400'}`}>
                              <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Productivity Score</p>
                              <p className={`text-2xl font-bold ${headingClass}`}>{aiGeneratedInsights.score} <span className="text-sm font-normal">/ 100</span></p>
                           </div>
                        )}
                        {aiGeneratedInsights.timeManagement && (
                           <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-blue-500' : 'border-blue-400'}`}>
                              <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Time Management</p>
                              <p className="text-sm">{aiGeneratedInsights.timeManagement}</p>
                           </div>
                        )}
                        {aiGeneratedInsights.conflicts && (
                           <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-orange-500' : 'border-orange-400'}`}>
                              <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Potential Conflicts</p>
                              <p className="text-sm">{aiGeneratedInsights.conflicts}</p>
                           </div>
                        )}
                        {aiGeneratedInsights.other && (
                           <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-purple-500' : 'border-purple-400'}`}>
                              <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Additional Insights</p>
                              <p className="text-sm">{aiGeneratedInsights.other}</p>
                           </div>
                        )}
                     </div>
                  )}

                  {/* Display Pending AI Recommendations */}
                  {pendingInsightActions.length > 0 && (
                     <div className="space-y-3 pt-3 border-t ${illuminateBorder}">
                        <h4 className={`text-sm font-semibold ${headingClass}`}>Pending AI Recommendations</h4>
                        {pendingInsightActions.map(action => (
                           <div key={action.id} className={`${cardClass} p-3 rounded-lg border ${isIlluminateEnabled ? 'border-yellow-300' : 'border-yellow-700/50'} shadow-sm`}>
                              <p className={`text-xs font-medium mb-0.5 ${isIlluminateEnabled ? 'text-yellow-700' : 'text-yellow-400'}`}>Suggestion: {action.description}</p>
                              <p className="text-xs my-1 italic">{action.reasoning}</p>
                              <p className="text-[11px] text-gray-500 mb-1.5">Impact: {action.impact}</p>
                              <div className="flex justify-end gap-1.5">
                                 <button onClick={() => handleAcceptDeepInsight(action)} className="px-2 py-0.5 text-[10px] rounded bg-green-500 text-white hover:bg-green-600">Accept</button>
                                 <button onClick={() => handleDeclineDeepInsight(action.id)} className="px-2 py-0.5 text-[10px] rounded bg-red-500 text-white hover:bg-red-600">Decline</button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Placeholder if no insights generated */}
                  {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && aiGeneratedInsights.score === undefined && pendingInsightActions.length === 0 && userTier !== 'basic' && userTier !== 'loading' && (
                     <p className="text-center text-sm italic text-gray-500 p-6">
                        Click "Generate Insights" to get an AI analysis of your productivity based on your current items and context.
                     </p>
                  )}
            </div>
            )}
        </div>

        {/* Sidebar Footer (Chat Input Area) */}
        <div className={`px-2 sm:px-3 pt-1 border-t ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`} >
           {/* Usage Limit Indicator */}
           {userTier !== 'premium' && userTier !== 'loading' && (
             <div className="pb-1.5 text-xs text-center">
                <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {chatCount} / {currentChatLimit === Infinity ? 'Unlimited' : currentChatLimit} </span>
                {isChatLimitReached && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )}
             </div>
           )}
           {/* Chat Input Form */}
           <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2">
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={isChatLimitReached ? "Monthly limit reached..." : aiSidebarTab === 'insights' ? "Switch to Chat tab to talk..." : "Ask TaskMaster AI..."} className={`flex-1 ${inputBg} border ${illuminateBorder} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 ${isChatLimitReached || aiSidebarTab === 'insights' ? 'cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'} aria-label="Chat input" />
              <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'} className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached || aiSidebarTab === 'insights' ? 'cursor-not-allowed' : ''}`} title="Send Message" aria-label="Send chat message" >
                 {isChatLoading ? ( <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ) : ( <Send className="w-4 h-4" /> )}
              </button>
           </form>
        </div>
      </div> {/* End AI Sidebar */}
    </div> // End Page Container
  );
}
