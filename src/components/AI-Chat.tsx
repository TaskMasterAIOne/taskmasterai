import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Send, TimerIcon as TimerIconLucide, Bot, Brain, AlertTriangle, MoreHorizontal, Plus, PlusCircle, MessageSquare, Edit2, Share, Trash2, CheckCircle, Goal, Calendar, Folder, BarChart2, Clock, Bell, TrendingUp, Lightbulb, Target, FileText, Notebook, Wand, ListChecks, SortAsc, Search, ClipboardList, Sun, Layers, AlignLeft, UserCheck, Hourglass, Settings, Columns, PieChart, Users, CalendarCheck, Eye, Crown, Paperclip, ImageIcon, X, Download, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { auth } from '../lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { geminiApiKey } from '../lib/dashboard-firebase';
import { onCollectionSnapshot } from '../lib/dashboard-firebase';
import { getCurrentUser } from '../lib/settings-firebase';

import {
  createChatConversation,
  saveChatMessage,
  onChatMessagesSnapshot,
  onChatConversationsSnapshot,
  updateChatConversationName,
  deleteChatConversation,
  findItemByName,
  uploadBase64ImageToStorage,
  uploadFileToStorage,
  type ChatMessage as FirebaseChatMessage,
  type ImageMeta as FirebaseImageMeta,
  type AttachedFileMeta as FirebaseAttachedFileMeta,
} from '../lib/ai-chat-firebase';

import {
  saveUserContext,
  onUserContextChange,
  type UserContext,
} from '../lib/ai-context-firebase';

import {
  createUserTask, createUserGoal, createUserPlan, createUserProject,
  updateUserTask, updateUserGoal, updateUserPlan, updateUserProject,
  deleteUserTask, deleteUserGoal, deleteUserPlan, deleteUserProject,
} from '../lib/ai-actions-firebase';

import {
    UserTier, BASIC_CHAT_LIMIT, getUserTier, getChatLimitForTier,
    getCurrentMonthUserChatUsage, incrementUserChatUsage,
} from '../lib/current-paying-user';

import { Sidebar } from './Sidebar';
import { Timer } from './Timer';
import { FlashcardsQuestions } from './FlashcardsQuestions';
import { ChatControls } from './chat-controls';
import { ContextDialog } from './context-dialog';

interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface FlashcardData { id: string; question: string; answer: string; topic: string; }
interface QuestionData { id: string; question: string; options: string[]; correctAnswer: number; explanation: string; }
interface FlashcardMessage { type: 'flashcard'; data: FlashcardData[]; }
interface QuestionMessage { type: 'question'; data: QuestionData[]; }
interface LocalImageData { base64: string; type: string; name: string; }

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
  timer?: TimerMessage;
  flashcard?: FlashcardMessage;
  question?: QuestionMessage;
  error?: boolean;
  actionDetails?: {
    status: 'success' | 'error';
  };
  localImageData?: LocalImageData;
  imageUrl?: string;
  imageMeta?: FirebaseImageMeta;
  isGeneratingImage?: boolean;
  wasImageGenerated?: boolean;
  attachedFilesMeta?: Array<{ name: string; type: string; size: number; url?: string; base64Data?: string; localPreviewUrl?: string; storagePath?:string }>;
  localPlaceholderId?: string;
}

interface SelectedFile { name: string; type: string; size: number; base64Data: string; fileObject: File; localPreviewUrl: string; }

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash'; // Changed from gemini-1.5-flash-latest as per original
const GEMINI_IMAGE_GEN_MODEL = 'gemini-2.0-flash-preview-image-generation'; // Changed as per original

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 60000) => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') console.error('Fetch request timed out:', url);
    throw error;
  }
};

const parseGeminiApiResponse = (responseText: string, isImageGenCall: boolean): { text: string | null; localImageData: LocalImageData | null; error: string | null; finishReason: string | null } => {
    let textContent: string | null = null;
    let imageContent: LocalImageData | null = null;
    let errorMessage: string | null = null;
    let reason: string | null = null;
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            if(jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
            return { text: null, localImageData: null, error: errorMessage, finishReason: 'BLOCKED' };
        }
        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;
            if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent = (textContent ? textContent + "\n" : "") + part.text;
                    } else if (isImageGenCall && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData?.data) {
                        imageContent = { base64: part.inlineData.data, type: part.inlineData.mimeType, name: "generated_image.png" };
                    }
                }
            }
             if (!textContent && !imageContent) {
                 if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
                 else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
                 else if (reason === 'RECITATION') { errorMessage = "Response blocked due to potential recitation issues."; }
                 else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
                 else if (!candidate.content) { errorMessage = "Received an empty response candidate."; }
             }
        } else if (jsonResponse?.error?.message) {
             errorMessage = `API Error: ${jsonResponse.error.message}`;
        } else { errorMessage = "Sorry, I received an empty or non-standard response format."; }
        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
             if (textContent) { if (!textContent.trim()) { textContent = "(No image generated and no text explanation provided)"; } }
             else { errorMessage = "Image generation request processed, but no image was returned."; }
        }
        if (!textContent && !imageContent && !errorMessage) { textContent = "(Received empty response content)"; }
        return { text: textContent, localImageData: imageContent, error: errorMessage, finishReason: reason };
    } catch (err) {
        console.error("Error parsing Gemini API response:", responseText, err);
        return { text: null, localImageData: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null };
    }
};

const readFileAsSelectedFile = (file: File): Promise<SelectedFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const localPreviewUrl = URL.createObjectURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            if (!base64String) {
                URL.revokeObjectURL(localPreviewUrl);
                reject(new Error("Failed to read file content."));
                return;
            }
            resolve({ name: file.name, type: file.type, size: file.size, base64Data: base64String, fileObject: file, localPreviewUrl });
        };
        reader.onerror = (error) => {
            URL.revokeObjectURL(localPreviewUrl);
            reject(error);
        };
        reader.readAsDataURL(file);
    });
};

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'; const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const handleDownloadImageFromUrl = (imageUrl: string, imageName?: string) => {
  if (!imageUrl) return;
  const link = document.createElement('a');
  link.href = imageUrl;
  const defaultExtension = imageUrl.includes('png') ? 'png' : imageUrl.includes('jpg') || imageUrl.includes('jpeg') ? 'jpg' : 'image';
  const fileName = imageName || `downloaded-image-${Date.now()}.${defaultExtension}`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function extractJsonBlocks(text: string): { blocks: any[], cleanedText: string, originalText: string } {
  const extractedBlocks: any[] = [];
  let remainingText = text;
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsedJson = JSON.parse(match[1]);
      extractedBlocks.push(parsedJson);
      remainingText = remainingText.replace(match[0], "").trim();
    } catch (e) {
      // If JSON in ```json ``` block is invalid, we still remove the block to avoid displaying malformed JSON.
      // The AI might output text before/after this block which is still useful.
      // Or, we might decide to keep the original block if parsing fails, to show the user what the AI sent.
      // For now, remove it, assuming it's an attempt at a JSON action that failed.
      remainingText = remainingText.replace(match[0], "").trim();
    }
  }

  // If no ```json ``` blocks were found, try to find JSON objects not wrapped in triple backticks
  if (extractedBlocks.length === 0) {
    // This regex tries to find objects starting with { and ending with }
    // It's more risky as it might grab parts of normal text.
    // We should only parse it if it's the *only* thing or clearly demarcated.
    // A simple approach: look for JSON at the start or end of lines.
    const curlyRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:$|\n)/g;
    let tempTextForCurlySearch = text; // Use original text for this search
    let modifiedCurlyText = ""; // Build up the text that isn't parsed as JSON
    let lastIndex = 0;

    while ((match = curlyRegex.exec(tempTextForCurlySearch)) !== null) {
        modifiedCurlyText += tempTextForCurlySearch.substring(lastIndex, match.index); // Add text before the potential JSON
        try {
            const parsedJson = JSON.parse(match[1]);
            extractedBlocks.push(parsedJson);
            // If successfully parsed, this part is removed from remainingText implicitly
        } catch(e) {
            // If parsing fails, it's not valid JSON, so add it back to the text to be displayed
            modifiedCurlyText += match[0];
        }
        lastIndex = curlyRegex.lastIndex;
    }
    modifiedCurlyText += tempTextForCurlySearch.substring(lastIndex); // Add any trailing text

    if (extractedBlocks.length > 0) {
        // If we found JSON this way, `modifiedCurlyText` is our `cleanedText`
        // We need to ensure that if a block was *intended* as JSON by the AI but was malformed,
        // it doesn't get re-parsed and removed by the logic that constructed `modifiedCurlyText`.
        // The current logic correctly adds back unparseable curly-braced blocks to `modifiedCurlyText`.
        remainingText = modifiedCurlyText.trim();
    }
  }
  return { blocks: extractedBlocks, cleanedText: remainingText.trim(), originalText: text };
}

