import React, { useState, useRef, useEffect } from 'react';
import {
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
import { useScrollLock } from '../hooks/useScrollLock';

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

// Helper function to validate YouTube URLs
const isValidYouTubeUrl = (url: string): boolean => {
  const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return urlPattern.test(url.trim());
};

// Helper function to validate PDF files
const isValidPDFFile = (file: File): boolean => {
  return file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
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

  // Lock body scroll when modal is open
  useScrollLock(true);

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
    if (!title.trim()) {
      setError("Please provide a title for your note.");
      return;
    }
    executeAction(() => onCreatePersonalNote(title.trim(), "", tags));
  };

  const handleCreateAINoteSubmit = () => {
    if (!aiText.trim()) {
      setError("Please provide text to process.");
      return;
    }
    if (!checkNoteLimit('pdfAi')) return;
    executeAction(() => onCreateAINote(aiText.trim(), handleProgressUpdate));
  };

  const processPDFFile = (file: File) => {
    if (!file) return;
    if (!isValidPDFFile(file)) {
      setError("Invalid file type. Please select a PDF file.");
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
    if (!youtubeUrl.trim()) {
      setError("Please enter a YouTube URL.");
      return;
    }
    if (!isValidYouTubeUrl(youtubeUrl)) {
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

  const handleKeyPress = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      action();
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
                    <div className="flex items-center justify-center gap-3 mb-4 text-[var(--text-secondary)]">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <p className="text-lg font-medium">Creating notes...</p>
                    </div>
                    <div className="w-full bg-[var(--bg-highlight)] rounded-full h-2.5">
                        <div
                            className="bg-[var(--bg-accent)] h-2.5 rounded-full transition-all duration-300 ease-linear"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="w-full flex justify-between mt-2 text-sm">
                        <span className="font-semibold text-[var(--text-primary)]">{Math.round(progress)}%</span>
                        <span className="text-[var(--text-muted)]">{etr}</span>
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
              { mode: 'personal', Icon: Briefcase, title: 'Personal Note', desc: 'Create manually', color: 'text-[var(--status-success)]' },
              { mode: 'ai', Icon: Text, title: 'Text to Note', desc: 'Generate from text', color: 'text-[var(--text-primary)]' },
              { mode: 'pdf', Icon: CustomPDFIcon, title: 'PDF to Note', desc: 'Upload a PDF', color: 'text-[var(--text-primary)]' },
              { mode: 'youtube', Icon: CustomYouTubeIcon, title: 'YouTube to Note', desc: 'Use a video link', color: 'text-[var(--text-primary)]' },
            ].map(({ mode: btnMode, Icon, title, desc, color }) => (
              <button
                key={btnMode}
                onClick={() => handleSetMode(btnMode as any)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--interactive-hover)] hover:shadow-md transition-all duration-150 border border-[var(--border-primary)]`}
              >
                <Icon className={`w-8 h-8 ${color}`} />
                <span className={`text-sm font-medium text-[var(--text-primary)]`}>{title}</span>
                <span className={`text-xs text-[var(--text-muted)]`}>{desc}</span>
              </button>
            ))}
          </div>
        );
      case 'personal':
        return (
          <div className="space-y-6 animate-fadeIn max-w-md mx-auto">
            {/* Title Input - Main Focus */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Note Title
              </label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="Enter your note title..." 
                className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-all duration-200" 
                autoFocus
              />
            </div>

            {/* Tags Section - Enhanced Visual Design */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[var(--text-secondary)]" />
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Tags <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
              </div>
              
              {/* Tag Display */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-[var(--bg-highlight)] rounded-lg border border-[var(--border-primary)]">
                  {tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--bg-accent)] text-[var(--text-white)] font-medium shadow-sm"
                    >
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)} 
                        className="hover:bg-[var(--overlay-dark)] rounded-full p-0.5 transition-colors duration-150"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add New Tag */}
              {tags.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1 bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-all duration-200"
                  />
                  <button 
                    onClick={handleAddTag} 
                    disabled={!newTag.trim()} 
                    className="bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-white)] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              )}

              {/* Tag Limit Helper */}
              <div className="text-xs text-[var(--text-muted)] flex justify-between items-center">
                <span>Maximum 5 tags</span>
                <span>{tags.length}/5</span>
              </div>
            </div>

            {/* Helper Text */}
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Create a personal note that you can edit and organize.
                <br />
                You can add content after creating the note.
              </p>
            </div>
          </div>
        );
      case 'ai':
        return (
          <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
            {/* Header Section */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-primary)]">
                  <Text className="w-6 h-6 text-[var(--text-primary)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Transform Text into Notes
                </h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-md mx-auto">
                Paste any text or tell TaskMaster what notes you want.<br />Get structured notes with key points, flashcards, and quizzes.
              </p>
            </div>

            {/* Text Input Area */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Text or Instructions
              </label>
              <textarea 
                value={aiText} 
                onChange={(e) => setAiText(e.target.value)} 
                onKeyDown={(e) => handleKeyPress(e, handleCreateAINoteSubmit)}
                placeholder="Paste any text or tell TaskMaster what notes you want.&#10;&#10;Examples:&#10;• Create study notes about the French Revolution&#10;• Make flashcards about JavaScript functions&#10;• [Your existing text here]" 
                rows={10} 
                className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-all duration-200 resize-none min-h-[200px]" 
              />
              <div className="text-xs text-[var(--text-muted)] flex justify-between items-center">
                <span>TaskMaster will create structured notes from your content or instructions</span>
                <span>{aiText.length} characters</span>
              </div>
            </div>


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
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${isDraggingOver
                  ? `border-[var(--bg-accent)] bg-[var(--interactive-hover)]`
                  : `border-[var(--border-primary)] hover:bg-[var(--interactive-hover)]`
                }
              `}
            >
              <CustomPDFIcon className={`w-10 h-10 text-[var(--text-primary)] mx-auto mb-3 ${isDraggingOver ? 'text-[var(--bg-accent)]' : ''}`} />
              <p className={`text-sm font-medium text-[var(--text-secondary)] mb-1`}>
                {isDraggingOver ? 'Drop PDF here' : 'Click or drag PDF file here'}
              </p>
              <p className={`text-xs text-[var(--text-muted)]`}>No file size limit</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
          </div>
        );
      case 'youtube':
        return (
          <div className="space-y-6 animate-fadeIn max-w-lg mx-auto">
            {/* Header Section */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <CustomYouTubeIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  YouTube Video to Notes
                </h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto">
                Transform any YouTube video into study notes<br />with key concepts and insights.
              </p>
            </div>

            {/* URL Input Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                YouTube Video URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, handleYoutubeLinkSubmit)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] transition-all duration-200"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <CustomYouTubeIcon className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Supports youtube.com and youtu.be links
              </p>
            </div>


          </div>
        );
    }
  };

   const renderFooterButtons = () => {
     if (mode === 'select' || isSubmitting) return null;

     const goBackAction = () => handleSetMode('select');
     
     const submitButtonClasses = "bg-[var(--bg-accent)] hover:bg-[var(--bg-accent-secondary)] text-[var(--text-white)] px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";

     switch (mode) {
       case 'personal':
         return (
           <>
             <button onClick={goBackAction} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreatePersonalNoteSubmit} disabled={!title.trim()} className={submitButtonClasses} >
               <Plus className="w-4 h-4" /> Create Note
             </button>
           </>
         );
       case 'ai':
         return (
           <>
             <button onClick={goBackAction} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreateAINoteSubmit} disabled={!aiText.trim()} className={submitButtonClasses} >
               <Sparkles className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       case 'pdf':
          return <button onClick={goBackAction} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-sm`}>Back</button>;
       case 'youtube':
         return (
           <>
             <button onClick={goBackAction} className={`bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleYoutubeLinkSubmit} disabled={!youtubeUrl.trim()} className={submitButtonClasses} >
               <CustomYouTubeIcon className="w-4 h-4" /> Generate Note
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
      <div className={`bg-[var(--bg-primary)] rounded-xl shadow-2xl ${mode === 'personal' || mode === 'youtube' ? 'max-w-lg' : mode === 'ai' ? 'max-w-2xl' : 'max-w-xl'} w-full max-h-[90vh] flex flex-col border border-[var(--border-primary)]`} data-note-generation={isSubmitting}>

        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] flex-shrink-0">
           <h2 className={`text-lg font-semibold text-[var(--text-primary)]`}>
             {isSubmitting ? 'Processing...' :
              mode === 'select' ? 'Create New Note' :
              mode === 'personal' ? 'Create Personal Note' :
              mode === 'ai' ? 'Text to Note' :
              mode === 'pdf' ? 'PDF to Note' :
              mode === 'youtube' ? 'YouTube to Note' : 'Create New Note'
             }
           </h2>
          <button onClick={onClose} disabled={isSubmitting} className={`text-[var(--text-muted)] disabled:opacity-50 transition-opacity rounded-full p-1`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- CORRECTED CONTENT WRAPPER --- */}
        <div 
          className={isSubmitting 
            // When submitting, use flexbox to push content to the bottom, then add padding to lift it up.
            ? "flex-1 p-4 flex flex-col  justify-end pb-20 min-h-[250px]"
            // Otherwise, use the standard scrolling behavior.
            : "flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] scrollbar-track-transparent min-h-[250px]"
          }
        >
          {renderContent()}
        </div>
        {/* --- END OF CORRECTION --- */}

        <div className="p-4 border-t border-[var(--border-primary)] flex-shrink-0 min-h-[68px] flex items-center justify-end gap-2">
          {error && !isSubmitting && (
            <div className={`p-2 rounded-md flex items-center gap-2 text-xs bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/20 w-full animate-fadeIn`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
               <button onClick={() => setError(null)} title="Dismiss error" className={`ml-2 p-0.5 rounded hover:opacity-70 hover:bg-[var(--status-error)]/20`}>
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
