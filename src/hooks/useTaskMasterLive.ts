import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../lib/firebase';
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, Session, Type } from '@google/genai';
import { AudioPlaybackQueue } from '../lib/AudioPlaybackQueue';
import { createBlob, decode } from '../lib/utils';
import processorUrl from '../lib/audio-processor.js?url';
import { sanitizeErrorMessage } from '../lib/error-sanitizer';
import { useActionProcessor, type CompletedAction } from './useActionProcessor';

// Helper function to calculate text similarity
const calculateSimilarity = (str1: string, str2: string): number => {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};

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
  completedActions: CompletedAction[];
  isProcessingActions: boolean;
  connect: (config?: TaskMasterLiveConfig) => Promise<void>;
  disconnect: () => void;
  sendText: (text: string, files?: { type: string; base64Data: string; name: string }[]) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearMessages: () => void;
  clearCompletedActions: () => void;
  createVoiceSample: (voiceId: string, sampleText?: string) => Promise<ArrayBuffer | null>;
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
  
  // Action processing hook
  const { 
    completedActions, 
    isProcessing: isProcessingActions, 
    processJsonBlocks, 
    processAction,
    clearCompletedActions,
    addCompletedAction
  } = useActionProcessor();
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
  const recentMessagesRef = useRef<TaskMasterLiveMessage[]>([]);

  useEffect(() => {
    // Initialize output audio context and playback queue
    if (!outputAudioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioContextRef.current = context;
      audioPlaybackQueueRef.current = new AudioPlaybackQueue(context);
      
      // Set up callback to track AI speaking state
      audioPlaybackQueueRef.current.setOnPlayingChange((isPlaying) => {
        setIsAISpeaking(isPlaying);
        
        // Clear any accumulated input transcription when AI starts speaking
        // to prevent feedback from partial user input that was interrupted
        if (isPlaying) {
          currentInputTranscriptionRef.current = '';
          if (inputTranscriptionTimeoutRef.current) {
            clearTimeout(inputTranscriptionTimeoutRef.current);
            inputTranscriptionTimeoutRef.current = null;
          }
        }
      });

    }

    return () => {
      // Cleanup on unmount
      disconnect();
    };
  }, []);

  const addMessage = useCallback((message: Omit<TaskMasterLiveMessage, 'timestamp'>) => {
    const newMessage = { ...message, timestamp: Date.now() };
    setMessages(prev => [...prev, newMessage]);
    
    // Update ref for deduplication logic
    recentMessagesRef.current = [...recentMessagesRef.current, newMessage].slice(-10); // Keep last 10 messages
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    recentMessagesRef.current = []; // Clear the ref as well
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
      const transcriptionText = currentOutputTranscriptionRef.current.trim();
      
      // Check if we already have a recent direct text response to avoid duplication
      // Look for messages in the last 2 seconds that were marked as direct text responses
      const recentMessages = recentMessagesRef.current.filter(msg => 
        msg.type === 'output' && 
        msg.data?.isDirectTextResponse && 
        Date.now() - msg.timestamp < 2000
      );
      
      // If we have a recent direct text response that contains similar content, skip transcription
      const hasRecentDirectResponse = recentMessages.some(msg => {
        const msgContent = msg.content?.toLowerCase() || '';
        const transcriptionLower = transcriptionText.toLowerCase();
        
        // Check if the transcription is substantially similar to recent direct response
        // (either contains the text or has high overlap)
        return msgContent.includes(transcriptionLower.substring(0, 50)) || 
               transcriptionLower.includes(msgContent.substring(0, 50)) ||
               (msgContent.length > 10 && transcriptionLower.length > 10 && 
                calculateSimilarity(msgContent, transcriptionLower) > 0.7);
      });
      
      if (hasRecentDirectResponse) {
        console.log('🔄 Skipping transcription - already have recent direct text response');
        currentOutputTranscriptionRef.current = '';
        return;
      }
      
      // Check if transcription contains ACTUAL JSON actions (not just content with braces)
      const containsActualJson = transcriptionText.includes('```json') || 
                                 transcriptionText.includes('```') || // Code blocks
                                 transcriptionText.includes('json') || // "json" word
                                 transcriptionText.includes('JSON') || // "JSON" word
                                 (transcriptionText.toLowerCase().includes('j') && transcriptionText.length < 10) || // Single "J" or "j"
                                 transcriptionText.match(/```json[\s\S]*?```/) || // JSON code blocks
                                 transcriptionText.match(/\{\s*["']?(action|type)["']?\s*:/) || // Actual JSON actions
                                 transcriptionText.match(/\{\s*["']?(payload)["']?\s*:/); // JSON with payload
      
      if (containsActualJson) {
        console.log('🛑 ACTUAL JSON detected in transcription - stopping audio playback IMMEDIATELY');
        audioPlaybackQueueRef.current?.stop(); // This stops and clears all sources
      }
      
      // Process JSON actions in the background before saving the message
      processJsonBlocks(transcriptionText).then(({ cleanedText, processedActions, enhancedText }) => {
        // Save the enhanced text (includes friendly messages from actions)
        const finalText = enhancedText || cleanedText || transcriptionText;
        addMessage({ 
          type: 'output', 
          content: finalText,
          data: { isTranscriptionResponse: true }
        });
        
        // Log processed actions for debugging
        if (processedActions.length > 0) {
          console.log(`🎯 Voice Chat (Transcription): Processed ${processedActions.length} actions:`, processedActions);
        }
      }).catch(error => {
        console.error('Error processing JSON actions from transcription:', error);
        // Fallback to original text if processing fails
        addMessage({ 
          type: 'output', 
          content: transcriptionText,
          data: { isTranscriptionResponse: true }
        });
      });
      
      currentOutputTranscriptionRef.current = '';
    }
    if (outputTranscriptionTimeoutRef.current) {
      clearTimeout(outputTranscriptionTimeoutRef.current);
      outputTranscriptionTimeoutRef.current = null;
    }
  }, [addMessage, processJsonBlocks]);

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
        tools: [
          { googleSearch: {} }, // Enable built-in Google Search
          { codeExecution: {} }, // Enable code execution
          { 
            functionDeclarations: [
              {
                name: 'searchNotion',
                description: 'Search the user\'s Notion workspace for pages and content',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: 'Search query for Notion pages. Leave empty to get all pages.'
                    }
                  }
                }
              },
              {
                name: 'readNotionPage',
                description: 'Read the content of a specific Notion page',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    pageTitle: {
                      type: Type.STRING,
                      description: 'The title of the Notion page to read'
                    }
                  },
                  required: ['pageTitle']
                }
              },
              {
                name: 'listGoogleDriveFiles',
                description: 'List files in the user\'s Google Drive',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: 'Search query for Google Drive files. Leave empty to get all files.'
                    }
                  }
                }
              },
              {
                name: 'readGoogleDriveFile',
                description: 'Read the content of a specific Google Drive file',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    fileName: {
                      type: Type.STRING,
                      description: 'The name of the Google Drive file to read'
                    }
                  },
                  required: ['fileName']
                }
              }
            ]
          }
        ] as any,
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
            
            // Console logging for quota and model status
            if (fallbackUsed) {
              console.warn(`⚠️  USING FREE MODEL: Premium quota reached, using `);
            }
            
            addMessage({ type: 'connected', content: 'Connected to TaskMaster Live API' });
          },
          onmessage: async (message: any) => {
            // Handle text responses and transcriptions
            if (message.text) {
              // IMMEDIATELY process and clean the text BEFORE any audio processing
              processJsonBlocks(message.text).then(({ cleanedText, processedActions, enhancedText }) => {
                // Use enhanced text for conversation - this includes friendly messages from actions
                const finalCleanText = enhancedText || cleanedText || message.text;
                
                // Check if original text contained ACTUAL JSON actions (not just content with braces)
                const containsActualJson = message.text.includes('```json') || 
                                          message.text.includes('```') || // Code blocks
                                          message.text.includes('json') || // "json" word
                                          message.text.includes('JSON') || // "JSON" word
                                          (message.text.toLowerCase().includes('j') && message.text.length < 10) || // Single "J" or "j"
                                          message.text.match(/```json[\s\S]*?```/) || // JSON code blocks
                                          message.text.match(/\{\s*["']?(action|type)["']?\s*:/) || // Actual JSON actions
                                          message.text.match(/\{\s*["']?(payload)["']?\s*:/); // JSON with payload
                
                if (containsActualJson) {
                  console.log('🛑 ACTUAL JSON detected in voice response - stopping audio playback IMMEDIATELY');
                  audioPlaybackQueueRef.current?.stop(); // This stops and clears all sources
                }
                
                // Save the cleaned text (without JSON blocks) as the message
                // Mark this message as from direct text response to avoid duplication with transcription
                addMessage({ 
                  type: 'output', 
                  content: finalCleanText, 
                  data: { ...message, text: finalCleanText, isDirectTextResponse: true } 
                });
                
                // Log processed actions for debugging
                if (processedActions.length > 0) {
                  console.log(`🎯 Voice Chat: Processed ${processedActions.length} actions:`, processedActions);
                }
              }).catch(error => {
                console.error('Error processing JSON actions:', error);
                // Fallback to original text if processing fails
                addMessage({ 
                  type: 'output', 
                  content: message.text, 
                  data: { ...message, isDirectTextResponse: true } 
                });
              });
            }
            
            // Handle tool calls (function calling)
            if (message.toolCall && message.toolCall.functionCalls) {
              console.log('🔧 Tool call received:', message.toolCall.functionCalls);
              
              const functionResponses = [];
              for (const functionCall of message.toolCall.functionCalls) {
                try {
                  let result;
                  
                  switch (functionCall.name) {
                    case 'searchNotion':
                      const notionSearchResult = await processAction('searchNotion', functionCall.args);
                      result = notionSearchResult.friendlyMessage || notionSearchResult.message;
                      
                      // Add to completed actions UI
                      addCompletedAction({
                        type: 'searchNotion',
                        title: `Searched Notion${functionCall.args.query ? ` for "${functionCall.args.query}"` : ''}`,
                        status: notionSearchResult.status,
                        message: notionSearchResult.message
                      });
                      break;
                      
                    case 'readNotionPage':
                      const notionReadResult = await processAction('findAndReadPageContent', { title: functionCall.args.pageTitle });
                      result = notionReadResult.friendlyMessage || notionReadResult.message;
                      
                      // Add to completed actions UI
                      addCompletedAction({
                        type: 'readNotionPage',
                        title: `Read page: "${functionCall.args.pageTitle}"`,
                        status: notionReadResult.status,
                        message: notionReadResult.message
                      });
                      break;
                      
                    case 'listGoogleDriveFiles':
                      const driveListResult = await processAction('listFilesAndFolders', functionCall.args);
                      result = driveListResult.friendlyMessage || driveListResult.message;
                      
                      // Add to completed actions UI
                      addCompletedAction({
                        type: 'listGoogleDriveFiles',
                        title: `Listed Drive files${functionCall.args.query ? ` for "${functionCall.args.query}"` : ''}`,
                        status: driveListResult.status,
                        message: driveListResult.message
                      });
                      break;
                      
                    case 'readGoogleDriveFile':
                      // Map fileName to query for the backend findAndReadFile action
                      const readPayload = { query: functionCall.args.fileName };
                      const driveReadResult = await processAction('readGoogleDriveFile', readPayload);
                      result = driveReadResult.friendlyMessage || driveReadResult.message;
                      
                      // Add to completed actions UI
                      addCompletedAction({
                        type: 'readGoogleDriveFile',
                        title: `Read file: "${functionCall.args.fileName}"`,
                        status: driveReadResult.status,
                        message: driveReadResult.message
                      });
                      break;
                      
                    default:
                      result = `Function ${functionCall.name} executed successfully.`;
                      
                      // Add generic tool call to completed actions UI
                      addCompletedAction({
                        type: functionCall.name,
                        title: `${functionCall.name} executed`,
                        status: 'success',
                        message: result
                      });
                  }
                  
                  functionResponses.push({
                    id: functionCall.id,
                    name: functionCall.name,
                    response: { result }
                  });
                  
                } catch (error) {
                  console.error(`Error executing ${functionCall.name}:`, error);
                  
                  // Add error to completed actions UI
                  addCompletedAction({
                    type: functionCall.name,
                    title: `${functionCall.name} failed`,
                    status: 'error',
                    message: `Couldn't complete ${functionCall.name}. Please try again.`
                  });
                  
                  functionResponses.push({
                    id: functionCall.id,
                    name: functionCall.name,
                    response: { 
                      result: `Error: Couldn't complete ${functionCall.name}. Please try again.` 
                    }
                  });
                }
              }
              
              // Send tool responses back to the model
              if (sessionRef.current && functionResponses.length > 0) {
                console.log('📤 Sending tool responses:', functionResponses);
                sessionRef.current.sendToolResponse({ functionResponses });
              }
            }
            
            // Handle input transcription fragments - accumulate them
            // BUT IGNORE if AI is currently speaking to prevent feedback loops
            if (message.serverContent?.inputTranscription?.text && !isAISpeaking) {
              const fragment = message.serverContent.inputTranscription.text;
              currentInputTranscriptionRef.current += fragment;
              
              // Clear existing timeout and set a new one to finalize after silence
              if (inputTranscriptionTimeoutRef.current) {
                clearTimeout(inputTranscriptionTimeoutRef.current);
              }
              inputTranscriptionTimeoutRef.current = setTimeout(finalizeInputTranscription, 1500);
            } else if (message.serverContent?.inputTranscription?.text && isAISpeaking) {
              // Log when we're ignoring input because AI is speaking
              console.log('🔇 Ignoring input transcription while AI is speaking to prevent feedback');
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
              // Check if this message contains ACTUAL JSON actions (not just content with braces)
              const messageContainsJson = message.text && (
                message.text.includes('```json') || 
                message.text.includes('```') || // Code blocks
                message.text.includes('json') || // "json" word
                message.text.includes('JSON') || // "JSON" word
                (message.text.toLowerCase().includes('j') && message.text.length < 10) || // Single "J" or "j"
                message.text.match(/```json[\s\S]*?```/) || // JSON code blocks
                message.text.match(/\{\s*["']?(action|type)["']?\s*:/) || // Actual JSON actions
                message.text.match(/\{\s*["']?(payload)["']?\s*:/) // JSON with payload
              );
              
              if (messageContainsJson) {
                console.log('🛑 COMPLETELY SKIPPING audio playback - message contains JSON/technical content');
                audioPlaybackQueueRef.current?.stop(); // Stop any current audio and clear sources
                
                // Check if we already processed this text in the direct text handler
                const hasDirectTextResponse = recentMessagesRef.current.some(msg => 
                  msg.type === 'output' && 
                  msg.data?.isDirectTextResponse && 
                  Date.now() - msg.timestamp < 1000 && // Within last second
                  msg.content === message.text
                );
                
                if (!hasDirectTextResponse) {
                  // Process the text to get enhanced version with friendly messages, but NO AUDIO
                  processJsonBlocks(message.text).then(({ cleanedText, enhancedText }) => {
                    const finalText = enhancedText || cleanedText || message.text;
                    addMessage({ 
                      type: 'output', 
                      content: finalText, 
                      data: { ...message, text: finalText, isAudioProcessingResponse: true } 
                    });
                  }).catch(() => {
                    addMessage({ 
                      type: 'output', 
                      content: message.text, 
                      data: { ...message, isAudioProcessingResponse: true } 
                    });
                  });
                }
                
                return; // Exit early - no audio processing
              } else {
                const audioBuffer = decode(audioData);
                
                // Ensure audio context is resumed before playing
                if (outputAudioContextRef.current?.state === 'suspended') {
                  outputAudioContextRef.current.resume();
                }
                
                audioPlaybackQueueRef.current?.add(audioBuffer);
                addMessage({ type: 'output', audio: audioBuffer, data: message });
              }
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
              
              // Gracefully handle session transition without stopping audio
              const isAudioPlaying = audioPlaybackQueueRef.current?.isPlaying() || false;
              
              if (sessionRef.current) {
                sessionRef.current.close();
                sessionRef.current = null;
              }
              
              // Wait for current audio to finish playing before retrying, or retry immediately if no audio
              const retryDelay = isAudioPlaying ? 4000 : 1000; // 4 seconds if audio is playing, 1 second otherwise
              
              console.warn(`🚨 QUOTA LIMIT REACHED: Premium model quota exhausted for user ${tokenData.userTier}`);
              
              setTimeout(() => {
                // Ensure clean state before retry
                setError(null);
                connect(config, true);
              }, retryDelay);
              return;
            } else if (isQuotaError && clientSideFallback) {
              setError('All voice models are currently at capacity. Please try again later.');
              setIsConnecting(false);
              return;
            }
            
            setError('Connection error: ' + sanitizeErrorMessage(error));
            addMessage({ type: 'error', content: 'Connection error' });
            setIsConnecting(false);
          },
          onclose: (event: any) => {
            setIsConnected(false);
            setIsConnecting(false);
            
            // Check if this is a quota error for premium users
            const isQuotaError = event.reason && (
              event.reason.includes('quota') || 
              event.reason.includes('limit') ||
              event.reason.includes('429') ||
              event.reason.includes('QUOTA_EXCEEDED') ||
              event.reason.includes('Resource has been exhausted') ||
              event.reason.includes('You exceeded your current quota')
            );
            
            // Only show disconnection message if this isn't a quota retry
            if (!isQuotaError) {
              addMessage({ type: 'disconnected', content: 'Disconnected from TaskMaster Live API' });
            }
            
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
              
              // Don't stop audio immediately if it's playing - let it finish naturally
              const isAudioPlaying = audioPlaybackQueueRef.current?.isPlaying() || false;
              if (!isAudioPlaying) {
                audioPlaybackQueueRef.current?.stop();
              }
              
              setIsConnected(false);
              setIsConnecting(false);
              
              console.warn(`🚨 QUOTA LIMIT REACHED (onclose): Premium model quota exhausted for user ${tokenData.userTier}`);
              
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

  // Quota status logger - accessible from browser console
  const logQuotaStatus = useCallback(() => {
    if (!isConnected) {
      return;
    }
  }, [isConnected, userTier, currentModel, fallbackUsed]);

  // Make quota status logger available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).logQuotaStatus = logQuotaStatus;
  }

  const sendText = useCallback((text: string, files?: { type: string; base64Data: string; name: string }[]) => {
    if (!sessionRef.current || !isConnected) {
      console.warn('Cannot send text: not connected');
      return;
    }

    try {
      const parts: any[] = [{ text }];
      
      // Add files if provided
      if (files && files.length > 0) {
        files.forEach(file => {
          // Only add supported file types for Gemini Live API
          if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.md')) {
            parts.push({
              inline_data: {
                mime_type: file.type,
                data: file.base64Data
              }
            });
          }
        });
      }
      
      sessionRef.current.sendClientContent({ 
        turns: [{ 
          role: "user", 
          parts 
        }],
        turnComplete: true
      });
      
      // Add message with file info
      const messageContent = files && files.length > 0 
        ? `${text}\n\n[Attached ${files.length} file${files.length > 1 ? 's' : ''}: ${files.map(f => f.name).join(', ')}]`
        : text;
      
      addMessage({ type: 'input', content: messageContent });
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
        
        // Skip audio chunks if not ready OR if AI is speaking (to prevent feedback)
        if (!isRecording || !sessionRef.current || !isConnected || isAISpeaking) {
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

  // Create voice sample function
  const createVoiceSample = useCallback(async (voiceId: string, sampleText?: string): Promise<ArrayBuffer | null> => {
    try {
      // Get API key from Firebase Function
      const functions = getFunctions();
      const createToken = httpsCallable(functions, 'createTaskMasterLiveToken');
      
      const result = await createToken({
        systemInstruction: sampleText || `You are TaskMaster. Say exactly: "Hi! This is ${voiceId}. I'm here to help you stay productive and organized."`,
        model: 'gemini-live-2.5-flash-preview' // Use cascade model for samples
      });

      const tokenData = result.data as any;
      
      // Initialize Google GenAI client for sample
      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey: tokenData.token
      });

      return new Promise((resolve, reject) => {
        let sampleSession: any = null;
        
        ai.live.connect({
          model: 'gemini-live-2.5-flash-preview',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceId
                }
              }
            },
            systemInstruction: tokenData.systemInstruction
          },
          callbacks: {
            onopen: () => {
              console.log(`🎵 Connected for ${voiceId} sample`);
              // Send a simple message to trigger the voice sample
              if (sampleSession) {
                sampleSession.sendClientContent({ 
                  turns: [{ 
                    role: "user", 
                    parts: [{ text: "Please introduce yourself" }] 
                  }],
                  turnComplete: true
                });
              }
            },
            onmessage: async (message: any) => {
              // Handle audio response
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data || 
                               message.serverContent?.modelTurn?.parts?.[0]?.audio || 
                               message.audio;
              
              if (audioData && typeof audioData === 'string') {
                try {
                  const audioBuffer = decode(audioData);
                  resolve(audioBuffer);
                  if (sampleSession) {
                    sampleSession.close();
                  }
                } catch (error) {
                  reject(error);
                }
              }
            },
            onerror: (error: any) => {
              console.error('Voice sample error:', error);
              reject(error);
            },
            onclose: () => {
              console.log(`🎵 Voice sample session closed for ${voiceId}`);
            }
          }
        }).then(session => {
          sampleSession = session;
        }).catch(reject);
      });
      
    } catch (error) {
      console.error('Error creating voice sample:', error);
      return null;
    }
  }, []);

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
    completedActions,
    isProcessingActions,
    connect,
    disconnect,
    sendText,
    startRecording,
    stopRecording,
    clearMessages,
    clearCompletedActions,
    createVoiceSample
  };
};