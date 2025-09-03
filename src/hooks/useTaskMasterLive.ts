import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../lib/firebase';
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, Session } from '@google/genai';
import { AudioPlaybackQueue } from '../lib/AudioPlaybackQueue';
import { createBlob, decode } from '../lib/utils';
import processorUrl from '../lib/audio-processor.js?url';

export interface TaskMasterLiveConfig {
  systemInstruction?: string;
  model?: string;
  responseModalities?: string[];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName?: string;
      }
    }
  };
  realtimeInputConfig?: {
    automaticActivityDetection?: {
      disabled?: boolean;
      startOfSpeechSensitivity?: string;
      endOfSpeechSensitivity?: string;
      silenceDurationMs?: number;
    }
  };
}

export interface TaskMasterLiveMessage {
  type: 'setup' | 'input' | 'output' | 'error' | 'connected' | 'disconnected';
  data?: any;
  content?: string;
  audio?: ArrayBuffer;
  timestamp: number;
}

export interface UseTaskMasterLiveReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  isAISpeaking: boolean;
  messages: TaskMasterLiveMessage[];
  error: string | null;
  userTier: string | null;
  fallbackUsed: boolean;
  currentModel: string | null;
  connect: (config?: TaskMasterLiveConfig) => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearMessages: () => void;
}

