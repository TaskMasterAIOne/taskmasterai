// src/lib/ai-chat-firebase.ts

import { db, storage } from './firebase'; // Import storage
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage"; // Storage imports
import { createDeepInsightAction, updateDeepInsightActionStatus, voteOnDeepInsightAction } from './ai-context-firebase';
import { createUserTask, createUserGoal, createUserPlan, createUserProject } from './ai-actions-firebase';

// This ImageData interface is now primarily for what Gemini API returns,
// or how AIChat.tsx initially processes an image, before it's uploaded.
export interface ImageData {
  base64: string;
  type: string;
  name: string;
}

export interface ImageMeta { // For storing in Firestore after upload
  name: string;
  type: string;
  originalBase64Length?: number; // Optional: for reference or diagnostics
  storagePath?: string; // Optional: store the path in Firebase Storage
}

export interface AttachedFileMeta {
  name: string;
  type: string;
  size: number;
  url?: string; // URL if uploaded to storage (especially for images)
  storagePath?: string; // Optional
  base64Data?: string; // Temporary, should not be saved to Firestore for large files
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
  timer?: { type: 'timer'; duration: number; id: string; };
  flashcard?: { type: 'flashcard'; data: any[]; };
  question?: { type: 'question'; data: any[]; };
  error?: boolean;
  actionDetails?: {
    status: 'success' | 'error';
  };
  // Fields for images stored in Firebase Storage
  imageUrl?: string; // For the main image of an assistant message
  imageMeta?: ImageMeta; // Metadata for the imageUrl

  isGeneratingImage?: boolean; // UI state, might not need to be in Firestore
  wasImageGenerated?: boolean; // Could be useful
  attachedFilesMeta?: AttachedFileMeta[]; // For user attachments (can include imageUrls for images)
  thinkingContent?: string; // AI reasoning process for premium users
  sources?: Array<{ number: number; url: string; title: string }>; // Web search sources
  
  // Voice message fields
  audioUrl?: string; // For voice messages from Live API
  audioDuration?: number; // Duration in seconds
  isVoiceMessage?: boolean; // Flag to indicate this is a voice message
  transcription?: string; // Text transcription of voice content
}

export async function findItemByName(collectionName: string, userId: string, itemName: string, fieldName: string): Promise<string | null> {
  try {
    const itemsRef = collection(db, collectionName);
    const q = query(itemsRef, where(fieldName, "==", itemName), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) return querySnapshot.docs[0].id;
    return null;
  } catch (error) {
    console.error(`Error finding ${collectionName} by name "${itemName}":`, error);
    return null;
  }
}

