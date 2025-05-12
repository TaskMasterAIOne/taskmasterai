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
    // console.log(`No ${collectionName} found with name "${itemName}" for user ${userId}`); // Less noisy
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
    role: message.role,
    content: message.content,
    // If createdAt is already a Date or Timestamp, use it. Otherwise, use serverTimestamp.
    // This handles client-set dates for optimistic updates.
    createdAt: (message.createdAt && (message.createdAt instanceof Date || message.createdAt instanceof Timestamp))
                 ? message.createdAt
                 : serverTimestamp(),
  };

  if (message.timer) messageData.timer = message.timer;
  if (message.flashcard) messageData.flashcard = message.flashcard;
  if (message.question) messageData.question = message.question;
  if (message.error === true) messageData.error = true; // Explicitly check for true
  if (message.actionDetails) messageData.actionDetails = message.actionDetails;
  if (typeof message.isGeneratingImage === 'boolean') messageData.isGeneratingImage = message.isGeneratingImage;
  if (typeof message.wasImageGenerated === 'boolean') messageData.wasImageGenerated = message.wasImageGenerated;

  // Handle imageData carefully to avoid "invalid nested entity"
  if (message.imageData) {
    if (
      typeof message.imageData.base64 === 'string' &&
      typeof message.imageData.type === 'string' &&
      typeof message.imageData.name === 'string'
    ) {
      messageData.imageData = {
        base64: message.imageData.base64,
        type: message.imageData.type,
        name: message.imageData.name,
      };
    } else {
      console.warn(
        "Message imageData was present but malformed (e.g., undefined properties within). imageData will NOT be saved. Problematic imageData:",
        JSON.stringify(message.imageData) // Use JSON.stringify for better logging of the object
      );
      // Do not add messageData.imageData if it's malformed
    }
  }

  // Handle attachedFilesMeta carefully
  if (message.attachedFilesMeta && Array.isArray(message.attachedFilesMeta) && message.attachedFilesMeta.length > 0) {
    const validFilesMeta = message.attachedFilesMeta
      .map(meta => {
        if (meta && typeof meta.name === 'string' && typeof meta.type === 'string' && typeof meta.size === 'number') {
          return { name: meta.name, type: meta.type, size: meta.size };
        }
        console.warn("An item in attachedFilesMeta was malformed or incomplete. Filtering it out. Problematic meta:", JSON.stringify(meta));
        return null;
      })
      .filter(meta => meta !== null) as AttachedFileMeta[]; // Assert type after filtering nulls

    if (validFilesMeta.length > 0) {
      messageData.attachedFilesMeta = validFilesMeta;
    }
  }
  
  const messageRef = await addDoc(collection(db, "chatConversations", conversationId, "messages"), messageData);

  await updateDoc(doc(db, "chatConversations", conversationId), {
    updatedAt: serverTimestamp(),
  });
  return messageRef.id;
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
  });
}

export async function updateChatConversationName(conversationId: string, newName: string): Promise<void> {
  await updateDoc(doc(db, "chatConversations", conversationId), {
    chatName: newName,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChatConversation(conversationId: string): Promise<void> {
  await deleteDoc(doc(db, "chatConversations", conversationId));
  console.warn(`Conversation document ${conversationId} deleted. Messages subcollection requires manual or Cloud Function deletion if not handled elsewhere.`);
}

export const extractJsonFromResponse = (text: string): any[] => {
  const jsonBlocks: any[] = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsed = JSON.parse(jsonContent);
      jsonBlocks.push(parsed);
    } catch (e) {
      console.error('Failed to parse JSON block from ```json ... ```:', e, match[1]);
    }
  }

  if (jsonBlocks.length === 0) {
      const curlyRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:$|\n)/g;
      let curlyMatch;
      while ((curlyMatch = curlyRegex.exec(text)) !== null) {
          try {
              jsonBlocks.push(JSON.parse(curlyMatch[1]));
          } catch(e) {
              // console.error('Failed to parse JSON block from { ... }:', e, curlyMatch[1]); // Can be noisy
          }
      }
  }
  return jsonBlocks;
};

export const processAiActions = async (userId: string, actions: any[]) => {
  if (!userId) {
    console.error("Cannot process AI actions without a user ID.");
    return;
  }
  for (const action of actions) {
    if (!action || !action.action || !action.payload) {
      console.warn("Skipping invalid AI action:", action);
      continue;
    }

    if (!action.payload.userId) {
        action.payload.userId = userId;
    }

    try {
      // console.log("Processing AI Action:", action.action, action.payload); // Less noisy
      switch (action.action) {
        case 'createTask':
          await createUserTask(userId, action.payload);
          break;
        case 'createGoal':
          await createUserGoal(userId, action.payload);
          break;
        case 'createPlan':
          await createUserPlan(userId, action.payload);
          break;
        case 'createProject':
          await createUserProject(userId, action.payload);
          break;
        case 'deepInsight':
          if (!action.payload.type || !action.payload.description) {
              console.warn("Skipping incomplete deepInsight action:", action.payload);
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
            console.warn(`Unknown AI action type: ${action.action}`);
      }
    } catch (error) {
      console.error(`Error processing action ${action.action}:`, error, "Payload:", action.payload);
    }
  }
};

export const handleDeepInsightVote = async (actionId: string, vote: 'up' | 'down') => {
  await voteOnDeepInsightAction(actionId, vote);
};

export const handleDeepInsightAccept = async (actionId: string, action: any) => {
  await updateDeepInsightActionStatus(actionId, 'accepted');
  if (action.actionPayload && action.userId) {
    await processAiActions(action.userId, [action.actionPayload]);
  } else {
    console.warn("Cannot process accepted DeepInsight action payload - missing actionPayload or userId", action);
  }
};

export const handleDeepInsightDecline = async (actionId: string) => {
  await updateDeepInsightActionStatus(actionId, 'declined');
};
