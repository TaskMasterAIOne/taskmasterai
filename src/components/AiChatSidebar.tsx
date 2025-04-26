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
import { User } from 'firebase/auth';

import { Timer } from './Timer';
import { FlashcardsQuestions } from './FlashcardsQuestions';
import { UserTier, getChatLimitForTier, updateUserChatUsage } from '../lib/current-paying-user';
import { ItemType, CollectionName, geminiApiKey, createItem, updateItem, deleteItem} from '../lib/dashboard-firebase';
import { UserContext } from '../lib/ai-context-firebase';
import {
    createChatConversation,
    saveChatMessage,
    updateChatConversationName,
    ChatMessage as FirebaseChatMessage
} from '../lib/ai-chat-firebase';

// --- Types ---
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
    createdAt?: Timestamp;
    error?: boolean | string;
    timer?: { type: 'timer'; duration: number; id: string };
    flashcard?: { type: 'flashcard'; data: any[] };
    question?: { type: 'question'; data: any[] };
}

interface DisplayChatMessage extends BaseChatMessage {
    id: string;
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

// --- Gemini Utilities ---
const geminiChatEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${geminiApiKey}&alt=sse`;
const geminiProEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`; // For naming and insights

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
        console.log("Streaming Request:", url); // Log request URL
        const response = await fetchWithTimeout(url, options, timeout);
        console.log("Stream Response Status:", response.status); // Log status
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
        console.log("Final Accumulated Raw Text:", accumulatedRawText); // Log final raw text
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
                        streamFinishReason = candidate.finishReason;
                        // console.warn("Gemini FinishReason:", streamFinishReason); // Less verbose logging
                        if (streamFinishReason === 'SAFETY') streamError = "Stopped due to safety concerns.";
                        else if (streamFinishReason === 'MAX_TOKENS') streamError = "Stopped due to maximum token limit.";
                        else streamError = `Stopped unexpectedly (${streamFinishReason}).`;
                    } else if (parsedJson.error?.message) streamError = `API Error: ${parsedJson.error.message}`;
                    else if (parsedJson.promptFeedback?.blockReason) { streamFinishReason = "BLOCKED"; streamError = `Blocked due to prompt feedback: ${parsedJson.promptFeedback.blockReason}`; }
                } catch (e) { /* Incomplete JSON is expected during streaming */ }
            }
        }
        // Basic cleanup, avoid removing too much
        return { text: combinedText.replace(/^Assistant:\s*/, '').trim(), error: streamError, finishReason: streamFinishReason };
    } catch (err) { console.error("Error extracting text:", err); return { text: "", error: "Error extracting text from stream.", finishReason: "ERROR" }; }
};

// --- Helper Functions ---
const getChatDisplayName = (conv: Conversation): string => {
    if (conv.data?.chatName && conv.data.chatName.trim() !== "") { return conv.data.chatName.trim(); }
    if (conv.data?.createdAt?.seconds) { const date = new Date(conv.data.createdAt.seconds * 1000); return `Chat ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`; }
    return `Chat ${conv.id.substring(0, 6)}`;
};

const parseTimerRequest = (message: string): number | null => { const timeRegex = /(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i; const match = message.match(timeRegex); if (!match) return null; const amount = parseInt(match[1]); const unit = match[2].toLowerCase(); if (isNaN(amount) || amount <= 0) return null; if (unit.startsWith('hour')) return amount * 3600; if (unit.startsWith('min')) return amount * 60; if (unit.startsWith('sec')) return amount; return null; };
const getTitleField = (itemData: any): string => { if (itemData.task !== undefined) return 'task'; if (itemData.goal !== undefined) return 'goal'; if (itemData.project !== undefined) return 'project'; if (itemData.plan !== undefined) return 'plan'; return 'text'; }; // Default to text if specific not found

// --- Props Interface ---
interface AiChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    userName: string;
    userTier: UserTier;
    userContext: UserContext | null;
    tasks: Array<{ id: string; data: any }>;
    goals: Array<{ id: string; data: any }>;
    projects: Array<{ id: string; data: any }>;
    plans: Array<{ id: string; data: any }>;
    chatConversations: Conversation[];
    selectedConversationId: string | null;
    onSelectConversation: (id: string | null) => void;
    currentChatHistory: DisplayChatMessage[]; // Received from parent
    isConversationsLoading: boolean;
    isMessagesLoading: boolean; // Loading messages for selected chat
    initialChatCount: number;
    initialChatMonth: string;
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
}

