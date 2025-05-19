/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, PlusCircle, Edit, Trash, CheckCircle, MessageCircle, BrainCircuit, Crown, RotateCcw, X, TimerIcon, Send, Settings2, SkipForward, Zap, Link2, StickyNote, History, Volume2, VolumeX, Maximize2, Brain, Coffee, Smile, Meh, Frown, TrendingUp, BookOpen, Award, Headphones, Wind, SunDim, Star as StarIcon
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  onFirebaseAuthStateChanged,
  updateDashboardLastSeen,
  geminiApiKey,
  onCustomTimersSnapshot,
  addCustomTimer,
  updateCustomTimer,
  deleteCustomTimer,
  // hfApiKey, // Removed as it's not used in this component
} from '../lib/dashboard-firebase';

// Corrected import path for current-paying-user utilities
import {
     type UserTier,
  getUserTier,
  getChatLimitForTier,
  BASIC_CHAT_LIMIT,
  getCurrentMonthUserChatUsage,
  incrementUserChatUsage,
} from '../lib/current-paying-user';


import {
  createFocusSession,
  updateFocusSession,
  onUserFocusSessionsSnapshot,
  getAllUserProductivityItems,
  addNoteToFocusSession,
  type FocusSessionData,
  type CreatePomodoroSessionInput,
  type CreateCustomTimerSessionInput,
  savePostSessionFeedback,
  updateSessionAmbientSound,
  onUserTotalXpSnapshot,
  calculateXpForSession, // Ensure this is exported if used locally for display, or handle in backend
  updateUserTotalXp,    // Ensure this is exported if used directly
} from '../lib/focus-mode-firebase';

import {
  createChatConversation,
  saveChatMessage,
  onChatMessagesSnapshot,
  onChatConversationsSnapshot,
  updateChatConversationName,
  deleteChatConversation,
  type ChatMessage as FirebaseChatMessage,
} from '../lib/ai-chat-firebase';

import { auth } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { ContextDialog } from './context-dialog';
import { saveUserContext, onUserContextChange, type UserContext } from '../lib/ai-context-firebase';


const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_TEXT_MODEL = 'gemini-1.5-flash-latest';

interface ChatMessageDisplayData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
  error?: boolean;
  actionDetails?: { status: 'success' | 'error'; message?: string };
  localPlaceholderId?: string;
}

interface CustomTimer { id: string; data: { name: string; time: number; userId: string; createdAt: any; } }
interface LinkableProductivityItem { id: string; name: string; type: string; collection: 'tasks'|'goals'|'projects'|'plans'; }

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECONDS = 5 * 60;
const DEFAULT_LONG_BREAK_SECONDS = 15 * 60;
const DEFAULT_CYCLES_GOAL = 4;

const AMBIENT_SOUNDS = [
    { id: 'none', name: 'None', src: '' },
    { id: 'whitenoise', name: 'White Noise', src: '/sounds/white_noise.mp3' },
    { id: 'rain', name: 'Rain', src: '/sounds/rain.mp3' },
    { id: 'cafe', name: 'Cafe Ambience', src: '/sounds/cafe.mp3' },
    { id: 'lofi', name: 'Lofi Beats (Example)', src: '/sounds/lofi_sample.mp3' },
];

const MINDFUL_BREAK_SUGGESTIONS = [
    "Take 5 deep breaths: inhale for 4s, hold 4s, exhale 6s.",
    "Stretch your neck, shoulders, and back gently.",
    "Look away from your screen and focus on something 20 feet away for 20 seconds.",
    "Stand up and walk around for a minute.",
    "Sip some water and rehydrate.",
    "Think of one thing you're grateful for right now.",
    "Close your eyes and just listen to your surroundings for 30 seconds.",
    "Do a quick body scan, noticing any tension and releasing it.",
];

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

