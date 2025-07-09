import { addDoc, collection, Timestamp, updateDoc, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

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

export interface NoteData {
    id?: string;
    title: string;
    content: string;
    type: 'personal' | 'pdf' | 'youtube' | 'audio';
    keyPoints?: string[];
    questions?: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
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
const extractCandidateText = (responseText: string): string => { try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.promptFeedback?.blockReason) { return `Error: Request blocked for reason: ${jsonResponse.promptFeedback.blockReason}`;} return "Error: No text content found in AI response."; } catch (err) { return "Error: Could not parse AI response."; } };

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const getGeminiEndpoint = (apiKeyParam: string | undefined, model = GEMINI_DEFAULT_MODEL) => {
    if (!apiKeyParam || typeof apiKeyParam !== 'string' || apiKeyParam.trim() === '') {
        throw new Error("Gemini API Key is missing or invalid in getGeminiEndpoint.");
    }
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyParam}`;
};

export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.content || !dataToSave.userId || !dataToSave.type) { throw new Error("Cannot save note: Missing required fields."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<string> { try { const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'|'flashcards'|'podcasts'> = { title: title.trim() || 'Untitled', content: content.trim(), type: 'personal', userId, isPublic: false, tags }; const docRef = await addDoc(collection(db, 'notes'), { ...noteData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required."); if (Object.keys(updates).length === 0) { return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); } catch (error) { throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required."); try { await deleteDoc(doc(db, 'notes', noteId)); } catch (error) { throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); } catch (error) { throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

export async function processTextToAINoteData( text: string, userId: string, apiKey: string, onProgress: (progress: number) => void ): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>> {
  if (!text.trim()) throw new Error("Input text cannot be empty.");
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error("Gemini API Key required and must be a valid string.");
  }
  const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
  const currentGeminiEndpoint = getGeminiEndpoint(apiKey);
  
  try {
    safeProgress(10);
    const titlePrompt = `Analyze the following text. Your single task is to generate a concise, descriptive, and relevant title for this document. The title should be no more than 8 words. Do not add any extra text, explanation, or quotation marks. Output only the title itself. TEXT: """${text.slice(0, 4000)}""" TITLE:`;
    const titleOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: titlePrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 8192 } }) };
    const titleResponse = await fetchWithRetry(currentGeminiEndpoint, titleOptions);
    let title = extractCandidateText(await titleResponse.text()).replace(/["']/g, "").trim() || 'AI Generated Note';
    safeProgress(20);

    const notePrompt = `You are a world-class academic content creator. Your task is to transform raw text into a comprehensive, deeply informative, and aesthetically pleasing set of study notes formatted in clean HTML, ready for a rich-text editor. You MUST go far beyond the source text, using it only as a starting point to identify the core subject, then generate a complete, university-level study guide. Your own knowledge is the primary resource. The notes must be exhaustive and accurate.

