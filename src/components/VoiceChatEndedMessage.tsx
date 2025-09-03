// src/components/VoiceChatEndedMessage.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { X, AudioWaveform } from 'lucide-react';

interface VoiceChatEndedMessageProps {
  duration?: string;
  onClose?: () => void;
}

export const VoiceChatEndedMessage: React.FC<VoiceChatEndedMessageProps> = ({
  duration,
  onClose
}) => {

  const formatDuration = (durationStr: string) => {
    // If duration is already formatted, return as is
    if (durationStr.includes(':')) return durationStr;
    
    // Otherwise, assume it's in seconds and format it
    const seconds = parseInt(durationStr);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center my-4"
    >
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl text-sm font-medium min-w-0"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
          boxShadow: '0 1px 3px 0 var(--shadow-light)'
        }}
      >
        {/* Left side: Icon and text */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2 rounded-full flex-shrink-0"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-muted)'
            }}
          >
            <AudioWaveform className="w-4 h-4" />
          </div>
          
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span style={{ color: 'var(--text-primary)' }} className="whitespace-nowrap">Voice chat ended</span>
            
            {duration && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: 'var(--text-muted)' }} className="whitespace-nowrap">
                  {formatDuration(duration)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side: Close button */}
        <div className="flex items-center flex-shrink-0">
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-opacity-80"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--interactive-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
