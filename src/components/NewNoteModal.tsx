import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Youtube,
  Plus,
  X,
  AlertTriangle,
  Tag,
  Sparkles,
  Briefcase,
  Text,
  Loader2
} from 'lucide-react';
import {
    UserTier,
    NOTE_LIMITS
} from '../lib/current-paying-user';

interface NewNoteModalProps {
  onClose: () => void;
  onCreatePersonalNote: (title: string, content: string, tags: string[]) => Promise<void>;
  onCreateAINote: (text: string, onProgress: (progress: number) => void) => Promise<void>;
  onUploadPDF: (file: File, onProgress: (progress: number) => void) => Promise<void>;
  onYoutubeLink: (url: string, onProgress: (progress: number) => void) => Promise<void>;
  isIlluminateEnabled: boolean;
  isBlackoutEnabled: boolean;
  userTier: UserTier;
  noteUsage: { pdfAi: number; youtube: number; };
}

// Helper function to format the estimated time remaining
const formatEtr = (ms: number): string => {
    if (ms < 0) return '';
    const seconds = Math.round(ms / 1000);
    if (seconds < 5) return 'a few seconds left';
    if (seconds < 30) return `less than 30 seconds`;
    if (seconds < 45) return 'less than a minute';
    const minutes = Math.ceil(seconds / 60);
    return `about ${minutes} minute${minutes > 1 ? 's' : ''}`;
};


