
import React, { useRef } from 'react';
import {
    BrainCircuit, X, PlusCircle, Sparkles, Send, TimerIcon, CheckCircle,
    Play, Pause, RotateCcw, Edit, Trash, Lock, MessageCircle // Added MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Ensure Katex CSS is imported here too
import { Timestamp } from 'firebase/firestore'; // Import Timestamp type

import { Timer } from './Timer'; // Assuming Timer is in the same directory or adjust path
import { FlashcardsQuestions } from './FlashcardsQuestions'; // Assuming FlashcardsQuestions is in the same directory or adjust path
import { UserTier } from '../lib/current-paying-user'; // Adjust path as needed
import { ItemType } from '../lib/dashboard-firebase'; // Adjust path as needed

// --- Types needed by the Sidebar ---

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
    flashcard?: { type: 'flashcard'; data: any[] }; // Use specific types if available
    question?: { type: 'question'; data: any[] }; // Use specific types if available
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
        nameGenerated?: boolean; // Flag for dynamic name generation
    };
}

// --- Helper Function (Moved from Dashboard) ---
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


// --- Props Interface ---
interface AiChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    userTier: UserTier;
    chatConversations: Conversation[];
    selectedConversationId: string | null;
    onSelectConversation: (id: string | null) => void;
    currentChatHistory: DisplayChatMessage[];
    isConversationsLoading: boolean;
    isMessagesLoading: boolean;
    isChatLoading: boolean;
    chatMessage: string;
    onChatMessageChange: (value: string) => void;
    onChatSubmit: (e: React.FormEvent) => Promise<void>;
    onNewChat: () => Promise<void>;
    aiSidebarTab: 'chat' | 'insights';
    onSetAiSidebarTab: (tab: 'chat' | 'insights') => void;
    aiGeneratedInsights: {
        score?: number;
        timeManagement?: string;
        conflicts?: string;
        other?: string;
        error?: string | null;
        isLoading: boolean;
        lastGeneratedSig: string | null;
    };
    onGenerateInsights: () => Promise<void>;
    onExecuteAiAction: (recommendation: AiActionRecommendationData) => Promise<void>;
    onTimerComplete: (timerId: string) => void;
    chatCount: number;
    currentChatLimit: number | typeof Infinity; // Allow Infinity
    isChatLimitReached: boolean;
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
}

