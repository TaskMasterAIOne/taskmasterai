/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play, Pause, PlusCircle, Edit, Trash, Sparkles, CheckCircle, MessageCircle, Crown, RotateCcw, Square, X, TimerIcon, Send, ChevronLeft, ChevronRight, Moon, Sun, Star, Calendar, Clock, MoreHorizontal, ArrowUpRight, Bookmark, BookOpen, Lightbulb, Flame, Award, TrendingUp, Rocket, Target, Layers, Clipboard, AlertCircle, ThumbsUp, ThumbsDown, BrainCircuit, ArrowRight, Flag, Bell, Filter, Tag, BarChart, PieChart, ChevronDown, Folder, ListChecks, Paperclip, ImageIcon, Settings, FileText, Users, Columns, Eye, AlignLeft, UserCheck, Hourglass, Notebook, Wand, SortAsc, Search, ClipboardList, CalendarCheck, Bot, Loader2, Check, Info, Download
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
  createTask as createDashboardTask,
  createGoal as createDashboardGoal,
  createProject as createDashboardProject,
  updateDashboardLastSeen,
  createPlan as createDashboardPlan,
  updateItem,
  deleteItem,
  markItemComplete,
  hfApiKey,
  geminiApiKey,
} from '../lib/dashboard-firebase';

import {
  UserTier,
  getUserTier,
  getCurrentMonthUserChatUsage,
  incrementUserChatUsage,
  getChatLimitForTier,
  BASIC_CHAT_LIMIT,
} from '../lib/current-paying-user';

import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getCurrentUser } from '../lib/settings-firebase';
import { PriorityBadge } from './PriorityBadge';
import { TaskAnalytics } from './TaskAnalytics';

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
  createUserTask, createUserGoal, createUserPlan, createUserProject,
  updateUserTask, updateUserGoal, updateUserPlan, updateUserProject,
  deleteUserTask, deleteUserGoal, deleteUserPlan, deleteUserProject,
} from '../lib/ai-actions-firebase';

import { ContextDialog } from './context-dialog';
import {
  saveUserContext,
  onUserContextChange,
  type UserContext,
} from '../lib/ai-context-firebase';


const geminiEndpointSSE = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}&alt=sse`;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const GEMINI_IMAGE_GEN_MODEL = 'gemini-2.0-flash-preview-image-generation';

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
  actionDetails?: { status: 'success' | 'error'; };
  localImageData?: LocalImageData;
  imageUrl?: string;
  imageMeta?: FirebaseImageMeta;
  isGeneratingImage?: boolean;
  wasImageGenerated?: boolean;
  attachedFilesMeta?: Array<{ name: string; type: string; size: number; url?: string; base64Data?: string; localPreviewUrl?: string; storagePath?:string }>;
  localPlaceholderId?: string;
}

interface SelectedFile { name: string; type: string; size: number; base64Data: string; fileObject: File; localPreviewUrl: string; }

const SUPPORTED_FILE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,text/plain,.md,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.rtf";
const MAX_FILE_SIZE_MB = 20;


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

const extractCandidateTextGeminiSSE = (rawResponseText: string): string => {
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
      remainingText = remainingText.replace(match[0], "").trim();
    }
  }
  if (extractedBlocks.length === 0) {
    const curlyRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:$|\n)/g;
    let tempTextForCurlySearch = text;
    let modifiedCurlyText = "";
    let lastIndex = 0;
    while ((match = curlyRegex.exec(tempTextForCurlySearch)) !== null) {
        modifiedCurlyText += tempTextForCurlySearch.substring(lastIndex, match.index);
        try {
            const parsedJson = JSON.parse(match[1]);
            extractedBlocks.push(parsedJson);
        } catch(e) {
            modifiedCurlyText += match[0];
        }
        lastIndex = curlyRegex.lastIndex;
    }
    modifiedCurlyText += tempTextForCurlySearch.substring(lastIndex);
    if (extractedBlocks.length > 0) {
        remainingText = modifiedCurlyText.trim();
    }
  }
  return { blocks: extractedBlocks, cleanedText: remainingText.trim(), originalText: text };
}


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
  const dueDateNormalized = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = dueDateNormalized.getTime() - nowDateNormalized.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'high';
  if (diffDays <= 1) return 'high';
  if (diffDays <= 3) return 'medium';
  return 'low';
};

interface OverviewAction {
  id: string;
  description: string;
  action_type: "create_task" | "create_goal" | "create_project" | "create_plan" | "update_item" | "suggestion";
  item_collection?: "tasks" | "goals" | "projects" | "plans";
  item_name_or_id?: string;
  payload?: any;
}

interface ProductivityAnalysis {
  productivity_score: number;
  text_analysis: string;
  recommended_actions: OverviewAction[];
}


export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("Loading...");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const truncatedName = useMemo(() => userName.split(' ')[0] || userName, [userName]);
  const [quote, setQuote] = useState(getRandomQuote());
  const [greeting, setGreeting] = useState(getTimeBasedGreeting());

  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [chatUsageCount, setChatUsageCount] = useState(0);
  const [chatLimit, setChatLimit] = useState(BASIC_CHAT_LIMIT);
  const [isChatDisabledByLimit, setIsChatDisabledByLimit] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  const [aiChatSidebarTab, setAiChatSidebarTab] = useState<'chat' | 'history' | 'analytics'>('chat');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [hasGeneratedChatName, setHasGeneratedChatName] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessageData[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isImageGenModeActive, setIsImageGenModeActive] = useState(false);
  const [assistantLoadingPlaceholderId, setAssistantLoadingPlaceholderId] = useState<string | null>(null);
  const [currentChatLimitDisplay, setCurrentChatLimitDisplay] = useState<number | string>(BASIC_CHAT_LIMIT);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [productivityAnalysisResult, setProductivityAnalysisResult] = useState<ProductivityAnalysis | null>(null);
  const [isProductivityAnalysisLoading, setIsProductivityAnalysisLoading] = useState(false);

  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  const [lastCompletedItem, setLastCompletedItem] = useState<{ id: string; tab: string; timestamp: number } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)), [isSidebarCollapsed]});
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
        const currentUserAuth = getCurrentUser();
        if (!currentUserAuth) navigate('/login');
        else updateDashboardLastSeen(currentUserAuth.uid).catch(err => console.warn("Failed to update last seen:", err));
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const unsubContext = onUserContextChange(user.uid, setUserContext);
    return () => unsubContext();
  }, [user]);

  const handleSaveContext = async (context: Partial<UserContext>) => {
    if (!user || !user.uid) return;
    await saveUserContext(user.uid, context);
    setIsContextDialogOpen(false);
  };

  const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const [currentDisplayMonth, setCurrentDisplayMonth] = useState(new Date());
  const today = new Date();

  const handleTimerComplete = (timerId: string) => {
      if (!conversationId || !user) return;
      const completionMsg: Partial<FirebaseChatMessage> = { role: 'assistant', content: `⏰ Timer (${timerId.substring(0,4)}...) finished!` };
      if(conversationId) saveChatMessage(conversationId, completionMsg);
  };

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

  const formatItemsForChatContext = () => {
    if (!user) return "User data not available.";
    const lines: string[] = [];
    lines.push(`Current items for ${truncatedName}:\n`);
    const formatLine = (item: any, type: string, nameField: string) => {
      const name = item.data[nameField] || 'Untitled';
      const due = item.data.dueDate?.toDate?.() || item.data.targetDate?.toDate?.() || item.data.deadline?.toDate?.();
      const priorityVal = item.data.priority || calculatePriority(item);
      const completed = item.data.completed ? '[Completed]' : '[Pending]';
      return `${type}: ${name}${due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''} [Priority: ${priorityVal}] ${completed}`;
    };
    [...tasks, ...goals, ...projects, ...plans].forEach(item => {
        if (item.data.task) lines.push(formatLine(item, 'Task', 'task'));
        else if (item.data.goal) lines.push(formatLine(item, 'Goal', 'goal'));
        else if (item.data.project) lines.push(formatLine(item, 'Project', 'project'));
        else if (item.data.plan) lines.push(formatLine(item, 'Plan', 'plan'));
    });
    if (lines.length === 1 && tasks.length === 0 && goals.length === 0 && projects.length === 0 && plans.length === 0) return `No active items found for ${truncatedName}.`;
    return lines.join('\n');
  };

  const createChatPrompt = (userMessage: string, filesDataForPrompt: SelectedFile[]): string => {
    const conversationSoFar = chatHistory.slice(-6)
      .map((m) => `${m.role === 'user' ? truncatedName : 'Assistant'}: ${m.content}${m.attachedFilesMeta ? ` [Files: ${m.attachedFilesMeta.map(f=>f.name).join(', ')}]` : ''}`)
      .join('\n');
    const itemsText = formatItemsForChatContext();
    const now = new Date();
    const currentDateTime = {
      date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    let contextInstruction = '';
    if (userContext) {
      contextInstruction = `
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
You are TaskMaster AI. The user wants to generate an image: "${userMessage}".
Your primary goal is to generate this image. You must also provide a brief accompanying text (e.g., "Here's the image:").
**CRITICAL**: Your response for image generation MUST include both the image data AND a text part. Do NOT output JSON for image generation. If image generation fails, explain why politely in plain text. You may also chat casually, but prioritize image generation if asked.
` : "";
    return `
[CONTEXT]
User's Name: ${truncatedName}
Current Date: ${currentDateTime.date}
Current Time: ${currentDateTime.time}
${contextInstruction}
${filePreamble}
User's Current Items (Only discuss if explicitly asked by ${truncatedName}):
${itemsText}
[CONVERSATION HISTORY (Last few turns)]
${conversationSoFar}
[NEW USER MESSAGE]
${truncatedName}: ${userMessage}
${imageGenInstruction}
You are TaskMaster, a friendly AI productivity assistant. Engage in casual conversation, provide productivity advice. Discuss ${truncatedName}'s items only if explicitly asked. Reference ${truncatedName}'s first name. Consider attached files and user context.
Guidelines:
1. General Conversation & File Q&A:
   - Natural tone. No meta commentary.
   - Use file content if relevant. For unsupported types (Word, Excel), state you can't process rich content but can discuss pasted text.
2. Image Generation (If in Image Gen Mode):
   - Generate image from description. Response MUST include image data AND text. NO JSON. Explain failures politely.
