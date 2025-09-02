import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useScrollLock } from '../hooks/useScrollLock';
import {
    FileText, Mic, Plus, Search,
    AlertTriangle, X, ChevronRight, ChevronLeft, FileQuestion, BookOpen,
    Sparkles, BadgeCheck, Loader2, Save, Edit2, Check, Pencil, MessageCircle, Globe,
    Lock, Trash2, RefreshCw, SplitSquareVertical, List, Briefcase,
    Share2, ClipboardCopy, Eye, ZoomIn, ZoomOut, RotateCcw, Crown,
    PanelLeftClose, GripVertical, PlusCircle, PodcastIcon,
    Layers, Download, Camera, Trash, ArrowLeft,
    Award, TrendingUp, Flame, PanelRightOpen,
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Speaker, ChevronDown, RotateCw as FlipIcon, Gift,
    Notebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Custom YouTube Icon Component
const CustomYouTubeIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    version="1.1" 
    width="512" 
    height="512" 
    x="0" 
    y="0" 
    viewBox="0 0 176 176" 
    className={className}
  >
    <g>
      <g data-name="Layer 2">
        <g data-name="02.youtube">
          <path 
            fill="#e60000" 
            d="M144.52 173a532.59 532.59 0 0 1-113 0A32.07 32.07 0 0 1 3 144.52a532.59 532.59 0 0 1 0-113A32.07 32.07 0 0 1 31.48 3a532.59 532.59 0 0 1 113 0A32.07 32.07 0 0 1 173 31.48a532.59 532.59 0 0 1 0 113A32.07 32.07 0 0 1 144.52 173z" 
          />
          <path 
            fill="#ffffff" 
            d="M140.43 61.54c-2.2-6.77-9.48-10.87-16.18-11.81a343.16 343.16 0 0 0-72.5 0c-6.7.94-14 5-16.18 11.81a137.42 137.42 0 0 0 0 52.93c2.2 6.76 9.48 10.87 16.18 11.81a343.16 343.16 0 0 0 72.5 0c6.7-.94 14-5 16.18-11.81a137.42 137.42 0 0 0 0-52.93zm-65.59 47.54V66.92L109.16 88c-11.57 7.11-22.8 14-34.32 21.08z" 
          />
        </g>
      </g>
    </g>
  </svg>
);

// Custom PDF Icon Component
const CustomPDFIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    version="1.1" 
    width="512" 
    height="512" 
    x="0" 
    y="0" 
    viewBox="0 0 791.454 791.454" 
    className={className}
  >
    <g>
      <path 
        fill="var(--bg-accent)" 
        fillRule="evenodd" 
        d="M202.808 0h264.609l224.265 233.758v454.661c0 56.956-46.079 103.035-102.838 103.035H202.808c-56.956 0-103.035-46.079-103.035-103.035V103.035C99.772 46.079 145.851 0 202.808 0z" 
        clipRule="evenodd"
      />
      <g fill="#fff">
        <path 
          fillRule="evenodd" 
          d="M467.219 0v231.978h224.463z" 
          clipRule="evenodd" 
          opacity=".302" 
          fill="#ffffff"
        />
        <path d="M214.278 590.525V445.959h61.505c15.228 0 27.292 4.153 36.389 12.657 9.097 8.306 13.646 19.579 13.646 33.62s-4.549 25.314-13.646 33.62c-9.097 8.504-21.161 12.657-36.389 12.657H251.26v52.012zm36.982-83.456h20.37c5.537 0 9.888-1.187 12.855-3.955 2.966-2.571 4.549-6.131 4.549-10.877s-1.582-8.306-4.549-10.877c-2.966-2.769-7.317-3.955-12.855-3.955h-20.37zm89.785 83.456V445.959h51.221c10.086 0 19.579 1.384 28.478 4.351 8.899 2.966 17.008 7.12 24.127 12.855 7.12 5.537 12.855 13.052 17.008 22.545 3.955 9.493 6.131 20.37 6.131 32.631 0 12.064-2.175 22.941-6.131 32.433-4.153 9.493-9.888 17.008-17.008 22.545-7.12 5.735-15.228 9.888-24.127 12.855-8.899 2.966-18.392 4.351-28.478 4.351zm36.191-31.444h10.679c5.735 0 11.075-.593 16.019-1.978 4.746-1.384 9.295-3.56 13.646-6.526 4.153-2.966 7.515-7.12 9.888-12.657s3.56-12.064 3.56-19.579c0-7.713-1.187-14.239-3.56-19.776s-5.735-9.69-9.888-12.657c-4.351-2.966-8.899-5.142-13.646-6.526-4.944-1.384-10.284-1.978-16.019-1.978h-10.679zM486.6 590.525V445.959h102.838v31.445h-65.856v23.138h52.605v31.247h-52.605v58.736z" 
          fill="#ffffff" 
        />
      </g>
    </g>
  </svg>
);
import { Sidebar } from './Sidebar';
import { auth, db, app } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { processPDF, ProcessedPDF } from '../lib/pdf-processor';
import { processYouTube } from '../lib/youtube-processor';
import {
    saveNote, savePersonalNote, updateNote, processTextToAINoteData,
    deleteNote, toggleNotePublicStatus, regenerateStudyQuestions, getNoteById,
    addPodcastToNote, deletePodcastFromNote,
    NoteData as FirebaseNoteData, Podcast, PodcastSegment, Flashcard
} from '../lib/notes-firebase';
import { NewNoteModal } from './NewNoteModal';
import { SplitView } from './SplitView';
import { NoteChat, NoteChatHandle, ImageData as ChatImageData } from './NoteChat';

import {
    UserTier,
    getUserTier as determineUserTier,
    getUserNoteUsage,
    updateUserNoteUsage,
    NOTE_LIMITS,
    UserProfileData,
    onUserProfileSnapshot,
    updateUserPointsAndLevel,
    updateUserStreak,
    addUserBadge,
    incrementUserProfileCounter,
    POINTS_FOR_FREE_PREMIUM
} from '../lib/current-paying-user';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import html2canvas from 'html2canvas';
import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import {
    processTextForPodcast,
    ProcessedPodcastSegment,
    PodcastTextProcessResult,
    SpeakerProfileForProcessor,
    PodcastPlaybackSettingsForProcessor
} from '../lib/podcast-processor';
import { ProfileModal } from './ProfileModal';

import SunEditorCore from "suneditor/src/lib/core";
import suneditor from 'suneditor';
import plugins from 'suneditor/src/plugins';
import { en } from 'suneditor/src/lang';
import 'suneditor/dist/css/suneditor.min.css';


pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// SECURE: API calls now go through the geminiProxy function

interface SunEditorWrapperProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

// This is only the SunEditorWrapper component from Notes.tsx.
// Replace the original component with this corrected version.

// This is only the SunEditorWrapper component from Notes.tsx.
// Replace the original component with this corrected version.

const SunEditorWrapper: React.FC<SunEditorWrapperProps> = ({ initialContent = '', onChange, readOnly = false }) => {
    const editorRef = useRef<SunEditorCore | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // This effect now re-runs whenever the note content changes.
        if (textAreaRef.current) {
            // 1. Destroy any existing editor instance to ensure a clean start.
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }

            // 2. Create a brand new editor instance.
            const editor = suneditor.create(textAreaRef.current, {
                plugins: plugins,
                katex: katex,
                lang: en,
                width: '100%',
                height: '100%',
                minHeight: '400px',
                buttonList: [
                    ['undo', 'redo'],
                    ['font', 'fontSize', 'formatBlock'],
                    ['bold', 'underline', 'italic', 'strike'],
                    ['fontColor', 'hiliteColor'],
                    ['outdent', 'indent', 'align'],
                    ['horizontalRule', 'list', 'lineHeight'],
                    ['table', 'link', 'image', 'video', 'math'],
                    ['removeFormat'],
                    ['fullScreen']
                ],
                defaultStyle: "font-family: var(--font-heading); font-size: 16px;",
                mode: 'classic',
                font: [
                    'Clarika Geometric Medium', 'Arial', 'Helvetica', 'Comic Sans MS', 'Courier New',
                    'Garamond', 'Georgia', 'Impact', 'Lucida Console', 'Tahoma',
                    'Times New Roman', 'Trebuchet MS', 'Verdana'
                ],
            });

            // 3. Set the content immediately after creation.
            editor.setContents(initialContent);

            editor.onChange = (contents: string) => {
                if (onChange) {
                    onChange(contents);
                }
            };

            editorRef.current = editor;
        }

        // 4. The cleanup function ensures the editor is destroyed when leaving edit mode.
        return () => {
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, [initialContent]); // <-- CRITICAL: This dependency ensures the effect re-runs for each note.

    useEffect(() => {
        // This separate effect handles the readOnly state without interfering with creation.
        if (editorRef.current && editorRef.current.core) {
            editorRef.current.readOnly(readOnly);
            if (readOnly) {
                editorRef.current.toolbar.hide();
            } else {
                editorRef.current.toolbar.show();
            }
        }
    }, [readOnly]);

    return <textarea ref={textAreaRef} style={{ visibility: 'hidden', display: 'block', width: '100%', height: '100%' }} />;
};

const KatexRenderer: React.FC<{ htmlContent: string | undefined }> = ({ htmlContent }) => {
    const renderedContent = useMemo(() => {
        if (!htmlContent) return '';

        // Regex to find $$...$$ (for display math) and $...$ (for inline math)
        // It properly handles multiline content in display math
        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;

        return htmlContent.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            // If it was a $$...$$ match, use display mode, otherwise use inline mode.
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false, // Prevents crashing on a syntax error
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                return match; // If there's an error, just return the original text
            }
        });
    }, [htmlContent]);

    // Use the same class as the editor for consistent styling
    return <div className="sun-editor-editable" dangerouslySetInnerHTML={{ __html: renderedContent }} />;
};

// A component to render strings containing LaTeX, wrapped in a <span>.
const RenderWithLatex: React.FC<{ text: string | undefined }> = ({ text }) => {
    const renderedHtml = useMemo(() => {
        if (!text) return '';
        // This regex finds $...$ and $$...$$ patterns
        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        // We replace the found patterns with the HTML rendered by KaTeX
        return text.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            // Use displayMode for $$...$$
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false,
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                // In case of an error, return the original string
                return match;
            }
        });
    }, [text]);

    return <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 1000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                if (attempt === retries - 1) {
                    let errorText = `API Error (${response.status}) after ${retries} attempts.`;
                    try {
                        const errJson = await response.json();
                        errorText = errJson?.error?.message || errorText;
                    } catch {}
                    throw new Error(errorText);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
                continue;
            }
            if (!response.ok) {
                let errorText = `API Error (${response.status})`;
                 try { const errJson = await response.json(); errorText = errJson?.error?.message || errorText; } catch { }
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

const parseGeminiResponse = (responseText: string): { text: string | null; error: string | null; } => {
    let textContent: string | null = null;
    let errorMessage: string | null = null;

    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.promptFeedback?.blockReason) {
            errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
            return { text: null, error: errorMessage };
        }
        if (jsonResponse?.candidates?.[0]) {
            const candidate = jsonResponse.candidates[0];
            if (candidate.content?.parts?.[0]?.text) {
                textContent = candidate.content.parts[0].text;
            } else if (candidate.finishReason) {
                 errorMessage = `Response generation stopped: ${candidate.finishReason}.`;
            }
        } else if (jsonResponse?.error?.message) {
             errorMessage = `API Error: ${jsonResponse.error.message}`;
        }
        if (!textContent && !errorMessage) {
            errorMessage = "Sorry, I received an empty or non-standard response format.";
        }
        return { text: textContent, error: errorMessage };
    } catch (err) {
        return { text: null, error: "Error: Could not process AI response (Invalid format)." };
    }
};

interface Note extends FirebaseNoteData {
    id: string;
}

interface UploadProgressState { progress: number; status: string; error: string | null; icon?: React.FC<any>; type?: 'success' | 'error' | 'info'; customStyle?: { backgroundColor?: string; color?: string; border?: string }; }
interface NoteUsage { pdfAi: number; youtube: number; }

interface PodcastSpeakerProfile extends SpeakerProfileForProcessor {
    description: string;
    avatarUrl: string;
    sampleAudioUrl: string;
}

const PREDEFINED_PODCAST_SPEAKERS: PodcastSpeakerProfile[] = [
    {
        id: 'felicity', name: 'Felicity', description: 'Polished, articulate, and easy on the ears.',
        avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/girl%20-%20felicity.jpg?alt=media&token=2515318d-1917-4561-9abb-400285733ef4',
        elevenLabsVoiceId: 'aTbnroHRGIomiKpqAQR8',
        sampleAudioUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/felicity_sample_voice.mp3?alt=media&token=d7c5bef0-cb45-491e-8e36-e792e63133e0'
    },
    {
        id: 'christopher', name: 'Christopher', description: 'Lifelike, expressive, and professionally tuned.',
        avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/boy%20-%20christopher.jpg?alt=media&token=92d53b92-48a7-4b04-826e-bca0a8f0507f',
        elevenLabsVoiceId: 'G17SuINrv2H9FC6nvetn',
        sampleAudioUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/christopher_sample_voice.mp3?alt=media&token=fd0d094a-dbbb-40b3-8019-b8bd1b6c17aa'
    },
];

interface TriggerPodcastRequest {
  noteId: string;
  segments: ProcessedPodcastSegment[];
}

interface TriggerPodcastResponse {
  jobId: string;
  message: string;
}

const firebaseFunctions = getFunctions(app);
const triggerPodcastGenerationFn = httpsCallable<
    TriggerPodcastRequest,
    TriggerPodcastResponse
>(firebaseFunctions, 'triggerPodcastGeneration');

const SimpleModal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string}) => {
    // Lock body scroll when modal is open
    useScrollLock(isOpen);
    
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`bg-[var(--bg-primary)] rounded-lg shadow-xl w-full ${maxWidth} flex flex-col overflow-hidden border border-[var(--border-primary)]`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`flex justify-between items-center p-4 border-b border-[var(--border-primary)]`}>
                    <h2 className={`text-lg font-semibold text-[var(--text-primary)]`}>{title}</h2>
                    <button onClick={onClose} className={`text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] p-1 rounded-full`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};



const UpgradeModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) => {
    if (!isOpen) return null;
    return (
        <SimpleModal isOpen={isOpen} onClose={onClose} title="Premium Feature">
            <div className="text-center">
                <Lock className={`w-16 h-16 mx-auto mb-4 text-[var(--bg-solid-button)]`} />
                <h3 className={`text-xl font-semibold mb-2 text-[var(--text-primary)]`}>Feature Locked</h3>
                <p className={`text-[var(--text-secondary)] text-sm  mb-6`}>
                    This is a Premium feature — upgrade to unlock.
                </p>
                <Link
                    to="/pricing"
                    onClick={onClose}
                    className={`w-full flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-medium bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent-secondary)] text-[var(--text-white)] shadow-md hover:shadow-lg transition-shadow`}
                >
                    {/* --- FIX IS HERE: Added Crown icon --- */}
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Premium
                </Link>
            </div>
        </SimpleModal>
    );
};

const toDateSafe = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value &&
        typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        try {
            return new Timestamp(value.seconds, value.nanoseconds).toDate();
        } catch (e) { console.warn("toDateSafe error converting object:", e); return null; }
    }
    return null;
};

const BADGES_CONFIG_NOTES: { [key: string]: { name: string, description: string, icon: React.FC<any>, unlock_criteria_text: string, condition?: (profile: UserProfileData, notes?: Note[], noteType?: Note['type']) => boolean } } = {
    firstPersonalNote: { name: "Personal Scribe", description: "Created your first personal note.", icon: Pencil, unlock_criteria_text: "Create 1 personal note", condition: (p) => (p.notesCreatedCount || 0) >=1 && (p.notesCreatedCount || 0) - (p.pdfNotesCreatedCount || 0) - (p.youtubeNotesCreatedCount || 0) - (p.aiNotesCreatedCount || 0) >=1 },
    firstPdfNote: { name: "PDF Powerhouse", description: "Processed your first PDF.", icon: CustomPDFIcon, unlock_criteria_text: "Process 1 PDF", condition: (p) => (p.pdfNotesCreatedCount || 0) >= 1 },
    firstYoutubeNote: { name: "Video Virtuoso", description: "Summarized your first YouTube video.", icon: CustomYouTubeIcon, unlock_criteria_text: "Summarize 1 YouTube video", condition: (p) => (p.youtubeNotesCreatedCount || 0) >= 1 },
    firstAiNote: { name: "AI Note Crafter", description: "Created your first AI-processed text note.", icon: Sparkles, unlock_criteria_text: "Create 1 AI text note", condition: (p) => (p.aiNotesCreatedCount || 0) >= 1 },
    fiveNotesCreated: { name: "Note Collector", description: "Created 5 notes in total.", icon: Layers, unlock_criteria_text: "Create 5 notes", condition: (p) => (p.notesCreatedCount || 0) >= 5 },
    twentyFiveNotesCreated: { name: "Note Archivist", description: "Created 25 notes in total.", icon: Briefcase, unlock_criteria_text: "Create 25 notes", condition: (p) => (p.notesCreatedCount || 0) >= 25 },
    firstFlashcardsFromNote: { name: "Note Card Wizard", description: "Generated or added flashcards to a note.", icon: Layers, unlock_criteria_text: "Add flashcards to a note", condition: (p) => (p.noteFlashcardsCreatedCount || 0) >=1 },
    firstChatWithNote: { name: "Note Conversationalist", description: "Used chat with a note.", icon: MessageCircle, unlock_criteria_text: "Chat with a note", condition: (p) => (p.noteChatsStartedCount || 0) >=1 },
    publicNoteSharer: { name: "Public Sharer", description: "Shared a note publicly.", icon: Share2, unlock_criteria_text: "Make a note public"},
    splitViewUser: { name: "Dual Viewer", description: "Used the split view feature.", icon: SplitSquareVertical, unlock_criteria_text: "Use Split View"},
    level5Reached: { name: "Level 5 Voyager", description: "Reached overall level 5.", icon: Award, unlock_criteria_text: "Reach Level 5", condition: (p) => p.level >= 5 },
    level10Reached: { name: "Level 10 Expert", description: "Reached overall level 10.", icon: Crown, unlock_criteria_text: "Reach Level 10", condition: (p) => p.level >= 10 },
    points1k: { name: "Point Collector (1k)", description: "Earned 1,000 total points.", icon: TrendingUp, unlock_criteria_text: "Earn 1,000 Points", condition: (p) => p.points >= 1000 },
    overallStreak3Day: { name: "3-Day Streak", description: "Maintained a 3-day study streak.", icon: Flame, unlock_criteria_text: "3-Day Streak", condition: (p) => (p.overallStreakCount || 0) >= 3 },
};

