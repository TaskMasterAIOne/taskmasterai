import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { 
    Loader2, Lock, Share2, Download, Sun, Moon, User,
    Sparkles, BookOpen, Layers, Mic, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Speaker, Check, X,
    ChevronRight, ChevronLeft, RotateCw as FlipIcon
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
  id: string;
  title: string;
  content: string;
  type: 'personal' | 'pdf' | 'youtube' | 'audio';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  isPublic: boolean;
  tags: string[];
  keyPoints?: string[];
  questions?: { question: string; options: string[]; correctAnswer: number; explanation?: string; }[];
  flashcards?: { front: string; back: string; }[];
  podcasts?: Podcast[];
}

interface Author {
    displayName: string;
}

interface Podcast {
    id: string;
    combinedUrl: string;
    totalDuration: number;
    segments: PodcastSegment[];
    createdAt: Timestamp;
    settings: {
        language: string;
        speaker1Id: string | null;
        speaker2Id: string | null;
        length: 'short' | 'medium' | 'long' | null;
        instructions: string;
    };
}

interface PodcastSegment {
    text: string;
    speakerId: string;
    startTime: number;
    endTime: number;
    audioUrl: string;
}

interface PodcastSpeakerProfile {
    id: string; name: string; description: string;
    avatarUrl: string;
    elevenLabsVoiceId: string;
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

const toDateSafe = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value &&
        typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        try {
            return new Timestamp(value.seconds, value.nanoseconds).toDate();
        } catch (e) { console.warn("toDateSafe error converting object:", e); return null; }
    }
    return null;
};

const RenderWithLatex: React.FC<{ text: string | undefined }> = ({ text }) => {
    const renderedHtml = useMemo(() => {
        if (!text) return '';
        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        return text.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false,
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                return match;
            }
        });
    }, [text]);

    return <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
};

const KatexRenderer: React.FC<{ htmlContent: string | undefined }> = ({ htmlContent }) => {
    const renderedContent = useMemo(() => {
        if (!htmlContent) return '';

        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        const processedHtml = htmlContent.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false,
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                return match;
            }
        });
        return processedHtml;
    }, [htmlContent]);
    
    return <div dangerouslySetInnerHTML={{ __html: renderedContent }} />;
};


