import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
    MessageCircle, Send, Timer as TimerIcon, Paperclip, Bot, X, AlertTriangle, Loader2,
    ImageIcon, ChevronDown, Maximize, Minimize, Edit, Check, RefreshCcw, Crown, Download,
    PlusCircle as AddToNoteIcon // Icon for adding image to note
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

// Interfaces (ImageData added)
export interface ImageData { base64: string; type: string; name: string; } // Exported for Notes.tsx
interface TimerMessage { type: 'timer'; duration: number; id: string; }
interface EditStep { editType: 'insert_after_context' | 'replace_context' | 'delete_context' | 'insert_at_start' | 'append_at_end'; targetContext: string | null; contentFragment: string; }
interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    imageData?: ImageData; // Can be user uploaded or AI generated
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
    isGeneratingImage?: boolean; // True when loading image gen
    wasImageGenerated?: boolean; // True if this assistant msg contains a *generated* image
    canAddToNote?: boolean; // Flag to show "Add to Note" button for generated images
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
    onAddImageToNoteRequest: (imageData: ImageData) => void; // Callback to add image
    displayMode?: 'overlay' | 'inline';
}
export interface NoteChatHandle {
    sendMessage: (message: string) => void;
    focusInput: () => void; // Added focus method
}

// --- CONSTANTS ---
// Use placeholder for Imagen 3 model, replace with actual model name
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002'; // <-- REPLACE WITH ACTUAL IMAGEN 3 MODEL
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash'; // Keep text model
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/'; // Or Vertex AI endpoint?

// --- Utility Functions (readFileAsBase64, formatBytes, fetchWithRetry) ---
// remain the same as previous version, omitted for brevity

// --- Parse Gemini Response (Updated for Imagen 3 context) ---
const parseGeminiResponse = (responseText: string, isImageGenCall: boolean): { text: string | null; imageData: ImageData | null; error: string | null; finishReason: string | null; suggestions: string[] } => {
    // ... (Keep previous parsing logic, but ensure error messages and checks are relevant)
    // Key changes:
    // - Assume image data comes in `inlineData` even for Imagen 3 (verify this with API docs)
    // - Error messages specific to image generation might change based on Imagen 3 API.
    // - Suggestions logic remains (only for non-image-gen calls).

    let textContent: string | null = null;
    let imageContent: ImageData | null = null;
    let errorMessage: string | null = null;
    let reason: string | null = null;
    let responseSuggestions: string[] = [];

    try {
        const jsonResponse = JSON.parse(responseText);

        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            if (jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
            return { text: null, imageData: null, error: errorMessage, finishReason: 'BLOCKED', suggestions: [] };
        }

        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            reason = candidate.finishReason || null;

            if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent = (textContent ? textContent + "\n" : "") + part.text;
                    } else if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData?.data) {
                        // Assume same format for Imagen 3 generated image data
                        imageContent = { base64: part.inlineData.data, type: part.inlineData.mimeType, name: "generated_image.png" };
                    } else if (part.inlineData) {
                        // console.log("Ignoring non-image inline data part:", part.inlineData.mimeType);
                    }
                }
            }

             // Handle errors/empty responses based on reason
             if (!textContent && !imageContent) {
                if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
                else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
                else if (reason === 'RECITATION') { errorMessage = "Response blocked due to potential recitation issues."; }
                else if (isImageGenCall && reason === 'OTHER') { errorMessage = "Image generation failed (Reason: Other). The prompt might be unsupported or ambiguous."; } // Potentially more specific Imagen error
                else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
                else if (!candidate.content) { errorMessage = "Received an empty response candidate."; }
                else { errorMessage = "Received response with no text or image content."; } // Fallback
            }

            // Suggestion Parsing (only for non-image gen)
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
             // Keep specific API error checks (quota, key, size, region etc.)
             if (errorMessage.toLowerCase().includes("context length") || errorMessage.toLowerCase().includes("request payload size") || errorMessage.toLowerCase().includes("request entity too large")) { errorMessage = "Error: The note content and/or attached files are too large for the AI to process."; }
             else if (errorMessage.toLowerCase().includes("api key not valid")) { errorMessage = "Error: Invalid API Key."; }
             else if (errorMessage.toLowerCase().includes("quota exceeded")) { errorMessage = "Error: API Quota Exceeded."; }
             else if (errorMessage.toLowerCase().includes("internal server error") || errorMessage.toLowerCase().includes("service unavailable")) { errorMessage = "Error: AI service is temporarily unavailable. Please try again later."; }
             else if (errorMessage.toLowerCase().includes("unsupported user location") || errorMessage.toLowerCase().includes("region")) { errorMessage = "Error: This feature (potentially image generation) is not available in your region."; }
             else if (isImageGenCall && (errorMessage.toLowerCase().includes("prompt") || errorMessage.toLowerCase().includes("request content"))) { errorMessage = `Error: Image generation failed. ${jsonResponse.error.message}`; } // More specific Image gen error

        } else { errorMessage = "Sorry, I received an empty or non-standard response format."; }

        // Additional check if image gen was expected but not returned
        if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
             errorMessage = "Image generation request processed, but no image was returned. The prompt might need refinement or the model could not fulfill it.";
        }
        // Fallback if absolutely nothing was parsed
        if (!textContent && !imageContent && !errorMessage) { textContent = "(Received empty response content)"; }

        return { text: textContent, imageData: imageContent, error: errorMessage, finishReason: reason, suggestions: isImageGenCall ? [] : responseSuggestions };

    } catch (err) {
         // Keep generic catch block handling common errors from raw text
         if (typeof responseText === 'string') {
            if (responseText.toLowerCase().includes("api key not valid")) return { text: null, imageData: null, error: "Error: Invalid API Key.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("quota exceeded")) return { text: null, imageData: null, error: "Error: API Quota Exceeded.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("internal server error") || responseText.toLowerCase().includes("service unavailable")) return { text: null, imageData: null, error: "Error: AI service is temporarily unavailable. Please try again later.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("context length") || responseText.toLowerCase().includes("request payload size") || responseText.toLowerCase().includes("request entity too large")) return { text: null, imageData: null, error: "Error: The note content and/or attached files are too large for the AI to process.", finishReason: null, suggestions: [] };
            if (responseText.toLowerCase().includes("unsupported user location") || responseText.toLowerCase().includes("region")) return { text: null, imageData: null, error: "Error: This feature is not available in your region.", finishReason: null, suggestions: [] };
            // Add a check for Imagen-specific errors if identifiable in raw text
            return { text: null, imageData: null, error: `Error: Could not process AI response. Raw: ${responseText.substring(0, 100)}...`, finishReason: null, suggestions: [] };
        }
        return { text: null, imageData: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null, suggestions: [] };
    }
};