export async function createChatConversation(userId: string, chatName:string): Promise<string> {
  const conversationRef = await addDoc(collection(db, "chatConversations"), {
    userId,
    chatName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return conversationRef.id;
}

export async function saveChatMessage(conversationId: string, message: Partial<ChatMessage>): Promise<string> {
  const messageData: { [key: string]: any } = {
    role: message.role || 'assistant',
    content: typeof message.content === 'string' ? message.content : '',
  };

  if (message.createdAt) {
    if (message.createdAt instanceof Date || message.createdAt instanceof Timestamp) {
      messageData.createdAt = message.createdAt;
    } else if (typeof message.createdAt === 'string' || typeof message.createdAt === 'number') {
      const date = new Date(message.createdAt);
      messageData.createdAt = !isNaN(date.getTime()) ? date : serverTimestamp();
    } else {
       messageData.createdAt = serverTimestamp();
    }
  } else {
    messageData.createdAt = serverTimestamp();
  }

  if (message.timer && typeof message.timer === 'object') messageData.timer = { ...message.timer };
  if (message.flashcard && typeof message.flashcard === 'object') messageData.flashcard = { ...message.flashcard };
  if (message.question && typeof message.question === 'object') messageData.question = { ...message.question };
  if (message.error === true) messageData.error = true;
  if (message.actionDetails && typeof message.actionDetails === 'object') messageData.actionDetails = { ...message.actionDetails };
  if (typeof message.isGeneratingImage === 'boolean') messageData.isGeneratingImage = message.isGeneratingImage; // Client might want to save this state
  if (typeof message.wasImageGenerated === 'boolean') messageData.wasImageGenerated = message.wasImageGenerated;

  // Save imageUrl and imageMeta (NO BASE64)
  if (message.imageUrl && typeof message.imageUrl === 'string') {
    messageData.imageUrl = message.imageUrl;
  }
  if (message.imageMeta && typeof message.imageMeta === 'object') {
    // Ensure imageMeta doesn't contain base64
    const { base64, ...restOfMeta } = message.imageMeta as any; // Exclude base64 if it somehow slips in
    messageData.imageMeta = restOfMeta;
  }

  // Save attachedFilesMeta - ensure no base64Data is saved here
  if (message.attachedFilesMeta && Array.isArray(message.attachedFilesMeta)) {
    const validFilesMeta = message.attachedFilesMeta
      .map(meta => {
        if (meta && typeof meta === 'object' &&
            typeof meta.name === 'string' && meta.name.length > 0 &&
            typeof meta.type === 'string' && meta.type.length > 0 &&
            typeof meta.size === 'number' && meta.size >= 0) {
          // Explicitly exclude base64Data from being saved
          const { base64Data, ...restOfFileMeta } = meta;
          return restOfFileMeta;
        }
        console.warn("saveChatMessage: An item in attachedFilesMeta was malformed or incomplete. Filtering it out. Meta:", JSON.stringify(meta));
        return null;
      })
      .filter(meta => meta !== null) as Partial<AttachedFileMeta>[]; // Now it's an array of meta objects without base64Data

    if (validFilesMeta.length > 0) {
      messageData.attachedFilesMeta = validFilesMeta;
    }
  }
  
  let loggableMessageData = { ...messageData };
  if (loggableMessageData.createdAt && typeof loggableMessageData.createdAt === 'object' && !(loggableMessageData.createdAt instanceof Date) && !(loggableMessageData.createdAt instanceof Timestamp)) {
      loggableMessageData.createdAt = "FieldValue.serverTimestamp()";
  }

  try {
    const messageRef = await addDoc(collection(db, "chatConversations", conversationId, "messages"), messageData);
    await updateDoc(doc(db, "chatConversations", conversationId), { updatedAt: serverTimestamp() });
    return messageRef.id;
  } catch (error: any) {
    console.error("saveChatMessage: Firestore save error:", error.message);
    console.error("saveChatMessage: Data that caused Firestore error (full object):", messageData);
    console.error("saveChatMessage: Data that caused Firestore error (stringified for overview):", JSON.parse(JSON.stringify(loggableMessageData)));
    if (error.code) console.error("saveChatMessage: Firebase error code:", error.code);
    if (error.details) console.error("saveChatMessage: Firebase error details:", error.details);
    throw error;
  }
}

export async function saveChatMessageWithId(conversationId: string, messageId: string, message: Partial<ChatMessage>): Promise<string> {
  const messageData: { [key: string]: any } = {
    role: message.role || 'assistant',
    content: typeof message.content === 'string' ? message.content : '',
  };

  if (message.createdAt) {
    if (message.createdAt instanceof Date || message.createdAt instanceof Timestamp) {
      messageData.createdAt = message.createdAt;
    } else if (typeof message.createdAt === 'string' || typeof message.createdAt === 'number') {
      const date = new Date(message.createdAt);
      messageData.createdAt = !isNaN(date.getTime()) ? date : serverTimestamp();
    } else {
       messageData.createdAt = serverTimestamp();
    }
  } else {
    messageData.createdAt = serverTimestamp();
  }

  if (message.timer && typeof message.timer === 'object') messageData.timer = { ...message.timer };
  if (message.flashcard && typeof message.flashcard === 'object') messageData.flashcard = { ...message.flashcard };
  if (message.question && typeof message.question === 'object') messageData.question = { ...message.question };
  if (message.error === true) messageData.error = true;
  if (message.actionDetails && typeof message.actionDetails === 'object') messageData.actionDetails = { ...message.actionDetails };
  if (typeof message.isGeneratingImage === 'boolean') messageData.isGeneratingImage = message.isGeneratingImage;
  if (typeof message.wasImageGenerated === 'boolean') messageData.wasImageGenerated = message.wasImageGenerated;
  if (message.thinkingContent && typeof message.thinkingContent === 'string') messageData.thinkingContent = message.thinkingContent;
  if (message.sources && Array.isArray(message.sources)) messageData.sources = message.sources;

  // Save imageUrl and imageMeta (NO BASE64)
  if (message.imageUrl && typeof message.imageUrl === 'string') {
    messageData.imageUrl = message.imageUrl;
  }
  if (message.imageMeta && typeof message.imageMeta === 'object') {
    const { base64, ...restOfMeta } = message.imageMeta as any;
    messageData.imageMeta = restOfMeta;
  }

  // Save attachedFilesMeta - ensure no base64Data is saved here
  if (message.attachedFilesMeta && Array.isArray(message.attachedFilesMeta)) {
    const validFilesMeta = message.attachedFilesMeta
      .map(meta => {
        if (meta && typeof meta === 'object' &&
            typeof meta.name === 'string' && meta.name.length > 0 &&
            typeof meta.type === 'string' && meta.type.length > 0 &&
            typeof meta.size === 'number' && meta.size >= 0) {
          const { base64Data, ...restOfFileMeta } = meta;
          return restOfFileMeta;
        }
        console.warn("saveChatMessageWithId: An item in attachedFilesMeta was malformed or incomplete. Filtering it out. Meta:", JSON.stringify(meta));
        return null;
      })
      .filter(meta => meta !== null) as Partial<AttachedFileMeta>[];

    if (validFilesMeta.length > 0) {
      messageData.attachedFilesMeta = validFilesMeta;
    }
  }
  
  let loggableMessageData = { ...messageData };
  if (loggableMessageData.createdAt && typeof loggableMessageData.createdAt === 'object' && !(loggableMessageData.createdAt instanceof Date) && !(loggableMessageData.createdAt instanceof Timestamp)) {
      loggableMessageData.createdAt = "FieldValue.serverTimestamp()";
  }

  try {
    // Use setDoc with the custom messageId instead of addDoc
    const { setDoc } = await import('firebase/firestore');
    const messageDocRef = doc(db, "chatConversations", conversationId, "messages", messageId);
    await setDoc(messageDocRef, messageData);
    await updateDoc(doc(db, "chatConversations", conversationId), { updatedAt: serverTimestamp() });
    return messageId;
  } catch (error: any) {
    console.error("saveChatMessageWithId: Firestore save error:", error.message);
    console.error("saveChatMessageWithId: Data that caused Firestore error (full object):", messageData);
    console.error("saveChatMessageWithId: Data that caused Firestore error (stringified for overview):", JSON.parse(JSON.stringify(loggableMessageData)));
    if (error.code) console.error("saveChatMessageWithId: Firebase error code:", error.code);
    if (error.details) console.error("saveChatMessageWithId: Firebase error details:", error.details);
    throw error;
  }
}

export function onChatMessagesSnapshot(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const messagesQuery = query(
    collection(db, "chatConversations", conversationId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
      messages.push({ id: docSnap.id, ...data, createdAt } as ChatMessage);
    });
    callback(messages);
  }, (error) => {
    console.error("onChatMessagesSnapshot error: ", error);
  });
}

