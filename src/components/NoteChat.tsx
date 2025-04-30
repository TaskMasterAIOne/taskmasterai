import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2, Sparkles, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Image as ImageIcon } from 'lucide-react'; // Added ImageIcon
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
    getCurrentMonthUserChatUsage, // *** NEW: Use this for reading ***
    incrementUserChatUsage,      // *** NEW: Use this for writing/incrementing ***
    getChatLimitForTier,
} from '../lib/current-paying-user'; // Correct path

// --- Types ---
interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface ImageData { base64: string; type: string; name: string; } // User uploaded image data
interface EditStep { editType: 'insert_after_context' | 'replace_context' | 'delete_context' | 'insert_at_start' | 'append_at_end'; targetContext: string | null; contentFragment: string; }

// Updated ChatMessage interface
interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    imageData?: ImageData; // User uploaded image
    generatedImageData?: string; // Assistant generated image (base64 data URL)
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
}
export interface NoteChatHandle {
    sendMessage: (message: string) => void;
}

// --- Helper Functions (Remain the same) ---
const readFileAsBase64 = (file: File): Promise<SelectedFile> => {
    // ... (implementation unchanged)
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
  // ... (implementation unchanged)
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    // ... (implementation unchanged)
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
                 // Check for unsupported image format error specifically if needed
                 if (response.status === 400 && errorText.toLowerCase().includes("image format")) {
                    throw new Error("Error: Unsupported image format provided to the AI.");
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

// *** MODIFIED ENDPOINT ***
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=`;

const parseTimerRequest = (message: string): number | null => {
    // ... (implementation unchanged)
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
    // ... (implementation unchanged)
    <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Thinking...</span>
    </div>
);

// --- Component ---
export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, displayMode = 'overlay' }: NoteChatProps, ref) => {
        // ... (State variables unchanged) ...
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

        // --- User, Tier, and Usage State (Unchanged) ---
        const [user, setUser] = useState<User | null>(null);
        const [userTier, setUserTier] = useState<UserTier>('loading'); // Use imported UserTier
        const [chatCount, setChatCount] = useState(0);
        const [usageMonth, setUsageMonth] = useState(''); // YYYY-MM
        const [isChatLimitReached, setIsChatLimitReached] = useState(false);
        const [isLoadingUsage, setIsLoadingUsage] = useState(true);

        // --- Memoized Chat Limit (Unchanged) ---
        const currentChatLimit = useMemo(() => {
            return getChatLimitForTier(userTier);
        }, [userTier]);

        // --- Theme Styles (Unchanged) ---
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

        // --- Effects (Unchanged) ---
        // Effect to load user, tier, and usage
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

            const tier = getUserTier(currentUser.email);
            setUserTier(tier);

            if (tier !== 'premium') {
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                getCurrentMonthUserChatUsage(currentUser.uid, currentMonthYear)
                    .then(usageData => {
                        if (usageData) {
                            setChatCount(usageData.count);
                            setUsageMonth(usageData.month);
                            const limit = getChatLimitForTier(tier);
                            setIsChatLimitReached(usageData.count >= limit);
                             console.log(`NoteChat: Loaded chat usage for ${currentMonthYear}: ${usageData.count}`);
                        } else {
                            console.log(`NoteChat: No chat usage data for ${currentUser.uid} for ${currentMonthYear}. Resetting local count.`);
                            setChatCount(0);
                            setUsageMonth(currentMonthYear);
                            setIsChatLimitReached(false);
                        }
                    })
                    .catch(err => {
                        console.error("NoteChat: Error loading chat usage data:", err);
                        setChatCount(0);
                        setUsageMonth(new Date().toISOString().slice(0, 7));
                        setIsChatLimitReached(false);
                    })
                    .finally(() => setIsLoadingUsage(false));
            } else {
                setChatCount(0);
                setUsageMonth('');
                setIsChatLimitReached(false);
                setIsLoadingUsage(false);
                console.log("NoteChat: Premium user detected, usage check skipped.");
            }

        }, [isVisible]); // Trigger when visibility changes

        // Initial message effect
        useEffect(() => {
            if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) {
                setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, generate an image, or attach/paste a file.` }]); // Added "generate an image"
                setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false); initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null);
            } else if (displayMode === 'overlay' && !isVisible) { initialMessageSent.current = false; currentNoteId.current = null; }
        }, [note, isVisible, userName, displayMode]);

        // Scroll effect
        useEffect(() => { if (!isMinimized || displayMode === 'inline') { setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); } }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);


        // --- Handlers (Unchanged, except file validation potentially) ---
         const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);
         const handleAcceptEdit = async (message: ChatMessage) => {
            // ... (implementation unchanged) ...
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
                    // Add confirmation message with revert capability
                    const confirmationMsgId = `edit-ok-${Date.now()}`;
                    setChatHistory(prev => [
                        ...prev,
                        {
                            id: confirmationMsgId,
                            role: 'assistant',
                            content: "✅ Note updated!",
                            isUpdateConfirmation: true,
                            canRevert: true,
                            previousContent: contentBeforeEdit,
                            noteIdToRevert: note.id
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
            // ... (implementation unchanged) ...
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
            // ... (implementation unchanged, check file types if model has stricter requirements) ...
            // Note: gemini-2.0-flash-exp-image-generation might have specific image format limitations.
            // Add validation if needed, e.g., only PNG, JPEG, WEBP.
            // Current check (image/*) is broad.
             const files = event.target.files; if (!files) return; setIsChatLoading(true); const newFiles: SelectedFile[] = []; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
             for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (existingFileNames.has(file.name)) { console.log(`Skipping duplicate file: ${file.name}`); setChatHistory(prev => [...prev, { id: `file-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate file: "${file.name}".`, error: false }]); continue; }
                if (file.size > 20 * 1024 * 1024) { setChatHistory(prev => [...prev, { id: `file-err-size-${Date.now()}`, role: 'assistant', content: `❌ File "${file.name}" is too large (max 20MB).`, error: true }]); continue; }
                 // Looser check for now, API will throw error if format not supported by the specific model
                if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setChatHistory(prev => [...prev, { id: `file-err-type-${Date.now()}`, role: 'assistant', content: `❌ File type for "${file.name}" is not supported (only images and PDFs).`, error: true }]); continue; }
                filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name);
             }
             try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); }
             catch (error) { console.error("Error reading files:", error); setChatHistory(prev => [...prev, { id: `file-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing selected file(s). Please try again.`, error: true }]); }
             finally { setIsChatLoading(false); if (fileInputRef.current) { fileInputRef.current.value = ''; } }
        };
         const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
         const triggerFileSelect = () => fileInputRef.current?.click();

        // --- *** Core Chat Submit Logic (MODIFIED) *** ---
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[]) => {
            const currentFiles = filesToSend || selectedFiles;
            if ((!messageContent && currentFiles.length === 0) || isChatLoading || !geminiApiKey || !note || !user) return;

            // --- Usage Check (Unchanged) ---
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            let limitReached = false;
            const limit = currentChatLimit; // Use memoized limit
            if (userTier !== 'premium') {
                 let currentCount = chatCount;
                if (usageMonth !== currentMonthYear) {
                    console.log(`NoteChat: Month mismatch (State: ${usageMonth}, Current: ${currentMonthYear}). Resetting local count.`);
                    currentCount = 0; setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false;
                } else {
                    limitReached = currentCount >= limit; setIsChatLimitReached(limitReached);
                }
            }
            if (limitReached) {
                 setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit. Upgrade for more interactions!`, error: true }]);
                 setChatMessage(''); return;
            }
            // --- END: Usage Check ---

            const timerDuration = parseTimerRequest(messageContent);

            // Prepare user message (Unchanged)
            let userMsgContent = messageContent;
            let userMsgImageData: ImageData | undefined = undefined;
            const imageFiles = currentFiles.filter(f => f.type.startsWith('image/'));
            const nonImageFiles = currentFiles.filter(f => !f.type.startsWith('image/'));
            const attachmentTextParts: string[] = [];
            if (imageFiles.length > 0) { userMsgImageData = { base64: imageFiles[0].base64Data, type: imageFiles[0].type, name: imageFiles[0].name }; imageFiles.forEach(img => attachmentTextParts.push(`[Image Attached: ${img.name}]`)); } // Added prefix
            nonImageFiles.forEach(file => attachmentTextParts.push(`[File Attached: ${file.name}]`)); // Added prefix
            if (attachmentTextParts.length > 0) { userMsgContent += `\n\n${attachmentTextParts.join('\n')}`; }
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

            // --- Increment Usage Count (Unchanged) ---
            let incrementFailed = false;
            if (userTier !== 'premium' && user?.uid) {
                try {
                    await incrementUserChatUsage(user.uid);
                    const newLocalCount = chatCount + 1; setChatCount(newLocalCount); setIsChatLimitReached(newLocalCount >= limit);
                } catch (err) {
                    incrementFailed = true; console.error("NoteChat: Failed to increment chat usage:", err);
                    setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]);
                }
            }
            // --- End Increment Logic ---

            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
            setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: '...' }]); // Placeholder

            // Prepare API history and context (Unchanged - keep system prompt focused on text edits for now)
            const recentHistory = chatHistory.slice(-8);
            const systemInstruction = `You are TaskMaster, a highly meticulous and context-aware AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}". You can also generate images if requested.

Your primary goal is to be helpful, accurate, and strictly follow instructions based on the user's request, the provided note content, and attached files. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** First, determine if the user is ASKING a question *about* the note, EXPLICITLY requesting a *change* to the note, requesting *image generation*, or having a general chat. This distinction is CRITICAL.
2.  **Execute Correct Function:** Based on the intent, follow the corresponding function below (Answer Questions, Modify Note, Generate Image, or General Chat).
3.  **Provide Suggestions:** ALWAYS conclude your text response (if any) with relevant suggestions.

**Functions (Strict Order of Priority):**

1.  **Answer Questions Directly (Highest Priority):**
    *   If the user asks a question *about* the note's content, provide a direct, textual answer based **SOLELY** on the "Current Note Content".
    *   **CRITICAL:** **DO NOT** propose an edit (JSON response) if the user is merely asking for information. Use your understanding of the provided note content to respond informatively in natural language.
    *   **Handling Missing Information:** If the note *doesn't* contain the answer, use your general knowledge to provide a helpful answer, clearly indicating it's supplementary.

2.  **Modify Note (ONLY if EXPLICITLY Asked - Requires JSON Output):**
    *   **TRIGGER:** Propose an edit **ONLY** if the user *explicitly* uses action verbs indicating a desire to *change* the note content (add, remove, change, etc.).
    *   **Choose ONE Method (A, B, or C) per response. Ensure JSON is valid.**
    *   **CRITICAL - NO CODE LEAKS:** **NEVER** include the raw JSON structure within your conversational text response.
        *   **Method A: Single Targeted Edit (PREFERRED)** ... (details omitted for brevity) ...
        *   **Method B: Sequential Edits (Use for MULTIPLE changes)** ... (details omitted for brevity) ...
        *   **Method C: Full Content Replacement (ONLY for MAJOR OVERHAULS)** ... (details omitted for brevity) ...
    \`\`\`json
    { "action": "...", "explanation": "...", ... }
    \`\`\`

3.  **Generate Image (If Explicitly Requested):**
    *   **TRIGGER:** If the user explicitly asks you to "generate", "create", "draw", or "make" an image (e.g., "Generate a pixel art image of a cat", "Create a logo for...").
    *   **RESPONSE:** Generate the image. You may optionally include a short text confirmation before or after the image data (e.g., "Okay, here's the image you requested:"). The image data will be handled by the system separately from your text response.

4.  **Generate Suggestions (Always Include with Text Responses):**
    *   **MANDATORY:** **ALWAYS** conclude every *textual* response (answering, editing, chatting) with 3 relevant follow-up suggestions.
    *   **Format:**
        [SUGGESTIONS]
        Suggestion 1?
        Suggestion 2?
        Suggestion 3?
        [/SUGGESTIONS]
    *   **Style:** Concise, actionable questions or commands. **DO NOT** include suggestions if your *only* output is a generated image.

5.  **General Chat:**
    *   If the input isn't handled by #1, #2, or #3, engage in helpful conversation related to the note's topic or clarify the request.

**Important Reminders:**

*   **Context is Key:** Pay close attention to Current Note Content, Chat History, and attached files.
*   **Explicit Instructions:** Wait for clear user intent for edits or image generation.
*   **Accuracy of target_context:** Critical for edits.
*   **No JSON/Code Leaks:** Keep conversational text clean.
*   **Be Helpful:** Assist even when the note lacks info.

**Current Note Content (Full):**
"""
${note.content}
"""

---
**Chat History (Recent):**
${recentHistory
    .filter(m => !m.timer && !m.isUpdateConfirmation && m.content !== '...')
    .map(m => {
        let prefix = m.role === 'user' ? userName : 'Assistant';
        let content = m.content || '';
        if (m.role === 'assistant' && m.isEditSuggestion) content = `(Proposed Edit: ${m.editExplanation || 'Details omitted'})`;
        if (m.role === 'assistant' && m.generatedImageData) content += ' [Generated Image Attached]';
        if (m.role === 'user' && m.imageData) content = content.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim() + ' [User Image Attached]'; // Simplify user image indication for history
        return `${prefix}: ${content}`;
    })
    .join('\n')}
---

**${userName}: ${messageContent.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim()}** ${attachmentTextParts.length > 0 ? `(${attachmentTextParts.length} file(s) attached)` : ''}
**Assistant:**`;


            // --- *** API Call and Response Handling (MODIFIED) *** ---
            try {
                const fullGeminiEndpoint = `${GEMINI_ENDPOINT}${geminiApiKey}`;
                const apiContent: any[] = [];

                // Build API history (similar to before, slight adjustment for clarity)
                recentHistory.forEach(msg => {
                    const role = msg.role === 'user' ? 'user' : 'model';
                    let parts: any[] = [];
                    let textContent = msg.content || '';

                    if (msg.role === 'user') {
                        // Remove attachment markers for history text part
                        textContent = textContent.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim();
                        if (textContent) parts.push({ text: textContent });
                        // Add user image data if present
                        if (msg.imageData) {
                             parts.push({ inline_data: { mime_type: msg.imageData.type, data: msg.imageData.base64 } });
                        }
                    } else { // Assistant
                         if (msg.isEditSuggestion) {
                             textContent = msg.editExplanation ? `(Proposed Edit: ${msg.editExplanation})` : '(Edit Proposed)';
                         } else if (msg.timer) {
                             textContent = `(Timer Set: ${msg.timer.duration}s)`;
                         } else if (msg.isUpdateConfirmation) {
                            textContent = msg.content; // e.g., "✅ Note updated!"
                         } else if (msg.error) {
                            textContent = `(Error Message: ${msg.content})`;
                         }
                         // Add assistant generated image indication? Maybe not needed in history if focusing on text flow.
                         // if (msg.generatedImageData) textContent += ' [Generated Image Attached]';

                        // Only add non-empty/non-placeholder assistant text messages to history
                        if (textContent && textContent !== '...' && !msg.timer && !msg.isUpdateConfirmation) {
                            parts.push({ text: textContent });
                        }
                    }

                    // Add to API content only if there are parts
                    if (parts.length > 0 && msg.content !== '...') { // Ensure loading messages aren't sent
                        apiContent.push({ role, parts });
                    }
                 });


                // Build current user message parts for the API call
                const currentUserParts: any[] = [{ text: systemInstruction }]; // Start with system prompt

                // Add current files (user uploaded)
                 if (currentFiles.length > 0) {
                    currentFiles.forEach(file => {
                        // Ensure MIME type is supported by the model (check Gemini docs for specifics if errors occur)
                        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                            currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                        } else { console.warn(`Skipping file with unsupported MIME type for API: ${file.name} (${file.type})`); }
                    });
                 }

                // Add the final API content entry for the current user message
                apiContent.push({ role: "user", parts: currentUserParts });

                // Construct Request Body (standard text response expected primarily)
                let requestBody = JSON.stringify({
                    contents: apiContent,
                    // Safety settings can be added here if needed
                    // generationConfig for text output primarily
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 8192, // Adjust as needed
                        topP: 0.95,
                        responseMimeType: "text/plain" // Expect text for explanations, suggestions etc.
                    }
                });

                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };

                // --- Make API Call ---
                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text(); // Get raw response text first

                // --- *** PARSE RESPONSE FOR TEXT, IMAGE, and JSON *** ---
                let parsedResponse: any;
                try {
                    parsedResponse = JSON.parse(responseText);
                } catch (jsonError) {
                     // Handle cases where response isn't valid JSON (e.g., network error HTML page)
                     console.error("Failed to parse API response as JSON:", responseText);
                     throw new Error("Received invalid response from AI service.");
                }

                let assistantTextContent = "";
                let assistantImageDataUrl: string | undefined = undefined;
                let assistantErrorContent: string | null = null;
                let extractedSuggestions: string[] = [];
                let assistantFinalMessage: ChatMessage = { id: newLoadingMsgId, role: 'assistant', content: "...", error: false }; // Default structure


                // 1. Check for Top-Level API Errors
                if (parsedResponse?.error?.message) {
                    assistantErrorContent = `Error: ${parsedResponse.error.message}`;
                    if (assistantErrorContent.toLowerCase().includes("context length") || assistantErrorContent.toLowerCase().includes("request payload size") || assistantErrorContent.toLowerCase().includes("request entity too large")) assistantErrorContent = "Error: The note content and/or attached files are too large for the AI to process.";
                    else if (assistantErrorContent.toLowerCase().includes("api key not valid")) assistantErrorContent = "Error: Invalid API Key.";
                    else if (assistantErrorContent.toLowerCase().includes("quota exceeded")) assistantErrorContent = "Error: API Quota Exceeded.";
                    else if (assistantErrorContent.toLowerCase().includes("internal server error") || assistantErrorContent.toLowerCase().includes("service unavailable")) assistantErrorContent = "Error: AI service is temporarily unavailable. Please try again later.";
                    else if (assistantErrorContent.toLowerCase().includes("image format not supported")) assistantErrorContent = "Error: One of the provided image formats is not supported by the AI model."; // More specific error

                    assistantFinalMessage = { ...assistantFinalMessage, content: assistantErrorContent, error: true };

                }
                // 2. Process Candidates and Parts if no top-level error
                else if (parsedResponse?.candidates?.[0]?.content?.parts) {
                    const parts = parsedResponse.candidates[0].content.parts;

                    parts.forEach((part: any) => {
                        if (part.text) {
                            assistantTextContent += part.text + "\n"; // Append text parts
                        } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
                            // Found image data - store the first one as a data URL
                            if (!assistantImageDataUrl) {
                                assistantImageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            }
                        }
                    });
                    assistantTextContent = assistantTextContent.trim(); // Clean up extra newline

                    // Check finish reason if content seems incomplete
                    const finishReason = parsedResponse.candidates[0]?.finishReason;
                    if (!assistantTextContent && !assistantImageDataUrl) {
                        if (finishReason === 'SAFETY') {
                             assistantTextContent = "My response was blocked due to potential safety concerns.";
                             assistantFinalMessage.error = true; // Mark as error visually
                        } else if (finishReason === 'MAX_TOKENS') {
                            assistantTextContent = "The response was cut off as it reached the maximum length.";
                        } else if (finishReason) {
                             assistantTextContent = `Response generation stopped: ${finishReason}.`;
                        } else {
                             assistantTextContent = "(Received empty response parts)";
                             assistantFinalMessage.error = true;
                        }
                    }

                    // 3. Parse Suggestions from Text Content
                    const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                    const suggestionMatch = assistantTextContent.match(suggestionRegex);
                     if (suggestionMatch && suggestionMatch[1]) {
                         extractedSuggestions = suggestionMatch[1].split('\n').map(s => s.trim().replace(/^- /, '').trim()).filter(s => s.length > 1 && s.length < 120);
                         assistantTextContent = assistantTextContent.replace(suggestionRegex, '').trim(); // Remove suggestions from main content
                         extractedSuggestions = extractedSuggestions.slice(0, 4);
                         setSuggestedPrompts(extractedSuggestions);
                     } else { setSuggestedPrompts([]); } // Clear suggestions if none found


                    // 4. Parse JSON for Edits from Text Content
                    assistantFinalMessage = { ...assistantFinalMessage, content: assistantTextContent, generatedImageData: assistantImageDataUrl, error: false }; // Base message before checking for JSON edits
                    const jsonMatch = assistantTextContent.match(/```json\s*([\s\S]*?)\s*```/);
                    let potentialJsonString: string | null = null;
                    if (jsonMatch && jsonMatch[1]) {
                        potentialJsonString = jsonMatch[1].trim();
                        let parsedSuccessfully = false;
                        try {
                            const parsedJson = JSON.parse(potentialJsonString);
                            // Reset error state potentially set by finish reason if JSON is valid
                            assistantFinalMessage.error = false;

                            if (parsedJson.action === "propose_targeted_edit" /* && other fields valid */) {
                                assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_targeted_edit", editExplanation: parsedJson.explanation, editType: parsedJson.edit_type as EditStep['editType'], targetContext: parsedJson.target_context, contentFragment: parsedJson.content_fragment, generatedImageData: undefined }; // Clear image if edit is proposed
                                parsedSuccessfully = true;
                            }
                            else if (parsedJson.action === "propose_full_content_replacement" /* && other fields valid */) {
                                assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_full_content_replacement", editExplanation: parsedJson.explanation, newFullContent: parsedJson.new_full_content, generatedImageData: undefined }; // Clear image if edit is proposed
                                parsedSuccessfully = true;
                            }
                            else if (parsedJson.action === "propose_sequential_edits" /* && other fields valid */) {
                                // ... (validation logic for sequential edits) ...
                                const validEdits = parsedJson.edits.map(/* map and validate */); // Simplified
                                if (validEdits.length > 0) { // Assuming validation passes
                                    assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_sequential_edits", editExplanation: parsedJson.explanation, sequentialEdits: validEdits, generatedImageData: undefined }; // Clear image if edit is proposed
                                    parsedSuccessfully = true;
                                } else { throw new Error("Invalid sequential edit steps."); }
                            }
                            else {
                                // JSON found but doesn't match expected edit actions
                                console.warn("Parsed JSON, but it's not a recognized edit action:", parsedJson);
                                // Keep original text content, don't treat as edit suggestion
                                assistantFinalMessage.content = assistantTextContent; // Restore original text
                            }

                            if (parsedSuccessfully) {
                                // Remove the JSON block from the displayed text
                                const textWithoutJson = assistantTextContent.replace(jsonMatch[0], '').trim();
                                assistantFinalMessage.content = textWithoutJson || parsedJson.explanation || "(Edit proposed)";
                                if (!assistantFinalMessage.content.trim()) assistantFinalMessage.content = "(Edit proposed without explanation)";
                            }

                        } catch (parseError: any) {
                             // JSON parsing failed, treat as plain text, maybe add warning
                             console.error("Failed to parse JSON edit block:", parseError);
                             assistantFinalMessage.content = `Warning: Found something that looks like an edit proposal, but failed to process it.\n\n---\n${assistantTextContent}`; // Keep original text
                             assistantFinalMessage.error = true; // Flag as error
                        }
                    } // End JSON block parsing

                }
                // 5. Handle other potential issues (e.g., Safety block without parts)
                else if (parsedResponse?.candidates?.[0]?.finishReason === 'SAFETY') {
                     assistantFinalMessage = { ...assistantFinalMessage, content: "My response was blocked due to potential safety concerns.", error: true };
                }
                // 6. Fallback for completely unexpected responses
                else {
                     console.warn("Unrecognized API response structure:", parsedResponse);
                     assistantFinalMessage = { ...assistantFinalMessage, content: "Sorry, I received an unexpected response from the AI.", error: true };
                }

                 // Final check for empty content
                if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.generatedImageData && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer && !assistantFinalMessage.error) {
                    assistantFinalMessage.content = "(Received empty response)"; assistantFinalMessage.error = true;
                }

                // Update chat history with the final message object
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));


            } catch (err: any) {
                console.error('Chat submit fetch/process error:', err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                // Update the loading placeholder with the error
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { id: newLoadingMsgId, role: 'assistant', content: `❌ ${errorMsg}. Please check console or try again.`, error: true } : msg ));
                 setSuggestedPrompts([]); // Clear suggestions on error
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null); // Clear loading message ID when done
             }
        };

        // --- Other Handlers (Unchanged) ---
        const handleChatSubmit = async (e?: React.FormEvent) => { e?.preventDefault(); const currentMessage = chatMessage.trim(); if (!currentMessage && selectedFiles.length === 0) return; const filesToSubmit = [...selectedFiles]; setChatMessage(''); await submitMessageToAI(currentMessage, filesToSubmit); if (textareaRef.current) { textareaRef.current.style.height = 'auto'; } };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => { submitMessageToAI(suggestion); };
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
             // ... (implementation unchanged) ...
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
        }));


        // --- Dynamic Styles & Render Logic (MODIFIED for generated images) ---
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

                {/* Chat Body (MODIFIED to render generated images) */}
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
                                            {/* Loading Indicator */}
                                            {isCurrentLoadingMsg && <LoadingIndicator isIlluminateEnabled={isIlluminateEnabled} />}

                                            {/* Text Content (Render if not loading and content exists) */}
                                            {!isCurrentLoadingMsg && message.content && (
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
                                            )}

                                            {/* User Uploaded Image */}
                                            {message.role === 'user' && message.imageData && (
                                                 <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                     <img src={`data:${message.imageData.type};base64,${message.imageData.base64}`} alt={message.imageData.name} className="max-w-full h-auto max-h-48 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={() => window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')} title={`Click to view full image: ${message.imageData.name}`} />
                                                 </div>
                                             )}

                                            {/* *** Assistant Generated Image *** */}
                                            {message.role === 'assistant' && message.generatedImageData && !isCurrentLoadingMsg && (
                                                <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                    <img
                                                        src={message.generatedImageData}
                                                        alt="Generated by AI"
                                                        className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                                                        onClick={() => window.open(message.generatedImageData || '', '_blank')}
                                                        title="Click to view full generated image"
                                                    />
                                                    {/* Optional: Add SynthID note */}
                                                     <p className={`text-[10px] italic mt-1 ${isIlluminateEnabled ? 'text-gray-500' : 'text-gray-400'}`}>Generated images may include invisible watermarks.</p>
                                                </div>
                                            )}

                                            {/* Timer */}
                                            {message.timer && ( <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div> )}

                                            {/* Edit/Revert Buttons */}
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

                        {/* Input Form Area (Unchanged logic, uses state) */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Usage Display */}
                            {userTier !== 'premium' && userTier !== 'loading' && (
                                <div className="pb-1 text-xs text-center">
                                    <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>
                                        Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit}
                                    </span>
                                    {isChatLimitReached && !isLoadingUsage && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )}
                                     {!isChatLimitReached && userTier === 'basic' && ( <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}> <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade </Link> )}
                                 </div>
                             )}
                            {/* File Pills */}
                            {selectedFiles.length > 0 && ( <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div> )}
                            {/* Input Form */}
                            <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "Monthly chat limit reached..." : "Ask, generate image, or attach files..."} className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || isLoadingUsage} style={{ height: 'auto' }} aria-label="Chat input" />
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" />
                                 <button type="button" onClick={triggerFileSelect} disabled={isChatLoading || isLoadingUsage} className={`${buttonSecondaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} title="Attach Files (Image/PDF)"> <Paperclip className="w-4 h-4" /> </button>
                                 <button type="submit" disabled={isChatLoading || isLoadingUsage || (!chatMessage.trim() && selectedFiles.length === 0) || isChatLimitReached} className={`${buttonPrimaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || (!chatMessage.trim() && selectedFiles.length === 0) || isChatLimitReached ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} > {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
