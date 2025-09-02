// src/hooks/useGeminiLive.ts

import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { convertToPCM16 } from '../lib/ai-chat-firebase';

const functions = getFunctions();

export interface GeminiLiveSession {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  userTier: 'basic' | 'pro' | 'premium';
}

export interface VoiceMessage {
  role: 'user' | 'assistant';
  audioData?: ArrayBuffer;
  transcription?: string;
  timestamp: number;
}

export interface GeminiLiveConfig {
  responseModalities?: ['AUDIO'] | ['TEXT'];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName?: string;
      };
    };
    languageCode?: string;
  };
  systemInstruction?: string;
  realtimeInputConfig?: {
    automaticActivityDetection?: {
      disabled?: boolean;
      startOfSpeechSensitivity?: 'START_SENSITIVITY_LOW' | 'START_SENSITIVITY_HIGH';
      endOfSpeechSensitivity?: 'END_SENSITIVITY_LOW' | 'END_SENSITIVITY_HIGH';
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
}

export const useGeminiLive = () => {
  const [session, setSession] = useState<GeminiLiveSession>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    isLoading: false,
    error: null,
    userTier: 'basic'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ephemeralTokenRef = useRef<string | null>(null);
  const onMessageCallbackRef = useRef<((message: VoiceMessage) => void) | null>(null);
  const onTranscriptionCallbackRef = useRef<((text: string, isUser: boolean) => void) | null>(null);

  // Clean up resources
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    ephemeralTokenRef.current = null;
  }, []);

  // Create ephemeral token for secure client access
  const createEphemeralToken = useCallback(async (): Promise<string> => {
    try {
      setSession(prev => ({ ...prev, isLoading: true, error: null }));
      
      const createTokenFn = httpsCallable(functions, 'createGeminiEphemeralToken');
      const result = await createTokenFn({});
      const data = result.data as any;
      
      if (!data.token) {
        throw new Error('No token received from server');
      }

      ephemeralTokenRef.current = data.token;
      setSession(prev => ({ 
        ...prev, 
        userTier: data.userTier || 'basic',
        isLoading: false 
      }));
      
      return data.token;
    } catch (error: any) {
      console.error('Error creating ephemeral token:', error);
      setSession(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to create session token',
        isLoading: false 
      }));
      throw error;
    }
  }, []);

  // Connect to Live API [[memory:7781167]]
  const connect = useCallback(async (config?: GeminiLiveConfig): Promise<void> => {
    try {
      setSession(prev => ({ ...prev, isLoading: true, error: null }));

      // Get ephemeral token if we don't have one
      let token = ephemeralTokenRef.current;
      if (!token) {
        token = await createEphemeralToken();
      }

      // Determine model based on user tier
      const model = session.userTier === 'premium' 
        ? 'gemini-2.5-flash-preview-native-audio-dialog'
        : 'gemini-live-2.5-flash-preview';

      // Default config for Live API
      const defaultConfig: GeminiLiveConfig = {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: session.userTier === 'premium' ? 'Aoede' : 'Puck'
            }
          }
        },
        systemInstruction: 'You are a helpful AI assistant with voice capabilities. Respond naturally and conversationally.',
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
            prefixPaddingMs: 20,
            silenceDurationMs: 500
          }
        },
        ...config
      };

      // Connect to Live API WebSocket with ephemeral token
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.generativeai.v1alpha.GenerativeService.BidiGenerateContent?access_token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Gemini Live API');
        
        // Send setup message
        const setupMessage = {
          setup: {
            model: `models/${model}`,
            config: defaultConfig
          }
        };
        
        ws.send(JSON.stringify(setupMessage));
        
        setSession(prev => ({ 
          ...prev, 
          isConnected: true,
          isLoading: false 
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setSession(prev => ({ 
          ...prev, 
          isConnected: false,
          isRecording: false,
          isPlaying: false 
        }));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setSession(prev => ({ 
          ...prev, 
          error: 'Connection error',
          isConnected: false,
          isLoading: false 
        }));
      };

    } catch (error: any) {
      console.error('Error connecting to Live API:', error);
      setSession(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to connect',
        isLoading: false 
      }));
    }
  }, [session.userTier, createEphemeralToken]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.serverContent) {
      // Handle audio data
      if (message.data) {
        // Received audio data from assistant
        const audioData = new Uint8Array(atob(message.data).split('').map(c => c.charCodeAt(0)));
        playAudioData(audioData.buffer);
        
        if (onMessageCallbackRef.current) {
          onMessageCallbackRef.current({
            role: 'assistant',
            audioData: audioData.buffer,
            timestamp: Date.now()
          });
        }
      }

      // Handle transcriptions
      if (message.serverContent.outputTranscription) {
        const transcription = message.serverContent.outputTranscription.text;
        if (onTranscriptionCallbackRef.current) {
          onTranscriptionCallbackRef.current(transcription, false);
        }
      }

      if (message.serverContent.inputTranscription) {
        const transcription = message.serverContent.inputTranscription.text;
        if (onTranscriptionCallbackRef.current) {
          onTranscriptionCallbackRef.current(transcription, true);
        }
      }

      // Handle interruptions
      if (message.serverContent.interrupted) {
        setSession(prev => ({ ...prev, isPlaying: false }));
      }
    }

    // Handle errors
    if (message.error) {
      console.error('Live API error:', message.error);
      setSession(prev => ({ 
        ...prev, 
        error: message.error.message || 'API error' 
      }));
    }
  }, []);

  // Play audio data received from the API
  const playAudioData = useCallback(async (audioBuffer: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000 // Live API outputs at 24kHz
        });
      }

      const audioData = await audioContextRef.current.decodeAudioData(audioBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioData;
      source.connect(audioContextRef.current.destination);
      
      setSession(prev => ({ ...prev, isPlaying: true }));
      
      source.onended = () => {
        setSession(prev => ({ ...prev, isPlaying: false }));
      };
      
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      setSession(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  // Start recording audio input
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to Live API');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          try {
            // Convert audio to PCM16 format required by Live API
            const arrayBuffer = await event.data.arrayBuffer();
            const pcmData = await convertToPCM16(arrayBuffer, 16000);
            
            // Send audio to Live API
            const audioMessage = {
              realtimeInput: {
                audio: {
                  data: btoa(String.fromCharCode(...new Uint8Array(pcmData))),
                  mimeType: 'audio/pcm;rate=16000'
                }
              }
            };
            
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify(audioMessage));
            }
          } catch (error) {
            console.error('Error processing audio chunk:', error);
          }
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          if (onMessageCallbackRef.current) {
            onMessageCallbackRef.current({
              role: 'user',
              audioData: audioBlob.arrayBuffer() as any,
              timestamp: Date.now()
            });
          }
        }
      };

      mediaRecorder.start(100); // Capture in 100ms chunks
      setSession(prev => ({ ...prev, isRecording: true }));
      
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setSession(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to start recording' 
      }));
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Send audio stream end signal
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const endMessage = {
        realtimeInput: {
          audioStreamEnd: true
        }
      };
      wsRef.current.send(JSON.stringify(endMessage));
    }

    setSession(prev => ({ ...prev, isRecording: false }));
  }, []);

  // Send text message
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Live API');
    }

    const textMessage = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      }
    };

    wsRef.current.send(JSON.stringify(textMessage));
  }, []);

  // Disconnect from Live API
  const disconnect = useCallback(() => {
    cleanup();
    setSession(prev => ({ 
      ...prev, 
      isConnected: false,
      isRecording: false,
      isPlaying: false 
    }));
  }, [cleanup]);

  // Set message callback
  const onMessage = useCallback((callback: (message: VoiceMessage) => void) => {
    onMessageCallbackRef.current = callback;
  }, []);

  // Set transcription callback
  const onTranscription = useCallback((callback: (text: string, isUser: boolean) => void) => {
    onTranscriptionCallbackRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    session,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
    onMessage,
    onTranscription
  };
};
