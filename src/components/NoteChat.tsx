
// NoteChat.tsx
import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
    MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2,
    ImageIcon, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Download,
    PlusCircle as AddToNoteIcon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, Link } from "react-router-dom";
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Timer } from './Timer';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
    UserTier,
    getUserTier,
    getCurrentMonthUserChatUsage,
    incrementUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';

// Interfaces
export interface ImageData { base64: string; type: string; name: string; }
interface TimerMessage { type: 'timer'; duration: number; id: string; }
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
    isGeneratingImage?: boolean;
    wasImageGenerated?: boolean;
    canAddToNote?: boolean;
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
    onAddImageToNoteRequest: (imageData: ImageData) => void;
    displayMode?: 'overlay' | 'inline';
}
export interface NoteChatHandle {
    sendMessage: (message: string) => void;
    focusInput: () => void;
    addContextToInput: (text: string) => void;
}

// --- CONSTANTS ---
// IMPORTANT: Replace with your actual Imagen 3 model name
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002'; // Placeholder - MUST BE REPLACED
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const GOOGLE_AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const getApiEndpoint = (modelName: string, apiKey: string) => {
    if (modelName.startsWith('imagen')) {
         // Assumes Imagen uses AI Studio endpoint structure without key in URL
         return `${GOOGLE_AI_STUDIO_BASE}${modelName}:generateContent`;
    } else {
        // Standard Gemini endpoint with key in URL
        return `${GOOGLE_AI_STUDIO_BASE}${modelName}:generateContent?key=${apiKey}`;
    }
};

// --- Utility Functions ---
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
  if (bytes === 0) return '0 Bytes'; const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            // Retry on rate limiting or server errors
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                if (attempt === retries - 1) {
                     let errorText = `API Error (${response.status}) after ${retries} attempts.`;
                     try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { /* ignore parsing error */ }
                     throw new Error(errorText);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue;
            }
            // Don't retry on other client errors (e.g., 400, 401, 403)
            if (!response.ok) {
                let errorText = `API Error (${response.status})`;
                 try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { /* ignore parsing error */ }
                 // Keep specific error checks
                 if (errorText.toLowerCase().includes("context length") || errorText.toLowerCase().includes("request payload size") || errorText.toLowerCase().includes("request entity too large")) { throw new Error("Error: The note content and/or attached files are too large for the AI to process."); }
                 if (errorText.toLowerCase().includes("unsupported user location") || errorText.toLowerCase().includes("region")) { throw new Error("Error: This feature is not available in your region."); }
                 if (errorText.toLowerCase().includes("api key not valid")) { throw new Error("Error: Invalid API Key."); }
                 // Add other specific checks as needed
                throw new Error(errorText);
            }
            return response; // Success
        } catch (error) {
            if (attempt === retries - 1) throw error; // Throw last error
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    throw new Error(`Max retries reached for: ${url}`); // Should not be reached if handled correctly
}