3. Educational Content (JSON - Only if not in Image Gen Mode):
   - If requested (flashcards/quiz), return one JSON object in a \`\`\`json code block.
   - Flashcards: {"type": "flashcard", "data": [{"id":"f1","question":"Q1","answer":"A1","topic":"T1"}]}
   - Quiz: {"type": "question", "data": [{"id":"q1","question":"Q1","options":["O1"],"correctAnswer":0,"explanation":"E1"}]}
4. Data Modifications (JSON - Only if not in Image Gen Mode):
   - On create/update/delete commands, respond with brief confirmation text *then* JSON: \`\`\`json\n{"action":"actionName","payload":{...}}\n\`\`\`
   - Actions: "createTask", "updateTask", "deleteTask", "createGoal", "updateGoal", "deleteGoal", "createPlan", "updatePlan", "deletePlan", "createProject", "updateProject", "deleteProject".
   - Creation payloads: {"task":"Name"}, {"goal":"Name"}, etc. Optional: priority, dueDate.
   - Update/Delete payloads: identify item by current name (e.g., task:"Old") or id, then fields to change.
5. Response Structure:
   - General/File Q&A: Text only.
   - Image Gen: Image data AND text. NO JSON.
   - Educational: ONLY JSON code block.
   - Data Mod: Confirmation text, THEN JSON code block.
Follow strictly.
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
      setAiChatSidebarTab('chat');
      setHasGeneratedChatName(false);
    }

    if (isChatDisabledByLimit) {
        const limitMsgForState: ChatMessageData = { id: `error-limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${chatLimit} message limit. Upgrade for more!`, error: true, createdAt: new Date() };
        setChatHistory(prev => [...prev, limitMsgForState ]);
        if(currentConvId) await saveChatMessage(currentConvId, {role: 'assistant', content: limitMsgForState.content, error: true, createdAt: new Date()});
        setChatMessage('');
        return;
    }

    const userMsgContent = chatMessage;
    const filesForThisMessageSubmission = [...selectedFiles];
    filesForThisMessageSubmission.forEach(sf => { if (sf.localPreviewUrl) URL.revokeObjectURL(sf.localPreviewUrl); });
    setSelectedFiles([]);

    const localUserMessageId = `user-local-${Date.now()}`;
    const attachedFilesMetaDataForUi: ChatMessageData['attachedFilesMeta'] = filesForThisMessageSubmission.map(sf => ({ name: sf.name, type: sf.type, size: sf.size, localPreviewUrl: sf.localPreviewUrl }));
    const userMessageForState: ChatMessageData = { id: localUserMessageId, role: 'user', content: userMsgContent, attachedFilesMeta: attachedFilesMetaDataForUi.length > 0 ? attachedFilesMetaDataForUi : undefined, createdAt: new Date() };
    setChatHistory(prev => [...prev, userMessageForState]);

    const uploadedFilesMetaDataToSave: FirebaseAttachedFileMeta[] = [];
    if (!isImageGenModeActive && filesForThisMessageSubmission.length > 0 && user && user.uid && currentConvId) {
        setIsChatLoading(true);
        setChatHistory(prev => prev.map(msg => msg.id === localUserMessageId ? {...msg, content: `${msg.content}\n(Uploading ${filesForThisMessageSubmission.length} attachment(s)...)`} : msg));
        for (const sf of filesForThisMessageSubmission) {
            try {
                const { downloadURL, storagePath, name, type, size } = await uploadFileToStorage(user.uid, currentConvId, sf.fileObject);
                uploadedFilesMetaDataToSave.push({ url: downloadURL, storagePath, name, type, size });
            } catch (uploadError) {
                uploadedFilesMetaDataToSave.push({ name: sf.name, type: sf.type, size: sf.size });
                setChatHistory(prev => [...prev, {id: `upload-err-${sf.name}-${Date.now()}`, role: 'assistant', content: `❌ Failed to upload file: ${sf.name}`, error: true, createdAt: new Date()}]);
            }
        }
        setChatHistory(prev => prev.map(msg => msg.id === localUserMessageId ? { ...msg, content: userMsgContent, attachedFilesMeta: uploadedFilesMetaDataToSave.map(meta => ({ ...meta, localPreviewUrl: filesForThisMessageSubmission.find(sf => sf.name === meta.name)?.localPreviewUrl })) } : msg));
    }

    const userMessageToSave: Partial<FirebaseChatMessage> = { role: 'user', content: userMsgContent, attachedFilesMeta: uploadedFilesMetaDataToSave.length > 0 ? uploadedFilesMetaDataToSave : undefined, createdAt: new Date() };
    if (currentConvId) await saveChatMessage(currentConvId, userMessageToSave);
    setChatMessage('');

    if (userTier !== 'premium' && userTier !== 'loading') {
      try { await incrementUserChatUsage(user.uid); setChatUsageCount(prev => prev + 1); }
      catch (error) { if (currentConvId) await saveChatMessage(currentConvId, {role: 'assistant', content: "⚠️ Error saving usage count.", error: true }); }
    }

    const timerDuration = parseTimerRequest(userMsgContent);
    if (timerDuration && !isImageGenModeActive) {
      const timerId = `timer-${Date.now()}`;
      const timerMsgContent = `Okay, ${truncatedName}! Starting a timer for ${timerDuration < 60 ? timerDuration + ' seconds' : Math.round(timerDuration / 60) + ' minutes'}.`;
      const timerMsgToSave: Partial<FirebaseChatMessage> = { role: 'assistant', content: timerMsgContent, timer: { type: 'timer', duration: timerDuration, id: timerId } };
      if (currentConvId) await saveChatMessage(currentConvId, timerMsgToSave);
      setIsChatLoading(false);
      return;
    }

    setIsChatLoading(true);
    const newAssistantLPHId = `assistant-ph-${Date.now()}`;
    setAssistantLoadingPlaceholderId(newAssistantLPHId);
    const assistantResponsePlaceholder: ChatMessageData = { id: newAssistantLPHId, role: 'assistant', content: "...", createdAt: new Date(), isGeneratingImage: isImageGenModeActive };
    setChatHistory(prev => [...prev, assistantResponsePlaceholder]);

    const prompt = createChatPrompt(userMsgContent, filesForThisMessageSubmission);
    const currentTargetModel = isImageGenModeActive ? GEMINI_IMAGE_GEN_MODEL : GEMINI_TEXT_MODEL;
    const fullApiUrl = `${GEMINI_API_BASE}${currentTargetModel}:generateContent?key=${geminiApiKey}`;
    const apiParts: any[] = [{ text: prompt }];
    if (!isImageGenModeActive && filesForThisMessageSubmission.length > 0) {
        filesForThisMessageSubmission.forEach(sf => { if (sf.type.startsWith('image/') || sf.type === 'application/pdf' || sf.type === 'text/plain' || sf.name.endsWith('.md') || sf.type === "image/svg+xml") { apiParts.push({ inline_data: { mime_type: sf.type, data: sf.base64Data }}); }});
    }
    const apiRequestBody: any = { contents: [{ parts: apiParts }], generationConfig: { temperature: 0.7, maxOutputTokens: isImageGenModeActive ? 2048 : 8192 }};
    if (isImageGenModeActive) apiRequestBody.generationConfig.responseModalities = ["TEXT", "IMAGE"];
    const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apiRequestBody) };

    try {
      const response = await fetchWithTimeout(fullApiUrl, geminiOptions);
      const responseText = await response.text();
      const parsedApiResult = parseGeminiApiResponse(responseText, isImageGenModeActive);

      let assistantTextForDisplay = parsedApiResult.text || "";
      const geminiGeneratedImageData: LocalImageData | null = parsedApiResult.localImageData;
      let finalImageUrl: string | undefined = undefined;
      let finalImageMeta: FirebaseImageMeta | undefined = undefined;

      if (isImageGenModeActive && geminiGeneratedImageData && user && user.uid && currentConvId) {
        setChatHistory(prev => prev.map(msg => msg.id === newAssistantLPHId ? {...msg, content: "Generating & saving image..." } : msg));
        try {
          const { downloadURL, storagePath } = await uploadBase64ImageToStorage(user.uid, currentConvId, geminiGeneratedImageData.base64, geminiGeneratedImageData.type, geminiGeneratedImageData.name );
          finalImageUrl = downloadURL; finalImageMeta = { name: geminiGeneratedImageData.name, type: geminiGeneratedImageData.type, storagePath };
        } catch (uploadError) { assistantTextForDisplay = (assistantTextForDisplay ? assistantTextForDisplay + "\n" : "") + "Error: Failed to save generated image."; }
      }

      let educationalContent: any = null; let actionTaken = false; let combinedActionConfirmation = ""; let finalActionDetails: ChatMessageData['actionDetails'] | undefined = undefined;
      const { blocks: jsonActionBlocks, cleanedText, originalText } = extractJsonBlocks(parsedApiResult.text || "");
      assistantTextForDisplay = isImageGenModeActive ? (parsedApiResult.text || (finalImageUrl ? "Generated image:" : "")) : cleanedText;

      if (!isImageGenModeActive && jsonActionBlocks.length > 0) {
          for (const parsed of jsonActionBlocks) {
            if (parsed.action && parsed.payload && user.uid) {
              actionTaken = true; const payload = { ...parsed.payload }; let itemNaturalLanguageResponse = "";
              if (payload.dueDate && typeof payload.dueDate === 'string') { const date = new Date(payload.dueDate); if (!isNaN(date.getTime())) payload.dueDate = date; else delete payload.dueDate; }
              if (payload.targetDate && typeof payload.targetDate === 'string') { const date = new Date(payload.targetDate); if (!isNaN(date.getTime())) payload.targetDate = date; else delete payload.targetDate; }
              try {
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
                else { actionTaken = false; }
                if (itemNaturalLanguageResponse) combinedActionConfirmation += (combinedActionConfirmation ? " " : "") + itemNaturalLanguageResponse;
                finalActionDetails = { status: 'success' };
              } catch (actionError: any) { combinedActionConfirmation += (combinedActionConfirmation ? " " : "") + `Error with ${parsed.action}: ${actionError.message || 'Failed'}.`; finalActionDetails = { status: 'error' };}
            } else if (parsed.type && parsed.data && (parsed.type === 'flashcard' || parsed.type === 'question')) { educationalContent = parsed; }
          }
      }

      if (actionTaken) { assistantTextForDisplay = (cleanedText && !["Okay, I'll create that task!", "Okay, I'll update that.", "Okay, I'll delete that."].includes(cleanedText) ? cleanedText + "\n" : "") + combinedActionConfirmation; }
      else if (educationalContent) { if (!cleanedText.trim()) assistantTextForDisplay = "Here's the educational content:"; else assistantTextForDisplay = cleanedText; }
      else if (isImageGenModeActive) { if (parsedApiResult.error) assistantTextForDisplay = parsedApiResult.error; else if (!finalImageUrl && !assistantTextForDisplay.trim()) assistantTextForDisplay = "Image generation failed or no content."; else if (finalImageUrl && !assistantTextForDisplay.trim()) assistantTextForDisplay = "Generated image:";}
      else if (!assistantTextForDisplay.trim() && originalText && !finalImageUrl) { assistantTextForDisplay = originalText; }
      if (!assistantTextForDisplay.trim() && !finalImageUrl && !parsedApiResult.error && !educationalContent && !actionTaken) { assistantTextForDisplay = "(No specific content received)"; }
      if (parsedApiResult.error && (!assistantTextForDisplay.trim() || assistantTextForDisplay === "(No specific content received)")) { assistantTextForDisplay = parsedApiResult.error; }

      const finalAssistantMsgDataForUi: ChatMessageData = { id: newAssistantLPHId, role: 'assistant', content: assistantTextForDisplay.trim() || (finalImageUrl ? "Generated image:" : "(No text content)"), createdAt: new Date(), flashcard: educationalContent?.type === 'flashcard' ? educationalContent : undefined, question: educationalContent?.type === 'question' ? educationalContent : undefined, actionDetails: actionTaken ? finalActionDetails : undefined, imageUrl: finalImageUrl, imageMeta: finalImageMeta, wasImageGenerated: isImageGenModeActive && !!finalImageUrl && !parsedApiResult.error, error: !!parsedApiResult.error || (actionTaken && finalActionDetails?.status === 'error'), isGeneratingImage: false };
      setChatHistory(prev => prev.map(msg => msg.id === newAssistantLPHId ? finalAssistantMsgDataForUi : msg ));
      const finalAssistantMsgToSave: Partial<FirebaseChatMessage> = { role: finalAssistantMsgDataForUi.role, content: finalAssistantMsgDataForUi.content, createdAt: finalAssistantMsgDataForUi.createdAt, flashcard: finalAssistantMsgDataForUi.flashcard, question: finalAssistantMsgDataForUi.question, actionDetails: finalAssistantMsgDataForUi.actionDetails, imageUrl: finalAssistantMsgDataForUi.imageUrl, imageMeta: finalAssistantMsgDataForUi.imageMeta, wasImageGenerated: finalAssistantMsgDataForUi.wasImageGenerated, error: finalAssistantMsgDataForUi.error };
      if (currentConvId) await saveChatMessage(currentConvId, finalAssistantMsgToSave);

      const conversationHistoryForName = [...chatHistory.filter(m => m.id !== newAssistantLPHId), finalAssistantMsgDataForUi];
      const totalUserMessagesInConv = conversationHistoryForName.filter(m => m.role === 'user').length;
      const currentConvInfo = conversationList.find(c => c.id === currentConvId);
      if (currentConvId && currentConvInfo?.chatName === "New Chat" && (!hasGeneratedChatName || totalUserMessagesInConv === 1)) {
          const tempHistoryForNaming = chatHistory.filter(m => m.role === 'user' || (m.role === 'assistant' && m.id !== newAssistantLPHId && m.id !== localUserMessageId));
          tempHistoryForNaming.push({ ...userMessageForState, id: 'temp-user-for-name' } as ChatMessageData);
          tempHistoryForNaming.push({ ...finalAssistantMsgDataForUi, id: 'temp-assistant-for-name' });
          const conversationTextForNaming = tempHistoryForNaming.slice(-6).map((m) =>`${m.role === 'user' ? truncatedName : 'Assistant'}: ${m.content}`).join('\n');
          if (conversationTextForNaming.length > 10) { await generateChatName(currentConvId, conversationTextForNaming); setHasGeneratedChatName(true); }
      }
      if (isImageGenModeActive && finalImageUrl && !parsedApiResult.error) { setIsImageGenModeActive(false); }

    } catch (err: any) {
      const errorMsgContent = `Sorry, I encountered an error${err.message ? ': ' + err.message : '.'} Please try again.`;
      const errorMsgForState: ChatMessageData = { id: newAssistantLPHId, role: 'assistant', content: errorMsgContent, error: true, createdAt: new Date() };
      setChatHistory(prev => prev.map(msg => msg.id === newAssistantLPHId ? errorMsgForState : msg ));
      if (currentConvId) await saveChatMessage(currentConvId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: new Date() });
    } finally {
      setIsChatLoading(false); setAssistantLoadingPlaceholderId(null);
    }
  };


  const [tasks, setTasks] = useState<Array<{ id: string; data: any }>>([]);
  const [goals, setGoals] = useState<Array<{ id: string; data: any }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; data: any }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; data: any }>>([]);


  const handleMarkComplete = async (itemId: string, currentTab: string) => {
    if (!user) return;
    try {
      await updateItem(currentTab, itemId, { completed: true });
      setLastCompletedItem({ id: itemId, tab: currentTab, timestamp: Date.now() });
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => setLastCompletedItem(null), 7000);
    } catch (error) {
      console.error("Error marking item as complete:", error);
    }
  };

  const handleUndoComplete = async () => {
    if (!user || !lastCompletedItem) return;
    try {
      await updateItem(lastCompletedItem.tab, lastCompletedItem.id, { completed: false });
      setLastCompletedItem(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    } catch (error) {
      console.error("Error undoing completion:", error);
    }
  };

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
    const unsubscribeAuth = onFirebaseAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      let unsubConversations = () => {};
      if (firebaseUser) {
        setUserEmail(firebaseUser.email);
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
        const limit = getChatLimitForTier(resolvedTier);
        setChatLimit(limit);
        setCurrentChatLimitDisplay(limit === Infinity ? '∞' : limit);

        if (resolvedTier !== 'premium') {
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            try {
                const usageData = await getCurrentMonthUserChatUsage(firebaseUser.uid, currentMonthYear);
                setChatUsageCount(usageData?.count || 0);
                setIsChatDisabledByLimit((usageData?.count || 0) >= limit && limit !== Infinity);
            } catch (err) {
                console.error("Error loading chat usage data:", err);
                setChatUsageCount(0); setIsChatDisabledByLimit(false);
            }
        } else {
            setChatUsageCount(0); setIsChatDisabledByLimit(false);
        }
        unsubConversations = onChatConversationsSnapshot(firebaseUser.uid, (conversations) => {
            setConversationList(conversations.map(c => ({...c, key: c.id})));
        });
      } else {
        setUserName("Loading..."); setUserEmail(null);
        setTasks([]); setGoals([]); setProjects([]); setPlans([]);
        setSmartOverview(""); setOverviewActions([]);
        setChatHistory([]); setConversationId(null); setConversationList([]);
        setUserTier('loading'); setChatUsageCount(0); setIsChatDisabledByLimit(false);
      }
      return () => {
        unsubConversations();
        setConversationId(null);
        setChatHistory([]);
      };
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
      if (!conversationId) {
          setChatHistory([]); setHasGeneratedChatName(false); setSelectedFiles([]); setIsImageGenModeActive(false); setAssistantLoadingPlaceholderId(null);
          return;
      }
      const unsubMessages = onChatMessagesSnapshot(conversationId, (messagesFromDb: FirebaseChatMessage[]) => {
          setChatHistory(messagesFromDb.map(m => {
            const attachedFilesMetaForUi = m.attachedFilesMeta?.map(fbm => ({ name: fbm.name, type: fbm.type, size: fbm.size, url: fbm.url, storagePath: fbm.storagePath, localPreviewUrl: fbm.url })) || undefined;
            return { id: m.id || `fb-msg-${Date.now()}-${Math.random()}`, role: m.role, content: m.content, createdAt: m.createdAt, timer: m.timer, flashcard: m.flashcard, question: m.question, error: m.error, actionDetails: m.actionDetails, imageUrl: m.imageUrl, imageMeta: m.imageMeta, isGeneratingImage: m.isGeneratingImage, wasImageGenerated: m.wasImageGenerated, attachedFilesMeta: attachedFilesMetaForUi } as ChatMessageData;
          }));
      });
      return () => unsubMessages();
  }, [conversationId]);


  useEffect(() => {
    if (!user?.uid) { setTasks([]); setGoals([]); setProjects([]); setPlans([]); return; };
    const unsubFunctions = [
        onCollectionSnapshot('tasks', user.uid, setTasks),
        onCollectionSnapshot('goals', user.uid, setGoals),
        onCollectionSnapshot('projects', user.uid, setProjects),
        onCollectionSnapshot('plans', user.uid, setPlans),
    ];
    return () => unsubFunctions.forEach(unsub => { try { unsub(); } catch (e) { console.warn("Error unsubscribing:", e); } });
  }, [user]);


  const [smartOverview, setSmartOverview] = useState<string>("");
  const [overviewActions, setOverviewActions] = useState<OverviewAction[]>([]);
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
        setSmartOverview(""); setOverviewActions([]); setOverviewLoading(userTier === 'loading'); setLastGeneratedDataSig(""); setLastResponse(""); return;
    }
    if (debouncedItemsSigForOverview === lastGeneratedDataSig && !overviewLoading) return;

    const generateOverview = async () => {
        if (overviewLoading) return;
        setOverviewLoading(true); setSmartOverview(""); setOverviewActions([]); setLastGeneratedDataSig(debouncedItemsSigForOverview);
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
            setSmartOverview(`No pending items to generate overview from.`); setOverviewActions([]); setOverviewLoading(false); setLastResponse(""); return;
        }
        const firstName = userName.split(" ")[0];
const prompt = `You are an AI assistant analyzing items for user "${firstName}". Your goal is to provide a "smart overview" that synthesizes the user's current situation and proposes actionable steps *you (the AI) can take* to help them.

