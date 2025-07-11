import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Loader2, Lock, Share2, Download, Sun, Moon, User } from 'lucide-react';
import html2pdf from 'html2pdf.js';

// Note interface matching the main application
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

// Simple interface for expected user data
interface Author {
    displayName: string;
}


export function PublicNoteView() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // --- Effects ---

  // Handles theme initialization and changes
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

  // Fetches note and author data
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

            // Now fetch the author's profile
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
          }
        } else {
          setError("Note not found.");
          document.title = `Note Not Found`;
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
    return () => { document.title = 'TaskMaster AI'; };
  }, [noteId]);

  // --- Handlers ---

  const toggleDarkMode = () => {
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
  };

  const handleDownloadPdf = () => {
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
  };
  
  // Dynamic CSS to style the dangerouslySetInnerHTML content
  const noteContentStyles = `
    .note-content-area h1, .note-content-area h2, .note-content-area h3, .note-content-area h4 {
        font-family: 'Poppins', sans-serif;
        font-weight: 600;
    }
    .note-content-area h1 { font-size: 1.875rem; margin-top: 1.5rem; margin-bottom: 1rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e5e7eb; }
    .note-content-area h2 { font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    .note-content-area h3 { font-size: 1.25rem; margin-top: 1.25rem; margin-bottom: 0.5rem; }
    .note-content-area p { font-size: 1rem; line-height: 1.75; margin-bottom: 1.25rem; color: #374151; }
    .note-content-area a { color: #4f46e5; text-decoration: none; }
    .note-content-area a:hover { text-decoration: underline; }
    .note-content-area ul, .note-content-area ol { margin-left: 1.25rem; margin-bottom: 1.25rem; }
    .note-content-area li { margin-bottom: 0.5rem; }
    .note-content-area blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; margin: 1.5rem 0; font-style: italic; color: #6b7280; }
    .note-content-area pre { background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-family: monospace; }
    .note-content-area code { font-family: monospace; background-color: #e5e7eb; color: #be123c; padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
    .note-content-area pre code { background-color: transparent; color: inherit; padding: 0; }
    .note-content-area img { max-width: 100%; height: auto; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); margin: 1.5rem 0; }
    .note-content-area table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    .note-content-area th, .note-content-area td { border: 1px solid #d1d5db; padding: 0.75rem; text-align: left; }
    .note-content-area th { background-color: #f9fafb; }
    
    .dark .note-content-area h1 { border-bottom-color: #374151; }
    .dark .note-content-area p { color: #d1d5db; }
    .dark .note-content-area a { color: #818cf8; }
    .dark .note-content-area blockquote { border-left-color: #4b5563; color: #9ca3af; }
    .dark .note-content-area pre { background-color: #111827; }
    .dark .note-content-area code { background-color: #374151; color: #fb7185; }
    .dark .note-content-area img { box-shadow: 0 4px 6px -1px rgb(255 255 255 / 0.05), 0 2px 4px -2px rgb(255 255 255 / 0.05); }
    .dark .note-content-area th, .dark .note-content-area td { border-color: #4b5563; }
    .dark .note-content-area th { background-color: #1f2937; }
  `;

  return (
    <>
    <style>{noteContentStyles}</style>
    <div className={`min-h-screen font-poppins bg-[#F7F8FA] dark:bg-[#0C0E1A] text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
      <div className="w-full mx-auto px-4 sm:px-6 md:px-12 lg:px-16 py-8 md:py-12">
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="text-center flex flex-col items-center max-w-lg mx-auto">
            <Lock className="w-12 h-12 mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">Access Denied or Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button onClick={() => navigate('/')} className="mt-6 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Go Home</button>
          </div>
        ) : note ? (
          <div ref={pdfContentRef}>
            <header className="mb-8 md:mb-12">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
                            {note.title}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-4">
                            {author && (
                                <div className="flex items-center gap-1.5">
                                    <User className="w-4 h-4" />
                                    <span>{author.displayName}</span>
                                </div>
                            )}
                            <span>•</span>
                            <span>Last updated: {note.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                         <button onClick={handleDownloadPdf} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800" title="Download as PDF">
                             <Download className="w-5 h-5" />
                         </button>
                         <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800" title="Toggle Theme">
                             {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                         </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-6">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                        <Share2 className="w-3.5 h-3.5"/>
                        Public Note
                    </span>
                    {note.tags?.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                        #{tag}
                        </span>
                    ))}
                </div>
                <div className="w-full h-px bg-gray-200 dark:bg-gray-800 mt-8"></div>
            </header>

            <main 
                className="note-content-area"
                dangerouslySetInnerHTML={{ __html: note.content || '' }}
            />
          </div>
        ) : null}
      </div>
      <footer className="text-center text-xs text-gray-500 dark:text-gray-500 pt-8 pb-6 border-t border-gray-200 dark:border-gray-800">
          Note shared via <a href="/" className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline">TaskMaster AI</a>
      </footer>
    </div>
    </>
  );
}
