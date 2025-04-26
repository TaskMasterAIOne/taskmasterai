import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    BrainCircuit, X, PlusCircle, Sparkles, Send, TimerIcon, CheckCircle,
    Play, Pause, RotateCcw, Edit, Trash, Lock, MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth'; // Import User type

import { Timer } from './Timer';
import { FlashcardsQuestions } from './FlashcardsQuestions';
import { UserTier, getChatLimitForTier, updateUserChatUsage } from '../lib/current-paying-user'; // Import necessary functions
import { ItemType, CollectionName, geminiApiKey, createItem, updateItem, deleteItem, findItemByName, calculatePriority } from '../lib/dashboard-firebase'; // Import necessary functions/types
import { UserContext } from '../lib/ai-context-firebase';
import {
    createChatConversation,
    saveChatMessage,
    updateChatConversationName,
    ChatMessage as FirebaseChatMessage // Import underlying type
} from '../lib/ai-chat-firebase'; // Import necessary chat functions

// --- Types ---
// (Keep existing types: AiActionRecommendationData, BaseChatMessage, DisplayChatMessage, Conversation)

interface AiActionRecommendationData {
    id: string;
    action: 'create' | 'update' | 'delete';
    itemType: ItemType;
    payload: any;
    reasoning: string;
}

interface BaseChatMessage {
    role: 'user' | 'assistant';
    content: string;
    createdAt?: Timestamp; // Use Firestore Timestamp
    error?: boolean | string;
    timer?: { type: 'timer'; duration: number; id: string };
    flashcard?: { type: 'flashcard'; data: any[] };
    question?: { type: 'question'; data: any[] };
}

interface DisplayChatMessage extends BaseChatMessage {
    id: string; // Unique ID for React key
    recommendation?: AiActionRecommendationData;
}

interface Conversation {
    id: string;
    data: {
        chatName?: string;
        createdAt?: Timestamp;
        lastActivity?: Timestamp;
        nameGenerated?: boolean;
    };
}


// --- Gemini Utilities (Moved here) ---
const geminiChatEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${geminiApiKey}&alt=sse`;
const geminiProEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000): Promise<Response> => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') { throw new Error('Request timed out'); }
    throw error;
  }
};

const streamResponse = async ( url: string, options: RequestInit, onStreamUpdate: (rawChunkAccumulated: string) => void, timeout = 45000 ): Promise<string> => {
    try {
        // console.log("Streaming Request:", url); // Simplified log
        const response = await fetchWithTimeout(url, options, timeout);
        // console.log("Stream Response Status:", response.status);
        if (!response.ok) {
            let errorBody = ''; try { errorBody = await response.text(); } catch {}
            console.error("Stream API Error:", response.status, errorBody);
            try { const errorJson = JSON.parse(errorBody); if (errorJson?.error?.message) throw new Error(`API Error (${response.status}): ${errorJson.error.message}`); }
            catch { throw new Error(`API Request Failed (${response.status}): ${response.statusText} ${errorBody || ''}`); }
            throw new Error(`API Request Failed (${response.status}): ${response.statusText}`); // Fallback
        }
        if (!response.body) { throw new Error("Expected streaming response but got non-streamed body."); }
        const reader = response.body.getReader(); const decoder = new TextDecoder("utf-8"); let done = false; let accumulatedRawText = "";
        while (!done) {
            const { value, done: doneReading } = await reader.read(); done = doneReading;
            if (value) { const rawChunk = decoder.decode(value, { stream: !done }); accumulatedRawText += rawChunk; onStreamUpdate(accumulatedRawText); }
        }
        return accumulatedRawText;
    } catch (error) { console.error("Streaming Error Caught:", error); throw new Error(`Streaming failed: ${(error as Error).message || 'Unknown streaming error'}`); }
};

const extractCandidateText = (rawResponseText: string): { text: string; error?: string; finishReason?: string } => {
    let combinedText = ""; let streamError: string | undefined = undefined; let streamFinishReason: string | undefined = undefined;
    try {
        const jsonLines = rawResponseText.trim().split('\n');
        for (const line of jsonLines) {
            if (line.startsWith('data: ')) {
                const jsonString = line.substring(6).trim(); if (!jsonString) continue;
                try {
                    const parsedJson = JSON.parse(jsonString);
                    if (parsedJson.candidates?.[0]?.content?.parts?.[0]?.text) { combinedText += parsedJson.candidates[0].content.parts[0].text; }
                    const candidate = parsedJson.candidates?.[0];
                    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                        streamFinishReason = candidate.finishReason; // console.warn("Gemini FinishReason:", streamFinishReason);
                        if (streamFinishReason === 'SAFETY') streamError = "Stopped: safety.";
                        else if (streamFinishReason === 'MAX_TOKENS') streamError = "Stopped: max tokens.";
                        else streamError = `Stopped: ${streamFinishReason}.`;
                    } else if (parsedJson.error?.message) streamError = `API Error: ${parsedJson.error.message}`;
                    else if (parsedJson.promptFeedback?.blockReason) { streamFinishReason = "BLOCKED"; streamError = `Blocked: ${parsedJson.promptFeedback.blockReason}`; }
                } catch (e) { /* Incomplete JSON is expected */ }
            }
        }
        return { text: combinedText.replace(/^Assistant:\s*/, '').trim(), error: streamError, finishReason: streamFinishReason };
    } catch (err) { console.error("Error extracting text:", err); return { text: "", error: "Error extracting text from stream.", finishReason: "ERROR" }; }
};


// --- Helper Functions ---
const getChatDisplayName = (conv: Conversation): string => {
    if (conv.data?.chatName && conv.data.chatName.trim() !== "") {
        return conv.data.chatName.trim();
    }
    if (conv.data?.createdAt?.seconds) {
        const date = new Date(conv.data.createdAt.seconds * 1000);
        return `Chat ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
    return `Chat ${conv.id.substring(0, 6)}`;
};

