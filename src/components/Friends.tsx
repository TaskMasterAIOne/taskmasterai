import React, { useState, useEffect, useRef, type ChangeEvent, type FormEvent, useCallback, useMemo } from "react"; // Added useMemo
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Users2, MessageSquare, PlusCircle, Paperclip, Send, Users, CheckCircle, XCircle, Edit, Trash2, Search, Bell, Settings, ChevronRight, ChevronLeft, Image, Smile, Mic, MoreVertical, Star, Filter, X, LogOut, Clock, Check, AudioLines, FileText, Video, Link, Bot, ThumbsUp, Heart, Laugh, Angry, Sad, MessageCircle, LogOutIcon, Camera, Edit3, Repeat, UserX, AlertTriangle, Loader2, FileQuestion, EyeOff, Eye
} from 'lucide-react';
import { Sidebar } from "./Sidebar";
import { getCurrentUser } from "../lib/settings-firebase";
import {
  listenToChatsRealtime,
  listenToMessagesRealtime,
  listenToFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  createGroupChat,
  sendMessage,
  uploadChatFile,
  renameChat,
  leaveGroupChat,
  deleteMessage,
  getUserProfile,
  setupPresenceSystem,
  listenToFriendsOnlineStatus,
  setTypingIndicator,
  listenToTypingIndicators,
  getUserFriends,
  updateGroupChatPhoto,
  unfriendUser,
  addReactionToMessage,
  removeReactionFromMessage,
} from "../lib/friends-firebase";
import { geminiApiKey } from '../lib/dashboard-firebase';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';

interface Chat {
  id: string;
  isGroup: boolean;
  members: string[];
  memberDetails?: Record<string, { name?: string; photoURL?: string }>;
  name?: string;
  lastMessage?: string;
  updatedAt?: Date;
  createdBy?: string;
  photoURL?: string;
  admins?: string[];
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderPhotoURL?: string | null;
  fileURL?: string;
  fileType?: 'image' | 'audio' | 'video' | 'file';
  fileName?: string;
  timestamp?: Date;
  reactions?: Record<string, string>; 
  aiResponseTo?: string; 
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected";
  fromUserPhotoURL?: string | null;
  createdAt?: Date;
}

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  photoURL?: string | null;
  status?: "online" | "offline" | "away";
  lastSeen?: Date;
}

interface GeminiApiResponse {
    text: string | null;
    error: string | null;
}

const slideUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } } };
const slideRight = { hidden: { opacity: 0, x: -15 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } } };
const slideLeft = { hidden: { opacity: 0, x: 15 }, visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.25 } } };
const staggerChildren = { visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } }, hidden: {} };
const itemFadeIn = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const AVAILABLE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJI_SET_FOR_PICKER = [
  "😊", "😂", "❤️", "👍", "🎉", "🔥", "👋", "😎", "🤔", "😢", "😍", "🙏", "👏", "💯", "🚀", "✨",
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😇", "😉", "😌", "😋", "😛", "😜", "😝", "🥲", "🤫",
  "🥳", "🥺", "🥰", "🤩", "🥲", "🤯", "😴", "🤤", "😪", "😫", "😩", "😮‍💨", "😮", "😱", "😨", "😰",
  "😥", "😓", "😯", "😕", "🫤", "😒", "🙄", "😤", "😠", "😡", "🤬", "🤝", "🙌", "🤲", "✍️", "👀",
];