const themeConfig = {
  default: {
    name: 'default', containerBg: 'bg-gray-900', headerBorder: 'border-gray-700', headerBg: 'bg-gray-900',
    textColor: 'text-white', mutedTextColor: 'text-gray-400', accentColor: 'text-blue-400', warningColor: 'text-yellow-400',
    userBubble: 'bg-blue-600 text-white', assistantBubble: 'bg-gray-700 text-gray-200', errorBubble: 'bg-red-900/30 text-red-300 border border-red-700/50',
    inputBg: 'bg-gray-700 text-gray-200 placeholder-gray-500', asideBg: 'bg-gray-800', asideBorder: 'border-gray-700',
    conversationInactive: 'bg-gray-700/80 text-gray-200 hover:bg-gray-700', conversationActive: 'bg-blue-600 text-white',
    markdownCodeBg: 'bg-black/20', markdownPreBg: 'bg-black/40', buttonHoverBg: 'hover:bg-gray-600', dropdownBg: 'bg-gray-700',
    gradientFrom: 'from-gray-900', limitReachedBg: 'bg-yellow-900/50 border border-yellow-700 text-yellow-300',
    quickActionBg: 'bg-gradient-to-r from-indigo-500 to-purple-500', quickActionHoverBg: 'hover:opacity-90',
    actionButtonBg: 'bg-blue-600 hover:bg-blue-700',
    timerText: 'text-blue-300 font-medium',
    viewButtonBg: 'bg-blue-600 hover:bg-blue-700',
    viewButtonText: 'text-white',
    filePillBg: "bg-blue-900/50 border-blue-700/50", filePillText: "text-blue-300",
    userFileAttachmentBg: "bg-blue-700/20 border-blue-500/30", userFileAttachmentText: "text-blue-200",
    imageGenButtonClass: "bg-gray-600 hover:bg-gray-500 text-gray-300",
    imageGenActiveButtonClass: "bg-purple-800/60 hover:bg-purple-700/60 text-purple-300",
    downloadButtonClass: "bg-gray-600 hover:bg-gray-500 text-gray-300",
    buttonSecondaryClass: "bg-gray-600 hover:bg-gray-500 text-gray-300",
    buttonDisabledClass: "opacity-50 cursor-not-allowed",
  },
  illuminate: {
    name: 'illuminate', containerBg: 'bg-slate-50', headerBorder: 'border-gray-200/80', headerBg: 'bg-white',
    textColor: 'text-gray-900', mutedTextColor: 'text-gray-600', accentColor: 'text-blue-600', warningColor: 'text-yellow-500',
    userBubble: 'bg-blue-500 text-white', assistantBubble: 'bg-gray-100 text-gray-800 border border-gray-200/80', errorBubble: 'bg-red-100 text-red-700 border border-red-200',
    inputBg: 'bg-gray-100 text-gray-900 placeholder-gray-500 hover:bg-gray-200/70', asideBg: 'bg-gray-50', asideBorder: 'border-gray-200',
    conversationInactive: 'bg-gray-200/80 text-gray-700 hover:bg-gray-200', conversationActive: 'bg-blue-500 text-white',
    markdownCodeBg: 'bg-gray-200', markdownPreBg: 'bg-gray-200', buttonHoverBg: 'hover:bg-gray-200', dropdownBg: 'bg-white',
    gradientFrom: 'from-slate-50', limitReachedBg: 'bg-yellow-100 border border-yellow-300 text-yellow-700',
    quickActionBg: 'bg-gradient-to-r from-indigo-500 to-purple-500', quickActionHoverBg: 'hover:opacity-90',
    actionButtonBg: 'bg-blue-500 hover:bg-blue-600',
    timerText: 'text-blue-700 font-medium',
    viewButtonBg: 'bg-blue-500 hover:bg-blue-600',
    viewButtonText: 'text-white',
    filePillBg: "bg-blue-100 border-blue-200", filePillText: "text-blue-800",
    userFileAttachmentBg: "bg-blue-50 border-blue-200", userFileAttachmentText: "text-blue-700",
    imageGenButtonClass: "bg-gray-200 hover:bg-gray-300 text-gray-700",
    imageGenActiveButtonClass: "bg-purple-100 hover:bg-purple-200 text-purple-700",
    downloadButtonClass: "bg-gray-200 hover:bg-gray-300 text-gray-600",
    buttonSecondaryClass: "bg-gray-200 hover:bg-gray-300 text-gray-700",
    buttonDisabledClass: "opacity-50 cursor-not-allowed",
  },
  blackout: {
    name: 'blackout', containerBg: 'bg-black', headerBorder: 'border-gray-800', headerBg: 'bg-black',
    textColor: 'text-gray-200', mutedTextColor: 'text-gray-500', accentColor: 'text-blue-400', warningColor: 'text-yellow-400',
    userBubble: 'bg-blue-600 text-white', assistantBubble: 'bg-gray-800/70 text-gray-200 border border-gray-700/50', errorBubble: 'bg-red-900/40 text-red-300 border border-red-700/60',
    inputBg: 'bg-gray-800 text-gray-300 placeholder-gray-500 hover:bg-gray-700/80', asideBg: 'bg-black', asideBorder: 'border-gray-800',
    conversationInactive: 'bg-gray-800/80 text-gray-300 hover:bg-gray-800', conversationActive: 'bg-blue-600 text-white',
    markdownCodeBg: 'bg-gray-900/50', markdownPreBg: 'bg-gray-900/70', buttonHoverBg: 'hover:bg-gray-700', dropdownBg: 'bg-gray-800',
    gradientFrom: 'from-black', limitReachedBg: 'bg-yellow-900/50 border border-yellow-700 text-yellow-300',
    quickActionBg: 'bg-gradient-to-r from-indigo-500 to-purple-500', quickActionHoverBg: 'hover:opacity-90',
    actionButtonBg: 'bg-blue-600 hover:bg-blue-700',
    timerText: 'text-blue-300 font-medium',
    viewButtonBg: 'bg-blue-600 hover:bg-blue-700',
    viewButtonText: 'text-white',
    filePillBg: "bg-blue-900/60 border-blue-700/60", filePillText: "text-blue-300",
    userFileAttachmentBg: "bg-gray-700/30 border-gray-600/50", userFileAttachmentText: "text-gray-300",
    imageGenButtonClass: "bg-gray-700 hover:bg-gray-600 text-gray-300",
    imageGenActiveButtonClass: "bg-purple-800/70 hover:bg-purple-700/70 text-purple-300",
    downloadButtonClass: "bg-gray-700 hover:bg-gray-600 text-gray-300",
    buttonSecondaryClass: "bg-gray-700 hover:bg-gray-600 text-gray-300",
    buttonDisabledClass: "opacity-50 cursor-not-allowed",
  }
};

const SUPPORTED_FILE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,text/plain,.md,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.rtf";
const MAX_FILE_SIZE_MB = 20;