export function Notes() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userName, setUserName] = useState<string>("User");
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [showNewNoteModal, setShowNewNoteModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({ progress: 0, status: '', error: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'personal' | 'pdf' | 'youtube' | 'audio'>('all');
    const [userTier, setUserTier] = useState<UserTier>('loading');
    const [noteUsage, setNoteUsage] = useState<NoteUsage>({ pdfAi: 0, youtube: 0 });
    const [isSideBySideNoteChatVisible, setIsSideBySideNoteChatVisible] = useState(false);
    const [noteChatSplitRatio, setNoteChatSplitRatio] = useState(60);
    const [isResizingNoteChatSplit, setIsResizingNoteChatSplit] = useState(false);
    const [usageMonth, setUsageMonth] = useState<string>('');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('isSidebarCollapsed');
        return saved ? JSON.parse(saved) : false;
    });
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const applyTheme = () => {
            const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
            document.body.classList.toggle('dark', !isIlluminateEnabled && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.body.classList.toggle('light', isIlluminateEnabled || !window.matchMedia('(prefers-color-scheme: dark)').matches);
            setIsDarkMode(document.body.classList.contains('dark'));
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

    const [isNotesListHidden, setIsNotesListHidden] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState<string>('');
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
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showNotesProfileModal, setShowNotesProfileModal] = useState(false);
    const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
    const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
    const [showPodcastSection, setShowPodcastSection] = useState(false);

    const [activePodcast, setActivePodcast] = useState<Podcast | null>(null);
    const [isPodcastPlaying, setIsPodcastPlaying] = useState(false);
    const [podcastPlaybackRate, setPodcastPlaybackRate] = useState(1);
    const [podcastVolume, setPodcastVolume] = useState(0.75);
    const [podcastCurrentTime, setPodcastCurrentTime] = useState(0);
    const [podcastDuration, setPodcastDuration] = useState(0);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
    const [isPodcastProcessing, setIsPodcastProcessing] = useState(false);
    const [showPodcastConfigModal, setShowPodcastConfigModal] = useState(false);
    const [showVoiceSelectionModal, setShowVoiceSelectionModal] = useState(false);
    const [speakerSlotToConfigure, setSpeakerSlotToConfigure] = useState<1 | 2 | null>(null);
    const [podcastPlaybackSettings, setPodcastPlaybackSettings] = useState<Podcast['settings']>({
        language: 'en',
        speaker1Id: PREDEFINED_PODCAST_SPEAKERS[0]?.id || null,
        speaker2Id: null,
        length: 'short',
        instructions: '',
    });

    const [questionAnswers, setQuestionAnswers] = useState<{[key: string]: number | null}>({});
    const mainContentAreaRef = useRef<HTMLDivElement>(null);
    const noteContentRef = useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const pdfViewerContainerRef = useRef<HTMLDivElement>(null);
    const [pdfScale, setPdfScale] = useState(1.0);
    const [pdfRotation, setPdfRotation] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfChatSplitRatio, setPdfChatSplitRatio] = useState(65);
    const [isResizingPdfChatSplit, setIsResizingPdfChatSplit] = useState(false);
    const [firstPageNaturalWidth, setFirstPageNaturalWidth] = useState<number | null>(null);
    const [pdfPageInput, setPdfPageInput] = useState<string>(String(currentPage));
    const [selectedPdfText, setSelectedPdfText] = useState<string | null>(null);
    const [highlightButtonPosition, setHighlightButtonPosition] = useState<{ top: number; left: number } | null>(null);
    const [showHighlightButtons, setShowHighlightButtons] = useState(false);
    const [isScreenshotModeActive, setIsScreenshotModeActive] = useState(false);
    const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [screenshotStartPoint, setScreenshotStartPoint] = useState<{ x: number, y: number } | null>(null);
    const targetPdfPageElementRef = useRef<HTMLElement | null>(null);



        // --- ADD THIS NEW STATE AND EFFECT ---


    // Define showToast early to avoid initialization errors
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', icon?: React.FC<any>, customStyle?: { backgroundColor?: string; color?: string; border?: string }) => {
        setUploadProgress({ progress: type === 'success' ? 100 : 0, status: message, error: type === 'error' ? message : null, icon, type, customStyle });
        setTimeout(() => setUploadProgress({ progress: 0, status: '', error: null, icon: undefined, type: undefined, customStyle: undefined }), 3500);
    }, []);



    
    const handlePodcastStop = useCallback(() => {
        const audioEl = audioPlayerRef.current;
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
            audioEl.src = "";
        }
        setIsPodcastPlaying(false);
        setActivePodcast(null);
        setCurrentSegmentIndex(-1);
        setPodcastCurrentTime(0);
        setPodcastDuration(0);
    }, []);

     useEffect(() => {
        const audioEl = audioPlayerRef.current;
        if (!audioEl || !activePodcast) {
            if (audioEl && !audioEl.paused) audioEl.pause();
            return;
        }

        let playPromise: Promise<void> | undefined;

        if (audioEl.src !== activePodcast.combinedUrl) {
            audioEl.src = activePodcast.combinedUrl;
            setPodcastDuration(activePodcast.totalDuration);
            audioEl.load();
            if (isPodcastPlaying) {
                playPromise = audioEl.play();
            }
        } else if (isPodcastPlaying && audioEl.paused) {
            playPromise = audioEl.play();
        }

        if (playPromise) {
            playPromise.catch(e => {
                console.error("Error playing combined audio:", e);
                showToast("Playback error.", "error");
                setIsPodcastPlaying(false);
            });
        }

        const handleTimeUpdate = () => {
            const currentTime = audioEl.currentTime;
            setPodcastCurrentTime(currentTime);

            const activeIndex = activePodcast.segments.findIndex(
                seg => currentTime >= seg.startTime && currentTime < seg.endTime
            );
            
            if (activeIndex !== -1 && activeIndex !== currentSegmentIndex) {
                 setCurrentSegmentIndex(activeIndex);
            }
        };

        const handlePlay = () => setIsPodcastPlaying(true);
        const handlePause = () => setIsPodcastPlaying(false);
        const handleEnded = () => {
            setIsPodcastPlaying(false);
            setCurrentSegmentIndex(-1);
            setPodcastCurrentTime(audioEl.duration || activePodcast.totalDuration);
        };
        const handleError = () => {
            setIsPodcastPlaying(false);
            showToast(`Error playing podcast audio.`, "error");
            handlePodcastStop();
        };

        audioEl.addEventListener('timeupdate', handleTimeUpdate);
        audioEl.addEventListener('play', handlePlay);
        audioEl.addEventListener('pause', handlePause);
        audioEl.addEventListener('ended', handleEnded);
        audioEl.addEventListener('error', handleError);

        return () => {
            audioEl.removeEventListener('timeupdate', handleTimeUpdate);
            audioEl.removeEventListener('play', handlePlay);
            audioEl.removeEventListener('pause', handlePause);
            audioEl.removeEventListener('ended', handleEnded);
            audioEl.removeEventListener('error', handleError);
        };
    }, [activePodcast, isPodcastPlaying, showToast, handlePodcastStop, currentSegmentIndex]);

const handlePodcastPlayPause = () => {
        const audioEl = audioPlayerRef.current;
        if (!audioEl || !activePodcast) return;

        if (audioEl.paused) {
            if (audioEl.currentTime >= activePodcast.totalDuration - 0.1) {
                audioEl.currentTime = 0;
            }
            audioEl.play().catch(e => setIsPodcastPlaying(false));
            setIsPodcastPlaying(true);
        } else {
            audioEl.pause();
            setIsPodcastPlaying(false);
        }
    };

    const handlePodcastSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
        const audioEl = audioPlayerRef.current;
        if (audioEl && activePodcast && activePodcast.segments.length > 0) {
            const newTime = Number(event.target.value);
            audioEl.currentTime = newTime;
            setPodcastCurrentTime(newTime);
        }
    };

const handleSkipForwardSegment = () => {
        if (activePodcast && audioPlayerRef.current) {
            const nextIndex = currentSegmentIndex + 1;
            if (nextIndex < activePodcast.segments.length) {
                audioPlayerRef.current.currentTime = activePodcast.segments[nextIndex].startTime;
                if (!isPodcastPlaying) setIsPodcastPlaying(true);
            } else {
                audioPlayerRef.current.currentTime = activePodcast.totalDuration;
            }
        }
    };
    const handleSkipBackSegment = () => {
        if (activePodcast && audioPlayerRef.current) {
            const currentTime = audioPlayerRef.current.currentTime;
            const currentSegment = activePodcast.segments[currentSegmentIndex];
            if (currentSegment && currentTime > currentSegment.startTime + 2) {
                 audioPlayerRef.current.currentTime = currentSegment.startTime;
            } else {
                const prevIndex = currentSegmentIndex - 1;
                if (prevIndex >= 0) {
                    audioPlayerRef.current.currentTime = activePodcast.segments[prevIndex].startTime;
                } else {
                    audioPlayerRef.current.currentTime = 0;
                }
            }
            if (!isPodcastPlaying) setIsPodcastPlaying(true);
        }
    };


    useEffect(() => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.volume = podcastVolume;
        }
    }, [podcastVolume]);

    useEffect(() => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.playbackRate = podcastPlaybackRate;
        }
    }, [podcastPlaybackRate]);


    const formatPodcastTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleScrollToSection = (sectionId: string) => {
    const scrollContainer = noteContentRef.current;
    if (scrollContainer) {
        const targetElement = scrollContainer.querySelector(`#${sectionId}`) as HTMLElement;
        if (targetElement) {
            // Calculate position relative to the scroll container's viewport
            const topPosition = targetElement.getBoundingClientRect().top;
            const containerTop = scrollContainer.getBoundingClientRect().top;
            const positionInContainer = topPosition - containerTop;

            // Add the current scroll position and subtract a small offset (e.g., 20px)
            const y = scrollContainer.scrollTop + positionInContainer - 20;

            scrollContainer.scrollTo({
                top: y,
                behavior: 'smooth'
            });
        }
    }
};

