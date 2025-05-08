import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
// Changed Sparkles to ImageIcon here
import { MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2, ImageIcon, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Download } from 'lucide-react';
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
    // REMOVED: getUserTier - NoteChat will use the prop
    getCurrentMonthUserChatUsage,
    incrementUserChatUsage,
    getChatLimitForTier,
} from '../lib/current-paying-user';

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
    isGeneratingImage?: boolean;
    wasImageGenerated?: boolean;
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
    userTier: UserTier; // User tier passed as a prop
}
export interface NoteChatHandle {
    sendMessage: (message: string) => void;
}

const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const GEMINI_IMAGE_GEN_MODEL = 'gemini-2.0-flash-exp-image-generation';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

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
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                if (attempt === retries - 1) { let errorText = `API Error (${response.status}) after ${retries} attempts.`; try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { } throw new Error(errorText); }
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue;
            }
            if (!response.ok) {
                let errorText = `API Error (${response.status})`;
                 try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { }
                 // Keep API-level size error handling
                 if (errorText.toLowerCase().includes("context length") || errorText.toLowerCase().includes("request payload size") || errorText.toLowerCase().includes("request entity too large")) { throw new Error("Error: The note content and/or attached files are too large for the AI to process."); }
                 if (errorText.toLowerCase().includes("unsupported user location")) { throw new Error("Error: Image generation is not available in your region."); }
                 if (errorText.toLowerCase().includes("response must contain text") && url.includes(GEMINI_IMAGE_GEN_MODEL)) { throw new Error("Error: Image generation failed. The model might require a different prompt or could not fulfill the request safely."); }
                throw new Error(errorText);
            }
            return response;
        } catch (error) {
            if (attempt === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    throw new Error(`Max retries reached for: ${url}`);
}

const parseGeminiResponse = (responseText: string, isImageGenCall: boolean): { text: string | null; imageData: ImageData | null; error: string | null; finishReason: string | null; suggestions: string[] } => {
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

            if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent = (textContent ? textContent + "\n" : "") + part.text;
                    } else if (isImageGenCall && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData?.data) {
                        imageContent = { base64: part.inlineData.data, type: part.inlineData.mimeType, name: "generated_image.png" };
                    } else if (part.inlineData) { }
                }
            }

             if (!textContent && !imageContent) {
                 if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
                 else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
                 else if (reason === 'RECITATION') { errorMessage = "Response blocked due to potential recitation issues."; }
                 else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
                 else if (!candidate.content) { errorMessage = "Received an empty response candidate."; }
             }

             if (textContent && !isImageGenCall) {
                const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                const suggestionMatch = textContent.match(suggestionRegex);
                if (suggestionMatch && suggestionMatch[1]) {
                    responseSuggestions = suggestionMatch[1].split('\n')
                        .map(s => s.trim().replace(/^- /, '').trim())
                        .filter(s => s.length > 1 && s.length < 150)
                        .slice(0, 3);
                    textContent = textContent.replace(suggestionRegex, '').trim();
                }
             }

        } else if (jsonResponse?.error?.message) {
             errorMessage = `API Error: ${jsonResponse.error.message}`;
             // Keep API-level size error handling
             if (errorMessage.toLowerCase().includes("context length") || errorMessage.toLowerCase().includes("request payload size") || errorMessage.toLowerCase().includes("request entity too large")) { errorMessage = "Error: The note content and/or attached files are too large for the AI to process."; }
             else if (errorMessage.toLowerCase().includes("api key not valid")) { errorMessage = "Error: Invalid API Key."; }
             else if (errorMessage.toLowerCase().includes("quota exceeded")) { errorMessage = "Error: API Quota Exceeded."; }
             else if (errorMessage.toLowerCase().includes("internal server error") || errorMessage.toLowerCase().includes("service unavailable")) { errorMessage = "Error: AI service is temporarily unavailable. Please try again later."; }
             else if (errorMessage.toLowerCase().includes("unsupported user location")) { errorMessage = "Error: Image generation is not available in your region."; }
             else if (errorMessage.toLowerCase().includes("response must contain text") && isImageGenCall) { errorMessage = "Error: Image generation failed. The model might require a different prompt or could not fulfill the request safely.";}
        } else { errorMessage = "Sorry, I received an empty or non-standard response format."; }

        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
             if (textContent) { if (!textContent.trim()) { textContent = "(No image generated and no text explanation provided)"; } }
             else { errorMessage = "Image generation request processed, but no image was returned."; }
        }
        if (!textContent && !imageContent && !errorMessage) { textContent = "(Received empty response content)"; }

        return { text: textContent, imageData: imageContent, error: errorMessage, finishReason: reason, suggestions: isImageGenCall ? [] : responseSuggestions };

    } catch (err) {
         if (typeof responseText === 'string') {
            if (responseText.toLowerCase().includes("api key not valid")) return { text: null, imageData: null, error: "Error: Invalid API Key.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("quota exceeded")) return { text: null, imageData: null, error: "Error: API Quota Exceeded.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("internal server error") || responseText.toLowerCase().includes("service unavailable")) return { text: null, imageData: null, error: "Error: AI service is temporarily unavailable. Please try again later.", finishReason: null, suggestions: [] };
            // Keep API-level size error handling
            if (responseText.toLowerCase().includes("context length") || responseText.toLowerCase().includes("request payload size") || responseText.toLowerCase().includes("request entity too large")) return { text: null, imageData: null, error: "Error: The note content and/or attached files are too large for the AI to process.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("unsupported user location")) return { text: null, imageData: null, error: "Error: Image generation is not available in your region.", finishReason: null, suggestions: [] };
            return { text: null, imageData: null, error: `Error: Could not process AI response. Raw: ${responseText.substring(0, 100)}...`, finishReason: null, suggestions: [] };
        }
        return { text: null, imageData: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null, suggestions: [] };
    }
};

