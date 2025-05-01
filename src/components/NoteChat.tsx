// NoteChat.tsx
// --- IMPORTS (remain mostly the same, add necessary types if needed) ---
import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2, Sparkles, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Image as ImageIcon } from 'lucide-react'; // Added ImageIcon
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

// --- Types (Add generatedImageData maybe? Or reuse imageData carefully) ---
interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface ImageData { base64: string; type: string; name: string; } // Reused for both uploaded and generated
interface EditStep { editType: 'insert_after_context' | 'replace_context' | 'delete_context' | 'insert_at_start' | 'append_at_end'; targetContext: string | null; contentFragment: string; }
interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;        // Text content
    imageData?: ImageData;  // For user-uploaded OR AI-generated images
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
    isGeneratingImage?: boolean; // Flag to indicate image generation context
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
    // focusInput: () => void;
}

// --- Constants ---
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const GEMINI_IMAGE_GEN_MODEL = 'gemini-2.0-flash-exp-image-generation';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// --- Helper Functions (Unchanged - readFileAsBase64, formatBytes, fetchWithRetry, parseTimerRequest) ---
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
    // ... (implementation unchanged, maybe log URL for debugging)
    console.log("API Fetch:", url, JSON.parse(options.body as string)?.generationConfig); // Log URL and config
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            // ... (rest of retry logic unchanged)
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
                 if (errorText.toLowerCase().includes("unsupported user location")) {
                     throw new Error("Error: Image generation is not available in your region.");
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

// --- MODIFIED Response Parsing: Now handles potential image data ---
// Note: This replaces the old extractCandidateText as direct parsing is needed
const parseGeminiResponse = (responseText: string, isImageGenCall: boolean): { text: string | null; imageData: ImageData | null; error: string | null; finishReason: string | null; suggestions: string[] } => {
    let textContent: string | null = null;
    let imageContent: ImageData | null = null;
    let errorMessage: string | null = null;
    let reason: string | null = null;
    let responseSuggestions: string[] = [];

    try {
        const jsonResponse = JSON.parse(responseText);
        console.log("Raw API Response JSON:", jsonResponse); // Debugging

        // Check for Prompt Feedback (Blocking) first
        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            if(jsonResponse.promptFeedback.safetyRatings) {
                errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`;
            }
            return { text: null, imageData: null, error: errorMessage, finishReason: 'BLOCKED', suggestions: [] };
        }

        // Check for Candidates
        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;

            if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                // Iterate through parts to find text and image data
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent = (textContent ? textContent + "\n" : "") + part.text; // Append text parts
                    } else if (isImageGenCall && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData?.data) {
                        // Only process image data if we requested it
                        imageContent = {
                            base64: part.inlineData.data,
                            type: part.inlineData.mimeType,
                            name: "generated_image.png" // Assign a default name
                        };
                    } else if (part.inlineData) {
                         console.warn("Received unexpected inlineData type:", part.inlineData.mimeType);
                    }
                }
            }

            // Handle finish reasons like SAFETY or MAX_TOKENS if no primary content found
            if (!textContent && !imageContent) {
                if (reason === 'SAFETY') {
                    errorMessage = "Response blocked due to safety concerns.";
                    if (candidate.safetyRatings) {
                       errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`;
                    }
                } else if (reason === 'MAX_TOKENS') {
                    errorMessage = "The response was cut off as it reached the maximum length.";
                } else if (reason) {
                     errorMessage = `Response generation stopped: ${reason}.`;
                } else if (!candidate.content) {
                     errorMessage = "Received an empty response candidate.";
                }
            }

            // Suggestion Parsing (applied to text content if it exists)
            if (textContent) {
                const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
                const suggestionMatch = textContent.match(suggestionRegex);
                if (suggestionMatch && suggestionMatch[1]) {
                    responseSuggestions = suggestionMatch[1].split('\n')
                        .map(s => s.trim().replace(/^- /, '').trim())
                        .filter(s => s.length > 1 && s.length < 120)
                        .slice(0, 4);
                    // Remove suggestions from the main text content
                    textContent = textContent.replace(suggestionRegex, '').trim();
                }
            }

        } else if (jsonResponse?.error?.message) {
            // Handle top-level API errors
            errorMessage = `API Error: ${jsonResponse.error.message}`;
            if (errorMessage.toLowerCase().includes("context length") || errorMessage.toLowerCase().includes("request payload size") || errorMessage.toLowerCase().includes("request entity too large")) {
                 errorMessage = "Error: The note content and/or attached files are too large for the AI to process.";
            } else if (errorMessage.toLowerCase().includes("api key not valid")) {
                errorMessage = "Error: Invalid API Key.";
            } else if (errorMessage.toLowerCase().includes("quota exceeded")) {
                errorMessage = "Error: API Quota Exceeded.";
            } else if (errorMessage.toLowerCase().includes("internal server error") || errorMessage.toLowerCase().includes("service unavailable")) {
                errorMessage = "Error: AI service is temporarily unavailable. Please try again later.";
            } else if (errorMessage.toLowerCase().includes("unsupported user location")) {
                errorMessage = "Error: Image generation is not available in your region.";
            }
        } else {
            errorMessage = "Sorry, I received an empty or non-standard response format.";
            console.warn("Unparseable response:", responseText);
        }

        // If we requested an image but didn't get one, and got no other error, report that.
        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
            if (textContent) {
                // Model might have just explained why it couldn't generate.
                // No need for an additional error message here unless textContent is also empty.
                 if (!textContent.trim()) {
                    textContent = "(No image generated and no text explanation provided)";
                 }
            } else {
                errorMessage = "Image generation request processed, but no image was returned.";
            }
        }

        // Ensure some content exists if no error
        if (!textContent && !imageContent && !errorMessage) {
           textContent = "(Received empty response content)";
        }


        return { text: textContent, imageData: imageContent, error: errorMessage, finishReason: reason, suggestions: responseSuggestions };

    } catch (err) {
        console.error('Error parsing Gemini response:', err, 'Raw Text:', responseText);
         // Handle non-JSON errors or generic failures
         if (typeof responseText === 'string') {
            if (responseText.toLowerCase().includes("api key not valid")) return { text: null, imageData: null, error: "Error: Invalid API Key.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("quota exceeded")) return { text: null, imageData: null, error: "Error: API Quota Exceeded.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("internal server error") || responseText.toLowerCase().includes("service unavailable")) return { text: null, imageData: null, error: "Error: AI service is temporarily unavailable. Please try again later.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("context length") || responseText.toLowerCase().includes("request payload size") || responseText.toLowerCase().includes("request entity too large")) return { text: null, imageData: null, error: "Error: The note content and/or attached files are too large for the AI to process.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("unsupported user location")) return { text: null, imageData: null, error: "Error: Image generation is not available in your region.", finishReason: null, suggestions: [] };
            // Return the raw text as an error if it's not JSON and not a known text error
            return { text: null, imageData: null, error: `Error: Could not process AI response. Raw: ${responseText.substring(0, 100)}...`, finishReason: null, suggestions: [] };
        }
        return { text: null, imageData: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null, suggestions: [] };
    }
};


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

