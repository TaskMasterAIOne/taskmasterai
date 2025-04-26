
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'; // Added useCallback
import { useNavigate, Link } from 'react-router-dom';
import {
    Play, Pause, PlusCircle, Edit, Trash, Sparkles, CheckCircle, MessageCircle, RotateCcw, Square, X, TimerIcon, Send, ChevronLeft, ChevronRight, Moon, Sun, Star, Wind, Droplets, Zap, Calendar, Clock, MoreHorizontal, ArrowUpRight, Bookmark, BookOpen, Lightbulb, Flame, Award, TrendingUp, Rocket, Target, Layers, Clipboard, AlertCircle, ThumbsUp, ThumbsDown, BrainCircuit, ArrowRight, Flag, Bell, Filter, Tag, BarChart, PieChart, ChevronDown, Settings, LogOut, User as UserIcon, FolderPlus, FolderMinus, EyeOff, Eye, Hash, Lock
} from 'lucide-react'; // Ensure Lock is imported
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
    // hfApiKey, // Unused
    geminiApiKey,
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
} from '../lib/ai-context-firebase';
import {
    createChatConversation,
    saveChatMessage,
    onChatMessagesSnapshot,
    onChatConversationsSnapshot,
    updateChatConversationName, // Keep if renaming is desired
    deleteChatConversation, // Keep if deleting is desired
    ChatMessage as FirebaseChatMessage,
    findItemByName
} from '../lib/ai-chat-firebase';
import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDoc, doc, Timestamp } from 'firebase/firestore';
import { updateUserProfile, signOutUser, deleteUserAccount, AuthError, getCurrentUser } from '../lib/settings-firebase';
import { PriorityBadge } from './PriorityBadge';
import EnhancedTaskAnalytics from './EnhancedTaskAnalytics';
import AddTimerModal from './AddTimerModal';

// Gemini helper functions
const geminiOverviewEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
const geminiChatEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${geminiApiKey}&alt=sse`; // Streaming for chat
// Use a more capable model for naming and insights?
const geminiProEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`; // Non-streaming for single answers


const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000): Promise<Response> => {
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

// --- REVISED streamResponse ---
const streamResponse = async (
  url: string,
  options: RequestInit,
  onStreamUpdate: (rawChunkAccumulated: string) => void, // Callback receives raw accumulated text
  timeout = 45000 // Increased timeout for potentially longer streams
): Promise<string> => { // Return the final accumulated raw text
    try {
        console.log("Streaming Request:", url, JSON.parse(options.body as string || '{}')); // Log request details
        const response = await fetchWithTimeout(url, options, timeout);
        console.log("Stream Response Status:", response.status); // Log status

        if (!response.ok) {
            let errorBody = '';
            try {
                errorBody = await response.text();
                console.error("Stream API Error Body:", errorBody); // Log raw error body
                // Attempt to parse JSON error even from text
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson?.error?.message) {
                        throw new Error(`API Error (${response.status}): ${errorJson.error.message}`);
                    }
                } catch (parseErr) {
                    // If JSON parsing fails, use the text body
                    throw new Error(`API Request Failed (${response.status}): ${response.statusText} ${errorBody || ''}`);
                }
            } catch (textError) {
                // If reading text fails or re-throws, use statusText
                 throw new Error(`API Request Failed (${response.status}): ${response.statusText}`);
             }
        }
        if (!response.body) {
             // Handle non-streamed response gracefully (shouldn't happen with alt=sse)
             console.warn("Expected streaming response but got non-streamed body.");
            const text = await response.text();
            console.log("Non-Streamed Response Body:", text); // Log non-streamed body
            onStreamUpdate(text); // Send full non-streamed response
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
                // console.log("Raw Stream Chunk:", rawChunk); // DEBUG: Very verbose
                accumulatedRawText += rawChunk;
                // Pass the *accumulated raw* text for parsing/display update
                onStreamUpdate(accumulatedRawText);
            }
        }
        console.log("Final Accumulated Raw Text:", accumulatedRawText); // Log final raw text
        return accumulatedRawText; // Return the final accumulated raw text
    } catch (error) {
        console.error("Streaming Error Caught:", error);
        // Ensure the error propagates with a meaningful message
        throw new Error(`Streaming failed: ${(error as Error).message || 'Unknown streaming error'}`);
    }
};

// --- REVISED extractCandidateText ---
const extractCandidateText = (rawResponseText: string): { text: string; error?: string; finishReason?: string } => {
    // Extracts text content from Gemini's STREAMING JSON format (lines starting with 'data: ')
    // Returns an object with extracted text, potential error message, and finish reason
    let combinedText = "";
    let streamError: string | undefined = undefined;
    let streamFinishReason: string | undefined = undefined;

    try {
        const jsonLines = rawResponseText.trim().split('\n');
        // console.log(`Raw JSON Lines: ${jsonLines.length}`); // DEBUG

        for (const line of jsonLines) {
            if (line.startsWith('data: ')) {
                const jsonString = line.substring(6).trim();
                if (!jsonString) continue; // Skip empty data lines

                try {
                    const parsedJson = JSON.parse(jsonString);
                    // console.log("Parsed Chunk:", parsedJson); // DEBUG

                    if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                        combinedText += parsedJson.candidates[0].content.parts[0].text;
                    }
                    // --- Check for errors or non-STOP finish reasons ---
                    const candidate = parsedJson.candidates?.[0];
                    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                        streamFinishReason = candidate.finishReason;
                        console.warn("Gemini API finishReason:", streamFinishReason, "Safety Ratings:", candidate.safetyRatings);
                        if (streamFinishReason === 'SAFETY') {
                            streamError = "Content generation stopped due to safety concerns.";
                            // Don't clear combinedText, let previous parts stand
                        } else if (streamFinishReason === 'MAX_TOKENS') {
                            streamError = "Content generation stopped due to maximum token limit.";
                        } else {
                            streamError = `Content generation stopped unexpectedly (${streamFinishReason}).`;
                        }
                        // We can break here if we want to stop processing on non-STOP reason
                        // break;
                    } else if (parsedJson.error?.message) {
                        console.error("Gemini API Error in chunk:", parsedJson.error.message);
                        streamError = `API Error: ${parsedJson.error.message}`;
                         // break; // Stop processing on direct error chunk
                    } else if (parsedJson.promptFeedback?.blockReason) {
                         console.error("Gemini Prompt Feedback Block:", parsedJson.promptFeedback.blockReason);
                         streamFinishReason = "BLOCKED";
                         streamError = `Content generation blocked due to prompt feedback: ${parsedJson.promptFeedback.blockReason}`;
                         // break; // Stop processing on block
                     }

                } catch (e) {
                    // Incomplete JSON chunk during streaming is expected, especially the last one.
                    // console.warn("Could not parse JSON chunk (likely incomplete stream):", jsonString);
                    // Don't treat incomplete parse as a fatal error during streaming
                }
            } else if (line.trim() && !line.startsWith('event: ') && !line.startsWith('id: ')) {
                // Log unexpected non-data lines if they contain content
                // console.warn("Unexpected line in stream:", line);
            }
        }

        // Basic cleanup (less aggressive than before)
        const cleanText = combinedText.replace(/^Assistant:\s*/, '').trim();
        return { text: cleanText, error: streamError, finishReason: streamFinishReason };

    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return { text: "", error: "Error extracting text from stream.", finishReason: "ERROR" };
    }
};


// Helper functions (getWeekDates, formatDateForComparison, calculatePriority) - remain unchanged
const getWeekDates = (date: Date): Date[] => { const sunday = new Date(date); sunday.setDate(date.getDate() - date.getDay()); const weekDates: Date[] = []; for (let i = 0; i < 7; i++) { const day = new Date(sunday); day.setDate(sunday.getDate() + i); weekDates.push(day); } return weekDates; };
const formatDateForComparison = (date: Date): string => date.toISOString().split('T')[0];
const calculatePriority = (item: any): 'high' | 'medium' | 'low' => { if (item.data.priority) return item.data.priority; if (!item.data.dueDate) return 'low'; let dueDate: Date | null = null; if (item.data.dueDate?.toDate) { dueDate = item.data.dueDate.toDate(); } else if (item.data.dueDate instanceof Date) { dueDate = item.data.dueDate; } else if (typeof item.data.dueDate === 'string' || typeof item.data.dueDate === 'number') { try { const d = new Date(item.data.dueDate); if (!isNaN(d.getTime())) { dueDate = d; } } catch (e) { dueDate = null; } } if (!dueDate) return 'low'; const now = new Date(); dueDate.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0); const diffTime = dueDate.getTime() - now.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) return 'high'; if (diffDays <= 1) return 'high'; if (diffDays <= 3) return 'medium'; return 'low'; };

// Define tab types
type TabDefinition = { id: ItemType; name: string; icon: React.ElementType; isDefaultImmutable: boolean; }; // Removed hidden, custom fields
// Interface for AI Action Recommendations in Chat - Unchanged
interface AiActionRecommendation { type: 'actionRecommendation'; data: { id: string; action: 'create' | 'update' | 'delete'; itemType: ItemType; payload: any; reasoning: string; }; }
// Combine local chat message state with Firebase structure - Unchanged
interface DisplayChatMessage extends FirebaseChatMessage { id: string; error?: boolean | string; recommendation?: AiActionRecommendation['data']; } // error can be string now

