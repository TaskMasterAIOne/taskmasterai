/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, PlusCircle, Edit, Trash, CheckCircle, MessageCircle, BrainCircuit, Crown, RotateCcw, X, TimerIcon, Send, Settings2, SkipForward, Zap, Link2, StickyNote, History, Volume2, VolumeX, Maximize2, Brain, Coffee, Smile, Meh, Frown, TrendingUp, BookOpen, Award, Headphones, Wind, SunDim, Star as StarIcon, Flame, Volume1, Waves, CloudRain, Music2 as LofiIcon, Bird as ForestIcon, Flame as FireplaceIcon
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
} from '../lib/dashboard-firebase';

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
  calculateXpForSession,
  updateUserTotalXp,
  onUserStreakDataSnapshot,
  type UserStreakData,
  getUserPomodoroSettings,
  saveUserPomodoroSettings,
  type UserPomodoroSettings
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
import { AMBIENT_SOUND_FILES, type AmbientSound as AmbientSoundFile } from '../lib/ambientSounds';


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
interface LinkableProductivityItem { id: string; name: string; type: string; collection: 'tasks' | 'goals' | 'projects' | 'plans'; }

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECONDS = 5 * 60;
const DEFAULT_LONG_BREAK_SECONDS = 15 * 60;
const DEFAULT_CYCLES_GOAL = 4;

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

