
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom"; // Added Link
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  X,
  Timer as TimerIconLucide, // Renamed to avoid conflict with Timer component if added later
  Target,
  ListTodo,
  FolderOpen as Folder,
  Edit,
  Trash2 as Trash,
  CheckCircle,
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  AlertCircle,
  Filter,
  GripVertical,
  Sun,
  Moon,
  Crown,
  Circle,
  ListChecks,
  CalendarDays,
  MapPin,
  Users,
  Bell,
  BrainCircuit, // Added for AI Chat & Context
  Send,          // Added for AI Chat
  Loader2,       // Added for loading state
  Brain,         // Added for context button
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { auth, db } from "../lib/firebase"; // Import db directly for getDoc
import type { User } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions used
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
  addDays,
  startOfDay,
  endOfDay,
  getDay,
  addWeeks,
  subWeeks,
  differenceInDays,
  parse,
  startOfMonth,
  endOfMonth,
  differenceInMinutes, // Import for AI context
  subDays,             // Import for AI context
  isValid,             // Import for date validation
} from "date-fns";
import {
  // Calendar-specific functions from calendar-firebase
  onCollectionSnapshot as onCalendarCollectionSnapshot,
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEventData, // Import type for payload
} from "../lib/calendar-firebase"; // Correct imports for events
import {
  // Dashboard item functions (Snapshot only needed from here)
  onCollectionSnapshot as onDashboardCollectionSnapshot,
  geminiApiKey,
} from '../lib/dashboard-firebase';
import {
  // --- NEW: Import AI Action Functions ---
  createUserTask,
  updateUserTask,
  deleteUserTask,
  createUserGoal,
  updateUserGoal,
  deleteUserGoal,
  createUserPlan,
  updateUserPlan,
  deleteUserPlan,
  createUserProject,
  updateUserProject,
  deleteUserProject,
} from '../lib/ai-actions-firebase'; // Import functions to perform actions
import { findItemByName } from '../lib/ai-chat-firebase'; // Import helper to find items by name

import {
  // --- Import Pricing/Usage Logic ---
  getUserTier, // <<<< Ensure this is the async version
  getCurrentMonthUserChatUsage,
  incrementUserChatUsage,
  getChatLimitForTier,
  UserTier, // <<<< Ensure UserTier type is imported
} from '../lib/current-paying-user';
import {
    // --- Import AI Context Logic ---
    saveUserContext,
    getUserContext,
    onUserContextChange,
    type UserContext,
} from '../lib/ai-context-firebase';
import { ContextDialog } from './context-dialog'; // Import Context Dialog component