export function AIChat() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Loading...');
  const truncatedName = userName.split(' ')[0] || userName;
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessageData[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [_customStyles, setCustomStyles] = useState<Record<string, { description: string; prompt: string }>>({});
  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);
  const [hasGeneratedChatName, setHasGeneratedChatName] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isImageGenModeActive, setIsImageGenModeActive] = useState(false);
  const [streamingAssistantContent, setStreamingAssistantContent] = useState('');
  const [assistantLoadingPlaceholderId, setAssistantLoadingPlaceholderId] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState(themeConfig.default);

  useEffect(() => {
    if (isBlackoutEnabled) setCurrentTheme(themeConfig.blackout);
    else if (isIlluminateEnabled) setCurrentTheme(themeConfig.illuminate);
    else setCurrentTheme(themeConfig.default);
  }, [isBlackoutEnabled, isIlluminateEnabled]);

  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [chatUsageCount, setChatUsageCount] = useState<number>(0);
  const [chatLimit, setChatLimit] = useState<number>(BASIC_CHAT_LIMIT);
  const [isChatDisabledByLimit, setIsChatDisabledByLimit] = useState(false);
  const currentChatLimitDisplay = useMemo(() => getChatLimitForTier(userTier), [userTier]);

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled));
    document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled);
  }, [isBlackoutEnabled, isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled));}, [isSidebarBlackoutEnabled]);
  useEffect(() => {
    localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled));
    document.body.classList.toggle('illuminate-mode', isIlluminateEnabled);
    if (isIlluminateEnabled) document.body.classList.remove('blackout-mode');
    else if (isBlackoutEnabled) document.body.classList.add('blackout-mode');
  }, [isIlluminateEnabled, isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled));}, [isSidebarIlluminateEnabled]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      if (fbUser) { setUserName(fbUser.displayName || 'User'); setUserEmail(fbUser.email); }
      else { setUserName('User'); setUserEmail(null); navigate('/login'); }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fbUser = getCurrentUser();
    if (fbUser) { setUser(fbUser); setUserName(fbUser.displayName || 'User'); setUserEmail(fbUser.email); }
    else { navigate('/login'); }
  }, [navigate]);

  useEffect(() => {
    if (user && user.uid && userEmail !== undefined) {
      getUserTier(user.uid, userEmail).then(tier => { setUserTier(tier); setChatLimit(getChatLimitForTier(tier)); });
    } else if (!user) {
      setUserTier('basic'); setChatLimit(getChatLimitForTier('basic'));
    }
  }, [user, userEmail]);

  useEffect(() => {
    if (user && user.uid && userTier !== 'loading') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      getCurrentMonthUserChatUsage(user.uid, currentMonth).then(usage => setChatUsageCount(usage?.count || 0));
    }
  }, [user, userTier]);

  useEffect(() => {
    setIsChatDisabledByLimit(userTier !== 'premium' && chatUsageCount >= chatLimit && chatLimit !== Infinity);
  }, [chatUsageCount, chatLimit, userTier]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const unsubTasks = onCollectionSnapshot('tasks', user.uid, setTasks);
    const unsubGoals = onCollectionSnapshot('goals', user.uid, setGoals);
    const unsubProjects = onCollectionSnapshot('projects', user.uid, setProjects);
    const unsubPlans = onCollectionSnapshot('plans', user.uid, setPlans);
    return () => { unsubTasks(); unsubGoals(); unsubProjects(); unsubPlans(); };
  }, [user]);

  useEffect(() => { if (!user || !user.uid) return; const unsub = onUserContextChange(user.uid, setUserContext); return () => unsub(); }, [user]);

  useEffect(() => {
      if (!user || !user.uid) return;
      const unsub = onChatConversationsSnapshot(user.uid, (conversations) => {
          setConversationList(conversations.map(c => ({...c, key: c.id})));
      });
      return () => unsub();
  }, [user]);

  useEffect(() => {
      if (!conversationId) {
          setChatHistory([]);
          setHasGeneratedChatName(false);
          setStreamingAssistantContent('');
          setSelectedFiles([]);
          setIsImageGenModeActive(false);
          setAssistantLoadingPlaceholderId(null);
          return;
      }
      const unsub = onChatMessagesSnapshot(conversationId, (messagesFromDb: FirebaseChatMessage[]) => {
          setChatHistory(messagesFromDb.map(m => {
            const attachedFilesMetaForUi = m.attachedFilesMeta?.map(fbm => ({
                name: fbm.name,
                type: fbm.type,
                size: fbm.size,
                url: fbm.url,
                storagePath: fbm.storagePath,
                localPreviewUrl: fbm.url,
            })) || undefined;

            return {
              id: m.id || `fb-msg-${Date.now()}-${Math.random()}`,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
              timer: m.timer,
              flashcard: m.flashcard,
              question: m.question,
              error: m.error,
              actionDetails: m.actionDetails,
              imageUrl: m.imageUrl,
              imageMeta: m.imageMeta,
              isGeneratingImage: m.isGeneratingImage,
              wasImageGenerated: m.wasImageGenerated,
              attachedFilesMeta: attachedFilesMetaForUi,
            } as ChatMessageData;
          }));
      });
      return () => unsub();
  }, [conversationId]);

  useEffect(() => {
    if (chatEndRef.current) {
        requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  }, [chatHistory, streamingAssistantContent]);

  useEffect(() => {
    const currentSelectedFiles = selectedFiles;
    return () => {
        currentSelectedFiles.forEach(sf => {
            if (sf.localPreviewUrl) {
                URL.revokeObjectURL(sf.localPreviewUrl);
            }
        });
    };
  }, [selectedFiles]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdownId(null); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveContext = async (context: Partial<UserContext>) => { if (!user || !user.uid) return; await saveUserContext(user.uid, context); };
  const handleStyleSelect = (style: string, prompt: string) => { setActiveStyle(style); setActivePrompt(prompt); };
  const handleCustomStyleCreate = (style: { name: string; description: string; prompt: string }) => {
    setCustomStyles(prev => ({ ...prev, [style.name]: { description: style.description, prompt: style.prompt }}));
    setActiveStyle(style.name); setActivePrompt(style.prompt);
  };

  const parseTimerRequest = (message: string): number | null => {
    const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i;
    const match = message.match(timeRegex);
    if (!match) return null;
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (isNaN(amount) || amount <= 0) return null;
    if (unit.startsWith('hour') || unit.startsWith('hr')) return amount * 3600;
    if (unit.startsWith('min')) return amount * 60;
    if (unit.startsWith('sec')) return amount;
    return null;
  };

  const handleTimerComplete = (timerId: string) => {
    if (!conversationId || !user) return;
    const completionMsg: Partial<FirebaseChatMessage> = {
      role: 'assistant',
      content: "⏰ Time's up! Your timer has finished.",
    };
    if (conversationId) saveChatMessage(conversationId, completionMsg);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const newSelectedFiles: SelectedFile[] = [];
    const fileProcessingPromises: Promise<void>[] = [];
    const currentFileNames = new Set(selectedFiles.map(f => f.name));
    let tempErrorMessages: ChatMessageData[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (currentFileNames.has(file.name)) {
            tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `ℹ️ File "${file.name}" is already selected.`, createdAt: new Date()});
            continue;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
             tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `❌ File "${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`, error: true, createdAt: new Date()});
             continue;
        }
        fileProcessingPromises.push(
            readFileAsSelectedFile(file)
                .then(processedFile => newSelectedFiles.push(processedFile))
                .catch(err => {
                    console.error("Error reading file:", file.name, err);
                    tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `❌ Error reading file "${file.name}".`, error: true, createdAt: new Date()});
                })
        );
    }

    await Promise.all(fileProcessingPromises);
    if (tempErrorMessages.length > 0) {
        setChatHistory(prev => [...prev, ...tempErrorMessages]);
    }
    setSelectedFiles(prev => [...prev, ...newSelectedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    textareaRef.current?.focus();
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(f => {
        if (f.name === fileName && f.localPreviewUrl) {
            URL.revokeObjectURL(f.localPreviewUrl);
        }
        return f.name !== fileName;
    }));
  };

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    let imagePasted = false;
    const filePromises: Promise<SelectedFile>[] = [];
    const existingFileNames = new Set(selectedFiles.map(f => f.name));
    let tempErrorMessages: ChatMessageData[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                if (existingFileNames.has(file.name)) {
                     tempErrorMessages.push({id: `local-paste-info-${Date.now()}`,role: 'assistant',content: `ℹ️ Pasted image "${file.name}" is already attached.`, createdAt: new Date()});
                     continue;
                };
                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                     tempErrorMessages.push({id: `local-paste-err-${Date.now()}`,role: 'assistant',content: `❌ Pasted image "${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`,error: true, createdAt: new Date()});
                     continue;
                }
                filePromises.push(readFileAsSelectedFile(file));
                existingFileNames.add(file.name); // Add to set immediately to prevent duplicates from same paste
                imagePasted = true;
            }
        }
    }
    if (imagePasted) {
        event.preventDefault();
        try {
            const results = await Promise.all(filePromises);
            setSelectedFiles(prev => [...prev, ...results]);
        } catch (error) {
            console.error("Error processing pasted images:", error);
            tempErrorMessages.push({id: `local-paste-read-err-${Date.now()}`,role: 'assistant',content: `❌ Error processing one or more pasted images.`,error: true, createdAt: new Date()});
        }
    }
    if (tempErrorMessages.length > 0) {
        setChatHistory(prev => [...prev, ...tempErrorMessages]);
    }
  }, [selectedFiles]);

  const handleToggleImageGenMode = () => {
    const nextState = !isImageGenModeActive;
    setIsImageGenModeActive(nextState);
    let tempInfoMessages: ChatMessageData[] = [];
    if (nextState && selectedFiles.length > 0) {
        selectedFiles.forEach(sf => URL.revokeObjectURL(sf.localPreviewUrl));
        setSelectedFiles([]);
        tempInfoMessages.push({id: `local-img-mode-info-${Date.now()}`, role: 'assistant', content: "🖼️ Image generation mode enabled. Attached files have been cleared.", createdAt: new Date()});
    } else if (!nextState) {
         tempInfoMessages.push({id: `local-txt-mode-info-${Date.now()}`, role: 'assistant', content: "💬 Switched to text & file mode.", createdAt: new Date()});
    }
    if (tempInfoMessages.length > 0) {
        setChatHistory(prev => [...prev, ...tempInfoMessages]);
    }
    textareaRef.current?.focus();
  };

  const formatItemsForChat = (): string => {
    if (!user) return "User data not available.";
    const lines: string[] = [];
    lines.push(`Current items for ${truncatedName}:\n`);
    const formatLine = (item: any, type: string, nameField: string) => {
      const name = item.data[nameField] || 'Untitled';
      const due = item.data.dueDate?.toDate?.() || item.data.targetDate?.toDate?.() || item.data.deadline?.toDate?.();
      const priority = item.data.priority || 'medium';
      const completed = item.data.completed ? '[Completed]' : '[Pending]';
      return `${type}: ${name}${due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''} [Priority: ${priority}] ${completed}`;
    };
    tasks.forEach(item => lines.push(formatLine(item, 'Task', 'task')));
    goals.forEach(item => lines.push(formatLine(item, 'Goal', 'goal')));
    projects.forEach(item => lines.push(formatLine(item, 'Project', 'project')));
    plans.forEach(item => lines.push(formatLine(item, 'Plan', 'plan')));
    if (lines.length === 1) return `No active items found for ${truncatedName}.`;
    return lines.join('\n');
  };

