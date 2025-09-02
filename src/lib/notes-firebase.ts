import { addDoc, collection, Timestamp, updateDoc, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { 
    getGeminiProxy, 
    extractCandidateText, 
    AI_CONFIGS, 
    PROMPT_TEMPLATES,
    makeParallelAICalls,
    parseTopicsResponse,
    parseQuestionsWithTopics
} from './processors';

export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

export interface Flashcard { front: string; back: string; }

export interface PodcastSegment {
    speakerId: string | null;
    url: string;
    text: string;
    startTime: number;
    endTime: number;
}

export interface Podcast {
    id: string;
    createdAt: Timestamp;
    settings: {
        language: string;
        speaker1Id: string | null;
        speaker2Id: string | null;
        length: 'short' | 'medium' | 'long' | null;
        instructions: string;
    };
    segments: PodcastSegment[];
    combinedUrl: string;
    totalDuration: number;
}

export interface Topic {
    id: string;
    name: string;
    description: string;
}

export interface Question {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    topicId: string;
    hint?: string;
}

export interface NoteData {
    id?: string;
    title: string;
    content: string;
    type: 'personal' | 'pdf' | 'youtube' | 'audio';
    keyPoints?: string[];
    questions?: Question[];
    topics?: Topic[];
    flashcards?: Flashcard[];
    podcasts?: Podcast[];
    sourceUrl?: string;
    userId: string;
    isPublic: boolean;
    tags: string[];
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
export interface NoteUsageData {
    pdfAi: number;
    youtube: number;
    month: string;
}
export interface ChatUsageData {
    count: number;
    month: string;
}

function removeUndefinedFields(obj: any): any { const newObj: any = {}; Object.keys(obj).forEach(key => { if (obj[key] !== undefined) { newObj[key] = obj[key]; } }); return newObj; }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> { for (let attempt = 0; attempt < retries; attempt++) { try { const response = await fetch(url, options); if (!response.ok && (response.status === 429 || response.status >= 500)) { await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue; } return response; } catch (error) { if (attempt === retries - 1) throw error; await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); } } throw new Error(`Max retries reached: ${url}`); }

// SECURE: API calls now go through the geminiProxy function

export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.content || !dataToSave.userId || !dataToSave.type) { throw new Error("Cannot save note: Missing required fields."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<string> { try { const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'|'flashcards'|'podcasts'> = { title: title.trim() || 'Untitled', content: content.trim(), type: 'personal', userId, isPublic: false, tags }; const docRef = await addDoc(collection(db, 'notes'), { ...noteData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required."); if (Object.keys(updates).length === 0) { return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); } catch (error) { throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required."); try { await deleteDoc(doc(db, 'notes', noteId)); } catch (error) { throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); } catch (error) { throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

export async function processTextToAINoteData( text: string, userId: string, onProgress: (progress: number) => void ): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>> {
  if (!text.trim()) throw new Error("Input text cannot be empty.");
  const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
  
  try {
    safeProgress(10);
    
    // Use parallel AI processing for faster note creation
    const aiCalls = [
      {
        key: 'title',
        prompt: PROMPT_TEMPLATES.TITLE_GENERATION(text.slice(0, 4000)),
        config: AI_CONFIGS.TITLE_GENERATION
      },
      {
        key: 'content',
        prompt: PROMPT_TEMPLATES.NOTE_GENERATION(text),
        config: AI_CONFIGS.NOTE_GENERATION
      },
      {
        key: 'keyPoints',
        prompt: PROMPT_TEMPLATES.KEY_POINTS(text),
        config: AI_CONFIGS.KEY_POINTS
      },
      {
        key: 'flashcards',
        prompt: PROMPT_TEMPLATES.FLASHCARDS(text),
        config: AI_CONFIGS.FLASHCARDS
      },
      {
        key: 'topics',
        prompt: PROMPT_TEMPLATES.TOPICS(text),
        config: AI_CONFIGS.QUESTIONS
      },
      {
        key: 'questions',
        prompt: PROMPT_TEMPLATES.QUESTIONS(text),
        config: AI_CONFIGS.QUESTIONS
      }
    ];

    const aiResults = await makeParallelAICalls(aiCalls, (progress) => {
      safeProgress(10 + Math.round(progress * 0.8)); // 10-90% range
    });

    // Process results
    let title = aiResults.title.replace(/["']/g, "").trim() || 'AI Generated Note';
    
    let content = aiResults.content;
    if (content.startsWith("Error:")) { 
      content = `<p><strong>Error generating note:</strong> ${content}</p>`; 
    }

    let keyPoints = aiResults.keyPoints.split('\n')
      .map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, ''))
      .filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
    if (keyPoints.length === 0) { 
      keyPoints.push("Key point generation failed or returned no valid points."); 
    }

    // Process flashcards
    const fcRawText = aiResults.flashcards;
    let flashcards: Flashcard[] = [];
    if (!fcRawText.startsWith("Error:")) {
      fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
        const match = block.trim().match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);
        if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
          flashcards.push({ front: match[1].trim(), back: match[2].trim() });
        }
      });
    }

    // Process topics
    const topicsRawText = aiResults.topics;
    let topics: Topic[] = [];
    if (!topicsRawText.startsWith("Error:")) {
      topics = parseTopicsResponse(topicsRawText);
    }

    // Process questions with topics and hints
    const qRawText = aiResults.questions;
    let questions: Question[] = [];
    if (!qRawText.startsWith("Error:")) {
      questions = parseQuestionsWithTopics(qRawText);
    }
    
    safeProgress(100);

    return { title, content, keyPoints, questions, flashcards, topics, type: 'personal', userId, isPublic: false, tags: [] };
  } catch (error) {
    throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export async function regenerateStudyQuestions( noteId: string, content: string, topics?: Topic[] ): Promise<Question[]> {
   if (!noteId || !content.trim()) throw new Error("Note ID/content required.");
   const geminiProxyCallable = getGeminiProxy();
  try {
    const topicsString = topics ? topics.map(t => `Topic: ${t.name}\nID: ${t.id}\nDescription: ${t.description}`).join('\n---DIVIDER---\n') : undefined;
    const questionsPrompt = PROMPT_TEMPLATES.QUESTIONS(content, undefined, topicsString);
    const qResult = await geminiProxyCallable({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: AI_CONFIGS.QUESTIONS });
    const qRawText = extractCandidateText(JSON.stringify(qResult.data));
    let questions: Question[] = [];
    if (!qRawText.startsWith("Error:")) {
        questions = parseQuestionsWithTopics(qRawText);
    }
    return questions;
  } catch (error) {
    throw new Error(`Failed to regenerate questions: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export async function addPodcastToNote(noteId: string, podcastData: Omit<Podcast, 'id'|'createdAt'>): Promise<string> {
    const noteRef = doc(db, 'notes', noteId);
    const noteSnap = await getDoc(noteRef);
    if (!noteSnap.exists()) {
        throw new Error("Note not found, cannot add podcast.");
    }
    const existingPodcasts = noteSnap.data().podcasts || [];
    const newPodcastId = doc(collection(db, 'tmp')).id;
    const newPodcastWithId = {
        ...podcastData,
        id: newPodcastId,
        createdAt: Timestamp.now(),
    };
    await updateDoc(noteRef, {
        podcasts: [...existingPodcasts, newPodcastWithId],
        updatedAt: Timestamp.now()
    });
    return newPodcastId;
}

export async function deletePodcastFromNote(noteId: string, podcastId: string): Promise<void> {
    const noteRef = doc(db, 'notes', noteId);
    const noteSnap = await getDoc(noteRef);
    if (!noteSnap.exists()) {
        throw new Error("Note not found, cannot delete podcast.");
    }
    const existingPodcasts: Podcast[] = noteSnap.data().podcasts || [];
    const updatedPodcasts = existingPodcasts.filter(p => p.id !== podcastId);
    await updateDoc(noteRef, {
        podcasts: updatedPodcasts,
        updatedAt: Timestamp.now()
    });
}