// --- Other Helper Functions (parseTimerRequest, isImageGenerationRequest, handleDownloadImage, LoadingIndicator) ---
// remain the same, omitted for brevity

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

        // --- Theme Styles ---
        const overlayBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700/60" : "bg-gray-800"; const headerBg = isIlluminateEnabled ? "bg-gray-50/90 border-gray-200" : "bg-gray-900/80 border-gray-700"; const headingColor = isIlluminateEnabled ? "text-gray-800" : "text-white"; const inputBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500"; const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200"; const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500"; const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white"; const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300"; const suggestionButtonClass = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200" : "bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600"; const buttonDisabledClass = "opacity-50 cursor-not-allowed"; const userBubbleClass = isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'; const assistantBubbleClass = isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50'; const errorBubbleClass = isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50'; const editSuggestionBubbleClass = isIlluminateEnabled ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-300'; const confirmationBubbleClass = isIlluminateEnabled ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-green-900/30 border border-green-700/50 text-green-200'; const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200"; const filePillBg = isIlluminateEnabled ? "bg-blue-100 border-blue-200" : "bg-blue-900/50 border-blue-700/50"; const filePillText = isIlluminateEnabled ? "text-blue-800" : "text-blue-300"; const downloadButtonClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-600" : "bg-gray-600 hover:bg-gray-500 text-gray-300"; const addToNoteButtonClass = isIlluminateEnabled ? "bg-green-100 hover:bg-green-200 text-green-700" : "bg-green-800/60 hover:bg-green-700/60 text-green-300";
        const imageGenButtonClass = isIlluminateEnabled
            ? (isImageGenModeActive ? "bg-purple-100 hover:bg-purple-200 text-purple-700" : "bg-gray-200 hover:bg-gray-300 text-gray-700")
            : (isImageGenModeActive ? "bg-purple-800/60 hover:bg-purple-700/60 text-purple-300" : "bg-gray-600 hover:bg-gray-500 text-gray-300");


        // --- Effects (Usage loading, Initial prompt, Scrolling) ---
        // remain the same, omitted for brevity

        // --- Handlers (Timers, Edits, Files, Paste, Image Gen Toggle) ---
        // handleTimerComplete, handleAcceptEdit, handleRevertEdit, handleFileSelect,
        // handleRemoveFile, triggerFileSelect, handlePaste, handleToggleImageGenMode
        // remain largely the same as previous version, omitted for brevity

        // --- Submit Message to AI (UPDATED for Imagen 3 and Note Context) ---
        const submitMessageToAI = async (messageContent: string, filesToSend?: SelectedFile[], forceImageGenMode = false) => {
            const isUsingImageGenModel = forceImageGenMode || isImageGenModeActive;
            const currentFiles = filesToSend || selectedFiles; // Use passed files or state

            // --- Basic Validation ---
            if ((!messageContent && currentFiles.length === 0 && !isUsingImageGenModel) ||
                (!messageContent && isUsingImageGenModel) ||
                isChatLoading || !geminiApiKey || !note || !user) return;

            // --- Usage Limit Check ---
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            let limitReached = false;
            const limit = currentChatLimit;
            if (userTier !== 'premium') {
                let currentCount = chatCount;
                if (usageMonth !== currentMonthYear) {
                    currentCount = 0; setChatCount(0); setUsageMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false;
                } else {
                    limitReached = currentCount >= limit; setIsChatLimitReached(limitReached);
                }
            }
            if (limitReached) {
                setChatHistory(prev => [...prev, { id: `limit-${Date.now()}`, role: 'assistant', content: `You've reached your ${limit === Infinity ? 'monthly' : limit} chat message limit. Upgrade for more interactions!`, error: true }]);
                setChatMessage(''); setIsImageGenModeActive(false); // Turn off image gen on limit
                return;
            }

            // --- Handle Timer Request ---
            const timerDuration = !isUsingImageGenModel ? parseTimerRequest(messageContent) : null;
            if (timerDuration) {
                const tId = `t-${Date.now()}`; const dTxt = timerDuration >= 3600 ? `${Math.round(timerDuration / 3600)}h` : timerDuration >= 60 ? `${Math.round(timerDuration / 60)}m` : `${timerDuration}s`;
                setChatHistory(prev => [ ...prev, { id: `tstart-${tId}`, role: 'assistant', content: `Timer set: ${dTxt}.`, timer: { type: 'timer', duration: timerDuration, id: tId } } ]);
                if (messageContent.toLowerCase().startsWith('set timer') || messageContent.toLowerCase().startsWith('timer for')) { setChatMessage(''); }
                if (isImageGenModeActive) setIsImageGenModeActive(false); // Turn off image gen if timer set
                return;
            }

            // --- Prevent Image Gen with Files ---
            if (isUsingImageGenModel && currentFiles.length > 0) {
                setChatHistory(prev => [...prev, { id: `img-gen-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Image generation requires a text prompt only. Please remove attached files first.`, error: false }]);
                return; // Don't proceed
            }

            // --- Prepare User Message for History ---
            let userMsgContent = messageContent;
            let userMsgImageData: ImageData | undefined = undefined;
            // Include first image for display if NOT in image gen mode
            if (!isUsingImageGenModel && currentFiles.length > 0) {
                 const imageFile = currentFiles.find(f => f.type.startsWith('image/'));
                 if (imageFile) {
                     userMsgImageData = { base64: imageFile.base64Data, type: imageFile.type, name: imageFile.name };
                 }
            }
            const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: userMsgContent, imageData: userMsgImageData };

            // --- Update State Before API Call ---
            setSuggestedPrompts([]);
            setChatHistory(prev => [...prev, userMsg]);
            if (!filesToSend) {
                // Clear files from input state only if they weren't explicitly passed (e.g., from highlight action)
                setSelectedFiles([]);
            }
            setIsChatLoading(true);
            const newLoadingMsgId = `load-${Date.now()}`;
            setLoadingMsgId(newLoadingMsgId);
            const loadingContent = isUsingImageGenModel ? "Generating image..." : "...";
            setChatHistory(prev => [...prev, { id: newLoadingMsgId, role: 'assistant', content: loadingContent, isGeneratingImage: isUsingImageGenModel }]);

             // --- Increment Usage (Optimistic) ---
             if (userTier !== 'premium' && user?.uid) {
                 try {
                     await incrementUserChatUsage(user.uid);
                     const newLocalCount = chatCount + 1;
                     setChatCount(newLocalCount);
                     setIsChatLimitReached(newLocalCount >= limit);
                 } catch (err) {
                     console.error("Error incrementing usage:", err);
                     setChatHistory(prevHist => [...prevHist, { id:`usage-err-${Date.now()}`, role: 'assistant', content: "⚠️ Error saving chat usage count. Your message was sent, but the count might be inaccurate.", error: true }]);
                 }
             }

            // --- Prepare API Request ---
            const recentHistory = chatHistory.slice(-8); // Limit history context

            // --- UPDATED SYSTEM INSTRUCTION for Imagen 3 & Note Context ---
            const systemInstruction = `You are TaskMaster, a highly meticulous, context-aware, and **conversational** AI agent integrated into Notes. You are chatting with "${userName}" about their note titled "${note.title}".

Your primary goal is to be helpful, accurate, and follow instructions based on the user's request, the provided note content, attached files/images, **and your general knowledge when appropriate**. Adhere to the following functions and rules with **absolute precision**, in this order of priority:

**Core Logic Flow:**

1.  **Analyze User Intent:** Determine if the user is ASKING a question, EXPLICITLY requesting image generation (using keywords like "generate image", "create picture", "draw", etc.), OR EXPLICITLY requesting a *change* to the note text (using keywords like "add", "remove", "change", "rewrite", etc.).
2.  **Execute Correct Function:** Follow the corresponding function below (Answer Questions, Generate Image, Modify Note, or General Chat).
3.  **Provide Suggestions (Conditional):** Conclude your response with relevant suggestions, **UNLESS** you just generated an image.

**Functions (Strict Order of Priority):**

1.  **Answer Questions (Highest Priority - Use Text Model):**
    *   **PRIORITY 1A: Questions *About* the Note/Images:** Provide direct, helpful answers based primarily on the "Current Note Content" **and any relevant attached images/files.** Use natural phrasing, avoid robotics. If info is missing, state so naturally and supplement with general knowledge if appropriate, clearly indicating its origin.
    *   **PRIORITY 1B: General Knowledge Questions:** Answer accurately using your broad world knowledge.
    *   **CRITICAL:** **DO NOT** propose an edit (JSON response) if the user is only asking for information or clarification.

2.  **Generate Image (ONLY if EXPLICITLY Asked - Use Imagen 3 Model - NO JSON Output):**
    *   **TRIGGER:** Activate **ONLY** for explicit image generation requests ("generate image", "create picture", "draw", "show me image of", etc.).
    *   **ACTION (Imagen 3):** Use the \`${IMAGEN_3_MODEL}\` model. **CRITICAL: You MUST consider the "Current Note Content" provided below AND the user's specific description** to generate a relevant image. The note content provides context.
    *   **OUTPUT:** Your response should contain the generated image data directly (via \`inlineData\`). You MAY include a brief preceding text (e.g., "Okay, here's an image based on the note and your request:"). Keep text concise.
    *   **CRITICAL (NO DIRECT NOTE EDIT):** You **CANNOT** add the generated image *directly* into the note text yourself. If the user asks to "add the image to the note", respond: "I've generated the image for you! You can add it to the note using the 'Add to Note' button below the image." **Do not propose a JSON edit for image insertion.**
    *   **FALLBACK:** If generation fails/blocked, explain why clearly IN TEXT.
    *   **CRITICAL (NO SUGGESTIONS):** **DO NOT** provide suggestions after an image generation attempt (success or failure).

3.  **Modify Note (ONLY if EXPLICITLY Asked & Not Image Gen - Requires JSON Output - Use Text Model):**
    *   **TRIGGER:** Propose an edit **ONLY** for explicit change requests ("add", "remove", "change", "rewrite", etc.). Use the \`${GEMINI_TEXT_MODEL}\` model.
    *   **Choose ONE Method (A, B, or C) per response. Ensure JSON is valid.**
    *   **CRITICAL - NO CODE LEAKS:** Natural chat text first, then the JSON block. Structured data (markdown, etc.) ONLY inside the JSON.
        *   **Method A: Single Targeted Edit:** (Preferred for one change) ... [JSON structure same as before] ...
        *   **Method B: Sequential Edits:** (For multiple changes in one message) ... [JSON structure same as before, ensure target_context considers prior steps] ...
        *   **Method C: Full Content Replacement:** (Major overhauls only) ... [JSON structure same as before] ...

4.  **General Chat (Use Text Model):**
    *   Engage conversationally if the input doesn't fit other categories.

5.  **Generate Suggestions (Conditional - Text Model - See Rule #3 Above):**
    *   **MANDATORY (Unless Generating Image):** **ALWAYS** conclude every Text Model response with exactly 3 relevant follow-up suggestions enclosed in \`[SUGGESTIONS]...[/SUGGESTIONS]\` tags. Base them on context (note, chat, files, last interaction). Phrased as user actions/questions.

**Important Reminders & Constraints:**

*   **Context is Key:** Use Current Note Content, Chat History, and Attached Files.
*   **Image Interpretation:** You **CAN** interpret user-attached images/PDFs.
*   **Imagen 3 Context:** When generating images, **USE THE NOTE CONTENT** for context along with the user's prompt.
*   **Explicit Intent:** Wait for clear commands/keywords for edits/image gen.
*   **Image Embedding Limitation:** Explain the 'Add to Note' button workflow *only if asked* to add the generated image. Do not propose JSON edits for this.
*   **Suggestion Exclusion:** **No suggestions** after image generation.
*   **Follow Hierarchy:** Answer Questions > Generate Image > Modify Note > General Chat. Append Suggestions (unless excluded).
*   **Accuracy of target_context:** Critical for edits. Must exist in note *at the time of the edit step*.
*   **No JSON/Code Leaks (Outside Edit JSON):** Keep chat text clean.
*   **Suggestion Format Adherence:** Strict \`[SUGGESTIONS]\` format, 3 items, new lines.

**Current Note Content (For Context/Image Generation):**
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
            // --- END SYSTEM INSTRUCTION ---

            try {
                const targetModel = isUsingImageGenModel ? IMAGEN_3_MODEL : GEMINI_TEXT_MODEL;
                const fullGeminiEndpoint = `${GEMINI_API_BASE}${targetModel}:generateContent?key=${geminiApiKey}`;

                // --- Generation Config ---
                let generationConfig: any = {
                    // temperature: isUsingImageGenModel ? 0.8 : 0.6, // Adjust temperature if needed
                    // maxOutputTokens: isUsingImageGenModel ? 1024 : 8192,
                    // topP: 0.95,
                    // topK: isUsingImageGenModel ? 40 : undefined // TopK might be relevant for image gen
                };
                // Ensure response modalities are set correctly for image gen if API requires
                 // if (isUsingImageGenModel) {
                 //     generationConfig.responseMimeType = "application/json"; // Or whatever Imagen API expects
                 //     // generationConfig.responseModalities = ["TEXT", "IMAGE"]; // Example if needed
                 // } else {
                 //     generationConfig.responseMimeType = "text/plain";
                 // }
                 // NOTE: The exact config parameters for Imagen 3 might differ significantly.
                 // Sticking to simpler config for now.
                 generationConfig = {
                    temperature: isUsingImageGenModel ? 0.7 : 0.6,
                    maxOutputTokens: 8192, // Keep higher limit for now
                 }


                // --- Build API Content Payload ---
                const apiContent: any[] = [];
                // Add system instruction first
                apiContent.push({ role: "user", parts: [{ text: systemInstruction }]});
                apiContent.push({ role: "model", parts: [{ text: "Okay, I understand. I'm ready to help." }]}); // Priming

                // Add recent history (filtered)
                recentHistory.forEach(msg => { /* ... same logic as before ... */ });

                // Add the current user message (with files for text model)
                 const currentUserParts: any[] = [{ text: messageContent }];
                 if (currentFiles.length > 0 && !isUsingImageGenModel) { // Only include files for TEXT model
                     currentFiles.forEach(file => {
                         if (file.type.startsWith('image/') || file.type === 'application/pdf') { // Filter supported types
                             currentUserParts.push({ inline_data: { mime_type: file.type, data: file.base64Data } });
                         }
                     });
                 }
                 if (currentUserParts[0].text || currentUserParts.length > 1) {
                      apiContent.push({ role: "user", parts: currentUserParts });
                 }


                // Filter consecutive roles (same logic as before)
                const filteredApiContent = apiContent.reduce(/* ... */);

                let requestBody = JSON.stringify({ contents: filteredApiContent, generationConfig });
                const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };

                // --- API Call & Response Parsing ---
                const response = await fetchWithRetry(fullGeminiEndpoint, geminiOptions);
                const responseText = await response.text();
                const parsedResult = parseGeminiResponse(responseText, isUsingImageGenModel);

                // --- Update Chat History with AI Response ---
                if (isUsingImageGenModel) { setSuggestedPrompts([]); } else { setSuggestedPrompts(parsedResult.suggestions); }

                let assistantFinalMessage: ChatMessage = {
                    id: newLoadingMsgId, // Use loading ID to replace
                    role: 'assistant',
                    content: parsedResult.text || (parsedResult.imageData ? "" : "(No text content received)"),
                    imageData: parsedResult.imageData,
                    error: !!parsedResult.error,
                    isEditSuggestion: false,
                    wasImageGenerated: isUsingImageGenModel && !!parsedResult.imageData && !parsedResult.error,
                    canAddToNote: isUsingImageGenModel && !!parsedResult.imageData && !parsedResult.error, // Add flag for button
                };

                // Handle errors
                if (parsedResult.error) {
                    assistantFinalMessage.content = parsedResult.error;
                    assistantFinalMessage.imageData = null;
                    assistantFinalMessage.error = true;
                    assistantFinalMessage.wasImageGenerated = false;
                    assistantFinalMessage.canAddToNote = false;
                    setSuggestedPrompts([]); // Clear suggestions on error
                }

                // Parse JSON for edit proposals (only if not image gen)
                if (!isUsingImageGenModel && !assistantFinalMessage.error && parsedResult.text) {
                    // ... (JSON parsing logic remains the same as previous version) ...
                     const jsonMatch = parsedResult.text.match(/```json\s*([\s\S]*?)\s*```/);
                     if (jsonMatch && jsonMatch[1]) {
                         // ... [rest of JSON parsing and validation] ...
                         // If JSON is valid and parsed:
                         // assistantFinalMessage.isEditSuggestion = true;
                         // assistantFinalMessage.canAddToNote = false; // Cannot add image if it's an edit proposal
                         // assistantFinalMessage.wasImageGenerated = false;
                         // assistantFinalMessage.imageData = undefined;
                         // assistantFinalMessage.content = remainingText || explanation;
                     }
                }

                // Handle empty valid responses
                 if (!assistantFinalMessage.content?.trim() && !assistantFinalMessage.imageData && !assistantFinalMessage.error && !assistantFinalMessage.isEditSuggestion && !assistantFinalMessage.timer) {
                     assistantFinalMessage.content = isUsingImageGenModel ? "(Image generation resulted in empty content)" : "(Received empty response)";
                     // Don't mark as error unless API indicated one
                 }

                // Final state update
                setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? assistantFinalMessage : msg ));

            } catch (err: any) {
                 console.error("API Call Failed:", err);
                 const errorMsg = err instanceof Error ? err.message : 'Unknown error processing request.';
                 const errorFinalMessage: ChatMessage = {
                     id: newLoadingMsgId, role: 'assistant', content: `❌ ${errorMsg}`, error: true,
                     isGeneratingImage: false, wasImageGenerated: false, canAddToNote: false,
                 };
                 setChatHistory(prev => prev.map(msg => msg.id === newLoadingMsgId ? errorFinalMessage : msg ));
                 setSuggestedPrompts([]);
             } finally {
                 setIsChatLoading(false);
                 setLoadingMsgId(null);
                 // Don't automatically turn off image gen mode anymore
             }
        };

        // --- Event Handlers (Submit, KeyDown, TextareaInput, SuggestionClick) ---
        // remain largely the same, handleChatSubmit clears files only if not image gen mode

        const handleChatSubmit = async (e?: React.FormEvent) => {
            e?.preventDefault();
            const currentMessage = chatMessage.trim();
            // Validation checks adjusted
            if ((!currentMessage && selectedFiles.length === 0 && !isImageGenModeActive) ||
                (!currentMessage && isImageGenModeActive)) {
                if(isImageGenModeActive && !currentMessage) {
                     setChatHistory(prev => [...prev, { id: `img-prompt-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Please describe the image you want to generate.`, error: false }]);
                }
                return;
            }
            // Check if image gen is active but files are attached
            if (isImageGenModeActive && selectedFiles.length > 0) {
                 setChatHistory(prev => [...prev, { id: `img-mode-file-err-${Date.now()}`, role: 'assistant', content: `ℹ️ Image Generation mode is active. Please remove attached files before generating an image.`, error: false }]);
                 return;
            }

            const filesToSubmit = [...selectedFiles]; // Copy files to send
            setChatMessage(''); // Clear input immediately
            // Clear selected files state *only if not* in image gen mode
            if (!isImageGenModeActive) {
                setSelectedFiles([]);
            }
            await submitMessageToAI(currentMessage, filesToSubmit, isImageGenModeActive);
            if (textareaRef.current) { // Reset textarea height
                textareaRef.current.style.height = 'auto';
            }
        };
         const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } };
         const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => { const ta = e.currentTarget; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`; setChatMessage(ta.value); };
         const handleSuggestionClick = (suggestion: string) => {
             // Turn off image gen mode when a suggestion is clicked
             if (isImageGenModeActive) {
                  setIsImageGenModeActive(false);
             }
             setSelectedFiles([]); // Clear any lingering files when using suggestion
             setChatMessage(''); // Clear input field
             submitMessageToAI(suggestion);
         };

        // --- Imperative Handle (Expose methods to parent) ---
        useImperativeHandle(ref, () => ({
             sendMessage: (message: string) => {
                 if (isImageGenModeActive) setIsImageGenModeActive(false); // Turn off img gen
                 setSelectedFiles([]); // Clear files
                 setChatMessage(''); // Clear input
                 submitMessageToAI(message);
             },
             focusInput: () => {
                 textareaRef.current?.focus();
             }
        }));

        // --- Component Render ---
        const rootClasses = displayMode === 'overlay'
            ? `fixed bottom-4 right-4 z-50 ${overlayBg} rounded-lg w-full max-w-sm flex flex-col shadow-xl transition-all duration-300 ease-in-out ${isMinimized ? 'h-12 overflow-hidden' : 'h-[75vh] max-h-[650px]'}`
            : `h-full w-full flex flex-col ${overlayBg}`; // Inline mode takes full available space

        if (displayMode === 'overlay' && !isVisible) return null;

        return (
            <div className={rootClasses}>
                {/* Header */}
                 <div className={`p-2 border-b ${headerBg} flex justify-between items-center shrink-0 sticky top-0 z-10 ${displayMode === 'overlay' ? 'cursor-pointer' : ''}`} onClick={displayMode === 'overlay' ? () => setIsMinimized(!isMinimized) : undefined} title={displayMode === 'overlay' ? (isMinimized ? "Expand" : "Minimize") : undefined}>
                     <h3 className={`text-sm font-semibold ${headingColor} flex items-center gap-1.5 truncate pr-2`}>
                         <MessageCircle className={`w-4 h-4 shrink-0 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} />
                         <span className="truncate" title={`Chat: ${note.title}`}>Chat: {note.title}</span>
                         {isImageGenModeActive && <ImageIcon className={`w-3 h-3 shrink-0 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} title="Image Generation Mode"/>}
                     </h3>
                     {/* Header Controls */}
                      <div className="flex items-center">
                         {displayMode === 'overlay' && (
                             <>
                             <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className={`${iconColor} rounded-full p-1 mr-1`} title={isMinimized ? "Expand" : "Minimize"}>
                                 {isMinimized ? <Maximize className="w-3 h-3" /> : <Minimize className="w-3 h-3" />}
                             </button>
                             <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${iconColor} rounded-full p-1`} title="Close">
                                 <X className="w-4 h-4" />
                             </button>
                             </>
                         )}
                         {displayMode === 'inline' && ( // Close button for inline mode (closes PDF view)
                             <button onClick={onClose} className={`${iconColor} rounded-full p-1`} title="Close Chat & PDF View">
                                 <X className="w-4 h-4" />
                             </button>
                         )}
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
                                const showDownloadButton = message.imageData && !message.error; // Show for generated or uploaded
                                const showAddToNoteButton = message.canAddToNote && message.imageData && !message.error; // Only for generated

                                return (
                                    <div key={message.id || index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm break-words ${bubbleClass}`}>
                                            {/* Loading Indicator */}
                                            {isCurrentLoadingMsg ? (
                                                <div className={`flex items-center gap-2 p-1 ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}> <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">{message.isGeneratingImage ? "Generating image..." : "Thinking..."}</span> </div>
                                            ) : null}
                                            {/* Message Content */}
                                            {message.content ? ( <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className={proseClass} components={{ /* component overrides */ }}>{message.content}</ReactMarkdown> ) : null}
                                            {/* Image Display */}
                                            {message.imageData && (
                                                 <div className={`relative group mt-1.5 ${message.content ? 'border-t pt-1.5' : ''} ${isIlluminateEnabled ? 'border-gray-300/50' : 'border-gray-600/50'}`}>
                                                     <img src={`data:${message.imageData.type};base64,${message.imageData.base64}`} alt={message.imageData.name || "Chat Image"} className="max-w-full h-auto max-h-60 object-contain rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`data:${message.imageData.type};base64,${message.imageData.base64}`, '_blank')}} title={`Click to view full image: ${message.imageData.name || (message.wasImageGenerated ? 'Generated Image' : 'Uploaded Image')}`} />
                                                      {/* Image Action Buttons */}
                                                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                                                          {showAddToNoteButton && (
                                                              <button onClick={(e) => { e.stopPropagation(); onAddImageToNoteRequest(message.imageData!); }} className={`p-1 rounded ${addToNoteButtonClass}`} title="Add Image to Note"> <AddToNoteIcon className="w-3.5 h-3.5" /> </button>
                                                          )}
                                                           {showDownloadButton && (
                                                              <button onClick={(e) => { e.stopPropagation(); handleDownloadImage(message.imageData!); }} className={`p-1 rounded ${downloadButtonClass}`} title="Download Image"> <Download className="w-3.5 h-3.5" /> </button>
                                                          )}
                                                      </div>
                                                 </div>
                                            )}
                                            {/* Timer Display */}
                                            {message.timer && ( <div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-2 py-1 text-xs border ${isIlluminateEnabled ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-800/60 border-gray-600 text-blue-300'}`}><TimerIcon className="w-3.5 h-3.5"/> <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled}/></div></div> )}
                                            {/* Edit/Revert Buttons */}
                                            {message.isEditSuggestion && message.editAction && !isChatLoading && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-yellow-300/50 dark:border-yellow-700/50"> <button onClick={() => handleAcceptEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-yellow-100' : 'hover:bg-yellow-700/50'} `} disabled={isChatLoading} > <Check className="w-3.5 h-3.5" /> Apply Update{message.editAction === 'propose_sequential_edits' && message.sequentialEdits && message.sequentialEdits.length > 1 ? ` (${message.sequentialEdits.length} steps)` : ''} </button> </div> )}
                                            {message.isUpdateConfirmation && message.canRevert && !message.error && ( <div className="mt-2 border-t pt-1.5 flex justify-end border-green-300/50 dark:border-green-700/50"> <button onClick={() => handleRevertEdit(message)} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 hover:brightness-110 ${isIlluminateEnabled ? 'hover:bg-gray-200' : 'hover:bg-gray-600'}`} disabled={isChatLoading} title="Revert this change" > <RefreshCcw className="w-3.5 h-3.5" /> Revert </button> </div> )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} className="h-0"></div> {/* Scroll target */}
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
                                 {/* Textarea Input */}
                                 <textarea ref={textareaRef} rows={1} value={chatMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={isChatLimitReached ? "Monthly chat limit reached..." : isImageGenModeActive ? "Describe image (uses note context)..." : "Ask, edit note, or attach file..."} className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:outline-none resize-none overflow-y-auto max-h-[100px] leading-snug ${isChatLoading || isChatLimitReached || isLoadingUsage ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={isChatLoading || isChatLimitReached || isLoadingUsage} style={{ height: 'auto' }} aria-label="Chat input" />
                                 {/* Hidden File Input */}
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,application/pdf" className="hidden" disabled={isImageGenModeActive} />
                                 {/* Attach File Button */}
                                 <button type="button" onClick={triggerFileSelect} disabled={isChatLoading || isLoadingUsage || isImageGenModeActive} className={`${buttonSecondaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isImageGenModeActive ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} title={isImageGenModeActive ? "Image Generation mode active (no attachments)" : "Attach Files (Image/PDF)"}> <Paperclip className="w-4 h-4" /> </button>
                                 {/* Image Generation Toggle Button */}
                                 <button type="button" onClick={handleToggleImageGenMode} disabled={isChatLoading || isLoadingUsage || isChatLimitReached} className={`${imageGenButtonClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${isChatLoading || isLoadingUsage || isChatLimitReached ? buttonDisabledClass : 'hover:scale-105 active:scale-100'} ${isImageGenModeActive ? 'ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 dark:ring-offset-black' : ''}`} title={isImageGenModeActive ? "Switch to Text/File Mode" : "Switch to Image Generation Mode"}> <ImageIcon className="w-4 h-4" /> </button>
                                 {/* Send Button */}
                                 <button type="submit" disabled={isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (!chatMessage.trim() && isImageGenModeActive) || (isImageGenModeActive && selectedFiles.length > 0) } className={`${buttonPrimaryClass} p-2 rounded-full self-end mb-[1px] transition-all duration-150 ${(isChatLoading || isLoadingUsage || isChatLimitReached || (!chatMessage.trim() && selectedFiles.length === 0 && !isImageGenModeActive) || (!chatMessage.trim() && isImageGenModeActive) || (isImageGenModeActive && selectedFiles.length > 0)) ? buttonDisabledClass : 'hover:scale-105 active:scale-100'}`} title="Send message"> {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} </button>
                             </form>
                         </div>
                    </>
                )}
            </div>
        );
    }
);

NoteChat.displayName = 'NoteChat';