const createPrompt = (userMessage: string, filesDataForPrompt: SelectedFile[]): string => {
    const conversationSoFar = chatHistory.slice(-6)
      .map((m) => `${m.role === 'user' ? truncatedName : 'Assistant'}: ${m.content}${m.attachedFilesMeta ? ` [Files: ${m.attachedFilesMeta.map(f=>f.name).join(', ')}]` : ''}`)
      .join('\n');
    const itemsText = formatItemsForChat();
    const now = new Date();
    const currentDateTime = {
      date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
    let styleInstruction = '';
    if (activeStyle && activePrompt) styleInstruction = `\n\nSYSTEM_STYLE_PROMPT: ${activePrompt}\n`;
    let contextSection = '';
    if (userContext) {
      contextSection = `
User Context (provided by ${truncatedName}):
- Work: ${userContext.workDescription || 'Not specified'}
- Short-term Focus: ${userContext.shortTermFocus || 'Not specified'}
- Long-term Goals: ${userContext.longTermGoals || 'Not specified'}
- Additional Context: ${userContext.otherContext || 'Not specified'}
`;
    }
    let filePreamble = "";
    if (filesDataForPrompt.length > 0 && !isImageGenModeActive) {
        filePreamble = `\n\n[CONTEXT FROM ATTACHED FILES (${filesDataForPrompt.map(f => f.name).join(', ')})]\n${filesDataForPrompt.length > 1 ? "Multiple files are attached. " : ""}The user has attached ${filesDataForPrompt.map(f => `${f.name} (${f.type})`).join(', ')}. Please consider their content if relevant to the query. For non-image/pdf files, assume their text content is available if I've provided it. If the query is about an image, describe it or use its content for the response. If it's about a PDF, use the text content.`;
    }
    const imageGenInstruction = isImageGenModeActive ? `
[IMAGE GENERATION TASK]
You are TaskMaster AI, a friendly and versatile AI productivity assistant. The user may want to generate an image based on the following description: "${userMessage}".
Your primary goal is to generate this image. You must also provide a brief accompanying text with the image (e.g., "Here's the image you requested:", or a short comment about the image).
**CRITICAL**: Your response for image generation MUST include both the image data AND a text part. Do NOT output JSON for image generation. The image will be encoded by the system. THE ONLY EXCEPTION IS IF THE USER IS SPEAKING TO YOU ABOUT SOMETHING THAT IS NOT RELATED TO CREATING IMAGES, THE YOU DON'T HAVE TO DO THIS STEP. 
If image generation fails, explain why politely in plain text. YOU ARE ALSO ALLOWED TO CHAT WITH THE USER IN CASUAL CONVERSATION AS WELL, ONLY CREATE IMAGES IF THE USER ASKS, OTHERWISE PLEASE CHAT WITH THE USER NORMALLY. MAKE Sure your response is in the same language the user speaks to you. 
` : "";
    return `
[CONTEXT]
User's Name: ${truncatedName}
Current Date: ${currentDateTime.date}
Current Time: ${currentDateTime.time}
${styleInstruction}
${contextSection}
${filePreamble}
User's Current Items (Only discuss if explicitly asked by ${truncatedName}):
${itemsText}
[CONVERSATION HISTORY (Last few turns)]
${conversationSoFar}
[NEW USER MESSAGE]
${truncatedName}: ${userMessage}
${imageGenInstruction}
You are TaskMaster, a friendly and versatile AI productivity assistant. Engage in casual conversation, provide productivity advice, and discuss ${truncatedName}'s items only when explicitly asked by ${truncatedName}. Only reference the user's first name when chatting. If files are attached, consider their content when answering. MAKE Sure your response is in the same language the user speaks to you. 
Guidelines:
1. General Conversation & File-based Q&A:
   - Respond in a friendly, natural tone. Do not include internal instructions or meta commentary.
   - If files are attached and the query relates to them, use their content. For images, describe or analyze. For PDFs/text files, use text content.
   - For unsupported file types (e.g., Word, Excel, PowerPoint), state that you can't process their rich content directly but can discuss any text pasted from them.
   - Only reference ${truncatedName}'s items if ${truncatedName} explicitly asks about them.
2. Image Generation (If in Image Generation Mode):
   - Generate an image based on ${truncatedName}'s textual description.
   - Your response MUST include both the image data and a textual part (e.g., "Here's your image:").
   - **CRITICAL**: DO NOT output JSON for image generation.
   - If generation fails, explain why politely in plain text.
3. Educational Content (JSON - Only if not in Image Gen Mode):
   - If ${truncatedName} explicitly requests educational content (flashcards or quiz questions), return exactly one JSON object.
   - The JSON must be wrapped in a single code block using triple backticks and the "json" language identifier.
   - Return only the JSON object with no additional text or extra lines before or after the JSON block itself.
   - Use one of the following formats:
     For flashcards:
     \`\`\`json
     {
       "type": "flashcard",
       "data": [ { "id": "unique-id-1", "question": "Question 1", "answer": "Answer 1", "topic": "Subject area" } ]
     }
     \`\`\`
     For quiz questions:
     \`\`\`json
     {
       "type": "question",
       "data": [ { "id": "unique-id-1", "question": "Question 1", "options": ["Option 1", "Option 2"], "correctAnswer": 0, "explanation": "Explanation 1" } ]
     }
     \`\`\`
4. Data Modifications (JSON - Only if not in Image Gen Mode):
   - When ${truncatedName} commands to create, update, or delete an item, you *MUST* respond with a brief conversational confirmation (e.g., "Okay, I'll create that task!") *followed by* the JSON block.
   - Your conversational confirmation text will be shown to the user.
   - JSON structure: \`\`\`json\n{"action": "actionName", "payload": {...}}\n\`\`\`
   - Valid actions: "createTask", "updateTask", "deleteTask", "createGoal", "updateGoal", "deleteGoal", "createPlan", "updatePlan", "deletePlan", "createProject", "updateProject", "deleteProject".
   - Payloads for creation *MUST* include the name of the item. Examples:
     - For "createTask": payload must include a \`task\` field (string) for the task name. E.g., \`{"action": "createTask", "payload": {"task": "Buy groceries", "priority": "high"}}\`
     - For "createGoal": payload must include a \`goal\` field (string) for the goal name. E.g., \`{"action": "createGoal", "payload": {"goal": "Learn Python"}}\`
     - For "createPlan": payload must include a \`plan\` field (string) for the plan name. E.g., \`{"action": "createPlan", "payload": {"plan": "Weekend trip"}}\`
     - For "createProject": payload must include a \`project\` field (string) for the project name. E.g., \`{"action": "createProject", "payload": {"project": "Home renovation"}}\`
     - Optional fields like \`priority\`, \`dueDate\`, \`description\`, etc., can also be included as appropriate.
   - For "update..." actions, the payload can identify the item by its current name (e.g., \`task: "Old Task Name"\`) or \`id\` (if known), and then include fields to change (e.g., \`newTask: "New Task Name"\`, \`priority: "low"\`).
   - For "delete..." actions, the payload can identify the item by its name (e.g., \`task: "Task to Delete"\`) or \`id\` (if known).
   - My system will display your conversational confirmation and process the JSON block. Ensure the JSON is the LAST part of your response.
5. Response Structure Summary:
   - General chat/file Q&A: Natural language text only.
   - Image generation: Image data AND a textual part. NO JSON.
   - Educational content: ONLY the JSON code block as per Guideline 3.
   - Data modification: Your conversational confirmation text, THEN the JSON code block as per Guideline 4.
Follow these instructions strictly.
Assistant:`;
  };

  const generateChatName = async (convId: string, conversationSoFar: string) => {
    try {
      const namePrompt = `Please provide a short 3-5 word title summarizing the conversation so far:\n${conversationSoFar}\nReturn ONLY the title, with no extra commentary.`;
      const fullApiUrl = `${GEMINI_API_BASE}${GEMINI_TEXT_MODEL}:generateContent?key=${geminiApiKey}`;
      const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }] }] })};
      const response = await fetchWithTimeout(fullApiUrl, options, 20000);
      const responseText = await response.text();
      const parsed = parseGeminiApiResponse(responseText, false);
      const finalText = parsed.text || 'Untitled Chat';
      await updateChatConversationName(convId, finalText.trim().substring(0, 50));
    } catch (err) { console.error('Error generating chat name:', err); }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (isImageGenModeActive && !chatMessage.trim()) || !user || !user.uid) return;

    let currentConvId = conversationId;
    if (!currentConvId) {
      const newId = await createChatConversation(user.uid, "New Chat");
      if (!newId) { console.error("Failed to create/get conversation ID"); return; }
      currentConvId = newId;
      setConversationId(currentConvId);
      setHasGeneratedChatName(false);
    }

    if (isChatDisabledByLimit) {
        const limitMsgForState: ChatMessageData = {
            id: `error-limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${chatLimit} message limit. Upgrade for more!`, error: true, createdAt: new Date()
        };
        setChatHistory(prev => [...prev, limitMsgForState ]);
        if(currentConvId) await saveChatMessage(currentConvId, {role: 'assistant', content: limitMsgForState.content, error: true, createdAt: new Date()});
        setChatMessage('');
        return;
    }

    const userMsgContent = chatMessage;
    const filesForThisMessageSubmission = [...selectedFiles];

    // Revoke local preview URLs for files being submitted, they are no longer needed in the selectedFiles state for this batch.
    filesForThisMessageSubmission.forEach(sf => {
        if (sf.localPreviewUrl) URL.revokeObjectURL(sf.localPreviewUrl);
    });
    setSelectedFiles([]); // Clear selected files from UI input area

    const localUserMessageId = `user-local-${Date.now()}`;
    // For UI display, we might still want to show localPreviewUrls if they were generated, even if revoked later
    // Or, for simplicity, if they are revoked, don't pass them.
    // Let's assume the revoke is for memory management and UI can still show a placeholder or the name.
    const attachedFilesMetaDataForUi: ChatMessageData['attachedFilesMeta'] = filesForThisMessageSubmission.map(sf => ({
        name: sf.name, type: sf.type, size: sf.size,
        // localPreviewUrl: sf.localPreviewUrl // Since we revoked, maybe not include it here or pass a flag
    }));


    const userMessageForState: ChatMessageData = {
        id: localUserMessageId,
        role: 'user',
        content: userMsgContent,
        attachedFilesMeta: attachedFilesMetaDataForUi.length > 0 ? filesForThisMessageSubmission.map(sf => ({ // Re-map to ensure localPreviewUrl is available for the immediate UI update
            name: sf.name, type: sf.type, size: sf.size, localPreviewUrl: sf.localPreviewUrl
        })) : undefined,
        createdAt: new Date()
    };
    setChatHistory(prev => [...prev, userMessageForState]);

    const uploadedFilesMetaDataToSave: FirebaseAttachedFileMeta[] = [];
    let userMessageContentForSave = userMsgContent; // This can be modified if file content is inlined for AI

    if (!isImageGenModeActive && filesForThisMessageSubmission.length > 0 && user && user.uid && currentConvId) {
        setIsChatLoading(true);
        // Update the UI message to show files are uploading
        setChatHistory(prev => prev.map(msg => msg.id === localUserMessageId ? {...msg, content: `${msg.content}\n(Uploading ${filesForThisMessageSubmission.length} attachment(s)...)`} : msg));

        for (const sf of filesForThisMessageSubmission) {
            try {
                const { downloadURL, storagePath, name, type, size } = await uploadFileToStorage(user.uid, currentConvId, sf.fileObject);
                uploadedFilesMetaDataToSave.push({ url: downloadURL, storagePath, name, type, size });
            } catch (uploadError) {
                console.error("Error uploading user file:", sf.name, uploadError);
                // Still add meta for files that failed to upload, but without URL/storagePath, so AI knows they were attempted
                uploadedFilesMetaDataToSave.push({ name: sf.name, type: sf.type, size: sf.size }); // No URL or storagePath
                // Optionally add an error message to chat history about the failed upload
                setChatHistory(prev => [...prev, {id: `upload-err-${sf.name}-${Date.now()}`, role: 'assistant', content: `❌ Failed to upload file: ${sf.name}`, error: true, createdAt: new Date()}]);
            }
        }
        // Update the user message in history with the final state of attached files (with URLs for successful uploads)
        setChatHistory(prev => prev.map(msg => msg.id === localUserMessageId ? {
            ...msg,
            content: userMsgContent, // Restore original content
            attachedFilesMeta: uploadedFilesMetaDataToSave.map(meta => ({
                ...meta,
                // Try to find original localPreviewUrl if needed for consistency, though it was revoked
                localPreviewUrl: filesForThisMessageSubmission.find(sf => sf.name === meta.name)?.localPreviewUrl
            }))
        } : msg));
        setIsChatLoading(false); // Potentially set to false after API call too
    }

    const userMessageToSave: Partial<FirebaseChatMessage> = {
        role: 'user',
        content: userMessageContentForSave,
        attachedFilesMeta: uploadedFilesMetaDataToSave.length > 0 ? uploadedFilesMetaDataToSave : undefined,
        createdAt: new Date()
    };
    if (currentConvId) await saveChatMessage(currentConvId, userMessageToSave);

    setChatMessage(''); // Clear input field

    // Handle chat usage increment
    if (userTier !== 'premium' && userTier !== 'loading') {
      try {
        await incrementUserChatUsage(user.uid);
        setChatUsageCount(prev => prev + 1);
      } catch (error) {
        console.error("Failed to increment chat usage:", error);
        const usageErrorMsgToSave: Partial<FirebaseChatMessage> = {
            role: 'assistant',
            content: "⚠️ Error saving usage count. Message sent.",
            error: true // Or a specific type of warning
        };
       if (currentConvId) await saveChatMessage(currentConvId, usageErrorMsgToSave);
       // Do not block chat for this error, message was already sent.
      }
    }


    const timerDuration = parseTimerRequest(userMsgContent);
    if (timerDuration && !isImageGenModeActive) {
      const timerId = `timer-${Date.now()}`;
      const timerMsgContent = `Okay, ${truncatedName}! Starting a timer for ${timerDuration < 60 ? timerDuration + ' seconds' : Math.round(timerDuration / 60) + ' minutes'}.`;
      const timerMsgToSave: Partial<FirebaseChatMessage> = {
        role: 'assistant',
        content: timerMsgContent,
        timer: { type: 'timer', duration: timerDuration, id: timerId }
      };
      if (currentConvId) await saveChatMessage(currentConvId, timerMsgToSave);
      return; // Don't proceed to Gemini if it's just a timer request
    }


    setIsChatLoading(true);
    const newAssistantLoadingPlaceholderId = `assistant-ph-${Date.now()}`;
    setAssistantLoadingPlaceholderId(newAssistantLoadingPlaceholderId);
    const assistantResponsePlaceholder: ChatMessageData = {
      id: newAssistantLoadingPlaceholderId,
      role: 'assistant',
      content: "...", // Placeholder content
      createdAt: new Date(),
      isGeneratingImage: isImageGenModeActive, // Indicate if image generation is expected
    };
    setChatHistory(prev => [...prev, assistantResponsePlaceholder]);
    setStreamingAssistantContent(''); // Reset streaming content


    const prompt = createPrompt(userMsgContent, filesForThisMessageSubmission); // Pass files with base64 for prompt
    const currentTargetModel = isImageGenModeActive ? GEMINI_IMAGE_GEN_MODEL : GEMINI_TEXT_MODEL;
    const fullApiUrl = `${GEMINI_API_BASE}${currentTargetModel}:generateContent?key=${geminiApiKey}`;

    const apiParts: any[] = [{ text: prompt }];

    if (!isImageGenModeActive && filesForThisMessageSubmission.length > 0) {
        filesForThisMessageSubmission.forEach(selectedFile => {
            // Only include supported types for inline data
            if (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf' || selectedFile.type === 'text/plain' || selectedFile.name.endsWith('.md') || selectedFile.type === "image/svg+xml") {
                 apiParts.push({ inline_data: { mime_type: selectedFile.type, data: selectedFile.base64Data }});
            }
            // For other types, the AI is informed by the preamble in the prompt.
        });
    }

    const apiRequestBody: any = {
        contents: [{ parts: apiParts }]
    };

    // Add generationConfig
    let generationConfig: any = {
        temperature: 0.7, // Adjust as needed
        maxOutputTokens: 8192, // Adjust for text model
    };
    if (isImageGenModeActive) {
        generationConfig.maxOutputTokens = 2048; // Typically smaller for image-related text
        generationConfig.responseModalities = ["TEXT", "IMAGE"]; // Explicitly request TEXT and IMAGE
    }
    apiRequestBody.generationConfig = generationConfig;


    const geminiOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody)
    };

    try {
      const response = await fetchWithTimeout(fullApiUrl, geminiOptions);
      const responseText = await response.text();
      const parsedApiResult = parseGeminiApiResponse(responseText, isImageGenModeActive);

      let assistantTextForDisplay = parsedApiResult.text || "";
      const geminiGeneratedImageData: LocalImageData | null = parsedApiResult.localImageData;
      let finalImageUrl: string | undefined = undefined;
      let finalImageMeta: FirebaseImageMeta | undefined = undefined;

      if (isImageGenModeActive && geminiGeneratedImageData && user && user.uid && currentConvId) {
        // Update placeholder to indicate image saving
        setChatHistory(prev => prev.map(msg => msg.id === newAssistantLoadingPlaceholderId ? {...msg, content: "Generating & saving image..." } : msg));
        try {
          const { downloadURL, storagePath } = await uploadBase64ImageToStorage(
            user.uid,
            currentConvId,
            geminiGeneratedImageData.base64,
            geminiGeneratedImageData.type,
            geminiGeneratedImageData.name
          );
          finalImageUrl = downloadURL;
          finalImageMeta = {
            name: geminiGeneratedImageData.name,
            type: geminiGeneratedImageData.type,
            storagePath
          };
        } catch (uploadError) {
          console.error("Error uploading AI generated image:", uploadError);
          assistantTextForDisplay = (assistantTextForDisplay ? assistantTextForDisplay + "\n" : "") + "Error: Failed to save generated image.";
          // Potentially set an error flag on the message
        }
      }


      let educationalContent: any = null;
      let actionTaken = false;
      let combinedActionConfirmation = "";
      let finalActionDetails: ChatMessageData['actionDetails'] | undefined = undefined;

      // Extract JSON blocks and separate text.
      // This function should ideally handle cases where AI might return text AND JSON.
      const { blocks: jsonActionBlocks, cleanedText, originalText } = extractJsonBlocks(parsedApiResult.text || "");
      assistantTextForDisplay = isImageGenModeActive ? (parsedApiResult.text || (finalImageUrl ? "Generated image:" : "")) : cleanedText;


      if (!isImageGenModeActive && jsonActionBlocks.length > 0) {
          for (const parsed of jsonActionBlocks) { // Iterate over all found JSON blocks
            if (parsed.action && parsed.payload && user.uid) {
              actionTaken = true; // Mark that an action was attempted
              const payload = { ...parsed.payload }; // Clone payload for modification
              let itemNaturalLanguageResponse = ""; // Confirmation for this specific action

              // Date parsing logic
              if (payload.dueDate && typeof payload.dueDate === 'string') {
                const date = new Date(payload.dueDate);
                if (!isNaN(date.getTime())) payload.dueDate = date; else delete payload.dueDate;
              }
              if (payload.targetDate && typeof payload.targetDate === 'string') { // For goals
                const date = new Date(payload.targetDate);
                if (!isNaN(date.getTime())) payload.targetDate = date; else delete payload.targetDate;
              }
              // Add similar for startDate, endDate for plans, deadline for projects if they come as strings

              try { // Wrap Firebase calls in try-catch to handle individual action errors
                if (parsed.action === 'createTask') { await createUserTask(user.uid, payload); itemNaturalLanguageResponse = `Task "${payload.task || 'Untitled'}" created.`; }
                else if (parsed.action === 'createGoal') { await createUserGoal(user.uid, payload); itemNaturalLanguageResponse = `Goal "${payload.goal || 'Untitled'}" set.`; }
                else if (parsed.action === 'createPlan') { await createUserPlan(user.uid, payload); itemNaturalLanguageResponse = `Plan "${payload.plan || 'Untitled'}" created.`; }
                else if (parsed.action === 'createProject') { await createUserProject(user.uid, payload); itemNaturalLanguageResponse = `Project "${payload.project || 'Untitled'}" set up.`; }
                else if (parsed.action === 'updateTask') { const id = payload.id || await findItemByName('tasks',user.uid,payload.task,'task'); if(id){await updateUserTask(id,payload);} itemNaturalLanguageResponse = `Task "${payload.newTask || payload.task}" updated.`; }
                else if (parsed.action === 'updateGoal') { const id = payload.id || await findItemByName('goals',user.uid,payload.goal,'goal'); if(id){await updateUserGoal(id,payload);} itemNaturalLanguageResponse = `Goal "${payload.newGoal || payload.goal}" updated.`; }
                else if (parsed.action === 'updatePlan') { const id = payload.id || await findItemByName('plans',user.uid,payload.plan,'plan'); if(id){await updateUserPlan(id,payload);} itemNaturalLanguageResponse = `Plan "${payload.newPlan || payload.plan}" updated.`; }
                else if (parsed.action === 'updateProject') { const id = payload.id || await findItemByName('projects',user.uid,payload.project,'project'); if(id){await updateUserProject(id,payload);} itemNaturalLanguageResponse = `Project "${payload.newProject || payload.project}" updated.`; }
                else if (parsed.action === 'deleteTask') { const id = payload.id || await findItemByName('tasks',user.uid,payload.task,'task'); if(id){await deleteUserTask(id);} itemNaturalLanguageResponse = `Task "${payload.task}" deleted.`; }
                else if (parsed.action === 'deleteGoal') { const id = payload.id || await findItemByName('goals',user.uid,payload.goal,'goal'); if(id){await deleteUserGoal(id);} itemNaturalLanguageResponse = `Goal "${payload.goal}" deleted.`; }
                else if (parsed.action === 'deletePlan') { const id = payload.id || await findItemByName('plans',user.uid,payload.plan,'plan'); if(id){await deleteUserPlan(id);} itemNaturalLanguageResponse = `Plan "${payload.plan}" deleted.`; }
                else if (parsed.action === 'deleteProject') { const id = payload.id || await findItemByName('projects',user.uid,payload.project,'project'); if(id){await deleteUserProject(id);} itemNaturalLanguageResponse = `Project "${payload.project}" deleted.`; }
                else { actionTaken = false; /* Not a recognized action */ }


                if (itemNaturalLanguageResponse) combinedActionConfirmation += (combinedActionConfirmation ? " " : "") + itemNaturalLanguageResponse;
                finalActionDetails = { status: 'success' }; // Assume success if no throw
              } catch (actionError: any) {
                  console.error(`Error processing action ${parsed.action}:`, actionError);
                  combinedActionConfirmation += (combinedActionConfirmation ? " " : "") + `Error with ${parsed.action}: ${actionError.message || 'Failed'}.`;
                  finalActionDetails = { status: 'error' }; // Mark as error
              }

            } else if (parsed.type && parsed.data && (parsed.type === 'flashcard' || parsed.type === 'question')) {
              educationalContent = parsed;
            }
          }
      }

      // Consolidate assistant text based on outcomes
      if (actionTaken) {
          if (combinedActionConfirmation.trim()) {
              // If there was a conversational confirmation from AI (cleanedText) AND specific action confirmations, combine them.
              // Or, if AI provided text (cleanedText) meant as confirmation, and we also have our generated one.
              // Let's prioritize our generated confirmation if `cleanedText` from AI was just the confirmation prompt itself.
              assistantTextForDisplay = (cleanedText && cleanedText !== "Okay, I'll create that task!" && cleanedText !== "Okay, I'll update that." && cleanedText !== "Okay, I'll delete that." ? cleanedText + "\n" : "") + combinedActionConfirmation;
          } else if (!cleanedText.trim() && !isImageGenModeActive) { // No AI text, no generated confirmation, but action was taken
              assistantTextForDisplay = "Action processed."; // Generic success
          } else if (isImageGenModeActive && !assistantTextForDisplay.trim()) {
              // This case should be rare if actions are disabled in image gen mode per prompt
              assistantTextForDisplay = "Action processed alongside image generation attempt.";
          }
          // `finalActionDetails` is already set
      } else if (educationalContent) {
          // If AI gave text along with educational JSON, use it. Otherwise, default.
          if (!cleanedText.trim()) {
            assistantTextForDisplay = "Here's the educational content you requested:";
          } else {
            assistantTextForDisplay = cleanedText; // Use AI's text if provided
          }
      } else if (isImageGenModeActive) {
          if (parsedApiResult.error) {
              assistantTextForDisplay = parsedApiResult.error; // API error for image gen
          } else if (!finalImageUrl && !assistantTextForDisplay.trim()) {
              assistantTextForDisplay = "Image generation may have failed or no content was returned.";
          } else if (finalImageUrl && !assistantTextForDisplay.trim()){
              assistantTextForDisplay = "Generated image:"; // Default text if AI provided image but no text
          }
      } else if (!assistantTextForDisplay.trim() && originalText && !finalImageUrl) {
          // If cleanedText is empty (meaning original was all JSON or whitespace) but there was original text
          // and no image was generated, use the original text (minus successfully parsed JSON).
          // This handles cases where AI might return only malformed JSON.
          assistantTextForDisplay = originalText;
      }

      // Final fallback if no content at all
      if (!assistantTextForDisplay.trim() && !finalImageUrl && !parsedApiResult.error && !educationalContent && !actionTaken) {
          assistantTextForDisplay = "(No specific content received)";
      }

      // Ensure API errors are prioritized if no other meaningful content.
      if (parsedApiResult.error && (!assistantTextForDisplay.trim() || assistantTextForDisplay === "(No specific content received)")) {
          assistantTextForDisplay = parsedApiResult.error;
      }


      const finalAssistantMsgDataForUi: ChatMessageData = {
          id: newAssistantLoadingPlaceholderId, // Use the placeholder ID
          role: 'assistant',
          content: assistantTextForDisplay.trim() || (finalImageUrl ? "Generated image:" : "(No text content)"),
          createdAt: new Date(),
          flashcard: educationalContent?.type === 'flashcard' ? educationalContent : undefined,
          question: educationalContent?.type === 'question' ? educationalContent : undefined,
          actionDetails: actionTaken ? finalActionDetails : undefined, // Use the potentially modified finalActionDetails
          imageUrl: finalImageUrl,
          imageMeta: finalImageMeta,
          wasImageGenerated: isImageGenModeActive && !!finalImageUrl && !parsedApiResult.error, // True if in mode, URL exists, and no API error
          error: !!parsedApiResult.error || (actionTaken && finalActionDetails?.status === 'error'), // Also mark error if action failed
          isGeneratingImage: false, // No longer generating
      };
      setChatHistory(prev => prev.map(msg => msg.id === newAssistantLoadingPlaceholderId ? finalAssistantMsgDataForUi : msg ));

      const finalAssistantMsgToSave: Partial<FirebaseChatMessage> = {
          role: finalAssistantMsgDataForUi.role,
          content: finalAssistantMsgDataForUi.content,
          createdAt: finalAssistantMsgDataForUi.createdAt,
          flashcard: finalAssistantMsgDataForUi.flashcard,
          question: finalAssistantMsgDataForUi.question,
          actionDetails: finalAssistantMsgDataForUi.actionDetails,
          imageUrl: finalAssistantMsgDataForUi.imageUrl,
          imageMeta: finalAssistantMsgDataForUi.imageMeta,
          wasImageGenerated: finalAssistantMsgDataForUi.wasImageGenerated,
          error: finalAssistantMsgDataForUi.error,
      };
      if (currentConvId) await saveChatMessage(currentConvId, finalAssistantMsgToSave);

      // Auto-generate chat name
      const conversationHistoryForName = [...chatHistory.filter(m => m.id !== newAssistantLoadingPlaceholderId), finalAssistantMsgDataForUi];
      const totalUserMessagesInConv = conversationHistoryForName.filter(m => m.role === 'user').length;
      const currentConvInfo = conversationList.find(c => c.id === currentConvId);

      if (currentConvId && currentConvInfo?.chatName === "New Chat" && (!hasGeneratedChatName || totalUserMessagesInConv === 1)) {
          // Create a temporary history that includes the latest user and assistant message for naming
          const tempHistoryForNaming = chatHistory.filter(m => m.role === 'user' || (m.role === 'assistant' && m.id !== newAssistantLoadingPlaceholderId && m.id !== localUserMessageId)); // Exclude placeholders
          tempHistoryForNaming.push({ ...userMessageForState, id: 'temp-user-for-name' } as ChatMessageData); // Add the processed user message
          tempHistoryForNaming.push({ ...finalAssistantMsgDataForUi, id: 'temp-assistant-for-name' }); // Add the final assistant message

          const conversationTextForNaming = tempHistoryForNaming.slice(-6) // Take last few turns
              .map((m) =>`${m.role === 'user' ? truncatedName : 'Assistant'}: ${m.content}`)
              .join('\n');
          if (conversationTextForNaming.length > 10) { // Ensure there's enough content
            await generateChatName(currentConvId, conversationTextForNaming);
            setHasGeneratedChatName(true);
          }
      }

      // Switch back from image gen mode if successful, without the extra message
      if (isImageGenModeActive && finalImageUrl && !parsedApiResult.error) {
        setIsImageGenModeActive(false);
        // The line below adding the chat message has been removed as per user request.
        // setChatHistory(prev => [...prev, {id: `local-img-mode-off-${Date.now()}`, role: 'assistant', content: "🖼️ Image generated! Switched back to text & file mode.", createdAt: new Date()}]);
      }

    } catch (err: any) {
      console.error('Chat Submit Error:', err);
      const errorMsgContent = `Sorry, I encountered an error${err.message ? ': ' + err.message : '.'} Please try again.`;
      const errorMsgForState: ChatMessageData = {
          id: newAssistantLoadingPlaceholderId, // Update the placeholder
          role: 'assistant',
          content: errorMsgContent,
          error: true,
          createdAt: new Date()
      };
      setChatHistory(prev => prev.map(msg => msg.id === newAssistantLoadingPlaceholderId ? errorMsgForState : msg ));
      const errorMsgToSave: Partial<FirebaseChatMessage> = {
          role: 'assistant',
          content: errorMsgContent,
          error: true,
          createdAt: new Date()
      };
      if (currentConvId) await saveChatMessage(currentConvId, errorMsgToSave);
    } finally {
      setIsChatLoading(false);
      setAssistantLoadingPlaceholderId(null); // Clear placeholder ID
      setStreamingAssistantContent(''); // Clear streaming content
    }
  };

  const handleNewConversation = async () => { if (!user || !user.uid) return; const newConvId = await createChatConversation(user.uid, 'New Chat'); if (newConvId) {setConversationId(newConvId);} };
  const handleSelectConversation = (convId: string) => { if(conversationId === convId && chatHistory.length > 0 && !isChatLoading) return; setConversationId(convId); const selConv = conversationList.find(c => c.id === convId); setHasGeneratedChatName(selConv ? selConv.chatName !== "New Chat" : false);};
  const handleRenameConversation = async (conv: any) => { setOpenDropdownId(null); const newName = window.prompt('Enter new chat name:', conv.chatName); if (newName?.trim()) await updateChatConversationName(conv.id, newName.trim()); };
  const handleDeleteConversationClick = async (conv: any) => { setOpenDropdownId(null); if (!window.confirm(`Delete "${conv.chatName}"?`)) return; await deleteChatConversation(conv.id); if (conversationId === conv.id) { setConversationId(null); } };
  const handleShareConversation = async (conv: any) => { setOpenDropdownId(null); alert(`Sharing ID: ${conv.id} (Not fully implemented)`); };

  const iconClass = "w-4 h-4";
  const smallIconClass = "w-3.5 h-3.5";

  const quickActions = useMemo(() => [
    'Create a Task', 'Create a Goal', 'Create a Plan', 'Create a Project', 'Analyze my items', 'Schedule a plan for me', 'Set a Reminder', 'Start a Timer for 5 minutes', 'Track My Progress', 'Brainstorm Ideas', 'Review My Goals', 'Generate a Report', 'Organize My Notes', 'Suggest Improvements', 'Create a Checklist', 'Prioritize My Tasks', 'Find a Solution', 'Log My Activity', 'Plan My Day', 'Break Down a Project', 'Summarize Information', 'Set a Deadline', 'Optimize My Workflow', 'Compare My Options', 'Visualize My Data', 'Sync My Calendar', 'Reflect on Progress',
  ], []);

  const quickActionIcons: Record<string, JSX.Element> = useMemo(() => ({
    'Create a Task': <CheckCircle className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Create a Goal': <Goal className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Create a Plan': <Calendar className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Create a Project': <Folder className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Analyze my items': <BarChart2 className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Schedule a plan for me': <Clock className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Set a Reminder': <Bell className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Start a Timer for 5 minutes': <TimerIconLucide className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Track My Progress': <TrendingUp className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Brainstorm Ideas': <Lightbulb className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Review My Goals': <Target className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Generate a Report': <FileText className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Organize My Notes': <Notebook className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Suggest Improvements': <Wand className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Create a Checklist': <ListChecks className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Prioritize My Tasks': <SortAsc className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Find a Solution': <Search className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Log My Activity': <ClipboardList className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Plan My Day': <Sun className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Break Down a Project': <Layers className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Summarize Information': <AlignLeft className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Assign a Task': <UserCheck className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Set a Deadline': <Hourglass className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Optimize My Workflow': <Settings className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Compare My Options': <Columns className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Visualize My Data': <PieChart className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Delegate Work': <Users className={`${iconClass} inline-block scale-90 md:scale-100`} />, 'Sync My Calendar': <CalendarCheck className={`${iconClass} inline-block scale-90 md:scale-100`} />,
    'Reflect on Progress': <Eye className={`${iconClass} inline-block scale-90 md:scale-100`} />,
  }), [iconClass]);

  const handleQuickActionClick = (action: string) => { setChatMessage(action); textareaRef.current?.focus(); };
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`; setChatMessage(ta.value); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };

  const leftOverlayClass = `absolute left-0 top-0 h-full w-16 z-10 pointer-events-none bg-gradient-to-r ${currentTheme.gradientFrom} to-transparent`;
  const rightOverlayClass = `absolute right-0 top-0 h-full w-16 z-10 pointer-events-none bg-gradient-to-l ${currentTheme.gradientFrom} to-transparent`;
  const quickActionSetWidth = useMemo(() => 160 * quickActions.length, [quickActions.length]);

  const currentConversationName = useMemo(() => {
    if (!conversationId) return "AI Assistant";
    const conv = conversationList.find(c => c.id === conversationId);
    return conv?.chatName || "Chat";
  }, [conversationId, conversationList]);

  const effectiveImageGenButtonClass = isImageGenModeActive ? currentTheme.imageGenActiveButtonClass : currentTheme.imageGenButtonClass;

  return (
    <div className={`flex flex-col md:flex-row h-screen ${currentTheme.containerBg} ${currentTheme.textColor} font-sans`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(p => !p)} userName={userName}
        isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled}
        isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled}
        currentThemeName={currentTheme.name}
      />
      <main className={`flex-1 overflow-hidden transition-all duration-300
          ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}
          ${!conversationId ? 'h-[calc(100vh_-_12rem)] sm:h-[calc(100vh_-_10rem)] md:h-full' : 'h-full'}`}
      >
        {!conversationId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-6">
            <h1 className={`text-xl md:text-3xl font-semibold mb-2 md:mb-3 ${currentTheme.textColor}`}>
              Hey {truncatedName}, how can I help you today?
            </h1>
            <p className={`mb-4 md:mb-6 text-sm ${currentTheme.mutedTextColor}`}>
              Select a quick action or start a new conversation.
            </p>
            <div className="relative w-full max-w-5xl overflow-hidden my-3 md:my-4">
              <div className={leftOverlayClass} />
              <div className={rightOverlayClass} />
              <div className="flex relative overflow-x-auto pb-3 hide-scrollbar">
                <motion.div
                  className="flex space-x-2.5 md:space-x-3 px-2"
                  animate={{ x: [0, -(quickActionSetWidth / (quickActions.length > 0 ? quickActions.length : 1) * quickActions.length)] }}
                  transition={{ x: { repeat: Infinity, repeatType: "loop", duration: quickActions.length * 2.5, ease: "linear" } }}
                >
                  {[...Array(6)].map((_, setIndex) => (
                    quickActions.map((action, index) => (
                      <button
                        key={`set${setIndex}-${index}`}
                        className={`flex items-center space-x-2 md:space-x-2.5 ${currentTheme.quickActionBg} px-3.5 py-2 md:px-4 md:py-2.5 rounded-xl text-white whitespace-nowrap text-xs md:text-sm flex-shrink-0 shadow-md transform transition-transform active:scale-95 ${currentTheme.quickActionHoverBg} hover:scale-102`}
                        onClick={() => handleQuickActionClick(action)}
                      >
                        <span className="flex-shrink-0 mr-0.5">{quickActionIcons[action]}</span>
                        <span>{action}</span>
                      </button>
                    ))
                  ))}
                </motion.div>
              </div>
            </div>
            <form onSubmit={handleChatSubmit} className="mt-4 md:mt-6 w-full max-w-3xl px-2">
              {userTier !== 'premium' && userTier !== 'loading' && (
                <div className={`pb-1.5 text-xs text-center ${currentTheme.mutedTextColor}`}>
                  Messages this month: {chatUsageCount} / {currentChatLimitDisplay === Infinity ? '∞' : currentChatLimitDisplay}
                  {isChatDisabledByLimit && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>}
                  {!isChatDisabledByLimit && userTier === 'basic' && (
                    <Link to="/pricing" className={`ml-2 font-medium ${currentTheme.accentColor} hover:underline`}>
                      <Crown className={`${smallIconClass} inline mr-0.5`} />Upgrade
                    </Link>
                  )}
                </div>
              )}
              {selectedFiles.length > 0 && !isImageGenModeActive && (
                 <div className="mb-2 flex flex-wrap justify-center gap-2 max-h-20 overflow-y-auto p-1 rounded-md border border-dashed border-gray-500/50">
                    {selectedFiles.map(file => (
                        <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${currentTheme.filePillBg} ${currentTheme.filePillText}`}>
                            {file.type.startsWith("image/") && file.localPreviewUrl && (
                                <img src={file.localPreviewUrl} alt={file.name} className="w-5 h-5 rounded mr-1 object-cover"/>
                            )}
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span>
                            <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${currentTheme.name === 'illuminate' ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button>
                        </div>
                    ))}
                 </div>
              )}
              <div className="flex gap-2 items-end">
                <button type="button" onClick={() => setIsContextDialogOpen(true)} className={`${currentTheme.actionButtonBg} text-white p-2.5 rounded-full transition-colors flex-shrink-0 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-100`} title="Set AI Context">
                  <Brain className={iconClass} />
                </button>
                <div className="flex-shrink-0">
                  <ChatControls onStyleSelect={handleStyleSelect} onCustomStyleCreate={handleCustomStyleCreate} isBlackoutEnabled={isBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled} activeStyle={activeStyle} currentThemeName={currentTheme.name} />
                </div>
                 <textarea
                    ref={textareaRef}
                    rows={1}
                    value={chatMessage}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isChatDisabledByLimit ? "Monthly limit reached..." : isImageGenModeActive ? "Describe the image to generate..." : "Ask anything, or attach files..."}
                    className={`flex-1 ${currentTheme.inputBg} ${currentTheme.textColor} ${currentTheme.name === 'illuminate' ? 'placeholder-gray-500' : 'placeholder-gray-400'} rounded-lg px-3 py-2 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[120px] leading-snug border ${currentTheme.name === 'illuminate' ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500' : 'border-gray-600 focus:border-blue-500 focus:ring-blue-500'} shadow-sm disabled:opacity-70`}
                    disabled={isChatLoading || isChatDisabledByLimit || userTier === 'loading'}
                    style={{ height: 'auto' }}
                  />
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept={SUPPORTED_FILE_TYPES} className="hidden" disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit} />
                <button type="button" onClick={triggerFileSelect} disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit} className={`${currentTheme.buttonSecondaryClass} p-2.5 rounded-full transition-colors ${isImageGenModeActive || isChatLoading || isChatDisabledByLimit ? currentTheme.buttonDisabledClass : 'hover:shadow-md transform hover:scale-105 active:scale-100'}`} title={isImageGenModeActive ? "File attachment disabled in image mode" : "Attach Files"}>
                    <Paperclip className={iconClass} />
                </button>
                <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isChatDisabledByLimit} className={`${effectiveImageGenButtonClass} p-2.5 rounded-full transition-colors ${isChatLoading || isChatDisabledByLimit ? currentTheme.buttonDisabledClass : 'hover:shadow-md transform hover:scale-105 active:scale-100'} ${isImageGenModeActive ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 dark:ring-offset-black' : ''}`} title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}>
                    <ImageIcon className={iconClass} />
                </button>
                <button type="submit" disabled={isChatLoading || isChatDisabledByLimit || userTier === 'loading' || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (isImageGenModeActive && !chatMessage.trim())}
                  className={`${currentTheme.actionButtonBg} text-white p-2.5 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-100`}
                >
                   {isChatLoading ? <Loader2 className={`${iconClass} animate-spin`} /> : <Send className={iconClass} />}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className={`p-3 border-b ${currentTheme.headerBorder} ${currentTheme.headerBg} flex justify-between items-center sticky top-0 z-20 shadow-sm`}>
                <div className="flex items-center gap-2">
                  <Bot className={`w-5 h-5 ${currentTheme.accentColor} flex-shrink-0`} />
                  <h1 className={`text-base sm:text-lg font-semibold ${currentTheme.textColor} truncate`}>{currentConversationName}</h1>
                </div>
                <div className={`flex items-center gap-1 text-xs ${currentTheme.mutedTextColor} ml-2`}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${currentTheme.warningColor} flex-shrink-0`} />
                    <span className="hidden sm:inline">AI responses may be inaccurate.</span>
                    <span className="sm:hidden">Inaccurate responses possible.</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5" >
              {chatHistory.map((message) => {
                const isUserMsg = message.role === 'user';
                const isAssistantMsg = message.role === 'assistant';
                const isCurrentAssistantTextLoading = isAssistantMsg && message.id === assistantLoadingPlaceholderId && isChatLoading && !message.isGeneratingImage && !message.imageUrl;
                const isCurrentAssistantImageGenerating = isAssistantMsg && message.id === assistantLoadingPlaceholderId && isChatLoading && message.isGeneratingImage;
                return (
                <div key={message.id} className={`flex ${isUserMsg ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${isUserMsg ? currentTheme.userBubble : message.error ? currentTheme.errorBubble : currentTheme.assistantBubble}`}>
                    {(message.content && message.content !== "..." && !isCurrentAssistantTextLoading && !isCurrentAssistantImageGenerating) && (
                        <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
                            components={{
                                p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-sm" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-sm" {...props} />,
                                li: ({node, ...props}) => <li className="mb-0.5" {...props} />,
                                a: ({node, ...props}) => <a className={`${currentTheme.accentColor} hover:underline`} target="_blank" rel="noopener noreferrer" {...props} />,
                                code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!${currentTheme.markdownPreBg} p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!${currentTheme.markdownCodeBg} px-1 rounded text-xs ${className}`} {...props}>{children}</code>); },
                            }}
                        >{message.content}</ReactMarkdown>
                    )}
                    {isCurrentAssistantTextLoading && (
                        streamingAssistantContent ? (
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {streamingAssistantContent + '▍'}
                            </ReactMarkdown>
                        ) : (
                            <div className="flex space-x-1 p-1">
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-60"></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-60"></div>
                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-60"></div>
                            </div>
                        )
                    )}
                    {isCurrentAssistantImageGenerating && (
                        <div className={`flex items-center gap-2 p-1 ${currentTheme.name === 'illuminate' ? 'text-gray-600' : 'text-gray-400'}`}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">Generating & saving image...</span>
                        </div>
                    )}
                    {isUserMsg && message.attachedFilesMeta && message.attachedFilesMeta.some(f => f.type.startsWith("image/") && (f.localPreviewUrl || f.url)) && (
                         <div className={`relative group ${message.content ? 'mt-1.5 border-t pt-1.5' : 'mt-1'} ${currentTheme.name === 'illuminate' ? 'border-gray-300/50' : (currentTheme.name === 'blackout' ? 'border-gray-700/50' : 'border-blue-400/30')}`}>
                            {message.attachedFilesMeta.filter(f => f.type.startsWith("image/") && (f.localPreviewUrl || f.url)).map(imgFile => (
                                <img
                                    key={imgFile.name}
                                    src={imgFile.url || imgFile.localPreviewUrl}
                                    alt={imgFile.name || "User uploaded image"}
                                    className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-400 dark:border-gray-600 cursor-pointer mb-1"
                                    onClick={() => window.open(imgFile.url || imgFile.localPreviewUrl, '_blank')} title="View full image"/>
                            ))}
                         </div>
                    )}
                    {isUserMsg && message.attachedFilesMeta && message.attachedFilesMeta.filter(f => !f.type.startsWith("image/")).length > 0 && (
                        <div className={`p-2 rounded-lg text-xs ${currentTheme.userFileAttachmentBg} ${currentTheme.userFileAttachmentText} border ${message.content || (message.attachedFilesMeta && message.attachedFilesMeta.some(f => f.type.startsWith("image/")))? 'mt-2 border-t' : 'mt-1'} ${currentTheme.name === 'illuminate' ? 'border-slate-300' : (currentTheme.name === 'blackout' ? 'border-gray-700/60' : 'border-blue-500/20') }`}>
                            <div className={`font-medium mb-1 ${currentTheme.userFileAttachmentText} flex items-center text-xs`}> <Paperclip className="w-3 h-3 mr-1 flex-shrink-0" /> Attached Files: </div>
                            <ul className="space-y-0.5 list-none pl-0">
                                {message.attachedFilesMeta.filter(f => !f.type.startsWith("image/")).map(f => (
                                    <li key={f.name} className="flex items-center justify-between text-xs">
                                        {f.url ? (
                                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[calc(100%_-_70px)] hover:underline">{f.name}</a>
                                        ) : (
                                            <span className="truncate max-w-[calc(100%_-_70px)]">{f.name}</span>
                                        )}
                                        <span className="text-[10px] opacity-70 flex-shrink-0 ml-1">{f.size ? formatBytes(f.size) : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {isAssistantMsg && message.imageUrl && message.wasImageGenerated && (
                         <div className={`relative group mt-1.5 ${message.content && message.content !== "..." && message.content !== "Generated image:" ? 'border-t pt-1.5' : ''} ${currentTheme.name === 'illuminate' ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                             <img src={message.imageUrl} alt={message.imageMeta?.name || "Generated image"} className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-400 dark:border-gray-600 cursor-pointer" onClick={() => window.open(message.imageUrl, '_blank')} title="View full image"/>
                             <button onClick={() => handleDownloadImageFromUrl(message.imageUrl!, message.imageMeta?.name)} className={`absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 ${currentTheme.downloadButtonClass}`} title="Download Image">
                                 <Download className="w-3.5 h-3.5" />
                             </button>
                         </div>
                    )}
                    {message.timer && (
                      <div className="mt-1.5">
                          <div className={`flex items-center space-x-2 rounded-md px-2.5 py-1 text-sm ${currentTheme.name === 'illuminate' ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}>
                              <TimerIconLucide className={`${iconClass} flex-shrink-0 ${currentTheme.accentColor}`} />
                              <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer!.id)} className={currentTheme.timerText} />
                          </div>
                      </div>
                    )}
                    {message.flashcard && <div className="mt-1.5"><FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} /></div>}
                    {message.question && <div className="mt-1.5"><FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} /></div>}
                    {message.actionDetails && message.actionDetails.status === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="mt-2"
                      >
                        <Link
                          to="/dashboard"
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium shadow-sm transition-colors ${currentTheme.viewButtonBg} ${currentTheme.viewButtonText}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View in Dashboard
                        </Link>
                      </motion.div>
                    )}
                  </div>
                </div>
              )})}
              <div ref={chatEndRef} />
            </div>
            <div className={`px-2 sm:px-3 pt-1 border-t ${currentTheme.headerBorder} ${currentTheme.name === 'illuminate' ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`}>
              {userTier !== 'premium' && userTier !== 'loading' && (
                <div className={`pb-1.5 text-xs text-center ${currentTheme.mutedTextColor}`}>
                  Messages this month: {chatUsageCount} / {currentChatLimitDisplay === Infinity ? '∞' : currentChatLimitDisplay}
                  {isChatDisabledByLimit && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>}
                  {!isChatDisabledByLimit && userTier === 'basic' && (
                    <Link to="/pricing" className={`ml-2 font-medium ${currentTheme.accentColor} hover:underline`}>
                      <Crown className={`${smallIconClass} inline mr-0.5`} />Upgrade
                    </Link>
                  )}
                </div>
              )}
               {selectedFiles.length > 0 && !isImageGenModeActive && (
                 <div className="mb-2 flex flex-wrap gap-1.5 px-1 max-h-20 overflow-y-auto scrollbar-thin">
                    {selectedFiles.map(file => (
                        <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${currentTheme.filePillBg} ${currentTheme.filePillText}`}>
                             {file.type.startsWith("image/") && file.localPreviewUrl && (
                                <img src={file.localPreviewUrl} alt={file.name} className="w-5 h-5 rounded mr-1 object-cover"/>
                            )}
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span>
                            <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${currentTheme.name === 'illuminate' ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button>
                        </div>
                    ))}
                 </div>
               )}
              <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end pb-2">
                <button type="button" onClick={() => setIsContextDialogOpen(true)} className={`${currentTheme.actionButtonBg} text-white p-2.5 rounded-full transition-colors flex-shrink-0 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-100`} title="Set AI Context">
                  <Brain className={iconClass} />
                </button>
                <div className="flex-shrink-0">
                  <ChatControls onStyleSelect={handleStyleSelect} onCustomStyleCreate={handleCustomStyleCreate} isBlackoutEnabled={isBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled} activeStyle={activeStyle} currentThemeName={currentTheme.name} />
                </div>
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={chatMessage}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isChatDisabledByLimit ? "Monthly limit reached..." : isImageGenModeActive ? "Describe the image to generate..." : "Ask TaskMaster AI, or attach files..."}
                    className={`flex-1 ${currentTheme.inputBg} ${currentTheme.textColor} ${currentTheme.name === 'illuminate' ? 'placeholder-gray-500' : 'placeholder-gray-400'} rounded-lg px-3 py-2 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[120px] leading-snug border ${currentTheme.name === 'illuminate' ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500' : 'border-gray-600 focus:border-blue-500 focus:ring-blue-500'} shadow-sm disabled:opacity-70`}
                    disabled={isChatLoading || isChatDisabledByLimit || userTier === 'loading'}
                    style={{ height: 'auto' }}
                  />
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept={SUPPORTED_FILE_TYPES} className="hidden" disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit} />
                 <button type="button" onClick={triggerFileSelect} disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit} className={`${currentTheme.buttonSecondaryClass} p-2.5 rounded-full transition-colors ${isImageGenModeActive || isChatLoading || isChatDisabledByLimit ? currentTheme.buttonDisabledClass : 'hover:shadow-md transform hover:scale-105 active:scale-100'}`} title={isImageGenModeActive ? "File attachment disabled in image mode" : "Attach Files"}>
                    <Paperclip className={iconClass} />
                </button>
                <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isChatDisabledByLimit} className={`${effectiveImageGenButtonClass} p-2.5 rounded-full transition-colors ${isChatLoading || isChatDisabledByLimit ? currentTheme.buttonDisabledClass : 'hover:shadow-md transform hover:scale-105 active:scale-100'} ${isImageGenModeActive ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 dark:ring-offset-black' : ''}`} title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}>
                    <ImageIcon className={iconClass} />
                </button>
                <button type="submit" disabled={isChatLoading || isChatDisabledByLimit || userTier === 'loading' || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (isImageGenModeActive && !chatMessage.trim())}
                  className={`${currentTheme.actionButtonBg} text-white p-2.5 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-100`}
                >
                   {isChatLoading ? <Loader2 className={`${iconClass} animate-spin`} /> : <Send className={iconClass} />}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
      <aside className={`${!conversationId ? 'h-48 sm:h-40' : 'hidden'} md:block md:w-80 lg:w-96 border-t md:border-t-0 md:border-l ${currentTheme.asideBorder} ${currentTheme.asideBg} md:h-full md:overflow-y-auto`}>
        <div className="p-3 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className={`text-base font-semibold ${currentTheme.textColor}`}>Conversations</h2>
            <button onClick={handleNewConversation} className={`${currentTheme.actionButtonBg} text-white flex items-center justify-center p-1.5 rounded-full transition-colors shadow-sm hover:shadow-md transform hover:scale-105 active:scale-100`} title="New Conversation">
              <Plus className={iconClass} />
            </button>
          </div>
          <button onClick={handleNewConversation} className={`mb-2.5 w-full flex items-center justify-center gap-1.5 ${currentTheme.actionButtonBg} text-white p-2 rounded-lg hover:opacity-90 transition-opacity text-sm shadow-sm hover:shadow-md`}>
            <PlusCircle className={iconClass} /> New Conversation
          </button>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {conversationList.sort((a,b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0)).map((conv) => (
              <div key={conv.id}
                className={`flex items-center justify-between cursor-pointer p-2 rounded-lg transition-all text-sm ${conversationId === conv.id ? currentTheme.conversationActive : currentTheme.conversationInactive}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <MessageSquare className={`${iconClass} flex-shrink-0`} />
                  <span className="truncate">{conv.chatName}</span>
                </div>
                <div className="relative flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === conv.id ? null : conv.id); }}
                    className={`p-1 rounded-full ${currentTheme.buttonHoverBg} transition-colors`}
                  > <MoreHorizontal className={iconClass} /> </button>
                  {openDropdownId === conv.id && (
                    <div ref={dropdownRef}
                      className={`absolute top-7 right-0 rounded-md shadow-xl z-50 text-xs ${currentTheme.dropdownBg} ${currentTheme.textColor} border ${currentTheme.asideBorder}`}
                      style={{ minWidth: '130px' }} onClick={(e) => e.stopPropagation()}
                    >
                      {[
                        { label: 'Rename', icon: Edit2, action: () => handleRenameConversation(conv), colorClass: currentTheme.textColor },
                        { label: 'Share', icon: Share, action: () => handleShareConversation(conv), colorClass: currentTheme.textColor },
                        { label: 'Delete', icon: Trash2, action: () => handleDeleteConversationClick(conv), colorClass: 'text-red-500 hover:text-red-400' },
                      ].map(item => (
                        <button key={item.label}
                          className={`flex items-center w-full text-left px-2.5 py-1.5 ${currentTheme.buttonHoverBg} ${item.colorClass} first:rounded-t-md last:rounded-b-md`}
                          onClick={item.action}
                        > <item.icon className={`${smallIconClass} mr-1.5`} /> {item.label} </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <ContextDialog isOpen={isContextDialogOpen} onClose={() => setIsContextDialogOpen(false)} onSave={handleSaveContext} initialContext={userContext} currentThemeName={currentTheme.name} />
    </div>
  );
}
export default AIChat;