import { PriorityBadge } from './PriorityBadge';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ---------------------
// Helper functions for Gemini integration
// ---------------------
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}&alt=sse`; // Use 1.5 flash

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
  timeout = 45000 // Increased timeout
) => {
    try {
        const response = await fetch(url, { ...options }); // No timeout needed for true streaming

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
            onStreamUpdate(text); // Send full text if not streamable
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
                    extractedText = "";
                }
            } catch (e) { extractedText = ""; }
        } else { extractedText = ""; }

        return extractedText.replace(/^Assistant:\s*/, '').replace(/^(User|Human):\s*/, '').trim();
    } catch (err) {
        console.error("Error *during* extraction logic:", err, "Original text:", rawResponseText);
        return "";
    }
};

function extractJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const tripleBacktickRegex = /```json\s*([\s\S]*?)```/g;
  let match = tripleBacktickRegex.exec(text);
  while (match) {
    blocks.push(match[1].trim());
    match = tripleBacktickRegex.exec(text);
  }

  if (blocks.length > 0) return blocks;

  const curlyRegex = /(\{(?:[^{}]|(?:\{[^{}]*\}))*?\})/g;
  let curlyMatch = curlyRegex.exec(text);
  while (curlyMatch) {
    try {
        JSON.parse(curlyMatch[1]);
        blocks.push(curlyMatch[1].trim());
    } catch (e) { /* Ignore */ }
    curlyMatch = curlyRegex.exec(text);
  }
  return blocks;
}


// ---------------------------
//   Interfaces & Types
// ---------------------------
interface CalendarItemBase {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: "event" | "task" | "goal" | "project" | "plan";
  userId: string;
  color?: string;
  isAllDay?: boolean;
  description?: string;
  status?: "pending" | "completed";
  priority?: 'high' | 'medium' | 'low';
  originalCollection?: "tasks" | "goals" | "projects" | "plans";
}

interface CalendarEvent extends CalendarItemBase {
  type: "event";
  originalCollection?: undefined;
}

type CalendarItem = CalendarItemBase;
type CalendarView = "month" | "week";

interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    error?: boolean;
}

interface AiActionPayload {
    id?: string;
    title?: string;
    task?: string;
    goal?: string;
    project?: string;
    plan?: string;
    description?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    dueDate?: string | Date;
    isAllDay?: boolean;
    color?: string;
    priority?: 'high' | 'medium' | 'low';
    newTitle?: string;
    newTask?: string;
    newGoal?: string;
    newProject?: string;
    newPlan?: string;
    userId?: string;
}

interface AiAction {
    action:
      | 'createEvent' | 'updateEvent' | 'deleteEvent'
      | 'createTask' | 'updateTask' | 'deleteTask'
      | 'createGoal' | 'updateGoal' | 'deleteGoal'
      | 'createProject' | 'updateProject' | 'deleteProject'
      | 'createPlan' | 'updatePlan' | 'deletePlan';
    payload: AiActionPayload;
}


// ---------------------------
//   Component Logic
// ---------------------------
export function Calendar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<any[]>([]);
  const [dashboardGoals, setDashboardGoals] = useState<any[]>([]);
  const [dashboardProjects, setDashboardProjects] = useState<any[]>([]);
  const [dashboardPlans, setDashboardPlans] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem("isSidebarCollapsed") || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem("isBlackoutEnabled") || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem("isSidebarBlackoutEnabled") || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem("isIlluminateEnabled") || 'true'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem("isSidebarIlluminateEnabled") || 'false'));

  const [itemForm, setItemForm] = useState({
    id: "", title: "", description: "", startDate: new Date(),
    endDate: addDays(new Date(), 1), isAllDay: false,
    type: "event" as CalendarItem["type"], color: "#3B82F6",
    priority: 'medium' as 'high' | 'medium' | 'low', originalCollection: undefined as CalendarItem['originalCollection'],
  });

  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: 'cal-greet-initial', role: 'assistant', content: "Hi! I'm your Scheduling Assistant. How can I help manage your calendar today? Feel free to ask me to add, change, or remove items." }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [chatCount, setChatCount] = useState(0);
  const [usageMonth, setUsageMonth] = useState('');
  const [isChatLimitReached, setIsChatLimitReached] = useState(false);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  const currentChatLimit = useMemo(() => {
      return getChatLimitForTier(userTier);
  }, [userTier]);


  // ---------------------------
  //   Helper Functions (Date Parsing, Priority etc.)
  // ---------------------------
   const getWeekDates = (date: Date): Date[] => eachDayOfInterval({ start: startOfWeek(date), end: endOfWeek(date) });

   const getMonthGridDays = (date: Date): Date[] => {
        const start = startOfWeek(startOfMonth(date));
        const end = endOfWeek(endOfMonth(date));
        let days = eachDayOfInterval({ start, end });
        if (days.length < 42) {
             const endOfSixthWeek = endOfWeek(addDays(start, 35));
             days = eachDayOfInterval({ start, end: endOfSixthWeek });
        }
        return days;
    };

  const formatDateForInput = (date: Date | null | undefined, isAllDay: boolean): string => {
    if (!date || !isValid(date)) return "";
    try {
      if (isAllDay) return format(date, "yyyy-MM-dd");
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - tzOffset);
      return localDate.toISOString().slice(0, 16);
    } catch { return ""; }
  };

  const parseInputDateFlexible = (value: string | Date | null | undefined, isAllDay: boolean = false): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
        return isValid(value) ? value : null;
    }
    if (typeof value === 'string') {
        let parsedDate: Date | null = null;
        const trimmedValue = value.trim();
        try {
            parsedDate = parseISO(trimmedValue);
            if (isValid(parsedDate)) return parsedDate;
            if (/\s(?:GMT|([A-Z]{3,}[ ]?Time))\b/.test(trimmedValue)) {
                parsedDate = new Date(trimmedValue);
                if (isValid(parsedDate)) return parsedDate;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
               parsedDate = parse(trimmedValue, "yyyy-MM-dd", new Date());
               if (isValid(parsedDate)) return startOfDay(parsedDate);
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmedValue)) {
                parsedDate = parse(trimmedValue, "yyyy-MM-dd HH:mm", new Date());
                if (isValid(parsedDate)) return parsedDate;
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmedValue)) {
                 parsedDate = parse(trimmedValue, "yyyy-MM-dd HH:mm:ss", new Date());
                 if (isValid(parsedDate)) return parsedDate;
            }
            parsedDate = new Date(trimmedValue);
            if (isValid(parsedDate)) return parsedDate;
            console.warn("Could not parse date string with any known format:", trimmedValue);
            return null;
        } catch (e) {
            console.error(`Error during date string parsing ("${trimmedValue}"):`, e);
            return null;
        }
    }
    console.warn("Invalid date input type:", value);
    return null;
  };


    const calculatePriority = (itemData: any): 'high' | 'medium' | 'low' => {
        if (itemData.priority && ['high', 'medium', 'low'].includes(itemData.priority)) return itemData.priority;
        let dueDate: Date | null = null;
        if (itemData.dueDate) {
            dueDate = parseInputDateFlexible(itemData.dueDate);
        } else if (itemData.startDate) {
            dueDate = parseInputDateFlexible(itemData.startDate);
        }
        if (!dueDate || !isValid(dueDate)) return 'low';
        const now = startOfDay(new Date());
        const dueDay = startOfDay(dueDate);
        const diffDays = differenceInDays(dueDay, now);
        if (diffDays < 0) return 'high';
        if (diffDays <= 1) return 'high';
        if (diffDays <= 3) return 'medium';
        return 'low';
    };

    const allCalendarItems = useMemo((): CalendarItem[] => {
        const dashboardItems: CalendarItem[] = [
        ...dashboardTasks.map((item): CalendarItem | null => {
            const startDate = parseInputDateFlexible(item.data.dueDate, true) ?? startOfDay(new Date());
            return {
                id: item.id,
                title: item.data.task || "Untitled Task",
                startDate: startDate,
                endDate: endOfDay(startDate),
                type: "task",
                isAllDay: true,
                userId: item.data.userId,
                color: "#EF4444",
                status: item.data.completed ? "completed" : "pending",
                priority: calculatePriority(item.data),
                originalCollection: "tasks",
                description: item.data.description || "",
            };
        }),
        ...dashboardGoals.map((item): CalendarItem | null => {
             const startDate = parseInputDateFlexible(item.data.dueDate, true) ?? startOfDay(new Date());
            return {
                id: item.id,
                title: item.data.goal || "Untitled Goal",
                startDate: startDate,
                endDate: endOfDay(startDate),
                type: "goal",
                isAllDay: true,
                userId: item.data.userId,
                color: "#10B981",
                status: item.data.completed ? "completed" : "pending",
                priority: calculatePriority(item.data),
                originalCollection: "goals",
                description: item.data.description || "",
            };
        }),
        ...dashboardProjects.map((item): CalendarItem | null => {
            const startDate = parseInputDateFlexible(item.data.dueDate, true) ?? startOfDay(new Date());
            return {
                id: item.id,
                title: item.data.project || "Untitled Project",
                startDate: startDate,
                endDate: endOfDay(startDate),
                type: "project",
                isAllDay: true,
                userId: item.data.userId,
                color: "#6366F1",
                status: item.data.completed ? "completed" : "pending",
                priority: calculatePriority(item.data),
                originalCollection: "projects",
                description: item.data.description || "",
            };
        }),
        ...dashboardPlans.map((item): CalendarItem | null => {
            const startDate = parseInputDateFlexible(item.data.dueDate, true) ?? startOfDay(new Date());
             return {
                id: item.id,
                title: item.data.plan || "Untitled Plan",
                startDate: startDate,
                endDate: endOfDay(startDate),
                type: "plan",
                isAllDay: true,
                userId: item.data.userId,
                color: "#8B5CF6",
                status: item.data.completed ? "completed" : "pending",
                priority: calculatePriority(item.data),
                originalCollection: "plans",
                description: item.data.description || "",
            };
        }),
        ].filter((item): item is CalendarItem => item !== null && isValid(item.startDate));

        const validCalendarEvents = calendarEvents.filter(event =>
            event.startDate instanceof Date && isValid(event.startDate) &&
            event.endDate instanceof Date && isValid(event.endDate)
        );

        const uniqueMap = new Map<string, CalendarItem>();
        dashboardItems.forEach(item => uniqueMap.set(item.id, item));
        validCalendarEvents.forEach(item => uniqueMap.set(item.id, item));

        return Array.from(uniqueMap.values());
    }, [calendarEvents, dashboardTasks, dashboardGoals, dashboardProjects, dashboardPlans]);


  // ---------------------------
  //   Effects (Auth, Data Listeners, Theme, Resize)
  // ---------------------------
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    }, [isIlluminateEnabled]);
    useEffect(() => localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)), [isSidebarIlluminateEnabled]);


    // Auth Listener (Loads Tier/Usage/Name) - *** UPDATED with new logic ***
    useEffect(() => {
        setLoading(true); // Overall loading for the component
        setUserTier('loading');
        setIsLoadingUsage(true); // Specific loading for usage data

        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => { // Make callback async
            setUser(firebaseUser);
            if (firebaseUser) {
                let fetchedTier: UserTier = 'loading'; // Temporary tier variable

                // Fetch Name (can run in parallel or before tier/usage)
                const userDocRef = doc(db, "users", firebaseUser.uid);
                getDoc(userDocRef)
                    .then(docSnap => {
                        const name = docSnap.exists() && docSnap.data()?.name ? docSnap.data()?.name : firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User";
                        setUserName(name);
                    })
                    .catch(() => setUserName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User"));

                // Fetch Tier
                try {
                    // Use uid and email as per current-paying-user.ts
                    fetchedTier = await getUserTier(firebaseUser.uid, firebaseUser.email);
                    setUserTier(fetchedTier);
                } catch (tierError) {
                    console.error("Calendar: Error fetching user tier:", tierError);
                    fetchedTier = 'basic'; // Fallback on error
                    setUserTier('basic');
                }

                // Fetch Usage (depends on fetchedTier)
                if (fetchedTier !== 'premium' && fetchedTier !== 'loading') {
                    const currentMonthYear = new Date().toISOString().slice(0, 7);
                    try {
                        const usageData = await getCurrentMonthUserChatUsage(firebaseUser.uid, currentMonthYear);
                        if (usageData) {
                            setChatCount(usageData.count);
                            setUsageMonth(usageData.month);
                            setIsChatLimitReached(usageData.count >= getChatLimitForTier(fetchedTier));
                        } else {
                            setChatCount(0);
                            setUsageMonth(currentMonthYear);
                            setIsChatLimitReached(false);
                        }
                    } catch (err) {
                        console.error("Calendar: Error loading chat usage data:", err);
                        setChatCount(0);
                        setUsageMonth(currentMonthYear);
                        setIsChatLimitReached(false); // Assume not limited on error
                    } finally {
                        setIsLoadingUsage(false);
                    }
                } else { // Premium or still loading tier
                    setChatCount(0);
                    setUsageMonth('');
                    setIsChatLimitReached(false);
                    setIsLoadingUsage(false); // Ensure usage loading stops
                    if (fetchedTier === 'premium') {
                    }
                }
                setLoading(false); // All initial auth-dependent data fetched or attempted

            } else {
                // Logout state reset
                setCalendarEvents([]); setDashboardTasks([]); setDashboardGoals([]); setDashboardProjects([]); setDashboardPlans([]);
                setUserName("User"); setUserTier('loading'); setChatCount(0); setUsageMonth(''); setIsChatLimitReached(false); setIsLoadingUsage(true); setUserContext(null);
                setLoading(false); // Stop loading
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [navigate]);


    // User Context Listener
    useEffect(() => {
        if (!user?.uid) { setUserContext(null); return; }
        const unsubscribeContext = onUserContextChange(user.uid, setUserContext);
        return () => unsubscribeContext();
    }, [user?.uid]);

    // Scroll AI chat to bottom
    useEffect(() => {
        if (chatEndRef.current && isAiSidebarOpen) {
            requestAnimationFrame(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
        }
    }, [chatHistory, isAiSidebarOpen]);


    // Data Listeners (Events and Dashboard Items)
    useEffect(() => {
        if (!user?.uid) {
             setCalendarEvents([]); setDashboardTasks([]); setDashboardGoals([]); setDashboardProjects([]); setDashboardPlans([]);
             // setLoading(true); // setLoading(true) is handled by auth listener if user becomes null
             return;
         }

        let loadedFlags = { event: false, task: false, goal: false, project: false, plan: false };
        // setLoading(true); // setLoading is for initial page load, this is for data streams

        const checkAllLoaded = () => {
            // This function might not be strictly necessary if `setLoading` is mainly for auth state
            // However, if you want a loading state until *all* data is initially fetched, it's useful.
            // For now, the main `loading` state is tied to auth.
            // If Object.values(loadedFlags).every(flag => flag === true)) { setLoading(false); }
        }

        const handleListenerError = (collectionName: string, error: Error) => {
            console.error(`Error fetching ${collectionName}:`, error);
             switch(collectionName) {
                case 'events': loadedFlags.event = true; break;
                case 'tasks': loadedFlags.task = true; break;
                case 'goals': loadedFlags.goal = true; break;
                case 'projects': loadedFlags.project = true; break;
                case 'plans': loadedFlags.plan = true; break;
            }
            checkAllLoaded();
        };

        const unsubEvents = onCalendarCollectionSnapshot(user.uid, (items) => {
            setCalendarEvents(
                 items.map(item => ({
                    ...item.data,
                    id: item.id,
                    startDate: item.data.startDate instanceof Date && isValid(item.data.startDate) ? item.data.startDate : new Date(),
                    endDate: item.data.endDate instanceof Date && isValid(item.data.endDate) ? item.data.endDate : addDays(item.data.startDate, 1),
                    type: 'event' as const,
                    originalCollection: undefined,
                 })).filter(event => isValid(event.startDate))
             );
            loadedFlags.event = true; checkAllLoaded();
        }, (error) => handleListenerError('events', error));


        const unsubTasks = onDashboardCollectionSnapshot("tasks", user.uid, (data) => { setDashboardTasks(data); loadedFlags.task = true; checkAllLoaded(); }, (error) => handleListenerError('tasks', error));
        const unsubGoals = onDashboardCollectionSnapshot("goals", user.uid, (data) => { setDashboardGoals(data); loadedFlags.goal = true; checkAllLoaded(); }, (error) => handleListenerError('goals', error));
        const unsubProjects = onDashboardCollectionSnapshot("projects", user.uid, (data) => { setDashboardProjects(data); loadedFlags.project = true; checkAllLoaded(); }, (error) => handleListenerError('projects', error));
        const unsubPlans = onDashboardCollectionSnapshot("plans", user.uid, (data) => { setDashboardPlans(data); loadedFlags.plan = true; checkAllLoaded(); }, (error) => handleListenerError('plans', error));


        return () => {
            unsubEvents();
            unsubTasks();
            unsubGoals();
            unsubProjects();
            unsubPlans();
        };
    }, [user?.uid]);


  // ---------------------------
  //   Event Handlers (UI)
  // ---------------------------
    const handleToggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
    const handlePrev = () => {
        if (calendarView === "month") setCurrentDate(subMonths(currentDate, 1));
        else if (calendarView === "week") setCurrentDate(subWeeks(currentDate, 1));
    };
    const handleNext = () => {
        if (calendarView === "month") setCurrentDate(addMonths(currentDate, 1));
        else if (calendarView === "week") setCurrentDate(addWeeks(currentDate, 1));
    };
    const handleToday = () => setCurrentDate(new Date());
    const handleViewChange = (view: CalendarView) => setCalendarView(view);

    const handleDateClick = (date: Date) => {
        setSelectedItem(null);
        setModalDate(date);
        const startDate = startOfDay(date); startDate.setHours(9, 0, 0, 0);
        const endDate = new Date(startDate); endDate.setHours(10, 0, 0, 0);

        setItemForm({
            id: "", title: "", description: "", startDate: startDate, endDate: endDate,
            isAllDay: false, type: "event", color: "#3B82F6", priority: 'medium',
            originalCollection: undefined,
        });
        setShowModal(true);
    };

    const handleItemClick = (item: CalendarItem) => {
        setSelectedItem(item);
        setModalDate(null);

        const validStartDate = item.startDate instanceof Date && isValid(item.startDate) ? item.startDate : new Date();
        const validEndDate = item.endDate instanceof Date && isValid(item.endDate) ? item.endDate : addDays(validStartDate, 1);

        setItemForm({
            id: item.id,
            title: item.title,
            description: item.description || "",
            startDate: validStartDate,
            endDate: validEndDate,
            isAllDay: item.isAllDay ?? (item.type !== 'event' && isSameDay(startOfDay(validStartDate), startOfDay(validEndDate))),
            type: item.type,
            color: item.color || getDefaultColor(item.type),
            priority: item.priority || calculatePriority(item),
            originalCollection: item.originalCollection,
        });
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setSelectedItem(null);
        setModalDate(null);
        setItemForm({
             id: "", title: "", description: "", startDate: new Date(),
            endDate: addDays(new Date(), 1), isAllDay: false,
            type: "event", color: "#3B82F6", priority: 'medium',
            originalCollection: undefined,
        });
    };

    const handleFormChange = (field: keyof typeof itemForm, value: any) => {
        setItemForm((prev) => {
            let newState = { ...prev };
            if (field === 'startDate' || field === 'endDate') {
                 const parsedDate = parseInputDateFlexible(value, prev.isAllDay);
                 if (parsedDate && isValid(parsedDate)) {
                    newState = { ...newState, [field]: parsedDate };
                 } else {
                    console.warn(`Invalid UI date input for ${field}:`, value);
                    return prev;
                 }
            } else if (field === 'isAllDay') {
                const isNowAllDay = Boolean(value);
                newState.isAllDay = isNowAllDay;
                 const currentStart = newState.startDate instanceof Date && isValid(newState.startDate) ? newState.startDate : new Date();
                 const currentEnd = newState.endDate instanceof Date && isValid(newState.endDate) ? newState.endDate : addDays(currentStart, 1);
                if (isNowAllDay) {
                    newState.startDate = startOfDay(currentStart);
                    newState.endDate = startOfDay(currentEnd);
                    if (isSameDay(newState.startDate, newState.endDate)) {
                        newState.endDate = newState.startDate;
                    }
                } else {
                     const startTime = new Date(currentStart); startTime.setHours(9,0,0,0);
                     const endTime = new Date(currentEnd); endTime.setHours(10,0,0,0);
                     newState.startDate = startTime;
                     newState.endDate = endTime;
                }
            } else {
                 newState = { ...newState, [field]: value };
            }
             if (newState.endDate instanceof Date && newState.startDate instanceof Date && isValid(newState.endDate) && isValid(newState.startDate) && newState.endDate < newState.startDate) {
                const newEndDate = new Date(newState.startDate);
                if (!newState.isAllDay) {
                    newEndDate.setHours(newEndDate.getHours() + 1);
                }
                newState.endDate = newEndDate;
            }
            return newState;
        });
    };

    const handleSaveItem = async () => {
        if (!user || !itemForm.title.trim()) return;
        const startDate = itemForm.startDate instanceof Date && isValid(itemForm.startDate) ? itemForm.startDate : null;
        let endDate = itemForm.endDate instanceof Date && isValid(itemForm.endDate) ? itemForm.endDate : null;
        if (!startDate) { alert("Invalid start date."); return; }
        if (!endDate) {
            endDate = new Date(startDate);
            if (!itemForm.isAllDay) endDate.setHours(startDate.getHours() + 1);
        }
        if (endDate < startDate) { alert("End date cannot be before start date."); return; }
        const finalStartDate = startDate;
        const finalEndDate = itemForm.isAllDay && isSameDay(startDate, endDate) ? startDate : endDate;
        const isDashboardItem = selectedItem?.originalCollection && selectedItem.type !== 'event';
        const isEditing = !!selectedItem;

        try {
            if (isEditing) {
                 if (isDashboardItem && selectedItem) { // Ensure selectedItem is not null
                    const updatePayload: any = {
                        [selectedItem.type]: itemForm.title.trim(),
                        description: itemForm.description.trim(),
                        dueDate: finalStartDate,
                        priority: itemForm.priority,
                    };
                     switch(selectedItem.originalCollection) {
                        case 'tasks': await updateUserTask(selectedItem.id, updatePayload); break;
                        case 'goals': await updateUserGoal(selectedItem.id, updatePayload); break;
                        case 'projects': await updateUserProject(selectedItem.id, updatePayload); break;
                        case 'plans': await updateUserPlan(selectedItem.id, updatePayload); break;
                        default: throw new Error("Unknown original collection for dashboard item update");
                    }
                } else if(selectedItem) { // Editing a Calendar Event
                    const eventUpdatePayload: Partial<CalendarEventData> = {
                        title: itemForm.title.trim(),
                        description: itemForm.description.trim(),
                        startDate: finalStartDate,
                        endDate: finalEndDate,
                        isAllDay: itemForm.isAllDay,
                        color: itemForm.color,
                    };
                    await updateEvent(selectedItem.id, eventUpdatePayload);
                }
            } else { // Creating New Item
                 const eventCreatePayload: Omit<CalendarEventData, 'createdAt' | 'updatedAt'> = {
                    userId: user.uid,
                    title: itemForm.title.trim(),
                    description: itemForm.description.trim(),
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    isAllDay: itemForm.isAllDay,
                    color: itemForm.color,
                    type: 'event',
                };
                await createEvent(eventCreatePayload);
            }
            handleModalClose();
        } catch (error) {
            console.error("Error saving item from UI:", error);
            alert(`Failed to save item. ${error instanceof Error ? error.message : 'Please check console.'}`);
        }
    };

    const handleDeleteItem = async () => {
        if (!selectedItem || !user) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete "${selectedItem.title}"?`);
        if (!confirmDelete) return;

        try {
        if (selectedItem.originalCollection && selectedItem.type !== 'event') {
            switch(selectedItem.originalCollection) {
                case 'tasks': await deleteUserTask(selectedItem.id); break;
                case 'goals': await deleteUserGoal(selectedItem.id); break;
                case 'projects': await deleteUserProject(selectedItem.id); break;
                case 'plans': await deleteUserPlan(selectedItem.id); break;
                 default: throw new Error("Unknown original collection for dashboard item delete");
            }
        } else {
            await deleteEvent(selectedItem.id);
        }
        handleModalClose();
        } catch (error) {
            console.error("Error deleting item from UI:", error);
            alert(`Failed to delete item. ${error instanceof Error ? error.message : 'Please check console.'}`);
        }
    };


    const getItemsForDay = (date: Date): CalendarItem[] => {
        const dayStart = startOfDay(date);
        return allCalendarItems.filter(item => {
            const itemStartDay = item.startDate instanceof Date && isValid(item.startDate) ? startOfDay(item.startDate) : null;
            const itemEndDay = item.endDate instanceof Date && isValid(item.endDate) ? startOfDay(item.endDate) : itemStartDay;
             if (!itemStartDay || !itemEndDay) return false;
            return itemStartDay <= dayStart && itemEndDay >= dayStart;
        }).sort((a, b) => {
             if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
             const timeA = a.startDate instanceof Date && isValid(a.startDate) ? a.startDate.getTime() : 0;
             const timeB = b.startDate instanceof Date && isValid(b.startDate) ? b.startDate.getTime() : 0;
             return timeA - timeB;
        });
    };

    const getTypeIcon = (type: CalendarItem["type"]) => {
        const iconProps = { className: "w-3.5 h-3.5 flex-shrink-0" };
        switch (type) {
            case "task": return <ListChecks {...iconProps} />;
            case "goal": return <Target {...iconProps} />;
            case "project": return <Folder {...iconProps} />;
            case "plan": return <TimerIconLucide {...iconProps} />;
            case "event": default: return <CalendarDays {...iconProps} />;
        }
    };

    const getDefaultColor = (type: CalendarItem["type"]): string => {
        switch (type) {
            case "task": return "#EF4444";
            case "goal": return "#10B981";
            case "project": return "#6366F1";
            case "plan": return "#8B5CF6";
            case "event": default: return "#3B82F6";
        }
    };

    const formatCalendarItemsForChat = (): string => {
        const now = new Date();
        const contextStart = subDays(now, 3);
        const contextEnd = addDays(now, 14);
        const relevantItems = allCalendarItems
            .filter(item => {
                 const itemStartDate = item.startDate instanceof Date && isValid(item.startDate) ? item.startDate : null;
                 const itemEndDate = item.endDate instanceof Date && isValid(item.endDate) ? item.endDate : itemStartDate;
                 if (!itemStartDate || !itemEndDate) return false;
                 return itemEndDate >= contextStart && itemStartDate <= contextEnd;
            })
            .sort((a, b) => (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0))
            .slice(0, 40);

        if (relevantItems.length === 0) return "No scheduled items found for the relevant period (-3 days to +14 days).";
        const formatted = relevantItems.map(item => {
             const startStr = item.isAllDay
                 ? format(item.startDate, 'EEE, MMM d')
                 : format(item.startDate, 'EEE, MMM d, h:mma');
             const endStr = item.isAllDay
                 ? (isSameDay(item.startDate, item.endDate) ? '' : ` to ${format(item.endDate, 'EEE, MMM d')}`)
                 : (isSameDay(item.startDate, item.endDate) ? ` - ${format(item.endDate, 'h:mma')}` : ` to ${format(item.endDate, 'EEE, MMM d, h:mma')}`);
            const duration = item.isAllDay || !isValid(item.startDate) || !isValid(item.endDate) ? 0 : differenceInMinutes(item.endDate, item.startDate);
            const durationStr = item.isAllDay ? "(All Day)" : (duration > 0 ? `(${Math.round(duration)} min)` : '');
            const status = item.status ? `[Status: ${item.status}]` : '';
            const priority = item.priority ? `[Priority: ${item.priority}]` : '';
            const descSnippet = item.description ? ` | Desc: ${item.description.substring(0, 30)}...` : '';
            const idInfo = `[ID: ${item.id}]`;
            const sourceInfo = item.originalCollection ? ` (Source: ${item.originalCollection})` : '';
            return `• ${item.title} (${item.type}${sourceInfo}) | ${startStr}${endStr} ${durationStr} ${priority} ${status} ${idInfo}${descSnippet}`;
        }).join('\n');
        return `User's Schedule & Items Context (approx. -3 to +14 days, IDs included for updates/deletes):\n${formatted}`;
    };


    const handleSaveContext = async (context: Partial<UserContext>) => {
        if (!user) return;
        await saveUserContext(user.uid, context);
    };


    // --- *** AI Chat Submission (Agentic Version) - UPDATED with new usage logic *** ---
    const handleCalendarChatSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatMessage.trim() || isChatLoading || !geminiApiKey || !user) return;

        // --- START: Usage Check (Uses state and imported functions) ---
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        let limitReached = false;
        // userTier state is now correctly populated by the auth listener
        const currentLimit = getChatLimitForTier(userTier);

        if (userTier !== 'premium') {
            let currentCount = chatCount;
            if (usageMonth !== currentMonthYear) {
                currentCount = 0;
                setChatCount(0);
                setUsageMonth(currentMonthYear);
                setIsChatLimitReached(false);
                limitReached = false;
            } else {
                limitReached = currentCount >= currentLimit;
                setIsChatLimitReached(limitReached);
            }
        }

        if (limitReached) {
              setChatHistory(prev => [...prev, {
                  id: `cal-limit-${Date.now()}`,
                  role: 'assistant',
                  content: `Monthly chat limit (${currentLimit === Infinity ? '∞' : currentLimit}) reached. Upgrade for more interactions!`,
                  error: true
              }]);
              setChatMessage('');
              return;
        }
        // --- END: Usage Check ---

        const currentMessage = chatMessage;
        setChatMessage('');
        const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: currentMessage };
        setChatHistory(prev => [...prev, userMsg]);
        setIsChatLoading(true);
        const assistantMsgId = `assistant-${Date.now()}`;
        const placeholderMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: "..." };
        setChatHistory(prev => [...prev, placeholderMsg]);

        // --- Increment Usage Count ---
        if (userTier !== 'premium' && user?.uid) {
            try {
                await incrementUserChatUsage(user.uid);
                const newLocalCount = chatCount + 1;
                setChatCount(newLocalCount);
                setIsChatLimitReached(newLocalCount >= currentLimit);
            } catch (err) {
                console.error("Calendar: Failed to increment chat usage:", err);
                setChatHistory(prevHist => [...prevHist, {
                    id:`usage-err-${Date.now()}`,
                    role: 'assistant',
                    content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.",
                    error: true
                }]);
            }
        }
        // --- End Increment Logic ---

        const conversationHistory = chatHistory
            .slice(-8)
            .filter(msg => msg.id !== assistantMsgId)
            .map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content}`)
            .join('\n');
        const scheduleContext = formatCalendarItemsForChat();
        const currentDateTime = format(new Date(), 'PPPP p');
        let userContextSection = '';
        if (userContext) {
            userContextSection = `
