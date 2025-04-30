import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2, Sparkles, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, Link } from "react-router-dom";
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Timer } from './Timer';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

// --- IMPORT Centralized Usage/Tier Functions ---
import {
    UserTier,
    getUserTier,
    getCurrentMonthUserChatUsage,
    incrementUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';

// --- Types ---
interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface ImageData { base64: string; type: string; name: string; } // User uploaded image data
interface EditStep { editType: 'insert_after_context' | 'replace_context' | 'delete_context' | 'insert_at_start' | 'append_at_end'; targetContext: string | null; contentFragment: string; }

interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string; // Primarily for text, explanations, errors
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

// --- Helper Functions ---
const readFileAsBase64 = (file: File): Promise<SelectedFile> => { /* ... (implementation unchanged) ... */
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
function formatBytes(bytes: number, decimals = 2): string { /* ... (implementation unchanged) ... */
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> { /* ... (implementation unchanged) ... */
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
                 if (response.status === 0) { // Network error
                     throw new Error("Network error. Please check your connection.");
                 }
                 if (response.status === 400 && errorText.toLowerCase().includes("image format")) {
                    throw new Error("Error: Unsupported image format provided to the AI.");
                 }
                throw new Error(errorText);
            }
            return response;
        } catch (error) {
             // Log the error before retrying or throwing
             console.error(`Attempt ${attempt + 1} fetch error:`, error);

             // Check if it's a network error or CORS issue which might not be retried effectively
             if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                 if (attempt === retries - 1) throw new Error("Network error. Please check your connection and API endpoint/key validity.");
             } else {
                 if (attempt === retries - 1) throw error; // Throw original error if max retries reached
             }
             await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    throw new Error(`Max retries reached for: ${url}`);
 }

// *** USING IMAGE GENERATION MODEL ENDPOINT ***
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=`;

const parseTimerRequest = (message: string): number | null => { /* ... (implementation unchanged) ... */
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

// --- Loading Indicator Component ---
const LoadingIndicator = ({ isIlluminateEnabled }: { isIlluminateEnabled: boolean }) => ( /* ... (implementation unchanged) ... */
    <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Thinking...</span>
    </div>
);

// --- Component ---
export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, displayMode = 'overlay' }: NoteChatProps, ref) => {
        // --- State variables ---
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
        const [user, setUser] = useState<User | null>(null);
        const [userTier, setUserTier] = useState<UserTier>('loading');
        const [chatCount, setChatCount] = useState(0);
        const [usageMonth, setUsageMonth] = useState('');
        const [isChatLimitReached, setIsChatLimitReached] = useState(false);
        const [isLoadingUsage, setIsLoadingUsage] = useState(true);

        const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

        // --- Theme Styles ---
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
        useEffect(() => { /* ... (Load user, tier, usage - unchanged) ... */
             if (!isVisible) return;
             setIsLoadingUsage(true);
             const currentUser = auth.currentUser;
             if (!currentUser) { console.error("NoteChat: No authenticated user."); setUserTier('basic'); setIsLoadingUsage(false); return; }
             setUser(currentUser);
             const tier = getUserTier(currentUser.email);
             setUserTier(tier);
             if (tier !== 'premium') {
                 const currentMonthYear = new Date().toISOString().slice(0, 7);
                 getCurrentMonthUserChatUsage(currentUser.uid, currentMonthYear)
                     .then(usageData => {
                         if (usageData) {
                             setChatCount(usageData.count); setUsageMonth(usageData.month);
                             setIsChatLimitReached(usageData.count >= getChatLimitForTier(tier));
                         } else {
                             setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false);
                         }
                     })
                     .catch(err => { console.error("NoteChat: Error loading usage:", err); setChatCount(0); setUsageMonth(new Date().toISOString().slice(0, 7)); setIsChatLimitReached(false); })
                     .finally(() => setIsLoadingUsage(false));
             } else {
                 setChatCount(0); setUsageMonth(''); setIsChatLimitReached(false); setIsLoadingUsage(false);
             }
         }, [isVisible]);
        useEffect(() => { /* ... (Initial message setup - unchanged) ... */
             if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) {
                 setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, generate an image, or attach/paste a file.` }]);
                 setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false); initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null);
             } else if (displayMode === 'overlay' && !isVisible) { initialMessageSent.current = false; currentNoteId.current = null; }
         }, [note, isVisible, userName, displayMode]);
        useEffect(() => { /* ... (Scroll to bottom - unchanged) ... */
             if (!isMinimized || displayMode === 'inline') { setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); }
         }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);

        // --- Handlers ---
        const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);
        const handleAcceptEdit = async (message: ChatMessage) => { /* ... (implementation unchanged) ... */
             if (!note || isChatLoading || !message.isEditSuggestion || !message.editAction) { console.error("Invalid edit proposal:", message); setChatHistory(prev => [...prev, { id: `edit-app-err-${Date.now()}`, role: 'assistant', content: `❌ Error: Could not apply edit. Invalid proposal data.`, error: true }]); return; }
             setIsChatLoading(true); setLoadingMsgId(null);
             let finalContent: string | null = null; const contentBeforeEdit = note.content;
             try {
                 let currentContent = contentBeforeEdit;
                 if (message.editAction === 'propose_targeted_edit') {
                    if (!message.editType) throw new Error("Missing edit type."); let applied = false; const { editType, targetContext, contentFragment = "" } = message;
                    switch (editType) {
                        case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); applied = true; break;
                        case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; applied = true; break;
                        case 'insert_after_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { const p = i + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); applied = true; } else throw new Error("Target context for insertion not found."); } else throw new Error("Missing target context for insert."); break;
                        case 'replace_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + contentFragment + currentContent.slice(i + targetContext.length); applied = true; } else throw new Error("Target context for replacement not found."); } else throw new Error("Missing target context for replace."); break;
                        case 'delete_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + currentContent.slice(i + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); applied = true; } else throw new Error("Target context for deletion not found."); } else throw new Error("Missing target context for delete."); break;
                        default: throw new Error(`Unsupported edit type: ${editType}`);
                    }
                    if (applied) finalContent = currentContent; else throw new Error("Targeted edit failed.");
                 } else if (message.editAction === 'propose_full_content_replacement') {
                     if (typeof message.newFullContent === 'string') { finalContent = message.newFullContent; } else { throw new Error("Missing new full content for replacement."); }
                 } else if (message.editAction === 'propose_sequential_edits') {
                     if (!message.sequentialEdits || !Array.isArray(message.sequentialEdits) || message.sequentialEdits.length === 0) throw new Error("Invalid sequential edit proposal.");
                     let allApplied = true;
                     for (let i = 0; i < message.sequentialEdits.length; i++) {
                        const editStep = message.sequentialEdits[i]; const { editType, targetContext, contentFragment } = editStep; let appliedThisStep = false; const stepNumber = i + 1;
                        switch (editType) {
                            case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); appliedThisStep = true; break;
                            case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; appliedThisStep = true; break;
                            case 'insert_after_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { const p = idx + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for insertion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for insert.`); } break;
                            case 'replace_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + contentFragment + currentContent.slice(idx + targetContext.length); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for replacement not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for replace.`); } break;
                            case 'delete_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + currentContent.slice(idx + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for deletion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for delete.`); } break;
                            default: allApplied = false; throw new Error(`Step ${stepNumber}: Unsupported edit type: ${editType}`);
                        }
                        if (!appliedThisStep) { allApplied = false; throw new Error(`Sequential edit step ${stepNumber} failed unexpectedly.`); }
                     }
                     if (allApplied) { finalContent = currentContent; }
                 } else { throw new Error(`Unknown edit action: ${message.editAction}`); }
                 if (finalContent !== null) { await onUpdateNoteContent(note.id, finalContent); const confirmationMsgId = `edit-ok-${Date.now()}`; setChatHistory(prev => [...prev, { id: confirmationMsgId, role: 'assistant', content: "✅ Note updated!", isUpdateConfirmation: true, canRevert: true, previousContent: contentBeforeEdit, noteIdToRevert: note.id }]); }
             } catch (error) { console.error("Error applying edit:", error); const eMsg = error instanceof Error ? error.message : 'Unknown error during update.'; setChatHistory(prev => [...prev, { id: `edit-err-${Date.now()}`, role: 'assistant', content: `❌ Update failed: ${eMsg}`, error: true }]); }
             finally { setIsChatLoading(false); }
          };
        const handleRevertEdit = async (message: ChatMessage) => { /* ... (implementation unchanged) ... */
             if (!message.canRevert || typeof message.previousContent !== 'string' || !message.noteIdToRevert || isChatLoading || !message.id) { console.error("Cannot revert. Invalid state:", message); setChatHistory(prev => [...prev, { id: `revert-err-state-${Date.now()}`, role: 'assistant', content: `❌ Cannot revert. Invalid state.`, error: true }]); return; }
             setIsChatLoading(true); setLoadingMsgId(null); const originalMessageId = message.id;
             try { await onUpdateNoteContent(message.noteIdToRevert, message.previousContent); setChatHistory(prev => [...prev.map(msg => msg.id === originalMessageId ? { ...msg, canRevert: false } : msg), { id: `revert-ok-${Date.now()}`, role: 'assistant', content: "🔄 Change reverted." }]); }
             catch (error) { console.error("Error reverting edit:", error); const eMsg = error instanceof Error ? error.message : 'Unknown error during revert.'; setChatHistory(prev => [...prev, { id: `revert-err-${Date.now()}`, role: 'assistant', content: `❌ Revert failed: ${eMsg}`, error: true }]); }
             finally { setIsChatLoading(false); }
         };
        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... (implementation unchanged) ... */
             const files = event.target.files; if (!files) return; setIsChatLoading(true); const newFiles: SelectedFile[] = []; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
             for (let i = 0; i < files.length; i++) { const file = files[i]; if (existingFileNames.has(file.name)) { setChatHistory(prev => [...prev, { id: `file-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate file: "${file.name}".`, error: false }]); continue; } if (file.size > 20 * 1024 * 1024) { setChatHistory(prev => [...prev, { id: `file-err-size-${Date.now()}`, role: 'assistant', content: `❌ File "${file.name}" is too large (max 20MB).`, error: true }]); continue; } if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setChatHistory(prev => [...prev, { id: `file-err-type-${Date.now()}`, role: 'assistant', content: `❌ File type for "${file.name}" is not supported (only images and PDFs).`, error: true }]); continue; } filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); }
             try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); }
             catch (error) { console.error("Error reading files:", error); setChatHistory(prev => [...prev, { id: `file-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing selected file(s). Please try again.`, error: true }]); }
             finally { setIsChatLoading(false); if (fileInputRef.current) { fileInputRef.current.value = ''; } }
         };
        const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        const triggerFileSelect = () => fileInputRef.current?.click();

        // --- Core Chat Submit Logic ---
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[]) => {
            const currentFiles = filesToSend || selectedFiles;
            if ((!messageContent && currentFiles.length === 0) || isChatLoading || !geminiApiKey || !note || !user) return;

            // --- Usage Check (unchanged) ---
            const currentMonthYear = new Date().toISOString().slice(0, 7); let limitReached = false; const limit = currentChatLimit;
            if (userTier !== 'premium') { let currentCount = chatCount; if (usageMonth !== currentMonthYear) { currentCount = 0; setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; } else { limitReached = currentCount >= limit; setIsChatLimitReached(limitReached); } }
            if (limitReached) { setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit. Upgrade for more interactions!`, error: true }]); setChatMessage(''); return; }

            const timerDuration = parseTimerRequest(messageContent);

            // --- Prepare user message (unchanged) ---
            let userMsgContent = messageContent; let userMsgImageData: ImageData | undefined = undefined; const imageFiles = currentFiles.filter(f => f.type.startsWith('image/')); const nonImageFiles = currentFiles.filter(f => !f.type.startsWith('image/')); const attachmentTextParts: string[] = [];
            if (imageFiles.length > 0) { userMsgImageData = { base64: imageFiles[0].base64Data, type: imageFiles[0].type, name: imageFiles[0].name }; imageFiles.forEach(img => attachmentTextParts.push(`[Image Attached: ${img.name}]`)); }
            nonImageFiles.forEach(file => attachmentTextParts.push(`[File Attached: ${file.name}]`));
            if (attachmentTextParts.length > 0) { userMsgContent += `\n\n${attachmentTextParts.join('\n')}`; }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: userMsgContent, imageData: userMsgImageData };
            setChatHistory(prev => [...prev, userMsg]);
            setSuggestedPrompts([]); if (!filesToSend) { setSelectedFiles([]); }

            if (timerDuration) { /* ... (handle timer - unchanged) ... */
                 const tId = `t-${Date.now()}`; const dTxt = timerDuration >= 3600 ? `${Math.round(timerDuration / 3600)}h` : timerDuration >= 60 ? `${Math.round(timerDuration / 60)}m` : `${timerDuration}s`;
                setChatHistory(prev => [ ...prev, { id: `tstart-${tId}`, role: 'assistant', content: `Timer set: ${dTxt}.`, timer: { type: 'timer', duration: timerDuration, id: tId } } ]);
                if (messageContent.toLowerCase().startsWith('set timer') || messageContent.toLowerCase().startsWith('timer for')) { setChatMessage(''); }
                return;
            }

            setIsChatLoading(true);

            // --- Increment Usage Count (unchanged) ---
            if (userTier !== 'premium' && user?.uid) { try { await incrementUserChatUsage(user.uid); const newLocalCount = chatCount + 1; setChatCount(newLocalCount); setIsChatLimitReached(newLocalCount >= limit); } catch (err) { console.error("NoteChat: Failed to increment chat usage:", err); setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]); } }

            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
            setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: '...' }]);

            // --- Prepare API history and context (system prompt unchanged) ---
            const recentHistory = chatHistory.slice(-8);
            const systemInstruction = `You are TaskMaster, a highly meticulous and context-aware AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}". You can also generate images if requested. Your primary goal is to be helpful, accurate, and strictly follow instructions based on the user's request, the provided note content, and attached files. Adhere to the following functions and rules with **absolute precision**, in this order of priority: 1. Analyze User Intent (Question, Edit, Image Gen, Chat). 2. Execute Correct Function (Answer, Modify Note (JSON), Generate Image, General Chat). 3. Provide Suggestions (ALWAYS conclude *text* responses with [SUGGESTIONS]...[/SUGGESTIONS]). **Functions:** 1. **Answer Questions Directly:** Respond textually based **SOLELY** on "Current Note Content". DO NOT propose edits for questions. Use general knowledge if note lacks info, stating so. 2. **Modify Note (ONLY if EXPLICITLY Asked - JSON Output):** Trigger ONLY on action verbs (add, remove, change, etc.). Use ONE method (Targeted, Sequential, Full Replace). **NO JSON LEAKS** in conversational text. \`\`\`json { "action": "...", ... } \`\`\` 3. **Generate Image (If Explicitly Requested):** Trigger on "generate", "create", "draw", "make". Generate the image. Optional short text confirmation allowed. Image data handled separately. 4. **Generate Suggestions:** **ALWAYS** conclude textual responses with 3 relevant suggestions in [SUGGESTIONS]...[/SUGGESTIONS] format. DO NOT include if *only* outputting an image. 5. **General Chat:** Handle other cases. **Reminders:** Context is key. Explicit instructions needed for edits/images. Target_context must be accurate. **Current Note Content:**\n"""\n${note.content}\n"""\n**Chat History (Recent):**\n${recentHistory.filter(m => !m.timer && !m.isUpdateConfirmation && m.content !== '...').map(m => { let prefix = m.role === 'user' ? userName : 'Assistant'; let content = m.content || ''; if (m.role === 'assistant' && m.isEditSuggestion) content = `(Proposed Edit: ${m.editExplanation || 'Details omitted'})`; if (m.role === 'assistant' && m.generatedImageData) content += ' [Generated Image Attached]'; if (m.role === 'user' && m.imageData) content = content.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim() + ' [User Image Attached]'; return `${prefix}: ${content}`; }).join('\n')}\n**${userName}: ${messageContent.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim()}** ${attachmentTextParts.length > 0 ? `(${attachmentTextParts.length} file(s) attached)` : ''}\n**Assistant:**`;

            // --- API Call and Response Handling ---
            try {
                const fullGeminiEndpoint = `${GEMINI_ENDPOINT}${geminiApiKey}`;
                const apiContent: any[] = [];

                // Build API history
                 recentHistory.forEach(msg => { /* ... (unchanged history building logic) ... */
                     const role = msg.role === 'user' ? 'user' : 'model';
                     let parts: any[] = [];
                     let textContent = msg.content || '';

                     if (msg.role === 'user') {
                         textContent = textContent.replace(/\[(?:Image|File) Attached:.*?\]/g, '').trim();
                         if (textContent) parts.push({ text: textContent });
                         if (msg.imageData) { parts.push({ inline_data: { mime_type: msg.imageData.type, data: msg.imageData.base64 } }); }
                     } else { // Assistant
                         if (msg.isEditSuggestion) { textContent = `(Proposed Edit: ${msg.editExplanation || 'Details omitted'})`; }
                         else if (msg.timer) { textContent = `(Timer Set: ${msg.timer.duration}s)`; }
                         else if (msg.isUpdateConfirmation || msg.error) { textContent = msg.content; }
                         else if (msg.generatedImageData) { textContent += ' [Generated Image Attached]'; } // Indicate image in history text
                         // Only add non-empty/non-placeholder/non-functional assistant text
                         if (textContent && textContent !== '...' && !msg.timer && !msg.isUpdateConfirmation && !msg.isEditSuggestion) { parts.push({ text: textContent }); }
                     }
                     if (parts.length > 0 && msg.content !== '...') { apiContent.push({ role, parts }); }
                 });

                // Build current user message parts
                const currentUserParts: any[] = [{ text: systemInstruction }]; // Start with system prompt text
                 if (currentFiles.length > 0) { /* ... (add files - unchanged) ... */
                     currentFiles.forEach(file => {
                         if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                             currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                         } else { console.warn(`Skipping file with unsupported MIME type for API: ${file.name} (${file.type})`); }
                     });
                 }
                apiContent.push({ role: "user", parts: currentUserParts });

                // *** Construct Request Body WITHOUT explicit responseMimeType ***
                let requestBody = JSON.stringify({
                    contents: apiContent,
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 8192,
                        topP: 0.95,
                        // responseMimeType: "text/plain" // <-- REMOVED THIS LINE
                    }
                });

                console.log("--- Sending API Request Body ---"); // Log before sending
                console.log(requestBody);
                console.log("-------------------------------");


                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };

                // Make API Call
                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text();

                // Parse Response (using the same logic as before, including logging)
                let parsedResponse: any;
                try { /* ... (parse JSON response) ... */
                     parsedResponse = JSON.parse(responseText);
                     console.log("--- Raw API Response ---");
                     console.log(JSON.stringify(parsedResponse, null, 2));
                     console.log("--------------------------");
                 } catch (jsonError) { /* ... (handle JSON parse error) ... */
                      console.error("Failed to parse API response as JSON:", responseText);
                      throw new Error("Received invalid response from AI service.");
                 }

                let assistantTextContent = "";
                let assistantImageDataUrl: string | undefined = undefined;
                let assistantErrorContent: string | null = null;
                let extractedSuggestions: string[] = [];
                let assistantFinalMessage: ChatMessage = { id: newLoadingMsgId, role: 'assistant', content: "", error: false };

                // Process API response parts (same logic as before)
                if (parsedResponse?.error?.message) { /* ... (handle top-level error) ... */
                     console.error("API Error Received:", parsedResponse.error.message);
                     assistantErrorContent = `Error: ${parsedResponse.error.message}`;
                     if (assistantErrorContent.toLowerCase().includes("context length") || assistantErrorContent.toLowerCase().includes("request payload size") || assistantErrorContent.toLowerCase().includes("request entity too large")) assistantErrorContent = "Error: The note content and/or attached files are too large for the AI to process.";
                     else if (assistantErrorContent.toLowerCase().includes("api key not valid")) assistantErrorContent = "Error: Invalid API Key.";
                     else if (assistantErrorContent.toLowerCase().includes("quota exceeded")) assistantErrorContent = "Error: API Quota Exceeded.";
                     else if (assistantErrorContent.toLowerCase().includes("internal server error") || assistantErrorContent.toLowerCase().includes("service unavailable")) assistantErrorContent = "Error: AI service is temporarily unavailable. Please try again later.";
                     else if (assistantErrorContent.toLowerCase().includes("image format not supported")) assistantErrorContent = "Error: One of the provided image formats is not supported by the AI model.";
                     assistantFinalMessage = { ...assistantFinalMessage, content: assistantErrorContent, error: true };
                 } else if (parsedResponse?.candidates?.[0]?.content?.parts && Array.isArray(parsedResponse.candidates[0].content.parts)) { /* ... (process parts for text/image) ... */
                     const parts = parsedResponse.candidates[0].content.parts;
                     console.log(`Processing ${parts.length} response part(s)...`);
                     parts.forEach((part: any, index: number) => {
                         console.log(`Part ${index}:`, part);
                         if (part.text) {
                             console.log(`Part ${index} is text.`);
                             assistantTextContent += part.text + "\n";
                         } else if (part.inlineData && part.inlineData.data && part.inlineData.mimeType?.startsWith('image/')) {
                             console.log(`Part ${index} is image data (${part.inlineData.mimeType}).`);
                             if (!assistantImageDataUrl) {
                                 assistantImageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                                 console.log("Constructed Image Data URL (first 100 chars):", assistantImageDataUrl.substring(0, 100) + "...");
                             } else { console.warn("Multiple images found, using the first."); }
                         } else { console.log(`Part ${index} is neither text nor recognized image data.`); }
                     });
                     assistantTextContent = assistantTextContent.trim();
                     const finishReason = parsedResponse.candidates[0]?.finishReason;
                     console.log("Finish Reason:", finishReason);
                     if (!assistantTextContent && !assistantImageDataUrl && !assistantFinalMessage.error) { /* ... (handle empty content based on finish reason) ... */
                          if (finishReason === 'STOP') { assistantTextContent = "(Received empty response)"; }
                          else if (finishReason === 'SAFETY') { assistantTextContent = "My response was blocked due to potential safety concerns."; assistantFinalMessage.error = true; }
                          else if (finishReason === 'MAX_TOKENS') { assistantTextContent = "The response was cut off as it reached the maximum length."; }
                          else if (finishReason) { assistantTextContent = `Response generation stopped unexpectedly: ${finishReason}.`; assistantFinalMessage.error = true; }
                          else { assistantTextContent = "(Received empty or unprocessable response)"; assistantFinalMessage.error = true; }
                     }
                     if (assistantTextContent) { /* ... (parse suggestions) ... */
                         const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                         const suggestionMatch = assistantTextContent.match(suggestionRegex);
                         if (suggestionMatch && suggestionMatch[1]) {
                             extractedSuggestions = suggestionMatch[1].split('\n').map(s => s.trim().replace(/^- /, '').trim()).filter(s => s.length > 1 && s.length < 120);
                             assistantTextContent = assistantTextContent.replace(suggestionRegex, '').trim();
                             extractedSuggestions = extractedSuggestions.slice(0, 4);
                             setSuggestedPrompts(extractedSuggestions); console.log("Extracted Suggestions:", extractedSuggestions);
                         } else { setSuggestedPrompts([]); }
                     } else { setSuggestedPrompts([]); }
                     assistantFinalMessage = { ...assistantFinalMessage, content: assistantTextContent, generatedImageData: assistantImageDataUrl };
                     if (assistantTextContent && !assistantImageDataUrl) { /* ... (parse JSON for edits) ... */
                         const jsonMatch = assistantTextContent.match(/```json\s*([\s\S]*?)\s*```/);
                         if (jsonMatch && jsonMatch[1]) {
                             const potentialJsonString = jsonMatch[1].trim(); console.log("Potential JSON block found:", potentialJsonString); let parsedSuccessfully = false;
                             try {
                                 const parsedJson = JSON.parse(potentialJsonString);
                                 if (parsedJson.action === "propose_targeted_edit" /* && fields valid */) { console.log("Parsed targeted edit proposal."); assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_targeted_edit", editExplanation: parsedJson.explanation, editType: parsedJson.edit_type, targetContext: parsedJson.target_context, contentFragment: parsedJson.content_fragment, generatedImageData: undefined }; parsedSuccessfully = true; }
                                 else if (parsedJson.action === "propose_full_content_replacement" /* && fields valid */) { console.log("Parsed full replacement proposal."); assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_full_content_replacement", editExplanation: parsedJson.explanation, newFullContent: parsedJson.new_full_content, generatedImageData: undefined }; parsedSuccessfully = true; }
                                 else if (parsedJson.action === "propose_sequential_edits" /* && fields valid */) { console.log("Parsed sequential edit proposal."); const validEdits = parsedJson.edits; assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_sequential_edits", editExplanation: parsedJson.explanation, sequentialEdits: validEdits, generatedImageData: undefined }; parsedSuccessfully = true; }
                                 else { console.log("JSON found, but not a recognized edit action."); }
                                 if (parsedSuccessfully) { const textWithoutJson = assistantTextContent.replace(jsonMatch[0], '').trim(); assistantFinalMessage.content = textWithoutJson || parsedJson.explanation || "(Edit proposed)"; if (!assistantFinalMessage.content.trim()) assistantFinalMessage.content = "(Edit proposed without explanation)"; }
                             } catch (parseError: any) { console.error("Failed to parse JSON edit block:", parseError); assistantFinalMessage.content = `Warning: Found something that looks like an edit proposal, but failed to process it.\n\n---\n${assistantTextContent}`; assistantFinalMessage.error = true; }
                         }
                     }
                 } else if (parsedResponse?.candidates?.[0]?.finishReason === 'SAFETY') { /* ... (handle safety block) ... */
                      console.warn("Response blocked due to safety concerns (no content parts).");
                      assistantFinalMessage = { ...assistantFinalMessage, content: "My response was blocked due to potential safety concerns.", error: true };
                 } else { /* ... (handle unexpected response) ... */
                      console.warn("Unrecognized API response structure:", parsedResponse);
                      assistantFinalMessage = { ...assistantFinalMessage, content: "Sorry, I received an unexpected response from the AI.", error: true };
                 }
                 if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.generatedImageData && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer && !assistantFinalMessage.error) { /* ... (final check for empty content) ... */
                     console.warn("Final assistant message has no text, image, edit, timer, or error. Setting default empty message.");
                     assistantFinalMessage.content = "(Received empty response)"; assistantFinalMessage.error = true;
                 }

                console.log("--- Final Assistant Message Object ---"); // Log final object
                console.log(assistantFinalMessage);
                console.log("--------------------------------------");

                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) { /* ... (handle fetch/process error) ... */
                 console.error('Chat submit fetch/process error:', err);
                 const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                 setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { id: newLoadingMsgId, role: 'assistant', content: `❌ ${errorMsg}. Please check console or try again.`, error: true } : msg ));
                 setSuggestedPrompts([]);
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null);
             }
        };

        // --- Other Handlers ---
        const handleChatSubmit = async (e?: React.FormEvent) => { e?.preventDefault(); const currentMessage = chatMessage.trim(); if (!currentMessage && selectedFiles.length === 0) return; const filesToSubmit = [...selectedFiles]; setChatMessage(''); await submitMessageToAI(currentMessage, filesToSubmit); if (textareaRef.current) { textareaRef.current.style.height = 'auto'; } };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => { submitMessageToAI(suggestion); };
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => { /* ... (implementation unchanged) ... */
            const items = event.clipboardData?.items; if (!items) return; let imagePasted = false; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
            for (let i = 0; i < items.length; i++) { const item = items[i]; if (item.kind === 'file' && item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { if (existingFileNames.has(file.name)) { setChatHistory(prev => [...prev, { id: `paste-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate pasted file: "${file.name}".`, error: false }]); continue; } if (file.size > 20 * 1024 * 1024) { setChatHistory(prev => [...prev, { id: `paste-err-size-${Date.now()}`, role: 'assistant', content: `❌ Pasted image "${file.name}" is too large (max 20MB).`, error: true }]); continue; } filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); imagePasted = true; } } }
            if (imagePasted) { event.preventDefault(); setIsChatLoading(true); try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { console.error("Error processing pasted image:", error); setChatHistory(prev => [...prev, { id: `paste-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing pasted image. Please try again.`, error: true }]); } finally { setIsChatLoading(false); } }
        }, [selectedFiles]);
        useImperativeHandle(ref, () => ({ sendMessage: (message: string) => { submitMessageToAI(message); }, }));

        // --- Render Logic ---
        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`;
        if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                {/* Header (unchanged) */}
                <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                    <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}> <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span> </h3>
                    {displayMode === 'overlay' && ( <div className="flex items-center"> <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}> {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />} </button> <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close"> <X className="w-4 h-4" /> </button> </div> )}
                    {displayMode === 'inline' && ( <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View"> <X className="w-4 h-4" /> </button> )}
                </div>

                {/* Chat Body (unchanged) */}
                {(!isMinimized || displayMode === 'inline') && (
                    <>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {chatHistory.map((message, index) => { /* ... (map logic unchanged) ... */
                                const isCurrentLoadingMsg = message.role === 'assistant' && isChatLoading && message.id === loadingMsgId;
                                const bubbleClass = message.role === 'user' ? userBubbleClass : message.error ? errorBubbleClass : message.isEditSuggestion ? editSuggestionBubbleClass : message.isUpdateConfirmation ? confirmationBubbleClass : assistantBubbleClass;
                                const proseClass = `prose prose-sm max-w-none ${ isIlluminateEnabled ? (message.isEditSuggestion ? 'prose-yellow text-yellow-900' : (message.error ? 'prose-red text-red-800' : (message.isUpdateConfirmation ? 'prose-green text-green-900' : 'prose-gray text-gray-800'))) : (message.isEditSuggestion ? 'prose-invert text-yellow-200' : (message.error ? 'prose-invert text-red-300' : (message.isUpdateConfirmation ? 'prose-invert text-green-200' : 'prose-invert text-gray-200'))) } prose-p:text-xs prose-p:my-1 prose-ul:text-xs prose-ol:text-xs prose-li:my-0 prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-1.5 prose-pre:rounded`;
                                const hasGeneratedImage = message.role === 'assistant' && typeof message.generatedImageData === 'string' && message.generatedImageData.startsWith('data:image/');
                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                            {isCurrentLoadingMsg && <LoadingIndicator isIlluminateEnabled={isIlluminateEnabled} />}
                                            {!isCurrentLoadingMsg && message.content && ( /* ... Markdown rendering ... */
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className={proseClass} components={{ a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" {...props} />, code: ({node, inline, className, children, ...props}) => { const match = /language-(\w+)/.exec(className || ''); const isJson = className === 'language-json'; if (inline) { return <code className={`${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-600/70 text-gray-100'} px-1 py-0.5 rounded text-[10px]`} {...props}>{children}</code>; } return <pre className={`${isIlluminateEnabled ? '!bg-gray-200/70 !text-gray-800' : '!bg-gray-600/70 !text-gray-100'} p-1.5 rounded my-1 text-[11px] overflow-x-auto`} {...props}><code>{children}</code></pre>; }, }}>{message.content}</ReactMarkdown>
                                            )}
                                            {message.role === 'user' && message.imageData && ( /* ... User image rendering ... */
                                                 <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}> <img src={`data:${message.imageData.type};base64,${message.imageData.base64}`} alt={message.imageData.name} className="max-w-full h-auto max-h-48 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={() => window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')} title={`Click to view full image: ${message.imageData.name}`} /> </div>
                                             )}
                                            {hasGeneratedImage && !isCurrentLoadingMsg && ( /* ... Generated image rendering ... */
                                                <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}> <img src={message.generatedImageData} alt="Generated by AI" className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={() => window.open(message.generatedImageData || '', '_blank')} title="Click to view full generated image" /> <p className={`text-[10px] italic mt-1 ${isIlluminateEnabled ? 'text-gray-500' : 'text-gray-400'}`}>Generated images may include invisible watermarks.</p> </div>
                                            )}
                                            {message.timer && ( /* ... Timer rendering ... */
                                                 <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div>
                                             )}
                                            {message.isEditSuggestion && message.editAction && !isChatLoading && !message.error && ( /* ... Apply button ... */
                                                 <div className="mt-2 border-t pt-1.5 flex justify-end border-yellow-300/50 dark:border-yellow-700/50"> <button onClick={() => handleAcceptEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-yellow-100' : 'hover:bg-yellow-700/50'} `} disabled={isChatLoading} > <Check className="w-3.5 h-3.5" /> Apply Update{message.editAction === 'propose_sequential_edits' && message.sequentialEdits && message.sequentialEdits.length > 1 ? ` (${message.sequentialEdits.length} steps)` : ''} </button> </div>
                                             )}
                                            {message.isUpdateConfirmation && message.canRevert && !message.error && ( /* ... Revert button ... */
                                                 <div className="mt-2 border-t pt-1.5 flex justify-end border-green-300/50 dark:border-green-700/50"> <button onClick={() => handleRevertEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-600'}`} disabled={isChatLoading} title="Revert this change" > <RefreshCcw className="w-3.5 h-3.5" /> Revert </button> </div>
                                             )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} className="h-0"></div>
                        </div>

                        {/* Suggestions Area (unchanged) */}
                        {suggestedPrompts.length > 0 && !isChatLoading && ( <div className={`px-3 py-2 border-t ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}> <p className={`text-xs font-medium w-full mb-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Suggestions:</p> <div className="flex flex-wrap gap-2"> {suggestedPrompts.map((prompt, idx) => ( <button key={idx} onClick={() => handleSuggestionClick(prompt)} className={`${suggestionButtonClass} text-xs px-2.5 py-1 rounded-md hover:shadow-sm transition-all duration-150 cursor-pointer`} title={prompt} > {prompt} </button> ))} </div> </div> )}

                        {/* Input Form Area (unchanged) */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {userTier !== 'premium' && userTier !== 'loading' && ( /* ... usage display ... */
                                  <div className="pb-1 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit} </span> {isChatLimitReached && !isLoadingUsage && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )} {!isChatLimitReached && userTier === 'basic' && ( <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}> <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade </Link> )} </div>
                              )}
                             {selectedFiles.length > 0 && ( /* ... file pills ... */
                                  <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div>
                              )}
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