export function onChatConversationsSnapshot(
  userId: string,
  callback: (conversations: any[]) => void
) {
  const conversationsQuery = query(
    collection(db, "chatConversations"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(conversationsQuery, (snapshot) => {
    const conversations: any[] = [];
    snapshot.forEach((docSnap) => {
      conversations.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(conversations);
  }, (error) => {
    console.error("onChatConversationsSnapshot error: ", error);
  });
}

export async function updateChatConversationName(conversationId: string, newName: string): Promise<void> {
  try {
    if (!conversationId || !newName) {
      throw new Error('Missing required parameters: conversationId and newName are required');
    }
    
    if (newName.trim().length === 0) {
      throw new Error('Chat name cannot be empty');
    }
    

    
    await updateDoc(doc(db, "chatConversations", conversationId), {
      chatName: newName.trim(),
      updatedAt: serverTimestamp(),
    });
    

  } catch (error) {
    console.error("updateChatConversationName error: ", error);
    throw error;
  }
}

export async function deleteChatConversation(userId: string, conversationId: string): Promise<void> {
  try {
    if (!userId || !conversationId) {
      throw new Error('Missing required parameters: userId and conversationId are required');
    }
    

    
    // First, delete all messages in the conversation
    const messagesQuery = query(collection(db, "chatConversations", conversationId, "messages"));
    const messagesSnapshot = await getDocs(messagesQuery);

    const batch = writeBatch(db);

    messagesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // Commit the batch deletion of messages
    await batch.commit();


    // Then delete the conversation document itself
    await deleteDoc(doc(db, "chatConversations", conversationId));
    

  } catch (error) {
    console.error("deleteChatConversation error: ", error);
    throw error;
  }
}

export const extractJsonFromResponse = (text: string): any[] => {
  if (typeof text !== 'string') return [];
  const jsonBlocks: any[] = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      jsonBlocks.push(JSON.parse(match[1].trim()));
    } catch (e) {
      console.warn('extractJsonFromResponse: Failed to parse JSON block from ```json ... ```:', e, match[1]);
    }
  }
  if (jsonBlocks.length === 0) {
      const curlyRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:$|\n)/g;
      let curlyMatch;
      while ((curlyMatch = curlyRegex.exec(text)) !== null) {
          try {
              jsonBlocks.push(JSON.parse(curlyMatch[1]));
          } catch(e) { /* Be less noisy for simple curly braces */ }
      }
  }
  return jsonBlocks;
};

export const processAiActions = async (userId: string, actions: any[]) => {
  if (!userId) {
    console.error("processAiActions: Cannot process AI actions without a user ID.");
    return;
  }
  for (const action of actions) {
    if (!action || typeof action.action !== 'string' || typeof action.payload !== 'object' || action.payload === null) {
      console.warn("processAiActions: Skipping invalid AI action:", action);
      continue;
    }
    if (!action.payload.userId) action.payload.userId = userId;
    try {
      switch (action.action) {
        case 'createTask': await createUserTask(userId, action.payload); break;
        case 'createGoal': await createUserGoal(userId, action.payload); break;
        case 'createPlan': await createUserPlan(userId, action.payload); break;
        case 'createProject': await createUserProject(userId, action.payload); break;
        case 'deepInsight':
          if (typeof action.payload.type !== 'string' || typeof action.payload.description !== 'string') {
              console.warn("processAiActions: Skipping incomplete deepInsight action:", action.payload);
              continue;
          }
          await createDeepInsightAction(userId, {
            type: action.payload.type,
            description: action.payload.description,
            reasoning: action.payload.reasoning || 'No reasoning provided.',
            impact: action.payload.impact || 'No impact provided.',
            actionPayload: action.payload.actionPayload
          });
          break;
        default:
            console.warn(`processAiActions: Unknown AI action type: ${action.action}`);
      }
    } catch (error) {
      console.error(`processAiActions: Error processing action ${action.action}:`, error, "Payload:", action.payload);
    }
  }
};

export const handleDeepInsightVote = async (actionId: string, vote: 'up' | 'down') => {
  try { 
    await voteOnDeepInsightAction(actionId, vote); 
  } catch (error) { 
    console.error("handleDeepInsightVote error: ", error); 
  }
};

// ---------- VOICE CHAT / LIVE API HELPERS ----------

/**
 * Upload audio blob to Firebase Storage
 */
export const uploadAudioToStorage = async (
  userId: string,
  conversationId: string,
  audioBlob: Blob,
  filename?: string
): Promise<{ downloadURL: string; storagePath: string; duration?: number }> => {
  try {
    const timestamp = Date.now();
    const audioFileName = filename || `voice_${timestamp}.webm`;
    const storagePath = `chat_audio/${userId}/${conversationId}/${audioFileName}`;
    const audioRef = ref(storage, storagePath);

    // Upload the audio blob
    await uploadBytes(audioRef, audioBlob);
    const downloadURL = await getDownloadURL(audioRef);

    // Try to get audio duration (note: this is approximate and may need audio context)
    let duration: number | undefined;
    try {
      if (audioBlob.type.includes('audio')) {
        // Create a temporary URL to get duration
        const tempUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(tempUrl);
        
        duration = await new Promise<number>((resolve) => {
          audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(tempUrl);
            resolve(audio.duration);
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(tempUrl);
            resolve(undefined);
          });
        });
      }
    } catch (error) {
      console.warn('Could not determine audio duration:', error);
    }

    return { downloadURL, storagePath, duration };
  } catch (error) {
    console.error('Error uploading audio to storage:', error);
    throw error;
  }
};

