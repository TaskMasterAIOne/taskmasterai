
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
    Image as ImageIcon,
    Layers,
    ImagePlus,
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
    generateImageWithImagen, NoteData // Import NoteData type if needed
} from '../lib/notes-firebase'; // Assuming generateImageWithImagen is here
import { NewNoteModal } from './NewNoteModal';
import { SplitView } from './SplitView';
import { NoteChat, NoteChatHandle, ImageData } from './NoteChat';
import { getCurrentUser } from '../lib/settings-firebase';
import { geminiApiKey } from '../lib/dashboard-firebase'; // Ensure this loads correctly
import { FlashcardStudyModal } from './FlashcardStudyModal';

import {
    UserTier,
    getUserTier,
    getUserChatUsage,
    updateUserChatUsage,
    getChatLimitForTier,
    getUserNoteUsage,
    updateUserNoteUsage
} from '../lib/current-paying-user';

import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import MDEditor from '@uiw/react-md-editor';

const SimpleModal = ({ isOpen, onClose, title, children, isIlluminateEnabled }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; isIlluminateEnabled: boolean; }) => {
    if (!isOpen) return null;
    const modalBg = isIlluminateEnabled ? "bg-white" : "bg-gray-800";
    const textColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";
    const modalBorderColor = isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700';
    const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className={`${modalBg} rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                <div className={`flex justify-between items-center p-4 border-b ${modalBorderColor}`}>
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

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Re-aligning with NoteData from firebase lib, keeping Flashcard interface separate if needed
export interface Flashcard { front: string; back: string; }
// Use NoteData from notes-firebase.ts directly or adapt if frontend needs slightly different structure
// For simplicity, let's assume NoteData from firebase is sufficient, adding 'id' after fetch.
type Note = NoteData & { id: string }; // Add required 'id' to the imported type

interface UploadProgressState { progress: number; status: string; error: string | null; }
interface NoteUsage { pdfAi: number; youtube: number; }

const NOTE_LIMITS = {
    basic: { pdfAi: 2, youtube: 1 },
    pro: { pdfAi: 10, youtube: 5 },
    premium: { pdfAi: Infinity, youtube: Infinity },
};

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

    const [userTier, setUserTier] = useState<UserTier>('loading');
    const [noteUsage, setNoteUsage] = useState<NoteUsage>({ pdfAi: 0, youtube: 0 });
    const [usageMonth, setUsageMonth] = useState<string>('');

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
    const [isNotesListHidden, setIsNotesListHidden] = useState(false); // Controls the right-side notes list panel
    const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
    const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
    const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'true'));
    const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState<string | undefined>(''); // MDEditor requires string | undefined
    const [editTags, setEditTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [editKeyPoints, setEditKeyPoints] = useState<string[]>([]);
    const [editFlashcards, setEditFlashcards] = useState<Flashcard[]>([]); // Use Flashcard interface
    const [isSaving, setIsSaving] = useState(false);
    const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const [showNotesListOnMobile, setShowNotesListOnMobile] = useState(true); // Mobile overlay visibility
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [showSplitView, setShowSplitView] = useState(false);
    const [splitViewNotes, setSplitViewNotes] = useState<{left: Note | null; right: Note | null}>({ left: null, right: null });

    const [isChatOverlayVisible, setIsChatOverlayVisible] = useState(false);
    const [chatNoteForOverlay, setChatNoteForOverlay] = useState<Note | null>(null);
    const noteChatRef = useRef<NoteChatHandle>(null);

    const [showFlashcardStudyModal, setShowFlashcardStudyModal] = useState(false);

    const [questionAnswers, setQuestionAnswers] = useState<{[key: string]: number | null}>({});
    const contentRef = useRef<HTMLDivElement>(null);

    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const pdfViewerContainerRef = useRef<HTMLDivElement>(null);
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfRotation, setPdfRotation] = useState(0);
    const [pdfChatSplitRatio, setPdfChatSplitRatio] = useState(65);
    const [isResizingPdfChatSplit, setIsResizingPdfChatSplit] = useState(false);

    const [selectedPdfText, setSelectedPdfText] = useState<string | null>(null);
    const [highlightButtonPosition, setHighlightButtonPosition] = useState<{ top: number; left: number } | null>(null);
    const [showHighlightButtons, setShowHighlightButtons] = useState(false);

    const [showImageGenModal, setShowImageGenModal] = useState(false);
    const [imageGenPrompt, setImageGenPrompt] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imageGenError, setImageGenError] = useState<string | null>(null);


    const togglePdfViewer = useCallback((forceOpen?: boolean) => {
        const turnOn = forceOpen !== undefined ? forceOpen : !showPdfViewer;

        if (turnOn) {
            if (selectedNote?.type === 'pdf' && selectedNote.sourceUrl) {
                setShowPdfViewer(true);
                 if (isChatOverlayVisible && chatNoteForOverlay?.id === selectedNote.id) {
                     setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
                 }
                 if (!isMobile && !isNotesListHidden) { // Hide right notes list on desktop
                     setIsNotesListHidden(true);
                 }
            } else {
                console.warn("Cannot open PDF viewer for the current note.");
                if (showPdfViewer) setShowPdfViewer(false); // Ensure it's closed if already open
                 if (!isMobile && isNotesListHidden) { // Show notes list if it was hidden
                     setIsNotesListHidden(false);
                 }
            }
        } else {
            setShowPdfViewer(false);
             if (!isMobile && isNotesListHidden) { // Show notes list when closing PDF view
                 setIsNotesListHidden(false);
             }
        }
    }, [selectedNote, showPdfViewer, isChatOverlayVisible, chatNoteForOverlay?.id, isMobile, isNotesListHidden]);

    const handleSelectNote = useCallback((note: Note) => {
        if (isEditing) setIsEditing(false); // Exit edit mode when selecting a new note
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        setQuestionAnswers({});
        setShowFlashcardStudyModal(false);

        if (showSplitView) {
            if (!splitViewNotes.left) {
                setSplitViewNotes({ ...splitViewNotes, left: note });
            } else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
                setSplitViewNotes({ ...splitViewNotes, right: note });
                if (isMobile) setShowNotesListOnMobile(false);
            }
            if (showPdfViewer) togglePdfViewer(false);
        } else {
            const previousNoteId = selectedNote?.id;
            setSelectedNote(note);

            if (showPdfViewer && previousNoteId !== note.id && (note.type !== 'pdf' || !note.sourceUrl)) {
                 togglePdfViewer(false); // Close PDF viewer if switching to a non-PDF note or PDF without URL
            }

            if (isMobile) {
                setShowNotesListOnMobile(false);
            }
        }
    }, [showSplitView, isMobile, showPdfViewer, selectedNote?.id, selectedNote?.type, togglePdfViewer, splitViewNotes, isEditing, isChatOverlayVisible]);


    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingPdfChatSplit || !pdfViewerContainerRef.current) return;
        const pdfSection = pdfViewerContainerRef.current.parentElement;
        const mainContentArea = pdfSection?.parentElement;

        if (mainContentArea && pdfSection) {
            const bounds = mainContentArea.getBoundingClientRect();
            const newPdfWidth = e.clientX - bounds.left;
            const totalWidth = bounds.width;
            const resizerWidth = 6; // Width of the resizer element
            let newRatio = (newPdfWidth / (totalWidth - resizerWidth)) * 100;
            newRatio = Math.max(20, Math.min(80, newRatio)); // Clamp ratio
            setPdfChatSplitRatio(newRatio);
        }
    }, [isResizingPdfChatSplit]);

    const handleResizeMouseUp = useCallback(() => {
         if (isResizingPdfChatSplit) {
             setIsResizingPdfChatSplit(false);
             document.removeEventListener('mousemove', handleResizeMouseMove);
             document.removeEventListener('mouseup', handleResizeMouseUp);
             document.body.style.cursor = 'default'; // Reset cursor
             document.body.style.userSelect = 'auto'; // Re-enable text selection
         }
    }, [isResizingPdfChatSplit, handleResizeMouseMove]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsResizingPdfChatSplit(true);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'col-resize'; // Change cursor during resize
        document.body.style.userSelect = 'none'; // Disable text selection during resize
    }, [handleResizeMouseMove, handleResizeMouseUp]);

     const handlePdfTextSelection = useCallback(() => {
        if (!pdfViewerContainerRef.current || !showPdfViewer) { if (showHighlightButtons) setShowHighlightButtons(false); return; }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textLayer = range.commonAncestorContainer.parentElement?.closest('.react-pdf__Page__textContent');
            if (textLayer) {
                const selectedText = range.toString().trim();
                if (selectedText.length > 2) { // Require minimum length
                    setSelectedPdfText(selectedText);
                    const containerRect = pdfViewerContainerRef.current.getBoundingClientRect();
                    const rangeRect = range.getBoundingClientRect();
                    const scrollTop = pdfViewerContainerRef.current.scrollTop;
                    const scrollLeft = pdfViewerContainerRef.current.scrollLeft;
                    // Position button slightly above the selected text
                    const top = rangeRect.top - containerRect.top + scrollTop - 35; // Adjust vertical offset
                    const left = rangeRect.left - containerRect.left + scrollLeft + (rangeRect.width / 2); // Center horizontally
                    setHighlightButtonPosition({ top: Math.max(scrollTop + 5, top), left: Math.max(scrollLeft + 5, left) }); // Ensure visible
                    setShowHighlightButtons(true);
                    return;
                }
            }
        }
         // Deselect if conditions not met or selection lost
         if (showHighlightButtons) {
             setShowHighlightButtons(false); setSelectedPdfText(null); setHighlightButtonPosition(null);
         }
     }, [showPdfViewer, showHighlightButtons]);


    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowNotesListOnMobile(true); // Always show list container on desktop
                // Manage hidden state based on PDF viewer
                setIsNotesListHidden(showPdfViewer);
            } else {
                // On mobile, hide list overlay if showing note/edit/pdf/split
                setShowNotesListOnMobile(!(selectedNote || isEditing || showPdfViewer || (showSplitView && (splitViewNotes.left || splitViewNotes.right))));
            }
            setIsResizingPdfChatSplit(false); // Stop resize on window resize
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check
        return () => window.removeEventListener('resize', handleResize);
        // Dependencies reflect state read *inside* the handler
    }, [selectedNote, isEditing, showPdfViewer, showSplitView, splitViewNotes.left, splitViewNotes.right]);


    useEffect(() => { localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed)); }, [isSidebarCollapsed]);
    useEffect(() => { localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled)); document.body.classList.toggle('blackout-mode', isBlackoutEnabled && !isIlluminateEnabled); }, [isBlackoutEnabled, isIlluminateEnabled]);
    useEffect(() => { localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled)); document.body.classList.toggle('illuminate-mode', isIlluminateEnabled); }, [isIlluminateEnabled]);
    useEffect(() => { localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled)); }, [isSidebarBlackoutEnabled]);
    useEffect(() => { localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled)); }, [isSidebarIlluminateEnabled]);

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
                            // Initialize usage for new month if needed
                            await updateUserNoteUsage(firebaseUser.uid, { pdfAi: 0, youtube: 0 }, currentMonthYear);
                        }
                    } catch (err) {
                        console.error("Error loading/updating note usage data:", err);
                        setNoteUsage({ pdfAi: 0, youtube: 0 }); // Reset on error
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
    }, [navigate]); // navigate is stable

    // Firestore notes listener - Refined dependencies
    useEffect(() => {
        if (!user?.uid) { setNotes([]); return; }

        setLoading(true); // Indicate loading when user changes or listener restarts
        const q = query(collection(db, 'notes'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesList: Note[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(notesList);

            // Update selected note if it still exists in the list
            if (selectedNote?.id) {
                const updatedSelected = notesList.find(n => n.id === selectedNote.id);
                if (updatedSelected) {
                    // Only update state if data differs to prevent unnecessary re-renders
                    if (JSON.stringify(selectedNote) !== JSON.stringify(updatedSelected)) {
                         setSelectedNote(updatedSelected);
                    }
                    // Update chat overlay note if it's the selected one
                    if (chatNoteForOverlay?.id === updatedSelected.id && JSON.stringify(chatNoteForOverlay) !== JSON.stringify(updatedSelected)) {
                         setChatNoteForOverlay(updatedSelected);
                    }
                } else {
                    // Selected note was deleted or removed
                    setSelectedNote(null);
                    setChatNoteForOverlay(null);
                    setIsEditing(false);
                    if (showPdfViewer) togglePdfViewer(false); // Close PDF if note gone
                    setShowFlashcardStudyModal(false);
                }
            }

            // Update split view notes if they still exist
            if (showSplitView) {
                 const currentLeftId = splitViewNotes.left?.id;
                 const currentRightId = splitViewNotes.right?.id;
                 const updatedLeft = currentLeftId ? notesList.find(n => n.id === currentLeftId) : null;
                 const updatedRight = currentRightId ? notesList.find(n => n.id === currentRightId) : null;
                 // Only update if the references actually changed
                 if (splitViewNotes.left?.id !== updatedLeft?.id || splitViewNotes.right?.id !== updatedRight?.id) {
                     setSplitViewNotes({ left: updatedLeft || null, right: updatedRight || null });
                 }
             }

            setLoading(false); // Loading complete after processing snapshot
        }, (error) => {
            console.error("Error fetching notes:", error); setLoading(false);
            setUploadProgress({ progress: 0, status: '', error: 'Could not load notes.' });
            // Consider resetting notes state? setNotes([]);
        });

        return () => unsubscribe(); // Cleanup listener on unmount or user change

    }, [user?.uid]); // Re-run ONLY when the user ID changes


    // Scroll non-PDF content area to top when selected note changes (and not in PDF view)
    useEffect(() => {
        const nonPdfScrollContainer = contentRef.current;
        if (!showPdfViewer && nonPdfScrollContainer && selectedNote?.id) { // Added selectedNote.id check
            nonPdfScrollContainer.scrollTop = 0;
        }
    }, [selectedNote?.id, showPdfViewer]); // Depend only on note ID and PDF view state

    // Reset PDF viewer specific state when viewer is closed or opened
    useEffect(() => {
        if (!showPdfViewer) {
            // Reset only if PDF states were previously set
            if (numPages !== null || pdfError !== null || pdfScale !== 1.0 || pdfRotation !== 0 || showHighlightButtons) {
                 setNumPages(null); setPdfError(null); setPdfScale(1.0); setPdfRotation(0);
                 setShowHighlightButtons(false); setSelectedPdfText(null); setHighlightButtonPosition(null);
             }
        } else { // When PDF viewer opens
             setNumPages(null); setPdfError(null); setPdfScale(1.0); setPdfRotation(0);
             setShowHighlightButtons(false); setSelectedPdfText(null); setHighlightButtonPosition(null);
        }
    }, [showPdfViewer]); // Depend only on the viewer visibility

    // Click outside handler for highlight buttons
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if click is outside the buttons AND the text content area
            if (showHighlightButtons && highlightButtonPosition) {
                const target = event.target as Element;
                 if (!target.closest('.highlight-buttons-container') && !target.closest('.react-pdf__Page__textContent')) {
                    setShowHighlightButtons(false); setSelectedPdfText(null);
                    setHighlightButtonPosition(null); window.getSelection()?.removeAllRanges(); // Clear browser selection
                }
            }
        };
        if (showPdfViewer) { document.addEventListener('mousedown', handleClickOutside); }
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [showHighlightButtons, highlightButtonPosition, showPdfViewer]);

    // Cleanup resize listeners
    useEffect(() => {
        const currentMouseMove = handleResizeMouseMove;
        const currentMouseUp = handleResizeMouseUp;
        return () => {
            document.removeEventListener('mousemove', currentMouseMove);
            document.removeEventListener('mouseup', currentMouseUp);
            // Reset body styles if component unmounts during resize
             if (isResizingPdfChatSplit) {
                 document.body.style.cursor = 'default';
                 document.body.style.userSelect = 'auto';
             }
        };
    }, [handleResizeMouseMove, handleResizeMouseUp, isResizingPdfChatSplit]);


    const checkNoteLimit = (noteType: 'pdfAi' | 'youtube'): boolean => {
        if (userTier === 'premium' || userTier === 'loading') return true;
        const limits = NOTE_LIMITS[userTier];
        return noteUsage[noteType] < limits[noteType];
    };

    const incrementNoteUsage = async (noteType: 'pdfAi' | 'youtube') => {
        if (!user || userTier === 'premium' || userTier === 'loading') return;
        const currentMonthYear = new Date().toISOString().slice(0, 7);
        // Fetch latest usage before incrementing to avoid race conditions if possible
        // (Simple increment based on local state here for brevity)
        if (usageMonth !== currentMonthYear) {
            // Reset for new month
            setUsageMonth(currentMonthYear);
            const newUsage = { pdfAi: noteType === 'pdfAi' ? 1 : 0, youtube: noteType === 'youtube' ? 1 : 0 };
            setNoteUsage(newUsage);
            await updateUserNoteUsage(user.uid, newUsage, currentMonthYear);
        } else {
            const newUsage = { ...noteUsage, [noteType]: noteUsage[noteType] + 1 };
            setNoteUsage(newUsage);
            await updateUserNoteUsage(user.uid, newUsage, currentMonthYear);
        }
    };

    const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
    const handleToggleNotesList = () => setIsNotesListHidden(prev => !prev);

    const handleSplitViewSelect = useCallback((note: Note) => {
        if (!splitViewNotes.left) { setSplitViewNotes({ ...splitViewNotes, left: note }); }
        else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
            setSplitViewNotes({ ...splitViewNotes, right: note });
            if (isMobile) { setShowNotesListOnMobile(false); }
        }
        if (isChatOverlayVisible) setIsChatOverlayVisible(false); setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
    }, [splitViewNotes, isMobile, showPdfViewer, togglePdfViewer, isChatOverlayVisible]);

    const startSplitView = useCallback(() => {
        setShowSplitView(true); setSelectedNote(null); // Deselect single note view
        if (showPdfViewer) togglePdfViewer(false);
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setSplitViewNotes({ left: null, right: null });
        if (isMobile) setShowNotesListOnMobile(true); // Show list to select notes
        if (!isMobile) setIsNotesListHidden(false); // Ensure list is visible on desktop
    }, [showPdfViewer, isChatOverlayVisible, isMobile, togglePdfViewer]);

    const closeSplitView = useCallback(() => {
        setShowSplitView(false); setSplitViewNotes({ left: null, right: null });
        // Select the first note if available on desktop, otherwise null
        if (notes.length > 0 && !isMobile) { handleSelectNote(notes[0]); }
        else { setSelectedNote(null); }
        if (isMobile) setShowNotesListOnMobile(true); // Show list again on mobile
        if (!isMobile) setIsNotesListHidden(false); // Ensure list visible on desktop
    }, [notes, isMobile, handleSelectNote]); // Added handleSelectNote dependency

    const handleChatWithNote = useCallback((note: Note | null) => {
         if (!note || !geminiApiKey) {
            setUploadProgress({progress: 0, status: '', error: 'Chat requires configuration.'});
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }
        // Select the note if it's not already selected in the main view
        if (!showSplitView && selectedNote?.id !== note.id) {
            setSelectedNote(note);
        }
        setChatNoteForOverlay(note);
        setIsChatOverlayVisible(true);
        if (showPdfViewer) togglePdfViewer(false); // Close PDF viewer for chat overlay
        if (isMobile) setShowNotesListOnMobile(false); // Hide list on mobile
        setTimeout(() => noteChatRef.current?.focusInput(), 150); // Focus input after transition
    }, [selectedNote?.id, showSplitView, showPdfViewer, isMobile, togglePdfViewer]); // Added showSplitView

    const handleCloseChatOverlay = useCallback(() => setIsChatOverlayVisible(false), []);

    // --- Consolidated Edit Mode Logic ---
    const switchToEditMode = useCallback((noteToEdit: Note | null) => {
        if (!noteToEdit) return;
        setEditTitle(noteToEdit.title);
        setEditContent(noteToEdit.content || ''); // Ensure content is not null/undefined for editor
        setEditTags(noteToEdit.tags || []);
        setEditKeyPoints(noteToEdit.keyPoints || []);
        setEditFlashcards(noteToEdit.flashcards || []);
        setNewTag('');
        setIsEditing(true); // Enter edit mode
        setSelectedNote(noteToEdit); // Ensure this note is selected
        // Close other views
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
        setShowFlashcardStudyModal(false);
        if (showSplitView) setShowSplitView(false); // Close split view if editing
        if (isMobile) setShowNotesListOnMobile(false); // Hide list on mobile
        if (!isMobile) setIsNotesListHidden(false); // Ensure main content is visible on desktop
    }, [isChatOverlayVisible, showPdfViewer, togglePdfViewer, showSplitView, isMobile]);

    const handleEditNote = useCallback(() => {
        if (!selectedNote) return;
        switchToEditMode(selectedNote);
    }, [selectedNote, switchToEditMode]);

    const handleAddImageToNoteRequest = useCallback((imageData: ImageData) => {
        if (!selectedNote && !isEditing) return; // Need a note context

        const markdownImageTag = `\n\n![Generated Image](${`data:${imageData.type};base64,${imageData.base64}`})\n\n`;

        if (!isEditing) {
            // If not already editing the selected note, switch to edit mode first
            if (selectedNote) {
                 switchToEditMode(selectedNote);
                 // Use timeout to ensure state update finishes before setting content
                 setTimeout(() => {
                     setEditContent(prevContent => (prevContent || '') + markdownImageTag);
                 }, 50);
            } else {
                console.error("Cannot add image: No note selected.");
                return;
            }
        } else {
             // Already in edit mode, just append
             setEditContent(prevContent => (prevContent || '') + markdownImageTag);
        }
        // Ensure chat overlay closes if image added from there
        if (isChatOverlayVisible) handleCloseChatOverlay();

    }, [selectedNote, isEditing, switchToEditMode, isChatOverlayVisible, handleCloseChatOverlay]);


    const handleUpdateNoteContentFromChat = useCallback(async (noteId: string, newContent: string) => {
        if (!user) return;
        console.log("Updating note from chat:", noteId);
        setIsSaving(true); // Use isSaving state to prevent conflicting saves
        setUploadProgress({ progress: 0, status: 'Updating via chat...', error: null });
        try {
            await updateNote(noteId, { content: newContent }); // updateNote handles updatedAt
            setUploadProgress({ progress: 100, status: 'Updated via chat!', error: null });
            // Let the onSnapshot listener update the local state (selectedNote, editContent if editing)
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error updating note from chat:", error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to update note via chat.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
        finally { setIsSaving(false); }
    }, [user?.uid]); // Minimal dependencies

    const handleSaveEdit = useCallback(async () => {
        if (!selectedNote || !editTitle.trim() || isSaving) return;
        setIsSaving(true); setUploadProgress({ progress: 0, status: 'Saving...', error: null });
        try {
            const finalKeyPoints = editKeyPoints.map(p => p.trim()).filter(p => p.length > 0);
            const finalFlashcards = editFlashcards.filter(fc => fc.front.trim().length > 0 && fc.back.trim().length > 0);
            const updatedData: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>> = {
                 title: editTitle.trim(),
                 content: (editContent || "").trim(),
                 tags: editTags,
                 keyPoints: finalKeyPoints.length > 0 ? finalKeyPoints : undefined, // Store undefined if empty
                 flashcards: finalFlashcards.length > 0 ? finalFlashcards : undefined,
                 // updatedAt is handled by updateNote
            };
            await updateNote(selectedNote.id, updatedData);
            setIsEditing(false); // Exit edit mode on successful save
            setUploadProgress({ progress: 100, status: 'Saved!', error: null });
            // Let listener update selectedNote state naturally
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error saving note:", error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to save note.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
         }
        finally { setIsSaving(false); }
    }, [selectedNote, editTitle, editContent, editTags, editKeyPoints, editFlashcards, isSaving]); // Added editContent

    const handleDeleteNote = useCallback(async (noteId: string) => {
        if (!window.confirm('Are you sure you want to delete this note? This cannot be undone.')) return;
        setUploadProgress({ progress: 0, status: 'Deleting...', error: null });
        try {
            await deleteNote(noteId);
            // No need to manually update local state here, the listener will handle it.
            // Just ensure UI resets appropriately if the deleted note was selected/viewed.
            if (selectedNote?.id === noteId) {
                 setSelectedNote(null);
                 setIsEditing(false);
                 if (showPdfViewer) togglePdfViewer(false);
            }
            if (chatNoteForOverlay?.id === noteId) {
                 handleCloseChatOverlay(); setChatNoteForOverlay(null);
            }
            if (splitViewNotes.left?.id === noteId || splitViewNotes.right?.id === noteId) {
                 const uLeft = splitViewNotes.left?.id === noteId ? null : splitViewNotes.left;
                 const uRight = splitViewNotes.right?.id === noteId ? null : splitViewNotes.right;
                 setSplitViewNotes({ left: uLeft, right: uRight });
                 if (showSplitView && !uLeft && !uRight) closeSplitView();
                 else if (showSplitView && (!uLeft || !uRight) && isMobile) setShowNotesListOnMobile(true);
            }
            setUploadProgress({ progress: 100, status: 'Deleted!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error deleting note:", error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to delete note.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
         }
    }, [selectedNote?.id, showPdfViewer, chatNoteForOverlay?.id, splitViewNotes, showSplitView, isMobile, togglePdfViewer, handleCloseChatOverlay, closeSplitView]);

    const handleTogglePublic = useCallback(async (noteId: string, currentIsPublic: boolean) => {
        setUploadProgress({ progress: 0, status: 'Updating visibility...', error: null });
        try {
            await toggleNotePublicStatus(noteId, !currentIsPublic);
            // Listener will update the local note state
            setUploadProgress({ progress: 100, status: 'Visibility updated!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
            if (currentIsPublic) setLinkCopied(false); // Reset copy status if made private
        } catch (error) {
            console.error("Error updating visibility:", error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to update visibility.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
         }
    }, []);

    const handleGetShareLink = useCallback((noteId: string) => {
        const shareUrl = `${window.location.origin}/public-note/${noteId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); })
            .catch(err => {
                console.error('Failed to copy link: ', err);
                setUploadProgress({ progress: 0, status: '', error: 'Could not copy link.' });
                setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            });
    }, []);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        // Reset edit fields (optional, could revert to selectedNote's state if preferred)
        // setEditTitle(''); setEditContent(''); setEditTags([]); setNewTag(''); setEditKeyPoints([]); setEditFlashcards([]);
        // If reverting is desired, just rely on the next note selection or re-entering edit mode
    }, []);

    const handleCreatePersonalNote = async (title: string, content: string, tags: string[]) => {
        if (!user) return;
        setUploadProgress({ progress: 0, status: 'Creating note...', error: null });
        try {
            const newNoteData = await savePersonalNote(user.uid, title, content, tags); // Returns full NoteData now
            setShowNewNoteModal(false);
            handleSelectNote(newNoteData); // Select the newly created note
            setUploadProgress({ progress: 100, status: 'Note created!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error creating personal note:", error);
            setUploadProgress({ progress: 0, status: '', error: `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
    };

    const handleCreateAINote = async (text: string) => {
        if (!user || !geminiApiKey) {
            setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
            return;
        }
        if (!checkNoteLimit('pdfAi')) { // Count general AI note towards pdfAi limit for now
            setUploadProgress({ progress: 0, status: '', error: 'AI note limit reached for this month.' });
            return;
        }
        setUploadProgress({ progress: 0, status: 'Processing text...', error: null });
        try {
            const aiNoteData = await processTextToAINoteData(text, geminiApiKey);
            setUploadProgress({ progress: 50, status: 'Saving AI note...', error: null });

            const newNote = await saveNote(user.uid, { // saveNote now returns NoteData
                ...aiNoteData, // Includes title, content, keyPoints, questions, flashcards, etc.
                type: 'personal', // Mark as personal type for now
            });

            await incrementNoteUsage('pdfAi');
            setShowNewNoteModal(false);
            handleSelectNote(newNote); // Select the newly created note
            setUploadProgress({ progress: 100, status: 'AI note created!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error creating AI note:", error);
            setUploadProgress({ progress: 0, status: '', error: `Failed to create AI note: ${error instanceof Error ? error.message : String(error)}` });
        }
    };

    const handlePDFUpload = async (file: File) => {
        if (!user || !geminiApiKey) {
             setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
             return;
        }
        if (!checkNoteLimit('pdfAi')) {
            setUploadProgress({ progress: 0, status: '', error: 'PDF/AI note limit reached for this month.' });
            return;
        }
        setUploadProgress({ progress: 0, status: 'Uploading PDF...', error: null });
        try {
            // Process PDF returns URL, but AI processing happens separately now
            const { storagePath, fileUrl, extractedText } = await processPDF( // Assuming processPDF returns extractedText now
                user.uid,
                file,
                (progress, status) => setUploadProgress({ progress, status, error: null })
            );

            if (!extractedText) {
                throw new Error("Failed to extract text from PDF for AI processing.");
            }

            setUploadProgress({ progress: 90, status: 'Generating AI summaries...', error: null });
            const aiNoteData = await processTextToAINoteData(extractedText, geminiApiKey, true);

            setUploadProgress({ progress: 95, status: 'Saving PDF note...', error: null });
            const newNote = await saveNote(user.uid, {
                ...aiNoteData,
                title: file.name.replace(/\.[^/.]+$/, "") || aiNoteData.title, // Use file name as title preferable
                type: 'pdf',
                sourceUrl: fileUrl, // Store the PDF URL
            });

            await incrementNoteUsage('pdfAi');
            setShowNewNoteModal(false);
            handleSelectNote(newNote);
            setUploadProgress({ progress: 100, status: 'PDF processed & note created!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);

        } catch (error) {
            console.error("Error processing PDF:", error);
            setUploadProgress({ progress: 0, status: '', error: `PDF processing failed: ${error instanceof Error ? error.message : String(error)}` });
        }
    };

    const handleYoutubeLink = async (url: string) => {
        if (!user || !geminiApiKey) {
            setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
            return;
        }
        if (!checkNoteLimit('youtube')) {
            setUploadProgress({ progress: 0, status: '', error: 'YouTube note limit reached for this month.' });
            return;
        }
        setUploadProgress({ progress: 0, status: 'Processing YouTube link...', error: null });
        try {
             // processYouTube should ideally return extracted transcript
            const { transcript, videoTitle } = await processYouTube(url, (status) => setUploadProgress({ progress: 50, status, error: null }));

            if (!transcript) {
                 throw new Error("Failed to get transcript from YouTube video.");
            }

            setUploadProgress({ progress: 80, status: 'Generating AI summaries...', error: null });
            const aiNoteData = await processTextToAINoteData(transcript, geminiApiKey);

            setUploadProgress({ progress: 95, status: 'Saving YouTube note...', error: null });
            const newNote = await saveNote(user.uid, {
                ...aiNoteData,
                title: videoTitle || aiNoteData.title, // Use actual video title if available
                type: 'youtube',
                sourceUrl: url, // Store the YT URL
            });

            await incrementNoteUsage('youtube');
            setShowNewNoteModal(false);
            handleSelectNote(newNote);
            setUploadProgress({ progress: 100, status: 'YouTube note created!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error processing YouTube link:", error);
            setUploadProgress({ progress: 0, status: '', error: `YouTube processing failed: ${error instanceof Error ? error.message : String(error)}` });
        }
    };

    const handleAddTag = () => {
        const trimmedTag = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (trimmedTag && editTags.length < 5 && !editTags.includes(trimmedTag)) {
            setEditTags([...editTags, trimmedTag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => setEditTags(editTags.filter(tag => tag !== tagToRemove));

    const handleKeyPointChange = (index: number, value: string) => {
        const updatedPoints = [...editKeyPoints];
        updatedPoints[index] = value;
        setEditKeyPoints(updatedPoints);
    };

    const handleAddKeyPoint = () => setEditKeyPoints([...editKeyPoints, '']);

    const handleRemoveKeyPoint = (index: number) => setEditKeyPoints(editKeyPoints.filter((_, i) => i !== index));

    const handleFlashcardChange = (index: number, field: 'front' | 'back', value: string) => {
        const updatedCards = [...editFlashcards];
        updatedCards[index] = { ...updatedCards[index], [field]: value };
        setEditFlashcards(updatedCards);
    };

    const handleAddFlashcard = () => setEditFlashcards([...editFlashcards, { front: '', back: '' }]);

    const handleRemoveFlashcard = (index: number) => setEditFlashcards(editFlashcards.filter((_, i) => i !== index));

    const handleStudyFlashcards = useCallback(() => {
        if (!selectedNote?.flashcards || selectedNote.flashcards.length === 0) {
             setUploadProgress({ progress: 0, status: '', error: 'No flashcards available for this note.' });
             setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
        else { setShowFlashcardStudyModal(true); }
    }, [selectedNote?.flashcards]);

    const handleRegenerateQuestions = useCallback(async () => {
        if (!selectedNote || !geminiApiKey || isRegeneratingQuestions || !user) return;

        // Check limits (consider if regen counts towards usage)
        if (userTier !== 'premium' && !checkNoteLimit('pdfAi')) { // Example: Count towards pdfAi limit
            setUploadProgress({ progress: 0, status: '', error: 'AI limit reached. Cannot regenerate questions.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }

        setIsRegeneratingQuestions(true);
        setUploadProgress({ progress: 0, status: 'Regenerating questions...', error: null });
        try {
            // Call the updated function from notes-firebase
            const newQuestions = await regenerateStudyQuestions(selectedNote.id, selectedNote.content, geminiApiKey);

            // Update the note in Firestore with the new questions
            await updateNote(selectedNote.id, { questions: newQuestions });

            // Increment usage if applicable
            if (userTier !== 'premium') {
                await incrementNoteUsage('pdfAi'); // Example: Count towards pdfAi limit
            }

            setUploadProgress({ progress: 100, status: 'Questions regenerated!', error: null });
            // Reset local answers state
            setQuestionAnswers({});
            // The listener will update the selectedNote with new questions automatically
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error regenerating questions:", error);
            setUploadProgress({ progress: 0, status: '', error: `Failed to regenerate questions: ${error instanceof Error ? error.message : String(error)}` });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        } finally {
            setIsRegeneratingQuestions(false);
        }
    }, [selectedNote, geminiApiKey, isRegeneratingQuestions, user, userTier]); // Removed redundant checks/increments

    const handleAnswerSelect = useCallback((questionKey: string, selectedOption: number) => setQuestionAnswers(prev => ({ ...prev, [questionKey]: selectedOption })), []);

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => { setNumPages(nextNumPages); setPdfError(null); };

    const onDocumentLoadError = (error: Error) => {
        console.error("Error loading PDF document:", error);
        setPdfError(error.message || 'Failed to load PDF file.');
        setNumPages(null);
    };

    const changeScale = (amount: number) => setPdfScale(prevScale => Math.max(0.5, Math.min(3.0, prevScale + amount))); // Added max scale
    const changeRotation = (amount: number) => setPdfRotation(prevRotation => (prevRotation + amount + 360) % 360);

    const handleExplainHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote) {
             handleChatWithNote(selectedNote);
             // Delay sending message slightly to allow chat overlay to open/focus
             setTimeout(() => { noteChatRef.current?.sendMessage(`Explain:\n\n"${selectedPdfText}"`); }, 250);
            setShowHighlightButtons(false); setSelectedPdfText(null); window.getSelection()?.removeAllRanges();
        } else { console.warn("Explain failed: No selected text or note."); }
    }, [selectedPdfText, selectedNote, handleChatWithNote]);

    const handleChatAboutHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote) {
             handleChatWithNote(selectedNote);
             // Delay adding context slightly
             setTimeout(() => { noteChatRef.current?.addContextToInput(selectedPdfText); }, 250);
            setShowHighlightButtons(false); setSelectedPdfText(null); window.getSelection()?.removeAllRanges();
        } else { console.warn("Chat failed: No selected text or note."); }
    }, [selectedPdfText, selectedNote, handleChatWithNote]);

    const handleGenerateImageForNote = useCallback(async () => {
        if (!imageGenPrompt.trim() || !selectedNote || !geminiApiKey || isGeneratingImage || !user) {
            setImageGenError("Prompt is required and note must be selected.");
            return;
        }
        if (userTier === 'loading' || (userTier !== 'premium' && userTier !== 'pro')) {
            setImageGenError("Image generation is available for Pro and Premium users only.");
            setTimeout(() => setImageGenError(null), 4000);
            return;
        }

        setIsGeneratingImage(true); setImageGenError(null);
        setUploadProgress({ progress: 0, status: 'Generating image...', error: null });
        try {
            const context = `Note Title: "${selectedNote.title}". Snippet: ${selectedNote.content.substring(0, 300)}...`;
            const imageData = await generateImageWithImagen(imageGenPrompt, context, geminiApiKey!); // Use non-null assertion if check passed
             if (imageData) {
                 handleAddImageToNoteRequest(imageData); // This now handles switching to edit mode if needed
                 setUploadProgress({ progress: 100, status: 'Image added to note!', error: null });
                 setShowImageGenModal(false); setImageGenPrompt('');
             } else { throw new Error("Image generation call succeeded but returned no data."); } // Should not happen if API worked
         } catch (error: any) {
            console.error("Image generation failed:", error);
            const errorMsg = error?.message || 'Unknown image generation error.';
            setImageGenError(`Failed: ${errorMsg}`); // Show error in modal
            setUploadProgress({ progress: 0, status: '', error: `Image generation failed: ${errorMsg}` }); // Show in corner
         }
        finally {
             setIsGeneratingImage(false);
             setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000); // Clear progress indicator
        }
    }, [imageGenPrompt, selectedNote, geminiApiKey, isGeneratingImage, user, userTier, handleAddImageToNoteRequest]);


    const containerClass = isIlluminateEnabled ? "bg-gray-100 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
    const notesListBg = isIlluminateEnabled ? "bg-white border-gray-200" : isBlackoutEnabled ? "bg-black border-gray-800" : "bg-gray-800 border-gray-700";
    const mainContentBg = isIlluminateEnabled ? "bg-gray-100" : isBlackoutEnabled ? "bg-black" : "bg-gray-900";
    const noteViewBg = isIlluminateEnabled ? "bg-white border border-gray-200 shadow-sm" : isBlackoutEnabled ? "bg-black border border-gray-800" : "bg-gray-800 border border-gray-700";
    const borderColor = isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700';
    const divideColor = isIlluminateEnabled ? 'divide-gray-200' : 'divide-gray-700';
    const headingClass = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";
    const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
    const textColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";
    const iconColor = isIlluminateEnabled ? "text-gray-400" : "text-gray-500";
    const iconActionColor = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
    const iconHoverColor = isIlluminateEnabled ? "text-gray-600 hover:text-gray-900" : "text-gray-400 hover:text-gray-100";
    const iconActionHoverBg = isIlluminateEnabled ? "hover:bg-gray-200" : "hover:bg-gray-700";
    const iconDeleteHoverColor = isIlluminateEnabled ? "text-red-500 hover:text-red-700" : "text-red-400 hover:text-red-300";
    const iconDeleteHoverBg = isIlluminateEnabled ? "hover:bg-red-100" : "hover:bg-red-900/30";
    const inputBg = isIlluminateEnabled ? "bg-gray-100 border border-gray-300 focus:ring-blue-500 focus:border-blue-500" : "bg-gray-700 border border-gray-600 focus:ring-blue-500 focus:border-blue-500";
    const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-white";
    const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500";
    const buttonPrimaryClass = isIlluminateEnabled ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-300" : "bg-blue-500 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-400";
    const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-300" : "bg-gray-700 text-gray-300 hover:bg-gray-600 focus:ring-2 focus:ring-gray-500";
    const buttonDisabledClass = "opacity-50 cursor-not-allowed";
    const listItemBaseClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-300";
    const listItemHoverBg = isIlluminateEnabled ? "hover:bg-gray-50" : "hover:bg-gray-700/50";
    // Updated selected item style for right border
    const listItemSelectedBg = isIlluminateEnabled ? "!bg-blue-50 border-r-2 border-blue-500" : "!bg-gray-700 border-r-2 border-blue-500";
    const tagBaseBg = isIlluminateEnabled ? 'bg-opacity-100' : 'bg-opacity-20';
    const tagTextBase = isIlluminateEnabled ? '' : 'text-opacity-90';
    const tagColors = {
      personal: isIlluminateEnabled ? 'bg-green-100 text-green-800' : 'bg-green-500 text-green-100',
      pdf: isIlluminateEnabled ? 'bg-red-100 text-red-800' : 'bg-red-500 text-red-100',
      youtube: isIlluminateEnabled ? 'bg-purple-100 text-purple-800' : 'bg-purple-500 text-purple-100',
      audio: isIlluminateEnabled ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-500 text-yellow-100',
      public: isIlluminateEnabled ? 'bg-cyan-100 text-cyan-800' : 'bg-cyan-500 text-cyan-100',
      custom: isIlluminateEnabled ? 'bg-gray-200 text-gray-700' : 'bg-gray-600 text-gray-300'
    };

    // Use a more robust prose class, ensure overrides don't break basics
    const proseClass = `prose prose-sm sm:prose-base max-w-none ${isIlluminateEnabled ? 'prose-gray' : 'prose-invert'} ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-headings:font-semibold prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal prose-li:my-1 prose-blockquote:border-l-4 ${isIlluminateEnabled ? 'prose-blockquote:border-gray-300' : 'prose-blockquote:border-gray-600'} prose-blockquote:pl-3 prose-blockquote:italic prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-200/50 dark:prose-code:bg-gray-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-md prose-pre:p-3 prose-img:rounded-lg prose-img:shadow-sm`; // Removed some potentially conflicting margin/padding styles

    const showSideBySideChat = selectedNote?.type === 'pdf' && showPdfViewer && !!selectedNote.sourceUrl && !!user && !!geminiApiKey && !isMobile;
    const currentLimits = userTier === 'loading' ? null : NOTE_LIMITS[userTier];


    return (
        <div className={`flex h-screen overflow-hidden ${containerClass} font-sans`}>
            <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} userName={userName} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />

            <main className={`flex-1 flex overflow-hidden transition-all duration-300 ${ isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64' }`}>

                 {/* === 1. Main Content Area (Left/Center) === */}
                 <div ref={!showSideBySideChat ? contentRef : null} className={`flex-1 ${mainContentBg} relative ${showSideBySideChat ? 'overflow-hidden' : 'overflow-y-auto'}`}>

                     {/* --- Mobile Header (Only when notes list overlay is hidden) --- */}
                     {isMobile && !showNotesListOnMobile && !showSideBySideChat && (
                          <div className={`sticky top-0 z-20 p-2 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-white/80 backdrop-blur-sm' : 'bg-gray-900/80 backdrop-blur-sm'} flex items-center justify-between`}>
                             <button onClick={() => setShowNotesListOnMobile(true)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Notes"> <List className="w-4 h-4" /> </button>
                             <span className={`text-sm font-medium truncate px-2 ${headingClass}`}> {isEditing ? 'Editing Note' : selectedNote?.title || 'Note'} </span>
                             {/* Action buttons */}
                             <div className="w-8 h-8 flex items-center justify-center">
                                 {selectedNote && !isEditing && !showPdfViewer && !showSplitView && ( <button onClick={handleEditNote} className={`p-1.5 rounded-md ${iconHoverColor} ${iconActionHoverBg}`} title="Edit note"> <Edit2 className="w-4 h-4" /> </button> )}
                                 {isEditing && ( <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`p-1.5 rounded-md ${buttonPrimaryClass} ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`} title="Save Changes"> {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} </button> )}
                             </div>
                         </div>
                    )}

                     {/* --- Dynamic Content Rendering --- */}
                     {showSplitView && splitViewNotes.left && splitViewNotes.right ? (
                         <SplitView leftNote={splitViewNotes.left} rightNote={splitViewNotes.right} onClose={closeSplitView} onTogglePublic={handleTogglePublic} onDelete={handleDeleteNote} onChat={handleChatWithNote} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} />
                     ) : showSideBySideChat ? (
                         // PDF Viewer + Inline Chat Side-by-Side
                         <div className="flex flex-row h-full overflow-hidden">
                              {/* PDF Viewer Section */}
                             <div className="flex flex-col overflow-hidden relative border-r border-gray-200 dark:border-gray-700" style={{ width: `${pdfChatSplitRatio}%` }}>
                                  {/* PDF Controls Header */}
                                  <div className={`flex-shrink-0 p-1.5 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-800/50'} flex items-center justify-between gap-1 sticky top-0 z-10`}>
                                      <div className="flex items-center gap-1">
                                          <button onClick={() => togglePdfViewer(false)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Note Content Only"> <FileText className="w-4 h-4" /> </button>
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
                                      Highlight PDF text for Explain/Chat options.
                                  </p>
                                 {/* PDF Document Area */}
                                 <div ref={pdfViewerContainerRef} onMouseUp={handlePdfTextSelection} className={`flex-1 overflow-auto relative ${isIlluminateEnabled ? 'bg-gray-100' : 'bg-gray-800/30'}`} >
                                     {pdfError ? (
                                        <div className="p-6 text-center text-red-500 flex flex-col items-center justify-center h-full"> <AlertTriangle className="w-10 h-10 mb-3" /> <p className="text-sm font-medium">Error Loading PDF</p> <p className="text-xs mt-1">{pdfError}</p> </div>
                                     ) : selectedNote?.sourceUrl ? ( // Ensure sourceUrl exists before rendering Document
                                        <Document file={selectedNote.sourceUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={<div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>} className="flex flex-col items-center pdf-document pt-4 pb-8" >
                                            {numPages === null && !pdfError ? ( <div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> ) : numPages && (
                                                 Array.from(new Array(numPages), (el, index) => (
                                                    <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={pdfScale} rotate={pdfRotation} renderAnnotationLayer={true} renderTextLayer={true} className="mb-2 shadow-md" loading={<div className="h-64 flex items-center justify-center text-xs">Loading page {index + 1}...</div>} />
                                                ))
                                            )}
                                        </Document>
                                     ) : (
                                         <div className="p-6 text-center text-gray-500">PDF source missing.</div> // Handle missing sourceUrl case
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
                                 {selectedNote && geminiApiKey && user && ( // Added user check
                                    <NoteChat
                                        ref={noteChatRef}
                                        key={`chat-${selectedNote.id}`} // Ensure key change on note switch
                                        note={selectedNote}
                                        onClose={() => togglePdfViewer(false)} // Action when chat closes itself (if applicable)
                                        geminiApiKey={geminiApiKey}
                                        userName={userName}
                                        isIlluminateEnabled={isIlluminateEnabled}
                                        isBlackoutEnabled={isBlackoutEnabled}
                                        isVisible={true} // Always visible in this layout
                                        onUpdateNoteContent={handleUpdateNoteContentFromChat}
                                        onAddImageToNoteRequest={handleAddImageToNoteRequest}
                                        displayMode="inline"
                                     />
                                 )}
                             </div>
                         </div>

                     ) : (
                         // Default View: Single Note, Edit, Split Placeholder, or Initial
                         <div className={`p-0 md:p-6 lg:p-8 h-full ${isEditing ? 'flex flex-col' : ''} ${showSideBySideChat ? 'hidden': ''}`}>
                            {showSplitView && (!splitViewNotes.left || !splitViewNotes.right) ? (
                                 <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <SplitSquareVertical className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>Compare Notes</h2> <p className={`${subheadingClass} text-sm mb-4`}>Select {splitViewNotes.left ? 'one more note' : 'two notes'} from the list.</p> <p className={`text-xs ${subheadingClass} mb-4`}>Selected: {splitViewNotes.left ? 1 : 0}/2</p> <button onClick={closeSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Cancel Comparison</button> </div>
                            ) : selectedNote ? (
                                isEditing ? (
                                    // Edit Mode
                                    <div className={`${noteViewBg} rounded-lg p-4 md:p-6 flex flex-col h-full overflow-hidden`}>
                                         {/* Edit Header */}
                                         <div className="space-y-3 flex-shrink-0">
                                              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} text-xl font-semibold rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${placeholderColor}`} placeholder="Note title..." />
                                              <div className="flex flex-wrap items-center gap-2"> {editTags.map((tag) => ( <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {tag} <button onClick={() => handleRemoveTag(tag)} className={`${iconHoverColor} rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5`} title={`Remove tag "${tag}"`}> <X className="w-2.5 h-2.5" /> </button> </span> ))} {editTags.length < 5 && ( <div className="flex items-center gap-1"> <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder="Add tag..." className={`${inputBg} ${inputTextColor} ${placeholderColor} rounded-full px-2.5 py-0.5 text-xs focus:outline-none focus:ring-1 w-24`} /> <button onClick={handleAddTag} className={`${buttonSecondaryClass} px-2 py-0.5 rounded-full text-xs`}>Add</button> </div> )} </div>
                                         </div>

                                         {/* Main Edit Area Container (Scrollable) */}
                                         <div className="flex-1 mt-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 pr-2">
                                             {/* MDEditor */}
                                             <div className="mb-4" data-color-mode={isIlluminateEnabled ? 'light' : 'dark'}>
                                                  {/* @ts-ignore because MDEditor types might have specific issues */}
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
                                             {/* Image Generation Button */}
                                             {geminiApiKey && (userTier === 'pro' || userTier === 'premium') ? (
                                                <button
                                                     onClick={() => { setShowImageGenModal(true); setImageGenError(null); setImageGenPrompt('');}}
                                                     className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}
                                                     title="Generate Image and add to Note"
                                                     disabled={isGeneratingImage}
                                                >
                                                     <ImagePlus className="w-4 h-4" /> Generate Image
                                                 </button>
                                             ) : ( // Show disabled/info state
                                                  <div className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ${buttonSecondaryClass} ${buttonDisabledClass}`} title={!geminiApiKey ? "API Key required" : "Image Gen (Pro/Premium only)"}>
                                                      <ImagePlus className="w-4 h-4" />
                                                      <span>Generate Image</span>
                                                      {!geminiApiKey ? null : <Info className="w-3 h-3"/>}
                                                  </div>
                                              )}
                                             {/* Save/Cancel Buttons */}
                                             <div className="flex gap-2">
                                                 <button onClick={handleCancelEdit} className={`${buttonSecondaryClass} px-4 py-1.5 rounded-md text-sm`}>Cancel</button>
                                                 <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`}> {isSaving ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Saving... </>) : (<> <Save className="w-4 h-4" /> Save </>)} </button>
                                             </div>
                                         </div>
                                     </div>
                                ) : (
                                    // View Mode
                                    <div className={`${noteViewBg} rounded-lg flex flex-col overflow-hidden h-full p-4 md:p-6 lg:p-8 animate-fadeIn`}>
                                        {/* View Header */}
                                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 flex-shrink-0`}>
                                            <h2 className={`text-xl md:text-2xl font-semibold ${headingClass} break-words mr-auto`}>{selectedNote.title || "Untitled Note"}</h2>
                                             {/* Action Buttons Group */}
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
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm, remarkMath]}
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={{
                                                        img: ({node, ...props}) => <img className="max-w-full h-auto rounded-md my-4 shadow-sm" {...props} alt={props.alt || 'Note image'}/>,
                                                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                                                        // Ensure basic elements render correctly
                                                         p: ({node, ...props}) => <p className="mb-2" {...props} />,
                                                         ul: ({node, ...props}) => <ul className="list-disc list-outside my-2 ml-4" {...props} />,
                                                         ol: ({node, ...props}) => <ol className="list-decimal list-outside my-2 ml-4" {...props} />,
                                                         li: ({node, ...props}) => <li className="mb-1" {...props} />,
                                                         blockquote: ({node, ...props}) => <blockquote className={`pl-3 italic text-sm my-2 border-l-4 ${isIlluminateEnabled ? 'border-gray-300 bg-gray-50' : 'border-gray-600 bg-gray-800/30'} p-2 rounded-r-md`} {...props} />,
                                                    }}
                                                >
                                                    {selectedNote.content || ''}
                                                </ReactMarkdown>
                                            </div>
                                            {/* Key Points */}
                                            {selectedNote.keyPoints && selectedNote.keyPoints.length > 0 && (
                                                <div className={`mt-6 border-t pt-4 ${borderColor}`}>
                                                    <h3 className={`text-base font-semibold mb-3 flex items-center gap-1.5 ${headingClass}`}><Sparkles className={`w-4 h-4 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} /> Key Points</h3>
                                                    <ul className={`list-none p-0 m-0 space-y-2`}>
                                                        {selectedNote.keyPoints.map((point, index) => (
                                                            <li key={index} className={`flex items-start gap-2 text-sm ${subheadingClass}`}>
                                                                <Sparkles className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} />
                                                                <span>{point}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {/* Flashcards */}
                                            {selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
                                                <div className={`mt-6 border-t pt-4 ${borderColor}`}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h3 className={`text-base font-semibold flex items-center gap-1.5 ${headingClass}`}><Layers className={`w-4 h-4 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} /> Flashcards ({selectedNote.flashcards.length})</h3>
                                                        <button onClick={handleStudyFlashcards} className={`${buttonSecondaryClass} px-3 py-1 rounded-md text-xs flex items-center gap-1`}> <BookOpen className="w-3.5 h-3.5" /> Study </button>
                                                    </div>
                                                    <p className={`text-xs ${subheadingClass}`}>Flashcards generated from this note. Click 'Study' to review them.</p>
                                                </div>
                                            )}
                                            {/* Study Questions */}
                                            {selectedNote.questions && selectedNote.questions.length > 0 && (
                                                <div className={`mt-6 border-t pt-4 ${borderColor}`}>
                                                     <div className="flex justify-between items-center mb-3">
                                                        <h3 className={`text-base font-semibold flex items-center gap-1.5 ${headingClass}`}><FileQuestion className={`w-4 h-4 ${isIlluminateEnabled ? 'text-blue-600' : 'text-blue-400'}`} /> Study Questions</h3>
                                                        <button onClick={handleRegenerateQuestions} disabled={isRegeneratingQuestions || !geminiApiKey} className={`${buttonSecondaryClass} px-3 py-1 rounded-md text-xs flex items-center gap-1 ${isRegeneratingQuestions || !geminiApiKey ? buttonDisabledClass : ''}`} title={!geminiApiKey ? "API Key required" : "Regenerate Questions"}>
                                                            {isRegeneratingQuestions ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
                                                            <span className="ml-1">{isRegeneratingQuestions ? 'Regenerating...' : 'Regenerate'}</span>
                                                         </button>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {selectedNote.questions.map((q, index) => {
                                                            const questionKey = `${selectedNote.id}_q${index}`; // Unique key for answer state
                                                            const selectedAnswer = questionAnswers[questionKey];
                                                            const isAnswered = selectedAnswer !== null && selectedAnswer !== undefined;
                                                            const isCorrect = isAnswered && selectedAnswer === q.correctAnswer;

                                                            return (
                                                                <div key={questionKey} className={`p-3 rounded-md border ${isAnswered ? (isCorrect ? (isIlluminateEnabled ? 'bg-green-50 border-green-200' : 'bg-green-900/30 border-green-700/50') : (isIlluminateEnabled ? 'bg-red-50 border-red-200' : 'bg-red-900/30 border-red-700/50')) : (isIlluminateEnabled ? 'bg-gray-50/50 border-gray-200' : 'bg-gray-800/40 border-gray-700/50')}`}>
                                                                    <p className={`text-sm font-medium mb-2 ${headingClass}`}>{index + 1}. {q.question}</p>
                                                                    <div className="space-y-1.5">
                                                                        {q.options.map((option, optIndex) => {
                                                                            let optionStyle = isIlluminateEnabled ? 'bg-white hover:bg-gray-100 border-gray-300' : 'bg-gray-700 hover:bg-gray-600 border-gray-600';
                                                                            let textStyle = subheadingClass;
                                                                            if (isAnswered) {
                                                                                 if (optIndex === q.correctAnswer) {
                                                                                     optionStyle = isIlluminateEnabled ? '!bg-green-100 border-green-400 ring-1 ring-green-400' : '!bg-green-800/50 border-green-600 ring-1 ring-green-600';
                                                                                     textStyle = isIlluminateEnabled ? 'text-green-800 font-medium' : 'text-green-200 font-medium';
                                                                                 } else if (optIndex === selectedAnswer) {
                                                                                     optionStyle = isIlluminateEnabled ? '!bg-red-100 border-red-400 ring-1 ring-red-400' : '!bg-red-800/50 border-red-600 ring-1 ring-red-600';
                                                                                     textStyle = isIlluminateEnabled ? 'text-red-800 font-medium' : 'text-red-200 font-medium';
                                                                                 } else {
                                                                                     optionStyle += ' opacity-70'; // Dim unselected
                                                                                }
                                                                             }

                                                                            return (
                                                                                <button
                                                                                    key={optIndex}
                                                                                    onClick={() => !isAnswered && handleAnswerSelect(questionKey, optIndex)}
                                                                                    disabled={isAnswered}
                                                                                    className={`w-full text-left text-xs px-3 py-1.5 rounded border transition-colors ${optionStyle} ${!isAnswered ? 'cursor-pointer' : 'cursor-default'}`}
                                                                                >
                                                                                    <span className={textStyle}>{option}</span>
                                                                                 </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    {isAnswered && (
                                                                        <div className={`mt-2 p-2 rounded text-xs ${isCorrect ? (isIlluminateEnabled ? 'bg-green-100/70 text-green-700' : 'bg-green-900/50 text-green-300') : (isIlluminateEnabled ? 'bg-red-100/70 text-red-700' : 'bg-red-900/50 text-red-300')}`}>
                                                                             <span className="font-semibold">{isCorrect ? 'Correct!' : 'Incorrect.'}</span> {q.explanation}
                                                                         </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ) : (
                                // Initial Placeholder / No Note Selected
                                <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <FileText className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>No Note Selected</h2> <p className={`${subheadingClass} max-w-xs text-sm mb-4`}>Select a note from the list, or create a new one.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 mb-2`}> <Plus className="w-4 h-4" /> Create Note </button> {!isMobile && notes.length >= 2 && !showSplitView && ( <button onClick={startSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <SplitSquareVertical className="w-4 h-4" /> Compare Notes </button> )} </div>
                            )}
                         </div>
                     )}
                </div> {/* End Main Content Area */}

                 {/* === 2. Notes List Sidebar (Right Side) === */}
                 {!isMobile && !isNotesListHidden && (
                     <div className={`
                        w-full md:w-72 lg:w-80 xl:w-96 border-l ${borderColor} flex-shrink-0 flex flex-col ${notesListBg}
                        transition-transform duration-300 ease-in-out relative h-full z-10 order-last
                    `}>
                         {/* Header */}
                         <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
                             <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}> <FileText className={`w-5 h-5 ${iconActionColor}`} /> Notes </h2>
                             <div className="flex items-center gap-1">
                                <button onClick={handleToggleNotesList} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title="Hide Notes List">
                                     <PanelLeftClose className="w-4 h-4 transform scale-x-[-1]" /> {/* Icon visually points left */}
                                </button>
                                {notes.length >= 2 && !showPdfViewer && ( <button onClick={showSplitView ? closeSplitView : startSplitView} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title={showSplitView ? "Close Comparison" : "Compare Notes"}> <SplitSquareVertical className={`w-4 h-4 ${showSplitView ? iconActionColor: ''}`} /> </button> )}
                                <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} p-2 rounded-full hover:shadow-md transition-all duration-150`} title="New Note"> <Plus className="w-4 h-4" /> </button>
                             </div>
                         </div>
                        {/* Search/Filter */}
                        <div className={`p-3 border-b ${borderColor} flex-shrink-0`}>
                             <div className="relative mb-2"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${iconColor}`} /> <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 ${placeholderColor}`} /> </div>
                             <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div>
                        </div>
                        {/* Usage Info */}
                        {userTier !== 'premium' && userTier !== 'loading' && currentLimits && (
                           <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}>
                                 <div className="flex justify-between items-center gap-2">
                                     <span>PDF/AI: {noteUsage.pdfAi}/{currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span>
                                     <span>YT: {noteUsage.youtube}/{currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span>
                                 </div>
                            </div>
                        )}
                        {/* Notes List Items */}
                        <div className="flex-1 overflow-y-auto">
                            {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div> )
                            : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> )
                            : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; case 'audio': typeIcon = <Mic className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>Left</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>Right</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{(note.content || '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type] || tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                        </div>
                    </div>
                 )}

                 {/* Notes List Toggle Button (when hidden on desktop - Right Side) */}
                 {!isMobile && isNotesListHidden && (
                    <button
                        onClick={handleToggleNotesList}
                        className={`fixed right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-l-md shadow-lg transition-all duration-300 ${buttonSecondaryClass} hover:brightness-110`}
                        title="Show Notes List"
                    >
                        <PanelRightClose className="w-5 h-5 transform scale-x-[-1]" /> {/* Icon visually points right */}
                    </button>
                 )}

                 {/* === 3. Mobile Notes List Overlay (Slides from Right) === */}
                 {isMobile && (
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
                                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div>
                            </div>
                             {/* Usage Info */}
                            {userTier !== 'premium' && userTier !== 'loading' && currentLimits && (
                                <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}>
                                    <div className="flex justify-between items-center gap-2">
                                        <span>PDF/AI: {noteUsage.pdfAi}/{currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span>
                                        <span>YT: {noteUsage.youtube}/{currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span>
                                    </div>
                                </div>
                            )}
                            {/* Notes List Items */}
                            <div className="flex-1 overflow-y-auto">
                                {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div> )
                                : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> )
                                : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; case 'audio': typeIcon = <Mic className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg.replace('border-r-2', 'border-l-2') : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>Left</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>Right</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{(note.content || '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type] || tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                            </div>
                         </div>
                     </div>
                 )}

            </main> {/* End Main Flex Container */}

            {/* Modals & Overlays */}
            {showNewNoteModal && ( <NewNoteModal onClose={() => { setShowNewNoteModal(false); setUploadProgress({ progress: 0, status: '', error: null }); }} onCreatePersonalNote={handleCreatePersonalNote} onCreateAINote={handleCreateAINote} onUploadPDF={handlePDFUpload} onYoutubeLink={handleYoutubeLink} uploadProgress={uploadProgress} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} /> )}

            {selectedNote && selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
                <FlashcardStudyModal
                    isOpen={showFlashcardStudyModal}
                    onClose={() => setShowFlashcardStudyModal(false)}
                    flashcards={selectedNote.flashcards}
                    isIlluminateEnabled={isIlluminateEnabled}
                 />
            )}

            <SimpleModal
                isOpen={showImageGenModal}
                onClose={() => { setShowImageGenModal(false); setIsGeneratingImage(false); setImageGenPrompt(''); setImageGenError(null);}}
                title="Generate Image for Note"
                isIlluminateEnabled={isIlluminateEnabled}
            >
                <div className="space-y-3">
                    <p className={`${subheadingClass} text-sm`}>Enter a description for the image. It will be added to the end of your current note content. (Available for Pro/Premium users)</p>
                    <textarea
                        value={imageGenPrompt}
                        onChange={(e) => setImageGenPrompt(e.target.value)}
                        placeholder="e.g., A photorealistic image of a futuristic cityscape at sunset..."
                        rows={3}
                        className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-y`}
                        disabled={isGeneratingImage || (userTier !== 'pro' && userTier !== 'premium')}
                    />
                    {imageGenError && <p className="text-xs text-red-500">{imageGenError}</p>}
                    <div className="flex justify-end">
                        <button
                            onClick={handleGenerateImageForNote}
                            disabled={isGeneratingImage || !imageGenPrompt.trim() || (userTier !== 'pro' && userTier !== 'premium')}
                            className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isGeneratingImage || !imageGenPrompt.trim() || (userTier !== 'pro' && userTier !== 'premium') ? buttonDisabledClass : ''}`}
                        >
                            {isGeneratingImage ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Generating... </>) : (<> Generate & Add </>)}
                        </button>
                    </div>
                </div>
            </SimpleModal>

            {/* Chat Overlay */}
            {chatNoteForOverlay && user && geminiApiKey && (
                 <NoteChat
                     key={`chat-overlay-${chatNoteForOverlay.id}`} // Ensure re-mount on note change
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

             {/* Mobile Floating Button (Show Notes - Right Side) */}
             {isMobile && !showNotesListOnMobile && (
                 <button
                     onClick={() => setShowNotesListOnMobile(true)}
                     className={`fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg transition-all duration-300 ${buttonPrimaryClass} transform hover:scale-110 active:scale-100 ${isChatOverlayVisible ? 'bottom-16' : 'bottom-4'}`} // Adjust bottom if chat is visible
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
