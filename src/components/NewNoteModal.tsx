import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Youtube,
  Plus,
  X,
  AlertTriangle,
  Tag,
  Sparkles,
  Loader2,
  Briefcase,
  Clock
} from 'lucide-react';
import {
    UserTier, // Import the type
    NOTE_LIMITS // Import NOTE_LIMITS from central location
} from '../lib/current-paying-user'; // Correct path

// --- Constants for Simulation ---
const SIMULATION_INTERVAL = 150; // Update progress every 150ms
const LONG_OPERATION_THRESHOLD = 30000; // Show warning after 30 seconds (10000ms)

// Simplified Status Update Times (adjust if needed based on new messages)
const STATUS_UPDATE_TIMES = {
  pdf: [5000], // Change status at 5s
  youtube: [6000], // Change status at 6s
  ai: [4000], // Change status at 4s
  personal: [], // Too fast for status change
};

const ESTIMATED_DURATIONS = {
    pdf: 25000, // 25 seconds
    youtube: 30000, // 30 seconds
    ai: 12000, // 12 seconds
    personal: 1000, // 1 seconds (very quick)
    select: 0,
};


// --- Interface ---
interface NewNoteModalProps {
  onClose: () => void;
  onCreatePersonalNote: (title: string, content: string, tags: string[]) => Promise<void>;
  onCreateAINote: (text: string) => Promise<void>;
  onUploadPDF: (file: File) => Promise<void>;
  onYoutubeLink: (url: string) => Promise<void>;
  isIlluminateEnabled: boolean;
  isBlackoutEnabled: boolean;
  userTier: UserTier;
  noteUsage: { pdfAi: number; youtube: number; };
}