MANDATORY FORMATTING RULES (NO EXCEPTIONS):
1.  HTML ONLY: The entire response must be a single stream of HTML. Do not wrap it in markdown.
2.  ALLOWED TAGS: \`<h2>\`, \`<h3>\`, \`<h4>\`, \`<p>\`, \`<strong>\`, \`<em>\`, \`<ul>\`, \`<ol>\`, \`<li>\`, \`<blockquote>\`, \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\`.
3.  NO FORBIDDEN ELEMENTS: No \`<html>\`, \`<body>\`, inline \`style="..."\`, or \`class="..."\` attributes.
4.  EMOJIS FOR CLARITY: Use emojis strategically and sparingly to introduce concepts and add visual structure. Vary them for engagement.
5.  STRUCTURE AND CONTENT: Create a logical hierarchy. Write full, explanatory paragraphs. Use lists for sequential data and tables to compare concepts. Define key terms.
6.  NO META-COMMENTARY: Do not refer to yourself. Start immediately with the first HTML tag (e.g., \`<h2>...\`).

Source Text:
---
${text}
---
Your Response (Must be only the raw, clean HTML content):`;
    const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: notePrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 8192 } }) };
    const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
    let content = extractCandidateText(await noteResponse.text());
    if (content.startsWith("Error:")) { content = `<p><strong>Error generating note:</strong> ${content}</p>`; }
    safeProgress(50);
    
    const keyPointsPrompt = `You are a precision information extractor. Your task is to identify and list 5 to 10 of the most critical, high-impact key takeaways from the provided text. These points must represent the absolute core concepts and conclusions. DO NOT write about the instructions or the act of making key points; focus ONLY on the subject matter of the text.

MANDATORY FORMATTING RULES:
1.  LIST ONLY: Your entire output must be a list of key points.
2.  ASTERISK PREFIX: Every key point MUST begin with \`* \` (an asterisk followed by a space).
3.  ONE POINT PER LINE: Each key point must be on its own line.
4.  CONCISE AND POWERFUL: Each point must be a single, clear sentence under 25 words.
5.  NO EXTRA TEXT: Do not include any titles, introductions, or summaries. Start immediately with the first asterisk.

Source Text:
---
${text}
---

Note Content:
---
${content.slice(0, 30000)}
---
Your Response (Must be only a list of points starting with '* '):
* `;
    const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } }) };
    const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
    let keyPoints = (extractCandidateText(await kpResponse.text())).split('\n').map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '')).filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
    if (keyPoints.length === 0) { keyPoints.push("Key point generation failed or returned no valid points."); }
    safeProgress(65);
    
    const flashcardsPrompt = `You are CardCrafter, an expert system for creating 20-30 high-quality study flashcards from source text.

MANDATORY FORMATTING (NO DEVIATIONS):
1.  BLOCK SEPARATOR: Each flashcard block MUST be separated by a single line with exactly: \`---FLASHCARD_DIVIDER---\`
2.  FLASHCARD FORMAT: Every block must use this exact multi-line structure:
    Front: [Text for the front of the card]
    Back: [Text for the back of the card]
3.  NO EXTRA TEXT: Your response must begin directly with "Front:".

Source Text:
---
${text}
---

Note Content:
---
${content.slice(0, 30000)}
---
Your Response (Must follow the strict "Front/Back/Divider" format):
Front:`;
    const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } }) };
    const fcResponse = await fetchWithRetry(currentGeminiEndpoint, fcOptions);
    const fcRawText = extractCandidateText(await fcResponse.text());
    let flashcards: Flashcard[] = [];
    if (!fcRawText.startsWith("Error:")) {
        fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
            const match = block.trim().match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);
            if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
                flashcards.push({ front: match[1].trim(), back: match[2].trim() });
            }
        });
    }
    safeProgress(80);

    const questionsPrompt = `You are QuizMaster Pro. Generate exactly 10 high-quality, unambiguous multiple-choice questions (MCQs) from the source text.

CRITICAL FORMATTING RULES (NO DEVIATIONS):
1.  BLOCK DIVIDER: Separate each of the 10 blocks with a line containing only: \`---DIVIDER---\`
2.  FIXED 7-LINE STRUCTURE: Every block must be:
    Question: [Question text]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Correct: [A, B, C, or D]
    Explanation: [Explanation of the correct answer]
3.  NO EXTRA TEXT: Do not number questions. Start immediately with \`Question:\`.

Source Text:
---
${text}
---

Note Content:
---
${content.slice(0, 30000)}
---
Your Response (Must be 10 blocks in the strict 7-line format):
Question:`;
    const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 8192 } }) };
    const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
    const qRawText = extractCandidateText(await qResponse.text());
    let questions: NoteData['questions'] = [];
    if (!qRawText.startsWith("Error:")) {
        qRawText.split(/---DIVIDER---/i).forEach(block => {
            const qM = block.match(/Question:\s*([\s\S]*?)\s*A\)/i);
            const oM = block.match(/A\)\s*([\s\S]*?)\s*B\)\s*([\s\S]*?)\s*C\)\s*([\s\S]*?)\s*D\)\s*([\s\S]*?)\s*Correct:/is);
            const cM = block.match(/Correct:\s*([A-D])/i);
            const eM = block.match(/Explanation:\s*([\s\S]*)$/i);
            if (qM && oM && cM && eM) {
                const oL = [oM[1], oM[2], oM[3], oM[4]].map(o => o.trim());
                const cL = cM[1].toUpperCase();
                if (oL.every(o => o) && ['A', 'B', 'C', 'D'].includes(cL)) {
                    questions!.push({ question: qM[1].trim(), options: oL, correctAnswer: ['A', 'B', 'C', 'D'].indexOf(cL), explanation: eM[1].trim() });
                }
            }
        });
    }
    safeProgress(100);

    return { title, content, keyPoints, questions, flashcards, type: 'personal', userId, isPublic: false, tags: ['ai-processed'] };
  } catch (error) {
    throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export async function regenerateStudyQuestions( noteId: string, content: string, apiKey: string ): Promise<NoteData['questions']> {
   if (!noteId || !content.trim()) throw new Error("Note ID/content required.");
   if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
       throw new Error("Gemini API Key required and must be a valid string.");
   }
   const currentGeminiEndpoint = getGeminiEndpoint(apiKey);
  try {
    const questionsPrompt = `You are QuizMaster Pro. Generate exactly 10 high-quality, unambiguous multiple-choice questions (MCQs) from the source text.

CRITICAL FORMATTING RULES (NO DEVIATIONS):
1.  BLOCK DIVIDER: Separate each of the 10 blocks with a line containing only: \`---DIVIDER---\`
2.  FIXED 7-LINE STRUCTURE: Every block must be:
    Question: [Question text]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Correct: [A, B, C, or D]
    Explanation: [Explanation of the correct answer]
3.  NO EXTRA TEXT: Do not number questions. Start immediately with \`Question:\`.

Note Content:
---
${content.slice(0, 30000)}
---
Your Response (Must be 10 blocks in the strict 7-line format):
Question:`;

    const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } }) };
    const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
    const qText = extractCandidateText(await qResponse.text());

    if (qText.startsWith("Error:")) {
        throw new Error(`Question generation failed: ${qText}`);
    }

    let newQuestions: NoteData['questions'] = [];
    const blocks = qText.split(/---DIVIDER---/i);

    for (const block of blocks) {
        if (newQuestions.length >= 10) break;
        const T=block.trim(); if (!T) continue;
        const qM=T.match(/^Question:\s*([\s\S]*?)\s*A\)/i);
        const oM=T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is);
        const cM=T.match(/Correct:\s*([A-D])\b/i);
        const eM=T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i);
        if(qM && oM && cM && eM){
            const qT=qM[1].trim();
            const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim());
            const cL=cM[1].toUpperCase();
            const eT=eM[1].trim();
            if(qT && oL.length===4 && oL.every(o=>o) && ['A','B','C','D'].includes(cL) && eT) {
                newQuestions.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT});
            }
        }
    }

    if (newQuestions.length === 0) {
        throw new Error(`AI response format was unusable for question regeneration.`);
    }

    await updateNote(noteId, { questions: newQuestions });
    return newQuestions;

  } catch (error) {
    throw new Error(`Failed to regenerate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