const parseGeminiApiResponseText = (responseText: string): { text: string | null; error: string | null; finishReason: string | null } => {
    let textContent: string | null = null;
    let errorMessage: string | null = null;
    let reason: string | null = null;
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            if(jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
            return { text: null, error: errorMessage, finishReason: 'BLOCKED' };
        }
        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;
            if (candidate.content?.parts?.[0]?.text) {
                textContent = candidate.content.parts[0].text;
            }
             if (!textContent && !errorMessage) {
                 if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`;}}
                 else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
                 else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
                 else if (!candidate.content) { errorMessage = "Received an empty response candidate."; }
             }
        } else if (jsonResponse?.error?.message) {
             errorMessage = `API Error: ${jsonResponse.error.message}`;
        } else { errorMessage = "Sorry, I received an empty or non-standard response format."; }
        
        if (!textContent && !errorMessage) { 
             textContent = ""; 
        }
        return { text: textContent, error: errorMessage, finishReason: reason };
    } catch (err) {
        console.error("Error parsing Gemini API response:", responseText, err);
        return { text: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null };
    }
};

function extractJsonBlocks(text: string): { blocks: any[], cleanedText: string } {
  const extractedBlocks: any[] = [];
  let remainingText = text;
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsedJson = JSON.parse(match[1]);
      extractedBlocks.push(parsedJson);
      remainingText = remainingText.replace(match[0], "").trim();
    } catch (e) { /* ignore parsing error, keep text */ }
  }
  return { blocks: extractedBlocks, cleanedText: remainingText.trim() };
}


export function FocusMode() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("Loading...");
  const truncatedName = useMemo(() => userName.split(' ')[0] || userName, [userName]);
  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [totalUserXp, setTotalUserXp] = useState(0);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeSession, setActiveSession] = useState<FocusSessionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_SECONDS);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [pomodoroWorkSetting, setPomodoroWorkSetting] = useState(DEFAULT_WORK_SECONDS);
  const [pomodoroShortBreakSetting, setPomodoroShortBreakSetting] = useState(DEFAULT_SHORT_BREAK_SECONDS);
  const [pomodoroLongBreakSetting, setPomodoroLongBreakSetting] = useState(DEFAULT_LONG_BREAK_SECONDS);
  const [pomodoroCyclesGoalSetting, setPomodoroCyclesGoalSetting] = useState(DEFAULT_CYCLES_GOAL);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [customTimers, setCustomTimers] = useState<CustomTimer[]>([]);
  const [showCustomTimerModal, setShowCustomTimerModal] = useState(false);
  const [editingCustomTimer, setEditingCustomTimer] = useState<CustomTimer | null>(null);
  const [newCustomTimerName, setNewCustomTimerName] = useState("");
  const [newCustomTimerDuration, setNewCustomTimerDuration] = useState(25);

  const [userProductivityItems, setUserProductivityItems] = useState<LinkableProductivityItem[]>([]);
  const [selectedLinkedItemId, setSelectedLinkedItemId] = useState<string | null>(null);

  const [focusHistory, setFocusHistory] = useState<FocusSessionData[]>([]);

  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionGoalText, setSessionGoalText] = useState("");

  const [showPreFocusModal, setShowPreFocusModal] = useState(false);
  const [preFocusMood, setPreFocusMood] = useState<'good' | 'okay' | 'bad' | null>(null);
  const [preFocusEnergy, setPreFocusEnergy] = useState<number>(3);

  const [showPostSessionModal, setShowPostSessionModal] = useState(false);
  const [completedSessionForFeedback, setCompletedSessionForFeedback] = useState<FocusSessionData | null>(null);
  const [postSessionProductivity, setPostSessionProductivity] = useState<number>(3);
  const [postSessionReflection, setPostSessionReflection] = useState("");
  const [postSessionGoalAchieved, setPostSessionGoalAchieved] = useState<boolean | null>(null);
  
  const [selectedAmbientSound, setSelectedAmbientSound] = useState<FocusSessionData['ambientSound']>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.5);

  const [currentMindfulSuggestion, setCurrentMindfulSuggestion] = useState("");

  const [aiChatSidebarTab, setAiChatSidebarTab] = useState<'chat' | 'history'>('chat');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessageDisplayData[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [chatUsageCount, setChatUsageCount] = useState(0);
  const [chatLimit, setChatLimit] = useState(BASIC_CHAT_LIMIT);
  const [isChatDisabledByLimit, setIsChatDisabledByLimit] = useState(false);
  const [currentChatLimitDisplay, setCurrentChatLimitDisplay] = useState<number | string>(BASIC_CHAT_LIMIT);
  const [hasGeneratedChatName, setHasGeneratedChatName] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User";
        setUserName(name);
        updateDashboardLastSeen(firebaseUser.uid);

        // Pass both userId and email to getUserTier
        const tier = await getUserTier(firebaseUser.uid, firebaseUser.email); 
        setUserTier(tier);
        const limit = getChatLimitForTier(tier);
        setChatLimit(limit);
        setCurrentChatLimitDisplay(limit === Infinity ? '∞' : limit);

        if (tier !== 'premium') {
          const usage = await getCurrentMonthUserChatUsage(firebaseUser.uid, new Date().toISOString().slice(0,7));
          setChatUsageCount(usage?.count || 0);
          setIsChatDisabledByLimit((usage?.count || 0) >= limit && limit !== Infinity);
        } else {
          setChatUsageCount(0); setIsChatDisabledByLimit(false);
        }

        onCustomTimersSnapshot(firebaseUser.uid, setCustomTimers);
        getAllUserProductivityItems(firebaseUser.uid).then(setUserProductivityItems);
        onUserFocusSessionsSnapshot(firebaseUser.uid, (sessions) => {
          const currentActive = sessions.find(s => ['running', 'paused', 'break_running', 'break_paused'].includes(s.status)) || null;
          setActiveSession(currentActive);
          setFocusHistory(sessions.filter(s => ['completed', 'cancelled'].includes(s.status)));
          if (currentActive?.ambientSound) {
            setSelectedAmbientSound(currentActive.ambientSound);
            if (audioRef.current && currentActive.ambientSound.src) setIsSoundPlaying(true);
          } else {
            setSelectedAmbientSound(null);
            setIsSoundPlaying(false);
          }
        }, { includeCompleted: true, includeCancelled: true });
        onChatConversationsSnapshot(firebaseUser.uid, (conversations) => setConversationList(conversations.map(c=> ({...c, key:c.id}))));
        onUserContextChange(firebaseUser.uid, setUserContext);
        onUserTotalXpSnapshot(firebaseUser.uid, setTotalUserXp);

      } else {
        navigate('/login');
        setActiveSession(null); setCustomTimers([]); setUserProductivityItems([]); setFocusHistory([]);
        setConversationId(null); setConversationList([]); setChatHistory([]); setTotalUserXp(0);
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (activeSession) {
        setSessionNotes(activeSession.notes || "");
        setSelectedLinkedItemId(activeSession.linkedItemId || null);
        setSessionGoalText(activeSession.sessionGoalText || "");
        
        if (activeSession.ambientSound) {
            setSelectedAmbientSound(activeSession.ambientSound);
            if(audioRef.current && activeSession.ambientSound.src) setIsSoundPlaying(true);
        } else {
            setSelectedAmbientSound(null);
            setIsSoundPlaying(false);
        }

        let durationForCurrentPhase = 0;
        let accumulatedTimeInPhase = 0;

        if (activeSession.status === 'running' || activeSession.status === 'paused') {
            durationForCurrentPhase = activeSession.type === 'pomodoro' 
                ? (activeSession.pomodoroWorkSeconds ?? pomodoroWorkSetting) 
                : (activeSession.plannedDurationSeconds ?? DEFAULT_WORK_SECONDS);
            accumulatedTimeInPhase = activeSession.accumulatedFocusSeconds ?? 0;
        } else if (activeSession.status === 'break_running' || activeSession.status === 'break_paused') {
            durationForCurrentPhase = activeSession.isLongBreakNext 
                ? (activeSession.pomodoroLongBreakSeconds ?? pomodoroLongBreakSetting)
                : (activeSession.pomodoroShortBreakSeconds ?? pomodoroShortBreakSetting);
            accumulatedTimeInPhase = activeSession.accumulatedBreakSeconds ?? 0;
        }

        if (activeSession.status === 'running' || activeSession.status === 'break_running') {
            const timeElapsedInCurrentSegment = activeSession.startTime ? (Timestamp.now().seconds - activeSession.startTime.seconds) : 0;
            const remainingTimeForPhase = durationForCurrentPhase - accumulatedTimeInPhase; // Total remaining for this phase type before this segment
            const uiTimeLeft = remainingTimeForPhase - timeElapsedInCurrentSegment; // Subtract current segment's progress
            setTimeLeft(Math.max(0, uiTimeLeft));
            startUiTimer();
        } else if (activeSession.status === 'paused' || activeSession.status === 'break_paused') {
            setTimeLeft(Math.max(0, durationForCurrentPhase - accumulatedTimeInPhase));
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        } else { 
            setTimeLeft(activeSession.type === 'pomodoro' ? (activeSession.pomodoroWorkSeconds ?? pomodoroWorkSetting) : (activeSession.plannedDurationSeconds ?? DEFAULT_WORK_SECONDS));
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    } else { 
        setTimeLeft(pomodoroWorkSetting); 
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    if (activeSession && (activeSession.status === 'break_running' || activeSession.status === 'break_paused')) {
        if (!currentMindfulSuggestion || activeSession.pauseTime) {
             setCurrentMindfulSuggestion(MINDFUL_BREAK_SUGGESTIONS[Math.floor(Math.random() * MINDFUL_BREAK_SUGGESTIONS.length)]);
        }
    } else {
        setCurrentMindfulSuggestion("");
    }

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [activeSession, pomodoroWorkSetting, pomodoroShortBreakSetting, pomodoroLongBreakSetting]);


  const startUiTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimerEnd = async () => {
    if (!activeSession || !user) return;
    
    const notificationSoundPath = '/sounds/timer_end_pling.mp3';
    const notificationSound = new Audio(notificationSoundPath); 
    notificationSound.play().catch(e => console.warn("Audio play failed for timer_end:", e, "Path:", notificationSoundPath));


    let updates: Partial<FocusSessionData> = {};
    const now = Timestamp.now();
    const timeJustFocusedOrBreaked = activeSession.startTime ? Math.max(0, now.seconds - activeSession.startTime.seconds) : 0;

    let currentPhaseDuration = 0;
    if (activeSession.status === 'running') {
        currentPhaseDuration = activeSession.type === 'pomodoro' 
            ? (activeSession.pomodoroWorkSeconds ?? pomodoroWorkSetting) 
            : (activeSession.plannedDurationSeconds ?? DEFAULT_WORK_SECONDS);
        updates.accumulatedFocusSeconds = (activeSession.accumulatedFocusSeconds || 0) + currentPhaseDuration; // Add full phase duration
        
        if (activeSession.type === 'pomodoro') {
            updates.status = 'break_running';
            updates.startTime = now;
            const isLong = (activeSession.currentCycle || 0) % (activeSession.pomodoroCyclesGoal || DEFAULT_CYCLES_GOAL) === 0 && (activeSession.currentCycle || 0) > 0;
            updates.isLongBreakNext = isLong;
        } else { 
            updates.status = 'completed';
            updates.endTime = now;
            setCompletedSessionForFeedback({...activeSession, accumulatedFocusSeconds: updates.accumulatedFocusSeconds, status: 'completed' }); 
            setShowPostSessionModal(true);
        }
    } else if (activeSession.status === 'break_running') {
        currentPhaseDuration = activeSession.isLongBreakNext 
            ? (activeSession.pomodoroLongBreakSeconds ?? pomodoroLongBreakSetting)
            : (activeSession.pomodoroShortBreakSeconds ?? pomodoroShortBreakSetting);
        updates.accumulatedBreakSeconds = (activeSession.accumulatedBreakSeconds || 0) + currentPhaseDuration;
        
        updates.status = 'running'; 
        updates.currentCycle = (activeSession.currentCycle || 0) + 1;
        updates.startTime = now; 
        updates.isLongBreakNext = false;
    }
    
    await updateFocusSession(activeSession.id!, updates);
  };

  const handleStartPauseResume = async () => {
    if (!user) return;
    const now = Timestamp.now();

    if (!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) {
      setShowPreFocusModal(true);
    } else { 
      let updates: Partial<FocusSessionData> = {};
      const timeElapsedInCurrentSegment = activeSession.startTime ? Math.max(0, now.seconds - activeSession.startTime.seconds) : 0;

      if (['running', 'break_running'].includes(activeSession.status)) { // PAUSE IT
        updates.status = activeSession.status === 'running' ? 'paused' : 'break_paused';
        if (activeSession.status === 'running') {
            updates.accumulatedFocusSeconds = (activeSession.accumulatedFocusSeconds || 0) + timeElapsedInCurrentSegment;
        } else { 
            updates.accumulatedBreakSeconds = (activeSession.accumulatedBreakSeconds || 0) + timeElapsedInCurrentSegment;
        }
        updates.pauseTime = now;
        updates.startTime = null; 
      } else if (['paused', 'break_paused'].includes(activeSession.status)) { // RESUME IT
        updates.status = activeSession.status === 'paused' ? 'running' : 'break_running';
        updates.startTime = now; 
        updates.pauseTime = null;
      }
      await updateFocusSession(activeSession.id!, updates);
    }
  };

  const startNewPomodoroSessionFromModal = async () => {
    if(!user) return;
    const linkedItem = selectedLinkedItemId ? userProductivityItems.find(i => i.id === selectedLinkedItemId) : null;
    const newSessionInput: CreatePomodoroSessionInput = {
      type: 'pomodoro',
      timerName: linkedItem ? `Focus: ${linkedItem.name}` : 'Pomodoro Session',
      pomodoroWorkSeconds: pomodoroWorkSetting,
      pomodoroShortBreakSeconds: pomodoroShortBreakSetting,
      pomodoroLongBreakSeconds: pomodoroLongBreakSetting,
      pomodoroCyclesGoal: pomodoroCyclesGoalSetting,
      startTime: Timestamp.now(),
      linkedItemId: linkedItem?.id || null,
      linkedItemName: linkedItem?.name || null,
      linkedItemCollection: linkedItem?.collection || null,
      notes: sessionNotes || null,
      sessionGoalText: sessionGoalText || null,
      preFocusCheckIn: { mood: preFocusMood, energyLevel: preFocusEnergy, customInput: null },
      ambientSound: selectedAmbientSound || null,
    };
    await createFocusSession(user.uid, newSessionInput);
    setShowPreFocusModal(false);
    setPreFocusMood(null); 
    setPreFocusEnergy(3);
  };
  
  const handleStartCustomTimerSession = async (timer: CustomTimer) => {
    if (!user) return;
    const linkedItem = selectedLinkedItemId ? userProductivityItems.find(i => i.id === selectedLinkedItemId) : null;
    const newSessionInput: CreateCustomTimerSessionInput = {
        type: 'custom_timer',
        timerName: timer.data.name,
        plannedDurationSeconds: timer.data.time,
        startTime: Timestamp.now(),
        linkedItemId: linkedItem?.id || null,
        linkedItemName: linkedItem?.name || null,
        linkedItemCollection: linkedItem?.collection || null,
        notes: sessionNotes || null,
        sessionGoalText: sessionGoalText || null,
        preFocusCheckIn: activeSession?.preFocusCheckIn || { mood: preFocusMood, energyLevel: preFocusEnergy, customInput: null },
        ambientSound: selectedAmbientSound || null,
      };
    await createFocusSession(user.uid, newSessionInput);
  };

  const handleReset = async () => {
    if (!activeSession || !user) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const now = Timestamp.now();
    const timeElapsedInCurrentSegment = activeSession.startTime ? Math.max(0, now.seconds - activeSession.startTime.seconds) : 0;
    
    let finalAccumulatedFocus = activeSession.accumulatedFocusSeconds || 0;
    let finalAccumulatedBreak = activeSession.accumulatedBreakSeconds || 0;

    if (activeSession.status === 'running' || (activeSession.status === 'paused' && activeSession.startTime === null /* Was running before pause */)) {
        finalAccumulatedFocus += timeElapsedInCurrentSegment;
    } else if (activeSession.status === 'break_running' || (activeSession.status === 'break_paused' && activeSession.startTime === null)) {
        finalAccumulatedBreak += timeElapsedInCurrentSegment;
    }

    const sessionToCalculateXp: FocusSessionData = {
        ...activeSession,
        status: 'cancelled',
        accumulatedFocusSeconds: finalAccumulatedFocus,
        sessionGoalAchieved: false, // Goal not met on cancel
    };
    const xpFromCancelled = calculateXpForSession(sessionToCalculateXp);

    const updates: Partial<FocusSessionData> = {
        status: 'cancelled',
        startTime: null,
        endTime: now,
        pauseTime: null,
        accumulatedFocusSeconds: finalAccumulatedFocus,
        accumulatedBreakSeconds: finalAccumulatedBreak,
        currentCycle: null,
        isLongBreakNext: false,
        xpEarned: xpFromCancelled,
    };
    await updateFocusSession(activeSession.id!, updates);
    if (xpFromCancelled > 0) {
        await updateUserTotalXp(user.uid, xpFromCancelled);
    }
    setSessionGoalText(""); 
    setSessionNotes(""); 
    setSelectedLinkedItemId(null); 
    setSelectedAmbientSound(null);
    setIsSoundPlaying(false);
  };
  
  const handleSkipBreak = async () => {
    if (!activeSession || !user || activeSession.type !== 'pomodoro' || !['break_running', 'break_paused'].includes(activeSession.status)) return;
    const now = Timestamp.now();
    const timeElapsedInBreakSegment = activeSession.startTime ? Math.max(0, now.seconds - activeSession.startTime.seconds) : 0;

    const updates: Partial<FocusSessionData> = {
        status: 'running',
        startTime: now,
        pauseTime: null,
        currentCycle: (activeSession.currentCycle || 0) + 1, // Increment cycle as we are starting a new work session
        isLongBreakNext: false,
        accumulatedBreakSeconds: (activeSession.accumulatedBreakSeconds || 0) + timeElapsedInBreakSegment,
        // Do not reset accumulatedFocusSeconds. Each work segment adds to it.
    };
    await updateFocusSession(activeSession.id!, updates);
  };

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled);}, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled));}, [isSidebarBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); document.body.classList.toggle('illuminate-mode', isIlluminateEnabled); if (isIlluminateEnabled) document.body.classList.remove('blackout-mode'); else if (isBlackoutEnabled) document.body.classList.add('blackout-mode');}, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled));}, [isSidebarIlluminateEnabled]);


  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const totalFocusedTimeToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = Timestamp.fromDate(todayStart);

    return focusHistory
      .filter(s => (s.status === 'completed' || s.status === 'cancelled') && s.createdAt && s.createdAt.seconds >= todayStartTimestamp.seconds)
      .reduce((total, s) => total + (s.accumulatedFocusSeconds || 0), 0);
  }, [focusHistory]);

  const handleSavePomodoroSettings = () => {
    localStorage.setItem('pomodoroSettings', JSON.stringify({
        work: pomodoroWorkSetting, shortBreak: pomodoroShortBreakSetting, longBreak: pomodoroLongBreakSetting, cycles: pomodoroCyclesGoalSetting
    }));
    if(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)){
        setTimeLeft(pomodoroWorkSetting);
    }
    setShowSettingsModal(false);
  };
  useEffect(() => {
    const saved = localStorage.getItem('pomodoroSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      setPomodoroWorkSetting(settings.work || DEFAULT_WORK_SECONDS);
      setPomodoroShortBreakSetting(settings.shortBreak || DEFAULT_SHORT_BREAK_SECONDS);
      setPomodoroLongBreakSetting(settings.longBreak || DEFAULT_LONG_BREAK_SECONDS);
      setPomodoroCyclesGoalSetting(settings.cycles || DEFAULT_CYCLES_GOAL);
      if (!activeSession && settings.work) {
        setTimeLeft(settings.work);
      }
    }
  }, []);

  const handleOpenCustomTimerModal = (timer?: CustomTimer) => {
    if (timer) {
      setEditingCustomTimer(timer);
      setNewCustomTimerName(timer.data.name);
      setNewCustomTimerDuration(timer.data.time / 60);
    } else {
      setEditingCustomTimer(null);
      setNewCustomTimerName("");
      setNewCustomTimerDuration(25);
    }
    setShowCustomTimerModal(true);
  };
  const handleSaveCustomTimer = async () => {
    if (!user || !newCustomTimerName.trim() || newCustomTimerDuration <= 0) return;
    const durationInSeconds = newCustomTimerDuration * 60;
    if (editingCustomTimer) {
      await updateCustomTimer(editingCustomTimer.id, newCustomTimerName, durationInSeconds);
    } else {
      await addCustomTimer(newCustomTimerName, durationInSeconds, user.uid);
    }
    setShowCustomTimerModal(false);
  };
  const handleDeleteCustomTimer = async (timerId: string) => {
    if (window.confirm("Are you sure you want to delete this custom timer?")) {
      await deleteCustomTimer(timerId);
    }
  };


  const handleLinkItemChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    setSelectedLinkedItemId(itemId || null);
    if (activeSession && activeSession.id) {
      const item = userProductivityItems.find(i => i.id === itemId);
      await updateFocusSession(activeSession.id, {
        linkedItemId: itemId || null,
        linkedItemName: item?.name || null,
        linkedItemCollection: item?.collection || null,
      });
    }
  };
  
  const handleSessionNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSessionNotes(e.target.value);
  };
  const handleSaveSessionNotes = async () => {
    if (activeSession && activeSession.id && user) {
      await addNoteToFocusSession(activeSession.id, sessionNotes || null);
    }
  };
  const handleSessionGoalTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSessionGoalText(e.target.value);
      if (activeSession && activeSession.id) {
          updateFocusSession(activeSession.id, { sessionGoalText: e.target.value || null });
      }
  };
  
  const handleSubmitPostSessionFeedback = async () => {
    if (completedSessionForFeedback && completedSessionForFeedback.id && user) {
        await savePostSessionFeedback(
            completedSessionForFeedback.id, 
            {
                productivityRating: postSessionProductivity,
                reflection: postSessionReflection || null,
            },
            postSessionGoalAchieved,
            user.uid
        );
    }
    setShowPostSessionModal(false);
    setCompletedSessionForFeedback(null);
    setPostSessionProductivity(3);
    setPostSessionReflection("");
    setPostSessionGoalAchieved(null);
  };

  useEffect(() => {
    if (audioRef.current) {
        const soundToPlay = selectedAmbientSound ? AMBIENT_SOUNDS.find(s => s.name === selectedAmbientSound.name) : null;
        
        if (soundToPlay && soundToPlay.src && isSoundPlaying) {
            if (audioRef.current.src !== window.location.origin + soundToPlay.src) {
                audioRef.current.src = soundToPlay.src;
            }
            audioRef.current.loop = true;
            audioRef.current.volume = selectedAmbientSound.volume ?? ambientVolume;
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        } else {
            audioRef.current.pause();
        }
    }
  }, [selectedAmbientSound, isSoundPlaying, ambientVolume]);

  const handleAmbientSoundChange = async (soundId: string) => {
    const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
    const soundToSet = sound && sound.id !== 'none' ? { name: sound.name, src: sound.src, volume: ambientVolume } : null;
    setSelectedAmbientSound(soundToSet);
    if (activeSession && activeSession.id) {
        await updateSessionAmbientSound(activeSession.id, soundToSet);
    }
    if (soundToSet && soundToSet.src) setIsSoundPlaying(true); else setIsSoundPlaying(false);
  };

  const toggleSoundPlay = () => setIsSoundPlaying(prev => {
      if (!prev && selectedAmbientSound && audioRef.current && selectedAmbientSound.src) {
          audioRef.current.play().catch(e=> console.warn("Error playing sound on toggle:", e));
      }
      return !prev;
  });

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setAmbientVolume(newVolume);
    if (audioRef.current) audioRef.current.volume = newVolume;
    if (selectedAmbientSound && activeSession && activeSession.id) {
        // Update the volume in the session data if it's currently active
        const updatedSoundData = { ...selectedAmbientSound, volume: newVolume };
        setSelectedAmbientSound(updatedSoundData); // Update local state for immediate UI feedback
        updateSessionAmbientSound(activeSession.id, updatedSoundData);
    }
  };
  
  const toggleFullscreen = () => {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  const formatItemsForFocusChatContext = () => {
    if (!user) return "User data not available for items.";
    if (userProductivityItems.length === 0) return "User has no active tasks, goals, projects, or plans.";
    
    const lines: string[] = [`Current non-completed items for ${truncatedName}:\n`];
    userProductivityItems.forEach(item => {
      lines.push(`- ${item.type}: "${item.name}" (ID: ${item.id})`);
    });
    return lines.join('\n');
  };

  const createFocusChatPrompt = (userMessage: string): string => {
    const conversationSoFar = chatHistory.slice(-6).map(m => `${m.role === 'user' ? truncatedName : 'Assistant'}: ${m.content}`).join('\n');
    const now = new Date();
    const currentDateTime = { date: now.toLocaleDateString(), time: now.toLocaleTimeString() };

    let focusContext = "No active focus session.";
    if (activeSession) {
        focusContext = `Current focus session:
Status: ${activeSession.status}
Type: ${activeSession.type}
Goal: ${activeSession.sessionGoalText || 'Not set'}
${activeSession.type === 'pomodoro' ? `Cycle: ${activeSession.currentCycle || 1}/${activeSession.pomodoroCyclesGoal || DEFAULT_CYCLES_GOAL}` : ''}
${activeSession.timerName ? `Timer Name: ${activeSession.timerName}`:''}
Time Left in current phase: ${formatTime(timeLeft)}
Linked Item: ${activeSession.linkedItemName || 'None'} (Linked Item ID: ${activeSession.linkedItemId || 'None'})
Ambient Sound: ${activeSession.ambientSound?.name || 'None'}
Session Notes: ${activeSession.notes || 'None added yet.'}`;
    }

    let userPersonalContext = '';
    if (userContext) {
      userPersonalContext = `User's General Context (provided by ${truncatedName}): Work: ${userContext.workDescription || 'N/A'}, Short-term Focus: ${userContext.shortTermFocus || 'N/A'}, Long-term Goals: ${userContext.longTermGoals || 'N/A'}, Other: ${userContext.otherContext || 'N/A'}`;
    }
    
    const userItemsContext = formatItemsForFocusChatContext();

    return `
[CONTEXT]
User's Name: ${truncatedName}
Current Date & Time: ${currentDateTime.date} ${currentDateTime.time}
${userPersonalContext}

User's Current Productivity Items (Tasks, Goals, Projects, Plans - with their IDs):
${userItemsContext}

Current Focus Session Details:
${focusContext}

[CONVERSATION HISTORY]
${conversationSoFar}

[NEW USER MESSAGE]
${truncatedName}: ${userMessage}

You are TaskMaster AI, specialized in helping ${truncatedName} with focus and productivity.
Guidelines:
1.  General Conversation & Focus Tips: Engage naturally. Provide actionable focus advice.
2.  Session Control (JSON): If asked to start, stop, pause, manage timers, or link items, respond with brief confirmation text *then* JSON: \`\`\`json\n{"action":"actionName","payload":{...}}\n\`\`\`
    *   Actions: "start_focus_session", "pause_focus_session", "resume_focus_session", "end_focus_session", "skip_break", "reset_session", "link_item_to_session", "set_session_goal", "change_ambient_sound", "add_session_note".
    *   Payloads:
        * "start_focus_session": {type: "pomodoro" | "custom", durationMinutes?: number, timerName?: string, linkedItemName?: string /* or linkedItemId */, sessionGoal?: string}
        * "link_item_to_session": {itemName: "Name of item" /* or itemId: "ID of item" */}
        * "set_session_goal": {goalText: "The user's goal"}
        * "change_ambient_sound": {soundName: "None" | "White Noise" | "Rain" | "Cafe Ambience" | "Lofi Beats"} (case-insensitive match)
        * "add_session_note": {note: "User's note content"}
        * Others might be empty or identify session.
3.  Timer Adjustments (Conceptual): If user mentions fatigue or task difficulty, you can *suggest* changes like "Would you like to try a shorter 20-minute cycle for this task?" but DO NOT output JSON to directly change timer settings without explicit confirmation.
4. If no specific action, provide helpful text. Be concise and encouraging.
Assistant:`;
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatMessage.trim() || !user || !user.uid) return;

    let currentConvId = conversationId;
    if (!currentConvId) {
      currentConvId = await createChatConversation(user.uid, "New Focus Chat");
      if (!currentConvId) { console.error("Failed to create/get conversation ID"); return; }
      setConversationId(currentConvId);
      setAiChatSidebarTab('chat');
      setHasGeneratedChatName(false);
    }
    
    if (isChatDisabledByLimit) {
      setChatHistory(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `Monthly message limit reached.`, error: true, createdAt: new Date() }]);
      return;
    }

    const userMsgForState: ChatMessageDisplayData = { id: `user-${Date.now()}`, role: 'user', content: chatMessage, createdAt: new Date() };
    setChatHistory(prev => [...prev, userMsgForState]);
    await saveChatMessage(currentConvId, { role: 'user', content: chatMessage, createdAt: new Date() });
    setChatMessage('');
    
    if (userTier !== 'premium' && userTier !== 'loading') {
      try { await incrementUserChatUsage(user.uid); setChatUsageCount(prev => prev + 1); }
      catch (err) { console.warn("Failed to increment chat usage:", err); }
    }

    setIsChatLoading(true);
    const assistantPlaceholderId = `assistant-ph-${Date.now()}`;
    setChatHistory(prev => [...prev, { id: assistantPlaceholderId, role: 'assistant', content: "...", localPlaceholderId: assistantPlaceholderId, createdAt: new Date() }]);

    const prompt = createFocusChatPrompt(userMsgForState.content);
    const fullApiUrl = `${GEMINI_API_BASE}${GEMINI_TEXT_MODEL}:generateContent?key=${geminiApiKey}`;
    const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) };

    try {
      const response = await fetchWithTimeout(fullApiUrl, geminiOptions);
      const responseText = await response.text();
      const parsedApiResult = parseGeminiApiResponseText(responseText);
      
      let assistantText = parsedApiResult.text || "Sorry, I couldn't process that.";
      let actionDetails: ChatMessageDisplayData['actionDetails'] | undefined = undefined;

      if (parsedApiResult.error && !assistantText) assistantText = parsedApiResult.error;

      const { blocks: jsonBlocks, cleanedText } = extractJsonBlocks(assistantText);
      
      if (jsonBlocks.length > 0) {
        assistantText = cleanedText || "Okay, I'll do that.";
        for (const block of jsonBlocks) {
          if (block.action && block.payload && user.uid) {
            try {
              let successMessage = "Action processed.";
              if (block.action === "start_focus_session") {
                const { type, durationMinutes, timerName, linkedItemName, linkedItemId, sessionGoal } = block.payload;
                let itemToLink = linkedItemId 
                    ? userProductivityItems.find(i => i.id === linkedItemId) 
                    : (linkedItemName ? userProductivityItems.find(i => i.name.toLowerCase() === String(linkedItemName).toLowerCase()) : null);

                if (type === 'pomodoro') {
                  const newSessionDataAI: CreatePomodoroSessionInput = { 
                    type: 'pomodoro', 
                    timerName: timerName || (itemToLink ? `Focus: ${itemToLink.name}`: 'Pomodoro (AI)'),
                    pomodoroWorkSeconds: pomodoroWorkSetting, pomodoroShortBreakSeconds: pomodoroShortBreakSetting,
                    pomodoroLongBreakSeconds: pomodoroLongBreakSetting, pomodoroCyclesGoal: pomodoroCyclesGoalSetting,
                    startTime: Timestamp.now(),
                    linkedItemId: itemToLink?.id || null, linkedItemName: itemToLink?.name || null, linkedItemCollection: itemToLink?.collection || null,
                    notes: null, sessionGoalText: sessionGoal || null,
                    preFocusCheckIn: null,
                    ambientSound: selectedAmbientSound || null,
                  };
                  await createFocusSession(user.uid, newSessionDataAI);
                  successMessage = `Started Pomodoro session ${itemToLink ? `for ${itemToLink.name}` : ''} ${sessionGoal ? ` (Goal: ${sessionGoal})` : ''}.`;
                } else if (type === 'custom' && durationMinutes) {
                  const newSessionDataAI: CreateCustomTimerSessionInput = { 
                    type: 'custom_timer', 
                    timerName: timerName || (itemToLink ? `Custom: ${itemToLink.name}` : `Custom ${durationMinutes}min (AI)`),
                    plannedDurationSeconds: durationMinutes * 60, 
                    startTime: Timestamp.now(),
                    linkedItemId: itemToLink?.id || null, linkedItemName: itemToLink?.name || null, linkedItemCollection: itemToLink?.collection || null,
                    notes: null, sessionGoalText: sessionGoal || null,
                    preFocusCheckIn: null,
                    ambientSound: selectedAmbientSound || null,
                  };
                  await createFocusSession(user.uid, newSessionDataAI);
                  successMessage = `Started ${durationMinutes} minute timer ${itemToLink ? `for ${itemToLink.name}` : ''} ${sessionGoal ? ` (Goal: ${sessionGoal})` : ''}.`;
                } else {
                  throw new Error("Invalid parameters for AI to start session.");
                }
              } else if (block.action === "add_session_note" && activeSession) {
                await addNoteToFocusSession(activeSession.id!, block.payload.note || null);
                setSessionNotes(block.payload.note || ""); 
                successMessage = "Note added to current session.";
              } else if (block.action === "link_item_to_session" && activeSession) {
                const { itemName, itemId } = block.payload;
                const itemToLink = itemId 
                    ? userProductivityItems.find(i => i.id === itemId)
                    : (itemName ? userProductivityItems.find(i => i.name.toLowerCase() === String(itemName)?.toLowerCase()) : null);
                
                if (itemToLink) {
                    await updateFocusSession(activeSession.id!, { linkedItemId: itemToLink.id, linkedItemName: itemToLink.name, linkedItemCollection: itemToLink.collection });
                    setSelectedLinkedItemId(itemToLink.id);
                    successMessage = `Linked "${itemToLink.name}" to current session.`;
                } else { throw new Error(`Could not find item: ${itemName || itemId}`); }
              } else if (block.action === "set_session_goal" && activeSession) {
                  await updateFocusSession(activeSession.id!, { sessionGoalText: block.payload.goalText || null });
                  setSessionGoalText(block.payload.goalText || "");
                  successMessage = `Session goal set to: "${block.payload.goalText}"`;
              } else if (block.action === "change_ambient_sound") {
                  const soundOption = AMBIENT_SOUNDS.find(s => s.name.toLowerCase() === String(block.payload.soundName)?.toLowerCase());
                  if (soundOption) {
                      handleAmbientSoundChange(soundOption.id);
                      successMessage = `Ambient sound changed to ${soundOption.name}.`;
                  } else { throw new Error(`Sound "${block.payload.soundName}" not found.`); }
              }
              else if (["pause_focus_session", "resume_focus_session", "end_focus_session", "skip_break", "reset_session"].includes(block.action) && activeSession) {
                  if (block.action === "pause_focus_session" && (activeSession.status === 'running' || activeSession.status === 'break_running')) await handleStartPauseResume();
                  else if (block.action === "resume_focus_session" && (activeSession.status === 'paused' || activeSession.status === 'break_paused')) await handleStartPauseResume();
                  else if (block.action === "end_focus_session" || block.action === "reset_session") await handleReset();
                  else if (block.action === "skip_break") await handleSkipBreak();
                  else { throw new Error(`Cannot perform '${block.action}' in current state: ${activeSession.status}.`); }
                  successMessage = `Session action '${block.action}' processed.`;
              }
              actionDetails = { status: 'success', message: successMessage };
              if (!cleanedText && successMessage) assistantText = successMessage;
            } catch (err: any) {
              actionDetails = { status: 'error', message: `Action failed: ${err.message}` };
              assistantText = cleanedText ? `${cleanedText}\nError processing action: ${err.message}` : `Action failed: ${err.message}`;
            }
          }
        }
      }
      
      const finalAssistantText = assistantText === "" && actionDetails?.status === 'success' ? (actionDetails.message || "Okay.") : assistantText;
      const assistantMsgForState: ChatMessageDisplayData = { id: assistantPlaceholderId, role: 'assistant', content: finalAssistantText, createdAt: new Date(), error: !!parsedApiResult.error || actionDetails?.status === 'error', actionDetails, localPlaceholderId: assistantPlaceholderId };
      setChatHistory(prev => prev.map(m => m.localPlaceholderId === assistantPlaceholderId ? assistantMsgForState : m));
      await saveChatMessage(currentConvId!, { role: 'assistant', content: finalAssistantText, createdAt: new Date(), error: assistantMsgForState.error, actionDetails: actionDetails as any });

      const conversationHistoryForName = [...chatHistory.filter(m => m.localPlaceholderId !== assistantPlaceholderId), assistantMsgForState];
      const totalUserMessagesInConv = conversationHistoryForName.filter(m => m.role === 'user').length;
      const currentConvInfo = conversationList.find(c => c.id === currentConvId);
      if (currentConvId && currentConvInfo?.chatName?.startsWith("New Focus Chat") && (!hasGeneratedChatName || totalUserMessagesInConv <= 2 )) {
          const newName = `Focus ${new Date().toLocaleDateString([], {month:'short', day:'numeric'})} ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
          await updateChatConversationName(currentConvId, newName);
          setHasGeneratedChatName(true);
      }

    } catch (err: any) {
      const errorMsg = `Sorry, error processing chat: ${err.message}`;
      setChatHistory(prev => prev.map(m => m.localPlaceholderId === assistantPlaceholderId ? { ...m, content: errorMsg, error: true } : m));
      if (currentConvId) await saveChatMessage(currentConvId, { role: 'assistant', content: errorMsg, error: true, createdAt: new Date() });
    } finally {
      setIsChatLoading(false);
    }
  };
  
  useEffect(() => {
    if (chatEndRef.current && isAiSidebarOpen) requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }, [chatHistory, isAiSidebarOpen]);
  
  const handleNewConversation = async () => { if (!user || !user.uid) return; const newConvId = await createChatConversation(user.uid, 'New Focus Chat'); if (newConvId) {setConversationId(newConvId); setAiChatSidebarTab('chat'); setHasGeneratedChatName(false);} };
  const handleSelectConversation = (convId: string) => { if(conversationId === convId && chatHistory.length > 0 && !isChatLoading) return; setConversationId(convId); setAiChatSidebarTab('chat'); const selConv = conversationList.find(c => c.id === convId); setHasGeneratedChatName(selConv ? !selConv.chatName?.startsWith("New Focus Chat") : false);};
  
  useEffect(() => {
    if (!conversationId) { setChatHistory([]); return; }
    const unsubMessages = onChatMessagesSnapshot(conversationId, (messagesFromDb: FirebaseChatMessage[]) => {
        setChatHistory(messagesFromDb.map(m => ({ id: m.id || `fb-${Date.now()}-${Math.random()}`, role: m.role, content: m.content, createdAt: m.createdAt, error: m.error, actionDetails: m.actionDetails as any } as ChatMessageDisplayData)));
    });
    return () => unsubMessages();
  }, [conversationId]);
  
  const containerClass = isIlluminateEnabled ? "bg-slate-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/80 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/60 shadow-lg shadow-black/20";
  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/70 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : isBlackoutEnabled ? "bg-gray-800 hover:bg-gray-700/80 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500" : "bg-gray-700 hover:bg-gray-600/70 border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500";
  const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
  const illuminateTextBlue = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
  const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-600" : "text-yellow-400";

  const fullscreenContainerVariants = {
    normal: { borderRadius: "0.75rem" },
    fullscreen: { borderRadius: "0px" }
  };
  const fullscreenContentVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: "circOut" } },
    exit: { opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.3, ease: "circIn" } },
  };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: -30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.9, y: 30, transition: { duration: 0.2, ease: "easeIn" } },
  };

  return (
    <div className={`${containerClass} min-h-screen w-full overflow-hidden relative font-sans`}>
      <Sidebar userName={userName} isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(p => !p)} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />
      <audio ref={audioRef} />
      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'} z-40 p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${isIlluminateEnabled ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'} ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open Focus AI Chat">
        <BrainCircuit className="w-5 h-5" />
      </button>

        <motion.main
            layout
            className={`transition-transform duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64'} p-3 md:p-4 lg:p-5 xl:p-6 
                        ${isFullscreen ? 'fixed inset-0 ml-0 !p-0 z-[100] flex flex-col items-center justify-center overflow-hidden' : 'overflow-x-hidden'}`}
            variants={fullscreenContainerVariants}
            animate={isFullscreen ? "fullscreen" : "normal"}
        >
        <AnimatePresence mode="wait">
            <motion.div
                key={isFullscreen ? "fullscreen-content" : "normal-content"}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={fullscreenContentVariants}
                className={`${isFullscreen ? 'w-full h-full flex flex-col' : 'w-full'}`}
            >
                <header className={`${isFullscreen ? 'pt-12 pb-4 px-6 text-center w-full' : 'mb-6'}`}>
                    <div className={`flex items-center ${isFullscreen ? 'justify-center relative' : 'justify-between'}`}>
                        <h1 className={`text-2xl md:text-3xl font-bold flex items-center ${headingClass}`}>
                            <TimerIcon className={`w-7 h-7 mr-2 ${illuminateTextBlue}`} /> Focus Mode
                        </h1>
                        <button onClick={toggleFullscreen} className={`p-2 rounded-full ${iconColor} ${isFullscreen ? 'absolute top-0 right-2' : ''}`} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                            {isFullscreen ? <X className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                    </div>
                    {!isFullscreen && <p className={`${subheadingClass} text-sm`}>Zone in and get things done, {truncatedName}.</p>}
                </header>

                <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isFullscreen ? 'flex-grow w-full max-w-6xl mx-auto px-6 pb-6' : ''}`}>
                    <motion.div
                        layout
                        className={`lg:col-span-2 ${isFullscreen ? '' : cardClass} rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-xl min-h-[500px] ${isFullscreen ? 'shadow-none border-none bg-transparent' : ''}`}
                    >
                        <motion.div
                            key={timeLeft + (activeSession?.status || 'idle')}
                            initial={{ opacity:0.8, y:5 }}
                            animate={{ opacity:1, y:0 }}
                            transition={{ duration: 0.2 }}
                            className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-mono font-bold mb-4 tabular-nums transition-colors duration-300 ${(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') ? (isIlluminateEnabled ? 'text-green-600' : 'text-green-400') : illuminateTextBlue }`}>
                            {formatTime(timeLeft)}
                        </motion.div>
                        <div className="mb-1 text-sm min-h-[20px]">
                        {activeSession?.status === 'running' && <span className={`font-semibold ${isIlluminateEnabled? 'text-gray-700' : 'text-gray-300'}`}>Focusing on: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                        {activeSession?.status === 'paused' && <span className={`font-semibold italic ${isIlluminateEnabled? 'text-gray-600' : 'text-gray-400'}`}>Paused: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                        {(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && <span className={`font-semibold ${isIlluminateEnabled? 'text-green-700' : 'text-green-300'}`}>{activeSession.isLongBreakNext ? 'Long Break' : 'Short Break'} {activeSession.status === 'break_paused' && '(Paused)'}</span>}
                        {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <span className={`italic ${subheadingClass}`}>Ready to start a new session.</span>}
                        </div>
                        {activeSession?.sessionGoalText && <p className={`text-xs italic mt-0 mb-2 ${subheadingClass}`}>Goal: {activeSession.sessionGoalText}</p>}
                        {activeSession?.type === 'pomodoro' && (activeSession.status === 'running' || activeSession.status === 'paused') && <p className={`${subheadingClass} text-xs mb-4`}>Cycle {activeSession.currentCycle || 1} of {activeSession.pomodoroCyclesGoal || DEFAULT_CYCLES_GOAL}</p>}

                        <AnimatePresence>
                            {currentMindfulSuggestion && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
                                    className={`${isFullscreen ? 'bg-opacity-20' : cardClass} p-3 my-3 rounded-lg text-xs italic max-w-sm ${isIlluminateEnabled ? 'bg-green-50 text-green-700' : 'bg-green-900/30 text-green-300'}`}>
                                    <Coffee className="w-3.5 h-3.5 inline mr-1.5" /> {currentMindfulSuggestion}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex flex-wrap justify-center items-center gap-3 mb-6">
                        <button
                            onClick={handleStartPauseResume} disabled={!user || showPreFocusModal} 
                            className={`px-6 py-3 text-lg font-semibold rounded-lg transition-all transform hover:scale-105 shadow-md flex items-center gap-2
                            ${(!activeSession || ['idle', 'paused', 'break_paused', 'completed', 'cancelled'].includes(activeSession.status))
                                ? (isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700')
                                : (isIlluminateEnabled ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-yellow-600 text-white hover:bg-yellow-700')
                            }`}>
                            {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <><Play className="w-5 h-5" /> Start Focus</>}
                            {(activeSession?.status === 'running' || activeSession?.status === 'break_running') && <><Pause className="w-5 h-5" /> Pause</>}
                            {(activeSession?.status === 'paused' || activeSession?.status === 'break_paused') && <><Play className="w-5 h-5" /> Resume</>}
                        </button>
                        <button onClick={handleReset} disabled={!activeSession || activeSession.status === 'idle'} className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm ${isIlluminateEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50' : 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50'}`}><RotateCcw className="w-4 h-4" /> Reset/Cancel</button>
                        {activeSession?.type === 'pomodoro' && (activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && (
                            <button onClick={handleSkipBreak} className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm ${isIlluminateEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-800 text-green-200 hover:bg-green-700'}`}><SkipForward className="w-4 h-4" /> Skip Break</button>
                        )}
                        </div>
                        
                        {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                                className={`w-full max-w-md mt-2 mb-4 overflow-hidden`}>
                                <label htmlFor="sessionGoal" className={`block text-sm font-medium mb-1 ${subheadingClass}`}>Set a Goal for this Session (Optional):</label>
                                <input type="text" id="sessionGoal" value={sessionGoalText} onChange={handleSessionGoalTextChange} placeholder="e.g., Finish chapter 1, Draft email" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                            </motion.div>
                        )}
                        
                        <div className={`w-full max-w-md border-t pt-4 mt-4 ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
                            <label htmlFor="linkItem" className={`block text-sm font-medium mb-1 ${subheadingClass}`}>Link to Item (Optional):</label>
                            <select id="linkItem" value={selectedLinkedItemId || ""} onChange={handleLinkItemChange} className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`}>
                                <option value="">-- Select an item --</option>
                                {userProductivityItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.type}: {item.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={`w-full max-w-md mt-4`}>
                            <label htmlFor="sessionNotes" className={`block text-sm font-medium mb-1 ${subheadingClass}`}>Session Notes:</label>
                            <textarea id="sessionNotes" rows={2} value={sessionNotes} onChange={handleSessionNotesChange} placeholder="Key insights, blockers, next steps..." className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none`}></textarea>
                            {activeSession && <button onClick={handleSaveSessionNotes} className={`mt-2 px-3 py-1.5 text-xs rounded-md transition-colors ${isIlluminateEnabled ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-600'}`}>Save Notes</button>}
                        </div>
                        <button onClick={() => setShowSettingsModal(true)} className={`mt-6 p-2 rounded-full transition-colors ${iconColor}`} title="Timer Settings"><Settings2 className="w-5 h-5" /></button>
                    </motion.div>

                    <div className={`lg:col-span-1 flex flex-col gap-6 ${isFullscreen ? 'hidden' : ''}`}> {/* Side column */}
                        <div className={`${cardClass} rounded-xl p-5`}>
                            <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><Headphones className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Ambient Sound</h2>
                            <div className="flex items-center gap-2 mb-2">
                                <select value={selectedAmbientSound?.name ? AMBIENT_SOUNDS.find(s=>s.name === selectedAmbientSound.name)?.id : 'none'} onChange={(e) => handleAmbientSoundChange(e.target.value)} className={`${inputBg} flex-grow p-2 rounded-lg text-sm shadow-sm`}>
                                    {AMBIENT_SOUNDS.map(sound => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
                                </select>
                                <button onClick={toggleSoundPlay} disabled={!selectedAmbientSound || selectedAmbientSound.name === "None" || !selectedAmbientSound.src} className={`p-2 rounded-full ${iconColor} disabled:opacity-50`}>
                                    {isSoundPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                </button>
                            </div>
                            <input type="range" min="0" max="1" step="0.05" value={ambientVolume} onChange={handleVolumeChange} disabled={!selectedAmbientSound || selectedAmbientSound.name === "None" || !selectedAmbientSound.src} className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-blue-500' : 'bg-gray-700 accent-blue-500'} disabled:opacity-50`} />
                        </div>

                        <div className={`${cardClass} rounded-xl p-5`}>
                        <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><Zap className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Quick Stats</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className={subheadingClass}>Focused Today:</span>
                                <span className={`font-semibold ${isIlluminateEnabled ? 'text-gray-700':'text-gray-200'}`}>{formatTime(totalFocusedTimeToday)}</span>
                            </div>
                            {activeSession?.type === 'pomodoro' && (activeSession.currentCycle !== null && activeSession.pomodoroCyclesGoal !== null && activeSession.currentCycle > 0) && (
                            <div className="flex justify-between items-center">
                                <span className={subheadingClass}>Current Cycle:</span>
                                <span className={`font-semibold ${isIlluminateEnabled ? 'text-gray-700':'text-gray-200'}`}>{activeSession?.currentCycle || 0} / {activeSession?.pomodoroCyclesGoal || DEFAULT_CYCLES_GOAL}</span>
                            </div>
                            )}
                             <div className="flex justify-between items-center">
                                <span className={subheadingClass}>Total XP:</span>
                                <motion.span key={totalUserXp} initial={{y:5, opacity:0}} animate={{y:0, opacity:1}} className={`font-semibold flex items-center gap-1 ${illuminateTextYellow}`}>
                                    <StarIcon className="w-3.5 h-3.5"/> {totalUserXp}
                                </motion.span>
                            </div>
                        </div>
                        </div>

                        <div className={`${cardClass} rounded-xl p-5`}>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className={`text-lg font-semibold flex items-center ${headingClass}`}><TimerIcon className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Custom Timers</h2>
                            <button onClick={() => handleOpenCustomTimerModal()} className={`p-1.5 rounded-full ${iconColor} hover:bg-opacity-20`} title="Add Custom Timer"><PlusCircle className="w-5 h-5" /></button>
                        </div>
                        {customTimers.length === 0 && <p className={`${subheadingClass} text-sm italic`}>No custom timers yet.</p>}
                        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {customTimers.map(timer => (
                            <li key={timer.id} className={`p-2.5 rounded-lg flex items-center justify-between text-sm transition-colors ${isIlluminateEnabled ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-700/50 hover:bg-gray-700'}`}>
                                <div>
                                <span className={`font-medium ${isIlluminateEnabled? 'text-gray-800': 'text-gray-100'}`}>{timer.data.name}</span>
                                <span className={`ml-2 text-xs ${subheadingClass}`}>({formatTime(timer.data.time)})</span>
                                </div>
                                <div className="flex gap-1">
                                <button onClick={() => handleStartCustomTimerSession(timer)} className={`p-1.5 rounded-md ${isIlluminateEnabled ? 'text-green-600 hover:bg-green-100' : 'text-green-400 hover:bg-green-900/50'}`} title="Start this timer"><Play className="w-4 h-4" /></button>
                                <button onClick={() => handleOpenCustomTimerModal(timer)} className={`p-1.5 rounded-md ${iconColor}`} title="Edit"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteCustomTimer(timer.id)} className={`p-1.5 rounded-md ${isIlluminateEnabled ? 'text-red-500 hover:bg-red-100' : 'text-red-400 hover:bg-red-900/50'}`} title="Delete"><Trash className="w-4 h-4" /></button>
                                </div>
                            </li>
                            ))}
                        </ul>
                        </div>
                        
                        <div className={`${cardClass} rounded-xl p-5`}>
                            <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><History className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Focus Log</h2>
                            {focusHistory.length === 0 && <p className={`${subheadingClass} text-sm italic`}>No completed or cancelled sessions yet.</p>}
                            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs">
                                {focusHistory.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(session => (
                                    <li key={session.id} className={`p-2 rounded-md ${session.status === 'cancelled' ? (isIlluminateEnabled ? 'bg-red-50/70' : 'bg-red-900/30') : (isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-700/40')}`}>
                                        <div className="flex justify-between items-center">
                                            <span className={`font-medium truncate ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`} title={session.timerName || (session.type === 'pomodoro' ? 'Pomodoro Session' : 'Custom Session')}>
                                                {session.timerName || (session.type === 'pomodoro' ? 'Pomodoro' : 'Custom')} ({formatTime(session.accumulatedFocusSeconds || 0)})
                                                {session.status === 'cancelled' && <span className={`ml-1 text-[10px] ${isIlluminateEnabled ? 'text-red-600' : 'text-red-400'}`}>(Cancelled)</span>}
                                            </span>
                                            <span className={subheadingClass}>{session.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                                        </div>
                                        {session.sessionGoalText && <p className={`mt-0.5 text-[11px] ${subheadingClass} truncate`}><Award className="w-2.5 h-2.5 inline mr-1"/>Goal: {session.sessionGoalText} {session.sessionGoalAchieved === true ? '(Achieved ✅)' : session.sessionGoalAchieved === false ? '(Not Met ❌)' : ''}</p>}
                                        {session.linkedItemName && <p className={`mt-0.5 text-[11px] ${subheadingClass} truncate`}><Link2 className="w-2.5 h-2.5 inline mr-1"/>{session.linkedItemName}</p>}
                                        {session.notes && <p className={`mt-0.5 text-[11px] italic ${subheadingClass} truncate`}><StickyNote className="w-2.5 h-2.5 inline mr-1"/>{session.notes}</p>}
                                        {session.postSessionFeedback?.productivityRating && <p className={`mt-0.5 text-[11px] ${subheadingClass}`}>Rated: {session.postSessionFeedback.productivityRating}/5</p>}
                                        {session.xpEarned && session.xpEarned > 0 && <p className={`mt-0.5 text-[11px] ${illuminateTextYellow} font-medium flex items-center gap-1`}><StarIcon className="w-3 h-3"/> +{session.xpEarned} XP</p>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
      </motion.main>
      
      {/* Modals (Pomodoro Settings, Custom Timer, Pre-Focus, Post-Session) */}
      {/* All modals wrapped with AnimatePresence and motion.div for animations */}
      <AnimatePresence>
      {showPreFocusModal && (
        <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`${cardClass} rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
            <h3 className={`text-xl font-semibold mb-4 text-center ${headingClass} flex items-center justify-center gap-2`}><Brain className="w-6 h-6 text-purple-400"/>Pre-Focus Check-in</h3>
            <p className={`text-sm mb-4 text-center ${subheadingClass}`}>Let's get you ready to focus, {truncatedName}!</p>
            <div className="space-y-5">
                <div>
                    <label className={`block mb-1.5 text-sm font-medium ${subheadingClass}`}>How are you feeling right now?</label>
                    <div className="flex justify-around gap-2">
                        {(['good', 'okay', 'bad'] as const).map(mood => (
                            <button key={mood} onClick={() => setPreFocusMood(mood)} 
                                    className={`flex-1 p-2.5 rounded-lg text-sm border-2 transition-all duration-150
                                        ${preFocusMood === mood ? 
                                            (mood === 'good' ? 'border-green-500 bg-green-500/20 text-green-400' : mood === 'okay' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' : 'border-red-500 bg-red-500/20 text-red-400') : 
                                            (isIlluminateEnabled ? 'border-gray-300 hover:border-gray-400' : 'border-gray-600 hover:border-gray-500')}`}>
                                {mood === 'good' && <Smile className="w-4 h-4 inline mr-1.5"/>}
                                {mood === 'okay' && <Meh className="w-4 h-4 inline mr-1.5"/>}
                                {mood === 'bad' && <Frown className="w-4 h-4 inline mr-1.5"/>}
                                {mood.charAt(0).toUpperCase() + mood.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="energyLevel" className={`block mb-1 text-sm font-medium ${subheadingClass}`}>Energy Level (1 Low - 5 High): <span className="font-bold text-base">{preFocusEnergy}</span></label>
                    <input type="range" id="energyLevel" min="1" max="5" step="1" value={preFocusEnergy} onChange={e => setPreFocusEnergy(parseInt(e.target.value))} 
                           className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-purple-500' : 'bg-gray-700 accent-purple-500'}`}/>
                </div>
                {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && (
                    <div>
                        <label htmlFor="modalSessionGoal" className={`block text-sm font-medium mb-1 ${subheadingClass}`}>What's your main goal for this session?</label>
                        <input type="text" id="modalSessionGoal" value={sessionGoalText} onChange={e => setSessionGoalText(e.target.value)} placeholder="e.g., Write 500 words" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm`} />
                    </div>
                )}
            </div>
            <div className="mt-6 flex gap-3">
                <button onClick={() => { setShowPreFocusModal(false); setPreFocusMood(null); setPreFocusEnergy(3);}} className={`w-1/2 py-2.5 rounded-lg font-medium transition-colors ${isIlluminateEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>Cancel</button>
                <button onClick={startNewPomodoroSessionFromModal} className={`w-1/2 py-2.5 rounded-lg font-semibold transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Start Pomodoro</button>
            </div>
            <p className="text-xs text-center mt-3 opacity-60">Your check-in helps tailor future suggestions.</p>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showPostSessionModal && completedSessionForFeedback && (
        <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`${cardClass} rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
            <h3 className={`text-xl font-semibold mb-2 text-center ${headingClass} flex items-center justify-center gap-2`}><CheckCircle className="w-6 h-6 text-green-400"/>Session Complete!</h3>
            <p className={`text-sm mb-1 text-center ${subheadingClass}`}>
                You focused for <span className="font-bold">{formatTime(completedSessionForFeedback.accumulatedFocusSeconds)}</span>
                {completedSessionForFeedback.linkedItemName && ` on "${completedSessionForFeedback.linkedItemName}"`}.
            </p>
            {completedSessionForFeedback.sessionGoalText && (
                <div className="text-sm mb-4 text-center">
                    <p className={`${subheadingClass}`}>Your goal was: "{completedSessionForFeedback.sessionGoalText}"</p>
                    <div className="mt-1.5">
                        <span className={`${subheadingClass} mr-2`}>Did you achieve it?</span>
                        <button onClick={() => setPostSessionGoalAchieved(true)} className={`px-3 py-1 text-xs rounded-md mr-1.5 ${postSessionGoalAchieved === true ? 'bg-green-500 text-white' : (isIlluminateEnabled ? 'bg-gray-200 hover:bg-green-100' : 'bg-gray-600 hover:bg-green-700')}`}>Yes ✅</button>
                        <button onClick={() => setPostSessionGoalAchieved(false)} className={`px-3 py-1 text-xs rounded-md ${postSessionGoalAchieved === false ? 'bg-red-500 text-white' : (isIlluminateEnabled ? 'bg-gray-200 hover:bg-red-100' : 'bg-gray-600 hover:bg-red-700')}`}>No ❌</button>
                    </div>
                </div>
            )}
            <div className="space-y-4">
                <div>
                    <label className={`block mb-1 text-sm font-medium ${subheadingClass}`}>How productive did you feel? (1 Low - 5 High): <span className="font-bold text-base">{postSessionProductivity}</span></label>
                    <input type="range" min="1" max="5" step="1" value={postSessionProductivity} onChange={e => setPostSessionProductivity(parseInt(e.target.value))} 
                           className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-green-500' : 'bg-gray-700 accent-green-500'}`}/>
                </div>
                <div>
                    <label htmlFor="reflection" className={`block text-sm font-medium mb-1 ${subheadingClass}`}>Any reflections on this session?</label>
                    <textarea id="reflection" rows={2} value={postSessionReflection} onChange={e => setPostSessionReflection(e.target.value)} placeholder="What went well? What could be better?" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm`}></textarea>
                </div>
            </div>
            <button onClick={handleSubmitPostSessionFeedback} className={`mt-6 w-full py-2.5 rounded-lg font-semibold transition-colors ${isIlluminateEnabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>Save Feedback & Collect XP</button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* Corrected Closing Tag for Pomodoro Settings Modal Div */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-md shadow-2xl`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-semibold ${headingClass}`}>Pomodoro Settings</h3>
                <button onClick={() => setShowSettingsModal(false)} className={iconColor}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                {[
                  { label: "Work Duration (minutes)", value: pomodoroWorkSetting / 60, setter: (val:number) => setPomodoroWorkSetting(Math.max(1, val) * 60) },
                  { label: "Short Break (minutes)", value: pomodoroShortBreakSetting / 60, setter: (val:number) => setPomodoroShortBreakSetting(Math.max(1, val) * 60) },
                  { label: "Long Break (minutes)", value: pomodoroLongBreakSetting / 60, setter: (val:number) => setPomodoroLongBreakSetting(Math.max(1, val) * 60) },
                  { label: "Cycles before Long Break", value: pomodoroCyclesGoalSetting, setter: (val:number) => setPomodoroCyclesGoalSetting(Math.max(1,val)) },
                ].map(item => (
                  <div key={item.label}>
                    <label className={`block mb-1 font-medium ${subheadingClass}`}>{item.label}:</label>
                    <input type="number" min="1" value={item.value} onChange={e => item.setter(parseInt(e.target.value))} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                  </div>
                ))}
              </div> {/* This div for space-y-4 was previously unclosed before the button */}
              <button onClick={handleSavePomodoroSettings} className={`mt-6 w-full py-2.5 rounded-lg font-semibold transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save Settings</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showCustomTimerModal && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-md shadow-2xl`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-xl font-semibold ${headingClass}`}>{editingCustomTimer ? "Edit" : "Add"} Custom Timer</h3>
                <button onClick={() => setShowCustomTimerModal(false)} className={iconColor}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <label className={`block mb-1 font-medium ${subheadingClass}`}>Timer Name:</label>
                  <input type="text" value={newCustomTimerName} onChange={e => setNewCustomTimerName(e.target.value)} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                </div>
                <div>
                  <label className={`block mb-1 font-medium ${subheadingClass}`}>Duration (minutes):</label>
                  <input type="number" min="1" value={newCustomTimerDuration} onChange={e => setNewCustomTimerDuration(parseInt(e.target.value))} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                </div>
              </div> {/* This div for space-y-4 was previously unclosed before the button */}
              <button onClick={handleSaveCustomTimer} className={`mt-6 w-full py-2.5 rounded-lg font-semibold transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save Timer</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* AI Chat Sidebar */}
      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-[55] transform transition-transform duration-300 ease-in-out ${isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
        <div className={`p-3 sm:p-4 border-b ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
          <h3 className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}><BrainCircuit className="w-5 h-5" />Focus AI</h3>
          <button onClick={() => setIsAiSidebarOpen(false)} className={`${isIlluminateEnabled ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'} p-1.5 rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        <div className={`flex border-b ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
            {['Chat', 'History'].map(tabName => ( <button key={tabName} onClick={() => setAiChatSidebarTab(tabName.toLowerCase() as any)} className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-medium ${aiChatSidebarTab === tabName.toLowerCase() ? `${isIlluminateEnabled ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600' : 'bg-gray-700 text-blue-300 border-b-2 border-blue-400'}` : `${isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-700/60 text-gray-400'}`}`}>{tabName}</button>))}
        </div>
        {aiChatSidebarTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatEndRef}>
              {!conversationId && <div className="text-center py-10"><MessageCircle className={`w-12 h-12 mx-auto mb-3 ${subheadingClass}`} /><p className={`${subheadingClass} text-sm`}>Start a new Focus AI chat.</p><button onClick={handleNewConversation} className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><PlusCircle className="w-4 h-4 inline mr-1.5" /> New Chat</button></div>}
              {conversationId && chatHistory.map((message, index) => ( <motion.div key={message.id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm shadow-md break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')}`}>
                  {message.content === "..." && isChatLoading && message.localPlaceholderId && <div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200"></div></div>}
                  {message.content && message.content !== "..." && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />, code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); }, }}>{message.content}</ReactMarkdown>}
                  {message.actionDetails && <div className={`mt-1.5 text-xs p-1.5 rounded ${message.actionDetails.status === 'success' ? (isIlluminateEnabled ? 'bg-green-50 text-green-700' : 'bg-green-900/30 text-green-300') : (isIlluminateEnabled ? 'bg-red-50 text-red-700' : 'bg-red-900/30 text-red-300')}`}>{message.actionDetails.message}</div>}
                </div>
              </motion.div>))}
            </div>
            <div className={`px-3 pt-2 border-t ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex-shrink-0`}>
              {userTier !== 'premium' && userTier !== 'loading' && (<div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>Messages: {chatUsageCount} / {currentChatLimitDisplay}</span> {isChatDisabledByLimit && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>} {!isChatDisabledByLimit && userTier === 'basic' && <Link to="/pricing" className={`ml-2 font-medium ${illuminateTextBlue} hover:underline`}><Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade</Link>}</div>)}
              <form onSubmit={handleChatSubmit} className="flex gap-2 items-center pb-2.5">
                <button type="button" onClick={() => setIsContextDialogOpen(true)} disabled={!conversationId} className={`p-2.5 rounded-full transition-colors ${!conversationId ? 'opacity-50 cursor-not-allowed' : ''} ${isIlluminateEnabled ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-700 text-gray-400'}`} title="Set AI Context"> <BrainCircuit className="w-4 h-4" /> </button>
                <textarea rows={1} value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }} placeholder={!conversationId ? "Select or start a chat..." : (isChatDisabledByLimit ? "Monthly limit reached..." : "Ask Focus AI...")} className={`flex-1 ${inputBg} rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-60 resize-none leading-tight max-h-24`} disabled={isChatLoading || isChatDisabledByLimit || !conversationId} />
                <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatDisabledByLimit || !conversationId} className={`bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50`}>
                  {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </>
        )}
        {aiChatSidebarTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <button onClick={handleNewConversation} className={`mb-2.5 w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm font-medium ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><PlusCircle className="w-4 h-4" /> New Focus Chat</button>
            {conversationList.length === 0 && <p className={`${subheadingClass} text-center text-sm py-4`}>No chat history.</p>}
            {conversationList.sort((a,b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0)).map(conv => (
              <div key={conv.id} className={`flex items-center justify-between cursor-pointer p-2.5 rounded-lg ${conversationId === conv.id ? (isIlluminateEnabled ? 'bg-blue-100 text-blue-700' : 'bg-blue-700 text-white') : (isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-700' : `text-gray-300 hover:bg-gray-700/60`)}`} onClick={() => handleSelectConversation(conv.id)}>
                <div className="flex items-center gap-2 flex-1 min-w-0"><MessageCircle className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{conv.chatName}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ContextDialog isOpen={isContextDialogOpen} onClose={() => setIsContextDialogOpen(false)} onSave={async (context) => { if(user) await saveUserContext(user.uid, context); setIsContextDialogOpen(false); }} initialContext={userContext} isIlluminateEnabled={isIlluminateEnabled} />
    </div>
  );
}
