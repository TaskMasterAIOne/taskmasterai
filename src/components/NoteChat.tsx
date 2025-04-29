import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2, Sparkles, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, Link } from "react-router-dom"; // Added Link
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Timer } from './Timer';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

// --- IMPORT Centralized Usage/Tier Functions ---
import {
    UserTier, // Import the type
    getUserTier,
    // getUserChatUsage, // OLD - Use getCurrentMonthUserChatUsage
    // updateUserChatUsage, // OLD - Use incrementUserChatUsage
    getCurrentMonthUserChatUsage, // *** NEW: Use this for reading ***
    incrementUserChatUsage,      // *** NEW: Use this for writing/incrementing ***
    getChatLimitForTier,
} from '../lib/current-paying-user'; // Correct path

// Types (Remain the same)
interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface ImageData { base64: string; type: string; name: string; }
interface EditStep { editType: 'insert_after_context' | 'replace_context' | 'delete_context' | 'insert_at_start' | 'append_at_end'; targetContext: string | null; contentFragment: string; }
interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    imageData?: ImageData;
    timer?: TimerMessage;
    error?: boolean;
    isEditSuggestion?: boolean;
    editExplanation?: string;
    editAction?: 'propose_targeted_edit' | 'propose_full_content_replacement' | 'propose_sequential_edits';
    editType?: EditStep['editType'];
    targetContext?: EditStep['targetContext'];
    contentFragment?: EditStep['contentFragment'];
    newFullContent?: string;
    sequentialEdits?: EditStep[];
    isUpdateConfirmation?: boolean;
    canRevert?: boolean;
    previousContent?: string;
    noteIdToRevert?: string;
}
interface SelectedFile { name: string; type: string; size: number; base64Data: string; }
interface Note { id: string; title: string; content: string; keyPoints?: string[]; questions?: { question: string }[]; }

interface NoteChatProps {
    note: Note;
    onClose: () => void;
    geminiApiKey: string;
    userName: string;
    isIlluminateEnabled: boolean;
    isBlackoutEnabled: boolean;
    isVisible: boolean;
    onUpdateNoteContent: (noteId: string, newContent: string) => Promise<void>;
    displayMode?: 'overlay' | 'inline';
    // userTier prop removed, will be fetched internally
}
export interface NoteChatHandle {
    sendMessage: (message: string) => void;
    // focusInput: () => void;
}

// --- Helper Functions (Remain the same) ---
// ... (readFileAsBase64, formatBytes, fetchWithRetry, extractCandidateText, parseTimerRequest) ...
const readFileAsBase64 = (file: File): Promise<SelectedFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            if (!base64String) { reject(new Error("Failed to read file content.")); return; }
            resolve({ name: file.name, type: file.type, size: file.size, base64Data: base64String });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                console.warn(`Attempt ${attempt + 1} failed: ${response.status}. Retrying...`);
                if (attempt === retries - 1) {
                    let errorText = `API Error (${response.status}) after ${retries} attempts.`;
                    try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { /* ignore */ }
                    throw new Error(errorText);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue;
            }
            if (!response.ok) {
                let errorText = `API Error (${response.status})`;
                 try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { /* ignore */ }
                 if (errorText.toLowerCase().includes("context length") || errorText.toLowerCase().includes("request payload size") || errorText.toLowerCase().includes("request entity too large")) {
                    throw new Error("Error: The note content and/or attached files are too large for the AI to process.");
                 }
                throw new Error(errorText);
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${attempt + 1} fetch error:`, error);
            if (attempt === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    throw new Error(`Max retries reached for: ${url}`);
}

const extractCandidateText = (responseText: string): string => {
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; }
        if (jsonResponse?.candidates?.[0]?.finishReason === 'SAFETY') { return "My response was blocked due to potential safety concerns."; }
        if (jsonResponse?.error?.message) {
            if (jsonResponse.error.message.toLowerCase().includes("context length") || jsonResponse.error.message.toLowerCase().includes("request payload size") || jsonResponse.error.message.toLowerCase().includes("request entity too large")) { return "Error: The note content and/or attached files are too large for the AI to process."; }
            return `Error: ${jsonResponse.error.message}`;
        }
         if (jsonResponse?.candidates?.[0]?.content && !jsonResponse.candidates[0].content.parts) {
             const reason = jsonResponse.candidates[0]?.finishReason;
             if (reason === 'MAX_TOKENS') return "The response was cut off as it reached the maximum length.";
             if (reason) return `Response generation stopped: ${reason}.`;
             return ""; // Empty content part
        }
        return "Sorry, I received an empty or non-standard response.";
    } catch (err) {
         if (typeof responseText === 'string') {
            if (responseText.toLowerCase().includes("api key not valid")) return "Error: Invalid API Key.";
            if (responseText.toLowerCase().includes("quota exceeded")) return "Error: API Quota Exceeded.";
            if (responseText.toLowerCase().includes("internal server error") || responseText.toLowerCase().includes("service unavailable")) return "Error: AI service is temporarily unavailable. Please try again later.";
            if (responseText.toLowerCase().includes("context length") || responseText.toLowerCase().includes("request payload size") || responseText.toLowerCase().includes("request entity too large")) return "Error: The note content and/or attached files are too large for the AI to process.";
            if (responseText.includes('```json')) return responseText; // Let JSON parsing handle errors inside JSON later
            return responseText;
        }
        console.error('Error parsing/handling Gemini response: Input was not a string.', 'Raw Input:', responseText);
        return "Error: Could not process AI response (Invalid format).";
    }
};