// --- NEW Helper Function: Check for Image Generation Intent ---
const isImageGenerationRequest = (message: string): boolean => {
    const lowerCaseMessage = message.toLowerCase().trim();
    const keywords = [
        "generate image", "generate an image", "create image", "create an image",
        "make image", "make an image", "draw image", "draw an image",
        "generate picture", "generate a picture", "create picture", "create a picture",
        "make picture", "make a picture", "draw picture", "draw a picture",
        "show me an image of", "show image of", "show picture of", "image of", "picture of"
    ];
    // Check if the message starts with any of the keywords
    return keywords.some(keyword => lowerCaseMessage.startsWith(keyword + " "));
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
        // ... (State variables remain largely the same) ...
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
        const [userTier, setUserTier] = useState<UserTier>('loading');
        const [chatCount, setChatCount] = useState(0);
        const [usageMonth, setUsageMonth] = useState('');
        const [isChatLimitReached, setIsChatLimitReached] = useState(false);
        const [isLoadingUsage, setIsLoadingUsage] = useState(true);

        // --- Memoized Chat Limit (Unchanged) ---
        const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

        // --- Theme Styles (Unchanged) ---
        const overlayBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700/60" : "bg-gray-800";
        const headerBg = isIlluminateEnabled ? "bg-gray-50/90 border-gray-200" : "bg-gray-900/80 border-gray-700";
        // ... (rest of theme styles unchanged) ...
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

        // --- Effects (Unchanged: User/Tier/Usage Loading, Initial Message, Scroll) ---
        useEffect(() => {
            // ... (user/tier/usage loading logic unchanged) ...
            if (!isVisible) return;
            setIsLoadingUsage(true);
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.error("NoteChat: No authenticated user found when becoming visible.");
                setUserTier('basic'); setIsLoadingUsage(false); return;
            }
            setUser(currentUser);
            const tier = getUserTier(currentUser.email); setUserTier(tier);
            if (tier !== 'premium') {
                const currentMonthYear = new Date().toISOString().slice(0, 7);
                getCurrentMonthUserChatUsage(currentUser.uid, currentMonthYear)
                    .then(usageData => {
                        if (usageData) {
                            setChatCount(usageData.count); setUsageMonth(usageData.month);
                            const limit = getChatLimitForTier(tier); setIsChatLimitReached(usageData.count >= limit);
                            console.log(`NoteChat: Loaded chat usage for ${currentMonthYear}: ${usageData.count}`);
                        } else {
                            console.log(`NoteChat: No chat usage data for ${currentUser.uid} for ${currentMonthYear}. Resetting local count.`);
                            setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false);
                        }
                    }) .catch(err => { console.error("NoteChat: Error loading chat usage data:", err); setChatCount(0); setUsageMonth(new Date().toISOString().slice(0, 7)); setIsChatLimitReached(false); }) .finally(() => setIsLoadingUsage(false));
            } else { setChatCount(0); setUsageMonth(''); setIsChatLimitReached(false); setIsLoadingUsage(false); console.log("NoteChat: Premium user detected, usage check skipped."); }
        }, [isVisible]);

        useEffect(() => {
            // ... (initial message logic unchanged) ...
             if (note && (note.id !== currentNoteId.current || (displayMode === 'overlay' && isVisible && !initialMessageSent.current))) {
                 const initialPrompt = `Hi ${userName}! Ask about **"${note.title}"**, ask me to change it, generate an image, or attach/paste a file.`;
                 setChatHistory([{ id: `init-${Date.now()}`, role: 'assistant', content: initialPrompt }]);
                 setChatMessage(''); setSelectedFiles([]); setSuggestedPrompts([]); setIsChatLoading(false); initialMessageSent.current = true; currentNoteId.current = note.id; setLoadingMsgId(null);
            } else if (displayMode === 'overlay' && !isVisible) { initialMessageSent.current = false; currentNoteId.current = null; }
        }, [note, isVisible, userName, displayMode]);

        useEffect(() => { if (!isMinimized || displayMode === 'inline') { setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, 150); } }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);


        // --- Handlers (Unchanged: Timer, Edit Accept/Revert, File Select/Remove/Trigger, Paste) ---
        const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);
        const handleAcceptEdit = async (message: ChatMessage) => { /* ... (implementation unchanged) ... */
             if (!note || isChatLoading || !message.isEditSuggestion || !message.editAction) { console.error("Invalid edit proposal:", message); setChatHistory(prev => [...prev, { id: `edit-app-err-${Date.now()}`, role: 'assistant', content: `❌ Error: Could not apply edit. Invalid proposal data.`, error: true }]); return; }
             setIsChatLoading(true); setLoadingMsgId(null); let finalContent: string | null = null; const contentBeforeEdit = note.content;
             try {
                 let currentContent = contentBeforeEdit;
                 if (message.editAction === 'propose_targeted_edit') { /* ... */
                      if (!message.editType) throw new Error("Missing edit type."); let applied = false; const { editType, targetContext, contentFragment = "" } = message;
                      switch (editType) {
                          case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); applied = true; break;
                          case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; applied = true; break;
                          case 'insert_after_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { const p = i + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); applied = true; } else throw new Error("Target context for insertion not found."); } else throw new Error("Missing target context for insert."); break;
                          case 'replace_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + contentFragment + currentContent.slice(i + targetContext.length); applied = true; } else throw new Error("Target context for replacement not found."); } else throw new Error("Missing target context for replace."); break;
                          case 'delete_context': if (targetContext) { const i = currentContent.indexOf(targetContext); if (i !== -1) { currentContent = currentContent.slice(0, i) + currentContent.slice(i + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); applied = true; } else throw new Error("Target context for deletion not found."); } else throw new Error("Missing target context for delete."); break;
                          default: throw new Error(`Unsupported edit type: ${editType}`);
                     } if (applied) finalContent = currentContent; else throw new Error("Targeted edit failed.");
                 } else if (message.editAction === 'propose_full_content_replacement') { /* ... */
                      if (typeof message.newFullContent === 'string') { finalContent = message.newFullContent; } else { throw new Error("Missing new full content for replacement."); }
                 } else if (message.editAction === 'propose_sequential_edits') { /* ... */
                      if (!message.sequentialEdits || !Array.isArray(message.sequentialEdits) || message.sequentialEdits.length === 0) { throw new Error("Invalid sequential edit proposal: 'edits' array is missing or empty."); }
                      let allApplied = true;
                      for (let i = 0; i < message.sequentialEdits.length; i++) {
                          const editStep = message.sequentialEdits[i]; const { editType, targetContext, contentFragment } = editStep; let appliedThisStep = false; const stepNumber = i + 1;
                          switch (editType) {
                              case 'insert_at_start': currentContent = contentFragment + (currentContent ? "\n" + currentContent : ""); appliedThisStep = true; break;
                              case 'append_at_end': currentContent = (currentContent ? currentContent + "\n" : "") + contentFragment; appliedThisStep = true; break;
                              case 'insert_after_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { const p = idx + targetContext.length; const x = currentContent.endsWith('\n') || currentContent.slice(p).startsWith('\n') || p === 0 ? "" : "\n"; currentContent = currentContent.slice(0, p) + x + contentFragment + currentContent.slice(p); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for insertion not found.`); throw new Error(`Step ${stepNumber}: Target context for insertion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for insert.`); } break;
                              case 'replace_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + contentFragment + currentContent.slice(idx + targetContext.length); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for replacement not found.`); throw new Error(`Step ${stepNumber}: Target context for replacement not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for replace.`); } break;
                              case 'delete_context': if (targetContext) { const idx = currentContent.indexOf(targetContext); if (idx !== -1) { currentContent = currentContent.slice(0, idx) + currentContent.slice(idx + targetContext.length); currentContent = currentContent.replace(/\n\n+/g, '\n').trim(); appliedThisStep = true; } else { allApplied = false; console.error(`Sequential edit step ${stepNumber} failed: Target context for deletion not found.`); throw new Error(`Step ${stepNumber}: Target context for deletion not found.`); } } else { allApplied = false; throw new Error(`Step ${stepNumber}: Missing target context for delete.`); } break;
                              default: allApplied = false; throw new Error(`Step ${stepNumber}: Unsupported edit type: ${editType}`);
                          } if (!appliedThisStep) { allApplied = false; throw new Error(`Sequential edit step ${stepNumber} failed unexpectedly.`); }
                      } if (allApplied) { finalContent = currentContent; }
                 } else { throw new Error(`Unknown edit action: ${message.editAction}`); }
                 if (finalContent !== null) { await onUpdateNoteContent(note.id, finalContent); const confirmationMsgId = `edit-ok-${Date.now()}`; setChatHistory(prev => [ ...prev, { id: confirmationMsgId, role: 'assistant', content: "✅ Note updated!", isUpdateConfirmation: true, canRevert: true, previousContent: contentBeforeEdit, noteIdToRevert: note.id } ]); }
             } catch (error) { console.error("Error applying edit:", error); const eMsg = error instanceof Error ? error.message : 'Unknown error during update.'; setChatHistory(prev => [...prev, { id: `edit-err-${Date.now()}`, role: 'assistant', content: `❌ Update failed: ${eMsg}`, error: true }]); } finally { setIsChatLoading(false); }
        };
        const handleRevertEdit = async (message: ChatMessage) => { /* ... (implementation unchanged) ... */
             if (!message.canRevert || typeof message.previousContent !== 'string' || !message.noteIdToRevert || isChatLoading || !message.id) { console.error("Cannot revert this action. Invalid message state:", message); setChatHistory(prev => [...prev, { id: `revert-err-state-${Date.now()}`, role: 'assistant', content: `❌ Cannot revert. Invalid state.`, error: true }]); return; }
             setIsChatLoading(true); setLoadingMsgId(null); const originalMessageId = message.id;
             try { await onUpdateNoteContent(message.noteIdToRevert, message.previousContent); setChatHistory(prev => [ ...prev.map(msg => msg.id === originalMessageId ? { ...msg, canRevert: false } : msg ), { id: `revert-ok-${Date.now()}`, role: 'assistant', content: "🔄 Change reverted." } ]); }
             catch (error) { console.error("Error reverting edit:", error); const eMsg = error instanceof Error ? error.message : 'Unknown error during revert.'; setChatHistory(prev => [...prev, { id: `revert-err-${Date.now()}`, role: 'assistant', content: `❌ Revert failed: ${eMsg}`, error: true }]); }
             finally { setIsChatLoading(false); }
        };
        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... (implementation unchanged) ... */
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
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => { /* ... (implementation unchanged) ... */
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

        // --- Core Chat Submit Logic (*** MODIFIED for Image Gen ***) ---
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[]) => {
            const currentFiles = filesToSend || selectedFiles;
            if ((!messageContent && currentFiles.length === 0) || isChatLoading || !geminiApiKey || !note || !user) return;

            // --- Usage Check (Unchanged) ---
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            let limitReached = false;
            const limit = currentChatLimit;
            if (userTier !== 'premium') {
                 let currentCount = chatCount;
                 if (usageMonth !== currentMonthYear) { console.log(`NoteChat: Month mismatch. Resetting local count.`); currentCount = 0; setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; }
                 else { limitReached = currentCount >= limit; setIsChatLimitReached(limitReached); }
            }
            if (limitReached) {
                 setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit. Upgrade for more interactions!`, error: true }]);
                 setChatMessage(''); return;
            }
            // --- END: Usage Check ---

            const timerDuration = parseTimerRequest(messageContent);

            // --- Determine Intent: Is it an Image Generation request? ---
            const isImageGen = isImageGenerationRequest(messageContent);
            // Prevent image generation if files are attached (for now, simplify)
             if (isImageGen && currentFiles.length > 0) {
                  setChatHistory(prev => [...prev, { id: `img-gen-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Please remove attached files before generating an image.`, error: false }]);
                  return; // Stop submission
            }

            // Prepare user message (Unchanged logic, just uses imageData)
            let userMsgContent = messageContent;
            let userMsgImageData: ImageData | undefined = undefined;
            const imageFiles = currentFiles.filter(f => f.type.startsWith('image/'));
            // Attach only the *first* image to the user message bubble display, but all files will be sent to API if not image gen
            if (imageFiles.length > 0) { userMsgImageData = { base64: imageFiles[0].base64Data, type: imageFiles[0].type, name: imageFiles[0].name }; }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: userMsgContent, imageData: userMsgImageData };
            setChatHistory(prev => [...prev, userMsg]);
            setSuggestedPrompts([]); // Clear suggestions
            if (!filesToSend) { setSelectedFiles([]); } // Clear files if not explicitly passed

            // Handle Timer (Unchanged)
            if (timerDuration) { /* ... (timer logic unchanged) ... */
                 const tId = `t-${Date.now()}`; const dTxt = timerDuration >= 3600 ? `${Math.round(timerDuration / 3600)}h` : timerDuration >= 60 ? `${Math.round(timerDuration / 60)}m` : `${timerDuration}s`;
                setChatHistory(prev => [ ...prev, { id: `tstart-${tId}`, role: 'assistant', content: `Timer set: ${dTxt}.`, timer: { type: 'timer', duration: timerDuration, id: tId } } ]);
                if (messageContent.toLowerCase().startsWith('set timer') || messageContent.toLowerCase().startsWith('timer for')) { setChatMessage(''); }
                return; // Stop if it was ONLY a timer command
            }

            setIsChatLoading(true);

            // --- Increment Usage Count (Unchanged logic) ---
            if (userTier !== 'premium' && user?.uid) { /* ... (increment logic unchanged) ... */
                try { await incrementUserChatUsage(user.uid); const newLocalCount = chatCount + 1; setChatCount(newLocalCount); setIsChatLimitReached(newLocalCount >= limit); }
                catch (err) { console.error("NoteChat: Failed to increment chat usage:", err); setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]); }
            }
            // --- End Increment Logic ---

            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
             // Add specific loading message for image generation
             const loadingContent = isImageGen ? "Generating image..." : "...";
             setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: loadingContent, isGeneratingImage: isImageGen }]); // Add placeholder

            const recentHistory = chatHistory.slice(-8); // Keep history length reasonable

             // --- *** UPDATED System Prompt with Image Generation Instructions *** ---
            const systemInstruction = `You are TaskMaster, a highly meticulous, context-aware, and **conversational** AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}".

Your primary goal is to be helpful, accurate, and strictly follow instructions based on the user's request, the provided note content, **and any attached files (images/PDFs)**. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** First, determine if the user is:
    a) ASKING a question *about* the note/files.
    b) EXPLICITLY requesting a *change* to the note text.
    c) EXPLICITLY requesting *image generation*.
    d) Engaging in general chat.