const NOTIFICATION_SOUND_URL = 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ios-17-ringtone-tilt-gg8jzmiv_pUhS32fz.mp3?alt=media&token=a0a522e0-8a49-408a-9dfe-17e41d3bc801';


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
      if (jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
      return { text: null, error: errorMessage, finishReason: 'BLOCKED' };
    }
    if (jsonResponse?.candidates?.[0]) {
      const candidate = jsonResponse.candidates[0];
      reason = candidate.finishReason || null;
      if (candidate.content?.parts?.[0]?.text) {
        textContent = candidate.content.parts[0].text;
      }
      if (!textContent && !errorMessage) {
        if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
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
    } catch (e) { }
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
  const [userStreakData, setUserStreakData] = useState<UserStreakData | null>({ current: 0, longest: 0, lastFocusTimestamp: null });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));


  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeSession, setActiveSession] = useState<FocusSessionData | null>(null);
  const activeSessionRef = useRef<FocusSessionData | null>(null);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_SECONDS);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

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

  const [selectedAmbientSoundInfo, setSelectedAmbientSoundInfo] = useState<AmbientSoundFile | null>(
    AMBIENT_SOUND_FILES.find(s => s.id === 'none') || null
  );
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

  const formatTime = useCallback((totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${String(hours).padStart(1, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!notificationSoundRef.current) {
      notificationSoundRef.current = new Audio(NOTIFICATION_SOUND_URL);
    }
    notificationSoundRef.current.loop = false;
    notificationSoundRef.current.currentTime = 0;
    notificationSoundRef.current.play().catch(e => console.warn("Notification audio play failed:", e));
  }, []);

  const stopNotificationSound = useCallback(() => {
    if (notificationSoundRef.current && !notificationSoundRef.current.paused) {
      notificationSoundRef.current.pause();
      notificationSoundRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User";
        setUserName(name);
        updateDashboardLastSeen(firebaseUser.uid);

        const userPomodoroSettings: UserPomodoroSettings | null = await getUserPomodoroSettings(firebaseUser.uid);
        if (userPomodoroSettings) {
          setPomodoroWorkSetting(userPomodoroSettings.workSeconds);
          setPomodoroShortBreakSetting(userPomodoroSettings.shortBreakSeconds);
          setPomodoroLongBreakSetting(userPomodoroSettings.longBreakSeconds);
          setPomodoroCyclesGoalSetting(userPomodoroSettings.cyclesGoal);
          if (!activeSessionRef.current) {
            setTimeLeft(userPomodoroSettings.workSeconds);
          }
        } else {
          setPomodoroWorkSetting(DEFAULT_WORK_SECONDS);
          setPomodoroShortBreakSetting(DEFAULT_SHORT_BREAK_SECONDS);
          setPomodoroLongBreakSetting(DEFAULT_LONG_BREAK_SECONDS);
          setPomodoroCyclesGoalSetting(DEFAULT_CYCLES_GOAL);
          if (!activeSessionRef.current) {
            setTimeLeft(DEFAULT_WORK_SECONDS);
          }
        }

        const tier = await getUserTier(firebaseUser.uid, firebaseUser.email);
        setUserTier(tier);
        const limit = getChatLimitForTier(tier);
        setChatLimit(limit);
        setCurrentChatLimitDisplay(limit === Infinity ? '∞' : limit);

        if (tier !== 'premium') {
          const usage = await getCurrentMonthUserChatUsage(firebaseUser.uid, new Date().toISOString().slice(0, 7));
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
          setFocusHistory(sessions.filter(s => ['completed', 'cancelled'].includes(s.status)).sort((a,b) => (b.endTime?.seconds || b.createdAt.seconds) - (a.endTime?.seconds || a.createdAt.seconds)));

          if (currentActive?.ambientSound) {
            const soundFile = AMBIENT_SOUND_FILES.find(f => f.name === currentActive.ambientSound!.name) || AMBIENT_SOUND_FILES[0];
            setSelectedAmbientSoundInfo(soundFile);
            setAmbientVolume(currentActive.ambientSound.volume ?? 0.5);
            if (currentActive.status === 'running' || currentActive.status === 'break_running') {
                if (soundFile && soundFile.id !== 'none') {
                    setIsSoundPlaying(true);
                } else {
                    setIsSoundPlaying(false);
                }
            } else {
                setIsSoundPlaying(false);
            }
          } else if (!currentActive) {
            setSelectedAmbientSoundInfo(AMBIENT_SOUND_FILES.find(s => s.id === 'none') || null);
            setIsSoundPlaying(false);
          }
        }, { includeCompleted: true, includeCancelled: true });

        onChatConversationsSnapshot(firebaseUser.uid, (conversations) => setConversationList(conversations.map(c => ({ ...c, key: c.id }))));
        onUserContextChange(firebaseUser.uid, setUserContext);
        onUserTotalXpSnapshot(firebaseUser.uid, setTotalUserXp);
        onUserStreakDataSnapshot(firebaseUser.uid, setUserStreakData);

      } else {
        navigate('/login');
        setActiveSession(null); setCustomTimers([]); setUserProductivityItems([]); setFocusHistory([]);
        setConversationId(null); setConversationList([]); setChatHistory([]); setTotalUserXp(0); setUserStreakData(null);
        setPomodoroWorkSetting(DEFAULT_WORK_SECONDS);
        setPomodoroShortBreakSetting(DEFAULT_SHORT_BREAK_SECONDS);
        setPomodoroLongBreakSetting(DEFAULT_LONG_BREAK_SECONDS);
        setPomodoroCyclesGoalSetting(DEFAULT_CYCLES_GOAL);
        setTimeLeft(DEFAULT_WORK_SECONDS);
        stopNotificationSound();
        setIsSoundPlaying(false);
      }
    });
    return () => unsubscribeAuth();
  }, [navigate, stopNotificationSound]);


  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (activeSession) {
      setSessionNotes(activeSession.notes || "");
      setSelectedLinkedItemId(activeSession.linkedItemId || null);
      setSessionGoalText(activeSession.sessionGoalText || "");

      if (activeSession.ambientSound) {
        const soundInfo = AMBIENT_SOUND_FILES.find(f => f.name === activeSession.ambientSound!.name);
        if (soundInfo && selectedAmbientSoundInfo?.id !== soundInfo.id) {
            setSelectedAmbientSoundInfo(soundInfo);
        }
        if (typeof activeSession.ambientSound.volume === 'number' && ambientVolume !== activeSession.ambientSound.volume) {
            setAmbientVolume(activeSession.ambientSound.volume);
        }
      } else if (!activeSession.ambientSound && selectedAmbientSoundInfo?.id !== 'none') {
          setSelectedAmbientSoundInfo(AMBIENT_SOUND_FILES.find(s => s.id === 'none') || null);
      }

      let targetDurationForCurrentPhase = 0;
      const progressInCurrentSegment = Number(activeSession.currentSegmentProgressSeconds || 0);

      if (activeSession.status === 'running' || activeSession.status === 'paused') {
        targetDurationForCurrentPhase = activeSession.type === 'pomodoro'
          ? (activeSession.pomodoroWorkSeconds ?? pomodoroWorkSetting)
          : (activeSession.plannedDurationSeconds ?? DEFAULT_WORK_SECONDS);
      } else if (activeSession.status === 'break_running' || activeSession.status === 'break_paused') {
        targetDurationForCurrentPhase = activeSession.isLongBreakNext
          ? (activeSession.pomodoroLongBreakSeconds ?? pomodoroLongBreakSetting)
          : (activeSession.pomodoroShortBreakSeconds ?? pomodoroShortBreakSetting);
      } else {
          setTimeLeft(pomodoroWorkSetting);
          if (['completed', 'cancelled'].includes(activeSession.status)) {
            stopNotificationSound();
          }
          return;
      }

      let timeRemainingInSegment = targetDurationForCurrentPhase - progressInCurrentSegment;

      if (activeSession.status === 'running' || activeSession.status === 'break_running') {
        const timeElapsedSinceStartTime = activeSession.startTime ? (Timestamp.now().seconds - activeSession.startTime.seconds) : 0;
        const currentDisplayTimeLeft = Math.max(0, timeRemainingInSegment - timeElapsedSinceStartTime);
        setTimeLeft(currentDisplayTimeLeft);

        if (currentDisplayTimeLeft > 0) {
            startUiTimer();
        } else {
            handleTimerEnd();
        }
      } else if (activeSession.status === 'paused' || activeSession.status === 'break_paused') {
        setTimeLeft(Math.max(0, timeRemainingInSegment));
      }
    } else {
      setTimeLeft(pomodoroWorkSetting);
      if (selectedAmbientSoundInfo?.id !== 'none') {
        setSelectedAmbientSoundInfo(AMBIENT_SOUND_FILES.find(s => s.id === 'none') || null);
      }
      stopNotificationSound();
    }

    if (activeSession && (activeSession.status === 'break_running' || activeSession.status === 'break_paused')) {
      if (!currentMindfulSuggestion || activeSession.pauseTime) {
        setCurrentMindfulSuggestion(MINDFUL_BREAK_SUGGESTIONS[Math.floor(Math.random() * MINDFUL_BREAK_SUGGESTIONS.length)]);
      }
    } else {
      setCurrentMindfulSuggestion("");
    }

    return () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };
  }, [activeSession, pomodoroWorkSetting, pomodoroShortBreakSetting, pomodoroLongBreakSetting]);


  const startUiTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          handleTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimerEnd = async () => {
    if (!activeSessionRef.current || !user || !activeSessionRef.current.id) {
        console.warn("handleTimerEnd called with no active session or user or session ID");
        return;
    }
    const currentSessionStateForCalc = { ...activeSessionRef.current };

    if (currentSessionStateForCalc.status !== 'running' && currentSessionStateForCalc.status !== 'break_running') {
        console.warn(`handleTimerEnd called for session not in 'running' or 'break_running' state: ${currentSessionStateForCalc.status}`);
        return;
    }

    let updates: Partial<FocusSessionData> = { currentSegmentProgressSeconds: 0 };
    const now = Timestamp.now();
    let phaseDurationJustCompleted = 0;

    if (currentSessionStateForCalc.status === 'running') {
      playNotificationSound();
      phaseDurationJustCompleted = currentSessionStateForCalc.type === 'pomodoro'
        ? (currentSessionStateForCalc.pomodoroWorkSeconds ?? pomodoroWorkSetting)
        : (currentSessionStateForCalc.plannedDurationSeconds ?? DEFAULT_WORK_SECONDS);
      updates.accumulatedFocusSeconds = (currentSessionStateForCalc.accumulatedFocusSeconds || 0) + phaseDurationJustCompleted;

      if (currentSessionStateForCalc.type === 'pomodoro') {
        updates.status = 'break_running';
        updates.startTime = now;
        const workSegmentNumberJustFinished = (currentSessionStateForCalc.currentCycle || 0) + 1;
        updates.isLongBreakNext = workSegmentNumberJustFinished % (currentSessionStateForCalc.pomodoroCyclesGoal || pomodoroCyclesGoalSetting) === 0;
      } else {
        updates.status = 'completed';
        updates.endTime = now;
        updates.startTime = null;
        setIsSoundPlaying(false);

        const completedSessionDataForFeedback: FocusSessionData = {
          ...currentSessionStateForCalc,
          ...updates,
          status: 'completed',
          endTime: now,
        };
        setCompletedSessionForFeedback(completedSessionDataForFeedback);
        setShowPostSessionModal(true);
      }
    } else if (currentSessionStateForCalc.status === 'break_running') {
      stopNotificationSound();
      phaseDurationJustCompleted = currentSessionStateForCalc.isLongBreakNext
        ? (currentSessionStateForCalc.pomodoroLongBreakSeconds ?? pomodoroLongBreakSetting)
        : (currentSessionStateForCalc.pomodoroShortBreakSeconds ?? pomodoroShortBreakSetting);
      updates.accumulatedBreakSeconds = (currentSessionStateForCalc.accumulatedBreakSeconds || 0) + phaseDurationJustCompleted;

      const newCompletedCycleCount = (currentSessionStateForCalc.currentCycle || 0) + 1;
      updates.currentCycle = newCompletedCycleCount;

      if (currentSessionStateForCalc.type === 'pomodoro' && newCompletedCycleCount >= (currentSessionStateForCalc.pomodoroCyclesGoal || pomodoroCyclesGoalSetting)) {
        playNotificationSound();
        updates.status = 'completed';
        updates.endTime = now;
        updates.startTime = null;
        updates.isLongBreakNext = false;
        setIsSoundPlaying(false);

        const completedSessionDataForFeedback: FocusSessionData = {
          ...currentSessionStateForCalc,
          ...updates,
          status: 'completed',
          endTime: now,
          currentCycle: newCompletedCycleCount,
        };
        setCompletedSessionForFeedback(completedSessionDataForFeedback);
        setShowPostSessionModal(true);
      } else if (currentSessionStateForCalc.type === 'pomodoro') {
        updates.status = 'running';
        updates.startTime = now;
        updates.isLongBreakNext = false;
        if (selectedAmbientSoundInfo?.id !== 'none' && selectedAmbientSoundInfo?.src) {
            setIsSoundPlaying(true);
        }
      } else {
        console.error("Reached unexpected state in handleTimerEnd for non-pomodoro break.");
        updates.status = 'cancelled';
        updates.endTime = now;
        updates.startTime = null;
        setIsSoundPlaying(false);
      }
    }

    if (activeSessionRef.current && activeSessionRef.current.id) {
        await updateFocusSession(activeSessionRef.current.id, updates);
    } else {
        console.error("Session ID became null before update in handleTimerEnd");
    }
  };

  const handleStartPauseResume = async () => {
    if (!user) return;
    const now = Timestamp.now();

    if (!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) {
      stopNotificationSound();
      setShowPreFocusModal(true);
    } else {
      if (!activeSession.id) {
        console.error("Cannot pause/resume: Active session has no ID.");
        return;
      }
      let updates: Partial<FocusSessionData> = {};
      const timeElapsedInCurrentRunningSegment = activeSession.startTime ? Math.max(0, now.seconds - activeSession.startTime.seconds) : 0;

      if (['running', 'break_running'].includes(activeSession.status)) {
        updates.status = activeSession.status === 'running' ? 'paused' : 'break_paused';
        updates.currentSegmentProgressSeconds = (activeSession.currentSegmentProgressSeconds || 0) + timeElapsedInCurrentRunningSegment;
        updates.pauseTime = now;
        updates.startTime = null;
        setIsSoundPlaying(false);
        stopNotificationSound();
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
      } else if (['paused', 'break_paused'].includes(activeSession.status)) {
        updates.status = activeSession.status === 'paused' ? 'running' : 'break_running';
        updates.startTime = now;
        updates.pauseTime = null;
        if (updates.status === 'running') {
            stopNotificationSound();
        }
        if (selectedAmbientSoundInfo?.src && selectedAmbientSoundInfo.id !== 'none') {
             setIsSoundPlaying(true);
        }
      }
      await updateFocusSession(activeSession.id, updates);
    }
  };

  const startNewPomodoroSessionFromModal = async () => {
    if (!user) return;
    stopNotificationSound();
    const linkedItem = selectedLinkedItemId ? userProductivityItems.find(i => i.id === selectedLinkedItemId) : null;
    const ambientSoundToSave = selectedAmbientSoundInfo && selectedAmbientSoundInfo.id !== 'none'
      ? { name: selectedAmbientSoundInfo.name, src: selectedAmbientSoundInfo.src, volume: ambientVolume }
      : null;

    const newSessionInput: CreatePomodoroSessionInput = {
      type: 'pomodoro',
      timerName: linkedItem ? `Focus: ${linkedItem.name}` : 'Pomodoro Session',
      pomodoroWorkSeconds: pomodoroWorkSetting,
      pomodoroShortBreakSeconds: pomodoroShortBreakSetting,
      pomodoroLongBreakSeconds: pomodoroLongBreakSetting,
      pomodoroCyclesGoal: pomodoroCyclesGoalSetting,
      startTime: Timestamp.now(),
      currentCycle: 0,
      linkedItemId: linkedItem?.id || null,
      linkedItemName: linkedItem?.name || null,
      linkedItemCollection: linkedItem?.collection || null,
      notes: sessionNotes || null,
      sessionGoalText: sessionGoalText || null,
      preFocusCheckIn: { mood: preFocusMood, energyLevel: preFocusEnergy, customInput: null },
      ambientSound: ambientSoundToSave,
    };
    await createFocusSession(user.uid, newSessionInput);
    setShowPreFocusModal(false);
    setPreFocusMood(null);
    setPreFocusEnergy(3);
    setSessionGoalText("");
    setSessionNotes("");
    setSelectedLinkedItemId(null);
    if (ambientSoundToSave) {
      setIsSoundPlaying(true);
    } else {
      setIsSoundPlaying(false);
    }
  };

  const handleStartCustomTimerSession = async (timer: CustomTimer) => {
    if (!user) return;
    stopNotificationSound();
    if (activeSession && !['completed', 'cancelled'].includes(activeSession.status) && activeSession.id) {
      await handleReset();
    }
    const linkedItem = selectedLinkedItemId ? userProductivityItems.find(i => i.id === selectedLinkedItemId) : null;
    const ambientSoundToSave = selectedAmbientSoundInfo && selectedAmbientSoundInfo.id !== 'none'
      ? { name: selectedAmbientSoundInfo.name, src: selectedAmbientSoundInfo.src, volume: ambientVolume }
      : null;

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
      ambientSound: ambientSoundToSave,
    };
    await createFocusSession(user.uid, newSessionInput);
    setSessionGoalText("");
    setSessionNotes("");
    setSelectedLinkedItemId(null);
    if (ambientSoundToSave) {
      setIsSoundPlaying(true);
    } else {
      setIsSoundPlaying(false);
    }
  };

  const handleReset = async () => {
    if (!activeSession || !user || !activeSession.id) return;
    stopNotificationSound();
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }
    const now = Timestamp.now();

    let finalAccumulatedFocus = activeSession.accumulatedFocusSeconds || 0;
    let finalAccumulatedBreak = activeSession.accumulatedBreakSeconds || 0;

    if (activeSession.startTime && (activeSession.status === 'running' || activeSession.status === 'break_running')) {
      const timeElapsedInCurrentSegment = Math.max(0, now.seconds - activeSession.startTime.seconds);
      if (activeSession.status === 'running') {
        finalAccumulatedFocus += timeElapsedInCurrentSegment;
      } else {
        finalAccumulatedBreak += timeElapsedInCurrentSegment;
      }
    }

    const sessionToCalculateXp: FocusSessionData = {
      ...activeSession,
      status: 'cancelled',
      accumulatedFocusSeconds: finalAccumulatedFocus,
      sessionGoalAchieved: false,
    };
    const xpFromCancelled = calculateXpForSession(sessionToCalculateXp);

    const updates: Partial<FocusSessionData> = {
      status: 'cancelled',
      startTime: null,
      endTime: now,
      pauseTime: null,
      accumulatedFocusSeconds: finalAccumulatedFocus,
      accumulatedBreakSeconds: finalAccumulatedBreak,
      currentCycle: activeSession.type === 'pomodoro' ? activeSession.currentCycle : null,
      isLongBreakNext: false,
      currentSegmentProgressSeconds: 0,
      xpEarned: xpFromCancelled,
    };
    await updateFocusSession(activeSession.id, updates);
    if (xpFromCancelled > 0) {
      await updateUserTotalXp(user.uid, xpFromCancelled);
    }

    setIsSoundPlaying(false);
    setSessionGoalText("");
    setSessionNotes("");
    setSelectedLinkedItemId(null);
    setTimeLeft(pomodoroWorkSetting);
  };

  const handleSkipBreak = async () => {
    if (!activeSession || !user || !activeSession.id || activeSession.type !== 'pomodoro' || !['break_running', 'break_paused'].includes(activeSession.status)) return;
    stopNotificationSound();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const now = Timestamp.now();

    let totalSkippedBreakProgress = activeSession.currentSegmentProgressSeconds || 0;
    if (activeSession.status === 'break_running' && activeSession.startTime) {
      totalSkippedBreakProgress += Math.max(0, now.seconds - activeSession.startTime.seconds);
    }

    const newCompletedCycleCount = (activeSession.currentCycle || 0) + 1;
    const cyclesGoal = activeSession.pomodoroCyclesGoal || pomodoroCyclesGoalSetting;

    let updates: Partial<FocusSessionData> = {
        accumulatedBreakSeconds: (activeSession.accumulatedBreakSeconds || 0) + totalSkippedBreakProgress,
        currentSegmentProgressSeconds: 0,
        pauseTime: null,
        currentCycle: newCompletedCycleCount,
    };

    if (newCompletedCycleCount >= cyclesGoal) {
      playNotificationSound();
      updates.status = 'completed';
      updates.endTime = now;
      updates.startTime = null;
      updates.isLongBreakNext = false;
      setIsSoundPlaying(false);

      const completedSessionDataForFeedback: FocusSessionData = {
        ...activeSession,
        ...updates,
        status: 'completed',
        endTime: now,
        currentCycle: newCompletedCycleCount,
      };
      setCompletedSessionForFeedback(completedSessionDataForFeedback);
      setShowPostSessionModal(true);

    } else {
      updates.status = 'running';
      updates.startTime = now;
      updates.isLongBreakNext = false;
      if (selectedAmbientSoundInfo?.src && selectedAmbientSoundInfo.id !== 'none') {
        setIsSoundPlaying(true);
      } else {
        setIsSoundPlaying(false);
      }
    }
    await updateFocusSession(activeSession.id, updates);
  };

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled);}, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled));}, [isSidebarBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); document.body.classList.toggle('illuminate-mode', isIlluminateEnabled); if (isIlluminateEnabled) document.body.classList.remove('blackout-mode'); else if (isBlackoutEnabled) document.body.classList.add('blackout-mode');}, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled));}, [isSidebarIlluminateEnabled]);


  const totalFocusedTimeToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = Timestamp.fromDate(todayStart);

    return focusHistory
      .filter(s => (s.status === 'completed' || (s.status === 'cancelled' && (s.accumulatedFocusSeconds || 0) > 0)) && s.createdAt && s.createdAt.seconds >= todayStartTimestamp.seconds)
      .reduce((total, s) => total + (s.accumulatedFocusSeconds || 0), 0);
  }, [focusHistory]);

  const handleSavePomodoroSettings = async () => {
    if (!user) return;
    const newSettings: Omit<UserPomodoroSettings, 'updatedAt'> = {
      workSeconds: pomodoroWorkSetting,
      shortBreakSeconds: pomodoroShortBreakSetting,
      longBreakSeconds: pomodoroLongBreakSetting,
      cyclesGoal: pomodoroCyclesGoalSetting
    };
    await saveUserPomodoroSettings(user.uid, newSettings);
    if (!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) {
      setTimeLeft(pomodoroWorkSetting);
    }
    setShowSettingsModal(false);
  };

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
    if (window.confirm("Are you sure you want to delete this timer?")) {
      await deleteCustomTimer(timerId);
    }
  };

  const handleLinkItemChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    setSelectedLinkedItemId(itemId || null);
    if (activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
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
    if (activeSession && activeSession.id && user && !['completed', 'cancelled'].includes(activeSession.status)) {
      await addNoteToFocusSession(activeSession.id, sessionNotes || null);
    }
  };
  const handleSessionGoalTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSessionGoalText(e.target.value);
    if (activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
      updateFocusSession(activeSession.id, { sessionGoalText: e.target.value || null });
    }
  };

  const handleSubmitPostSessionFeedback = async () => {
    if (completedSessionForFeedback && completedSessionForFeedback.id && user) {
      stopNotificationSound();
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
      const soundToPlay = selectedAmbientSoundInfo;
      const shouldAudioBePlaying = isSoundPlaying && soundToPlay && soundToPlay.src && soundToPlay.id !== 'none';

      if (shouldAudioBePlaying) {
        if (audioRef.current.src !== soundToPlay.src) {
          audioRef.current.src = soundToPlay.src;
        }
        audioRef.current.loop = true;
        audioRef.current.volume = ambientVolume;

        if(audioRef.current.paused || audioRef.current.ended || audioRef.current.HAVE_NOTHING || (audioRef.current.src !== soundToPlay.src && audioRef.current.currentSrc !== soundToPlay.src) ) {
            if (audioRef.current.src !== soundToPlay.src) audioRef.current.src = soundToPlay.src;
            audioRef.current.play().catch(e => console.warn("Ambient audio play failed:", e, soundToPlay.src));
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [selectedAmbientSoundInfo, isSoundPlaying, ambientVolume]);


  const handleAmbientSoundChange = async (soundId: string) => {
    const soundFile = AMBIENT_SOUND_FILES.find(s => s.id === soundId) || AMBIENT_SOUND_FILES.find(s => s.id === 'none')!;
    setSelectedAmbientSoundInfo(soundFile);

    const soundToSetForFirebase = soundFile && soundFile.id !== 'none'
      ? { name: soundFile.name, src: soundFile.src, volume: ambientVolume }
      : null;

    if (activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
      await updateSessionAmbientSound(activeSession.id, soundToSetForFirebase);
    }

    if (soundToSetForFirebase && soundToSetForFirebase.src) {
        if (activeSession && (activeSession.status === 'running' || activeSession.status === 'break_running')) {
            setIsSoundPlaying(true);
        } else if (isSoundPlaying) {
            setIsSoundPlaying(true);
        } else {
             setIsSoundPlaying(false);
        }
    } else {
        setIsSoundPlaying(false);
    }
  };

  const toggleSoundPlay = () => {
    if (!selectedAmbientSoundInfo || selectedAmbientSoundInfo.id === 'none' || !selectedAmbientSoundInfo.src) {
      setIsSoundPlaying(false);
      return;
    }
    setIsSoundPlaying(prev => !prev);
  };

  const handleVolumeChange = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setAmbientVolume(clampedVolume);

    if (selectedAmbientSoundInfo && selectedAmbientSoundInfo.id !== 'none' && activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
      const updatedSoundDataForFirebase = { name: selectedAmbientSoundInfo.name, src: selectedAmbientSoundInfo.src, volume: clampedVolume };
      updateSessionAmbientSound(activeSession.id, updatedSoundDataForFirebase);
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
${activeSession.type === 'pomodoro' ? `Cycle: ${(activeSession.currentCycle || 0) + 1}/${activeSession.pomodoroCyclesGoal || pomodoroCyclesGoalSetting}` : ''}
${activeSession.timerName ? `Timer Name: ${activeSession.timerName}` : ''}
Time Left in current phase: ${formatTime(timeLeft)}
Linked Item: ${activeSession.linkedItemName || 'None'} (Linked Item ID: ${activeSession.linkedItemId || 'None'})
Ambient Sound: ${selectedAmbientSoundInfo?.name || 'None'}
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

General Conversation & Focus Tips: Engage naturally. Provide actionable focus advice.

Session Control (JSON): If asked to start, stop, pause, manage timers, or link items, respond with brief confirmation text then JSON: \`\`\`json
{"action":"actionName","payload":{...}}
\`\`\`

Actions: "start_focus_session", "pause_focus_session", "resume_focus_session", "end_focus_session", "skip_break", "reset_session", "link_item_to_session", "set_session_goal", "change_ambient_sound", "add_session_note".

Payloads:

"start_focus_session": {type: "pomodoro" | "custom", durationMinutes?: number, timerName?: string, linkedItemName?: string /* or linkedItemId */, sessionGoal?: string}

"link_item_to_session": {itemName: "Name of item" /* or itemId: "ID of item" */}

"set_session_goal": {goalText: "The user's goal"}

"change_ambient_sound": {soundName: "None" | "${AMBIENT_SOUND_FILES.filter(s => s.id !== 'none').map(s => s.name).join('" | "')}"} (case-insensitive match)

"add_session_note": {note: "User's note content"}

Others might be empty or identify session.

Timer Adjustments (Conceptual): If user mentions fatigue or task difficulty, you can suggest changes like "Would you like to try a shorter 20-minute cycle for this task?" but DO NOT output JSON to directly change timer settings without explicit confirmation.

If no specific action, provide helpful text. Be concise and encouraging.
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
                stopNotificationSound();
                if (user && activeSession && !['completed', 'cancelled', 'idle'].includes(activeSession.status) && activeSession.id) {
                  await handleReset();
                }
                const { type, durationMinutes, timerName, linkedItemName, linkedItemId, sessionGoal } = block.payload;
                let itemToLink = linkedItemId
                  ? userProductivityItems.find(i => i.id === linkedItemId)
                  : (linkedItemName ? userProductivityItems.find(i => i.name.toLowerCase() === String(linkedItemName).toLowerCase()) : null);

                const ambientSoundForAISession = selectedAmbientSoundInfo && selectedAmbientSoundInfo.id !== 'none'
                  ? { name: selectedAmbientSoundInfo.name, src: selectedAmbientSoundInfo.src, volume: ambientVolume }
                  : null;

                if (type === 'pomodoro') {
                  const newSessionDataAI: CreatePomodoroSessionInput = {
                    type: 'pomodoro',
                    timerName: timerName || (itemToLink ? `Focus: ${itemToLink.name}` : 'Pomodoro (AI)'),
                    pomodoroWorkSeconds: pomodoroWorkSetting,
                    pomodoroShortBreakSeconds: pomodoroShortBreakSetting,
                    pomodoroLongBreakSeconds: pomodoroLongBreakSetting,
                    pomodoroCyclesGoal: pomodoroCyclesGoalSetting,
                    currentCycle: 0,
                    startTime: Timestamp.now(),
                    linkedItemId: itemToLink?.id || null, linkedItemName: itemToLink?.name || null, linkedItemCollection: itemToLink?.collection || null,
                    notes: null, sessionGoalText: sessionGoal || null,
                    preFocusCheckIn: null,
                    ambientSound: ambientSoundForAISession,
                  };
                  await createFocusSession(user.uid, newSessionDataAI);
                  if (ambientSoundForAISession) setIsSoundPlaying(true); else setIsSoundPlaying(false);
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
                    ambientSound: ambientSoundForAISession,
                  };
                  await createFocusSession(user.uid, newSessionDataAI);
                  if (ambientSoundForAISession) setIsSoundPlaying(true); else setIsSoundPlaying(false);
                  successMessage = `Started ${durationMinutes} minute timer ${itemToLink ? `for ${itemToLink.name}` : ''} ${sessionGoal ? ` (Goal: ${sessionGoal})` : ''}.`;
                } else {
                  throw new Error("Invalid parameters for AI to start session.");
                }
              } else if (block.action === "add_session_note" && activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
                await addNoteToFocusSession(activeSession.id, block.payload.note || null);
                setSessionNotes(block.payload.note || "");
                successMessage = "Note added to current session.";
              } else if (block.action === "link_item_to_session" && activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
                const { itemName, itemId } = block.payload;
                const itemToLink = itemId
                  ? userProductivityItems.find(i => i.id === itemId)
                  : (itemName ? userProductivityItems.find(i => i.name.toLowerCase() === String(itemName)?.toLowerCase()) : null);

                if (itemToLink) {
                  await updateFocusSession(activeSession.id, { linkedItemId: itemToLink.id, linkedItemName: itemToLink.name, linkedItemCollection: itemToLink.collection });
                  setSelectedLinkedItemId(itemToLink.id);
                  successMessage = `Linked "${itemToLink.name}" to current session.`;
                } else { throw new Error(`Could not find item: ${itemName || itemId}`); }
              } else if (block.action === "set_session_goal" && activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status)) {
                await updateFocusSession(activeSession.id, { sessionGoalText: block.payload.goalText || null });
                setSessionGoalText(block.payload.goalText || "");
                successMessage = `Session goal set to: "${block.payload.goalText}"`;
              } else if (block.action === "change_ambient_sound") {
                const soundFile = AMBIENT_SOUND_FILES.find(s => s.name.toLowerCase() === String(block.payload.soundName)?.toLowerCase());
                if (soundFile) {
                  await handleAmbientSoundChange(soundFile.id);
                  successMessage = `Ambient sound changed to ${soundFile.name}.`;
                } else { throw new Error(`Sound "${block.payload.soundName}" not found.`); }
              }
              else if (["pause_focus_session", "resume_focus_session", "end_focus_session", "skip_break", "reset_session"].includes(block.action) && activeSession && activeSession.id && !['completed', 'cancelled', 'idle'].includes(activeSession.status)) {
                if (block.action === "pause_focus_session" && (activeSession.status === 'running' || activeSession.status === 'break_running')) { await handleStartPauseResume(); }
                else if (block.action === "resume_focus_session" && (activeSession.status === 'paused' || activeSession.status === 'break_paused')) { await handleStartPauseResume(); }
                else if (block.action === "end_focus_session" || block.action === "reset_session") { await handleReset(); }
                else if (block.action === "skip_break") { await handleSkipBreak(); }
                else { throw new Error(`Cannot perform '${block.action}' in current session state: ${activeSession.status}. Session might be inactive.`); }
                successMessage = `Session action '${block.action}' processed.`;
              } else if (activeSession && (activeSession.status === 'completed' || activeSession.status === 'cancelled' || activeSession.status === 'idle') && ["pause_focus_session", "resume_focus_session", "end_focus_session", "skip_break", "reset_session"].includes(block.action)) {
                throw new Error(`Cannot perform '${block.action}' as session is not active or already ended.`);
              } else if (!activeSession || !activeSession.id) {
                 throw new Error(`Cannot perform '${block.action}' as there is no active session or session ID.`);
              }
              actionDetails = { status: 'success', message: successMessage };
              if (!cleanedText && successMessage) assistantText = successMessage;
            } catch (err: any) {
              console.error("AI Action failed:", block.action, err);
              actionDetails = { status: 'error', message: `Action '${block.action}' failed: ${err.message}` };
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
      if (currentConvId && currentConvInfo?.chatName?.startsWith("New Focus Chat") && (!hasGeneratedChatName || totalUserMessagesInConv <= 2)) {
        const newName = `Focus ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        await updateChatConversationName(currentConvId, newName);
        setHasGeneratedChatName(true);
      }

    } catch (err: any) {
      console.error("Error in handleChatSubmit (Gemini API call):", err);
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

  const handleNewConversation = async () => { if (!user || !user.uid) return; const newConvId = await createChatConversation(user.uid, 'New Focus Chat'); if (newConvId) { setConversationId(newConvId); setAiChatSidebarTab('chat'); setHasGeneratedChatName(false); } };
  const handleSelectConversation = (convId: string) => { if (conversationId === convId && chatHistory.length > 0 && !isChatLoading) return; setConversationId(convId); setAiChatSidebarTab('chat'); const selConv = conversationList.find(c => c.id === convId); setHasGeneratedChatName(selConv ? !selConv.chatName?.startsWith("New Focus Chat") : false); };

  useEffect(() => {
    if (!conversationId) { setChatHistory([]); return; }
    const unsubMessages = onChatMessagesSnapshot(conversationId, (messagesFromDb: FirebaseChatMessage[]) => {
      setChatHistory(messagesFromDb.map(m => ({ id: m.id || `fb-${Date.now()}-${Math.random()}`, role: m.role, content: m.content, createdAt: m.createdAt, error: m.error, actionDetails: m.actionDetails as any } as ChatMessageDisplayData)));
    });
    return () => unsubMessages();
  }, [conversationId]);

  useEffect(() => {
    return () => {
      stopNotificationSound();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };
  }, [stopNotificationSound]);

  const containerClass = isIlluminateEnabled ? "bg-slate-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/80 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/60 shadow-lg shadow-black/20";
  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/70 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-800 placeholder-gray-400" : isBlackoutEnabled ? "bg-gray-800 hover:bg-gray-700/80 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500" : "bg-gray-700 hover:bg-gray-600/70 border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500";
  const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
  const illuminateTextBlue = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
  const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-600" : "text-yellow-400";
  const illuminateTextRed = isIlluminateEnabled ? "text-red-600" : "text-red-400";


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
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.9, y: 30, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const fsTheme = useMemo(() => {
    if (isIlluminateEnabled) return 'illuminate';
    if (isBlackoutEnabled) return 'blackout';
    return 'default';
  }, [isIlluminateEnabled, isBlackoutEnabled]);

  const fsBgColor = fsTheme === 'illuminate' ? 'bg-slate-100' : fsTheme === 'blackout' ? 'bg-black' : 'bg-gray-950';
  const fsTextColor = fsTheme === 'illuminate' ? 'text-gray-900' : 'text-gray-100';
  const fsSubtleTextColor = fsTheme === 'illuminate' ? 'text-gray-600' : 'text-gray-400';
  const fsCardBg = fsTheme === 'illuminate' ? 'bg-white/70' : fsTheme === 'blackout' ? 'bg-gray-900/70' : 'bg-gray-800/60';
  const fsInputBorder = fsTheme === 'illuminate' ? 'border-gray-400' : 'border-gray-600';
  const fsIconColor = fsTheme === 'illuminate' ? 'text-gray-600 hover:text-gray-800' : 'text-gray-400 hover:text-gray-200';

  const displayCycleNumber = useMemo(() => {
    if (!activeSession || activeSession.type !== 'pomodoro') return 1;
    return (activeSession.currentCycle || 0) + 1;
  }, [activeSession]);

  return (
    <div className={`${containerClass} min-h-screen w-full overflow-hidden relative font-sans`}>
      <Sidebar userName={userName} isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(p => !p)} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />
      <audio ref={audioRef} />
      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'} z-40 p-3.5 rounded-full shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-100 ${isIlluminateEnabled ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'} ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open Focus AI Chat">
        <BrainCircuit className="w-5 h-5" />
      </button>

      <motion.main
        layout
        className={`transition-transform duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64'}
                    ${isFullscreen ? `fixed inset-0 ml-0 !p-0 z-[45] flex flex-col items-stretch justify-start overflow-hidden ${fsBgColor} ${fsTextColor}` : `p-3 md:p-4 lg:p-5 xl:p-6 ${containerClass} overflow-x-hidden`}`}
        variants={fullscreenContainerVariants}
        animate={isFullscreen ? "fullscreen" : "normal"}
      >
        <AnimatePresence mode="wait">
          {isFullscreen ? (
            <motion.div
              key="fullscreen-content-new"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: "circOut" } }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2, ease: "circIn" } }}
              className={`w-full h-full flex flex-col items-center justify-between p-6 sm:p-8 selection:bg-blue-500 selection:text-white ${fsBgColor} ${fsTextColor}`}
            >
              <div className="w-full max-w-6xl mx-auto flex justify-between items-center pt-2">
                <div className="text-left">
                  <h1 className="text-xl sm:text-2xl font-bold flex items-center">
                    <TimerIcon className={`w-6 h-6 sm:w-7 sm:h-7 mr-2 ${fsTheme === 'illuminate' ? 'text-blue-600' : 'text-blue-400'}`} /> Focus Session
                  </h1>
                  {activeSession?.sessionGoalText && <p className={`text-xs sm:text-sm italic mt-1 ${fsSubtleTextColor}`}>Goal: {activeSession.sessionGoalText}</p>}
                </div>
                <button onClick={toggleFullscreen} className={`p-2.5 rounded-full transition-colors ${fsIconColor}`} title="Exit Fullscreen">
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center flex-grow w-full text-center">
                <motion.div
                  key={timeLeft + (activeSession?.status || 'idle') + "-fullscreen"}
                  initial={{ opacity: 0.8, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] xl:text-[12rem] font-mono font-bold mb-4 tabular-nums transition-colors duration-300
                                ${(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused')
                      ? (fsTheme === 'illuminate' ? 'text-green-600' : 'text-green-400')
                      : (fsTheme === 'illuminate' ? 'text-blue-600' : 'text-blue-400')}`}
                >
                  {formatTime(timeLeft)}
                </motion.div>

                <div className="mb-3 text-base sm:text-lg min-h-[24px] font-medium">
                  {activeSession?.status === 'running' && <span className={`${fsTheme === 'illuminate' ? 'text-gray-700' : 'text-gray-200'}`}>Focusing on: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                  {activeSession?.status === 'paused' && <span className={`italic ${fsSubtleTextColor}`}>Paused: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                  {(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && <span className={`${fsTheme === 'illuminate' ? 'text-green-700' : 'text-green-300'}`}>{activeSession.isLongBreakNext ? 'Long Break' : 'Short Break'} {activeSession.status === 'break_paused' && '(Paused)'}</span>}
                  {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <span className={`italic ${fsSubtleTextColor}`}>Ready to start a new session.</span>}
                </div>
                {activeSession?.type === 'pomodoro' && (activeSession.status === 'running' || activeSession.status === 'paused' || activeSession.status === 'break_running' || activeSession.status === 'break_paused') && <p className={`${fsSubtleTextColor} text-sm sm:text-base mb-6`}>Cycle {displayCycleNumber} of {activeSession.pomodoroCyclesGoal || pomodoroCyclesGoalSetting}</p>}

                <AnimatePresence>
                  {currentMindfulSuggestion && (activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
                      className={`p-3.5 my-4 rounded-lg text-sm italic max-w-md backdrop-blur-sm ${fsTheme === 'illuminate' ? 'bg-green-500/10 text-green-700 border border-green-500/20' : 'bg-green-500/10 text-green-300 border border-green-500/30'}`}>
                      <Coffee className="w-4 h-4 inline mr-2" /> {currentMindfulSuggestion}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 mt-4">
                  <button
                    onClick={handleStartPauseResume} disabled={!user || showPreFocusModal}
                    className={`px-6 py-3 sm:px-8 sm:py-3.5 text-lg sm:text-xl font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 sm:gap-2.5
                                ${(!activeSession || ['idle', 'paused', 'break_paused', 'completed', 'cancelled'].includes(activeSession.status))
                        ? (fsTheme === 'illuminate' ? 'bg-blue-500 text-white hover:bg-blue-600 focus-visible:ring-4 focus-visible:ring-blue-300' : 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-4 focus-visible:ring-blue-700')
                        : (fsTheme === 'illuminate' ? 'bg-yellow-500 text-black hover:bg-yellow-400 focus-visible:ring-4 focus-visible:ring-yellow-300' : 'bg-yellow-500 text-black hover:bg-yellow-400 focus-visible:ring-4 focus-visible:ring-yellow-600')
                      }`}
                  >
                    {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <><Play className="w-5 h-5 sm:w-6 sm:h-6" /> Start</>}
                    {(activeSession?.status === 'running' || activeSession?.status === 'break_running') && <><Pause className="w-5 h-5 sm:w-6 sm:h-6" /> Pause</>}
                    {(activeSession?.status === 'paused' || activeSession?.status === 'break_paused') && <><Play className="w-5 h-5 sm:w-6 sm:h-6" /> Resume</>}
                  </button>
                  <button onClick={handleReset} disabled={!activeSession || activeSession.status === 'idle' || !activeSession?.id} className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg transition-colors flex items-center gap-1.5 text-sm sm:text-base font-medium shadow-md disabled:opacity-50
                                    ${fsTheme === 'illuminate' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}><RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" /> Reset</button>
                  {activeSession?.type === 'pomodoro' && (activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && (
                    <button onClick={handleSkipBreak} className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg transition-colors flex items-center gap-1.5 text-sm sm:text-base font-medium shadow-md
                                        ${fsTheme === 'illuminate' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-800 text-green-200 hover:bg-green-700'}`}><SkipForward className="w-4 h-4 sm:w-5 sm:h-5" /> Skip Break</button>
                  )}
                </div>
              </div>

              <motion.div
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                className={`w-full max-w-3xl mx-auto mb-4 p-3 sm:p-4 rounded-xl shadow-xl backdrop-blur-md ${fsCardBg} border ${fsInputBorder}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-base sm:text-lg font-semibold ${fsTheme === 'illuminate' ? 'text-gray-700' : 'text-gray-300'}`}>Ambient Sound</h3>
                  {selectedAmbientSoundInfo && selectedAmbientSoundInfo.id !== 'none' && selectedAmbientSoundInfo.src && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button onClick={toggleSoundPlay} className={`p-2 rounded-full transition-colors ${fsIconColor}`}>
                        {isSoundPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={ambientVolume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className={`w-20 sm:w-28 h-2 rounded-lg appearance-none cursor-pointer ${fsTheme === 'illuminate' ? 'bg-gray-300 accent-blue-500' : 'bg-gray-600 accent-blue-500'}`}
                      />
                      <span className={`text-xs sm:text-sm w-10 text-right ${fsSubtleTextColor}`}>{Math.round(ambientVolume * 100)}%</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
                  {AMBIENT_SOUND_FILES.map(sound => {
                    const IconComponent = sound.icon;
                    const isSelected = selectedAmbientSoundInfo?.id === sound.id;
                    return (
                      <button
                        key={sound.id}
                        onClick={() => handleAmbientSoundChange(sound.id)}
                        title={sound.name}
                        className={`p-2.5 sm:p-3 rounded-lg flex flex-col items-center justify-center aspect-square transition-all duration-200 ease-out transform focus:outline-none focus:ring-2
                                            ${isSelected
                            ? (fsTheme === 'illuminate' ? 'bg-blue-500 text-white shadow-md scale-105 ring-blue-300' : 'bg-blue-600 text-white shadow-md scale-105 ring-blue-500')
                            : (fsTheme === 'illuminate' ? `bg-slate-200 hover:bg-slate-300 text-gray-700 ring-slate-400` : `bg-gray-700/70 hover:bg-gray-600/90 text-gray-300 hover:text-white ring-gray-500`)
                          }
                                            ${sound.id === 'none' && !isSelected && (fsTheme === 'illuminate' ? 'opacity-70 hover:opacity-100' : 'opacity-60 hover:opacity-90')}
                                            `}
                      >
                        <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-1.5 ${isSelected ? '' : (fsTheme === 'illuminate' ? 'text-gray-600' : 'text-gray-400')}`} />
                        <span className={`text-[10px] sm:text-xs font-medium truncate w-full text-center ${isSelected ? '' : (fsTheme === 'illuminate' ? 'text-gray-600' : 'text-gray-400')}`}>{sound.name}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedAmbientSoundInfo?.attribution && selectedAmbientSoundInfo.id !== 'none' && (
                  <p className={`text-[10px] text-center mt-2 ${fsSubtleTextColor}`}>Sound from {selectedAmbientSoundInfo.attribution}</p>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="normal-content"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fullscreenContentVariants}
              className="w-full"
            >
              <header className="mb-6">
                <div className="flex items-center justify-between">
                  <h1 className={`text-2xl md:text-3xl font-bold flex items-center ${headingClass}`}>
                    <TimerIcon className={`w-7 h-7 mr-2.5 ${illuminateTextBlue}`} /> Focus Mode
                  </h1>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowSettingsModal(true)} className={`p-2 rounded-full ${iconColor}`} title="Timer Settings"><Settings2 className="w-5 h-5" /></button>
                    <button onClick={toggleFullscreen} className={`p-2 rounded-full ${iconColor}`} title="Enter Fullscreen">
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className={`${subheadingClass} text-sm mt-1`}>Zone in and get things done, {truncatedName}.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  layout
                  className={`lg:col-span-2 flex flex-col items-center justify-center text-center ${cardClass} rounded-xl p-6 shadow-xl min-h-[500px]`}
                >
                  <motion.div
                    key={timeLeft + (activeSession?.status || 'idle') + "-normal"}
                    initial={{ opacity: 0.8, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-mono font-bold mb-4 tabular-nums transition-colors duration-300 ${(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') ? (isIlluminateEnabled ? 'text-green-600' : 'text-green-400') : illuminateTextBlue}`}
                  >
                    {formatTime(timeLeft)}
                  </motion.div>
                  <div className="mb-1 text-sm min-h-[20px] font-medium">
                    {activeSession?.status === 'running' && <span className={`${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'}`}>Focusing on: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                    {activeSession?.status === 'paused' && <span className={`italic ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Paused: {activeSession.linkedItemName || activeSession.timerName || "Work"}</span>}
                    {(activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && <span className={`${isIlluminateEnabled ? 'text-green-700' : 'text-green-300'}`}>{activeSession.isLongBreakNext ? 'Long Break' : 'Short Break'} {activeSession.status === 'break_paused' && '(Paused)'}</span>}
                    {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <span className={`italic ${subheadingClass}`}>Ready to start a new session.</span>}
                  </div>
                  {activeSession?.sessionGoalText && <p className={`text-xs italic mt-0.5 mb-2 ${subheadingClass}`}>Goal: {activeSession.sessionGoalText}</p>}
                  {activeSession?.type === 'pomodoro' && (activeSession.status === 'running' || activeSession.status === 'paused' || activeSession.status === 'break_running' || activeSession.status === 'break_paused') && <p className={`${subheadingClass} text-xs mb-4`}>Cycle {displayCycleNumber} of {activeSession.pomodoroCyclesGoal || pomodoroCyclesGoalSetting}</p>}

                  <AnimatePresence>
                    {currentMindfulSuggestion && (activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
                        className={`${cardClass} p-3 my-3.5 rounded-lg text-xs italic max-w-sm ${isIlluminateEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-green-900/40 text-green-300 border border-green-700/50'}`}>
                        <Coffee className="w-3.5 h-3.5 inline mr-1.5" /> {currentMindfulSuggestion}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-wrap justify-center items-center gap-3 mb-6 mt-2">
                    <button
                      onClick={handleStartPauseResume} disabled={!user || showPreFocusModal}
                      className={`px-6 py-3 text-lg font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2
                                            ${(!activeSession || ['idle', 'paused', 'break_paused', 'completed', 'cancelled'].includes(activeSession.status))
                          ? (isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2' : 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800')
                          : (isIlluminateEnabled ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2' : 'bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800')
                        }`}
                    >
                      {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && <><Play className="w-5 h-5" /> Start Focus</>}
                      {(activeSession?.status === 'running' || activeSession?.status === 'break_running') && <><Pause className="w-5 h-5" /> Pause</>}
                      {(activeSession?.status === 'paused' || activeSession?.status === 'break_paused') && <><Play className="w-5 h-5" /> Resume</>}
                    </button>
                    <button onClick={handleReset} disabled={!activeSession || activeSession.status === 'idle' || !activeSession?.id} className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium shadow-md ${isIlluminateEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-60' : 'bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-60'}`}><RotateCcw className="w-4 h-4" /> Reset/Cancel</button>
                    {activeSession?.type === 'pomodoro' && (activeSession?.status === 'break_running' || activeSession?.status === 'break_paused') && (
                      <button onClick={handleSkipBreak} className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium shadow-md ${isIlluminateEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-800 text-green-200 hover:bg-green-700'}`}><SkipForward className="w-4 h-4" /> Skip Break</button>
                    )}
                  </div>

                  {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                      className="w-full max-w-md mt-2 mb-4 overflow-hidden"
                    >
                      <label htmlFor="sessionGoal" className={`block text-sm font-medium mb-1.5 ${subheadingClass}`}>Set a Goal for this Session (Optional):</label>
                      <input type="text" id="sessionGoal" value={sessionGoalText} onChange={handleSessionGoalTextChange} placeholder="e.g., Finish chapter 1, Draft email" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                    </motion.div>
                  )}

                  <div className={`w-full max-w-md border-t pt-4 mt-4 ${isIlluminateEnabled ? 'border-gray-200/80' : 'border-gray-700/70'}`}>
                    <label htmlFor="linkItem" className={`block text-sm font-medium mb-1.5 ${subheadingClass}`}>Link to Item (Optional):</label>
                    <select id="linkItem" value={selectedLinkedItemId || ""} onChange={handleLinkItemChange} className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`}>
                      <option value="">-- Select an item --</option>
                      {userProductivityItems.map(item => (
                        <option key={item.id} value={item.id}>{item.type}: {item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full max-w-md mt-4">
                    <label htmlFor="sessionNotes" className={`block text-sm font-medium mb-1.5 ${subheadingClass}`}>Session Notes:</label>
                    <textarea id="sessionNotes" rows={2} value={sessionNotes} onChange={handleSessionNotesChange} placeholder="Key insights, blockers, next steps..." className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none`}></textarea>
                    {activeSession && activeSession.id && !['completed', 'cancelled'].includes(activeSession.status) && <button onClick={handleSaveSessionNotes} className={`mt-2 px-3 py-1.5 text-xs rounded-md transition-colors shadow ${isIlluminateEnabled ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-600'}`}>Save Notes</button>}
                  </div>
                </motion.div>

                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className={`${cardClass} rounded-xl p-5`}>
                    <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><Headphones className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Ambient Sound</h2>
                    <div className="flex items-center gap-2 mb-2.5">
                      <select value={selectedAmbientSoundInfo?.id || 'none'} onChange={(e) => handleAmbientSoundChange(e.target.value)} className={`${inputBg} flex-grow p-2.5 rounded-lg text-sm shadow-sm`}>
                        {AMBIENT_SOUND_FILES.map(sound => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
                      </select>
                      <button onClick={toggleSoundPlay} disabled={!selectedAmbientSoundInfo || selectedAmbientSoundInfo.id === "none" || !selectedAmbientSoundInfo.src} className={`p-2.5 rounded-full ${iconColor} disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {isSoundPlaying ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </button>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={ambientVolume} onChange={(e) => handleVolumeChange(parseFloat(e.target.value))} disabled={!selectedAmbientSoundInfo || selectedAmbientSoundInfo.id === "none" || !selectedAmbientSoundInfo.src} className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-blue-500' : 'bg-gray-700 accent-blue-500'} disabled:opacity-50 disabled:cursor-not-allowed`} />
                  </div>

                  <div className={`${cardClass} rounded-xl p-5`}>
                    <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><Zap className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Quick Stats</h2>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className={subheadingClass}>Focused Today:</span>
                        <span className={`font-semibold ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{formatTime(totalFocusedTimeToday)}</span>
                      </div>
                      {activeSession?.type === 'pomodoro' && activeSession.pomodoroCyclesGoal && (activeSession.status === 'running' || activeSession.status === 'paused' || activeSession.status === 'break_running' || activeSession.status === 'break_paused') && (
                        <div className="flex justify-between items-center">
                          <span className={subheadingClass}>Current Cycle:</span>
                          <span className={`font-semibold ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{displayCycleNumber} / {activeSession.pomodoroCyclesGoal || pomodoroCyclesGoalSetting}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className={subheadingClass}>Total XP:</span>
                        <motion.span key={totalUserXp} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`font-semibold flex items-center gap-1 ${illuminateTextYellow}`}>
                          <StarIcon className="w-3.5 h-3.5" /> {totalUserXp}
                        </motion.span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={subheadingClass}>Current Streak:</span>
                        <motion.span key={userStreakData?.current} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`font-semibold flex items-center gap-1 ${userStreakData && userStreakData.current > 0 ? illuminateTextRed : (isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200')}`}>
                          <Flame className="w-3.5 h-3.5" /> {userStreakData?.current || 0} days
                        </motion.span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardClass} rounded-xl p-5`}>
                    <div className="flex justify-between items-center mb-3">
                      <h2 className={`text-lg font-semibold flex items-center ${headingClass}`}><TimerIcon className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Timers</h2>
                      <button onClick={() => handleOpenCustomTimerModal()} className={`p-1.5 rounded-full ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700/60'}`} title="Add Timer"><PlusCircle className="w-5 h-5" /></button>
                    </div>
                    {customTimers.length === 0 && <p className={`${subheadingClass} text-sm italic`}>No timers yet.</p>}
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {customTimers.map(timer => (
                        <li key={timer.id} className={`p-2.5 rounded-lg flex items-center justify-between text-sm transition-colors shadow-sm ${isIlluminateEnabled ? 'bg-gray-50 hover:bg-gray-100 border border-gray-200' : 'bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50'}`}>
                          <div>
                            <span className={`font-medium ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100'}`}>{timer.data.name}</span>
                            <span className={`ml-2 text-xs ${subheadingClass}`}>({formatTime(timer.data.time)})</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleStartCustomTimerSession(timer)} className={`p-1.5 rounded-md ${isIlluminateEnabled ? 'text-green-600 hover:bg-green-100' : 'text-green-400 hover:bg-green-800/70'}`} title="Start this timer"><Play className="w-4 h-4" /></button>
                            <button onClick={() => handleOpenCustomTimerModal(timer)} className={`p-1.5 rounded-md ${iconColor}`} title="Edit"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteCustomTimer(timer.id)} className={`p-1.5 rounded-md ${isIlluminateEnabled ? 'text-red-500 hover:bg-red-100' : 'text-red-400 hover:bg-red-800/70'}`} title="Delete"><Trash className="w-4 h-4" /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`${cardClass} rounded-xl p-5`}>
                    <h2 className={`text-lg font-semibold mb-3 flex items-center ${headingClass}`}><History className={`w-5 h-5 mr-2 ${illuminateTextBlue}`} />Focus Log</h2>
                    {focusHistory.length === 0 && <p className={`${subheadingClass} text-sm italic`}>No completed or cancelled sessions yet.</p>}
                    <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs">
                      {focusHistory.map(session => (
                        <li key={session.id} className={`p-2 rounded-md shadow-sm ${session.status === 'cancelled' ? (isIlluminateEnabled ? 'bg-red-50/70 border border-red-200/60' : 'bg-red-900/30 border border-red-700/40') : (isIlluminateEnabled ? 'bg-gray-50 border border-gray-200/60' : 'bg-gray-700/40 border border-gray-600/40')}`}>
                          <div className="flex justify-between items-center">
                            <span className={`font-medium truncate ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`} title={session.timerName || (session.type === 'pomodoro' ? 'Pomodoro Session' : 'Custom Session')}>
                              {session.timerName || (session.type === 'pomodoro' ? 'Pomodoro' : 'Custom')} ({formatTime(session.accumulatedFocusSeconds || 0)})
                              {session.status === 'cancelled' && <span className={`ml-1 text-[10px] ${isIlluminateEnabled ? 'text-red-600' : 'text-red-400'}`}>(Cancelled)</span>}
                            </span>
                            <span className={subheadingClass}>{session.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {session.sessionGoalText && <p className={`mt-0.5 text-[11px] ${subheadingClass} truncate`}><Award className="w-2.5 h-2.5 inline mr-1" />Goal: {session.sessionGoalText} {session.sessionGoalAchieved === true ? '(Achieved ✅)' : session.sessionGoalAchieved === false ? '(Not Met ❌)' : ''}</p>}
                          {session.linkedItemName && <p className={`mt-0.5 text-[11px] ${subheadingClass} truncate`}><Link2 className="w-2.5 h-2.5 inline mr-1" />{session.linkedItemName}</p>}
                          {session.notes && <p className={`mt-0.5 text-[11px] italic ${subheadingClass} truncate`}><StickyNote className="w-2.5 h-2.5 inline mr-1" />{session.notes}</p>}
                          {session.postSessionFeedback?.productivityRating && <p className={`mt-0.5 text-[11px] ${subheadingClass}`}>Rated: {session.postSessionFeedback.productivityRating}/5</p>}
                          {session.xpEarned && session.xpEarned > 0 && <p className={`mt-0.5 text-[11px] ${illuminateTextYellow} font-medium flex items-center gap-1`}><StarIcon className="w-3 h-3" /> +{session.xpEarned} XP</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      <AnimatePresence>
        {showPreFocusModal && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
              <h3 className={`text-xl font-semibold mb-4 text-center ${headingClass} flex items-center justify-center gap-2`}><Brain className={`w-6 h-6 ${isIlluminateEnabled ? 'text-purple-500' : 'text-purple-400'}`} />Pre-Focus Check-in</h3>
              <p className={`text-sm mb-5 text-center ${subheadingClass}`}>Let's get you ready to focus, {truncatedName}!</p>
              <div className="space-y-5">
                <div>
                  <label className={`block mb-1.5 text-sm font-medium ${subheadingClass}`}>How are you feeling right now?</label>
                  <div className="flex justify-around gap-2 sm:gap-3">
                    {(['good', 'okay', 'bad'] as const).map(mood => (
                      <button key={mood} onClick={() => setPreFocusMood(mood)}
                        className={`flex-1 p-2.5 rounded-lg text-sm border-2 transition-all duration-150 font-medium flex items-center justify-center gap-1.5
                                    ${preFocusMood === mood ?
                            (mood === 'good' ? 'border-green-500 bg-green-500/20 text-green-400' : mood === 'okay' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' : 'border-red-500 bg-red-500/20 text-red-400') :
                            (isIlluminateEnabled ? 'border-gray-300 hover:border-gray-400 bg-gray-50' : 'border-gray-600 hover:border-gray-500 bg-gray-700/30')}`}
                      >
                        {mood === 'good' && <Smile className="w-4 h-4" />}
                        {mood === 'okay' && <Meh className="w-4 h-4" />}
                        {mood === 'bad' && <Frown className="w-4 h-4" />}
                        {mood.charAt(0).toUpperCase() + mood.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="energyLevel" className={`block mb-1.5 text-sm font-medium ${subheadingClass}`}>Energy Level (1 Low - 5 High): <span className={`font-bold text-base ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`}>{preFocusEnergy}</span></label>
                  <input type="range" id="energyLevel" min="1" max="5" step="1" value={preFocusEnergy} onChange={e => setPreFocusEnergy(parseInt(e.target.value))}
                    className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-purple-500' : 'bg-gray-700 accent-purple-500'}`} />
                </div>
                {(!activeSession || ['idle', 'completed', 'cancelled'].includes(activeSession.status)) && (
                  <div>
                    <label htmlFor="modalSessionGoal" className={`block text-sm font-medium mb-1.5 ${subheadingClass}`}>What's your main goal for this session?</label>
                    <input type="text" id="modalSessionGoal" value={sessionGoalText} onChange={e => setSessionGoalText(e.target.value)} placeholder="e.g., Write 500 words" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm`} />
                  </div>
                )}
              </div>
              <div className="mt-7 flex gap-3">
                <button onClick={() => { setShowPreFocusModal(false); setPreFocusMood(null); setPreFocusEnergy(3); }} className={`w-1/2 py-2.5 rounded-lg font-medium transition-colors shadow-md ${isIlluminateEnabled ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>Cancel</button>
                <button onClick={startNewPomodoroSessionFromModal} className={`w-1/2 py-2.5 rounded-lg font-semibold transition-colors shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Start Pomodoro</button>
              </div>
              <p className={`text-xs text-center mt-3.5 ${subheadingClass} opacity-70`}>Your check-in helps tailor future suggestions.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPostSessionModal && completedSessionForFeedback && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
              <h3 className={`text-xl font-semibold mb-2.5 text-center ${headingClass} flex items-center justify-center gap-2`}><CheckCircle className={`w-6 h-6 ${isIlluminateEnabled ? 'text-green-500' : 'text-green-400'}`} />Session Complete!</h3>
              <p className={`text-sm mb-1.5 text-center ${subheadingClass}`}>
                You focused for <span className="font-bold">{formatTime(completedSessionForFeedback.accumulatedFocusSeconds)}</span>
                {completedSessionForFeedback.linkedItemName && ` on "${completedSessionForFeedback.linkedItemName}"`}. Great job!
              </p>
              {completedSessionForFeedback.sessionGoalText && (
                <div className="text-sm mb-4 text-center">
                  <p className={`${subheadingClass}`}>Your goal was: "{completedSessionForFeedback.sessionGoalText}"</p>
                  <div className="mt-2">
                    <span className={`${subheadingClass} mr-2.5`}>Did you achieve it?</span>
                    <button onClick={() => setPostSessionGoalAchieved(true)} className={`px-3.5 py-1.5 text-xs rounded-md mr-1.5 font-medium transition-colors ${postSessionGoalAchieved === true ? 'bg-green-500 text-white' : (isIlluminateEnabled ? 'bg-gray-200 hover:bg-green-100 text-gray-700' : 'bg-gray-600 hover:bg-green-700 text-gray-200')}`}>Yes ✅</button>
                    <button onClick={() => setPostSessionGoalAchieved(false)} className={`px-3.5 py-1.5 text-xs rounded-md font-medium transition-colors ${postSessionGoalAchieved === false ? 'bg-red-500 text-white' : (isIlluminateEnabled ? 'bg-gray-200 hover:bg-red-100 text-gray-700' : 'bg-gray-600 hover:bg-red-700 text-gray-200')}`}>No ❌</button>
                  </div>
                </div>
              )}
              <div className="space-y-4 mt-1">
                <div>
                  <label className={`block mb-1.5 text-sm font-medium ${subheadingClass}`}>How productive did you feel? (1 Low - 5 High): <span className={`font-bold text-base ${isIlluminateEnabled ? 'text-green-600' : 'text-green-400'}`}>{postSessionProductivity}</span></label>
                  <input type="range" min="1" max="5" step="1" value={postSessionProductivity} onChange={e => setPostSessionProductivity(parseInt(e.target.value))}
                    className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${isIlluminateEnabled ? 'bg-gray-200 accent-green-500' : 'bg-gray-700 accent-green-500'}`} />
                </div>
                <div>
                  <label htmlFor="reflection" className={`block text-sm font-medium mb-1.5 ${subheadingClass}`}>Any reflections on this session?</label>
                  <textarea id="reflection" rows={2} value={postSessionReflection} onChange={e => setPostSessionReflection(e.target.value)} placeholder="What went well? What could be better?" className={`${inputBg} w-full p-2.5 rounded-lg text-sm shadow-sm`}></textarea>
                </div>
              </div>
              <button onClick={handleSubmitPostSessionFeedback} className={`mt-7 w-full py-2.5 rounded-lg font-semibold transition-colors shadow-md ${isIlluminateEnabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>Save Feedback & Collect XP</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-md shadow-2xl`}>
              <div className="flex justify-between items-center mb-5">
                <h3 className={`text-xl font-semibold ${headingClass}`}>Pomodoro Settings</h3>
                <button onClick={() => setShowSettingsModal(false)} className={`${iconColor} p-1 rounded-full`}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                {[
                  { label: "Work Duration (minutes)", value: pomodoroWorkSetting / 60, setter: (val: number) => setPomodoroWorkSetting(Math.max(1, val) * 60) },
                  { label: "Short Break (minutes)", value: pomodoroShortBreakSetting / 60, setter: (val: number) => setPomodoroShortBreakSetting(Math.max(1, val) * 60) },
                  { label: "Long Break (minutes)", value: pomodoroLongBreakSetting / 60, setter: (val: number) => setPomodoroLongBreakSetting(Math.max(1, val) * 60) },
                  { label: "Cycles before Long Break", value: pomodoroCyclesGoalSetting, setter: (val: number) => setPomodoroCyclesGoalSetting(Math.max(1, val)) },
                ].map(item => (
                  <div key={item.label}>
                    <label className={`block mb-1.5 font-medium ${subheadingClass}`}>{item.label}:</label>
                    <input type="number" min="1" value={item.value} onChange={e => item.setter(parseInt(e.target.value))} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                  </div>
                ))}
              </div>
              <button onClick={handleSavePomodoroSettings} className={`mt-7 w-full py-2.5 rounded-lg font-semibold transition-colors shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save Settings</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomTimerModal && (
          <motion.div initial="hidden" animate="visible" exit="exit" variants={modalVariants} className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`${cardClass} rounded-xl p-6 w-full max-w-md shadow-2xl`}>
              <div className="flex justify-between items-center mb-5">
                <h3 className={`text-xl font-semibold ${headingClass}`}>{editingCustomTimer ? "Edit" : "Add"} Timer</h3>
                <button onClick={() => setShowCustomTimerModal(false)} className={`${iconColor} p-1 rounded-full`}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <label className={`block mb-1.5 font-medium ${subheadingClass}`}>Timer Name:</label>
                  <input type="text" value={newCustomTimerName} onChange={e => setNewCustomTimerName(e.target.value)} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                </div>
                <div>
                  <label className={`block mb-1.5 font-medium ${subheadingClass}`}>Duration (minutes):</label>
                  <input type="number" min="1" value={newCustomTimerDuration} onChange={e => setNewCustomTimerDuration(parseInt(e.target.value))} className={`${inputBg} w-full p-2.5 rounded-lg shadow-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500`} />
                </div>
              </div>
              <button onClick={handleSaveCustomTimer} className={`mt-7 w-full py-2.5 rounded-lg font-semibold transition-colors shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Save Timer</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-[55] transform transition-transform duration-300 ease-in-out ${isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${isIlluminateEnabled ? 'border-gray-200/80' : 'border-gray-700/70'}`}>
        <div className={`p-3 sm:p-4 border-b ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700/70 bg-gray-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
          <h3 className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}><BrainCircuit className="w-5 h-5" />Focus AI</h3>
          <button onClick={() => setIsAiSidebarOpen(false)} className={`${iconColor} p-1.5 rounded-full`}><X className="w-5 h-5" /></button>
        </div>
        <div className={`flex border-b ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700/70'}`}>
          {['Chat', 'History'].map(tabName => (<button key={tabName} onClick={() => setAiChatSidebarTab(tabName.toLowerCase() as any)} className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-medium transition-colors ${aiChatSidebarTab === tabName.toLowerCase() ? `${isIlluminateEnabled ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600' : 'bg-gray-700 text-blue-300 border-b-2 border-blue-400'}` : `${isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-700/60 text-gray-400'}`}`}>{tabName}</button>))}
        </div>
        {aiChatSidebarTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-3.5" ref={chatEndRef}>
              {!conversationId && <div className="text-center py-10"><MessageCircle className={`w-12 h-12 mx-auto mb-3 ${subheadingClass}`} /><p className={`${subheadingClass} text-sm`}>Start a new Focus AI chat.</p><button onClick={handleNewConversation} className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><PlusCircle className="w-4 h-4 inline mr-1.5" /> New Chat</button></div>}
              {conversationId && chatHistory.map((message, index) => (<motion.div key={message.id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm shadow-md break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')}`}>
                  {message.content === "..." && isChatLoading && message.localPlaceholderId && <div className="flex space-x-1.5 p-1.5"><div className="w-2 h-2 bg-current rounded-full animate-bounce"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200"></div></div>}
                  {message.content && message.content !== "..." && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...props} />, code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/50 p-2.5 rounded-md overflow-x-auto my-1.5 text-xs ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!bg-black/30 px-1.5 py-0.5 rounded text-xs ${className}`} {...props}>{children}</code>); }, }}>{message.content}</ReactMarkdown>}
                  {message.actionDetails && <div className={`mt-1.5 text-xs p-1.5 rounded ${message.actionDetails.status === 'success' ? (isIlluminateEnabled ? 'bg-green-50 text-green-700 border border-green-200/70' : 'bg-green-900/30 text-green-300 border border-green-700/50') : (isIlluminateEnabled ? 'bg-red-50 text-red-700 border border-red-200/70' : 'bg-red-900/30 text-red-300 border border-red-700/50')}`}>{message.actionDetails.message}</div>}
                </div>
              </motion.div>))}
            </div>
            <div className={`px-3 pt-2.5 border-t ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700/70 bg-gray-800/90'} flex-shrink-0`}>
              {userTier !== 'premium' && userTier !== 'loading' && (<div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>Messages: {chatUsageCount} / {currentChatLimitDisplay}</span> {isChatDisabledByLimit && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>} {!isChatDisabledByLimit && userTier === 'basic' && <Link to="/pricing" className={`ml-2 font-medium ${illuminateTextBlue} hover:underline`}><Crown className="w-2.5 h-2.5 inline mr-0.5" />Upgrade</Link>}</div>)}
              <form onSubmit={handleChatSubmit} className="flex gap-2 items-center pb-3">
                <button type="button" onClick={() => setIsContextDialogOpen(true)} disabled={!conversationId} className={`p-2.5 rounded-full transition-colors ${!conversationId ? 'opacity-50 cursor-not-allowed' : ''} ${iconColor}`} title="Set AI Context"> <BrainCircuit className="w-4 h-4" /> </button>
                <textarea rows={1} value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }} placeholder={!conversationId ? "Select or start a chat..." : (isChatDisabledByLimit ? "Monthly limit reached..." : "Ask Focus AI...")} className={`flex-1 ${inputBg} rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 disabled:opacity-60 resize-none leading-tight max-h-28`} disabled={isChatLoading || isChatDisabledByLimit || !conversationId} />
                <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatDisabledByLimit || !conversationId} className={`bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </>
        )}
        {aiChatSidebarTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <button onClick={handleNewConversation} className={`mb-2.5 w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm font-medium shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><PlusCircle className="w-4 h-4" /> New Focus Chat</button>
            {conversationList.length === 0 && <p className={`${subheadingClass} text-center text-sm py-4`}>No chat history.</p>}
            {conversationList.sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0)).map(conv => (
              <div key={conv.id} className={`flex items-center justify-between cursor-pointer p-2.5 rounded-lg transition-colors ${conversationId === conv.id ? (isIlluminateEnabled ? 'bg-blue-100 text-blue-700' : 'bg-blue-700/80 text-white') : (isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-700 border border-gray-200' : `text-gray-300 hover:bg-gray-700/60 border border-gray-700/30`)}`} onClick={() => handleSelectConversation(conv.id)}>
                <div className="flex items-center gap-2.5 flex-1 min-w-0"><MessageCircle className="w-4 h-4 flex-shrink-0" /> <span className="truncate text-sm">{conv.chatName}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ContextDialog isOpen={isContextDialogOpen} onClose={() => setIsContextDialogOpen(false)} onSave={async (context) => { if (user) await saveUserContext(user.uid, context); setIsContextDialogOpen(false); }} initialContext={userContext} isIlluminateEnabled={isIlluminateEnabled} />
    </div>
  );
}