// Parse timer requests from chat messages - Unchanged
const parseTimerRequest = (message: string): number | null => { const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i; const match = message.match(timeRegex); if (!match) return null; const amount = parseInt(match[1]); const unit = match[2].toLowerCase(); if (isNaN(amount) || amount <= 0) return null; if (unit.startsWith('hour') || unit.startsWith('hr')) { return amount * 3600; } else if (unit.startsWith('min')) { return amount * 60; } else if (unit.startsWith('sec')) { return amount; } return null; };

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
  const today = new Date(); today.setHours(0,0,0,0);
  const [currentWeek, setCurrentWeek] = useState<Date[]>(getWeekDates(new Date()));

  // ---------------------
  // 2. AI CHAT SIDEBAR STATE
  // ---------------------
  const [chatConversations, setChatConversations] = useState<Array<{ id: string; data: { chatName?: string; createdAt?: Timestamp; lastActivity?: Timestamp; nameGenerated?: boolean; } }>>([]); // Added nameGenerated flag
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentChatHistory, setCurrentChatHistory] = useState<DisplayChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [aiSidebarTab, setAiSidebarTab] = useState<'chat' | 'insights'>('chat');
  const [aiGeneratedInsights, setAiGeneratedInsights] = useState<{ score?: number; timeManagement?: string; conflicts?: string; other?: string; error?: string | null; isLoading: boolean; lastGeneratedSig: string | null; }>({ isLoading: false, lastGeneratedSig: null });
  const [hasGeneratedChatNameForCurrentConv, setHasGeneratedChatNameForCurrentConv] = useState(false); // State for dynamic name generation

  // ---------------------
  // 3. COLLECTION & TAB STATES
  // ---------------------
  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);
  const [activeTabId, setActiveTabId] = useState<string>('tasks');

  // SIMPLIFIED TABS: All tabs are now default and immutable
  const availableTabs: TabDefinition[] = useMemo(() => {
      return [
          { id: 'tasks', name: 'Tasks', icon: Clipboard, isDefaultImmutable: true },
          { id: 'goals', name: 'Goals', icon: Target, isDefaultImmutable: true },
          { id: 'projects', name: 'Projects', icon: Layers, isDefaultImmutable: true },
          { id: 'plans', name: 'Plans', icon: Rocket, isDefaultImmutable: true },
      ];
  }, []);

  const activeTabDefinition = useMemo(() => availableTabs.find(tab => tab.id === activeTabId), [activeTabId, availableTabs]);
  const activeCollectionName: CollectionName | null = useMemo(() => activeTabId as ItemType, [activeTabId]);

  // ---------------------
  // 4. ITEM EDITING & CREATION STATE - REMOVED editingSectionId
  // ---------------------
  const [newItemText, setNewItemText] = useState("");
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingPriority, setEditingPriority] = useState<'high' | 'medium' | 'low'>('medium');

  // ---------------------
  // 5. TIMER STATES (POMODORO & CUSTOM) - Unchanged
  // ---------------------
  const [customTimers, setCustomTimers] = useState<Array<{ id: string; data: any }>>([]); const [editingTimerId, setEditingTimerId] = useState<string | null>(null); const [editingTimerName, setEditingTimerName] = useState(""); const [editingTimerMinutes, setEditingTimerMinutes] = useState(""); const [runningTimers, setRunningTimers] = useState<{ [id: string]: { isRunning: boolean; timeLeft: number; intervalRef: NodeJS.Timer | null; audio?: HTMLAudioElement | null; finished?: boolean; }; }>({}); const [isAddTimerModalOpen, setIsAddTimerModalOpen] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60); const [pomodoroRunning, setPomodoroRunning] = useState(false); const pomodoroRef = useRef<NodeJS.Timer | null>(null); const pomodoroAudioRef = useRef<HTMLAudioElement | null>(null); const [pomodoroFinished, setPomodoroFinished] = useState(false);

  // ---------------------
  // 6. UI STATES (Analytics) - REMOVED Local Insights state
  // ---------------------
  const [showAnalytics, setShowAnalytics] = useState(false);

  // ---------------------
  // 7. WEATHER STATE - Unchanged
  // ---------------------
  const [weatherData, setWeatherData] = useState<any>(null); const [weatherLoading, setWeatherLoading] = useState<boolean>(true); const [weatherError, setWeatherError] = useState<string | null>(null);

  // ---------------------
  // EFFECT HOOKS
  // ---------------------

  // LocalStorage Sync Effects - Unchanged
  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); if (isBlackoutEnabled && !isIlluminateEnabled) { document.body.classList.add('blackout-mode'); } else { document.body.classList.remove('blackout-mode'); } }, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); if (isIlluminateEnabled) { document.body.classList.add('illuminate-mode'); document.body.classList.remove('blackout-mode'); } else { document.body.classList.remove('illuminate-mode'); if (isBlackoutEnabled) { document.body.classList.add('blackout-mode'); } } }, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

  // Card Visibility Animation Effect - Unchanged
  useEffect(() => { const timer = setTimeout(() => setCardVisible(true), 100); return () => clearTimeout(timer); }, []);

  // Auth Guard & Last Seen Update - Unchanged
  useEffect(() => { const checkAuth = async () => { const currentUser = getCurrentUser(); if (!currentUser) { navigate('/login'); } else { updateDashboardLastSeen(currentUser.uid).catch(err => console.warn("Failed to update last seen:", err)); } }; checkAuth(); }, [navigate]);

  // Auth Listener, Tier/Usage Check, Context Fetch - Unchanged
  useEffect(() => { const unsubscribeAuth = onFirebaseAuthStateChanged(async (firebaseUser) => { setUser(firebaseUser); if (firebaseUser) { setIsLoadingContext(true); setContextError(null); try { const docSnap = await getDoc(doc(db, "users", firebaseUser.uid)); let nameToSet = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"); if (docSnap.exists() && docSnap.data().name) { nameToSet = docSnap.data().name; } setUserName(nameToSet); } catch (error) { console.error("Error fetching user name:", error); setUserName(firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User")); } const tier = await getUserTier(firebaseUser.email);
       setUserTier(tier); if (tier !== 'premium') { try { const currentMonthYear = new Date().toISOString().slice(0, 7); const usageData = await getUserChatUsage(firebaseUser.uid); if (usageData && usageData.month === currentMonthYear) { setChatCount(usageData.count); setChatMonth(usageData.month); const limit = getChatLimitForTier(tier); setIsChatLimitReached(usageData.count >= limit); } else {
             setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false); await updateUserChatUsage(firebaseUser.uid, 0, currentMonthYear); } } catch (err) { console.error("Error loading/updating usage data:", err); setChatCount(0); setChatMonth(new Date().toISOString().slice(0, 7)); setIsChatLimitReached(false);
           } } else { setChatCount(0); setChatMonth(''); setIsChatLimitReached(false);
       } try { const context = await getUserContext(firebaseUser.uid); setUserContext(context); } catch (error) { console.error("Error fetching user context:", error); setContextError("Failed to load user context."); setUserContext(null); } finally { setIsLoadingContext(false); } } else {
         setUserName("Loading..."); setTasks([]); setGoals([]); setProjects([]); setPlans([]); setCustomTimers([]); setWeatherData(null); setSmartOverview(""); setCurrentChatHistory([]); setChatConversations([]); setSelectedConversationId(null); setUserTier('loading'); setChatCount(0); setChatMonth(''); setIsChatLimitReached(false); setUserContext(null); setIsLoadingContext(false); setContextError(null); navigate('/login');
       } }); return () => unsubscribeAuth(); }, [navigate]);

  // Collection Snapshot Listeners - REMOVED userSections, DeepInsightActions listeners
  useEffect(() => {
    if (!user?.uid) {
        setTasks([]); setGoals([]); setProjects([]); setPlans([]); setCustomTimers([]);
        return;
    };
    const unsubFunctions = [
        onCollectionSnapshot('tasks', user.uid, setTasks),
        onCollectionSnapshot('goals', user.uid, setGoals),
        onCollectionSnapshot('projects', user.uid, setProjects),
        onCollectionSnapshot('plans', user.uid, setPlans),
        onCustomTimersSnapshot(user.uid, setCustomTimers),
    ];
    return () => { unsubFunctions.forEach(unsub => { try { unsub(); } catch (e) { console.warn("Error unsubscribing:", e); } }); };
  }, [user]);

  // Chat Conversations Listener - Enhanced robustness for selection & logging
  useEffect(() => {
    if (!user?.uid) {
      setChatConversations([]);
      setSelectedConversationId(null);
      setIsConversationsLoading(false);
      return;
    }
    setIsConversationsLoading(true);
    console.log("Setting up conversations listener for user:", user.uid);
    const unsubscribeConversations = onChatConversationsSnapshot(user.uid, (conversations) => {
      console.log("Received conversations snapshot:", conversations.length); // DEBUG: Log count
      setChatConversations(conversations);
      if (conversations.length > 0) {
        const currentSelectionValid = conversations.some(c => c.id === selectedConversationId);
        if (!selectedConversationId || !currentSelectionValid) {
            const sorted = [...conversations].sort((a, b) =>
                (b.data?.lastActivity?.seconds ?? b.data?.createdAt?.seconds ?? 0) -
                (a.data?.lastActivity?.seconds ?? a.data?.createdAt?.seconds ?? 0)
            );
            const mostRecentId = sorted[0].id;
            console.log("Auto-selecting most recent conversation:", mostRecentId);
            setSelectedConversationId(mostRecentId);
            // Reset name generation flag when selecting a new conversation
            setHasGeneratedChatNameForCurrentConv(sorted[0].data?.nameGenerated || false);
        } else {
             console.log("Keeping selected conversation:", selectedConversationId);
             // Update name generation flag for the currently selected conversation if it changes
             const currentConvData = conversations.find(c => c.id === selectedConversationId)?.data;
             setHasGeneratedChatNameForCurrentConv(currentConvData?.nameGenerated || false);
        }
      } else {
        console.log("No conversations found, resetting selection.");
        setSelectedConversationId(null);
        setHasGeneratedChatNameForCurrentConv(false);
      }
      setIsConversationsLoading(false);
    });
    return () => {
        console.log("Unsubscribing from conversations listener.");
        unsubscribeConversations();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Remove selectedConversationId from deps to prevent re-subscribing on selection change

    // Chat Messages Listener - Track name generation flag on selection change
    useEffect(() => {
        if (!user?.uid || !selectedConversationId) {
            setCurrentChatHistory([]);
            setIsMessagesLoading(false);
            setHasGeneratedChatNameForCurrentConv(false); // Reset flag if no conversation selected
            return;
        }
        console.log("Setting up messages listener for conversation:", selectedConversationId);
        setIsMessagesLoading(true);

        // Find the selected conversation data to check the nameGenerated flag
        const selectedConvData = chatConversations.find(c => c.id === selectedConversationId)?.data;
        setHasGeneratedChatNameForCurrentConv(selectedConvData?.nameGenerated || false);

        const unsubscribeMessages = onChatMessagesSnapshot(selectedConversationId, (messages) => {
            console.log(`Received ${messages.length} messages for ${selectedConversationId}`);
            const displayMessages = messages.map((msg, index) => ({
                ...msg,
                // Ensure a unique and stable key for each message
                id: `msg-${selectedConversationId}-${msg.createdAt?.seconds || 0}-${index}`
            }));
            setCurrentChatHistory(displayMessages);
            setIsMessagesLoading(false);
        });

        return () => {
            console.log("Unsubscribing from messages listener for:", selectedConversationId);
            unsubscribeMessages();
        };
    // Include chatConversations in dependencies to re-check nameGenerated flag if conversation data updates
    }, [user, selectedConversationId, chatConversations]);


  // Weather Fetch Effect - Unchanged
  useEffect(() => { if (!user || !weatherApiKey) { setWeatherLoading(false); setWeatherData(null); setWeatherError(null); return; } let isMounted = true; setWeatherLoading(true); setWeatherError(null); navigator.geolocation.getCurrentPosition( async (position) => { if (!isMounted) return; const { latitude, longitude } = position.coords; try { const response = await fetchWithTimeout( `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${latitude},${longitude}&days=3`, {}, 15000); if (!response.ok) { let errorMsg = `Weather fetch failed (${response.status})`; try { const errorData = await response.json(); errorMsg = errorData?.error?.message || errorMsg; } catch {} throw new Error(errorMsg); } const data = await response.json(); if (isMounted) { setWeatherData(data); setWeatherLoading(false); } } catch (error: any) { if (isMounted) { console.error("Failed to fetch weather:", error); setWeatherData(null); if (error.message === 'Request timed out') { setWeatherError("Weather request timed out."); } else { setWeatherError(error.message || "Failed to fetch weather data."); } setWeatherLoading(false); } } }, (error) => { if (isMounted) { console.error("Geolocation error:", error); setWeatherData(null); let geoErrorMsg = "Geolocation Error"; switch(error.code) { case error.PERMISSION_DENIED: geoErrorMsg = "Location permission denied."; break; case error.POSITION_UNAVAILABLE: geoErrorMsg = "Location information is unavailable."; break; case error.TIMEOUT: geoErrorMsg = "Geolocation request timed out."; break; default: geoErrorMsg = `Geolocation Error: ${error.message}`; } setWeatherError(geoErrorMsg); setWeatherLoading(false); } }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 } ); return () => { isMounted = false; }; }, [user]);

  // Greeting Update Effect - Unchanged
  useEffect(() => { const interval = setInterval(() => { setGreeting(getTimeBasedGreeting()); setQuote(getRandomQuote()); }, 60000); return () => clearInterval(interval); }, []);

  // ---------------------
  // SMART OVERVIEW GENERATION (TIER-BASED) - REVISED TO FIX EXTRACTION
  // ---------------------
    const [smartOverview, setSmartOverview] = useState<string>(""); // Holds AI generated text or error messages
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [lastGeneratedDataSig, setLastGeneratedDataSig] = useState<string>("");
    const [lastOverviewResponseText, setLastOverviewResponseText] = useState<string>(""); // Stores the actual text content

    const overviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [debouncedItemsSigForOverview, setDebouncedItemsSigForOverview] = useState("");

    // Signature for overview (remains the same)
    const createItemsSignatureForOverview = (items: any[][]): string => {
        return items
        .flat()
        .map(item => `${item.id}-${item.data.completed}-${item.data.dueDate?.seconds || 'null'}-${item.data.priority || 'm'}-${item.data.task||item.data.goal||item.data.project||item.data.plan||''}`)
        .sort()
        .join('|');
    };

     // Effect to update debounced signature for overview (remains the same)
    useEffect(() => {
        if (!user) return;
        const currentSig = createItemsSignatureForOverview([tasks, goals, projects, plans]);
        if (overviewTimeoutRef.current) { clearTimeout(overviewTimeoutRef.current); }
        overviewTimeoutRef.current = setTimeout(() => { setDebouncedItemsSigForOverview(currentSig); }, 1500); // 1.5 seconds debounce
        return () => { if (overviewTimeoutRef.current) { clearTimeout(overviewTimeoutRef.current); } };
    }, [user, tasks, goals, projects, plans]);

     // Effect to generate overview based on debounced signature and user tier - REVISED for functionality & extraction
    useEffect(() => {
        if (!user || !geminiApiKey || !debouncedItemsSigForOverview || userTier === 'loading' || userTier === 'basic') {
            setSmartOverview(""); setOverviewLoading(userTier === 'loading'); setLastGeneratedDataSig(""); setLastOverviewResponseText(""); return;
        }
        if (debouncedItemsSigForOverview === lastGeneratedDataSig && !overviewLoading) {
            setSmartOverview(lastOverviewResponseText || "Add items or check back later for an overview."); return;
        }
        const generateOverview = async () => {
            if (overviewLoading) return;
            console.log("Overview: Generating new overview."); setOverviewLoading(true); setSmartOverview(""); setLastGeneratedDataSig(debouncedItemsSigForOverview);
            const formatItemForOverview = (item: any, type: string) => { let dueDate: Date | null = null; if (item.data.dueDate?.toDate) dueDate = item.data.dueDate.toDate(); else if (item.data.dueDate) try { dueDate = new Date(item.data.dueDate); if (isNaN(dueDate.getTime())) dueDate = null; } catch { dueDate = null; } const title = item.data[type] || item.data.title || 'Untitled'; const priority = item.data.priority || calculatePriority(item); const completed = item.data.completed ? 'Completed' : 'Pending'; const dueDateFormatted = dueDate ? ` (Due: ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''; return `• ${title}${dueDateFormatted} [Priority: ${priority}] [Status: ${completed}]`; };
            const allActiveItems = [...tasks, ...goals, ...projects, ...plans].filter(i => !i.data.completed); const formattedData = allActiveItems.length > 0 ? allActiveItems.map(item => { if (item.data.task) return formatItemForOverview(item, 'task'); if (item.data.goal) return formatItemForOverview(item, 'goal'); if (item.data.project) return formatItemForOverview(item, 'project'); if (item.data.plan) return formatItemForOverview(item, 'plan'); return null; }).filter(Boolean).join('\n') : "No pending items.";
            if (formattedData === "No pending items.") { console.log("Overview: No pending items found."); setSmartOverview(`No pending items to generate overview from.`); setOverviewLoading(false); setLastOverviewResponseText(""); return; }
            const firstName = userName.split(" ")[0] || "User";
            const prompt = `Analyze these pending items for user "${firstName}" and provide a *very concise* (1-2 sentences, max 80 tokens) plain text Smart Overview focusing on the single most immediate priority or suggestion. No greetings, no sign-offs, no markdown, just the overview sentence(s).\n\nCurrent Pending Items:\n${formattedData}\n\nExample Output: Focus on high-priority 'Submit Report' due today. Next, tackle 'Plan Project Kickoff'.\nExample Output: Check the overdue 'Draft Proposal' task first. Then review upcoming goals.\nExample Output: Looks clear for today. Consider planning your next project step.`;
            console.log("Overview: Sending prompt to Gemini:", prompt);
            try {
                const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 80, temperature: 0.5 }, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, ], }) };
                const response = await fetchWithTimeout(geminiOverviewEndpoint, geminiOptions, 20000); console.log("Overview API Response Status:", response.status);
                if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} console.error("Overview API Error Body:", errorBody); throw new Error(`Gemini API error (${response.status}): ${errorBody}`); }
                const resultJson = await response.json(); console.log("Overview API Response JSON:", resultJson);
                let extractedOverviewText = "";
                if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) { extractedOverviewText = resultJson.candidates[0].content.parts[0].text; console.log("Overview Extracted Directly:", extractedOverviewText); }
                else { const finishReason = resultJson.candidates?.[0]?.finishReason; const blockReason = resultJson.promptFeedback?.blockReason; let errorMessage = "AI failed to provide overview text."; if (finishReason === 'SAFETY' || blockReason) { errorMessage = `Overview blocked: ${finishReason || blockReason || 'Safety'}`; } else if (resultJson.error?.message) { errorMessage = `API Error: ${resultJson.error.message}`; } console.error("Overview response missing text. JSON:", resultJson); throw new Error(errorMessage); }
                const cleanText = extractedOverviewText.trim();
                if (!cleanText || cleanText.toLowerCase().startsWith("[error") || cleanText.length < 5) { console.warn("Received invalid overview content:", cleanText); throw new Error("Received empty or invalid overview content."); }
                if (cleanText !== lastOverviewResponseText) { console.log("Overview: New response received:", cleanText); setLastOverviewResponseText(cleanText); setSmartOverview(cleanText); }
                else { console.log("Overview: Response is same as last time, keeping current state."); setSmartOverview(lastOverviewResponseText); }
            } catch (error: any) {
                console.error("Overview generation error:", error); let errorMsg = "AI overview currently unavailable."; if (error.message.includes('429') || error.message.includes('rate limit')) { errorMsg = "Overview limit reached. Try again later."; } else if (error.message.includes('API key not valid')) { errorMsg = "Invalid AI config."; } else if (error.message.includes('timed out')) { errorMsg = "Overview request timed out."; } else if (error.message.includes("invalid overview content") || error.message.includes("provide overview text") || error.message.includes("Overview blocked")) { errorMsg = `AI Error: ${error.message}`; } else if (error.message.includes("API error")) { const detailMatch = error.message.match(/Gemini API error \(\d+\): (.*)/); errorMsg = `Overview generation failed: ${detailMatch ? detailMatch[1] : 'API issue'}`; } else { errorMsg = `Overview Error: ${error.message}`; }
                setSmartOverview(errorMsg); setLastOverviewResponseText(""); setLastGeneratedDataSig(""); // Force retry on error
            } finally { setOverviewLoading(false); }
        };
        generateOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, userTier, debouncedItemsSigForOverview, userName, geminiApiKey]); // Keep dependencies as is

  // Pomodoro Timer Interval Effect - Unchanged
  useEffect(() => { if (pomodoroRunning && pomodoroTimeLeft > 0) { pomodoroRef.current = setInterval(() => { setPomodoroTimeLeft((prev) => { if (prev <= 1) { clearInterval(pomodoroRef.current as NodeJS.Timer); setPomodoroRunning(false); setPomodoroFinished(true); if (!pomodoroAudioRef.current) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error("Error playing sound:", e)); pomodoroAudioRef.current = alarmAudio; } catch (e) { console.error("Could not create or play audio:", e); } } return 0; } return prev - 1; }); }, 1000); } else { if (pomodoroRef.current) clearInterval(pomodoroRef.current); } return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); }; }, [pomodoroRunning, pomodoroTimeLeft]);
  useEffect(() => { return () => { if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current = null; } }; }, []);

  // Custom Timer State Sync Effect - Unchanged
  useEffect(() => { setRunningTimers(prev => { const nextState: typeof prev = {}; customTimers.forEach(timer => { const sourceTime = timer.data.time; if (prev[timer.id]) { const localState = prev[timer.id]; nextState[timer.id] = { ...localState, timeLeft: localState.isRunning ? localState.timeLeft : (sourceTime !== localState.timeLeft && !localState.finished) ? sourceTime : localState.timeLeft, finished: localState.isRunning ? localState.finished : (sourceTime > 0 ? false : localState.finished) }; } else { nextState[timer.id] = { isRunning: false, timeLeft: sourceTime, intervalRef: null, finished: sourceTime <= 0 }; } }); Object.keys(prev).forEach(id => { if (!nextState[id]) {
         const timerState = prev[id]; if (timerState.intervalRef) clearInterval(timerState.intervalRef); if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; } } }); return nextState; }); }, [customTimers]);

  // Chat Scroll Effect - Unchanged
  useEffect(() => { if (chatEndRef.current && isAiSidebarOpen && aiSidebarTab === 'chat') { requestAnimationFrame(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }); } }, [currentChatHistory, isAiSidebarOpen, aiSidebarTab]);

  // ---------------------
  // HANDLER FUNCTIONS
  // ---------------------

  const handleToggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const handleTabChange = (tabId: string) => { setActiveTabId(tabId); setEditingItemId(null); };

  // Item Creation Handler - Unchanged
  const handleCreate = async () => {
      if (!user || !newItemText.trim() || !activeCollectionName) { console.warn("Cannot create item: Missing user, text, or active collection."); return; }
      let dateValue: Date | null = null; if (newItemDate) { try { const d = new Date(newItemDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { dateValue = d; } } catch { dateValue = null; } }
      const itemTypeForCreate: ItemType = activeCollectionName;
      const titleField = itemTypeForCreate.slice(0, -1);
      const itemData = { [titleField]: newItemText.trim(), text: newItemText.trim(), dueDate: dateValue, priority: newItemPriority, completed: false, createdAt: Timestamp.now(), };
      try { await createItem(user.uid, itemTypeForCreate, itemData); setNewItemText(""); setNewItemDate(""); setNewItemPriority("medium"); }
      catch (error: any) { console.error(`Error creating ${itemTypeForCreate}:`, error); alert(`Failed to create ${itemTypeForCreate}. Error: ${error.message}. Please check console.`); }
  };

  // Get Title Field Helper - Unchanged
  const getTitleField = (itemData: any): string => { if (itemData.task !== undefined) return 'task'; if (itemData.goal !== undefined) return 'goal'; if (itemData.project !== undefined) return 'project'; if (itemData.plan !== undefined) return 'plan'; if (itemData.text !== undefined) return 'text'; return 'task'; }; // Default to 'task'? Maybe 'text' is better default?

  // Item Edit Click Handler - Unchanged
  const handleEditClick = (itemId: string, currentData: any) => {
      const titleField = getTitleField(currentData);
      setEditingItemId(itemId); setEditingText(currentData[titleField] || currentData.text || "");
      let dateForInput = ""; if (currentData.dueDate) { try { const dueDateObj = currentData.dueDate.toDate ? currentData.dueDate.toDate() : new Date(currentData.dueDate); if (!isNaN(dueDateObj.getTime())) { dateForInput = dueDateObj.toISOString().split('T')[0]; } } catch (e) { console.warn("Error converting date for editing:", e); } }
      setEditingDate(dateForInput); setEditingPriority(currentData.priority || 'medium');
  };

  // Item Edit Save Handler - Unchanged
  const handleEditSave = async (itemId: string) => {
      if (!user || !editingText.trim()) return;
      let dateValue: Date | null = null; if (editingDate) { try { const d = new Date(editingDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { dateValue = d; } } catch { dateValue = null; } }
      const allItems = [...tasks, ...goals, ...projects, ...plans]; const originalItem = allItems.find(item => item.id === itemId); if (!originalItem) { console.error("Cannot save edit: Original item not found."); alert("Error: Could not find the item to update."); return; }
      let collectionToUpdate: ItemType; let titleField: string;
      if (originalItem.data.task !== undefined) { collectionToUpdate = 'tasks'; titleField = 'task'; }
      else if (originalItem.data.goal !== undefined) { collectionToUpdate = 'goals'; titleField = 'goal'; }
      else if (originalItem.data.project !== undefined) { collectionToUpdate = 'projects'; titleField = 'project'; }
      else if (originalItem.data.plan !== undefined) { collectionToUpdate = 'plans'; titleField = 'plan'; }
      else { collectionToUpdate = 'tasks'; titleField = 'text'; }
      try { const dataToUpdate: any = { [titleField]: editingText.trim(), text: editingText.trim(), dueDate: dateValue, priority: editingPriority };
          console.log(`Updating ${collectionToUpdate} item ${itemId} with:`, dataToUpdate);
          await updateItem(collectionToUpdate, itemId, dataToUpdate); setEditingItemId(null);
      } catch (error: any) { console.error(`Error updating ${collectionToUpdate.slice(0, -1)}:`, error); alert(`Failed to update ${collectionToUpdate.slice(0, -1)}. Error: ${error.message}`); }
  };

  // Item Delete Handler - Unchanged
  const handleDelete = async (itemId: string) => { if (!user) return; const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemToDelete = allItems.find(item => item.id === itemId); let collectionToDelete: ItemType | null = null; let typeString: string | null = null; if (itemToDelete) { if (itemToDelete.data.task !== undefined) { collectionToDelete = 'tasks'; typeString = 'task'; } else if (itemToDelete.data.goal !== undefined) { collectionToDelete = 'goals'; typeString = 'goal'; } else if (itemToDelete.data.project !== undefined) { collectionToDelete = 'projects'; typeString = 'project'; } else if (itemToDelete.data.plan !== undefined) { collectionToDelete = 'plans'; typeString = 'plan'; } } else if (activeCollectionName && activeCollectionName !== 'customTimers' && activeCollectionName !== 'users') { collectionToDelete = activeCollectionName; typeString = activeCollectionName.slice(0, -1); console.warn(`Item ${itemId} not found in local state, attempting delete from active tab collection: ${collectionToDelete}`); } if (!collectionToDelete || !typeString) { console.error("Cannot delete: Unknown item type or collection for item ID:", itemId); alert("Error: Could not determine the type of item to delete."); return; } const confirmDel = window.confirm(`Are you sure you want to delete this ${typeString}? This action cannot be undone.`); if (!confirmDel) return; try { await deleteItem(collectionToDelete, itemId); if (editingItemId === itemId) setEditingItemId(null); } catch (error: any) { console.error(`Error deleting ${typeString}:`, error); alert(`Failed to delete ${typeString}. Error: ${error.message}`); } };

  // Mark Complete Handler - Unchanged
  const handleMarkComplete = async (itemId: string) => { if (!user) return; const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemToMark = allItems.find(item => item.id === itemId); if (!itemToMark) { console.error("Cannot mark complete: Item not found."); alert("Error: Could not find item."); return; } let collectionToUpdate: ItemType; if (itemToMark.data.task !== undefined) collectionToUpdate = 'tasks'; else if (itemToMark.data.goal !== undefined) collectionToUpdate = 'goals'; else if (itemToMark.data.project !== undefined) collectionToUpdate = 'projects'; else if (itemToMark.data.plan !== undefined) collectionToUpdate = 'plans'; else { console.error("Cannot mark complete: Unknown item type."); alert("Error: Could not determine item type."); return; } try { await markItemComplete(collectionToUpdate, itemId, !itemToMark.data.completed); } catch (error: any) { console.error("Error marking item as complete:", error); alert(`Failed to update completion status. Error: ${error.message}`); } };

  // Pomodoro Handlers - Unchanged
  const handlePomodoroStart = () => { if (pomodoroRunning || pomodoroFinished) return; setPomodoroRunning(true); setPomodoroFinished(false); if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; } if (pomodoroTimeLeft <= 0) { setPomodoroTimeLeft(25 * 60); } };
  const handlePomodoroPause = () => { if (!pomodoroRunning) return; setPomodoroRunning(false); };
  const handlePomodoroReset = () => { setPomodoroRunning(false); setPomodoroFinished(false); if (pomodoroRef.current) clearInterval(pomodoroRef.current); pomodoroRef.current = null; setPomodoroTimeLeft(25 * 60); if (pomodoroAudioRef.current) { pomodoroAudioRef.current.pause(); pomodoroAudioRef.current.currentTime = 0; pomodoroAudioRef.current = null; } };
  const formatPomodoroTime = (timeInSeconds: number) => { const mins = Math.floor(timeInSeconds / 60); const secs = timeInSeconds % 60; return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; };

  // Custom Timer Handlers - Unchanged
  const handleAddCustomTimer = async (name: string, durationMinutes: number) => { if (!user || !name || durationMinutes <= 0) return; try { await addCustomTimer(name.trim(), durationMinutes * 60, user.uid); setIsAddTimerModalOpen(false); } catch (error) { console.error("Error adding custom timer:", error); alert("Failed to add custom timer. Please try again."); } };
  const formatCustomTime = (timeInSeconds: number): string => { if (timeInSeconds < 0) timeInSeconds = 0; const hours = Math.floor(timeInSeconds / 3600); const remainder = timeInSeconds % 3600; const mins = Math.floor(remainder / 60); const secs = remainder % 60; if (hours > 0) { return `${hours.toString()}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; } else { return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`; } };
  const startCustomTimer = (timerId: string) => { setRunningTimers((prev) => { const timerState = prev[timerId]; if (!timerState || timerState.isRunning || timerState.timeLeft <= 0) return prev; const newState = { ...prev }; const newTimerState = { ...timerState }; if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; } newTimerState.isRunning = true; newTimerState.finished = false; const intervalId = setInterval(() => { setRunningTimers((currentTimers) => { if (!currentTimers[timerId]) { clearInterval(intervalId); return currentTimers; } const updatedTimers = { ...currentTimers }; const tState = { ...updatedTimers[timerId] };
           if (!tState.isRunning && tState.intervalRef) { clearInterval(tState.intervalRef); tState.intervalRef = null; updatedTimers[timerId] = tState; return updatedTimers; }
           if (tState.timeLeft <= 0 && tState.isRunning) { clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.intervalRef = null; tState.timeLeft = 0; updatedTimers[timerId] = tState; return updatedTimers; } if (tState.timeLeft <= 1) {
             clearInterval(tState.intervalRef as NodeJS.Timer); tState.isRunning = false; tState.finished = true; tState.timeLeft = 0; tState.intervalRef = null; if (!tState.audio) { try { const alarmAudio = new Audio('https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801'); alarmAudio.loop = true; alarmAudio.play().catch(e => console.error(`Error playing timer sound for ${timerId}:`, e)); tState.audio = alarmAudio; } catch(e) { console.error("Could not create/play audio:", e)} } } else { tState.timeLeft -= 1; } updatedTimers[timerId] = tState; return updatedTimers; }); }, 1000); newTimerState.intervalRef = intervalId; newState[timerId] = newTimerState; return newState; }); };
  const pauseCustomTimer = (timerId: string) => { setRunningTimers((prev) => { const timerState = prev[timerId]; if (!timerState || !timerState.isRunning) return prev; const newState = { ...prev }; const newTimerState = { ...timerState }; if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); newTimerState.intervalRef = null; } newTimerState.isRunning = false; newState[timerId] = newTimerState; return newState; }); };
  const resetCustomTimer = (timerId: string) => { const sourceTimerData = customTimers.find((t) => t.id === timerId)?.data; if (!sourceTimerData) {
      setRunningTimers(prev => { const { [timerId]: _, ...rest } = prev; return rest; }); return; } const defaultTime = sourceTimerData.time; setRunningTimers((prev) => { const timerState = prev[timerId]; const newState = { ...prev }; const newTimerState = timerState ? { ...timerState } : { isRunning: false, timeLeft: defaultTime, intervalRef: null, finished: defaultTime <= 0, audio: undefined }; if (newTimerState.intervalRef) { clearInterval(newTimerState.intervalRef); } newTimerState.isRunning = false; newTimerState.timeLeft = defaultTime; newTimerState.intervalRef = null; newTimerState.finished = defaultTime <= 0; if (newTimerState.audio) { newTimerState.audio.pause(); newTimerState.audio.currentTime = 0; newTimerState.audio = undefined; } newState[timerId] = newTimerState; return newState; }); };
  const handleEditTimerClick = (timerId: string, currentName: string, currentTime: number) => { if (runningTimers[timerId]?.isRunning) { pauseCustomTimer(timerId); } setEditingTimerId(timerId); setEditingTimerName(currentName); setEditingTimerMinutes(String(Math.max(1, Math.floor(currentTime / 60)))); };
  const handleEditTimerSave = async (timerId: string) => { if (!editingTimerName.trim()) { alert("Please enter a timer name."); return; }; const minutes = parseInt(editingTimerMinutes, 10); if (isNaN(minutes) || minutes <= 0) { alert("Please enter a valid positive number for minutes."); return; } try { const newTimeSeconds = minutes * 60; await updateCustomTimer(timerId, editingTimerName.trim(), newTimeSeconds);
       setRunningTimers(prev => ({ ...prev, [timerId]: { ...prev[timerId], timeLeft: newTimeSeconds, finished: newTimeSeconds <= 0 } })); setEditingTimerId(null); } catch (error) { console.error("Error updating timer:", error); alert("Failed to update timer. Please try again."); } };
  const handleDeleteTimer = async (timerId: string) => { const confirmDel = window.confirm("Are you sure you want to delete this timer?"); if (!confirmDel) return; try {
      setRunningTimers(prev => { const timerState = prev[timerId]; if (timerState) { if (timerState.intervalRef) clearInterval(timerState.intervalRef); if (timerState.audio) { timerState.audio.pause(); timerState.audio.currentTime = 0; } } const { [timerId]: _, ...rest } = prev; return rest; }); await deleteCustomTimer(timerId); } catch (error) { console.error("Error deleting custom timer:", error); alert("Failed to delete timer. Please try again."); } };

  // Progress Bar Memos - Unchanged
  const tasksProgress = useMemo(() => { const total = tasks.length; return total === 0 ? 0 : Math.round((tasks.filter(t => t.data.completed).length / total) * 100); }, [tasks]);
  const goalsProgress = useMemo(() => { const total = goals.length; return total === 0 ? 0 : Math.round((goals.filter(g => g.data.completed).length / total) * 100); }, [goals]);
  const projectsProgress = useMemo(() => { const total = projects.length; return total === 0 ? 0 : Math.round((projects.filter(p => p.data.completed).length / total) * 100); }, [projects]);
  const plansProgress = useMemo(() => { const total = plans.length; return total === 0 ? 0 : Math.round((plans.filter(pl => pl.data.completed).length / total) * 100); }, [plans]);

  // Format items for chat context - REMOVED sectionId filtering
  const formatItemsForChat = useCallback(() => { // Wrap in useCallback
      const lines: string[] = [];
      lines.push(`Current items for ${userName}:\n`);
      const formatLine = (item: any, type: string) => {
          const name = item.data[type] || item.data.text || 'Untitled';
          const due = item.data.dueDate?.toDate?.();
          const priority = item.data.priority || calculatePriority(item);
          const completed = item.data.completed ? 'Yes' : 'No';
          return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${name}${ due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '' } [Priority: ${priority}] [Completed: ${completed}] [ID: ${item.id}]`; // Include ID
      };

      const allItemsMap: { [key in ItemType]?: any[] } = { tasks, goals, projects, plans };

      if (tasks.length === 0 && goals.length === 0 && projects.length === 0 && plans.length === 0) {
          return `No active items found for ${userName}.`;
      }

      availableTabs.forEach(tab => {
          lines.push(`\n--- Tab: ${tab.name} ---`);
          const itemType = tab.id;
          const itemsInTab: any[] = allItemsMap[itemType] || [];
          const filteredItems = itemsInTab;

          if (filteredItems.length === 0) { lines.push(" (No items in this tab)"); }
          else { filteredItems.forEach((item) => { const actualItemType = getTitleField(item.data); lines.push(formatLine(item, actualItemType)); }); }
      });
      return lines.join('\n');
  // Add dependencies for useCallback
  }, [userName, tasks, goals, projects, plans, availableTabs]);

  // Execute AI Recommended Action (from Chat) - Enhanced logging & ID finding
  const executeAiAction = async (recommendation: AiActionRecommendation['data']) => {
      if (!user) { console.error("Cannot execute AI action: No user logged in."); return; }
      console.log("Attempting to execute AI action:", recommendation);
      const { action, itemType, payload } = recommendation;
      if (!action || !itemType || !payload) { console.error("Invalid AI action recommendation received:", recommendation); alert("Error: Received an invalid action recommendation from AI."); return; }
      try {
          let confirmationMessage = '';
          if (action === 'create') { console.log("Executing AI Action: CREATE"); let dateValue: Date | null = null; if (payload.dueDate) { try { const d = new Date(payload.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) dateValue = d; } catch { console.warn("Invalid date format in AI create payload:", payload.dueDate); } } const titleField = itemType.slice(0, -1); const createPayload = { [titleField]: payload.text || 'AI Generated Item', text: payload.text || 'AI Generated Item', dueDate: dateValue, priority: payload.priority || 'medium', completed: false, createdAt: Timestamp.now() }; console.log("AI Create Payload:", createPayload); await createItem(user.uid, itemType, createPayload); confirmationMessage = `✅ Action complete: Created ${itemType.slice(0,-1)} "${payload.text || 'AI Generated Item'}".`;
          } else if (action === 'update') { console.log("Executing AI Action: UPDATE"); let itemIdToUpdate = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToUpdate && payload.itemName) { console.log(`Attempting to find ${itemType} named "${payload.itemName}" for update...`); try { itemIdToUpdate = await findItemByName(itemType, user.uid, payload.itemName, titleField); console.log(`Found item ID via name lookup: ${itemIdToUpdate}`); } catch (findError) { console.error(`Error finding item by name: ${payload.itemName}`, findError); throw new Error(`Could not find ${itemType.slice(0,-1)} named "${payload.itemName}" to update.`); } } if (!itemIdToUpdate) { throw new Error(`Could not identify the ${itemType.slice(0,-1)} to update. Please provide name or ID.`); } const { itemId, itemName, ...updates } = payload; if (updates.dueDate) { try { const d = new Date(updates.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) { updates.dueDate = d; } else { delete updates.dueDate; console.warn("Invalid date format in AI update payload, removing:", updates.dueDate); } } catch { delete updates.dueDate; console.warn("Invalid date format in AI update payload, removing:", updates.dueDate); } } else if (updates.dueDate === null || updates.dueDate === '') { updates.dueDate = null; } if (updates[titleField] !== undefined && updates[titleField] !== null) { updates.text = updates[titleField]; } delete updates.itemId; delete updates.itemName; delete updates.createdAt; if (Object.keys(updates).length === 0) { throw new Error("No valid fields provided for update."); } console.log("Applying AI updates:", updates, "to item ID:", itemIdToUpdate); await updateItem(itemType, itemIdToUpdate, updates); confirmationMessage = `✅ Action complete: Updated ${itemType.slice(0,-1)}.`;
          } else if (action === 'delete') { console.log("Executing AI Action: DELETE"); let itemIdToDelete = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToDelete && payload.itemName) { console.log(`Attempting to find ${itemType} named "${payload.itemName}" for deletion...`); try { itemIdToDelete = await findItemByName(itemType, user.uid, payload.itemName, titleField); console.log(`Found item ID via name lookup: ${itemIdToDelete}`); } catch (findError) { console.error(`Error finding item by name: ${payload.itemName}`, findError); throw new Error(`Could not find ${itemType.slice(0,-1)} named "${payload.itemName}" to delete.`); } } if (!itemIdToDelete) { throw new Error(`Could not identify the ${itemType.slice(0,-1)} named "${payload.itemName || '(name not provided)'}" to delete.`); } console.log("Attempting AI Delete ID:", itemIdToDelete); await deleteItem(itemType, itemIdToDelete); confirmationMessage = `✅ Action complete: Deleted ${itemType.slice(0,-1)}.`;
          } else { throw new Error(`Unsupported AI action type: ${action}`); }
          if (isAiSidebarOpen && aiSidebarTab === 'chat' && selectedConversationId) { const confirmMsg: DisplayChatMessage = { id: `action-confirm-${Date.now()}`, role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev, confirmMsg]); saveChatMessage(selectedConversationId, { role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() }).catch(e => console.error("Failed to save action confirmation message:", e)); }
      } catch (error: any) {
          console.error("Error executing AI action:", error); const errorMsgContent = `❌ Error executing action: ${error.message || 'Unknown error'}.`; if (isAiSidebarOpen && aiSidebarTab === 'chat' && selectedConversationId) { const errorMsg: DisplayChatMessage = { id: `action-error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev, errorMsg]); saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, createdAt: Timestamp.now() }).catch(e => console.error("Failed to save action error message:", e)); } alert(`Failed to execute AI action: ${error.message || 'Unknown error'}`);
      }
  };

  // --- Generate Chat Name (Adapted from AIChat.tsx) ---
  const generateDynamicChatName = async (convId: string, history: DisplayChatMessage[]) => {
      if (!user || !geminiApiKey) return; // Use Pro endpoint for better naming

      const conversationText = history
          .slice(-6) // Use last ~6 messages for context
          .map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content}`)
          .join('\n');

      // Simple prompt for a concise title
      const namePrompt = `Based on this recent conversation snippet, suggest a very short (3-5 words max) title. Output ONLY the title, nothing else.
Example: "Planning Project X" or "Grocery List Update" or "Discussing Weekend Plans"

Conversation:
${conversationText}`;

      console.log("Attempting to generate chat name for:", convId);

      try {
          const options = {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: namePrompt }] }],
                  generationConfig: { maxOutputTokens: 15, temperature: 0.5 }, // Short, less creative
                  safetySettings: [ // Standard safety settings
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                  ]
              }),
          };
          // Using non-streaming endpoint for a single title generation
          const response = await fetchWithTimeout(geminiProEndpoint, options, 15000); // 15s timeout

          if (!response.ok) {
              const errorBody = await response.text();
              throw new Error(`Chat name generation failed (${response.status}): ${errorBody}`);
          }

          const resultJson = await response.json();
          console.log("Chat Name Generation Response:", resultJson); // DEBUG

          let generatedName = "Chat Summary"; // Default fallback
          if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) {
              generatedName = resultJson.candidates[0].content.parts[0].text.trim().replace(/["']/g, ''); // Remove quotes
              // Basic validation: Check length and avoid placeholder-like names
              if (generatedName.length > 30 || generatedName.toLowerCase().includes("title:") || generatedName.toLowerCase().includes("summary:")) {
                  console.warn("Generated name seems invalid, using default:", generatedName);
                  generatedName = "Chat Summary";
              }
          } else {
               console.warn("Could not extract chat name text from response.");
          }


          console.log(`Generated name for ${convId}:`, generatedName);
          await updateChatConversationName(convId, generatedName, true); // Update name and set nameGenerated flag
          setHasGeneratedChatNameForCurrentConv(true); // Update local state

      } catch (err) {
          console.error('Error generating chat name:', err);
          // Don't update the name on error
      }
  };


  // Handle Chat Submit - REVISED: Improved prompt clarity, parsing robustness, error handling, streaming fix, dynamic naming
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading || !user || !selectedConversationId) {
        console.warn("Chat submit blocked:", { chatMessage: !!chatMessage.trim(), isChatLoading, user: !!user, selectedConversationId });
        return;
    }

    // Tier/Limit Check
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    let limitReached = false; let currentLimit = Infinity;
    if (userTier !== 'premium') { currentLimit = getChatLimitForTier(userTier); let currentCount = chatCount; if (chatMonth !== currentMonthYear) { currentCount = 0; setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; updateUserChatUsage(user.uid, 0, currentMonthYear).catch(err => console.error("Failed to reset chat usage:", err)); } else { limitReached = currentCount >= currentLimit; setIsChatLimitReached(limitReached); } }
    if (limitReached) { const limitMsg: DisplayChatMessage = { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${currentLimit} chat message limit for this month. Upgrade for more interactions!`, error: true, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev, limitMsg]); setChatMessage(''); return; }

    // Prepare and Send User Message
    const currentMessage = chatMessage;
    setChatMessage('');
    const timerDuration = parseTimerRequest(currentMessage);
    const userMsgData: FirebaseChatMessage = { role: 'user', content: currentMessage, createdAt: Timestamp.now() };
    const userMsgId = `user-${Date.now()}-${Math.random()}`;
    const userMsgDisplay: DisplayChatMessage = { ...userMsgData, id: userMsgId };
    // Capture history *before* adding new messages for potential name generation
    const historyBeforeUpdate = [...currentChatHistory, userMsgDisplay];
    setCurrentChatHistory(historyBeforeUpdate);
    setIsChatLoading(true);
    try { await saveChatMessage(selectedConversationId, userMsgData); } catch (error) { console.error("Failed to save user message:", error); const errorMsg: DisplayChatMessage = { id: `err-save-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving your message. Please try again.", error: true, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev.filter(m => m.id !== userMsgId), errorMsg]); setIsChatLoading(false); return; }

    // Update Usage Count
    if (userTier !== 'premium' && user?.uid) { const newCount = chatCount + 1; setChatCount(newCount); setIsChatLimitReached(newCount >= currentLimit); updateUserChatUsage(user.uid, newCount, currentMonthYear).catch(err => console.error("Failed to update chat usage count:", err)); }

    // Handle Timer Request
    if (timerDuration) { const timerId = Math.random().toString(36).substring(2, 9); const timerMsgContent = `Okay, starting a timer for ${Math.round(timerDuration / 60)} minutes.`; const timerMsgData: FirebaseChatMessage = { role: 'assistant', content: timerMsgContent, timer: { type: 'timer', duration: timerDuration, id: timerId }, createdAt: Timestamp.now() }; const timerMsgDisplay: DisplayChatMessage = { ...timerMsgData, id: `timer-start-${timerId}-${Math.random()}` }; setCurrentChatHistory(prev => [...prev, timerMsgDisplay]); try { await saveChatMessage(selectedConversationId, timerMsgData); } catch(e) { console.error("Failed to save timer message:", e); } setIsChatLoading(false); return; }

    // Prepare for AI Response
    const assistantMsgId = `assistant-${Date.now()}-${Math.random()}`;
    const placeholderMsg: DisplayChatMessage = { id: assistantMsgId, role: 'assistant', content: "...", createdAt: Timestamp.now() };
    setCurrentChatHistory(prev => [...prev, placeholderMsg]);
    let finalAccumulatedRawText = "";
    let lastStreamError: string | undefined = undefined; // Store last error from stream

    try {
        if (!geminiApiKey) throw new Error("Gemini API key is not configured.");

        // Construct History
        const historyLimit = 10; // Use a bit more history
        const historyForPrompt: { role: 'user' | 'model', parts: { text: string }[] }[] = historyBeforeUpdate // Use history *before* adding placeholder
            .slice(-historyLimit)
            .filter(msg => msg.content !== "...") // Exclude placeholders from history
            .map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));

        // Construct Context
        const itemsText = formatItemsForChat(); // Use useCallback version
        const userContextText = userContext ? `Work Description: ${userContext.workDescription || 'Not set'}\nShort Term Focus: ${userContext.shortTermFocus || 'Not set'}\nLong Term Goals: ${userContext.longTermGoals || 'Not set'}\nOther Context: ${userContext.otherContext || 'Not set'}` : "User context not available.";
        const now = new Date();
        const currentDateTime = { date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) };

        // REFINED System Instruction (Matches AIChat.tsx more closely for actions)
        const systemInstruction = `
You are TaskMaster, a friendly and helpful AI productivity assistant.
User's Name: ${userName || 'User'}
Current Date & Time: ${currentDateTime.date}, ${currentDateTime.time}

[User Context]
${userContextText}

[User's Current Items - Use the [ID: item_id] for actions]
${itemsText}

[Your Task]
1.  Respond conversationally to the user's message.
2.  Analyze the conversation and the user's items/context.
3.  **Action Recommendation (Optional JSON):** If the user's message clearly implies a need to create, update, or delete a *specific* item (task, goal, project, plan), AND you are confident about the details:
    *   Provide your normal text response first.
    *   **AFTER** your text, add ONE JSON object in \`\`\`json ... \`\`\` format.
    *   Use this EXACT JSON structure:
        \`\`\`json
        {
            "type": "actionRecommendation",
            "data": {
                "id": "rec-${Date.now()}", // Unique ID for the recommendation itself
                "action": "create" | "update" | "delete",
                "itemType": "tasks" | "goals" | "projects" | "plans",
                "payload": { /* Payload details below */ },
                "reasoning": "Concise reason for this specific suggestion based on the chat."
            }
        }
        \`\`\`
    *   **Payload Details:**
        *   \`create\`: \`{ "text": "Item Name", "dueDate": "YYYY-MM-DD" | null, "priority": "high"|"medium"|"low" }\` (text required)
        *   \`update\`: \`{ "itemId": "existing_item_id" | null, "itemName": "Item Name If ID Unknown" | null, "text": "New Name" | null, "completed": true|false|null, "priority": "high"|"medium"|"low"|null, "dueDate": "YYYY-MM-DD" | null }\` (MUST include \`itemId\` or \`itemName\`. Include at least one field to update. \`text\` updates the item's main name/title.)
        *   \`delete\`: \`{ "itemId": "existing_item_id" | null, "itemName": "Item Name If ID Unknown" | null }\` (MUST include \`itemId\` or \`itemName\`)
    *   **Crucially:** Use the \`itemId\` from the "[User's Current Items]" list above if you know which specific item to modify. Only use \`itemName\` for updates/deletes if the \`itemId\` is unclear from the conversation.
    *   Only include the JSON block if an action is strongly suggested and relevant. Do NOT invent actions. Ensure the JSON is valid.
4.  **Flashcards/Quizzes (Optional JSON):** If the user *explicitly* asks for flashcards or a quiz, provide the data in ONE \`\`\`json ... \`\`\` block AFTER your text response, using the structure: \`{ "type": "flashcard" | "question", "data": [...] }\`. Do not include this unless asked.
5.  **Response Format:** Conversational text response first. Then, optionally, ONE JSON block (either action or educational, not both). Be concise and helpful. Do not include instructions or metadata in your response.
`;
        // Prepare Request Body
        const requestBody = {
            contents: [
                 { role: 'user', parts: [{ text: systemInstruction }] },
                 { role: 'model', parts: [{ text: "Understood. I am TaskMaster AI, ready to assist."}] },
                 ...historyForPrompt // Append actual conversation history (including latest user message)
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
            safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ]
        };

        const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) };

        // Initiate Streaming
        await streamResponse(geminiChatEndpoint, geminiOptions, (rawChunkAccumulated) => {
            finalAccumulatedRawText = rawChunkAccumulated; // Store full raw response
            // Use REVISED extractCandidateText for streaming
            const { text: currentExtractedText, error: streamExtractionError } = extractCandidateText(rawChunkAccumulated);
            // Store the latest error encountered during streaming
            if (streamExtractionError) {
                lastStreamError = streamExtractionError;
            }

            // Update UI incrementally *only if text content changes*
            setCurrentChatHistory(prev => prev.map(msg =>
                (msg.id === assistantMsgId && msg.content !== currentExtractedText)
                ? {
                    ...msg,
                    content: currentExtractedText || (msg.content === "..." ? "..." : msg.content), // Avoid flicker if extraction is temporarily empty
                    error: streamExtractionError || false // Show error from stream if present
                  }
                : msg
             ));
        });

        // --- Final Processing after Stream Ends ---
        console.log("Stream ended. Final Raw Text for Processing:", finalAccumulatedRawText); // DEBUG
        const { text: finalExtractedAssistantText, error: finalError, finishReason } = extractCandidateText(finalAccumulatedRawText);
        console.log("Final Extracted Text:", finalExtractedAssistantText, "Final Error:", finalError, "Finish Reason:", finishReason); // DEBUG

        // Determine the final text and error state
        let textForDisplay = finalExtractedAssistantText;
        let finalErrorMessage = finalError || lastStreamError; // Prioritize final error, fallback to last stream error

        // Fallback if extraction yields nothing useful but we have some text
        if (!textForDisplay && finalAccumulatedRawText && finalAccumulatedRawText.length > 5) { // Check if raw text has *some* content
             // This case is less likely with the improved extractor, but a safety net
             console.warn("Final extraction empty, but raw text exists. Potential parse issue.");
             textForDisplay = "[Processing Error]"; // Indicate a problem
             if (!finalErrorMessage) finalErrorMessage = "Could not fully process the AI response.";
        }

        // Further fallback if still empty or placeholder
        if (!textForDisplay || textForDisplay === "...") {
            textForDisplay = "..." // Keep placeholder if truly empty
            if (finishReason && finishReason !== 'STOP' && !finalErrorMessage) {
                // If finished for other reason but no text and no specific error extracted
                finalErrorMessage = `Response ended unexpectedly (${finishReason}).`;
            } else if (!finalErrorMessage) {
                 finalErrorMessage = "No response received from AI.";
            }
        }

        let parsedJsonData: any = null;
        let jsonType: 'flashcard' | 'question' | 'actionRecommendation' | null = null;
        let recommendationData: AiActionRecommendation['data'] | undefined = undefined;

        // Process JSON block if text is valid
        if (textForDisplay && textForDisplay !== "..." && !finalErrorMessage) {
            const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
            const jsonMatch = textForDisplay.match(jsonBlockRegex);

            if (jsonMatch && jsonMatch[1]) {
                const rawJsonString = jsonMatch[1].trim();
                console.log("Attempting to parse JSON block:", rawJsonString);
                try {
                    const potentialJson = JSON.parse(rawJsonString);
                    console.log("Parsed JSON:", potentialJson);

                    if (potentialJson.type === 'actionRecommendation' && potentialJson.data?.action /* ...etc */) {
                        console.log("Detected valid Action Recommendation.");
                        jsonType = 'actionRecommendation';
                        recommendationData = potentialJson.data;
                        parsedJsonData = potentialJson;
                        textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim();
                        if (!textForDisplay && recommendationData.reasoning) { textForDisplay = recommendationData.reasoning; }
                        else if (!textForDisplay) { textForDisplay = "I have a suggestion:"; }
                    } else if ((potentialJson.type === 'flashcard' || potentialJson.type === 'question') && Array.isArray(potentialJson.data)) {
                        console.log("Detected valid Educational Content.");
                        jsonType = potentialJson.type;
                        parsedJsonData = potentialJson;
                        textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim();
                        if (!textForDisplay) { textForDisplay = `Here are the ${parsedJsonData.type}s:`; }
                    } else { console.warn("JSON block found but doesn't match expected structures."); }
                } catch (e: any) { console.error('Failed to parse JSON block:', e.message, "Content:", rawJsonString); }
            } else { console.log("No JSON block found in the response."); }
        }

        // Final check if text became empty after removing JSON
        if (!textForDisplay && recommendationData) {
             textForDisplay = recommendationData.reasoning || "Suggestion received.";
        } else if (!textForDisplay && parsedJsonData) {
             textForDisplay = `Educational content received.`;
        } else if (!textForDisplay && !finalErrorMessage) {
             // If text is empty after processing, and there wasn't an error reported earlier
             textForDisplay = "Received an empty response.";
             console.warn("Final text content is empty after processing. Raw response was:", finalAccumulatedRawText);
        }

        // Prepare final message data for Firestore
        const assistantMsgData: FirebaseChatMessage = {
            role: 'assistant',
            content: finalErrorMessage ? `⚠️ ${finalErrorMessage}` : textForDisplay, // Prepend error if exists
            createdAt: Timestamp.now(),
            error: !!finalErrorMessage, // Mark as error in Firestore if needed
            ...(jsonType === 'flashcard' && { flashcard: parsedJsonData }),
            ...(jsonType === 'question' && { question: parsedJsonData }),
        };

        // Update the placeholder message in the UI with final content and recommendation UI
        setCurrentChatHistory(prev => prev.map(msg =>
            msg.id === assistantMsgId
            ? {
                ...msg,
                content: assistantMsgData.content, // Use content prepared for Firestore
                flashcard: jsonType === 'flashcard' ? parsedJsonData : undefined,
                question: jsonType === 'question' ? parsedJsonData : undefined,
                recommendation: finalErrorMessage ? undefined : recommendationData, // Don't show recommendation if there was an error
                error: finalErrorMessage || false // Store error string or false
              }
            : msg
        ));

        // Save the final assistant message to Firestore
        try {
             console.log("Saving final assistant message to Firestore:", assistantMsgData);
             await saveChatMessage(selectedConversationId, assistantMsgData);
        } catch (error) { console.error("Failed to save final assistant message:", error); /* Optionally show another UI error */ }

        // --- Dynamic Chat Name Generation ---
        const userMessagesCount = historyBeforeUpdate.filter(m => m.role === 'user').length;
        // Generate name after 2 user messages (so on the 3rd user message submission)
        if (userMessagesCount === 2 && !hasGeneratedChatNameForCurrentConv && !finalErrorMessage) {
            console.log("Triggering dynamic chat name generation...");
            // Use history *including* the latest assistant response for better context
            const historyForNameGen = [...historyBeforeUpdate];
            // Add the successful assistant response to the history used for naming
            if (!finalErrorMessage) {
                 historyForNameGen.push({
                     id: assistantMsgId, // Use the same ID temporarily
                     role: 'assistant',
                     content: textForDisplay, // Use the final display text
                     createdAt: Timestamp.now()
                 });
            }
            await generateDynamicChatName(selectedConversationId, historyForNameGen);
        }

    } catch (err: any) {
        console.error('Chat Submit Error:', err);
        let errorMsgContent = "Sorry, I encountered an error processing your request.";
        if (err.message) {
            if (err.message.includes('API key not valid')) { errorMsgContent = "Error: AI configuration issue (invalid API key)."; }
            else if (err.message.includes('timed out')) { errorMsgContent = "Error: The request timed out. Please try again."; }
            else if (err.message.includes('API Error') || err.message.includes('API Request Failed') || err.message.includes('Streaming failed')) {
                const detailMatch = err.message.match(/API Error \(\d+\): (.*)/) || err.message.match(/API Request Failed \(\d+\):.*?(\{.*\}|.*)/s) || err.message.match(/Streaming failed: (.*)/);
                let specificError = detailMatch?.[1] ? detailMatch[1].trim() : err.message;
                 try { const errorJson = JSON.parse(specificError); specificError = errorJson.error?.message || specificError; } catch {}
                 errorMsgContent = `Error from AI service: ${specificError}.`;
            } else if (err.message.includes('SAFETY') || err.message.includes('blocked due to prompt feedback')) {
                 errorMsgContent = "Error: The response could not be generated due to safety settings or blocked prompt.";
            } else { errorMsgContent = `Sorry, an unexpected error occurred: ${err.message}`; }
        }

        // Update the placeholder message with the error
        setCurrentChatHistory(prev => {
            const updatedHistory = prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: errorMsgContent, error: errorMsgContent } : msg );
            // Save the error message to Firebase
            saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() })
                .catch(e => console.error("Failed to save error message to chat history:", e));
            return updatedHistory;
        });
    } finally { setIsChatLoading(false); }
  };

  // Handle starting a new chat conversation - Use more robust default name
  const handleNewChat = async () => {
      if (!user) return;
      setIsChatLoading(true);
      try {
         const now = new Date();
         // Use a slightly more descriptive default name initially
         const defaultChatName = `Chat ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
         console.log("Creating new chat with default name:", defaultChatName);
         const newId = await createChatConversation(user.uid, defaultChatName, false); // Start with nameGenerated = false
         console.log("New chat created with ID:", newId);
         setSelectedConversationId(newId);
         setCurrentChatHistory([]);
         setHasGeneratedChatNameForCurrentConv(false); // Reset flag for new chat
         setAiSidebarTab('chat');
         setIsAiSidebarOpen(true); // Ensure sidebar is open
      } catch (error) {
          console.error("Error creating new chat:", error);
          alert("Failed to start new chat.");
      } finally {
          setIsChatLoading(false);
      }
  };

  // Handle Generating AI Insights - IMPROVED Prompt and Error Handling
  const generateAiInsights = async () => {
    if (!user || aiGeneratedInsights.isLoading || !geminiApiKey) {
      console.warn("Insight generation skipped:", { user: !!user, loading: aiGeneratedInsights.isLoading, key: !!geminiApiKey });
      return;
    }
    if (userTier === 'basic' || userTier === 'loading') {
         setAiGeneratedInsights(prev => ({ ...prev, isLoading: false, error: "Insights generation requires Pro/Premium tier.", lastGeneratedSig: null }));
         return;
    }

    setAiGeneratedInsights(prev => ({ ...prev, isLoading: true, error: null, lastGeneratedSig: prev.lastGeneratedSig }));
    const allItems = [...tasks, ...goals, ...projects, ...plans];
    const itemsSignature = createItemsSignatureForOverview([allItems]);
    const itemsText = formatItemsForChat();
    const userContextText = userContext ? `Work: ${userContext.workDescription || 'N/A'}\nFocus: ${userContext.shortTermFocus || 'N/A'}\nGoals: ${userContext.longTermGoals || 'N/A'}\nOther: ${userContext.otherContext || 'N/A'}` : "User context not available.";

    // IMPROVED Prompt: More guidance on scoring
    const prompt = `
Analyze the following user data for ${userName || 'User'} and provide productivity insights. Focus on actionable, concise info. Be realistic.
[USER CONTEXT]
${userContextText}
[USER ITEMS]
${itemsText}
[INSTRUCTIONS]
Generate a JSON object ONLY with the following structure:
{
  "productivityScore": number (0-100, estimate based on task completion vs. total items, urgency of pending items, and alignment with goals/context. Penalize heavily for overdue items. Consider recent completions positive.),
  "timeManagementAnalysis": string (Brief analysis based on due dates, overdue items, and workload distribution. Mention specific bottlenecks or successes if clear.),
  "potentialConflicts": string (Identify potential scheduling conflicts, resource overlaps, or contradictory goals based *only* on the provided items and context. If none, state "No obvious conflicts detected."),
  "additionalInsights": string (One other relevant observation, suggestion, or encouragement based on the data. Keep it concise.)
}
Return ONLY the JSON object. No other text. Ensure the JSON is valid. If there are no items, provide default values (e.g., score 0, analysis "No items to analyze").`;

    try {
      // Use the NON-STREAMING endpoint for insights as we expect JSON
      // Consider using gemini-1.5-pro for potentially better insights if flash isn't sufficient
      const insightEndpoint = geminiProEndpoint; // Using Pro for better analysis
      const geminiOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600,
            responseMimeType: "application/json" // Request JSON directly
          },
          safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ]
        })
      };
      console.log("Generating AI Insights with payload:", JSON.stringify(geminiOptions.body)); // Log the actual prompt
      const response = await fetchWithTimeout(insightEndpoint, geminiOptions, 35000);
      console.log("Insights API Response Status:", response.status);

      if (!response.ok) {
        let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {}
        console.error("Insights API Error Body:", errorBody);
        throw new Error(`Insights API error (${response.status}): ${errorBody}`);
      }
      const resultJson = await response.json();
      console.log("Insights API Raw Response JSON:", resultJson); // Log the raw response

      let insightsData;
      if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) {
        const rawJsonText = resultJson.candidates[0].content.parts[0].text;
        console.log("Insights Raw JSON Text from AI:", rawJsonText); // Log the JSON text
        try {
          insightsData = JSON.parse(rawJsonText);
          console.log("Parsed Insights Data:", insightsData); // Log parsed data
        } catch (parseError: any) {
          console.error("Failed to parse insights JSON from text:", parseError, "Raw Text:", rawJsonText);
          if (resultJson.candidates[0]?.finishReason === 'SAFETY') throw new Error("Insights generation blocked due to safety settings.");
          if (resultJson.promptFeedback?.blockReason) throw new Error(`Insights generation blocked: ${resultJson.promptFeedback.blockReason}`);
          throw new Error(`AI returned invalid insight JSON format: ${parseError.message}`);
        }
      } else {
        const finishReason = resultJson.candidates?.[0]?.finishReason;
        const blockReason = resultJson.promptFeedback?.blockReason;
        if (finishReason === 'SAFETY' || blockReason) { throw new Error(`Insights generation blocked due to ${finishReason || blockReason || 'safety settings'}.`); }
        console.error("Unexpected insights response structure:", resultJson);
        throw new Error("Received unexpected insight data structure from AI.");
      }

      // Validate the structure of the parsed data
      if (typeof insightsData.productivityScore !== 'number' ||
          typeof insightsData.timeManagementAnalysis !== 'string' ||
          typeof insightsData.potentialConflicts !== 'string' ||
          typeof insightsData.additionalInsights !== 'string') {
          console.error("Parsed insights data has incorrect structure:", insightsData);
          throw new Error("AI returned insight data with missing or invalid fields.");
      }

      setAiGeneratedInsights({
        score: insightsData.productivityScore,
        timeManagement: insightsData.timeManagementAnalysis,
        conflicts: insightsData.potentialConflicts,
        other: insightsData.additionalInsights,
        isLoading: false,
        error: null,
        lastGeneratedSig: itemsSignature
      });

    } catch (error: any) {
      console.error("Error generating AI insights:", error);
      let errorMsg = `Failed to generate insights: ${error.message || 'Unknown error'}`;
       if (error.message.includes('API key not valid')) errorMsg = "Invalid AI config for insights.";
       else if (error.message.includes('timed out')) errorMsg = "Insights request timed out.";
       else if (error.message.includes("API error") || error.message.includes("generation failed")) {
             const detailMatch = error.message.match(/(?:API error \(\d+\):|Insights generation failed:)\s*(.*)/is); // More robust regex
             errorMsg = `Insights generation failed: ${detailMatch?.[1] ? detailMatch[1].trim() : 'API issue'}`;
       }

      setAiGeneratedInsights(prev => ({
        score: undefined, timeManagement: undefined, conflicts: undefined, other: undefined,
        isLoading: false,
        error: errorMsg,
        // lastGeneratedSig: null // Keep last sig? Maybe clear it to allow retry always. Let's clear.
      }));
    }
  };

  // Handle timer complete callback - Unchanged
  const handleTimerComplete = (timerId: string) => { const completionMsgContent = `⏰ Timer finished!`; const completionMsg: DisplayChatMessage = { id: `timer-complete-${timerId}-${Date.now()}`, role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() }; setCurrentChatHistory(prev => [...prev, completionMsg]); if (selectedConversationId) { saveChatMessage(selectedConversationId, { role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() }) .catch(e => console.error("Failed to save timer completion message:", e)); } };

  // ---------------------
  // MEMOS & DERIVED STATE
  // ---------------------
  // Simplified currentItems - Unchanged
  const currentItems: Array<{ id: string; data: any }> = useMemo(() => {
    if (!activeCollectionName) return [];
    const allItemsOfType = activeCollectionName === 'tasks' ? tasks : activeCollectionName === 'goals' ? goals : activeCollectionName === 'projects' ? projects : activeCollectionName === 'plans' ? plans : [];
    return allItemsOfType;
  }, [activeTabId, activeCollectionName, tasks, goals, projects, plans]);

  // Current Chat Limit Memo - Unchanged
  const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

  // ---------------------
  // THEME & STYLE VARIABLES - Unchanged
  // ---------------------
  const headlineColor = isIlluminateEnabled ? "text-green-700" : "text-green-400"; const illuminateHighlightToday = isIlluminateEnabled ? "bg-blue-100 text-blue-700 font-semibold" : "bg-blue-500/30 text-blue-200 font-semibold"; const illuminateHighlightDeadline = isIlluminateEnabled ? "bg-red-100 hover:bg-red-200" : "bg-red-500/20 hover:bg-red-500/30"; const illuminateHoverGray = isIlluminateEnabled ? "hover:bg-gray-200/60" : "hover:bg-gray-700/50"; const illuminateTextBlue = isIlluminateEnabled ? "text-blue-700" : "text-blue-400"; const illuminateTextPurple = isIlluminateEnabled ? "text-purple-700" : "text-purple-400"; const illuminateTextGreen = isIlluminateEnabled ? "text-green-700" : "text-green-400"; const illuminateTextPink = isIlluminateEnabled ? "text-pink-700" : "text-pink-400"; const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-700" : "text-yellow-400"; const illuminateBorder = isIlluminateEnabled ? "border-gray-300" : "border-gray-600/80"; const illuminateIconColor = isIlluminateEnabled ? "text-gray-500" : "text-gray-400"; const illuminateBgHover = isIlluminateEnabled ? "hover:bg-gray-100" : "hover:bg-gray-700"; const containerClass = isIlluminateEnabled ? "bg-gray-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200"; const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/70 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/50 shadow-lg shadow-black/20"; const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100"; const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400"; const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/50 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 hover:bg-gray-600/50 border-gray-600 focus:border-blue-500 focus:ring-blue-500"; const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";

  // --- FIX: Function to get a display name for chat conversation ---
  const getChatDisplayName = (conv: { id: string; data: { chatName?: string; createdAt?: Timestamp } }): string => {
      // Prioritize chatName if it exists and isn't empty/whitespace
      if (conv.data?.chatName && conv.data.chatName.trim() !== "") {
          return conv.data.chatName.trim(); // Return trimmed name
      }
      // Fallback to formatted date
      if (conv.data?.createdAt?.seconds) {
          const date = new Date(conv.data.createdAt.seconds * 1000);
          return `Chat ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      }
      // Ultimate fallback using ID prefix
      return `Chat ${conv.id.substring(0, 6)}`;
  };

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
                    <div className="col-span-7 grid grid-cols-7 gap-px sm:gap-0.5"> {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map( (day, index) => ( <div key={index} className={`text-center text-[9px] font-medium ${subheadingClass} pt-0.5`}> {day} </div> ))} </div>
                    {currentWeek.map((date) => { const dateStr = formatDateForComparison(date); const allItems = [...tasks, ...goals, ...projects, ...plans]; const hasDeadline = allItems.some((item) => { if (!item?.data?.dueDate) return false; try { const itemDate = item.data.dueDate.toDate ? item.data.dueDate.toDate() : new Date(item.data.dueDate); return !isNaN(itemDate.getTime()) && formatDateForComparison(itemDate) === dateStr; } catch { return false; } }); const isToday = dateStr === formatDateForComparison(new Date()); const todayClass = illuminateHighlightToday; const deadlineClass = illuminateHighlightDeadline; const defaultHover = illuminateHoverGray; return ( <div key={dateStr} className={`relative w-full h-5 text-center rounded transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] ${ isToday ? todayClass : `${subheadingClass} ${defaultHover}` } ${hasDeadline && !isToday ? `${deadlineClass} font-medium` : ''} `} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} > <span>{date.getDate()}</span> {hasDeadline && !isToday && ( <div className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${isIlluminateEnabled ? 'bg-red-500' : 'bg-red-400'}`}></div> )} </div> ); })}
                 </div>
              </div>
              <button onClick={() => { const nextWeek = new Date(currentWeek[0]); nextWeek.setDate(nextWeek.getDate() + 7); setCurrentWeek(getWeekDates(nextWeek)); }} className={`w-5 sm:w-6 h-full flex items-center justify-center ${iconColor} ${illuminateHoverGray} rounded-lg transition-colors`} title="Next Week" > <ChevronRight className="w-4 h-4" /> </button>
            </div>
          </div>
        </div>

        {/* AI Smart Overview */}
        <div className={`${cardClass} rounded-xl p-3 sm:p-4 relative min-h-[80px] transition-all duration-300 ease-out animate-fadeIn mb-4 sm:mb-5 ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-300`} >
             <div className="flex flex-wrap items-center gap-2 mb-1.5">
                 <h2 className={`text-base sm:text-lg font-semibold mr-1 flex items-center ${illuminateTextBlue}`}> <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 text-yellow-400 animate-pulse" /> Smart Overview </h2>
                 {userTier === 'pro' && ( <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-teal-400 to-cyan-500 text-white px-1.5 py-0.5 rounded-full font-medium"> PRO </span> )}
                 {userTier === 'premium' && ( <span className="text-[9px] sm:text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium"> PREMIUM </span> )}
             </div>
             {userTier === 'loading' ? ( <div className="animate-pulse space-y-1.5 pt-1"> <div className={`h-3 rounded-full w-1/2 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> </div>
             ) : userTier === 'basic' ? ( <div className={`text-xs italic flex items-center justify-start gap-1.5 py-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}> <span>Smart Overview is a Pro/Premium feature.</span> <Link to="/pricing" className={`font-medium ml-1 ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline not-italic`} > Upgrade now </Link> </div>
             ) : overviewLoading ? ( <div className="space-y-1.5 animate-pulse pt-1"> <div className={`h-3 rounded-full w-11/12 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> <div className={`h-3 rounded-full w-3/4 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> </div>
             ) : ( <> <div className={`text-xs sm:text-sm prose-sm max-w-none animate-fadeIn ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} leading-snug ${smartOverview.includes('unavailable') || smartOverview.includes('failed') || smartOverview.includes('limit') || smartOverview.toLowerCase().includes('error:') || smartOverview.toLowerCase().includes('blocked:') ? (isIlluminateEnabled ? 'text-yellow-700 italic' : 'text-yellow-500 italic') : ''}`} > {smartOverview || "Add items or check back later for an overview."} </div> {smartOverview && !smartOverview.includes('unavailable') && !smartOverview.includes('failed') && !smartOverview.includes('limit') && !smartOverview.includes('No pending items') && !smartOverview.toLowerCase().startsWith('error:') && !smartOverview.toLowerCase().includes('blocked:') && smartOverview !== "Add items or check back later for an overview." && ( <div className="mt-1.5 text-left text-[10px] text-gray-500/80"> AI responses may be inaccurate. Verify critical info. </div> )} </>
             )}
        </div>

        {/* Main Content Grid (Left/Right Columns) */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-400`}>

           {/* LEFT COLUMN */}
           <div className="flex flex-col gap-4 sm:gap-5">
             {/* Productivity/Analytics Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}> <div className="flex justify-between items-center mb-3"> <h2 className={`text-base sm:text-lg font-semibold ${illuminateTextPurple} flex items-center`}> <TrendingUp className="w-5 h-5 mr-1.5" /> Productivity </h2> <button onClick={() => setShowAnalytics(prev => !prev)} className={`p-1 rounded-full transition-colors ${iconColor} ${ isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-700' } flex items-center gap-1 text-[10px] sm:text-xs`} title={showAnalytics ? "Show Basic Progress" : "Show Analytics"} > {showAnalytics ? <PieChart className="w-3.5 h-3.5" /> : <BarChart className="w-3.5 h-3.5" /> } <span>{showAnalytics ? 'Analytics' : 'Progress'}</span> </button> </div> {showAnalytics ? ( <div className="animate-fadeIn min-h-[150px]"> <EnhancedTaskAnalytics tasks={tasks} goals={goals} projects={projects} plans={plans} sections={[]} isIlluminateEnabled={isIlluminateEnabled} /> </div> ) : ( <div className="space-y-3 animate-fadeIn"> {(tasks.length > 0 || goals.length > 0 || projects.length > 0 || plans.length > 0) ? ( <> {tasks.length > 0 && ( <div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"> <p className="flex items-center font-medium"> <Clipboard className="w-3.5 h-3.5 mr-1 text-gray-400" /> Tasks </p> <p className={`${illuminateTextGreen} font-semibold text-xs`}> {tasks.filter(t => t.data.completed).length}/{tasks.length} ({tasksProgress}%) </p> </div> <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${tasksProgress}%` }} /> </div> </div> )} {goals.length > 0 && ( <div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"> <p className="flex items-center font-medium"> <Target className="w-3.5 h-3.5 mr-1 text-gray-400" /> Goals </p> <p className={`${illuminateTextPink} font-semibold text-xs`}> {goals.filter(g => g.data.completed).length}/{goals.length} ({goalsProgress}%) </p> </div> <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${goalsProgress}%` }} /> </div> </div> )}
                             {projects.length > 0 && ( <div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"> <p className="flex items-center font-medium"> <Layers className="w-3.5 h-3.5 mr-1 text-gray-400" /> Projects </p> <p className={`${illuminateTextBlue} font-semibold text-xs`}> {projects.filter(p => p.data.completed).length}/{projects.length} ({projectsProgress}%) </p> </div> <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${projectsProgress}%` }} /> </div> </div> )}
                             {plans.length > 0 && ( <div> <div className="flex justify-between items-center mb-0.5 text-xs sm:text-sm"> <p className="flex items-center font-medium"> <Rocket className="w-3.5 h-3.5 mr-1 text-gray-400" /> Plans </p> <p className={`${illuminateTextYellow} font-semibold text-xs`}> {plans.filter(p => p.data.completed).length}/{plans.length} ({plansProgress}%) </p> </div> <div className={`w-full h-1.5 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'} rounded-full overflow-hidden`}> <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${plansProgress}%` }} /> </div> </div> )} </> ) : ( <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}> <Lightbulb className="w-4 h-4 mr-1.5 text-yellow-400" /> Add items to track your progress. </p> )} </div> )} </div>

             {/* Upcoming Deadlines Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}> <h2 className={`text-base sm:text-lg font-semibold mb-3 ${illuminateTextBlue} flex items-center`}> <Calendar className="w-5 h-5 mr-1.5" /> Upcoming </h2> {(() => { const allItems = [...tasks, ...goals, ...projects, ...plans]; const now = new Date(); now.setHours(0, 0, 0, 0); const upcomingDeadlines = allItems .filter(item => { const { dueDate, completed } = item.data; if (!dueDate || completed) return false; try { const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate); if (isNaN(dueDateObj.getTime())) return false; // Ensure valid date
                   dueDateObj.setHours(0, 0, 0, 0); return dueDateObj >= now; } catch { return false; } }) .sort((a, b) => { try { const aDate = a.data.dueDate.toDate ? a.data.dueDate.toDate() : new Date(a.data.dueDate); const bDate = b.data.dueDate.toDate ? b.data.dueDate.toDate() : new Date(b.data.dueDate); return aDate.getTime() - bDate.getTime(); } catch { return 0; } }) .slice(0, 5); if (!upcomingDeadlines.length) { return ( <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}> <CheckCircle className="w-4 h-4 mr-1.5 text-green-400" /> All caught up! No upcoming deadlines. </p> ); } return ( <ul className="space-y-2"> {upcomingDeadlines.map((item, index) => { const { id, data } = item; const itemType = getTitleField(data); const dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); const dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const itemName = data[itemType.toLowerCase()] || 'Untitled'; const normalizedDueDate = new Date(dueDateObj); normalizedDueDate.setHours(0,0,0,0); const daysRemaining = Math.ceil((normalizedDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); let urgencyColor = isIlluminateEnabled ? 'border-l-gray-300' : 'border-l-gray-600'; let urgencyText = ''; let urgencyClass = ''; if (daysRemaining <= 0) { urgencyColor = 'border-l-red-500'; urgencyText = 'Today!'; urgencyClass = isIlluminateEnabled ? 'text-red-600' : 'text-red-400'; } else if (daysRemaining <= 1) { urgencyColor = 'border-l-orange-500'; urgencyText = 'Tomorrow'; urgencyClass = isIlluminateEnabled ? 'text-orange-600' : 'text-orange-400'; } else if (daysRemaining <= 3) { urgencyColor = 'border-l-yellow-500'; urgencyText = `${daysRemaining} days`; urgencyClass = isIlluminateEnabled ? 'text-yellow-700' : 'text-yellow-500'; } else { urgencyColor = 'border-l-green-500'; urgencyText = `${daysRemaining} days`; urgencyClass = isIlluminateEnabled ? 'text-green-600' : 'text-green-400'; } const priority = calculatePriority(item); return ( <li key={id} className={`${isIlluminateEnabled ? 'bg-gray-100/80 hover:bg-gray-200/60' : 'bg-gray-700/40 hover:bg-gray-700/60'} p-2.5 rounded-lg transition-colors duration-150 border-l-4 ${urgencyColor} animate-slideInRight flex items-center justify-between gap-2`} style={{ animationDelay: `${index * 60}ms` }} > <div className="flex-grow overflow-hidden mr-2"> <div className="text-xs sm:text-sm font-medium flex items-center"> <span className={`font-semibold mr-1 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{itemType.charAt(0).toUpperCase() + itemType.slice(1)}:</span> <span className="truncate" title={itemName}>{itemName}</span> <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="ml-1.5 flex-shrink-0" /> </div> </div> <div className={`text-[10px] sm:text-xs flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'} flex items-center whitespace-nowrap`}> <Clock className={`w-3 h-3 mr-0.5 ${urgencyClass}`} /> <span className={`font-medium mr-1.5 ${urgencyClass}`}>{dueDateStr}</span> {urgencyText && ( <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${ daysRemaining <= 0 ? (isIlluminateEnabled ? 'bg-red-100 text-red-600' : 'bg-red-900/50 text-red-400') : daysRemaining <= 1 ? (isIlluminateEnabled ? 'bg-orange-100 text-orange-600' : 'bg-orange-900/50 text-orange-400') : daysRemaining <= 3 ? (isIlluminateEnabled ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/50 text-yellow-400') : (isIlluminateEnabled ? 'bg-green-100 text-green-600' : 'bg-green-900/50 text-green-400') }`}> {urgencyText} </span> )} </div> </li> ); })} </ul> ); })()} </div>

             {/* Main Task/Goal/Project/Plan List Card */}
             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
                {/* Tab Navigation */}
                <div className={`border-b pb-2 mb-4 ${illuminateBorder}`}>
                   <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                     {availableTabs.map((tab) => ( <div key={tab.id} className="flex-shrink-0"> <button className={`px-3 py-1.5 rounded-full transition-all duration-200 transform hover:scale-[1.03] text-xs sm:text-sm font-medium flex items-center whitespace-nowrap ${ activeTabId === tab.id ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm" : isIlluminateEnabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-gray-700 text-gray-300 hover:bg-gray-600" }`} onClick={() => handleTabChange(tab.id)} > <tab.icon className="w-3.5 h-3.5 mr-1" /> {tab.name} </button> </div> ))}
                   </div>
                </div>

                {/* Item Creation Input Row */}
                <div className="flex flex-col md:flex-row gap-1.5 mb-4"> <input type="text" className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3.5 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500`} placeholder={`Add a new ${activeTabDefinition?.name.slice(0,-1) || 'item'}...`} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /> <div className="flex gap-1.5 flex-shrink-0"> <input type="date" className={`${inputBg} border ${illuminateBorder} rounded-full px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${newItemDate ? (isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300') : iconColor }`} value={newItemDate} onChange={(e) => setNewItemDate(e.target.value)} title="Set due date" style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} /> <div className="relative"> <select className={`${inputBg} border ${illuminateBorder} rounded-full pl-3 pr-7 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value as 'high' | 'medium' | 'low')} title="Set priority" > <option value="high">High 🔥</option> <option value="medium">Medium</option> <option value="low">Low 🧊</option> </select> <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} /> </div> <button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-full flex items-center justify-center hover:shadow-md hover:shadow-purple-500/20 transition-all duration-200 transform hover:scale-105 active:scale-100 min-w-[32px] min-h-[32px]" onClick={handleCreate} title={`Add new ${activeTabDefinition?.name.slice(0,-1) || 'item'}`} > <PlusCircle className="w-4 h-4" /> </button> </div> </div>

                {/* Item List */}
                <ul className="space-y-1.5 sm:space-y-2 min-h-[100px]"> {currentItems.length === 0 ? ( <li className={`${subheadingClass} text-sm text-center py-6 italic`}> No {activeTabDefinition?.name || 'items'} here yet... Add one above! </li> ) : ( currentItems .sort((a, b) => { const completedDiff = (a.data.completed ? 1 : 0) - (b.data.completed ? 1 : 0); if (completedDiff !== 0) return completedDiff; const priorityMap = { high: 0, medium: 1, low: 2 }; const priorityA = priorityMap[calculatePriority(a)]; const priorityB = priorityMap[calculatePriority(b)]; if (priorityA !== priorityB) return priorityA - priorityB; return (a.data.createdAt?.seconds || 0) - (b.data.createdAt?.seconds || 0); }) .map((item, index) => { const itemId = item.id; const { data } = item; const titleField = getTitleField(data); const textValue = data[titleField] || data.text || 'Untitled';
                            const isCompleted = data.completed || false; const isEditing = editingItemId === itemId; const priority = calculatePriority(item); let dueDateStr = ''; let overdue = false; let dueDateObj: Date | null = null; if (data.dueDate) { try { dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); if (!isNaN(dueDateObj.getTime())) { dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const itemDate = new Date(dueDateObj); itemDate.setHours(0,0,0,0); overdue = itemDate < today && !isCompleted; } else { dueDateStr = ''; } } catch { dueDateStr = ''; } } return ( <li key={item.id} className={`group p-2 sm:p-2.5 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 transition-all duration-150 animate-slideInUp ${ isCompleted ? isIlluminateEnabled ? 'bg-green-100/50 opacity-60' : 'bg-green-900/20 opacity-50' : overdue ? isIlluminateEnabled ? 'bg-red-100/60' : 'bg-red-900/30' : isIlluminateEnabled ? 'bg-gray-100/70 hover:bg-gray-200/50' : 'bg-gray-700/30 hover:bg-gray-700/50' } ${isEditing ? (isIlluminateEnabled ? 'ring-1 ring-purple-400 bg-purple-50/50' : 'ring-1 ring-purple-500 bg-purple-900/20') : ''} `} style={{ animationDelay: `${index * 50}ms` }} > {!isEditing ? ( <> <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2"> <button onClick={() => handleMarkComplete(itemId)} className={`flex-shrink-0 p-0.5 rounded-full transition-colors duration-150 border ${ isCompleted ? (isIlluminateEnabled ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600') : (isIlluminateEnabled ? 'border-gray-400 hover:border-green-500 hover:bg-green-100/50' : 'border-gray-500 hover:border-green-500 hover:bg-green-900/30') }`} title={isCompleted ? "Mark Pending" : "Mark Complete"}> <CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-white' : 'text-transparent'}`} /> </button> <span className={`font-medium text-sm sm:text-[0.9rem] truncate ${ isCompleted ? 'line-through text-gray-500 dark:text-gray-600' : (isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100') }`} title={textValue} > {textValue} </span> <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="flex-shrink-0 ml-auto sm:ml-1.5" /> {dueDateStr && ( <span className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 hidden sm:flex items-center ${ overdue ? (isIlluminateEnabled ? 'bg-red-200 text-red-700' : 'bg-red-800/50 text-red-300') : (isIlluminateEnabled ? 'bg-gray-200 text-gray-600' : 'bg-gray-600/80 text-gray-300') }`} > <Calendar className="w-2.5 h-2.5 mr-0.5" /> {dueDateStr} </span> )} </div> <div className="flex gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150"> <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'} transition-colors`} onClick={() => handleEditClick(itemId, data)} title="Edit" > <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> </button> <button className={`p-1.5 rounded ${isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'} transition-colors`} onClick={() => handleDelete(itemId)} title="Delete" > <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> </button> </div> </> ) : ( <> <div className="flex flex-col sm:flex-row gap-1.5 w-full"> <input className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(itemId); if (e.key === 'Escape') setEditingItemId(null); }} /> <div className="flex gap-1.5 flex-shrink-0"> <input type="date" className={`${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${editingDate ? (isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300') : iconColor}`} value={editingDate} onChange={(e) => setEditingDate(e.target.value)} style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} /> <div className="relative"> <select className={`${inputBg} border ${illuminateBorder} rounded-full pl-3 pr-7 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={editingPriority} onChange={(e) => setEditingPriority(e.target.value as 'high' | 'medium' | 'low')} > <option value="high">High 🔥</option> <option value="medium">Medium</option> <option value="low">Low 🧊</option> </select> <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} /> </div> </div> </div> <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center"> <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditSave(itemId)} > Save </button> <button className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm" onClick={() => setEditingItemId(null)} > Cancel </button> </div> </> )} </li> ); }) )} </ul> </div>
           </div> {/* End Left Column */}

           {/* RIGHT COLUMN */}
           <div className="flex flex-col gap-4 sm:gap-5">
              {/* Weather Card */}
              <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}> <h2 className={`text-base sm:text-lg font-semibold mb-2 ${headingClass} flex items-center`}> <Sun className={`w-4 h-4 mr-1.5 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} /> Weather {weatherData?.location?.name && !weatherLoading && <span className="text-sm font-normal ml-1.5 text-gray-500 truncate hidden sm:inline"> / {weatherData.location.name}</span>} </h2> {weatherLoading ? ( <div className="animate-pulse space-y-2 py-4"> <div className={`h-5 rounded w-1/2 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> <div className={`h-4 rounded w-3/4 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> <div className={`h-3 rounded w-1/3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> </div> ) : weatherError ? ( <p className="text-center text-xs text-red-500 py-4">{weatherError}</p> ) : weatherData ? ( <> <div className={`flex items-center gap-2 sm:gap-3 mb-3 border-b ${illuminateBorder} pb-3`}> <img src={weatherData.current.condition.icon ? `https:${weatherData.current.condition.icon}` : "/placeholder.svg"} alt={weatherData.current.condition.text} className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" loading="lazy" /> <div className="flex-grow"> <p className={`text-lg sm:text-xl font-bold ${headingClass} leading-tight`}> {Math.round(weatherData.current.temp_f)}°F <span className={`ml-1 text-xs sm:text-sm font-normal ${subheadingClass}`}> ({weatherData.current.condition.text}) </span> </p> <p className={`text-xs ${subheadingClass}`}> Feels like {Math.round(weatherData.current.feelslike_f)}°F </p> </div> <div className="flex flex-col items-end text-[10px] sm:text-xs gap-0.5 flex-shrink-0"> <div className="flex items-center" title={`Wind: ${weatherData.current.wind_dir} ${Math.round(weatherData.current.wind_mph)} mph`}> <Wind className="w-3 h-3 mr-0.5 text-blue-400" /> {Math.round(weatherData.current.wind_mph)} mph </div> <div className="flex items-center" title={`Humidity: ${weatherData.current.humidity}%`}> <Droplets className="w-3 h-3 mr-0.5 text-cyan-400" /> {weatherData.current.humidity}% </div> <div className="flex items-center" title={`UV Index: ${weatherData.current.uv}`}> <Zap className="w-3 h-3 mr-0.5 text-yellow-400" /> UV: {weatherData.current.uv} </div> </div> </div> {weatherData.forecast?.forecastday?.length > 0 && ( <div className="space-y-1.5"> {(() => { const now = new Date(); now.setHours(0, 0, 0, 0); const validDays = weatherData.forecast.forecastday.filter((day: any) => { try { const d = new Date(day.date_epoch * 1000); d.setHours(0, 0, 0, 0); return d >= now; } catch { return false; } }); return validDays.slice(0, 3).map((day: any, idx: number) => { const dateObj = new Date(day.date_epoch * 1000); const dayLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short' }); const maxF = Math.round(day.day.maxtemp_f); const minF = Math.round(day.day.mintemp_f); const icon = day.day.condition.icon ? `https:${day.day.condition.icon}` : "/placeholder.svg"; const forecastBg = isIlluminateEnabled ? 'bg-gray-100/70' : 'bg-gray-700/30'; return ( <div key={day.date_epoch} className={`flex items-center gap-2 ${forecastBg} p-1 rounded-md animate-slideInRight`} style={{ animationDelay: `${idx * 80}ms` }} > <img src={icon} alt={day.day.condition.text} className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" loading="lazy"/> <span className={`text-[10px] sm:text-xs font-medium w-7 sm:w-8 flex-shrink-0 text-center ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'}`}>{dayLabel}</span> <div className={`flex-grow h-1 rounded-full ${isIlluminateEnabled ? 'bg-gray-200': 'bg-gray-600'} overflow-hidden mx-1`}> <div className="h-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" style={{width: `${Math.max(0,Math.min(100, (maxF / 100) * 100))}%`}}></div> </div> <span className={`text-[10px] sm:text-xs w-12 text-right flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'}`}> <span className="font-semibold">{maxF}°</span> / {minF}° </span> </div> ); }); })()} </div> )} </> ) : ( <p className="text-center text-xs text-gray-500 py-4">Weather data unavailable.</p> )} </div>
              {/* Pomodoro Timer Card */}
              <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}> <div className="flex items-center justify-between mb-2"> <h2 className={`text-base sm:text-lg font-semibold ${headingClass} flex items-center`}> <Clock className="w-4 h-4 mr-1.5" /> Pomodoro </h2> <button className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-2 py-1 rounded-full font-semibold flex items-center gap-1 hover:shadow-md hover:shadow-purple-500/10 transition-all duration-150 transform hover:scale-105 active:scale-100 text-[10px] sm:text-xs" onClick={() => setIsAddTimerModalOpen(true)} title="Add a new custom timer" > <PlusCircle className="w-3 h-3" /> New Timer </button> </div> <div className={`text-4xl sm:text-5xl font-bold mb-3 text-center tabular-nums tracking-tight bg-clip-text text-transparent ${ isIlluminateEnabled ? 'bg-gradient-to-r from-blue-600 to-purple-700' : 'bg-gradient-to-r from-blue-400 to-purple-500' } ${pomodoroRunning ? 'animate-pulse' : ''}`} > {formatPomodoroTime(pomodoroTimeLeft)} </div> <div className="flex justify-center gap-2"> <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning || pomodoroFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-md hover:shadow-green-500/10'}`} onClick={handlePomodoroStart} disabled={pomodoroRunning || pomodoroFinished} title="Start Timer" > Start </button> <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${!pomodoroRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:shadow-md hover:shadow-yellow-500/10'}`} onClick={handlePomodoroPause} disabled={!pomodoroRunning} title="Pause Timer" > Pause </button> <button className={`px-3 py-1.5 rounded-full font-medium text-white transition-all duration-150 transform hover:scale-105 active:scale-100 text-xs sm:text-sm ${pomodoroRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-md hover:shadow-red-500/10'}`} onClick={handlePomodoroReset} disabled={pomodoroRunning} title="Reset Timer" > Reset </button> </div> {pomodoroFinished && ( <p className="text-center text-xs text-red-500 mt-2 animate-bounce font-medium">Time's up!</p> )} </div>
              {/* Custom Timers List Card */}
              {customTimers.length > 0 && ( <div className={`${cardClass} rounded-xl p-3 sm:p-4 transition-all duration-300`}> <h2 className={`text-base sm:text-lg font-semibold mb-3 ${headingClass} flex items-center`}> <TimerIcon className="w-4 h-4 mr-1.5" /> Timers </h2> <ul className="space-y-2"> {customTimers .sort((a, b) => (a.data.createdAt?.seconds || 0) - (b.data.createdAt?.seconds || 0)) .map((timer, index) => { const timerId = timer.id; const runningState = runningTimers[timerId]; const timeLeft = runningState ? runningState.timeLeft : timer.data.time; const isRunning = runningState ? runningState.isRunning : false; const isFinished = runningState ? (runningState.finished ?? timeLeft <= 0) : timer.data.time <= 0; const isEditing = editingTimerId === timerId; let itemBgClass = isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-700/40'; if (isFinished && !isEditing) itemBgClass = isIlluminateEnabled ? 'bg-yellow-100/70 opacity-80' : 'bg-yellow-900/30 opacity-70'; if (isEditing) itemBgClass = isIlluminateEnabled ? 'bg-purple-100/50 ring-1 ring-purple-400' : 'bg-purple-900/20 ring-1 ring-purple-500'; return ( <li key={timerId} className={`p-2 sm:p-2.5 rounded-lg transition-all duration-150 animate-slideInUp ${itemBgClass}`} style={{ animationDelay: `${index * 60}ms` }} > <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3"> {isEditing ? ( <> <div className="flex flex-col sm:flex-row gap-1.5 w-full"> <input type="text" className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingTimerName} onChange={(e) => setEditingTimerName(e.target.value)} placeholder="Timer name" autoFocus /> <input type="number" className={`w-20 ${inputBg} border ${illuminateBorder} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-textfield [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} value={editingTimerMinutes} onChange={(e) => setEditingTimerMinutes(e.target.value)} placeholder="Min" min="1" onKeyDown={(e) => e.key === 'Enter' && handleEditTimerSave(timerId)} /> </div> <div className="flex gap-1 flex-shrink-0 mt-1 sm:mt-0 self-end sm:self-center"> <button className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm font-medium" onClick={() => handleEditTimerSave(timerId)} > Save </button> <button className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-full text-white transition-colors text-xs sm:text-sm" onClick={() => setEditingTimerId(null)} > Cancel </button> </div> </> ) : ( <> <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2"> <span className="font-medium text-sm sm:text-[0.9rem] truncate" title={timer.data.name}> {timer.data.name} </span> <span className={`text-xl sm:text-2xl font-semibold tabular-nums tracking-tight ${ isIlluminateEnabled ? 'text-purple-700' : 'text-purple-400' } ${isRunning ? 'animate-pulse' : ''}`} > {formatCustomTime(timeLeft)} </span> </div> <div className="flex gap-1 sm:gap-1.5 flex-shrink-0"> <button className={`p-1.5 rounded-full text-white transition-colors ${isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : isFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`} onClick={() => isRunning ? pauseCustomTimer(timerId) : startCustomTimer(timerId)} title={isRunning ? "Pause" : isFinished ? "Finished" : "Start"} disabled={isFinished && !isRunning} > {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className={`w-3.5 h-3.5 ${isFinished ? 'opacity-50' : ''}`} />} </button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'bg-gray-400/50 text-gray-600/50 cursor-not-allowed' : isIlluminateEnabled ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`} onClick={() => resetCustomTimer(timerId)} title="Reset" disabled={isRunning} > <RotateCcw className="w-3.5 h-3.5" /> </button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-gray-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'}`} onClick={() => handleEditTimerClick(timerId, timer.data.name, timer.data.time)} title="Edit" disabled={isRunning} > <Edit className={`w-3.5 h-3.5 ${isRunning ? 'opacity-50' : ''}`} /> </button> <button className={`p-1.5 rounded-full transition-colors ${isRunning ? 'text-gray-400/50 cursor-not-allowed' : isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'}`} onClick={() => handleDeleteTimer(timerId)} title="Delete" disabled={isRunning} > <Trash className={`w-3.5 h-3.5 ${isRunning ? 'opacity-50' : ''}`} /> </button> </div> </> )} </div> {isFinished && !isEditing && ( <p className="text-center text-[10px] text-yellow-600 dark:text-yellow-500 mt-1">Timer finished!</p> )} </li> ); })} </ul> </div> )}
           </div> {/* End Right Column */}
        </div> {/* End Main Content Grid */}
      </main> {/* End Main Content Area */}

      {/* AI Chat & Insights Sidebar */}
      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${ isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full' } ${cardClass} flex flex-col shadow-2xl border-l ${illuminateBorder}`} role="complementary" aria-labelledby="ai-sidebar-title" >
        {/* Sidebar Header */}
        <div className={`p-3 sm:p-4 border-b ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky top-0 backdrop-blur-sm z-20`} > <div className="flex justify-between items-center mb-2"> <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}> <BrainCircuit className="w-5 h-5" /> TaskMaster AI </h3> <button onClick={() => setIsAiSidebarOpen(false)} className={`${ iconColor } p-1 rounded-full ${illuminateBgHover} transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar" > <X className="w-5 h-5" /> </button> </div> <div className="flex items-center gap-2">
           {/* Chat Conversation Selector - FIXED: Removed truncate class */}
           <select
              value={selectedConversationId || ''}
              onChange={(e) => {
                  const newId = e.target.value;
                  if (newId) {
                      console.log("User selected conversation:", newId);
                      setSelectedConversationId(newId);
                      // Reset name gen flag state when changing conv
                       const selectedConv = chatConversations.find(c => c.id === newId);
                       setHasGeneratedChatNameForCurrentConv(selectedConv?.data?.nameGenerated || false);
                  }
              }}
              disabled={isConversationsLoading || chatConversations.length === 0}
              // *** FIX: Removed 'truncate' class ***
              className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`}
              title="Select Conversation"
              style={{ textOverflow: 'ellipsis' }} // Use CSS ellipsis if needed, but removing truncate might be enough
              >
              {isConversationsLoading ? ( <option value="">Loading chats...</option> ) :
               chatConversations.length > 0 ? (
                 chatConversations
                  .sort((a, b) => (b.data?.lastActivity?.seconds ?? b.data?.createdAt?.seconds ?? 0) - (a.data?.lastActivity?.seconds ?? a.data?.createdAt?.seconds ?? 0) )
                  .map(conv => (
                   <option key={conv.id} value={conv.id}>
                      {/* Use helper function for robust display name */}
                      {getChatDisplayName(conv)}
                   </option>
                 ))
               ) : ( <option value="">No chats yet</option> )}
           </select>
           {/* *** END FIX *** */}
           <button onClick={handleNewChat} disabled={isChatLoading || isConversationsLoading} className={`bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 flex items-center gap-1 text-xs`} title="Start New Chat" > <PlusCircle className="w-3.5 h-3.5" /> New </button> </div> <div className={`mt-3 flex border-b ${illuminateBorder} -mb-[1px]`}> <button onClick={() => setAiSidebarTab('chat')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'chat' ? `border-blue-500 ${illuminateTextBlue}` : `border-transparent ${subheadingClass} hover:${illuminateTextBlue}`}`} > Chat </button>
             {/* *** FIX: Added BETA tag *** */}
             <button onClick={() => setAiSidebarTab('insights')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'insights' ? `border-purple-500 ${illuminateTextPurple}` : `border-transparent ${subheadingClass} hover:${illuminateTextPurple}`}`} >
                Insights <span className="text-xs font-normal opacity-70 ml-1">(BETA)</span>
             </button>
             {/* *** END FIX *** */}
        </div> </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto" ref={aiSidebarTab === 'chat' ? chatEndRef : null}>
            {/* CHAT TAB */}
            {aiSidebarTab === 'chat' && (
                <div className="p-3 space-y-3">
                    {isMessagesLoading && selectedConversationId && ( <div className="space-y-3 animate-pulse p-4"> <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> <div className={`h-12 rounded w-2/3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div> </div> )}
                    {!isMessagesLoading && currentChatHistory.map((message, index) => (
                        <div key={message.id} className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' } animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }} >
                             <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${ message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50') }`} >
                                {/* Render Markdown - Ensure content exists before rendering */}
                                {message.content && message.content !== "..." ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                            li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                                            a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                            code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? ( <pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}> <code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code> </pre> ) : ( <code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}> {children} </code> ); },
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                ) : message.content === "..." && isChatLoading && index === currentChatHistory.length - 1 ? (
                                    // Loading indicator only for the very last message if it's "..." and loading
                                    <div className="flex space-x-1 p-1">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                    </div>
                                ) : null /* Don't render anything if content is "..." but not loading or not last */ }

                                {message.timer && ( <div className="mt-1.5"> <div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}> <TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} /> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} /> </div> </div> )}
                                {message.flashcard && ( <div className="mt-1.5"> <FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /> </div> )}
                                {message.question && ( <div className="mt-1.5"> <FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /> </div> )}
                                {message.recommendation && !message.error && ( <div className={`mt-2 p-2 rounded-md border ${isIlluminateEnabled ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-700/50'}`}> <p className={`text-xs font-medium mb-1 ${isIlluminateEnabled ? 'text-purple-800' : 'text-purple-300'}`}>AI Suggestion:</p> <p className="text-xs mb-1.5">{message.recommendation.reasoning}</p> <div className="flex justify-end gap-1.5"> <button onClick={() => executeAiAction(message.recommendation!)} className="px-2 py-0.5 text-[10px] rounded bg-green-500 text-white hover:bg-green-600">Accept</button> <button onClick={() => { setCurrentChatHistory(prev => prev.map(m => m.id === message.id ? {...m, recommendation: undefined} : m)) }} className="px-2 py-0.5 text-[10px] rounded bg-red-500 text-white hover:bg-red-600">Reject</button> </div> </div> )}
                            </div>
                        </div>
                    ))}
                    {isMessagesLoading && currentChatHistory.length === 0 && selectedConversationId && ( <div className="flex justify-start animate-fadeIn"> <div className={`${ isIlluminateEnabled ? 'bg-gray-100 border border-gray-200/80' : 'bg-gray-700/80 border border-gray-600/50' } rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm`}> <div className="flex space-x-1 p-1"> <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> </div> </div> </div> )}
                    {!selectedConversationId && !isConversationsLoading && !isMessagesLoading && ( <div className="text-center p-6 text-sm italic text-gray-500"> Select a conversation or start a new one to begin chatting. </div> )}
                     {!isMessagesLoading && selectedConversationId && currentChatHistory.length === 0 && ( <div className="text-center p-6 text-sm italic text-gray-500"> Send a message to start the conversation. </div> )}
                </div>
            )}

            {/* INSIGHTS TAB */}
            {aiSidebarTab === 'insights' && (
                <div className="p-3 sm:p-4 space-y-4">
                    <button onClick={generateAiInsights} disabled={aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading'} className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors transform hover:scale-[1.02] active:scale-100 shadow-md ${aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading' ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`} > {aiGeneratedInsights.isLoading ? ( <> <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating... </> ) : userTier === 'basic' || userTier === 'loading' ? ( <> <Lock className="w-4 h-4" /> Generate Insights (Pro/Premium)</> ) : ( <> <Sparkles className="w-4 h-4" /> Generate Insights </> )} </button>
                    {aiGeneratedInsights.error && ( <p className="text-center text-sm text-red-500 p-4 border border-red-500/30 rounded-lg">{aiGeneratedInsights.error}</p> )}
                    {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (aiGeneratedInsights.score !== undefined || aiGeneratedInsights.timeManagement || aiGeneratedInsights.conflicts || aiGeneratedInsights.other) && (
                        <div className="space-y-3 animate-fadeIn">
                            {aiGeneratedInsights.score !== undefined && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-green-500' : 'border-green-400'}`}> <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Productivity Score</p> <p className={`text-2xl font-bold ${headingClass}`}>{aiGeneratedInsights.score} <span className="text-sm font-normal">/ 100</span></p> </div> )}
                            {aiGeneratedInsights.timeManagement && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-blue-500' : 'border-blue-400'}`}> <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Time Management</p> <p className="text-sm">{aiGeneratedInsights.timeManagement}</p> </div> )}
                            {aiGeneratedInsights.conflicts && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-orange-500' : 'border-orange-400'}`}> <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Potential Conflicts</p> <p className="text-sm">{aiGeneratedInsights.conflicts}</p> </div> )}
                            {aiGeneratedInsights.other && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-purple-500' : 'border-purple-400'}`}> <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Additional Insights</p> <p className="text-sm">{aiGeneratedInsights.other}</p> </div> )}
                        </div>
                    )}
                    {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && aiGeneratedInsights.score === undefined && !aiGeneratedInsights.timeManagement && !aiGeneratedInsights.conflicts && !aiGeneratedInsights.other && userTier !== 'basic' && userTier !== 'loading' && ( <p className="text-center text-sm italic text-gray-500 p-6"> Click "Generate Insights" to get an AI analysis of your productivity based on your current items and context. </p> )}
                    {(userTier === 'basic' || userTier === 'loading') && !aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && ( <p className="text-center text-sm italic text-gray-500 p-6"> Upgrade to Pro or Premium to generate AI-powered productivity insights. </p> )}
                </div>
            )}
        </div>


        {/* Sidebar Footer (Chat Input Area) */}
        <div className={`px-2 sm:px-3 pt-1 border-t ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`} > {userTier !== 'premium' && userTier !== 'loading' && ( <div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {chatCount} / {currentChatLimit === Infinity ? 'Unlimited' : currentChatLimit} </span> {isChatLimitReached && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )} </div> )} <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2"> <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={isChatLimitReached ? "Monthly limit reached..." : aiSidebarTab === 'insights' ? "Switch to Chat tab to talk..." : !selectedConversationId ? "Select or start a chat..." : "Ask TaskMaster AI..."} className={`flex-1 ${inputBg} border ${illuminateBorder} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 ${isChatLimitReached || aiSidebarTab === 'insights' || !selectedConversationId ? 'cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'} aria-label="Chat input" /> <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'} className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached || aiSidebarTab === 'insights' || !selectedConversationId ? 'cursor-not-allowed' : ''}`} title="Send Message" aria-label="Send chat message" > {isChatLoading ? ( <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ) : ( <Send className="w-4 h-4" /> )} </button> </form> </div>
      </div> {/* End AI Sidebar */}
    </div> // End Page Container
  );
}