2.  **Execute Correct Function:** Based on the intent, follow the corresponding function below (Answer, Modify, Generate Image, General Chat).
3.  **Provide Suggestions:** ALWAYS conclude your response with relevant suggestions.

**Functions (Strict Order of Priority):**

1.  **Answer Questions Directly (Highest Priority):**
    *   **PRIORITY:** If the user asks a question *about* the note's content or attached files (e.g., "What does the diagram show?", "Summarize this section"), provide a direct, helpful answer based primarily on the "Current Note Content" **and any relevant attached files.**
    *   **Natural Phrasing:** Integrate information smoothly. Avoid robotic phrasing. Use natural language (e.g., "Looking at the plan...", "Yes, the notes mention...", "The image shows...").
    *   **CRITICAL:** **DO NOT** propose an edit (JSON response) or generate an image if the user is merely asking for information, clarification, or summarization of existing content.
    *   **Handling Missing Information:** State clearly but naturally if info isn't present (e.g., "That detail isn't in this note,"). Then, leverage general knowledge if appropriate, clearly indicating its origin ("...but generally speaking..."). Avoid fabricating.

2.  **Modify Note (ONLY if EXPLICITLY Asked - Requires JSON Output):**
    *   **TRIGGER:** Propose an edit **ONLY** if the user *explicitly* uses action verbs indicating a desire to *change* the note text (e.g., "add", "remove", "change", "rewrite", "update"). Simple questions ("What about adding Y?") DO NOT automatically trigger an edit proposal.
    *   **Choose ONE Method (A, B, or C) per response. Ensure JSON is valid.**
    *   **CRITICAL - NO CODE LEAKS:** **NEVER** include the raw JSON structure or code fragments directly within your conversational text response (outside the JSON block). Explain *what* you're doing conversationally before the JSON.
        *   **Method A: Single Targeted Edit:** (Preferred for ONE change) \`\`\`json { "action": "propose_targeted_edit", ... } \`\`\`
        *   **Method B: Sequential Edits:** (Use for MULTIPLE changes in ONE message) \`\`\`json { "action": "propose_sequential_edits", "edits": [...] } \`\`\`
        *   **Method C: Full Content Replacement:** (ONLY for MAJOR OVERHAULS) \`\`\`json { "action": "propose_full_content_replacement", ... } \`\`\`
    *   **(Full JSON specs omitted for brevity - same as before)**

3.  **Generate Image (ONLY if EXPLICITLY Asked - NO JSON Output):**
    *   **TRIGGER:** Activate **ONLY** if the user *explicitly* asks you to "generate an image", "create a picture", "draw", "show me an image of", etc., followed by a description.
    *   **ACTION:** Use your image generation capability based on the user's description.
    *   **OUTPUT:** Your response should contain the generated image data directly. You MAY include a brief preceding text (e.g., "Okay, here's an image of [subject]:").
    *   **CRITICAL:** **DO NOT** output JSON for image generation requests. The image data should be returned via the appropriate API mechanism (e.g., inlineData).
    *   **FALLBACK:** If generation fails or is blocked (e.g., safety, unsupported request), explain why clearly and politely (e.g., "I couldn't generate that image due to safety guidelines." or "Sorry, I encountered an error generating the image.").
    *   **PRIORITY:** Image generation is requested less often than questions or edits. Prioritize answering/editing if the request is ambiguous. If the user asks to *add an image description to the note*, that's a **Modify Note** request, not image generation.

4.  **General Chat:**
    *   If the input isn't a direct question about content, an explicit note change request, or an explicit image generation request, engage in helpful conversation related to the note's topic or clarify their request.
    *   **DO NOT** process timer requests (handled separately).

5.  **Generate Suggestions (Always Include):**
    *   **MANDATORY:** **ALWAYS** conclude every response with 3 relevant follow-up suggestions.
    *   **Content:** Base suggestions on the note, files, chat history, and the *last interaction* (including generated images).
    *   **Format:** Enclose clearly at the **VERY END**: `[SUGGESTIONS]\nSuggestion 1?\nSuggestion 2\nAdd suggestion 3\n[/SUGGESTIONS]`
    *   **Style:** Concise, actionable, phrased as user questions or commands. Mix types.

**Important Reminders & Constraints:**

*   **Context is Key:** Use Current Note Content, Chat History, **and Attached Files**.
*   **Image Interpretation:** You **CAN** see and interpret images/PDFs attached by the user. Refer to them naturally ("The diagram you sent shows...").
*   **Explicit Intent:** Do not infer edit or image generation requests. Wait for clear commands.
*   **Follow Hierarchy:** Answer > Modify > Generate Image > General Chat > Suggestions.
*   **No JSON/Code Leaks (Except for Edits):** Keep conversational text clean.
*   **Conversational Tone:** Be helpful, collaborative.

**Current Note Content (Full):**
"""
${note.content}
"""

**Key Points (Reference Only):**
${note.keyPoints?.map(p => `- ${p}`).join('\n') || 'N/A'}

---
**Chat History (Recent):**
${recentHistory
    .filter(m => !m.timer && !m.isUpdateConfirmation && m.content !== '...' && !m.isGeneratingImage) // Filter out more transient messages
    .map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content.replace(/```json[\s\S]*?```/g, '[Edit Proposed]').replace(/\[(?:Image )?Attached:.*?\]/g, '[File Attached]')}`)
    .join('\n')}