export function NewNoteModal({
  onClose,
  onCreatePersonalNote,
  onCreateAINote,
  onUploadPDF,
  onYoutubeLink,
  isIlluminateEnabled,
  isBlackoutEnabled,
  userTier,
  noteUsage
}: NewNoteModalProps) {
  const [mode, setMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube'>('select');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiText, setAiText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [etr, setEtr] = useState<string>('Estimating...');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to calculate Estimated Time Remaining
  useEffect(() => {
    if (!isSubmitting || !startTime || progress < 5) {
        setEtr('Estimating...');
        return;
    }
    if (progress >= 100) {
        setEtr('Finishing up...');
        return;
    }

    const elapsedTime = Date.now() - startTime;
    const timePerPercent = elapsedTime / progress;
    const totalEstimatedTime = timePerPercent * 100;
    const remainingTime = totalEstimatedTime - elapsedTime;
    
    setEtr(formatEtr(remainingTime));

  }, [progress, isSubmitting, startTime]);

  const handleProgressUpdate = (newProgress: number) => {
      setProgress(Math.min(100, Math.max(0, newProgress)));
  };

  const checkNoteLimit = (noteType: 'pdfAi' | 'youtube'): boolean => {
    if (userTier === 'loading') {
        setError('Verifying account status, please wait...');
        return false;
    }
    if (userTier === 'premium') return true;

    const limits = NOTE_LIMITS[userTier];
    const currentCount = noteUsage[noteType];
    const limit = limits[noteType];

    if (currentCount >= limit) {
        const typeName = noteType === 'pdfAi' ? 'PDF/AI Text Note' : 'YouTube Note';
        setError(`Your monthly ${typeName} limit (${limit}) for the ${userTier} plan has been reached. Please upgrade for more notes.`);
        return false;
    }
    return true;
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
        setTags([...tags, trimmedTag]);
        setNewTag('');
    } else if (tags.length >= 5) {
        setError("Maximum 5 tags allowed.");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSetMode = (newMode: 'select' | 'personal' | 'ai' | 'pdf' | 'youtube') => {
    if (!isSubmitting) {
        setError(null);
        setProgress(0);
        setMode(newMode);
    }
  }
  
  const executeAction = async (action: () => Promise<void>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStartTime(Date.now());
    setProgress(0);
    setError(null);
    try {
        await action();
        onClose();
    } catch(e: any) {
        setError(e.message || "An unexpected error occurred. Please try again.");
        setIsSubmitting(false);
        setProgress(0);
        setStartTime(null);
    }
  }

  const handleCreatePersonalNoteSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    executeAction(() => onCreatePersonalNote(title.trim(), content.trim(), tags));
  };

  const handleCreateAINoteSubmit = () => {
    if (!aiText.trim()) return;
    if (!checkNoteLimit('pdfAi')) return;
    executeAction(() => onCreateAINote(aiText.trim(), handleProgressUpdate));
  };

  const processPDFFile = (file: File) => {
    if (!file) return;
    if (!file.type.includes('pdf')) {
      setError("Invalid file type. Please select a PDF.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!checkNoteLimit('pdfAi')) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }
    executeAction(() => onUploadPDF(file, handleProgressUpdate));
     if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(file) processPDFFile(file);
  };

  const handleYoutubeLinkSubmit = () => {
    if (!youtubeUrl.trim()) return;
    const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!urlPattern.test(youtubeUrl.trim())) {
      setError("Please enter a valid YouTube URL.");
      return;
    }
    if (!checkNoteLimit('youtube')) return;
    executeAction(() => onYoutubeLink(youtubeUrl.trim(), handleProgressUpdate));
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processPDFFile(files[0]);
    }
  };

const renderContent = () => {
    if (isSubmitting) {
        return (
            // The outer centering container
            <div className="flex items-center justify-center h-full">
                {/* 
                  This wrapper now has no max-width, so it will expand
                  to the full width of its parent container.
                */}
                <div className="w-full text-center">  {/* <-- REMOVED max-w-sm HERE */}
                    <div className="flex items-center justify-center gap-3 mb-4 text-gray-700 dark:text-gray-300">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <p className="text-lg font-medium">Creating notes...</p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="w-full flex justify-between mt-2 text-sm">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{Math.round(progress)}%</span>
                        <span className="text-gray-500 dark:text-gray-400">{etr}</span>
                    </div>
                </div>
            </div>
        );
    }

    switch (mode) {
       case 'select':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
            {[
              { mode: 'personal', Icon: Briefcase, title: 'Personal Note', desc: 'Create manually', color: 'text-green-500 dark:text-green-400' },
              { mode: 'ai', Icon: Text, title: 'Text to Note', desc: 'Generate from text', color: 'text-purple-500 dark:text-purple-400' },
              { mode: 'pdf', Icon: Upload, title: 'PDF to Note', desc: 'Upload a PDF', color: 'text-red-500 dark:text-red-400' },
              { mode: 'youtube', Icon: Youtube, title: 'YouTube to Note', desc: 'Use a video link', color: 'text-pink-500 dark:text-pink-400' },
            ].map(({ mode: btnMode, Icon, title, desc, color }) => (
              <button
                key={btnMode}
                onClick={() => handleSetMode(btnMode as any)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-150 border border-gray-200 dark:border-gray-700/50`}
              >
                <Icon className={`w-8 h-8 ${color}`} />
                <span className={`text-sm font-medium text-gray-800 dark:text-gray-100`}>{title}</span>
                <span className={`text-xs text-gray-500 dark:text-gray-400`}>{desc}</span>
              </button>
            ))}
          </div>
        );
      case 'personal':
        return (
          <div className="space-y-3 animate-fadeIn">
            <div>
              <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1`}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title..." className={`w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`} />
            </div>
            <div>
              <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1`}>Content</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Note content..." rows={8} className={`w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[150px]`} />
            </div>
            <div>
              <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1`}>Tags (Optional, max 5)</label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tags.map((tag) => (
                  <span key={tag} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-700/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-600`}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className={`hover:opacity-70 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5`}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add tag..."
                    className={`flex-1 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 rounded-md px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`} />
                  <button onClick={handleAddTag} disabled={!newTag.trim()} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${!newTag.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Tag className="w-3 h-3" /> Add
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'ai':
        return (
           <div className="space-y-3 animate-fadeIn">
            <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1`}>Text to Process</label>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste or type any text here to turn it into a structured note with key points, flashcards, and a quiz..." rows={8} className={`w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[150px]`} />
          </div>
        );
      case 'pdf':
        return (
          <div className="animate-fadeIn">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${isDraggingOver
                  ? `border-indigo-500 bg-indigo-50 dark:bg-indigo-700/20`
                  : `border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50`
                }
              `}
            >
              <Upload className={`w-10 h-10 text-gray-500 dark:text-gray-400 mx-auto mb-3 ${isDraggingOver ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
              <p className={`text-sm font-medium text-gray-700 dark:text-gray-200 mb-1`}>
                {isDraggingOver ? 'Drop PDF here' : 'Click or drag PDF file here'}
              </p>
              <p className={`text-xs text-gray-500 dark:text-gray-400`}>No file size limit</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
          </div>
        );
      case 'youtube':
        return (
           <div className="space-y-3 animate-fadeIn">
            <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1`}>YouTube URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={`w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`} />
          </div>
        );
    }
  };

   const renderFooterButtons = () => {
     if (mode === 'select' || isSubmitting) return null;

     const goBackAction = () => handleSetMode('select');
     
     const submitButtonClasses = "bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";

     switch (mode) {
       case 'personal':
         return (
           <>
             <button onClick={goBackAction} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreatePersonalNoteSubmit} disabled={!title.trim() || !content.trim()} className={submitButtonClasses} >
               <Plus className="w-4 h-4" /> Create Note
             </button>
           </>
         );
       case 'ai':
         return (
           <>
             <button onClick={goBackAction} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreateAINoteSubmit} disabled={!aiText.trim()} className={submitButtonClasses} >
               <Sparkles className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       case 'pdf':
          return <button onClick={goBackAction} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm`}>Back</button>;
       case 'youtube':
         return (
           <>
             <button onClick={goBackAction} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleYoutubeLinkSubmit} disabled={!youtubeUrl.trim()} className={submitButtonClasses} >
               <Youtube className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       default:
         return null;
     }
   };

// In NewNoteModal.tsx -> REPLACE the entire return statement

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`bg-white dark:bg-[#161922] rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700/50`}>

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
           <h2 className={`text-lg font-semibold text-gray-800 dark:text-gray-100`}>
             {isSubmitting ? 'Processing...' :
              mode === 'select' ? 'Create New Note' :
              mode === 'personal' ? 'New Personal Note' :
              mode === 'ai' ? 'Text to Note' :
              mode === 'pdf' ? 'PDF to Note' :
              mode === 'youtube' ? 'YouTube to Note' : 'Create New Note'
             }
           </h2>
          <button onClick={onClose} disabled={isSubmitting} className={`text-gray-500 dark:text-gray-400 disabled:opacity-50 transition-opacity rounded-full p-1`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- CORRECTED CONTENT WRAPPER --- */}
        <div 
          className={isSubmitting 
            // When submitting, use flexbox to push content to the bottom, then add padding to lift it up.
            ? "flex-1 p-4 flex flex-col  justify-end pb-20 min-h-[250px]"
            // Otherwise, use the standard scrolling behavior.
            : "flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent min-h-[250px]"
          }
        >
          {renderContent()}
        </div>
        {/* --- END OF CORRECTION --- */}

        <div className="p-4 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 min-h-[68px] flex items-center justify-end gap-2">
          {error && !isSubmitting && (
            <div className={`p-2 rounded-md flex items-center gap-2 text-xs bg-red-100 dark:bg-red-700/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-600 w-full animate-fadeIn`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
               <button onClick={() => setError(null)} title="Dismiss error" className={`ml-2 p-0.5 rounded hover:opacity-70 hover:bg-red-200 dark:hover:bg-red-700/50`}>
                 <X className="w-3 h-3" />
                </button>
            </div>
          )}
          
          <div className="flex justify-end gap-2 w-full">
              {renderFooterButtons()}
          </div>
        </div>
      </div>
    </div>
  );
}
