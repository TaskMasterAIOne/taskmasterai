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
    setOverlayContext: (text: string) => void; // For PDF highlight chat overlay
    switchToImageMode: () => void; // To activate image mode externally
}

// --- CONSTANTS ---
// Use the specific model names provided
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002'; // Specific Imagen 3 model
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash'; // Stick to 1.5 Flash as per original code
const GOOGLE_AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const getApiEndpoint = (modelName: string, apiKey: string) => {
    // Assumes Imagen 3 uses the base endpoint without key, Gemini needs key in URL
    if (modelName.startsWith('imagen')) {
         return `${GOOGLE_AI_STUDIO_BASE}${modelName}:generateContent`;
    } else {
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
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                if (attempt === retries - 1) {
                     let errorText = `API Error (${response.status}) after ${retries} attempts.`; try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch {}
                     throw new Error(errorText);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue;
            }
            if (!response.ok) {
                let errorText = `API Error (${response.status})`; try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch {}
                 if (errorText.toLowerCase().includes("context length") || errorText.toLowerCase().includes("request payload size") || errorText.toLowerCase().includes("request entity too large")) { throw new Error("Error: The note content and/or attached files are too large for the AI to process."); }
                 if (errorText.toLowerCase().includes("unsupported user location") || errorText.toLowerCase().includes("region")) { throw new Error("Error: This feature is not available in your region."); }
                 if (errorText.toLowerCase().includes("api key not valid")) { throw new Error("Error: Invalid API Key."); }
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
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`; if(jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
            return { text: null, imageData: null, error: errorMessage, finishReason: 'BLOCKED', suggestions: [] };
        }
        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;
            // Imagen 3 Image Data Extraction
            if (isImageGenCall && candidate.image?.data) {
                 imageContent = { base64: candidate.image.data, type: 'image/png', name: "generated_image.png" };
                 textContent = candidate.content?.parts?.[0]?.text || null;
            }
            // Gemini Text Data Extraction
            else if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                for (const part of candidate.content.parts) { if (part.text) { textContent = (textContent ? textContent + "\n" : "") + part.text; } }
            }
             // Error/Empty Response Handling
             if (!textContent && !imageContent) { /* ... error handling based on reason ... */ }
             // Suggestion Parsing (Only for Gemini Text)
             if (textContent && !isImageGenCall) { const suggestionRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i; const suggestionMatch = textContent.match(suggestionRegex); if (suggestionMatch && suggestionMatch[1]) { responseSuggestions = suggestionMatch[1].split('\n').map(s => s.trim().replace(/^- /, '').trim()).filter(s => s.length > 1 && s.length < 150).slice(0, 3); textContent = textContent.replace(suggestionRegex, '').trim(); } }
        } else if (jsonResponse?.error?.message) { errorMessage = `API Error: ${jsonResponse.error.message}`; /* Add specific checks... */ }
        else { errorMessage = "Sorry, I received an empty or non-standard response format."; }
        // Final Checks
        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') { errorMessage = "Image generation request processed, but no image data was returned."; }
        if (!textContent && !imageContent && !errorMessage) { textContent = "(Received empty response content)"; }
        return { text: textContent, imageData: imageContent, error: errorMessage, finishReason: reason, suggestions: isImageGenCall ? [] : responseSuggestions };
    } catch (err) { /* ... generic error handling ... */ return { text: null, imageData: null, error: "Error: Could not process AI response (Internal Error).", finishReason: null, suggestions: [] }; }
};

// Other Helper Functions
const parseTimerRequest = (message: string): number | null => { /* ... same as before ... */ };
const isImageGenerationRequest = (message: string): boolean => { /* ... same as before ... */ };
const handleDownloadImage = (imageData: ImageData) => { /* ... same as before ... */ };
const LoadingIndicator = ({ isIlluminateEnabled }: { isIlluminateEnabled: boolean }) => ( /* ... same as before ... */ );

// --- Main Component (NoteChat) ---
export const NoteChat = forwardRef<NoteChatHandle, NoteChatProps>(
    ({ note, onClose, geminiApiKey, userName, isIlluminateEnabled, isBlackoutEnabled, isVisible, onUpdateNoteContent, onAddImageToNoteRequest, displayMode = 'overlay' }: NoteChatProps, ref) => {
        const [chatMessage, setChatMessage] = useState('');
        const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
        const [isChatLoading, setIsChatLoading] = useState(false);
        const [isMinimized, setIsMinimized] = useState(false);
        const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
        const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
        const [overlayContextText, setOverlayContextText] = useState<string | null>(null); // State for PDF highlight overlay
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
        const overlayBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700/60" : "bg-gray-800"; const headerBg = isIlluminateEnabled ? "bg-gray-50/90 border-gray-200" : "bg-gray-900/80 border-gray-700"; const headingColor = isIlluminateEnabled ? "text-gray-800" : "text-white"; const inputBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500"; const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200"; const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500"; const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white"; const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300"; const suggestionButtonClass = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200" : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"; const buttonDisabledClass = "opacity-50 cursor-not-allowed"; const userBubbleClass = isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'; const assistantBubbleClass = isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50'; const errorBubbleClass = isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50'; const editSuggestionBubbleClass = isIlluminateEnabled ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300'; const confirmationBubbleClass = isIlluminateEnabled ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-green-900/30 border border-green-700/50 text-green-200'; const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200"; const filePillBg = isIlluminateEnabled ? "bg-blue-100 border-blue-200" : "bg-blue-900/50 border-blue-700/50"; const filePillText = isIlluminateEnabled ? "text-blue-800" : "text-blue-300"; const downloadButtonClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-600" : "bg-gray-600 hover:bg-gray-500 text-gray-300"; const addToNoteButtonClass = isIlluminateEnabled ? "bg-green-100 hover:bg-green-200 text-green-700" : "bg-green-800/60 hover:bg-green-700/60 text-green-300";
        const imageGenButtonClass = isIlluminateEnabled ? (isImageGenModeActive ? "bg-purple-100 hover:bg-purple-200 text-purple-700" : "bg-gray-200 hover:bg-gray-300 text-gray-700") : (isImageGenModeActive ? "bg-purple-800/60 hover:bg-purple-700/60 text-purple-300" : "bg-gray-600 hover:bg-gray-500 text-gray-300");
        const overlayContextBg = isIlluminateEnabled ? "bg-blue-50 border-blue-200" : "bg-gray-600 border-gray-500";
        const overlayContextTextCls = isIlluminateEnabled ? "text-blue-800" : "text-blue-200";


        // Effects
        useEffect(() => { /* Load usage */ }, [isVisible, userTier]);
        useEffect(() => { /* Set initial prompt */ }, [note, isVisible, userName, displayMode, isIlluminateEnabled]);
        useEffect(() => { /* Scroll to bottom */ }, [chatHistory, isMinimized, displayMode, suggestedPrompts]);

        // Handlers
        const handleTimerComplete = (timerId: string) => setChatHistory(prev => [...prev, { id: `timer-comp-${timerId}`, role: 'assistant', content: "⏰ Time's up!" }]);
        const handleAcceptEdit = async (message: ChatMessage) => { /* ... full implementation ... */ };
        const handleRevertEdit = async (message: ChatMessage) => { /* ... full implementation ... */ };
        const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => { /* ... full implementation ... */ };
        const handleRemoveFile = (fileName: string) => setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        const triggerFileSelect = () => fileInputRef.current?.click();
        const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => { /* ... full implementation ... */ }, [selectedFiles]);
        const handleToggleImageGenMode = () => { if (isChatLoading || isLoadingUsage) return; const nextState = !isImageGenModeActive; setIsImageGenModeActive(nextState); if (nextState && selectedFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-mode-file-warn-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation mode enabled. Attached files will be ignored.`, error: false }]); setSelectedFiles([]); } setOverlayContextText(null); /* Clear overlay context when switching modes */ textareaRef.current?.focus(); };
        const dismissOverlayContext = () => setOverlayContextText(null);

        // Submit Message to AI
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[], forceImageGenMode = false) => {
            const isUsingImageGenModel = forceImageGenMode || isImageGenModeActive;
            const currentFiles = filesToSend || selectedFiles;
            const contextToPrepend = overlayContextText; // Capture context before clearing

            // Validation & Usage Limit Check
            if ((!messageContent && currentFiles.length === 0 && !isUsingImageGenModel && !contextToPrepend) || // Need something if not image gen
                (!messageContent && isUsingImageGenModel && !contextToPrepend) || // Need prompt or context for image gen
                isChatLoading || !geminiApiKey || !note || !user) return;
             // Check usage limit... (use previous logic)
             const currentMonthYear = new Date().toISOString().slice(0, 7); let limitReached = false; const limit = currentChatLimit; if (userTier !== 'premium') { let currentCount = chatCount; if (usageMonth !== currentMonthYear) { currentCount = 0; setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; } else { limitReached = currentCount >= limit; setIsChatLimitReached(limitReached); } } if (limitReached) { setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit.`, error: true }]); setChatMessage(''); setIsImageGenModeActive(false); setOverlayContextText(null); return; }

            // Handle Timer
            const timerDuration = !isUsingImageGenModel && !contextToPrepend ? parseTimerRequest(messageContent) : null;
            if (timerDuration) { /* Handle timer... */ setOverlayContextText(null); return; }

            // Prevent Image Gen with Files
            if (isUsingImageGenModel && currentFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-gen-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Remove attached files before generating an image.`, error: false }]); return; }

            // Prepare final prompt including overlay context if present
             let finalPromptContent = messageContent;
             if (contextToPrepend) {
                 const formattedContext = `--- Highlighted Context ---\n"${contextToPrepend}"\n-------------------------\n\n`;
                 finalPromptContent = messageContent ? `${formattedContext}${messageContent}` : formattedContext + "(No additional prompt provided)";
             }

            // Prepare User Message & Update State
            let userMsgImageData: ImageData | undefined = undefined;
            if (!isUsingImageGenModel && currentFiles.length > 0) { const imageFile = currentFiles.find(f => f.type.startsWith('image/')); if (imageFile) { userMsgImageData = { base64: imageFile.base64Data, type: imageFile.type, name: imageFile.name }; } }
            // Display only the user's typed message in history, not the prepended context
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: messageContent || (contextToPrepend ? "(Context Provided)" : ""), imageData: userMsgImageData };

            setSuggestedPrompts([]);
            setChatHistory(prev => [...prev, userMsg]);
            if (!filesToSend && !isImageGenModeActive) setSelectedFiles([]);
            setOverlayContextText(null); // Clear overlay context *after* capturing it
            setIsChatLoading(true); const newLoadingMsgId = `load-${Date.now()}`; setLoadingMsgId(newLoadingMsgId);
            const loadingContent = isUsingImageGenModel ? "Generating image..." : "..."; setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: loadingContent, isGeneratingImage: isUsingImageGenModel }]);
            // Increment usage... (use previous logic)

            // Prepare API Request
            const recentHistory = chatHistory.slice(-8);
            // --- RE-ADD THE FULL SYSTEM PROMPT HERE ---
            const systemInstruction = `You are TaskMaster, a highly meticulous, context-aware, and **conversational** AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}".

Your primary goal is to be helpful, accurate, and strictly follow instructions based on the user's request, the provided note content, **and any attached images**. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** First, determine if the user is ASKING a question *about* the note (or related images) or if they are EXPLICITLY requesting a *change* to the note text OR EXPLICITLY requesting image generation. This distinction is CRITICAL.
2.  **Execute Correct Function:** Based on the intent, follow the corresponding function below (Answer Questions, Generate Image, Modify Note, or General Chat).
3.  **Provide Suggestions (Conditional):** Conclude your response with relevant suggestions, **UNLESS** you just generated an image.

**Functions (Strict Order of Priority):**

1.  **Answer Questions Directly (Highest Priority):**
    *   **PRIORITY:** If the user asks a question *about* the note's content or attached images (e.g., "What does the diagram show?", "Summarize this section", "Explain the process mentioned"), provide a direct, helpful answer based primarily on the "Current Note Content" **and any relevant attached images.**
    *   **Natural Phrasing:** **CRITICAL:** Integrate information smoothly into your conversational response. **Avoid overly robotic phrasing** like "The note states..." or "According to the note...". Use more natural language (e.g., "Looking at the plan here, the first step is...", "Yes, the meeting notes mention that point.", "The image shows...", "Based on the details in the note...").
    *   **CRITICAL:** **DO NOT** propose an edit (JSON response) if the user is merely asking for information, clarification, or summarization.
    *   **Handling Missing Information:** If the note or images *don't* contain the answer to the user's question, **avoid stiff phrases like "The note doesn't mention X" or "The note does not contain information on X."** Instead, state clearly but naturally that the info isn't present in the note context (e.g., "That specific detail isn't in this note," or "Hmm, I don't see that covered here.") and *then* leverage your general knowledge to provide a helpful and accurate supplementary answer where appropriate, clearly indicating its origin (e.g., "...but generally speaking...", "...however, typical approaches include..."). Avoid fabricating information not present in the note or general knowledge.

2.  **Generate Image (ONLY if EXPLICITLY Asked - NO JSON Output):**
    *   **TRIGGER:** Activate **ONLY** if the user *explicitly* asks you to "generate an image", "create a picture", "draw", "show me an image of", etc., followed by a description. Use the \`gemini-2.0-flash-exp-image-generation\` model for this.
    *   **ACTION:** Use your image generation capability based on the user's description.
    *   **OUTPUT:** Your response should contain the generated image data directly (via \`inlineData\`). You MAY include a brief preceding text (e.g., "Okay, here's an image of [subject]:" or "Here's the image you requested:"). **Keep this preceding text concise.**
    *   **CRITICAL (LIMITATION): You CANNOT add the generated image *directly* into the note text.** If the user asks to "add the image to the note" or similar *after* you generate it, explain politely that you cannot embed it in the note, but they can download it. Example: "Here is the image you requested. I can't add images directly to the note text, but you can download it using the button." **Do not proactively state this limitation unless the user asks to add the generated image.**
    *   **CRITICAL:** **DO NOT** output JSON for image generation requests. The image data should be returned via the appropriate API mechanism.
    *   **FALLBACK:** If generation fails or is blocked (e.g., safety, unsupported request, unclear prompt), explain why clearly and politely IN TEXT (e.g., "I couldn't generate that image due to safety guidelines." or "Sorry, I encountered an error generating the image." or "Could you please provide a more specific description for the image?"). Do not attempt to generate an image if blocked.
    *   **CRITICAL (NO SUGGESTIONS):** **DO NOT** provide suggestions after successfully generating an image OR explaining a generation failure.

3.  **Modify Note (ONLY if EXPLICITLY Asked & Not Image Gen - Requires JSON Output):**
    *   **TRIGGER:** Propose an edit **ONLY** if the user *explicitly* uses action verbs indicating a desire to *change* the note content. Examples: "add", "remove", "delete", "change", "rewrite", "update", "replace", "insert", "correct", "fix", "append", "revise". Simple questions or statements like "This section is unclear" or "What about adding Y?" DO NOT automatically trigger an edit proposal (treat them as questions or discussion points first). Use the standard text model (\`gemini-2.0-flash\`) for this.
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
    *   If the user's input isn't a question about content/images, an explicit image generation request, or an explicit note change request, engage in helpful conversation related to the note's topic, note-taking strategies, or clarifying their request. Use the standard text model.
    *   **DO NOT** process timer requests (e.g., "set timer 5 min"); state that they are handled separately if asked.

5.  **Generate Suggestions (Conditional - See Rule #3 Above):**
    *   **MANDATORY (Unless Generating Image):** **ALWAYS** conclude every response (EXCEPT for image generation responses) with exactly 3 relevant follow-up suggestions.
    *   **Content:** Suggestions should be context-aware, based on the current note content, attached files, recent chat history, and the *last interaction*. They should anticipate what the *user* might want to do or ask next.
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
[/SUGGESTIONS]
    *   **Style:** Make suggestions concise, actionable, and phrased as questions the user might ask you, or direct edit/generation commands they might give you. Mix types. **DO NOT** phrase them as things *you* can do (e.g., "I can add..." is WRONG. Use "Add..." instead). ONLY CREATE 3 SUGGESTIONS AT A TIME!

**Important Reminders & Constraints:**

*   **Context is Key:** Pay close attention to the Current Note Content, Chat History, **and any attached Images/Files**. Responses MUST be relevant to the *current* state.
*   **Image Interpretation:** You **CAN** see and interpret images/PDFs attached by the user. Integrate information from them naturally when answering questions or discussing content. **Do not claim you are only text-based.**
*   **Explicit Intent:** Do not infer edit or image generation requests. Wait for clear commands/keywords.
*   **Image Embedding Limitation:** Reiterate that you cannot embed *generated* images into the note's text content *only if the user explicitly asks* you to add a generated image to the note after it has been generated.
*   **Suggestion Exclusion:** Remember that **no suggestions** should follow an image generation attempt (successful or failed).
*   **Follow Hierarchy:** Prioritize actions in this order: Answer Questions > Generate Image > Modify Note > General Chat. Suggestions are appended unless excluded.
*   **Accuracy of target_context:** This is critical for edits, especially sequential ones. It MUST uniquely identify the location in the note *at the time that specific edit step is executed*. Double-check this.
*   **No JSON/Code Leaks (Except for Edits):** Keep conversational text clean. Structured data belongs ONLY in the designated JSON block for edits. Image generation does not use JSON.
*   **Conversational Tone:** Aim for a natural, helpful, collaborative tone.
*   **Be Helpful:** Even when the note lacks information, try to assist using general knowledge where appropriate, clearly indicating it.
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

**${userName}: ${messageContent}** ${currentFiles.length > 0 && !isImageGen ? `(Files Attached: ${currentFiles.map(f=>f.name).join(', ')})` : ''}
**Assistant:**`;

            const targetModel = isUsingImageGenModel ? IMAGEN_3_MODEL : GEMINI_TEXT_MODEL;
            const endpoint = getApiEndpoint(targetModel, geminiApiKey);

            let requestBodyPayload: any;
            let apiHeaders: HeadersInit = { 'Content-Type': 'application/json' };

            if (isUsingImageGenModel) {
                 // Use Imagen 3 structure
                 requestBodyPayload = { prompt: { text: finalPromptContent } }; // Send combined prompt+context
                 if (!endpoint.includes('?key=')) { apiHeaders['x-goog-api-key'] = geminiApiKey; }
            } else {
                 // Gemini Text structure
                 const apiContent: any[] = [];
                 apiContent.push({ role: "user", parts: [{ text: systemInstruction }]});
                 apiContent.push({ role: "model", parts: [{ text: "Okay, I understand." }]});
                 // Add filtered history...
                 recentHistory.forEach(msg => { /* ... filter and add user/model history ... */ });
                 // Add final user prompt (already includes context) + files
                 const currentUserParts: any[] = [{ text: finalPromptContent }];
                 if (currentFiles.length > 0) { currentFiles.forEach(file => { if (file.type.startsWith('image/') || file.type === 'application/pdf') { currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } }); } }); }
                 if (currentUserParts[0].text || currentUserParts.length > 1) { apiContent.push({ role: "user", parts: currentUserParts }); }
                 // Filter consecutive roles...
                 const filteredApiContent = apiContent; // Use filtered result
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

                if (parsedResult.error) { /* ... */ }
                else if (!isUsingImageGenModel && parsedResult.text) {
                     const jsonMatch = parsedResult.text.match(/```json\s*([\s\S]*?)\s*```/);
                     if (jsonMatch && jsonMatch[1]) { /* Parse JSON edits... */ }
                }
                 if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.imageData && !assistantFinalMessage.error && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer) { /* ... */ }

                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) { /* ... error handling ... */ }
            finally { setIsChatLoading(false); setLoadingMsgId(null); }
        };

        // Event Handlers
        const handleChatSubmit = async (e?: React.FormEvent) => { e?.preventDefault(); const currentMessage = chatMessage.trim(); if ((!currentMessage && selectedFiles.length === 0 && !isImageGenModeActive && !overlayContextText) || (!currentMessage && isImageGenModeActive && !overlayContextText)) { if(isImageGenModeActive && !currentMessage && !overlayContextText) { setChatHistory(prev => [...prev, { id: `img-prompt-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Please describe the image or provide context.`, error: false }]); } return; } if (isImageGenModeActive && selectedFiles.length > 0) { setChatHistory(prev => [...prev, { id: `img-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Remove attached files before generating an image.`, error: false }]); return; } const filesToSubmit = [...selectedFiles]; setChatMessage(''); if (!isImageGenModeActive) setSelectedFiles([]); await submitMessageToAI(currentMessage, filesToSubmit, isImageGenModeActive); if (textareaRef.current) { textareaRef.current.style.height = 'auto'; } };
        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
        const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`; setChatMessage(ta.value); };
        const handleSuggestionClick = (suggestion: string) => { if (isImageGenModeActive) setIsImageGenModeActive(false); setSelectedFiles([]); setChatMessage(''); setOverlayContextText(null); /* Clear context on suggestion click */ submitMessageToAI(suggestion); };

        // Imperative Handle
        useImperativeHandle(ref, () => ({
             sendMessage: (message: string) => { if (isImageGenModeActive) setIsImageGenModeActive(false); setSelectedFiles([]); setChatMessage(''); setOverlayContextText(null); submitMessageToAI(message); },
             focusInput: () => { textareaRef.current?.focus(); },
             setOverlayContext: (text: string) => { setOverlayContextText(text); setChatMessage(''); /* Optionally clear main input */ textareaRef.current?.focus(); },
             switchToImageMode: () => { setIsImageGenModeActive(true); setSelectedFiles([]); setOverlayContextText(null); textareaRef.current?.focus(); setChatHistory(prev => [...prev, { id: `img-mode-activated-${Date.now()}`, role: 'assistant', content: `🖼️ Image generation mode activated. Describe the image you want to create (using note context).`, error: false }]); }
        }));

        // Component Render
        const rootClasses = displayMode === 'overlay' ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}` : `h-full w-full flex flex-col ${overlayBg}`;
        if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                {/* Header */}
                 <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                      <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}> <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span> {isImageGenModeActive && <ImageIcon className={`w-3 h-3 shrink-0 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} title="Image Generation Mode"/>} </h3>
                      <div className="flex items-center"> {displayMode === 'overlay' && ( <> <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}> {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />} </button> <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close"> <X className="w-4 h-4" /> </button> </> )} {displayMode === 'inline' && ( <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View"> <X className="w-4 h-4" /> </button> )} </div>
                 </div>

                {(!isMinimized || displayMode === 'inline') && (
                    <>
                        {/* Chat History Area */} <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin ..."> {/* Chat messages rendering... */} </div>
                        {/* Suggestions Area */} {suggestedPrompts.length > 0 && !isChatLoading && ( /* ... */ )}
                        {/* Input Area */}
                        <div className={`p-2 border-t ${headerBg} shrink-0 sticky bottom-0`}>
                             {/* Usage Indicator */} {/* Selected Files Pills */}
                             {/* Overlay Context Area */}
                              {overlayContextText && (
                                 <div className={`relative mb-1.5 px-2 py-1 rounded-md border text-xs ${overlayContextBg} ${overlayContextTextCls}`}>
                                     <span className="font-medium mr-1">Context:</span>
                                     <span className="italic line-clamp-2">"{overlayContextText}"</span>
                                     <button
                                         onClick={dismissOverlayContext}
                                         className={`absolute top-0.5 right-0.5 p-0.5 rounded-full ${isIlluminateEnabled ? 'hover:bg-blue-100' : 'hover:bg-gray-500'}`}
                                         title="Dismiss Context"
                                     >
                                         <X className="w-3 h-3" />
                                     </button>
                                 </div>
                              )}
                             {/* Form */}
                             <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-end">
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "..." : isImageGenModeActive ? "Describe image..." : overlayContextText ? "Add details or ask about context..." : "Ask, edit note, or attach file..."} className={`flex-1 ${inputBg} ${inputTextColor} ...`} disabled={/*...*/} style={{ height: 'auto' }} aria-label="Chat input" />
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" disabled={isImageGenModeActive} />
                                 <button type="button" onClick={triggerFileSelect} disabled={isChatLoading || isLoadingUsage || isImageGenModeActive} ...> <Paperclip className="w-4 h-4" /> </button>
                                 <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isLoadingUsage || isChatLimitReached} ...> <ImageIcon className="w-4 h-4" /> </button>
                                 <button type="submit" disabled={ /* Validation logic updated */ isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive && !overlayContextText) || (!chatMessage.trim() && isImageGenModeActive && !overlayContextText) || (isImageGenModeActive && selectedFiles.length > 0) } ...> {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} </button>
                             </form>
                         </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