export const useTaskMasterLive = (): UseTaskMasterLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [messages, setMessages] = useState<TaskMasterLiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [clientSideFallback, setClientSideFallback] = useState(() => {
    // Initialize from localStorage to persist across page reloads
    return localStorage.getItem('taskmaster-client-side-fallback') === 'true';
  });
  const [nullModelRetryCount, setNullModelRetryCount] = useState(0);
  const [unexpectedDisconnectCount, setUnexpectedDisconnectCount] = useState(0);
  const clientSideFallbackRef = useRef(localStorage.getItem('taskmaster-client-side-fallback') === 'true');
  const lastConfigRef = useRef<TaskMasterLiveConfig | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackQueueRef = useRef<AudioPlaybackQueue | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const lastConnectionAttemptRef = useRef<number>(0);
  const connectionAttemptsRef = useRef<number>(0);
  const audioChunkCountRef = useRef<number>(0);
  
  // Add refs for accumulating transcription fragments
  const currentOutputTranscriptionRef = useRef<string>('');
  const currentInputTranscriptionRef = useRef<string>('');
  const outputTranscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputTranscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize output audio context and playback queue
    if (!outputAudioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = context;
      audioPlaybackQueueRef.current = new AudioPlaybackQueue(context);
      
      // Set up callback to track AI speaking state
      audioPlaybackQueueRef.current.setOnPlayingChange((isPlaying) => {
        setIsAISpeaking(isPlaying);
      });

    }

    return () => {
      // Cleanup on unmount
      disconnect();
    };
  }, []);

  const addMessage = useCallback((message: Omit<TaskMasterLiveMessage, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: Date.now() }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    // Clear transcription accumulation
    currentOutputTranscriptionRef.current = '';
    currentInputTranscriptionRef.current = '';
    if (outputTranscriptionTimeoutRef.current) {
      clearTimeout(outputTranscriptionTimeoutRef.current);
      outputTranscriptionTimeoutRef.current = null;
    }
    if (inputTranscriptionTimeoutRef.current) {
      clearTimeout(inputTranscriptionTimeoutRef.current);
      inputTranscriptionTimeoutRef.current = null;
    }
  }, []);

  // Helper function to finalize accumulated transcription
  const finalizeOutputTranscription = useCallback(() => {
    if (currentOutputTranscriptionRef.current.trim()) {
      addMessage({ 
        type: 'output', 
        content: currentOutputTranscriptionRef.current.trim() 
      });
      currentOutputTranscriptionRef.current = '';
    }
    if (outputTranscriptionTimeoutRef.current) {
      clearTimeout(outputTranscriptionTimeoutRef.current);
      outputTranscriptionTimeoutRef.current = null;
    }
  }, [addMessage]);

  const finalizeInputTranscription = useCallback(() => {
    if (currentInputTranscriptionRef.current.trim()) {
      addMessage({ 
        type: 'input', 
        content: currentInputTranscriptionRef.current.trim() 
      });
      currentInputTranscriptionRef.current = '';
    }
    if (inputTranscriptionTimeoutRef.current) {
      clearTimeout(inputTranscriptionTimeoutRef.current);
      inputTranscriptionTimeoutRef.current = null;
    }
  }, [addMessage]);

  const connect = useCallback(async (config: TaskMasterLiveConfig = {}, attemptFallback = false) => {

    
    if (isConnecting || isConnected) {
      return;
    }

    // Rate limit connection attempts
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;
    
    // Prevent rapid successive connection attempts
    if (timeSinceLastAttempt < 1000) { // 1 second minimum between attempts
      return;
    }
    
    // More lenient rate limiting for fallback attempts
    const rateLimitMs = (clientSideFallback || attemptFallback || clientSideFallbackRef.current) ? 2000 : 5000;
    if (timeSinceLastAttempt < rateLimitMs) {
      return;
    }

    if (connectionAttemptsRef.current >= 3 && timeSinceLastAttempt < 60000) { // Max 3 attempts per minute
      setError('Too many connection attempts. Please wait a moment and try again.');
      return;
    }

    lastConnectionAttemptRef.current = now;
    connectionAttemptsRef.current += 1;

    // Reset attempt counter after 1 minute
    if (timeSinceLastAttempt > 60000) {
      connectionAttemptsRef.current = 1;
    }


    // Store config for potential reconnection
    lastConfigRef.current = config;
    
    setIsConnecting(true);
    setError(null);

    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      // Get API key from Firebase Function - use original function (no backend fallback)
      const functions = getFunctions();
      const createToken = httpsCallable(functions, 'createTaskMasterLiveToken');
      
      const result = await createToken({
        systemInstruction: config.systemInstruction,
        model: config.model
      });

      const tokenData = result.data as {
        token: string;
        model: string;
        userTier: string;
        systemInstruction: string;
        fallbackUsed?: boolean;
        originalModel?: string;
      };

      setUserTier(tokenData.userTier);
      
      // Determine final model based on client-side fallback state
      let finalModel = tokenData.model;

      
      if (clientSideFallback || attemptFallback || clientSideFallbackRef.current) {
        finalModel = 'gemini-live-2.5-flash-preview'; // Use cascade model for fallback
        setFallbackUsed(true);

      } else {
        setFallbackUsed(tokenData.fallbackUsed || false);

      }
      
      // If we still don't have a valid model, retry or force cascade model
      if (!finalModel) {
        const newRetryCount = nullModelRetryCount + 1;
        setNullModelRetryCount(newRetryCount);
        
        if (newRetryCount <= 2) {
          setIsConnecting(false);
          setTimeout(() => {
            connect(config, attemptFallback);
          }, 1500);
          return;
        } else {

          finalModel = 'gemini-live-2.5-flash-preview';
          setFallbackUsed(true);
          setClientSideFallback(true);
          clientSideFallbackRef.current = true;
          localStorage.setItem('taskmaster-client-side-fallback', 'true');
          setNullModelRetryCount(0); // Reset for next session
        }
      }
      
      // Reset retry count on successful model retrieval
      setNullModelRetryCount(0);
      
      setCurrentModel(finalModel);

      // Initialize Google GenAI client with API key
      const ai = new GoogleGenAI({
        apiKey: tokenData.token
      });

      // Ensure output audio context is ready for playback
      if (outputAudioContextRef.current?.state === 'suspended') {

        await outputAudioContextRef.current.resume();
      }

      // Configure Live API session
      const sessionConfig = {
        responseModalities: [Modality.AUDIO], // Audio only for voice responses
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName || (tokenData.userTier === 'premium' ? 'Aoede' : 'Puck')
            }
          }
        },
        systemInstruction: tokenData.systemInstruction,
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            silenceDurationMs: 800
          }
        },
        // Enable transcription for debugging (empty object as per API docs)
        outputAudioTranscription: {}
      };

      // Connect to Live API

      const session = await ai.live.connect({
        model: finalModel,
        config: sessionConfig,
        callbacks: {
          onopen: () => {

            setIsConnected(true);
            setIsConnecting(false);
            connectionAttemptsRef.current = 0; // Reset attempts on successful connection
            setUnexpectedDisconnectCount(0); // Reset disconnect counter on successful connection
            addMessage({ type: 'connected', content: 'Connected to TaskMaster Live API' });
          },
          onmessage: (message: any) => {
            


            // Handle text responses and transcriptions
            if (message.text) {
              // For direct text responses, save immediately (these are usually complete)
              addMessage({ type: 'output', content: message.text, data: message });
            }
            
            // Handle input transcription fragments - accumulate them
            if (message.serverContent?.inputTranscription?.text) {
              const fragment = message.serverContent.inputTranscription.text;
              currentInputTranscriptionRef.current += fragment;
              
              // Clear existing timeout and set a new one to finalize after silence
              if (inputTranscriptionTimeoutRef.current) {
                clearTimeout(inputTranscriptionTimeoutRef.current);
              }
              inputTranscriptionTimeoutRef.current = setTimeout(finalizeInputTranscription, 1500);
            }
            
            // Handle output transcription fragments - accumulate them
            if (message.serverContent?.outputTranscription?.text) {
              const fragment = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += fragment;
              
              // Clear existing timeout and set a new one to finalize after silence
              if (outputTranscriptionTimeoutRef.current) {
                clearTimeout(outputTranscriptionTimeoutRef.current);
              }
              outputTranscriptionTimeoutRef.current = setTimeout(finalizeOutputTranscription, 1500);
            }

            // Handle audio from model - check multiple possible locations
            const audioData1 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            const audioData2 = message.serverContent?.modelTurn?.parts?.[0]?.audio;
            const audioData3 = message.audio;
            const audioData4 = message.serverContent?.audio;
            
            // Check for audio data in multiple locations
            const audioData = audioData1 || audioData2 || audioData3 || audioData4;

            
            if (audioData && typeof audioData === 'string') {

              const audioBuffer = decode(audioData);


              
              // Ensure audio context is resumed before playing
              if (outputAudioContextRef.current?.state === 'suspended') {

                outputAudioContextRef.current.resume();
              }
              
              audioPlaybackQueueRef.current?.add(audioBuffer);
              addMessage({ type: 'output', audio: audioBuffer, data: message });
            }

            // Handle interruption
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              audioPlaybackQueueRef.current?.stop();
              // Finalize any pending transcriptions when interrupted
              if (currentOutputTranscriptionRef.current.trim()) {
                finalizeOutputTranscription();
              }
              if (currentInputTranscriptionRef.current.trim()) {
                finalizeInputTranscription();
              }
            }
          },
          onerror: (error: any) => {
            console.error('TaskMaster Live error:', error);
            
            // Check if this is a quota error for premium users
            const isQuotaError = error.message && (
              error.message.includes('quota') || 
              error.message.includes('limit') ||
              error.message.includes('429') ||
              error.message.includes('QUOTA_EXCEEDED') ||
              error.message.includes('Resource has been exhausted') ||
              error.message.includes('You exceeded your current quota')
            );
            
            if (isQuotaError && tokenData.userTier === 'premium' && !clientSideFallback) {

              
              // Set client-side fallback flag and retry
              setClientSideFallback(true);
              clientSideFallbackRef.current = true;
              localStorage.setItem('taskmaster-client-side-fallback', 'true');
              setIsConnecting(false);
              
              // Clean up session without full disconnect to preserve clientSideFallback state
              if (sessionRef.current) {
                sessionRef.current.close();
                sessionRef.current = null;
              }
              
              // Retry with client-side fallback after a short delay
              setTimeout(() => {
                // Ensure clean state before retry
                setError(null);
                connect(config, true);
              }, 2000); // Increased delay to 2 seconds
              return;
            } else if (isQuotaError && clientSideFallback) {
              setError('All voice models are currently at capacity. Please try again later.');
              setIsConnecting(false);
              return;
            }
            
            setError('Connection error: ' + error.message);
            addMessage({ type: 'error', content: 'Connection error' });
            setIsConnecting(false);
          },
          onclose: (event: any) => {

            setIsConnected(false);
            setIsConnecting(false);
            addMessage({ type: 'disconnected', content: 'Disconnected from TaskMaster Live API' });

            // Check if this is a quota error for premium users
            const isQuotaError = event.reason && (
              event.reason.includes('quota') || 
              event.reason.includes('limit') ||
              event.reason.includes('429') ||
              event.reason.includes('QUOTA_EXCEEDED') ||
              event.reason.includes('Resource has been exhausted') ||
              event.reason.includes('You exceeded your current quota')
            );
            
            if (isQuotaError && tokenData.userTier === 'premium' && !clientSideFallback) {

              
              // Set client-side fallback flag and retry
              setClientSideFallback(true);
              clientSideFallbackRef.current = true;
              localStorage.setItem('taskmaster-client-side-fallback', 'true');
              
              // Clean up session without resetting clientSideFallback
              if (sessionRef.current) {
                sessionRef.current.close();
                sessionRef.current = null;
              }
              stopRecording();
              audioPlaybackQueueRef.current?.stop();
              setIsConnected(false);
              setIsConnecting(false);
              
              // Retry with client-side fallback after a short delay
              setTimeout(() => {
                // Ensure clean state before retry
                setError(null);
                connect(config, true);
              }, 2000); // Increased delay to 2 seconds
            } else if (isQuotaError && clientSideFallback) {
              // If we're already using client-side fallback and still hitting quota limits
              setError('All voice models are currently at capacity. Please try again later.');
            } else if (!isQuotaError && !event.reason?.includes('User initiated disconnect')) {
              // Handle unexpected disconnections (not quota errors, not user-initiated)
              const newDisconnectCount = unexpectedDisconnectCount + 1;
              setUnexpectedDisconnectCount(newDisconnectCount);
              
              if (newDisconnectCount <= 3 && lastConfigRef.current) {
                // Auto-reconnect up to 3 times for unexpected disconnections
                setTimeout(() => {
                  if (lastConfigRef.current) {
                    connect(lastConfigRef.current, clientSideFallback || attemptFallback);
                  }
                }, 3000); // 3 second delay for unexpected disconnections
              } else {
                setError('Connection lost. Please try again.');
              }
            }
          }
        }
      });

      sessionRef.current = session;

    } catch (err: any) {
      console.error('Error connecting to TaskMaster Live:', err);
      
      // Check if this is a quota error during token creation and we haven't tried fallback yet
      const isQuotaError = err.message && (
        err.message.includes('quota') || 
        err.message.includes('limit') ||
        err.message.includes('429') ||
        err.message.includes('QUOTA_EXCEEDED') ||
        err.message.includes('Resource has been exhausted')
      );
      
      if (isQuotaError && !attemptFallback) {

        setIsConnecting(false);
        // Retry with fallback
        setTimeout(() => {
          connect(config, true);
        }, 1000);
        return;
      }
      
      setError(err.message || 'Failed to connect to TaskMaster Live');
      setIsConnecting(false);
      addMessage({ type: 'error', content: err.message || 'Connection failed' });
    }
  }, [isConnecting, isConnected, addMessage]);

  const disconnect = useCallback(() => {
    // Finalize any pending transcriptions before disconnecting
    if (currentOutputTranscriptionRef.current.trim()) {
      finalizeOutputTranscription();
    }
    if (currentInputTranscriptionRef.current.trim()) {
      finalizeInputTranscription();
    }
    
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopRecording(); // Also stops and cleans up audio resources
    audioPlaybackQueueRef.current?.stop();
    setIsConnected(false);
    setIsConnecting(false);
    setClientSideFallback(false); // Reset client-side fallback state
    clientSideFallbackRef.current = false; // Reset ref as well
    localStorage.removeItem('taskmaster-client-side-fallback'); // Clear localStorage
    setNullModelRetryCount(0); // Reset null model retry count
    setUnexpectedDisconnectCount(0); // Reset disconnect counter
    lastConfigRef.current = null; // Clear stored config
    addMessage({ type: 'disconnected', content: 'Disconnected from voice chat' });
  }, [addMessage, finalizeOutputTranscription, finalizeInputTranscription]);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current || !isConnected) {
      console.warn('Cannot send text: not connected');
      return;
    }

    try {
      sessionRef.current.sendClientContent({ 
        turns: [{ 
          role: "user", 
          parts: [{ text }] 
        }],
        turnComplete: true
      });
      addMessage({ type: 'input', content: text });
    } catch (error) {
      console.error('Error sending text:', error);
      addMessage({ type: 'error', content: 'Failed to send message' });
    }
  }, [isConnected, addMessage]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

        
        try {

          await inputAudioContextRef.current.audioWorklet.addModule(processorUrl);

        } catch (error) {
          console.error('❌ Error adding audio worklet module:', error);
          // Fallback or error handling
          setError('Failed to load audio processor. Please try refreshing the page.');
          return;
        }
      }
      await inputAudioContextRef.current.resume();


      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;

      mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);


      audioWorkletNodeRef.current = new AudioWorkletNode(
        inputAudioContextRef.current,
        'recorder-processor',
      );


      audioWorkletNodeRef.current.port.onmessage = (event) => {
        const pcmData = event.data;
        
        // Skip audio chunks if not ready
        if (!isRecording || !sessionRef.current || !isConnected) {
          return;
        }
        
        try {
          audioChunkCountRef.current += 1;
          // Track audio chunks (logging removed to reduce noise)
          const blob = createBlob(pcmData);
          sessionRef.current.sendRealtimeInput({ media: blob as any });
        } catch (error) {
          console.error('Error sending real-time audio:', error);
        }
      };

      // Set recording state BEFORE connecting to avoid race condition
      setIsRecording(true);


      mediaStreamSourceRef.current.connect(audioWorkletNodeRef.current);

      
      audioWorkletNodeRef.current.connect(inputAudioContextRef.current.destination);

    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording: ' + err.message);
      addMessage({ type: 'error', content: 'Failed to start recording' });
      stopRecording();
    }
  }, [isRecording, isConnected, addMessage]);

  const stopRecording = useCallback(() => {
    if (!isRecording && !mediaStreamRef.current) return;
    
    // Recording stopped - reset counter
    audioChunkCountRef.current = 0;
    setIsRecording(false);

    if (audioWorkletNodeRef.current && mediaStreamSourceRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null;
      audioWorkletNodeRef.current.disconnect();
      mediaStreamSourceRef.current.disconnect();
    }
    audioWorkletNodeRef.current = null;
    mediaStreamSourceRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.suspend();
    }
    
  }, [isRecording, addMessage]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isRecording,
    isAISpeaking,
    messages,
    error,
    userTier,
    fallbackUsed,
    currentModel,
    connect,
    disconnect,
    sendText,
    startRecording,
    stopRecording,
    clearMessages
  };
};