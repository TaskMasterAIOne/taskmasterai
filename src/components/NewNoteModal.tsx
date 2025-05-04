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
  Briefcase
} from 'lucide-react';

// --- Interface ---
interface NewNoteModalProps {
  onClose: () => void;
  onCreatePersonalNote: (title: string, content: string, tags: string[]) => Promise<void>;
  onCreateAINote: (text: string) => Promise<void>;
  onUploadPDF: (file: File) => Promise<void>;
  onYoutubeLink: (url: string) => Promise<void>;
  // No operationStatus prop needed anymore
  isIlluminateEnabled: boolean;
  isBlackoutEnabled: boolean;
}

// --- Component ---
export function NewNoteModal({
  onClose,
  onCreatePersonalNote,
  onCreateAINote,
  onUploadPDF,
  onYoutubeLink,
  isIlluminateEnabled,
  isBlackoutEnabled
}: NewNoteModalProps) {
  // --- State ---
  const [mode, setMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube'>('select');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiText, setAiText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Internal loading and error state management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOperationMode, setCurrentOperationMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  // Reset loading context when loading finishes
  useEffect(() => {
    if (!isLoading) {
      setCurrentOperationMode(null);
    }
  }, [isLoading]);

  // Clear error when changing mode
  useEffect(() => {
    setError(null);
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


  // --- Handlers ---
  const handleAddTag = () => {
    const trimmedTag = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
        setTags([...tags, trimmedTag]);
        setNewTag('');
    } else if (tags.length >= 5) {
        alert("Maximum 5 tags allowed.");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleClose = () => {
      if (!isLoading) {
          setError(null); // Clear error on manual close
          onClose();
      }
  }

  const handleSetMode = (newMode: 'select' | 'personal' | 'ai' | 'pdf' | 'youtube') => {
    if (!isLoading) {
        setError(null); // Clear error when changing mode via buttons
        setMode(newMode);
    }
  }

  // Action executor: sets internal loading/error states
  const executeAction = async (action: () => Promise<void>, actionType: typeof mode) => {
    if (isLoading) return;
    setCurrentOperationMode(actionType);
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      await action();
      // Action successful - Parent might close modal via onClose prop passed to it
      // Or if the action itself doesn't close, call handleClose() here maybe?
      // Let's assume the parent handles the closing on success for now.
    } catch (e: any) {
      console.error("Action failed:", e);
      setError(e.message || "An unexpected error occurred. Please try again."); // Set internal error state
    } finally {
      setIsLoading(false);
      // currentOperationMode reset is handled by useEffect watching isLoading
    }
  };

  // Specific action triggers
  const handleCreatePersonalNoteSubmit = () => {
    if (!title.trim() || !content.trim() || isLoading) return;
    executeAction(() => onCreatePersonalNote(title.trim(), content.trim(), tags), 'personal');
  };

  const handleCreateAINoteSubmit = () => {
    if (!aiText.trim() || isLoading) return;
    executeAction(() => onCreateAINote(aiText.trim()), 'ai');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) {
      setError("Invalid file type. Please select a PDF."); // Use internal error state
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    executeAction(() => onUploadPDF(file), 'pdf');
     if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleYoutubeLinkSubmit = () => {
    if (!youtubeUrl.trim() || isLoading) return;
    const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!urlPattern.test(youtubeUrl.trim())) {
      setError("Please enter a valid YouTube URL."); // Use internal error state
      return;
    }
    executeAction(() => onYoutubeLink(youtubeUrl.trim()), 'youtube');
  };

  // --- Rendering Logic ---

  // Loading state display
  const getLoadingState = () => {
    if (!isLoading || !currentOperationMode) return null; // Should not happen if isLoading is true

    let message = "Processing...";
    let IconComponent: React.ElementType | null = null;

    switch (currentOperationMode) {
      case 'personal':
        message = "Saving your note...";
        IconComponent = Briefcase;
        break;
      case 'ai':
        message = "Generating AI insights...";
        IconComponent = Sparkles;
        break;
      case 'pdf':
        message = "Analyzing PDF document...";
        IconComponent = FileText;
        break;
      case 'youtube':
        message = "Processing YouTube video...";
        IconComponent = Youtube;
        break;
    }

    return (
      <div className="flex flex-col items-center justify-center text-center p-4 space-y-3 animate-fadeIn">
         {IconComponent && <IconComponent className={`w-8 h-8 ${iconColor} mb-2 animate-pulse`} />}
         <Loader2 className={`w-6 h-6 ${iconColor} animate-spin`} />
         <p className={`text-sm font-medium ${loadingTextColor}`}>{message}</p>
         <p className={`text-xs ${loadingTextColor} opacity-80`}>Please wait...</p>
      </div>
    );
  };

  // Main content rendering (switches between modes or shows loading)
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
            ].map(({ mode, Icon, title, desc, color }) => (
              <button
                key={mode}
                onClick={() => handleSetMode(mode as any)}
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
              onClick={() => !isLoading && fileInputRef.current?.click()} // Ensure click doesn't work while loading
              className={`border-2 border-dashed ${isIlluminateEnabled ? 'border-gray-300' : 'border-gray-600'} rounded-lg p-6 text-center transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed bg-opacity-50' : `cursor-pointer ${isIlluminateEnabled ? 'hover:border-blue-400 hover:bg-gray-50' : 'hover:border-blue-500 hover:bg-gray-700/50'}`}`}
            >
              <Upload className={`w-10 h-10 ${iconColor} mx-auto mb-3`} />
              <p className={`text-sm font-medium ${textColor} mb-1`}>Click or drag PDF file here</p>
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

   // Footer buttons rendering
   const renderFooterButtons = () => {
     // Never show buttons while loading
     if (isLoading) return null;

     // Determine Back button action
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
          // Only show Back button for PDF mode in footer
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
       case 'select': // No buttons in select mode footer
         default:
         return null;
     }
   };


  // --- JSX Structure ---
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`${modalBg} rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col`}> {/* Removed fixed p-5, allow flex growth */}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className={`text-lg font-semibold ${headingColor}`}>
            {mode === 'select' ? 'Create New Note' :
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

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[200px]"> {/* Added padding here */}
          {renderContent()}
        </div>

        {/* Footer: Error Display OR Action Buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 min-h-[68px] flex items-center justify-end gap-2"> {/* Added padding */}
          {/* Error Message (takes priority over buttons if not loading) */}
          {!isLoading && error && (
            <div className={`p-2 rounded-md flex items-center gap-2 text-xs ${errorBg} w-full animate-fadeIn`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              {/* Optional: Add a dismiss button for the error? */}
              {/* <button onClick={() => setError(null)} className="p-1 rounded hover:bg-red-200 dark:hover:bg-red-700/50"><X className="w-3 h-3" /></button> */}
            </div>
          )}

          {/* Action Buttons (only shown if not loading and no error) */}
          {!isLoading && !error && (
             <div className="flex justify-end gap-2 w-full">
                 {renderFooterButtons()}
             </div>
          )}

           {/* Keep footer height consistent even when loading (buttons/error hidden) */}
           {isLoading && <div className="h-[36px]"></div> }
        </div>
      </div>
    </div>
  );
}
