import React, { useState, useEffect, useRef, type ChangeEvent, type FormEvent, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Users2, MessageSquare, PlusCircle, Paperclip, Send, Users, CheckCircle, XCircle, Edit, Trash2, Search, Bell, Settings, ChevronRight, ChevronLeft, Image as ImageIcon, Smile, Mic, MoreVertical, Star, Filter, X, LogOut, Clock, Check, AudioLines, FileText, Video, Link as LinkIcon, Bot, ThumbsUp, Heart, Laugh, Angry, Sad, LogOutIcon, Camera, Edit3, Repeat, UserX, AlertTriangle, Loader2, FileQuestion, EyeOff, Eye, UserPlus, MessageSquarePlus, Play, Pause
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
  updatedAt?: any;
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
  timestamp?: any;
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
  createdAt?: any;
}

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  photoURL?: string | null;
  status?: "online" | "offline" | "away";
  lastSeen?: any;
}

interface GeminiApiResponse {
    text: string | null;
    error: string | null;
}

const AVAILABLE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJI_SET_FOR_PICKER = [
  "😊", "😂", "❤️", "👍", "🎉", "🔥", "👋", "😎", "🤔", "😢", "😍", "🙏", "👏", "💯", "🚀", "✨",
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😇", "😉", "😌", "😋", "😛", "😜", "😝", "🥲", "🤫",
  "🥳", "🥺", "🥰", "🤩", "🥲", "🤯", "😴", "🤤", "😪", "😫", "😩", "😮‍💨", "😮", "😱", "😨", "😰",
  "😥", "😓", "😯", "😕", "🫤", "😒", "🙄", "😤", "😠", "😡", "🤬", "🤝", "🙌", "🤲", "✍️", "👀",
];

const getDateValue = (dateLike: any): number => {
    if (!dateLike) return 0;
    if (dateLike.toDate) return dateLike.toDate().getTime();
    if (dateLike instanceof Date) return dateLike.getTime();
    if (typeof dateLike === 'object' && dateLike.seconds) return new Date(dateLike.seconds * 1000).getTime();
    return 0;
};

const AudioPlayer = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
        setDuration(audioRef.current.duration);
    }
  };
  
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const scrubbable = e.currentTarget;
    const rect = scrubbable.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const newTime = (offsetX / rect.width) * duration;
    if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds === 0) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 mt-1.5 p-2 pr-3 rounded-lg bg-gray-100 dark:bg-gray-700/60 max-w-[280px] w-full" onClick={e => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden"
        preload="metadata"
      />
      <button onClick={handlePlayPause} className="p-2 rounded-full text-white bg-indigo-500 hover:bg-indigo-600 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 ml-0.5 fill-white" />}
      </button>
      <div className="flex-1 flex flex-col justify-center gap-1.5 w-full">
        <div className="w-full bg-gray-300 dark:bg-gray-500 h-1.5 rounded-full cursor-pointer group" onClick={handleScrub}>
          <div
            className="h-full bg-indigo-500 rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white dark:bg-indigo-300 rounded-full shadow border border-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 self-end font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