// --- Component ---
export function AiChatSidebar({
    isOpen, onClose, user, userName, userTier, userContext,
    tasks, goals, projects, plans,
    chatConversations, selectedConversationId, onSelectConversation, currentChatHistory,
    isConversationsLoading, isMessagesLoading,
    initialChatCount, initialChatMonth,
    cardClass, illuminateBorder, inputBg, iconColor, illuminateTextBlue, illuminateTextPurple, subheadingClass, illuminateBgHover, headingClass, isIlluminateEnabled,
}: AiChatSidebarProps) {

    // --- Internal State ---
    const [chatMessage, setChatMessage] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false); // For AI response generation
    const [aiSidebarTab, setAiSidebarTab] = useState<'chat' | 'insights'>('chat');
    const [aiGeneratedInsights, setAiGeneratedInsights] = useState<{ score?: number; timeManagement?: string; conflicts?: string; other?: string; error?: string | null; isLoading: boolean; lastGeneratedSig: string | null; }>({ isLoading: false, lastGeneratedSig: null });
    const [hasGeneratedChatNameForCurrentConv, setHasGeneratedChatNameForCurrentConv] = useState(false);
    const [chatCount, setChatCount] = useState(initialChatCount);
    const [chatMonth, setChatMonth] = useState(initialChatMonth);
    const [isChatLimitReached, setIsChatLimitReached] = useState(false);
    // Local state for the messages being displayed, including temporary ones during streaming
    const [displayHistory, setDisplayHistory] = useState<DisplayChatMessage[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- Effects ---
    useEffect(() => { setDisplayHistory(currentChatHistory); }, [currentChatHistory]); // Sync display with fetched history
    useEffect(() => { setChatCount(initialChatCount); setChatMonth(initialChatMonth); const limit = getChatLimitForTier(userTier); setIsChatLimitReached(limit !== Infinity && initialChatCount >= limit); }, [initialChatCount, initialChatMonth, userTier]);
    useEffect(() => { const currentConv = chatConversations.find(c => c.id === selectedConversationId); setHasGeneratedChatNameForCurrentConv(currentConv?.data?.nameGenerated || false); }, [selectedConversationId, chatConversations]);
    useEffect(() => { if (chatEndRef.current && isOpen && aiSidebarTab === 'chat') { const id = requestAnimationFrame(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }); return () => cancelAnimationFrame(id); } }, [displayHistory, isOpen, aiSidebarTab]);

    // --- Memos ---
    const sortedConversations = useMemo(() => [...chatConversations].sort((a, b) => (b.data?.lastActivity?.seconds ?? b.data?.createdAt?.seconds ?? 0) - (a.data?.lastActivity?.seconds ?? a.data?.createdAt?.seconds ?? 0)), [chatConversations]);
    const currentChatLimit = useMemo(() => getChatLimitForTier(userTier), [userTier]);

    // --- Internal Logic Functions ---
    const formatItemsForChat = useCallback(() => {
        const lines: string[] = []; lines.push(`Current items for ${userName}:\n`);
        const formatLine = (item: any, type: string) => { const name = item.data[type] || item.data.text || 'Untitled'; const due = item.data.dueDate?.toDate?.(); const priority = item.data.priority || calculatePriority(item); const completed = item.data.completed ? 'Yes' : 'No'; return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${name}${ due ? ` (Due: ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : '' } [Priority: ${priority}] [Completed: ${completed}] [ID: ${item.id}]`; };
        const allItemsMap = { tasks, goals, projects, plans }; if (tasks.length === 0 && goals.length === 0 && projects.length === 0 && plans.length === 0) { return `No active items found for ${userName}.`; }
        Object.entries(allItemsMap).forEach(([type, items]) => { if (items.length > 0) { lines.push(`\n--- ${type.charAt(0).toUpperCase() + type.slice(1)} ---`); items.forEach((item) => lines.push(formatLine(item, type.slice(0, -1)))); } }); return lines.join('\n');
    }, [userName, tasks, goals, projects, plans]);

    const executeAiAction = useCallback(async (recommendation: AiActionRecommendationData) => {
        if (!user) { console.error("No user for action"); return; }
        console.log("Executing AI action:", recommendation);
        const { action, itemType, payload } = recommendation;
        if (!action || !itemType || !payload) { console.error("Invalid recommendation"); /* Update UI with error? */ return; }
        try {
            let confirmationMessage = '';
            if (action === 'create') {
                let dateValue: Date | null = null; if (payload.dueDate) { try { const d = new Date(payload.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) dateValue = d; } catch {} }
                const titleField = itemType.slice(0, -1); const createPayload = { [titleField]: payload.text || 'AI Item', text: payload.text || 'AI Item', dueDate: dateValue, priority: payload.priority || 'medium', completed: false, createdAt: Timestamp.now() };
                await createItem(user.uid, itemType, createPayload); confirmationMessage = `✅ Created ${itemType.slice(0,-1)}: "${payload.text || 'AI Item'}".`;
            } else if (action === 'update') {
                let itemIdToUpdate = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToUpdate && payload.itemName) { try { itemIdToUpdate = await findItemByName(itemType, user.uid, payload.itemName, titleField); } catch { throw new Error(`Could not find ${itemType.slice(0,-1)}: "${payload.itemName}".`); } } if (!itemIdToUpdate) throw new Error(`Could not identify ${itemType.slice(0,-1)} to update.`);
                const { itemId, itemName, ...updates } = payload; if (updates.dueDate) { try { const d = new Date(updates.dueDate + 'T12:00:00Z'); if (!isNaN(d.getTime())) updates.dueDate = d; else delete updates.dueDate; } catch { delete updates.dueDate; } } else if (updates.dueDate === null || updates.dueDate === '') { updates.dueDate = null; } if (updates[titleField] !== undefined) updates.text = updates[titleField]; delete updates.itemId; delete updates.itemName; delete updates.createdAt; if (Object.keys(updates).length === 0) throw new Error("No valid fields for update.");
                await updateItem(itemType, itemIdToUpdate, updates); confirmationMessage = `✅ Updated ${itemType.slice(0,-1)}.`;
            } else if (action === 'delete') {
                let itemIdToDelete = payload.itemId; const titleField = itemType.slice(0, -1); if (!itemIdToDelete && payload.itemName) { try { itemIdToDelete = await findItemByName(itemType, user.uid, payload.itemName, titleField); } catch { throw new Error(`Could not find ${itemType.slice(0,-1)}: "${payload.itemName}".`); } } if (!itemIdToDelete) throw new Error(`Could not identify ${itemType.slice(0,-1)}: "${payload.itemName || 'N/A'}".`);
                await deleteItem(itemType, itemIdToDelete); confirmationMessage = `✅ Deleted ${itemType.slice(0,-1)}.`;
            } else { throw new Error(`Unsupported action: ${action}`); }
            const confirmMsg: DisplayChatMessage = { id: `action-confirm-${Date.now()}`, role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() }; setDisplayHistory(prev => [...prev, confirmMsg]); if (selectedConversationId) { saveChatMessage(selectedConversationId, { role: 'assistant', content: confirmationMessage, createdAt: Timestamp.now() }).catch(e => console.error("Save confirm err:", e)); }
        } catch (error: any) {
            console.error("Error executing AI action:", error); const errorMsgContent = `❌ Action Error: ${error.message || 'Unknown'}.`; const errorMsg: DisplayChatMessage = { id: `action-error-${Date.now()}`, role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }; setDisplayHistory(prev => [...prev, errorMsg]); if (selectedConversationId) { saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }).catch(e => console.error("Save action err msg err:", e)); }
        }
    }, [user, selectedConversationId]);

    const handleTimerComplete = useCallback((timerId: string) => {
        const completionMsg: DisplayChatMessage = { id: `timer-complete-${timerId}-${Date.now()}`, role: 'assistant', content: `⏰ Timer finished!`, createdAt: Timestamp.now() }; setDisplayHistory(prev => [...prev, completionMsg]); if (selectedConversationId) { saveChatMessage(selectedConversationId, { role: 'assistant', content: completionMsg.content, createdAt: Timestamp.now() }).catch(e => console.error("Save timer complete err:", e)); }
    }, [selectedConversationId]);

    const generateDynamicChatName = useCallback(async (convId: string, history: DisplayChatMessage[]) => {
        if (!user || !geminiApiKey) return; const conversationText = history.slice(-6).map(m => `${m.role === 'user' ? userName : 'Assistant'}: ${m.content}`).join('\n'); const namePrompt = `Based on this recent conversation snippet, suggest a very short (3-5 words max) title. Output ONLY the title, nothing else.\nExample: "Planning Project X" or "Grocery List Update"\n\nConversation:\n${conversationText}`; console.log("Gen name for:", convId);
        try {
            const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: namePrompt }] }], generationConfig: { maxOutputTokens: 15, temperature: 0.5 }, safetySettings: [/*..safety..*/] }), }; const response = await fetchWithTimeout(geminiProEndpoint, options, 15000); if (!response.ok) throw new Error(`Name gen fail (${response.status}): ${await response.text()}`); const resultJson = await response.json(); let generatedName = "Chat Summary"; if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) { generatedName = resultJson.candidates[0].content.parts[0].text.trim().replace(/["']/g, ''); if (generatedName.length > 30 || generatedName.toLowerCase().includes("title:")) generatedName = "Chat Summary"; }
            await updateChatConversationName(convId, generatedName, true); setHasGeneratedChatNameForCurrentConv(true);
        } catch (err) { console.error('Name gen err:', err); }
    }, [user, userName]);

    const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault(); if (!chatMessage.trim() || isChatLoading || !user || !selectedConversationId) return;
        const currentMonthYear = new Date().toISOString().slice(0, 7); let limitReached = false; if (userTier !== 'premium') { let currentCount = chatCount; if (chatMonth !== currentMonthYear) { currentCount = 0; setChatCount(0); setChatMonth(currentMonthYear); setIsChatLimitReached(false); limitReached = false; updateUserChatUsage(user.uid, 0, currentMonthYear).catch(err => console.error("Usage reset err:", err)); } else { limitReached = currentCount >= currentChatLimit; setIsChatLimitReached(limitReached); } } if (limitReached) { const limitMsg: DisplayChatMessage = { id: `limit-${Date.now()}`, role: 'assistant', content: `Monthly limit reached.`, error: true, createdAt: Timestamp.now() }; setDisplayHistory(prev => [...prev, limitMsg]); setChatMessage(''); return; }
        const currentMessage = chatMessage; setChatMessage(''); const timerDuration = parseTimerRequest(currentMessage); const userMsgData: FirebaseChatMessage = { role: 'user', content: currentMessage, createdAt: Timestamp.now() }; const userMsgId = `user-${Date.now()}-${Math.random()}`; const userMsgDisplay: DisplayChatMessage = { ...userMsgData, id: userMsgId }; const historyForSubmit = [...displayHistory, userMsgDisplay]; setDisplayHistory(historyForSubmit); setIsChatLoading(true); try { await saveChatMessage(selectedConversationId, userMsgData); } catch (error) { console.error("Save user msg err:", error); setDisplayHistory(prev => prev.filter(m => m.id !== userMsgId)); setIsChatLoading(false); return; }
        if (userTier !== 'premium' && user?.uid) { const newCount = chatCount + 1; setChatCount(newCount); setIsChatLimitReached(newCount >= currentChatLimit); updateUserChatUsage(user.uid, newCount, currentMonthYear).catch(err => console.error("Usage update err:", err)); }
        if (timerDuration) { const timerId = Math.random().toString(36).substring(2, 9); const timerMsgContent = `Starting ${Math.round(timerDuration / 60)} min timer.`; const timerMsgData: FirebaseChatMessage = { role: 'assistant', content: timerMsgContent, timer: { type: 'timer', duration: timerDuration, id: timerId }, createdAt: Timestamp.now() }; const timerMsgDisplay: DisplayChatMessage = { ...timerMsgData, id: `timer-start-${timerId}-${Math.random()}` }; setDisplayHistory(prev => [...prev, timerMsgDisplay]); try { await saveChatMessage(selectedConversationId, timerMsgData); } catch(e) {} setIsChatLoading(false); return; }
        const assistantMsgId = `assistant-${Date.now()}-${Math.random()}`; const placeholderMsg: DisplayChatMessage = { id: assistantMsgId, role: 'assistant', content: "...", createdAt: Timestamp.now() }; setDisplayHistory(prev => [...prev, placeholderMsg]); let finalAccumulatedRawText = ""; let lastStreamError: string | undefined = undefined;
        try {
            if (!geminiApiKey) throw new Error("API key missing");
            const historyLimit = 12; const historyForPrompt = historyForSubmit.slice(-historyLimit).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })); const itemsText = formatItemsForChat(); const userContextText = userContext ? `Work: ${userContext.workDescription||'N/A'}\nFocus: ${userContext.shortTermFocus||'N/A'}\nGoals: ${userContext.longTermGoals||'N/A'}\nOther: ${userContext.otherContext||'N/A'}` : "N/A"; const now = new Date(); const currentDateTime = { date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) };
            // *** DETAILED CHAT PROMPT ***
            const systemInstruction = `
You are TaskMaster AI, an expert productivity assistant for ${userName || 'User'}. Current date is ${currentDateTime.date}, ${currentDateTime.time}.
Your primary function is to help the user manage their tasks, goals, projects, and plans effectively through conversation. Be proactive, clear, and helpful.

[User Context - Use this for personalized advice]
${userContextText}

[User Items - CRITICAL: Use [ID: item_id] when referring to specific items for actions]
${itemsText}

[Interaction Guidelines]
1.  **Tone:** Friendly, professional, encouraging, slightly proactive. Adapt to the user's tone.
2.  **Clarity:** Be concise but provide enough detail. Avoid ambiguity.
3.  **Proactivity (Subtle):** If the user mentions a topic related to an existing item (e.g., "meeting notes"), you might gently ask if they want to link it or update the related item. Don't overdo it.
4.  **Item Awareness:** Demonstrate awareness of the user's items when relevant to the conversation. Use the provided IDs when suggesting updates/deletions.
5.  **Commands (Action Recommendations):** This is crucial. When the user's intent to CREATE, UPDATE, or DELETE a specific item is clear:
    *   First, confirm the action conversationally (e.g., "Okay, adding task 'Buy milk'...", "Updating 'Project Alpha' deadline...", "Got it, removing the 'Old Goal'..."). Use the item name in your confirmation.
    *   **Immediately AFTER** the confirmation text, provide **ONE** valid JSON object in \`\`\`json ... \`\`\` format.
    *   Use the EXACT structure and payload schemas defined below.
    *   If optional details (dueDate, priority) are omitted by the user, either omit them in the payload or use sensible defaults (e.g., priority 'medium').
    *   Never invent actions. If the user's request is unclear, ask for clarification instead of generating JSON.
    *   JSON Structure:
        \`\`\`json
        { "type": "actionRecommendation", "data": { "id": "rec-${Date.now()}", "action": "create"|"update"|"delete", "itemType": "tasks"|"goals"|"projects"|"plans", "payload": { /* Schema Below */ }, "reasoning": "Brief confirmation, e.g., 'Creating task as requested.'" } }
        \`\`\`


Respond to the user's last message now.`;

            const requestBody = { contents: [ { role: 'user', parts: [{ text: systemInstruction }] }, { role: 'model', parts: [{ text: "Understood. I'm ready to help!"}] }, ...historyForPrompt ], generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }, safetySettings: [/*..safety..*/] };
            const geminiOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) };
            await streamResponse(geminiChatEndpoint, geminiOptions, (rawChunkAccumulated) => { finalAccumulatedRawText = rawChunkAccumulated; const { text: currentExtractedText, error: streamExtractionError } = extractCandidateText(rawChunkAccumulated); if (streamExtractionError) lastStreamError = streamExtractionError; setDisplayHistory(prev => prev.map(msg => (msg.id === assistantMsgId) ? { ...msg, content: currentExtractedText || msg.content, error: streamExtractionError || msg.error } : msg )); });
            const { text: finalExtractedAssistantText, error: finalError, finishReason } = extractCandidateText(finalAccumulatedRawText); let textForDisplay = finalExtractedAssistantText; let finalErrorMessage = finalError || lastStreamError;
            if (!textForDisplay && finalAccumulatedRawText.length > 5) { textForDisplay = "[Processing Error]"; finalErrorMessage = finalErrorMessage || "Processing error."; } if (!textForDisplay || textForDisplay === "...") { textForDisplay = "..."; finalErrorMessage = finalErrorMessage || (finishReason && finishReason !== 'STOP' ? `Ended: ${finishReason}` : "No response."); }
            let parsedJsonData: any = null; let jsonType: 'flashcard' | 'question' | 'actionRecommendation' | null = null; let recommendationData: AiActionRecommendationData | undefined = undefined;
            if (textForDisplay && textForDisplay !== "..." && !finalErrorMessage) { const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/; const jsonMatch = textForDisplay.match(jsonBlockRegex); if (jsonMatch && jsonMatch[1]) { try { const potentialJson = JSON.parse(jsonMatch[1].trim()); if (potentialJson.type === 'actionRecommendation' && potentialJson.data?.action) { jsonType = 'actionRecommendation'; recommendationData = potentialJson.data; textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim(); if (!textForDisplay && recommendationData.reasoning) textForDisplay = recommendationData.reasoning; else if (!textForDisplay) textForDisplay = "Action suggested:"; } else if ((potentialJson.type === 'flashcard' || potentialJson.type === 'question') && Array.isArray(potentialJson.data)) { jsonType = potentialJson.type; parsedJsonData = potentialJson; textForDisplay = textForDisplay.replace(jsonMatch[0], '').trim(); if (!textForDisplay) textForDisplay = `Educational content:`; } } catch (e: any) { console.error('JSON parse err:', e.message); } } }
            if (!textForDisplay && recommendationData) textForDisplay = recommendationData.reasoning || "Suggestion received."; else if (!textForDisplay && parsedJsonData) textForDisplay = `Content received.`; else if (!textForDisplay && !finalErrorMessage) textForDisplay = "Empty response.";
            const assistantMsgData: FirebaseChatMessage = { role: 'assistant', content: finalErrorMessage ? `⚠️ ${finalErrorMessage}` : textForDisplay, createdAt: Timestamp.now(), error: !!finalErrorMessage, ...(jsonType === 'flashcard' && { flashcard: parsedJsonData }), ...(jsonType === 'question' && { question: parsedJsonData }), };
            setDisplayHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: assistantMsgData.content, flashcard: jsonType === 'flashcard' ? parsedJsonData : undefined, question: jsonType === 'question' ? parsedJsonData : undefined, recommendation: finalErrorMessage ? undefined : recommendationData, error: finalErrorMessage || false } : msg ));
            try { await saveChatMessage(selectedConversationId, assistantMsgData); } catch (error) { console.error("Save final msg err:", error); }
            const userMessagesCount = historyForSubmit.filter(m => m.role === 'user').length; if (userMessagesCount >= 2 && !hasGeneratedChatNameForCurrentConv && !finalErrorMessage) { const historyForName = [...historyForSubmit, { ...assistantMsgData, id: assistantMsgId }]; await generateDynamicChatName(selectedConversationId, historyForName); }
        } catch (err: any) { console.error('Chat Submit Err:', err); let errorMsgContent = `Error: ${err.message || 'Unknown'}`; setDisplayHistory(prev => prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: errorMsgContent, error: errorMsgContent } : msg )); if (selectedConversationId) saveChatMessage(selectedConversationId, { role: 'assistant', content: errorMsgContent, error: true, createdAt: Timestamp.now() }).catch(e => console.error("Save err msg err:", e)); }
        finally { setIsChatLoading(false); }
    }, [ user, userName, userTier, userContext, selectedConversationId, chatMessage, isChatLoading, displayHistory, chatCount, chatMonth, currentChatLimit, hasGeneratedChatNameForCurrentConv, formatItemsForChat, generateDynamicChatName, executeAiAction ]); // Dependencies

    const handleNewChat = useCallback(async () => {
        if (!user) return; setIsChatLoading(true);
        try { const now = new Date(); const defaultChatName = `Chat ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`; const newId = await createChatConversation(user.uid, defaultChatName, false); onSelectConversation(newId); setDisplayHistory([]); setHasGeneratedChatNameForCurrentConv(false); setAiSidebarTab('chat'); }
        catch (error) { console.error("New chat err:", error); alert("Failed to start chat."); } finally { setIsChatLoading(false); }
    }, [user, onSelectConversation]);

    const generateAiInsights = useCallback(async () => {
        if (!user || aiGeneratedInsights.isLoading || !geminiApiKey) return; if (userTier === 'basic' || userTier === 'loading') { setAiGeneratedInsights(prev => ({ ...prev, error: "Insights require Pro/Premium."})); return; } setAiGeneratedInsights(prev => ({ ...prev, isLoading: true, error: null })); const allItems = [...tasks, ...goals, ...projects, ...plans]; const itemsSignature = allItems.map(i => `${i.id}-${i.data.completed}`).join('|'); const itemsText = formatItemsForChat(); const userContextText = userContext ? `Work: ${userContext.workDescription || 'N/A'}\nFocus: ${userContext.shortTermFocus || 'N/A'}\nGoals: ${userContext.longTermGoals || 'N/A'}\nOther: ${userContext.otherContext || 'N/A'}` : "Context N/A.";
        // *** DETAILED INSIGHTS PROMPT ***
        const prompt = `
Task: Analyze the provided user data for ${userName || 'User'} and generate comprehensive productivity insights in JSON format.

[User Context - Consider for analysis and suggestions]
${userContextText}

[User Items - Analyze for patterns, completion, deadlines, priorities]
${itemsText}

[JSON Output Instructions - Adhere strictly to this format]
Generate ONLY a valid JSON object with the following fields:
{
  "productivityScore": number (0-100. REQUIRED. Calculate based on:
      - Percentage of COMPLETED items across all types (tasks, goals, etc.). Higher = better.
      - Urgency: Number of items due today/soon vs. total pending. More urgent pending = slight penalty.
      - Overdue Items: Number of overdue items. Apply a SIGNIFICANT penalty for each overdue item.
      - Recent Activity: Consider if many items were completed recently (positive modifier).
      - Context Alignment: Briefly assess if pending items align with stated Short-term Focus/Long-term Goals (if context provided). Good alignment = slight boost.
      - Provide a score reflecting overall productivity health. Score 50 is average.),
  "timeManagementAnalysis": string (REQUIRED. Provide a 2-3 sentence analysis covering:
      - Workload distribution (e.g., "Heavy focus on projects this week", "Many tasks due soon").
      - Identification of potential bottlenecks (e.g., "Overdue Task 'X' may be blocking progress").
      - Positive reinforcement (e.g., "Good progress on completing goals recently").
      - Brief justification for the productivityScore (e.g., "Score reflects high completion rate but hampered by 2 overdue tasks.")),
  "potentialConflicts": string (REQUIRED. Identify specific potential issues based on item details:
      - Scheduling: Check for items with the same or overlapping due dates (e.g., "Task 'A' and Project 'B' phase both due on YYYY-MM-DD.").
      - Resource Allocation (Implied): Note if multiple demanding items (e.g., high-priority projects) are scheduled closely.
      - Goal Contradiction: Mention if any items seem to contradict stated long-term goals (if context provided).
      - If no clear conflicts: "No obvious conflicts detected based on provided data."),
  "additionalInsights": string (REQUIRED. Provide ONE concise, actionable suggestion or observation tailored to the user's current situation:
      - Suggest breaking down a large item (e.g., "Consider breaking down 'Plan World Domination' goal into smaller steps.").
      - Recommend focusing on a specific priority level (e.g., "Focus on clearing high-priority tasks first.").
      - Offer encouragement if progress is good (e.g., "Keep up the great momentum on your projects!").
      - Suggest reviewing overdue items (e.g., "Review overdue items to reschedule or delegate.").
      - If context suggests a focus area, relate the insight (e.g., "Aligning daily tasks with your Short-term Focus could boost progress.") )
}
Ensure all fields are present. If no items exist, return defaults (score 0, "No items to analyze", "N/A", "Add items...").`;

         try {
             const insightEndpoint = geminiProEndpoint; const geminiOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 800, responseMimeType: "application/json" }, safetySettings: [ /* ... */ ] }) };
             console.log("Generating Insights..."); const response = await fetchWithTimeout(insightEndpoint, geminiOptions, 40000); if (!response.ok) throw new Error(`Insights API err (${response.status}): ${await response.text()}`); const resultJson = await response.json(); let insightsData;
             if (resultJson.candidates?.[0]?.content?.parts?.[0]?.text) { const rawJsonText = resultJson.candidates[0].content.parts[0].text; try { insightsData = JSON.parse(rawJsonText); } catch (parseError: any) { throw new Error(`Invalid insight JSON: ${parseError.message}`); } } else { /* Handle block */ throw new Error("No insight data."); }
             if (typeof insightsData.productivityScore !== 'number' || !insightsData.timeManagementAnalysis || !insightsData.potentialConflicts || !insightsData.additionalInsights) { throw new Error("Incomplete insight data."); }
             setAiGeneratedInsights({ score: insightsData.productivityScore, timeManagement: insightsData.timeManagementAnalysis, conflicts: insightsData.potentialConflicts, other: insightsData.additionalInsights, isLoading: false, error: null, lastGeneratedSig: itemsSignature });
         } catch (error: any) { console.error("Insights gen err:", error); let errorMsg = `Insights failed: ${error.message || 'Unknown'}`; setAiGeneratedInsights(prev => ({ ...prev, score: undefined, timeManagement: undefined, conflicts: undefined, other: undefined, isLoading: false, error: errorMsg })); }
    }, [user, userName, userTier, userContext, tasks, goals, projects, plans, aiGeneratedInsights.isLoading, formatItemsForChat]);

    // --- JSX ---
    return (
        <div aria-hidden={!isOpen} className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${cardClass} flex flex-col shadow-2xl border-l ${illuminateBorder}`} role="complementary" aria-labelledby="ai-sidebar-title">
            {/* --- Header --- */}
            <div className={`p-3 sm:p-4 border-b ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky top-0 backdrop-blur-sm z-20`}>
                <div className="flex justify-between items-center mb-2">
                    <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}> <BrainCircuit className="w-5 h-5" /> TaskMaster AI </h3>
                    <button onClick={onClose} className={`${iconColor} p-1 rounded-full ${illuminateBgHover} transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar"> <X className="w-5 h-5" /> </button>
                </div>
                <div className="flex items-center gap-2">
                    <select value={selectedConversationId || ''} onChange={(e) => onSelectConversation(e.target.value || null)} disabled={isConversationsLoading || sortedConversations.length === 0} className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ...`} title="Select Conversation" style={{ textOverflow: 'ellipsis' }}>
                        {isConversationsLoading ? <option value="">Loading...</option> : sortedConversations.length > 0 ? sortedConversations.map(conv => (<option key={conv.id} value={conv.id}>{getChatDisplayName(conv)}</option>)) : <option value="" disabled>No chats yet</option>}
                    </select>
                    <button onClick={handleNewChat} disabled={isChatLoading || isConversationsLoading} className={`bg-blue-600 text-white p-1.5 rounded-md ...`} title="Start New Chat"> <PlusCircle className="w-3.5 h-3.5" /> New </button>
                </div>
                <div className={`mt-3 flex border-b ${illuminateBorder} -mb-[1px]`}>
                    <button onClick={() => setAiSidebarTab('chat')} className={`flex-1 py-2 ... ${aiSidebarTab === 'chat' ? `border-blue-500 ${illuminateTextBlue}` : `border-transparent ${subheadingClass} hover:${illuminateTextBlue}`}`}> Chat </button>
                    <button onClick={() => setAiSidebarTab('insights')} className={`flex-1 py-2 ... ${aiSidebarTab === 'insights' ? `border-purple-500 ${illuminateTextPurple}` : `border-transparent ${subheadingClass} hover:${illuminateTextPurple}`}`}> Insights <span className="text-xs ...">(BETA)</span> </button>
                </div>
            </div>
            {/* --- Content --- */}
            <div className="flex-1 overflow-y-auto" ref={aiSidebarTab === 'chat' ? chatEndRef : null}>
                {aiSidebarTab === 'chat' && (
                    <div className="p-3 space-y-3">
                        {isMessagesLoading && selectedConversationId && ( <div className="space-y-3 animate-pulse p-4"> <div className={`h-8 ...`}></div> <div className={`h-12 ...`}></div> </div> )}
                        {!isMessagesLoading && displayHistory.map((message, index) => (
                             <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${message.role === 'user' ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white') : message.error ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50') : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')}`}>
                                    {message.content && message.content !== "..." ? ( <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ p: ({node,...props})=><p className="mb-1 last:mb-0" {...props}/>, ul: ({node,...props})=><ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props}/>, ol: ({node,...props})=><ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props}/>, li: ({node,...props})=><li className="mb-0.5" {...props}/>, a: ({node,...props})=><a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props}/>, code: ({node,inline,className,children,...props})=>{ const match=/\blanguage-(\w+)\b/.exec(className||''); return !inline?(<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}><code className={`language-${match?.[1]||'plaintext'}`}>{children}</code></pre>):(<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); } }}>{message.content}</ReactMarkdown> ) : message.content === "..." && isChatLoading && index === displayHistory.length - 1 ? ( <div className="flex space-x-1 p-1"> <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div> </div> ) : null}
                                    {message.timer && (<div className="mt-1.5"><div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}><TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} /><Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => handleTimerComplete(message.timer!.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} /></div></div>)}
                                    {message.flashcard && (<div className="mt-1.5"><FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>)}
                                    {message.question && (<div className="mt-1.5"><FlashcardsQuestions type="question" data={message.question.data} onComplete={() => {}} isIlluminateEnabled={isIlluminateEnabled} /></div>)}
                                    {message.recommendation && !message.error && ( <div className={`mt-2 p-2 rounded-md border ${isIlluminateEnabled ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-700/50'}`}><p className={`text-xs font-medium mb-1 ${isIlluminateEnabled ? 'text-purple-800' : 'text-purple-300'}`}>AI Suggestion:</p><p className="text-xs mb-1.5">{message.recommendation.reasoning}</p><div className="flex justify-end gap-1.5"><button onClick={() => executeAiAction(message.recommendation!)} className="px-2 py-0.5 text-[10px] rounded bg-green-500 text-white hover:bg-green-600">Accept</button></div></div> )}
                                </div>
                            </div>
                        ))}
                        {!selectedConversationId && !isConversationsLoading && !isMessagesLoading && ( <div className="text-center p-6 text-sm italic text-gray-500"> Select or start a chat. </div> )}
                        {!isMessagesLoading && selectedConversationId && displayHistory.length === 0 && ( <div className="text-center p-6 text-sm italic text-gray-500"> Send a message to begin. </div> )}
                    </div>
                )}
                {aiSidebarTab === 'insights' && (
                    <div className="p-3 sm:p-4 space-y-4">
                        <button onClick={generateAiInsights} disabled={aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading'} className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white ... ${aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading' ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`}> {aiGeneratedInsights.isLoading ? ( <><div className="w-4 h-4 border-2 ... animate-spin"></div> Generating...</> ) : userTier === 'basic' || userTier === 'loading' ? ( <><Lock className="w-4 h-4" /> Generate (Pro/Premium)</> ) : ( <><Sparkles className="w-4 h-4" /> Generate Insights</> )} </button>
                        {aiGeneratedInsights.error && ( <p className="text-center text-sm text-red-500 p-4 border border-red-500/30 rounded-lg">{aiGeneratedInsights.error}</p> )}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (aiGeneratedInsights.score !== undefined || aiGeneratedInsights.timeManagement || aiGeneratedInsights.conflicts || aiGeneratedInsights.other) && (
                            <div className="space-y-3 animate-fadeIn">
                                {aiGeneratedInsights.score !== undefined && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-green-500' : 'border-green-400'}`}><p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Productivity Score</p><p className={`text-2xl font-bold ${headingClass}`}>{aiGeneratedInsights.score} <span className="text-sm font-normal">/ 100</span></p></div> )}
                                {aiGeneratedInsights.timeManagement && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-blue-500' : 'border-blue-400'}`}><p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Time Management</p><p className="text-sm">{aiGeneratedInsights.timeManagement}</p></div> )}
                                {aiGeneratedInsights.conflicts && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-orange-500' : 'border-orange-400'}`}><p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Potential Conflicts</p><p className="text-sm">{aiGeneratedInsights.conflicts}</p></div> )}
                                {aiGeneratedInsights.other && ( <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-purple-500' : 'border-purple-400'}`}><p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Additional Insights</p><p className="text-sm">{aiGeneratedInsights.other}</p></div> )}
                            </div>
                        )}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && aiGeneratedInsights.score === undefined && !aiGeneratedInsights.timeManagement && !aiGeneratedInsights.conflicts && !aiGeneratedInsights.other && userTier !== 'basic' && userTier !== 'loading' && ( <p className="text-center text-sm italic text-gray-500 p-6"> Click "Generate Insights"... </p> )}
                        {(userTier === 'basic' || userTier === 'loading') && !aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && ( <p className="text-center text-sm italic text-gray-500 p-6"> Upgrade for insights. </p> )}
                    </div>
                )}
            </div>
            {/* --- Footer --- */}
            <div className={`px-2 sm:px-3 pt-1 border-t ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`}>
                {userTier !== 'premium' && userTier !== 'loading' && ( <div className="pb-1.5 text-xs text-center"> <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}> Messages: {chatCount} / {currentChatLimit === Infinity ? 'Unlimited' : currentChatLimit} </span> {isChatLimitReached && (<span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>)} </div> )}
                <form onSubmit={handleChatSubmit} className="flex gap-1.5 items-center pb-2">
                    <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={isChatLimitReached?"Limit Reached...":aiSidebarTab==='insights'?"Switch to Chat...":!selectedConversationId?"Select/start chat...":"Ask TaskMaster..."} className={`flex-1 ${inputBg} border ${illuminateBorder} rounded-full px-4 py-1.5 text-sm ... ${isChatLimitReached||aiSidebarTab==='insights'||!selectedConversationId?'cursor-not-allowed':''}`} disabled={isChatLoading||isChatLimitReached||userTier==='loading'||!selectedConversationId||aiSidebarTab==='insights'} aria-label="Chat input" />
                    <button type="submit" disabled={isChatLoading||!chatMessage.trim()||isChatLimitReached||userTier==='loading'||!selectedConversationId||aiSidebarTab==='insights'} className={`bg-blue-600 text-white p-2 rounded-full ... ${isChatLimitReached||aiSidebarTab==='insights'||!selectedConversationId?'cursor-not-allowed':''}`} title="Send Message" aria-label="Send chat message"> {isChatLoading ? <div className="w-4 h-4 border-2 ... animate-spin"></div> : <Send className="w-4 h-4" />} </button>
                </form>
            </div>
        </div>
    );
}