const handlePodcastToggle = () => {
    if (userTier !== 'premium') {
        setShowUpgradeModal(true);
        return;
    }

    // If the section is currently hidden, we are about to show it.
    // We schedule the scroll to happen right after the state update.
    if (!showPodcastSection) {
        // A small timeout ensures the element is rendered and its animation has started.
        setTimeout(() => {
            const element = document.getElementById('podcast-section-wrapper');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100); 
    }

    setShowPodcastSection(prev => !prev);
};

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setShowNotesListOnMobile(!(selectedNote || isEditing || showPdfViewer || isSideBySideNoteChatVisible || (showSplitView && (splitViewNotes.left || splitViewNotes.right))));
            }
            setIsResizingPdfChatSplit(false);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [selectedNote, isEditing, showPdfViewer, showSplitView, splitViewNotes.left, splitViewNotes.right, isSideBySideNoteChatVisible]);

    useEffect(() => {
        localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    const updateOverallStreakAndCheckBadges = useCallback(async () => {
        if (!user || !userProfile) return;
        try {
            const { newStreakCount, streakBroken } = await updateUserStreak(user.uid, { email: user.email!, displayName: userName });
             if (streakBroken && userProfile.overallStreakCount && userProfile.overallStreakCount > 0) {
                 showToast("Welcome back! Your previous streak was broken.", "info");
            } else if (newStreakCount > (userProfile.overallStreakCount || 0) && newStreakCount > 0) {
                 showToast(`Streak: ${newStreakCount} days!`, "info", Flame);
            }

            const updatedProfileForBadgeCheck = { ...userProfile, overallStreakCount: newStreakCount };
             Object.entries(BADGES_CONFIG_NOTES).forEach(async ([badgeKey, badgeConfig]) => {
                if (badgeKey.includes('overallStreak') && !(userProfile.badges || []).includes(badgeKey) && badgeConfig.condition) {
                     if (badgeConfig.condition(updatedProfileForBadgeCheck)) {
                        await addUserBadge(user.uid, badgeKey, { email: user.email!, displayName: userName });
                        showToast(`Badge Unlocked: ${badgeConfig.name}!`, 'success', badgeConfig.icon);
                    }
                }
            });
        } catch (error) {
            console.error("Error updating streak:", error);
        }
    }, [user, userProfile, userName, showToast]);

    useEffect(() => {
        setLoading(true);
        setUserTier('loading');

        const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
          let unsubProfile = () => {};

          if (firebaseUser) {
            setUser(firebaseUser);
            setUserName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User");

            unsubProfile = onUserProfileSnapshot(firebaseUser.uid, (profile) => {
              if (profile) {
                const hadProfile = !!userProfile;
                setUserProfile(profile);

                determineUserTier(firebaseUser.uid, firebaseUser.email, profile).then(resolvedTier => {
                  setUserTier(resolvedTier);
                  const currentMonthYear = new Date().toISOString().slice(0, 7);
                  setUsageMonth(currentMonthYear);
                  if (resolvedTier !== 'premium') {
                    const usageData = profile.noteUsageByMonth?.[currentMonthYear];
                    setNoteUsage({ pdfAi: usageData?.pdfAi || 0, youtube: usageData?.youtube || 0 });
                  } else {
                    setNoteUsage({ pdfAi: Infinity, youtube: Infinity });
                  }
                });

                if (!hadProfile) {
                    updateOverallStreakAndCheckBadges();
                }

              } else {
                setUserTier('basic');
                setNoteUsage({ pdfAi: 0, youtube: 0 });
                setUsageMonth(new Date().toISOString().slice(0, 7));
              }
            });

          } else {
            // Don't navigate away if there are active processes that could be interrupted
            const hasActiveProcesses = showNewNoteModal || isPodcastProcessing || activePodcast || 
                                      document.querySelector('[data-note-generation="true"]') !== null;
            
            if (!hasActiveProcesses) {
              navigate('/login');
            }
            
            setUser(null);
            setUserName("User");
            setUserProfile(null);
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
            handlePodcastStop();
          }
          setLoading(false);

          return () => unsubProfile();
        });
        
        return () => unsubscribeAuth();
    }, [navigate, handlePodcastStop]);

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

        if (notesList.length > 0 && !selectedNote && !isMobile && !showSplitView) {
            setSelectedNote(notesList[0]);
        }
        
        setSelectedNote(prevSelectedNote => {
            if (!prevSelectedNote) return null;
            const updatedNoteData = notesList.find(n => n.id === prevSelectedNote.id);
            if (!updatedNoteData) {
                if (isEditing) setIsEditing(false);
                return null;
            }

            if (isPodcastProcessing && updatedNoteData.podcasts && updatedNoteData.podcasts.length > (prevSelectedNote.podcasts?.length || 0)) {
                setIsPodcastProcessing(false);
                showToast("Your podcast is ready!", 'success', Check);
                const newestPodcast = updatedNoteData.podcasts.sort((a,b) => toDateSafe(b.createdAt)!.getTime() - toDateSafe(a.createdAt)!.getTime())[0];
                if (newestPodcast) {
                    handlePlayPodcast(newestPodcast);
                    setShowPodcastSection(true);
                }
            }
            
            if (JSON.stringify(prevSelectedNote) !== JSON.stringify(updatedNoteData)) {
                return updatedNoteData;
            }
            return prevSelectedNote;
        });

        if (activePodcast) {
            const updatedNoteForPodcast = notesList.find(n => n.id === selectedNote?.id);
            if (updatedNoteForPodcast && updatedNoteForPodcast.podcasts) {
                const updatedActivePodcast = updatedNoteForPodcast.podcasts.find(p => p.id === activePodcast.id);
                if (updatedActivePodcast) {
                    if (JSON.stringify(activePodcast) !== JSON.stringify(updatedActivePodcast)) {
                       setActivePodcast(updatedActivePodcast);
                    }
                } else {
                    handlePodcastStop();
                }
            } else {
                handlePodcastStop();
            }
        }


        setChatNoteForOverlay(prevChatNote => {
            if (!prevChatNote) return null;
            const updatedChatNoteData = notesList.find(n => n.id === prevChatNote.id);
            if (!updatedChatNoteData) return null;
            if (JSON.stringify(prevChatNote) !== JSON.stringify(updatedChatNoteData)) {
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
                 if (prevSplitNotes.left?.id !== updatedLeft?.id || prevSplitNotes.right?.id !== updatedRight?.id ||
                     (updatedLeft && JSON.stringify(prevSplitNotes.left) !== JSON.stringify(updatedLeft)) ||
                     (updatedRight && JSON.stringify(prevSplitNotes.right) !== JSON.stringify(updatedRight))
                    ) {
                     return { left: updatedLeft || null, right: updatedRight || null };
                 }
                 return prevSplitNotes;
             });
         }

        setLoading(false);
    }, (error) => {
        console.error("Firestore snapshot error:", error)
        setLoading(false);
        setUploadProgress({ progress: 0, status: '', error: 'Could not load notes.' });
    });
    return () => unsubscribe();
}, [user?.uid, isPodcastProcessing]);

    // Handle navigation state from Dashboard suggestions
    useEffect(() => {
        if (!location.state) return;
        
        const state = location.state as any;
        
        // Handle search term from Dashboard suggestions
        if (state.autoSearch && state.searchTerm) {
            setSearchQuery(state.searchTerm);
        }
        
        // Handle specific note targeting
        if (state.targetNoteId && notes.length > 0) {
            const targetNote = notes.find(note => note.id === state.targetNoteId);
            if (targetNote) {
                setSelectedNote(targetNote);
                // If we found the specific note, clear the search to focus on it
                setSearchQuery('');
            }
        }
        
        // Handle navigation from created notes
        if (state.noteId && notes.length > 0) {
            const createdNote = notes.find(note => note.id === state.noteId);
            if (createdNote) {
                setSelectedNote(createdNote);
                setSearchQuery('');
            }
        }
        
        // Handle opening new note modal
        if (state.openNewNoteModal) {
            setShowNewNoteModal(true);
        }
        
        // Clear the navigation state after processing to prevent re-triggering
        if (Object.keys(state).length > 0) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [location.state, notes]);

    useEffect(() => {
        if (!showPdfViewer && mainContentAreaRef.current) {
            mainContentAreaRef.current.scrollTop = 0;
        }
         if (noteContentRef.current && selectedNote && !isEditing) {
            noteContentRef.current.scrollTop = 0;
        }
    }, [selectedNote?.id, showPdfViewer, isEditing]);


    useEffect(() => {
        if (!showPdfViewer) {
            setNumPages(null);
            setPdfError(null);
            setPdfRotation(0);
            setCurrentPage(1);
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            setHighlightButtonPosition(null);
            setIsScreenshotModeActive(false);
            setSelectionRect(null);
            setScreenshotStartPoint(null);
            targetPdfPageElementRef.current = null;
            window.getSelection()?.removeAllRanges();
        }
    }, [showPdfViewer]);

    useEffect(() => {
        if (!showPdfViewer || !selectedNote || selectedNote.type !== 'pdf' || !selectedNote.sourceUrl) {
            setFirstPageNaturalWidth(null);
        } else {
            setFirstPageNaturalWidth(null);
        }
    }, [showPdfViewer, selectedNote?.id, selectedNote?.sourceUrl, selectedNote?.type]);

    useEffect(() => {
        setPdfPageInput(String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showHighlightButtons && highlightButtonPosition) {
                const target = event.target as Element;
                if (!target.closest('.highlight-buttons-container') && !target.closest('.react-pdf__Page__textContent')) {
                    setShowHighlightButtons(false);
                    setSelectedPdfText(null);
                    setHighlightButtonPosition(null);
                }
            }
        };
        if (showPdfViewer && !isScreenshotModeActive) {
             document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHighlightButtons, highlightButtonPosition, showPdfViewer, isScreenshotModeActive]);


    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingPdfChatSplit || !firstPageNaturalWidth) return;

        const mainContentArea = pdfViewerContainerRef.current?.parentElement?.parentElement;
        if (!mainContentArea) return;

        const bounds = mainContentArea.getBoundingClientRect();
        const resizerWidth = 6;

        let newPdfPixelWidth = e.clientX - bounds.left;

        const minPanelWidth = 150;
        const minChatWidth = isMobile ? 100 : 200;

        newPdfPixelWidth = Math.max(minPanelWidth, newPdfPixelWidth);
        newPdfPixelWidth = Math.min(bounds.width - resizerWidth - minChatWidth, newPdfPixelWidth);

        let newRatio = (newPdfPixelWidth / (bounds.width - resizerWidth)) * 100;
        newRatio = Math.max(20, Math.min(80, newRatio));

        setPdfChatSplitRatio(newRatio);

        const pdfPanelWidth = (newRatio / 100) * (bounds.width - resizerWidth);

        const SCROLLBAR_WIDTH_ESTIMATE = 17;
        const targetPageDisplayWidth = pdfPanelWidth - SCROLLBAR_WIDTH_ESTIMATE;

        if (firstPageNaturalWidth > 0 && targetPageDisplayWidth > 0) {
            const newScale = targetPageDisplayWidth / firstPageNaturalWidth;
            setPdfScale(Math.max(0.15, Math.min(5.0, newScale)));
        }
    }, [isResizingPdfChatSplit, firstPageNaturalWidth, isMobile]);

    const handleResizeMouseUp = useCallback(() => {
         if (isResizingPdfChatSplit) {
             setIsResizingPdfChatSplit(false);
             document.removeEventListener('mousemove', handleResizeMouseMove);
             document.removeEventListener('mouseup', handleResizeMouseUp);
             document.body.style.cursor = 'default';
             document.body.style.userSelect = 'auto';
         }
    }, [isResizingPdfChatSplit, handleResizeMouseMove]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsResizingPdfChatSplit(true);
        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [handleResizeMouseMove, handleResizeMouseUp]);

    useEffect(() => {
        const currentMouseMove = handleResizeMouseMove;
        const currentMouseUp = handleResizeMouseUp;
        return () => {
            document.removeEventListener('mousemove', currentMouseMove);
            document.removeEventListener('mouseup', currentMouseUp);
            if (isResizingPdfChatSplit) {
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        };
    }, [handleResizeMouseMove, handleResizeMouseUp, isResizingPdfChatSplit]);

    const addPointsAndCheckBadges = useCallback(async (points: number, noteType?: Note['type']) => {
        if (!user || !userProfile) return;
        try {
            const { newPoints, newLevel, newTier } = await updateUserPointsAndLevel(user.uid, points, { email: user.email!, displayName: userName });
            if (points > 0) showToast(`+${points} Points!`, 'info', TrendingUp);
            if (newLevel > userProfile.level) showToast(`Level Up! You reached Level ${newLevel}!`, 'success', Award);
            if (newTier === 'premium' && userTier !== 'premium' && (!userProfile.premiumAwardedUntil || (toDateSafe(userProfile.premiumAwardedUntil) || new Date(0)) < new Date())) {
                showToast(`🎉 You've earned 1 FREE week of Premium!`, 'success', Crown);
            }

            const updatedProfileForBadgeCheck = { ...userProfile, points: newPoints, level: newLevel };
            Object.entries(BADGES_CONFIG_NOTES).forEach(async ([badgeKey, badgeConfig]) => {
                if (!(userProfile.badges || []).includes(badgeKey) && badgeConfig.condition) {
                     if (badgeConfig.condition(updatedProfileForBadgeCheck, notes, noteType)) {
                        await addUserBadge(user.uid, badgeKey, { email: user.email!, displayName: userName });
                        showToast(`Badge Unlocked: ${badgeConfig.name}!`, 'success', badgeConfig.icon);
                    }
                }
            });
        } catch (error) {
            console.error("Error updating points/badges:", error);
            showToast("Failed to update points.", "error");
        }
    }, [user, userProfile, userName, notes, userTier, showToast]);


    const checkNoteLimit = (noteType: 'pdfAi' | 'youtube'): boolean => {
        if (userTier === 'loading') {
            showToast('Verifying account status...', 'info');
            return false;
        }
        if (userTier === 'premium') return true;

        const limits = NOTE_LIMITS[userTier];
        const currentCount = userProfile?.noteUsageByMonth?.[usageMonth]?.[noteType] ?? 0;
        const limit = limits[noteType];

        if (currentCount >= limit) {
            const typeName = noteType === 'pdfAi' ? 'PDF/AI Text Note' : 'YouTube Note';
            showToast(`Monthly ${typeName} limit (${limit}) reached for ${userTier} plan.`, 'error');
            return false;
        }
        return true;
    };

    const incrementUsageAndCounters = async (noteTypeToIncrement: 'pdfAi' | 'youtube' | 'personal', isNewAiNote: boolean = false) => {
        if (!user?.uid) return;
        if (noteTypeToIncrement !== 'personal') {
             await updateUserNoteUsage(user.uid, noteTypeToIncrement, usageMonth);
        }
        await incrementUserProfileCounter(user.uid, 'notesCreatedCount');
        if (noteTypeToIncrement === 'pdfAi' && !isNewAiNote) await incrementUserProfileCounter(user.uid, 'pdfNotesCreatedCount');
        if (noteTypeToIncrement === 'youtube') await incrementUserProfileCounter(user.uid, 'youtubeNotesCreatedCount');
        if (isNewAiNote) await incrementUserProfileCounter(user.uid, 'aiNotesCreatedCount');
    };


    const handleToggleSidebar = () => setIsSidebarCollapsed(prev => !prev);
    const handleToggleNotesList = useCallback(() => setIsNotesListHidden(prev => !prev), []);

    const togglePdfViewer = useCallback((forceOpen?: boolean) => {
        const turnOn = forceOpen !== undefined ? forceOpen : !showPdfViewer;
        if (turnOn) {
            if (selectedNote?.type === 'pdf' && selectedNote.sourceUrl) {
                if(isSideBySideNoteChatVisible) setIsSideBySideNoteChatVisible(false);
                setShowPdfViewer(true);
                setCurrentPage(1);
                setPdfPageInput('1');
                setPdfRotation(0);
                setShowHighlightButtons(false);
                setSelectedPdfText(null);
                setHighlightButtonPosition(null);
                setIsScreenshotModeActive(false);
                targetPdfPageElementRef.current = null;
                if (activePodcast) handlePodcastStop();

                if (isChatOverlayVisible && chatNoteForOverlay?.id === selectedNote.id) {
                    setIsChatOverlayVisible(false);
                    setChatNoteForOverlay(null);
                }
                if (!isMobile) setIsNotesListHidden(true);
            } else {
                showToast('Cannot view PDF: Note type is not PDF or source is missing.', 'error');
                if (showPdfViewer) setShowPdfViewer(false);
            }
        } else {
            setShowPdfViewer(false);
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            setIsScreenshotModeActive(false);
            targetPdfPageElementRef.current = null;
            window.getSelection()?.removeAllRanges();
            if (!isMobile) {
                setIsNotesListHidden(false);
            }
        }
    }, [selectedNote, showPdfViewer, isChatOverlayVisible, chatNoteForOverlay?.id, isMobile, isNotesListHidden, showToast, activePodcast, handlePodcastStop, isSideBySideNoteChatVisible]);

    const switchToEditMode = useCallback((noteToEdit: Note | null) => {
        if (!noteToEdit) return;
        setEditTitle(noteToEdit.title);
        setEditContent(noteToEdit.content || '');
        setEditTags(noteToEdit.tags || []);
        setEditKeyPoints(noteToEdit.keyPoints || []);
        setEditFlashcards(noteToEdit.flashcards || []);
        setNewTag('');
        setIsEditing(true);
        setSelectedNote(noteToEdit);
        if (isSideBySideNoteChatVisible) setIsSideBySideNoteChatVisible(false);
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
        if (activePodcast) handlePodcastStop();
        if (showSplitView) setShowSplitView(false);
        if (isMobile) setShowNotesListOnMobile(false);
    }, [isChatOverlayVisible, showPdfViewer, togglePdfViewer, activePodcast, showSplitView, isMobile, handlePodcastStop, isSideBySideNoteChatVisible]);

      const handleNoteChatResizeMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingNoteChatSplit || !mainContentAreaRef.current) return;

        const bounds = mainContentAreaRef.current.getBoundingClientRect();
        const resizerWidth = 6;

        let newNotePixelWidth = e.clientX - bounds.left;
        const minPanelWidth = 250; 

        newNotePixelWidth = Math.max(minPanelWidth, newNotePixelWidth);
        newNotePixelWidth = Math.min(bounds.width - resizerWidth - minPanelWidth, newNotePixelWidth);

        let newRatio = (newNotePixelWidth / (bounds.width - resizerWidth)) * 100;
        newRatio = Math.max(20, Math.min(80, newRatio));

        setNoteChatSplitRatio(newRatio);
    }, [isResizingNoteChatSplit]);

    const handleNoteChatResizeMouseUp = useCallback(() => {
         if (isResizingNoteChatSplit) {
             setIsResizingNoteChatSplit(false);
             document.removeEventListener('mousemove', handleNoteChatResizeMouseMove);
             document.removeEventListener('mouseup', handleNoteChatResizeMouseUp);
             document.body.style.cursor = 'default';
             document.body.style.userSelect = 'auto';
         }
    }, [isResizingNoteChatSplit, handleNoteChatResizeMouseMove]);

    const handleNoteChatResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsResizingNoteChatSplit(true);
        document.addEventListener('mousemove', handleNoteChatResizeMouseMove);
        document.addEventListener('mouseup', handleNoteChatResizeMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [handleNoteChatResizeMouseMove, handleNoteChatResizeMouseUp]);

    const handleCloseSideBySideNoteChat = () => {
        setIsSideBySideNoteChatVisible(false);
        setIsNotesListHidden(false); // Explicitly show the list when closing the chat view
    };

    const handleSplitViewSelect = useCallback((note: Note) => {
        if (!splitViewNotes.left) {
            setSplitViewNotes({ ...splitViewNotes, left: note });
        } else if (!splitViewNotes.right && note.id !== splitViewNotes.left?.id) {
            setSplitViewNotes({ ...splitViewNotes, right: note });
            if (isMobile) {
                setShowNotesListOnMobile(false);
            }
        }
        setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        if (showPdfViewer) togglePdfViewer(false);
        if (activePodcast) handlePodcastStop();
        if (user && userProfile && !(userProfile.badges || []).includes('splitViewUser')) {
            addUserBadge(user.uid, 'splitViewUser', { email: user.email!, displayName: userName });
            showToast("Badge Unlocked: Dual Viewer!", "success", SplitSquareVertical);
        }
    }, [splitViewNotes, isMobile, showPdfViewer, togglePdfViewer, activePodcast, user, userProfile, userName, showToast, handlePodcastStop]);

        const handleSelectNote = useCallback((note: Note) => {
        if (selectedNote?.id === note.id && !isEditing && !showSplitView) return;

        setIsEditing(false);
        if (isSideBySideNoteChatVisible) setIsSideBySideNoteChatVisible(false); // Close side-by-side chat
        if (!isMobile && isNotesListHidden && !showPdfViewer) setIsNotesListHidden(false); // Show notes list again
        setIsChatOverlayVisible(false);
        setChatNoteForOverlay(null);
        setQuestionAnswers({});
        setCurrentFlashcardIndex(0);
        setIsFlashcardFlipped(false);
        setShowPodcastSection(false);
        if (activePodcast) handlePodcastStop();

        if (showSplitView) {
             handleSplitViewSelect(note);
        } else {
            setSelectedNote(note);
            if (showPdfViewer && (note.type !== 'pdf' || !note.sourceUrl)) {
                 togglePdfViewer(false);
            }
            if (isMobile) {
                setShowNotesListOnMobile(false);
            }
        }
    }, [selectedNote?.id, showSplitView, isMobile, showPdfViewer, togglePdfViewer, isEditing, handleSplitViewSelect, activePodcast, handlePodcastStop, isSideBySideNoteChatVisible, isNotesListHidden]);

    const startSplitView = useCallback(() => {
        setShowSplitView(true);
        setSelectedNote(null);
        if (isSideBySideNoteChatVisible) setIsSideBySideNoteChatVisible(false);
        if (showPdfViewer) togglePdfViewer(false);
        if (activePodcast) handlePodcastStop();
        if (isChatOverlayVisible) setIsChatOverlayVisible(false);
        setSplitViewNotes({ left: null, right: null });
        if (isMobile) setShowNotesListOnMobile(true);
        if (!isMobile) setIsNotesListHidden(false);
     }, [showPdfViewer, isChatOverlayVisible, isMobile, togglePdfViewer, activePodcast, handlePodcastStop, isSideBySideNoteChatVisible]);

    const closeSplitView = useCallback(() => {
        setShowSplitView(false);
        setSplitViewNotes({ left: null, right: null });
        if (notes.length > 0 && !isMobile) {
            handleSelectNote(notes[0]);
        } else {
            setSelectedNote(null);
        }
        if (isMobile) setShowNotesListOnMobile(true);
        if (!isMobile) setIsNotesListHidden(false);
    }, [notes, isMobile, handleSelectNote]);

       const handleChatWithNote = useCallback((note: Note | null, keepPdfOpen: boolean = false) => {
        if (!note) {
             showToast('Chat requires API key setup.', 'error');
             return;
        }

        if (!showSplitView && selectedNote?.id !== note.id) {
            setSelectedNote(note);
        }
        if (activePodcast) handlePodcastStop();

        const isPdfSideBySide = note.type === 'pdf' && showPdfViewer && !!note.sourceUrl && !isMobile;
        
        if (isPdfSideBySide && keepPdfOpen) {
            setIsChatOverlayVisible(false);
            setChatNoteForOverlay(null);
            noteChatRef.current?.focusInput?.();
        } else if (!isMobile) {
            // --- FIX IS HERE: Enable the new side-by-side view for notes ---
            setIsSideBySideNoteChatVisible(true);
            setIsNotesListHidden(true); // Hide note list to make space
            setIsChatOverlayVisible(false); // Disable old overlay
            setChatNoteForOverlay(null);
        }
        else {
            // Mobile devices will still use the overlay
            setChatNoteForOverlay(note);
            setIsChatOverlayVisible(true);
            if (showPdfViewer) {
                togglePdfViewer(false);
            }
            if (isMobile) {
                setShowNotesListOnMobile(false);
            }
            setTimeout(() => noteChatRef.current?.focusInput?.(), 150);
        }

        if (user && userProfile && !(userProfile.badges || []).includes('firstChatWithNote')) {
            incrementUserProfileCounter(user.uid, 'noteChatsStartedCount');
            addUserBadge(user.uid, 'firstChatWithNote', { email: user.email!, displayName: userName });
            showToast("Badge Unlocked: Note Conversationalist!", "success", MessageCircle);
        }
    }, [selectedNote?.id, showSplitView, showPdfViewer, isMobile, togglePdfViewer, user, userProfile, userName, showToast, activePodcast, handlePodcastStop]);


    const handleCloseChatOverlay = useCallback(() => setIsChatOverlayVisible(false), []);

    const handleUpdateNoteContentFromChat = useCallback(async (noteId: string, newContent: string) => {
        if (!user || isSaving) return;
        setIsSaving(true);
        showToast('Updating via chat...', 'info');
        try {
            await updateNote(noteId, { content: newContent, updatedAt: Timestamp.now() });
            showToast('Updated via chat!', 'success', Check);
        } catch (error) {
            showToast('Failed to update note via chat.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [user, isSaving, showToast]);

    const handleAddImageToNoteRequest = useCallback((imageData: ChatImageData) => {
        const targetNote = isEditing ? selectedNote : (chatNoteForOverlay || selectedNote);
        if (!targetNote) {
            return;
        }
        const markdownImageTag = `<p><img src="data:${imageData.type};base64,${imageData.base64}" alt="Generated Image"></p>`;
        if (isEditing && selectedNote?.id === targetNote.id) {
            setEditContent(prevContent => (prevContent || '') + markdownImageTag);
        } else {
            switchToEditMode(targetNote);
            setTimeout(() => {
                setEditContent(prevContent => (prevContent || '') + markdownImageTag);
            }, 50);
        }
        if (isChatOverlayVisible) handleCloseChatOverlay();
    }, [selectedNote, isEditing, chatNoteForOverlay, switchToEditMode, isChatOverlayVisible, handleCloseChatOverlay]);

    const handleEditNote = useCallback(() => {
        if (!selectedNote) return;
        switchToEditMode(selectedNote);
    }, [selectedNote, switchToEditMode]);

    const handleSaveEdit = async () => {
        if (!selectedNote || !editTitle.trim() || isSaving) return;
        setIsSaving(true);
        showToast('Saving...', 'info');
        try {
            const finalKeyPoints = editKeyPoints.map(p => p.trim()).filter(p => p.length > 0);
            const finalFlashcards = editFlashcards.filter(fc => fc.front.trim().length > 0 && fc.back.trim().length > 0);

            const updatedData: Partial<Omit<FirebaseNoteData, 'id'|'userId'|'createdAt'|'type'>> & { updatedAt: Timestamp } = {
                title: editTitle.trim(),
                content: (editContent || "").trim(),
                tags: editTags,
                keyPoints: finalKeyPoints.length > 0 ? finalKeyPoints : undefined,
                flashcards: finalFlashcards.length > 0 ? finalFlashcards : undefined,
                updatedAt: Timestamp.now()
            };
            await updateNote(selectedNote.id, updatedData);
            setIsEditing(false);
            showToast('Saved!', 'success', Check);
            addPointsAndCheckBadges(1);

            if (user && userProfile && finalFlashcards.length > (selectedNote.flashcards?.length || 0) && !(userProfile.badges || []).includes('firstFlashcardsFromNote')) {
                 incrementUserProfileCounter(user.uid, 'noteFlashcardsCreatedCount');
                 addUserBadge(user.uid, 'firstFlashcardsFromNote', { email: user.email!, displayName: userName });
                 showToast("Badge Unlocked: Note Card Wizard!", "success", Layers);
            }

        } catch (error) {
            showToast('Failed to save note', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = useCallback(async (noteId: string) => {
        if (!window.confirm('Are you sure you want to delete this note? This cannot be undone.')) return;
        showToast('Deleting...', 'info');
        try {
            await deleteNote(noteId);
            if (selectedNote?.id === noteId) {
                 setSelectedNote(null);
                 setIsEditing(false);
                 if (showPdfViewer) togglePdfViewer(false);
                 if (activePodcast) handlePodcastStop();
            }
            if (chatNoteForOverlay?.id === noteId) {
                 handleCloseChatOverlay();
                 setChatNoteForOverlay(null);
            }
            if (splitViewNotes.left?.id === noteId || splitViewNotes.right?.id === noteId) {
                 const uLeft = splitViewNotes.left?.id === noteId ? null : splitViewNotes.left;
                 const uRight = splitViewNotes.right?.id === noteId ? null : splitViewNotes.right;
                 setSplitViewNotes({ left: uLeft, right: uRight });
                 if (showSplitView && !uLeft && !uRight) closeSplitView();
                 else if (showSplitView && (!uLeft || !uRight) && isMobile) setShowNotesListOnMobile(true);
            }
            showToast('Deleted!', 'success', Check);
        } catch (error) {
            showToast('Failed to delete note', 'error');
        }
    }, [selectedNote?.id, showPdfViewer, chatNoteForOverlay?.id, splitViewNotes, showSplitView, isMobile, togglePdfViewer, handleCloseChatOverlay, closeSplitView, showToast, activePodcast, handlePodcastStop]);

    const handleTogglePublic = async (noteId: string, currentIsPublic: boolean) => {
        showToast('Updating visibility...', 'info');
        try {
            await toggleNotePublicStatus(noteId, !currentIsPublic);
            showToast('Visibility updated!', 'success', Check);
            if (currentIsPublic) setLinkCopied(false);

            if (user && userProfile && !currentIsPublic && !(userProfile.badges || []).includes('publicNoteSharer')) {
                addUserBadge(user.uid, 'publicNoteSharer', { email: user.email!, displayName: userName });
                showToast("Badge Unlocked: Public Sharer!", "success", Share2);
            }

        } catch (error) {
            showToast('Failed to update note visibility', 'error');
        }
    };

    const handleGetShareLink = (noteId: string) => {
        const shareUrl = `${window.location.origin}/public-note/${noteId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); })
            .catch(err => {
                showToast('Could not copy link.', 'error');
            });
    };

    const handleCancelEdit = () => { setIsEditing(false); };

    const handleCreatePersonalNote = async (title: string, content: string, tags: string[]) => {
        if (!user) return;
        showToast('Creating note...', 'info');
        try {
            const newNoteId = await savePersonalNote(user.uid, title, content, tags);
            await incrementUsageAndCounters('personal');
            const newNoteDoc = await getNoteById(newNoteId);
            if (newNoteDoc) {
                handleSelectNote(newNoteDoc as Note);
            }
            showToast('Note created!', 'success', Check);
            addPointsAndCheckBadges(2, 'personal');
            if (user && userProfile && !(userProfile.badges || []).includes('firstPersonalNote')) {
                addUserBadge(user.uid, 'firstPersonalNote', { email: user.email!, displayName: userName });
                 showToast("Badge Unlocked: Personal Scribe!", "success", Pencil);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showToast(`Failed to create note: ${errorMessage}`, 'error');
            throw error;
        }
    };



   const handleCreateAINote = async (text: string, onProgress: (progress: number) => void) => {
    if (!user) { throw new Error('AI features not available.'); }
    if (!checkNoteLimit('pdfAi')) { throw new Error('AI note creation limit reached.'); }
    
    try {
        const aiNoteData = await processTextToAINoteData(text, user.uid, onProgress);
        const newNoteId = await saveNote({ ...aiNoteData, isPublic: false });
        
        await incrementUsageAndCounters('pdfAi', true);
        const newNoteDoc = await getNoteById(newNoteId);
        if (newNoteDoc) { handleSelectNote(newNoteDoc as Note); }
        
        showToast('AI Note Created!', 'success', Sparkles);
        addPointsAndCheckBadges(5, 'personal');
        if (user && userProfile && !(userProfile.badges || []).includes('firstAiNote')) {
            addUserBadge(user.uid, 'firstAiNote', { email: user.email!, displayName: userName });
            showToast("Badge Unlocked: AI Note Crafter!", "success", Sparkles);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create AI note';
        showToast(errorMessage, 'error', AlertTriangle);
        throw error;
    }
};

const handlePDFUpload = async (file: File, onProgress: (progress: number) => void) => {
    if (!user) { throw new Error('AI features not available.'); }
    if (!checkNoteLimit('pdfAi')) { throw new Error('PDF processing limit reached.'); }

    try {
        const processedData: ProcessedPDF = await processPDF(file, user.uid, onProgress);
        
        const noteToSave: Omit<FirebaseNoteData, 'id' | 'createdAt' | 'updatedAt'> = {
            title: processedData.title,
            content: processedData.content,
            keyPoints: processedData.keyPoints,
            questions: processedData.questions,
            flashcards: processedData.flashcards,
            type: 'pdf',
            sourceUrl: processedData.sourceUrl,
            isPublic: false,
            tags: [],
            userId: user.uid,
        };
        const newNoteId = await saveNote(noteToSave);

        await incrementUsageAndCounters('pdfAi', true);
        const newNoteDoc = await getNoteById(newNoteId);
        if (newNoteDoc) { handleSelectNote(newNoteDoc as Note); }
        
        showToast('PDF Note Created!', 'success', CustomPDFIcon);
        addPointsAndCheckBadges(5, 'personal');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
        showToast(errorMessage, 'error', AlertTriangle);
        throw error; // Re-throw to be caught by the modal
    }
};


const handleYoutubeLink = async (url: string, onProgress: (progress: number) => void) => {
    if (!user) { throw new Error('AI features not available.'); }
    if (!checkNoteLimit('youtube')) { throw new Error('YouTube processing limit reached.'); }

    try {
        const processedData = await processYouTube(url, user.uid, onProgress);
        
        const noteToSave: Omit<FirebaseNoteData, 'id' | 'createdAt' | 'updatedAt'> = {
            title: processedData.title,
            content: processedData.content,
            keyPoints: processedData.keyPoints,
            questions: processedData.questions,
            flashcards: processedData.flashcards,
            type: 'youtube',
            sourceUrl: processedData.sourceUrl || url,
            isPublic: false,
            tags: [],
            userId: user.uid,
        };
        const newNoteId = await saveNote(noteToSave);

        await incrementUsageAndCounters('youtube', true);
        const newNoteDoc = await getNoteById(newNoteId);
        if (newNoteDoc) { handleSelectNote(newNoteDoc as Note); }

        showToast('YouTube Note Created!', 'success', CustomYouTubeIcon);
        addPointsAndCheckBadges(5, 'youtube');
        if (user && userProfile && !(userProfile.badges || []).includes('firstYoutubeNote')) {
            addUserBadge(user.uid, 'firstYoutubeNote', { email: user.email!, displayName: userName });
            showToast("Badge Unlocked: YouTube Scholar!", "success", CustomYouTubeIcon);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process YouTube link';
        showToast(errorMessage, 'error', AlertTriangle);
        throw error;
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

    const handlePlayPodcast = (podcast: Podcast) => {
        if (activePodcast?.id === podcast.id) {
            handlePodcastPlayPause();
        } else {
            setCurrentSegmentIndex(0);
            setPodcastCurrentTime(0);
            setActivePodcast(podcast);
            setIsPodcastPlaying(true);
        }
    };

    const handleDeletePodcast = async (podcastId: string) => {
        if (!selectedNote || !window.confirm("Are you sure you want to delete this podcast?")) return;
        if (activePodcast?.id === podcastId) {
            handlePodcastStop();
        }
        try {
            await deletePodcastFromNote(selectedNote.id, podcastId);
            showToast("Podcast deleted.", "success", Check);
        } catch (error) {
            showToast("Failed to delete podcast.", "error");
        }
    };

    const handleStartAIPodcast = async () => {
    if (!selectedNote) {
        showToast('Please select a note.', 'error'); return;
    }
    if (userTier !== 'premium') {
        setShowUpgradeModal(true); return;
    }

    setShowPodcastConfigModal(false);
    setIsPodcastProcessing(true);
    if (activePodcast) handlePodcastStop();

    try {
        const { title, contentHtml, keyPoints } = podcastTextObjects;

        const speaker1Profile = PREDEFINED_PODCAST_SPEAKERS.find(s => s.id === podcastPlaybackSettings.speaker1Id);
        const speaker2Profile = podcastPlaybackSettings.speaker2Id ? PREDEFINED_PODCAST_SPEAKERS.find(s => s.id === podcastPlaybackSettings.speaker2Id) : null;

        let speakerInstructions = `There is one speaker: [SPEAKER_1].
- **Name**: ${speaker1Profile?.name}
- **Persona**: "${speaker1Profile?.description}"
- **Role**: They are the sole narrator and host. They must embody their persona fully, making the script sound like a captivating monologue or story, not a dry reading.`;
        if (speaker2Profile) {
            speakerInstructions = `There are two speakers. Their interaction is the heart of the podcast. It must be a living, breathing conversation.
- **[SPEAKER_1] (The Host)**:
  - **Name**: ${speaker1Profile?.name}
  - **Persona**: "${speaker1Profile?.description}"
  - **Role**: To steer the conversation, introduce the main ideas, and pose thoughtful questions. They are the anchor of the show.

- **[SPEAKER_2] (The Co-Host)**:
  - **Name**: ${speaker2Profile.name}
  - **Persona**: "${speaker2Profile.description}"
  - **Role**: To be the voice of the listener. They must actively interject with clarifying questions ("So, what you're saying is..."), provide real-world examples, challenge assumptions ("But does that always hold true?"), and offer alternative viewpoints to create a rich, multi-faceted dialogue.`;
        }

        const lengthInstruction = {
            short: "The target length is 'short' (approx. 5-15 minutes). Every line must serve a purpose. Be ruthless in cutting fluff. The goal is maximum impact in minimum time.",
        }[podcastPlaybackSettings.length || 'short'];

        const scriptGenPrompt = `You are a world-class podcast scriptwriter and narrative designer. Your job is not to summarize text, but to transmute it into a deeply engaging and authentic audio experience. You will adhere to every single rule in this prompt with absolute fidelity.

**Your Secret Raw Material (Source Note Content):**
"""
${contentHtml.replace(/<[^>]+>/g, '\n')}
"""

**Core Themes to Weave into the Conversation:**
- ${keyPoints.join('\n- ')}

**DIRECTIVE 1: THE SOUL OF THE SCRIPT - RADICAL AUTHENTICITY**
- **This is a Conversation, Not a Recitation:** The source content is your inspiration, not your script. You must completely re-imagine it as a natural dialogue. The final script should have no trace of its origin as written notes.
- **Embrace Spoken Language:** Use contractions (it's, that's, you're), conversational phrasing, and rhetorical questions. Write for the ear, not the eye.
- **No Monologues:** A speaker should rarely deliver more than 3-4 sentences before the other speaker contributes. The dialogue must be a rapid, engaging volley of ideas. Keep the pace brisk and the exchanges tight.
- **Show, Don't Just Tell:** Instead of stating a fact, have the hosts discuss its implications. Use analogies, stories, and examples to illustrate complex points.

**DIRECTIVE 2: MASTER THE SPEAKER PERSONAS & DYNAMICS**
- ${speakerInstructions}
- **FOR TWO-SPEAKER SCRIPTS:** The interplay is everything. [SPEAKER_2] must not be a passive listener. They should interrupt, question, and push the conversation in new directions. Their lines should sound like genuine reactions to [SPEAKER_1]. For example:
    - "Hang on, let me stop you there. What does that actually mean for someone who isn't an expert?"
    - "That's a great point, and it reminds me of a situation where..."
    - "I'm not sure I totally agree with that. Couldn't you also argue that...?"

**DIRECTIVE 3: THE UNBREAKABLE RULES OF FORMATTING (ZERO TOLERANCE FOR ERRORS)**
- **THE ONE TRUE FORMAT:** Every single line of dialogue MUST start with either \`[SPEAKER_1]:\` or \`[SPEAKER_2]:\`. This is a non-negotiable, absolute rule.
- **VALID TAGS ONLY:** The only tags you are permitted to use are \`[SPEAKER_1]:\` and \`[SPEAKER_2]:\`.
- **NO DEVIATION:** There must be a colon directly after the bracketed tag, followed by a space.
- **OUTPUT MUST BE PURE SCRIPT:** Your entire output must be nothing but the script itself. It must begin with the first speaker tag and end with the last line of dialogue.

**DIRECTIVE 4: A COMPENDIUM OF FORBIDDEN ACTIONS (CRITICAL)**
- **NEVER MENTION THE SOURCE MATERIAL:** The audience must never know this was generated from notes. You are strictly forbidden from using phrases like: "The notes say...", "According to the text...", "The author mentions...", "As we see in the source content...". This breaks the illusion and is an immediate failure.
- **NO IMAGINARY TAGS:** You are forbidden from creating, modifying, or using any speaker tags other than the two specified above. Do not use \`SPEAKER_1_MALE\`, \`[SPEAKER 1]\`, \`Host:\`, or any other variation. This will be considered a critical error.
- **NO METADATA OR EXPLANATIONS:** Do not include a title, scene settings, author notes, sound effect cues (e.g., "[upbeat music]"), or any explanatory text. The response must be 100% raw script.
- **DO NOT ANNOUNCE THE TOPIC:** Avoid openings like, "Welcome to today's podcast on [Topic]." The conversation should start naturally and reveal the topic organically.
- **NO SELF-CORRECTION IN THE OUTPUT:** Do not include phrases like "Oops, let me rephrase that" or notes about your own process.

**DIRECTIVE 5: THE ANATOMY OF A PERFECT PODCAST EPISODE**
1.  **The Hook (First 30 Seconds):** Start in the middle of a thought, with a provocative question, or a bold statement. Grab the listener's attention immediately.
2.  **The Body (The Conversation):** Unfold the key points through a natural, back-and-forth discussion. Use the speaker dynamics to explore the topic from multiple angles. Guide the listener logically from one idea to the next.
3.  **The Landing (The Conclusion):** Don't just stop. Bring the conversation to a satisfying close. Have the speakers summarize the one or two most important takeaways. Leave the listener with a clear, memorable final thought.

**DIRECTIVE 6: LENGTH, PACE, AND USER INSTRUCTIONS**
- **Adhere to Length:** ${lengthInstruction}
- **Pacing is Key:** The script should feel energetic. Vary sentence length. Short, punchy lines create speed; longer, more thoughtful sentences can be used for emphasis.
- **Custom Instructions:** ${podcastPlaybackSettings.instructions || 'None provided. Adhere to the core directives above.'}

**FINAL MANDATE:** Review all directives. Your mission is to produce a flawless script. The formatting must be perfect. The conversation must be authentic. The illusion must not be broken. Generate only the script. Begin now.
`;
        
        const functions = getFunctions();
        const geminiProxyCallable = httpsCallable(functions, 'geminiProxy');
        
        const scriptGenBody = {
            contents: [{ role: "user", parts: [{ text: scriptGenPrompt }] }],
            generationConfig: { temperature: 0.75, maxOutputTokens: 8192, topP: 0.95 }
        };

        const result = await geminiProxyCallable(scriptGenBody);
        const scriptResponseData = result.data as any; // The data is now the direct response from Gemini

        const parsedScriptResult = parseGeminiResponse(JSON.stringify(scriptResponseData));

        if (parsedScriptResult.error || !parsedScriptResult.text) {
            throw new Error(parsedScriptResult.error || "Failed to generate podcast script from note.");
        }
        
        const podcastScript = parsedScriptResult.text;

        const textProcessingResult: PodcastTextProcessResult = await processTextForPodcast(
            podcastScript,
            { id: podcastPlaybackSettings.speaker1Id!, voiceId: speaker1Profile?.elevenLabsVoiceId! },
            speaker2Profile ? { id: podcastPlaybackSettings.speaker2Id!, voiceId: speaker2Profile.elevenLabsVoiceId! } : undefined
        );

        if (textProcessingResult.error || !textProcessingResult.processedSegments) {
            throw new Error(textProcessingResult.error || "Failed to process script for podcast generation.");
        }

        await triggerPodcastGeneration(selectedNote.id, textProcessingResult.processedSegments, podcastPlaybackSettings);
        showToast("Your podcast is being generated!", 'success', Check);

    } catch (error: any) {
        showToast(error.message || "Failed to start podcast generation.", 'error');
    } finally {
        setIsPodcastProcessing(false);
    }
};
const [playingSpeakerSampleId, setPlayingSpeakerSampleId] = useState<string | null>(null);
const [isSamplePlaying, setIsSamplePlaying] = useState(false);
const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

useEffect(() => {
    return () => {
        if (sampleAudioRef.current) {
            sampleAudioRef.current.pause();
            sampleAudioRef.current = null;
        }
    };
}, []);

const handleToggleSpeakerSample = (speaker: PodcastSpeakerProfile) => {
    if (isSamplePlaying && playingSpeakerSampleId === speaker.id && sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        setIsSamplePlaying(false);
    }
    else if (!isSamplePlaying && playingSpeakerSampleId === speaker.id && sampleAudioRef.current) {
        sampleAudioRef.current.play().catch(e => console.error("Error resuming sample audio", e));
        setIsSamplePlaying(true);
    }
    else {
        if (sampleAudioRef.current) {
            sampleAudioRef.current.pause();
        }
        
        if (!speaker.sampleAudioUrl) {
            showToast("No audio sample available for this speaker.", "error");
            return;
        }
        
        const newAudio = new Audio(speaker.sampleAudioUrl);
        sampleAudioRef.current = newAudio;
        newAudio.play().catch(e => {
            console.error("Error playing sample audio:", e);
            showToast("Could not play audio sample.", "error");
        });

        newAudio.onended = () => {
            setIsSamplePlaying(false);
            setPlayingSpeakerSampleId(null);
        };

        setPlayingSpeakerSampleId(speaker.id);
        setIsSamplePlaying(true);
    }
};

useEffect(() => {
    if (!showVoiceSelectionModal && isSamplePlaying) {
        if (sampleAudioRef.current) {
            sampleAudioRef.current.pause();
        }
        setIsSamplePlaying(false);
        setPlayingSpeakerSampleId(null);
    }
}, [showVoiceSelectionModal, isSamplePlaying]);


    const handleRegenerateQuestions = async () => {
        if (!selectedNote || isRegeneratingQuestions || !user) return;

        if (userTier !== 'premium' && !checkNoteLimit('pdfAi')) {
            showToast('Monthly AI Note limit reached.', 'error');
            return;
        }

        setIsRegeneratingQuestions(true);
        showToast('Regenerating questions...', 'info');
        try {
            await regenerateStudyQuestions(selectedNote.id, selectedNote.content);
            setQuestionAnswers({});

            if (userTier !== 'premium') {
                await updateUserNoteUsage(user.uid, 'pdfAi', usageMonth);
            }
            addPointsAndCheckBadges(3);
            showToast('Questions regenerated!', 'success', Check);
        } catch (error) {
            console.error("Error regenerating questions:", error);
            showToast('Failed to regenerate questions.', 'error');
        } finally {
            setIsRegeneratingQuestions(false);
        }
    };

    const handleAnswerSelect = useCallback((questionKey: string, selectedOption: number) => setQuestionAnswers(prev => ({ ...prev, [questionKey]: selectedOption })), []);

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
        setNumPages(nextNumPages);
        setPdfError(null);
        setCurrentPage(1);
        setPdfPageInput('1');
    };
    const onDocumentLoadError = (error: Error) => {
        setPdfError(`Failed to load PDF: ${error.message}. Ensure URL is correct and file is accessible.`);
        setNumPages(null);
        setFirstPageNaturalWidth(null);
    };

    const changePage = (offset: number) => {
      setCurrentPage(prevPage => {
          const newPage = Math.min(Math.max(prevPage + offset, 1), numPages || 1);
          setPdfPageInput(String(newPage));
          return newPage;
      });
    };

    const handlePdfPageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPdfPageInput(e.target.value);
    };

    const handleGoToPage = () => {
        const pageNumber = parseInt(pdfPageInput, 10);
        if (numPages && !isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= numPages) {
            if (pageNumber !== currentPage) {
                setCurrentPage(pageNumber);
            }
        } else {
            setPdfPageInput(String(currentPage));
        }
    };

    const changeScale = (amount: number) => setPdfScale(prevScale => Math.max(0.15, Math.min(5.0, prevScale + amount)));
    const changeRotation = (amount: number) => setPdfRotation(prevRotation => (prevRotation + amount + 360) % 360);

    const handleDownloadPdf = () => {
        if (selectedNote?.sourceUrl && selectedNote.type === 'pdf') {
            window.open(selectedNote.sourceUrl, '_blank');
        } else {
            showToast('No PDF source available for download.', 'error');
        }
    };

    const showSideBySideChat = selectedNote?.type === 'pdf' && showPdfViewer && !!selectedNote.sourceUrl && !!user && !isMobile;

    const handlePdfTextSelection = useCallback(() => {
        if (!pdfViewerContainerRef.current || !showPdfViewer || isScreenshotModeActive) {
            if (showHighlightButtons) setShowHighlightButtons(false);
            return;
        }
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            let commonAncestor = range.commonAncestorContainer;
            if (commonAncestor.nodeType === Node.TEXT_NODE) {
                commonAncestor = commonAncestor.parentElement!;
            }

            if (!(commonAncestor instanceof HTMLElement)) {
                if (showHighlightButtons) {
                    setShowHighlightButtons(false);
                    setSelectedPdfText(null);
                    setHighlightButtonPosition(null);
                }
                return;
            }

            const textLayer = commonAncestor.closest('.react-pdf__Page__textContent');

            if (textLayer && pdfViewerContainerRef.current.contains(textLayer)) {
                const currentSelectedText = selection.toString().trim();
                if (currentSelectedText.length > 2) {
                    setSelectedPdfText(currentSelectedText);
                    const containerRect = pdfViewerContainerRef.current.getBoundingClientRect();
                    const rangeRect = range.getBoundingClientRect();
                    const scrollTop = pdfViewerContainerRef.current.scrollTop;
                    const scrollLeft = pdfViewerContainerRef.current.scrollLeft;

                    let top = rangeRect.top - containerRect.top + scrollTop - 40;
                    let left = rangeRect.left - containerRect.left + scrollLeft + (rangeRect.width / 2);

                    top = Math.max(scrollTop + 5, top);
                    left = Math.max(scrollLeft + 5, left);
                    left = Math.min(left, scrollLeft + containerRect.width - 120);


                    setHighlightButtonPosition({ top, left });
                    setShowHighlightButtons(true);
                    return;
                }
            }
        }
        if (showHighlightButtons) {
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            setHighlightButtonPosition(null);
        }
    }, [showPdfViewer, showHighlightButtons, isScreenshotModeActive]);


    const handleExplainHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote && noteChatRef.current) {
            if (showSideBySideChat) {
                noteChatRef.current.sendMessage(`Explain:\n\n"${selectedPdfText}"`);
            } else {
                handleChatWithNote(selectedNote, true);
                setTimeout(() => {
                    noteChatRef.current?.sendMessage(`Explain:\n\n"${selectedPdfText}"`);
                }, 250);
            }
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
            window.getSelection()?.removeAllRanges();
        }
    }, [selectedPdfText, selectedNote, showSideBySideChat, handleChatWithNote]);

    const handleChatAboutHighlight = useCallback(() => {
        if (selectedPdfText && selectedNote && noteChatRef.current?.addPdfContextSegment) {
            if (showSideBySideChat) {
                noteChatRef.current.addPdfContextSegment(selectedPdfText);
                noteChatRef.current.focusInput?.();
            } else {
                handleChatWithNote(selectedNote, true);
                setTimeout(() => {
                    noteChatRef.current?.addPdfContextSegment?.(selectedPdfText);
                    noteChatRef.current?.focusInput?.();
                }, 250);
            }
            setShowHighlightButtons(false);
            setSelectedPdfText(null);
        }
    }, [selectedPdfText, selectedNote, showSideBySideChat, handleChatWithNote]);

     const handleScreenshotMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isScreenshotModeActive || !pdfViewerContainerRef.current) return;
        const viewerRect = pdfViewerContainerRef.current.getBoundingClientRect();

        const clickedElement = e.target as HTMLElement;
        const pageElement = clickedElement.closest('.react-pdf__Page') as HTMLElement;

        if (!pageElement) {
            targetPdfPageElementRef.current = null;
            setScreenshotStartPoint(null);
            setSelectionRect(null);
            return;
        }
        targetPdfPageElementRef.current = pageElement;


        const x = e.clientX - viewerRect.left;
        const y = e.clientY - viewerRect.top;
        setScreenshotStartPoint({ x, y });
        setSelectionRect({ x, y, width: 0, height: 0 });
    };

    const handleScreenshotMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isScreenshotModeActive || !screenshotStartPoint || !pdfViewerContainerRef.current) return;
        const viewerRect = pdfViewerContainerRef.current.getBoundingClientRect();
        const currentX = e.clientX - viewerRect.left;
        const currentY = e.clientY - viewerRect.top;

        const newRect = {
            x: Math.min(screenshotStartPoint.x, currentX),
            y: Math.min(screenshotStartPoint.y, currentY),
            width: Math.abs(currentX - screenshotStartPoint.x),
            height: Math.abs(currentY - screenshotStartPoint.y),
        };
        setSelectionRect(newRect);
    };

    const handleScreenshotMouseUp = async () => {
        if (!isScreenshotModeActive || !selectionRect || !targetPdfPageElementRef.current || !pdfViewerContainerRef.current || selectionRect.width < 5 || selectionRect.height < 5) {
            setIsScreenshotModeActive(false);
            setSelectionRect(null);
            setScreenshotStartPoint(null);
            targetPdfPageElementRef.current = null;
            return;
        }

        const pageElementToCapture = targetPdfPageElementRef.current;
        const viewerRect = pdfViewerContainerRef.current.getBoundingClientRect();
        const pageRect = pageElementToCapture.getBoundingClientRect();


        const cropX = selectionRect.x - (pageRect.left - viewerRect.left);
        const cropY = selectionRect.y - (pageRect.top - viewerRect.top);


        const pageNumber = Array.from(pdfViewerContainerRef.current.querySelectorAll('.react-pdf__Page')).indexOf(pageElementToCapture) + 1;


        try {
            const canvas = await html2canvas(pageElementToCapture, {
                x: cropX,
                y: cropY,
                width: selectionRect.width,
                height: selectionRect.height,
                scale: window.devicePixelRatio,
                useCORS: true,
                logging: false,
                removeContainer: true,
            });
            const base64Image = canvas.toDataURL('image/png');
            const byteString = atob(base64Image.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/png' });


            if (noteChatRef.current?.addPdfScreenshot) {
                 noteChatRef.current.addPdfScreenshot({
                    name: `pdf_snippet_p${pageNumber}_${Date.now()}.png`,
                    type: 'image/png',
                    size: blob.size,
                    base64Data: base64Image.split(',')[1],
                });
                 if (!showSideBySideChat) {
                    handleChatWithNote(selectedNote, true);
                } else {
                    noteChatRef.current?.focusInput?.();
                }
            }
        } catch (error) {
            showToast('Failed to capture PDF snippet. See console for details.', 'error');
        } finally {
            setIsScreenshotModeActive(false);
            setSelectionRect(null);
            setScreenshotStartPoint(null);
            targetPdfPageElementRef.current = null;
        }
    };

    const currentLimits = userTier === 'loading' ? null : NOTE_LIMITS[userTier];
    const pointsNeededForPremium = userProfile ? Math.max(0, POINTS_FOR_FREE_PREMIUM - (userProfile.points || 0)) : POINTS_FOR_FREE_PREMIUM;


    const formatNoteTypeDisplay = (type: string): string => {
        if (type === 'pdf') return 'PDF';
        if (type === 'youtube') return 'YouTube';
        if (type === 'personal') return 'Personal';
        if (type === 'audio') return 'Audio';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const tagColors = {
        personal: "bg-[var(--status-success)] text-white border-[var(--status-success)]",
        pdf: "bg-[var(--bg-accent)] text-white border-[var(--bg-accent)]",
        youtube: "bg-[var(--status-error)] text-white border-[var(--status-error)]",
        audio: "bg-[var(--status-warning)] text-white border-[var(--status-warning)]",
        public: "bg-[var(--status-info)] text-white border-[var(--status-info)]",
        custom: "bg-[var(--bg-solid-button)] text-white border-[var(--bg-solid-button)]",
    };

    const podcastTextObjects = useMemo(() => {
        if (!selectedNote) return { title: "", contentHtml: "", keyPoints: [] };
        return {
            title: selectedNote.title,
            contentHtml: selectedNote.content || "",
            keyPoints: selectedNote.keyPoints || [],
        };
    }, [selectedNote]);

    return (
        <div className={`flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-clarika selection:bg-[var(--bg-accent)] selection:text-white`}>
      <Sidebar
        userName={userName}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        userProfile={userProfile}
      />
                  <ProfileModal
                isOpen={showNotesProfileModal}
                onClose={() => setShowNotesProfileModal(false)}
                userProfile={userProfile}
                userName={userName}
            />

            {/* --- START OF FIX --- */}
            <main className={`pt-14 md:pt-0 flex-1 flex overflow-hidden transition-all duration-300 ${ isSidebarCollapsed ? 'ml-16 md:ml-20' : 'ml-0 md:ml-64' }`}>
{/* --- END OF FIX --- */}

<div ref={mainContentAreaRef} className={`flex-1 bg-[var(--bg-primary)] relative overflow-hidden`}>

                     {isMobile && !showNotesListOnMobile && !showSideBySideChat && (
                         <div className={`sticky top-0 z-30 p-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/80 backdrop-blur-sm flex items-center justify-between`}>
                             <span className={`text-sm font-medium truncate px-2 text-[var(--text-primary)]`}> {isEditing ? 'Editing Note' : ''} </span>
                          <div className="w-8 h-8 flex items-center justify-center">
                                 {selectedNote && !isEditing && !showPdfViewer && !showSplitView && ( <button onClick={handleEditNote} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Edit note"> <Edit2 className="w-4 h-4" /> </button> )}
                                 {isEditing && ( <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`p-1.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white ${isSaving || !editTitle.trim() ? 'opacity-50 cursor-not-allowed' : ''}`} title="Save Changes"> {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} </button> )}
                             </div>
                         </div>
                    )}

                    {showSplitView && splitViewNotes.left && splitViewNotes.right ? (
                        <SplitView
                            key={`${splitViewNotes.left.id}-${splitViewNotes.right.id}`}
                            leftNote={splitViewNotes.left}
                            rightNote={splitViewNotes.right}
                            onClose={closeSplitView}
                            onTogglePublic={handleTogglePublic}
                            onDelete={handleDeleteNote}
                            onChat={(note) => handleChatWithNote(note)}
                            isIlluminateEnabled={!isDarkMode}
                            isBlackoutEnabled={false}
                        />
                    ) : showSideBySideChat ? (
                        <div className="flex flex-row h-full overflow-hidden">
                             <div
                                className="flex flex-col overflow-hidden relative border-r border-[var(--border-primary)]"
                                style={{ width: `${pdfChatSplitRatio}%` }}
                                onMouseDown={isScreenshotModeActive ? handleScreenshotMouseDown : undefined}
                                onMouseMove={isScreenshotModeActive ? handleScreenshotMouseMove : undefined}
                                onMouseUp={isScreenshotModeActive ? handleScreenshotMouseUp : undefined}
                             >
                                  <div className={`flex-shrink-0 p-1.5 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] flex items-center justify-between gap-1 sticky top-0 z-20`}>
                                      <div className="flex items-center gap-1">
<button
    onClick={() => togglePdfViewer(false)}
    className={`p-1.5 rounded-md flex items-center gap-1 text-xs bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]`}
    title="Go Back"
>
    <ArrowLeft className="w-4 h-4" />
    <span className="hidden sm:inline">Back</span>
</button>
<button
    onClick={() => setIsScreenshotModeActive(!isScreenshotModeActive)}
    className={`p-1.5 rounded-md flex items-center gap-1 text-xs text-white shadow-sm hover:shadow-md transition-colors ${isScreenshotModeActive
        ? 'bg-[var(--status-error)] hover:bg-[var(--status-error)]/80'   // Cancel button color
        : 'bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)]'   // Snip button color
    }`}
    title={isScreenshotModeActive ? "Cancel Screenshot Mode" : "Capture PDF Area"}
>
    <Camera className="w-4 h-4" />
    <span className="hidden sm:inline">{isScreenshotModeActive ? 'Cancel' : 'Snip'}</span>
</button>
                                      </div>
                                      
                                      <div className="flex items-center gap-1 text-xs font-medium">
                                        <span className={`text-xs text-[var(--text-secondary)]`}>Page</span>
                                        <input type="number" value={pdfPageInput} onChange={handlePdfPageInputChange} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGoToPage(); (e.target as HTMLInputElement).blur(); } }} onBlur={handleGoToPage} className={`w-14 text-center bg-[var(--bg-highlight)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs rounded p-1 border border-[var(--border-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)]`} min="1" max={numPages || undefined} disabled={!numPages} aria-label="Current Page Number" />
                                        {numPages != null && <span className={`text-xs text-[var(--text-secondary)]`}>of {numPages}</span>}
                                     </div>
                                     <div className="flex items-center gap-1">
                                        <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
                                        <button onClick={() => changeScale(-0.1)} className={`p-1.5 rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)]`} title="Zoom Out"> <ZoomOut className="w-4 h-4" /> </button>
                                        <span className={`text-xs font-medium px-1 text-[var(--text-secondary)]`}>{Math.round(pdfScale * 100)}%</span>
                                        <button onClick={() => changeScale(0.1)} className={`p-1.5 rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)]`} title="Zoom In"> <ZoomIn className="w-4 h-4" /> </button>
                                        <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
                                        <button onClick={() => changeRotation(-90)} className={`p-1.5 rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)]`} title="Rotate Left"> <RotateCcw className="w-4 h-4 transform -scale-x-100" /> </button>
                                        <button onClick={() => changeRotation(90)} className={`p-1.5 rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)]`} title="Rotate Right"> <RotateCcw className="w-4 h-4" /> </button>
                                        <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
                                        <button onClick={handleDownloadPdf} disabled={!selectedNote?.sourceUrl || selectedNote.type !== 'pdf'} className={`p-1.5 rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)] ${(!selectedNote?.sourceUrl || selectedNote.type !== 'pdf') ? 'opacity-50 cursor-not-allowed' : ''}`} title="Download PDF" > <Download className="w-4 h-4" /> </button>
                                    </div>
                                  </div>
                                  <p className={`flex-shrink-0 text-center text-[10px] p-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 sticky top-[37px] z-[19]`}>
                                    {isScreenshotModeActive ? "Click and drag on a page to select an area for chat." : "Highlight text for Explain/Chat options. Use Camera to Snip PDF area."}
                                  </p>
                                 <div ref={pdfViewerContainerRef} onMouseUp={isScreenshotModeActive ? undefined : handlePdfTextSelection} className={`flex-1 overflow-auto relative bg-[var(--bg-highlight)] ${isScreenshotModeActive ? 'cursor-crosshair' : ''}`} >
                                     {pdfError ? ( <div className="p-6 text-center text-red-500 flex flex-col items-center justify-center h-full"> <AlertTriangle className="w-10 h-10 mb-3" /> <p className="text-sm font-medium">Error Loading PDF</p> <p className="text-xs mt-1">{pdfError}</p> </div>
                                     ) : selectedNote?.sourceUrl ? (
                                        <Document file={selectedNote.sourceUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={<div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>} className="flex flex-col items-center pdf-document pt-4 pb-8" >
                                            {numPages === null && !pdfError ? ( <div className="flex justify-center items-center h-64 pt-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                                            ) : numPages && ( Array.from(new Array(numPages), (el, index) => (
                                                <Page
                                                    key={`page_${index + 1}`}
                                                    pageNumber={index + 1}
                                                    scale={pdfScale}
                                                    rotate={pdfRotation}
                                                    onLoadSuccess={(page) => {
                                                        if (page.pageNumber === 1) { if (!firstPageNaturalWidth || firstPageNaturalWidth !== page.originalWidth) { setFirstPageNaturalWidth(page.originalWidth); const pdfPanel = pdfViewerContainerRef.current?.parentElement; if (pdfPanel && page.originalWidth > 0) { const SCROLLBAR_WIDTH_ESTIMATE = 17; const initialTargetWidth = pdfPanel.clientWidth - SCROLLBAR_WIDTH_ESTIMATE; if (initialTargetWidth > 0) { const initialScale = initialTargetWidth / page.originalWidth; setPdfScale(Math.max(0.15, Math.min(5.0, initialScale))); } } } }
                                                    }}
                                                    renderAnnotationLayer={!isScreenshotModeActive}
                                                    renderTextLayer={!isScreenshotModeActive}
                                                    className="mb-2 shadow-md react-pdf__Page"
                                                    loading={<div className="h-64 flex items-center justify-center text-xs text-[var(--text-muted)]">Loading page {index + 1}...</div>}
                                                />
                                            )))}
                                        </Document>
                                     ) : ( <div className="p-6 text-center text-[var(--text-muted)]">PDF source missing.</div> )}
                                     {isScreenshotModeActive && selectionRect && (
                                        <div style={{ position: 'absolute', border: `2px dashed var(--bg-accent)`, backgroundColor: 'rgba(78, 70, 220, 0.1)', left: selectionRect.x + (pdfViewerContainerRef.current?.scrollLeft || 0), top: selectionRect.y + (pdfViewerContainerRef.current?.scrollTop || 0), width: selectionRect.width, height: selectionRect.height, zIndex: 100, pointerEvents: 'none' }} />
                                     )}
{showHighlightButtons && highlightButtonPosition && (
  <div
    className={`highlight-buttons-container absolute z-20 flex items-center bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl shadow-lg overflow-hidden`}
    style={{
      top: `${highlightButtonPosition.top}px`,
      left: `${highlightButtonPosition.left}px`,
      transform: 'translateX(-50%)'
    }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    <button
      onClick={handleExplainHighlight}
      className={`text-sm px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
    >
      Explain
    </button>
    <div className="w-px self-stretch bg-[var(--border-primary)]"></div>
    <button
      onClick={handleChatAboutHighlight}
      className={`text-sm px-4 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
    >
      Chat
    </button>
  </div>
)}                               </div>
                             </div>
                             <div className={`w-1.5 cursor-col-resize flex items-center justify-center flex-shrink-0 bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] ${isResizingPdfChatSplit ? '!bg-[var(--bg-accent)]' : ''}`} onMouseDown={handleResizeMouseDown} title="Drag to resize panels"><GripVertical className={`w-4 h-4 pointer-events-none text-[var(--text-secondary)]`} /></div>
                             <div className="h-full flex flex-col overflow-hidden" style={{ width: `${100 - pdfChatSplitRatio}%` }}>
                                 {selectedNote && user && ( <NoteChat ref={noteChatRef} key={`chat-inline-${selectedNote.id}`} note={selectedNote} onClose={() => togglePdfViewer(false)} userName={userName} isIlluminateEnabled={!isDarkMode} isBlackoutEnabled={false} isVisible={true} onUpdateNoteContent={handleUpdateNoteContentFromChat} onAddImageToNoteRequest={handleAddImageToNoteRequest} displayMode="inline" userTier={userTier} /> )}
                             </div>
                        </div>
) : isSideBySideNoteChatVisible && selectedNote && !isMobile ? (
    <div className="flex flex-row h-full overflow-hidden">
        <div className="flex flex-col overflow-hidden h-full" style={{ width: `${noteChatSplitRatio}%` }}>
            <div key={`view-split-${selectedNote.id}`} className={`bg-[var(--bg-primary)] flex flex-col overflow-hidden h-full`}>
                <div className={`p-4 md:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between mb-0 gap-3 flex-shrink-0`}>
                    <h1 className={`text-2xl md:text-2xl font-semibold text-[var(--text-primary)] break-words mr-auto pr-4`}>{selectedNote.title || "Untitled"}</h1>
                    <div className={`flex items-center gap-1 flex-shrink-0  rounded-full p-0.5 bg-[var(--bg-primary)]`}>
                        {!isMobile && isNotesListHidden && (
                            <>
                                <button
                                    onClick={handleToggleNotesList}
                                    className={`p-1.5 rounded-full text-[var(--bg-accent)] bg-[var(--bg-accent)]/10 hover:bg-[var(--interactive-hover)]`}
                                    title="Show Notes List"
                                >
                                    <PanelRightOpen className="w-4 h-4" />
                                </button>
                                <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
                            </>
                        )}
                        <button onClick={handleEditNote} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleChatWithNote(selectedNote)} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Chat with AI"><MessageCircle className="w-4 h-4" /></button>
                        {selectedNote.type === 'pdf' && selectedNote.sourceUrl && !isMobile && (
                            <button
                                onClick={() => togglePdfViewer(true)}
                                className={`p-1.5 rounded-full flex items-center gap-1 text-xs font-medium text-white bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)] focus:ring-1 focus:ring-[var(--bg-accent)]/50 transition-colors`}
                                title="View PDF Side-by-Side"
                            >
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline">View PDF</span>
                            </button>
                        )}
                        <button onClick={() => handleTogglePublic(selectedNote.id, selectedNote.isPublic)} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] ${selectedNote.isPublic ? 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30' : ''}`} title={selectedNote.isPublic ? 'Make private' : 'Make public'}>{selectedNote.isPublic ? <Globe className={`w-4 h-4 text-[var(--status-info)]`} /> : <Lock className="w-4 h-4" />}</button>
                        {selectedNote.isPublic && ( <button onClick={() => handleGetShareLink(selectedNote.id)} className={`p-1.5 rounded-full relative text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] ${linkCopied ? 'hover:bg-green-100/50 dark:hover:bg-green-900/30' : ''}`} title="Copy share link">{linkCopied ? <ClipboardCopy className={`w-4 h-4 text-[var(--status-success)]`} /> : <Share2 className="w-4 h-4" />}</button> )}
                        <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
                        <button onClick={() => handleDeleteNote(selectedNote.id)} className={`p-1.5 rounded-full text-[var(--status-error)] hover:bg-[var(--status-error)]/10`} title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                </div>
                <div ref={noteContentRef} className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)] px-4 md:px-6 bg-[var(--bg-primary)]`}>
                    <div className="py-1">
                        <KatexRenderer htmlContent={selectedNote.content} />
                    </div>

                    {selectedNote.keyPoints && selectedNote.keyPoints.length > 0 && (
                        <div className={`mt-8 pt-6 border-t border-[var(--border-primary)]`}>
                            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]`}> <BadgeCheck className={`w-5 h-5 text-[var(--text-primary)]`} /> Key Points </h3>
                            <div className={`space-y-3`}> {selectedNote.keyPoints.map((point, index) => (
                                <div key={index} className="flex items-start p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-sm">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--bg-accent)]/10 text-[var(--bg-accent)] flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">{index + 1}</div>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed"><RenderWithLatex text={point} /></p>
                                </div>
                            ))} </div>
                        </div>
                    )}

                    {selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
                        <div id="flashcards-section" className="my-8 pt-6 border-t border-[var(--border-primary)]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                                    <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Flashcards
                                </h3>
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentFlashcardIndex}
                                    initial={{ opacity: 0, y: isFlashcardFlipped ? -10: 10 }}
                                    animate={{ opacity: 1, y:0 }}
                                    exit={{ opacity: 0, y: isFlashcardFlipped ? 10: -10}}
                                    transition={{ duration: 0.2 }}
                                >
                                    <motion.div
                                        className="relative min-h-[280px] cursor-pointer [perspective:1000px]"
                                        onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                                    >
                                        <motion.div
                                            className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center bg-indigo-500 dark:bg-indigo-700 text-white [backface-visibility:hidden]"
                                            animate={{ rotateX: isFlashcardFlipped ? -180 : 0 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                                        >
                                            <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Term</p>
                                            <p className="text-xl font-medium leading-tight">
                                                <RenderWithLatex text={selectedNote.flashcards[currentFlashcardIndex].front} />
                                            </p>
                                        </motion.div>
                                        <motion.div
                                            className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center bg-purple-500 dark:bg-purple-700 text-white [backface-visibility:hidden] [transform:rotateX(180deg)]"
                                            animate={{ rotateX: isFlashcardFlipped ? 0 : 180 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                                        >
                                            <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Definition</p>
                                            <p className="text-xl font-medium leading-tight">
                                                <RenderWithLatex text={selectedNote.flashcards[currentFlashcardIndex].back} />
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                </motion.div>
                            </AnimatePresence>
                            <div className="flex items-center justify-between mt-4">
                                <button
                                    onClick={() => { setCurrentFlashcardIndex(prev => Math.max(0, prev - 1)); setIsFlashcardFlipped(false); }}
                                    disabled={currentFlashcardIndex === 0}
                                    className="p-2 rounded-full bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                                > <ChevronLeft className="w-5 h-5" /> </button>
                                <span className="text-sm text-[var(--text-secondary)]"> {currentFlashcardIndex + 1} / {selectedNote.flashcards.length} </span>
                                <button
                                    onClick={() => { setCurrentFlashcardIndex(prev => Math.min(selectedNote.flashcards!.length - 1, prev + 1)); setIsFlashcardFlipped(false); }}
                                    disabled={currentFlashcardIndex === selectedNote.flashcards.length - 1}
                                    className="p-2 rounded-full bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                                > <ChevronRight className="w-5 h-5" /> </button>
                            </div>
                            <button onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)} className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]">
                                <FlipIcon className="w-4 h-4" /> Flip Card
                            </button>
                        </div>
                    )}

                    {selectedNote.questions && selectedNote.questions.length > 0 && (
                        <div id="study-questions-section" className={`mt-8 pt-6 border-t border-[var(--border-primary)]`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                                <h3 className={`text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]`}><BookOpen className={`w-5 h-5 text-purple-500 dark:text-purple-400`} />Study Questions</h3>
                                <button onClick={handleRegenerateQuestions} disabled={isRegeneratingQuestions} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${isRegeneratingQuestions ? 'opacity-50 cursor-not-allowed' : ''}`} title="Regenerate"> {isRegeneratingQuestions ? (<> <Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating... </>) : (<> <RefreshCw className="w-3.5 h-3.5" /> Regenerate </>)} </button>
                            </div>
                            <div className="space-y-5">
                                {selectedNote.questions.map((q, index) => {
                                    const key = `${selectedNote?.id}-${index}`;
                                    const answer = questionAnswers[key];
                                    const answered = answer != null;
                                    const isCorrect = answered && answer === q.correctAnswer;
                                    return (
                                        <div key={key} className={`p-4 md:p-5 rounded-xl transition-colors duration-300 ${answered ? (isCorrect ? 'bg-[var(--status-success)]/10' : 'bg-[var(--status-error)]/10') : 'bg-[var(--bg-highlight)]'}`}>
                                            <p className={`text-[var(--text-primary)] font-medium mb-4 leading-relaxed`}>
                                                <span className="text-indigo-500 dark:text-indigo-400 font-semibold mr-2">{index + 1}.</span>
                                                <RenderWithLatex text={q.question} />
                                            </p>
                                            <div className="space-y-3">
                                                {q.options.map((opt, idx) => {
                                                    const sel = answer === idx;
                                                    const cor = idx === q.correctAnswer;

                                                    let stateClasses = '';
                                                    if (answered) {
                                                        if (sel) {
                                                            stateClasses = cor
                                                                ? `bg-[var(--status-success)]/10 text-[var(--status-success)] font-semibold border-[var(--status-success)]/30 cursor-default`
                                                                : `bg-[var(--status-error)]/10 text-[var(--status-error)] font-semibold border-[var(--status-error)]/30 cursor-default`;
                                                        } else if (cor) {
                                                            stateClasses = `bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30 cursor-default`;
                                                        } else {
                                                            stateClasses = `bg-[var(--bg-highlight)] text-[var(--text-muted)] border-transparent cursor-default opacity-70`;
                                                        }
                                                    } else {
                                                        stateClasses = `bg-[var(--bg-primary)] border-[var(--border-primary)] hover:border-[var(--bg-accent)] hover:bg-[var(--interactive-hover)] focus:ring-2 focus:ring-[var(--interactive-focus)] focus:outline-none text-[var(--text-secondary)]`;
                                                    }

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => !answered && handleAnswerSelect(key, idx)}
                                                            disabled={answered}
                                                            className={`w-full text-left p-3 rounded-lg transition-all duration-200 text-sm flex items-center justify-between group border ${stateClasses}`}
                                                        >
                                                            <span><RenderWithLatex text={opt} /></span>
                                                            <div className={`flex-shrink-0 ml-4 w-6 h-6 flex items-center justify-center rounded-full transition-colors
                                                                ${answered && (sel || cor) ? (cor ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30') : 'bg-[var(--bg-highlight)] border-[var(--border-primary)]'}
                                                            `}>
                                                                {answered && sel && (cor ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-600" />)}
                                                                {answered && !sel && cor && <Check className="w-4 h-4 text-green-600" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {answered && q.explanation && (
                                                <div className={`mt-4 p-3 rounded-lg text-sm leading-relaxed ${isCorrect ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]' : 'bg-[var(--status-error)]/10 text-[var(--status-error)]'}`}>
                                                    <strong className="font-semibold">Explanation: </strong><RenderWithLatex text={q.explanation} />
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
        </div>
        <div
            className={`w-1.5 cursor-col-resize flex items-center justify-center flex-shrink-0 bg-[var(--border-primary)] hover:bg-[var(--interactive-hover)] ${isResizingNoteChatSplit ? '!bg-indigo-500' : ''}`}
            onMouseDown={handleNoteChatResizeMouseDown}
            title="Drag to resize panels"
        >
            <GripVertical className={`w-4 h-4 pointer-events-none text-[var(--text-secondary)]`} />
        </div>
        <div className="h-full flex flex-col overflow-hidden border-l border-[var(--border-primary)]" style={{ width: `${100 - noteChatSplitRatio}%` }}>
            {user && (
                <NoteChat
                    ref={noteChatRef}
                    key={`chat-inline-note-${selectedNote.id}`}
                    note={selectedNote}
                    onClose={handleCloseSideBySideNoteChat}
                    userName={userName}
                    isIlluminateEnabled={!isDarkMode}
                    isBlackoutEnabled={false}
                    isVisible={true}
                    onUpdateNoteContent={handleUpdateNoteContentFromChat}
                    onAddImageToNoteRequest={handleAddImageToNoteRequest}
                    displayMode="inline"
                    userTier={userTier}
                />
            )}
        </div>
    </div>
                    ) : (
                        <div className={`h-full`}>
                            {showSplitView && (!splitViewNotes.left || !splitViewNotes.right) ? (
                                <div className={`flex flex-col items-center justify-center bg-[var(--bg-primary)] h-full text-center p-6`}>
                                    <SplitSquareVertical className={`w-12 h-12 text-[var(--text-muted)] mb-4`} />
                                    <h2 className={`text-lg font-semibold text-[var(--text-primary)] mb-2`}>Compare Notes</h2>
                                    <p className={`text-[var(--text-secondary)] text-sm mb-4`}>Select {splitViewNotes.left ? 'one more note' : 'two notes'} from the list.</p>
                                    <p className={`text-xs text-[var(--text-muted)] mb-4`}>Selected: {splitViewNotes.left ? 1 : 0}/2</p>
                                    <button onClick={closeSplitView} className={`bg-[var(--bg-card)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] px-3 py-1.5 rounded-md text-sm`}>Cancel Comparison</button>
                                </div>
                            ) : selectedNote ? (
                                isEditing ? (
                                    <div key={`edit-${selectedNote.id}`} className={`bg-[var(--bg-primary)] flex flex-col h-full`}>
                                        <div className="p-4 pt-5 md:p-6 flex-shrink-0 ">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className={`w-full bg-transparent text-[var(--text-primary)] text-2xl font-semibold focus:outline-none placeholder-[var(--text-muted)] border-none ring-0 focus:ring-0 p-0`}
                                                placeholder="Note title..."
                                            />
                                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                                {editTags.map((tag) => (
                                                    <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${(tagColors as any)[tag] || tagColors.custom}`}>
                                                        {tag}
                                                        <button onClick={() => handleRemoveTag(tag)} className={`hover:opacity-70 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5`} title={`Remove tag "${tag}"`}>
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {editTags.length < 5 && (
                                                    <div className="flex items-center gap-1">
                                                        <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder="Add tag..." className={`bg-[var(--bg-card)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-full px-2.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] w-24`} />
                                                        <button onClick={handleAddTag} className={`bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] px-2 py-0.5 rounded-full text-xs`}>Add</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-grow flex flex-col min-h-0 overflow-y-auto">
                                            <div className="flex-grow" data-color-mode={isDarkMode ? 'dark' : 'light'}>
                                                <SunEditorWrapper
                                                    onChange={setEditContent}
                                                    initialContent={editContent}
                                                />
                                            </div>
                                            <div className="flex-shrink-0 p-4">
                                                <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                                                    <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5 text-[var(--text-primary)]">
                                                        <BadgeCheck className="w-4 h-4 text-[var(--text-primary)]" />
                                                        Key Points
                                                    </h3>
                                                    {editKeyPoints.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {editKeyPoints.map((point, index) => (
                                                                <div key={index} className="group flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] transition-colors">
                                                                    <span className="mt-1.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-700/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[10px] font-semibold">{index + 1}</span>
                                                                    <textarea
                                                                        rows={1}
                                                                        value={point}
                                                                        onChange={(e) => handleKeyPointChange(index, e.target.value)}
                                                                        placeholder={`Key point ${index + 1}`}
                                                                        className="flex-grow bg-[var(--bg-primary)] text-[var(--text-secondary)] placeholder-[var(--text-muted)] text-sm rounded focus:outline-none resize-y min-h-[28px] py-1 leading-relaxed border border-[var(--border-primary)] shadow-sm"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleRemoveKeyPoint(index)}
                                                                        className="mt-0.5 text-[var(--text-muted)] hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        title="Remove Point"
                                                                    >
                                                                        <Trash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--text-muted)] italic">No key points added yet.</p>
                                                    )}
                                                    <button
                                                        onClick={handleAddKeyPoint}
                                                        className="mt-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-700/20 dark:hover:bg-indigo-700/40 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5" /> Add Key Point
                                                    </button>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                                                    <h3 className="text-base font-semibold mb-3 flex items-center gap-1.5 text-[var(--text-primary)]">
                                                        <Layers className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                                                        Flashcards
                                                    </h3>
                                                    {editFlashcards.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {editFlashcards.map((card, index) => (
                                                                <div key={index} className="group relative p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-sm">
                                                                    <span className="absolute top-2 left-2.5 px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 dark:bg-purple-700/40 text-purple-700 dark:text-purple-200 rounded-full">
                                                                        Card {index + 1}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleRemoveFlashcard(index)}
                                                                        className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        title="Remove Card"
                                                                    >
                                                                        <Trash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <div className="space-y-2.5 mt-4">
                                                                        <div>
                                                                            <label htmlFor={`flashcard-front-${index}`} className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5 ml-1">Front</label>
                                                                            <textarea
                                                                                id={`flashcard-front-${index}`}
                                                                                rows={2}
                                                                                value={card.front}
                                                                                onChange={(e) => handleFlashcardChange(index, 'front', e.target.value)}
                                                                                placeholder="Term or question..."
                                                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] placeholder-[var(--text-muted)] text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y min-h-[40px] leading-relaxed"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label htmlFor={`flashcard-back-${index}`} className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5 ml-1">Back</label>
                                                                            <textarea
                                                                                id={`flashcard-back-${index}`}
                                                                                rows={2}
                                                                                value={card.back}
                                                                                onChange={(e) => handleFlashcardChange(index, 'back', e.target.value)}
                                                                                placeholder="Definition or answer..."
                                                                                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] placeholder-[var(--text-muted)] text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y min-h-[40px] leading-relaxed"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--text-muted)] italic">No flashcards added yet.</p>
                                                    )}
                                                    <button
                                                        onClick={handleAddFlashcard}
                                                        className="mt-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-700/20 dark:hover:bg-purple-700/40 text-purple-600 dark:text-purple-300 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                                                    >
                                                        <PlusCircle className="w-3.5 h-3.5" /> Add Flashcard
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`flex justify-end items-center gap-2 p-4  flex-shrink-0 bg-[var(--bg-primary)]`}>
                                            <button onClick={handleCancelEdit} className={`bg-[var(--bg-card)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] px-4 py-1.5 rounded-md text-sm`}>Cancel</button>
                                            <button onClick={handleSaveEdit} disabled={isSaving || !editTitle.trim()} className={`bg-[var(--status-success)] text-white hover:bg-[var(--status-success)]/80 px-4 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${isSaving || !editTitle.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}> {isSaving ? (<> <Loader2 className="w-4 h-4 animate-spin" /> Saving... </>) : (<> <Check className="w-4 h-4" /> Save </>)} </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`view-${selectedNote.id}`} className={`bg-[var(--bg-primary)] flex flex-col overflow-hidden h-full animate-fadeIn`}>
                                        <div className={`p-4 md:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between mb-0 gap-3 flex-shrink-0`}>
                                            <h1 className={`text-2xl md:text-2xl font-semibold text-[var(--text-primary)] break-words mr-auto pr-4`}>{selectedNote.title || "Untitled"}</h1>
<div className={`flex items-center gap-1 flex-shrink-0  rounded-full p-0.5  bg-[var(--bg-primary)]`}>
    {!isMobile && isNotesListHidden && (
        <>
            <button 
                onClick={handleToggleNotesList} 
                className={`p-1.5 rounded-full text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-700/30 hover:bg-indigo-200 dark:hover:bg-indigo-700/50`} 
                title="Show Notes List"
            >
                <PanelRightOpen className="w-4 h-4" />
            </button>
            <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
        </>
    )}
    <button onClick={handleEditNote} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Edit"><Edit2 className="w-4 h-4" /></button>
    <button onClick={() => handleChatWithNote(selectedNote)} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Chat with AI"><MessageCircle className="w-4 h-4" /></button>
    {selectedNote.type === 'pdf' && selectedNote.sourceUrl && !isMobile && (
        <button
            onClick={() => togglePdfViewer(true)}
            className={`p-1.5 rounded-full flex items-center gap-1 text-xs font-medium text-white bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)] focus:ring-1 focus:ring-[var(--bg-accent)]/50 transition-colors`}
            title="View PDF Side-by-Side"
        >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View PDF</span>
        </button>
    )}
    <button onClick={() => handleTogglePublic(selectedNote.id, selectedNote.isPublic)} className={`p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] ${selectedNote.isPublic ? 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30' : ''}`} title={selectedNote.isPublic ? 'Make private' : 'Make public'}>{selectedNote.isPublic ? <Globe className={`w-4 h-4 text-cyan-600 dark:text-cyan-400`} /> : <Lock className="w-4 h-4" />}</button>
                            {selectedNote.isPublic && ( <button onClick={() => handleGetShareLink(selectedNote.id)} className={`p-1.5 rounded-full relative text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] ${linkCopied ? 'hover:bg-green-100/50 dark:hover:bg-green-900/30' : ''}`} title="Copy share link">{linkCopied ? <ClipboardCopy className={`w-4 h-4 text-[var(--status-success)]`} /> : <Share2 className="w-4 h-4" />}</button> )}
    <div className={`w-px h-4 bg-[var(--border-primary)] mx-0.5`}></div>
    <button onClick={() => handleDeleteNote(selectedNote.id)} className={`p-1.5 rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/30`} title="Delete"><Trash2 className="w-4 h-4" /></button>
</div>
                                        </div>
 {/* --- START OF FIX --- */}
<div className={`px-4 md:px-6 mb-4 flex-shrink-0`}>
    {/* Desktop View: Full-width buttons */}
    <div className={`hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}>
        {(selectedNote.questions && selectedNote.questions.length > 0) && (
            <button onClick={() => handleScrollToSection('study-questions-section')} className={`p-3 rounded-lg text-left transition-all duration-150 flex items-center space-x-3 bg-purple-50 dark:bg-purple-700/20 hover:bg-purple-100 dark:hover:bg-purple-700/30 shadow-sm `} >
                <div className={`p-2 rounded-full bg-purple-100 dark:bg-purple-700/30 text-purple-600 dark:text-purple-300`}> <BookOpen className="w-5 h-5" /> </div>
                <div> <span className={`block font-semibold text-sm text-[var(--text-primary)]`}>Quiz</span> <span className={`block text-xs text-[var(--text-secondary)]`}>Test your knowledge</span> </div>
            </button>
        )}
        {(selectedNote.flashcards && selectedNote.flashcards.length > 0) && (
            <button onClick={() => handleScrollToSection('flashcards-section')} className={`p-3 rounded-lg text-left transition-all duration-150 flex items-center space-x-3 bg-indigo-50 dark:bg-indigo-700/20 hover:bg-indigo-100 dark:hover:bg-indigo-700/30 shadow-sm `} >
                <div className={`p-2 rounded-full bg-indigo-100 dark:bg-indigo-700/30 text-indigo-600 dark:text-indigo-300`}> <Layers className="w-5 h-5" /> </div>
                <div> <span className={`block font-semibold text-sm text-[var(--text-primary)]`}>Flashcards</span> <span className={`block text-xs text-[var(--text-secondary)]`}>Review key terms</span> </div>
            </button>
        )}
        <button
            onClick={handlePodcastToggle}
            className={`p-3 rounded-lg text-left transition-all duration-150 flex items-center space-x-3 bg-teal-50 dark:bg-teal-700/20 hover:bg-teal-100 dark:hover:bg-teal-700/30 shadow-sm  ${userTier !== 'premium' ? 'opacity-70' : ''}`}
        >
            <div className={`p-2 rounded-full bg-teal-100 dark:bg-teal-700/30 text-teal-600 dark:text-teal-300`}>
                <PodcastIcon className="w-5 h-5" />
            </div>
            <div>
                <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">Podcast</span>
                    {userTier !== 'premium' && (<Lock className="w-4 h-4 text-[var(--text-muted)] relative translate-y-[-0.5px]" />)}
                </div>
                <span className="block text-xs text-[var(--text-secondary)]">{showPodcastSection ? 'Close Player' : 'Listen to your notes'}</span>
            </div>
        </button>
    </div>

    {/* Mobile View: Icon-only buttons */}
    <div className={`flex sm:hidden items-center justify-center gap-4`}>
        {(selectedNote.questions && selectedNote.questions.length > 0) && (
            <button onClick={() => handleScrollToSection('study-questions-section')} className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center bg-purple-50 dark:bg-purple-700/20 hover:bg-purple-100 dark:hover:bg-purple-700/30 shadow-sm`} title="Quiz">
                <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-300" />
            </button>
        )}
        {(selectedNote.flashcards && selectedNote.flashcards.length > 0) && (
            <button onClick={() => handleScrollToSection('flashcards-section')} className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center bg-indigo-50 dark:bg-indigo-700/20 hover:bg-indigo-100 dark:hover:bg-indigo-700/30 shadow-sm`} title="Flashcards">
                <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </button>
        )}
        <button
            onClick={handlePodcastToggle}
            className={`relative p-3 rounded-full transition-all duration-150 flex items-center justify-center bg-teal-50 dark:bg-teal-700/20 hover:bg-teal-100 dark:hover:bg-teal-700/30 shadow-sm ${userTier !== 'premium' ? 'opacity-70' : ''}`}
            title="Podcast"
        >
            <PodcastIcon className="w-5 h-5 text-teal-600 dark:text-teal-300" />
            {userTier !== 'premium' && (
                <Lock className="w-3 h-3 absolute bottom-1 right-1 bg-white dark:bg-[var(--bg-card)] rounded-full p-0.5 text-[var(--text-muted)]" />
            )}
        </button>
    </div>
</div>
{/* --- END OF FIX --- */}
<div ref={noteContentRef} className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)] px-4 md:px-6 bg-[var(--bg-primary)]`}>
    <AnimatePresence>
    {showPodcastSection && (
        <motion.div
                id="podcast-section-wrapper"
           initial={{ opacity: 0, height: 0 }}
           animate={{ opacity: 1, height: 'auto' }}
           exit={{ opacity: 0, height: 0 }}
           transition={{ duration: 0.3, ease: "easeInOut" }}
           className="overflow-hidden"
        >
        {isPodcastProcessing && (
            <div className="my-6 p-4 rounded-lg bg-[var(--bg-highlight)] text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--text-primary)]">Crafting your podcast...</p>
                <p className="text-xs text-[var(--text-muted)]">This may take 5-10 min. Please wait.</p>
            </div>
        )}
        
        {activePodcast && (
            <div id="podcast-player-section" className="my-6 p-4 rounded-lg shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800 text-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                        <Speaker size={24} className="mr-3 opacity-80" />
                        <h3 className="text-lg font-semibold truncate">{selectedNote.title} - Podcast</h3>
                    </div>
                    <button onClick={handlePodcastStop} className="p-1 text-white/70 hover:text-white rounded-full hover:bg-white/10"><X size={18}/></button>
                </div>

                <audio ref={audioPlayerRef} className="hidden" controls={false} />

                <>
                    <div className="w-full space-y-2 mb-3">
                        <input
                            type="range"
                            min="0"
                            max={podcastDuration || 100}
                            value={podcastCurrentTime}
                            onChange={handlePodcastSeek}
                            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                        />
                        <div className="flex justify-between text-xs opacity-80">
                            <span>{formatPodcastTime(podcastCurrentTime)}</span>
                            <span>{formatPodcastTime(podcastDuration)}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center space-x-4 mb-4">
                       <button onClick={handleSkipBackSegment} className="p-2 opacity-80 hover:opacity-100 transition-opacity" disabled={!activePodcast || (audioPlayerRef.current?.currentTime || 0) < 1} >
                            <SkipBack size={20} />
                        </button>
                        <button onClick={handlePodcastPlayPause} className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors transform hover:scale-105" >
                            {isPodcastPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button onClick={handleSkipForwardSegment} className="p-2 opacity-80 hover:opacity-100 transition-opacity" disabled={!activePodcast || (audioPlayerRef.current?.currentTime || 0) >= activePodcast.totalDuration - 1} >
                            <SkipForward size={20} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-90">
                        <div className="flex items-center space-x-2">
                            {podcastVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            <input
                                type="range" min="0" max="1" step="0.05" value={podcastVolume}
                                onChange={(e) => setPodcastVolume(Number(e.target.value))}
                                className="w-20 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                            />
                        </div>
                        <div className="flex items-center space-x-2 relative group">
                            <span className="px-2 py-0.5 bg-white/20 rounded-md focus:ring-2 focus:ring-white/50">{podcastPlaybackRate}x</span>
                            <select value={podcastPlaybackRate} onChange={(e) => setPodcastPlaybackRate(Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            >
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                    <option key={rate} value={rate}>{rate}x</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </>
            </div>
        )}

        <div id="podcast-list-section" className="mt-1 pt-6 mb-6 border-t border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                    <PodcastIcon className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Podcasts
                </h3>
                <button onClick={() => { if (userTier === 'premium') setShowPodcastConfigModal(true); else setShowUpgradeModal(true); }}
                    className="bg-teal-50 dark:bg-teal-700/20 hover:bg-teal-100 dark:hover:bg-teal-700/30 text-teal-600 dark:text-teal-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                    <PlusCircle className="w-3.5 h-3.5" /> New Podcast {userTier !== 'premium' && <Crown className="w-3 h-3 ml-1" />}
                </button>
            </div>
            {(selectedNote.podcasts?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                    {selectedNote.podcasts!.sort((a, b) => toDateSafe(b.createdAt)!.getTime() - toDateSafe(a.createdAt)!.getTime()).map(p => (
                        <div key={p.id} className="p-3 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button onClick={() => handlePlayPodcast(p)} className="p-2 rounded-full bg-teal-100 dark:bg-teal-700/30 text-teal-600 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-700/50">
                                    {activePodcast?.id === p.id && isPodcastPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                </button>
                                <div>
                                    <p className="text-sm font-medium text-[var(--text-primary)]">
                                        Podcast from {toDateSafe(p.createdAt)?.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {p.settings.speaker2Id ? `${PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker1Id)?.name} & ${PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker2Id)?.name}` : PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker1Id)?.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => handleDeletePodcast(p.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-xs text-[var(--text-muted)] py-1">No podcasts generated for this note yet.</p>
            )}
        </div>
        </motion.div>
    )}
    </AnimatePresence>

    <div className="py-1">
        <KatexRenderer htmlContent={selectedNote.content} />
    </div>


    {selectedNote.keyPoints && selectedNote.keyPoints.length > 0 && (
    <div className={`mt-8 pt-6 border-t border-[var(--border-primary)]`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]`}> <BadgeCheck className={`w-5 h-5 text-[var(--text-primary)]`} /> Key Points </h3>
        <div className={`space-y-3`}> {selectedNote.keyPoints.map((point, index) => (
                         <div key={index} className="flex items-start p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-sm">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-700/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">{index + 1}</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed"><RenderWithLatex text={point} /></p>
            </div>
        ))} </div>
    </div>
    )}

    {selectedNote.flashcards && selectedNote.flashcards.length > 0 && (
        <div id="flashcards-section" className="my-8 pt-6 border-t border-[var(--border-primary)]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                    <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Flashcards
                </h3>
            </div>
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentFlashcardIndex}
                    initial={{ opacity: 0, y: isFlashcardFlipped ? -10: 10 }}
                    animate={{ opacity: 1, y:0 }}
                    exit={{ opacity: 0, y: isFlashcardFlipped ? 10: -10}}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className="relative min-h-[280px] cursor-pointer [perspective:1000px]"
                        onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                    >
                        <motion.div
                            className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center bg-indigo-500 dark:bg-indigo-700 text-white [backface-visibility:hidden]"
                            animate={{ rotateX: isFlashcardFlipped ? -180 : 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                        >
                            <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Term</p>
<p className="text-xl font-medium leading-tight">
    <RenderWithLatex text={selectedNote.flashcards[currentFlashcardIndex].front} />
</p>
                        </motion.div>
                        <motion.div
                            className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center bg-purple-500 dark:bg-purple-700 text-white [backface-visibility:hidden] [transform:rotateX(180deg)]"
                            animate={{ rotateX: isFlashcardFlipped ? 0 : 180 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                        >
                            <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Definition</p>
<p className="text-xl font-medium leading-tight">
    <RenderWithLatex text={selectedNote.flashcards[currentFlashcardIndex].back} />
</p>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
            <div className="flex items-center justify-between mt-4">
                <button
                    onClick={() => { setCurrentFlashcardIndex(prev => Math.max(0, prev - 1)); setIsFlashcardFlipped(false); }}
                    disabled={currentFlashcardIndex === 0}
                    className="p-2 rounded-full bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                > <ChevronLeft className="w-5 h-5" /> </button>
                <span className="text-sm text-[var(--text-secondary)]"> {currentFlashcardIndex + 1} / {selectedNote.flashcards.length} </span>
                <button
                    onClick={() => { setCurrentFlashcardIndex(prev => Math.min(selectedNote.flashcards!.length - 1, prev + 1)); setIsFlashcardFlipped(false); }}
                    disabled={currentFlashcardIndex === selectedNote.flashcards.length - 1}
                    className="p-2 rounded-full bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-secondary)]"
                > <ChevronRight className="w-5 h-5" /> </button>
            </div>
            <button onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)} className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]">
                <FlipIcon className="w-4 h-4" /> Flip Card
            </button>
        </div>
    )}


    {selectedNote.questions && selectedNote.questions.length > 0 && (
    <div id="study-questions-section" className={`mt-8 pt-6 border-t border-[var(--border-primary)]`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h3 className={`text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]`}><BookOpen className={`w-5 h-5 text-purple-500 dark:text-purple-400`} />Study Questions</h3>
            <button onClick={handleRegenerateQuestions} disabled={isRegeneratingQuestions} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 ${isRegeneratingQuestions ? 'opacity-50 cursor-not-allowed' : ''}`} title="Regenerate"> {isRegeneratingQuestions ? (<> <Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating... </>) : (<> <RefreshCw className="w-3.5 h-3.5" /> Regenerate </>)} </button>
        </div>
        <div className="space-y-5">
            {selectedNote.questions.map((q, index) => {
                const key = `${selectedNote?.id}-${index}`;
                const answer = questionAnswers[key];
                const answered = answer != null;
                const isCorrect = answered && answer === q.correctAnswer;
                return (
                    <div key={key} className={`p-4 md:p-5 rounded-xl transition-colors duration-300 ${answered ? (isCorrect ? 'bg-[var(--status-success)]/10' : 'bg-[var(--status-error)]/10') : 'bg-[var(--bg-card)]'}`}>
<p className={`text-[var(--text-primary)] font-medium mb-4 leading-relaxed`}>
    <span className="text-indigo-500 dark:text-indigo-400 font-semibold mr-2">{index + 1}.</span>
    <RenderWithLatex text={q.question} />
</p>
                        <div className="space-y-3">
                            {q.options.map((opt, idx) => {
                                const sel = answer === idx;
                                const cor = idx === q.correctAnswer;

                                let stateClasses = '';
                                if (answered) {
                                    if (sel) {
                                        stateClasses = cor
                                            ? `bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-white font-semibold border-green-300 dark:border-green-500/50 cursor-default`
                                            : `bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-white font-semibold border-red-300 dark:border-red-500/50 cursor-default`;
                                    } else if (cor) {
                                        stateClasses = `bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-white border-green-300 dark:border-green-500/50 cursor-default`;
                                    } else {
                                        stateClasses = `bg-[var(--bg-highlight)] text-[var(--text-muted)] border-transparent cursor-default opacity-70`;
                                    }
                                } else {
                                    stateClasses = `bg-[var(--bg-primary)] border-[var(--border-primary)] hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-[var(--text-secondary)]`;
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => !answered && handleAnswerSelect(key, idx)}
                                        disabled={answered}
                                        className={`w-full text-left p-3 rounded-lg transition-all duration-200 text-sm flex items-center justify-between group border ${stateClasses}`}
                                    >
                                        <span><RenderWithLatex text={opt} /></span>
                                        <div className={`flex-shrink-0 ml-4 w-6 h-6 flex items-center justify-center rounded-full transition-colors
                                            ${answered && (sel || cor) ? (cor ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30') : 'bg-[var(--bg-highlight)] border-[var(--border-primary)]'}
                                        `}>
                                            {answered && sel && (cor ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-600" />)}
                                            {answered && !sel && cor && <Check className="w-4 h-4 text-green-600" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {answered && q.explanation && (
<div className={`mt-4 p-3 rounded-lg text-sm leading-relaxed ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
    <strong className="font-semibold">Explanation: </strong><RenderWithLatex text={q.explanation} />
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
                                <div className={`flex flex-col items-center justify-center bg-[var(--bg-primary)] h-full text-center p-6`}>
                                    <FileQuestion className={`w-12 h-12 text-[var(--text-muted)] mb-4`} />
                                    <h2 className={`text-lg font-semibold text-[var(--text-primary)] mb-2`}>No Note Selected</h2>
                                    <p className={`text-[var(--text-secondary)] text-sm mb-4 max-w-xs whitespace-nowrap`}>Select a note from the list, or create a new one.</p>
                                    <button onClick={() => setShowNewNoteModal(true)} className={`bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent-secondary)] text-[var(--text-white)] px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 mb-2`}>
                                        <Plus className="w-4 h-4" /> Create Note
                                    </button>
                                    {!isMobile && notes.length >= 2 && !showSplitView && (
                                        <button onClick={startSplitView} className={`bg-[var(--bg-card)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}>
                                            <SplitSquareVertical className="w-4 h-4" /> Compare Notes
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                 <div className={` ${!isMobile && !isNotesListHidden ? 'w-full md:w-72 lg:w-80 xl:w-96 ' : 'w-0 hidden'} border-[var(--border-primary)] flex-shrink-0 flex flex-col bg-[var(--bg-sidebar)] transition-all duration-300 ease-in-out relative h-full z-10 order-last `}>
                     {(!isMobile && !isNotesListHidden) && (
                         <>
                         <div className={`p-3  flex items-center justify-between flex-shrink-0`}> <h2 className={`text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2`}>
    <Notebook className={`w-5 h-5 icon-theme-adaptive`} />
    <span>Notes</span>
</h2> <div className="flex items-center gap-1"> <button onClick={handleToggleNotesList} className={`bg-[var(--bg-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)] p-1.5 rounded-full`} title="Hide List"> <PanelLeftClose className="w-4 h-4 transform scale-x-[-1]" /> </button> {notes.length >= 2 && !showPdfViewer && ( <button onClick={showSplitView ? closeSplitView : startSplitView} className={`bg-[var(--bg-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)] p-1.5 rounded-full`} title={showSplitView ? "Close Comparison" : "Compare Notes"}> <SplitSquareVertical className={`w-4 h-4 ${showSplitView ? 'text-[var(--bg-accent)]': ''}`} /> </button> )} <button onClick={() => setShowNewNoteModal(true)} className={`bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent-secondary)] text-[var(--text-white)] p-2 rounded-full hover:shadow-md transition-all duration-150`} title="New Note"> <Plus className="w-4 h-4" /> </button> </div> </div>
                                                  {userTier !== 'premium' && userProfile && pointsNeededForPremium > 0 && (
                            <div className="px-3 pt-2 pb-2 border-b border-[var(--border-primary)]">
                                <div className="p-2 rounded-lg bg-[var(--bg-accent)] border border-[var(--bg-accent)] text-center shadow-sm">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Gift className="w-4 h-4 text-white flex-shrink-0" />
                                        <p className="text-[10px] font-medium text-white leading-tight">
                                            Collect {pointsNeededForPremium} more points to earn <span className="font-semibold text-white">1 FREE week of Premium</span>!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                         <div className={`p-3 border-b border-[var(--border-primary)] flex-shrink-0`}> <div className="relative mb-4"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]`} /> <input type="text" placeholder="Search notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full bg-[var(--bg-highlight)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] focus:border-[var(--interactive-focus)]`} /> </div> <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `bg-[var(--bg-solid-button)] text-[var(--text-white)] shadow-sm` : `bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]`}`}> {formatNoteTypeDisplay(type)} </button> ))} </div> </div>
                         {userTier !== 'premium' && userTier !== 'loading' && currentLimits && ( <div className={`px-3 py-2 text-[10px] border-b border-[var(--border-primary)] text-[var(--text-secondary)] bg-[var(--bg-card)]`}> <div className="flex justify-between items-center gap-2"> <span>PDF/Text Notes: {userProfile?.noteUsageByMonth?.[usageMonth]?.pdfAi ?? 0} / {currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span> <span>YouTube Notes: {userProfile?.noteUsageByMonth?.[usageMonth]?.youtube ?? 0} / {currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span> </div> </div> )}
                         <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)]"> {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin text-[var(--text-muted)]`} /> </div> ) : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 text-[var(--text-muted)] mb-3`} /> <p className={`text-[var(--text-secondary)] mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create Note </button> </div> ) : ( <div className={`divide-y divide-[var(--border-primary)]`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <CustomPDFIcon className="w-3 h-3"/>; break; case 'youtube': typeIcon = <CustomYouTubeIcon className="w-3 h-3"/>; break; case 'audio': typeIcon = <PodcastIcon className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 hover:bg-[var(--interactive-hover)] border-l-2 ${isSelectedAny ? 'bg-indigo-50 dark:bg-indigo-700/20 border-indigo-500 dark:border-indigo-400' : 'border-transparent'}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 text-[var(--text-primary)] flex items-center`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-[var(--bg-accent)] text-[var(--text-white)] border border-[var(--bg-accent)]`}>L</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-[var(--bg-accent-secondary)] text-[var(--text-white)] border border-[var(--bg-accent-secondary)]`}>R</span>} </div> <p className={`text-[var(--text-secondary)] text-xs line-clamp-2 mb-1.5`}>{(note.content || '').replace(/<[^>]+>/g, '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${(tagColors as any)[note.type] || tagColors.custom}`}> {typeIcon} {formatNoteTypeDisplay(note.type)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${tagColors.public}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.filter(t => t !== note.type).slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded-full border ${(tagColors as any)[tag] || tagColors.custom} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.filter(t => t !== note.type).length > 2 && <span className={`px-1.5 py-0.5 rounded-full border ${tagColors.custom}`}>+{note.tags.filter(t => t !== note.type).length - 2}</span>} <span className={`ml-auto text-[var(--text-muted)]`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )} </div>
                         </>
                    )}
                 </div>


                  {isMobile && (
                    <div className={` fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${showNotesListOnMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} `} onClick={() => setShowNotesListOnMobile(false)}>
                        <div className={` absolute top-0 right-0 h-full w-4/5 max-w-sm bg-[var(--bg-sidebar)] border-l border-[var(--border-primary)] shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${showNotesListOnMobile ? 'translate-x-0' : 'translate-x-full'} `} onClick={(e) => e.stopPropagation()}>
                            <div className={`p-3   flex items-center justify-between flex-shrink-0`}>
                                <h2 className={`text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2`}> <FileText className={`w-5 h-5 text-indigo-500 dark:text-indigo-400`} /> Notes </h2>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setShowNewNoteModal(true)} className={`bg-indigo-500 hover:bg-indigo-600 text-white p-1.5 rounded-full hover:shadow-md`} title="New Note"> <Plus className="w-4 h-4" /> </button>
                                    <button onClick={() => setShowNotesListOnMobile(false)} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-muted)] p-1.5 rounded-md`} title="Close List"> <X className="w-4 h-4" /> </button>
                                </div>
                            </div>

                             {userTier !== 'premium' && userProfile && pointsNeededForPremium > 0 && (
                                <div className="px-3 pt-1 pb-1 border-b border-[var(--border-primary)]">
                                    <div className="p-1.5 rounded-lg bg-[var(--bg-accent)] border border-[var(--bg-accent)] text-center shadow-sm">
                                        <div className="flex items-center justify-center gap-1">
                                            <Gift className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                            <p className="text-[9px] font-medium text-white leading-tight">
                                                Collect {pointsNeededForPremium} more points for <span className="font-semibold text-white">1 FREE week of Premium</span>!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className={`p-3 border-b border-[var(--border-primary)] flex-shrink-0`}>
                                <div className="relative mb-4"> <Search className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]`} /> <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] pl-8 pr-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] focus:border-[var(--interactive-focus)]`} /> </div>
                                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"> {(['all', 'personal', 'pdf', 'youtube', 'audio'] as const).map(type => ( <button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-1 text-[11px] rounded-full transition-colors whitespace-nowrap ${filterType === type ? `bg-[var(--bg-solid-button)] text-[var(--text-white)] shadow-sm` : `bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]`}`}> {formatNoteTypeDisplay(type)} </button> ))} </div>
                            </div>
                            {userTier !== 'premium' && userTier !== 'loading' && currentLimits && ( <div className={`px-3 py-2 text-[10px] border-b border-[var(--border-primary)] text-[var(--text-secondary)] bg-[var(--bg-card)]`}> <div className="flex justify-between items-center gap-2"> <span>PDF/AI: {userProfile?.noteUsageByMonth?.[usageMonth]?.pdfAi ?? 0}/{currentLimits.pdfAi === Infinity ? '∞' : currentLimits.pdfAi}</span> <span>YT: {userProfile?.noteUsageByMonth?.[usageMonth]?.youtube ?? 0}/{currentLimits.youtube === Infinity ? '∞' : currentLimits.youtube}</span> </div> </div> )}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)]">
                                {loading && notes.length === 0 ? ( <div className="flex justify-center items-center h-full p-6"> <Loader2 className={`w-6 h-6 animate-spin text-[var(--text-muted)]`} /> </div>
                                ) : !loading && notes.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-center p-6"> <FileQuestion className={`w-12 h-12 text-[var(--text-muted)] mb-3`} /> <p className={`text-[var(--text-secondary)] mb-4 text-sm`}>No notes yet.</p> <button onClick={() => setShowNewNoteModal(true)} className={`bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5`}> <Plus className="w-4 h-4" /> Create </button> </div>
                                ) : ( <div className={`divide-y divide-[var(--border-primary)]`}> {notes.filter((note) => { if (filterType !== 'all' && note.type !== filterType) return false; if (searchQuery) { const search = searchQuery.toLowerCase(); return (note.title.toLowerCase().includes(search) || (note.content || '').toLowerCase().includes(search) || note.tags?.some((tag) => tag.toLowerCase().includes(search))); } return true; }).map((note) => { const isSel = (!showSplitView && selectedNote?.id === note.id); const isSplitL = showSplitView && splitViewNotes.left?.id === note.id; const isSplitR = showSplitView && splitViewNotes.right?.id === note.id; const isSelectedAny = isSel || isSplitL || isSplitR; let typeIcon; switch (note.type) { case 'personal': typeIcon = <Briefcase className="w-3 h-3"/>; break; case 'pdf': typeIcon = <CustomPDFIcon className="w-3 h-3"/>; break; case 'youtube': typeIcon = <CustomYouTubeIcon className="w-3 h-3"/>; break; case 'audio': typeIcon = <PodcastIcon className="w-3 h-3"/>; break; default: typeIcon = null; } return ( <div key={note.id} className={`p-3 cursor-pointer transition-colors duration-150 hover:bg-[var(--interactive-hover)] border-l-2 ${isSelectedAny ? 'bg-indigo-50 dark:bg-indigo-700/20 border-indigo-500 dark:border-indigo-400' : 'border-transparent'}`} onClick={() => handleSelectNote(note)}> <div className="flex justify-between items-start gap-2"> <h3 className={`text-sm font-medium mb-0.5 line-clamp-1 text-[var(--text-primary)] flex items-center`}>{note.title || "Untitled"}</h3> {isSplitL && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-[var(--bg-accent)] text-[var(--text-white)] border border-[var(--bg-accent)]`}>L</span>} {isSplitR && <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium shrink-0 bg-[var(--bg-accent-secondary)] text-[var(--text-white)] border border-[var(--bg-accent-secondary)]`}>R</span>} </div> <p className={`text-[var(--text-secondary)] text-xs line-clamp-2 mb-1.5`}>{(note.content || '').replace(/<[^>]+>/g, '').substring(0, 100)}</p> <div className="flex flex-wrap items-center gap-1 text-[10px]"> <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${(tagColors as any)[note.type] || tagColors.custom}`}> {typeIcon} {formatNoteTypeDisplay(note.type)} </span> {note.isPublic && <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${tagColors.public}`}><Globe className="w-3 h-3"/> Public</span>} {note.tags?.filter(t=>t !== note.type).slice(0, 2).map((tag) => <span key={tag} className={`px-1.5 py-0.5 rounded-full border ${(tagColors as any)[tag] || tagColors.custom} truncate max-w-[60px]`} title={tag}>#{tag}</span>)} {note.tags && note.tags.filter(t=>t !== note.type).length > 2 && <span className={`px-1.5 py-0.5 rounded-full border ${tagColors.custom}`}>+{note.tags.filter(t=>t !== note.type).length - 2}</span>} <span className={`ml-auto text-[var(--text-muted)]`}>{note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> </div> </div> ); })} </div> )}
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {showNewNoteModal && (
                <NewNoteModal
                    onClose={() => setShowNewNoteModal(false)}
                    onCreatePersonalNote={handleCreatePersonalNote}
                    onCreateAINote={handleCreateAINote}
                    onUploadPDF={handlePDFUpload}
                    onYoutubeLink={handleYoutubeLink}
                    isIlluminateEnabled={!isDarkMode}
                    isBlackoutEnabled={false}
                    userTier={userTier}
                    noteUsage={noteUsage}
                />
            )}
            <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
             {showPodcastConfigModal && (
                <SimpleModal isOpen={showPodcastConfigModal} onClose={() => setShowPodcastConfigModal(false)} title="Create New Podcast" maxWidth="max-w-lg">
                    <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                        <p className="text-xs text-[var(--text-muted)] -mt-2">Customize your podcast.</p>
                        <div>
                            <label className="block text-xs font-medium mb-1">Speaker 1:</label>
                            <button
                                onClick={() => { setSpeakerSlotToConfigure(1); setShowVoiceSelectionModal(true); }}
                                className="w-full p-2 border border-[var(--border-primary)] rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-left flex items-center justify-between"
                            >
                                <span>{podcastPlaybackSettings.speaker1Id ? PREDEFINED_PODCAST_SPEAKERS.find(s => s.id === podcastPlaybackSettings.speaker1Id)?.name : "Choose Speaker 1"}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                         <div>
                            <label className="block text-xs font-medium mb-1">Speaker 2:</label>
                            <button
                                onClick={() => { setSpeakerSlotToConfigure(2); setShowVoiceSelectionModal(true); }}
                                className="w-full p-2 border border-[var(--border-primary)] rounded-md bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-left flex items-center justify-between"
                            >
                                <span>{podcastPlaybackSettings.speaker2Id ? PREDEFINED_PODCAST_SPEAKERS.find(s => s.id === podcastPlaybackSettings.speaker2Id)?.name : "Choose Speaker 2"}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                             {podcastPlaybackSettings.speaker2Id && podcastPlaybackSettings.speaker2Id === podcastPlaybackSettings.speaker1Id && (
                                <p className="text-red-500 text-xs mt-1">Speaker 2 cannot be the same as Speaker 1.</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="podcastLength" className="block text-xs font-medium mb-1">Podcast Length:</label>
                            <select
                                id="podcastLength"
                                value={podcastPlaybackSettings.length || 'short'}
                                onChange={(e) => setPodcastPlaybackSettings(prev => ({ ...prev, length: e.target.value as 'short' | 'medium' | 'long' | null }))}
                                className="w-full p-2 border border-[var(--border-primary)] rounded-md bg-[var(--bg-highlight)] text-[var(--text-secondary)] focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="short">Short (5-15 min)</option>
                                <option value="medium" disabled>Medium (15-30 min) - Coming Soon</option>
                                <option value="long" disabled>Long (30+ min) - Coming Soon</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="podcastInstructions" className="block text-xs font-medium mb-1">Special Instructions:</label>
                            <textarea
                                id="podcastInstructions"
                                value={podcastPlaybackSettings.instructions}
                                onChange={(e) => setPodcastPlaybackSettings(prev => ({...prev, instructions: e.target.value}))}
                                rows={3}
                                placeholder="e.g., 'Explain this for a beginner', 'Focus on the historical context', 'Make the tone humorous'"
                                className="w-full p-2 border border-[var(--border-primary)] rounded-md bg-[var(--bg-highlight)] text-[var(--text-secondary)] focus:ring-indigo-500 focus:border-indigo-500 placeholder-[var(--text-muted)] text-xs"
                            />
                        </div>

                        <button
                            onClick={handleStartAIPodcast}
                            disabled={isPodcastProcessing || !podcastPlaybackSettings.speaker1Id || (podcastPlaybackSettings.speaker1Id === podcastPlaybackSettings.speaker2Id && !!podcastPlaybackSettings.speaker2Id) }
                            className={`w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-full transition-colors flex items-center justify-center gap-2 ${(!podcastPlaybackSettings.speaker1Id || isPodcastProcessing || (podcastPlaybackSettings.speaker1Id === podcastPlaybackSettings.speaker2Id && !!podcastPlaybackSettings.speaker2Id) ) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isPodcastProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {isPodcastProcessing ? 'Generating...' : 'Generate Podcast'}
                        </button>
                    </div>
                </SimpleModal>
            )}

            {showVoiceSelectionModal && speakerSlotToConfigure && (
                <SimpleModal isOpen={showVoiceSelectionModal} onClose={() => setShowVoiceSelectionModal(false)} title={`Choose Podcast Speaker ${speakerSlotToConfigure}`} maxWidth="max-w-md">
                    <p className="text-xs text-[var(--text-muted)] -mt-2 mb-3">Hear a sample by clicking the play icon!</p>
                    <div className="space-y-3">
                        {PREDEFINED_PODCAST_SPEAKERS.map(speaker => (
                            <div
                                key={speaker.id}
                                onClick={() => {
                                    if (speakerSlotToConfigure === 1) {
                                        setPodcastPlaybackSettings(prev => ({ ...prev, speaker1Id: speaker.id, ...(prev.speaker2Id === speaker.id && { speaker2Id: null }) }));
                                    } else if (speakerSlotToConfigure === 2) {
                                         setPodcastPlaybackSettings(prev => ({ ...prev, speaker2Id: prev.speaker1Id === speaker.id ? null : speaker.id }));
                                    }
                                    setShowVoiceSelectionModal(false);
                                }}
                                className="p-3 border border-[var(--border-primary)] rounded-lg flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <img src={speaker.avatarUrl} alt={speaker.name} className="w-12 h-12 rounded-full object-cover bg-[var(--bg-highlight)]" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-[var(--text-primary)]">{speaker.name}</h4>
                                    <p className="text-xs text-[var(--text-muted)]">{speaker.description}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleSpeakerSample(speaker); }}
                                    className="p-2 rounded-full hover:bg-[var(--interactive-hover)] text-[var(--text-muted)]"
                                    title={isSamplePlaying && playingSpeakerSampleId === speaker.id ? `Pause sample of ${speaker.name}` : `Play sample of ${speaker.name}`}
                                >
                                    {isSamplePlaying && playingSpeakerSampleId === speaker.id ? (
                                        <Pause className="w-5 h-5" />
                                    ) : (
                                        <Play className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        ))}
                        {speakerSlotToConfigure === 2 && (
                             <button
                                onClick={() => { setPodcastPlaybackSettings(prev => ({ ...prev, speaker2Id: null })); setShowVoiceSelectionModal(false); }}
                                className="w-full mt-2 p-2 border border-dashed border-[var(--border-primary)] rounded-md text-[var(--text-muted)] hover:bg-[var(--interactive-hover)] text-sm"
                            >
                                Clear Speaker 2 (Single Narrator)
                            </button>
                        )}
                    </div>
                </SimpleModal>
            )}

            {chatNoteForOverlay && user && (
                 <NoteChat key={`chat-overlay-${chatNoteForOverlay.id}`} ref={noteChatRef} note={chatNoteForOverlay} onClose={handleCloseChatOverlay} userName={userName} isIlluminateEnabled={!isDarkMode} isBlackoutEnabled={false} isVisible={isChatOverlayVisible} onUpdateNoteContent={handleUpdateNoteContentFromChat} onAddImageToNoteRequest={handleAddImageToNoteRequest} displayMode="overlay" userTier={userTier}/>
            )}
             {isMobile && !showNotesListOnMobile && ( <button onClick={() => setShowNotesListOnMobile(true)} className={`fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg bg-indigo-500 hover:bg-indigo-600 text-white transform hover:scale-110 active:scale-100 ${isChatOverlayVisible ? 'bottom-16' : 'bottom-4'}`} title="Show Notes" > <List className="w-5 h-5" /> </button> )}
             {uploadProgress.status && (
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] p-3 rounded-lg shadow-xl text-xs font-medium border ${!uploadProgress.customStyle ? 
                                    (uploadProgress.type === 'error' ? 'bg-red-100 dark:bg-red-700/40 border-red-300 dark:border-red-600 text-red-700 dark:text-red-200' :
                                      uploadProgress.type === 'success' ? 'bg-green-100 dark:bg-green-700/40 border-green-300 dark:border-green-600 text-green-700 dark:text-green-200' :
                                      'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-primary)]') : ''}`}
                        style={uploadProgress.customStyle ? { 
                            backgroundColor: uploadProgress.customStyle.backgroundColor, 
                            color: uploadProgress.customStyle.color,
                            border: uploadProgress.customStyle.border || 'none'
                        } : {}}
                    >
                        <div className="flex items-center gap-2">
                            {uploadProgress.icon ? <uploadProgress.icon className={`w-4 h-4 ${uploadProgress.customStyle ? 'text-white' : (uploadProgress.type === 'error' ? 'text-red-500' : uploadProgress.type === 'success' ? 'text-green-500' : 'text-indigo-500')}`} /> :
                             uploadProgress.type === 'error' ? <AlertTriangle className={`w-4 h-4 ${uploadProgress.customStyle ? 'text-white' : 'text-red-500'}`} /> :
                             uploadProgress.type === 'success' ? <Check className={`w-4 h-4 ${uploadProgress.customStyle ? 'text-white' : 'text-green-500'}`} /> :
                             <Loader2 className={`w-4 h-4 animate-spin ${uploadProgress.customStyle ? 'text-white' : 'text-indigo-500'}`} />}
                            <span>{uploadProgress.status}</span>
                            {uploadProgress.progress > 0 && uploadProgress.progress < 100 && !uploadProgress.error && (
                                <span className="text-[var(--text-muted)]">({uploadProgress.progress}%)</span>
                            )}
                        </div>
                        {!uploadProgress.error && uploadProgress.progress < 100 && (
                            <div className={`w-full h-1 mt-1.5 rounded-full overflow-hidden bg-[var(--bg-highlight)]`}>
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
             )}
        </div>
    );
};

export default Notes;





