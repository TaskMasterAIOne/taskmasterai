
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
    Image as ImageIcon, Layers, ImagePlus,
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
import { processPDF, ProcessedPDF } from '../lib/pdf-processor'; // Import ProcessedPDF type
import { processYouTube } from '../lib/youtube-processor'; // Assuming ProcessedYouTube type is exported
import {
    saveNote, savePersonalNote, updateNote, processTextToAINoteData,
    deleteNote, toggleNotePublicStatus, regenerateStudyQuestions,
    getNoteById, // Import getNoteById
    NoteData as FirebaseNoteData, // Alias to avoid conflict if needed
    Flashcard
} from '../lib/notes-firebase';
import { NewNoteModal } from './NewNoteModal';
import { SplitView } from './SplitView';
import { NoteChat, NoteChatHandle, ImageData } from './NoteChat';
import { geminiApiKey, generateImageWithImagen } from '../lib/dashboard-firebase'; // Assuming generateImageWithImagen is here

import {
    UserTier,
    getUserTier as determineUserTierFromEmail, // Renamed to avoid conflict with state var
    getUserNoteUsage,
    updateUserNoteUsage,
    NOTE_LIMITS
} from '../lib/current-paying-user';


import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import MDEditor from '@uiw/react-md-editor';
import { FlashcardStudyModal } from './FlashcardStudyModal';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Note {
    id: string; title: string; content: string; type: 'personal' | 'pdf' | 'youtube' | 'audio';
    createdAt: Timestamp; updatedAt: Timestamp; userId: string; sourceUrl?: string;
    keyPoints?: string[]; questions?: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    isPublic: boolean; tags: string[];
    flashcards?: Flashcard[];
}
interface UploadProgressState { progress: number; status: string; error: string | null; }
interface NoteUsage { pdfAi: number; youtube: number; }


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
    const [isNotesListHidden, setIsNotesListHidden] = useState(false);
    const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
    const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
    const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'true'));
    const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));

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

    const [showNotesListOnMobile, setShowNotesListOnMobile] = useState(true);
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
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfChatSplitRatio, setPdfChatSplitRatio] = useState(65);
    const [isResizingPdfChatSplit, setIsResizingPdfChatSplit] = useState(false);

    const [selectedPdfText, setSelectedPdfText] = useState<string | null>(null);
    const [highlightButtonPosition, setHighlightButtonPosition] = useState<{ top: number; left: number } | null>(null);
    const [showHighlightButtons, setShowHighlightButtons] = useState(false);

    const [showImageGenModal, setShowImageGenModal] = useState(false);
    const [imageGenPrompt, setImageGenPrompt] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imageGenError, setImageGenError] = useState<string | null>(null);


    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setShowNotesListOnMobile(true);
                setIsNotesListHidden(showPdfViewer);
            } else {
                setShowNotesListOnMobile(!(selectedNote || isEditing || showPdfViewer || (showSplitView && (splitViewNotes.left || splitViewNotes.right))));
            }
            setIsResizingPdfChatSplit(false);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
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

                let resolvedTier: UserTier = 'basic';
                try {
                    // Using determineUserTierFromEmail from current-paying-user.ts
                    resolvedTier = determineUserTierFromEmail(firebaseUser.email);
                    setUserTier(resolvedTier);
                } catch (error) {
                    console.error("Notes: Error fetching user tier:", error);
                    setUserTier('basic'); // Fallback
                }

                if (resolvedTier !== 'premium') {
                    try {
                        const currentMonthYear = new Date().toISOString().slice(0, 7);
                        // Assuming getUserNoteUsage is from current-paying-user.ts
                        const usageData = await getUserNoteUsage(firebaseUser.uid);

                        if (usageData?.month === currentMonthYear) {
                            setNoteUsage({ pdfAi: usageData.pdfAi || 0, youtube: usageData.youtube || 0 });
                            setUsageMonth(currentMonthYear);
                        } else {
                            setNoteUsage({ pdfAi: 0, youtube: 0 });
                            setUsageMonth(currentMonthYear);
                            // Assuming updateUserNoteUsage is from current-paying-user.ts
                            await updateUserNoteUsage(firebaseUser.uid, { pdfAi: 0, youtube: 0 }, currentMonthYear);
                        }
                    } catch (err) {
                        console.error("Error loading/updating note usage data:", err);
                        setNoteUsage({ pdfAi: 0, youtube: 0 }); // Default on error
                        setUsageMonth(new Date().toISOString().slice(0, 7));
                    }
                } else { // Premium users have "unlimited" usage
                    setNoteUsage({ pdfAi: Infinity, youtube: Infinity });
                    setUsageMonth('');
                }
            } else {
                setUser(null);
                setUserName("User");
                setNotes([]);
                setSelectedNote(null);
                setShowPdfViewer(false);
                setIsEditing(false);
                setSplitViewNotes({ left: null, right: null });
                setShowSplitView(false);
                setIsChatOverlayVisible(false);
                setChatNoteForOverlay(null);
                setUserTier('loading');
                setNoteUsage({ pdfAi: 0, youtube: 0 });
                setUsageMonth('');
                setIsNotesListHidden(false);
                setIsSidebarCollapsed(false);
                setShowFlashcardStudyModal(false);
                setShowImageGenModal(false);
                setImageGenPrompt('');
                setImageGenError(null);
                setIsGeneratingImage(false);
                navigate('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (!user?.uid) {
            setNotes([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(collection(db, 'notes'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesList: Note[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(notesList);

            setSelectedNote(prevSelectedNote => {
                if (!prevSelectedNote) return null;
                const updatedNoteData = notesList.find(n => n.id === prevSelectedNote.id);
                if (!updatedNoteData) return null; // Note was deleted
                // Basic check for changes to avoid unnecessary re-renders if only updatedAt changed
                if (JSON.stringify(prevSelectedNote.content) !== JSON.stringify(updatedNoteData.content) ||
                    JSON.stringify(prevSelectedNote.title) !== JSON.stringify(updatedNoteData.title) ||
                    JSON.stringify(prevSelectedNote.keyPoints) !== JSON.stringify(updatedNoteData.keyPoints) ||
                    JSON.stringify(prevSelectedNote.questions) !== JSON.stringify(updatedNoteData.questions) ||
                    JSON.stringify(prevSelectedNote.tags) !== JSON.stringify(updatedNoteData.tags) ||
                    prevSelectedNote.isPublic !== updatedNoteData.isPublic
                ) {
                    return updatedNoteData;
                }
                return prevSelectedNote; // No significant change detected
            });

            setChatNoteForOverlay(prevChatNote => {
                if (!prevChatNote) return null;
                const updatedChatNoteData = notesList.find(n => n.id === prevChatNote.id);
                if (!updatedChatNoteData) return null;
                if (JSON.stringify(prevChatNote) !== JSON.stringify(updatedChatNoteData)) { // Simple check
                   return updatedChatNoteData;
                }
                return prevChatNote;
            });

            if (showSplitView) {
                 setSplitViewNotes(prevSplitNotes => {
                    const currentLeftId = prevSplitNotes.left?.id;
                    const currentRightId = prevSplitNotes.right?.id;
                    const updatedLeft = currentLeftId ? notesList.find(n => n.id === currentLeftId) : null;
                    const updatedRight = currentRightId ? notesList.find(n => n.id === currentRightId) : null;
                     // Check if either note was updated or removed
                     if ( (prevSplitNotes.left && JSON.stringify(prevSplitNotes.left) !== JSON.stringify(updatedLeft)) ||
                          (prevSplitNotes.right && JSON.stringify(prevSplitNotes.right) !== JSON.stringify(updatedRight)) ||
                          (!prevSplitNotes.left && updatedLeft) || (!prevSplitNotes.right && updatedRight) // one was added
                        ) {
                         return { left: updatedLeft || null, right: updatedRight || null };
                     }
                     return prevSplitNotes;
                 });
             }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching notes:", error);
            setLoading(false);
            setUploadProgress({ progress: 0, status: '', error: 'Could not load notes.' });
        });
        return () => unsubscribe();
    }, [user?.uid, showSplitView]);


    useEffect(() => {
        if (!showPdfViewer && contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [selectedNote?.id, showPdfViewer]);

    useEffect(() => {
        if (!showPdfViewer) {
            setNumPages(null);
            setPdfError(null);
            setPdfScale(1.0);
            setPdfRotation(0);
            setCurrentPage(1);
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            setHighlightButtonPosition(null);
            window.getSelection()?.removeAllRanges();
        }
    }, [showPdfViewer]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showHighlightButtons && highlightButtonPosition) {
                const target = event.target as Element;
                if (!target.closest('.highlight-buttons-container') && !target.closest('.react-pdf__Page__textContent')) {
                    setShowHighlightButtons(false);
                    setSelectedPdfText(null);
                    setHighlightButtonPosition(null);
                    window.getSelection()?.removeAllRanges();
                }
            }
        };
        if (showPdfViewer) {
             document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHighlightButtons, highlightButtonPosition, showPdfViewer]);

    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingPdfChatSplit || !pdfViewerContainerRef.current) return;
        const pdfSection = pdfViewerContainerRef.current.parentElement;
        const mainContentArea = pdfSection?.parentElement;
        if (mainContentArea && pdfSection) {
            const bounds = mainContentArea.getBoundingClientRect();
            const newPdfWidth = e.clientX - bounds.left;
            const totalWidth = bounds.width;
            const resizerWidth = 6; // Assuming this is the width of your resizer element

            let newRatio = (newPdfWidth / (totalWidth - resizerWidth)) * 100;
            newRatio = Math.max(20, Math.min(80, newRatio)); // Clamp between 20% and 80%
            setPdfChatSplitRatio(newRatio);
        }
    }, [isResizingPdfChatSplit]);

    const handleResizeMouseUp = useCallback(() => {
         if (isResizingPdfChatSplit) {
             setIsResizingPdfChatSplit(false);
             // Clean up event listeners attached to document
             document.removeEventListener('mousemove', handleResizeMouseMove);
             document.removeEventListener('mouseup', handleResizeMouseUp);
             document.body.style.cursor = 'default';
             document.body.style.userSelect = 'auto';
         }
    }, [isResizingPdfChatSplit, handleResizeMouseMove]); // Added handleResizeMouseMove as a dependency

    const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault(); // Prevent text selection during drag
        setIsResizingPdfChatSplit(true);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection on the body
    }, [handleResizeMouseMove, handleResizeMouseUp]);

    // Effect to clean up global listeners if component unmounts while resizing
    useEffect(() => {
        const currentMouseMove = handleResizeMouseMove; // Capture current refs for cleanup
        const currentMouseUp = handleResizeMouseUp;
        return () => {
            document.removeEventListener('mousemove', currentMouseMove);
            document.removeEventListener('mouseup', currentMouseUp);
            // Reset body styles if unmounting during resize
            if (isResizingPdfChatSplit) {
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        };
    }, [handleResizeMouseMove, handleResizeMouseUp, isResizingPdfChatSplit]);


    const checkNoteLimit = (noteType: 'pdfAi' | 'youtube'): boolean => {
        if (userTier === 'loading') {
            setUploadProgress({ progress: 0, status: '', error: 'Verifying account status...' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return false;
        }
        if (userTier === 'premium') return true;

        const limits = NOTE_LIMITS[userTier];
        const currentCount = noteUsage[noteType];
        const limit = limits[noteType];

        if (currentCount >= limit) {
            const typeName = noteType === 'pdfAi' ? 'PDF/AI Text Note' : 'YouTube Note';
            setUploadProgress({ progress: 0, status: '', error: `Monthly ${typeName} limit (${limit}) reached for ${userTier} plan.` });
             setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 4000);
            return false;
        }
        return true;
    };

    const incrementNoteUsage = async (noteType: 'pdfAi' | 'youtube') => {
        if (!user?.uid || userTier === 'premium') return;

        const currentMonthYear = new Date().toISOString().slice(0, 7);
        const newUsage = { ...noteUsage };
        newUsage[noteType]++;
        setNoteUsage(newUsage);
        setUsageMonth(currentMonthYear);

        try {
            // Assuming updateUserNoteUsage is from current-paying-user.ts
            await updateUserNoteUsage(user.uid, newUsage, currentMonthYear);
        } catch (error) {
            console.error(`Failed to update ${noteType} usage count:`, error);
            // Optionally revert local state or show an error
        }
    };

    const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
    const handleToggleNotesList = useCallback(() => setIsNotesListHidden(prev => !prev), []);

    const togglePdfViewer = useCallback((forceOpen?: boolean) => {
        const turnOn = forceOpen !== undefined ? forceOpen : !showPdfViewer;
        if (turnOn) {
            if (selectedNote?.type === 'pdf' && selectedNote.sourceUrl) {
                setShowPdfViewer(true);
                setCurrentPage(1);
                setPdfScale(1.0);
                setPdfRotation(0);
                setShowHighlightButtons(false);
                setSelectedPdfText(null);
                setHighlightButtonPosition(null);

                if (isChatOverlayVisible && chatNoteForOverlay?.id === selectedNote.id) {
                    setIsChatOverlayVisible(false);
                    setChatNoteForOverlay(null);
                }
                if (!isMobile) setIsNotesListHidden(true);
            } else {
                console.warn("Cannot open PDF viewer: Selected note is not a PDF or source is missing.");
                setUploadProgress({ progress: 0, status: '', error: 'Cannot view PDF: Note type is not PDF or source is missing.' });
                setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
                if (showPdfViewer) setShowPdfViewer(false); // Ensure it's closed if it was open
                if (!isMobile && isNotesListHidden) setIsNotesListHidden(false); // Ensure list is shown if PDF viewer fails to open
            }
        } else {
            setShowPdfViewer(false);
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            window.getSelection()?.removeAllRanges(); // Clear any selection when closing PDF viewer
            if (!isMobile) setIsNotesListHidden(false);
        }
    }, [selectedNote, showPdfViewer, isChatOverlayVisible, chatNoteForOverlay?.id, isMobile, isNotesListHidden]);

    const switchToEditMode = useCallback((noteToEdit: Note | null) => {
        if (!noteToEdit) return;
        setEditTitle(noteToEdit.title);
        setEditContent(noteToEdit.content || '');
        setEditTags(noteToEdit.tags || []);
        setEditKeyPoints(noteToEdit.keyPoints || []);
        setEditFlashcards(noteToEdit.flashcards || []);
        setNewTag('');
        setIsEditing(true);
        setSelectedNote(noteToEdit); // Keep the note selected
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false); // Close PDF viewer if open
        setShowFlashcardStudyModal(false);
        if (showSplitView) setShowSplitView(false);
        if (isMobile) setShowNotesListOnMobile(false);
        if (!isMobile) setIsNotesListHidden(false); // Ensure notes list is visible on desktop
    }, [isChatOverlayVisible, showPdfViewer, togglePdfViewer, showSplitView, isMobile]);

    const handleSplitViewSelect = useCallback((note: Note) => {
        if (!splitViewNotes.left) {
            setSplitViewNotes({ ...splitViewNotes, left: note });
        } else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
            setSplitViewNotes({ ...splitViewNotes, right: note });
            if (isMobile) {
                setShowNotesListOnMobile(false); // Hide list once two notes are selected for split view on mobile
            }
        }
        // Clear other views that conflict with split view
        setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
    }, [splitViewNotes, isMobile, showPdfViewer, togglePdfViewer]);

    const handleSelectNote = useCallback((note: Note) => {
        // If the same note is clicked again and we are not in edit/split mode, do nothing to avoid re-renders
        if (selectedNote?.id === note.id && !isEditing && !showSplitView) return;

        setIsEditing(false); // Always exit edit mode when selecting a new note (or re-selecting)
        setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        setQuestionAnswers({}); // Clear previous question answers
        setShowFlashcardStudyModal(false);

        if (showSplitView) {
             handleSplitViewSelect(note);
        } else {
            setSelectedNote(note);
            // If PDF viewer was open but the new note is not a PDF or has no source, close it.
            if (showPdfViewer && (note.type !== 'pdf' || !note.sourceUrl)) {
                 togglePdfViewer(false);
            }
            if (isMobile) {
                setShowNotesListOnMobile(false); // Hide list on mobile when a note is selected
            }
        }
    }, [selectedNote?.id, showSplitView, isMobile, showPdfViewer, togglePdfViewer, isEditing, handleSplitViewSelect]);

    const startSplitView = useCallback(() => {
        setShowSplitView(true);
        setSelectedNote(null); // Clear single selected note
        if (showPdfViewer) togglePdfViewer(false);
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setSplitViewNotes({ left: null, right: null });
        if (isMobile) setShowNotesListOnMobile(true); // Show list to select notes for split view on mobile
        if (!isMobile) setIsNotesListHidden(false); // Ensure notes list is visible
    }, [showPdfViewer, isChatOverlayVisible, isMobile, togglePdfViewer]);

    const closeSplitView = useCallback(() => {
        setShowSplitView(false);
        setSplitViewNotes({ left: null, right: null });
        // Optionally, select the first note in the list if available, or clear selection
        if (notes.length > 0 && !isMobile) {
            handleSelectNote(notes[0]); // Select first note
        } else {
            setSelectedNote(null); // Or clear selection
        }
        if (isMobile) setShowNotesListOnMobile(true); // Show list again on mobile after closing split view
        if (!isMobile) setIsNotesListHidden(false);
    }, [notes, isMobile, handleSelectNote]);

    const handleChatWithNote = useCallback((note: Note | null, keepPdfOpen: boolean = false) => {
        if (!note || !geminiApiKey) { // Ensure user is checked too if chat depends on auth
             console.warn("Cannot chat: Note is null, Gemini API key not available, or user not logged in.");
             setUploadProgress({progress: 0, status: '', error: 'Chat requires API key setup and login.'})
             setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
             return;
        }

        // If not in split view and the chat note is different from the selected note, update selectedNote
        if (!showSplitView && selectedNote?.id !== note.id) {
            setSelectedNote(note);
        }

        const isSideBySideChatShouldBeActive = note.type === 'pdf' && showPdfViewer && !!note.sourceUrl && !!user && !!geminiApiKey && !isMobile;

        if (isSideBySideChatShouldBeActive && keepPdfOpen) {
            // This means we are likely in PDF view and want to interact with the inline chat.
            setIsChatOverlayVisible(false); // Ensure overlay is hidden
            setChatNoteForOverlay(null); // Clear overlay note
            // Focus the inline chat; NoteChat.tsx might handle its own focus on visibility.
            noteChatRef.current?.focusInput?.();
        } else {
            // Open overlay chat for all other cases
            setChatNoteForOverlay(note);
            setIsChatOverlayVisible(true);
            if (showPdfViewer) { // If overlay is opening, always close PDF viewer
                togglePdfViewer(false);
            }
            if (isMobile) {
                setShowNotesListOnMobile(false); // Hide notes list on mobile for overlay chat
            }
            // Delay focus to allow modal to render
            setTimeout(() => noteChatRef.current?.focusInput?.(), 150);
        }
    }, [selectedNote?.id, showSplitView, showPdfViewer, isMobile, togglePdfViewer, geminiApiKey, user]);


    const handleCloseChatOverlay = useCallback(() => setIsChatOverlayVisible(false), []);

    const handleUpdateNoteContentFromChat = useCallback(async (noteId: string, newContent: string) => {
        if (!user || isSaving) return; // Check for user
        console.log("Updating note from chat:", noteId);
        setIsSaving(true);
        setUploadProgress({ progress: 0, status: 'Updating via chat...', error: null });
        try {
            await updateNote(noteId, { content: newContent, updatedAt: Timestamp.now() });
            setUploadProgress({ progress: 100, status: 'Updated via chat!', error: null });
            // The onSnapshot listener should update the selectedNote/chatNoteForOverlay if its content changes.
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error("Error updating note from chat:", error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to update note via chat.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        } finally {
            setIsSaving(false);
        }
    }, [user, isSaving]); // Added user as dependency

    const handleAddImageToNoteRequest = useCallback((imageData: ImageData) => {
        // Determine which note to target for adding the image
        const targetNote = isEditing ? selectedNote : (chatNoteForOverlay || selectedNote);

        if (!targetNote) {
            console.error("Cannot add image: No suitable note selected or in context.");
            setUploadProgress({ progress: 0, status: '', error: 'No note selected to add image to.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }

        const markdownImageTag = `\n\n![Generated Image](${`data:${imageData.type};base64,${imageData.base64}`})\n\n`;

        if (isEditing && selectedNote && selectedNote.id === targetNote.id) {
            // Already in edit mode for the target note
            setEditContent(prevContent => (prevContent || '') + markdownImageTag);
        } else {
            // Not in edit mode for the target note, or editing a different note
            // Switch to edit mode for the targetNote and append
            switchToEditMode(targetNote); // This will set selectedNote to targetNote
            // Use a timeout to ensure state update for editContent happens after switchToEditMode completes its state changes
            setTimeout(() => {
                setEditContent(prevContent => (prevContent || '') + markdownImageTag);
            }, 50); // Small delay
        }

        if (isChatOverlayVisible) handleCloseChatOverlay(); // Close chat overlay if it was open
        // If image gen modal was open, it's handled by its own close logic
    }, [selectedNote, isEditing, chatNoteForOverlay, switchToEditMode, isChatOverlayVisible, handleCloseChatOverlay]);

    const handleEditNote = useCallback(() => {
        if (!selectedNote) return;
        switchToEditMode(selectedNote);
    }, [selectedNote, switchToEditMode]);

    const handleSaveEdit = async () => {
        if (!selectedNote || !editTitle.trim() || isSaving) return;
        setIsSaving(true);
        setUploadProgress({ progress: 0, status: 'Saving...', error: null });
        try {
            const finalKeyPoints = editKeyPoints.map(p => p.trim()).filter(p => p.length > 0);
            const finalFlashcards = editFlashcards.filter(fc => fc.front.trim().length > 0 && fc.back.trim().length > 0);

            const updatedData: Partial<Omit<FirebaseNoteData, 'id'|'userId'|'createdAt'|'type'>> & { updatedAt: Timestamp } = {
                title: editTitle.trim(),
                content: (editContent || "").trim(),
                tags: editTags,
                keyPoints: finalKeyPoints.length > 0 ? finalKeyPoints : undefined, // Store undefined if empty
                flashcards: finalFlashcards.length > 0 ? finalFlashcards : undefined, // Store undefined if empty
                updatedAt: Timestamp.now()
            };
            await updateNote(selectedNote.id, updatedData);
            setIsEditing(false); // Exit edit mode
            // selectedNote will be updated by onSnapshot
            setUploadProgress({ progress: 100, status: 'Saved!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error saving note:', error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to save note' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = useCallback(async (noteId: string) => {
        if (!window.confirm('Are you sure you want to delete this note? This cannot be undone.')) return;
        setUploadProgress({ progress: 0, status: 'Deleting...', error: null });
        try {
            await deleteNote(noteId);
            // Note will be removed from `notes` state by onSnapshot.
            // Clear relevant states if the deleted note was active.
            if (selectedNote?.id === noteId) {
                 setSelectedNote(null);
                 setIsEditing(false);
                 if (showPdfViewer) togglePdfViewer(false);
            }
            if (chatNoteForOverlay?.id === noteId) {
                 handleCloseChatOverlay();
                 setChatNoteForOverlay(null);
            }
            if (splitViewNotes.left?.id === noteId || splitViewNotes.right?.id === noteId) {
                 const uLeft = splitViewNotes.left?.id === noteId ? null : splitViewNotes.left;
                 const uRight = splitViewNotes.right?.id === noteId ? null : splitViewNotes.right;
                 setSplitViewNotes({ left: uLeft, right: uRight });
                 if (showSplitView && !uLeft && !uRight) closeSplitView(); // Close split view if both notes are gone
                 else if (showSplitView && (!uLeft || !uRight) && isMobile) setShowNotesListOnMobile(true); // Show list if one remains
            }
            setShowFlashcardStudyModal(false); // Close if open for the deleted note
            setShowImageGenModal(false); // Close if open

            setUploadProgress({ progress: 100, status: 'Deleted!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error deleting note:', error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to delete note' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    }, [selectedNote?.id, showPdfViewer, chatNoteForOverlay?.id, splitViewNotes, showSplitView, isMobile, togglePdfViewer, handleCloseChatOverlay, closeSplitView]);

    const handleTogglePublic = async (noteId: string, currentIsPublic: boolean) => {
        setUploadProgress({ progress: 0, status: 'Updating visibility...', error: null });
        try {
            await toggleNotePublicStatus(noteId, !currentIsPublic);
            // Note's public status will be updated by onSnapshot.
            setUploadProgress({ progress: 100, status: 'Visibility updated!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
            if (currentIsPublic) setLinkCopied(false); // Reset copied status if made private
        } catch (error) {
            console.error('Error toggling public status:', error);
            setUploadProgress({ progress: 0, status: '', error: 'Failed to update note visibility' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    };

    const handleGetShareLink = (noteId: string) => {
        const shareUrl = `${window.location.origin}/public-note/${noteId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); })
            .catch(err => {
                console.error('Failed to copy share link:', err);
                setUploadProgress({ progress: 0, status: '', error: 'Could not copy link.' });
                setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            });
    };

    const handleCancelEdit = () => { setIsEditing(false); };

    const handleCreatePersonalNote = async (title: string, content: string, tags: string[]) => {
        if (!user) return;
        setUploadProgress({ progress: 0, status: 'Creating note...', error: null });
        try {
            const newNoteId = await savePersonalNote(user.uid, title, content, tags);
            const newNoteDoc = await getNoteById(newNoteId); // Fetch the full note data
            if (newNoteDoc) {
                // The onSnapshot listener will add it to `notes`, then this will select it.
                handleSelectNote({ ...newNoteDoc, id: newNoteId } as Note); // Cast FirebaseNoteData to Note
            }
            setUploadProgress({ progress: 100, status: 'Note created!', error: null });
            setShowNewNoteModal(false);
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error creating personal note:', error);
            setUploadProgress({ progress: 0, status: '', error: `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}` });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    };

    const handleCreateAINote = async (text: string) => {
        if (!user || !geminiApiKey) {
            setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }
        if (!checkNoteLimit('pdfAi')) return;
        setUploadProgress({ progress: 0, status: 'Processing text...', error: null });
        try {
            setUploadProgress(prev => ({ ...prev, progress: 20 }));
            // processTextToAINoteData expects (text, userId, apiKey)
            const aiNoteData = await processTextToAINoteData(text, user.uid, geminiApiKey);
            
            setUploadProgress(prev => ({ ...prev, progress: 80, status: 'Saving note...' }));
            // saveNote expects Omit<FirebaseNoteData, 'id'|'createdAt'|'updatedAt'>
            // aiNoteData from processTextToAINoteData already includes userId and matches this structure.
            const newNoteId = await saveNote(aiNoteData);
            await incrementNoteUsage('pdfAi');

            const newNoteDoc = await getNoteById(newNoteId);
            if (newNoteDoc) {
                handleSelectNote({ ...newNoteDoc, id: newNoteId } as Note);
            }
            
            setUploadProgress({ progress: 100, status: 'AI Note Created!', error: null });
            setShowNewNoteModal(false);
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error creating AI note:', error);
            setUploadProgress({ progress: 0, status: '', error: error instanceof Error ? error.message : 'Failed to create AI note' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    };

    const handlePDFUpload = async (file: File) => {
        if (!user || !geminiApiKey) {
            setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }
        if (!checkNoteLimit('pdfAi')) return;
        setUploadProgress({ progress: 0, status: 'Uploading PDF...', error: null });
        try {
            // processPDF returns: ProcessedPDF (includes title, content, keyPoints, questions, sourceUrl, extractedText)
            const processedData: ProcessedPDF = await processPDF( file, user.uid, geminiApiKey, (progressState) => setUploadProgress(progressState) );
            
            if (!processedData.extractedText || processedData.extractedText.trim().length === 0) {
                 throw new Error("Failed to extract text from PDF.");
            }
            // content, keyPoints, questions from processedData are already AI-generated.

            setUploadProgress(prev => ({ ...prev, progress: 95, status: 'Saving PDF note...' }));

            const noteToSave: Omit<FirebaseNoteData, 'id' | 'createdAt' | 'updatedAt'> = {
                title: processedData.title || file.name.replace(/\.[^/.]+$/, ""),
                content: processedData.content,
                keyPoints: processedData.keyPoints,
                questions: processedData.questions,
                type: 'pdf',
                sourceUrl: processedData.sourceUrl,
                isPublic: false,
                tags: ['pdf', file.name.split('.').pop() || 'file'],
                userId: user.uid, // Explicitly ensure userId is part of the object for saveNote
            };
            
            const newNoteId = await saveNote(noteToSave);
            await incrementNoteUsage('pdfAi');

            const newNoteDoc = await getNoteById(newNoteId);
            if (newNoteDoc) {
                handleSelectNote({ ...newNoteDoc, id: newNoteId } as Note);
            }
            
            setUploadProgress({ progress: 100, status: 'PDF Note Created!', error: null });
            setShowNewNoteModal(false);
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error processing PDF:', error);
            setUploadProgress({ progress: 0, status: '', error: error instanceof Error ? error.message : 'Failed to process PDF' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    };

    const handleYoutubeLink = async (url: string) => {
        if (!user || !geminiApiKey) {
            setUploadProgress({ progress: 0, status: '', error: 'AI features not available.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }
        if (!checkNoteLimit('youtube')) return;
        setUploadProgress({ progress: 0, status: 'Processing YouTube...', error: null });
        try {
            // processYouTube expects (url, userId, apiKey, onProgress)
            // It should return an object similar to ProcessedPDF or a specific ProcessedYouTube type
            const processedData = await processYouTube( url, user.uid, geminiApiKey, (progressState) => setUploadProgress(progressState) );
            // Ensure processedData contains necessary fields (title, content, keyPoints, questions, sourceUrl)
            // and that content, keyPoints, questions are AI-generated within processYouTube.

            setUploadProgress(prev => ({ ...prev, progress: 95, status: 'Saving note...' }));
            const noteToSave: Omit<FirebaseNoteData, 'id' | 'createdAt' | 'updatedAt'> = {
                title: processedData.title || 'YouTube Note',
                content: processedData.content,
                keyPoints: processedData.keyPoints,
                questions: processedData.questions,
                type: 'youtube',
                sourceUrl: processedData.sourceUrl || url,
                isPublic: false,
                tags: ['youtube', 'video'],
                userId: user.uid,
            };
            const newNoteId = await saveNote(noteToSave);
            await incrementNoteUsage('youtube');

            const newNoteDoc = await getNoteById(newNoteId);
            if (newNoteDoc) {
                handleSelectNote({ ...newNoteDoc, id: newNoteId } as Note);
            }

            setUploadProgress({ progress: 100, status: 'YouTube Note Created!', error: null });
            setShowNewNoteModal(false);
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error processing YouTube:', error);
            setUploadProgress({ progress: 0, status: '', error: error instanceof Error ? error.message : 'Failed to process YouTube' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    };

    const handleAddTag = () => {
        const trimmedTag = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (trimmedTag && editTags.length < 5 && !editTags.includes(trimmedTag)) {
            setEditTags([...editTags, trimmedTag]);
            setNewTag('');
        } else if (editTags.length >= 5) {
            alert("Maximum 5 tags allowed.");
        } else if (!trimmedTag) {
            alert("Tag cannot be empty.");
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
        } else {
            setShowFlashcardStudyModal(true);
        }
    }, [selectedNote?.flashcards]);

    const handleRegenerateQuestions = async () => {
        if (!selectedNote || !geminiApiKey || isRegeneratingQuestions || !user) return;

        if (userTier !== 'premium' && !checkNoteLimit('pdfAi')) { // Assuming question regen counts as pdfAi usage
            setUploadProgress({ progress: 0, status: '', error: 'Monthly AI Note limit reached.' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
            return;
        }

        setIsRegeneratingQuestions(true);
        setUploadProgress({ progress: 0, status: 'Regenerating questions...', error: null });
        try {
            // regenerateStudyQuestions now directly updates Firestore
            await regenerateStudyQuestions(selectedNote.id, selectedNote.content, geminiApiKey);
            // The onSnapshot listener will update selectedNote with new questions.
            setQuestionAnswers({}); // Clear old answers

            if (userTier !== 'premium') {
                await incrementNoteUsage('pdfAi'); // Increment usage
            }

            setUploadProgress({ progress: 100, status: 'Questions regenerated!', error: null });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 2000);
        } catch (error) {
            console.error('Error regenerating questions:', error);
            setUploadProgress({ progress: 0, status: '', error: error instanceof Error ? error.message : 'Failed to regenerate questions' });
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        } finally {
            setIsRegeneratingQuestions(false);
        }
    };

    const handleAnswerSelect = useCallback((questionKey: string, selectedOption: number) => setQuestionAnswers(prev => ({ ...prev, [questionKey]: selectedOption })), []);

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
        setNumPages(nextNumPages);
        setPdfError(null);
        setCurrentPage(1); // Reset to first page on new PDF load
    };
    const onDocumentLoadError = (error: Error) => {
        console.error('Failed to load PDF:', error);
        setPdfError(`Failed to load PDF: ${error.message}. Ensure URL is correct and file is accessible.`);
        setNumPages(null); // Clear numPages on error
    };

    const changePage = (offset: number) => setCurrentPage(prevPage => Math.min(Math.max(prevPage + offset, 1), numPages || 1));
    const changeScale = (amount: number) => setPdfScale(prevScale => Math.max(0.5, Math.min(3.0, prevScale + amount)));
    const changeRotation = (amount: number) => setPdfRotation(prevRotation => (prevRotation + amount + 360) % 360);

    const showSideBySideChat = selectedNote?.type === 'pdf' && showPdfViewer && !!selectedNote.sourceUrl && !!user && !!geminiApiKey && !isMobile;

    const handlePdfTextSelection = useCallback(() => {
        if (!pdfViewerContainerRef.current || !showPdfViewer) {
            if (showHighlightButtons) setShowHighlightButtons(false);
            return;
        }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            // Check if the selection is within the PDF viewer's text layer
            const textLayer = (range.commonAncestorContainer as HTMLElement).closest('.react-pdf__Page__textContent');
            if (textLayer && pdfViewerContainerRef.current.contains(textLayer)) {
                const currentSelectedText = selection.toString().trim();
                if (currentSelectedText.length > 2) { // Only show for reasonably long selections
                    setSelectedPdfText(currentSelectedText); // Set state slightly later
                    const containerRect = pdfViewerContainerRef.current.getBoundingClientRect();
                    const rangeRect = range.getBoundingClientRect();
                    const scrollTop = pdfViewerContainerRef.current.scrollTop;
                    const scrollLeft = pdfViewerContainerRef.current.scrollLeft;

                    // Position button above the selection
                    const top = rangeRect.top - containerRect.top + scrollTop - 35; // 35px offset for button height
                    const left = rangeRect.left - containerRect.left + scrollLeft + (rangeRect.width / 2); // Center horizontally
                    
                    setHighlightButtonPosition({ top: Math.max(scrollTop + 5, top), left: Math.max(scrollLeft + 5, left) });
                    setShowHighlightButtons(true);
                    return; // Exit early if buttons are shown
                }
            }
        }
        // If conditions not met (no valid selection), hide buttons
        if (showHighlightButtons) { // Only hide if they were previously shown
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            setHighlightButtonPosition(null);
            // Avoid aggressive deselection here, let click-outside handle it,
            // or if user clicks elsewhere in the PDF.
        }
    }, [showPdfViewer, showHighlightButtons]);


    const handleExplainHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote && noteChatRef.current) {
            if (showSideBySideChat) { // If side-by-side chat is active
                noteChatRef.current.sendMessage(`Explain:\n\n"${selectedPdfText}"`);
            } else {
                // If not in side-by-side, activate overlay chat and then send.
                handleChatWithNote(selectedNote, true); // This should set up the correct chat view
                setTimeout(() => { // Delay to allow chat view to be ready
                    noteChatRef.current?.sendMessage(`Explain:\n\n"${selectedPdfText}"`);
                }, 250);
            }
            setShowHighlightButtons(false);
            setSelectedPdfText(null); // Clear selected text
            window.getSelection()?.removeAllRanges(); // Clear browser selection
        } else {
            console.warn("Explain failed: No selected text, note, or chat ref.");
        }
    }, [selectedPdfText, selectedNote, showSideBySideChat, handleChatWithNote]);

    const handleChatAboutHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote && noteChatRef.current?.addPdfContextSegment) {
            if (showSideBySideChat) {
                noteChatRef.current.addPdfContextSegment(selectedPdfText);
                noteChatRef.current.focusInput?.();
            } else {
                handleChatWithNote(selectedNote, true); // Activate chat view
                setTimeout(() => {
                    noteChatRef.current?.addPdfContextSegment?.(selectedPdfText);
                    noteChatRef.current?.focusInput?.();
                }, 250);
            }
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            // window.getSelection()?.removeAllRanges(); // Optionally clear selection
        } else {
             console.warn("Chat about highlight failed: No selected text, note, or chat ref with addPdfContextSegment.");
        }
    }, [selectedPdfText, selectedNote, showSideBySideChat, handleChatWithNote]);


    const handleGenerateImageForNote = useCallback(async () => {
        if (!imageGenPrompt.trim() || !selectedNote || !geminiApiKey || isGeneratingImage || !user) {
            setImageGenError("Prompt is required, a note must be selected, and AI features must be available.");
            setTimeout(() => setImageGenError(null), 4000);
            return;
        }
        if (userTier === 'loading' || (userTier !== 'premium' && userTier !== 'pro')) {
            setImageGenError("Image generation is available for Pro and Premium users only.");
            setTimeout(() => setImageGenError(null), 4000);
            return;
        }

        setIsGeneratingImage(true);
        setImageGenError(null);
        setUploadProgress({ progress: 0, status: 'Generating image...', error: null });
        try {
            const context = `Note Title: "${selectedNote.title}". Snippet: ${selectedNote.content.substring(0, Math.min(selectedNote.content.length, 300))}...`;
            // Assuming generateImageWithImagen is correctly imported and setup
            const imageData = await generateImageWithImagen(imageGenPrompt, context, geminiApiKey);

            if (imageData) {
                handleAddImageToNoteRequest(imageData); // This will switch to edit mode if needed
                setUploadProgress({ progress: 100, status: 'Image added to note!', error: null });
                setShowImageGenModal(false);
                setImageGenPrompt('');
            } else {
                throw new Error("Image generation returned no data.");
            }
        } catch (error: any) {
            console.error("Image generation failed:", error);
            const errorMsg = error?.message || 'Unknown image generation error.';
            setImageGenError(`Failed: ${errorMsg}`);
            setUploadProgress({ progress: 0, status: '', error: `Image generation failed: ${errorMsg}` });
        } finally {
            setIsGeneratingImage(false);
            setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null }), 3000);
        }
    }, [imageGenPrompt, selectedNote, geminiApiKey, isGeneratingImage, user, userTier, handleAddImageToNoteRequest]);


    const containerClass = isIlluminateEnabled ? "bg-gray-100 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
    const notesListBg = isIlluminateEnabled ? "bg-white border-gray-200" : isBlackoutEnabled ? "bg-black border-gray-800" : "bg-gray-800 border-gray-700";
    const mainContentBg = isIlluminateEnabled ? "bg-gray-100" : isBlackoutEnabled ? "bg-black" : "bg-gray-900";
    const noteViewBg = isIlluminateEnabled ? "bg-white border border-gray-200/70 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 border border-gray-700/50" : "bg-gray-800 border border-gray-700/50";
    const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
    const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
    const textColor = isIlluminateEnabled ? "text-gray-700" : "text-gray-300";
    const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/60 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 hover:bg-gray-600/70 border-gray-600 focus:border-blue-500 focus:ring-blue-500";
    const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200";
    const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500";
    const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white";
    const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-700 hover:bg-gray-600 text-gray-300";
    const buttonDisabledClass = "opacity-50 cursor-not-allowed";
    const iconColor = isIlluminateEnabled ? "text-gray-500" : "text-gray-400";
    const iconHoverColor = isIlluminateEnabled ? "hover:text-gray-700" : "hover:text-gray-100";
    const iconActionColor = isIlluminateEnabled ? "text-blue-600" : "text-blue-400";
    const iconActionHoverBg = isIlluminateEnabled ? "hover:bg-blue-100/50" : "hover:bg-blue-900/30";
    const iconDeleteHoverColor = isIlluminateEnabled ? "hover:text-red-600" : "hover:text-red-400";
    const iconDeleteHoverBg = isIlluminateEnabled ? "hover:bg-red-100/50" : "hover:bg-red-900/30";
    const borderColor = isIlluminateEnabled ? "border-gray-200" : "border-gray-700";
    const divideColor = isIlluminateEnabled ? "divide-gray-200" : "divide-gray-700";
    const listItemHoverBg = isIlluminateEnabled ? "hover:bg-gray-100" : "hover:bg-gray-700/50";
    const listItemSelectedBg = isIlluminateEnabled ? "bg-blue-50 border-l-2 border-blue-500" : "bg-gray-700 border-l-2 border-blue-500";
    const listItemBaseClass = "border-l-2 border-transparent"; // Base class for note items
    const tagBaseBg = isIlluminateEnabled ? "bg-opacity-80" : "bg-opacity-20";
    const tagTextBase = isIlluminateEnabled ? "text-opacity-90" : "text-opacity-80";
    const tagColors = { personal: isIlluminateEnabled ? "bg-green-100 text-green-700" : "bg-green-500/20 text-green-300", pdf: isIlluminateEnabled ? "bg-red-100 text-red-700" : "bg-red-500/20 text-red-300", youtube: isIlluminateEnabled ? "bg-purple-100 text-purple-700" : "bg-purple-500/20 text-purple-300", audio: isIlluminateEnabled ? "bg-yellow-100 text-yellow-700" : "bg-yellow-500/20 text-yellow-300", public: isIlluminateEnabled ? "bg-cyan-100 text-cyan-700" : "bg-cyan-500/20 text-cyan-300", custom: isIlluminateEnabled ? "bg-blue-100 text-blue-700" : "bg-blue-500/20 text-blue-300", };

    const proseClass = `prose prose-sm sm:prose-base max-w-none ${isIlluminateEnabled ? 'prose-gray' : 'prose-invert'} ${isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'} prose-a:text-blue-500 hover:prose-a:text-blue-600 prose-headings:font-semibold prose-p:leading-relaxed prose-p:mb-3 prose-ul:list-disc prose-ul:my-2 prose-ul:ml-5 prose-ol:list-decimal prose-ol:my-2 prose-ol:ml-5 prose-li:my-1 prose-li:ml-2 prose-blockquote:border-l-4 ${isIlluminateEnabled ? 'prose-blockquote:border-gray-300' : 'prose-blockquote:border-gray-600'} prose-blockquote:pl-4 prose-blockquote:pr-2 prose-blockquote:py-1 prose-blockquote:italic prose-blockquote:text-sm prose-blockquote:my-3 prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-200/50 dark:prose-code:bg-gray-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:rounded-md prose-pre:p-3 prose-img:rounded-lg prose-img:shadow-sm prose-img:max-w-full prose-table:my-4 prose-table:w-full prose-table:text-sm prose-thead:border-b ${isIlluminateEnabled ? 'prose-thead:border-gray-300' : 'prose-thead:border-gray-600'} prose-th:px-3 prose-th:py-1.5 prose-th:font-medium prose-th:text-left ${isIlluminateEnabled ? 'prose-th:bg-gray-100' : 'prose-th:bg-gray-700/40'} prose-tbody:divide-y ${isIlluminateEnabled ? 'prose-tbody:divide-gray-200' : 'prose-tbody:divide-gray-700'} prose-td:px-3 prose-td:py-1.5`;

    const currentLimits = userTier === 'loading' ? null : NOTE_LIMITS[userTier];


    return (
        <div className={`flex h-screen overflow-hidden ${containerClass} font-sans`}>
            <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} userName={userName} isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled} isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled} />

            <main className={`flex-1 flex overflow-hidden transition-all duration-300 ${ isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64' }`}>
                {/* Main content area: either notes list and content view, or split view, or PDF view + chat */}
                {/* Conditional rendering for notes list on desktop */}
                 <div className={` ${!isMobile && !isNotesListHidden ? 'w-full md:w-72 lg:w-80 xl:w-96 border-l' : 'w-0 hidden'} ${borderColor} flex-shrink-0 flex flex-col ${notesListBg} transition-all duration-300 ease-in-out relative h-full order-first `}>
                     {(!isMobile && !isNotesListHidden) && (
                         <>
                         <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}> <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}> <FileText className={`w-5 h-5 ${iconActionColor}`} /> Notes </h2> <div className="flex items-center gap-1"> <button onClick={handleToggleNotesList} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title="Hide List"> <PanelRightClose className="w-4 h-4" /> </button> {notes.length >= 2 && !showPdfViewer && ( <button onClick={showSplitView ? closeSplitView : startSplitView} className={`${buttonSecondaryClass} p-1.5 rounded-full ${iconHoverColor}`} title={showSplitView ? "Close Comparison" : "Compare Notes"}> <SplitSquareVertical className={`w-4 h-4 ${showSplitView ? iconActionColor: ''}`} /> </button> )} <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} p-2 rounded-full hover:shadow-md transition-all duration-150`} title="New Note"> <Plus className="w-4 h-4" /> </button> </div> </div>
                         <div className={`p-3 border-b ${borderColor} flex-shrink-0`}> <div className="relative mb-2"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${iconColor}`} /> <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 ${placeholderColor}`} /> </div> <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div> </div>
                         {userTier !== 'premium' && userTier !== 'loading' && currentLimits && ( <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}> <div className="flex justify-between items-center gap-2"> <span>PDF/AI Notes: {noteUsage.pdfAi} / {currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span> <span>YouTube Notes: {noteUsage.youtube} / {currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span> </div> </div> )}
                         <div className="flex-1 overflow-y-auto"> {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div> ) : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> ) : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; case 'audio': typeIcon = <Mic className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>L</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>R</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{(note.content || '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type] || tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )} </div>
                         </>
                    )}
                 </div>


                <div ref={!showSideBySideChat ? contentRef : null} className={`flex-1 ${mainContentBg} relative ${showSideBySideChat ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                     {/* Mobile header when notes list is hidden */}
                     {isMobile && !showNotesListOnMobile && !showSideBySideChat && (
                         <div className={`sticky top-0 z-10 p-2 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-white/80 backdrop-blur-sm' : 'bg-gray-900/80 backdrop-blur-sm'} flex items-center justify-between`}>
                             <button onClick={() => setShowNotesListOnMobile(true)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Notes"> <List className="w-4 h-4" /> </button>
                             <span className={`text-sm font-medium truncate px-2 ${headingClass}`}> {isEditing ? 'Editing Note' : selectedNote?.title || 'Note'} </span>
                             <div className="w-8 h-8 flex items-center justify-center"> {/* Placeholder for right-side action like save/edit */}
                                 {selectedNote && !isEditing && !showPdfViewer && !showSplitView && ( <button onClick={handleEditNote} className={`p-1.5 rounded-md ${iconHoverColor} ${iconActionHoverBg}`} title="Edit note"> <Edit2 className="w-4 h-4" /> </button> )}
                                 {isEditing && ( <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`p-1.5 rounded-md ${buttonPrimaryClass} ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`} title="Save Changes"> {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} </button> )}
                             </div>
                         </div>
                    )}

                     {/* Split View */}
                     {showSplitView && splitViewNotes.left && splitViewNotes.right ? (
                         <SplitView key={`${splitViewNotes.left.id}-${splitViewNotes.right.id}`} leftNote={splitViewNotes.left} rightNote={splitViewNotes.right} onClose={closeSplitView} onTogglePublic={handleTogglePublic} onDelete={handleDeleteNote} onChat={(note) => handleChatWithNote(note)}
                          isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} />

                     /* PDF Viewer with Side-by-Side Chat (Desktop Only) */
                     ) : showSideBySideChat ? (
                         <div className="flex flex-row h-full overflow-hidden">
                             {/* PDF Viewer Section */}
                             <div className="flex flex-col overflow-hidden relative border-r border-gray-200 dark:border-gray-700" style={{ width: `${pdfChatSplitRatio}%` }}>
                                  {/* PDF Controls */}
                                  <div className={`flex-shrink-0 p-1.5 border-b ${borderColor} ${isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-800/50'} flex items-center justify-between gap-1 sticky top-0 z-10`}>
                                      <div className="flex items-center gap-1"><button onClick={() => togglePdfViewer(false)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Show Note Only"> <FileText className="w-4 h-4" /> </button></div>
                                      <div className="flex items-center gap-1 text-xs font-medium">
                                        <button onClick={() => changePage(-1)} disabled={currentPage <= 1} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor} ${currentPage <= 1 ? buttonDisabledClass : ''}`} title="Previous Page"> <ChevronLeft className="w-4 h-4" /> </button>
                                         <span>Page {currentPage} of {numPages || '--'}</span>
                                         <button onClick={() => changePage(1)} disabled={currentPage >= (numPages || 1)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor} ${currentPage >= (numPages || 1) ? buttonDisabledClass : ''}`} title="Next Page"> <ChevronRight className="w-4 h-4" /> </button>
                                     </div>
                                     <div className="flex items-center gap-1"> <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div> <button onClick={() => changeScale(-0.1)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Zoom Out"> <ZoomOut className="w-4 h-4" /> </button> <span className={`text-xs font-medium px-1 ${textColor}`}>{Math.round(pdfScale * 100)}%</span> <button onClick={() => changeScale(0.1)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Zoom In"> <ZoomIn className="w-4 h-4" /> </button> <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div> <button onClick={() => changeRotation(-90)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Rotate Left"> <RotateCcw className="w-4 h-4 transform -scale-x-100" /> </button> <button onClick={() => changeRotation(90)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Rotate Right"> <RotateCcw className="w-4 h-4" /> </button> </div>
                                  </div>
                                  <p className={`flex-shrink-0 text-center text-[10px] p-0.5 ${isIlluminateEnabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-800 text-gray-400'} sticky top-[37px] z-[9]`}>Highlight any text in the PDF to open the Explain or Chat options.</p>
                                 {/* PDF Document Area */}
                                 <div ref={pdfViewerContainerRef} onMouseUp={handlePdfTextSelection} className={`flex-1 overflow-auto relative ${isIlluminateEnabled ? 'bg-gray-100' : 'bg-gray-800/30'}`} >
                                     {pdfError ? ( <div className="p-6 text-center text-red-500 flex flex-col items-center justify-center h-full"> <AlertTriangle className="w-10 h-10 mb-3" /> <p className="text-sm font-medium">Error Loading PDF</p> <p className="text-xs mt-1">{pdfError}</p> </div>
                                     ) : selectedNote?.sourceUrl ? ( <Document file={selectedNote.sourceUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={<div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500"/></div>} className="flex flex-col items-center pdf-document pt-4 pb-8" > {numPages === null && !pdfError ? ( <div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> ) : numPages && ( Array.from(new Array(numPages), (el, index) => ( <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={pdfScale} rotate={pdfRotation} renderAnnotationLayer={true} renderTextLayer={true} className="mb-2 shadow-md" loading={<div className="h-64 flex items-center justify-center text-xs">Loading page {index + 1}...</div>} /> )) )} </Document>
                                     ) : ( <div className="p-6 text-center text-gray-500">PDF source missing.</div> )}
                                     {/* Highlight Buttons */}
                                     {showHighlightButtons && highlightButtonPosition && ( <div className="highlight-buttons-container absolute z-20 flex items-center gap-1 bg-gray-800 dark:bg-gray-200 p-1 rounded-md shadow-lg" style={{ top: `${highlightButtonPosition.top}px`, left: `${highlightButtonPosition.left}px`, transform: 'translateX(-50%)' }} onMouseDown={(e) => e.stopPropagation()} > <button onClick={handleExplainHighlight} className={`text-xs px-2 py-1 rounded transition-colors ${isIlluminateEnabled ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Explain</button> <button onClick={handleChatAboutHighlight} className={`text-xs px-2 py-1 rounded transition-colors ${isIlluminateEnabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>Chat</button> </div> )}
                                 </div>
                             </div>
                             {/* Resizer */}
                             <div className={`w-1.5 cursor-col-resize flex items-center justify-center flex-shrink-0 ${isIlluminateEnabled ? 'bg-gray-300 hover:bg-gray-400' : 'bg-gray-600 hover:bg-gray-500'} ${isResizingPdfChatSplit ? (isIlluminateEnabled ? '!bg-blue-500' : '!bg-blue-500') : ''}`} onMouseDown={handleResizeMouseDown} title="Drag to resize panels"><GripVertical className={`w-4 h-4 pointer-events-none ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`} /></div>
                             {/* Inline Chat Section */}
                             <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 - pdfChatSplitRatio}%` }}>
                                 {selectedNote && geminiApiKey && user && ( <NoteChat ref={noteChatRef} key={`chat-inline-${selectedNote.id}`} note={selectedNote} onClose={() => togglePdfViewer(false)} /* Close PDF view to go back to note view */ geminiApiKey={geminiApiKey} userName={userName} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} isVisible={true} /* Always visible in this layout */ onUpdateNoteContent={handleUpdateNoteContentFromChat} onAddImageToNoteRequest={handleAddImageToNoteRequest} displayMode="inline" userTier={userTier} /> )}
                             </div>
                         </div>

                     /* Standard Note View / Edit View */
                     ) : (
                         <div className={`p-0 md:p-6 lg:p-8 h-full ${isEditing ? 'flex flex-col' : ''} ${showSideBySideChat ? 'hidden': ''}`}>
                            {/* Placeholder for Split View Selection */}
                            {showSplitView && (!splitViewNotes.left || !splitViewNotes.right) ? ( <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <SplitSquareVertical className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>Compare Notes</h2> <p className={`${subheadingClass} text-sm mb-4`}>Select {splitViewNotes.left ? 'one more note' : 'two notes'} from the list.</p> <p className={`text-xs ${subheadingClass} mb-4`}>Selected: {splitViewNotes.left ? 1 : 0}/2</p> <button onClick={closeSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Cancel Comparison</button> </div>

                            /* Note Content or Edit Form */
                            ) : selectedNote ? (
                                isEditing ? (
                                    /* Edit Mode */
                                    <div className={`${noteViewBg} rounded-lg p-4 md:p-6 flex flex-col h-full overflow-hidden`}>
                                         {/* Title and Tags Input */}
                                         <div className="space-y-3 flex-shrink-0"> <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} text-xl font-semibold rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${placeholderColor}`} placeholder="Note title..." /> <div className="flex flex-wrap items-center gap-2"> {editTags.map((tag) => ( <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {tag} <button onClick={() => handleRemoveTag(tag)} className={`${iconHoverColor} rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5`} title={`Remove tag "${tag}"`}> <X className="w-2.5 h-2.5" /> </button> </span> ))} {editTags.length < 5 && ( <div className="flex items-center gap-1"> <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder="Add tag..." className={`${inputBg} ${inputTextColor} ${placeholderColor} rounded-full px-2.5 py-0.5 text-xs focus:outline-none focus:ring-1 w-24`} /> <button onClick={handleAddTag} className={`${buttonSecondaryClass} px-2 py-0.5 rounded-full text-xs`}>Add</button> </div> )} </div> </div>
                                         {/* MDEditor and other edit fields */}
                                         <div className="flex-1 mt-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 pr-2">
                                             <div className="mb-4" data-color-mode={isIlluminateEnabled ? 'light' : 'dark'}><MDEditor value={editContent} onChange={setEditContent} minHeight={200} preview="live" textareaProps={{ placeholder: "Start writing..." }} className={`[&_.w-md-editor-preview]:!bg-transparent [&_.w-md-editor-input]:!bg-transparent [&_.w-md-editor-toolbar]:!bg-gray-100/50 dark:[&_.w-md-editor-toolbar]:!bg-gray-800/50 border dark:border-gray-700 rounded-md [&_.w-md-editor-live]:border-l dark:[&_.w-md-editor-live]:border-gray-700`} /></div>
                                             {/* Edit Key Points */}
                                             <div className="mt-4 pt-3 border-t dark:border-gray-700"> <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${headingClass}`}><Sparkles className={`w-4 h-4 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} />Edit Key Points</h3> <div className="space-y-1.5"> {editKeyPoints.map((point, index) => ( <div key={index} className="flex items-center gap-2"> <textarea rows={1} value={point} onChange={(e) => handleKeyPointChange(index, e.target.value)} placeholder={`Key point ${index + 1}`} className={`flex-grow ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} /> <button onClick={() => handleRemoveKeyPoint(index)} className={`${iconDeleteHoverColor} p-1 rounded`} title="Remove Point"><Trash className="w-3.5 h-3.5" /></button> </div> ))} </div> <button onClick={handleAddKeyPoint} className={`${buttonSecondaryClass} mt-2 px-2.5 py-1 rounded text-xs flex items-center gap-1`}> <PlusCircle className="w-3.5 h-3.5"/> Add Point </button> </div>
                                             {/* Edit Flashcards */}
                                             <div className="mt-4 pt-3 border-t dark:border-gray-700"> <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${headingClass}`}><Layers className={`w-4 h-4 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} />Edit Flashcards</h3> <div className="space-y-2"> {editFlashcards.map((card, index) => ( <div key={index} className={`flex items-start gap-2 border rounded p-2 ${isIlluminateEnabled ? 'border-gray-200 bg-gray-50/50' : 'border-gray-600/50 bg-gray-700/30'}`}> <div className="flex-grow space-y-1"> <textarea rows={1} value={card.front} onChange={(e) => handleFlashcardChange(index, 'front', e.target.value)} placeholder="Front of flashcard" className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} /> <textarea rows={1} value={card.back} onChange={(e) => handleFlashcardChange(index, 'back', e.target.value)} placeholder="Back of flashcard" className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 resize-y min-h-[28px]`} /> </div> <button onClick={() => handleRemoveFlashcard(index)} className={`${iconDeleteHoverColor} p-1 rounded mt-1`} title="Remove Card"><Trash className="w-3.5 h-3.5" /></button> </div> ))} </div> <button onClick={handleAddFlashcard} className={`${buttonSecondaryClass} mt-2 px-2.5 py-1 rounded text-xs flex items-center gap-1`}> <PlusCircle className="w-3.5 h-3.5"/> Add Card </button> </div>
                                         </div>
                                         {/* Save/Cancel Buttons */}
                                         <div className="flex justify-between items-center gap-2 pt-3 mt-3 border-t border-gray-300 dark:border-gray-700 flex-shrink-0"> {geminiApiKey && (userTier === 'pro' || userTier === 'premium') ? ( <button onClick={() => { setShowImageGenModal(true); setImageGenError(null); setImageGenPrompt('');}} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`} title="Generate Image for Note Content" disabled={isGeneratingImage}> <ImagePlus className="w-4 h-4" /> Generate Image </button> ) : ( <div className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ${buttonSecondaryClass} ${buttonDisabledClass}`} title={!geminiApiKey ? "Gemini API Key required for AI features" : "Image generation is a Pro/Premium feature"}> <ImagePlus className="w-4 h-4" /> <span>Generate Image</span> {!geminiApiKey ? null : <Info className="w-3 h-3"/>} </div> )} <div className="flex gap-2"> <button onClick={handleCancelEdit} className={`${buttonSecondaryClass} px-4 py-1.5 rounded-md text-sm`}>Cancel</button> <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isSaving || !editTitle.trim() ? buttonDisabledClass : ''}`}> {isSaving ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Saving... </>) : (<> <Save className="w-4 h-4" /> Save </>)} </button> </div> </div>
                                     </div>
                                ) : (
                                    /* View Mode */
                                    <div className={`${noteViewBg} rounded-lg flex flex-col overflow-hidden h-full p-4 md:p-6 lg:p-8 animate-fadeIn`}>
                                        {/* Note Title and Actions */}
                                        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 flex-shrink-0`}> <h2 className={`text-xl md:text-2xl font-semibold ${headingClass} break-words mr-auto`}>{selectedNote.title || "Untitled"}</h2> <div className={`flex items-center gap-1 flex-shrink-0 border rounded-full p-0.5 ${borderColor} ${isIlluminateEnabled ? 'bg-gray-50' : 'bg-gray-800/50'}`}> <button onClick={handleEditNote} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Edit"><Edit2 className="w-4 h-4" /></button> {geminiApiKey && <button onClick={() => handleChatWithNote(selectedNote)} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Chat with AI"><MessageCircle className="w-4 h-4" /></button>} {selectedNote.type === 'pdf' && selectedNote.sourceUrl && !isMobile && ( <button onClick={() => togglePdfViewer(true)} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title={"View PDF & Chat"}> <Eye className="w-4 h-4" /> </button> )} {selectedNote.flashcards && selectedNote.flashcards.length > 0 && ( <button onClick={handleStudyFlashcards} className={`p-1.5 rounded-full ${iconHoverColor} ${iconActionHoverBg}`} title="Study Flashcards"><Layers className="w-4 h-4" /> </button> )} <button onClick={() => handleTogglePublic(selectedNote.id, selectedNote.isPublic)} className={`p-1.5 rounded-full ${iconHoverColor} ${selectedNote.isPublic ? 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30' : iconActionHoverBg}`} title={selectedNote.isPublic ? 'Make private' : 'Make public'}>{selectedNote.isPublic ? <Globe className={`w-4 h-4 ${isIlluminateEnabled ? 'text-cyan-600' : 'text-cyan-400'}`} /> : <Lock className="w-4 h-4" />}</button> {selectedNote.isPublic && ( <button onClick={() => handleGetShareLink(selectedNote.id)} className={`p-1.5 rounded-full relative ${iconHoverColor} hover:bg-green-100/50 dark:hover:bg-green-900/30`} title="Copy share link">{linkCopied ? <ClipboardCopy className={`w-4 h-4 text-green-500`} /> : <Share2 className="w-4 h-4" />}</button> )} <div className={`w-px h-4 ${isIlluminateEnabled ? 'bg-gray-300' : 'bg-gray-600'} mx-0.5`}></div> <button onClick={() => handleDeleteNote(selectedNote.id)} className={`p-1.5 rounded-full ${iconDeleteHoverColor} ${iconDeleteHoverBg}`} title="Delete"><Trash2 className="w-4 h-4" /></button> </div> </div>
                                        {/* Tags */}
                                        {((selectedNote.tags?.length ?? 0) > 0) && ( <div className={`flex flex-wrap gap-1.5 mb-4`}> {selectedNote.tags!.map((tag) => (<span key={tag} className={`px-2 py-0.5 rounded-full text-xs ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>#{tag}</span>))} </div> )}
                                        {/* Note Content Display */}
                                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                                            <div className={`${proseClass} mb-6`}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                                                     components={{
                                                        img: ({node, ...props}) => <img className="max-w-full h-auto rounded-md my-4 shadow-sm" {...props} alt={props.alt || 'Note image'}/>,
                                                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                                                        table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className={`w-full text-left border-collapse border ${borderColor}`} {...props} /></div>,
                                                        thead: ({node, ...props}) => <thead className={isIlluminateEnabled ? 'bg-gray-100' : 'bg-gray-700/40'} {...props} />,
                                                        th: ({node, ...props}) => <th className={`border ${borderColor} px-3 py-2 font-medium text-sm`} {...props} />,
                                                        td: ({node, ...props}) => <td className={`border ${borderColor} px-3 py-2 text-sm`} {...props} />,
                                                        h1: ({node, ...props}) => <h1 className="text-xl font-semibold mb-2 mt-4 border-b pb-1" {...props} />, h2: ({node, ...props}) => <h2 className="text-lg font-semibold mb-1.5 mt-3 border-b pb-0.5" {...props} />, h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-1 mt-2" {...props} />, p: ({node, ...props}) => <p className="text-sm leading-relaxed mb-2" {...props} />, ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 space-y-1 text-sm mb-2" {...props} />, ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 space-y-1 text-sm mb-2" {...props} />, li: ({node, ...props}) => <li className="mb-0.5" {...props} />, blockquote: ({node, ...props}) => <blockquote className={`border-l-4 ${borderColor} pl-3 italic text-sm my-2 ${subheadingClass}`} {...props} />, code: ({node, inline, className, children, ...props}) => { const match = /language-(\w+)/.exec(className || ''); return !inline ? ( <pre className={`text-[11px] leading-snug ${isIlluminateEnabled ? '!bg-gray-100 !text-gray-800 border border-gray-200' : '!bg-gray-900/80 !text-gray-300 border border-gray-700'} p-2 rounded-md overflow-x-auto my-2`} {...props}> <code className={`language-${match?.[1] || 'plaintext'}`}>{children}</code> </pre> ) : ( <code className={`text-xs ${isIlluminateEnabled ? 'bg-gray-200/70 text-gray-800' : 'bg-gray-700/70 text-gray-200'} px-1 rounded`} {...props}>{children}</code> ); },
                                                     }}
                                                >
                                                    {selectedNote.content || ''}
                                                </ReactMarkdown>
                                            </div>
                                            {/* Key Points Display */}
                                            {selectedNote.keyPoints && selectedNote.keyPoints.length > 0 && (
                                            <div className={`mt-6 border-t pt-4 ${borderColor}`}>
                                                <h3 className={`text-base font-semibold mb-3 flex items-center gap-1.5 ${headingClass}`}> <Sparkles className={`w-4 h-4 ${isIlluminateEnabled ? 'text-yellow-500' : 'text-yellow-400'}`} /> Key Points </h3>
                                                <ul className={`space-y-1.5 text-sm`}>
                                                {selectedNote.keyPoints.map((point, index) => (
                                                    <li key={index} className={`flex items-start gap-2 ${textColor}`}>
                                                    <span className={`flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${isIlluminateEnabled ? 'bg-blue-500' : 'bg-blue-400'}`}></span>
                                                    {point}
                                                    </li>
                                                ))}
                                                </ul>
                                            </div>
                                            )}
                                            {/* Flashcards Section */}
                                            {selectedNote.flashcards && selectedNote.flashcards.length > 0 && ( <div className={`mt-6 border-t pt-4 ${borderColor}`}> <div className="flex justify-between items-center mb-3"> <h3 className={`text-base font-semibold flex items-center gap-1.5 ${headingClass}`}><Layers className={`w-4 h-4 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} /> Flashcards ({selectedNote.flashcards.length})</h3> <button onClick={handleStudyFlashcards} className={`${buttonSecondaryClass} px-3 py-1 rounded-md text-xs flex items-center gap-1`}> <BookOpen className="w-3.5 h-3.5" /> Study </button> </div> <p className={`text-xs ${subheadingClass}`}>Review generated flashcards.</p> </div> )}
                                            {/* Study Questions */}
                                            {selectedNote.questions && selectedNote.questions.length > 0 && ( <div className={`mt-6 border-t pt-4 ${borderColor}`}> <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2"> <h3 className={`text-base font-semibold flex items-center gap-1.5 ${headingClass}`}><BookOpen className={`w-4 h-4 ${isIlluminateEnabled ? 'text-purple-600' : 'text-purple-400'}`} />Study Questions</h3> {geminiApiKey && <button onClick={handleRegenerateQuestions} disabled={isRegeneratingQuestions || !geminiApiKey} className={`${buttonSecondaryClass} px-3 py-1 rounded-md text-xs flex items-center gap-1 ${isRegeneratingQuestions || !geminiApiKey ? buttonDisabledClass : ''}`} title={!geminiApiKey ? "API Key required" : "Regenerate"}> {isRegeneratingQuestions ? (<> <Loader2 className="w-3 h-3 animate-spin" /> Regenerating... </>) : (<> <RefreshCw className="w-3 h-3" /> Regenerate </>)} </button>} </div> <div className="space-y-4"> {selectedNote.questions.map((q, index) => { const key = `${selectedNote?.id}-${index}`; const answer = questionAnswers[key]; const answered = answer != null; const isCorrect = answered && answer === q.correctAnswer; return ( <div key={key} className={`p-3 rounded-lg ${answered ? (isCorrect ? (isIlluminateEnabled ? 'bg-green-50 border-green-200' : 'bg-green-900/30 border-green-700/50') : (isIlluminateEnabled ? 'bg-red-50 border-red-200' : 'bg-red-900/30 border-red-700/50')) : (isIlluminateEnabled ? 'bg-gray-50/50 border-gray-200' : 'bg-gray-800/40 border-gray-700/50')}`}> <p className={`${textColor} text-sm mb-2`}><span className="font-medium">{index + 1}.</span> {q.question}</p> <div className="space-y-1.5"> {q.options.map((opt, idx) => { const sel = answer === idx; const cor = idx === q.correctAnswer; let cls = `w-full text-left px-3 py-1.5 rounded-md transition-colors text-xs`; if (answered) { if (sel) cls += cor ? ` ${isIlluminateEnabled ? 'bg-green-100 border-green-300 text-green-800 font-medium' : 'bg-green-500/20 border-green-500 text-green-300 font-medium'}` : ` ${isIlluminateEnabled ? 'bg-red-100 border-red-300 text-red-800 font-medium' : 'bg-red-500/20 border-red-500 text-red-300 font-medium'}`; else if (cor) cls += ` ${isIlluminateEnabled ? 'bg-green-50/50 border-green-200 text-green-700' : 'bg-green-500/10 border-green-600/50 text-green-400'} border`; else cls += ` ${isIlluminateEnabled ? 'bg-gray-100 text-gray-500' : 'bg-gray-700 text-gray-400 opacity-70'}`; } else { cls += ` ${buttonSecondaryClass} hover:brightness-110`; } return ( <button key={idx} onClick={() => !answered && handleAnswerSelect(key, idx)} disabled={answered} className={cls}> <div className="flex items-center justify-between"> <span>{opt}</span> {answered && sel && (cor ? <Check className={`w-3.5 h-3.5 ${isIlluminateEnabled ? 'text-green-600' : 'text-green-400'}`} /> : <X className={`w-3.5 h-3.5 ${isIlluminateEnabled ? 'text-red-600' : 'text-red-400'}`} />)} </div> </button> ); })} </div> {answered && q.explanation && (<div className={`mt-2 p-2 rounded-md text-xs ${isCorrect ? (isIlluminateEnabled ? 'bg-green-200/70 text-green-700' : 'bg-green-900/50 text-green-300') : (isIlluminateEnabled ? 'bg-red-200/70 text-red-700' : 'bg-red-900/50 text-red-300')}`}><span className="font-medium">Explanation: </span>{q.explanation}</div>)} </div> ); })} </div> </div> )}
                                        </div>
                                    </div>
                                )
                            ) : ( /* No Note Selected View */ <div className={`flex flex-col items-center justify-center rounded-lg ${noteViewBg} h-full text-center p-6`}> <FileText className={`w-12 h-12 ${iconColor} mb-4`} /> <h2 className={`text-lg font-semibold ${headingClass} mb-2`}>No Note Selected</h2> <p className={`${subheadingClass} max-w-xs text-sm mb-4`}>Select a note from the list, or create a new one.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 mb-2`}> <Plus className="w-4 h-4" /> Create Note </button> {!isMobile && notes.length >= 2 && !showSplitView && ( <button onClick={startSplitView} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <SplitSquareVertical className="w-4 h-4" /> Compare Notes </button> )} </div>
                            )}
                         </div>
                     )}
                </div>

                {/* Button to show notes list on desktop when hidden */}
                 {!isMobile && isNotesListHidden && (
                    <button onClick={handleToggleNotesList} className={`fixed left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-r-md shadow-lg ${buttonSecondaryClass} hover:brightness-110`} title="Show Notes List">
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                 )}

                  {/* Mobile Notes List (Overlay/Drawer) */}
                  {isMobile && (
                    <div className={` fixed inset-0 z-20 bg-black/50 transition-opacity duration-300 ease-in-out ${showNotesListOnMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} `} onClick={() => setShowNotesListOnMobile(false)}>
                        <div className={` absolute top-0 right-0 h-full w-4/5 max-w-sm ${notesListBg} border-l ${borderColor} shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${showNotesListOnMobile ? 'translate-x-0' : 'translate-x-full'} `} onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className={`p-3 border-b ${borderColor} flex items-center justify-between flex-shrink-0`}>
                                <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}> <FileText className={`w-5 h-5 ${iconActionColor}`} /> Notes </h2>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} p-1.5 rounded-full hover:shadow-md`} title="New Note"> <Plus className="w-4 h-4" /> </button>
                                    <button onClick={() => setShowNotesListOnMobile(false)} className={`p-1.5 rounded-md ${buttonSecondaryClass} ${iconHoverColor}`} title="Close List"> <X className="w-4 h-4" /> </button>
                                </div>
                            </div>
                            {/* Search and Filters */}
                            <div className={`p-3 border-b ${borderColor} flex-shrink-0`}>
                                <div className="relative mb-2"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${iconColor}`} /> <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full ${inputBg} ${inputTextColor} pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 ${placeholderColor}`} /> </div>
                                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `${buttonPrimaryClass} shadow-sm` : `${buttonSecondaryClass}`}`}> {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} </button> ))} </div>
                            </div>
                            {/* Usage Stats (Mobile) */}
                            {userTier !== 'premium' && userTier !== 'loading' && currentLimits && ( <div className={`px-3 py-2 text-[10px] border-b ${borderColor} ${isIlluminateEnabled ? 'text-gray-600 bg-gray-50' : 'text-gray-400 bg-gray-800/50'}`}> <div className="flex justify-between items-center gap-2"> <span>PDF/AI: {noteUsage.pdfAi}/{currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span> <span>YT: {noteUsage.youtube}/{currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span> </div> </div> )}
                            {/* Notes List Itself (Mobile) */}
                            <div className="flex-1 overflow-y-auto">
                                {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin ${iconColor}`} /> </div>
                                ) : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 ${iconColor} mb-3`} /> <p className={`${subheadingClass} mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create </button> </div>
                                ) : ( <div className={`divide-y ${divideColor}`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <FileText className="w-3 h-3"/>; break; case 'youtube': typeIcon = <Youtube className="w-3 h-3"/>; break; case 'audio': typeIcon = <Mic className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 ${listItemHoverBg} ${listItemBaseClass} ${isSelectedAny ? listItemSelectedBg.replace('border-l-2', 'border-l-2') : ''}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 ${headingClass}`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-blue-500/20 text-blue-300`}>L</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-purple-500/20 text-purple-300`}>R</span>} </div> <p className={`${subheadingClass} text-xs line-clamp-2 mb-1.5`}>{(note.content || '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors[note.type] || tagColors.custom} ${tagBaseBg} ${tagTextBase}`}> {typeIcon} {note.type.charAt(0).toUpperCase() + note.type.slice(1)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${tagColors.public} ${tagBaseBg} ${tagTextBase}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.length > 2 && <span className={`px-1.5 py-0.5 rounded ${tagColors.custom} ${tagBaseBg} ${tagTextBase}`}>+{note.tags.length - 2}</span>} <span className={`ml-auto text-gray-500 dark:text-gray-500`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {/* Modals and Overlays */}
            {showNewNoteModal && (
                <NewNoteModal
                    onClose={() => { setShowNewNoteModal(false); setUploadProgress({ progress: 0, status: '', error: null }); }}
                    onCreatePersonalNote={handleCreatePersonalNote}
                    onCreateAINote={handleCreateAINote}
                    onUploadPDF={handlePDFUpload}
                    onYoutubeLink={handleYoutubeLink}
                    isIlluminateEnabled={isIlluminateEnabled}
                    isBlackoutEnabled={isBlackoutEnabled}
                    userTier={userTier}
                    noteUsage={noteUsage}
                />
            )}
            {selectedNote && selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
                <FlashcardStudyModal
                    isOpen={showFlashcardStudyModal}
                    onClose={() => setShowFlashcardStudyModal(false)}
                    flashcards={selectedNote.flashcards}
                    isIlluminateEnabled={isIlluminateEnabled}
                    isBlackoutEnabled={isBlackoutEnabled}
                />
            )}
            <SimpleModal isOpen={showImageGenModal} onClose={() => { setShowImageGenModal(false); setIsGeneratingImage(false); setImageGenPrompt(''); setImageGenError(null);}} title="Generate Image for Note" isIlluminateEnabled={isIlluminateEnabled} >
                <div className="space-y-3">
                    <p className={`${subheadingClass} text-sm`}>Enter a detailed prompt for the image. The generated image will be added to the end of the note content. (Pro/Premium only)</p>
                    <textarea value={imageGenPrompt} onChange={(e) => setImageGenPrompt(e.target.value)} placeholder="e.g., A watercolor painting of a serene forest..." rows={3} className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-y`} disabled={isGeneratingImage || (userTier !== 'pro' && userTier !== 'premium')} />
                    {imageGenError && <p className="text-xs text-red-500">{imageGenError}</p>}
                    <div className="flex justify-end"> <button onClick={handleGenerateImageForNote} disabled={isGeneratingImage || !imageGenPrompt.trim() || (userTier !== 'pro' && userTier !== 'premium')} className={`${buttonPrimaryClass} px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isGeneratingImage || !imageGenPrompt.trim() || (userTier !== 'pro' && userTier !== 'premium') ? buttonDisabledClass : ''}`} > {isGeneratingImage ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Generating... </>) : (<> Generate & Add </>)} </button> </div>
                </div>
            </SimpleModal>
            {chatNoteForOverlay && user && geminiApiKey && (
                 <NoteChat key={`chat-overlay-${chatNoteForOverlay.id}`} ref={noteChatRef} note={chatNoteForOverlay} onClose={handleCloseChatOverlay} geminiApiKey={geminiApiKey} userName={userName} isIlluminateEnabled={isIlluminateEnabled} isBlackoutEnabled={isBlackoutEnabled} isVisible={isChatOverlayVisible} onUpdateNoteContent={handleUpdateNoteContentFromChat} onAddImageToNoteRequest={handleAddImageToNoteRequest} displayMode="overlay" userTier={userTier}/>
            )}
             {/* Mobile FAB to show notes list */}
             {isMobile && !showNotesListOnMobile && ( <button onClick={() => setShowNotesListOnMobile(true)} className={`fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg ${buttonPrimaryClass} transform hover:scale-110 active:scale-100 ${isChatOverlayVisible ? 'bottom-16' : 'bottom-4'}`} title="Show Notes" > <List className="w-5 h-5" /> </button> )}
            {/* Upload Progress Toast */}
            {uploadProgress.status && ( <div className={`fixed bottom-4 left-4 z-[60] p-3 rounded-lg shadow-lg text-xs font-medium transition-opacity duration-300 ${isIlluminateEnabled ? 'bg-white border border-gray-200 text-gray-800' : 'bg-gray-800 border border-gray-700 text-gray-200'} ${uploadProgress.error ? (isIlluminateEnabled ? '!bg-red-100 !border-red-300 !text-red-700' : '!bg-red-900/50 !border-red-700 !text-red-300') : (uploadProgress.progress === 100 && !uploadProgress.error ? (isIlluminateEnabled ? '!bg-green-100 !border-green-300 !text-green-700' : '!bg-green-900/50 !border-green-700 !text-green-300') : '')}`}> <div className="flex items-center gap-2"> {uploadProgress.error ? <AlertTriangle className="w-4 h-4 text-red-500" /> : (uploadProgress.progress === 100 && !uploadProgress.error) ? <Check className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 animate-spin text-blue-500" />} <span>{uploadProgress.error || uploadProgress.status}</span> {uploadProgress.progress > 0 && uploadProgress.progress < 100 && !uploadProgress.error && (<span className="text-gray-500">({uploadProgress.progress}%)</span>)} </div> {!uploadProgress.error && uploadProgress.progress < 100 && ( <div className={`w-full h-1 mt-1 rounded-full overflow-hidden ${isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'}`}> <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div> </div> )} </div> )}

        </div>
    );
};

export default Notes;