export function PublicNoteView() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const [activePodcast, setActivePodcast] = useState<Podcast | null>(null);
  const [isPodcastPlaying, setIsPodcastPlaying] = useState(false);
  const [podcastPlaybackRate, setPodcastPlaybackRate] = useState(1);
  const [podcastVolume, setPodcastVolume] = useState(0.75);
  const [podcastCurrentTime, setPodcastCurrentTime] = useState(0);
  const [podcastDuration, setPodcastDuration] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);

  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);

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
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };
    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme();
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!noteId) {
      setError("Invalid note ID.");
      setLoading(false);
      return;
    }

    const fetchNoteAndAuthor = async () => {
      setLoading(true);
      setError(null);
      try {
        const noteRef = doc(db, 'notes', noteId);
        const docSnap = await getDoc(noteRef);

        if (docSnap.exists()) {
          const fetchedData = { id: docSnap.id, ...docSnap.data() } as Note;
          if (fetchedData.isPublic) {
            setNote(fetchedData);
            document.title = `${fetchedData.title} | Public Note`;

            try {
                const userRef = doc(db, 'users', fetchedData.userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setAuthor(userSnap.data() as Author);
                } else {
                    setAuthor({ displayName: 'Anonymous User' });
                }
            } catch (userError) {
                console.error("Error fetching author:", userError);
                setAuthor({ displayName: 'Anonymous User' });
            }
          } else {
            setError("This note is private and cannot be viewed.");
            document.title = `Private Note`;
            setNote(null);
          }
        } else {
          setError("Note not found.");
          document.title = `Note Not Found`;
          setNote(null);
        }
      } catch (err) {
        console.error("Error fetching public note:", err);
        setError("Failed to load the note. Please try again later.");
        document.title = `Error`;
      } finally {
        setLoading(false);
      }
    };

    fetchNoteAndAuthor();
    return () => { 
        document.title = 'TaskMaster AI'; 
        handlePodcastStop();
    };
  }, [noteId, handlePodcastStop]);

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
}, [activePodcast, isPodcastPlaying, handlePodcastStop, currentSegmentIndex]);

  const toggleDarkMode = useCallback(() => {
      setIsDarkMode(prev => {
          const newIsDark = !prev;
          if (newIsDark) {
              document.documentElement.classList.add('dark');
              localStorage.setItem('theme', 'dark');
          } else {
              document.documentElement.classList.remove('dark');
              localStorage.setItem('theme', 'light');
          }
          return newIsDark;
      });
  }, []);

  const handleDownloadPdf = useCallback(() => {
    if (!note || !pdfContentRef.current) return;
    
    const element = pdfContentRef.current;
    const filename = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    const opt = {
      margin:       [0.7, 0.7, 0.7, 0.7],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().from(element).set(opt).save();
  }, [note]);

  const handlePodcastPlayPause = useCallback(() => {
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
  }, [activePodcast]);

  const handlePodcastSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audioEl = audioPlayerRef.current;
    if (audioEl && activePodcast && activePodcast.segments.length > 0) {
        const newTime = Number(event.target.value);
        audioEl.currentTime = newTime;
        setPodcastCurrentTime(newTime);
    }
  }, [activePodcast]);

  const handleSkipForwardSegment = useCallback(() => {
    if (activePodcast && audioPlayerRef.current) {
        const nextIndex = currentSegmentIndex + 1;
        if (nextIndex < activePodcast.segments.length) {
            audioPlayerRef.current.currentTime = activePodcast.segments[nextIndex].startTime;
            if (!isPodcastPlaying) audioPlayerRef.current.play();
        } else {
            audioPlayerRef.current.currentTime = activePodcast.totalDuration;
        }
    }
  }, [activePodcast, currentSegmentIndex, isPodcastPlaying]);

  const handleSkipBackSegment = useCallback(() => {
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
        if (!isPodcastPlaying) audioPlayerRef.current.play();
    }
  }, [activePodcast, currentSegmentIndex, isPodcastPlaying]);

  const formatPodcastTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
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

  const handleNextFlashcard = useCallback(() => {
    if (note && note.flashcards && currentFlashcardIndex < note.flashcards.length - 1) {
        setCurrentFlashcardIndex(prev => prev + 1);
        setIsFlashcardFlipped(false);
    }
  }, [note, currentFlashcardIndex]);

  const handlePrevFlashcard = useCallback(() => {
    if (currentFlashcardIndex > 0) {
        setCurrentFlashcardIndex(prev => prev - 1);
        setIsFlashcardFlipped(false);
    }
  }, [currentFlashcardIndex]);

  const handleFlipFlashcard = useCallback(() => {
      setIsFlashcardFlipped(prev => !prev);
  }, []);

  const handleScrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const globalStyles = `
    ::-webkit-scrollbar { width: 12px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
        background-color: #d1d5db;
        border-radius: 10px;
        border: 3px solid transparent;
        background-clip: content-box;
    }
    .dark ::-webkit-scrollbar-thumb { background-color: #4b5563; }
    ::-webkit-scrollbar-thumb:hover { background-color: #9ca3af; }
    .dark ::-webkit-scrollbar-thumb:hover { background-color: #6b7280; }

    .note-content-area {
        font-family: 'Poppins', sans-serif;
        font-size: 16px;
        line-height: 1.8;
        color: #111827;
    }
    .dark .note-content-area { color: #D1D5DB; }

    .note-content-area h1, .note-content-area h2, .note-content-area h3, .note-content-area h4, .note-content-area h5, .note-content-area h6 {
        font-weight: 600;
        font-family: 'Poppins', sans-serif;
        margin-top: 1.5em;
        margin-bottom: 0.75em;
        line-height: 1.3;
    }
    .note-content-area h1 { font-size: 2.25em; }
    .note-content-area h2 { font-size: 1.8em; }
    .note-content-area h3 { font-size: 1.5em; }
    .note-content-area h4 { font-size: 1.25em; }
    .note-content-area h5 { font-size: 1.1em; }
    .note-content-area h6 { font-size: 1em; font-weight: 700; }

    .note-content-area p { margin-bottom: 1.5rem; }

    .note-content-area ul, .note-content-area ol {
        margin-left: 1.75em;
        margin-top: 1.25em;
        margin-bottom: 1.25em;
        list-style-position: outside;
        padding-left: 0.75em;
    }
    .note-content-area ul { list-style-type: disc; }
    .note-content-area ol { list-style-type: decimal; }

    .note-content-area li {
        margin-bottom: 1.1em;
        padding-left: 0.5em;
    }
    
    .note-content-area a {
        color: #4f46e5;
        text-decoration: underline;
    }
    .dark .note-content-area a { color: #818cf8; }

    .note-content-area table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5em 0;
        font-size: 15px;
    }

    .note-content-area th, .note-content-area td {
        padding: 12px 16px;
        text-align: left;
        line-height: 1.6;
    }
    
    .note-content-area tr { border-bottom: 1px solid #E5E7EB; }
    .dark .note-content-area tr { border-bottom: 1px solid #374151; }
    .note-content-area tr:last-child { border-bottom: none; }

    .note-content-area th {
        background-color: #F9FAFB;
        color: #111827;
        font-weight: 600;
    }
    .dark .note-content-area th {
        background-color: #1F2937;
        color: #F9FAFB;
    }

    .note-content-area td { color: #374151; }
    .dark .note-content-area td { color: #D1D5DB; }

    .note-content-area img {
        border-radius: 12px;
        overflow: hidden;
        max-width: 100%;
        height: auto;
        display: inline-block; /* Changed from 'block' to 'inline-block' */
        margin: 1.5em 0; /* Removed 'auto' to prevent centering */
    }
    .note-content-area iframe {
        border-radius: 12px;
        overflow: hidden;
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1.5em 0;
        min-height: 200px;
        aspect-ratio: 16 / 9;
    }

    .public-note-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 0px; /* Removed border */
    }

    .public-note-quick-actions button {
        flex: 1;
        min-width: 120px;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 500;
        transition: background-color 0.15s ease-in-out;
        cursor: pointer;
        background-color: #F3F4F6; /* Default light background */
        color: #1F2937; /* Default light text */
    }
    .dark .public-note-quick-actions button {
        background-color: #1A202C; /* Default dark background */
        color: #E5E7EB; /* Default dark text */
    }
    .public-note-quick-actions button:hover {
        background-color: #E5E7EB; /* Hover light background */
    }
    .dark .public-note-quick-actions button:hover {
        background-color: #2D3748; /* Hover dark background */
    }
    .public-note-quick-actions button svg {
        flex-shrink: 0;
    }

    /* Override for specific section styling */
    .section-container {
        padding-top: 24px;
        margin-top: 32px;
        border-top: 0px; /* Removed border */
    }
    .flashcard-card-view {
        background-color: #ffffff; /* Light mode card background */
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border-radius: 12px;
        padding: 24px;
        min-height: 280px;
        perspective: 1000px;
        cursor: pointer;
    }
    .dark .flashcard-card-view {
        background-color: #1A1D29; /* Dark mode card background */
    }
    .flashcard-card-face {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        backface-visibility: hidden;
        transition: transform 0.5s;
    }
    .flashcard-front {
        background-color: #6366f1; /* Indigo */
        color: white;
    }
    .flashcard-back {
        background-color: #8B5CF6; /* Purple */
        color: white;
        transform: rotateX(180deg);
    }
  `;

  return (
    <>
    <style>{globalStyles}</style>
    <div className={`min-h-screen font-poppins bg-white dark:bg-[#0C0E1A] text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col`}>
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex-grow flex flex-col">
            {loading || error ? (
                <div className="flex-grow flex items-center justify-center">
                    {loading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    ) : (
                        <div className="text-center flex flex-col items-center max-w-lg mx-auto">
                            <Lock className="w-12 h-12 mb-4 text-red-500" />
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Access Denied or Not Found</h2>
                            <p className="text-gray-600 dark:text-gray-400">{error}</p>
                            <button onClick={() => navigate('/')} className="mt-6 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Go Home</button>
                        </div>
                    )}
                </div>
            ) : note ? (
                <div className="py-8 md:py-12">
                    <div ref={pdfContentRef}>
                        <header className="mb-10 md:mb-14">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h1 className="text-3xl md:text-5xl font-semibold text-gray-900 dark:text-white tracking-tight">
                                        {note.title}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 mt-4">
                                        {author && (
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span>{author.displayName}</span>
                                            </div>
                                        )}
                                        <span className="hidden sm:inline">•</span>
                                        <span>Last updated: {toDateSafe(note.updatedAt)?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300">
                                            <Share2 className="w-3.5 h-3.5"/>
                                            Public Note
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                     <button onClick={handleDownloadPdf} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-800/70" title="Download as PDF">
                                         <Download className="w-5 h-5" />
                                     </button>
                                     <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-800/70" title="Toggle Theme">
                                         {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                     </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-6">
                                {note.tags?.map((tag) => (
                                    <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <div className="w-full h-px bg-gray-200 dark:bg-gray-800 mt-8"></div>
                        </header>
                        
                        {/* Quick Actions Buttons */}
                        <div className="public-note-quick-actions">
                            {note.keyPoints && note.keyPoints.length > 0 && (
                                <button onClick={() => handleScrollToSection('key-points-section')} className="bg-yellow-50 dark:bg-yellow-700/20 hover:bg-yellow-100 dark:hover:bg-yellow-700/30">
                                    <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
                                    Key Points
                                </button>
                            )}
                            {note.flashcards && note.flashcards.length > 0 && (
                                <button onClick={() => handleScrollToSection('flashcards-section')} className="bg-indigo-50 dark:bg-indigo-700/20 hover:bg-indigo-100 dark:hover:bg-indigo-700/30">
                                    <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                                    Flashcards
                                </button>
                            )}
                            {note.questions && note.questions.length > 0 && (
                                <button onClick={() => handleScrollToSection('study-questions-section')} className="bg-purple-50 dark:bg-purple-700/20 hover:bg-purple-100 dark:hover:bg-purple-700/30">
                                    <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                                    Quiz
                                </button>
                            )}
                            {note.podcasts && note.podcasts.length > 0 && (
                                <button onClick={() => handleScrollToSection('podcast-section-wrapper')} className="bg-teal-50 dark:bg-teal-700/20 hover:bg-teal-100 dark:hover:bg-teal-700/30">
                                    <Mic className="w-5 h-5 text-teal-600 dark:text-teal-300" />
                                    Podcast
                                </button>
                            )}
                        </div>

                        <main className="note-content-area">
                            <KatexRenderer htmlContent={note.content} />

                            {note.keyPoints && note.keyPoints.length > 0 && (
                                <div id="key-points-section" className={`section-container`}>
                                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100`}> <Sparkles className={`w-5 h-5 text-yellow-500 dark:text-yellow-400`} /> Key Points </h3>
                                    <div className={`space-y-3`}> {note.keyPoints.map((point, index) => (
                                        <div key={index} className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-700/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">{index + 1}</div>
                                            <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed"><RenderWithLatex text={point} /></p>
                                        </div>
                                    ))} </div>
                                </div>
                            )}

                            {note.flashcards && note.flashcards.length > 0 && (
                                <div id="flashcards-section" className="section-container">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                                        <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Flashcards
                                    </h3>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentFlashcardIndex}
                                            initial={{ opacity: 0, y: isFlashcardFlipped ? -10: 10 }}
                                            animate={{ opacity: 1, y:0 }}
                                            exit={{ opacity: 0, y: isFlashcardFlipped ? 10: -10}}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <motion.div
                                                className="relative flashcard-card-view [perspective:1000px]"
                                                onClick={handleFlipFlashcard}
                                            >
                                                <motion.div
                                                    className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center flashcard-front [backface-visibility:hidden]"
                                                    animate={{ rotateX: isFlashcardFlipped ? -180 : 0 }}
                                                    transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                                                >
                                                    <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Term</p>
                                                    <p className="text-xl font-medium leading-tight">
                                                        <RenderWithLatex text={note.flashcards[currentFlashcardIndex].front} />
                                                    </p>
                                                </motion.div>
                                                <motion.div
                                                    className="absolute inset-0 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center text-center flashcard-back [backface-visibility:hidden] [transform:rotateX(180deg)]"
                                                    animate={{ rotateX: isFlashcardFlipped ? 0 : 180 }}
                                                    transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
                                                >
                                                    <p className="text-xs uppercase tracking-wider mb-2 opacity-80">Definition</p>
                                                    <p className="text-xl font-medium leading-tight">
                                                        <RenderWithLatex text={note.flashcards[currentFlashcardIndex].back} />
                                                    </p>
                                                </motion.div>
                                            </motion.div>
                                        </motion.div>
                                    </AnimatePresence>
                                    <div className="flex items-center justify-between mt-4">
                                        <button
                                            onClick={handlePrevFlashcard}
                                            disabled={currentFlashcardIndex === 0}
                                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                                        > <ChevronLeft className="w-5 h-5" /> </button>
                                        <span className="text-sm text-gray-600 dark:text-gray-400"> {currentFlashcardIndex + 1} / {note.flashcards.length} </span>
                                        <button
                                            onClick={handleNextFlashcard}
                                            disabled={currentFlashcardIndex === note.flashcards.length - 1}
                                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                                        > <ChevronRight className="w-5 h-5" /> </button>
                                    </div>
                                    <button onClick={handleFlipFlashcard} className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                                        <FlipIcon className="w-4 h-4" /> Flip Card
                                    </button>
                                </div>
                            )}

                            {note.questions && note.questions.length > 0 && (
                                <div id="study-questions-section" className={`section-container`}>
                                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100`}><BookOpen className={`w-5 h-5 text-purple-500 dark:text-purple-400`} />Study Questions</h3>
                                    <div className="space-y-5">
                                        {note.questions.map((q, index) => {
                                            const key = `q-${index}`;
                                            const isCorrect = true; // Always show correct answer in public view for explanation
                                            return (
                                                <div key={key} className={`p-4 md:p-5 rounded-xl bg-gray-50 dark:bg-[#1A1D29]`}>
                                                    <p className={`text-gray-800 dark:text-gray-200 font-medium mb-4 leading-relaxed`}>
                                                        <span className="text-indigo-500 dark:text-indigo-400 font-bold mr-2">{index + 1}.</span>
                                                        <RenderWithLatex text={q.question} />
                                                    </p>
                                                    <div className="space-y-3">
                                                        {q.options.map((opt, idx) => {
                                                            const isAnswer = idx === q.correctAnswer;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`w-full text-left p-3 rounded-lg text-sm flex items-center justify-between group cursor-default
                                                                        ${isAnswer
                                                                            ? `bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-white font-semibold`
                                                                            : `bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400 opacity-70`
                                                                        }`}
                                                                >
                                                                    <span><RenderWithLatex text={opt} /></span>
                                                                    <div className={`flex-shrink-0 ml-4 w-6 h-6 flex items-center justify-center rounded-full
                                                                        ${isAnswer ? 'bg-green-500/20' : 'bg-gray-200/50 dark:bg-gray-700/50'}
                                                                    `}>
                                                                        {isAnswer && <Check className="w-4 h-4 text-green-600" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {q.explanation && (
                                                        <div className={`mt-4 p-3 rounded-lg text-sm leading-relaxed bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200`}>
                                                            <strong className="font-semibold">Explanation: </strong><RenderWithLatex text={q.explanation} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {note.podcasts && note.podcasts.length > 0 && (
                                <div id="podcast-section-wrapper" className="section-container">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                                        <Mic className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Podcasts
                                    </h3>
                                    {activePodcast && (
                                        <div id="podcast-player-section" className="my-6 p-4 rounded-lg shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800 text-white">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center">
                                                    <Speaker size={24} className="mr-3 opacity-80" />
                                                    <h3 className="text-lg font-semibold truncate">{note.title} - Podcast</h3>
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
                                                        <SkipBack className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={handlePodcastPlayPause} className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors transform hover:scale-105" >
                                                        {isPodcastPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                                                    </button>
                                                    <button onClick={handleSkipForwardSegment} className="p-2 opacity-80 hover:opacity-100 transition-opacity" disabled={!activePodcast || (audioPlayerRef.current?.currentTime || 0) >= activePodcast.totalDuration - 1} >
                                                        <SkipForward className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between text-xs opacity-90">
                                                    <div className="flex items-center space-x-2">
                                                        {podcastVolume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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

                                    <div id="podcast-list-section" className="mt-1">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Generated Podcasts for this Note:</p>
                                        <div className="space-y-2">
                                            {note.podcasts!.sort((a, b) => toDateSafe(b.createdAt)!.getTime() - toDateSafe(a.createdAt)!.getTime()).map(p => (
                                                <div key={p.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => { activePodcast?.id === p.id ? handlePodcastPlayPause() : setActivePodcast(p) }} className="p-2 rounded-full bg-teal-100 dark:bg-teal-700/30 text-teal-600 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-700/50">
                                                            {activePodcast?.id === p.id && isPodcastPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                                        </button>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                                Podcast from {toDateSafe(p.createdAt)?.toLocaleString()}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {p.settings.speaker2Id ? `${PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker1Id)?.name} & ${PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker2Id)?.name}` : PREDEFINED_PODCAST_SPEAKERS.find(s=>s.id===p.settings.speaker1Id)?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </main>
                    </div>
                </div>
            ) : null}
        </main>
      <footer className="text-center text-xs text-gray-500 dark:text-gray-500 pt-8 pb-6 flex-shrink-0">
          Shared via <a href="/" className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline">TaskMaster AI</a>
      </footer>
    </div>
    </>
  );
}