// --- Component ---
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
  // --- State ---
  const [mode, setMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube'>('select');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiText, setAiText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Internal loading, error, progress, and status management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStatusMessage, setCurrentStatusMessage] = useState("");
  const [showLongOperationWarning, setShowLongOperationWarning] = useState(false);
  const [currentOperationMode, setCurrentOperationMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube' | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false); // <-- ADDED for drag-and-drop

  // Refs to store timer IDs for cleanup
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const longWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Cleanup Timers ---
  const clearAllTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (longWarningTimeoutRef.current) {
      clearTimeout(longWarningTimeoutRef.current);
      longWarningTimeoutRef.current = null;
    }
    statusTimeoutRefs.current.forEach(clearTimeout);
    statusTimeoutRefs.current = [];
  };

  // Ensure timers are cleared on unmount if loading is interrupted
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

   // Reset loading context/state when loading finishes externally or internally
   useEffect(() => {
    if (!isLoading) {
      setCurrentOperationMode(null);
      setProgress(0);
      setCurrentStatusMessage("");
      setShowLongOperationWarning(false);
      setIsDraggingOver(false); // <-- ADDED: Reset drag state
      clearAllTimers();
    }
  }, [isLoading]);

  // Clear error and drag state when changing mode
  useEffect(() => {
    setError(null);
    setIsDraggingOver(false); // <-- ADDED: Reset drag state
  }, [mode]);


  // --- Theme Styles ---
  const modalBg = isIlluminateEnabled ? "bg-white" : isBlackoutEnabled ? "bg-black border border-gray-700" : "bg-gray-800";
  const textColor = isIlluminateEnabled ? "text-gray-700" : "text-gray-300";
  const headingColor = isIlluminateEnabled ? "text-gray-900" : "text-white";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500";
  const inputTextColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-200";
  const placeholderColor = isIlluminateEnabled ? "placeholder-gray-400" : "placeholder-gray-500";
  const buttonPrimaryClass = "bg-blue-600 hover:bg-blue-700 text-white";
  const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300";
  const buttonDisabledClass = "opacity-50 cursor-not-allowed";
  const selectionButtonBg = isIlluminateEnabled ? "bg-gray-50 hover:bg-gray-100 border border-gray-200" : "bg-gray-700 hover:bg-gray-600 border border-gray-600";
  const selectionButtonTextColor = isIlluminateEnabled ? "text-gray-800" : "text-gray-200";
  const selectionButtonSubTextColor = isIlluminateEnabled ? "text-gray-500" : "text-gray-400";
  const tagBg = isIlluminateEnabled ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300';
  const iconColor = isIlluminateEnabled ? "text-gray-500" : "text-gray-400";
  const errorBg = isIlluminateEnabled ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-300';
  const loadingTextColor = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const progressBg = isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600';
  const progressBarColor = 'bg-blue-500';
  // Drag-and-drop zone specific styles
  const dropZoneBaseBorder = isIlluminateEnabled ? 'border-gray-300' : 'border-gray-600';
  const dropZoneHoverBorder = isIlluminateEnabled ? 'border-blue-400' : 'border-blue-500';
  const dropZoneDragOverBorder = isIlluminateEnabled ? 'border-blue-500' : 'border-blue-400';
  const dropZoneBaseBg = ''; // No specific base bg, handled by hover/drag states
  const dropZoneHoverBg = isIlluminateEnabled ? 'hover:bg-gray-50' : 'hover:bg-gray-700/50';
  const dropZoneDragOverBg = isIlluminateEnabled ? 'bg-blue-50' : 'bg-gray-700';


  // --- Helper Function to Check Limits (Uses Props) ---
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


  // --- Handlers ---
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

  const handleClose = () => {
      if (!isLoading) {
          setError(null);
          onClose();
      }
  }

  const handleSetMode = (newMode: 'select' | 'personal' | 'ai' | 'pdf' | 'youtube') => {
    if (!isLoading) {
        setError(null);
        setMode(newMode);
    }
  }

  // --- Dynamic Status Messages Logic (Simplified) ---
  const getStatusMessages = (actionType: typeof mode): string[] => {
      switch (actionType) {
          case 'pdf': return ["Uploading PDF...", "Creating notes...", "Notes created from PDF!"];
          case 'youtube': return ["Fetching video info...", "Creating notes...", "Notes created from YouTube!"];
          case 'ai': return ["Processing text...", "Creating notes...", "AI notes generated!"];
          case 'personal': return ["Saving note...", "Note saved!"];
          default: return ["Processing...", "Completed!"];
      }
  }

  // --- Action Executor with Simulation ---
  const executeAction = async (action: () => Promise<void>, actionType: Exclude<typeof mode, 'select'>) => {
    if (isLoading) return;

    setCurrentOperationMode(actionType);
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setShowLongOperationWarning(false);
    setIsDraggingOver(false); // Reset drag state on action execution
    clearAllTimers();

    const statusMessages = getStatusMessages(actionType);
    setCurrentStatusMessage(statusMessages[0] || "Processing...");

    const estimatedDuration = ESTIMATED_DURATIONS[actionType];
    const progressIncrement = (100 / (estimatedDuration / SIMULATION_INTERVAL));

    progressIntervalRef.current = setInterval(() => {
        setProgress(prev => Math.min(prev + progressIncrement, 99));
    }, SIMULATION_INTERVAL);

    const updateTimes = STATUS_UPDATE_TIMES[actionType] || [];
    if (updateTimes.length > 0 && statusMessages.length > 2) {
       const timeoutId = setTimeout(() => {
         setCurrentStatusMessage(statusMessages[1]);
       }, updateTimes[0]);
       statusTimeoutRefs.current.push(timeoutId);
    }

    longWarningTimeoutRef.current = setTimeout(() => {
        setShowLongOperationWarning(true);
    }, LONG_OPERATION_THRESHOLD);

    try {
      await action();
      clearAllTimers();
      setProgress(100);
      setCurrentStatusMessage(statusMessages[statusMessages.length - 1] || "Completed!");
      setIsLoading(false);
      // Parent now handles onClose via the promise resolution

    } catch (e: any) {
      clearAllTimers();
      console.error("Action failed:", e);
      setError(e.message || "An unexpected error occurred. Please try again.");
      setProgress(0);
      setIsLoading(false);
    }
  };


  // Specific action triggers
  const handleCreatePersonalNoteSubmit = () => {
    if (!title.trim() || !content.trim() || isLoading) return;
    executeAction(() => onCreatePersonalNote(title.trim(), content.trim(), tags), 'personal');
  };

  const handleCreateAINoteSubmit = () => {
    if (!aiText.trim() || isLoading) return;
    if (!checkNoteLimit('pdfAi')) return;
    executeAction(() => onCreateAINote(aiText.trim()), 'ai');
  };

  const processPDFFile = (file: File) => { // Helper to avoid code duplication
    if (!file) return;
    if (!file.type.includes('pdf')) {
      setError("Invalid file type. Please select a PDF.");
      if (fileInputRef.current) fileInputRef.current.value = ""; // Clear for click input
      return;
    }
    if (!checkNoteLimit('pdfAi')) {
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear for click input
        return;
    }
    executeAction(() => onUploadPDF(file), 'pdf');
     if (fileInputRef.current) fileInputRef.current.value = ""; // Clear for click input
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    const file = event.target.files?.[0];
    processPDFFile(file as File);
  };

  const handleYoutubeLinkSubmit = () => {
    if (!youtubeUrl.trim() || isLoading) return;
    const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!urlPattern.test(youtubeUrl.trim())) {
      setError("Please enter a valid YouTube URL.");
      return;
    }
    if (!checkNoteLimit('youtube')) return;
    executeAction(() => onYoutubeLink(youtubeUrl.trim()), 'youtube');
  };

  // --- Drag and Drop Handlers for PDF ---
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isLoading) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Crucial for onDrop to fire
    event.stopPropagation();
    if (!isLoading) {
      setIsDraggingOver(true); // Keep it true while dragging over
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Check if the mouse is leaving the element or one of its children
    // A simple check is if relatedTarget (where the mouse is going) is outside the dropzone
    const dropZone = event.currentTarget;
    if (!dropZone.contains(event.relatedTarget as Node)) {
        setIsDraggingOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    if (isLoading) return;

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0]; // Process the first file
      processPDFFile(file);
    }
  };

  // --- Rendering Logic ---

  const getLoadingState = () => {
    if (!isLoading || !currentOperationMode) return null;

    let IconComponent: React.ElementType | null = null;
     switch (currentOperationMode) {
       case 'personal': IconComponent = Briefcase; break;
       case 'ai': IconComponent = Sparkles; break;
       case 'pdf': IconComponent = FileText; break;
       case 'youtube': IconComponent = Youtube; break;
     }

    return (
      <div className="flex flex-col items-center justify-center text-center p-4 space-y-3 animate-fadeIn min-h-[200px]">
         <div className="flex items-center justify-center gap-3 mb-2">
            {IconComponent && <IconComponent className={`w-7 h-7 ${iconColor} animate-pulse`} />}
            <Loader2 className={`w-6 h-6 ${iconColor} animate-spin`} />
         </div>
         <p className={`text-sm font-medium ${loadingTextColor}`}>{currentStatusMessage}</p>
         <div className={`w-full h-2 rounded-full overflow-hidden ${progressBg}`}>
            <div
              className={`h-full ${progressBarColor} transition-all duration-150 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={`text-xs ${loadingTextColor} opacity-80`}>{Math.round(progress)}%</p>
         <p className={`text-xs ${loadingTextColor} opacity-70 mt-1`}>Please wait...</p>
         {showLongOperationWarning && (
            <div className={`flex items-center gap-1.5 text-xs ${loadingTextColor} opacity-90 mt-2 p-1.5 rounded-md ${isIlluminateEnabled ? 'bg-yellow-100/60' : 'bg-yellow-500/10'}`}>
                <Clock className="w-3 h-3 text-yellow-500 dark:text-yellow-400" />
                <span>This may take a while...</span>
            </div>
         )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[250px]">
             {getLoadingState()}
        </div>
       );
    }

    switch (mode) {
       case 'select':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
            {[
              { mode: 'personal', Icon: Briefcase, title: 'Personal Note', desc: 'Create manually', color: 'text-green-500 dark:text-green-400' },
              { mode: 'ai', Icon: Sparkles, title: 'AI Note', desc: 'Generate from text', color: 'text-purple-500 dark:text-purple-400' },
              { mode: 'pdf', Icon: Upload, title: 'PDF to Note', desc: 'Upload a PDF', color: 'text-red-500 dark:text-red-400' },
              { mode: 'youtube', Icon: Youtube, title: 'YouTube to Note', desc: 'Use a video link', color: 'text-pink-500 dark:text-pink-400' },
            ].map(({ mode: btnMode, Icon, title, desc, color }) => (
              <button
                key={btnMode}
                onClick={() => handleSetMode(btnMode as any)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg ${selectionButtonBg} hover:shadow-md transition-all duration-150`}
              >
                <Icon className={`w-8 h-8 ${color}`} />
                <span className={`text-sm font-medium ${selectionButtonTextColor}`}>{title}</span>
                <span className={`text-xs ${selectionButtonSubTextColor}`}>{desc}</span>
              </button>
            ))}
          </div>
        );
      case 'personal':
        return (
          <div className="space-y-3 animate-fadeIn">
            <div>
              <label className={`block text-xs font-medium ${textColor} mb-1`}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title..." className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1`} />
            </div>
            <div>
              <label className={`block text-xs font-medium ${textColor} mb-1`}>Content (Markdown)</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Note content..." rows={8} className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 min-h-[150px]`} />
            </div>
            <div>
              <label className={`block text-xs font-medium ${textColor} mb-1`}>Tags (Optional, max 5)</label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tags.map((tag) => (
                  <span key={tag} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${tagBg}`}>
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className={`hover:opacity-70`}>
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
                    className={`flex-1 ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1 text-xs focus:outline-none focus:ring-1`} />
                  <button onClick={handleAddTag} disabled={!newTag.trim()} className={`${buttonSecondaryClass} px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${!newTag.trim() ? buttonDisabledClass : ''}`}>
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
            <label className={`block text-xs font-medium ${textColor} mb-1`}>Text to Process</label>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste or type text here..." rows={8} className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 min-h-[150px]`} />
          </div>
        );
      case 'pdf':
        return (
          <div className="animate-fadeIn">
            <div
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-150 ease-in-out
                ${isLoading
                  ? 'opacity-50 cursor-not-allowed bg-opacity-50 ' + dropZoneBaseBorder
                  : `cursor-pointer 
                     ${isDraggingOver
                       ? `${dropZoneDragOverBorder} ${dropZoneDragOverBg}`
                       : `${dropZoneBaseBorder} ${dropZoneHoverBg}`
                     }`
                }
              `}
            >
              <Upload className={`w-10 h-10 ${iconColor} mx-auto mb-3 ${isDraggingOver && !isLoading ? (isIlluminateEnabled ? 'text-blue-500' : 'text-blue-400') : ''}`} />
              <p className={`text-sm font-medium ${textColor} mb-1`}>
                {isDraggingOver && !isLoading ? 'Drop PDF here' : 'Click or drag PDF file here'}
              </p>
              <p className={`text-xs ${isIlluminateEnabled ? 'text-gray-500' : 'text-gray-400'}`}>No file size limit</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} disabled={isLoading} className="hidden" />
          </div>
        );
      case 'youtube':
        return (
           <div className="space-y-3 animate-fadeIn">
            <label className={`block text-xs font-medium ${textColor} mb-1`}>YouTube URL</label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1`} />
          </div>
        );
    }
  };

   const renderFooterButtons = () => {
     if (isLoading || mode === 'select') return null;

     const goBackAction = () => handleSetMode('select');

     switch (mode) {
       case 'personal':
         return (
           <>
             <button onClick={goBackAction} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreatePersonalNoteSubmit} disabled={!title.trim() || !content.trim()} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${!title.trim() || !content.trim() ? buttonDisabledClass : ''}`} >
               <Plus className="w-4 h-4" /> Create Note
             </button>
           </>
         );
       case 'ai':
         return (
           <>
             <button onClick={goBackAction} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreateAINoteSubmit} disabled={!aiText.trim()} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${!aiText.trim() ? buttonDisabledClass : ''}`} >
               <Sparkles className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       case 'pdf':
          // No primary action button for PDF as action is triggered by file select/drop
          return <button onClick={goBackAction} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>;
       case 'youtube':
         return (
           <>
             <button onClick={goBackAction} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleYoutubeLinkSubmit} disabled={!youtubeUrl.trim()} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${!youtubeUrl.trim() ? buttonDisabledClass : ''}`} >
               <Youtube className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       default:
         return null;
     }
   };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`${modalBg} rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col`}>

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
           <h2 className={`text-lg font-semibold ${headingColor}`}>
             {isLoading ? (currentOperationMode === 'personal' ? 'Saving Note...' :
                           currentOperationMode === 'ai' ? 'Generating AI Note...' :
                           currentOperationMode === 'pdf' ? 'Processing PDF...' :
                           currentOperationMode === 'youtube' ? 'Processing YouTube...' :
                           'Processing...') :
              mode === 'select' ? 'Create New Note' :
              mode === 'personal' ? 'New Personal Note' :
              mode === 'ai' ? 'New AI Note' :
              mode === 'pdf' ? 'PDF to Note' :
              mode === 'youtube' ? 'YouTube to Note' : 'Create New Note'
             }
           </h2>
          <button onClick={handleClose} disabled={isLoading} className={`${iconColor} ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70'} transition-opacity rounded-full p-1`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[250px]">
          {renderContent()}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 min-h-[68px] flex items-center justify-end gap-2">
          {!isLoading && error && (
            <div className={`p-2 rounded-md flex items-center gap-2 text-xs ${errorBg} w-full animate-fadeIn`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
               <button onClick={() => setError(null)} title="Dismiss error" className={`ml-2 p-0.5 rounded hover:opacity-70 ${isIlluminateEnabled ? 'hover:bg-red-200' : 'hover:bg-red-900/50'}`}>
                 <X className="w-3 h-3" />
                </button>
            </div>
          )}

          {!isLoading && !error && (
             <div className="flex justify-end gap-2 w-full">
                 {renderFooterButtons()}
             </div>
          )}

           {isLoading && <div className="h-[16px] w-full"></div> } {/* Placeholder to prevent layout jump when error disappears */}
        </div>
      </div>
    </div>
  );
}