// --- Component ---
export function AiChatSidebar({
    isOpen,
    onClose,
    userTier,
    chatConversations,
    selectedConversationId,
    onSelectConversation,
    currentChatHistory,
    isConversationsLoading,
    isMessagesLoading,
    isChatLoading,
    chatMessage,
    onChatMessageChange,
    onChatSubmit,
    onNewChat,
    aiSidebarTab,
    onSetAiSidebarTab,
    aiGeneratedInsights,
    onGenerateInsights,
    onExecuteAiAction,
    onTimerComplete,
    chatCount,
    currentChatLimit,
    isChatLimitReached,
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
}: AiChatSidebarProps) {

    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll Effect (remains internal to sidebar)
    React.useEffect(() => {
        if (chatEndRef.current && isOpen && aiSidebarTab === 'chat') {
            requestAnimationFrame(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
        }
    }, [currentChatHistory, isOpen, aiSidebarTab]);


    return (
        <div
            aria-hidden={!isOpen}
            className={`fixed top-0 right-0 h-full w-full max-w-sm md:max-w-md lg:max-w-[440px] z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                } ${cardClass} flex flex-col shadow-2xl border-l ${illuminateBorder}`}
            role="complementary"
            aria-labelledby="ai-sidebar-title"
        >
            {/* Sidebar Header */}
            <div className={`p-3 sm:p-4 border-b ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky top-0 backdrop-blur-sm z-20`}>
                <div className="flex justify-between items-center mb-2">
                    <h3 id="ai-sidebar-title" className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${illuminateTextBlue}`}>
                        <BrainCircuit className="w-5 h-5" /> TaskMaster AI
                    </h3>
                    <button onClick={onClose} className={`${iconColor} p-1 rounded-full ${illuminateBgHover} transition-colors transform hover:scale-110 active:scale-100`} title="Close Chat" aria-label="Close AI Chat Sidebar">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedConversationId || ''}
                        onChange={(e) => {
                            const newId = e.target.value;
                            // Allow selecting the placeholder "No chats yet" which results in null
                            onSelectConversation(newId || null);
                        }}
                        disabled={isConversationsLoading || chatConversations.length === 0}
                        className={`flex-grow ${inputBg} border ${illuminateBorder} rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm appearance-none ${iconColor}`}
                        title="Select Conversation"
                        style={{ textOverflow: 'ellipsis' }} // Optional: Use CSS ellipsis
                    >
                        {isConversationsLoading ? (
                            <option value="">Loading chats...</option>
                        ) : chatConversations.length > 0 ? (
                            // Add a default placeholder option if needed, or just show the first item
                            // <option value="" disabled>Select a chat</option>
                            chatConversations
                                // Sort by last activity (descending) for display
                                .sort((a, b) =>
                                    (b.data?.lastActivity?.seconds ?? b.data?.createdAt?.seconds ?? 0) -
                                    (a.data?.lastActivity?.seconds ?? a.data?.createdAt?.seconds ?? 0)
                                )
                                .map(conv => (
                                    <option key={conv.id} value={conv.id}>
                                        {getChatDisplayName(conv)}
                                    </option>
                                ))
                        ) : (
                            <option value="" disabled>No chats yet</option> // Make placeholder disabled
                        )}
                    </select>
                    <button onClick={onNewChat} disabled={isChatLoading || isConversationsLoading} className={`bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 flex items-center gap-1 text-xs`} title="Start New Chat">
                        <PlusCircle className="w-3.5 h-3.5" /> New
                    </button>
                </div>
                <div className={`mt-3 flex border-b ${illuminateBorder} -mb-[1px]`}>
                    <button onClick={() => onSetAiSidebarTab('chat')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'chat' ? `border-blue-500 ${illuminateTextBlue}` : `border-transparent ${subheadingClass} hover:${illuminateTextBlue}`}`}>
                        Chat
                    </button>
                    <button onClick={() => onSetAiSidebarTab('insights')} className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${aiSidebarTab === 'insights' ? `border-purple-500 ${illuminateTextPurple}` : `border-transparent ${subheadingClass} hover:${illuminateTextPurple}`}`}>
                        Insights <span className="text-xs font-normal opacity-70 ml-1">(BETA)</span>
                    </button>
                </div>
            </div>

            {/* Sidebar Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto" ref={aiSidebarTab === 'chat' ? chatEndRef : null}>
                {/* CHAT TAB */}
                {aiSidebarTab === 'chat' && (
                    <div className="p-3 space-y-3">
                        {isMessagesLoading && selectedConversationId && (
                            <div className="space-y-3 animate-pulse p-4">
                                <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                                <div className={`h-12 rounded w-2/3 ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                                <div className={`h-8 rounded w-3/4 ml-auto ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-700'}`}></div>
                            </div>
                        )}
                        {!isMessagesLoading && currentChatHistory.map((message, index) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`} style={{ animationDelay: `${index * 30}ms`, animationDuration: '300ms' }}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm break-words ${message.role === 'user'
                                    ? (isIlluminateEnabled ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white')
                                    : message.error
                                        ? (isIlluminateEnabled ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-900/30 text-red-300 border border-red-700/50')
                                        : (isIlluminateEnabled ? 'bg-gray-100 text-gray-800 border border-gray-200/80' : 'bg-gray-700/80 text-gray-200 border border-gray-600/50')
                                    }`}>

                                    {/* Render Markdown - Check content */}
                                    {message.content && message.content !== "..." ? (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath, remarkGfm]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-1 text-xs sm:text-sm" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                                code: ({ node, inline, className, children, ...props }) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? (<pre className={`!bg-black/40 p-2 rounded-md overflow-x-auto my-1 text-[11px] leading-snug ${className}`} {...props}> <code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code> </pre>) : (<code className={`!bg-black/20 px-1 rounded text-xs ${className}`} {...props}>{children}</code>); },
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    ) : message.content === "..." && isChatLoading && index === currentChatHistory.length - 1 ? (
                                        // Loading indicator
                                        <div className="flex space-x-1 p-1">
                                            <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                            <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                            <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                        </div>
                                    ) : null /* Render nothing if "..." but not loading/last */}

                                    {message.timer && (
                                        <div className="mt-1.5">
                                            <div className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm ${isIlluminateEnabled ? 'bg-blue-100/70 border border-blue-200/80' : 'bg-gray-800/60 border border-gray-600/50'}`}>
                                                <TimerIcon className={`w-4 h-4 flex-shrink-0 ${illuminateTextBlue}`} />
                                                <Timer key={message.timer.id} initialDuration={message.timer.duration} onComplete={() => onTimerComplete(message.timer!.id)} compact={true} isIlluminateEnabled={isIlluminateEnabled} />
                                            </div>
                                        </div>
                                    )}
                                    {message.flashcard && (
                                        <div className="mt-1.5">
                                            <FlashcardsQuestions type="flashcard" data={message.flashcard.data} onComplete={() => { }} isIlluminateEnabled={isIlluminateEnabled} />
                                        </div>
                                    )}
                                    {message.question && (
                                        <div className="mt-1.5">
                                            <FlashcardsQuestions type="question" data={message.question.data} onComplete={() => { }} isIlluminateEnabled={isIlluminateEnabled} />
                                        </div>
                                    )}
                                    {/* Render Action Recommendation Buttons only if no error */}
                                    {message.recommendation && !message.error && (
                                        <div className={`mt-2 p-2 rounded-md border ${isIlluminateEnabled ? 'bg-purple-50 border-purple-200' : 'bg-purple-900/20 border-purple-700/50'}`}>
                                            <p className={`text-xs font-medium mb-1 ${isIlluminateEnabled ? 'text-purple-800' : 'text-purple-300'}`}>AI Suggestion:</p>
                                            <p className="text-xs mb-1.5">{message.recommendation.reasoning}</p>
                                            <div className="flex justify-end gap-1.5">
                                                <button onClick={() => onExecuteAiAction(message.recommendation!)} className="px-2 py-0.5 text-[10px] rounded bg-green-500 text-white hover:bg-green-600">Accept</button>
                                                {/* Reject simply hides it visually - no backend change needed here */}
                                                {/* <button onClick={() => { setCurrentChatHistory(prev => prev.map(m => m.id === message.id ? {...m, recommendation: undefined} : m)) }} className="px-2 py-0.5 text-[10px] rounded bg-red-500 text-white hover:bg-red-600">Reject</button> */}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isMessagesLoading && currentChatHistory.length === 0 && selectedConversationId && (
                            <div className="flex justify-start animate-fadeIn">
                                <div className={`${isIlluminateEnabled ? 'bg-gray-100 border border-gray-200/80' : 'bg-gray-700/80 border border-gray-600/50'} rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm`}>
                                    <div className="flex space-x-1 p-1">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-100 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-200 opacity-60 ${isIlluminateEnabled ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {!selectedConversationId && !isConversationsLoading && !isMessagesLoading && (
                            <div className="text-center p-6 text-sm italic text-gray-500">
                                Select a conversation or start a new one to begin chatting.
                            </div>
                        )}
                        {!isMessagesLoading && selectedConversationId && currentChatHistory.length === 0 && (
                            <div className="text-center p-6 text-sm italic text-gray-500">
                                Send a message to start the conversation.
                            </div>
                        )}
                    </div>
                )}

                {/* INSIGHTS TAB */}
                {aiSidebarTab === 'insights' && (
                    <div className="p-3 sm:p-4 space-y-4">
                        <button
                            onClick={onGenerateInsights}
                            disabled={aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading'}
                            className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors transform hover:scale-[1.02] active:scale-100 shadow-md ${aiGeneratedInsights.isLoading || userTier === 'basic' || userTier === 'loading' ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`}
                        >
                            {aiGeneratedInsights.isLoading ? (
                                <> <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating... </>
                            ) : userTier === 'basic' || userTier === 'loading' ? (
                                <> <Lock className="w-4 h-4" /> Generate Insights (Pro/Premium)</>
                            ) : (
                                <> <Sparkles className="w-4 h-4" /> Generate Insights </>
                            )}
                        </button>
                        {aiGeneratedInsights.error && (
                            <p className="text-center text-sm text-red-500 p-4 border border-red-500/30 rounded-lg">{aiGeneratedInsights.error}</p>
                        )}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (aiGeneratedInsights.score !== undefined || aiGeneratedInsights.timeManagement || aiGeneratedInsights.conflicts || aiGeneratedInsights.other) && (
                            <div className="space-y-3 animate-fadeIn">
                                {aiGeneratedInsights.score !== undefined && (
                                    <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-green-500' : 'border-green-400'}`}>
                                        <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Productivity Score</p>
                                        <p className={`text-2xl font-bold ${headingClass}`}>{aiGeneratedInsights.score} <span className="text-sm font-normal">/ 100</span></p>
                                    </div>
                                )}
                                {aiGeneratedInsights.timeManagement && (
                                    <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-blue-500' : 'border-blue-400'}`}>
                                        <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Time Management</p>
                                        <p className="text-sm">{aiGeneratedInsights.timeManagement}</p>
                                    </div>
                                )}
                                {aiGeneratedInsights.conflicts && (
                                    <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-orange-500' : 'border-orange-400'}`}>
                                        <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Potential Conflicts</p>
                                        <p className="text-sm">{aiGeneratedInsights.conflicts}</p>
                                    </div>
                                )}
                                {aiGeneratedInsights.other && (
                                    <div className={`${cardClass} p-3 rounded-lg border-l-4 ${isIlluminateEnabled ? 'border-purple-500' : 'border-purple-400'}`}>
                                        <p className={`text-xs font-medium mb-1 ${subheadingClass}`}>Additional Insights</p>
                                        <p className="text-sm">{aiGeneratedInsights.other}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {!aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && aiGeneratedInsights.score === undefined && !aiGeneratedInsights.timeManagement && !aiGeneratedInsights.conflicts && !aiGeneratedInsights.other && userTier !== 'basic' && userTier !== 'loading' && (
                            <p className="text-center text-sm italic text-gray-500 p-6">
                                Click "Generate Insights" to get an AI analysis of your productivity based on your current items and context.
                            </p>
                        )}
                        {(userTier === 'basic' || userTier === 'loading') && !aiGeneratedInsights.isLoading && !aiGeneratedInsights.error && (
                            <p className="text-center text-sm italic text-gray-500 p-6">
                                Upgrade to Pro or Premium to generate AI-powered productivity insights.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Sidebar Footer (Chat Input Area) */}
            <div className={`px-2 sm:px-3 pt-1 border-t ${illuminateBorder} ${isIlluminateEnabled ? 'bg-gray-100/80' : 'bg-gray-800/90'} flex-shrink-0 sticky bottom-0 backdrop-blur-sm z-10`}>
                {userTier !== 'premium' && userTier !== 'loading' && (
                    <div className="pb-1.5 text-xs text-center">
                        <span className={isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}>
                            Messages this month: {chatCount} / {currentChatLimit === Infinity ? 'Unlimited' : currentChatLimit}
                        </span>
                        {isChatLimitReached && (
                            <span className="text-red-500 ml-1 font-medium">(Limit Reached)</span>
                        )}
                    </div>
                )}
                <form onSubmit={onChatSubmit} className="flex gap-1.5 items-center pb-2">
                    <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => onChatMessageChange(e.target.value)}
                        placeholder={isChatLimitReached ? "Monthly limit reached..." : aiSidebarTab === 'insights' ? "Switch to Chat tab to talk..." : !selectedConversationId ? "Select or start a chat..." : "Ask TaskMaster AI..."}
                        className={`flex-1 ${inputBg} border ${illuminateBorder} rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 ${isChatLimitReached || aiSidebarTab === 'insights' || !selectedConversationId ? 'cursor-not-allowed' : ''}`}
                        disabled={isChatLoading || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'}
                        aria-label="Chat input"
                    />
                    <button
                        type="submit"
                        disabled={isChatLoading || !chatMessage.trim() || isChatLimitReached || userTier === 'loading' || !selectedConversationId || aiSidebarTab === 'insights'}
                        className={`bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 shadow-sm flex-shrink-0 ${isChatLimitReached || aiSidebarTab === 'insights' || !selectedConversationId ? 'cursor-not-allowed' : ''}`}
                        title="Send Message"
                        aria-label="Send chat message"
                    >
                        {isChatLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
