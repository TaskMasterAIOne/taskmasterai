// src/lib/ai-chat-firebase.ts

import { db } from './firebase';
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
  Timestamp
} from "firebase/firestore";
import { createDeepInsightAction, updateDeepInsightActionStatus, voteOnDeepInsightAction } from './ai-context-firebase';
import { createUserTask, createUserGoal, createUserPlan, createUserProject } from './ai-actions-firebase';

// Interface for embedded image data (matches AIChat.tsx)
export interface ImageData {
  base64: string;
  type: string;
  name: string;
}

// Interface for attached file metadata (matches AIChat.tsx)
export interface AttachedFileMeta {
  name: string;
  type: string;
  size: number;
}

// Updated ChatMessage interface to align with AIChat.tsx's ChatMessageData
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any; // Firestore ServerTimestamp, client-side Date, or Firestore Timestamp
  timer?: { type: 'timer'; duration: number; id: string; };
  flashcard?: { type: 'flashcard'; data: any[]; };
  question?: { type: 'question'; data: any[]; };
  error?: boolean;
  actionDetails?: {
    status: 'success' | 'error';
  };
  imageData?: ImageData;
  isGeneratingImage?: boolean;
  wasImageGenerated?: boolean;
  attachedFilesMeta?: AttachedFileMeta[];
}


export async function findItemByName(collectionName: string, userId: string, itemName: string, fieldName: string): Promise<string | null> {
  try {
    const itemsRef = collection(db, collectionName);
    const q = query(itemsRef, where(fieldName, "==", itemName), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
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
  const messageData: { [key: string]: any } = {};

  // Required or defaulted fields
  messageData.role = message.role || 'assistant'; // Provide a sensible default if role can be missing
  messageData.content = typeof message.content === 'string' ? message.content : ''; // Ensure content is a string

  // Handle createdAt carefully
  if (message.createdAt) {
    if (message.createdAt instanceof Date || message.createdAt instanceof Timestamp) {
      messageData.createdAt = message.createdAt;
    } else if (typeof message.createdAt === 'string' || typeof message.createdAt === 'number') {
      const date = new Date(message.createdAt);
      if (!isNaN(date.getTime())) {
        messageData.createdAt = date; // Firestore will convert Date to Timestamp
      } else {
        console.warn("saveChatMessage: Malformed createdAt (string/number couldn't be parsed to Date), using serverTimestamp. Value:", message.createdAt);
        messageData.createdAt = serverTimestamp();
      }
    } else {
       console.warn("saveChatMessage: Unsupported createdAt type, using serverTimestamp. Value:", message.createdAt, "Type:", typeof message.createdAt);
       messageData.createdAt = serverTimestamp();
    }
  } else {
    messageData.createdAt = serverTimestamp();
  }

  // Optional simple fields
  if (message.timer && typeof message.timer === 'object') messageData.timer = { ...message.timer };
  if (message.flashcard && typeof message.flashcard === 'object') messageData.flashcard = { ...message.flashcard };
  if (message.question && typeof message.question === 'object') messageData.question = { ...message.question };
  if (message.error === true) messageData.error = true;
  if (message.actionDetails && typeof message.actionDetails === 'object') messageData.actionDetails = { ...message.actionDetails };
  if (typeof message.isGeneratingImage === 'boolean') messageData.isGeneratingImage = message.isGeneratingImage;
  if (typeof message.wasImageGenerated === 'boolean') messageData.wasImageGenerated = message.wasImageGenerated;

  // Rigorous check and sanitization for imageData
  if (message.imageData && typeof message.imageData === 'object') {
    const { base64, type, name } = message.imageData;
    if (
      typeof base64 === 'string' && base64.length > 0 &&
      typeof type === 'string' && type.length > 0 &&
      typeof name === 'string' && name.length > 0
    ) {
      messageData.imageData = { base64, type, name }; // Create a new plain object
    } else {
      console.warn(
        "saveChatMessage: message.imageData was present but malformed (e.g., missing or empty properties). imageData will NOT be saved. Problematic imageData:",
        JSON.stringify(message.imageData)
      );
    }
  }

  // Rigorous check and sanitization for attachedFilesMeta
  if (message.attachedFilesMeta && Array.isArray(message.attachedFilesMeta)) {
    const validFilesMeta = message.attachedFilesMeta
      .filter(meta =>
        meta && typeof meta === 'object' && // Ensure meta itself is an object
        typeof meta.name === 'string' && meta.name.length > 0 &&
        typeof meta.type === 'string' && meta.type.length > 0 &&
        typeof meta.size === 'number' && meta.size >= 0
      )
      .map(meta => ({ name: meta.name, type: meta.type, size: meta.size })); // Create new plain objects

    if (validFilesMeta.length > 0) {
      messageData.attachedFilesMeta = validFilesMeta;
    } else if (message.attachedFilesMeta.length > 0) {
      console.warn("saveChatMessage: All items in attachedFilesMeta were malformed or empty. attachedFilesMeta will NOT be saved. Original:", JSON.stringify(message.attachedFilesMeta));
    }
  }

  // Log the exact data being sent to Firestore for debugging BEFORE the call
  // Using JSON.parse(JSON.stringify()) helps to see what a "plain" version of the object looks like,
  // especially if serverTimestamp() or other special Firestore values are involved (though serverTimestamp is resolved by Firestore).
  let loggableMessageData = { ...messageData };
  if (loggableMessageData.createdAt && typeof loggableMessageData.createdAt === 'object' && !(loggableMessageData.createdAt instanceof Date) && !(loggableMessageData.createdAt instanceof Timestamp)) {
      // If createdAt is serverTimestamp(), it's a sentinel value, stringify might not be ideal for direct console view.
      // For logging, we can represent it as a string. Firestore handles the actual sentinel.
      loggableMessageData.createdAt = "FieldValue.serverTimestamp()";
  }


  console.log("saveChatMessage: Attempting to save to Firestore with sanitized data:", JSON.parse(JSON.stringify(loggableMessageData)));


  try {
    const messageRef = await addDoc(collection(db, "chatConversations", conversationId, "messages"), messageData);

    await updateDoc(doc(db, "chatConversations", conversationId), {
      updatedAt: serverTimestamp(),
    });
    return messageRef.id;
  } catch (error: any) {
    console.error("saveChatMessage: Firestore save error:", error.message);
    // Log the data that caused the error again, using the same stringification method
    console.error("saveChatMessage: Data that caused Firestore error:", JSON.parse(JSON.stringify(loggableMessageData)));
    // For more detailed Firebase error object:
    if (error.code) console.error("saveChatMessage: Firebase error code:", error.code);
    if (error.details) console.error("saveChatMessage: Firebase error details:", error.details);
    
    throw error; // Re-throw the error so AIChat.tsx can catch and display it
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
      // Ensure createdAt is converted to Date if it's a Firestore Timestamp
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
      messages.push({ id: docSnap.id, ...data, createdAt } as ChatMessage);
    });
    callback(messages);
  }, (error) => {
    console.error("onChatMessagesSnapshot error: ", error);
    // Optionally, you could propagate this error to the UI
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
    await updateDoc(doc(db, "chatConversations", conversationId), {
      chatName: newName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("updateChatConversationName error: ", error);
    throw error;
  }
}

export async function deleteChatConversation(conversationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "chatConversations", conversationId));
    console.warn(`Conversation document ${conversationId} deleted. Messages subcollection requires manual or Cloud Function deletion if not handled elsewhere.`);
  } catch (error) {
    console.error("deleteChatConversation error: ", error);
    throw error;
  }
}