// --- Parse Response ---
const parseApiResponse = (responseText: string, isImageGenCall: boolean): { text: string | null; imageData: ImageData | null; error: string | null; finishReason: string | null; suggestions: string[] } => {
    let textContent: string | null = null;
    let imageContent: ImageData | null = null;
    let errorMessage: string | null = null;
    let reason: string | null = null;
    let responseSuggestions: string[] = [];

    try {
        const jsonResponse = JSON.parse(responseText);

        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            if(jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
            return { text: null, imageData: null, error: errorMessage, finishReason: 'BLOCKED', suggestions: [] };
        }

        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;

            // Image Data Extraction (Imagen 3 Example Structure)
            if (isImageGenCall && candidate.image?.data) {
                 imageContent = { base64: candidate.image.data, type: 'image/png', name: "generated_image.png" }; // Assuming PNG
                 textContent = candidate.content?.parts?.[0]?.text || null; // Optional text
            }
            // Text/Gemini Data Extraction
            else if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                for (const part of candidate.content.parts) {
                    if (part.text) { textContent = (textContent ? textContent + "\n" : "") + part.text; }
                }
            }

             if (!textContent && !imageContent) {
                 if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
                 else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
                 else if (reason === 'RECITATION') { errorMessage = "Response blocked due to potential recitation issues."; }
                 else if (isImageGenCall && reason === 'OTHER') { errorMessage = "Image generation failed (Reason: Other)."; }
                 else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
                 else if (!candidate.content && !candidate.image) { errorMessage = "Received an empty response candidate."; }
                 else { errorMessage = "Received response with no usable text or image content."; }
             }

            if (textContent && !isImageGenCall) {
                const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                const suggestionMatch = textContent.match(suggestionRegex);
                if (suggestionMatch && suggestionMatch[1]) {
                    responseSuggestions = suggestionMatch[1].split('\n').map(s => s.trim().replace(/^- /, '').trim()).filter(s => s.length > 1 && s.length < 150).slice(0, 3);
                    textContent = textContent.replace(suggestionRegex, '').trim();
                }
             }

        } else if (jsonResponse?.error?.message) {
             errorMessage = `API Error: ${jsonResponse.error.message}`;
             // Add specific checks...
        } else {
             errorMessage = "Sorry, I received an empty or non-standard response format.";
        }

        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
             errorMessage = "Image generation request processed, but no image data was returned.";
        }
        if (!textContent && !imageContent && !errorMessage) {
             textContent = "(Received empty response content)";
        }

        return { text: textContent, imageData: imageContent, error: errorMessage, finishReason: reason, suggestions: isImageGenCall ? [] : responseSuggestions };

    } catch (err) {
         console.error("Response Parsing Error:", err);
         if (typeof responseText === 'string') {
             if (responseText.toLowerCase().includes("api key not valid")) return { text: null, imageData: null, error: "Error: Invalid API Key.", finishReason: null, suggestions: [] };
             // Add other raw text checks...
             return { text: null, imageData: null, error: `Error: Could not process AI response. Raw: ${responseText.substring(0, 100)}...`, finishReason: null, suggestions: [] };
         }
         return { text: null, imageData: null, error: "Error: Could not process AI response (Internal Error).", finishReason: null, suggestions: [] };
    }
};