// Use correct Gemini 1.5 Flash endpoint
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=`; // Use 1.5 Flash

const parseTimerRequest = (message: string): number | null => {
    const cleanedMessage = message.trim().toLowerCase();
    const keywords = ['set timer', 'start timer', 'timer for', 'remind me in'];
    const timeRegex = /(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i;
    let M: RegExpMatchArray | null = null;
    const hasKeywords = keywords.some(keyword => cleanedMessage.includes(keyword));
    if (hasKeywords) { M = cleanedMessage.match(timeRegex); }
    if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i); }
    if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\s*$/i); }
    if (!M) return null;
    const A = parseInt(M[1]);
    const U = M[2].toLowerCase();
    if (isNaN(A) || A <= 0) return null;
    if (U.startsWith('h')) return A * 3600;
    if (U.startsWith('m')) return A * 60;
    if (U.startsWith('s')) return A;
    return null;
};

// --- Loading Indicator Component (Unchanged) ---
const LoadingIndicator = ({ isIlluminateEnabled }: { isIlluminateEnabled: boolean }) => (
    <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Thinking...</span>
    </div>
);

// --- Component ---
export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, displayMode = 'overlay' }: NoteChatProps, ref) => {
        // ... (State for chat message, history, loading, files, suggestions, refs remain the same) ...
        const [chatMessage, setChatMessage] = useState('');
        const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
        const [isChatLoading, setIsChatLoading] = useState(false);
        const [isMinimized, setIsMinimized] = useState(false);
        const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
        const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
        const chatEndRef = useRef<HTMLDivElement>(null);
        const initialMessageSent = useRef(false);
        const currentNoteId = useRef<string | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const [loadingMsgId, setLoadingMsgId] = useState<string | null>(null);

        // --- User, Tier, and Usage State (Using imported types/functions) ---
        const [user, setUser] = useState<User | null>(null);
        const [userTier, setUserTier] = useState<UserTier>('loading'); // Use imported UserTier
        const [chatCount, setChatCount] = useState(0);
        const [usageMonth, setUsageMonth] = useState(''); // YYYY-MM
        const [isChatLimitReached, setIsChatLimitReached] = useState(false);
        const [isLoadingUsage, setIsLoadingUsage] = useState(true);

        // --- Memoized Chat Limit (Using imported function) ---
        const currentChatLimit = useMemo(() => {
            return getChatLimitForTier(userTier);
        }, [userTier]);

        // --- Theme Styles (Unchanged) ---
        // ... (theme style constants) ...
         const overlayBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700/60" : "bg-gray-800";
        const headerBg = isIlluminateEnabled ? "bg-gray-50/90 border-gray-200" : "bg-gray-900/80 border-gray-700";
        const headingColor = isIlluminateEnabled ? "text-gray-800" : "text-white";
        const inputBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500";
        const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200";
        const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500";
        const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white";
        const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300";
        const suggestionButtonClass = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200" : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600";
        const buttonDisabledClass = "opacity-50 cursor-not-allowed";
        const userBubbleClass = isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white';
        const assistantBubbleClass = isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50';
        const errorBubbleClass = isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50';
        const editSuggestionBubbleClass = isIlluminateEnabled ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300';
        const confirmationBubbleClass = isIlluminateEnabled ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-green-900/30 border border-green-700/50 text-green-200';
        const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";
        const filePillBg = isIlluminateEnabled ? "bg-blue-100 border-blue-200" : "bg-blue-900/50 border-blue-700/50";
        const filePillText = isIlluminateEnabled ? "text-blue-800" : "text-blue-300";

        // --- Effects ---

        // --- Effect to load user, tier, and usage (*** UPDATED with new logic ***) ---
        useEffect(() => {
            if (!isVisible) return; // Only load when chat becomes visible

            setIsLoadingUsage(true);
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error("NoteChat: No authenticated user found when becoming visible.");
                setUserTier('basic'); // Default to basic if no user
                setIsLoadingUsage(false);
                return;
            }
            setUser(currentUser);

            // Determine Tier
            const tier = getUserTier(currentUser.email);
            setUserTier(tier);

            // Load Chat Usage Data (if not premium) using NEW function
            if (tier !== 'premium') {
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                getCurrentMonthUserChatUsage(currentUser.uid, currentMonthYear) // Use NEW function
                    .then(usageData => {
                        if (usageData) {
                            // Data exists for current month
                            setChatCount(usageData.count);
                            setUsageMonth(usageData.month); // Should match currentMonthYear
                            const limit = getChatLimitForTier(tier);
                            setIsChatLimitReached(usageData.count >= limit);
                             console.log(`NoteChat: Loaded chat usage for ${currentMonthYear}: ${usageData.count}`);
                        } else {
                            // No data for the CURRENT month found.
                            // Reset local state. Firestore update handled by increment.
                            console.log(`NoteChat: No chat usage data for ${currentUser.uid} for ${currentMonthYear}. Resetting local count.`);
                            setChatCount(0);
                            setUsageMonth(currentMonthYear);
                            setIsChatLimitReached(false);
                            // NO Firestore write here.
                        }
                    })
                    .catch(err => {
                        console.error("NoteChat: Error loading chat usage data:", err);
                        setChatCount(0);
                        setUsageMonth(new Date().toISOString().slice(0, 7));
                        setIsChatLimitReached(false);
                    })
                    .finally(() => setIsLoadingUsage(false));
            } else { // Premium user
                setChatCount(0);
                setUsageMonth('');
                setIsChatLimitReached(false);
                setIsLoadingUsage(false);
                console.log("NoteChat: Premium user detected, usage check skipped.");
            }

        }, [isVisible]); // Trigger when visibility changes

        // ... (Other useEffects: Initial message, scroll, etc. remain the same) ...
        useEffect(() => {
            if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) {
                setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, or attach/paste a file.` }]);
                setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false); initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null);
            } else if (displayMode === 'overlay' && !isVisible) { initialMessageSent.current = false; currentNoteId.current = null; }
        }, [note, isVisible, userName, displayMode]);

        useEffect(() => { if (!isMinimized || displayMode === 'inline') { setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); } }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);

        // --- Handlers ---
        // ... (handleTimerComplete, handleAcceptEdit, handleRevertEdit, handleFileSelect, handleRemoveFile, triggerFileSelect remain the same) ...
         const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);

        const handleAcceptEdit = async (message: ChatMessage) => {
            if (!note || isChatLoading || !message.isEditSuggestion || !message.editAction) {
                console.error("Invalid edit proposal:", message);
                setChatHistory(prev => [...prev, { id: `edit-app-err-${Date.now()}`, role: 'assistant', content: `❌ Error: Could not apply edit. Invalid proposal data.`, error: true }]);
                return;
            }
            setIsChatLoading(true);
            setLoadingMsgId(null); // Clear any previous loading state

            let finalContent: string | null = null;
            const contentBeforeEdit = note.content; // Store content BEFORE modification

            try {
                let currentContent = contentBeforeEdit; // Start with the current note content

                if (message.editAction === 'propose_targeted_edit') {
                    // Apply single targeted edit (existing logic)
                     if (!message.editType) throw new Error("Missing edit type.");
                    let applied = false;
                    const { editType, targetContext, contentFragment = "" } = message;
                     switch (editType) {
                         case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); applied = true; break;
                         case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; applied = true; break;
                         case 'insert_after_context':
                            if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { const p = i + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); applied = true; } else throw new Error("Target context for insertion not found."); } else throw new Error("Missing target context for insert."); break;
                        case 'replace_context':
                            if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + contentFragment + currentContent.slice(i + targetContext.length); applied = true; } else throw new Error("Target context for replacement not found."); } else throw new Error("Missing target context for replace."); break;
                        case 'delete_context':
                            if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + currentContent.slice(i + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); applied = true; } else throw new Error("Target context for deletion not found."); } else throw new Error("Missing target context for delete."); break;
                         default: throw new Error(`Unsupported edit type: ${editType}`);
                    }
                     if (applied) finalContent = currentContent; else throw new Error("Targeted edit failed.");

                } else if (message.editAction === 'propose_full_content_replacement') {
                    // Apply full replacement (existing logic)
                     if (typeof message.newFullContent === 'string') { finalContent = message.newFullContent; }
                     else { throw new Error("Missing new full content for replacement."); }

                } else if (message.editAction === 'propose_sequential_edits') {
                    // Apply sequential edits (existing logic)
                     if (!message.sequentialEdits || !Array.isArray(message.sequentialEdits) || message.sequentialEdits.length === 0) {
                         throw new Error("Invalid sequential edit proposal: 'edits' array is missing or empty.");
                     }
                    let allApplied = true;
                    for (let i = 0; i < message.sequentialEdits.length; i++) {
                         const editStep = message.sequentialEdits[i];
                         const { editType, targetContext, contentFragment } = editStep;
                         let appliedThisStep = false;
                         const stepNumber = i + 1;
                         switch (editType) {
                             case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); appliedThisStep = true; break;
                             case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; appliedThisStep = true; break;
                            case 'insert_after_context':
                                if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { const p = idx + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for insertion not found.`); throw new Error(`Step ${stepNumber}: Target context for insertion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for insert.`); } break;
                            case 'replace_context':
                                if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + contentFragment + currentContent.slice(idx + targetContext.length); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for replacement not found.`); throw new Error(`Step ${stepNumber}: Target context for replacement not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for replace.`); } break;
                            case 'delete_context':
                                if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + currentContent.slice(idx + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for deletion not found.`); throw new Error(`Step ${stepNumber}: Target context for deletion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for delete.`); } break;
                             default: allApplied = false; throw new Error(`Step ${stepNumber}: Unsupported edit type: ${editType}`);
                         }
                         if (!appliedThisStep) { allApplied = false; throw new Error(`Sequential edit step ${stepNumber} failed unexpectedly.`); }
                     }
                     if (allApplied) { finalContent = currentContent; }
                } else {
                    throw new Error(`Unknown edit action: ${message.editAction}`);
                }

                // If any action resulted in valid finalContent, update note
                if (finalContent !== null) {
                    await onUpdateNoteContent(note.id, finalContent);
                    // --- MODIFIED: Add confirmation message with revert capability ---
                    const confirmationMsgId = `edit-ok-${Date.now()}`;
                    setChatHistory(prev => [
                        ...prev,
                        {
                            id: confirmationMsgId,
                            role: 'assistant',
                            content: "✅ Note updated!",
                            isUpdateConfirmation: true, // Mark as confirmation
                            canRevert: true,           // Initially allow revert
                            previousContent: contentBeforeEdit, // Store previous state
                            noteIdToRevert: note.id     // Store note ID
                        }
                    ]);
                }
            } catch (error) {
                console.error("Error applying edit:", error);
                const eMsg = error instanceof Error ? error.message : 'Unknown error during update.';
                setChatHistory(prev => [...prev, { id: `edit-err-${Date.now()}`, role: 'assistant', content: `❌ Update failed: ${eMsg}`, error: true }]);
            } finally {
                setIsChatLoading(false);
            }
        };

        const handleRevertEdit = async (message: ChatMessage) => {
            if (!message.canRevert || typeof message.previousContent !== 'string' || !message.noteIdToRevert || isChatLoading || !message.id) {
                console.error("Cannot revert this action. Invalid message state:", message);
                setChatHistory(prev => [...prev, { id: `revert-err-state-${Date.now()}`, role: 'assistant', content: `❌ Cannot revert. Invalid state.`, error: true }]);
                return;
            }
            setIsChatLoading(true);
            setLoadingMsgId(null); // Clear loader state
            const originalMessageId = message.id; // ID of the "✅ Note updated!" message
            try {
                await onUpdateNoteContent(message.noteIdToRevert, message.previousContent);
                // Add revert confirmation message
                setChatHistory(prev => [
                    ...prev.map(msg => // Disable revert on the original message
                        msg.id === originalMessageId ? { ...msg, canRevert: false } : msg
                    ),
                    { id: `revert-ok-${Date.now()}`, role: 'assistant', content: "🔄 Change reverted." }
                ]);
            } catch (error) {
                console.error("Error reverting edit:", error);
                const eMsg = error instanceof Error ? error.message : 'Unknown error during revert.';
                setChatHistory(prev => [...prev, { id: `revert-err-${Date.now()}`, role: 'assistant', content: `❌ Revert failed: ${eMsg}`, error: true }]);
            } finally {
                setIsChatLoading(false);
            }
        };

        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
             const files = event.target.files; if (!files) return; setIsChatLoading(true); const newFiles: SelectedFile[] = []; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
             for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (existingFileNames.has(file.name)) { console.log(`Skipping duplicate file: ${file.name}`); setChatHistory(prev => [...prev, { id: `file-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate file: "${file.name}".`, error: false }]); continue; }
                if (file.size > 20 * 1024 * 1024) { setChatHistory(prev => [...prev, { id: `file-err-size-${Date.now()}`, role: 'assistant', content: `❌ File "${file.name}" is too large (max 20MB).`, error: true }]); continue; }
                if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setChatHistory(prev => [...prev, { id: `file-err-type-${Date.now()}`, role: 'assistant', content: `❌ File type for "${file.name}" is not supported (only images and PDFs).`, error: true }]); continue; }
                filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name);
             }
             try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); }
             catch (error) { console.error("Error reading files:", error); setChatHistory(prev => [...prev, { id: `file-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing selected file(s). Please try again.`, error: true }]); }
             finally { setIsChatLoading(false); if (fileInputRef.current) { fileInputRef.current.value = ''; } }
        };

        const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        const triggerFileSelect = () => fileInputRef.current?.click();

        // --- Core Chat Submit Logic (*** UPDATED with new usage logic ***) ---
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[]) => {
            const currentFiles = filesToSend || selectedFiles;
            if ((!messageContent && currentFiles.length === 0) || isChatLoading || !geminiApiKey || !note || !user) return;

            // --- START: Usage Check (Use state and imported functions) ---
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            let limitReached = false;
            const limit = currentChatLimit; // Use memoized limit

            if (userTier !== 'premium') {
                 let currentCount = chatCount; // Use state value

                // Check if the stored month matches the current month. If not, reset local count.
                if (usageMonth !== currentMonthYear) {
                    console.log(`NoteChat: Month mismatch (State: ${usageMonth}, Current: ${currentMonthYear}). Resetting local count.`);
                    currentCount = 0; // Reset count locally for the check below
                    setChatCount(0); // Update state
                    setUsageMonth(currentMonthYear); // Update state
                    setIsChatLimitReached(false); // Update state
                    limitReached = false; // Ensure limit isn't triggered by outdated state
                    // NO Firestore write here - handled by incrementUserChatUsage
                } else {
                    // Month matches, check current count against limit
                    limitReached = currentCount >= limit;
                    // Update state just in case it was out of sync
                    setIsChatLimitReached(limitReached);
                }
            }

            if (limitReached) {
                 setChatHistory(prev => [...prev, {
                     id: `limit-${Date.now()}`,
                     role: 'assistant',
                     content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit. Upgrade for more interactions!`,
                     error: true
                 }]);
                 setChatMessage(''); // Clear input if limit reached
                 return; // Stop submission
            }
            // --- END: Usage Check ---


            const timerDuration = parseTimerRequest(messageContent);

            // Prepare user message
            let userMsgContent = messageContent;
            let userMsgImageData: ImageData | undefined = undefined;
            const imageFiles = currentFiles.filter(f => f.type.startsWith('image/'));
            const nonImageFiles = currentFiles.filter(f => !f.type.startsWith('image/'));
            const attachmentTextParts: string[] = [];
            if (imageFiles.length > 0) { userMsgImageData = { base64: imageFiles[0].base64Data, type: imageFiles[0].type, name: imageFiles[0].name }; imageFiles.forEach(img => attachmentTextParts.push(img.name)); }
            nonImageFiles.forEach(file => attachmentTextParts.push(file.name));
            if (attachmentTextParts.length > 0) { userMsgContent += `${userMsgContent ? '\n\n' : ''}`; }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: userMsgContent, imageData: userMsgImageData };
            setChatHistory(prev => [...prev, userMsg]);
            setSuggestedPrompts([]); // Clear suggestions
            if (!filesToSend) { setSelectedFiles([]); } // Clear files if not explicitly passed

            if (timerDuration) {
                 const tId = `t-${Date.now()}`; const dTxt = timerDuration >= 3600 ? `${Math.round(timerDuration / 3600)}h` : timerDuration >= 60 ? `${Math.round(timerDuration / 60)}m` : `${timerDuration}s`;
                setChatHistory(prev => [ ...prev, { id: `tstart-${tId}`, role: 'assistant', content: `Timer set: ${dTxt}.`, timer: { type: 'timer', duration: timerDuration, id: tId } } ]);
                if (messageContent.toLowerCase().startsWith('set timer') || messageContent.toLowerCase().startsWith('timer for')) { setChatMessage(''); }
                return; // Stop if it was ONLY a timer command
            }

            setIsChatLoading(true);

            // --- Increment Usage Count (Use ATOMIC function) ---
            let incrementFailed = false;
            if (userTier !== 'premium' && user?.uid) {
                try {
                    // Call the ATOMIC increment function
                    await incrementUserChatUsage(user.uid);

                    // Optimistic UI update *after* successful increment
                    const newLocalCount = chatCount + 1;
                    setChatCount(newLocalCount);
                    setIsChatLimitReached(newLocalCount >= limit);

                } catch (err) {
                    incrementFailed = true;
                    console.error("NoteChat: Failed to increment chat usage:", err);
                    // Add error message to chat history for user feedback
                    setChatHistory(prevHist => [...prevHist, {
                        id:`usage-err-${Date.now()}`,
                        role: 'assistant',
                        content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.",
                        error: true
                    }]);
                    // Do not block the chat functionality itself
                }
            }
            // --- End Increment Logic ---

            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
            setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: '...' }]); // Placeholder

            const recentHistory = chatHistory.slice(-8);
            const systemInstruction = `You are TaskMaster, a highly meticulous and context-aware AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}".

Your primary goal is to be helpful, accurate, and strictly follow instructions based on the user's request and the provided note content. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** First, determine if the user is ASKING a question *about* the note or if they are EXPLICITLY requesting a *change* to the note. This distinction is CRITICAL.
2.  **Execute Correct Function:** Based on the intent, follow the corresponding function below (Answer Questions, Modify Note, or General Chat).
3.  **Provide Suggestions:** ALWAYS conclude your response with relevant suggestions.

**Functions (Strict Order of Priority):**

1.  **Answer Questions Directly (Highest Priority):**
    *   **PRIORITY:** If the user asks a question *about* the note's content (e.g., "What does it say about X?", "Summarize this section", "Explain the process mentioned"), provide a direct, textual answer based **SOLELY** on the "Current Note Content".
    *   **CRITICAL:** **DO NOT** propose an edit (JSON response) if the user is merely asking for information, clarification, or summarization. Use your understanding of the provided note content to respond informatively in natural language.
    *   **Handling Missing Information:** If the note *doesn't* contain the answer to the user's question, **DO NOT** state "The note doesn't mention X". Instead, leverage your general knowledge to provide a helpful and accurate answer, clearly indicating that this information is supplementary (e.g., "While the note doesn't detail X, generally speaking..."). Avoid fabricating information.

2.  **Modify Note (ONLY if EXPLICITLY Asked - Requires JSON Output):**
    *   **TRIGGER:** Propose an edit **ONLY** if the user *explicitly* uses action verbs indicating a desire to *change* the note content. Examples: "add", "remove", "delete", "change", "rewrite", "update", "replace", "insert", "correct", "fix", "append", "revise". Simple questions or statements like "This section is unclear" DO NOT trigger an edit proposal.
    *   **Choose ONE Method (A, B, or C) per response. Ensure JSON is valid.**
    *   **CRITICAL - NO CODE LEAKS:** **NEVER** include the raw JSON structure or code fragments (like markdown tables, lists, etc.) intended for the edit directly within your conversational text response (outside the JSON block). Your user-facing chat text before the JSON block must be natural language (e.g., "Okay, I can add that list for you." or "Here's the proposed correction:"). The structured data *only* goes inside the designated JSON block.

        *   **Method A: Single Targeted Edit (PREFERRED for ONE specific change):** For a single, localized change.
            \`\`\`json
            {
              "action": "propose_targeted_edit",
              "explanation": "[Brief, clear explanation of the specific change being made.]",
              "edit_type": "[Type: 'insert_after_context', 'replace_context', 'delete_context', 'insert_at_start', 'append_at_end']",
              "target_context": "[Short, unique text snippet EXACTLY from the CURRENT note identifying the location. MUST be precise. Use null ONLY for 'insert_at_start' or 'append_at_end'.]",
              "content_fragment": "[EXACT markdown fragment for the change. Use empty string \"\" for 'delete_context'.]"
            }
            \`\`\`
            *   **Handling Corrections/Fixes:** If the user asks to "fix" or "correct" something (especially something *you* might have recently added incorrectly), use replace_context targeting the *incorrect* segment in the *current* note content, or delete_context if removal is needed. Do not just add a *second*, corrected version.

        *   **Method B: Sequential Edits (Use for MULTIPLE specific changes requested in ONE user message):** MUST be used if the user asks for *multiple distinct* changes in a single message (e.g., "Delete sentence A, then add paragraph B after sentence C").
            \`\`\`json
            {
              "action": "propose_sequential_edits",
              "explanation": "[Overall explanation summarizing ALL the sequential changes.]",
              "edits": [ // An array of edit steps, executed STRICTLY in order
                { // First edit step
                  "edit_type": "[Type]",
                  "target_context": "[Context for *first* edit, based on ORIGINAL note content. null for start/end.]",
                  "content_fragment": "[Fragment for *first* edit.]"
                },
                { // Second edit step
                  "edit_type": "[Type]",
                  // CRITICAL: target_context for step N MUST exist in the note content *AFTER* steps 1 to N-1 have been virtually applied. Be precise.
                  "target_context": "[Context for *second* edit, based on content *after* first edit is applied. null for start/end.]",
                  "content_fragment": "[Fragment for *second* edit.]"
                }
                // ... add more steps exactly as needed for the user's request
              ]
            }
            \`\`\`
            *   **MANDATORY USE:** Use this method whenever multiple distinct operations are requested in one turn. DO NOT propose multiple separate propose_targeted_edit responses for a single multi-step request. Ensure the sequence logically follows the user's instructions.

        *   **Method C: Full Content Replacement (ONLY for MAJOR OVERHAULS):** Use ONLY for requests like deleting *all* content, replacing the *entire* note, or major holistic rewrites requested *in one go*.
            \`\`\`json
            {
              "action": "propose_full_content_replacement",
              "explanation": "[Brief explanation, e.g., 'Okay, I've cleared the note.' or 'Here is the completely rewritten note based on your instructions.']",
              "new_full_content": "[COMPLETE new markdown content for the entire note. Use empty string \"\" for deleting all content.]"
            }
            \`\`\`

3.  **Generate Suggestions (Always Include):**
    *   **MANDATORY:** **ALWAYS** conclude every response (whether answering, editing, or chatting) with 3 relevant follow-up suggestions.
    *   **Content:** Suggestions should be context-aware, based on the current note content, attached files (if mentioned), and recent chat history. They should anticipate what the *user* might want to do or ask next.
    *   **Format:** Enclose them clearly at the **VERY END** of your response:
        
        [SUGGESTIONS]
        What are the key takeaways from the conclusion?
        Can you add a section comparing Option A and Option B?
        Rewrite the first paragraph to be more engaging.
        [/SUGGESTIONS]
        
    *   **Style:** Make suggestions concise, actionable, and phrased as questions the user might ask you, or direct edit commands they might give you (e.g., "Add X", "Summarize Y", "What about Z?"). **DO NOT** phrase them as things *you* can do (e.g., "I can add a table..." is WRONG. Use "Add a table summarizing..." instead). Mix question and edit prompts appropriately.

4.  **General Chat:**
    *   If the user's input isn't a direct question about the note content (handled by #1) and isn't an explicit command to change the note (handled by #2), engage in helpful conversation related to the note's topic, note-taking strategies, or clarifying their request.
    *   **DO NOT** process timer requests (e.g., "set timer 5 min"); state that they are handled separately.

**Important Reminders & Constraints:**

*   **Context is Key:** Pay close attention to the Current Note Content and Chat History. Your responses and edit proposals MUST be relevant to the *current* state.
*   **Explicit Edits Only:** Do not infer an edit request. Wait for clear action verbs.
*   **Accuracy of target_context:** This is critical for edits, especially sequential ones. It MUST uniquely identify the location in the note *at the time that specific edit step is executed*. Double-check this.
*   **Follow Hierarchy:** Prioritize answering questions over proposing edits.
*   **No JSON/Code Leaks:** Keep your conversational text clean and natural. Structured data belongs ONLY in the JSON block.
*   **Be Helpful:** Even when the note lacks information, try to assist using your general knowledge where appropriate and clearly indicated.

**Current Note Content (Full):**
"""
${note.content}
"""

**Key Points (Reference Only):**
${note.keyPoints?.map(p => `- ${p}`).join('\n') || 'N/A'}

---
**Chat History (Recent):**
${recentHistory
    .filter(m => !m.content?.startsWith("Timer set:") && !m.timer && !m.content?.startsWith("✅ Note updated!") && !m.content?.startsWith("🔄 Change reverted.") && m.content !== '...' && !m.isUpdateConfirmation) // Exclude confirmation/revert/loading messages
    .map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content.replace(/```json[\s\S]*?```/g, '[Edit Proposed]').replace(/\[(?:Image )?Attached:.*?\]/g, '[File Attached]')}`)
    .join('\n')}
