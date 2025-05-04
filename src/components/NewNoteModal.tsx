import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Youtube,
  Plus,
  X,
  // ChevronRight, // Removed as unused
  AlertTriangle,
  Tag,
  Sparkles,
  Loader2,
  Briefcase
} from 'lucide-react';

interface NewNoteModalProps {
  onClose: () => void;
  onCreatePersonalNote: (title: string, content: string, tags: string[]) => Promise<void>;
  onCreateAINote: (text: string) => Promise<void>;
  onUploadPDF: (file: File) => Promise<void>;
  onYoutubeLink: (url: string) => Promise<void>;
  // Simplified progress/status object
  operationStatus: {
    isLoading: boolean; // Is an operation currently in progress?
    error: string | null; // Error message if the last operation failed
  };
  isIlluminateEnabled: boolean;
  isBlackoutEnabled: boolean;
}

export function NewNoteModal({
  onClose,
  onCreatePersonalNote,
  onCreateAINote,
  onUploadPDF,
  onYoutubeLink,
  operationStatus, // Renamed for clarity
  isIlluminateEnabled,
  isBlackoutEnabled
}: NewNoteModalProps) {
  const [mode, setMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube'>('select');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [aiText, setAiText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentOperationMode, setCurrentOperationMode] = useState<'select' | 'personal' | 'ai' | 'pdf' | 'youtube' | null>(null);

  // Derive processing state from props
  const isProcessing = operationStatus.isLoading;

  // Track which mode initiated the processing for relevant messages/icons
  useEffect(() => {
    if (!isProcessing) {
      setCurrentOperationMode(null); // Reset when not processing
    }
    // If isProcessing is true, currentOperationMode should already be set by the action handler
  }, [isProcessing]);


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Styles
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
  // const progressBg = isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-600'; // Removed
  // const progressBarColor = operationStatus.error ? 'bg-red-500' : 'bg-blue-500'; // Removed
  const errorBg = isIlluminateEnabled ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-300';
  const loadingTextColor = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";

  // Handlers
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

  // Wrapper to initiate action and set the context for the loading message
  const executeAction = async (action: () => Promise<void>, actionType: typeof mode) => {
    if (isProcessing) return; // Should not happen if buttons are disabled, but safety first
    setCurrentOperationMode(actionType); // Set context *before* parent sets isLoading
    // Parent component is responsible for setting operationStatus.isLoading = true
    try {
      await action();
      // Parent handles success (e.g., closing modal) and setting isLoading = false
    } catch (e) {
      console.error("Action failed:", e);
      // Parent handles error state (setting error message) and setting isLoading = false
    }
    // No need to set isProcessing or currentOperationMode here; useEffect handles reset
  };

  const handleCreatePersonalNoteSubmit = () => {
    if (!title.trim() || !content.trim() || isProcessing) return;
    executeAction(() => onCreatePersonalNote(title.trim(), content.trim(), tags), 'personal');
  };

  const handleCreateAINoteSubmit = () => {
    if (!aiText.trim() || isProcessing) return;
    executeAction(() => onCreateAINote(aiText.trim()), 'ai');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) {
      alert("Please select a PDF file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    // No size limit
    executeAction(() => onUploadPDF(file), 'pdf');
     if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleYoutubeLinkSubmit = () => {
    if (!youtubeUrl.trim() || isProcessing) return;
    if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      alert("Please enter a valid YouTube URL.");
      return;
    }
    executeAction(() => onYoutubeLink(youtubeUrl.trim()), 'youtube');
  };

  // Determine loading message and icon based on the mode that started the operation
  const getLoadingState = () => {
    if (!isProcessing || !currentOperationMode) return null;

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
        IconComponent = FileText; // Use FileText for PDF analysis
        break;
      case 'youtube':
        message = "Processing YouTube video...";
        IconComponent = Youtube;
        break;
    }

    return (
      <div className="flex flex-col items-center justify-center text-center p-4 space-y-3 animate-fadeIn">
         {/* Optional: Show relevant icon pulsing */}
         {IconComponent && <IconComponent className={`w-8 h-8 ${iconColor} mb-2 animate-pulse`} />}
         <Loader2 className={`w-6 h-6 ${iconColor} animate-spin`} />
         <p className={`text-sm font-medium ${loadingTextColor}`}>{message}</p>
         <p className={`text-xs ${loadingTextColor} opacity-80`}>Please wait...</p>
      </div>
    );
  };


  const renderContent = () => {
    // If processing, show the loading state covering the main content area
    if (isProcessing) {
      return (
        <div className="flex items-center justify-center min-h-[250px]">
             {getLoadingState()}
        </div>
       );
    }

    // Otherwise, render the normal mode content
    switch (mode) {
      case 'select':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { mode: 'personal', Icon: Briefcase, title: 'Personal Note', desc: 'Create manually', color: 'text-green-500 dark:text-green-400' },
              { mode: 'ai', Icon: Sparkles, title: 'AI Note', desc: 'Generate from text', color: 'text-purple-500 dark:text-purple-400' },
              { mode: 'pdf', Icon: Upload, title: 'PDF to Note', desc: 'Upload a PDF', color: 'text-red-500 dark:text-red-400' },
              { mode: 'youtube', Icon: Youtube, title: 'YouTube to Note', desc: 'Use a video link', color: 'text-pink-500 dark:text-pink-400' },
            ].map(({ mode, Icon, title, desc, color }) => (
              <button
                key={mode}
                onClick={() => setMode(mode as any)} // No processing check needed here as this view isn't shown during processing
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
          // Ensure this section is not rendered if isProcessing is true (handled above)
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
            {/* Buttons moved to footer */}
          </div>
        );
      case 'ai':
        return (
           <div className="space-y-3 animate-fadeIn">
            <label className={`block text-xs font-medium ${textColor} mb-1`}>Text to Process</label>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste or type text here..." rows={8} className={`w-full ${inputBg} ${inputTextColor} ${placeholderColor} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 min-h-[150px]`} />
            {/* Buttons moved to footer */}
          </div>
        );
      case 'pdf':
        return (
          <div className="animate-fadeIn">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed ${isIlluminateEnabled ? 'border-gray-300 hover:border-blue-400 hover:bg-gray-50' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/50'} rounded-lg p-6 text-center cursor-pointer transition-colors`}
            >
              <Upload className={`w-10 h-10 ${iconColor} mx-auto mb-3`} />
              <p className={`text-sm font-medium ${textColor} mb-1`}>Click or drag PDF file here</p>
              <p className={`text-xs ${isIlluminateEnabled ? 'text-gray-500' : 'text-gray-400'}`}>No file size limit</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
             {/* Back Button moved to footer */}
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
            {/* Buttons moved to footer */}
          </div>
        );
    }
  };

   // Determine which buttons to show in the footer based on mode
   const renderFooterButtons = () => {
     if (isProcessing || mode === 'select') return null; // No buttons during processing or in select mode

     switch (mode) {
       case 'personal':
         return (
           <>
             <button onClick={() => setMode('select')} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreatePersonalNoteSubmit} disabled={!title.trim() || !content.trim()} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${!title.trim() || !content.trim() ? buttonDisabledClass : ''}`} >
               <Plus className="w-4 h-4" /> Create Note
             </button>
           </>
         );
       case 'ai':
         return (
           <>
             <button onClick={() => setMode('select')} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
             <button onClick={handleCreateAINoteSubmit} disabled={!aiText.trim()} className={`${buttonPrimaryClass} px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${!aiText.trim() ? buttonDisabledClass : ''}`} >
               <Sparkles className="w-4 h-4" /> Generate Note
             </button>
           </>
         );
       case 'pdf':
           // No primary action button here; action happens on file select. Only show Back.
          return <button onClick={() => setMode('select')} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>;
       case 'youtube':
         return (
           <>
             <button onClick={() => setMode('select')} className={`${buttonSecondaryClass} px-3 py-1.5 rounded-md text-sm`}>Back</button>
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
      <div className={`${modalBg} rounded-lg p-5 max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className={`text-lg font-semibold ${headingColor}`}>
            {mode === 'select' ? 'Create New Note' :
             mode === 'personal' ? 'New Personal Note' :
             mode === 'ai' ? 'New AI Note' :
             mode === 'pdf' ? 'PDF to Note' :
             mode === 'youtube' ? 'YouTube to Note' : 'Create New Note' // Fallback
            }
          </h2>
          <button onClick={!isProcessing ? onClose : undefined} disabled={isProcessing} className={`${iconColor} ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-70'} transition-opacity rounded-full p-1`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area (Shows loading state or mode content) */}
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 mb-4 custom-scrollbar min-h-[200px]"> {/* Added min-height */}
          {renderContent()}
        </div>

        {/* Footer: Error Display OR Action Buttons */}
        <div className="mt-auto flex-shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 min-h-[55px] flex items-center justify-end gap-2"> {/* Ensure consistent height */}
          {/* Error Message (only shown if not processing) */}
          {!isProcessing && operationStatus.error && (
            <div className={`p-2 rounded-md flex items-center gap-2 text-xs ${errorBg} w-full animate-fadeIn`}> {/* Make error fill width */}
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{operationStatus.error}</span>
            </div>
          )}

          {/* Action Buttons (only shown if not processing and no error) */}
          {!isProcessing && !operationStatus.error && (
             <div className="flex justify-end gap-2 w-full">
                 {renderFooterButtons()}
             </div>
          )}

           {/* Placeholder if processing (buttons hidden, loading shown in content area) */}
           {isProcessing && <div className="h-[38px]"></div> }

        </div>
      </div>
    </div>
  );
}

// Add this to your global CSS or a relevant CSS file for the custom scrollbar:
/*
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
.animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 20px; border: 3px solid transparent; }
html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(107, 114, 128, 0.5); }
.custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(156, 163, 175, 0.4) transparent; }
html.dark .custom-scrollbar { scrollbar-color: rgba(107, 114, 128, 0.5) transparent; }
*/