/**
 * Save a voice message to the conversation
 */
export const saveVoiceMessage = async (
  conversationId: string,
  message: Partial<ChatMessage>
): Promise<void> => {
  try {
    await saveChatMessage(conversationId, {
      ...message,
      isVoiceMessage: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error saving voice message:', error);
    throw error;
  }
};

/**
 * Convert audio blob to base64 for temporary storage/display
 */
export const audioToBase64 = async (audioBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
};

/**
 * Convert audio blob to array buffer for Live API
 */
export const audioToArrayBuffer = async (audioBlob: Blob): Promise<ArrayBuffer> => {
  return await audioBlob.arrayBuffer();
};

/**
 * Convert audio buffer to 16-bit PCM format required by Live API
 */
export const convertToPCM16 = async (audioBuffer: ArrayBuffer, sampleRate: number = 16000): Promise<ArrayBuffer> => {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: sampleRate
    });
    
    // Decode audio data
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
    
    // Get the first channel (mono)
    const channelData = decodedAudio.getChannelData(0);
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      // Convert from [-1, 1] to [-32768, 32767]
      pcmData[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32767));
    }
    
    return pcmData.buffer;
  } catch (error) {
    console.error('Error converting audio to PCM16:', error);
    throw error;
  }
};

export const handleDeepInsightAccept = async (actionId: string, action: any) => {
  try {
    await updateDeepInsightActionStatus(actionId, 'accepted');
    if (action && action.actionPayload && action.userId) {
      await processAiActions(action.userId, [action.actionPayload]);
    } else {
      console.warn("handleDeepInsightAccept: Cannot process accepted DeepInsight action payload - missing action, actionPayload or userId", action);
    }
  } catch (error) { console.error("handleDeepInsightAccept error: ", error); }
};

