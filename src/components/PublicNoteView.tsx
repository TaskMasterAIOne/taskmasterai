import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Loader2, Lock, Share2, Download, Sun, Moon, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface Note {
  id: string;
  title: string;
  content: string;
  type: 'personal' | 'pdf' | 'youtube' | 'audio';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  sourceUrl?: string;
  keyPoints?: string[];
  questions?: any[];
  isPublic: boolean;
  tags: string[];
}

export function PublicNoteView() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

    const fetchNote = async () => {
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

    fetchNote();
     return () => {
        document.title = 'TaskMaster AI';
     };
  }, [noteId]);

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
    if (!note || !contentRef.current) return;

    const element = contentRef.current.cloneNode(true) as HTMLElement;
    const headerElement = element.querySelector('.pdf-export-header');
    if(headerElement) {
        headerElement.classList.remove('hidden');
    }

    const filename = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    const opt = {
      margin:       [0.7, 0.7, 0.7, 0.7],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'], before: ['h1', 'h2', 'h3'] }
    };

    html2pdf().from(element).set(opt).save();
  };

  return (
    <div className={`min-h-screen font-poppins bg-[#F7F8FA] dark:bg-[#0C0E1A] text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
            <div className={`bg-white dark:bg-[#161922] rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700/50`}>
                {loading ? (
                <div className="flex justify-center items-center h-96">
                    <Loader2 className={`w-8 h-8 animate-spin text-indigo-500`} />
                </div>
                ) : error ? (
                <div className="p-8 text-center flex flex-col items-center">
                    <Lock className={`w-12 h-12 mb-4 text-red-500`} />
                    <h2 className={`text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100`}>Access Denied or Not Found</h2>
                    <p className={`text-gray-600 dark:text-gray-400`}>{error}</p>
                    <button onClick={() => navigate('/')} className={`mt-6 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium`}>Go Home</button>
                </div>
                ) : note ? (
                <>
                    <header className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700/50 print:hidden">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-grow">
                                <h1 className={`text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words`}>
                                    {note.title}
                                </h1>
                                <p className={`text-xs text-gray-500 dark:text-gray-400 mt-2`}>
                                    Last updated: {note.updatedAt?.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                                 <div className="flex items-center gap-1 flex-shrink-0 border rounded-full p-1 border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-[#2A2F45]/50">
                                    <button onClick={handleDownloadPdf} className={`p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60`} title="Download as PDF">
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <div className={`w-px h-4 bg-gray-300 dark:bg-gray-700/50 mx-0.5`}></div>
                                    <button onClick={toggleDarkMode} className={`p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60`} title="Toggle Theme">
                                        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                    </button>
                                 </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-700/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-600`}>
                                <Share2 className="w-3.5 h-3.5"/>
                                Public
                            </span>
                            {note.tags?.map((tag) => (
                                <span key={tag} className={`px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-700/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-600`}>
                                #{tag}
                                </span>
                            ))}
                        </div>
                    </header>

                    <main ref={contentRef} className="p-4 md:p-6 lg:p-8">
                        <div className="hidden pdf-export-header print:block mb-8">
                            <h1 className="text-3xl font-bold text-gray-900">{note.title}</h1>
                             <p className={`text-sm text-gray-600 mt-2`}>
                                Last updated: {note.updatedAt?.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <div className="border-b border-gray-300 mt-4"></div>
                        </div>
                        <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                h1: ({node, ...props}) => <h1 className="text-2xl font-semibold mt-6 mb-3 pb-1 border-b border-gray-200 dark:border-gray-700" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-5 mb-2.5" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                                p: ({node, ...props}) => <p className="text-base leading-relaxed my-3 text-gray-800 dark:text-gray-300" {...props} />,
                                a: ({node, ...props}) => <a className="text-indigo-500 dark:text-indigo-400 hover:underline" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 space-y-2 my-4" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 space-y-2 my-4" {...props} />,
                                li: ({node, ...props}) => <li className="text-base text-gray-800 dark:text-gray-300" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4" {...props} />,
                                table: ({node, ...props}) => <div className="overflow-x-auto my-4 border border-gray-200 dark:border-gray-700 rounded-lg"><table className="w-full" {...props} /></div>,
                                thead: ({node, ...props}) => <thead className="bg-gray-50 dark:bg-gray-800/60" {...props} />,
                                th: ({node, ...props}) => <th className="px-4 py-2 text-left font-semibold border-b border-gray-200 dark:border-gray-700" {...props} />,
                                td: ({node, ...props}) => <td className="px-4 py-2 border-t border-gray-200 dark:border-gray-700" {...props} />,
                                code: ({node, inline, className, children, ...props}) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline ? (
                                    <pre className="bg-gray-100 dark:bg-gray-900/70 p-4 rounded-lg my-4 overflow-x-auto text-sm" {...props}>
                                        <code>{children}</code>
                                    </pre>
                                    ) : (
                                    <code className="bg-gray-200 dark:bg-gray-700 text-red-500 dark:text-red-400 font-mono text-sm px-1.5 py-1 rounded" {...props}>
                                        {children}
                                    </code>
                                    );
                                },
                            }}
                        >
                            {note.content || ''}
                        </ReactMarkdown>
                    </main>
                </>
                ) : null}
            </div>
             <footer className="text-center text-xs text-gray-500 dark:text-gray-500 mt-8 pb-4 print:hidden">
                Shared via <a href="/" className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline">TaskMaster AI</a>
            </footer>
        </div>
    </div>
  );
}
