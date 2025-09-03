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
  messages: TaskMasterLiveMessage[];
  error: string | null;
  userTier: string | null;
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
  const [messages, setMessages] = useState<TaskMasterLiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);

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

  useEffect(() => {
    // Initialize output audio context and playback queue
    if (!outputAudioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = context;
      audioPlaybackQueueRef.current = new AudioPlaybackQueue(context);

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
  }, []);

  const connect = useCallback(async (config: TaskMasterLiveConfig = {}) => {
    if (isConnecting || isConnected) {

      return;
    }

    // Rate limit connection attempts
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;
    
    if (timeSinceLastAttempt < 5000) { // 5 second cooldown

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

    setIsConnecting(true);
    setError(null);

    try {
      if (!auth.currentUser) {
        throw new Error('User must be authenticated');
      }

      // Get API key from Firebase Function
      const functions = getFunctions();
      const createToken = httpsCallable(functions, 'createGeminiLiveToken');
      
      const result = await createToken({
        systemInstruction: config.systemInstruction,
        model: config.model
      });

      const tokenData = result.data as {
        token: string;
        model: string;
        userTier: string;
        systemInstruction: string;
      };

      setUserTier(tokenData.userTier);

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
        model: tokenData.model,
        config: sessionConfig,
        callbacks: {
          onopen: () => {

            setIsConnected(true);
            setIsConnecting(false);
            connectionAttemptsRef.current = 0; // Reset attempts on successful connection
            addMessage({ type: 'connected', content: 'Connected to TaskMaster Live API' });
          },
          onmessage: (message: any) => {
            // Identify message type for better debugging
            let messageType = 'unknown';
            if (message.setupComplete) messageType = 'setupComplete';
            else if (message.serverContent?.inputTranscription) messageType = 'inputTranscription';
            else if (message.serverContent?.outputTranscription) messageType = 'outputTranscription';
            else if (message.serverContent?.modelTurn) messageType = 'modelTurn';
            else if (message.text) messageType = 'textResponse';
            else if (message.serverContent?.interrupted) messageType = 'interrupted';
            


            // Handle text responses and transcriptions
            if (message.text) {

              addMessage({ type: 'output', content: message.text, data: message });
            }
            if (message.serverContent?.inputTranscription?.text) {

              addMessage({ type: 'input', content: message.serverContent.inputTranscription.text });
            }
            if (message.serverContent?.outputTranscription?.text) {

              addMessage({ type: 'output', content: message.serverContent.outputTranscription.text });
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
            }
          },
          onerror: (error: any) => {
            console.error('TaskMaster Live error:', error);
            setError('Connection error: ' + error.message);
            addMessage({ type: 'error', content: 'Connection error' });
            setIsConnecting(false);
          },
          onclose: (event: any) => {
            console.log('TaskMaster Live session closed:', event.reason);
            setIsConnected(false);
            setIsConnecting(false);
            addMessage({ type: 'disconnected', content: 'Disconnected from TaskMaster Live API' });
          }
        }
      });

      sessionRef.current = session;

    } catch (err: any) {
      console.error('Error connecting to TaskMaster Live:', err);
      setError(err.message || 'Failed to connect to TaskMaster Live');
      setIsConnecting(false);
      addMessage({ type: 'error', content: err.message || 'Connection failed' });
    }
  }, [isConnecting, isConnected, addMessage]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopRecording(); // Also stops and cleans up audio resources
    audioPlaybackQueueRef.current?.stop();
    setIsConnected(false);
    setIsConnecting(false);
    addMessage({ type: 'disconnected', content: 'Disconnected from voice chat' });
  }, [addMessage]);

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
      // Microphone access granted
      const audioTracks = stream.getAudioTracks().map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      }));

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
    messages,
    error,
    userTier,
    connect,
    disconnect,
    sendText,
    startRecording,
    stopRecording,
    clearMessages
  };
};