const parseTimerRequest = (message: string): number | null => {
    const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i;
    const match = message.match(timeRegex); if (!match) return null;
    const amount = parseInt(match[1]); const unit = match[2].toLowerCase(); if (isNaN(amount) || amount <= 0) return null;
    if (unit.startsWith('hour') || unit.startsWith('hr')) return amount * 3600;
    if (unit.startsWith('min')) return amount * 60;
    if (unit.startsWith('sec')) return amount;
    return null;
};

const getTitleField = (itemData: any): string => { // Helper needed locally now
    if (itemData.task !== undefined) return 'task'; if (itemData.goal !== undefined) return 'goal'; if (itemData.project !== undefined) return 'project'; if (itemData.plan !== undefined) return 'plan'; if (itemData.text !== undefined) return 'text'; return 'task';
};

// --- Props Interface ---
interface AiChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null; // Need the full user object
    userName: string;
    userTier: UserTier;
    userContext: UserContext | null;
    // Pass item data directly
    tasks: Array<{ id: string; data: any }>;
    goals: Array<{ id: string; data: any }>;
    projects: Array<{ id: string; data: any }>;
    plans: Array<{ id: string; data: any }>;
    // Pass conversation data
    chatConversations: Conversation[];
    selectedConversationId: string | null;
    onSelectConversation: (id: string | null) => void; // Still need parent to manage selection state
    currentChatHistory: DisplayChatMessage[]; // Receive the history for the selected conv
    isConversationsLoading: boolean;
    isMessagesLoading: boolean;
    // Initial chat usage state
    initialChatCount: number;
    initialChatMonth: string;
    // Theming props
    cardClass: string;
    illuminateBorder: string;
    inputBg: string;
    iconColor: string;
    illuminateTextBlue: string;
    illuminateTextPurple: string;
    subheadingClass: string;
    illuminateBgHover: string;
    headingClass: string;
    isIlluminateEnabled: boolean;
    // Callback if an action needs broader app state update (e.g., maybe notification?) - optional for now
    // onActionTaken?: (action: AiActionRecommendationData['action'], itemType: ItemType) => void;
}