export const handleDeepInsightDecline = async (actionId: string) => {
  try { await updateDeepInsightActionStatus(actionId, 'declined'); }
  catch (error) { console.error("handleDeepInsightDecline error: ", error); }
};

// Helper function to upload base64 image to Firebase Storage
export const uploadBase64ImageToStorage = async (
  userId: string,
  conversationId: string,
  base64String: string,
  imageType: string, // e.g., 'image/png'
  imageName?: string,
  messageId?: string // Add message ID for absolute uniqueness
): Promise<{ downloadURL: string; storagePath: string }> => {
  if (!userId || !conversationId) {
    throw new Error("User ID and Conversation ID are required for image upload.");
  }
  // Include messageId and additional randomness to ensure absolute uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  const messagePrefix = messageId ? `${messageId.substring(0, 8)}_` : '';
  
  // CRITICAL FIX: Always use unique filenames, never use the provided imageName for generated images
  const fileExtension = imageType.split('/')[1] || 'png';
  const uniqueName = `generated_${messagePrefix}${timestamp}_${randomSuffix}.${fileExtension}`;
  const storagePath = `chatImages/${userId}/${conversationId}/${uniqueName}`;
  const imageRef = ref(storage, storagePath);

  // 'data_url' format for uploadString: "data:image/png;base64,iVBORw0KGgoAAA..."
  const fullBase64Url = `data:${imageType};base64,${base64String}`;

  try {
    const snapshot = await uploadString(imageRef, fullBase64Url, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { downloadURL, storagePath };
  } catch (error) {
    console.error("Error uploading base64 image to Firebase Storage:", error);
    throw error;
  }
};

// Helper function to upload File object to Firebase Storage
export const uploadFileToStorage = async (
  userId: string,
  conversationId: string,
  file: File
): Promise<{ downloadURL: string; storagePath: string; name: string; type: string; size: number }> => {
  if (!userId || !conversationId) {
    throw new Error("User ID and Conversation ID are required for file upload.");
  }
  const uniqueName = `${Date.now()}_${file.name}`;
  const storagePath = `chatImages/${userId}/${conversationId}/${uniqueName}`; // Or a more general path like 'chatFiles/'
  const fileRef = ref(storage, storagePath);

  try {
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { downloadURL, storagePath, name: file.name, type: file.type, size: file.size };
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw error;
  }
};

export async function pinChatConversation(userId: string, conversationId: string): Promise<void> {
  try {
    const conversationRef = doc(db, "chatConversations", conversationId);
    await updateDoc(conversationRef, {
      pinnedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error pinning conversation:", error);
    throw error;
  }
}

export async function unpinChatConversation(userId: string, conversationId: string): Promise<void> {
  try {
    const conversationRef = doc(db, "chatConversations", conversationId);
    await updateDoc(conversationRef, {
      pinnedAt: null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error unpinning conversation:", error);
    throw error;
  }
}