---

**${userName}: ${messageContent}** ${currentFiles.length > 0 ? `(Files Attached: ${currentFiles.map(f=>f.name).join(', ')})` : ''}
**Assistant:**`;
            // --- End of Updated System Prompt ---


            try {
                // --- Determine API Model and Config ---
                const targetModel = isImageGen ? GEMINI_IMAGE_GEN_MODEL : GEMINI_TEXT_MODEL;
                const fullGeminiEndpoint = `${GEMINI_API_BASE}${targetModel}:generateContent?key=${geminiApiKey}`;

                // Base generation config
                let generationConfig: any = {
                    temperature: isImageGen ? 0.7 : 0.6, // Slightly different defaults maybe
                    maxOutputTokens: isImageGen ? 1024 : 8192, // Image gen might need fewer text tokens
                    topP: 0.95,
                    // responseMimeType: "text/plain" // REMOVE this for image gen - let model decide based on modalities
                };

                // Add image generation specific config
                if (isImageGen) {
                    generationConfig.responseModalities = ["TEXT", "IMAGE"]; // Request image capability
                     // Optional: Add safety settings if needed, e.g.,
                     // safetySettings: [
                     //   { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                     //   { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                     //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                     //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                     // ]
                } else {
                     generationConfig.responseMimeType = "text/plain"; // Specify for text-only
                }


                // --- Prepare API Request Body ---
                const apiContent: any[] = [];

                // Build API history (unchanged)
                 recentHistory.forEach(msg => {
                     if (msg.role === 'user') {
                         // Simple text part for user history
                         const userParts: any[] = [{ text: msg.content.replace(/\[(?:Image )?Attached:.*?\]/g, '').trim() }];
                         // Include user-uploaded image data *in history* if it existed
                         if (msg.imageData) {
                             userParts.push({ inline_data: { mime_type: msg.imageData.type, data: msg.imageData.base64 } });
                         }
                         apiContent.push({ role: "user", parts: userParts });

                     } else if (msg.role === 'assistant' && !msg.timer && !msg.isUpdateConfirmation && m.content !== '...' && !m.isGeneratingImage) {
                         // Simple text part for assistant history
                         // Don't include previously *generated* images in history to save tokens/complexity
                         const assistantContent = msg.content?.replace(/```json[\s\S]*?```/g, msg.isEditSuggestion ? `(Proposed Edit: ${msg.editExplanation || 'Details omitted'})` : '(Response provided)');
                         if (assistantContent?.trim()) {
                             apiContent.push({ role: "model", parts: [{ text: assistantContent }] });
                         }
                     }
                 });

                // Add current user message + system prompt + files (if any, and not image gen)
                 const currentUserParts: any[] = [];
                 // Add system prompt FIRST for the current turn
                 currentUserParts.push({ text: systemInstruction });
                 // Add text part of the current message
                 // currentUserParts.push({ text: messageContent }); // Already included IN the system prompt

                 // Add files if they exist AND it's NOT an image generation request
                 if (currentFiles.length > 0 && !isImageGen) {
                    currentFiles.forEach(file => {
                        // Only send image/pdf to the text model
                        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                            currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                        } else { console.warn(`Skipping file with unsupported MIME type for API: ${file.name} (${file.type})`); }
                    });
                 }
                 // Add the final user turn content
                 apiContent.push({ role: "user", parts: currentUserParts });


                 // Construct final request body
                 let requestBody = JSON.stringify({
                    contents: apiContent,
                    generationConfig: generationConfig
                    // Add safetySettings here if needed and defined above
                 });

                // --- Make API Call ---
                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text(); // Get raw text first

                // --- Process Response using NEW Parser ---
                const parsedResult = parseGeminiResponse(responseText, isImageGen);

                setSuggestedPrompts(parsedResult.suggestions); // Set suggestions regardless of content type

                // Prepare the final message state
                let assistantFinalMessage: ChatMessage = {
                    id: newLoadingMsgId,
                    role: 'assistant',
                    content: parsedResult.text || (parsedResult.imageData ? "" : "(No text content received)"), // Default text if only image
                    imageData: parsedResult.imageData, // Assign generated image data
                    error: !!parsedResult.error,
                    isEditSuggestion: false, // Reset defaults
                };

                // If there was an error, override content with the error message
                if (parsedResult.error) {
                    assistantFinalMessage.content = parsedResult.error;
                    assistantFinalMessage.imageData = null; // Don't show partial images on error
                    assistantFinalMessage.error = true;
                }

                // --- Handle JSON Edit Proposals (ONLY if NOT an image gen request) ---
                 if (!isImageGen && parsedResult.text) {
                    const jsonMatch = parsedResult.text.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch && jsonMatch[1]) {
                        let potentialJsonString = jsonMatch[1].trim();
                        try {
                            const parsedJson = JSON.parse(potentialJsonString);
                            let parsedSuccessfully = false;
                            // Reset error state if JSON parsing starts
                            assistantFinalMessage.error = false;

                            if (parsedJson.action === "propose_targeted_edit" /* ... validation ... */) {
                                // ... (Existing targeted edit logic) ...
                                if (typeof parsedJson.explanation === 'string' && typeof parsedJson.edit_type === 'string' && typeof parsedJson.content_fragment === 'string' && (typeof parsedJson.target_context === 'string' || parsedJson.target_context === null)) {
                                     assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_targeted_edit", editExplanation: parsedJson.explanation, editType: parsedJson.edit_type as EditStep['editType'], targetContext: parsedJson.target_context, contentFragment: parsedJson.content_fragment };
                                     parsedSuccessfully = true;
                                }
                            } else if (parsedJson.action === "propose_full_content_replacement" /* ... validation ... */) {
                                // ... (Existing full replacement logic) ...
                                if (typeof parsedJson.explanation === 'string' && typeof parsedJson.new_full_content === 'string') {
                                    assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_full_content_replacement", editExplanation: parsedJson.explanation, newFullContent: parsedJson.new_full_content };
                                    parsedSuccessfully = true;
                                }
                            } else if (parsedJson.action === "propose_sequential_edits" /* ... validation ... */) {
                                // ... (Existing sequential edit logic) ...
                                if (typeof parsedJson.explanation === 'string' && Array.isArray(parsedJson.edits) && parsedJson.edits.length > 0) {
                                    const { valid, edits } = validateSequentialEdits(parsedJson.edits); // Extracted validation logic
                                    if (valid) {
                                         assistantFinalMessage = { ...assistantFinalMessage, content: parsedJson.explanation, isEditSuggestion: true, editAction: "propose_sequential_edits", editExplanation: parsedJson.explanation, sequentialEdits: edits };
                                         parsedSuccessfully = true;
                                    } else {
                                        assistantFinalMessage.content = `Warning: AI proposed sequential edits, but the format was invalid. \n\n---\n${parsedResult.text}`; assistantFinalMessage.error = true;
                                    }
                                }
                            }

                            // Update content if JSON was parsed and valid
                            if (parsedSuccessfully) {
                                const remainingText = parsedResult.text.replace(jsonMatch[0], '').trim();
                                assistantFinalMessage.content = remainingText || parsedJson.explanation || "(Edit proposed)";
                                if (!assistantFinalMessage.content.trim()) assistantFinalMessage.content = "(Edit proposed without explanation)";
                                // Ensure imageData is cleared if an edit is proposed
                                assistantFinalMessage.imageData = undefined;
                            } else if (!assistantFinalMessage.error) { // Only set error if not already set by validation
                                // Invalid JSON structure found
                                assistantFinalMessage.content = `Warning: AI proposed an edit, but the format was invalid. \n\n---\n${parsedResult.text}`;
                                assistantFinalMessage.error = true;
                            }

                        } catch (parseError: any) {
                            // JSON syntax error
                            assistantFinalMessage.content = `Error: Failed to process edit (JSON Parse Error: ${parseError.message}).\n\n---\n${parsedResult.text}`;
                            assistantFinalMessage.error = true;
                            assistantFinalMessage.imageData = undefined; // Clear image data on JSON error
                        }
                    }
                 }

                 // Final check for empty content if no error/image/edit
                 if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.imageData && !assistantFinalMessage.error && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer) {
                    assistantFinalMessage.content = "(Received empty response)";
                    assistantFinalMessage.error = true; // Treat as error if completely empty
                 }

                // --- Update Chat History ---
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) {
                console.error('Chat submit fetch/process error:', err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                // Update the loading message with the error
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? { id: newLoadingMsgId, role: 'assistant', content: `❌ ${errorMsg}. Please check console or try again.`, error: true } : msg ));
                 setSuggestedPrompts([]); // Clear suggestions on error
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null); // Clear loading message ID when done
             }
        };

        // Helper function for sequential edit validation (extracted for clarity)
        const validateSequentialEdits = (editsJson: any[]): { valid: boolean, edits: EditStep[] } => {
            const validEdits: EditStep[] = [];
            let sequenceIsValid = true;
            for (let i = 0; i < editsJson.length; i++) {
                 const step = editsJson[i];
                 if (typeof step.edit_type === 'string' && typeof step.content_fragment === 'string' && (typeof step.target_context === 'string' || step.target_context === null) &&
                     ['insert_after_context', 'replace_context', 'delete_context', 'insert_at_start', 'append_at_end'].includes(step.edit_type) &&
                     (step.edit_type === 'insert_at_start' || step.edit_type === 'append_at_end' || step.target_context !== null) && // Target context required unless start/end
                     !(step.edit_type === 'delete_context' && typeof step.target_context !== 'string') // Delete needs target
                 ) { validEdits.push({ editType: step.edit_type as EditStep['editType'], targetContext: step.target_context, contentFragment: step.content_fragment }); }
                 else { sequenceIsValid = false; break; }
             }
            return { valid: sequenceIsValid, edits: validEdits };
        };


        // --- Other Handlers (Unchanged: handleChatSubmit, handleKeyDown, handleTextareaInput, handleSuggestionClick) ---
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


        useImperativeHandle(ref, () => ({
            sendMessage: (message: string) => { submitMessageToAI(message); },
            // focusInput: () => { textareaRef.current?.focus(); }
        }));


        // --- Dynamic Styles & Render Logic (Unchanged) ---
        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`;
        if (displayMode === 'overlay' && !isVisible) return null;

        // --- JSX Structure (Mostly Unchanged, relies on existing rendering for imageData) ---
        return (
            <div className={rootClasses}>
                {/* Header (Unchanged) */}
                <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                     <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}> <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span> </h3>
                     {displayMode === 'overlay' && ( <div className="flex items-center"> <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}> {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />} </button> <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close"> <X className="w-4 h-4" /> </button> </div> )}
                     {displayMode === 'inline' && ( <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View"> <X className="w-4 h-4" /> </button> )}
                </div>

                 {/* Chat Body (Unchanged - logic handles imageData rendering) */}
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
                                // Dynamic prose class based on theme and message type (slightly adjusted for clarity)
                                 const getProseClass = (msg: ChatMessage) => {
                                     let base = `prose prose-sm max-w-none prose-p:text-xs prose-p:my-1 prose-ul:text-xs prose-ol:text-xs prose-li:my-0 prose-code:text-[11px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-[11px] prose-pre:my-1 prose-pre:p-1.5 prose-pre:rounded`;
                                     if (isIlluminateEnabled) {
                                         if (msg.isEditSuggestion) base += ' prose-yellow text-yellow-900';
                                         else if (msg.error) base += ' prose-red text-red-800';
                                         else if (msg.isUpdateConfirmation) base += ' prose-green text-green-900';
                                         else base += ' prose-gray text-gray-800'; // Default assistant text
                                     } else { // Dark modes
                                         base += ' prose-invert'; // Invert base colors
                                         if (msg.isEditSuggestion) base += ' text-yellow-200';
                                         else if (msg.error) base += ' text-red-300';
                                         else if (msg.isUpdateConfirmation) base += ' text-green-200';
                                         else base += ' text-gray-200'; // Default assistant text
                                     }
                                     return base;
                                 };
                                const proseClass = getProseClass(message);

                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                             {/* Loading Indicator */}
                                            {isCurrentLoadingMsg ? (
                                                <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    {/* Show specific loading text */}
                                                     <span className="text-xs">{message.isGeneratingImage ? "Generating image..." : "Thinking..."}</span>
                                                </div>
                                            ) : // --- Render Text Content (If any) ---
                                               message.content ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
                                                    className={proseClass}
                                                    components={{ /* ... markdown components unchanged ... */
                                                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600" {...props} />,
                                                        code: ({node, inline, className, children, ...props}) => { /* ... */
                                                            const match = /language-(\w+)/.exec(className || ''); const isJson = className === 'language-json';
                                                            if (inline) { return <code className={`${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-600/70 text-gray-100'} px-1 py-0.5 rounded text-[10px]`} {...props}>{children}</code>; }
                                                            return <pre className={`${isIlluminateEnabled ? '!bg-gray-200/70 !text-gray-800' : '!bg-gray-600/70 !text-gray-100'} p-1.5 rounded my-1 text-[11px] overflow-x-auto`} {...props}><code>{children}</code></pre>;
                                                         },
                                                    }}
                                                >{message.content}</ReactMarkdown>
                                            ) : null}

                                            {/* --- Render Image Data (Handles BOTH user-uploaded AND AI-generated) --- */}
                                            {message.imageData && (
                                                 <div className={`mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                     <img
                                                         src={`data:${message.imageData.type};base64,${message.imageData.base64}`}
                                                         // Use a more specific alt text for generated images if possible
                                                         alt={message.imageData.name || "Chat Image"}
                                                         className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                                                         onClick={() => window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')}
                                                         title={`Click to view full image: ${message.imageData.name || 'Generated Image'}`}
                                                     />
                                                 </div>
                                             )}

                                            {/* Timer Rendering (Unchanged) */}
                                            {message.timer && ( <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div> )}

                                             {/* Edit/Revert Buttons (Unchanged) */}
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

                         {/* Input Form Area (Unchanged - usage display logic correct) */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Usage Display */}
                             {userTier !== 'premium' && userTier !== 'loading' && ( /* ... usage display unchanged ... */
                                <div className="pb-1 text-xs text-center">
                                    <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages this month: {isLoadingUsage ? '...' : chatCount} / {currentChatLimit === Infinity ? '∞' : currentChatLimit} </span>
                                    {isChatLimitReached && !isLoadingUsage && ( <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span> )}
                                    {!isChatLimitReached && userTier === 'basic' && ( <Link to="/pricing" className={`ml-2 font-medium ${isIlluminateEnabled ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'} hover:underline`}> <Crown className="w-2.5 h-2.5 inline mr-0.5"/>Upgrade </Link> )}
                                </div>
                            )}
                            {/* File Pills */}
                            {selectedFiles.length > 0 && ( /* ... file pills unchanged ... */
                                <div className="mb-1.5 flex flex-wrap gap-1.5 px-1"> {selectedFiles.map(file => ( <div key={file.name} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${filePillBg} ${filePillText}`}> <span className="truncate max-w-[100px]">{file.name}</span> <span className="text-[10px] opacity-70">({formatBytes(file.size)})</span> <button type="button" onClick={() => handleRemoveFile(file.name)} className={`ml-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-200' : 'hover:bg-blue-700'} `} title="Remove"> <X className="w-2.5 h-2.5" /> </button> </div> ))} </div>
                             )}
                            {/* Input Form */}
                            <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "Monthly chat limit reached..." : "Ask, generate image, or attach..."} className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || isLoadingUsage} style={{ height: 'auto' }} aria-label="Chat input" />
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

// Export the component (if not already default)
// export default NoteChat; // Or keep existing export style