[User Context]
- Work/Study: ${userContext.workDescription || 'N/A'}
- Short-term Focus: ${userContext.shortTermFocus || 'N/A'}
- Long-term Goals: ${userContext.longTermGoals || 'N/A'}
- Additional Info: ${userContext.otherContext || 'N/A'}
`;
        }

        const prompt = `
You are TaskMaster AI, an AI Scheduling Assistant in Calendar for ${userName}. Your goal is to help manage their calendar, tasks, goals, projects, and plans effectively based on the provided context and conversation. You can now perform actions like creating, updating, or deleting items.

[Current Time]
${currentDateTime}

[Current Calendar View]
${calendarView} view showing dates around ${format(currentDate, 'MMMM yyyy')}

${userContextSection}

[User's Schedule & Items Context]
(Includes Events, Tasks, Goals, Projects, Plans. Use the [ID: ...] for updates/deletes.)
${scheduleContext}

[Recent Conversation History]
${conversationHistory}

[New User Message]
${userName}: ${currentMessage}

**Your Task:**
Respond to the user's message. If the user requests an action (create, update, delete), FIRST provide a brief confirmation or clarifying statement, THEN **immediately follow** it with the necessary JSON action block(s). If no action is requested, just respond naturally. If the user asks about what they have for a certain date, simply let them know what they have -- no need to use JSON.

**Action JSON Format:**
- Respond with one or more JSON objects wrapped in \`\`\`json ... \`\`\` blocks.
- Each block represents one action.
- Use the EXACT "action" strings and "payload" fields specified below.
- Provide dates/times in "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" (ISO-like) format. Use 'dueDate' for dashboard items (tasks, goals, etc.) and 'startDate'/'endDate' for calendar events.
- For updates/deletes, use the item's 'id' from the context if available. If not, use the 'title'/'task'/'goal' etc. field for lookup (less reliable).

**Available Actions & Payloads:**

1.  **Calendar Events (Stored in 'events' collection):**
    *   \`createEvent\`: \`{ "title": "...", "description": "...", "startDate": "YYYY-MM-DDTHH:mm", "endDate": "YYYY-MM-DDTHH:mm", "isAllDay": boolean, "color": "#hex" }\` (Defaults: isAllDay=false, color=#3B82F6)
    *   \`updateEvent\`: \`{ "id": "event_id", "title": "(optional new)", "description": "(optional)", "startDate": "(optional)", "endDate": "(optional)", "isAllDay": boolean, "color": "(optional)" }\`
    *   \`deleteEvent\`: \`{ "id": "event_id" }\`

2.  **Tasks (Stored in 'tasks' collection):**
    *   \`createTask\`: \`{ "task": "...", "description": "...", "dueDate": "YYYY-MM-DD", "priority": "low|medium|high" }\` (Defaults: priority=medium)
    *   \`updateTask\`: \`{ "id": "task_id" or "task": "name to find", "newTask": "(optional new name)", "description": "(optional)", "dueDate": "(optional)", "priority": "(optional)" }\`
    *   \`deleteTask\`: \`{ "id": "task_id" or "task": "name to find" }\`

3.  **Goals (Stored in 'goals' collection):**
    *   \`createGoal\`: \`{ "goal": "...", "description": "...", "dueDate": "YYYY-MM-DD", "priority": "low|medium|high" }\`
    *   \`updateGoal\`: \`{ "id": "goal_id" or "goal": "name", "newGoal": "(optional)", ... other fields ... }\`
    *   \`deleteGoal\`: \`{ "id": "goal_id" or "goal": "name" }\`

4.  **Projects (Stored in 'projects' collection):**
    *   \`createProject\`: \`{ "project": "...", "description": "...", "dueDate": "YYYY-MM-DD", "priority": "low|medium|high" }\`
    *   \`updateProject\`: \`{ "id": "proj_id" or "project": "name", "newProject": "(optional)", ... }\`
    *   \`deleteProject\`: \`{ "id": "proj_id" or "project": "name" }\`

5.  **Plans (Stored in 'plans' collection):**
    *   \`createPlan\`: \`{ "plan": "...", "description": "...", "dueDate": "YYYY-MM-DD", "priority": "low|medium|high" }\`
    *   \`updatePlan\`: \`{ "id": "plan_id" or "plan": "name", "newPlan": "(optional)", ... }\`
    *   \`deletePlan\`: \`{ "id": "plan_id" or "plan": "name" }\`

**Response Guidelines:**
- Be conversational and helpful.
- If performing an action, state it clearly *before* the JSON block (e.g., "Okay, adding that event:").
- Return ONLY the JSON block(s) if the user's request *only* implies actions. Do not add extra text *after* the JSON.
- If clarifying (e.g., "Which 'meeting' event did you mean?"), ask clearly and do *not* provide JSON.
- Base analysis and suggestions *only* on the provided context.
- Do not invent items or assume knowledge outside the context.

Assistant Response:`;


        let finalRawResponseText = "";
        let assistantResponseText = "";
        let actionJsonBlocks: string[] = [];

        try {
            const geminiOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    ],
                })
            };

            await streamResponse(geminiEndpoint, geminiOptions, (rawChunkAccumulated) => {
                finalRawResponseText = rawChunkAccumulated;
                const currentExtractedText = extractCandidateText(rawChunkAccumulated);
                setChatHistory(prev => prev.map(msg =>
                    msg.id === assistantMsgId ? { ...msg, content: currentExtractedText || "..." } : msg
                ));
            });

            assistantResponseText = extractCandidateText(finalRawResponseText).trim();
            actionJsonBlocks = extractJsonBlocks(assistantResponseText);

            if (actionJsonBlocks.length > 0) {
                actionJsonBlocks.forEach(block => {
                    assistantResponseText = assistantResponseText.replace(`\`\`\`json\n${block}\n\`\`\``, '').trim();
                     assistantResponseText = assistantResponseText.replace(`\`\`\`json${block}\`\`\``, '').trim();
                     assistantResponseText = assistantResponseText.replace(block, '').trim();
                });
                if (!assistantResponseText) {
                    assistantResponseText = "OK, I'll take care of that.";
                }
            }

            let actionErrorOccurred = false;
            for (const jsonBlock of actionJsonBlocks) {
                try {
                    const actionData = JSON.parse(jsonBlock) as AiAction;
                    if (!actionData.action || !actionData.payload) {
                        console.warn("Skipping invalid JSON action block:", jsonBlock);
                        continue;
                    }
                    actionData.payload.userId = user.uid;

                     switch (actionData.action) {
                        case 'createEvent':
                            {
                                const startDate = parseInputDateFlexible(actionData.payload.startDate, actionData.payload.isAllDay);
                                const endDate = parseInputDateFlexible(actionData.payload.endDate, actionData.payload.isAllDay);
                                if (!actionData.payload.title || !startDate || !endDate || endDate < startDate) throw new Error("Invalid payload for createEvent");
                                await createEvent({
                                    userId: user.uid,
                                    title: actionData.payload.title,
                                    description: actionData.payload.description || "",
                                    startDate: startDate,
                                    endDate: endDate,
                                    isAllDay: actionData.payload.isAllDay ?? false,
                                    color: actionData.payload.color
                                });
                            }
                            break;
                        case 'updateEvent':
                            {
                                if (!actionData.payload.id) throw new Error("Missing id for updateEvent");
                                const updates: Partial<CalendarEventData> = {};
                                if (actionData.payload.title) updates.title = actionData.payload.title;
                                if (actionData.payload.description) updates.description = actionData.payload.description;
                                const startDate = parseInputDateFlexible(actionData.payload.startDate, actionData.payload.isAllDay);
                                const endDate = parseInputDateFlexible(actionData.payload.endDate, actionData.payload.isAllDay);
                                if (startDate) updates.startDate = startDate;
                                if (endDate) updates.endDate = endDate;
                                if (startDate && endDate && endDate < startDate) throw new Error("End date cannot be before start date in updateEvent");
                                if (actionData.payload.hasOwnProperty('isAllDay')) updates.isAllDay = actionData.payload.isAllDay;
                                if (actionData.payload.color) updates.color = actionData.payload.color;
                                if (Object.keys(updates).length > 0) {
                                    await updateEvent(actionData.payload.id, updates);
                                } else { console.warn("No valid fields to update for event:", actionData.payload.id); }
                            }
                            break;
                        case 'deleteEvent':
                            if (!actionData.payload.id) throw new Error("Missing id for deleteEvent");
                            await deleteEvent(actionData.payload.id);
                            break;
                        case 'createTask':
                            {
                                const dueDate = parseInputDateFlexible(actionData.payload.dueDate, true);
                                if (!actionData.payload.task) throw new Error("Missing task field for createTask");
                                await createUserTask(user.uid, {
                                    task: actionData.payload.task,
                                    description: actionData.payload.description || "",
                                    dueDate: dueDate ?? undefined,
                                    priority: actionData.payload.priority || 'medium'
                                });
                            }
                            break;
                        case 'updateTask':
                           {
                                let taskId = actionData.payload.id;
                                if (!taskId && actionData.payload.task) {
                                     taskId = await findItemByName('tasks', user.uid, actionData.payload.task, 'task');
                                     if (!taskId) throw new Error(`Task named "${actionData.payload.task}" not found for update.`);
                                }
                                if (!taskId) throw new Error("Missing id or task name for updateTask");
                                const updates: any = {};
                                if (actionData.payload.newTask) updates.task = actionData.payload.newTask;
                                if (actionData.payload.description) updates.description = actionData.payload.description;
                                const dueDate = parseInputDateFlexible(actionData.payload.dueDate, true);
                                if (dueDate) updates.dueDate = dueDate;
                                if (actionData.payload.priority) updates.priority = actionData.payload.priority;
                                if (Object.keys(updates).length > 0) {
                                    await updateUserTask(taskId, updates);
                                } else { console.warn("No valid fields to update for task:", taskId); }
                           }
                            break;
                        case 'deleteTask':
                            {
                                let taskId = actionData.payload.id;
                                if (!taskId && actionData.payload.task) {
                                     taskId = await findItemByName('tasks', user.uid, actionData.payload.task, 'task');
                                      if (!taskId) throw new Error(`Task named "${actionData.payload.task}" not found for deletion.`);
                                }
                                if (!taskId) throw new Error("Missing id or task name for deleteTask");
                                await deleteUserTask(taskId);
                            }
                            break;
                        case 'createGoal':
                             if (!actionData.payload.goal) throw new Error("Missing goal field for createGoal");
                             await createUserGoal(user.uid, {
                                 goal: actionData.payload.goal,
                                 description: actionData.payload.description || "",
                                 dueDate: parseInputDateFlexible(actionData.payload.dueDate, true) ?? undefined,
                                 priority: actionData.payload.priority || 'medium'
                             });
                             break;
                        case 'updateGoal':
                            {
                                let goalId = actionData.payload.id;
                                if (!goalId && actionData.payload.goal) goalId = await findItemByName('goals', user.uid, actionData.payload.goal, 'goal');
                                if (!goalId) throw new Error("Missing id or goal name for updateGoal");
                                const updates: any = {};
                                if (actionData.payload.newGoal) updates.goal = actionData.payload.newGoal;
                                if (actionData.payload.description) updates.description = actionData.payload.description;
                                if (actionData.payload.dueDate) updates.dueDate = parseInputDateFlexible(actionData.payload.dueDate, true);
                                if (actionData.payload.priority) updates.priority = actionData.payload.priority;
                                if (Object.keys(updates).length > 0) await updateUserGoal(goalId, updates);
                            }
                            break;
                        case 'deleteGoal':
                            {
                                let goalId = actionData.payload.id;
                                if (!goalId && actionData.payload.goal) goalId = await findItemByName('goals', user.uid, actionData.payload.goal, 'goal');
                                if (!goalId) throw new Error("Missing id or goal name for deleteGoal");
                                await deleteUserGoal(goalId);
                            }
                            break;
                         case 'createProject':
                             if (!actionData.payload.project) throw new Error("Missing project field for createProject");
                             await createUserProject(user.uid, {
                                 project: actionData.payload.project,
                                 description: actionData.payload.description || "",
                                 dueDate: parseInputDateFlexible(actionData.payload.dueDate, true) ?? undefined,
                                 priority: actionData.payload.priority || 'medium'
                             });
                             break;
                         case 'updateProject':
                             {
                                let projId = actionData.payload.id;
                                if (!projId && actionData.payload.project) projId = await findItemByName('projects', user.uid, actionData.payload.project, 'project');
                                if (!projId) throw new Error("Missing id or project name for updateProject");
                                const updates: any = {};
                                if (actionData.payload.newProject) updates.project = actionData.payload.newProject;
                                if (actionData.payload.description) updates.description = actionData.payload.description;
                                if (actionData.payload.dueDate) updates.dueDate = parseInputDateFlexible(actionData.payload.dueDate, true);
                                if (actionData.payload.priority) updates.priority = actionData.payload.priority;
                                if (Object.keys(updates).length > 0) await updateUserProject(projId, updates);
                             }
                             break;
                         case 'deleteProject':
                             {
                                let projId = actionData.payload.id;
                                if (!projId && actionData.payload.project) projId = await findItemByName('projects', user.uid, actionData.payload.project, 'project');
                                if (!projId) throw new Error("Missing id or project name for deleteProject");
                                await deleteUserProject(projId);
                             }
                             break;
                         case 'createPlan':
                              if (!actionData.payload.plan) throw new Error("Missing plan field for createPlan");
                              await createUserPlan(user.uid, {
                                  plan: actionData.payload.plan,
                                  description: actionData.payload.description || "",
                                  dueDate: parseInputDateFlexible(actionData.payload.dueDate, true) ?? undefined,
                                  priority: actionData.payload.priority || 'medium'
                              });
                              break;
                         case 'updatePlan':
                             {
                                let planId = actionData.payload.id;
                                if (!planId && actionData.payload.plan) planId = await findItemByName('plans', user.uid, actionData.payload.plan, 'plan');
                                if (!planId) throw new Error("Missing id or plan name for updatePlan");
                                const updates: any = {};
                                if (actionData.payload.newPlan) updates.plan = actionData.payload.newPlan;
                                if (actionData.payload.description) updates.description = actionData.payload.description;
                                if (actionData.payload.dueDate) updates.dueDate = parseInputDateFlexible(actionData.payload.dueDate, true);
                                if (actionData.payload.priority) updates.priority = actionData.payload.priority;
                                if (Object.keys(updates).length > 0) await updateUserPlan(planId, updates);
                             }
                             break;
                         case 'deletePlan':
                             {
                                let planId = actionData.payload.id;
                                if (!planId && actionData.payload.plan) planId = await findItemByName('plans', user.uid, actionData.payload.plan, 'plan');
                                if (!planId) throw new Error("Missing id or plan name for deletePlan");
                                await deleteUserPlan(planId);
                             }
                             break;
                        default:
                            console.warn("Unknown AI action:", actionData.action);
                    }
                 } catch (err: any) {
                    actionErrorOccurred = true;
                    console.error(`Error executing AI action (${(err as Error).message}):`, jsonBlock, err);
                     setChatHistory(prev => [...prev, {
                        id: `err-${Date.now()}`, role: 'assistant', content: `Sorry, I couldn't perform the action: ${(err as Error).message}`, error: true
                     }]);
                }
            }

            setChatHistory(prev => prev.map(msg => {
                 if (msg.id === assistantMsgId) {
                     const finalContent = assistantResponseText || (actionJsonBlocks.length > 0 ? "Action completed." : "Sorry, I couldn't process that request.");
                     const isError = !finalRawResponseText || finalRawResponseText.startsWith("Error:") || actionErrorOccurred;
                     return { ...msg, content: finalContent, error: isError };
                 }
                 return msg;
             }));
        } catch (err: any) {
            console.error('Calendar Chat Submit Error:', err);
            setChatHistory(prev => prev.map(msg =>
                 msg.id === assistantMsgId ? { ...msg, content: `Sorry, I encountered an error: ${err.message || 'Please try again.'}`, error: true } : msg
            ));
        } finally {
            setIsChatLoading(false);
        }
    };


  // ---------------------------
  //   Styling Variables
  // ---------------------------
  const containerClass = isIlluminateEnabled ? "bg-gray-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/70 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50" : "bg-gray-800 text-gray-300 border border-gray-700/50";
  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const borderColor = isIlluminateEnabled ? "border-gray-200/70" : "border-gray-700/60";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/50 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" : "bg-gray-700 hover:bg-gray-600/50 border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50";
  const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
  const modalClass = isIlluminateEnabled ? "bg-white text-gray-900" : "bg-gray-800 text-gray-200";
  const buttonPrimaryClass = "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed";
  const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-gray-700 text-gray-300 hover:bg-gray-600";
  const buttonDangerClass = isIlluminateEnabled ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-red-900/50 text-red-300 hover:bg-red-800/60";
  const dayCellBaseClass = `relative transition-colors duration-150 overflow-hidden border ${borderColor}`;
  const dayCellMonthViewClass = "min-h-[90px] sm:min-h-[110px] md:min-h-[120px] lg:min-h-[130px] p-1 md:p-1.5";
  const dayCellWeekViewClass = "min-h-[250px] sm:min-h-[350px] md:min-h-[450px] lg:min-h-[550px] p-1 md:p-1.5";
  const dayCellHoverBg = isIlluminateEnabled ? "hover:bg-gray-100/50" : "hover:bg-gray-700/20";
  const illuminateTextBlue = isIlluminateEnabled ? "text-blue-700" : "text-blue-400";


  // ---------------------------
  //   Main Render
  // ---------------------------
  const monthGridDays = getMonthGridDays(currentDate);
  const currentWeekDates = getWeekDates(currentDate);

  if (loading && !user) { // Show full page loader only if truly loading initial auth state
    return (
        <div className={`flex items-center justify-center h-screen ${containerClass}`}>
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
    );
  }

  return (
    <div className={`flex h-screen ${containerClass} font-sans overflow-hidden`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        userName={userName}
        isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled}
        isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled}
      />

        <button
            onClick={() => setIsAiSidebarOpen(true)}
            className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${
            isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'
            } z-40 p-2.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${
            isIlluminateEnabled
                ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100'
                : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
            } ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            title="Open Scheduling Assistant"
            aria-label="Open Scheduling Assistant AI Chat"
        >
            <BrainCircuit className="w-5 h-5" />
        </button>

      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-64"} ml-0`}>
        <header className={`p-3 md:p-4 border-b ${borderColor} flex-shrink-0`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-4">
                <h1 className={`text-lg sm:text-xl md:text-2xl font-bold ${headingClass} whitespace-nowrap truncate`}>
                    {calendarView === "month" ? format(currentDate, "MMMM yyyy") : (
                       <>
                           {format(startOfWeek(currentDate), 'MMM d')} - {format(endOfWeek(currentDate), 'MMM d, yyyy')}
                       </>
                    )}
                </h1>
                <div className="flex items-center gap-1">
                    <button onClick={handlePrev} className={`p-1.5 rounded ${iconColor} hover:bg-gray-500/10`} title="Previous Period">
                    <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={handleToday} className={`px-2 py-1 rounded text-xs ${buttonSecondaryClass} transition-colors`} title="Go to Today">
                    Today
                    </button>
                    <button onClick={handleNext} className={`p-1.5 rounded ${iconColor} hover:bg-gray-500/10`} title="Next Period">
                    <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
                    <div className={`${buttonSecondaryClass} p-0.5 rounded-full flex text-xs font-medium`}>
                        <button
                            onClick={() => handleViewChange('month')}
                            className={`px-2.5 py-0.5 rounded-full transition-colors duration-150 ${calendarView === 'month' ? (isIlluminateEnabled ? 'bg-white shadow-sm text-blue-600' : 'bg-gray-600 shadow-sm text-white') : 'hover:bg-gray-500/10'}`}
                        > Month </button>
                        <button
                            onClick={() => handleViewChange('week')}
                            className={`px-2.5 py-0.5 rounded-full transition-colors duration-150 ${calendarView === 'week' ? (isIlluminateEnabled ? 'bg-white shadow-sm text-blue-600' : 'bg-gray-600 shadow-sm text-white') : 'hover:bg-gray-500/10'}`}
                        > Week </button>
                    </div>

                <button
                    onClick={() => handleDateClick(new Date())}
                    className={`flex items-center gap-1 px-3 py-1.5 ${buttonPrimaryClass} rounded-full text-xs sm:text-sm shadow-sm transform hover:scale-105 active:scale-100`}
                >
                    <Plus className="w-3.5 h-3.5" />
                    New
                </button>
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-auto p-1.5 md:p-2 lg:p-3 relative">
           { loading && // Show a smaller loader if loading data after auth check
                <div className="absolute inset-0 flex items-center justify-center bg-opacity-50 z-20" style={{ backgroundColor: isIlluminateEnabled ? 'rgba(249, 250, 251, 0.5)' : 'rgba(17, 24, 39, 0.5)'}}>
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
           }
            <div className="grid grid-cols-7 gap-1 md:gap-2 lg:gap-3 sticky top-0 z-10 py-1.5 backdrop-blur-sm mb-1"
                 style={{ backgroundColor: isIlluminateEnabled ? 'rgba(249, 250, 251, 0.8)' : 'rgba(17, 24, 39, 0.8)'}}>
                {getWeekDates(currentDate).map(day => (
                    <div key={getDay(day)} className={`text-center text-xs font-semibold ${subheadingClass} ${isSameDay(day, new Date()) ? (isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400') : ''}`}>
                        {format(day, 'EEE')}
                         <span className={`ml-1 ${isMobile ? 'hidden' : 'inline'}`}>{format(day, 'd')}</span>
                    </div>
                ))}
            </div>

          {calendarView === 'month' && (
            <div className="grid grid-cols-7 grid-rows-6 gap-px">
              {monthGridDays.map((day) => {
                const dayItems = getItemsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                 const cellBg = isToday
                    ? (isIlluminateEnabled ? 'bg-blue-50/70' : 'bg-blue-900/20')
                    : (isIlluminateEnabled ? 'bg-white' : 'bg-gray-800/20');

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={`${dayCellBaseClass} ${dayCellMonthViewClass} ${cellBg} ${!isCurrentMonth ? 'bg-opacity-60 opacity-60' : ''} ${dayCellHoverBg} cursor-pointer flex flex-col group`}
                  >
                    <span className={`text-xs font-medium mb-1 self-end p-0.5 ${isToday ? `bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center` : (isCurrentMonth ? headingClass : subheadingClass)}`}>
                      {format(day, "d")}
                    </span>
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                        {dayItems.slice(0, isMobile ? 1 : 3).map((item) => (
                           <button
                                key={item.id}
                                onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                title={item.title}
                                className={`w-full text-left px-1 py-0.5 rounded text-[10px] md:text-[11px] flex items-center gap-1 truncate transition-colors duration-150 ${item.status === 'completed' ? 'line-through opacity-60' : ''}`}
                                style={{
                                    backgroundColor: `${item.color || getDefaultColor(item.type)}1A`,
                                    color: isIlluminateEnabled ? darkenColor(item.color || getDefaultColor(item.type), 20) : lightenColor(item.color || getDefaultColor(item.type), 30),
                                    borderLeft: `2px solid ${item.color || getDefaultColor(item.type)}`
                                }}
                                >
                                {getTypeIcon(item.type)}
                                <span className="truncate flex-grow font-medium">{item.title}</span>
                                {item.priority === 'high' && !item.isAllDay && (
                                    <PriorityBadge priority={item.priority} isIlluminateEnabled={isIlluminateEnabled} compact className="ml-auto flex-shrink-0 scale-[65%]" />
                                )}
                            </button>
                        ))}
                        {dayItems.length > (isMobile ? 1 : 3) && (
                            <div className={`text-[9px] text-center ${subheadingClass} mt-0.5`}>
                            +{dayItems.length - (isMobile ? 1 : 3)} more
                            </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {calendarView === 'week' && (
             <div className="grid grid-cols-7 gap-px">
                 {currentWeekDates.map((day) => {
                     const dayItems = getItemsForDay(day);
                     const isToday = isSameDay(day, new Date());
                     const cellBg = isToday ? (isIlluminateEnabled ? 'bg-blue-50/70' : 'bg-blue-900/20') : (isIlluminateEnabled ? 'bg-white' : 'bg-gray-800/20');

                     return (
                         <div
                            key={day.toISOString()}
                            onClick={() => handleDateClick(day)}
                            className={`${dayCellBaseClass} ${dayCellWeekViewClass} ${cellBg} ${dayCellHoverBg} cursor-pointer flex flex-col`}
                         >
                             <div className="flex-1 space-y-1 overflow-auto p-1 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent">
                                {dayItems.length === 0 && (
                                     <div className={`text-xs text-center italic ${subheadingClass} mt-4`}>No items</div>
                                 )}
                                {dayItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                        title={`${item.title}\n${item.isAllDay ? 'All Day' : format(item.startDate, 'h:mm a') + (isSameDay(item.startDate, item.endDate) ? '' : ' (' + format(item.startDate, 'MMM d') + ')') + ' - ' + format(item.endDate, 'h:mm a') + (isSameDay(item.startDate, item.endDate) ? '' : ' (' + format(item.endDate, 'MMM d') + ')')}`}
                                        className={`w-full text-left px-1.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors duration-150 ${item.status === 'completed' ? 'line-through opacity-60' : ''} ${item.isAllDay ? 'my-0.5 font-semibold' : ''}`}
                                        style={{
                                            backgroundColor: `${item.color || getDefaultColor(item.type)}1A`,
                                            color: isIlluminateEnabled ? darkenColor(item.color || getDefaultColor(item.type), 20) : lightenColor(item.color || getDefaultColor(item.type), 30),
                                            borderLeft: `2px solid ${item.color || getDefaultColor(item.type)}`
                                        }}
                                    >
                                        {getTypeIcon(item.type)}
                                        <div className="flex-grow truncate">
                                            <span>{item.title}</span>
                                             {!item.isAllDay && (
                                                 <span className={`ml-1 text-[10px] opacity-80`}>
                                                     {format(item.startDate, 'h:mma')}
                                                 </span>
                                             )}
                                        </div>
                                         {item.priority === 'high' && (
                                             <PriorityBadge priority={item.priority} isIlluminateEnabled={isIlluminateEnabled} compact className="ml-auto flex-shrink-0 scale-[65%]" />
                                         )}
                                    </button>
                                ))}
                             </div>
                         </div>
                     );
                 })}
             </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className={`${modalClass} rounded-xl shadow-2xl p-5 md:p-6 max-w-lg w-full mx-auto max-h-[90vh] flex flex-col`}>
               <div className="flex items-center justify-between mb-4 pb-3 border-b ${borderColor} flex-shrink-0">
                 <div className="flex items-center gap-2">
                     <span className="p-1.5 rounded-full" style={{ backgroundColor: `${itemForm.color || getDefaultColor(itemForm.type)}20`}}>
                         {getTypeIcon(itemForm.type)}
                     </span>
                     <h3 className={`text-lg font-semibold ${headingClass}`}>
                         {selectedItem ? "Edit Item" : "New Calendar Event"}
                     </h3>
                 </div>
                <button onClick={handleModalClose} className={`p-1.5 rounded-full ${iconColor} hover:bg-gray-500/10`} aria-label="Close modal">
                  <X className="w-5 h-5" />
                </button>
              </div>

               <div className="space-y-4 overflow-y-auto flex-grow pr-1 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent">
                 <div>
                   <label htmlFor="itemTitle" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Title</label>
                   <input
                     id="itemTitle"
                     type="text"
                     value={itemForm.title}
                     onChange={(e) => handleFormChange('title', e.target.value)}
                     className={`w-full ${inputBg} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 border ${borderColor}`}
                     placeholder={ `Enter ${itemForm.originalCollection ? itemForm.type : 'event'} title`}
                   />
                 </div>

                 <div className="flex items-center gap-2 justify-between pt-2">
                   <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Time</span>
                   <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400">
                      All-day
                     <input
                       type="checkbox"
                       checked={itemForm.isAllDay}
                       onChange={(e) => handleFormChange('isAllDay', e.target.checked)}
                       className="form-checkbox h-4 w-4 text-blue-500 rounded focus:ring-blue-400 border-gray-400 dark:border-gray-600 bg-transparent dark:checked:bg-blue-500"
                     />
                   </label>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div>
                     <label htmlFor="startDate" className="sr-only">Start Date/Time</label>
                     <input
                       id="startDate"
                       type={itemForm.isAllDay ? "date" : "datetime-local"}
                       value={formatDateForInput(itemForm.startDate, itemForm.isAllDay)}
                       onChange={(e) => handleFormChange('startDate', e.target.value)}
                       className={`w-full ${inputBg} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 border ${borderColor}`}
                       style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }}
                     />
                   </div>
                   <div>
                      <label htmlFor="endDate" className="sr-only">End Date/Time</label>
                     <input
                       id="endDate"
                       type={itemForm.isAllDay ? "date" : "datetime-local"}
                       value={formatDateForInput(itemForm.endDate, itemForm.isAllDay)}
                       min={formatDateForInput(itemForm.startDate, itemForm.isAllDay)}
                       onChange={(e) => handleFormChange('endDate', e.target.value)}
                       className={`w-full ${inputBg} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 border ${borderColor}`}
                       style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }}
                     />
                   </div>
                 </div>

                  {itemForm.originalCollection && itemForm.type !== 'event' && (
                      <div>
                          <label htmlFor="itemPriority" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Priority</label>
                          <select
                              id="itemPriority"
                              value={itemForm.priority}
                              onChange={(e) => handleFormChange('priority', e.target.value as typeof itemForm.priority)}
                              className={`w-full ${inputBg} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 border ${borderColor} appearance-none bg-no-repeat bg-right`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.2em 1.2em' }}
                          >
                              <option value="high">High 🔥</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low 🧊</option>
                          </select>
                      </div>
                  )}

                 <div>
                   <label htmlFor="itemDescription" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Description</label>
                   <textarea
                     id="itemDescription"
                     value={itemForm.description}
                     onChange={(e) => handleFormChange('description', e.target.value)}
                     className={`w-full ${inputBg} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-500 border ${borderColor}`}
                     placeholder="Add notes or details..."
                     rows={3}
                   />
                 </div>

                 {itemForm.type === 'event' && !itemForm.originalCollection && (
                      <div>
                          <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Color Tag</label>
                          <div className="flex flex-wrap gap-2">
                             {["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"].map((color) => (
                             <button
                                 key={color}
                                 onClick={() => handleFormChange('color', color)}
                                 className={`w-6 h-6 rounded-full transition-transform transform border-2 ${itemForm.color === color ? `scale-110 ring-2 ring-offset-2 ${isIlluminateEnabled ? 'ring-offset-white' : 'ring-offset-gray-800'} ring-current` : 'border-transparent hover:scale-110'}`}
                                 style={{ backgroundColor: color, color: color }}
                                 aria-label={`Select color ${color}`}
                             />
                             ))}
                          </div>
                      </div>
                 )}

               </div>

                <div className="flex flex-wrap justify-between items-center mt-5 pt-4 border-t ${borderColor} flex-shrink-0 gap-2">
                 <div>
                    {selectedItem && (
                        <button onClick={handleDeleteItem} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm ${buttonDangerClass} flex items-center gap-1`}>
                            <Trash className="w-3.5 h-3.5" /> Delete
                        </button>
                    )}
                 </div>
                 <div className="flex gap-2">
                    <button onClick={handleModalClose} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm ${buttonSecondaryClass}`}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveItem}
                        disabled={!itemForm.title.trim() || !isValid(itemForm.startDate) || !isValid(itemForm.endDate)}
                        className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm ${buttonPrimaryClass}`}
                    >
                        {selectedItem ? "Save Changes" : "Create Event"}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}

            <div
                aria-hidden={!isAiSidebarOpen}
                className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${
                isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                } ${cardClass} flex flex-col shadow-2xl border-l ${borderColor}`}
                role="complementary"
                aria-labelledby="ai-calendar-sidebar-title"
            >
                <div className={`p-3 sm:p-4 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
                    <h3 id="ai-calendar-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}>
                        <BrainCircuit className="w-5 h-5" />
                        Scheduling Assistant
                    </h3>
                     <div className="flex items-center">
                        <button
                            onClick={() => setIsContextDialogOpen(true)}
                            className={`${iconColor} p-1 mr-1 rounded-full hover:bg-gray-500/10 transition-colors`}
                            title="Set AI Context" aria-label="Set AI Context" >
                            <Brain className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsAiSidebarOpen(false)}
                            className={`${iconColor} p-1 rounded-full hover:bg-gray-500/10 transition-colors transform hover:scale-110 active:scale-100`}
                            title="Close Chat" aria-label="Close AI Chat Sidebar" >
                            <X className="w-5 h-5" />
                        </button>
                     </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent" ref={chatEndRef}>
                    {chatHistory.map((message, index) => (
                        <div key={message.id || index} className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' } animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }} >
                            <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${ message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50') }`} >
                                {message.content && message.content !== "..." ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]}
                                        rehypePlugins={[rehypeKatex]}
                                        className={`prose prose-sm max-w-none ${isIlluminateEnabled ? 'prose-gray dark:prose-invert' : 'prose-invert'} text-current prose-p:my-1 prose-ul:my-1 prose-ol:my-1`}
                                        components={{}} >
                                        {message.content}
                                    </ReactMarkdown>
                                ) : ( index === chatHistory.length - 1 && message.content === "...") ? (
                                    <div className="flex space-x-1 p-1"> <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-60"></div> <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-60"></div> <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-60"></div> </div>
                                ) : null }
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`p-2 sm:p-3 border-t ${borderColor} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm`}>
                    {userTier !== 'premium' && userTier !== 'loading' && (
                        <div className="pb-1.5 text-xs text-center">
                            <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>
                                Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? 'Unlimited' : currentChatLimit}
                            </span>
                            {isChatLimitReached && !isLoadingUsage && (
                                <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>
                            )}
                         {!isChatLimitReached && userTier === 'basic' && ( // Show upgrade only if basic and not limit reached
                              <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}>
                                 <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade
                             </Link>
                         )}
                     </div>
                 )}
                    <form onSubmit={handleCalendarChatSubmit} >
                        <div className="flex gap-1.5 items-center">
                            <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder={isChatLimitReached ? "Monthly limit reached..." : "Add event, update task..."}
                                className={`flex-1 ${inputBg} border ${borderColor} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 ${isChatLimitReached || isLoadingUsage || isChatLoading || userTier === 'loading' ? 'cursor-not-allowed' : ''}`}
                                disabled={isChatLoading || isChatLimitReached || isLoadingUsage || userTier === 'loading'}
                                aria-label="Chat input"
                            />
                            <button
                                type="submit"
                                disabled={isChatLoading || isLoadingUsage || !chatMessage.trim() || isChatLimitReached || userTier === 'loading'}
                                className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached || isLoadingUsage || isChatLoading || userTier === 'loading' ? 'cursor-not-allowed' : ''}`}
                                title="Send Message"
                                aria-label="Send chat message" >
                                {isChatLoading || userTier === 'loading' ? ( <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ) : ( <Send className="w-4 h-4" /> )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ContextDialog
                isOpen={isContextDialogOpen}
                onClose={() => setIsContextDialogOpen(false)}
                onSave={handleSaveContext}
                initialContext={userContext}
                isBlackoutEnabled={isBlackoutEnabled}
                isIlluminateEnabled={isIlluminateEnabled}
            />

      </main>
    </div>
  );
}

// --- Color Utility Functions ---
function darkenColor(hex: string, percent: number): string {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function lightenColor(hex: string, percent: number): string {
    hex = hex.replace(/^#/, '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.min(255, Math.floor(r * (1 + percent / 100)));
    g = Math.min(255, Math.floor(g * (1 + percent / 100)));
    b = Math.min(255, Math.floor(b * (1 + percent / 100)));
     return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default Calendar;