export function Friends() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null); 
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem("isSidebarCollapsed") || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem("isBlackoutEnabled") || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem("isSidebarBlackoutEnabled") || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem("isIlluminateEnabled") || 'true'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem("isSidebarIlluminateEnabled") || 'false'));

  const [chats, setChats] = useState<Chat[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string }>>({}); 

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // Raw messages
  const [newMessage, setNewMessage] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isEditingChatName, setIsEditingChatName] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [groupPhotoUploading, setGroupPhotoUploading] = useState(false);

  const [friendEmail, setFriendEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedAudioBlob, setAttachedAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupEmails, setGroupEmails] = useState("");

  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showMobileAside, setShowMobileAside] = useState(false); 

  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "requests">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null); 
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null); 
  const [friendToUnfriend, setFriendToUnfriend] = useState<UserProfile | null>(null);

  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showAiAssistantChats, setShowAiAssistantChats] = useState(true);


  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); }, [isBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
  useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); }, [isIlluminateEnabled]);
  useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

  useEffect(() => {
    document.body.classList.toggle('illuminate-mode', isIlluminateEnabled);
    document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled);
    if (isIlluminateEnabled) document.body.classList.remove('blackout-mode');
    else if (isBlackoutEnabled) document.body.classList.add('blackout-mode');
  }, [isIlluminateEnabled, isBlackoutEnabled]);

  useEffect(() => { const checkMobileView = () => setIsMobileView(window.innerWidth < 768); window.addEventListener("resize", checkMobileView); checkMobileView(); return () => window.removeEventListener("resize", checkMobileView); }, []);
  
  const displayedMessages = useMemo(() => {
    if (!showAiAssistantChats && user?.uid) {
        // Identify AI messages and the user queries they respond to from the raw `messages` list
        const aiMessageResponses = new Map<string, string>(); // Maps userQueryId to aiMessageId
        messages.forEach(msg => {
            if (msg.senderId === "AI_ASSISTANT_ID" && msg.aiResponseTo) {
                const originalQuery = messages.find(m => m.id === msg.aiResponseTo && m.senderId === user.uid);
                if (originalQuery) {
                    aiMessageResponses.set(originalQuery.id, msg.id);
                }
            }
        });

        return messages.filter(msg => {
            // If it's an AI message
            if (msg.senderId === "AI_ASSISTANT_ID") {
                // Show it only if it's a response to a user query (already implicitly handled by map)
                // and that query itself is not hidden by this filter.
                // Effectively, we hide all AI messages, and then unhide specific ones if their user query is shown.
                // This is simpler: if it's an AI message and its original user query is linked,
                // its visibility depends on whether the user query is shown.
                // We only show AI messages if their user query is also shown.
                // If msg.aiResponseTo is a key in aiMessageResponses, it means it's an AI response to a user query.
                // We need to find if the original user query (msg.aiResponseTo) is itself NOT hidden.
                if (msg.aiResponseTo && aiMessageResponses.has(msg.aiResponseTo)) {
                     return true; // Show AI response if its linked user query is shown (default behavior for user messages)
                }
                return false; // Hide general AI messages or unlinked ones
            }
            // If it's a user's message
            if (msg.senderId === user.uid) {
                // Hide it if it's an AI query that has an AI response
                if (aiMessageResponses.has(msg.id)) {
                    return false; 
                }
            }
            // Show all other messages (user's non-AI queries, other participants' messages)
            return true;
        });
    }
    return messages; // Show all raw messages if AI chats are not hidden
  }, [messages, showAiAssistantChats, user]);


  useEffect(() => { 
    // Scroll based on displayedMessages length or selectedChat change
    if (displayedMessages.length > 0 || selectedChat) {
        requestAnimationFrame(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }); 
    }
  }, [displayedMessages, selectedChat]); // Use displayedMessages here

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) setShowEmojiPicker(false);
    if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) setShowReactionPickerFor(null);
    if (showChatOptions && event.target instanceof Element && !event.target.closest('.chat-options-trigger') && !event.target.closest('.chat-options-menu')) {
        setShowChatOptions(false);
    }
  }, [showChatOptions]);

  useEffect(() => { document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [handleClickOutside]);

  const containerClass = isIlluminateEnabled ? "bg-slate-100 text-slate-800" : isBlackoutEnabled ? "bg-black text-slate-200" : "bg-slate-900 text-slate-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-slate-700 border border-slate-200 shadow-sm" : isBlackoutEnabled ? "bg-slate-900 text-slate-300 border border-slate-700 shadow-md shadow-black/30" : "bg-slate-800 text-slate-300 border border-slate-700 shadow-lg shadow-black/30";
  const headingClass = isIlluminateEnabled ? "text-slate-700" : "text-slate-100";
  const subheadingClass = isIlluminateEnabled ? "text-slate-500" : "text-slate-400";
  const subtleTextColor = isIlluminateEnabled ? "text-slate-400" : "text-slate-500";
  const iconColor = isIlluminateEnabled ? "text-slate-500 hover:text-slate-600" : "text-slate-400 hover:text-slate-300";
  const illuminateBorder = isIlluminateEnabled ? "border-slate-200/90" : "border-slate-700/80";
  const illuminateBgHover = isIlluminateEnabled ? "hover:bg-slate-100/80" : "hover:bg-slate-700/60";
  
  const chatHeaderClass = isIlluminateEnabled ? "bg-white/80 backdrop-blur-md border-b border-slate-200/90" : "bg-slate-800/80 backdrop-blur-md border-b border-slate-700/80";
  const messageAreaClass = isIlluminateEnabled ? "bg-slate-50/90" : isBlackoutEnabled ? "bg-black" : "bg-slate-800/95";
  
  const ownMessageClass = isIlluminateEnabled ? "bg-blue-500 text-white" : "bg-blue-600 text-white";
  const otherMessageClass = isIlluminateEnabled ? "bg-white border border-slate-200/80 text-slate-700" : "bg-slate-700 text-slate-200";
  const aiMessageClass = isIlluminateEnabled ? "bg-purple-50 border border-purple-200/80 text-purple-700" : "bg-purple-900/40 border border-purple-700/50 text-purple-300";
  
  const chatInputContainerClass = isIlluminateEnabled ? "bg-white/80 backdrop-blur-md border-t border-slate-200/90" : "bg-slate-800/80 backdrop-blur-md border-t border-slate-700/80";
  const inputBg = isIlluminateEnabled ? "bg-slate-100 hover:bg-slate-200/50 border-slate-300/80 focus:border-blue-500 focus:ring-blue-500/50 text-slate-800 placeholder-slate-400" : "bg-slate-700 hover:bg-slate-600/70 border-slate-600/70 focus:border-blue-500 focus:ring-blue-500/50 text-slate-100 placeholder-slate-400";
  const asideClass = isIlluminateEnabled ? "bg-white border-l border-slate-200/90" : isBlackoutEnabled ? "bg-black border-l border-slate-800/70" : "bg-slate-800 border-l border-slate-700/70";
  const modalClass = isIlluminateEnabled ? "bg-white shadow-xl border border-slate-200/90 text-slate-800" : isBlackoutEnabled ? "bg-slate-900 shadow-2xl border border-slate-700 text-slate-200" : "bg-slate-800 shadow-2xl border border-slate-700 text-slate-200";
  
  const acceptButtonClass = `p-1.5 rounded-full transition-colors ${isIlluminateEnabled ? 'text-green-500 hover:bg-green-100/80' : 'text-green-500 hover:bg-green-500/15'}`;
  const rejectButtonClass = `p-1.5 rounded-full transition-colors ${isIlluminateEnabled ? 'text-red-500 hover:bg-red-100/80' : 'text-red-500 hover:bg-red-500/15'}`;
  
  const selectedChatClass = isIlluminateEnabled ? "bg-slate-100/90" : "bg-slate-700/40";
  const chatListItemClass = `rounded-md transition-all duration-100 ${isIlluminateEnabled ? 'hover:bg-slate-50/90 active:bg-slate-100/90' : 'hover:bg-slate-700/25 active:bg-slate-700/40'}`;
  
  const primaryButtonClass = `px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-100 transform focus:outline-none focus:ring-1 focus:ring-offset-1 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${isIlluminateEnabled ? 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400 focus:ring-offset-white' : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400 focus:ring-offset-slate-800'}`;
  const secondaryButtonClass = `px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-100 transform focus:outline-none focus:ring-1 focus:ring-offset-1 active:scale-[0.98] disabled:opacity-50 ${isIlluminateEnabled ? 'bg-slate-200 hover:bg-slate-300/80 text-slate-600 focus:ring-slate-300 focus:ring-offset-white' : 'bg-slate-600 hover:bg-slate-500/80 text-slate-200 focus:ring-slate-500 focus:ring-offset-slate-800'}`;
  const iconButtonClass = `p-1.5 rounded-full transition-colors duration-100 ${iconColor} ${illuminateBgHover} disabled:opacity-40 disabled:cursor-not-allowed`;
  
  const activeTabClass = isIlluminateEnabled ? "border-blue-500 text-blue-500 font-medium" : "border-blue-400 text-blue-400 font-medium";
  const inactiveTabClass = `border-transparent ${subtleTextColor} hover:border-slate-300/70 hover:text-${isIlluminateEnabled ? 'slate-600' : 'slate-300'}`;

  useEffect(() => {
    const currentAuthUser = getCurrentUser();
    if (!currentAuthUser) { navigate("/login"); return; }
    setUser(currentAuthUser); 
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeChats: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    let unsubscribeFriendStatus: (() => void) | null = null;
    let cleanupPresence: (() => void) | null = null;

    const setupListeners = async () => {
        if (!currentAuthUser?.uid) return;
        const profileData = await getUserProfile(currentAuthUser.uid);
        setUserProfile(profileData); 
        
        cleanupPresence = setupPresenceSystem(currentAuthUser.uid);

        unsubscribeChats = listenToChatsRealtime(currentAuthUser.uid, (newChats) => {
            setChats(newChats.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)));
        });

        unsubscribeRequests = listenToFriendRequests(currentAuthUser.uid, setFriendRequests);
        
        const friendsList = await getUserFriends(currentAuthUser.uid);
        setFriends(friendsList);
        const friendIds = friendsList.map((friend) => friend.id);

        if (friendIds.length > 0) {
            unsubscribeFriendStatus = listenToFriendsOnlineStatus(friendIds, (statuses) => {
                 const onlineIds = new Set<string>();
                 statuses.forEach(status => { if (status.status === 'online' || status.status === 'away') onlineIds.add(status.id); });
                 setOnlineFriendIds(onlineIds);
                 setFriends(currentFriends => currentFriends.map(f => {
                    const updatedStatus = statuses.find(s => s.id === f.id);
                    return updatedStatus ? { ...f, status: updatedStatus.status, lastSeen: updatedStatus.lastSeen } : f;
                 }));
            });
        }
    };
    setupListeners();
    return () => {
      unsubscribeProfile?.(); unsubscribeChats?.(); unsubscribeRequests?.(); unsubscribeFriendStatus?.(); cleanupPresence?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [navigate]); 

  // Effect for listening to Firebase messages and updating raw `messages` state
  useEffect(() => {
    if (!selectedChat || !user?.uid) { 
        setMessages([]); // Clear raw messages
        setTypingUsers({}); 
        return; 
    }
    const unsubscribeMessages = listenToMessagesRealtime(selectedChat.id, (newMessagesFromFirebase) => {
        setMessages(newMessagesFromFirebase); // Update raw messages
    });
    const unsubscribeTyping = listenToTypingIndicators(selectedChat.id, user.uid, setTypingUsers);
    return () => { unsubscribeMessages(); unsubscribeTyping(); };
  }, [selectedChat, user]); // Only depends on selectedChat and user

  const formatTimestamp = (timestamp: any, type: 'message' | 'chatList' | 'lastSeen' = 'message'): string => {
    if (!timestamp) return "";
    const date = timestamp instanceof Date ? timestamp : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp || Date.now()));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (type === 'lastSeen') {
        if (diffSeconds < 10) return "Online";
        if (diffSeconds < 60) return `Seen ${diffSeconds}s ago`;
        if (diffMinutes < 60) return `Seen ${diffMinutes}m ago`;
        if (diffHours < 24) return `Seen ${diffHours}h ago`;
        return `Seen ${diffDays}d ago`;
    }

    if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getChatDisplayInfo = (chat: Chat): { name: string; photoURL?: string | null; statusText?: string, isOnline?: boolean } => {
    if (!user) return { name: 'Loading...' };
    if (chat.isGroup) {
        return { name: chat.name || "Group Chat", photoURL: chat.photoURL };
    }
    const otherUserId = chat.members.find((id) => id !== user.uid);
    if (otherUserId) {
        const otherFriendProfile = friends.find(f => f.id === otherUserId) || chat.memberDetails?.[otherUserId];
        const isOnline = onlineFriendIds.has(otherUserId) || otherFriendProfile?.status === 'online';
        let statusText = "Offline";
        if (isOnline) statusText = "Online";
        else if (otherFriendProfile?.lastSeen) statusText = formatTimestamp(otherFriendProfile.lastSeen, 'lastSeen');
        
        return {
            name: otherFriendProfile?.name || otherFriendProfile?.displayName || 'Friend',
            photoURL: chat.photoURL || otherFriendProfile?.photoURL,
            statusText,
            isOnline
        };
    }
    return { name: "Direct Chat" };
  };

  const getFileTypeFromInfo = (fileNameOrMimeType?: string): Message['fileType'] => {
    if (!fileNameOrMimeType) return 'file';
    const lowerCase = fileNameOrMimeType.toLowerCase();
    if (lowerCase.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(lowerCase)) return 'image';
    if (lowerCase.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|opus|webm)$/i.test(lowerCase)) return 'audio';
    if (lowerCase.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(lowerCase)) return 'video';
    return 'file';
  };

  const getSimpleFileName = (fileSource: File | string, maxLength = 25): string => {
    let name: string;
    if (fileSource instanceof File) {
        name = fileSource.name;
    } else {
        try {
            const url = new URL(fileSource);
            const pathParts = decodeURIComponent(url.pathname).split('/');
            const fullFileNameWithQuery = pathParts[pathParts.length - 1];
            const actualFileName = fullFileNameWithQuery.split('?')[0]; 
            const nameParts = actualFileName.split('_');
            if (nameParts.length > 1 && /^\d{13,}$/.test(nameParts[0])) {
                name = nameParts.slice(1).join('_');
            } else {
                name = actualFileName;
            }
        } catch { name = 'file'; }
    }
    return name.length > maxLength ? name.substring(0, maxLength - 3) + "..." : name;
  };
  
  const clearNotifications = () => { setError(null); setSuccess(null); };
  const showNotification = (type: 'success' | 'error', message: string, duration = 2500) => {
    clearNotifications();
    if (type === 'success') setSuccess(message);
    else setError(message);
    setTimeout(clearNotifications, duration);
  };

  const handleSelectChat = (chat: Chat) => {
    if (selectedChat?.id === chat.id && !isMobileView) return; 
    setSelectedChat(chat);
    // `messages` will be cleared by the useEffect listener for selectedChat
    setTypingUsers({});
    setIsEditingChatName(false);
    setShowChatOptions(false);
    clearAttachments();
    setIsAiModeActive(false); 
    if (isMobileView) setShowMobileAside(false); 
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const clearAttachments = () => {
    setAttachedFile(null);
    setAttachedAudioBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop(); 
    }
    setIsRecording(false); 
    audioChunksRef.current = [];
  };

  const handleSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!selectedChat || !user || isAiThinking || (!newMessage.trim() && !attachedFile && !attachedAudioBlob)) return;

    const currentMessageText = newMessage;
    const currentAttachedFile = attachedFile;
    const currentAttachedAudioBlob = attachedAudioBlob;

    setNewMessage("");
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (user?.uid && selectedChat?.id) {
        setTypingIndicator(selectedChat.id, user.uid, false, userProfile?.name || user.displayName);
    }

    if (isAiModeActive) {
        handleSendToAI(currentMessageText, currentAttachedFile); // Pass file for context
        clearAttachments(); 
        return;
    }
    
    let fileURL = "";
    let fileMeta = { type: undefined as Message['fileType'], name: undefined as string | undefined };
    let uploadAttempted = false;

    try {
      if (currentAttachedFile) {
        uploadAttempted = true;
        setFileUploading(true);
        setUploadProgress(0);
        fileMeta.type = getFileTypeFromInfo(currentAttachedFile.type || currentAttachedFile.name);
        fileMeta.name = currentAttachedFile.name; 
        fileURL = await uploadChatFile(selectedChat.id, currentAttachedFile, setUploadProgress);
      } else if (currentAttachedAudioBlob) {
        uploadAttempted = true;
        setFileUploading(true);
        setUploadProgress(0);
        const audioFile = new File([currentAttachedAudioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
        fileMeta.type = 'audio';
        fileMeta.name = audioFile.name; 
        fileURL = await uploadChatFile(selectedChat.id, audioFile, setUploadProgress);
      }

      if (currentMessageText.trim() || fileURL) {
        await sendMessage(
            selectedChat.id, 
            currentMessageText.trim(), 
            user.uid, 
            fileURL || undefined, 
            fileURL ? fileMeta.type : undefined, 
            fileURL ? fileMeta.name : undefined
        );
      } else if (uploadAttempted && !fileURL) {
        showNotification('error', 'File upload failed. Message not sent.');
      }
    } catch (err: any) {
      console.error("Error sending message or uploading file:", err);
      showNotification('error', `Failed to send: ${err.message || 'Unknown error'}`);
    } finally {
      clearAttachments(); 
      if (uploadAttempted) {
        setFileUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) { 
        showNotification('error', 'File size exceeds 15MB limit.');
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      clearAttachments(); 
      setAttachedFile(file);
    }
  };

  const handleTyping = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    if (!selectedChat || !user || isAiModeActive || !user.uid || !selectedChat.id) return;

    if (value.trim().length > 0 && !typingTimeoutRef.current) { 
        setTypingIndicator(selectedChat.id, user.uid, true, userProfile?.name || user.displayName);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => { 
      if (user?.uid && selectedChat?.id) {
          setTypingIndicator(selectedChat.id, user.uid, false, userProfile?.name || user.displayName);
      }
      typingTimeoutRef.current = null;
    }, 1200); 
  };

  const handleSendFriendRequest = async () => { if (!friendEmail.trim() || !user) return; setError(null); setSuccess(null); try { await sendFriendRequest(user.uid, friendEmail.trim()); setFriendEmail(""); showNotification('success', "Friend request sent!"); } catch (err: any) { console.error("Error sending friend request:", err); showNotification('error', err.message || "Failed to send request."); } };
  const handleAcceptRequest = async (requestId: string) => { if (!user) return; try { await acceptFriendRequest(requestId, user.uid); showNotification('success', "Friend request accepted!"); } catch (err: any) { console.error("Error accepting request:", err); showNotification('error', err.message || "Failed to accept request."); } };
  const handleRejectRequest = async (requestId: string) => { if (!user) return; try { await rejectFriendRequest(requestId, user.uid); showNotification('success', "Friend request rejected."); } catch (err: any) { console.error("Error rejecting request:", err); showNotification('error', err.message || "Failed to reject request."); } };
  const handleCreateGroupChat = async () => { if (!groupName.trim() || !user) return; setError(null); setSuccess(null); try { const emails = groupEmails.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean); await createGroupChat(groupName.trim(), emails, user.uid); setGroupName(""); setGroupEmails(""); setIsGroupModalOpen(false); showNotification('success', "Group chat created!"); setActiveTab('chats'); } catch (err: any) { console.error("Error creating group chat:", err); showNotification('error', err.message || "Failed to create group."); } };

  const handleRenameChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newChatName.trim() || !selectedChat.isGroup || !user) return;
    setError(null); setSuccess(null);
    try {
      await renameChat(selectedChat.id, newChatName.trim(), user.uid);
      setIsEditingChatName(false);
      setSelectedChat(prev => prev ? { ...prev, name: newChatName.trim() } : null);
      showNotification('success', 'Group renamed!');
    } catch (err: any) {
      console.error("Error renaming chat:", err);
      showNotification('error', err.message || 'Failed to rename group.');
    }
  };

  const handleGroupPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !selectedChat || !selectedChat.isGroup || !user) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { 
        showNotification('error', 'Group photo exceeds 5MB limit.');
        if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
        return;
    }
    setGroupPhotoUploading(true);
    showNotification('success', 'Uploading...'); 
    try {
      await updateGroupChatPhoto(selectedChat.id, file, user.uid);
      showNotification('success', 'Group photo updated!');
    } catch (err: any) {
      console.error("Error updating group photo:", err);
      showNotification('error', err.message || 'Failed to update photo.');
    } finally {
      setGroupPhotoUploading(false);
      if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
    }
  };

  const handleLeaveGroupChat = async () => { if (!selectedChat || !selectedChat.isGroup || !user) return; setShowChatOptions(false); const confirmLeave = window.confirm("Are you sure you want to leave this group?"); if (!confirmLeave) return; setError(null); setSuccess(null); try { await leaveGroupChat(selectedChat.id, user.uid); setSelectedChat(null); showNotification('success', "You left the group."); } catch (err: any) { console.error("Error leaving group:", err); showNotification('error', err.message || "Failed to leave group."); } };
  const handleDeleteMessageConfirmed = async () => { if (!selectedChat || !user || !messageToDelete) return; setError(null); setSuccess(null); try { await deleteMessage(selectedChat.id, messageToDelete, user.uid); } catch (err: any) { console.error("Error deleting message:", err); showNotification('error', err.message || "Failed to delete message."); } finally { setMessageToDelete(null); } };
  const addEmoji = (emoji: string) => { setNewMessage((prev) => prev + emoji); setShowEmojiPicker(false); chatInputRef.current?.focus(); };
  
  const startRecording = async () => { if (isRecording) return; clearAttachments(); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const options = { mimeType: 'audio/webm;codecs=opus' }; 
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm'; 
         if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            showNotification('error', "Audio recording format not supported.");
            return;
        }
    }
    const recorder = new MediaRecorder(stream, options); mediaRecorderRef.current = recorder; audioChunksRef.current = []; recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data); recorder.onstop = () => { const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType }); setAttachedAudioBlob(audioBlob); stream.getTracks().forEach(track => track.stop()); mediaRecorderRef.current = null; }; recorder.start(); setIsRecording(true); } catch (err) { console.error("Error starting recording:", err); showNotification('error', "Mic access denied or error starting recording."); } };
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleReaction = async (messageId: string, emoji: string) => {
    console.log("[HandleReaction] Called with:", { messageId, emoji, userId: user?.uid, selectedChatId: selectedChat?.id });
    if (!selectedChat || !user?.uid) {
        console.warn("[HandleReaction] Aborting: No selectedChat or user.uid.", { selectedChat, userId: user?.uid });
        return;
    }

    const message = messages.find(m => m.id === messageId); // Find in raw messages
    if (!message) {
        console.warn("[HandleReaction] Aborting: Message not found in raw messages for ID:", messageId);
        return;
    }
    console.log("[HandleReaction] Found message:", message);

    const currentReactions = message.reactions || {};
    const userPreviousReaction = currentReactions[user.uid];
    console.log("[HandleReaction] Current reactions on message:", currentReactions, "User's previous reaction:", userPreviousReaction);

    const newReactionsOptimistic = { ...currentReactions };
    if (userPreviousReaction === emoji) {
        delete newReactionsOptimistic[user.uid];
        console.log("[HandleReaction] Optimistically REMOVING reaction. New optimistic reactions:", newReactionsOptimistic);
    } else {
        newReactionsOptimistic[user.uid] = emoji;
        console.log("[HandleReaction] Optimistically ADDING/CHANGING reaction to:", emoji, ". New optimistic reactions:", newReactionsOptimistic);
    }
    
    setMessages(prevMessages => { // Update raw messages state
        const updatedMessages = prevMessages.map(msg =>
            msg.id === messageId ? { ...msg, reactions: newReactionsOptimistic } : msg
        );
        const updatedMsgForLog = updatedMessages.find(m => m.id === messageId);
        console.log("[HandleReaction] SetMessages called. Updated message in raw local state (optimistic):", updatedMsgForLog);
        return updatedMessages;
    });
    setShowReactionPickerFor(null);

    try {
        if (userPreviousReaction === emoji) {
            console.log("[HandleReaction] Calling removeReactionFromMessage on Firebase for user:", user.uid);
            await removeReactionFromMessage(selectedChat.id, messageId, user.uid);
        } else {
            console.log("[HandleReaction] Calling addReactionToMessage on Firebase for user:", user.uid, "with emoji:", emoji);
            await addReactionToMessage(selectedChat.id, messageId, user.uid, emoji);
        }
        console.log("[HandleReaction] Firebase reaction update successful.");
    } catch (err: any) {
        console.error("[HandleReaction] Firebase reaction update FAILED:", err);
        showNotification('error', `Reaction failed: ${err.message || 'Unknown error'}`);
        setMessages(prevMessages => { // Revert raw messages state
            const revertedMessages = prevMessages.map(msg =>
                msg.id === messageId ? { ...msg, reactions: currentReactions } : msg
            );
            console.log("[HandleReaction] Reverted optimistic update due to Firebase error. Message reactions now:", revertedMessages.find(m => m.id === messageId)?.reactions);
            return revertedMessages;
        });
    }
  };

  const handleUnfriendConfirmed = async () => {
    if (!friendToUnfriend || !user) return;
    try {
      await unfriendUser(user.uid, friendToUnfriend.id);
      showNotification('success', `You are no longer friends with ${friendToUnfriend.name || friendToUnfriend.displayName}.`);
      if (selectedChat && !selectedChat.isGroup && selectedChat.members.includes(friendToUnfriend.id)) {
        setSelectedChat(null);
      }
    } catch (err: any) {
      showNotification('error', `Failed to unfriend: ${err.message}`);
    } finally {
      setFriendToUnfriend(null);
      setShowChatOptions(false);
    }
  };

  const parseGeminiApiResponse = (responseText: string): GeminiApiResponse => {
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.promptFeedback?.blockReason) {
            return { text: null, error: `Request blocked: ${jsonResponse.promptFeedback.blockReason}` };
        }
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return { text: jsonResponse.candidates[0].content.parts[0].text, error: null };
        }
        if (jsonResponse?.error?.message) {
             return { text: null, error: `API Error: ${jsonResponse.error.message}`};
        }
        return { text: null, error: "Sorry, I received an empty or non-standard response." };
    } catch (e) {
        console.error("Error parsing Gemini API response:", responseText, e);
        return { text: null, error: "Error: Could not process AI response (Invalid format)." };
    }
  };

  const handleSendToAI = async (userMessageText: string, attachedUserFile?: File | null) => {
    if (!selectedChat || !user?.uid || !geminiApiKey || (!userMessageText.trim() && !attachedUserFile) ) return;
    setIsAiThinking(true);

    const userAiQueryId = `user-ai-query-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    let messageWithFileText = userMessageText;
    if (attachedUserFile) {
        messageWithFileText += ` [User attached file: ${getFileTypeFromInfo(attachedUserFile.name || attachedUserFile.type)} - "${attachedUserFile.name}"]`;
    }

    // Optimistically add user's query to the raw messages state
    setMessages(prev => [...prev, {
        id: userAiQueryId,
        text: messageWithFileText, // Include file info in text for AI context
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || "You",
        senderPhotoURL: userProfile?.photoURL || null,
        timestamp: new Date(),
        // If you were to store the file with the optimistic message (not typical for AI queries)
        // fileName: attachedUserFile?.name,
        // fileType: attachedUserFile ? getFileTypeFromInfo(attachedUserFile.name || attachedUserFile.type) : undefined,
    }]);

    // Construct history including text about files
    const historyForPrompt = messages // Use raw messages for history
        .filter(msg => msg.senderId !== userAiQueryId) // Exclude the current optimistic query
        .slice(-8) // Slightly more context
        .map(msg => {
            const prefix = msg.senderId === user.uid ? (userProfile?.name || 'User') : 
                           (msg.senderId === "AI_ASSISTANT_ID" ? "AI" : (msg.senderName || getChatDisplayInfo(selectedChat).name || "Other"));
            let textContent = msg.text || "";
            if (msg.fileURL && msg.fileName) { // For existing messages with files
                textContent += ` [Shared ${msg.fileType || 'file'}: "${msg.fileName}"]`;
            }
            return `${prefix}: ${textContent}`;
        })
        .join("\n");

    const personaInstructions = `You are an AI assistant integrated into this chat application. 
Your role is to be helpful, concise, and directly responsive to the user's most recent message. 
Consider the provided conversation history (including mentions of shared files) solely for context to understand the current query. 
Engage naturally as a participant in the conversation. 
DO NOT analyze the users, their intentions, or the meta-dynamics of the chat. 
Simply provide a direct, conversational, and helpful response.
Avoid self-reference as an AI unless crucial for answering a question about your capabilities.
Focus on answering the question or continuing the topic.
If the user's message mentions an attachment they just sent (e.g., "[User attached file: image - "photo.jpg"]"), acknowledge it if relevant, but remember you cannot see the file's content, only its name and type.`;
    
    let participantsInfo = `The current user sending this message is "${userProfile?.name || 'User'}" (ID: ${user.uid}). `;
    if (!selectedChat.isGroup) {
        const otherUserInChat = selectedChat.members.find(id => id !== user.uid);
        if (otherUserInChat) {
            const otherUserInfo = friends.find(f => f.id === otherUserInChat) || selectedChat.memberDetails?.[otherUserInChat];
            participantsInfo += `They are chatting with "${otherUserInfo?.name || otherUserInfo?.displayName || 'the other user'}" (ID: ${otherUserInChat}).`;
        }
    } else {
        participantsInfo += `This is a group chat. The AI should respond generally to the group, addressing "${userProfile?.name || 'User'}" who sent the last message.`;
    }

    const prompt = `${personaInstructions}\n\nParticipants: ${participantsInfo}\n\nConversation History:\n${historyForPrompt}\n\nUser (${userProfile?.name || 'User'}): ${messageWithFileText}\nAI:`;
    
    console.log("AI Prompt:", prompt); // For debugging

    try {
        const fullApiUrl = `${GEMINI_API_BASE}${GEMINI_TEXT_MODEL}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(fullApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const responseText = await response.text(); 
        const parsedResult = parseGeminiApiResponse(responseText);

        if (!response.ok || parsedResult.error) {
            throw new Error(parsedResult.error || `API request failed with status ${response.status}`);
        }

        if (parsedResult.text) {
            await sendMessage(
                selectedChat.id,
                parsedResult.text,
                "AI_ASSISTANT_ID", 
                undefined, undefined, undefined,
                userAiQueryId
            );
        } else {
            throw new Error("AI returned no usable text.");
        }
    } catch (err: any) {
        console.error("Error with AI call:", err);
        showNotification('error', `AI Error: ${err.message}`);
        await sendMessage(selectedChat.id, `Sorry, I encountered an error: ${err.message}`, "AI_ASSISTANT_ID", undefined, undefined, undefined, userAiQueryId);
    } finally {
        setIsAiThinking(false);
    }
  };

  const filteredChats = chats.filter((chat) => getChatDisplayInfo(chat).name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFriends = friends.filter(friend => friend.id !== user?.uid && (friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) || friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || friend.email?.toLowerCase().includes(searchQuery.toLowerCase())));
  const pendingRequestsCount = friendRequests.filter((req) => req.status === "pending").length;

  const renderFilePreview = (message: Message) => {
    if (!message.fileURL || !message.fileType) return null;
    const commonClasses = "mt-1.5 rounded-md overflow-hidden max-w-[200px] sm:max-w-[220px] border";
    const linkClasses = `flex items-center gap-1.5 p-2 border text-xs ${illuminateBorder} ${illuminateBgHover} hover:shadow-sm transition-shadow`;

    switch (message.fileType) {
        case 'image': return (
            <a href={message.fileURL} target="_blank" rel="noopener noreferrer" className="block">
                <motion.img 
                    src={message.fileURL} 
                    alt={message.fileName || 'Shared image'} 
                    className={`${commonClasses} ${illuminateBorder} object-cover aspect-[16/10] cursor-pointer hover:opacity-90 transition-opacity`}
                    loading="lazy" 
                    variants={fadeIn} initial="hidden" animate="visible" 
                />
            </a>
        );
        case 'audio': return (
            <audio 
                controls 
                src={message.fileURL} 
                className={`mt-1.5 w-full max-w-[200px] h-10 rounded ${isIlluminateEnabled ? 'bg-slate-100' : 'bg-slate-600/40'}`}
            >
                Your browser doesn't support audio. <a href={message.fileURL} download={message.fileName} className="underline text-xs">Download</a>
            </audio>
        );
        case 'video': 
            const canPlayInline = /\.(mp4|webm|ogv)$/i.test(message.fileName || message.fileURL);
            if (canPlayInline) { 
                 return (
                    <video 
                        controls 
                        src={message.fileURL} 
                        className={`${commonClasses} ${illuminateBorder} object-cover aspect-[16/10]`}
                        preload="metadata"
                        controlsList="nodownload"
                    >
                       Video not supported. <a href={message.fileURL} download={message.fileName} className="underline text-xs">Download</a>
                    </video>
                );
            }
            return (
                <a href={message.fileURL} target="_blank" rel="noopener noreferrer" className={`${linkClasses} ${commonClasses}`}>
                    <Video className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    <span className="truncate" title={message.fileName}>{message.fileName || 'Video File'}</span>
                </a>
            );
        default: return ( 
            <a href={message.fileURL} target="_blank" rel="noopener noreferrer" download={message.fileName} className={`${linkClasses} ${commonClasses}`}>
                 { message.fileName?.match(/\.(pdf)$/i) ? <FileText className="w-5 h-5 text-red-400 flex-shrink-0" /> :
                   message.fileName?.match(/\.(doc|docx)$/i) ? <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" /> :
                   message.fileName?.match(/\.(zip|rar|tar|gz)$/i) ? <FileQuestion className="w-5 h-5 text-yellow-400 flex-shrink-0" /> :
                   <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                 }
                <span className="truncate" title={message.fileName}>{message.fileName || 'Shared File'}</span>
            </a>
        );
    }
  };
  
  const renderAttachmentPreview = () => {
    if (!attachedFile && !attachedAudioBlob) return null;
    let previewContent;
    let fileName = '';
    let fileTypeIcon: React.ReactNode;

    if (attachedFile) {
        fileName = getSimpleFileName(attachedFile, 20);
        const type = getFileTypeFromInfo(attachedFile.type || attachedFile.name);
        if (type === 'image' && attachedFile.size < 3 * 1024 * 1024) { 
            previewContent = <img src={URL.createObjectURL(attachedFile)} alt="Preview" className="w-8 h-8 object-cover rounded" />;
        } else if (type === 'audio') {
            fileTypeIcon = <AudioLines className="w-5 h-5 text-purple-500" />;
        } else if (type === 'video') {
            fileTypeIcon = <Video className="w-5 h-5 text-pink-500" />;
        } else {
            fileTypeIcon = <FileText className="w-5 h-5 text-blue-500" />;
        }
    } else if (attachedAudioBlob) {
        fileName = 'Voice Note.webm';
        fileTypeIcon = <AudioLines className="w-5 h-5 text-purple-500" />;
    }

    return (
        <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`mb-1.5 px-2.5 py-1.5 rounded-md border ${illuminateBorder} ${isIlluminateEnabled ? 'bg-slate-50' : 'bg-slate-700/50'} flex items-center justify-between gap-2 text-xs shadow-sm`}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                {previewContent || fileTypeIcon}
                <span className="truncate font-medium" title={fileName}>{fileName}</span>
            </div>
            <button type="button" onClick={clearAttachments} className={`${iconButtonClass} !p-0.5`} title="Remove attachment">
                <X className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    );
  };

  const renderReactionsDisplay = (message: Message) => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
    const grouped: Record<string, number> = {}; 
    Object.values(message.reactions).forEach(emoji => {
        grouped[emoji] = (grouped[emoji] || 0) + 1;
    });

    return (
        <div className="absolute -bottom-2.5 right-1.5 md:right-2 flex gap-0.5 z-10">
            {Object.entries(grouped)
                .sort(([, countA], [, countB]) => countB - countA) 
                .slice(0, 3) 
                .map(([emoji, count]) => (
                <button
                    key={emoji}
                    onClick={() => user?.uid && handleReaction(message.id, emoji)}
                    className={`px-1 py-0.5 rounded-full text-[10px] shadow-sm flex items-center gap-0.5 transition-all transform hover:scale-105 active:scale-100
                        ${message.reactions?.[user?.uid || ''] === emoji
                            ? (isIlluminateEnabled ? 'bg-blue-100 border border-blue-300/70 text-blue-600' : 'bg-blue-700/80 border border-blue-600/70 text-blue-100')
                            : (isIlluminateEnabled ? 'bg-white/80 border border-slate-200/70 hover:bg-slate-100/90' : 'bg-slate-600/80 border border-slate-500/70 hover:bg-slate-500/90')
                        }
                    `}
                    title={`${count} reaction${count > 1 ? 's' : ''}: ${emoji}`}
                >
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-[9px] font-semibold">{count}</span>}
                </button>
            ))}
        </div>
    );
  };

  return (
    <div className={`flex h-screen ${containerClass} antialiased overflow-hidden font-sans text-xs sm:text-sm`}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} 
        isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} 
        onToggle={() => setIsSidebarCollapsed(prev => !prev)} 
        userName={userProfile?.name || user?.displayName || "User"}
        userPhotoURL={userProfile?.photoURL} 
      />
      {/* Main content area with adjusted margin for gap from left sidebar */}
      <div className={`flex-1 flex overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-18 md:ml-20' : 'ml-60 md:ml-64'}`}>
        {/* Main chat area - removed right margin */}
        <main className={`flex-1 flex flex-col overflow-hidden relative`}>
          <motion.div 
            className={`${chatHeaderClass} px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between z-20 flex-shrink-0 shadow-sm`}
            variants={slideUp} initial="hidden" animate="visible"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {selectedChat ? (
                <>
                  {isMobileView && !showMobileAside && (
                    <button onClick={() => {setSelectedChat(null); setIsAiModeActive(false);}} className={iconButtonClass} aria-label="Back to chat list">
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5"/>
                    </button>
                  )}
                  <div className="relative flex-shrink-0">
                    <button 
                        onClick={() => selectedChat.isGroup && groupPhotoInputRef.current?.click()} 
                        disabled={groupPhotoUploading || !selectedChat.isGroup} 
                        className={`w-8 h-8 sm:w-9 sm:w-9 rounded-full flex items-center justify-center overflow-hidden text-white text-base sm:text-lg font-semibold
                                    ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} 
                                    ${selectedChat.isGroup ? 'cursor-pointer hover:opacity-80' : ''} 
                                    disabled:opacity-60 disabled:cursor-not-allowed`}
                        title={selectedChat.isGroup ? "Change group photo" : getChatDisplayInfo(selectedChat).name}
                    >
                       {getChatDisplayInfo(selectedChat).photoURL ? (
                         <img src={getChatDisplayInfo(selectedChat).photoURL!} alt="Chat avatar" className="w-full h-full object-cover" />
                       ) : selectedChat.isGroup ? (
                         <Users className={`w-4 h-4 sm:w-5 sm:h-5 ${subtleTextColor}`} />
                       ) : (
                         <User className={`w-4 h-4 sm:w-5 sm:h-5 ${subtleTextColor}`} />
                       )}
                       {groupPhotoUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-spin"/></div>}
                    </button>
                    {selectedChat.isGroup && <input type="file" ref={groupPhotoInputRef} accept="image/*" className="hidden" onChange={handleGroupPhotoChange} disabled={groupPhotoUploading}/>}
                    {getChatDisplayInfo(selectedChat).isOnline && !selectedChat.isGroup && (
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 ${isIlluminateEnabled ? 'border-white':'border-slate-800'}`}></div>
                    )}
                  </div>
                  <div className="min-w-0">
                      <div className="flex items-center gap-1">
                          <h2 className={`text-sm sm:text-base font-semibold ${headingClass} truncate`}>{getChatDisplayInfo(selectedChat).name}</h2>
                          {selectedChat.isGroup && !isEditingChatName && user && (selectedChat.admins?.includes(user.uid) || selectedChat.createdBy === user.uid) && (
                             <button onClick={() => {setIsEditingChatName(true); setNewChatName(selectedChat.name || '');}} className={`${iconButtonClass} !p-0.5 opacity-60 hover:opacity-100`} title="Rename Group"><Edit className="w-3.5 h-3.5" /></button>
                          )}
                      </div>
                    <p className={`text-xs ${subtleTextColor} truncate`}>
                        {selectedChat.isGroup ? `${selectedChat.members.length} member${selectedChat.members.length > 1 ? 's':''}` : getChatDisplayInfo(selectedChat).statusText}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Users2 className={`w-5 h-5 sm:w-6 sm:h-6 ${isIlluminateEnabled ? 'text-blue-500' : 'text-blue-400'}`} />
                    <h1 className={`text-base sm:text-lg font-semibold ${headingClass}`}>Friends</h1>
                </div>
              )}
            </div>
            
            {selectedChat && (
              <div className="flex items-center gap-1 ml-auto">
                {isEditingChatName ? (
                  <form onSubmit={handleRenameChatSubmit} className="flex items-center gap-1">
                    <input type="text" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} className={`${inputBg} rounded-md px-2 py-1 text-xs sm:text-sm focus:ring-1 w-32 sm:w-36`} placeholder="New name" autoFocus onBlur={() => setTimeout(() => setIsEditingChatName(false), 200)}/>
                    <button type="submit" className={`${acceptButtonClass} !p-1`} title="Save Name"><Check className="w-3.5 h-3.5"/></button>
                    <button type="button" onClick={() => setIsEditingChatName(false)} className={`${rejectButtonClass} !p-1`} title="Cancel Edit"><X className="w-3.5 h-3.5"/></button>
                  </form>
                ) : (
                  <div className="relative">
                    <button onClick={() => setShowChatOptions(prev => !prev)} className={`${iconButtonClass} chat-options-trigger`} title="Chat Options"><MoreVertical className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    <AnimatePresence>
                      {showChatOptions && (
                        <motion.div 
                            initial={{ opacity: 0, y: 3, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 3, scale: 0.98 }}
                            className={`absolute right-0 mt-1.5 w-48 rounded-md shadow-lg z-30 ${modalClass} ring-1 ring-black/5 py-1 chat-options-menu`}
                        >
                            <button onClick={() => {setIsAiModeActive(prev => !prev); setShowChatOptions(false); chatInputRef.current?.focus();}} 
                                    className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs sm:text-sm ${subtleTextColor} ${illuminateBgHover} 
                                    ${isAiModeActive ? (isIlluminateEnabled ? 'bg-purple-100/70 text-purple-600' : 'bg-purple-900/50 text-purple-300') : ''}`}>
                                <Bot className={`w-3.5 h-3.5 ${isAiModeActive ? (isIlluminateEnabled ? 'text-purple-500' : 'text-purple-400') : ''}`}/> {isAiModeActive ? "Disable AI" : "Chat with AI"}
                            </button>
                            <button onClick={() => {setShowAiAssistantChats(prev => !prev); setShowChatOptions(false);}} 
                                    className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs sm:text-sm ${subtleTextColor} ${illuminateBgHover}`}>
                                {showAiAssistantChats ? <EyeOff className="w-3.5 h-3.5 text-orange-500"/> : <Eye className="w-3.5 h-3.5 text-green-500"/>} {showAiAssistantChats ? "Hide AI Chats" : "Show AI Chats"}
                            </button>
                          {selectedChat.isGroup && (
                            <button onClick={handleLeaveGroupChat} className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs sm:text-sm text-red-500/80 hover:text-red-500 ${illuminateBgHover} hover:!bg-red-500/5`}> 
                                <LogOutIcon className="w-3.5 h-3.5"/> Leave Group 
                            </button>
                          )}
                          {!selectedChat.isGroup && (() => {
                            const otherUserId = selectedChat.members.find(id => id !== user?.uid);
                            const friendProfile = friends.find(f => f.id === otherUserId);
                            if (friendProfile) {
                                return <button onClick={() => { setFriendToUnfriend(friendProfile); setShowChatOptions(false); }} className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs sm:text-sm text-red-500/80 hover:text-red-500 ${illuminateBgHover} hover:!bg-red-500/5`}> <UserX className="w-3.5 h-3.5"/> Unfriend </button>;
                            } return null;
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
            {isMobileView && !selectedChat && !showMobileAside && (
                <button onClick={() => setShowMobileAside(true)} className={`${iconButtonClass} ml-1.5 relative`} aria-label="Open friends panel">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5"/>
                    {pendingRequestsCount > 0 && (<span className={`absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border ${isIlluminateEnabled ? 'border-white' : 'border-slate-800'}`}>{pendingRequestsCount}</span>)}
                </button>
            )}
          </motion.div>

          <div className={`flex-1 overflow-y-auto ${messageAreaClass} relative`}>
            {selectedChat ? (
               <div className="p-2.5 sm:p-3 space-y-2.5 relative min-h-full">
                {displayedMessages.length === 0 && !fileUploading && ( // Use displayedMessages
                    <motion.div className="flex flex-col items-center justify-center h-[calc(100%-3rem)] text-center absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                        <MessageSquare className={`w-12 h-12 sm:w-14 sm:h-14 ${subtleTextColor} mb-2 opacity-40`} />
                        <p className={`${headingClass} text-base sm:text-lg font-medium`}>No messages.</p>
                        <p className={`${subheadingClass} text-xs sm:text-sm mt-0.5`}>Send a message to start the chat!</p>
                    </motion.div>
                )}
                {displayedMessages.map((msg, index) => { // Use displayedMessages
                  const isOwn = msg.senderId === user?.uid;
                  const isAI = msg.senderId === "AI_ASSISTANT_ID";
                  const prevMsg = displayedMessages[index - 1]; // Use displayedMessages
                  const showSenderInfo = selectedChat.isGroup && !isOwn && !isAI && 
                                         (!prevMsg || prevMsg.senderId !== msg.senderId || (new Date(msg.timestamp || 0).getTime() - new Date(prevMsg.timestamp || 0).getTime() > 3 * 60 * 1000));
                  
                  const messageBubbleClass = isOwn ? ownMessageClass : isAI ? aiMessageClass : otherMessageClass;

                  return (
                    <motion.div 
                        key={msg.id} 
                        variants={isOwn ? slideLeft : slideRight} 
                        initial="hidden" animate="visible"
                        className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group w-full relative`} // Added relative here
                    >
                      {showSenderInfo && (
                        <div className="flex items-center gap-1 mb-0.5 ml-0.5">
                            <img src={msg.senderPhotoURL || '/placeholder-avatar.svg'} alt={msg.senderName} className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full object-cover"/>
                            <span className={`text-[11px] sm:text-xs font-medium ${subheadingClass}`}>{msg.senderName}</span>
                        </div>
                      )}
                      {isAI && msg.senderId === "AI_ASSISTANT_ID" && (
                        <div className="flex items-center gap-1 mb-0.5 ml-0.5">
                            <Bot className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isIlluminateEnabled ? "text-purple-500" : "text-purple-400"}`}/>
                            <span className={`text-[11px] sm:text-xs font-medium ${isIlluminateEnabled ? "text-purple-600" : "text-purple-300"}`}>AI Assistant</span>
                        </div>
                      )}
                       <div className={`flex items-end gap-1.5 max-w-[80%] sm:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`relative px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl shadow-md ${messageBubbleClass} min-w-[50px]`}>
                            {msg.text && <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-normal sm:leading-relaxed">{msg.text}</p>}
                            {renderFilePreview(msg)}
                            {renderReactionsDisplay(msg)}
                          </div>
                           <div className={`flex flex-col items-center gap-0.5 mb-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ${isOwn ? 'mr-0.5' : 'ml-0.5'}`}>
                             {!isAI && user?.uid && (
                                <button onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)} className={`${iconButtonClass} !p-1`} title="React">
                                    <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>
                                </button>
                              )}
                            {isOwn && msg.senderId !== "AI_ASSISTANT_ID" && (
                                <button onClick={() => setMessageToDelete(msg.id)} className={`${iconButtonClass} !p-1`} title="Delete message">
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                            )}
                           </div>
                       </div>
                       <span className={`text-[10px] sm:text-[11px] ${subtleTextColor} mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isOwn ? 'mr-1' : 'ml-1'}`}>{formatTimestamp(msg.timestamp)}</span>
                       
                       <AnimatePresence>
                        {showReactionPickerFor === msg.id && user?.uid && (
                            <motion.div 
                                ref={reactionPickerRef} 
                                initial={{ opacity: 0, scale: 0.9, y: isOwn ? -8 : 8 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.9, y: isOwn ? -8 : 8 }}
                                className={`absolute ${isOwn ? 'right-6 sm:right-7' : 'left-6 sm:left-7'} ${isOwn ? 'bottom-full mb-1' : 'top-full mt-1'} p-1.5 rounded-full shadow-xl z-30 flex gap-1 ${modalClass} border ${illuminateBorder}`} // Adjusted padding and gap
                            >
                                {AVAILABLE_REACTIONS.map(emoji => (
                                    <button key={emoji} onClick={() => handleReaction(msg.id, emoji)}
                                        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-lg sm:text-xl rounded-full transition-transform hover:scale-110 active:scale-95 
                                            ${ msg.reactions?.[user.uid] === emoji 
                                                ? (isIlluminateEnabled ? 'bg-blue-100/80' : 'bg-blue-700/50') 
                                                : (isIlluminateEnabled ? 'hover:bg-slate-100/90' : 'hover:bg-slate-600/60')
                                            }`}>
                                        {emoji}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                       </AnimatePresence>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} className="h-0.5" /> 
                
                {Object.entries(typingUsers).map(([userId, userInfo]) => (
                    <motion.div 
                        key={userId} 
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-start mt-1.5"
                    >
                         <div className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl shadow-md ${otherMessageClass} flex items-center gap-1.5`}>
                            <span className="text-xs sm:text-sm font-medium">{userInfo.name} is typing</span>
                            <div className="flex space-x-0.5 items-center h-full">
                                <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${isIlluminateEnabled ? 'bg-slate-400' : 'bg-slate-400'} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }}></div>
                                <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${isIlluminateEnabled ? 'bg-slate-400' : 'bg-slate-400'} rounded-full animate-bounce`} style={{ animationDelay: "180ms" }}></div>
                                <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${isIlluminateEnabled ? 'bg-slate-400' : 'bg-slate-400'} rounded-full animate-bounce`} style={{ animationDelay: "360ms" }}></div>
                            </div>
                        </div>
                    </motion.div>
                ))}
              </div>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                <Users2 className={`w-16 h-16 sm:w-18 sm:h-18 ${subtleTextColor} opacity-30 mb-3`} />
                <p className={`${headingClass} text-lg sm:text-xl font-medium`}>Select a chat</p>
                <p className={`${subheadingClass} text-sm sm:text-base mt-1.5 max-w-sm sm:max-w-md`}>
                    Choose a conversation from the right to start chatting.
                </p>
                <button 
                    onClick={() => setIsGroupModalOpen(true)} 
                    className={`${primaryButtonClass} mt-5 inline-flex items-center gap-1.5 text-sm sm:text-base !px-5 !py-2`}
                >
                    <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" /> New Group
                </button>
            </div>
            )}
          </div>

          {selectedChat && (
            <motion.div 
                className={`${chatInputContainerClass} p-2 sm:p-2.5 flex-shrink-0`}
                variants={slideUp} initial="hidden" animate="visible"
            >
               {renderAttachmentPreview()}
                {fileUploading && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} 
                        className="mb-1 px-0.5 text-[11px] sm:text-xs text-blue-500 flex flex-col gap-0.5"
                    >
                        <div className="flex justify-between items-center">
                            <span className="truncate max-w-[calc(100%-3.5rem)]">Uploading {attachedFile?.name || 'audio'}...</span>
                            <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className={`w-full h-0.5 ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'} rounded-full overflow-hidden`}>
                            <div className="h-full bg-blue-400 rounded-full transition-all duration-100" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    </motion.div>
                )}
                 {isAiModeActive && (
                    <div className={`mb-1 px-2.5 py-1 text-[11px] sm:text-xs rounded-md border ${isIlluminateEnabled ? 'bg-purple-50/80 border-purple-200/70 text-purple-600' : 'bg-purple-900/40 border-purple-700/50 text-purple-300'} flex items-center gap-1 font-medium`}>
                        <Bot className="w-3.5 h-3.5"/> AI Mode On.
                        {!geminiApiKey && <span className="text-red-500 text-[10px]">(API Key Missing)</span>}
                    </div>
                 )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={isRecording || fileUploading || isAiThinking}/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`${iconButtonClass} ${(attachedFile && !isRecording) ? (isIlluminateEnabled ? '!bg-blue-100/80 !text-blue-500':'!bg-blue-700/60 !text-blue-300') : ''}`} title="Attach file" disabled={isRecording || fileUploading || isAiThinking}>
                    <Paperclip className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </button>
                  <button type="button" onClick={isRecording ? stopRecording : startRecording} 
                          className={`${iconButtonClass} ${(isRecording || attachedAudioBlob) ? (isIlluminateEnabled ? '!bg-purple-100/80 !text-purple-500':'!bg-purple-700/60 !text-purple-300') : ''} ${isRecording ? 'animate-pulse ring-1 ring-purple-300' : ''}`} 
                          title={isRecording ? "Stop recording" : "Record audio"} 
                          disabled={!!attachedFile || fileUploading || isAiThinking}>
                    <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </button>
                <div className="flex-1 relative">
                  <input 
                    ref={chatInputRef}
                    type="text" 
                    value={newMessage} 
                    onChange={handleTyping} 
                    placeholder={(isAiModeActive && !geminiApiKey) ? "AI Disabled (No API Key)" : isAiModeActive ? "Ask AI..." : "Message..."} 
                    className={`w-full ${inputBg} rounded-full pl-3 pr-9 sm:pl-3.5 sm:pr-10 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 shadow-sm disabled:opacity-50 disabled:bg-opacity-60`}
                    disabled={fileUploading || isRecording || isAiThinking || (isAiModeActive && !geminiApiKey)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  />
                  <div className="absolute right-2 sm:right-2.5 top-1/2 transform -translate-y-1/2">
                    <button type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className={`${iconButtonClass} !p-1`} title="Add emoji">
                        <Smile className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </button>
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <motion.div 
                            ref={emojiPickerRef} 
                            initial={{ opacity: 0, y: 8, scale:0.95 }} animate={{ opacity: 1, y: 0, scale:1 }} exit={{ opacity: 0, y: 8, scale:0.95 }} 
                            className={`absolute bottom-full right-0 mb-1.5 p-2 rounded-lg shadow-xl z-40 grid grid-cols-8 gap-0.5 ${modalClass} w-60 sm:w-64 max-h-40 sm:max-h-48 overflow-y-auto no-scrollbar border ${illuminateBorder}`}
                        >
                            {EMOJI_SET_FOR_PICKER.map(emoji => (<button key={emoji} type="button" onClick={() => addEmoji(emoji)} className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-base sm:text-lg rounded-full transition-colors ${illuminateBgHover} hover:scale-110 active:scale-95`}>{emoji}</button>))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <button type="submit" className={`${primaryButtonClass} !p-2 !rounded-full flex-shrink-0 shadow-md hover:shadow-lg`} disabled={(!newMessage.trim() && !attachedFile && !attachedAudioBlob) || fileUploading || isRecording || isAiThinking || (isAiModeActive && !geminiApiKey)} title="Send Message">
                  {isAiThinking ? <Loader2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-spin"/> : <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>
              </form>
            </motion.div>
          )}
        </main>

        <AnimatePresence>
          {(isMobileView ? showMobileAside : true) && (
            <motion.aside 
                key="aside-content-panel" 
                className={`${asideClass} w-full md:w-64 lg:w-72 flex-shrink-0 flex flex-col ${ isMobileView ? 'fixed inset-y-0 right-0 z-40 shadow-xl' : 'relative' }`}
                initial={isMobileView ? { x: '100%' } : { opacity: 0, width: 0 }} 
                animate={isMobileView ? { x: 0 } : { opacity: 1, width: isMobileView ? '100%' : (isSidebarCollapsed ? 256 : 288) }} 
                exit={isMobileView ? { x: '100%' } : { opacity: 0, width: 0 }} 
                transition={{ type: 'spring', stiffness: 320, damping: 32, duration: 0.25 }}
            >
               {isMobileView && (
                <button onClick={() => setShowMobileAside(false)} className={`${iconButtonClass} absolute top-2.5 right-2.5 z-50 !p-1.5 ${isIlluminateEnabled ? 'bg-white/40 hover:bg-slate-100/70' : 'bg-slate-800/40 hover:bg-slate-700/70'}`} aria-label="Close friends panel">
                    <X className="w-4 h-4 sm:w-5 sm:h-5"/>
                </button>
               )}
                <div className={`p-2.5 border-b ${illuminateBorder}`}>
                    <div className="relative">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${activeTab}...`} className={`w-full ${inputBg} rounded-full pl-8 pr-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 shadow-inner`}/>
                        <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 ${subtleTextColor} opacity-60`} />
                    </div>
                </div>
                <div className={`flex border-b ${illuminateBorder} flex-shrink-0`}>
                    {([ 
                        {key: 'chats', icon: MessageSquare, label: 'Chats'}, 
                        {key: 'friends', icon: Users, label: 'Friends'}, 
                        {key: 'requests', icon: Bell, label: 'Requests'} 
                    ] as const).map(tabInfo => (
                        <button 
                            key={tabInfo.key} 
                            onClick={() => setActiveTab(tabInfo.key)} 
                            className={`flex-1 py-2 text-xs sm:text-sm border-b-2 transition-colors duration-100 flex items-center justify-center gap-1 focus:outline-none 
                                        ${ activeTab === tabInfo.key ? activeTabClass : inactiveTabClass }`}
                        >
                            <tabInfo.icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{tabInfo.label}</span>
                            {tabInfo.key === 'requests' && pendingRequestsCount > 0 && (
                                <span className={`ml-0.5 bg-red-500 text-white text-[9px] font-semibold rounded-full w-3.5 h-3.5 flex items-center justify-center px-0.5`}>{pendingRequestsCount}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto pt-1.5 pb-2 px-1.5 space-y-1 no-scrollbar">
                    <AnimatePresence>
                        {success && (<motion.div variants={itemFadeIn} initial="hidden" animate="visible" exit="hidden" className={`p-2 rounded-md text-xs sm:text-sm border-l-4 ${ isIlluminateEnabled ? 'bg-green-50/80 border-green-400 text-green-600' : 'bg-green-500/10 border-green-500 text-green-300' } shadow-sm`}> {success} </motion.div>)}
                        {error && (<motion.div variants={itemFadeIn} initial="hidden" animate="visible" exit="hidden" className={`p-2 rounded-md text-xs sm:text-sm border-l-4 ${ isIlluminateEnabled ? 'bg-red-50/80 border-red-400 text-red-600' : 'bg-red-500/10 border-red-500 text-red-300' } shadow-sm`}> {error} </motion.div>)}
                    </AnimatePresence>
                    
                    {activeTab === 'chats' && (
                        <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="space-y-1">
                            <button onClick={() => setIsGroupModalOpen(true)} className={`w-full flex items-center justify-center gap-1.5 p-2 rounded-md text-xs sm:text-sm ${secondaryButtonClass} !font-medium my-0.5`}>
                                <PlusCircle className="w-3.5 h-3.5" /> New Group
                            </button>
                            {filteredChats.length === 0 && <p className={`text-xs sm:text-sm ${subtleTextColor} text-center py-4`}>No active chats.</p>}
                            {filteredChats.map(chat => {
                                const display = getChatDisplayInfo(chat);
                                return (
                                <motion.button 
                                    key={chat.id} 
                                    variants={itemFadeIn} 
                                    onClick={() => handleSelectChat(chat)} 
                                    className={`w-full text-left p-2 flex items-center gap-2 ${chatListItemClass} ${selectedChat?.id === chat.id ? selectedChatClass : ''}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden text-white text-base sm:text-lg font-semibold ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'}`}>
                                            {display.photoURL ? (<img src={display.photoURL} alt={display.name} className="w-full h-full object-cover" />) 
                                                : chat.isGroup ? (<Users className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${subtleTextColor}`} />) 
                                                : (<User className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${subtleTextColor}`} />)
                                            }
                                        </div>
                                        {display.isOnline && !chat.isGroup && (<div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 ${isIlluminateEnabled ? 'border-white':'border-slate-800'}`}></div>)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h3 className={`text-xs sm:text-sm font-medium truncate ${headingClass}`}>{display.name}</h3>
                                            <span className={`text-[10px] sm:text-xs ${subtleTextColor}`}>{formatTimestamp(chat.updatedAt, 'chatList')}</span>
                                        </div>
                                        <p className={`text-[11px] sm:text-xs ${subtleTextColor} truncate mt-0.5`}>{chat.lastMessage || 'No messages...'}</p>
                                    </div>
                                </motion.button>
                            )})}
                        </motion.div>
                    )}
                    {activeTab === 'friends' && (
                        <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="space-y-1">
                            <div className={`p-2.5 rounded-md border ${illuminateBorder} ${isIlluminateEnabled ? 'bg-slate-50/80' : 'bg-slate-700/25'} mb-1.5 shadow-sm`}>
                                <label className={`block text-xs sm:text-sm font-medium mb-1 ${headingClass}`}>Add Friend</label>
                                <div className="flex gap-1.5">
                                    <input type="email" value={friendEmail} onChange={e => setFriendEmail(e.target.value)} placeholder="Friend's email" className={`flex-1 ${inputBg} !text-xs sm:!text-sm !py-1.5 !px-2.5 rounded-md focus:ring-1 shadow-inner`} />
                                    <button onClick={handleSendFriendRequest} className={`${primaryButtonClass} !text-xs sm:!text-sm !px-3 !py-1.5`} disabled={!friendEmail.trim()}>Send</button>
                                </div>
                            </div>
                            {filteredFriends.length === 0 && <p className={`text-xs sm:text-sm ${subtleTextColor} text-center py-4`}>No friends yet.</p>}
                            {filteredFriends.map(friend => (
                                <motion.div 
                                    key={friend.id} 
                                    variants={itemFadeIn} 
                                    className={`w-full text-left p-2 flex items-center gap-2 ${chatListItemClass}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'}`}>
                                            {friend.photoURL ? (<img src={friend.photoURL} alt={friend.name || friend.displayName} className="w-full h-full object-cover" />) : (<User className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${subtleTextColor}`} />)}
                                        </div>
                                        {onlineFriendIds.has(friend.id) && (<div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 ${isIlluminateEnabled ? 'border-white':'border-slate-800'}`}></div>)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-xs sm:text-sm font-medium truncate ${headingClass}`}>{friend.name || friend.displayName}</h3>
                                        <p className={`text-[11px] sm:text-xs ${subtleTextColor} truncate mt-0.5`}>{friend.email}</p>
                                    </div>
                                    <button 
                                        onClick={() => { 
                                            const existingChat = chats.find(c => !c.isGroup && user?.uid && c.members.includes(friend.id) && c.members.includes(user.uid)); 
                                            if (existingChat) handleSelectChat(existingChat); 
                                            else {
                                                showNotification('error', `No direct chat. A new chat will be created if you send a message after accepting a friend request, or if they accept yours.`);
                                            }
                                        }} 
                                        className={`${iconButtonClass} ml-auto !p-1.5`} title={`Chat with ${friend.name || friend.displayName}`}
                                    >
                                        <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                    {activeTab === 'requests' && (
                        <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="space-y-1.5">
                            {friendRequests.filter(req => req.status === 'pending').length === 0 && <p className={`text-xs sm:text-sm ${subtleTextColor} text-center py-4`}>No pending requests.</p>}
                            {friendRequests.filter(req => req.status === 'pending').map(req => (
                                <motion.div 
                                    key={req.id} 
                                    variants={itemFadeIn} 
                                    className={`p-2.5 rounded-md flex items-center gap-2 border ${illuminateBorder} ${isIlluminateEnabled ? 'bg-slate-50/80' : 'bg-slate-700/25'} shadow-sm`}
                                >
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden ${isIlluminateEnabled ? 'bg-slate-200' : 'bg-slate-600'}`}>
                                        {req.fromUserPhotoURL ? <img src={req.fromUserPhotoURL} alt={req.fromUserName} className="w-full h-full object-cover"/> : <User className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${subtleTextColor}`} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs sm:text-sm font-medium truncate ${headingClass}`}>{req.fromUserName}</p>
                                        <p className={`text-[10px] sm:text-xs ${subtleTextColor} mt-0.5`}>Wants to connect</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAcceptRequest(req.id)} className={acceptButtonClass} title="Accept"><Check className="w-4 h-4 sm:w-4.5 sm:h-4.5"/></button>
                                        <button onClick={() => handleRejectRequest(req.id)} className={rejectButtonClass} title="Reject"><X className="w-4 h-4 sm:w-4.5 sm:h-4.5"/></button>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
          {isGroupModalOpen && (
            <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div 
                    className={`${modalClass} p-4 sm:p-5 rounded-lg w-full max-w-md transform transition-all`} 
                    initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}
                >
                    <div className="flex justify-between items-center mb-3">
                        <h2 className={`text-base sm:text-lg font-semibold flex items-center gap-1.5 ${headingClass}`}> <Users className="w-5 h-5 text-blue-500"/> Create Group </h2>
                        <button onClick={() => setIsGroupModalOpen(false)} className={iconButtonClass}><X className="w-4 h-4"/></button>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="groupNameInput" className={`block text-xs sm:text-sm font-medium mb-0.5 ${subheadingClass}`}>Group Name</label>
                            <input id="groupNameInput" type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className={`w-full ${inputBg} rounded-md px-3 py-2 text-xs sm:text-sm focus:ring-1 shadow-inner`} />
                        </div>
                        <div>
                            <label htmlFor="groupEmailsInput" className={`block text-xs sm:text-sm font-medium mb-0.5 ${subheadingClass}`}>Member Emails <span className="text-[10px] font-normal"> (comma/space separated)</span></label>
                            <textarea id="groupEmailsInput" value={groupEmails} onChange={e => setGroupEmails(e.target.value)} className={`w-full ${inputBg} rounded-md px-3 py-2 text-xs sm:text-sm focus:ring-1 shadow-inner`} rows={2} placeholder="friend1@example.com friend2@example.com"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setIsGroupModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
                        <button onClick={handleCreateGroupChat} className={primaryButtonClass} disabled={!groupName.trim()}>Create</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
          {messageToDelete && (
            <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className={`${modalClass} p-4 sm:p-5 rounded-lg w-full max-w-xs transform transition-all`} initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}>
                    <h2 className={`text-base sm:text-lg font-semibold mb-1.5 flex items-center gap-1.5 ${headingClass}`}> <AlertTriangle className="w-5 h-5 text-red-500"/> Delete Message? </h2>
                    <p className={`text-xs sm:text-sm mb-4 ${subheadingClass}`}>This cannot be undone.</p>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setMessageToDelete(null)} className={secondaryButtonClass}>Cancel</button>
                        <button onClick={handleDeleteMessageConfirmed} className={`!bg-red-500 hover:!bg-red-600 text-white ${primaryButtonClass}`}>Delete</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
          {friendToUnfriend && (
            <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className={`${modalClass} p-4 sm:p-5 rounded-lg w-full max-w-xs transform transition-all`} initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}>
                    <h2 className={`text-base sm:text-lg font-semibold mb-1.5 flex items-center gap-1.5 ${headingClass}`}> <UserX className="w-5 h-5 text-red-500"/> Unfriend {friendToUnfriend.name || friendToUnfriend.displayName}? </h2>
                    <p className={`text-xs sm:text-sm mb-4 ${subheadingClass}`}>Chat history will be lost.</p>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setFriendToUnfriend(null)} className={secondaryButtonClass}>Cancel</button>
                        <button onClick={handleUnfriendConfirmed} className={`!bg-red-500 hover:!bg-red-600 text-white ${primaryButtonClass}`}>Unfriend</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

export default Friends;