export function Friends() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem("isSidebarCollapsed") || 'false'));

  const [chats, setChats] = useState<Chat[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string }>>({});

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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

  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);
  
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

  useEffect(() => {
    const applyTheme = () => {
        const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
        if (isIlluminateEnabled) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.remove('light');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
                setIsDarkMode(true);
            } else {
                document.documentElement.classList.remove('dark');
                setIsDarkMode(false);
            }
        }
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    }
  }, []);

  useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
  useEffect(() => { const checkMobileView = () => setIsMobileView(window.innerWidth < 1024); window.addEventListener("resize", checkMobileView); return () => window.removeEventListener("resize", checkMobileView); }, []);

  const displayedMessages = useMemo(() => {
    if (!showAiAssistantChats && user?.uid) {
        const aiMessageResponses = new Map<string, string>();
        messages.forEach(msg => {
            if (msg.senderId === "AI_ASSISTANT_ID" && msg.aiResponseTo) {
                const originalQuery = messages.find(m => m.id === msg.aiResponseTo && m.senderId === user.uid);
                if (originalQuery) {
                    aiMessageResponses.set(originalQuery.id, msg.id);
                }
            }
        });

        return messages.filter(msg => {
            if (msg.senderId === "AI_ASSISTANT_ID") {
                if (msg.aiResponseTo && aiMessageResponses.has(msg.aiResponseTo)) {
                     return true;
                }
                return false;
            }
            if (msg.senderId === user.uid) {
                if (aiMessageResponses.has(msg.id)) {
                    return false;
                }
            }
            return true;
        });
    }
    return messages;
  }, [messages, showAiAssistantChats, user]);

  useEffect(() => {
    if (displayedMessages.length > 0 || selectedChat) {
        requestAnimationFrame(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); });
    }
  }, [displayedMessages, selectedChat]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) setShowEmojiPicker(false);
    if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) setShowReactionPickerFor(null);
    if (showChatOptions && event.target instanceof Element && !event.target.closest('.chat-options-trigger') && !event.target.closest('.chat-options-menu')) {
        setShowChatOptions(false);
    }
  }, [showChatOptions]);

  useEffect(() => { document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [handleClickOutside]);

  useEffect(() => {
    const currentAuthUser = getCurrentUser();
    if (!currentAuthUser) { navigate("/login"); return; }
    setUser(currentAuthUser);
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
            setChats(newChats.sort((a, b) => getDateValue(b.updatedAt) - getDateValue(a.updatedAt)));
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
      unsubscribeChats?.(); unsubscribeRequests?.(); unsubscribeFriendStatus?.(); cleanupPresence?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [navigate]);

  useEffect(() => {
    if (!selectedChat || !user?.uid) {
        setMessages([]);
        setTypingUsers({});
        return;
    }
    const unsubscribeMessages = listenToMessagesRealtime(selectedChat.id, setMessages);
    const unsubscribeTyping = listenToTypingIndicators(selectedChat.id, user.uid, setTypingUsers);
    return () => { unsubscribeMessages(); unsubscribeTyping(); };
  }, [selectedChat, user]);
  
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
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
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
  const showNotification = (type: 'success' | 'error', message: string, duration = 3000) => {
    clearNotifications();
    if (type === 'success') setSuccess(message);
    else setError(message);
    setTimeout(clearNotifications, duration);
  };
  
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setTypingUsers({});
    setIsEditingChatName(false);
    setShowChatOptions(false);
    clearAttachments();
    setIsAiModeActive(false);
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
    if (chatInputRef.current) {
        chatInputRef.current.style.height = 'auto';
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (user?.uid && selectedChat?.id) {
        setTypingIndicator(selectedChat.id, user.uid, false, userProfile?.name || user.displayName);
    }

    if (isAiModeActive) {
        handleSendToAI(currentMessageText, currentAttachedFile);
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

  const handleTyping = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

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
  
  const handleSendFriendRequest = async () => { if (!friendEmail.trim() || !user) return; clearNotifications(); try { await sendFriendRequest(user.uid, friendEmail.trim()); setFriendEmail(""); showNotification('success', "Friend request sent!"); } catch (err: any) { showNotification('error', err.message || "Failed to send request."); } };
  const handleAcceptRequest = async (requestId: string) => { if (!user) return; try { await acceptFriendRequest(requestId, user.uid); showNotification('success', "Friend request accepted!"); } catch (err: any) { showNotification('error', err.message || "Failed to accept request."); } };
  const handleRejectRequest = async (requestId: string) => { if (!user) return; try { await rejectFriendRequest(requestId, user.uid); showNotification('success', "Friend request rejected."); } catch (err: any) { showNotification('error', err.message || "Failed to reject request."); } };
  const handleCreateGroupChat = async () => { if (!groupName.trim() || !user) return; clearNotifications(); try { const emails = groupEmails.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean); await createGroupChat(groupName.trim(), emails, user.uid); setGroupName(""); setGroupEmails(""); setIsGroupModalOpen(false); showNotification('success', "Group chat created!"); setActiveTab('chats'); } catch (err: any) { showNotification('error', err.message || "Failed to create group."); } };

  const handleRenameChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newChatName.trim() || !selectedChat.isGroup || !user) return;
    clearNotifications();
    try {
      await renameChat(selectedChat.id, newChatName.trim(), user.uid);
      setIsEditingChatName(false);
      setSelectedChat(prev => prev ? { ...prev, name: newChatName.trim() } : null);
      showNotification('success', 'Group renamed!');
    } catch (err: any) {
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
      showNotification('error', err.message || 'Failed to update photo.');
    } finally {
      setGroupPhotoUploading(false);
      if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
    }
  };

  const handleLeaveGroupChat = async () => { if (!selectedChat || !selectedChat.isGroup || !user) return; setShowChatOptions(false); const confirmLeave = window.confirm("Are you sure you want to leave this group?"); if (!confirmLeave) return; clearNotifications(); try { await leaveGroupChat(selectedChat.id, user.uid); setSelectedChat(null); showNotification('success', "You left the group."); } catch (err: any) { showNotification('error', err.message || "Failed to leave group."); } };
  const handleDeleteMessageConfirmed = async () => { if (!selectedChat || !user || !messageToDelete) return; clearNotifications(); try { await deleteMessage(selectedChat.id, messageToDelete, user.uid); } catch (err: any) { showNotification('error', err.message || "Failed to delete message."); } finally { setMessageToDelete(null); } };
  const addEmoji = (emoji: string) => { setNewMessage((prev) => prev + emoji); setShowEmojiPicker(false); chatInputRef.current?.focus(); };
  
  const startRecording = async () => { if (isRecording) return; clearAttachments(); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
         if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            showNotification('error', "Audio recording format not supported.");
            return;
        }
    }
    const recorder = new MediaRecorder(stream, options); mediaRecorderRef.current = recorder; audioChunksRef.current = []; recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data); recorder.onstop = () => { const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType }); setAttachedAudioBlob(audioBlob); stream.getTracks().forEach(track => track.stop()); mediaRecorderRef.current = null; }; recorder.start(); setIsRecording(true); } catch (err) { showNotification('error', "Mic access denied or error starting recording."); } };
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!selectedChat || !user?.uid) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    const currentReactions = message.reactions || {};
    const userPreviousReaction = currentReactions[user.uid];
    const newReactionsOptimistic = { ...currentReactions };
    if (userPreviousReaction === emoji) {
        delete newReactionsOptimistic[user.uid];
    } else {
        newReactionsOptimistic[user.uid] = emoji;
    }
    setMessages(prevMessages => prevMessages.map(msg => msg.id === messageId ? { ...msg, reactions: newReactionsOptimistic } : msg));
    setShowReactionPickerFor(null);
    try {
        if (userPreviousReaction === emoji) {
            await removeReactionFromMessage(selectedChat.id, messageId, user.uid);
        } else {
            await addReactionToMessage(selectedChat.id, messageId, user.uid, emoji);
        }
    } catch (err: any) {
        showNotification('error', `Reaction failed: ${err.message || 'Unknown error'}`);
        setMessages(prevMessages => prevMessages.map(msg => msg.id === messageId ? { ...msg, reactions: currentReactions } : msg));
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

    setMessages(prev => [...prev, {
        id: userAiQueryId,
        text: messageWithFileText,
        senderId: user.uid,
        senderName: userProfile?.name || user.displayName || "You",
        senderPhotoURL: userProfile?.photoURL || null,
        timestamp: new Date(),
    }]);

    const historyForPrompt = messages
        .filter(msg => msg.senderId !== userAiQueryId)
        .slice(-8)
        .map(msg => {
            const prefix = msg.senderId === user.uid ? (userProfile?.name || 'User') :
                           (msg.senderId === "AI_ASSISTANT_ID" ? "AI" : (msg.senderName || getChatDisplayInfo(selectedChat).name || "Other"));
            let textContent = msg.text || "";
            if (msg.fileURL && msg.fileName) {
                textContent += ` [Shared ${msg.fileType || 'file'}: "${msg.fileName}"]`;
            }
            return `${prefix}: ${textContent}`;
        })
        .join("\n");

    const personaInstructions = `You are an AI assistant integrated into this chat application. Your role is to be helpful, concise, and directly responsive to the user's most recent message. Consider the provided conversation history (including mentions of shared files) solely for context to understand the current query. Engage naturally as a participant in the conversation. DO NOT analyze the users, their intentions, or the meta-dynamics of the chat. Simply provide a direct, conversational, and helpful response. Avoid self-reference as an AI unless crucial for answering a question about your capabilities. Focus on answering the question or continuing the topic. If the user's message mentions an attachment they just sent (e.g., "[User attached file: image - "photo.jpg"]"), acknowledge it if relevant, but remember you cannot see the file's content, only its name and type.`;
    
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
    
    const commonClasses = "mt-1.5 rounded-lg overflow-hidden max-w-[250px] sm:max-w-[300px] border border-gray-200 dark:border-gray-700/60";
    const linkClasses = `flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/60 text-xs hover:bg-gray-100 dark:hover:bg-gray-700/80 hover:shadow-md transition-all duration-150`;

    switch (message.fileType) {
        case 'image': return (
            <a href={message.fileURL} target="_blank" rel="noopener noreferrer" className="block">
                <motion.img 
                    src={message.fileURL} 
                    alt={message.fileName || 'Shared image'} 
                    className={`${commonClasses} object-cover aspect-video cursor-pointer hover:opacity-90 transition-opacity`}
                    loading="lazy" 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                />
            </a>
        );
        case 'audio': return <AudioPlayer src={message.fileURL} />;
        case 'video':
            return (
               <video 
                   controls 
                   src={message.fileURL} 
                   className={`${commonClasses} object-cover aspect-video`}
                   preload="metadata"
                   controlsList="nodownload"
               >
                  <a href={message.fileURL} download={message.fileName} className="underline text-xs">Download Video</a>
               </video>
           );
        default: return ( 
            <a href={message.fileURL} target="_blank" rel="noopener noreferrer" download={message.fileName} className={`${linkClasses} ${commonClasses}`}>
                 { message.fileName?.match(/\.(pdf)$/i) ? <FileText className="w-5 h-5 text-red-500 flex-shrink-0" /> :
                   message.fileName?.match(/\.(doc|docx|pages)$/i) ? <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" /> :
                   message.fileName?.match(/\.(zip|rar|tar|gz)$/i) ? <FileQuestion className="w-5 h-5 text-yellow-500 flex-shrink-0" /> :
                   <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                 }
                <span className="truncate text-gray-700 dark:text-gray-200" title={message.fileName}>{message.fileName || 'Shared File'}</span>
            </a>
        );
    }
  };
  
  const renderAttachmentPreview = () => {
    if (!attachedFile && !attachedAudioBlob) return null;
    let fileName = '';
    let fileTypeIcon: React.ReactNode;

    if (attachedFile) {
        fileName = getSimpleFileName(attachedFile, 20);
        const type = getFileTypeFromInfo(attachedFile.type || attachedFile.name);
        if (type === 'image') {
            fileTypeIcon = <ImageIcon className="w-4 h-4 text-teal-500" />;
        } else if (type === 'audio') {
            fileTypeIcon = <AudioLines className="w-4 h-4 text-purple-500" />;
        } else if (type === 'video') {
            fileTypeIcon = <Video className="w-4 h-4 text-pink-500" />;
        } else {
            fileTypeIcon = <FileText className="w-4 h-4 text-blue-500" />;
        }
    } else if (attachedAudioBlob) {
        fileName = 'Voice Note.webm';
        fileTypeIcon = <AudioLines className="w-4 h-4 text-purple-500" />;
    }

    return (
        <motion.div 
            initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }}
            className="mb-1.5 mx-3 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/70 flex items-center justify-between gap-2 text-xs shadow-sm"
        >
            <div className="flex items-center gap-2 overflow-hidden">
                {fileTypeIcon}
                <span className="truncate font-medium text-gray-700 dark:text-gray-200" title={fileName}>{fileName}</span>
            </div>
            <button type="button" onClick={clearAttachments} className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600/70" title="Remove attachment">
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
        <div className="absolute -bottom-2.5 right-2 flex gap-0.5 z-10">
            {Object.entries(grouped)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, 3)
                .map(([emoji, count]) => (
                <button
                    key={emoji}
                    onClick={() => user?.uid && handleReaction(message.id, emoji)}
                    className={`px-1.5 py-0.5 rounded-full text-[10px] shadow-md flex items-center gap-1 transition-all transform hover:scale-105 active:scale-100 backdrop-blur-sm
                        ${message.reactions?.[user?.uid || ''] === emoji
                            ? 'bg-blue-500/80 border border-blue-400 text-white'
                            : 'bg-white/70 dark:bg-gray-700/70 border border-gray-200 dark:border-gray-600/80 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }
                    `}
                    title={`${count} reaction${count > 1 ? 's' : ''}: ${emoji}`}
                >
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-[9px] font-bold">{count}</span>}
                </button>
            ))}
        </div>
    );
  };
  
  return (
    <div className="bg-[#F7F8FA] dark:bg-[#0C0E1A] text-gray-900 dark:text-gray-100 h-screen w-full flex font-poppins">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isMobileOpen={false}
        setIsMobileOpen={()=>{}}
        userName={userProfile?.name || user?.displayName || "User"}
        userProfile={{photoURL: userProfile?.photoURL}}
      />
      <div className={`flex-1 flex flex-row overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-[4.5rem]' : 'md:ml-64'}`}>
        <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50 dark:bg-[#11131E]">
            {selectedChat ? (
                <>
                <header className="px-4 py-3 flex items-center justify-between z-10 flex-shrink-0 bg-white/80 dark:bg-[#161922]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      {isMobileView && (
                        <button onClick={() => setSelectedChat(null)} className="p-2 -ml-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70" aria-label="Back to chat list">
                            <ChevronLeft className="w-5 h-5"/>
                        </button>
                      )}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-lg font-semibold">
                           {getChatDisplayInfo(selectedChat).photoURL ? (
                             <img src={getChatDisplayInfo(selectedChat).photoURL!} alt="Chat avatar" className="w-full h-full object-cover" />
                           ) : selectedChat.isGroup ? ( <Users className="w-5 h-5" /> ) : ( <User className="w-5 h-5" /> )}
                        </div>
                        {getChatDisplayInfo(selectedChat).isOnline && !selectedChat.isGroup && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#161922]"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{getChatDisplayInfo(selectedChat).name}</h2>
                              {selectedChat.isGroup && !isEditingChatName && user && (selectedChat.admins?.includes(user.uid) || selectedChat.createdBy === user.uid) && (
                                 <button onClick={() => {setIsEditingChatName(true); setNewChatName(selectedChat.name || '');}} className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Rename Group"><Edit className="w-3.5 h-3.5" /></button>
                              )}
                          </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {selectedChat.isGroup ? `${selectedChat.members.length} member${selectedChat.members.length > 1 ? 's':''}` : getChatDisplayInfo(selectedChat).statusText}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditingChatName ? (
                          <form onSubmit={handleRenameChatSubmit} className="flex items-center gap-2">
                            <input type="text" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} className="bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-sm py-1 px-2 rounded-md focus:ring-1 focus:ring-[#635BFF] w-36" placeholder="New name" autoFocus onBlur={() => setTimeout(() => setIsEditingChatName(false), 200)}/>
                            <button type="submit" className="p-1.5 rounded-full text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-500/20" title="Save"><Check className="w-4 h-4"/></button>
                            <button type="button" onClick={() => setIsEditingChatName(false)} className="p-1.5 rounded-full text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-500/20" title="Cancel"><X className="w-4 h-4"/></button>
                          </form>
                        ) : (
                          <div className="relative">
                            <button onClick={() => setShowChatOptions(prev => !prev)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 chat-options-trigger" title="Chat Options"><MoreVertical className="w-5 h-5"/></button>
                            <AnimatePresence>
                              {showChatOptions && (
                                <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-30 bg-white dark:bg-[#1A1D29] ring-1 ring-black/5 py-1.5 chat-options-menu">
                                    <button onClick={() => {setIsAiModeActive(prev => !prev); setShowChatOptions(false); chatInputRef.current?.focus();}} className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70 ${isAiModeActive ? 'bg-purple-50 dark:bg-purple-500/20' : ''}`}>
                                        <Bot className={`w-4 h-4 ${isAiModeActive ? 'text-purple-500 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}/> {isAiModeActive ? "Disable AI" : "Chat with AI"}
                                    </button>
                                    <button onClick={() => {setShowAiAssistantChats(prev => !prev); setShowChatOptions(false);}} className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70">
                                        {showAiAssistantChats ? <EyeOff className="w-4 h-4 text-orange-500"/> : <Eye className="w-4 h-4 text-green-500"/>} {showAiAssistantChats ? "Hide AI Chats" : "Show AI Chats"}
                                    </button>
                                  {selectedChat.isGroup && (<>
                                    <label className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70 cursor-pointer">
                                        <Camera className="w-4 h-4 text-gray-500 dark:text-gray-400"/> Change Photo
                                        <input type="file" ref={groupPhotoInputRef} accept="image/*" className="hidden" onChange={handleGroupPhotoChange} disabled={groupPhotoUploading}/>
                                    </label>
                                    <div className="my-1 h-[1px] bg-gray-100 dark:bg-gray-700/50"></div>
                                    <button onClick={handleLeaveGroupChat} className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"> <LogOutIcon className="w-4 h-4"/> Leave Group </button>
                                  </>)}
                                  {!selectedChat.isGroup && (() => {
                                    const otherUserId = selectedChat.members.find(id => id !== user?.uid);
                                    const friendProfile = friends.find(f => f.id === otherUserId);
                                    if (friendProfile) return <button onClick={() => { setFriendToUnfriend(friendProfile); setShowChatOptions(false); }} className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"> <UserX className="w-4 h-4"/> Unfriend </button>;
                                    return null;
                                  })()}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    {displayedMessages.map((msg, index) => {
                      const isOwn = msg.senderId === user?.uid;
                      const isAI = msg.senderId === "AI_ASSISTANT_ID";
                      const prevMsg = displayedMessages[index - 1];
                      const showSenderInfo = selectedChat.isGroup && !isOwn && !isAI &&
                                             (!prevMsg || prevMsg.senderId !== msg.senderId || (getDateValue(msg.timestamp) - getDateValue(prevMsg.timestamp) > 3 * 60 * 1000));
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group w-full relative`}>
                          {showSenderInfo && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                                <img src={msg.senderPhotoURL || '/placeholder-avatar.svg'} alt={msg.senderName} className="w-5 h-5 rounded-full object-cover"/>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{msg.senderName}</span>
                            </div>
                          )}
                          {isAI && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                                <Bot className="w-5 h-5 text-purple-500 dark:text-purple-400"/>
                                <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">AI Assistant</span>
                            </div>
                          )}
                           <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`relative px-3.5 py-2.5 rounded-2xl shadow-md ${isOwn ? 'bg-indigo-500 text-white rounded-br-lg' : isAI ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700/50 rounded-bl-lg' : 'bg-white dark:bg-[#1A1D29] text-gray-800 dark:text-gray-100 rounded-bl-lg border border-gray-100 dark:border-gray-700/60'}`}>
                                {msg.text && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>}
                                {renderFilePreview(msg)}
                                {renderReactionsDisplay(msg)}
                              </div>
                               <div className="flex flex-col items-center gap-1 mb-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                                 {!isAI && user?.uid && (
                                    <button onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)} className="p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/70" title="React">
                                        <Smile className="w-4 h-4"/>
                                    </button>
                                  )}
                                {isOwn && !isAI && (
                                    <button onClick={() => setMessageToDelete(msg.id)} className="p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-800/50 hover:text-red-500" title="Delete message">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                               </div>
                           </div>
                           <span className={`text-[11px] text-gray-400 dark:text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isOwn ? 'mr-2' : 'ml-2'}`}>{formatTimestamp(msg.timestamp)}</span>
                           <AnimatePresence>
                            {showReactionPickerFor === msg.id && user?.uid && (
                                <motion.div ref={reactionPickerRef} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`absolute ${isOwn ? 'right-8' : 'left-8'} bottom-full mb-1.5 p-1 rounded-full shadow-xl z-20 flex gap-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700/80`}>
                                    {AVAILABLE_REACTIONS.map(emoji => (
                                        <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className={`w-8 h-8 flex items-center justify-center text-xl rounded-full transition-all hover:scale-110 active:scale-95 ${ msg.reactions?.[user.uid] === emoji ? 'bg-blue-100 dark:bg-blue-500/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                            {emoji}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                           </AnimatePresence>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                    {Object.entries(typingUsers).map(([userId, userInfo]) => (
                        <motion.div key={userId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start">
                             <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-lg shadow-md bg-white dark:bg-[#1A1D29] border border-gray-100 dark:border-gray-700/60 flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{userInfo.name} is typing</span>
                                <div className="flex space-x-0.5 items-center h-full">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "180ms" }}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "360ms" }}></div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    {displayedMessages.length === 0 && !fileUploading && (<div className="flex flex-col items-center justify-center h-full text-center"><MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-3" /><p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No messages yet</p><p className="text-gray-400 dark:text-gray-500">Send the first message to start the conversation!</p></div>)}
                </div>
<footer className="p-3 border-t border-gray-200 dark:border-gray-700/50 bg-white/70 dark:bg-[#161922]/70 backdrop-blur-sm flex-shrink-0">
    {renderAttachmentPreview()}
    {fileUploading && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-1.5 mx-3 text-xs text-blue-600 dark:text-blue-400"><div className="flex justify-between items-center"><span className="truncate max-w-[calc(100%-4rem)]">Uploading {attachedFile?.name || 'audio'}...</span><span>{Math.round(uploadProgress)}%</span></div><div className="w-full h-1 rounded-full bg-gray-200 dark:bg-gray-700 mt-0.5"><div className="h-full bg-blue-500 rounded-full transition-all duration-100" style={{ width: `${uploadProgress}%` }}></div></div></motion.div>)}
    {isAiModeActive && (<div className="mx-3 mb-1.5 px-2.5 py-1 text-xs rounded-md border bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 flex items-center gap-1.5 font-medium"><Bot className="w-4 h-4"/> AI Mode is Active. Your message will be sent to the AI.{!geminiApiKey && <span className="text-red-500 text-[10px]">(API Key Missing)</span>}</div>)}
    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} disabled={isRecording || fileUploading || isAiThinking}/>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70 disabled:opacity-50 ${(attachedFile && !isRecording) ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400' : ''}`} title="Attach file" disabled={isRecording || fileUploading || isAiThinking}>
            <Paperclip className="w-4 h-4" />
        </button>
        <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70 disabled:opacity-50 ${(isRecording || attachedAudioBlob) ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400' : ''} ${isRecording ? 'animate-pulse ring-1 ring-purple-300' : ''}`} title={isRecording ? "Stop recording" : "Record audio"} disabled={!!attachedFile || fileUploading || isAiThinking}>
            <Mic className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
            <textarea
                ref={chatInputRef}
                value={newMessage}
                onChange={handleTyping}
                placeholder={(isAiModeActive && !geminiApiKey) ? "AI Disabled" : isAiModeActive ? "Ask AI..." : "Type a message..."}
                className="w-full bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 rounded-2xl pl-4 pr-12 py-2 text-sm focus:ring-1 focus:ring-[#635BFF] focus:border-[#635BFF] transition-colors resize-none overflow-y-auto max-h-32 min-h-[40px] leading-relaxed"
                rows={1}
                disabled={fileUploading || isRecording || isAiThinking || (isAiModeActive && !geminiApiKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <button type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className="p-1.5 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" title="Add emoji">
                    <Smile className="w-5 h-5" />
                </button>
                <AnimatePresence>
                {showEmojiPicker && (
                <motion.div ref={emojiPickerRef} initial={{ opacity: 0, y: 8, scale:0.95 }} animate={{ opacity: 1, y: 0, scale:1 }} exit={{ opacity: 0, y: 8, scale:0.95 }} className="absolute bottom-full right-0 mb-2 p-2 rounded-lg shadow-xl z-40 grid grid-cols-8 gap-1 bg-white dark:bg-[#1A1D29] w-64 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700/60 scrollbar-thin">
                    {EMOJI_SET_FOR_PICKER.map(emoji => (<button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="w-7 h-7 flex items-center justify-center text-lg rounded-full transition-all hover:bg-gray-100 dark:hover:bg-gray-700/70 hover:scale-110 active:scale-95">{emoji}</button>))}
                </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>
        <button type="submit" className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full shadow-md bg-[#635BFF] hover:bg-[#5249d9] text-white transition-all duration-200 transform hover:scale-105 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed" disabled={(!newMessage.trim() && !attachedFile && !attachedAudioBlob) || fileUploading || isRecording || isAiThinking || (isAiModeActive && !geminiApiKey)} title="Send Message">
            {isAiThinking ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
        </button>
    </form>
</footer>
                </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Users2 className="w-20 h-20 text-gray-300 dark:text-gray-700 mb-4" />
                <p className="text-gray-800 dark:text-gray-100 text-xl font-semibold">Welcome to Friends</p>
                <p className="text-gray-500 dark:text-gray-400 text-base mt-2 max-w-md">Select a conversation or start a new one to begin chatting with your friends and groups.</p>
                <button onClick={() => setIsGroupModalOpen(true)} className="mt-6 flex items-center gap-2 bg-gradient-to-r from-[#635BFF] to-[#8A85FF] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:opacity-90 transition-all duration-200 transform active:scale-95">
                    <PlusCircle className="w-5 h-5" /> Create New Group
                </button>
            </div>
            )}
        </main>
        <AnimatePresence>
            {(!selectedChat || !isMobileView) && (
                <motion.aside
                    key="chat-list-panel"
                    initial={isMobileView ? { x: '100%' } : { opacity: 1 }}
                    animate={isMobileView ? { x: 0 } : { opacity: 1 }}
                    exit={isMobileView ? { x: '100%' } : { opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`w-full lg:w-[22rem] lg:flex-shrink-0 bg-white dark:bg-[#161922] border-l border-gray-200 dark:border-gray-700/50 flex flex-col h-full ${isMobileView ? 'absolute inset-0 z-20' : ''}`}
                >
                   <div className="p-3 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
                       <div className="relative">
                           <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${activeTab}...`} className="w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-[#635BFF] focus:border-[#635BFF] transition-colors"/>
                           <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                       </div>
                   </div>
                   <div className="flex border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
                       {([
                           {key: 'chats', icon: MessageSquare, label: 'Chats'},
                           {key: 'friends', icon: Users, label: 'Friends'},
                           {key: 'requests', icon: UserPlus, label: 'Requests'}
                       ] as const).map(tabInfo => (
                           <button
                               key={tabInfo.key}
                               onClick={() => setActiveTab(tabInfo.key)}
                               className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 flex items-center justify-center gap-1.5 focus:outline-none
                                           ${ activeTab === tabInfo.key
                                               ? 'border-[#635BFF] text-[#635BFF] dark:text-[#8A85FF]'
                                               : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600' }`}
                           >
                               <tabInfo.icon className="w-4 h-4" />
                               <span>{tabInfo.label}</span>
                               {tabInfo.key === 'requests' && pendingRequestsCount > 0 && (
                                   <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{pendingRequestsCount}</span>
                               )}
                           </button>
                       ))}
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        <AnimatePresence>
                            {success && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-2.5 rounded-md text-sm bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-300 shadow-sm flex items-center gap-2"><CheckCircle className="w-4 h-4"/> {success} </motion.div>)}
                            {error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-2.5 rounded-md text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 shadow-sm flex items-center gap-2"><XCircle className="w-4 h-4"/> {error} </motion.div>)}
                        </AnimatePresence>

                       {activeTab === 'chats' && (
                           <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible" className="space-y-1">
                               <button onClick={() => setIsGroupModalOpen(true)} className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 transition-colors my-1">
                                   <MessageSquarePlus className="w-4 h-4" /> New Group Chat
                               </button>
                               {filteredChats.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 italic">No chats found.</p>}
                               {filteredChats.map(chat => {
                                   const display = getChatDisplayInfo(chat);
                                   return (
                                   <motion.button
                                       key={chat.id}
                                       variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                       onClick={() => handleSelectChat(chat)}
                                       className={`w-full text-left p-2.5 flex items-center gap-3 rounded-lg transition-all duration-150 ${selectedChat?.id === chat.id ? 'bg-indigo-50 dark:bg-indigo-700/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800/60'}`}
                                   >
                                       <div className="relative flex-shrink-0">
                                           <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-lg font-semibold">
                                               {display.photoURL ? (<img src={display.photoURL} alt={display.name} className="w-full h-full object-cover" />)
                                                   : chat.isGroup ? (<Users className="w-5 h-5" />)
                                                   : (<User className="w-5 h-5" />)
                                               }
                                           </div>
                                           {display.isOnline && !chat.isGroup && (<div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#161922]"></div>)}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <div className="flex justify-between items-center">
                                               <h3 className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">{display.name}</h3>
                                               <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{formatTimestamp(chat.updatedAt, 'chatList')}</span>
                                           </div>
                                           <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{chat.lastMessage || '...'}</p>
                                       </div>
                                   </motion.button>
                               )})}
                           </motion.div>
                       )}
                       {activeTab === 'friends' && (
                           <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible" className="space-y-1">
                               <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-[#1A1D29] my-1.5 shadow-sm">
                                   <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-200">Add Friend</label>
                                   <div className="flex gap-2">
                                       <input type="email" value={friendEmail} onChange={e => setFriendEmail(e.target.value)} placeholder="Friend's email address" className="flex-1 bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-sm py-1.5 px-3 rounded-lg focus:ring-1 focus:ring-[#635BFF]" />
                                       <button onClick={handleSendFriendRequest} className="bg-[#635BFF] hover:bg-[#5249d9] text-white font-semibold text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50" disabled={!friendEmail.trim()}>Send</button>
                                   </div>
                               </div>
                               {filteredFriends.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 italic">No friends found.</p>}
                               {filteredFriends.map(friend => (
                                   <motion.div
                                       key={friend.id}
                                       variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                       className="w-full text-left p-2.5 flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60"
                                   >
                                       <div className="relative flex-shrink-0">
                                           <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700">
                                               {friend.photoURL ? (<img src={friend.photoURL} alt={friend.name || friend.displayName} className="w-full h-full object-cover" />) : (<User className="w-5 h-5 text-gray-500 dark:text-gray-400" />)}
                                           </div>
                                           {onlineFriendIds.has(friend.id) && (<div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#161922]"></div>)}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <h3 className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">{friend.name || friend.displayName}</h3>
                                           <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{friend.email}</p>
                                       </div>
                                       <button
                                            onClick={() => {
                                                const existingChat = chats.find(c => !c.isGroup && user?.uid && c.members.includes(friend.id) && c.members.includes(user.uid));
                                                if (existingChat) handleSelectChat(existingChat);
                                            }}
                                            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title={`Chat with ${friend.name || friend.displayName}`}
                                        >
                                           <MessageSquare className="w-5 h-5" />
                                       </button>
                                   </motion.div>
                               ))}
                           </motion.div>
                       )}
                       {activeTab === 'requests' && (
                           <motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible" className="space-y-2 pt-1">
                               {friendRequests.filter(req => req.status === 'pending').length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 italic">No pending requests.</p>}
                               {friendRequests.filter(req => req.status === 'pending').map(req => (
                                   <motion.div
                                       key={req.id}
                                       variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                       className="p-3 rounded-xl flex items-center gap-3 border border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/60 shadow-sm"
                                   >
                                       <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-700">
                                           {req.fromUserPhotoURL ? <img src={req.fromUserPhotoURL} alt={req.fromUserName} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                                       </div>
                                       <div className="flex-1 min-w-0">
                                           <p className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">{req.fromUserName}</p>
                                           <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Wants to connect</p>
                                       </div>
                                       <div className="flex gap-2">
                                           <button onClick={() => handleAcceptRequest(req.id)} className="p-2 rounded-full text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors" title="Accept"><Check className="w-5 h-5"/></button>
                                           <button onClick={() => handleRejectRequest(req.id)} className="p-2 rounded-full text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors" title="Reject"><X className="w-5 h-5"/></button>
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
                <motion.div className="bg-white dark:bg-[#161922] p-5 rounded-xl w-full max-w-md transform transition-all border border-gray-200 dark:border-gray-700/50 shadow-2xl" initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100"> <Users className="w-5 h-5 text-[#635BFF]"/> Create New Group </h2>
                        <button onClick={() => setIsGroupModalOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/70 text-gray-400 dark:text-gray-500"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="groupNameInput" className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Group Name</label>
                            <input id="groupNameInput" type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-[#635BFF]" />
                        </div>
                        <div>
                            <label htmlFor="groupEmailsInput" className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Member Emails <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(comma/space separated)</span></label>
                            <textarea id="groupEmailsInput" value={groupEmails} onChange={e => setGroupEmails(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-[#635BFF]" rows={3} placeholder="friend1@example.com friend2@example.com"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-5">
                        <button onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 font-semibold">Cancel</button>
                        <button onClick={handleCreateGroupChat} className="px-5 py-2 text-sm rounded-md bg-[#635BFF] hover:bg-[#5249d9] text-white font-semibold" disabled={!groupName.trim()}>Create</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
          {messageToDelete && (
            <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="bg-white dark:bg-[#161922] p-5 rounded-xl w-full max-w-sm border border-gray-200 dark:border-gray-700/50 shadow-2xl" initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}>
                    <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-800 dark:text-gray-100"> <AlertTriangle className="w-5 h-5 text-red-500"/> Delete Message? </h2>
                    <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setMessageToDelete(null)} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold">Cancel</button>
                        <button onClick={handleDeleteMessageConfirmed} className="px-5 py-2 text-sm rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold">Delete</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
          {friendToUnfriend && (
            <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="bg-white dark:bg-[#161922] p-5 rounded-xl w-full max-w-sm border border-gray-200 dark:border-gray-700/50 shadow-2xl" initial={{ scale: 0.95, opacity: 0, y:15 }} animate={{ scale: 1, opacity: 1, y:0 }} exit={{ scale: 0.95, opacity: 0, y:15 }}>
                    <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-800 dark:text-gray-100"> <UserX className="w-5 h-5 text-red-500"/> Unfriend {friendToUnfriend.name || friendToUnfriend.displayName}? </h2>
                    <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">This will remove your chat history.</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setFriendToUnfriend(null)} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold">Cancel</button>
                        <button onClick={handleUnfriendConfirmed} className="px-5 py-2 text-sm rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold">Unfriend</button>
                    </div>
                </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}