Respond with a single JSON object containing two top-level keys: "overview_text" (string) and "suggested_actions" (array of objects).

"overview_text" must be:
* 1-2 concise sentences, under 80 tokens.
* An actionable insight or guiding suggestion *from you (the AI)*, based on your analysis of the items.
* Addressed directly to the user, helping them understand priorities or potential next steps.

"suggested_actions" array:
*   This array lists concrete actions *you, the AI, are proposing to perform* on the user's behalf if they approve.
*   Each object must have:
    *   "id" (string, e.g., "action_1").
    *   "description" (string, user-facing). **This description must clearly state the action *you (the AI) propose to take*. It should be phrased as a proposal from you to the user.** For example:
        *   "I Propose creating a task: 'Follow up with Client X' due YYYY-MM-DD."
        *   "I Propose setting priority of 'Project Alpha' to high."
        *   "I Suggest reviewing your 'Q3 Goals' as they seem ambitious." (for "suggestion" type)
    *   "action_type" (string: "create_task", "create_goal", "create_project", "create_plan", "update_item", "suggestion").
*   If "action_type" is "update_item":
    *   Include "item_collection" (string: 'tasks', 'goals', 'projects', 'plans').
    *   Include "item_name_or_id" (string: name or ID of the item to be updated).
*   If "action_type" is "create_task", "create_goal", "create_project", "create_plan", or "update_item":
    *   Include a "payload" object detailing the specifics of the creation or update.
        *   For "create_task": e.g., {"task_name": "Name", "dueDate": "YYYY-MM-DD", "priority": "medium"}
        *   For "create_goal": e.g., {"goal_name": "Achieve X", "targetDate": "YYYY-MM-DD"}
        *   For "update_item": e.g., {"priority": "high", "status": "in_progress"}