---

**${userName}: ${messageContent}** (Note: Files might be attached separately)
**Assistant:**`;

            try {
                // ... (API call and response handling logic remains the same) ...
                const fullGeminiEndpoint = `${GEMINI_ENDPOINT}${geminiApiKey}`;
                const apiContent: any[] = [];
                // Build API history (unchanged)
                recentHistory.forEach(msg => {
                     if (msg.role === 'user') {
                         apiContent.push({ role: "user", parts: [{ text: msg.content.replace(/\[(?:Image )?Attached:.*?\]/g, '').trim() }] });
                     } else if (msg.role === 'assistant' && !msg.content?.startsWith("Timer set:") && !msg.timer && !msg.content?.startsWith("✅ Note updated!") && !msg.content?.startsWith("🔄 Change reverted.") && msg.content !== '...' && !msg.isUpdateConfirmation) { // Added more filters
                         const assistantContent = msg.content?.replace(/```json[\s\S]*?```/g, msg.isEditSuggestion ? `(Proposed Edit: ${msg.editExplanation || 'Details omitted'})` : '(Response provided)');
                         if (assistantContent?.trim()) { apiContent.push({ role: "model", parts: [{ text: assistantContent }] }); }
                     }
                 });

                const currentUserParts: any[] = [{ text: systemInstruction }];
                 if (currentFiles.length > 0) {
                    currentFiles.forEach(file => {
                        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                            currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                        } else { console.warn(`Skipping file with unsupported MIME type for API: ${file.name} (${file.type})`); }
                    });
                 }
                apiContent.push({ role: "user", parts: currentUserParts });

                let requestBody = JSON.stringify({
                    contents: apiContent,
                    generationConfig: { temperature: 0.6, maxOutputTokens: 8192, topP: 0.95, responseMimeType: "text/plain" }
                });

                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };

                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text();

                let assistantRawContent = extractCandidateText(responseText);
                let finalDisplayedContent = assistantRawContent;
                let extractedSuggestions: string[] = [];

                // Suggestion Parsing (Unchanged)
                const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                const suggestionMatch = assistantRawContent.match(suggestionRegex);
                 if (suggestionMatch && suggestionMatch[1]) {
                     extractedSuggestions = suggestionMatch[1].split('\n').map(s => s.trim().replace(/^- /, '').trim()).filter(s => s.length > 1 && s.length < 120);
                     finalDisplayedContent = assistantRawContent.replace(suggestionRegex, '').trim();
                     extractedSuggestions = extractedSuggestions.slice(0, 4);
                     setSuggestedPrompts(extractedSuggestions);
                 } else { setSuggestedPrompts([]); }


                let assistantFinalMessage: ChatMessage = { id: newLoadingMsgId, role: 'assistant', content: finalDisplayedContent || "...", error: assistantRawContent.startsWith("Error:") };

                // JSON Parsing Logic (Unchanged)
                const jsonMatch = finalDisplayedContent.match(/```json\s*([\s\S]*?)\s*```/);
                let potentialJsonString: string | null = null;
                if (jsonMatch && jsonMatch[1]) {
                    potentialJsonString = jsonMatch[1].trim();
                    let parsedSuccessfully = false;
                    try {
                        const parsedJson = JSON.parse(potentialJsonString);
                        assistantFinalMessage.isEditSuggestion = false; assistantFinalMessage.error = false; // Reset

                        if (parsedJson.action === "propose_targeted_edit" && typeof parsedJson.explanation === 'string' && typeof parsedJson.edit_type === 'string' && typeof parsedJson.content_fragment === 'string' && (typeof parsedJson.target_context === 'string' || parsedJson.target_context === null)) {
                             assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_targeted_edit", editExplanation: parsedJson.explanation, editType: parsedJson.edit_type as EditStep['editType'], targetContext: parsedJson.target_context, contentFragment: parsedJson.content_fragment };
                             parsedSuccessfully = true;
                        }
                        else if (parsedJson.action === "propose_full_content_replacement" && typeof parsedJson.explanation === 'string' && typeof parsedJson.new_full_content === 'string') {
                             assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_full_content_replacement", editExplanation: parsedJson.explanation, newFullContent: parsedJson.new_full_content };
                             parsedSuccessfully = true;
                        }
                        else if (parsedJson.action === "propose_sequential_edits" && typeof parsedJson.explanation === 'string' && Array.isArray(parsedJson.edits) && parsedJson.edits.length > 0) {
                            const validEdits: EditStep[] = []; let sequenceIsValid = true;
                            for (let i = 0; i < parsedJson.edits.length; i++) {
                                const step = parsedJson.edits[i];
                                if (typeof step.edit_type === 'string' && typeof step.content_fragment === 'string' && (typeof step.target_context === 'string' || step.target_context === null) &&
                                    ['insert_after_context', 'replace_context', 'delete_context', 'insert_at_start', 'append_at_end'].includes(step.edit_type) &&
                                    (step.edit_type === 'insert_at_start' || step.edit_type === 'append_at_end' || step.target_context !== null)
                                ) { validEdits.push({ editType: step.edit_type as EditStep['editType'], targetContext: step.target_context, contentFragment: step.content_fragment }); }
                                else { sequenceIsValid = false; break; }
                            }
                            if (sequenceIsValid) {
                                assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_sequential_edits", editExplanation: parsedJson.explanation, sequentialEdits: validEdits };
                                parsedSuccessfully = true;
                            } else {
                                assistantFinalMessage.content = `Warning: AI proposed sequential edits, but failed. Please ask the AI to try again. \n\n---\n${finalDisplayedContent}`; assistantFinalMessage.error = true;
                            }
                        }
                        else {
                             assistantFinalMessage.content = `Warning: AI proposed an edit, but failed. Please ask the AI to try again. \n\n---\n${finalDisplayedContent}`; assistantFinalMessage.error = true;
                        }
                        if (parsedSuccessfully) {
                             finalDisplayedContent = finalDisplayedContent.replace(jsonMatch[0], '').trim();
                             assistantFinalMessage.content = finalDisplayedContent || parsedJson.explanation || "(Edit proposed)";
                             if (!assistantFinalMessage.content.trim()) assistantFinalMessage.content = "(Edit proposed without explanation)";
                        }
                    } catch (parseError: any) {
                         assistantFinalMessage.content = `Error: Failed to process edit (JSON Parse Error: ${parseError.message}).\n\n---\n${finalDisplayedContent}`; assistantFinalMessage.error = true;
                    }
                } else if (assistantRawContent.startsWith("Error:")) {
                    assistantFinalMessage.error = true; assistantFinalMessage.content = assistantRawContent;
                }
                else if (!assistantFinalMessage.isEditSuggestion) { assistantFinalMessage.content = finalDisplayedContent; }

                if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer) {
                    assistantFinalMessage.content = "(Received empty response)"; assistantFinalMessage.error = true;
                }

                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { ...assistantFinalMessage, id: newLoadingMsgId } : msg ));

            } catch (err: any) {
                console.error('Chat submit fetch/process error:', err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { id: newLoadingMsgId, role: 'assistant', content: `❌ ${errorMsg}. Please check console or try again.`, error: true } : msg ));
                 setSuggestedPrompts([]); // Clear suggestions on error
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null); // Clear loading message ID when done
             }
        };

        // --- Other Handlers ---
        const handleChatSubmit = async (e?: React.FormEvent) => {
            e?.preventDefault(); const currentMessage = chatMessage.trim();
            if (!currentMessage && selectedFiles.length === 0) return;
            const filesToSubmit = [...selectedFiles]; setChatMessage('');
            await submitMessageToAI(currentMessage, filesToSubmit);
            if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
        };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => { submitMessageToAI(suggestion); };
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
             const items = event.clipboardData?.items; if (!items) return; let imagePasted = false; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
             for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        if (existingFileNames.has(file.name)) { setChatHistory(prev => [...prev, { id: `paste-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate pasted file: "${file.name}".`, error: false }]); continue; }
                        if (file.size > 20 * 1024 * 1024) { setChatHistory(prev => [...prev, { id: `paste-err-size-${Date.now()}`, role: 'assistant', content: `❌ Pasted image "${file.name}" is too large (max 20MB).`, error: true }]); continue; }
                        filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); imagePasted = true;
                    }
                }
             }
             if (imagePasted) {
                event.preventDefault(); setIsChatLoading(true);
                try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); }
                catch (error) { console.error("Error processing pasted image:", error); setChatHistory(prev => [...prev, { id: `paste-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing pasted image. Please try again.`, error: true }]); }
                finally { setIsChatLoading(false); }
             }
        }, [selectedFiles]);

        useImperativeHandle(ref, () => ({
            sendMessage: (message: string) => { submitMessageToAI(message); },
            // focusInput: () => { textareaRef.current?.focus(); }
        }));


        // --- Dynamic Styles & Render Logic (Unchanged) ---
        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`;
        if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                {/* Header (Unchanged) */}
                <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                    <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}> <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span> </h3>
                    {displayMode === 'overlay' && ( <div className="flex items-center"> <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}> {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />} </button> <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close"> <X className="w-4 h-4" /> </button> </div> )}
                    {displayMode === 'inline' && ( <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View"> <X className="w-4 h-4" /> </button> )}
                </div>

                {/* Chat Body (Unchanged logic, styles reference unchanged vars) */}
                {(!isMinimized || displayMode === 'inline') && (
                    <>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {chatHistory.map((message, index) => {
                                const isCurrentLoadingMsg = message.role === 'assistant' && isChatLoading && message.id === loadingMsgId;
                                const bubbleClass = message.role === 'user' ? userBubbleClass
                                    : message.error ? errorBubbleClass
                                    : message.isEditSuggestion ? editSuggestionBubbleClass
                                    : message.isUpdateConfirmation ? confirmationBubbleClass
                                    : assistantBubbleClass;
                                const proseClass = `prose prose-sm max-w-none ${ isIlluminateEnabled
                                    ? (message.isEditSuggestion ? 'prose-yellow text-yellow-900' : (message.error ? 'prose-red text-red-800' : (message.isUpdateConfirmation ? 'prose-green text-green-900' : 'prose-gray text-gray-800')))
                                    : (message.isEditSuggestion ? 'prose-invert text-yellow-200' : (message.error ? 'prose-invert text-red-300' : (message.isUpdateConfirmation ? 'prose-invert text-green-200' : 'prose-invert text-gray-200')))
                                } prose-p:text-xs prose-p:my-1 prose-ul:text-xs prose-ol:text-xs prose-li:my-0 prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-1.5 prose-pre:rounded`;

                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                            {isCurrentLoadingMsg ? (
                                                <LoadingIndicator isIlluminateEnabled={isIlluminateEnabled} />
                                            ) : message.content ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
                                                    className={proseClass}
                                                    components={{
                                                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" {...props} />,
                                                        code: ({node, inline, className, children, ...props}) => {
                                                            const match = /language-(\w+)/.exec(className || ''); const isJson = className === 'language-json';
                                                            if (inline) { return <code className={`${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-600/70 text-gray-100'} px-1 py-0.5 rounded text-[10px]`} {...props}>{children}</code>; }
                                                            return <pre className={`${isIlluminateEnabled ? '!bg-gray-200/70 !text-gray-800' : '!bg-gray-600/70 !text-gray-100'} p-1.5 rounded my-1 text-[11px] overflow-x-auto`} {...props}><code>{children}</code></pre>;
                                                        },
                                                    }}
                                                >{message.content}</ReactMarkdown>
                                            ) : null}
                                            {message.imageData && ( <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}> <img src={`data:${message.imageData.type};base64,${message.imageData.base64}`} alt={message.imageData.name} className="max-w-full h-auto max-h-48 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={() => window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')} title={`Click to view full image: ${message.imageData.name}`} /> </div> )}
                                            {message.timer && ( <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div> )}
                                            {message.isEditSuggestion && message.editAction && !isChatLoading && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-yellow-300/50 dark:border-yellow-700/50"> <button onClick={() => handleAcceptEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-yellow-100' : 'hover:bg-yellow-700/50'} `} disabled={isChatLoading} > <Check className="w-3.5 h-3.5" /> Apply Update{message.editAction === 'propose_sequential_edits' && message.sequentialEdits && message.sequentialEdits.length > 1 ? ` (${message.sequentialEdits.length} steps)` : ''} </button> </div> )}
                                            {message.isUpdateConfirmation && message.canRevert && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-green-300/50 dark:border-green-700/50"> <button onClick={() => handleRevertEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-600'}`} disabled={isChatLoading} title="Revert this change" > <RefreshCcw className="w-3.5 h-3.5" /> Revert </button> </div> )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} className="h-0"></div>
                        </div>

                        {/* Suggestions Area (Unchanged) */}
                        {suggestedPrompts.length > 0 && !isChatLoading && ( <div className={`px-3 py-2 border-t ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}> <p className={`text-xs font-medium w-full mb-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Suggestions:</p> <div className="flex flex-wrap gap-2"> {suggestedPrompts.map((prompt, idx) => ( <button key={idx} onClick={() => handleSuggestionClick(prompt)} className={`${suggestionButtonClass} text-xs px-2.5 py-1 rounded-md hover:shadow-sm transition-all duration-150 cursor-pointer`} title={prompt} > {prompt} </button> ))} </div> </div> )}

                        {/* Input Form Area (*** UPDATED with new usage logic ***) */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Usage Display */}
                            {userTier !== 'premium' && userTier !== 'loading' && (
                                <div className="pb-1 text-xs text-center">
                                    <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>
                                        {/* Use chatCount state and currentChatLimit memo */}
                                        Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit}
                                    </span>
                                    {/* Use isChatLimitReached state */}
                                    {isChatLimitReached && !isLoadingUsage && (
                                        <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>
                                    )}
                         {!isChatLimitReached && userTier === 'basic' && (
                              <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}>
                                 <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade
                             </Link>
                         )}
                     </div>
                 )}
                            {/* File Pills */}
                            {selectedFiles.length > 0 && ( <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div> )}
                            {/* Input Form */}
                            <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "Monthly chat limit reached..." : "Ask, paste an image, or attach files..."} className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  // Use state to disable
                                  disabled={isChatLoading || isChatLimitReached || isLoadingUsage}
                                  style={{ height: 'auto' }} aria-label="Chat input" />
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" />
                                 <button type="button" onClick={triggerFileSelect} disabled={isChatLoading || isLoadingUsage} className={`${buttonSecondaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} title="Attach Files (Image/PDF)"> <Paperclip className="w-4 h-4" /> </button>
                                 <button type="submit"
                                  // Use state to disable
                                  disabled={isChatLoading || isLoadingUsage || (!chatMessage.trim() && selectedFiles.length === 0) || isChatLimitReached}
                                  className={`${buttonPrimaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || (!chatMessage.trim() && selectedFiles.length === 0) || isChatLimitReached ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`}
                                  > {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