const parseTimerRequest = (message: string): number | null => { const cleanedMessage = message.trim().toLowerCase(); const keywords = ['set timer', 'start timer', 'timer for', 'remind me in']; const timeRegex = /(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i; let M: RegExpMatchArray | null = null; const hasKeywords = keywords.some(keyword => cleanedMessage.includes(keyword)); if (hasKeywords) { M = cleanedMessage.match(timeRegex); } if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\b/i); } if (!M) { M = cleanedMessage.match(/^\s*(\d+)\s*(m|min|minute|h|hr|hour|s|sec|second)s?\s*$/i); } if (!M) return null; const A = parseInt(M[1]); const U = M[2].toLowerCase(); if (isNaN(A) || A <= 0) return null; if (U.startsWith('h')) return A * 3600; if (U.startsWith('m')) return A * 60; if (U.startsWith('s')) return A; return null; };
const isImageGenerationRequest = (message: string): boolean => { const lowerCaseMessage = message.toLowerCase().trim(); const keywords = [ "generate image of", "generate an image of", "create image of", "create an image of", "make image of", "make an image of", "draw image of", "draw an image of", "generate picture of", "generate a picture of", "create picture of", "create a picture of", "make picture of", "make a picture of", "draw picture of", "draw a picture of", "show me an image of", "show image of", "show picture of", "image of", "picture of" ]; return keywords.some(keyword => lowerCaseMessage.startsWith(keyword + " ") && lowerCaseMessage.length > (keyword.length + 1)); };
const handleDownloadImage = (imageData: ImageData) => { if (!imageData) return; const link = document.createElement('a'); link.href = `data:${imageData.type};base64,${imageData.base64}`; const fileExtension = imageData.type.split('/')[1] || 'png'; const fileName = `generated-image-${Date.now()}.${fileExtension}`; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

const LoadingIndicator = ({ isIlluminateEnabled }: { isIlluminateEnabled: boolean }) => ( <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Thinking...</span></div> );

export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, displayMode = 'overlay', userTier /* Use the userTier prop */ }: NoteChatProps, ref) => {
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
        
        // State for current authenticated user (for UID)
        const [user, setUser] = useState<User | null>(null);
        // REMOVED: const [userTier, setUserTier] = useState<UserTier>('loading');

        const [chatCount, setChatCount] = useState(0);
        const [usageMonth, setUsageMonth] = useState('');
        const [isChatLimitReached, setIsChatLimitReached] = useState(false);
        const [isLoadingUsage, setIsLoadingUsage] = useState(true); // Start as true
        const [isImageGenModeActive, setIsImageGenModeActive] = useState(false);

        // currentChatLimit now depends on the userTier prop
        const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

        const overlayBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700/60" : "bg-gray-800"; const headerBg = isIlluminateEnabled ? "bg-gray-50/90 border-gray-200" : "bg-gray-900/80 border-gray-700"; const headingColor = isIlluminateEnabled ? "text-gray-800" : "text-white"; const inputBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500"; const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200"; const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500"; const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white"; const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300"; const suggestionButtonClass = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200" : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"; const buttonDisabledClass = "opacity-50 cursor-not-allowed"; const userBubbleClass = isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'; const assistantBubbleClass = isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50'; const errorBubbleClass = isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50'; const editSuggestionBubbleClass = isIlluminateEnabled ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300'; const confirmationBubbleClass = isIlluminateEnabled ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-green-900/30 border border-green-700/50 text-green-200'; const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200"; const filePillBg = isIlluminateEnabled ? "bg-blue-100 border-blue-200" : "bg-blue-900/50 border-blue-700/50"; const filePillText = isIlluminateEnabled ? "text-blue-800" : "text-blue-300"; const downloadButtonClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-600" : "bg-gray-600 hover:bg-gray-500 text-gray-300";
        const imageGenButtonClass = isIlluminateEnabled
            ? (isImageGenModeActive ? "bg-purple-100 hover:bg-purple-200 text-purple-700" : "bg-gray-200 hover:bg-gray-300 text-gray-700")
            : (isImageGenModeActive ? "bg-purple-800/60 hover:bg-purple-700/60 text-purple-300" : "bg-gray-600 hover:bg-gray-500 text-gray-300");

        // Effect to load current user and their chat usage based on the userTier prop
        useEffect(() => {
            const currentAuthUser = auth.currentUser;
            setUser(currentAuthUser); // Update local user state

            if (!isVisible) {
                setIsLoadingUsage(false); // Reset loading state if not visible
                return;
            }
        
            // If userTier prop is still loading, or no authenticated user for usage fetching
            if (userTier === 'loading' || !currentAuthUser) {
                setIsLoadingUsage(true); // Indicate that we are waiting for tier/auth
                setChatCount(0);
                setUsageMonth('');
                // A loading tier means limit is 0, so chat is "limit reached"
                setIsChatLimitReached(userTier === 'loading'); 
                return;
            }
        
            // At this point, userTier prop is resolved (e.g., 'basic', 'pro', 'premium')
            // and currentAuthUser (for UID) exists.
            setIsLoadingUsage(true); // Begin loading actual usage data
        
            if (userTier !== 'premium') {
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                getCurrentMonthUserChatUsage(currentAuthUser.uid, currentMonthYear)
                    .then(usageData => {
                        const limit = getChatLimitForTier(userTier); // Get limit based on the resolved prop tier
                        if (usageData) {
                            setChatCount(usageData.count);
                            setUsageMonth(usageData.month);
                            setIsChatLimitReached(limit !== Infinity && usageData.count >= limit);
                        } else {
                            // No usage data for the month means count is 0
                            setChatCount(0);
                            setUsageMonth(currentMonthYear);
                            setIsChatLimitReached(limit !== Infinity && 0 >= limit);
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching chat usage:", err);
                        setChatCount(0); // Reset on error
                        setUsageMonth(new Date().toISOString().slice(0, 7));
                        const limit = getChatLimitForTier(userTier);
                        // On error, assume not reached unless limit is explicitly 0
                        setIsChatLimitReached(limit === 0 && limit !== Infinity); 
                    })
                    .finally(() => setIsLoadingUsage(false));
            } else { // Premium user
                setChatCount(0); // No tracking needed for premium
                setUsageMonth('');
                setIsChatLimitReached(false); // Premium users never reach a limit
                setIsLoadingUsage(false);
            }
        // Depend on isVisible, the userTier prop, and user's UID (from local user state)
        }, [isVisible, userTier, user?.uid]);


        useEffect(() => { if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) { const initialPrompt = `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, generate an image (click the ${isIlluminateEnabled ? '🖼️' : '🖼️'} button!), or attach/paste a file.`; setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: initialPrompt }]); setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false); initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null); setIsImageGenModeActive(false); } else if (displayMode === 'overlay' && !isVisible) { initialMessageSent.current = false; currentNoteId.current = null; setIsImageGenModeActive(false); } }, [note, isVisible, userName, displayMode, isIlluminateEnabled]); 
        useEffect(() => { if (!isMinimized || displayMode === 'inline') { setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); } }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);

        const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);
        const handleAcceptEdit = async (message: ChatMessage) => { if (!note || isChatLoading || !message.isEditSuggestion || !message.editAction) { setChatHistory(prev => [...prev, { id: `edit-app-err-${Date.now()}`, role: 'assistant', content: `❌ Error: Could not apply edit. Invalid proposal data.`, error: true }]); return; } setIsChatLoading(true); setLoadingMsgId(null); let finalContent: string | null = null; const contentBeforeEdit = note.content; try { let currentContent = contentBeforeEdit; if (message.editAction === 'propose_targeted_edit') { if (!message.editType) throw new Error("Missing edit type."); let applied = false; const { editType, targetContext, contentFragment = "" } = message; switch (editType) { case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); applied = true; break; case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; applied = true; break; case 'insert_after_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { const p = i + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); applied = true; } else throw new Error("Target context for insertion not found."); } else throw new Error("Missing target context for insert."); break; case 'replace_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + contentFragment + currentContent.slice(i + targetContext.length); applied = true; } else throw new Error("Target context for replacement not found."); } else throw new Error("Missing target context for replace."); break; case 'delete_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + currentContent.slice(i + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); applied = true; } else throw new Error("Target context for deletion not found."); } else throw new Error("Missing target context for delete."); break; default: throw new Error(`Unsupported edit type: ${editType}`); } if (applied) finalContent = currentContent; else throw new Error("Targeted edit failed."); } else if (message.editAction === 'propose_full_content_replacement') { if (typeof message.newFullContent === 'string') { finalContent = message.newFullContent; } else { throw new Error("Missing new full content for replacement."); } } else if (message.editAction === 'propose_sequential_edits') { if (!message.sequentialEdits || !Array.isArray(message.sequentialEdits) || message.sequentialEdits.length === 0) { throw new Error("Invalid sequential edit proposal: 'edits' array is missing or empty."); } let allApplied = true; for (let i = 0; i < message.sequentialEdits.length; i++) { const editStep = message.sequentialEdits[i]; const { editType, targetContext, contentFragment } = editStep; let appliedThisStep = false; const stepNumber = i + 1; switch (editType) { case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); appliedThisStep = true; break; case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; appliedThisStep = true; break; case 'insert_after_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { const p = idx + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for insertion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for insert.`); } break; case 'replace_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + contentFragment + currentContent.slice(idx + targetContext.length); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for replacement not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for replace.`); } break; case 'delete_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + currentContent.slice(idx + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); appliedThisStep = true; } else { allApplied = false; throw new Error(`Step ${stepNumber}: Target context for deletion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for delete.`); } break; default: allApplied = false; throw new Error(`Step ${stepNumber}: Unsupported edit type: ${editType}`); } if (!appliedThisStep) { allApplied = false; throw new Error(`Sequential edit step ${stepNumber} failed unexpectedly.`); } } if (allApplied) { finalContent = currentContent; } } else { throw new Error(`Unknown edit action: ${message.editAction}`); } if (finalContent !== null) { await onUpdateNoteContent(note.id, finalContent); const confirmationMsgId = `edit-ok-${Date.now()}`; setChatHistory(prev => [ ...prev, { id: confirmationMsgId, role: 'assistant', content: "✅ Note updated!", isUpdateConfirmation: true, canRevert: true, previousContent: contentBeforeEdit, noteIdToRevert: note.id } ]); } } catch (error) { const eMsg = error instanceof Error ? error.message : 'Unknown error during update.'; console.error("Edit failed:", error); setChatHistory(prev => [...prev, { id: `edit-err-${Date.now()}`, role: 'assistant', content: `❌ Update failed: ${eMsg}`, error: true }]); } finally { setIsChatLoading(false); } };
        const handleRevertEdit = async (message: ChatMessage) => { if (!message.canRevert || typeof message.previousContent !== 'string' || !message.noteIdToRevert || isChatLoading || !message.id) { setChatHistory(prev => [...prev, { id: `revert-err-state-${Date.now()}`, role: 'assistant', content: `❌ Cannot revert. Invalid state.`, error: true }]); return; } setIsChatLoading(true); setLoadingMsgId(null); const originalMessageId = message.id; try { await onUpdateNoteContent(message.noteIdToRevert, message.previousContent); setChatHistory(prev => [ ...prev.map(msg => msg.id === originalMessageId ? { ...msg, canRevert: false } : msg ), { id: `revert-ok-${Date.now()}`, role: 'assistant', content: "🔄 Change reverted." } ]); } catch (error) { const eMsg = error instanceof Error ? error.message : 'Unknown error during revert.'; console.error("Revert failed:", error); setChatHistory(prev => [...prev, { id: `revert-err-${Date.now()}`, role: 'assistant', content: `❌ Revert failed: ${eMsg}`, error: true }]); } finally { setIsChatLoading(false); } };
        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => { const files = event.target.files; if (!files) return; setIsChatLoading(true); const newFiles: SelectedFile[] = []; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name)); for (let i = 0; i < files.length; i++) { const file = files[i]; if (existingFileNames.has(file.name)) { setChatHistory(prev => [...prev, { id: `file-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate file: "${file.name}".`, error: false }]); continue; }
             if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setChatHistory(prev => [...prev, { id: `file-err-type-${Date.now()}`, role: 'assistant', content: `❌ File type for "${file.name}" is not supported (only images and PDFs).`, error: true }]); continue; } filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); } try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { console.error("File read error:", error); setChatHistory(prev => [...prev, { id: `file-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing selected file(s). Please try again.`, error: true }]); } finally { setIsChatLoading(false); if (fileInputRef.current) { fileInputRef.current.value = ''; } } };
        const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        const triggerFileSelect = () => fileInputRef.current?.click();
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => { const items = event.clipboardData?.items; if (!items) return; let imagePasted = false; const filePromises: Promise<SelectedFile>[] = []; const existingFileNames = new Set(selectedFiles.map(f => f.name)); for (let i = 0; i < items.length; i++) { const item = items[i]; if (item.kind === 'file' && item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { if (existingFileNames.has(file.name)) { setChatHistory(prev => [...prev, { id: `paste-err-dup-${Date.now()}-${file.name}`, role: 'assistant', content: `ℹ️ Skipped duplicate pasted file: "${file.name}".`, error: false }]); continue; }
             filePromises.push(readFileAsBase64(file)); existingFileNames.add(file.name); imagePasted = true; } } } if (imagePasted) { event.preventDefault(); setIsChatLoading(true); try { const results = await Promise.all(filePromises); setSelectedFiles(prev => [...prev, ...results]); } catch (error) { console.error("Paste read error:", error); setChatHistory(prev => [...prev, { id: `paste-err-read-${Date.now()}`, role: 'assistant', content: `❌ Error processing pasted image. Please try again.`, error: true }]); } finally { setIsChatLoading(false); } } }, [selectedFiles]);

        const handleToggleImageGenMode = () => {
            if (isChatLoading || isLoadingUsage) return;
            const nextState = !isImageGenModeActive;
            setIsImageGenModeActive(nextState);
            if (nextState && selectedFiles.length > 0) {
                setChatHistory(prev => [...prev, { id: `img-mode-file-warn-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation mode enabled. Attached files will be ignored.`, error: false }]);
                setSelectedFiles([]);
            }
             textareaRef.current?.focus();
        };

        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[], forceImageGenMode = false) => {
            const isUsingImageGenModel = forceImageGenMode || isImageGenModeActive;
            const currentFiles = filesToSend || selectedFiles;

            // Use userTier prop for checks
            if ((!messageContent && currentFiles.length === 0 && !isUsingImageGenModel) ||
                (!messageContent && isUsingImageGenModel) ||
                isChatLoading || !geminiApiKey || !note || !user ) return;


            // Use currentChatLimit (derived from userTier prop) and isChatLimitReached state
            if (isChatLimitReached && userTier !== 'premium') { // Double check isChatLimitReached state
                setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${currentChatLimit === Infinity ? 'monthly' : currentChatLimit} chat message limit. Upgrade for more interactions!`, error: true }]);
                setChatMessage('');
                setIsImageGenModeActive(false);
                return;
            }

            const timerDuration = !isUsingImageGenModel ? parseTimerRequest(messageContent) : null;

            if (isUsingImageGenModel && currentFiles.length > 0) {
                setChatHistory(prev => [...prev, { id: `img-gen-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation requires a text prompt only. Please remove attached files or disable image generation mode.`, error: false }]);
                return;
            }

            let userMsgContent = messageContent;
            let userMsgImageData: ImageData | undefined = undefined;
            if (!isUsingImageGenModel) {
                const imageFiles = currentFiles.filter(f => f.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    userMsgImageData = { base64: imageFiles[0].base64Data, type: imageFiles[0].type, name: imageFiles[0].name };
                }
            }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: userMsgContent, imageData: userMsgImageData };

            setSuggestedPrompts([]);
            setChatHistory(prev => [...prev, userMsg]);
            if (!filesToSend && !isUsingImageGenModel) {
                setSelectedFiles([]);
            }

            if (timerDuration) {
                const tId = `t-${Date.now()}`;
                const dTxt = timerDuration >= 3600 ? `${Math.round(timerDuration / 3600)}h` : timerDuration >= 60 ? `${Math.round(timerDuration / 60)}m` : `${timerDuration}s`;
                setChatHistory(prev => [
                    ...prev,
                    { id: `tstart-${tId}`, role: 'assistant', content: `Timer set: ${dTxt}.`, timer: { type: 'timer', duration: timerDuration, id: tId } }
                ]);
                if (messageContent.toLowerCase().startsWith('set timer') || messageContent.toLowerCase().startsWith('timer for')) {
                    setChatMessage('');
                }
                 if (isImageGenModeActive) setIsImageGenModeActive(false);
                return;
            }

            setIsChatLoading(true);

            // Use userTier prop for incrementing usage
            if (userTier !== 'premium' && user?.uid) {
                try {
                    await incrementUserChatUsage(user.uid);
                    const newLocalCount = chatCount + 1;
                    setChatCount(newLocalCount);
                    // Re-evaluate limit reached based on new count and currentChatLimit (from prop)
                    setIsChatLimitReached(currentChatLimit !== Infinity && newLocalCount >= currentChatLimit);
                } catch (err) {
                    console.error("Error incrementing usage:", err);
                    setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]);
                }
            }

            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
            const loadingContent = isUsingImageGenModel ? "Generating image..." : "...";
            setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: loadingContent, isGeneratingImage: isUsingImageGenModel }]);

            const recentHistory = chatHistory.slice(-8);

            const systemInstruction = `You are TaskMaster, a highly meticulous, context-aware, and **conversational** AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}".

Your primary goal is to be helpful, accurate, and follow instructions based on the user's request, the provided note content, attached images, **and your general knowledge when appropriate**. While your main focus is assisting with the note, you are also equipped to answer general knowledge questions and engage in broader conversation. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** First, determine if the user is ASKING a question (*about* the note/images OR a *general knowledge* question), EXPLICITLY requesting a *change* to the note text, OR EXPLICITLY requesting image generation. This distinction is CRITICAL.
2.  **Execute Correct Function:** Based the intent, follow the corresponding function below (Answer Questions, Generate Image, Modify Note, or General Chat).
3.  **Provide Suggestions (Conditional):** Conclude your response with relevant suggestions, **UNLESS** you just generated an image.

**Functions (Strict Order of Priority):**

1.  **Answer Questions (Highest Priority):**
    *   **PRIORITY 1A: Questions *About* the Note/Images:** If the user asks a question *about* the note's content or attached images (e.g., "What does the diagram show?", "Summarize this section"), provide a direct, helpful answer based primarily on the "Current Note Content" **and any relevant attached images.**
        *   **Natural Phrasing:** **CRITICAL:** Integrate information smoothly into your conversational response. **Avoid overly robotic phrasing** like "The note states..." or "According to the note...". Use more natural language (e.g., "Looking at the plan here, the first step is...", "Yes, the meeting notes mention that point.", "The image shows...", "Based on the details in the note...").
        *   **Handling Missing Note Information:** If the note or images *don't* contain the answer to a note-related question, **avoid stiff phrases like "The note doesn't mention X."** Instead, state clearly but naturally that the info isn't present *in this specific note context* (e.g., "That specific detail isn't in this note," or "Hmm, I don't see that covered here.") and *then* leverage your general knowledge to provide a helpful and accurate supplementary answer where appropriate, clearly indicating its origin (e.g., "...but generally speaking...", "...however, typical approaches include..."). Avoid fabricating information.
    *   **PRIORITY 1B: General Knowledge Questions:** If the user asks a general question *unrelated* to the current note or attached images (e.g., "Who was the first president?", "Explain photosynthesis", "Tell me about Hitler"), answer it helpfully and accurately using your broad world knowledge. Respond naturally without needing to reference the note.
    *   **CRITICAL (Both Cases):** **DO NOT** propose an edit (JSON response) if the user is merely asking for information, clarification, or summarization, whether about the note or a general topic.

2.  **Generate Image (ONLY if EXPLICITLY Asked - NO JSON Output):**
    *   **TRIGGER:** Activate **ONLY** if the user *explicitly* asks you to "generate an image", "create a picture", "draw", "show me an image of", etc., followed by a description. Use the \`gemini-2.0-flash-exp-image-generation\` model for this.
    *   **ACTION:** Use your image generation capability based on the user's description.
    *   **OUTPUT:** Your response should contain the generated image data directly (via \`inlineData\`). You MAY include a brief preceding text (e.g., "Okay, here's an image of [subject]:" or "Here's the image you requested:"). **Keep this preceding text concise.**
    *   **CRITICAL (LIMITATION): You CANNOT add the generated image *directly* into the note text.** If the user asks to "add the image to the note" or similar *after* you generate it, explain politely that you cannot embed it in the note, but they can download it. Example: "Here is the image you requested. I can't add images directly to the note text, but you can download it using the button." **Do not proactively state this limitation unless the user asks to add the generated image.**
    *   **CRITICAL:** **DO NOT** output JSON for image generation requests. The image data should be returned via the appropriate API mechanism.
    *   **FALLBACK:** If generation fails or is blocked (e.g., safety, unsupported request, unclear prompt), explain why clearly and politely IN TEXT (e.g., "I couldn't generate that image due to safety guidelines." or "Sorry, I encountered an error generating the image." or "Could you please provide a more specific description for the image?"). Do not attempt to generate an image if blocked.
    *   **CRITICAL (NO SUGGESTIONS):** **DO NOT** provide suggestions after successfully generating an image OR explaining a generation failure.

3.  **Modify Note (ONLY if EXPLICITLY Asked & Not Image Gen - Requires JSON Output):**
    *   **TRIGGER:** Propose an edit **ONLY** if the user *explicitly* uses action verbs indicating a desire to *change* the note content. Examples: "add", "remove", "delete", "change", "rewrite", "update", "replace", "insert", "correct", "fix", "append", "revise". Simple questions or statements like "This section is unclear" or "What about adding Y?" DO NOT automatically trigger an edit proposal (treat them as questions or discussion points first under Function 1). Use the standard text model (\`gemini-2.0-flash\`) for this.
    *   **Choose ONE Method (A, B, or C) per response. Ensure JSON is valid.**
    *   **CRITICAL - NO CODE LEAKS:** **NEVER** include the raw JSON structure or code fragments (like markdown tables, lists, etc.) intended for the edit directly within your conversational text response (outside the JSON block). Your user-facing chat text *before* the JSON block must be natural, friendly conversation (e.g., "Okay, I can add that list for you." or "Sure thing, here's the proposed correction:") explaining *what* you're doing conversationally. The structured data *only* goes inside the designated JSON block.

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

4.  **General Chat:**
    *   If the user's input doesn't fall into the priority categories above (Note Question, General Question, Image Gen, Note Modify), engage in helpful, natural conversation. This could involve discussing the note's topic more broadly, talking about related concepts using general knowledge, discussing note-taking strategies, clarifying the user's request, or simply having a friendly chat.
    *   **DO NOT** process timer requests (e.g., "set timer 5 min"); state that they are handled separately if asked.

5.  **Generate Suggestions (Conditional - See Rule #3 Above):**
    *   **MANDATORY (Unless Generating Image):** **ALWAYS** conclude every response (EXCEPT for image generation responses) with exactly 3 relevant follow-up suggestions.
    *   **Content:** Suggestions should be context-aware, based on the current note content, attached files, recent chat history, and the *last interaction*. They should anticipate what the *user* might want to do or ask next. If the last interaction was general chat/knowledge, suggestions can be more general or related to that topic, but ideally steer back towards the note if appropriate context exists.
    *   **Format:** Enclose them clearly at the **VERY END** of your response, each on a new line, within the tags:
[SUGGESTIONS]
Summarize the section on _______.
Add _____.
Rewrite _____.
Explain why _______ is important.
Define the term _______.
List the key points of _______.
Give an example of _______.
Compare _______ and _______.
Break down the steps of _______.
Create a mnemonic for _______.
Rephrase _______ in simpler terms.
Quiz me on _______.
Highlight the most important takeaway from _______.
Make a flashcard for _______.
Connect _______ to a real-life example.
Translate _______ into a diagram or chart.
Turn _______ into a question-and-answer format.
What are the pros and cons of _______?
What do I need to memorize from _______?
What questions might a teacher ask about _______?
Tell me more about _______.
Ask me another question about _______.
What else can you do?
[/SUGGESTIONS]
    *   **Style:** Make suggestions concise, actionable, and phrased as questions the user might ask you, or direct edit/generation commands they might give you. Mix types. **DO NOT** phrase them as things *you* can do (e.g., "I can add..." is WRONG. Use "Add..." instead). ONLY CREATE 3 SUGGESTIONS AT A TIME! Add generic suggestions like "Tell me more about..." or "What else can you do?" if note-specific ones aren't relevant after general chat.

**Important Reminders & Constraints:**

*   **Context is Key:** Pay close attention to the Current Note Content, Chat History, **and any attached Images/Files**. Responses MUST be relevant to the *current* state when discussing the note. General knowledge answers don't require note context.
*   **Image Interpretation:** You **CAN** see and interpret images/PDFs attached by the user. Integrate information from them naturally when answering questions *about the note*. **Do not claim you are only text-based.**
*   **General Knowledge:** Freely use your world knowledge to answer general questions accurately and helpfully.
*   **Explicit Intent:** Do not infer edit or image generation requests. Wait for clear commands/keywords.
*   **Image Embedding Limitation:** Reiterate that you cannot embed *generated* images into the note's text content *only if the user explicitly asks* you to add a generated image to the note after it has been generated.
*   **Suggestion Exclusion:** Remember that **no suggestions** should follow an image generation attempt (successful or failed).
*   **Follow Hierarchy:** Prioritize actions in this order: Answer Note/Image Questions > Answer General Questions > Generate Image > Modify Note > General Chat. Suggestions are appended unless excluded.
*   **Accuracy of target_context:** This is critical for edits, especially sequential ones. It MUST uniquely identify the location in the note *at the time that specific edit step is executed*. Double-check this.
*   **No JSON/Code Leaks (Except for Edits):** Keep conversational text clean. Structured data belongs ONLY in the designated JSON block for edits. Image generation does not use JSON.
*   **Conversational Tone:** Aim for a natural, helpful, collaborative tone.
*   **Be Helpful:** Assist with both note-specific tasks and general inquiries.
*   **Suggestion Format Adherence:** Strictly follow the \`[SUGGESTIONS]\`...\`[/SUGGESTIONS]\` format with exactly 3 suggestions inside, each on a new line, when suggestions are required.

**Current Note Content (Full):**
"""
${note.content}
"""

**Key Points (Reference Only):**
${note.keyPoints?.map(p => `- ${p}`).join('\n') || 'N/A'}

---
**Chat History (Recent):**
${recentHistory.filter(msg => !msg.timer && !msg.isUpdateConfirmation && msg.content !== '...' && !msg.isGeneratingImage).map(msg => { let prefix = msg.role === 'user' ? userName : 'Assistant'; let displayContent = msg.content; if (msg.isEditSuggestion) displayContent = `[Proposed Edit: ${msg.editExplanation || 'details omitted'}]`; if (msg.imageData && !msg.wasImageGenerated) displayContent += ' [User Image Attached]'; if (msg.wasImageGenerated) displayContent += ' [Generated Image Provided]'; displayContent = displayContent.replace(/```json[\s\S]*?```/g, '[Edit JSON Proposed]'); return `${prefix}: ${displayContent.trim()}`; }).join('\n')}
---

**${userName}: ${messageContent}** ${currentFiles.length > 0 && !isUsingImageGenModel ? `(Files Attached: ${currentFiles.map(f=>f.name).join(', ')})` : ''}
**Assistant:**`;
            
            try {
                const targetModel = isUsingImageGenModel ? GEMINI_IMAGE_GEN_MODEL : GEMINI_TEXT_MODEL;
                const fullGeminiEndpoint = `${GEMINI_API_BASE}${targetModel}:generateContent?key=${geminiApiKey}`;

                let generationConfig: any = {
                    temperature: isUsingImageGenModel ? 0.7 : 0.6,
                    maxOutputTokens: isUsingImageGenModel ? 1024 : 8192,
                    topP: 0.95,
                };
                if (isUsingImageGenModel) {
                    generationConfig.responseModalities = ["TEXT", "IMAGE"];
                } else {
                    generationConfig.responseMimeType = "text/plain";
                }

                const apiContent: any[] = [];
                apiContent.push({ role: "user", parts: [{ text: systemInstruction }]});
                apiContent.push({ role: "model", parts: [{ text: "Okay, I understand. I'm ready to help with the note, answer questions, or generate images based on your instructions." }]}); 

                recentHistory.forEach(msg => {
                    if (msg.role === 'user' && !msg.timer && !msg.isUpdateConfirmation && msg.content !== '...' && !msg.isGeneratingImage) {
                        const userParts: any[] = [{ text: msg.content.replace(/\[(?:Image )?Attached:.*?\]/g, '').trim() }];
                        if (msg.imageData && !isUsingImageGenModel) {
                           userParts.push({ inline_data: { mime_type: msg.imageData.type, data: msg.imageData.base64 } });
                        }
                        if (userParts[0].text || userParts.length > 1) {
                            apiContent.push({ role: "user", parts: userParts });
                        }
                    } else if (msg.role === 'assistant' && !msg.timer && !msg.isUpdateConfirmation && msg.content !== '...' && !msg.isGeneratingImage) {
                        let assistantHistoryContent = msg.content?.replace(/```json[\s\S]*?```/g, msg.isEditSuggestion ? `(I proposed an edit: ${msg.editExplanation || 'Details omitted'})` : '(I provided a response)');
                        if (msg.wasImageGenerated) { assistantHistoryContent += " [I generated an image]"; }
                        if (assistantHistoryContent?.trim()) {
                            apiContent.push({ role: "model", parts: [{ text: assistantHistoryContent.trim() }] });
                        }
                    }
                });

                const currentUserParts: any[] = [{ text: messageContent }];
                if (currentFiles.length > 0 && !isUsingImageGenModel) {
                    currentFiles.forEach(file => {
                        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                            currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                        }
                    });
                }
                if (currentUserParts[0].text || currentUserParts.length > 1) {
                     apiContent.push({ role: "user", parts: currentUserParts });
                }

                const filteredApiContent = apiContent.reduce((acc, current) => {
                    const last = acc[acc.length - 1];
                    if (last && last.role === current.role) {
                        last.parts = [...last.parts, ...current.parts];
                    } else {
                        acc.push(current);
                    }
                    return acc;
                }, [] as { role: string, parts: any[] }[]);

                let requestBody = JSON.stringify({ contents: filteredApiContent, generationConfig });
                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };

                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text();

                const parsedResult = parseGeminiResponse(responseText, isUsingImageGenModel);

                if (isUsingImageGenModel) {
                    setSuggestedPrompts([]);
                } else {
                    setSuggestedPrompts(parsedResult.suggestions);
                }

                let assistantFinalMessage: ChatMessage = {
                    id: newLoadingMsgId,
                    role: 'assistant',
                    content: parsedResult.text || (parsedResult.imageData ? "" : "(No text content received)"),
                    imageData: parsedResult.imageData,
                    error: !!parsedResult.error,
                    isEditSuggestion: false,
                    wasImageGenerated: isUsingImageGenModel && !!parsedResult.imageData && !parsedResult.error,
                };

                if (parsedResult.error) {
                    assistantFinalMessage.content = parsedResult.error;
                    assistantFinalMessage.imageData = null;
                    assistantFinalMessage.error = true;
                    assistantFinalMessage.wasImageGenerated = false;
                    setSuggestedPrompts([]);
                }

                if (!isUsingImageGenModel && !assistantFinalMessage.error && parsedResult.text) {
                    const jsonMatch = parsedResult.text.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch && jsonMatch[1]) {
                        let potentialJsonString = jsonMatch[1].trim();
                        try {
                            const parsedJson = JSON.parse(potentialJsonString);
                            let parsedSuccessfully = false;
                            assistantFinalMessage.error = false;

                            if (parsedJson.action === "propose_targeted_edit" ) {
                                if (typeof parsedJson.explanation === 'string' && typeof parsedJson.edit_type === 'string' && typeof parsedJson.content_fragment === 'string' && (typeof parsedJson.target_context === 'string' || parsedJson.target_context === null)) {
                                    Object.assign(assistantFinalMessage, { content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_targeted_edit", editExplanation: parsedJson.explanation, editType: parsedJson.edit_type as EditStep['editType'], targetContext: parsedJson.target_context, contentFragment: parsedJson.content_fragment });
                                    parsedSuccessfully = true;
                                }
                            } else if (parsedJson.action === "propose_full_content_replacement" ) {
                                if (typeof parsedJson.explanation === 'string' && typeof parsedJson.new_full_content === 'string') {
                                    Object.assign(assistantFinalMessage, { content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_full_content_replacement", editExplanation: parsedJson.explanation, newFullContent: parsedJson.new_full_content });
                                    parsedSuccessfully = true;
                                }
                            } else if (parsedJson.action === "propose_sequential_edits" ) {
                                if (typeof parsedJson.explanation === 'string' && Array.isArray(parsedJson.edits) && parsedJson.edits.length > 0) {
                                    const { valid, edits } = validateSequentialEdits(parsedJson.edits);
                                    if (valid) {
                                        Object.assign(assistantFinalMessage, { content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_sequential_edits", editExplanation: parsedJson.explanation, sequentialEdits: edits });
                                        parsedSuccessfully = true;
                                    } else {
                                        assistantFinalMessage.content = `Warning: AI proposed sequential edits, but the format was invalid. \n\n---\n${parsedResult.text}`;
                                        assistantFinalMessage.error = true;
                                    }
                                }
                            }

                            if (parsedSuccessfully) {
                                const remainingText = parsedResult.text.replace(jsonMatch[0], '').trim();
                                assistantFinalMessage.content = remainingText || parsedJson.explanation || "(Edit proposed)";
                                if (!assistantFinalMessage.content.trim()) assistantFinalMessage.content = "(Edit proposed without explanation)";
                                assistantFinalMessage.imageData = undefined;
                                assistantFinalMessage.wasImageGenerated = false;
                            } else if (!assistantFinalMessage.error) {
                                assistantFinalMessage.content = `Warning: AI proposed an edit, but the JSON structure was invalid or incomplete. \n\n---\n${parsedResult.text}`;
                                assistantFinalMessage.error = true;
                            }
                        } catch (parseError: any) {
                            console.error("JSON Parse Error:", parseError);
                            assistantFinalMessage.content = `Error: Failed to process edit (JSON Parse Error: ${parseError.message}).\n\n---\n${parsedResult.text}`;
                            assistantFinalMessage.error = true;
                            assistantFinalMessage.imageData = undefined;
                            assistantFinalMessage.wasImageGenerated = false;
                        }
                    }
                }

                if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.imageData && !assistantFinalMessage.error && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer) {
                    assistantFinalMessage.content = "(Received empty response)";
                    assistantFinalMessage.error = true;
                }

                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) {
                 console.error("API Call Failed:", err);
                 const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                 const errorFinalMessage = {
                     id: newLoadingMsgId,
                     role: 'assistant',
                     content: `❌ ${errorMsg}. Please check console or try again.`,
                     error: true,
                     isGeneratingImage: false,
                     wasImageGenerated: false
                 };
                 setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? errorFinalMessage : msg ));
                 setSuggestedPrompts([]);
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null);
             }
        };

        const validateSequentialEdits = (editsJson: any[]): { valid: boolean, edits: EditStep[] } => { const validEdits: EditStep[] = []; let sequenceIsValid = true; for (let i = 0; i < editsJson.length; i++) { const step = editsJson[i]; if (typeof step.edit_type === 'string' && typeof step.content_fragment === 'string' && (typeof step.target_context === 'string' || step.target_context === null) && ['insert_after_context', 'replace_context', 'delete_context', 'insert_at_start', 'append_at_end'].includes(step.edit_type) && (step.edit_type === 'insert_at_start' || step.edit_type === 'append_at_end' || step.target_context !== null) && !(step.edit_type === 'delete_context' && typeof step.target_context !== 'string') ) { validEdits.push({ editType: step.edit_type as EditStep['editType'], targetContext: step.target_context, contentFragment: step.content_fragment }); } else { sequenceIsValid = false; break; } } return { valid: sequenceIsValid, edits: validEdits }; };

        const handleChatSubmit = async (e?: React.FormEvent) => {
            e?.preventDefault();
            const currentMessage = chatMessage.trim();
            if ((!currentMessage && selectedFiles.length === 0 && !isImageGenModeActive) ||
                (!currentMessage && isImageGenModeActive)) {
                if(isImageGenModeActive && !currentMessage) {
                     setChatHistory(prev => [...prev, { id: `img-prompt-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Please describe the image you want to generate.`, error: false }]);
                }
                return;
            }
            const filesToSubmit = [...selectedFiles];
            setChatMessage('');
            if (!isImageGenModeActive) {
                setSelectedFiles([]);
            }
            await submitMessageToAI(currentMessage, filesToSubmit, isImageGenModeActive);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => {
            if (isImageGenModeActive) {
                 setIsImageGenModeActive(false);
            }
            submitMessageToAI(suggestion);
        };

        useImperativeHandle(ref, () => ({ sendMessage: (message: string) => {
            if (isImageGenModeActive) {
                 setIsImageGenModeActive(false);
            }
             submitMessageToAI(message);
        }, }));

        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`; if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                 <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                     <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}>
                         <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} />
                         <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span>
                     </h3>
                     {displayMode === 'overlay' && (
                         <div className="flex items-center">
                             <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}>
                                 {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />}
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close">
                                 <X className="w-4 h-4" />
                             </button>
                         </div>
                     )}
                     {displayMode === 'inline' && (
                         <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View">
                             <X className="w-4 h-4" />
                         </button>
                     )}
                 </div>

                {(!isMinimized || displayMode === 'inline') && (
                    <>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {chatHistory.map((message, index) => {
                                const isCurrentLoadingMsg = message.role === 'assistant' && isChatLoading && message.id === loadingMsgId;
                                const bubbleClass = message.role === 'user' ? userBubbleClass : message.error ? errorBubbleClass : message.isEditSuggestion ? editSuggestionBubbleClass : message.isUpdateConfirmation ? confirmationBubbleClass : assistantBubbleClass;
                                const getProseClass = (msg: ChatMessage) => { let base = `prose prose-sm max-w-none prose-p:text-xs prose-p:my-1 prose-ul:text-xs prose-ol:text-xs prose-li:my-0 prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-1.5 prose-pre:rounded`; if (isIlluminateEnabled) { if (msg.isEditSuggestion) base += ' prose-yellow text-yellow-900'; else if (msg.error) base += ' prose-red text-red-800'; else if (msg.isUpdateConfirmation) base += ' prose-green text-green-900'; else base += ' prose-gray text-gray-800'; } else { base += ' prose-invert'; if (msg.isEditSuggestion) base += ' text-yellow-200'; else if (msg.error) base += ' text-red-300'; else if (msg.isUpdateConfirmation) base += ' text-green-200'; else base += ' text-gray-200'; } return base; };
                                const proseClass = getProseClass(message);
                                const showDownloadButton = message.role === 'assistant' && message.wasImageGenerated && message.imageData && !message.error;

                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                            {isCurrentLoadingMsg ? (
                                                <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-xs">{message.isGeneratingImage ? "Generating image..." : "Thinking..."}</span>
                                                </div>
                                            ) : message.content ? (
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className={proseClass} components={{ a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" {...props} />, code: ({node, inline, className, children, ...props}) => { const match = /language-(\w+)/.exec(className || ''); const isJson = className === 'language-json'; if (inline) { return <code className={`${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-600/70 text-gray-100'} px-1 py-0.5 rounded text-[10px]`} {...props}>{children}</code>; } return <pre className={`${isIlluminateEnabled ? '!bg-gray-200/70 !text-gray-800' : '!bg-gray-600/70 !text-gray-100'} p-1.5 rounded my-1 text-[11px] overflow-x-auto`} {...props}><code>{children}</code></pre>; }, }} >{message.content}</ReactMarkdown>
                                            ) : null}

                                            {message.imageData && (
                                                 <div className={`relative group mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                     <img
                                                         src={`data:${message.imageData.type};base64,${message.imageData.base64}`}
                                                         alt={message.imageData.name || "Chat Image"}
                                                         className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                                                         onClick={(e) => { e.stopPropagation(); window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')}}
                                                         title={`Click to view full image: ${message.imageData.name || (message.wasImageGenerated ? 'Generated Image' : 'Uploaded Image')}`}
                                                     />
                                                      {showDownloadButton && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDownloadImage(message.imageData!); }}
                                                            className={`absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 ${downloadButtonClass}`}
                                                            title="Download Image"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                        </button>
                                                      )}
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

                        {suggestedPrompts.length > 0 && !isChatLoading && (
                            <div className={`px-3 py-2 border-t ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
                                <p className={`text-xs font-medium w-full mb-2 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>Suggestions:</p>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedPrompts.map((prompt, idx) => (
                                        <button key={idx} onClick={() => handleSuggestionClick(prompt)} className={`${suggestionButtonClass} text-xs px-2.5 py-1 rounded-md hover:shadow-sm transition-all duration-150 cursor-pointer`} title={prompt} > {prompt} </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Use userTier prop for UI elements */}
                             {userTier !== 'premium' && userTier !== 'loading' && ( <div className="pb-1 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit} </span> {isChatLimitReached && !isLoadingUsage && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )} {!isChatLimitReached && userTier === 'basic' && ( <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}> <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade </Link> )} </div> )}
                             {selectedFiles.length > 0 && !isImageGenModeActive && ( <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div> )}
                             <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea
                                     ref={textareaRef}
                                     rows={1}
                                     value={chatMessage}
                                     onChange={handleTextareaInput}
                                     onKeyDown={handleKeyDown}
                                     onPaste={handlePaste}
                                     placeholder={isChatLimitReached ? "Monthly chat limit reached..." : isImageGenModeActive ? "Describe the image to generate..." : "Ask, or attach file..."}
                                     className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`}
                                     disabled={isChatLoading || isChatLimitReached || isLoadingUsage}
                                     style={{ height: 'auto' }}
                                     aria-label="Chat input"
                                 />
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" disabled={isImageGenModeActive} />
                                 <button
                                     type="button"
                                     onClick={triggerFileSelect}
                                     disabled={isChatLoading || isLoadingUsage || isImageGenModeActive}
                                     className={`${buttonSecondaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isImageGenModeActive ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`}
                                     title={isImageGenModeActive ? "Image Generation mode active (no attachments)" : "Attach Files (Image/PDF)"}
                                 >
                                     <Paperclip className="w-4 h-4" />
                                 </button>
                                 <button
                                     type="button"
                                     onClick={handleToggleImageGenMode}
                                     disabled={isChatLoading || isLoadingUsage || isChatLimitReached}
                                     className={`${imageGenButtonClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isChatLimitReached ? buttonDisabledClass : 'hover:scale-105 active:scale-100'} ${isImageGenModeActive ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 dark:ring-offset-black' : ''}`}
                                     title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}
                                 >
                                     <ImageIcon className="w-4 h-4" />
                                 </button>
                                 <button
                                     type="submit"
                                     disabled={
                                         isChatLoading ||
                                         isLoadingUsage ||
                                         isChatLimitReached ||
                                         (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || 
                                         (!chatMessage.trim() && isImageGenModeActive) || 
                                         (isImageGenModeActive && selectedFiles.length > 0) 
                                     }
                                     className={`${buttonPrimaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${
                                         (isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (!chatMessage.trim() && isImageGenModeActive) || (isImageGenModeActive && selectedFiles.length > 0))
                                             ? buttonDisabledClass
                                             : 'hover:scale-105 active:scale-100'
                                     }`}
                                     title="Send message" 
                                 >
                                     {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                 </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