// Other Helper Functions
const parseTimerRequest = (message: string): number | null => { const cleanedMessage = message.trim().toLowerCase(); const keywords = ['set timer', 'start timer', 'timer for', 'remind me in']; const timeRegex = /(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i; let M: RegExpMatchArray | null = null; const hasKeywords = keywords.some(keyword => cleanedMessage.includes(keyword)); if (hasKeywords) { M = cleanedMessage.match(timeRegex); } if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i); } if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\s*$/i); } if (!M) return null; const A = parseInt(M[1]); const U = M[2].toLowerCase(); if (isNaN(A) || A <= 0) return null; if (U.startsWith('h')) return A * 3600; if (U.startsWith('m')) return A * 60; if (U.startsWith('s')) return A; return null; };
const isImageGenerationRequest = (message: string): boolean => { const lowerCaseMessage = message.toLowerCase().trim(); const keywords = [ "generate image of", "generate an image of", "create image of", "create an image of", "make image of", "make an image of", "draw image of", "draw an image of", "generate picture of", "generate a picture of", "create picture of", "create a picture of", "make picture of", "make a picture of", "draw picture of", "draw a picture of", "show me an image of", "show image of", "show picture of", "image of", "picture of" ]; return keywords.some(keyword => lowerCaseMessage.startsWith(keyword + " ") && lowerCaseMessage.length > (keyword.length + 1)); };
const handleDownloadImage = (imageData: ImageData) => { if (!imageData) return; const link = document.createElement('a'); link.href = `data:${imageData.type};base64,${imageData.base64}`; const fileExtension = imageData.type.split('/')[1] || 'png'; const fileName = `generated-image-${Date.now()}.${fileExtension}`; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
const LoadingIndicator = ({ isIlluminateEnabled }: { isIlluminateEnabled: boolean }) => ( <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Thinking...</span></div> );

// --- Main Component (NoteChat) ---
export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, onAddImageToNoteRequest, displayMode = 'overlay' }: NoteChatProps, ref) => {
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
        const [isImageGenModeActive, setIsImageGenModeActive] = useState(false);

        const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

        // Theme Styles
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
        const downloadButtonClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-600" : "bg-gray-600 hover:bg-gray-500 text-gray-300";
        const addToNoteButtonClass = isIlluminateEnabled ? "bg-green-100 hover:bg-green-200 text-green-700" : "bg-green-800/60 hover:bg-green-700/60 text-green-300";
        const imageGenButtonClass = isIlluminateEnabled
            ? (isImageGenModeActive ? "bg-purple-100 hover:bg-purple-200 text-purple-700" : "bg-gray-200 hover:bg-gray-300 text-gray-700")
            : (isImageGenModeActive ? "bg-purple-800/60 hover:bg-purple-700/60 text-purple-300" : "bg-gray-600 hover:bg-gray-500 text-gray-300");

        // Effects
        useEffect(() => {
            if (!isVisible) return;
            setIsLoadingUsage(true);
            const currentUser = auth.currentUser;
            if (!currentUser) { setUserTier('basic'); setIsLoadingUsage(false); return; }
            setUser(currentUser); const tier = getUserTier(currentUser.email); setUserTier(tier);
            if (tier !== 'premium') {
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                getCurrentMonthUserChatUsage(currentUser.uid, currentMonthYear)
                    .then(usageData => {
                        if (usageData) { setChatCount(usageData.count); setUsageMonth(usageData.month); const limit = getChatLimitForTier(tier); setIsChatLimitReached(usageData.count >= limit); }
                        else { setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); }
                    })
                    .catch(err => { console.error("Error fetching usage:", err); setChatCount(0); setUsageMonth(new Date().toISOString().slice(0, 7)); setIsChatLimitReached(false); })
                    .finally(() => setIsLoadingUsage(false));
            } else { setChatCount(0); setUsageMonth(''); setIsChatLimitReached(false); setIsLoadingUsage(false); }
        }, [isVisible, userTier]); // Added userTier dependency

        useEffect(() => {
            if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) {
                const initialPrompt = `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, generate an image (click the ${isIlluminateEnabled ? '🖼️' : '🖼️'} button!), or attach/paste a file.`;
                setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: initialPrompt }]);
                setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false);
                initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null);
                setIsImageGenModeActive(false);
            } else if (displayMode === 'overlay' && !isVisible) {
                initialMessageSent.current = false; currentNoteId.current = null; setIsImageGenModeActive(false);
            }
        }, [note, isVisible, userName, displayMode, isIlluminateEnabled]);

        useEffect(() => {
            if (!isMinimized || displayMode === 'inline') {
                setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150);
            }
        }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);

        // Handlers
        const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);

        const handleAcceptEdit = async (message: ChatMessage) => {
            if (!note || isChatLoading || !message.isEditSuggestion || !message.editAction) { setChatHistory(prev => [...prev, { id: `edit-app-err-${Date.now()}`, role: 'assistant', content: `❌ Error: Could not apply edit. Invalid proposal data.`, error: true }]); return; }
            setIsChatLoading(true); setLoadingMsgId(null); let finalContent: string | null = null; const contentBeforeEdit = note.content;
            try {
                let currentContent = contentBeforeEdit;
                if (message.editAction === 'propose_targeted_edit') { /* ... apply targeted edit ... */ }
                else if (message.editAction === 'propose_full_content_replacement') { /* ... apply full replacement ... */ }
                else if (message.editAction === 'propose_sequential_edits') { /* ... apply sequential edits ... */ }
                else { throw new Error(`Unknown edit action: ${message.editAction}`); }

                if (finalContent !== null) {
                    await onUpdateNoteContent(note.id, finalContent);
                    const confirmationMsgId = `edit-ok-${Date.now()}`;
                    setChatHistory(prev => [ ...prev, { id: confirmationMsgId, role: 'assistant', content: "✅ Note updated!", isUpdateConfirmation: true, canRevert: true, previousContent: contentBeforeEdit, noteIdToRevert: note.id } ]);
                }
            } catch (error) { const eMsg = error instanceof Error ? error.message : 'Unknown error during update.'; console.error("Edit failed:", error); setChatHistory(prev => [...prev, { id: `edit-err-${Date.now()}`, role: 'assistant', content: `❌ Update failed: ${eMsg}`, error: true }]); }
            finally { setIsChatLoading(false); }
        };

        const handleRevertEdit = async (message: ChatMessage) => {
            if (!message.canRevert || typeof message.previousContent !== 'string' || !message.noteIdToRevert || isChatLoading || !message.id) { setChatHistory(prev => [...prev, { id: `revert-err-state-${Date.now()}`, role: 'assistant', content: `❌ Cannot revert. Invalid state.`, error: true }]); return; }
            setIsChatLoading(true); setLoadingMsgId(null); const originalMessageId = message.id;
            try {
                await onUpdateNoteContent(message.noteIdToRevert, message.previousContent);
                setChatHistory(prev => [ ...prev.map(msg => msg.id === originalMessageId ? { ...msg, canRevert: false } : msg ), { id: `revert-ok-${Date.now()}`, role: 'assistant', content: "🔄 Change reverted." } ]);
            } catch (error) { const eMsg = error instanceof Error ? error.message : 'Unknown error during revert.'; console.error("Revert failed:", error); setChatHistory(prev => [...prev, { id: `revert-err-${Date.now()}`, role: 'assistant', content: `❌ Revert failed: ${eMsg}`, error: true }]); }
            finally { setIsChatLoading(false); }
        };

        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
             const files = event.target.files; if (!files) return; setIsChatLoading(true); const newFiles: SelectedFile[] = []; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
             for (let i = 0; i < files.length; i++) { const file = files[i]; if (existingFileNames.has(file.name)) { /* Skip duplicate */ continue; } if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { /* Skip unsupported */ continue; } filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); }
             try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { console.error("File read error:", error); setChatHistory(prev => [...prev, { id: `file-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing selected file(s).`, error: true }]); } finally { setIsChatLoading(false); if (fileInputRef.current) { fileInputRef.current.value = ''; } }
        };

        const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        const triggerFileSelect = () => fileInputRef.current?.click();

        // handlePaste defined with useCallback
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const items = event.clipboardData?.items; if (!items) return; let imagePasted = false; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name));
            for (let i = 0; i < items.length; i++) { const item = items[i]; if (item.kind === 'file' && item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { if (existingFileNames.has(file.name)) { /* Skip duplicate */ continue; } filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); imagePasted = true; } } }
            if (imagePasted) { event.preventDefault(); setIsChatLoading(true); try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { console.error("Paste read error:", error); setChatHistory(prev => [...prev, { id: `paste-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing pasted image.`, error: true }]); } finally { setIsChatLoading(false); } }
        }, [selectedFiles]);

        const handleToggleImageGenMode = () => {
            if (isChatLoading || isLoadingUsage) return; const nextState = !isImageGenModeActive; setIsImageGenModeActive(nextState);
            if (nextState && selectedFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-mode-file-warn-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation mode enabled. Attached files will be ignored.`, error: false }]); setSelectedFiles([]); }
             textareaRef.current?.focus();
        };

        // Submit Message to AI
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[], forceImageGenMode = false) => {
            const isUsingImageGenModel = forceImageGenMode || isImageGenModeActive;
            const currentFiles = filesToSend || selectedFiles;

            // Validation & Usage Limit Check
            if ((!messageContent && currentFiles.length === 0 && !isUsingImageGenModel) || (!messageContent && isUsingImageGenModel) || isChatLoading || !geminiApiKey || !note || !user) return;
            // Check usage limit... (implementation omitted for brevity, use previous logic)

            // Handle Timer & Prevent Image Gen with Files
            const timerDuration = !isUsingImageGenModel ? parseTimerRequest(messageContent) : null; if (timerDuration) { /* Handle timer... */ return; }
            if (isUsingImageGenModel && currentFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-gen-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation requires a text prompt only. Remove files first.`, error: false }]); return; }

            // Prepare User Message & Update State
            let userMsgImageData: ImageData | undefined = undefined;
            if (!isUsingImageGenModel && currentFiles.length > 0) { const imageFile = currentFiles.find(f => f.type.startsWith('image/')); if (imageFile) { userMsgImageData = { base64: imageFile.base64Data, type: imageFile.type, name: imageFile.name }; } }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: messageContent, imageData: userMsgImageData };
            setSuggestedPrompts([]); setChatHistory(prev => [...prev, userMsg]);
            if (!filesToSend && !isImageGenModeActive) setSelectedFiles([]);
            setIsChatLoading(true); const newLoadingMsgId = `load-${Date.now()}`; setLoadingMsgId(newLoadingMsgId);
            const loadingContent = isUsingImageGenModel ? "Generating image..." : "..."; setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: loadingContent, isGeneratingImage: isUsingImageGenModel }]);
            // Increment usage... (implementation omitted for brevity, use previous logic)

            // Prepare API Request
            const recentHistory = chatHistory.slice(-8);
            const systemInstruction = `You are TaskMaster... [Use the FULL system instruction from the previous response, emphasizing Imagen 3 context usage and the 'Add to Note' button workflow explanation only when asked] ...`;

            const targetModel = isUsingImageGenModel ? IMAGEN_3_MODEL : GEMINI_TEXT_MODEL;
            const endpoint = getApiEndpoint(targetModel, geminiApiKey);

            let requestBodyPayload: any;
            let apiHeaders: HeadersInit = { 'Content-Type': 'application/json' };

            if (isUsingImageGenModel) {
                 requestBodyPayload = { prompt: { text: messageContent } }; // Basic Imagen 3 payload
                 // Add context if needed:
                 // requestBodyPayload.prompt.text += `\n\n[Note Context]:\n${note.content.substring(0, 1000)}`;
                 if (!endpoint.includes('?key=')) { apiHeaders['x-goog-api-key'] = geminiApiKey; }
            } else {
                 // Gemini payload setup
                 const apiContent: any[] = [];
                 apiContent.push({ role: "user", parts: [{ text: systemInstruction }]});
                 apiContent.push({ role: "model", parts: [{ text: "Okay, I understand." }]});
                 // Add filtered history...
                 recentHistory.forEach(msg => {
                     if (!msg.timer && !msg.isUpdateConfirmation && msg.content !== '...' && !msg.isGeneratingImage) {
                         let role = msg.role === 'user' ? 'user' : 'model';
                         let parts: any[] = [];
                         if (msg.content) {
                             let displayContent = msg.content.replace(/\[(?:Image )?Attached:.*?\]/g, '').trim();
                             if (msg.isEditSuggestion) displayContent = `[Proposed Edit: ${msg.editExplanation || 'details omitted'}]`.replace(/```json[\s\S]*?```/g, '');
                             parts.push({text: displayContent});
                         }
                         if (msg.imageData && role === 'user' && !isUsingImageGenModel) { // Only attach for user in text mode
                             parts.push({ inline_data: { mime_type: msg.imageData.type, data: msg.imageData.base64 } });
                         }
                         if (parts.length > 0) { apiContent.push({ role: role, parts: parts }); }
                     }
                 });
                 // Add current message + files...
                 const currentUserParts: any[] = [{ text: messageContent }];
                 if (currentFiles.length > 0) { currentFiles.forEach(file => { if (file.type.startsWith('image/') || file.type === 'application/pdf') { currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } }); } }); }
                 if (currentUserParts[0].text || currentUserParts.length > 1) { apiContent.push({ role: "user", parts: currentUserParts }); }
                 // Filter consecutive roles... (Implementation omitted, use previous logic)
                 const filteredApiContent = apiContent; // Use filtered result here
                 requestBodyPayload = { contents: filteredApiContent, generationConfig: { temperature: 0.6, maxOutputTokens: 8192 } };
            }

            const requestBody = JSON.stringify(requestBodyPayload);
            const apiOptions = { method: 'POST', headers: apiHeaders, body: requestBody };

            try {
                const response = await fetchWithRetry(endpoint, apiOptions);
                const responseText = await response.text();
                const parsedResult = parseApiResponse(responseText, isUsingImageGenModel);

                if (!isUsingImageGenModel) setSuggestedPrompts(parsedResult.suggestions); else setSuggestedPrompts([]);

                let assistantFinalMessage: ChatMessage = {
                    id: newLoadingMsgId, role: 'assistant',
                    content: parsedResult.text || (parsedResult.imageData ? "" : "(No text content received)"),
                    imageData: parsedResult.imageData, error: !!parsedResult.error,
                    isEditSuggestion: false, wasImageGenerated: isUsingImageGenModel && !!parsedResult.imageData && !parsedResult.error,
                    canAddToNote: isUsingImageGenModel && !!parsedResult.imageData && !parsedResult.error,
                };

                if (parsedResult.error) { /* Set error state */ }
                else if (!isUsingImageGenModel && parsedResult.text) {
                     const jsonMatch = parsedResult.text.match(/```json\s*([\s\S]*?)\s*```/);
                     if (jsonMatch && jsonMatch[1]) { /* Parse JSON edits... */
                        try {
                             const parsedJson = JSON.parse(jsonMatch[1].trim());
                             // Validate and assign edit properties... (use previous validation logic)
                             // ...
                             // Set isEditSuggestion = true, clear image flags, set content to explanation
                        } catch (parseError) { /* Set JSON parse error */ }
                     }
                }

                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) {
                 console.error("API Call Failed:", err);
                 const errorMsg = err instanceof Error ? err.message : 'Unknown error.';
                 setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { ...msg, role: 'assistant', content: `❌ ${errorMsg}`, error: true, isGeneratingImage: false } : msg ));
                 setSuggestedPrompts([]);
             } finally {
                 setIsChatLoading(false); setLoadingMsgId(null);
             }
        };

        // Event Handlers
        const handleChatSubmit = async (e?: React.FormEvent) => {
            e?.preventDefault(); const currentMessage = chatMessage.trim();
            if ((!currentMessage && selectedFiles.length === 0 && !isImageGenModeActive) || (!currentMessage && isImageGenModeActive)) { if(isImageGenModeActive && !currentMessage) { setChatHistory(prev => [...prev, { id: `img-prompt-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Please describe the image to generate.`, error: false }]); } return; }
            if (isImageGenModeActive && selectedFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Remove attached files before generating an image.`, error: false }]); return; }
            const filesToSubmit = [...selectedFiles]; setChatMessage('');
            if (!isImageGenModeActive) setSelectedFiles([]);
            await submitMessageToAI(currentMessage, filesToSubmit, isImageGenModeActive);
            if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
        };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => { if (isImageGenModeActive) setIsImageGenModeActive(false); setSelectedFiles([]); setChatMessage(''); submitMessageToAI(suggestion); };

        // Imperative Handle
        useImperativeHandle(ref, () => ({
             sendMessage: (message: string) => { if (isImageGenModeActive) setIsImageGenModeActive(false); setSelectedFiles([]); setChatMessage(''); submitMessageToAI(message); },
             focusInput: () => { textareaRef.current?.focus(); },
             addContextToInput: (text: string) => { const separator = "\n\n--- Highlight ---\n"; setChatMessage(prev => prev.trim() === '' ? `"${text}"` : `${prev}${separator}"${text}"`); textareaRef.current?.focus(); setTimeout(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`; } }, 0); }
        }));

        // Component Render
        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`;
        if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                {/* Header */}
                 <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                      <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}> <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span> {isImageGenModeActive && <ImageIcon className={`w-3 h-3 shrink-0 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} title="Image Generation Mode"/>} </h3>
                      <div className="flex items-center">
                         {displayMode === 'overlay' && ( <> <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}> {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />} </button> <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close"> <X className="w-4 h-4" /> </button> </> )}
                         {displayMode === 'inline' && ( <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View"> <X className="w-4 h-4" /> </button> )}
                      </div>
                 </div>

                {(!isMinimized || displayMode === 'inline') && (
                    <>
                        {/* Chat History Area */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {chatHistory.map((message, index) => {
                                const isCurrentLoadingMsg = message.role === 'assistant' && isChatLoading && message.id === loadingMsgId;
                                const bubbleClass = message.role === 'user' ? userBubbleClass : message.error ? errorBubbleClass : message.isEditSuggestion ? editSuggestionBubbleClass : message.isUpdateConfirmation ? confirmationBubbleClass : assistantBubbleClass;
                                const proseClass = `prose prose-sm max-w-none prose-p:text-xs prose-p:my-1 prose-ul:text-xs prose-ol:text-xs prose-li:my-0 prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-1.5 prose-pre:rounded ${isIlluminateEnabled ? (message.isEditSuggestion ? 'prose-yellow text-yellow-900' : message.error ? 'prose-red text-red-800' : message.isUpdateConfirmation ? 'prose-green text-green-900' : 'prose-gray text-gray-800') : 'prose-invert ' + (message.isEditSuggestion ? 'text-yellow-200' : message.error ? 'text-red-300' : message.isUpdateConfirmation ? 'text-green-200' : 'text-gray-200')}`;
                                const showAddToNoteButton = message.canAddToNote && message.imageData && !message.error;
                                const showDownloadButton = message.imageData && !message.error;

                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                            {isCurrentLoadingMsg ? ( <LoadingIndicator isIlluminateEnabled={isIlluminateEnabled}/> ) : null}
                                            {message.content ? ( <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className={proseClass} components={{ a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" {...props} />, code: ({node, inline, className, children, ...props}) => { const match = /language-(\w+)/.exec(className || ''); const isJson = className === 'language-json'; if (inline) { return <code className={`${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-600/70 text-gray-100'} px-1 py-0.5 rounded text-[10px]`} {...props}>{children}</code>; } return <pre className={`${isIlluminateEnabled ? '!bg-gray-200/70 !text-gray-800' : '!bg-gray-600/70 !text-gray-100'} p-1.5 rounded my-1 text-[11px] overflow-x-auto`} {...props}><code>{children}</code></pre>; }, }} >{message.content}</ReactMarkdown> ) : null}
                                            {message.imageData && (
                                                 <div className={`relative group mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                     <img src={`data:${message.imageData.type};base64,${message.imageData.base64}`} alt={message.imageData.name || "Chat Image"} className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')}} title={`Click to view full image: ${message.imageData.name || (message.wasImageGenerated ? 'Generated Image' : 'Uploaded Image')}`} />
                                                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                                                          {showAddToNoteButton && ( <button onClick={(e) => { e.stopPropagation(); onAddImageToNoteRequest(message.imageData!); }} className={`p-1 rounded ${addToNoteButtonClass}`} title="Add Image to Note"> <AddToNoteIcon className="w-3.5 h-3.5" /> </button> )}
                                                          {showDownloadButton && ( <button onClick={(e) => { e.stopPropagation(); handleDownloadImage(message.imageData!); }} className={`p-1 rounded ${downloadButtonClass}`} title="Download Image"> <Download className="w-3.5 h-3.5" /> </button> )}
                                                      </div>
                                                 </div>
                                            )}
                                            {message.timer && ( <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div> )}
                                            {message.isEditSuggestion && message.editAction && !isChatLoading && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-yellow-300/50 dark:border-yellow-700/50"> <button onClick={() => handleAcceptEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-yellow-100' : 'hover:bg-yellow-700/50'} `} disabled={isChatLoading} > <Check className="w-3.5 h-3.5" /> Apply Update{message.editAction === 'propose_sequential_edits' && message.sequentialEdits && message.sequentialEdits.length > 1 ? ` (${message.sequentialEdits.length} steps)` : ''} </button> </div> )}
                                            {message.isUpdateConfirmation && message.canRevert && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-green-300/50 dark:border-green-700/50"> <button onClick={() => handleRevertEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-600'}`} disabled={isChatLoading} title="Revert this change" > <RefreshCcw className="w-3.5 h-3.5" /> Revert </button> </div> )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} className="h-0"></div>
                        </div>

                         {/* Suggestions Area */}
                        {suggestedPrompts.length > 0 && !isChatLoading && (
                            <div className={`px-3 py-2 border-t ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
                                <p className={`text-xs font-medium w-full mb-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Suggestions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedPrompts.map((prompt, idx) => ( <button key={idx} onClick={() => handleSuggestionClick(prompt)} className={`${suggestionButtonClass} text-xs px-2.5 py-1 rounded-md hover:shadow-sm transition-all duration-150 cursor-pointer`} title={prompt} > {prompt} </button> ))}
                                </div>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Usage Indicator */}
                             {userTier !== 'premium' && userTier !== 'loading' && ( <div className="pb-1 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit} </span> {isChatLimitReached && !isLoadingUsage && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )} {!isChatLimitReached && userTier === 'basic' && ( <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}> <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade </Link> )} </div> )}
                             {/* Selected Files Pills */}
                             {selectedFiles.length > 0 && !isImageGenModeActive && ( <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div> )}
                             {/* Form */}
                             <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "Monthly chat limit reached..." : isImageGenModeActive ? "Describe image (uses note context)..." : "Ask, edit note, or attach file..."} className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || isLoadingUsage} style={{ height: 'auto' }} aria-label="Chat input" />
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" disabled={isImageGenModeActive} />
                                 <button type="button" onClick={triggerFileSelect} disabled={isChatLoading || isLoadingUsage || isImageGenModeActive} className={`${buttonSecondaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isImageGenModeActive ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} title={isImageGenModeActive ? "Image Generation mode active (no attachments)" : "Attach Files (Image/PDF)"}> <Paperclip className="w-4 h-4" /> </button>
                                 <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isLoadingUsage || isChatLimitReached} className={`${imageGenButtonClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isChatLimitReached ? buttonDisabledClass : 'hover:scale-105 active:scale-100'} ${isImageGenModeActive ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 dark:ring-offset-black' : ''}`} title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}> <ImageIcon className="w-4 h-4" /> </button>
                                 <button type="submit" disabled={ isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (!chatMessage.trim() && isImageGenModeActive) || (isImageGenModeActive && selectedFiles.length > 0) } className={`${buttonPrimaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${ (isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (!chatMessage.trim() && isImageGenModeActive) || (isImageGenModeActive && selectedFiles.length > 0)) ? buttonDisabledClass : 'hover:scale-105 active:scale-100' }`} title="Send message"> {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} </button>
                             </form>
                         </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