export const extractJsonFromResponse = (text: string): any[] => {
  if (typeof text !== 'string') return []; // Guard against non-string input
  const jsonBlocks: any[] = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      jsonBlocks.push(parsed);
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
          } catch(e) {
              // console.warn('extractJsonFromResponse: Failed to parse JSON block from { ... }:', e, curlyMatch[1]); // Can be very noisy
          }
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
      console.warn("processAiActions: Skipping invalid AI action (missing action/payload or invalid types):", action);
      continue;
    }

    if (!action.payload.userId) {
        action.payload.userId = userId;
    }

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

export const handleDeepInsightAccept = async (actionId: string, action: any) => {
  try {
    await updateDeepInsightActionStatus(actionId, 'accepted');
    if (action && action.actionPayload && action.userId) {
      await processAiActions(action.userId, [action.actionPayload]);
    } else {
      console.warn("handleDeepInsightAccept: Cannot process accepted DeepInsight action payload - missing action, actionPayload or userId", action);
    }
  } catch (error) {
    console.error("handleDeepInsightAccept error: ", error);
  }
};

export const handleDeepInsightDecline = async (actionId: string) => {
  try {
    await updateDeepInsightActionStatus(actionId, 'declined');
  } catch (error) {
    console.error("handleDeepInsightDecline error: ", error);
  }
};
