// src/components/FullscreenVoiceChat.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  X,
  Settings2,
  Loader2,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import { useGeminiLive, type GeminiLiveConfig, type VoiceMessage } from '../hooks/useGeminiLive';
import { uploadAudioToStorage, saveVoiceMessage } from '../lib/ai-chat-firebase';
import { User } from 'firebase/auth';

interface FullscreenVoiceChatProps {
  user: User | null;
  conversationId: string;
  onMessage?: (message: any) => void;
  onTranscription?: (text: string, isUser: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenVoiceChat: React.FC<FullscreenVoiceChatProps> = ({
  user,
  conversationId,
  onMessage,
  onTranscription,
  isOpen,
  onClose
}) => {
  const {
    session,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    onMessage: setMessageCallback,
    onTranscription: setTranscriptionCallback
  } = useGeminiLive();

  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [config, setConfig] = useState<GeminiLiveConfig>({
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Puck'
        }
      }
    },
    systemInstruction: 'You are TaskMaster, a helpful AI assistant with voice capabilities. Respond naturally and conversationally.',
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        silenceDurationMs: 800
      }
    }
  });

  const animationRef = useRef<number>();

  // Initialize voice chat when opened
  useEffect(() => {
    if (isOpen && !session.isConnected && !session.isLoading) {
      handleConnect();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen]);

  // Set up message and transcription callbacks
  useEffect(() => {
    setMessageCallback(async (message: VoiceMessage) => {
      try {
        if (user && conversationId && message.audioData) {
          // Convert audio data to blob for storage
          const audioBlob = new Blob([message.audioData], { type: 'audio/webm' });
          
          // Upload to Firebase Storage
          const { downloadURL, duration } = await uploadAudioToStorage(
            user.uid,
            conversationId,
            audioBlob
          );

          // Save voice message to conversation
          await saveVoiceMessage(conversationId, {
            role: message.role,
            content: message.transcription || '[Voice Message]',
            audioUrl: downloadURL,
            audioDuration: duration,
            transcription: message.transcription,
            isVoiceMessage: true
          });

          // Notify parent component
          if (onMessage) {
            onMessage({
              role: message.role,
              content: message.transcription || '[Voice Message]',
              audioUrl: downloadURL,
              audioDuration: duration,
              isVoiceMessage: true,
              transcription: message.transcription
            });
          }
        }
      } catch (error) {
        console.error('Error handling voice message:', error);
      }
    });

    setTranscriptionCallback((text: string, isUser: boolean) => {
      setCurrentTranscription(text);
      setIsUserSpeaking(isUser);
      
      if (onTranscription) {
        onTranscription(text, isUser);
      }
    });
  }, [user, conversationId, onMessage, onTranscription, setMessageCallback, setTranscriptionCallback]);

  // Handle connection
  const handleConnect = async () => {
    try {
      await connect(config);
    } catch (error) {
      console.error('Failed to connect to voice chat:', error);
    }
  };

  // Handle disconnection
  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  // Toggle recording
  const handleToggleRecording = async () => {
    if (session.isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Voice selection options based on user tier
  const getAvailableVoices = () => {
    if (session.userTier === 'premium') {
      return [
        { id: 'Aoede', name: 'Aoede (Premium)', description: 'Warm and expressive' },
        { id: 'Leda', name: 'Leda (Premium)', description: 'Clear and professional' },
        { id: 'Orus', name: 'Orus (Premium)', description: 'Deep and authoritative' },
        { id: 'Zephyr', name: 'Zephyr (Premium)', description: 'Light and friendly' }
      ];
    } else {
      return [
        { id: 'Puck', name: 'Puck', description: 'Friendly and clear' },
        { id: 'Charon', name: 'Charon', description: 'Calm and steady' },
        { id: 'Kore', name: 'Kore', description: 'Warm and engaging' },
        { id: 'Fenrir', name: 'Fenrir', description: 'Strong and confident' }
      ];
    }
  };

  // Update voice configuration
  const updateVoice = (voiceName: string) => {
    setConfig(prev => ({
      ...prev,
      speechConfig: {
        ...prev.speechConfig,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center"
        style={{ 
          background: 'var(--bg-primary)',
          fontFamily: 'var(--font-body)',
          zIndex: 9999
        }}
      >


        {/* Header */}
        <div className="absolute top-0 right-0 p-6" style={{ zIndex: 10 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-full transition-all duration-200 hover:scale-105"
            style={{ 
              background: 'transparent',
              color: 'var(--text-primary)' 
            }}
          >
            <Settings2 className="w-5 h-5" style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-6 right-6 p-6 rounded-2xl max-w-md mx-auto"
              style={{ 
                zIndex: 20,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-heavy)'
              }}
            >
              <h3 
                className="font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Voice Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Voice
                  </label>
                  <select
                    value={config.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName || 'Puck'}
                    onChange={(e) => updateVoice(e.target.value)}
                    className="w-full p-3 rounded-lg text-sm"
                    style={{
                      background: 'var(--bg-highlight)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {getAvailableVoices().map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} - {voice.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Mute Microphone
                  </span>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 rounded-full transition-colors"
                    style={{ 
                      background: isMuted ? 'var(--status-error)' : 'var(--bg-highlight)',
                      color: isMuted ? 'var(--text-white)' : 'var(--text-secondary)'
                    }}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {session.error && (
          <div 
            className="absolute top-32 left-6 right-6 p-4 rounded-xl flex items-center space-x-3 max-w-md mx-auto"
            style={{ 
              zIndex: 15,
              background: 'var(--status-error)',
              color: 'var(--text-white)'
            }}
          >
            <AlertCircle className="w-6 h-6" />
            <span className="text-sm">{session.error}</span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-8 px-6 relative" style={{ zIndex: 10, marginTop: '-60px' }}>
          
          {/* Central AI Orb */}
          <div className="relative">


            {/* Main Orb */}
            <motion.div
              className="relative w-44 h-44 rounded-full flex items-center justify-center"
              style={{
                background: session.isConnected
                  ? session.isRecording
                    ? 'var(--status-error)'
                    : session.isPlaying
                    ? 'var(--status-info)'
                    : 'var(--bg-highlight)'
                  : 'var(--bg-highlight)',
                boxShadow: session.isConnected ? 'var(--shadow-heavy)' : 'var(--shadow-medium)'
              }}
              animate={{
                scale: session.isRecording ? [1, 1.05, 1] : 1
              }}
              transition={{
                duration: 1,
                repeat: session.isRecording ? Infinity : 0
              }}
            >
              {session.isLoading && (
                <Loader2 className="w-16 h-16 text-white animate-spin" />
              )}
            </motion.div>


          </div>

          {/* Transcription Display */}
          {currentTranscription && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto p-6 rounded-2xl text-center"
              style={{ 
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)' 
              }}
            >
              <div className="flex items-center justify-center space-x-2 mb-3">
                <MessageCircle className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <span 
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isUserSpeaking ? 'You' : 'TaskMaster'}
                </span>
              </div>
              <p 
                className="text-lg leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {currentTranscription}
              </p>
            </motion.div>
          )}

          {/* Status Text */}
          <div className="text-center space-y-2">
            {session.isConnected && !session.isLoading && (
              <div className="space-y-1">
                <p 
                  className="text-lg font-medium"
                  style={{
                    color: session.isRecording ? 'var(--status-error)' : 
                           session.isPlaying ? 'var(--status-info)' : 
                           'var(--text-primary)'
                  }}
                >
                  {session.isRecording ? 'Listening...' : 
                   session.isPlaying ? 'TaskMaster is speaking...' : 
                   'Ready to chat'}
                </p>
                
                {/* Voice Activity Visualization */}
                {(session.isRecording || session.isPlaying) && (
                  <div className="flex items-center justify-center space-x-1 h-6">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 rounded-full"
                        style={{
                          background: session.isRecording ? 'var(--status-error)' : 'var(--status-info)'
                        }}
                        animate={{
                          height: [4, 16, 4],
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.1,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="rounded-full transition-all duration-200 hover:scale-105"
              style={{
                padding: '18px',
                background: isMuted ? 'var(--status-error)' : 'var(--text-primary)',
                color: isMuted ? 'var(--text-white)' : 'var(--bg-primary)',
                border: '1px solid var(--border-primary)'
              }}
            >
              {isMuted ? <MicOff className="w-6 h-6" style={{ width: '26px', height: '26px' }} /> : <Mic className="w-6 h-6" style={{ width: '26px', height: '26px' }} />}
            </button>

            <button
              onClick={handleDisconnect}
              className="rounded-full transition-all duration-200 hover:scale-105"
              style={{
                padding: '18px',
                background: 'var(--bg-highlight)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <X className="w-6 h-6" style={{ width: '26px', height: '26px' }} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
