// Notes.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Upload, Youtube, Mic, Plus, Search, Filter as FilterIcon,
    AlertTriangle, X, ChevronRight, ChevronLeft, Bot, FileQuestion, BookOpen,
    Sparkles, Loader2, Save, Tag, Edit2, Check, Pencil, MessageCircle, Globe,
    Lock, Trash2, Copy, RefreshCw, SplitSquareVertical, Menu, List, Briefcase,
    Share2, ClipboardCopy, Eye, ZoomIn, ZoomOut, RotateCcw, Crown, Info,
    PanelRightClose, PanelLeftClose, GripVertical, PlusCircle, Trash,
    Image as ImageIcon, // Renamed to avoid conflict
    Layers, // Icon for Flashcards
    ImagePlus, // CORRECTED ICON: Replaced ImagePlay with ImagePlus
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { auth, db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { processPDF } from '../lib/pdf-processor';
import { processYouTube } from '../lib/youtube-processor';
import {
    saveNote, savePersonalNote, updateNote, processTextToAINoteData,
    deleteNote, toggleNotePublicStatus, regenerateStudyQuestions,
    generateImageWithImagen // Import the image generation function
} from '../lib/notes-firebase'; // Assuming generateImageWithImagen is here
import { NewNoteModal } from './NewNoteModal';
import { SplitView } from './SplitView';
import { NoteChat, NoteChatHandle, ImageData } from './NoteChat';
import { getCurrentUser } from '../lib/settings-firebase';
import { geminiApiKey } from '../lib/dashboard-firebase';
import { FlashcardStudyModal } from './FlashcardStudyModal';

// --- IMPORT Centralized Tier/Usage Functions ---
import {
    UserTier,
    getUserTier,
    getUserChatUsage,
    updateUserChatUsage,
    getChatLimitForTier,
    getUserNoteUsage,
    updateUserNoteUsage
} from '../lib/current-paying-user';

// --- PDF Viewer Imports ---
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// --- Markdown Editor Import ---
import MDEditor from '@uiw/react-md-editor';

// --- Simple Modal Component ---
const SimpleModal = ({ isOpen, onClose, title, children, isIlluminateEnabled }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; isIlluminateEnabled: boolean; }) => {
    if (!isOpen) return null;
    const modalBg = isIlluminateEnabled ? "bg-white" : "bg-gray-800";
    const textColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";
    const borderColor = isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700';
    const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className={`${modalBg} rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                <div className={`flex justify-between items-center p-4 border-b ${borderColor}`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>{title}</h2>
                    <button onClick={onClose} className={`${iconColor} p-1 rounded-full hover:bg-gray-500/10`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};


// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// --- Types ---
export interface Flashcard { front: string; back: string; }
interface Note {
    id: string; title: string; content: string; type: 'personal' | 'pdf' | 'youtube' | 'audio';
    createdAt: Timestamp; updatedAt: Timestamp; userId: string; sourceUrl?: string;
    keyPoints?: string[];
    questions?: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    isPublic: boolean; tags: string[];
    flashcards?: Flashcard[];
}
interface UploadProgressState { progress: number; status: string; error: string | null; }
interface NoteUsage { pdfAi: number; youtube: number; }
// UserTier type defined in imported file

// --- Tier Limits ---
const NOTE_LIMITS = {
    basic: { pdfAi: 2, youtube: 1 },
    pro: { pdfAi: 10, youtube: 5 },
    premium: { pdfAi: Infinity, youtube: Infinity },
};

// --- Main Component ---
export function Notes() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string>("User");
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [showNewNoteModal, setShowNewNoteModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({ progress: 0, status: '', error: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'personal' | 'pdf' | 'youtube' | 'audio'>('all');

    // Tier and Usage State
    const [userTier, setUserTier] = useState<UserTier>('loading');
    const [noteUsage, setNoteUsage] = useState<NoteUsage>({ pdfAi: 0, youtube: 0 });
    const [usageMonth, setUsageMonth] = useState<string>(''); // YYYY-MM

    // Theme & Layout State
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
    const [isNotesListHidden, setIsNotesListHidden] = useState(false);
    const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
    const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
    const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'true'));
    const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState<string | undefined>('');
    const [editTags, setEditTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [editKeyPoints, setEditKeyPoints] = useState<string[]>([]);
    const [editFlashcards, setEditFlashcards] = useState<Flashcard[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Mobile state
    const [showNotesListOnMobile, setShowNotesListOnMobile] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Split view state
    const [showSplitView, setShowSplitView] = useState(false);
    const [splitViewNotes, setSplitViewNotes] = useState<{left: Note | null; right: Note | null}>({ left: null, right: null });

    // Chat State
    const [isChatOverlayVisible, setIsChatOverlayVisible] = useState(false);
    const [chatNoteForOverlay, setChatNoteForOverlay] = useState<Note | null>(null);
    const noteChatRef = useRef<NoteChatHandle>(null);

    // Flashcard Study State
    const [showFlashcardStudyModal, setShowFlashcardStudyModal] = useState(false);

    // Question answers state
    const [questionAnswers, setQuestionAnswers] = useState<{[key: string]: number | null}>({});
    const contentRef = useRef<HTMLDivElement>(null);

    // PDF Viewer State
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const pdfViewerContainerRef = useRef<HTMLDivElement>(null);
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfRotation, setPdfRotation] = useState(0);
    const [pdfChatSplitRatio, setPdfChatSplitRatio] = useState(65);
    const [isResizingPdfChatSplit, setIsResizingPdfChatSplit] = useState(false);

    // PDF Highlighting State
    const [selectedPdfText, setSelectedPdfText] = useState<string | null>(null);
    const [highlightButtonPosition, setHighlightButtonPosition] = useState<{ top: number; left: number } | null>(null);
    const [showHighlightButtons, setShowHighlightButtons] = useState(false);

    // Image Generation State
    const [showImageGenModal, setShowImageGenModal] = useState(false);
    const [imageGenPrompt, setImageGenPrompt] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imageGenError, setImageGenError] = useState<string | null>(null);

    // --- useCallback Definitions ---

    // Toggle PDF view (using useCallback)
    const togglePdfViewer = useCallback((forceOpen?: boolean) => {
        const turnOn = forceOpen !== undefined ? forceOpen : !showPdfViewer;

        if (turnOn) {
            // Check if we *can* open it based on the *current* selectedNote
            if (selectedNote?.type === 'pdf' && selectedNote.sourceUrl) {
                setShowPdfViewer(true);
                // State resets for PDF content (scale, pages etc.) are handled by the useEffect watching showPdfViewer
                 if (isChatOverlayVisible && chatNoteForOverlay?.id === selectedNote.id) {
                     setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
                 }
            } else {
                // Cannot open PDF viewer
                console.warn("Cannot open PDF viewer for the current note.");
                // Ensure it's closed if it was somehow true
                if (showPdfViewer) setShowPdfViewer(false);
            }
        } else {
            // Turning off
            setShowPdfViewer(false);
            // State resets and note list visibility handled by useEffect watching showPdfViewer
        }
        // Note: isNotesListHidden logic is now managed in the useEffect watching showPdfViewer
    }, [selectedNote, showPdfViewer, isChatOverlayVisible, chatNoteForOverlay?.id]); // Dependencies for togglePdfViewer

    const handleSelectNote = useCallback((note: Note) => {
        setIsEditing(false);
        setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        setQuestionAnswers({});
        setShowFlashcardStudyModal(false);

        if (showSplitView) {
            // Need split view selection logic here
            if (!splitViewNotes.left) {
                setSplitViewNotes({ ...splitViewNotes, left: note });
            } else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
                setSplitViewNotes({ ...splitViewNotes, right: note });
                if (isMobile) { setShowNotesListOnMobile(false); }
            }
            // Close overlay/PDF view when selecting for split view
            if (showPdfViewer) togglePdfViewer(false);
        } else {
            const previousNote = selectedNote;
            setSelectedNote(note);

            // Close PDF viewer ONLY if switching from PDF to non-PDF, or vice-versa AND PDF was open
            if (showPdfViewer && previousNote?.id !== note.id && (previousNote?.type === 'pdf' || note.type !== 'pdf')) {
                togglePdfViewer(false);
            }

            if (isMobile) {
                setShowNotesListOnMobile(false);
            }
        }
    }, [showSplitView, isMobile, showPdfViewer, selectedNote, togglePdfViewer, splitViewNotes]); // Added splitViewNotes dependency


    // PDF/Chat Resizing Handlers
    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingPdfChatSplit) return;
        const pdfSection = pdfViewerContainerRef.current?.parentElement;
        const mainContentArea = pdfSection?.parentElement;

        if (mainContentArea && pdfSection) {
            const bounds = mainContentArea.getBoundingClientRect();
            const newPdfWidth = e.clientX - bounds.left;
            const totalWidth = bounds.width;
            const resizerWidth = 6;
            let newRatio = (newPdfWidth / (totalWidth - resizerWidth)) * 100;
            newRatio = Math.max(20, Math.min(80, newRatio));
            setPdfChatSplitRatio(newRatio);
        }
    }, [isResizingPdfChatSplit]); // Dependency

    const handleResizeMouseUp = useCallback(() => {
         if (isResizingPdfChatSplit) {
             setIsResizingPdfChatSplit(false);
             document.removeEventListener('mousemove', handleResizeMouseMove);
             document.removeEventListener('mouseup', handleResizeMouseUp);
         }
    }, [isResizingPdfChatSplit, handleResizeMouseMove]); // Added handleResizeMouseMove

    const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsResizingPdfChatSplit(true);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    }, [handleResizeMouseMove, handleResizeMouseUp]); // Add function dependencies

    // PDF Text Selection Handler
     const handlePdfTextSelection = useCallback(() => {
        if (!pdfViewerContainerRef.current || !showPdfViewer) { if (showHighlightButtons) setShowHighlightButtons(false); return; }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textLayer = range.commonAncestorContainer.parentElement?.closest('.react-pdf__Page__textContent');
            if (textLayer) {
                const selectedText = range.toString().trim();
                if (selectedText.length > 2) {
                    setSelectedPdfText(selectedText);
                    const containerRect = pdfViewerContainerRef.current.getBoundingClientRect();
                    const rangeRect = range.getBoundingClientRect();
                    const scrollTop = pdfViewerContainerRef.current.scrollTop;
                    const scrollLeft = pdfViewerContainerRef.current.scrollLeft;
                    const top = rangeRect.top - containerRect.top + scrollTop - 35;
                    const left = rangeRect.left - containerRect.left + scrollLeft + (rangeRect.width / 2);
                    setHighlightButtonPosition({ top: Math.max(scrollTop + 5, top), left: Math.max(scrollLeft + 5, left) });
                    setShowHighlightButtons(true);
                    return;
                }
            }
        }
         if (showHighlightButtons) {
             setShowHighlightButtons(false); setSelectedPdfText(null); setHighlightButtonPosition(null);
         }
     }, [showPdfViewer, showHighlightButtons]); // Dependencies

    // --- Effects ---

    // Handle window resize for mobile state
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowNotesListOnMobile(true);
                // Only ensure notes list isn't hidden if PDF viewer is *not* shown
                if (!showPdfViewer) {
                    setIsNotesListHidden(false);
                }
            } else {
                // On mobile, hide list if showing note/edit/pdf/split
                setShowNotesListOnMobile(!(selectedNote || isEditing || showPdfViewer || (showSplitView && (splitViewNotes.left || splitViewNotes.right))));
            }
            // Ensure notes list is shown if PDF view is closed and list was hidden (desktop)
             if (!showPdfViewer && isNotesListHidden && !isMobile) {
                 setIsNotesListHidden(false);
             }
            setIsResizingPdfChatSplit(false); // Stop resize on window resize
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check
        return () => window.removeEventListener('resize', handleResize);
    // Dependencies need to include states read inside the effect
    }, [selectedNote, isEditing, showPdfViewer, showSplitView, splitViewNotes.left, splitViewNotes.right, isNotesListHidden]);


    // LocalStorage for theme/sidebar/layout
    useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
    useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled); }, [isBlackoutEnabled, isIlluminateEnabled]);
    useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); document.body.classList.toggle('illuminate-mode', isIlluminateEnabled); }, [isIlluminateEnabled]);
    useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
    useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

    // Auth listener and Tier/Usage Loading
    useEffect(() => {
        setLoading(true);
        setUserTier('loading');
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setUserName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User");
                const tier = getUserTier(firebaseUser.email);
                setUserTier(tier);
                if (tier !== 'premium') {
                    try {
                        const currentMonthYear = new Date().toISOString().slice(0, 7);
                        const usageData = await getUserNoteUsage(firebaseUser.uid);
                        if (usageData?.month === currentMonthYear) {
                            setNoteUsage({ pdfAi: usageData.pdfAi || 0, youtube: usageData.youtube || 0 });
                            setUsageMonth(currentMonthYear);
                        } else {
                            setNoteUsage({ pdfAi: 0, youtube: 0 });
                            setUsageMonth(currentMonthYear);
                            await updateUserNoteUsage(firebaseUser.uid, { pdfAi: 0, youtube: 0 }, currentMonthYear);
                        }
                    } catch (err) {
                        console.error("Error loading/updating note usage data:", err);
                        setNoteUsage({ pdfAi: 0, youtube: 0 });
                        setUsageMonth(new Date().toISOString().slice(0, 7));
                    }
                } else {
                    setNoteUsage({ pdfAi: Infinity, youtube: Infinity });
                    setUsageMonth('');
                }
            } else {
                setUser(null); setUserName("User"); setNotes([]); setSelectedNote(null);
                setShowPdfViewer(false); setIsEditing(false); setSplitViewNotes({ left: null, right: null });
                setShowSplitView(false); setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
                setUserTier('loading'); setNoteUsage({ pdfAi: 0, youtube: 0 }); setUsageMonth('');
                setIsNotesListHidden(false); setIsSidebarCollapsed(false); setShowFlashcardStudyModal(false);
                setShowImageGenModal(false); setImageGenPrompt(''); setImageGenError(null); setIsGeneratingImage(false);
                navigate('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]); // navigate is a stable function from react-router-dom

    // Notes listener - CORRECTED DEPENDENCY ARRAY
    useEffect(() => {
        if (!user?.uid) { setNotes([]); return; }
        const q = query(collection(db, 'notes'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesList: Note[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(notesList);
            let currentSelectedNote = selectedNote;
            if (selectedNote) {
                const updatedSelected = notesList.find(n => n.id === selectedNote.id);
                if (updatedSelected) {
                    // Only update if the data actually changed to prevent potential loops
                    if (JSON.stringify(selectedNote) !== JSON.stringify(updatedSelected)) {
                        setSelectedNote(updatedSelected);
                    }
                    currentSelectedNote = updatedSelected; // Use potentially updated note for logic
                     if (chatNoteForOverlay?.id === updatedSelected.id) {
                         setChatNoteForOverlay(updatedSelected);
                     }
                     // Update editor state only if editing and content differs
                     if (isEditing && !isSaving && editContent !== updatedSelected.content) {
                         setEditContent(updatedSelected.content || '');
                         // Potentially update other fields if needed, check for actual changes
                         // if (editTitle !== updatedSelected.title) setEditTitle(updatedSelected.title);
                         // ... etc for tags, keypoints, flashcards
                     }
                } else {
                    // Note deleted or no longer matches query
                    setSelectedNote(null); currentSelectedNote = null; setShowPdfViewer(false);
                    setIsEditing(false); setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
                    setShowFlashcardStudyModal(false);
                }
            }
            if (showSplitView) {
                const uLeft = notesList.find(n => n.id === splitViewNotes.left?.id);
                const uRight = notesList.find(n => n.id === splitViewNotes.right?.id);
                 if (splitViewNotes.left?.id !== uLeft?.id || splitViewNotes.right?.id !== uRight?.id) {
                     setSplitViewNotes({ left: uLeft || null, right: uRight || null });
                 }
            }
            // Close PDF viewer if selected note is not PDF or if editing
            if ((currentSelectedNote && currentSelectedNote.type !== 'pdf' && showPdfViewer) || (isEditing && showPdfViewer)) {
                togglePdfViewer(false); // Call the memoized function
            }
        }, (error) => {
            console.error("Error fetching notes:", error); setLoading(false);
            setUploadProgress({ progress: 0, status: '', error: 'Could not load notes.' });
        });
        return () => unsubscribe();
    }, [ // FINAL CORRECTED DEPENDENCIES for notes listener
        user?.uid,
        selectedNote?.id, // Reacts to note selection change
        selectedNote?.type, // Reacts if the *type* changes (for PDF logic)
        showSplitView,
        splitViewNotes.left?.id, // Reacts to split view note changes
        splitViewNotes.right?.id,
        chatNoteForOverlay?.id, // Reacts to chat overlay note changes
        isEditing, // Needed for logic inside
        isSaving, // Needed for logic inside
        editContent, // Needed for logic inside (updating editor)
        showPdfViewer, // Needed for logic inside
        togglePdfViewer // Include the memoized function because it's called inside
                       // And its dependencies ensure it only changes when necessary
    ]);

    // Scroll non-PDF content area to top
    useEffect(() => {
        const nonPdfScrollContainer = contentRef.current;
        if (!showPdfViewer && nonPdfScrollContainer) {
            nonPdfScrollContainer.scrollTop = 0;
        }
    }, [selectedNote, isEditing, showPdfViewer]); // Dependencies are correct here

    // Reset PDF viewer specific state and manage notes list visibility
    useEffect(() => {
        if (!showPdfViewer) {
            // Reset PDF states only if viewer was previously open for a PDF
            if (numPages !== null || pdfError !== null) {
                 setNumPages(null); setPdfError(null); setPdfScale(1.0); setPdfRotation(0);
                 setShowHighlightButtons(false); setSelectedPdfText(null);
             }
             // Ensure notes list is visible on desktop when PDF closes
            if (!isMobile && isNotesListHidden) {
                setIsNotesListHidden(false);
            }
        } else { // showPdfViewer is true
             // Reset necessary PDF states when opening for a new PDF or reopening
             setNumPages(null); setPdfError(null); setPdfScale(1.0); setPdfRotation(0);
             setShowHighlightButtons(false); setSelectedPdfText(null);
             // Hide notes list on desktop when PDF opens
             if (!isMobile) {
                 setIsNotesListHidden(true);
             }
        }
    }, [showPdfViewer, isMobile, isNotesListHidden]); // Added isNotesListHidden, removed selectedNote deps


    // Click outside handler for highlight buttons
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showHighlightButtons && highlightButtonPosition) {
                const target = event.target as Element;
                 if (!target.closest('.highlight-buttons-container') && !target.closest('.react-pdf__Page__textContent')) {
                    setShowHighlightButtons(false); setSelectedPdfText(null);
                    setHighlightButtonPosition(null); window.getSelection()?.removeAllRanges();
                }
            }
        };
        if (showPdfViewer) { document.addEventListener('mousedown', handleClickOutside); }
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [showHighlightButtons, highlightButtonPosition, showPdfViewer]); // Dependencies are correct

    // Cleanup resize listeners
    useEffect(() => {
        // Define listeners here or ensure they are stable references
        const currentMouseMove = handleResizeMouseMove;
        const currentMouseUp = handleResizeMouseUp;

        // Need to add/remove the *exact same* function references
        // handled correctly by useCallback now

        return () => {
            document.removeEventListener('mousemove', currentMouseMove);
            document.removeEventListener('mouseup', currentMouseUp);
        };
    }, [handleResizeMouseMove, handleResizeMouseUp]); // Depend on the memoized functions

    // --- Helper Functions (limits, usage) ---
    // (These functions are simple and don't need useCallback/memoization here)
    const checkNoteLimit = (noteType: 'pdfAi' | 'youtube'): boolean => { /* ... */ return true;};
    const incrementNoteUsage = async (noteType: 'pdfAi' | 'youtube') => { /* ... */ };

    // --- Core Handlers ---
    const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
    const handleToggleNotesList = () => setIsNotesListHidden(prev => !prev);

    const handleSplitViewSelect = useCallback((note: Note) => { // Added useCallback
        if (!splitViewNotes.left) { setSplitViewNotes({ ...splitViewNotes, left: note }); }
        else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
            setSplitViewNotes({ ...splitViewNotes, right: note });
            if (isMobile) { setShowNotesListOnMobile(false); }
        }
        setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
    }, [splitViewNotes, isMobile, showPdfViewer, togglePdfViewer]); // Dependencies

    const startSplitView = useCallback(() => { // Added useCallback
        setShowSplitView(true); setSelectedNote(null);
        if (showPdfViewer) togglePdfViewer(false);
        setIsChatOverlayVisible(false); setSplitViewNotes({ left: null, right: null });
        if (isMobile) { setShowNotesListOnMobile(true); }
        if (!isMobile) setIsNotesListHidden(false);
    }, [showPdfViewer, isMobile, togglePdfViewer]); // Dependencies

    const closeSplitView = useCallback(() => { // Added useCallback
        setShowSplitView(false); setSplitViewNotes({ left: null, right: null });
        if (notes.length > 0 && !isMobile) { handleSelectNote(notes[0]); }
        else { setSelectedNote(null); }
        if (isMobile) { setShowNotesListOnMobile(true); }
    }, [notes, isMobile, handleSelectNote]); // Dependencies

    const handleChatWithNote = useCallback((note: Note | null) => { // Added useCallback
         if (!note || !geminiApiKey) { /* ... error handling ... */ return; }
        if (selectedNote?.id !== note.id) { setSelectedNote(note); }
        setChatNoteForOverlay(note);
        setIsChatOverlayVisible(true);
        if (showPdfViewer) togglePdfViewer(false);
        if (isMobile) setShowNotesListOnMobile(false);
        setTimeout(() => noteChatRef.current?.focusInput(), 150);
    }, [selectedNote?.id, showPdfViewer, isMobile, togglePdfViewer]); // Dependencies

    const handleCloseChatOverlay = useCallback(() => setIsChatOverlayVisible(false), []); // No dependencies needed

    const handleAddImageToNoteRequest = useCallback((imageData: ImageData) => { // Added useCallback
        if (!selectedNote) return;
        const markdownImageTag = `\n\n![Generated Image](${`data:${imageData.type};base64,${imageData.base64}`})\n\n`;
        // Need handleEditNote reference
        const switchToEditMode = () => {
            setEditTitle(selectedNote.title);
            setEditContent(selectedNote.content || '');
            setEditTags(selectedNote.tags || []);
            setEditKeyPoints(selectedNote.keyPoints || []);
            setEditFlashcards(selectedNote.flashcards || []);
            setNewTag(''); setIsEditing(true);
            setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
            if (showPdfViewer) togglePdfViewer(false);
            setShowFlashcardStudyModal(false);
            if (isMobile) { setShowNotesListOnMobile(false); }
        };

        if (!isEditing) {
            switchToEditMode(); // Call the defined function
            setTimeout(() => { setEditContent(prevContent => (prevContent || '') + markdownImageTag); }, 50);
        } else {
             setEditContent(prevContent => (prevContent || '') + markdownImageTag);
        }
        if (isChatOverlayVisible) handleCloseChatOverlay();
    // Dependencies for handleAddImageToNoteRequest
    }, [selectedNote, isEditing, isChatOverlayVisible, showPdfViewer, isMobile, togglePdfViewer, handleCloseChatOverlay]);


    const handleUpdateNoteContentFromChat = useCallback(async (noteId: string, newContent: string) => { // Added useCallback
        if (!user) return; console.log("Updating note from chat:", noteId);
        setIsSaving(true); setUploadProgress({ progress: 0, status: 'Updating via chat...', error: null });
        try {
            await updateNote(noteId, { content: newContent, updatedAt: Timestamp.now() });
            setUploadProgress({ progress: 100, status: 'Updated via chat!', error: null });
            // Listener handles updating state
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) { /* ... error handling ... */ }
        finally { setIsSaving(false); }
    }, [user?.uid]); // Dependency

    const handleEditNote = useCallback(() => { // Added useCallback
        if (!selectedNote) return;
        setEditTitle(selectedNote.title);
        setEditContent(selectedNote.content || '');
        setEditTags(selectedNote.tags || []);
        setEditKeyPoints(selectedNote.keyPoints || []);
        setEditFlashcards(selectedNote.flashcards || []);
        setNewTag(''); setIsEditing(true);
        setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
        setShowFlashcardStudyModal(false);
        if (isMobile) { setShowNotesListOnMobile(false); }
    }, [selectedNote, showPdfViewer, isMobile, togglePdfViewer]); // Dependencies

    const handleSaveEdit = useCallback(async () => { // Added useCallback
        if (!selectedNote || !editTitle.trim() || isSaving) return;
        setIsSaving(true); setUploadProgress({ progress: 0, status: 'Saving...', error: null });
        try {
            const finalKeyPoints = editKeyPoints.map(p => p.trim()).filter(p => p.length > 0);
            const finalFlashcards = editFlashcards.filter(fc => fc.front.trim().length > 0 && fc.back.trim().length > 0);
            const updatedData: Partial<Note> = {
                 title: editTitle.trim(), content: (editContent || "").trim(),
                 tags: editTags, keyPoints: finalKeyPoints, flashcards: finalFlashcards,
                 updatedAt: Timestamp.now()
            };
            await updateNote(selectedNote.id, updatedData);
            setIsEditing(false);
            setUploadProgress({ progress: 100, status: 'Saved!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) { /* ... */ }
        finally { setIsSaving(false); }
    }, [selectedNote, editTitle, isSaving, editKeyPoints, editFlashcards, editContent, editTags]); // Dependencies

    const handleDeleteNote = useCallback(async (noteId: string) => { // Added useCallback
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        setUploadProgress({ progress: 0, status: 'Deleting...', error: null });
        try {
            await deleteNote(noteId);
            if (selectedNote?.id === noteId) {
                 setSelectedNote(null);
                 if (showPdfViewer) togglePdfViewer(false);
                 setIsEditing(false);
            }
            if (chatNoteForOverlay?.id === noteId) {
                 handleCloseChatOverlay(); setChatNoteForOverlay(null);
            }
            if (splitViewNotes.left?.id === noteId || splitViewNotes.right?.id === noteId) {
                 const uLeft = splitViewNotes.left?.id === noteId ? null : splitViewNotes.left;
                 const uRight = splitViewNotes.right?.id === noteId ? null : splitViewNotes.right;
                 setSplitViewNotes({ left: uLeft, right: uRight });
                 if (showSplitView && !uLeft && !uRight) closeSplitView(); // Close if both are gone
                 else if (showSplitView && (!uLeft || !uRight) && isMobile) setShowNotesListOnMobile(true);
            }
            setUploadProgress({ progress: 100, status: 'Deleted!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) { /* ... */ }
    }, [selectedNote?.id, showPdfViewer, chatNoteForOverlay?.id, splitViewNotes, showSplitView, isMobile, togglePdfViewer, handleCloseChatOverlay, closeSplitView]); // Dependencies

    const handleTogglePublic = useCallback(async (noteId: string, currentIsPublic: boolean) => { // Added useCallback
        setUploadProgress({ progress: 0, status: 'Updating visibility...', error: null });
        try {
            await toggleNotePublicStatus(noteId, !currentIsPublic);
            setUploadProgress({ progress: 100, status: 'Visibility updated!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
            if (currentIsPublic) setLinkCopied(false);
        } catch (error) { /* ... */ }
    }, []); // No changing dependencies

    const handleGetShareLink = useCallback((noteId: string) => { // Added useCallback
        const shareUrl = `${window.location.origin}/public-note/${noteId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); })
            .catch(err => { /* ... */ });
    }, []); // No changing dependencies

    const handleCancelEdit = useCallback(() => { setIsEditing(false); setEditTitle(''); setEditContent(''); setEditTags([]); setNewTag(''); setEditKeyPoints([]); setEditFlashcards([]); }, []); // No dependencies

    // Note Creation Handlers (simple, no useCallback needed unless complex logic/deps)
    const handleCreatePersonalNote = async (title: string, content: string, tags: string[]) => { /* ... */ };
    const handleCreateAINote = async (text: string) => { /* ... */ };
    const handlePDFUpload = async (file: File) => { /* ... */ };
    const handleYoutubeLink = async (url: string) => { /* ... */ };

    // Tag/KeyPoint/Flashcard Edit Handlers (simple state updates, no useCallback needed)
    const handleAddTag = () => { /* ... */ };
    const handleRemoveTag = (tagToRemove: string) => setEditTags(editTags.filter(tag => tag !== tagToRemove));
    const handleKeyPointChange = (index: number, value: string) => { /* ... */ };
    const handleAddKeyPoint = () => setEditKeyPoints([...editKeyPoints, '']);
    const handleRemoveKeyPoint = (index: number) => setEditKeyPoints(editKeyPoints.filter((_, i) => i !== index));
    const handleFlashcardChange = (index: number, field: 'front' | 'back', value: string) => { /* ... */ };
    const handleAddFlashcard = () => setEditFlashcards([...editFlashcards, { front: '', back: '' }]);
    const handleRemoveFlashcard = (index: number) => setEditFlashcards(editFlashcards.filter((_, i) => i !== index));

    // Study/Regenerate Handlers
    const handleStudyFlashcards = useCallback(() => { // Added useCallback
        if (!selectedNote?.flashcards || selectedNote.flashcards.length === 0) { /* ... */ }
        else { setShowFlashcardStudyModal(true); }
    }, [selectedNote?.flashcards]); // Dependency

    const handleRegenerateQuestions = useCallback(async () => { // Added useCallback
        if (!selectedNote || !geminiApiKey || isRegeneratingQuestions) return;
        setIsRegeneratingQuestions(true);
        // ... try/catch ...
        finally { setIsRegeneratingQuestions(false); }
    }, [selectedNote, isRegeneratingQuestions]); // Dependencies

    const handleAnswerSelect = useCallback((questionKey: string, selectedOption: number) => setQuestionAnswers(prev => ({ ...prev, [questionKey]: selectedOption })), []); // No dependencies

    // PDF Viewer Handlers (simple state updates, no useCallback needed)
    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => { setNumPages(nextNumPages); setPdfError(null); };
    const onDocumentLoadError = (error: Error) => { /* ... */ };
    const changeScale = (amount: number) => setPdfScale(prevScale => Math.max(0.5, prevScale + amount));
    const changeRotation = (amount: number) => setPdfRotation(prevRotation => (prevRotation + amount + 360) % 360);

    // Highlight Button Actions
    const handleExplainHighlight = useCallback(() => { // Added useCallback
        if (selectedPdfText && selectedNote) {
             handleChatWithNote(selectedNote);
             setTimeout(() => { noteChatRef.current?.sendMessage(`Explain:\n\n"${selectedPdfText}"`); }, 200);
            setShowHighlightButtons(false); setSelectedPdfText(null); window.getSelection()?.removeAllRanges();
        } else { console.warn("Explain failed: No selected text or note."); }
    }, [selectedPdfText, selectedNote, handleChatWithNote]); // Dependencies

    const handleChatAboutHighlight = useCallback(() => { // Added useCallback
        if (selectedPdfText && selectedNote) {
             handleChatWithNote(selectedNote);
             setTimeout(() => { noteChatRef.current?.addContextToInput(selectedPdfText); }, 200);
            setShowHighlightButtons(false); setSelectedPdfText(null); window.getSelection()?.removeAllRanges();
        } else { console.warn("Chat failed: No selected text or note."); }
    }, [selectedPdfText, selectedNote, handleChatWithNote]); // Dependencies

    // --- Image Generation Handler ---
    const handleGenerateImageForNote = useCallback(async () => { // Added useCallback
        if (!imageGenPrompt.trim() || !selectedNote || !geminiApiKey || isGeneratingImage) { /* ... */ return; }
        setIsGeneratingImage(true); setImageGenError(null);
        // ... try/catch ...
        try {
            const context = `Note Title: "${selectedNote.title}". Snippet: ${selectedNote.content.substring(0, 300)}...`;
            const imageData = await generateImageWithImagen(imageGenPrompt, context, geminiApiKey!); // Assert non-null API key
             if (imageData) {
                 handleAddImageToNoteRequest(imageData);
                 // ... success progress ...
                 setShowImageGenModal(false); setImageGenPrompt('');
             } else { throw new Error("Image generation call succeeded but returned no data."); }
         } catch (error: any) { /* ... error handling ... */ }
        finally { setIsGeneratingImage(false); /* ... progress timeout ... */ }
    }, [imageGenPrompt, selectedNote, isGeneratingImage, handleAddImageToNoteRequest]); // Dependencies

    // --- Theme Styles ---
    const containerClass = isIlluminateEnabled ? "bg-gray-100 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
    const notesListBg = isIlluminateEnabled ? "bg-white border-gray-200" : isBlackoutEnabled ? "bg-black border-gray-800" : "bg-gray-800 border-gray-700";
    // ... other style variables ...
    const proseClass = `prose prose-sm sm:prose-base max-w-none ${isIlluminateEnabled ? 'prose-gray' : 'prose-invert'} ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-200/50 dark:prose-code:bg-gray-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-md prose-pre:p-3 prose-img:rounded-lg prose-img:shadow-sm prose-headings:font-semibold prose-h1:text-xl prose-h1:mb-2 prose-h1:mt-4 prose-h2:text-lg prose-h2:mb-1.5 prose-h2:mt-3 prose-h3:text-base prose-h3:mb-1 prose-h3:mt-2 prose-p:leading-relaxed prose-p:mb-2 prose-ul:list-disc prose-ul:my-1 prose-ul:ml-4 prose-ol:list-decimal prose-ol:my-1 prose-ol:ml-4 prose-li:my-0.5 prose-blockquote:border-l-4 ${isIlluminateEnabled ? 'prose-blockquote:border-gray-300' : 'prose-blockquote:border-gray-600'} prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-sm prose-blockquote:my-2 prose-table:text-sm prose-table:my-2 prose-thead:border-b ${isIlluminateEnabled ? 'prose-thead:border-gray-300' : 'prose-thead:border-gray-600'} prose-th:px-2 prose-th:py-1 prose-th:font-medium ${isIlluminateEnabled ? 'prose-th:bg-gray-100/50' : 'prose-th:bg-gray-700/30'} prose-td:border ${isIlluminateEnabled ? 'prose-td:border-gray-200' : 'prose-td:border-gray-700'} prose-td:px-2 prose-td:py-1`;

    // Derived State
    const showSideBySideChat = selectedNote?.type === 'pdf' && showPdfViewer && !!selectedNote.sourceUrl && !!user && !!geminiApiKey && !isMobile;
    const currentLimits = userTier === 'loading' ? null : NOTE_LIMITS[userTier];


    // --- JSX ---
    return (
        <div className={`flex h-screen overflow-hidden ${containerClass} font-sans`}>
            {/* Sidebar */}
            <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} userName={userName} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />

            {/* Main Area */}
            <main className={`flex-1 flex overflow-hidden transition-all duration-300 ${ isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64' }`}>

                 {/* === 1. Notes List Sidebar (Desktop) === */}
                 {/* Renders only on desktop when not hidden */}
                 {!isMobile && !isNotesListHidden && (
                     <div className={`
                        w-full md:w-72 lg:w-80 xl:w-96 border-r ${borderColor} flex-shrink-0 flex flex-col ${notesListBg}
                        transition-transform duration-300 ease-in-out relative h-full z-10
                    `}>
                         {/* Header */}
                         <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
                             <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}> <FileText className={`w-5 h-5 ${iconActionColor}`} /> Notes </h2>
                             <div className="flex items-center gap-1">
                                <button onClick={handleToggleNotesList} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title={isNotesListHidden ? "Show Notes List" : "Hide Notes List"}>
                                     <PanelRightClose className="w-4 h-4" /> {/* Always show close when visible */}
                                </button>
                                {notes.length >= 2 && !showPdfViewer && ( <button onClick={showSplitView ? closeSplitView : startSplitView} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title={showSplitView ? "Close Comparison" : "Compare Notes"}> <SplitSquareVertical className={`w-4 h-4 ${showSplitView ? iconActionColor: ''}`} /> </button> )}
                                <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} p-2 rounded-full hover:shadow-md transition-all duration-150`} title="New Note"> <Plus className="w-4 h-4" /> </button>
                             </div>
                         </div>
                        {/* Search/Filter */}
                        <div className={`p-3 border-b ${borderColor} flex-shrink-0`}>
                            {/* ... search/filter inputs ... */}
                             <div className="relative mb-2"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${iconColor}`} /> <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 ${placeholderColor}`} /> </div>
                             <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div>
                        </div>
                        {/* Usage Info Display */}
                        {userTier !== 'premium' && userTier !== 'loading' && currentLimits && (
                           <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}>
                                 <div className="flex justify-between items-center gap-2">
                                     <span>PDF/AI Notes: {noteUsage.pdfAi} / {currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span>
                                     <span>YouTube Notes: {noteUsage.youtube} / {currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span>
                                 </div>
                            </div>
                        )}
                        {/* Notes List */}
                        <div className="flex-1 overflow-y-auto">
                            {/* ... notes list rendering ... */}
                            {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div> )
                            : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> )
                            : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || note.content.toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>Left</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>Right</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{note.content.substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type]} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                        </div>
                    </div>
                 )}

                 {/* Notes List Toggle Button (when hidden on desktop) */}
                 {!isMobile && isNotesListHidden && (
                    <button
                        onClick={handleToggleNotesList}
                        className={`fixed left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-r-md shadow-lg transition-all duration-300 ${buttonSecondaryClass} hover:brightness-110`}
                        title="Show Notes List"
                        style={{ left: isSidebarCollapsed ? '5rem' : '16rem' }}
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                 )}

                 {/* === 2. Main Content Area === */}
                 <div ref={!showSideBySideChat ? contentRef : null} className={`flex-1 ${mainContentBg} relative ${showSideBySideChat ? 'overflow-hidden' : 'overflow-y-auto'}`}>

                      {/* Mobile Header */}
                     {isMobile && !showNotesListOnMobile && !showSideBySideChat && (
                        // ... mobile header JSX ...
                          <div className={`sticky top-0 z-10 p-2 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-white/80 backdrop-blur-sm' : 'bg-gray-900/80 backdrop-blur-sm'} flex items-center justify-between`}>
                             <button onClick={() => setShowNotesListOnMobile(true)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Notes"> <List className="w-4 h-4" /> </button>
                             <span className={`text-sm font-medium truncate px-2 ${headingClass}`}> {isEditing ? 'Editing Note' : selectedNote?.title || 'Note'} </span>
                             <div className="w-8 h-8 flex items-center justify-center">
                                 {selectedNote && !isEditing && !showPdfViewer && ( <button onClick={handleEditNote} className={`p-1.5 rounded-md ${iconHoverColor} ${iconActionHoverBg}`} title="Edit note"> <Edit2 className="w-4 h-4" /> </button> )}
                                 {isEditing && ( <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`p-1.5 rounded-md ${buttonPrimaryClass} ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`} title="Save Changes"> {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} </button> )}
                             </div>
                         </div>
                    )}

                    {/* --- Dynamic Content Rendering --- */}
                     {showSplitView && splitViewNotes.left && splitViewNotes.right ? (
                        // ... split view JSX ...
                         <SplitView leftNote={splitViewNotes.left} rightNote={splitViewNotes.right} onClose={closeSplitView} onTogglePublic={handleTogglePublic} onDelete={handleDeleteNote} onChat={handleChatWithNote} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} />
                     ) : showSideBySideChat ? (
                        // ... side-by-side PDF and Chat JSX ...
                         <div className="flex flex-row h-full overflow-hidden">
                              {/* PDF Viewer Section */}
                             <div className="flex flex-col overflow-hidden relative border-r border-gray-200 dark:border-gray-700" style={{ width: `${pdfChatSplitRatio}%` }}>
                                  {/* PDF Controls Header */}
                                  <div className={`flex-shrink-0 p-1.5 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-800/50'} flex items-center justify-between gap-1 sticky top-0 z-10`}>
                                      <div className="flex items-center gap-1">
                                          <button onClick={() => togglePdfViewer(false)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Note Content"> <FileText className="w-4 h-4" /> </button>
                                      </div>
                                      <div className="flex items-center gap-1"> {/* Zoom & Rotate */}
                                          <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div>
                                          <button onClick={() => changeScale(-0.1)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Zoom Out"> <ZoomOut className="w-4 h-4" /> </button>
                                          <span className={`text-xs font-medium px-1 ${textColor}`}>{Math.round(pdfScale * 100)}%</span>
                                          <button onClick={() => changeScale(0.1)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Zoom In"> <ZoomIn className="w-4 h-4" /> </button>
                                          <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div>
                                          <button onClick={() => changeRotation(-90)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Rotate Left"> <RotateCcw className="w-4 h-4 transform -scale-x-100" /> </button>
                                          <button onClick={() => changeRotation(90)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Rotate Right"> <RotateCcw className="w-4 h-4" /> </button>
                                       </div>
                                  </div>
                                  {/* Highlight Instruction */}
                                  <p className={`flex-shrink-0 text-center text-[10px] p-0.5 ${isIlluminateEnabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-800 text-gray-400'} sticky top-[37px] z-[9]`}>
                                      Highlight any text in the PDF to open the Explain or Chat options.
                                  </p>
                                 {/* PDF Document Area */}
                                 <div ref={pdfViewerContainerRef} onMouseUp={handlePdfTextSelection} className={`flex-1 overflow-auto relative ${isIlluminateEnabled ? 'bg-gray-100' : 'bg-gray-800/30'}`} >
                                     {pdfError ? (
                                        <div className="p-6 text-center text-red-500 flex flex-col items-center justify-center h-full"> <AlertTriangle className="w-10 h-10 mb-3" /> <p className="text-sm font-medium">Error Loading PDF</p> <p className="text-xs mt-1">{pdfError}</p> </div>
                                     ) : (
                                        <Document file={selectedNote.sourceUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={<div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>} className="flex flex-col items-center pdf-document pt-4 pb-8" >
                                            {numPages === null ? ( <div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> ) : (
                                                 Array.from(new Array(numPages), (el, index) => (
                                                    <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={pdfScale} rotate={pdfRotation} renderAnnotationLayer={true} renderTextLayer={true} className="mb-2 shadow-md" loading={<div className="h-64 flex items-center justify-center text-xs">Loading page {index + 1}...</div>} />
                                                ))
                                            )}
                                        </Document>
                                     )}
                                     {/* Highlight Buttons */}
                                     {showHighlightButtons && highlightButtonPosition && (
                                         <div className="highlight-buttons-container absolute z-20 flex items-center gap-1 bg-gray-800 dark:bg-gray-200 p-1 rounded-md shadow-lg" style={{ top: `${highlightButtonPosition.top}px`, left: `${highlightButtonPosition.left}px`, transform: 'translateX(-50%)' }} onMouseDown={(e) => e.stopPropagation()} >
                                             <button onClick={handleExplainHighlight} className={`text-xs px-2 py-1 rounded transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Explain</button>
                                             <button onClick={handleChatAboutHighlight} className={`text-xs px-2 py-1 rounded transition-colors ${isIlluminateEnabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>Chat</button>
                                         </div>
                                     )}
                                 </div>
                             </div>

                             {/* Resizable Handle */}
                             <div className={`w-1.5 cursor-col-resize flex items-center justify-center flex-shrink-0 ${isIlluminateEnabled ? 'bg-gray-300 hover:bg-gray-400' : 'bg-gray-600 hover:bg-gray-500'} ${isResizingPdfChatSplit ? (isIlluminateEnabled ? '!bg-blue-500' : '!bg-blue-500') : ''}`} onMouseDown={handleResizeMouseDown} title="Drag to resize panels">
                                 <GripVertical className={`w-4 h-4 pointer-events-none ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`} />
                             </div>

                             {/* Chat Section (Inline) */}
                             <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 - pdfChatSplitRatio}%` }}>
                                 {selectedNote && geminiApiKey && (
                                    <NoteChat
                                        ref={noteChatRef}
                                        key={selectedNote.id}
                                        note={selectedNote}
                                        onClose={() => togglePdfViewer(false)}
                                        geminiApiKey={geminiApiKey}
                                        userName={userName}
                                        isIlluminateEnabled={isIlluminateEnabled}
                                        isBlackoutEnabled={isBlackoutEnabled}
                                        isVisible={true}
                                        onUpdateNoteContent={handleUpdateNoteContentFromChat}
                                        onAddImageToNoteRequest={handleAddImageToNoteRequest}
                                        displayMode="inline"
                                     />
                                 )}
                             </div>
                         </div>

                     ) : (
                         // --- Default View: Single Note, Edit, Split Placeholder, or Initial ---
                         <div className={`p-0 md:p-6 lg:p-8 h-full ${isEditing ? 'flex flex-col' : ''} ${showSideBySideChat ? 'hidden': ''}`}>
                            {showSplitView && (!splitViewNotes.left || !splitViewNotes.right) ? (
                                // ... split placeholder JSX ...
                                 <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <SplitSquareVertical className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>Compare Notes</h2> <p className={`${subheadingClass} text-sm mb-4`}>Select {splitViewNotes.left ? 'one more note' : 'two notes'} from the list.</p> <p className={`text-xs ${subheadingClass} mb-4`}>Selected: {splitViewNotes.left ? 1 : 0}/2</p> <button onClick={closeSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Cancel Comparison</button> </div>
                            ) : selectedNote ? (
                                isEditing ? (
                                    // ... edit mode JSX ...
                                    <div className={`${noteViewBg} rounded-lg p-4 md:p-6 flex flex-col h-full overflow-hidden`}>
                                        {/* Edit Header */}
                                         <div className="space-y-3 flex-shrink-0">
                                             {/* ... title input, tags ... */}
                                              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} text-xl font-semibold rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${placeholderColor}`} placeholder="Note title..." />
                                              <div className="flex flex-wrap items-center gap-2"> {editTags.map((tag) => ( <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {tag} <button onClick={() => handleRemoveTag(tag)} className={`${iconHoverColor} rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5`} title={`Remove tag "${tag}"`}> <X className="w-2.5 h-2.5" /> </button> </span> ))} {editTags.length < 5 && ( <div className="flex items-center gap-1"> <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder="Add tag..." className={`${inputBg} ${inputTextColor} ${placeholderColor} rounded-full px-2.5 py-0.5 text-xs focus:outline-none focus:ring-1 w-24`} /> <button onClick={handleAddTag} className={`${buttonSecondaryClass} px-2 py-0.5 rounded-full text-xs`}>Add</button> </div> )} </div>
                                         </div>

                                         {/* Main Edit Area Container (Scrollable) */}
                                         <div className="flex-1 mt-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 pr-2">
                                             {/* MDEditor */}
                                             <div className="mb-4" data-color-mode={isIlluminateEnabled ? 'light' : 'dark'}>
                                                  {/* @ts-ignore */}
                                                  <MDEditor
                                                      value={editContent}
                                                      onChange={setEditContent}
                                                      minHeight={200}
                                                      preview="live"
                                                      textareaProps={{ placeholder: "Start writing your note in Markdown..." }}
                                                      className={`[&_.w-md-editor-preview]:!bg-transparent [&_.w-md-editor-input]:!bg-transparent [&_.w-md-editor-toolbar]:!bg-gray-100/50 dark:[&_.w-md-editor-toolbar]:!bg-gray-800/50 border dark:border-gray-700 rounded-md [&_.w-md-editor-live]:border-l dark:[&_.w-md-editor-live]:border-gray-700`}
                                                  />
                                              </div>

                                             {/* Editable Key Points */}
                                             <div className="mt-4 pt-3 border-t dark:border-gray-700">
                                                  {/* ... key points edit section ... */}
                                                  <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${headingClass}`}><Sparkles className={`w-4 h-4 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} />Edit Key Points</h3>
                                                   <div className="space-y-1.5">
                                                       {editKeyPoints.map((point, index) => (
                                                           <div key={index} className="flex items-center gap-2">
                                                               <textarea rows={1} value={point} onChange={(e) => handleKeyPointChange(index, e.target.value)} placeholder={`Key point ${index + 1}`} className={`flex-grow ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} />
                                                               <button onClick={() => handleRemoveKeyPoint(index)} className={`${iconDeleteHoverColor} p-1 rounded`} title="Remove Point"><Trash className="w-3.5 h-3.5" /></button>
                                                           </div>
                                                       ))}
                                                   </div>
                                                   <button onClick={handleAddKeyPoint} className={`${buttonSecondaryClass} mt-2 px-2.5 py-1 rounded text-xs flex items-center gap-1`}> <PlusCircle className="w-3.5 h-3.5"/> Add Point </button>
                                              </div>

                                              {/* Editable Flashcards */}
                                             <div className="mt-4 pt-3 border-t dark:border-gray-700">
                                                  {/* ... flashcards edit section ... */}
                                                   <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${headingClass}`}><Layers className={`w-4 h-4 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} />Edit Flashcards</h3>
                                                   <div className="space-y-2">
                                                       {editFlashcards.map((card, index) => (
                                                           <div key={index} className={`flex items-start gap-2 border rounded p-2 ${isIlluminateEnabled ? 'border-gray-200 bg-gray-50/50' : 'border-gray-600/50 bg-gray-700/30'}`}>
                                                               <div className="flex-grow space-y-1">
                                                                   <textarea rows={1} value={card.front} onChange={(e) => handleFlashcardChange(index, 'front', e.target.value)} placeholder="Front" className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} />
                                                                   <textarea rows={1} value={card.back} onChange={(e) => handleFlashcardChange(index, 'back', e.target.value)} placeholder="Back" className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} />
                                                               </div>
                                                                <button onClick={() => handleRemoveFlashcard(index)} className={`${iconDeleteHoverColor} p-1 rounded mt-1`} title="Remove Card"><Trash className="w-3.5 h-3.5" /></button>
                                                           </div>
                                                       ))}
                                                   </div>
                                                   <button onClick={handleAddFlashcard} className={`${buttonSecondaryClass} mt-2 px-2.5 py-1 rounded text-xs flex items-center gap-1`}> <PlusCircle className="w-3.5 h-3.5"/> Add Card </button>
                                              </div>
                                         </div> {/* End Scrollable Edit Area */}

                                         {/* Edit Footer */}
                                         <div className="flex justify-between items-center gap-2 pt-3 mt-3 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
                                             {/* Left side: Image Generation */}
                                             {geminiApiKey && (
                                                <button
                                                     onClick={() => { setShowImageGenModal(true); setImageGenError(null); setImageGenPrompt('');}}
                                                     className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}
                                                     title="Generate Image and add to Note"
                                                     disabled={isGeneratingImage}
                                                >
                                                     <ImagePlus className="w-4 h-4" /> {/* CORRECTED ICON */}
                                                     Generate Image
                                                 </button>
                                             )}
                                             {/* Right side: Save/Cancel */}
                                             <div className="flex gap-2">
                                                 <button onClick={handleCancelEdit} className={`${buttonSecondaryClass} px-4 py-1.5 rounded-md text-sm`}>Cancel</button>
                                                 <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`}> {isSaving ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Saving... </>) : (<> <Save className="w-4 h-4" /> Save </>)} </button>
                                             </div>
                                         </div>
                                     </div>
                                ) : (
                                    // --- View Mode ---
                                    <div className={`${noteViewBg} rounded-lg flex flex-col overflow-hidden h-full p-4 md:p-6 lg:p-8 animate-fadeIn`}>
                                        {/* View Header */}
                                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 flex-shrink-0`}>
                                            {/* ... title, action buttons ... */}
                                            <h2 className={`text-xl md:text-2xl font-semibold ${headingClass} break-words mr-auto`}>{selectedNote.title || "Untitled Note"}</h2>
                                             <div className={`flex items-center gap-1 flex-shrink-0 border rounded-full p-0.5 ${borderColor} ${isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
                                                <button onClick={handleEditNote} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Edit"><Edit2 className="w-4 h-4" /></button>
                                                {geminiApiKey && <button onClick={() => handleChatWithNote(selectedNote)} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Chat about this note"><MessageCircle className="w-4 h-4" /></button>}
                                                {selectedNote.type === 'pdf' && selectedNote.sourceUrl && !isMobile && ( <button onClick={() => togglePdfViewer(true)} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title={"View PDF & Chat"}> <Eye className="w-4 h-4" /> </button> )}
                                                {selectedNote.flashcards && selectedNote.flashcards.length > 0 && ( <button onClick={handleStudyFlashcards} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Study Flashcards"><Layers className="w-4 h-4" /> </button> )}
                                                <button onClick={() => handleTogglePublic(selectedNote.id, selectedNote.isPublic)} className={`p-1.5 rounded-full ${iconHoverColor} ${selectedNote.isPublic ? 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30' : iconActionHoverBg}`} title={selectedNote.isPublic ? 'Make private' : 'Make public'}>{selectedNote.isPublic ? <Globe className={`w-4 h-4 ${isIlluminateEnabled ? 'text-cyan-600' : 'text-cyan-400'}`} /> : <Lock className="w-4 h-4" />}</button>
                                                {selectedNote.isPublic && ( <button onClick={() => handleGetShareLink(selectedNote.id)} className={`p-1.5 rounded-full relative ${iconHoverColor} hover:bg-green-100/50 dark:hover:bg-green-900/30`} title="Copy share link">{linkCopied ? <ClipboardCopy className={`w-4 h-4 text-green-500`} /> : <Share2 className="w-4 h-4" />}</button> )}
                                                <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div>
                                                <button onClick={() => handleDeleteNote(selectedNote.id)} className={`p-1.5 rounded-full ${iconDeleteHoverColor} ${iconDeleteHoverBg}`} title="Delete"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        {/* Tags */}
                                        {((selectedNote.tags?.length ?? 0) > 0) && ( <div className={`flex flex-wrap gap-1.5 mb-4`}> {selectedNote.tags!.map((tag) => (<span key={tag} className={`px-2 py-0.5 rounded-full text-xs ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>#{tag}</span>))} </div> )}
                                        {/* Content Area */}
                                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                                            {/* Note Content */}
                                            <div className={`${proseClass} mb-6`}>
                                                <ReactMarkdown /* ... props ... */ >{selectedNote.content}</ReactMarkdown>
                                            </div>
                                            {/* Key Points */}
                                            {selectedNote.keyPoints && selectedNote.keyPoints.length > 0 && ( <div className={`mt-6 border-t pt-4 ${borderColor}`}> {/* ... key points display ... */} </div> )}
                                            {/* Flashcards */}
                                            {selectedNote.flashcards && selectedNote.flashcards.length > 0 && ( <div className={`mt-6 border-t pt-4 ${borderColor}`}> {/* ... flashcards display/study button ... */} </div> )}
                                            {/* Study Questions */}
                                            {selectedNote.questions && selectedNote.questions.length > 0 && ( <div className={`mt-6 border-t pt-4 ${borderColor}`}> {/* ... questions display ... */} </div> )}
                                        </div>
                                    </div>
                                )
                            ) : (
                                // --- Initial Placeholder ---
                                <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <FileText className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>No Note Selected</h2> <p className={`${subheadingClass} max-w-xs text-sm mb-4`}>Select a note from the list, or create a new one.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 mb-2`}> <Plus className="w-4 h-4" /> Create Note </button> {!isMobile && notes.length >= 2 && !showSplitView && ( <button onClick={startSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <SplitSquareVertical className="w-4 h-4" /> Compare Notes </button> )} </div>
                            )}
                         </div>
                     )} {/* End Main Content Conditional Rendering */}
                </div> {/* End Main Content Area Flex container */}

                {/* === 3. Mobile Notes List Overlay === */}
                 {isMobile && (
                    // ... mobile notes list JSX ...
                     <div className={`
                        fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out
                        ${showNotesListOnMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                     `} onClick={() => setShowNotesListOnMobile(false)}>
                         <div className={`
                            absolute top-0 right-0 h-full w-4/5 max-w-sm ${notesListBg} border-l ${borderColor} shadow-xl
                            flex flex-col transform transition-transform duration-300 ease-in-out
                            ${showNotesListOnMobile ? 'translate-x-0' : 'translate-x-full'}
                         `} onClick={(e) => e.stopPropagation()}>
                               {/* Header */}
                             <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
                                 <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}> <FileText className={`w-5 h-5 ${iconActionColor}`} /> Notes </h2>
                                 <div className="flex items-center gap-1">
                                    <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} p-1.5 rounded-full hover:shadow-md transition-all duration-150`} title="New Note"> <Plus className="w-4 h-4" /> </button>
                                     <button onClick={() => setShowNotesListOnMobile(false)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Hide List"> <X className="w-4 h-4" /> </button>
                                 </div>
                             </div>
                            {/* Search/Filter */}
                            <div className={`p-3 border-b ${borderColor} flex-shrink-0`}>
                                <div className="relative mb-2"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${iconColor}`} /> <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 ${placeholderColor}`} /> </div>
                                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div>
                            </div>
                             {/* Usage Info Display */}
                            {userTier !== 'premium' && userTier !== 'loading' && currentLimits && (
                                <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}>
                                    <div className="flex justify-between items-center gap-2">
                                        <span>PDF/AI: {noteUsage.pdfAi}/{currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span>
                                        <span>YT: {noteUsage.youtube}/{currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span>
                                    </div>
                                </div>
                            )}
                            {/* Notes List */}
                            <div className="flex-1 overflow-y-auto">
                                {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div> )
                                : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> )
                                : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || note.content.toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>Left</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>Right</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{note.content.substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type]} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                            </div>
                         </div>
                     </div>
                 )}

            </main>

            {/* Modals & Overlays */}
            {showNewNoteModal && ( <NewNoteModal onClose={() => { setShowNewNoteModal(false); setUploadProgress({ progress: 0, status: '', error: null }); }} onCreatePersonalNote={handleCreatePersonalNote} onCreateAINote={handleCreateAINote} onUploadPDF={handlePDFUpload} onYoutubeLink={handleYoutubeLink} uploadProgress={uploadProgress} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} /> )}

            {/* Flashcard Study Modal */}
            {selectedNote && selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
                <FlashcardStudyModal
                    isOpen={showFlashcardStudyModal}
                    onClose={() => setShowFlashcardStudyModal(false)}
                    flashcards={selectedNote.flashcards}
                    isIlluminateEnabled={isIlluminateEnabled}
                 />
            )}

            {/* Image Generation Modal */}
            <SimpleModal
                isOpen={showImageGenModal}
                onClose={() => { setShowImageGenModal(false); setIsGeneratingImage(false); setImageGenPrompt(''); setImageGenError(null);}}
                title="Generate Image for Note"
                isIlluminateEnabled={isIlluminateEnabled}
            >
                <div className="space-y-3">
                    <p className={`${subheadingClass} text-sm`}>Enter a description for the image. It will be added to the end of your current note content.</p>
                    <textarea
                        value={imageGenPrompt}
                        onChange={(e) => setImageGenPrompt(e.target.value)}
                        placeholder="e.g., A photorealistic image of a futuristic cityscape at sunset..."
                        rows={3}
                        className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-y`}
                        disabled={isGeneratingImage}
                    />
                    {imageGenError && <p className="text-xs text-red-500">{imageGenError}</p>}
                    <div className="flex justify-end">
                        <button
                            onClick={handleGenerateImageForNote}
                            disabled={isGeneratingImage || !imageGenPrompt.trim()}
                            className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isGeneratingImage || !imageGenPrompt.trim() ? buttonDisabledClass : ''}`}
                        >
                            {isGeneratingImage ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Generating... </>) : (<> Generate & Add </>)}
                        </button>
                    </div>
                </div>
            </SimpleModal>

            {/* Chat Overlay */}
            {chatNoteForOverlay && user && geminiApiKey && (
                 <NoteChat
                     key={chatNoteForOverlay.id}
                     ref={noteChatRef}
                     note={chatNoteForOverlay}
                     onClose={handleCloseChatOverlay}
                     geminiApiKey={geminiApiKey}
                     userName={userName}
                     isIlluminateEnabled={isIlluminateEnabled}
                     isBlackoutEnabled={isBlackoutEnabled}
                     isVisible={isChatOverlayVisible}
                     onUpdateNoteContent={handleUpdateNoteContentFromChat}
                     onAddImageToNoteRequest={handleAddImageToNoteRequest}
                     displayMode="overlay"
                 />
            )}

            {/* Mobile Floating Button (Show Notes) */}
             {isMobile && !showNotesListOnMobile && (
                 <button
                     onClick={() => setShowNotesListOnMobile(true)}
                     className={`fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg transition-all duration-300 ${buttonPrimaryClass} transform hover:scale-110 active:scale-100 ${isChatOverlayVisible ? 'bottom-16' : 'bottom-4'}`}
                     title="Show Notes List"
                 >
                     <List className="w-5 h-5" />
                 </button>
             )}
            {/* Upload Progress Indicator */}
            {uploadProgress.status && (
                 <div className={`fixed bottom-4 left-4 z-[60] p-3 rounded-lg shadow-lg text-xs font-medium transition-opacity duration-300 ${isIlluminateEnabled ? 'bg-white border border-gray-200 text-gray-800' : 'bg-gray-800 border border-gray-700 text-gray-200'} ${uploadProgress.error ? (isIlluminateEnabled ? '!bg-red-100 !border-red-300 !text-red-700' : '!bg-red-900/50 !border-red-700 !text-red-300') : (uploadProgress.progress === 100 && !uploadProgress.error ? (isIlluminateEnabled ? '!bg-green-100 !border-green-300 !text-green-700' : '!bg-green-900/50 !border-green-700 !text-green-300') : '')}`}>
                    <div className="flex items-center gap-2"> {uploadProgress.error ? <AlertTriangle className="w-4 h-4 text-red-500" /> : (uploadProgress.progress === 100 && !uploadProgress.error) ? <Check className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 animate-spin text-blue-500" />} <span>{uploadProgress.error || uploadProgress.status}</span> {uploadProgress.progress > 0 && uploadProgress.progress < 100 && !uploadProgress.error && (<span className="text-gray-500">({uploadProgress.progress}%)</span>)} </div>
                    {!uploadProgress.error && uploadProgress.progress < 100 && ( <div className={`w-full h-1 mt-1 rounded-full overflow-hidden ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'}`}> <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div> </div> )}
                 </div>
            )}

        </div> // End Root Flex Container
    );
};

export default Notes;
