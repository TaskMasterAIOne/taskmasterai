import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Loader2, Lock, Share2, Download, Sun, Moon, User } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

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
}

interface Author {
    displayName: string;
}

const KatexRenderer: React.FC<{ htmlContent: string | undefined }> = ({ htmlContent }) => {
    const renderedContent = useMemo(() => {
        if (!htmlContent) return '';

        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        return htmlContent.replace(regex, (match, displayMath, inlineMath) => {
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

  useEffect(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDarkMode(false);
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

    setLoading(true);
    setError(null);

    const noteRef = doc(db, 'notes', noteId);
    const unsubscribeNote = onSnapshot(noteRef, async (docSnap) => {
      if (docSnap.exists()) {
        const fetchedData = { id: docSnap.id, ...docSnap.data() } as Note;
        if (fetchedData.isPublic) {
          setNote(fetchedData);
          document.title = `${fetchedData.title} | Public Note`;

          if (!author || author.displayName === 'Anonymous User' || fetchedData.userId !== note?.userId) {
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
      setLoading(false);
    }, (err) => {
        console.error("Error fetching public note:", err);
        setError("Failed to load the note. Please try again later.");
        document.title = `Error`;
        setLoading(false);
        setNote(null);
    });

    return () => {
        unsubscribeNote();
        document.title = 'TaskMaster AI';
    };
  }, [noteId, author, note?.userId]);

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

    .note-content-area img, .note-content-area iframe {
        border-radius: 12px;
        overflow: hidden;
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1.5em auto;
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
                                        <span>Last updated: {note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20">
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
                                    <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <div className="w-full h-px bg-gray-200 dark:bg-gray-800 mt-8"></div>
                        </header>
                        
                        <main className="note-content-area">
                            <KatexRenderer htmlContent={note.content} />
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