*   For "action_type" "suggestion", the "item_collection", "item_name_or_id", and "payload" fields are not typically needed, as it's a general suggestion rather than a direct modification proposal.
*   Provide up to 3 actions. If none are appropriate, "suggested_actions" must be an empty array.

Example output format for your response:
\`\`\`json
{
  "overview_text": "${firstName}, I see 'Submit Report' is due today. Focusing on this high-priority item seems critical right now.",
  "suggested_actions": [
    {
      "id": "action_1",
      "description": "Propose setting 'Submit Report' priority to high, as it's due today.",
      "action_type": "update_item",
      "item_collection": "tasks",
      "item_name_or_id": "Submit Report",
      "payload": { "priority": "high" }
    },
    {
      "id": "action_2",
      "description": "Propose creating a follow-up task: 'Review feedback on report' for tomorrow.",
      "action_type": "create_task",
      "payload": { "task_name": "Review feedback on report", "dueDate": "YYYY-MM-DD" } // Assuming tomorrow's date
    }
  ]
}
\`\`\`

Items for analysis:
${formattedData}`;
        try {
            const overviewEndpoint = `${GEMINI_API_BASE}${GEMINI_TEXT_MODEL}:generateContent?key=${geminiApiKey}`;
            const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.6 } })};
            const response = await fetchWithTimeout(overviewEndpoint, geminiOptions, 20000);
            if (!response.ok) { let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {} throw new Error(`Gemini API error (${response.status}): ${errorBody}`); }
            const responseText = await response.text();
            const parsedResponse = parseGeminiApiResponse(responseText, false);
            if (parsedResponse.error) throw new Error(parsedResponse.error);
            if (!parsedResponse.text) throw new Error("Empty response from AI for overview.");
            const overviewJson = JSON.parse(parsedResponse.text);
            if (!overviewJson.overview_text || !Array.isArray(overviewJson.suggested_actions)) { throw new Error("Invalid JSON structure for overview response."); }
            if (responseText !== lastResponse) { setLastResponse(responseText); setSmartOverview(overviewJson.overview_text); setOverviewActions(overviewJson.suggested_actions); }
            else { const lastParsed = JSON.parse(lastResponse); setSmartOverview(lastParsed.overview_text); setOverviewActions(lastParsed.suggested_actions); }
        } catch (error: any) {
            let errorMsg = "AI overview currently unavailable.";
            if (error.message.includes('429') || error.message.includes('rate limit')) errorMsg = "Overview limit reached. Try again later.";
            else if (error.message.includes('API key not valid')) errorMsg = "Invalid AI config.";
            else if (error.message.includes('timed out')) errorMsg = "Overview request timed out.";
            else if (error.message.includes("Invalid JSON") || error.message.includes("invalid overview response")) errorMsg = "AI failed to generate a valid overview.";
            setSmartOverview(errorMsg); setOverviewActions([]); setLastResponse(""); setLastGeneratedDataSig("");
        } finally { setOverviewLoading(false); }
    };
    generateOverview();
  }, [user, userTier, debouncedItemsSigForOverview, userName, geminiApiKey, lastResponse]);


  const handleOverviewAction = async (action: OverviewAction, accepted: boolean) => {
    if (!user || !user.uid || !accepted) {
      setOverviewActions(prev => prev.filter(a => a.id !== action.id));
      return;
    }
    try {
      const payload = { ...action.payload };
      if (payload.dueDate && typeof payload.dueDate === 'string') {
        const date = new Date(payload.dueDate);
        if (!isNaN(date.getTime())) payload.dueDate = date; else delete payload.dueDate;
      }
      switch (action.action_type) {
        case "create_task": await createUserTask(user.uid, payload); break;
        case "create_goal": await createUserGoal(user.uid, payload); break;
        case "create_project": await createUserProject(user.uid, payload); break;
        case "create_plan": await createUserPlan(user.uid, payload); break;
        case "update_item":
          if (action.item_collection && action.item_name_or_id) {
            let itemId = action.item_name_or_id;
            if (!action.item_name_or_id.match(/^[a-zA-Z0-9]{20}$/)) {
                const fieldNameMap = { tasks: 'task', goals: 'goal', projects: 'project', plans: 'plan' };
                itemId = await findItemByName(action.item_collection, user.uid, action.item_name_or_id, fieldNameMap[action.item_collection]);
            }
            if (itemId) { await updateItem(action.item_collection, itemId, payload); }
            else { throw new Error(`Item "${action.item_name_or_id}" not found in ${action.item_collection}.`); }
          } else { throw new Error("Missing item_collection or item_name_or_id for update_item action."); }
          break;
        case "suggestion": break;
        default: console.warn("Unknown overview action type:", action.action_type);
      }
      setOverviewActions(prev => prev.filter(a => a.id !== action.id));
    } catch (error) {
      console.error("Error processing overview action:", error);
      alert(`Failed to process action: ${(error as Error).message}`);
      setOverviewActions(prev => prev.filter(a => a.id !== action.id));
    }
  };


  const handleTabChange = (tabName: "tasks" | "goals" | "projects" | "plans") => { setActiveTab(tabName); setEditingItemId(null); };
  const handleCreate = async () => {
    if (!user || !newItemText.trim()) return;
    let dateValue: Date | null = null;
    if (newItemDate) { try { const [year, month, day] = newItemDate.split('-').map(Number); dateValue = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); if (isNaN(dateValue.getTime())) dateValue = null; } catch { dateValue = null; } }
    const typeField = activeTab.slice(0, -1);
    try {
       if (activeTab === "tasks") await createDashboardTask(user.uid, newItemText, dateValue, newItemPriority);
       else if (activeTab === "goals") await createDashboardGoal(user.uid, newItemText, dateValue, newItemPriority);
       else if (activeTab === "projects") await createDashboardProject(user.uid, newItemText, dateValue, newItemPriority);
       else if (activeTab === "plans") await createDashboardPlan(user.uid, newItemText, dateValue, newItemPriority);
      setNewItemText(""); setNewItemDate(""); setNewItemPriority("medium");
    } catch (error) { console.error(`Error creating ${typeField}:`, error); alert(`Failed to create ${typeField}. Please try again.`); }
  };

  let currentItems: Array<{ id: string; data: any }> = [];
  let titleField = "task";
  let collectionName = activeTab;
  if (activeTab === "tasks") { currentItems = tasks.filter(item => !item.data.completed); titleField = "task"; }
  else if (activeTab === "goals") { currentItems = goals.filter(item => !item.data.completed); titleField = "goal"; }
  else if (activeTab === "projects") { currentItems = projects.filter(item => !item.data.completed); titleField = "project"; }
  else if (activeTab === "plans") { currentItems = plans.filter(item => !item.data.completed); titleField = "plan"; }

  const handleEditClick = (itemId: string, currentData: any) => {
    setEditingItemId(itemId); setEditingText(currentData[titleField] || "");
    let dateForInput = "";
    if (currentData.dueDate) {
        try {
             const dueDateObj = currentData.dueDate.toDate ? currentData.dueDate.toDate() : new Date(currentData.dueDate);
             if (!isNaN(dueDateObj.getTime())) { dateForInput = formatDateForComparison(dueDateObj); }
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
      if (editingItemId === itemId) setEditingItemId(null);
    } catch (error) { console.error(`Error deleting ${itemType}:`, error); alert(`Failed to delete ${itemType}. Please try again.`); }
  };

  const tasksProgress = useMemo(() => tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.data.completed).length / tasks.length) * 100), [tasks]);
  const goalsProgress = useMemo(() => goals.length === 0 ? 0 : Math.round((goals.filter(g => g.data.completed).length / goals.length) * 100), [goals]);
  const projectsProgress = useMemo(() => projects.length === 0 ? 0 : Math.round((projects.filter(p => p.data.completed).length / projects.length) * 100), [projects]);
  const plansProgress = useMemo(() => plans.length === 0 ? 0 : Math.round((plans.filter(pl => pl.data.completed).length / plans.length) * 100), [plans]);


  const containerClass = isIlluminateEnabled ? "bg-slate-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/80 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/60 shadow-lg shadow-black/20";
  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/70 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : isBlackoutEnabled ? "bg-gray-800 hover:bg-gray-700/80 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500" : "bg-gray-700 hover:bg-gray-600/70 border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-gray-300 placeholder-gray-500";
  const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
  const tabBorderColor = isIlluminateEnabled ? "border-gray-300" : "border-gray-700";
  const illuminateTextBlue = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
  const illuminateTextPurple = isIlluminateEnabled ? "text-purple-600" : "text-purple-400";
  const illuminateTextGreen = isIlluminateEnabled ? "text-green-600" : "text-green-400";
  const illuminateTextPink = isIlluminateEnabled ? "text-pink-600" : "text-pink-400";
  const illuminateTextYellow = isIlluminateEnabled ? "text-yellow-600" : "text-yellow-400";


    const deadlinesByDate = useMemo(() => {
        const deadlines = new Map<string, { count: number, types: Set<string>, priorities: Set<string> }>();
        const allItems = [...tasks, ...goals, ...projects, ...plans];
        allItems.forEach(item => {
            if (item.data.dueDate && !item.data.completed) {
                let dateObj;
                if (item.data.dueDate.toDate) dateObj = item.data.dueDate.toDate();
                else try { dateObj = new Date(item.data.dueDate); if (isNaN(dateObj.getTime())) return; } catch { return; }
                const dateStr = formatDateForComparison(dateObj);
                const itemType = item.data.task ? 'Task' : item.data.goal ? 'Goal' : item.data.project ? 'Project' : 'Plan';
                const priority = calculatePriority(item);
                if (!deadlines.has(dateStr)) deadlines.set(dateStr, { count: 0, types: new Set(), priorities: new Set() });
                deadlines.get(dateStr)!.count++; deadlines.get(dateStr)!.types.add(itemType); deadlines.get(dateStr)!.priorities.add(priority);
            }
        });
        return deadlines;
    }, [tasks, goals, projects, plans]);

    const handlePreviousMonth = () => setCurrentDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    const handleCalendarDateClick = (date: Date) => {
        setNewItemDate(formatDateForComparison(date));
        const newItemTextInput = document.querySelector('input[placeholder^="Add a new"]');
        if (newItemTextInput instanceof HTMLInputElement) { newItemTextInput.focus(); if (!isElementInViewport(newItemTextInput)) newItemTextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });}
    };
    const isElementInViewport = (el: HTMLElement) => { const rect = el.getBoundingClientRect(); return ( rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth) ); };

    const renderCalendarDays = () => {
        const year = currentDisplayMonth.getFullYear(); const month = currentDisplayMonth.getMonth(); const firstDayOfMonth = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const daysArray = [];
        for (let i = 0; i < firstDayOfMonth; i++) daysArray.push(<div key={`blank-${i}`} className="min-h-[4rem] sm:min-h-[5rem] border border-transparent"></div>);
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day); const dateStr = formatDateForComparison(date); const isToday = dateStr === formatDateForComparison(today); const deadlineInfo = deadlinesByDate.get(dateStr);
            let dayClass = `${cardClass} p-1.5 text-xs sm:text-sm flex flex-col items-start justify-start min-h-[4rem] sm:min-h-[5rem] rounded-md transition-all duration-150 hover:shadow-md cursor-pointer `;
            if (isToday) dayClass += `${isIlluminateEnabled ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-blue-900/50 border-blue-500 ring-1 ring-blue-500'} `;
            else if (deadlineInfo) dayClass += `${isIlluminateEnabled ? 'bg-amber-50/70' : 'bg-amber-900/30'} `; else dayClass += `${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} `;
            let priorityIndicatorColor = '';
            if (deadlineInfo?.priorities.has('high')) priorityIndicatorColor = 'bg-red-500'; else if (deadlineInfo?.priorities.has('medium')) priorityIndicatorColor = 'bg-yellow-500'; else if (deadlineInfo?.priorities.has('low')) priorityIndicatorColor = 'bg-green-500';
            daysArray.push( <div key={day} className={dayClass} title={date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => handleCalendarDateClick(date)}> <span className={`font-semibold mb-0.5 ${isToday ? (isIlluminateEnabled ? 'text-blue-700' : 'text-blue-300') : ''}`}>{day}</span> {deadlineInfo && ( <div className="mt-auto w-full"> {priorityIndicatorColor && <div className={`h-1 w-full rounded-full ${priorityIndicatorColor} mb-1`}></div>} <div className="text-[9px] sm:text-[10px] leading-tight opacity-80"> {deadlineInfo.count} item{deadlineInfo.count > 1 ? 's' : ''} </div> </div> )} </div> );
        }
        return daysArray;
    };

    const triggerFileSelect = () => fileInputRef.current?.click();
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files; if (!files || files.length === 0) return; const newSelectedFiles: SelectedFile[] = []; const fileProcessingPromises: Promise<void>[] = []; const currentFileNames = new Set(selectedFiles.map(f => f.name)); let tempErrorMessages: ChatMessageData[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (currentFileNames.has(file.name)) { tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `ℹ️ File "${file.name}" is already selected.`, createdAt: new Date()}); continue; }
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `❌ File "${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`, error: true, createdAt: new Date()}); continue; }
            fileProcessingPromises.push( readFileAsSelectedFile(file).then(processedFile => newSelectedFiles.push(processedFile)).catch(err => { tempErrorMessages.push({ id: `local-err-${Date.now()}`, role: 'assistant', content: `❌ Error reading file "${file.name}".`, error: true, createdAt: new Date()}); }) );
        }
        await Promise.all(fileProcessingPromises); if (tempErrorMessages.length > 0) setChatHistory(prev => [...prev, ...tempErrorMessages]); setSelectedFiles(prev => [...prev, ...newSelectedFiles]); if (fileInputRef.current) fileInputRef.current.value = ''; textareaRef.current?.focus();
    };
    const handleRemoveFile = (fileName: string) => { setSelectedFiles(prev => prev.filter(f => { if (f.name === fileName && f.localPreviewUrl) URL.revokeObjectURL(f.localPreviewUrl); return f.name !== fileName; })); };
    const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items; if (!items) return; let imagePasted = false; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name)); let tempErrorMessages: ChatMessageData[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    if (existingFileNames.has(file.name)) { tempErrorMessages.push({id: `local-paste-info-${Date.now()}`,role: 'assistant',content: `ℹ️ Pasted image "${file.name}" is already attached.`, createdAt: new Date()}); continue; };
                    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { tempErrorMessages.push({id: `local-paste-err-${Date.now()}`,role: 'assistant',content: `❌ Pasted image "${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`,error: true, createdAt: new Date()}); continue; }
                    filePromises.push(readFileAsSelectedFile(file)); existingFileNames.add(file.name); imagePasted = true;
                }
            }
        }
        if (imagePasted) { event.preventDefault(); try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { tempErrorMessages.push({id: `local-paste-read-err-${Date.now()}`,role: 'assistant',content: `❌ Error processing one or more pasted images.`,error: true, createdAt: new Date()}); } }
        if (tempErrorMessages.length > 0) setChatHistory(prev => [...prev, ...tempErrorMessages]);
    }, [selectedFiles]);

    const handleToggleImageGenMode = () => {
        const nextState = !isImageGenModeActive; setIsImageGenModeActive(nextState); let tempInfoMessages: ChatMessageData[] = [];
        if (nextState && selectedFiles.length > 0) { selectedFiles.forEach(sf => URL.revokeObjectURL(sf.localPreviewUrl)); setSelectedFiles([]); tempInfoMessages.push({id: `local-img-mode-info-${Date.now()}`, role: 'assistant', content: "🖼️ Image generation mode enabled. Attached files cleared.", createdAt: new Date()});
        } else if (!nextState) { tempInfoMessages.push({id: `local-txt-mode-info-${Date.now()}`, role: 'assistant', content: "💬 Switched to normal chat mode.", createdAt: new Date()}); }
        if (tempInfoMessages.length > 0 && conversationId) { saveChatMessage(conversationId, tempInfoMessages[0]); }
        textareaRef.current?.focus();
    };
    
    const handleNewConversation = async () => { if (!user || !user.uid) return; const newConvId = await createChatConversation(user.uid, 'New Chat'); if (newConvId) {setConversationId(newConvId); setAiChatSidebarTab('chat');} };
    const handleSelectConversation = (convId: string) => { if(conversationId === convId && chatHistory.length > 0 && !isChatLoading) return; setConversationId(convId); setAiChatSidebarTab('chat'); const selConv = conversationList.find(c => c.id === convId); setHasGeneratedChatName(selConv ? selConv.chatName !== "New Chat" : false);};
    const handleRenameConversation = async (conv: any) => { setOpenDropdownId(null); const newName = window.prompt('Enter new chat name:', conv.chatName); if (newName?.trim()) await updateChatConversationName(conv.id, newName.trim()); };
    const handleDeleteConversationClick = async (conv: any) => { setOpenDropdownId(null); if (!window.confirm(`Delete "${conv.chatName}"?`)) return; await deleteChatConversation(conv.id); if (conversationId === conv.id) { setConversationId(null); setAiChatSidebarTab('history'); } };
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdownId(null); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);


    const generateProductivityAnalysis = async () => {
      if (!user || !user.uid || isProductivityAnalysisLoading) return;
      setIsProductivityAnalysisLoading(true);
      setProductivityAnalysisResult(null);
  
      const itemsSummary = formatItemsForChatContext();
      const prompt = `User: ${userName} (${user.uid})
Items:
${itemsSummary}

Analyze the user's current productivity based on their items.
Respond with a single JSON object with three keys:
1. "productivity_score": An integer between 0 and 100.
2. "text_analysis": A 2-4 sentence string explaining the score, highlighting strengths and areas for improvement.
3. "recommended_actions": An array of 1-3 objects. Each object should represent an actionable recommendation to improve productivity, with the following keys:
   - "id": A unique string (e.g., "rec_1").
   - "description": User-facing string (e.g., "Break down 'Large Project X' into smaller tasks.").
   - "action_type": "create_task", "create_goal", "create_project", "create_plan", or "suggestion".
   - "payload" (if action_type is create_...): Object with item details (e.g., {"task": "New Task Name", "priority": "medium"}). For "suggestion", payload is not needed.

Example for recommended_actions:
[
  {
    "id": "rec_1",
    "description": "Create a task: 'Review overdue items'.",
    "action_type": "create_task",
    "payload": { "task": "Review overdue items", "priority": "high", "dueDate": "${formatDateForComparison(new Date())}" }
  }
]

Provide only the JSON object.`;
  
      try {
        const analysisEndpoint = `${GEMINI_API_BASE}${GEMINI_TEXT_MODEL}:generateContent?key=${geminiApiKey}`;
        const geminiOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 1000 }
          })
        };
        const response = await fetchWithTimeout(analysisEndpoint, geminiOptions, 30000);
        if (!response.ok) {
          let errorBody = 'API Error'; try { errorBody = await response.text(); } catch {}
          throw new Error(`Productivity Analysis API error (${response.status}): ${errorBody}`);
        }
        const responseText = await response.text();
        const parsedResponse = parseGeminiApiResponse(responseText, false);
        if (parsedResponse.error) throw new Error(parsedResponse.error);
        if (!parsedResponse.text) throw new Error("Empty response from AI for productivity analysis.");
        
        const analysisJson = JSON.parse(parsedResponse.text);
        if (typeof analysisJson.productivity_score !== 'number' || typeof analysisJson.text_analysis !== 'string' || !Array.isArray(analysisJson.recommended_actions)) {
          throw new Error("Invalid JSON structure for productivity analysis.");
        }
        setProductivityAnalysisResult(analysisJson);
  
      } catch (error: any) {
        console.error("Productivity analysis generation error:", error);
        setProductivityAnalysisResult({
          productivity_score: 0,
          text_analysis: `Failed to generate analysis: ${error.message}`,
          recommended_actions: []
        });
      } finally {
        setIsProductivityAnalysisLoading(false);
      }
    };

    const handleAcceptProductivityAction = async (action: OverviewAction) => {
        if (!user || !user.uid) return;
        try {
          const payload = { ...action.payload };
          if (payload.dueDate && typeof payload.dueDate === 'string') {
            const date = new Date(payload.dueDate);
            if (!isNaN(date.getTime())) payload.dueDate = date; else delete payload.dueDate;
          }
    
          switch (action.action_type) {
            case "create_task": await createUserTask(user.uid, payload); break;
            case "create_goal": await createUserGoal(user.uid, payload); break;
            case "create_project": await createUserProject(user.uid, payload); break;
            case "create_plan": await createUserPlan(user.uid, payload); break;
            default: console.warn("Unknown productivity action type:", action.action_type); return;
          }
          setProductivityAnalysisResult(prev => prev ? ({
            ...prev,
            recommended_actions: prev.recommended_actions.filter(a => a.id !== action.id)
          }) : null);
          if(conversationId) {
            saveChatMessage(conversationId, { role: 'assistant', content: `✅ Action accepted: "${action.description}" and item created.` });
          }

        } catch (error) {
          console.error("Error processing productivity action:", error);
          if(conversationId) {
            saveChatMessage(conversationId, { role: 'assistant', content: `⚠️ Error accepting action: "${action.description}". ${(error as Error).message}`, error: true });
          }
        }
      };


  return (
    <div className={`${containerClass} min-h-screen w-full overflow-x-hidden relative font-sans`}>
      <Sidebar userName={userName} isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />
      <button onClick={() => setIsAiSidebarOpen(true)} className={`fixed bottom-4 md:bottom-6 lg:bottom-8 ${isSidebarCollapsed ? 'right-4 md:right-6' : 'right-4 md:right-6 lg:right-8'} z-40 p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-100 ${isIlluminateEnabled ? 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'} ${isAiSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} title="Open TaskMaster AI Chat" aria-label="Open TaskMaster AI Chat">
        <BrainCircuit className="w-5 h-5" />
      </button>

      <main className={`transition-all duration-300 ease-in-out min-h-screen ${isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64'} p-3 md:p-4 lg:p-5 xl:p-6 overflow-x-hidden`}>
         <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <header className={`dashboard-header w-full lg:w-auto animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} transition-all duration-500 ease-out pt-1 lg:pt-0`}>
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 ${headingClass} break-words`}>
              {React.cloneElement(greeting.icon, { className: `w-5 h-5 lg:w-6 lg:h-6 inline-block align-middle mr-1.5 -translate-y-0.5 ${greeting.color ? `text-${greeting.color}-500` : iconColor}` })}
              {greeting.greeting},{' '} <span className="font-semibold">{userName ? userName.split(' ')[0] : '...'}</span>
            </h1>
          </header>
        </div>

        {lastCompletedItem && (
          <div className={`${cardClass} p-3 sm:p-4 mb-4 sm:mb-5 rounded-lg flex items-center justify-between animate-fadeIn`}>
            <p className="text-sm">Item marked complete.</p>
            <button
              onClick={handleUndoComplete}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${isIlluminateEnabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-800 text-blue-200 hover:bg-blue-700'}`}
            >
              <RotateCcw className="w-4 h-4 inline mr-1 -ml-1" /> Undo
            </button>
          </div>
        )}


        <div className={`grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-5 animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-400`}>
           <div className="xl:col-span-3 flex flex-col gap-4 sm:gap-5">
            <div className={`${cardClass} rounded-xl p-3 sm:p-4 relative min-h-[60px] transition-all duration-300 ease-out animate-fadeIn ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} delay-300`}>
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
                  {overviewActions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
                      <h4 className={`text-xs font-semibold ${subheadingClass}`}>Suggested Actions:</h4>
                      {overviewActions.map(action => (
                        <div key={action.id} className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2 ${isIlluminateEnabled ? 'bg-blue-50' : 'bg-blue-900/30'}`}>
                          <span className="flex-grow truncate mr-2" title={action.description}>{action.description}</span>
                          <div className="flex-shrink-0 flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOverviewAction(action, true)}
                              className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 font-medium transition-colors ${
                                isIlluminateEnabled
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                              title="Accept suggestion"
                            >
                              <ThumbsUp className="w-3 h-3"/> Accept
                            </button>
                            <button
                              onClick={() => handleOverviewAction(action, false)}
                              className={`px-2 py-1 rounded-md text-[10px] flex items-center gap-1 font-medium transition-colors border ${
                                isIlluminateEnabled
                                ? 'border-red-400 text-red-500 hover:bg-red-50 hover:border-red-500'
                                : 'border-red-500 text-red-400 hover:bg-red-500/20 hover:border-red-400'
                              }`}
                              title="Deny suggestion"
                            >
                              <ThumbsDown className="w-3 h-3"/> Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {smartOverview && !smartOverview.includes('unavailable') && !smartOverview.includes('failed') && !smartOverview.includes('limit') && !smartOverview.includes('No pending items') && <div className="mt-1.5 text-left text-[10px] text-gray-500/80">AI responses may be inaccurate. Verify critical info.</div>} </>}
            </div>

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

            <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300`}>
               <h2 className={`text-base sm:text-lg font-semibold mb-3 ${illuminateTextBlue} flex items-center`}>
                 <Calendar className="w-5 h-5 mr-1.5" /> Upcoming
               </h2>
               {(() => {
                   const allItems = [...tasks, ...goals, ...projects, ...plans]; const now = new Date(); const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                   const upcomingDeadlines = allItems.filter(item => { const { dueDate, completed } = item.data; if (!dueDate || completed) return false; try { const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate); const dueDateNormalized = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()); return dueDateNormalized >= nowDateNormalized; } catch { return false; } }).sort((a, b) => { try { const aDate = a.data.dueDate.toDate ? a.data.dueDate.toDate() : new Date(a.data.dueDate); const bDate = b.data.dueDate.toDate ? b.data.dueDate.toDate() : new Date(b.data.dueDate); return aDate.getTime() - bDate.getTime(); } catch { return 0; } }).slice(0, 5);
                 if (!upcomingDeadlines.length) return ( <p className={`${subheadingClass} text-xs sm:text-sm flex items-center justify-center py-4 italic`}> <CheckCircle className="w-4 h-4 mr-1.5 text-green-400" /> All caught up! No upcoming deadlines. </p> );
                 return ( <ul className="space-y-2"> {upcomingDeadlines.map((item, index) => { const { id, data } = item; const itemType = data.task ? 'Task' : data.goal ? 'Goal' : data.project ? 'Project' : 'Plan'; const dueDateObj = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); const dueDateStr = dueDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const itemName = data[itemType.toLowerCase()] || 'Untitled'; const dueDateNormalized = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()); const daysRemaining = Math.ceil((dueDateNormalized.getTime() - nowDateNormalized.getTime()) / (1000 * 60 * 60 * 24)); let urgencyColorClass = isIlluminateEnabled ? 'border-l-gray-300' : 'border-l-gray-600'; let urgencyText = `${daysRemaining} days`; let urgencyTextClass = isIlluminateEnabled ? 'text-green-600' : 'text-green-400'; let urgencyBgClass = isIlluminateEnabled ? 'bg-green-100 text-green-600' : 'bg-green-900/50 text-green-400'; if (daysRemaining === 0) { urgencyColorClass = 'border-l-red-500'; urgencyText = 'Today!'; urgencyTextClass = isIlluminateEnabled ? 'text-red-600' : 'text-red-400'; urgencyBgClass = isIlluminateEnabled ? 'bg-red-100 text-red-600' : 'bg-red-900/50 text-red-400'; } else if (daysRemaining === 1) { urgencyColorClass = 'border-l-orange-500'; urgencyText = 'Tomorrow!'; urgencyTextClass = isIlluminateEnabled ? 'text-orange-600' : 'text-orange-400'; urgencyBgClass = isIlluminateEnabled ? 'bg-orange-100 text-orange-600' : 'bg-orange-900/50 text-orange-400'; } else if (daysRemaining <= 3) { urgencyColorClass = 'border-l-yellow-500'; urgencyTextClass = isIlluminateEnabled ? 'text-yellow-700' : 'text-yellow-400'; urgencyBgClass = isIlluminateEnabled ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/50 text-yellow-400'; } const priority = data.priority || calculatePriority(item);
                       return ( <li key={id} className={`${isIlluminateEnabled ? 'bg-gray-100/80 hover:bg-gray-200/60' : 'bg-gray-700/40 hover:bg-gray-700/60'} p-2.5 rounded-lg transition-colors duration-150 border-l-4 ${urgencyColorClass} animate-slideInRight flex items-center justify-between gap-2`} style={{ animationDelay: `${index * 60}ms` }}> <div className="flex-grow overflow-hidden mr-2"> <div className="text-xs sm:text-sm font-medium flex items-center"> <span className={`font-semibold mr-1 ${isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200'}`}>{itemType}:</span> <span className="truncate" title={itemName}>{itemName}</span> <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="ml-1.5 flex-shrink-0" /> </div> </div> <div className={`text-[10px] sm:text-xs flex-shrink-0 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'} flex items-center whitespace-nowrap`}> <Clock className={`w-3 h-3 mr-0.5 ${urgencyTextClass}`} /> <span className={`font-medium mr-1.5 ${urgencyTextClass}`}>{dueDateStr}</span> {urgencyText && (<span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${urgencyBgClass}`}>{urgencyText}</span>)} </div> </li>); })} </ul>);
               })()}
             </div>


             <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300 flex flex-col`}>
               <div className="overflow-x-auto no-scrollbar mb-4">
                 <div className={`flex space-x-1.5 w-full border-b pb-2 ${tabBorderColor}`}>
                   {["tasks", "goals", "projects", "plans"].map((tab) => ( <button key={tab} className={`px-3 py-1.5 rounded-full transition-all duration-200 transform hover:scale-[1.03] text-xs sm:text-sm font-medium flex items-center whitespace-nowrap ${activeTab === tab ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm" : isIlluminateEnabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} onClick={() => handleTabChange(tab as "tasks" | "goals" | "projects" | "plans")}> {tab === "tasks" && <Clipboard className="w-3.5 h-3.5 mr-1" />} {tab === "goals" && <Target className="w-3.5 h-3.5 mr-1" />} {tab === "projects" && <Layers className="w-3.5 h-3.5 mr-1" />} {tab === "plans" && <Rocket className="w-3.5 h-3.5 mr-1" />} {tab.charAt(0).toUpperCase() + tab.slice(1)} </button>))}
                 </div>
               </div>
               <div className="flex flex-col md:flex-row gap-1.5 mb-4">
                 <input type="text" className={`flex-grow ${inputBg} rounded-full px-3.5 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} placeholder={`Add a new ${activeTab.slice(0, -1)}...`} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                 <div className="flex gap-1.5 flex-shrink-0">
                   <input type="date" className={`${inputBg} rounded-full px-3 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${iconColor}`} value={newItemDate} onChange={(e) => setNewItemDate(e.target.value)} title="Set due date" style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }} />
                   <div className="relative"> <select className={`${inputBg} rounded-full pl-3 pr-7 py-1.5 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={newItemPriority} onChange={(e) => setNewItemPriority(e.target.value as 'high' | 'medium' | 'low')} title="Set priority"> <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option> </select> <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} /> </div>
                   <button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-full flex items-center justify-center hover:shadow-md hover:shadow-purple-500/20 transition-all duration-200 transform hover:scale-105 active:scale-100 min-w-[32px] min-h-[32px]" onClick={handleCreate} title={`Add new ${activeTab.slice(0,-1)}`}><PlusCircle className="w-4 h-4" /></button>
                 </div>
               </div>
               <ul className="space-y-1.5 sm:space-y-2 flex-grow overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 550px)', minHeight: '250px' }}>
                 {currentItems.length === 0 ? <li className={`${subheadingClass} text-sm text-center py-6 italic`}>No {activeTab} here yet... Add one above!</li>
                 : currentItems.sort((a, b) => { const po = { high: 0, medium: 1, low: 2 }; const ap = po[calculatePriority(a)]; const bp = po[calculatePriority(b)]; if (ap !== bp) return ap - bp; const ad = a.data.dueDate?.toDate ? a.data.dueDate.toDate() : (a.data.dueDate ? new Date(a.data.dueDate) : null); const bd = b.data.dueDate?.toDate ? b.data.dueDate.toDate() : (b.data.dueDate ? new Date(b.data.dueDate) : null); if (ad && bd) return ad.getTime() - bd.getTime(); if (ad) return -1; if (bd) return 1; return (b.data.createdAt?.seconds || 0) - (a.data.createdAt?.seconds || 0); })
                     .map((item, index) => {
                       const itemId = item.id; const { data } = item; const textValue = data[titleField] || 'Untitled'; const isCompleted = data.completed || false; const isEditing = editingItemId === itemId; const priority = data.priority || calculatePriority(item); let dueDateStr = ''; let overdue = false;
                       if (data.dueDate) { try { const ddo = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate); if (!isNaN(ddo.getTime())) { dueDateStr = ddo.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); const td = new Date(); const todayNormalized = new Date(td.getFullYear(), td.getMonth(), td.getDate()); const itemDateNormalized = new Date(ddo.getFullYear(), ddo.getMonth(), ddo.getDate()); overdue = itemDateNormalized < todayNormalized && !isCompleted; }} catch {} }
                       return (
                         <li key={item.id} className={`group p-2 sm:p-2.5 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2 transition-all duration-150 animate-slideInUp ${isCompleted ? (isIlluminateEnabled ? 'bg-green-100/50 opacity-60' : 'bg-green-900/20 opacity-50') : overdue ? (isIlluminateEnabled ? 'bg-red-100/60' : 'bg-red-900/30') : isIlluminateEnabled ? 'bg-gray-100/70 hover:bg-gray-200/50' : 'bg-gray-700/30 hover:bg-gray-700/50'} ${isEditing ? (isIlluminateEnabled ? 'ring-1 ring-purple-400 bg-purple-50/50' : 'ring-1 ring-purple-500 bg-purple-900/20') : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
                           {!isEditing ? (<> <div className="flex items-center gap-2 flex-grow overflow-hidden mr-2">
                                 <button onClick={() => handleMarkComplete(itemId, activeTab)} className={`flex-shrink-0 p-0.5 rounded-full transition-colors duration-150 ${isCompleted ? (isIlluminateEnabled ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600') : (isIlluminateEnabled ? 'border border-gray-400 hover:border-green-500 hover:bg-green-100/50' : 'border border-gray-500 hover:border-green-500 hover:bg-green-900/30')} `} title={isCompleted ? "Mark Pending" : "Mark Complete"}><CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-white' : 'text-transparent'}`} /></button>
                                 <span className={`font-medium text-sm sm:text-[0.9rem] truncate ${isCompleted ? 'line-through text-gray-500 dark:text-gray-600' : (isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100')}`} title={textValue}>{textValue}</span>
                                 <PriorityBadge priority={priority} isIlluminateEnabled={isIlluminateEnabled} className="flex-shrink-0 ml-auto sm:ml-1.5" />
                                 {dueDateStr && <span className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 hidden sm:flex items-center ${overdue ? (isIlluminateEnabled ? 'bg-red-200 text-red-700' : 'bg-red-800/50 text-red-300') : (isIlluminateEnabled ? 'bg-gray-200 text-gray-600' : 'bg-gray-600/80 text-gray-300')}`}><Calendar className="w-2.5 h-2.5 mr-0.5" />{dueDateStr}</span>}
                               </div> <div className="flex gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                                 <button className={`p-1.5 rounded-lg ${isIlluminateEnabled ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-900/50 text-blue-400'} transition-colors`} onClick={() => handleEditClick(itemId, data)} title="Edit"><Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                                 <button className={`p-1.5 rounded-lg ${isIlluminateEnabled ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-500'} transition-colors`} onClick={() => handleDelete(itemId)} title="Delete"><Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                               </div></>)
                           : (<> <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                                   <input className={`flex-grow ${inputBg} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm`} value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(itemId); if (e.key === 'Escape') setEditingItemId(null); }}/>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        <input type="date" className={`${inputBg} rounded-full px-3 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 w-auto shadow-sm appearance-none ${iconColor}`} value={editingDate} onChange={(e) => setEditingDate(e.target.value)} style={{ colorScheme: isIlluminateEnabled ? 'light' : 'dark' }}/>
                                        <div className="relative"> <select className={`${inputBg} rounded-full pl-3 pr-7 py-1 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`} value={editingPriority} onChange={(e) => setEditingPriority(e.target.value as 'high' | 'medium' | 'low')}> <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option> </select> <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`} /> </div></div></div>
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
                <div className={`${cardClass} rounded-xl p-4 sm:p-5 transition-all duration-300 flex flex-col`} style={{ minHeight: '600px' }}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                        <button onClick={handlePreviousMonth} className={`p-2 rounded-full ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`} title="Previous Month"><ChevronLeft className="w-5 h-5" /></button>
                        <h2 className={`text-lg sm:text-xl font-semibold text-center ${headingClass}`}> {currentDisplayMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} </h2>
                        <button onClick={handleNextMonth} className={`p-2 rounded-full ${iconColor} ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'}`} title="Next Month"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs sm:text-sm font-medium mb-2 flex-shrink-0"> {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => ( <div key={day} className={subheadingClass}>{day}</div> ))} </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-grow overflow-y-auto"> {renderCalendarDays()} </div>
                </div>
           </div>
         </div>
      </main>

      <div aria-hidden={!isAiSidebarOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isAiSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`} role="complementary" aria-labelledby="ai-sidebar-title">
        <div className={`p-3 sm:p-4 border-b ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex justify-between items-center flex-shrink-0 sticky top-0 backdrop-blur-sm z-10`}>
          <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}><BrainCircuit className="w-5 h-5" />Chat with TaskMaster</h3>
          <button onClick={() => setIsAiSidebarOpen(false)} className={`${isIlluminateEnabled ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'} p-1.5 rounded-full transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar"><X className="w-5 h-5" /></button>
        </div>

        <div className={`flex border-b ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'} flex-shrink-0`}>
            {['Chat', 'History', 'Analytics'].map(tabName => (
                <button key={tabName} onClick={() => setAiChatSidebarTab(tabName.toLowerCase() as any)}
                    className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-medium transition-colors rounded-t-none ${aiChatSidebarTab === tabName.toLowerCase() ? `${isIlluminateEnabled ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600' : 'bg-gray-700 text-blue-300 border-b-2 border-blue-400'}` : `${isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-gray-700/60 text-gray-400'}`}`}>
                    {tabName}
                </button>
            ))}
        </div>
        
        {aiChatSidebarTab === 'chat' && (
            <>
            <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={chatEndRef}>
                {!conversationId && (
                     <div className="text-center py-10">
                        <MessageCircle className={`w-12 h-12 mx-auto mb-3 ${subheadingClass}`} />
                        <p className={`${subheadingClass} text-sm`}>Select a conversation from History or start a new one.</p>
                        <button onClick={handleNewConversation} className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            <PlusCircle className="w-4 h-4 inline mr-1.5" /> New Chat
                        </button>
                    </div>
                )}
                {conversationId && chatHistory.map((message, index) => ( <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm shadow-md break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')}`}>
                        {message.content && message.content !== "..." && <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />, ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />, li: ({node, ...props}) => <li className="mb-0.5" {...props} />, a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />, code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}><code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code></pre>) : (<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); }, }}>{message.content}</ReactMarkdown>}
                        {message.content === "..." && isChatLoading && message.id === assistantLoadingPlaceholderId && <div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-60"></div><div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-60"></div></div>}
                        {message.role === 'user' && message.attachedFilesMeta && message.attachedFilesMeta.length > 0 && (
                            <div className={`p-2 rounded-lg text-xs ${isIlluminateEnabled ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/30 border border-blue-700/50'} mt-2`}>
                                {message.attachedFilesMeta.filter(f => f.type.startsWith("image/") && (f.localPreviewUrl || f.url)).map(imgFile => (
                                    <img key={imgFile.name} src={imgFile.url || imgFile.localPreviewUrl} alt={imgFile.name} className="max-w-full h-auto max-h-40 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer mb-1.5" onClick={() => window.open(imgFile.url || imgFile.localPreviewUrl, '_blank')} title="View full image"/>
                                ))}
                                {message.attachedFilesMeta.filter(f => !f.type.startsWith("image/")).map(file => (
                                    <div key={file.name} className="flex items-center gap-1.5 py-1">
                                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate" title={file.name}>{file.name}</span>
                                        <span className="text-[10px] opacity-70 ml-auto">({formatBytes(file.size)})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                         {message.role === 'assistant' && message.imageUrl && message.wasImageGenerated && (
                            <div className={`relative group mt-2 ${message.content && message.content !== "..." && message.content !== "Generated image:" ? (isIlluminateEnabled ? 'border-t border-gray-300/50 pt-2' : 'border-t border-gray-600/50 pt-2') : ''}`}>
                                <img src={message.imageUrl} alt={message.imageMeta?.name || "Generated image"} className="max-w-full h-auto max-h-60 object-contain rounded-lg border border-gray-400 dark:border-gray-600 cursor-pointer" onClick={() => window.open(message.imageUrl, '_blank')} title="View full image"/>
                                <button onClick={() => handleDownloadImageFromUrl(message.imageUrl!, message.imageMeta?.name)} className={`absolute top-1.5 right-1.5 p-1.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 ${isIlluminateEnabled ? 'bg-gray-200 hover:bg-gray-300 text-gray-600' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`} title="Download Image">
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {message.timer && <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}><TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} /><Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer!.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} /></div></div>}
                        {message.flashcard && <div className="mt-1.5"><FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>}
                        {message.question && <div className="mt-1.5"><FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>}
                    </div> </div> ))}
                {isChatLoading && conversationId && chatHistory.length > 0 && chatHistory[chatHistory.length -1]?.id !== assistantLoadingPlaceholderId && <div className="flex justify-start animate-fadeIn"><div className={`${isIlluminateEnabled ? 'bg-gray-100 border border-gray-200/80' : 'bg-gray-700/80 border border-gray-600/50'} rounded-xl px-3.5 py-2 max-w-[85%] shadow-md`}><div className="flex space-x-1 p-1"><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div></div></div></div>}
            </div>
            <div className={`px-3 pt-2 border-t ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100/80' : 'border-gray-700 bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`}>
                {userTier !== 'premium' && userTier !== 'loading' && (<div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>Messages: {chatUsageCount} / {currentChatLimitDisplay}</span> {isChatDisabledByLimit && <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>} {!isChatDisabledByLimit && userTier === 'basic' && <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}><Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade</Link>}</div>)}
                {selectedFiles.length > 0 && !isImageGenModeActive && (
                     <div className="mb-2 flex flex-wrap gap-1.5 px-1 max-h-20 overflow-y-auto scrollbar-thin border border-dashed rounded-lg p-2 ${isIlluminateEnabled ? 'border-gray-300' : 'border-gray-600'}">
                        {selectedFiles.map(file => (
                            <div key={file.name} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${isIlluminateEnabled ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-blue-900/50 border-blue-700/50 text-blue-300'}`}>
                                 {file.type.startsWith("image/") && file.localPreviewUrl && (<img src={file.localPreviewUrl} alt={file.name} className="w-4 h-4 rounded-sm mr-0.5 object-cover"/> )}
                                 {!file.type.startsWith("image/") && <FileText className="w-3 h-3 flex-shrink-0" />}
                                <span className="truncate max-w-[100px]">{file.name}</span>
                                <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span>
                                <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-1 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button>
                            </div>
                        ))}
                     </div>
                 )}
                <form onSubmit={handleChatSubmit} className="flex gap-2 items-center pb-2.5">
                    <button type="button" onClick={() => setIsContextDialogOpen(true)} disabled={!conversationId} className={`p-2.5 rounded-full transition-colors ${!conversationId ? 'opacity-50 cursor-not-allowed' : ''} ${isIlluminateEnabled ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-700 text-gray-400'}`} title="Set AI Context"> <BrainCircuit className="w-4 h-4" /> </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept={SUPPORTED_FILE_TYPES} className="hidden" disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit || !conversationId} />
                    <button type="button" onClick={triggerFileSelect} disabled={isImageGenModeActive || isChatLoading || isChatDisabledByLimit || !conversationId} className={`p-2.5 rounded-full transition-colors ${(isImageGenModeActive || !conversationId) ? 'opacity-50 cursor-not-allowed' : ''} ${isIlluminateEnabled ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-700 text-gray-400'}`} title={isImageGenModeActive ? "File attachment disabled in image mode" : "Attach Files"}> <Paperclip className="w-4 h-4" /> </button>
                    <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isChatDisabledByLimit || !conversationId} className={`p-2.5 rounded-full transition-colors ${(!conversationId) ? 'opacity-50 cursor-not-allowed' : ''} ${isImageGenModeActive ? (isIlluminateEnabled ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-500' : 'bg-purple-800/70 text-purple-300 ring-1 ring-purple-500') : (isIlluminateEnabled ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-700 text-gray-400') }`} title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}> <ImageIcon className="w-4 h-4" /> </button>
                    <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }} onPaste={handlePaste} placeholder={!conversationId ? "Select or start a chat..." : (isChatDisabledByLimit ? "Monthly limit reached..." : (isImageGenModeActive ? "Describe image..." : "Ask TaskMaster AI..."))} className={`flex-1 ${inputBg} rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm disabled:opacity-60 resize-none overflow-y-auto max-h-28 leading-snug`} disabled={isChatLoading || isChatDisabledByLimit || userTier === 'loading' || !conversationId} style={{ height: 'auto' }}/>
                    <button type="submit" disabled={isChatLoading || !chatMessage.trim() || isChatDisabledByLimit || userTier === 'loading' || !conversationId} className={`bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-md flex-shrink-0 ${isChatDisabledByLimit ? 'cursor-not-allowed' : ''}`} title="Send Message" aria-label="Send chat message">
                        {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                    </button>
                </form>
            </div>
            </>
        )}
        {aiChatSidebarTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <button onClick={handleNewConversation} className={`mb-2.5 w-full flex items-center justify-center gap-2 p-2.5 rounded-lg transition-colors text-sm font-medium shadow-md ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    <PlusCircle className="w-4 h-4" /> New Chat
                </button>
                {conversationList.length === 0 && <p className={`${subheadingClass} text-center text-sm py-4`}>No chat history yet.</p>}
                {conversationList.sort((a,b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0)).map((conv) => (
                  <div key={conv.id} className={`flex items-center justify-between cursor-pointer p-2.5 rounded-lg transition-all text-sm ${conversationId === conv.id ? (isIlluminateEnabled ? 'bg-blue-100 text-blue-700' : 'bg-blue-700 text-white') : (isIlluminateEnabled ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-gray-700/60 text-gray-300')}`} onClick={() => handleSelectConversation(conv.id)} >
                    <div className="flex items-center gap-2 flex-1 min-w-0"> <MessageCircle className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{conv.chatName}</span> </div>
                    <div className="relative flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === conv.id ? null : conv.id); }} className={`p-1.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-600'} transition-colors`}> <MoreHorizontal className="w-4 h-4" /> </button>
                      {openDropdownId === conv.id && (
                        <div ref={dropdownRef} className={`absolute top-8 right-0 rounded-lg shadow-xl z-50 text-xs ${isIlluminateEnabled ? 'bg-white text-gray-800 border border-gray-200' : 'bg-gray-800 text-gray-200 border border-gray-700'}`} style={{ minWidth: '130px' }} onClick={(e) => e.stopPropagation()}>
                          {[{ label: 'Rename', icon: Edit, action: () => handleRenameConversation(conv) }, { label: 'Delete', icon: Trash, action: () => handleDeleteConversationClick(conv), colorClass: isIlluminateEnabled ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-700/50' }].map(item => (
                            <button key={item.label} className={`flex items-center w-full text-left px-3 py-2 ${isIlluminateEnabled ? 'hover:bg-gray-100' : 'hover:bg-gray-700'} ${item.colorClass || ''} first:rounded-t-lg last:rounded-b-lg`} onClick={item.action}> <item.icon className="w-3.5 h-3.5 mr-2" /> {item.label} </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
        )}
        {aiChatSidebarTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <button onClick={generateProductivityAnalysis} disabled={isProductivityAnalysisLoading || !user} className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors shadow-md ${isIlluminateEnabled ? 'bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-indigo-300' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400'}`}>
                    {isProductivityAnalysisLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart className="w-4 h-4" />}
                    Generate Productivity Analysis
                </button>
                {productivityAnalysisResult && (
                    <div className={`p-3.5 rounded-lg ${cardClass} animate-fadeIn`}>
                        <h4 className={`text-lg font-semibold mb-2 ${illuminateTextPurple}`}>Productivity Score: {productivityAnalysisResult.productivity_score}%</h4>
                        <div className={`w-full h-3 rounded-full mb-3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" style={{width: `${productivityAnalysisResult.productivity_score}%`}}></div>
                        </div>
                        <h5 className={`text-sm font-semibold mt-3 mb-1 ${headingClass}`}>Analysis:</h5>
                        <p className={`text-xs mb-3 ${subheadingClass}`}>{productivityAnalysisResult.text_analysis}</p>
                        {productivityAnalysisResult.recommended_actions.length > 0 && (
                            <>
                                <h5 className={`text-sm font-semibold mt-3 mb-1.5 ${headingClass}`}>Recommended Actions:</h5>
                                <ul className="space-y-2">
                                    {productivityAnalysisResult.recommended_actions.map(action => (
                                        <li key={action.id} className={`p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 ${isIlluminateEnabled ? 'bg-indigo-50 border border-indigo-200' : 'bg-indigo-900/40 border border-indigo-700/60'}`}>
                                            <span className="truncate" title={action.description}>{action.description}</span>
                                            {action.action_type !== "suggestion" && (
                                                <button onClick={() => handleAcceptProductivityAction(action)} className={`px-2.5 py-1 rounded-md text-white text-[10px] flex items-center gap-1.5 ${isIlluminateEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'}`}>
                                                    <Check className="w-3 h-3"/> Accept
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}
                {!isProductivityAnalysisLoading && !productivityAnalysisResult && (
                    <div className={`text-center py-6 ${subheadingClass} text-sm`}>
                        <Info className="w-8 h-8 mx-auto mb-2" />
                        Click the button above to generate your productivity analysis.
                    </div>
                )}
            </div>
        )}
      </div>
      <ContextDialog
        isOpen={isContextDialogOpen}
        onClose={() => setIsContextDialogOpen(false)}
        onSave={handleSaveContext}
        initialContext={userContext}
        isIlluminateEnabled={isIlluminateEnabled}
      />
    </div>
  );
}