// --- Component ---
export function AiChatSidebar({
    isOpen,
    onClose,
    user, // Receive user object
    userName,
    userTier,
    userContext,
    // Receive item data
    tasks,
    goals,
    projects,
    plans,
    // Receive conversation data
    chatConversations,
    selectedConversationId,
    onSelectConversation,
    currentChatHistory, // Receive history for display
    isConversationsLoading,
    isMessagesLoading,
    // Receive initial usage state
    initialChatCount,
    initialChatMonth,
    // Theming props
    cardClass,
    illuminateBorder,
    inputBg,
    iconColor,
    illuminateTextBlue,
    illuminateTextPurple,
    subheadingClass,
    illuminateBgHover,
    headingClass,
    isIlluminateEnabled,
    // onActionTaken,
}: AiChatSidebarProps) {

    // --- Internal State Management ---
    const [chatMessage, setChatMessage] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false); // AI response loading
    const [aiSidebarTab, setAiSidebarTab] = useState<'chat' | 'insights'>('chat');
    const [aiGeneratedInsights, setAiGeneratedInsights] = useState<{ score?: number; timeManagement?: string; conflicts?: string; other?: string; error?: string | null; isLoading: boolean; lastGeneratedSig: string | null; }>({ isLoading: false, lastGeneratedSig: null });
    const [hasGeneratedChatNameForCurrentConv, setHasGeneratedChatNameForCurrentConv] = useState(false);
    // Manage chat usage state internally, initialized by props
    const [chatCount, setChatCount] = useState(initialChatCount);
    const [chatMonth, setChatMonth] = useState(initialChatMonth);
    const [isChatLimitReached, setIsChatLimitReached] = useState(false);
    // Need internal state for the messages to display, as the prop only reflects the saved state
    const [displayHistory, setDisplayHistory] = useState<DisplayChatMessage[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- Update internal display history when prop changes ---
    useEffect(() => {
        setDisplayHistory(currentChatHistory);
    }, [currentChatHistory]);

     // --- Update internal chat usage state when initial props change ---
     useEffect(() => {
        setChatCount(initialChatCount);
        setChatMonth(initialChatMonth);
        const limit = getChatLimitForTier(userTier);
        setIsChatLimitReached(limit !== Infinity && initialChatCount >= limit);
    }, [initialChatCount, initialChatMonth, userTier]);

    // --- Update generated name flag when conversation changes ---
     useEffect(() => {
        const currentConv = chatConversations.find(c => c.id === selectedConversationId);
        setHasGeneratedChatNameForCurrentConv(currentConv?.data?.nameGenerated || false);
    }, [selectedConversationId, chatConversations]);

    // Scroll Effect
    useEffect(() => {
        if (chatEndRef.current && isOpen && aiSidebarTab === 'chat') {
            const animationFrameId = requestAnimationFrame(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
            return () => cancelAnimationFrame(animationFrameId);
        }
        // Use displayHistory here as it controls what's rendered
    }, [displayHistory, isOpen, aiSidebarTab]);

    // Memoize sorted conversations
    const sortedConversations = useMemo(() => {
        return [...chatConversations].sort((a, b) =>
            (b.data?.lastActivity?.seconds ?? b.data?.createdAt?.seconds ?? 0) -
            (a.data?.lastActivity?.seconds ?? a.data?.createdAt?.seconds ?? 0)
        );
    }, [chatConversations]);

    const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

    // --- Internal Logic Functions ---

    const formatItemsForChat = useCallback(() => {
        const lines: string[] = []; lines.push(`Current items for ${userName}:\n`);
        const formatLine = (item: any, type: string) => { const name = item.data[type] || item.data.text || 'Untitled'; const due = item.data.dueDate?.toDate?.(); const priority = item.data.priority || calculatePriority(item); const completed = item.data.completed ? 'Yes' : 'No'; return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${name}${ due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '' } [Priority: ${priority}] [Completed: ${completed}] [ID: ${item.id}]`; };
        const allItemsMap = { tasks, goals, projects, plans };
        if (tasks.length === 0 && goals.length === 0 && projects.length === 0 && plans.length === 0) { return `No active items found for ${userName}.`; }
        // Assumes 'availableTabs' is implicitly defined or passed if needed for filtering sections (removed for simplicity)
         Object.entries(allItemsMap).forEach(([type, items]) => {
             if (items.length > 0) {
                 lines.push(`\n--- ${type.charAt(0).toUpperCase() + type.slice(1)} ---`);
                 items.forEach((item) => lines.push(formatLine(item, type.slice(0, -1))));
             }
         });
        return lines.join('\n');
    }, [userName, tasks, goals, projects, plans]); // Dependencies on props

    const executeAiAction = useCallback(async (recommendation: AiActionRecommendationData) => {
        if (!user) { console.error("Cannot execute action: No user."); return; }
        console.log("Executing AI action:", recommendation);
        const { action, itemType, payload } = recommendation;
        if (!action || !itemType || !payload) { /* ... error handling ... */ return; }
        try {
            let confirmationMessage = '';
            if (action === 'create') {
                let dateValue: Date | null = null; if (payload.dueDate) { try { const d = new Date(payload.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) dateValue = d; } catch {} }
                const titleField = itemType.slice(0, -1);
                const createPayload = { [titleField]: payload.text || 'AI Item', text: payload.text || 'AI Item', dueDate: dateValue, priority: payload.priority || 'medium', completed: false, createdAt: Timestamp.now() };
                await createItem(user.uid, itemType, createPayload); // Use imported function
                confirmationMessage = `✅ Created ${itemType.slice(0,-1)}: "${payload.text || 'AI Item'}".`;
            } else if (action === 'update') {
                let itemIdToUpdate = payload.itemId; const titleField = itemType.slice(0, -1);
                if (!itemIdToUpdate && payload.itemName) { try { itemIdToUpdate = await findItemByName(itemType, user.uid, payload.itemName, titleField); } catch { throw new Error(`Could not find ${itemType.slice(0,-1)}: "${payload.itemName}".`); } }
                if (!itemIdToUpdate) throw new Error(`Could not identify ${itemType.slice(0,-1)} to update.`);
                const { itemId, itemName, ...updates } = payload; if (updates.dueDate) { try { const d = new Date(updates.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) updates.dueDate = d; else delete updates.dueDate; } catch { delete updates.dueDate; } } else if (updates.dueDate === null || updates.dueDate === '') { updates.dueDate = null; }
                if (updates[titleField] !== undefined) updates.text = updates[titleField]; delete updates.itemId; delete updates.itemName; delete updates.createdAt; if (Object.keys(updates).length === 0) throw new Error("No valid fields for update.");
                await updateItem(itemType, itemIdToUpdate, updates); // Use imported function
                confirmationMessage = `✅ Updated ${itemType.slice(0,-1)}.`;
            } else if (action === 'delete') {
                let itemIdToDelete = payload.itemId; const titleField = itemType.slice(0, -1);
                if (!itemIdToDelete && payload.itemName) { try { itemIdToDelete = await findItemByName(itemType, user.uid, payload.itemName, titleField); } catch { throw new Error(`Could not find ${itemType.slice(0,-1)}: "${payload.itemName}".`); } }
                if (!itemIdToDelete) throw new Error(`Could not identify ${itemType.slice(0,-1)}: "${payload.itemName || 'N/A'}".`);
                await deleteItem(itemType, itemIdToDelete); // Use imported function
                confirmationMessage = `✅ Deleted ${itemType.slice(0,-1)}.`;
            } else { throw new Error(`Unsupported action: ${action}`); }

            // Add confirmation message to display history locally
            const confirmMsg: DisplayChatMessage = { id: `action-confirm-${Date.now()}`, role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() };
            setDisplayHistory(prev => [...prev, confirmMsg]);
            if (selectedConversationId) {
                 saveChatMessage(selectedConversationId, { role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() }).catch(e => console.error("Failed to save confirmation:", e));
            }
            // Optionally call onActionTaken if provided
            // if (onActionTaken) onActionTaken(action, itemType);

        } catch (error: any) {
            console.error("Error executing AI action:", error);
            const errorMsgContent = `❌ Error executing action: ${error.message || 'Unknown error'}.`;
            const errorMsg: DisplayChatMessage = { id: `action-error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() };
             setDisplayHistory(prev => [...prev, errorMsg]);
             if (selectedConversationId) {
                 saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }).catch(e => console.error("Failed to save action error:", e));
             }
        }
    }, [user, selectedConversationId]); // Dependencies: user, selectedConversationId

     const handleTimerComplete = useCallback((timerId: string) => {
        const completionMsgContent = `⏰ Timer finished!`;
        const completionMsg: DisplayChatMessage = { id: `timer-complete-${timerId}-${Date.now()}`, role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() };
        setDisplayHistory(prev => [...prev, completionMsg]);
        if (selectedConversationId) {
            saveChatMessage(selectedConversationId, { role: 'assistant', content: completionMsgContent, createdAt: Timestamp.now() })
                .catch(e => console.error("Failed to save timer completion message:", e));
        }
    }, [selectedConversationId]);


    const generateDynamicChatName = useCallback(async (convId: string, history: DisplayChatMessage[]) => {
        if (!user || !geminiApiKey) return;
        const conversationText = history.slice(-6).map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content}`).join('\n');
        const namePrompt = `Based on this recent conversation snippet, suggest a very short (3-5 words max) title. Output ONLY the title, nothing else.\nExample: "Planning Project X" or "Grocery List Update"\n\nConversation:\n${conversationText}`;
        console.log("Generating chat name for:", convId);
        try {
            const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }] }], generationConfig: { maxOutputTokens: 15, temperature: 0.5 }, safetySettings: [ /* ... safety ... */ ] }), };
            const response = await fetchWithTimeout(geminiProEndpoint, options, 15000);
            if (!response.ok) throw new Error(`Name generation failed (${response.status}): ${await response.text()}`);
            const resultJson = await response.json();
            let generatedName = "Chat Summary";
            if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) { generatedName = resultJson.candidates[0].content.parts[0].text.trim().replace(/["']/g, ''); if (generatedName.length > 30 || generatedName.toLowerCase().includes("title:") || generatedName.toLowerCase().includes("summary:")) { generatedName = "Chat Summary"; } }
            console.log(`Generated name for ${convId}:`, generatedName);
            await updateChatConversationName(convId, generatedName, true); // Update Firestore
            setHasGeneratedChatNameForCurrentConv(true); // Update local flag
        } catch (err) { console.error('Error generating chat name:', err); }
    }, [user, userName]); // Dependencies


    const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMessage.trim() || isChatLoading || !user || !selectedConversationId) return;

        // Limit Check (uses internal state now)
        const currentMonthYear = new Date().toISOString().slice(0, 7); let limitReached = false;
        if (userTier !== 'premium') { let currentCount = chatCount; if (chatMonth !== currentMonthYear) { currentCount = 0; setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; updateUserChatUsage(user.uid, 0, currentMonthYear).catch(err => console.error("Usage reset err:", err)); } else { limitReached = currentCount >= currentChatLimit; setIsChatLimitReached(limitReached); } }
        if (limitReached) { /* ... show limit message ... */ return; }

        // User Message
        const currentMessage = chatMessage; setChatMessage('');
        const timerDuration = parseTimerRequest(currentMessage);
        const userMsgData: FirebaseChatMessage = { role: 'user', content: currentMessage, createdAt: Timestamp.now() };
        const userMsgId = `user-${Date.now()}-${Math.random()}`; const userMsgDisplay: DisplayChatMessage = { ...userMsgData, id: userMsgId };
        const historyForSubmit = [...displayHistory, userMsgDisplay]; // Use internal state for context
        setDisplayHistory(historyForSubmit); // Update display immediately
        setIsChatLoading(true);
        try { await saveChatMessage(selectedConversationId, userMsgData); } catch (error) { /* ... handle save error ... */ setIsChatLoading(false); return; }

        // Update Usage (uses internal state)
        if (userTier !== 'premium' && user?.uid) { const newCount = chatCount + 1; setChatCount(newCount); setIsChatLimitReached(newCount >= currentChatLimit); updateUserChatUsage(user.uid, newCount, currentMonthYear).catch(err => console.error("Usage update err:", err)); }

        // Timer Request
        if (timerDuration) { /* ... handle timer creation and display ... */ setIsChatLoading(false); return; }

        // AI Response Prep
        const assistantMsgId = `assistant-${Date.now()}-${Math.random()}`;
        const placeholderMsg: DisplayChatMessage = { id: assistantMsgId, role: 'assistant', content: "...", createdAt: Timestamp.now() };
        setDisplayHistory(prev => [...prev, placeholderMsg]); // Add placeholder to display
        let finalAccumulatedRawText = ""; let lastStreamError: string | undefined = undefined;

        try {
             if (!geminiApiKey) throw new Error("Gemini API key is not configured.");

            // History & Context (uses internal state/props)
            const historyLimit = 10;
            const historyForPrompt = historyForSubmit // Use history *before* placeholder
                .slice(-historyLimit)
                .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
            const itemsText = formatItemsForChat(); // Use local helper
            const userContextText = userContext ? `Work: ${userContext.workDescription || 'N/A'}...` : "Context N/A.";
            const now = new Date(); const currentDateTime = { date: now.toLocaleDateString(), time: now.toLocaleTimeString() };

            // System Prompt (More Detailed)
            const systemInstruction = `
You are TaskMaster AI, an advanced productivity assistant for ${userName || 'User'}. Today is ${currentDateTime.date}, ${currentDateTime.time}.
Your goal is to be helpful, conversational, and proactive in managing tasks, goals, projects, and plans based on user requests and context.

[User Context] ${userContextText}
[User Items - IMPORTANT: Use [ID: item_id] when referring to specific items for actions]
${itemsText}

[Your Core Responsibilities]
1.  **Engage Naturally:** Respond conversationally. Adapt to the user's tone. Be concise but clear.
2.  **Understand Intent:** Analyze the user's message to determine if they are asking a question, giving a command, or making a general statement.
3.  **Provide Information:** Answer questions about productivity, time management, or the user's items *when asked*.
4.  **Execute Commands (Action Recommendations):** If the user clearly requests creation, update, or deletion of an item:
    *   Acknowledge the request in your text response (e.g., "Okay, adding that task..." or "Got it, deleting the 'Old Project' plan...").
    *   **AFTER** the text response, provide **ONE** valid JSON object in \`\`\`json ... \`\`\` format using the *exact* structure specified below.
    *   Use the item's `[ID: item_id]` from the list above for `update` and `delete` actions whenever possible. If the ID isn't clear but the name is, use `itemName`. One identifier is required for update/delete.
    *   Do *not* invent actions or parameters. If details are missing (e.g., no due date specified), omit the field or use a sensible default (like priority 'medium').
    *   JSON Structure:
        \`\`\`json
        {
          "type": "actionRecommendation",
          "data": {
            "id": "rec-${Date.now()}",
            "action": "create" | "update" | "delete",
            "itemType": "tasks" | "goals" | "projects" | "plans",
            "payload": { /* Details Below */ },
            "reasoning": "Very brief confirmation of the action being taken based on user request."
          }
        }
        \`\`\`
    *   Payload Schemas:
        *   `create`: `{ "text": "...", "dueDate": "YYYY-MM-DD" | null, "priority": "high"|"medium"|"low" }` (text is required)
        *   `update`: `{ "itemId": "..." | null, "itemName": "..." | null, "text": "..." | null, "completed": true|false|null, "priority": "..."|null, "dueDate": "YYYY-MM-DD" | null }` (itemId or itemName required; at least one field to update required; 'text' updates the main title/name)
        *   `delete`: `{ "itemId": "..." | null, "itemName": "..." | null }` (itemId or itemName required)
5.  **Generate Educational Content (Optional JSON):** If the user *explicitly* asks for "flashcards" or a "quiz" on a topic:
    *   Provide a brief text intro (e.g., "Here are some flashcards on X:").
    *   **AFTER** the text, provide **ONE** valid JSON object \`\`\`json ... \`\`\` with `type: "flashcard"` or `type: "question"` and a `data` array containing the items. Structure as specified previously.
    *   Do *not* provide this JSON unless explicitly requested.
6.  **Format:** Text response ALWAYS comes first. If JSON is needed (action OR educational, never both), it follows the text. No extra explanations or metadata outside the JSON.

[Example Interaction (Create Task)]
User: Remind me to call John tomorrow afternoon.
Assistant: Okay, I'll add a task 'Call John' for tomorrow.
\`\`\`json
{
  "type": "actionRecommendation",
  "data": {
    "id": "rec-1700000000000",
    "action": "create",
    "itemType": "tasks",
    "payload": { "text": "Call John", "dueDate": "YYYY-MM-DD", "priority": "medium" }, // AI calculates tomorrow's date
    "reasoning": "Creating task as requested."
  }
}
\`\`\`

Respond now to the user's latest message.`;

            // Request Body & Options... (same as before)
             const requestBody = { contents: [ { role: 'user', parts: [{ text: systemInstruction }] }, { role: 'model', parts: [{ text: "Understood. How can I help?"}] }, ...historyForPrompt ], generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }, safetySettings: [ /* ... */ ] }; // Increased tokens slightly
             const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) };

            // Streaming and Processing (uses local state setters)
            await streamResponse(geminiChatEndpoint, geminiOptions, (rawChunkAccumulated) => {
                finalAccumulatedRawText = rawChunkAccumulated;
                const { text: currentExtractedText, error: streamExtractionError } = extractCandidateText(rawChunkAccumulated);
                if (streamExtractionError) lastStreamError = streamExtractionError;
                // Update *display* history incrementally
                setDisplayHistory(prev => prev.map(msg => (msg.id === assistantMsgId) ? { ...msg, content: currentExtractedText || msg.content, error: streamExtractionError || msg.error } : msg ));
            });

            // Final Processing (uses local state setters)
            const { text: finalExtractedAssistantText, error: finalError, finishReason } = extractCandidateText(finalAccumulatedRawText);
            let textForDisplay = finalExtractedAssistantText; let finalErrorMessage = finalError || lastStreamError;
            /* ... (rest of JSON parsing and text cleanup logic remains the same) ... */
             if (!textForDisplay && finalAccumulatedRawText.length > 5) { textForDisplay = "[Processing Error]"; finalErrorMessage = finalErrorMessage || "Could not fully process response."; }
             if (!textForDisplay || textForDisplay === "...") { textForDisplay = "..."; finalErrorMessage = finalErrorMessage || (finishReason && finishReason !== 'STOP' ? `Response ended: ${finishReason}` : "No response received."); }
             let parsedJsonData: any = null; let jsonType: 'flashcard' | 'question' | 'actionRecommendation' | null = null; let recommendationData: AiActionRecommendationData | undefined = undefined;
             if (textForDisplay && textForDisplay !== "..." && !finalErrorMessage) {
                 const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = textForDisplay.match(jsonBlockRegex);
                 if (jsonMatch && jsonMatch[1]) { /* ... parse JSON logic ... */ if (potentialJson.type === 'actionRecommendation' && /*...*/) { /*...*/ textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim(); } else if ((potentialJson.type === 'flashcard' || /*...*/) && /*...*/) { /*...*/ textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim(); } }
             }
             if (!textForDisplay && recommendationData) { textForDisplay = recommendationData.reasoning || "Suggestion received."; } else if (!textForDisplay && parsedJsonData) { textForDisplay = `Educational content received.`; } else if (!textForDisplay && !finalErrorMessage) { textForDisplay = "Received empty response."; }


            // Prepare & Save Final Message
            const assistantMsgData: FirebaseChatMessage = { role: 'assistant', content: finalErrorMessage ? `⚠️ ${finalErrorMessage}` : textForDisplay, createdAt: Timestamp.now(), error: !!finalErrorMessage, ...(jsonType === 'flashcard' && { flashcard: parsedJsonData }), ...(jsonType === 'question' && { question: parsedJsonData }), };
            // Update final display state
            setDisplayHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: assistantMsgData.content, flashcard: jsonType === 'flashcard' ? parsedJsonData : undefined, question: jsonType === 'question' ? parsedJsonData : undefined, recommendation: finalErrorMessage ? undefined : recommendationData, error: finalErrorMessage || false } : msg ));
            // Save to Firestore
            try { await saveChatMessage(selectedConversationId, assistantMsgData); } catch (error) { console.error("Failed to save final assistant message:", error); }

            // Dynamic Naming (uses local state/helpers)
            const userMessagesCount = historyForSubmit.filter(m => m.role === 'user').length;
            if (userMessagesCount >= 2 && !hasGeneratedChatNameForCurrentConv && !finalErrorMessage) { // Check after 2 or more messages
                 console.log("Triggering dynamic chat name generation...");
                 // Pass history including the assistant's *successful* response
                 const historyForNameGen = [...historyForSubmit];
                 if (!finalErrorMessage) historyForNameGen.push({ id: assistantMsgId, role: 'assistant', content: textForDisplay, createdAt: Timestamp.now() });
                 await generateDynamicChatName(selectedConversationId, historyForNameGen);
            }

        } catch (err: any) {
             /* ... (Error Handling - update displayHistory with error) ... */
            console.error('Chat Submit Error:', err);
            let errorMsgContent = `Sorry, error: ${err.message || 'Unknown'}`;
             setDisplayHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: errorMsgContent, error: errorMsgContent } : msg ));
             if (selectedConversationId) saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }).catch(e => console.error("Failed to save error message:", e));
        } finally {
            setIsChatLoading(false);
        }
    }, [
        user, userName, userTier, userContext, selectedConversationId, chatMessage, isChatLoading,
        displayHistory, // Use internal display history
        chatCount, chatMonth, currentChatLimit, // Use internal usage state
        hasGeneratedChatNameForCurrentConv, formatItemsForChat, generateDynamicChatName, // Use internal helpers
        // No longer need onChatSubmit prop
    ]); // Dependencies

    const handleNewChat = useCallback(async () => {
        if (!user) return; setIsChatLoading(true); // Use internal loading state
        try {
            const now = new Date(); const defaultChatName = `Chat ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            const newId = await createChatConversation(user.uid, defaultChatName, false);
            onSelectConversation(newId); // Tell parent to select the new one
            setDisplayHistory([]); // Clear local display history
            setHasGeneratedChatNameForCurrentConv(false);
            setAiSidebarTab('chat');
            // Don't control isOpen from here, parent does
        } catch (error) { console.error("Error creating new chat:", error); alert("Failed to start new chat."); }
        finally { setIsChatLoading(false); }
    }, [user, onSelectConversation]); // Dependencies

    const generateAiInsights = useCallback(async () => {
        // ... (Insight generation logic remains largely the same, but uses internal state/props) ...
        // ... (Ensure it uses 'user', 'userContext', 'formatItemsForChat' from internal scope/props) ...
        // ... (Updates 'aiGeneratedInsights' state variable directly) ...
         if (!user || aiGeneratedInsights.isLoading || !geminiApiKey) return;
         if (userTier === 'basic' || userTier === 'loading') { setAiGeneratedInsights(prev => ({ ...prev, error: "Insights require Pro/Premium."})); return; }
         setAiGeneratedInsights(prev => ({ ...prev, isLoading: true, error: null }));
         const allItems = [...tasks, ...goals, ...projects, ...plans];
         const itemsSignature = allItems.map(i => `${i.id}-${i.data.completed}`).join('|'); // Simple signature
         const itemsText = formatItemsForChat();
         const userContextText = userContext ? `Work: ${userContext.workDescription || 'N/A'}...` : "Context N/A.";
         // Enhanced Prompt
          const prompt = `
Analyze the following user data for ${userName || 'User'} and provide detailed, actionable productivity insights. Be specific and justify your score.
[USER CONTEXT]
${userContextText}
[USER ITEMS]
${itemsText}
[INSTRUCTIONS]
Generate a JSON object ONLY with the following structure:
{
  "productivityScore": number (0-100. REQUIRED. Base score on: % items completed, ratio of high/medium/low priority pending, number of overdue items (significant penalty), recent completion velocity (positive boost), alignment with user's stated focus/goals if available. Justify the score briefly in timeManagementAnalysis.),
  "timeManagementAnalysis": string (REQUIRED. Analyze workload distribution, upcoming deadlines, overdue items. Mention specific items as examples. Suggest potential bottlenecks or areas for focus. Include a brief justification for the productivityScore.),
  "potentialConflicts": string (REQUIRED. Identify scheduling conflicts, resource overlaps, or contradictory goals based on item names, types, and due dates. Example: "Project A kickoff and Task B deadline overlap". If none evident, state "No obvious conflicts detected based on provided data."),
  "additionalInsights": string (REQUIRED. Provide ONE actionable suggestion, encouragement, or observation relevant to the user's current state. Examples: "Consider breaking down large 'Project X' goal", "Good progress on recent tasks!", "Focus on clearing overdue 'Task Y' first.")
}
Return ONLY the JSON object. Ensure all fields are present and the JSON is valid. If no items exist, return default values (score 0, analysis "No items to analyze", conflicts "N/A", insights "Add items to get insights.").`;

         try {
             const insightEndpoint = geminiProEndpoint;
             const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 800, responseMimeType: "application/json" }, safetySettings: [ /* ... */ ] }) };
             console.log("Generating AI Insights with payload:", JSON.stringify(geminiOptions.body)); // Log the actual prompt
             const response = await fetchWithTimeout(insightEndpoint, geminiOptions, 40000); // Increased timeout
             console.log("Insights API Status:", response.status);
             if (!response.ok) { const errorBody = await response.text(); throw new Error(`Insights API error (${response.status}): ${errorBody}`); }
             const resultJson = await response.json();
             console.log("Insights API Raw Response JSON:", resultJson);
             let insightsData;
             if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                 const rawJsonText = resultJson.candidates[0].content.parts[0].text;
                 console.log("Insights Raw JSON Text:", rawJsonText);
                 try { insightsData = JSON.parse(rawJsonText); } catch (parseError: any) { throw new Error(`Invalid insight JSON: ${parseError.message}`); }
             } else { /* ... handle blocked/empty response ... */ throw new Error("Received unexpected insight structure."); }
             // Stricter Validation
             if (typeof insightsData.productivityScore !== 'number' || !insightsData.timeManagementAnalysis || !insightsData.potentialConflicts || !insightsData.additionalInsights) { throw new Error("AI returned incomplete insight data."); }
             setAiGeneratedInsights({ score: insightsData.productivityScore, timeManagement: insightsData.timeManagementAnalysis, conflicts: insightsData.potentialConflicts, other: insightsData.additionalInsights, isLoading: false, error: null, lastGeneratedSig: itemsSignature });
         } catch (error: any) {
             console.error("Error generating AI insights:", error);
             let errorMsg = `Insights failed: ${error.message || 'Unknown'}`; /* ... more specific error messages ... */
             setAiGeneratedInsights(prev => ({ ...prev, score: undefined, timeManagement: undefined, conflicts: undefined, other: undefined, isLoading: false, error: errorMsg }));
         }
    }, [user, userName, userTier, userContext, tasks, goals, projects, plans, aiGeneratedInsights.isLoading, formatItemsForChat]); // Dependencies


    // --- JSX ---
    return (
        <div
            aria-hidden={!isOpen}
            className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full' } ${cardClass} flex flex-col shadow-2xl border-l ${illuminateBorder}`}
            role="complementary" aria-labelledby="ai-sidebar-title"
        >
            {/* Header */}
            <div className={`p-3 sm:p-4 border-b ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky top-0 backdrop-blur-sm z-20`}>
                {/* ... (Header Title and Close Button remain the same) ... */}
                 <div className="flex justify-between items-center mb-2">
                    <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}> <BrainCircuit className="w-5 h-5" /> TaskMaster AI </h3>
                    <button onClick={onClose} className={`${iconColor} p-1 rounded-full ${illuminateBgHover} transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar"> <X className="w-5 h-5" /> </button>
                </div>
                {/* Conversation Selector and New Chat Button */}
                <div className="flex items-center gap-2">
                    <select value={selectedConversationId || ''} onChange={(e) => onSelectConversation(e.target.value || null)} disabled={isConversationsLoading || sortedConversations.length === 0} className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-md px-3 py-1.5 text-sm ...`}>
                        {isConversationsLoading ? <option value="">Loading...</option> : sortedConversations.length > 0 ? sortedConversations.map(conv => (<option key={conv.id} value={conv.id}>{getChatDisplayName(conv)}</option>)) : <option value="" disabled>No chats yet</option>}
                    </select>
                    <button onClick={handleNewChat} disabled={isChatLoading || isConversationsLoading} className={`bg-blue-600 text-white p-1.5 rounded-md ...`}> <PlusCircle className="w-3.5 h-3.5" /> New </button>
                </div>
                {/* Tab Buttons */}
                <div className={`mt-3 flex border-b ${illuminateBorder} -mb-[1px]`}>
                     <button onClick={() => setAiSidebarTab('chat')} className={`flex-1 py-2 ... ${aiSidebarTab === 'chat' ? `border-blue-500 ${illuminateTextBlue}` : `border-transparent ${subheadingClass} hover:${illuminateTextBlue}`}`}> Chat </button>
                     <button onClick={() => setAiSidebarTab('insights')} className={`flex-1 py-2 ... ${aiSidebarTab === 'insights' ? `border-purple-500 ${illuminateTextPurple}` : `border-transparent ${subheadingClass} hover:${illuminateTextPurple}`}`}> Insights <span className="text-xs ...">(BETA)</span> </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto" ref={aiSidebarTab === 'chat' ? chatEndRef : null}>
                {/* CHAT TAB Content */}
                {aiSidebarTab === 'chat' && (
                    <div className="p-3 space-y-3">
                        {/* Message Loading Placeholder */}
                        {isMessagesLoading && selectedConversationId && ( <div className="space-y-3 animate-pulse p-4"> {/* ... */} </div> )}
                        {/* Chat History Rendering (uses displayHistory state) */}
                        {!isMessagesLoading && displayHistory.map((message, index) => (
                             <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`} style={{ /*...*/ }}>
                                <div className={`max-w-[85%] rounded-lg ... ${message.role === 'user' ? /*...*/ : message.error ? /*...*/ : /*...*/}`}>
                                    {/* Markdown Rendering */}
                                    {message.content && message.content !== "..." ? ( <ReactMarkdown /*...*/ >{message.content}</ReactMarkdown> )
                                    : message.content === "..." && isChatLoading && index === displayHistory.length - 1 ? ( <div className="flex space-x-1 p-1"> {/* Loading Dots */} </div> )
                                    : null}
                                    {/* Timer/Flashcards/Questions */}
                                    {message.timer && (<div className="mt-1.5"> {/*... Timer Component ...*/} </div>)}
                                    {message.flashcard && (<div className="mt-1.5"> {/*... Flashcard Component ...*/} </div>)}
                                    {message.question && (<div className="mt-1.5"> {/*... Question Component ...*/} </div>)}
                                    {/* Action Recommendation */}
                                    {message.recommendation && !message.error && ( <div className={`mt-2 p-2 rounded-md border ...`}> <p className={`text-xs font-medium mb-1 ...`}>AI Suggestion:</p> <p className="text-xs mb-1.5">{message.recommendation.reasoning}</p> <div className="flex justify-end gap-1.5"> <button onClick={() => executeAiAction(message.recommendation!)} className="px-2 py-0.5 ...">Accept</button> </div> </div> )}
                                </div>
                            </div>
                        ))}
                        {/* Empty/Placeholder states */}
                        {!selectedConversationId && !isConversationsLoading && !isMessagesLoading && ( <div className="text-center p-6 ..."> Select or start a chat. </div> )}
                        {!isMessagesLoading && selectedConversationId && displayHistory.length === 0 && ( <div className="text-center p-6 ..."> Send a message to begin. </div> )}
                    </div>
                )}
                {/* INSIGHTS TAB Content */}
                {aiSidebarTab === 'insights' && (
                    <div className="p-3 sm:p-4 space-y-4">
                        {/* Generate Button */}
                        <button onClick={generateAiInsights} disabled={aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading'} className={`w-full flex justify-center items-center gap-2 ...`}> {/* ... Button Text/Icon ... */} </button>
                        {/* Error Display */}
                        {aiGeneratedInsights.error && ( <p className="text-center text-sm text-red-500 ...">{aiGeneratedInsights.error}</p> )}
                        {/* Insights Display */}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (aiGeneratedInsights.score !== undefined || /*...*/) && ( <div className="space-y-3 animate-fadeIn"> {/* ... Render individual insight cards ... */} </div> )}
                        {/* Placeholder states */}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && aiGeneratedInsights.score === undefined && /*...*/ && userTier !== 'basic' && ( <p className="text-center ..."> Click "Generate Insights"... </p> )}
                        {(userTier === 'basic' || userTier === 'loading') && !aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && ( <p className="text-center ..."> Upgrade for insights. </p> )}
                    </div>
                )}
            </div>

            {/* Footer / Chat Input */}
            <div className={`px-2 sm:px-3 pt-1 border-t ${illuminateBorder} ... sticky bottom-0 ...`}>
                {/* Usage Limit */}
                {userTier !== 'premium' && userTier !== 'loading' && ( <div className="pb-1.5 text-xs text-center"> {/* ... Usage display ... */} </div> )}
                {/* Input Form */}
                <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2">
                    <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={/* ... */} className={`flex-1 ${inputBg} border ...`} disabled={isChatLoading || /* ... */} />
                    <button type="submit" disabled={isChatLoading || !chatMessage.trim() || /* ... */} className={`bg-blue-600 text-white p-2 rounded-full ...`}> {isChatLoading ? <div className="w-4 h-4 border-2 ... animate-spin"></div> : <Send className="w-4 h-4" />} </button>
                </form>
            </div>
        </div>
    );
}
