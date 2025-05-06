// src/lib/notes-firebase.ts
import { addDoc, collection, Timestamp, updateDoc, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { geminiApiKey } from './dashboard-firebase';

// --- Tier Definitions ---
export const PREMIUM_EMAILS = ["robinmyh@gmail.com", "oliverbeckett069420@gmail.com", "bajinsrinivasr@lexington1.net"];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

// --- Usage Limits ---
export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;

// Types
export interface ImageData { base64: string; type: string; name: string; }
export interface Flashcard { front: string; back: string; }
export interface NoteData {
    id?: string;
    title: string;
    content: string;
    type: 'personal' | 'pdf' | 'youtube' | 'audio';
    keyPoints?: string[];
    questions?: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    sourceUrl?: string;
    userId: string;
    isPublic: boolean;
    tags: string[];
    flashcards?: Flashcard[];
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
interface NoteUsageData {
    pdfAi: number;
    youtube: number;
    month: string; // YYYY-MM
}
interface ChatUsageData {
    count: number;
    month: string; // YYYY-MM
}

// --- Helper Functions ---
function removeUndefinedFields(obj: any): any { const newObj: any = {}; Object.keys(obj).forEach(key => { if (obj[key] !== undefined) { newObj[key] = obj[key]; } }); return newObj; }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> { for (let attempt = 0; attempt < retries; attempt++) { try { const response = await fetch(url, options); if (!response.ok && (response.status === 429 || response.status >= 500)) { console.warn(`Attempt ${attempt + 1}/${retries} failed: ${response.status}. Retrying in ${delayMs * (attempt + 1)}ms...`); await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); continue; } return response; } catch (error) { console.error(`Attempt ${attempt + 1}/${retries} fetch error:`, error); if (attempt === retries - 1) throw error; console.warn(`Retrying fetch in ${delayMs * (attempt + 1)}ms...`); await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1))); } } throw new Error(`Max retries reached: ${url}`); }
const extractCandidateText = (responseText: string): string => { try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { console.error("Gemini API Error:", jsonResponse.error.message); throw new Error(`API Error: ${jsonResponse.error.message}`); } if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') { console.warn(`Gemini finish reason: ${jsonResponse.candidates[0].finishReason}`, jsonResponse); throw new Error(`Generation stopped due to ${jsonResponse.candidates[0].finishReason}`); } console.warn("No candidate text found:", jsonResponse); return ""; } catch (err) { console.error('Error parsing Gemini response:', err); throw new Error(`Could not parse AI response: ${err instanceof Error ? err.message : 'Unknown parsing error'}`); } };

// Model Names & Endpoints
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002';
const GOOGLE_AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const getApiEndpoint = (modelName: string, apiKey: string | undefined, isImageGen: boolean = false) => {
    if (!apiKey) throw new Error("API Key is missing.");
    const action = ':generateContent'; // Both use :generateContent
    const keyParam = isImageGen ? '' : `?key=${apiKey}`;
    return `${GOOGLE_AI_STUDIO_BASE}${modelName}${action}${keyParam}`;
};

// --- Tier Determination Function ---
export const getUserTier = (email: string | null | undefined): UserTier => {
    if (!email) return 'basic';
    if (PREMIUM_EMAILS.includes(email)) return 'premium';
    if (PRO_EMAILS.includes(email)) return 'pro';
    return 'basic';
};

// --- Firestore Operations ---
export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { console.error('Error fetching note by ID:', error); throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(userId: string, noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<NoteData> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.type) { console.error("Missing required fields for save:", dataToSave); throw new Error("Cannot save note: Missing required fields (title, type)."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, userId: userId, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); const newDocSnap = await getDoc(docRef); if (!newDocSnap.exists()) throw new Error("Failed to fetch newly created note."); return { id: newDocSnap.id, ...newDocSnap.data() } as NoteData; } catch (error) { console.error('Error saving note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid data for save:', noteData); throw new Error(`Firestore rejected save data. Original Error: ${error.message}`); } throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<NoteData> { try { const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'|'userId'|'flashcards'> = { title: title.trim() || 'Untitled', content: content.trim(), type: 'personal', isPublic: false, tags, }; const docRef = await addDoc(collection(db, 'notes'), { ...noteData, userId, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); const newDocSnap = await getDoc(docRef); if (!newDocSnap.exists()) throw new Error("Failed to fetch newly created personal note."); return { id: newDocSnap.id, ...newDocSnap.data() } as NoteData; } catch (error) { console.error('Error saving personal note:', error); throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required for update."); if (Object.keys(updates).length === 0) { console.warn("updateNote called with empty updates."); return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { console.warn("updateNote resulted in empty object after cleaning undefined fields."); return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); console.log("Note updated:", noteId); } catch (error) { console.error('Error updating note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid update data:', updates); throw new Error(`Firestore rejected update data. Original Error: ${error.message}`); } throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required for delete."); try { await deleteDoc(doc(db, 'notes', noteId)); console.log("Note deleted:", noteId); } catch (error) { console.error('Error deleting note:', error); throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required for toggle public."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); console.log(`Note ${noteId} public status set to:`, makePublic); } catch (error) { console.error('Error toggling public status:', error); throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

// --- Usage Tracking Functions ---
export async function getUserNoteUsage(userId: string): Promise<NoteUsageData | null> { if (!userId) throw new Error("User ID is required to fetch note usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `noteCounts_${currentMonthYear}`; if (userData[usageFieldName]) { return { pdfAi: userData[usageFieldName].pdfAi || 0, youtube: userData[usageFieldName].youtube || 0, month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching note usage:', error); throw new Error(`Failed to fetch note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserNoteUsage(userId: string, usage: { pdfAi: number; youtube: number }, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update note usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `noteCounts_${month}`; await setDoc(userRef, { [usageFieldName]: { pdfAi: usage.pdfAi, youtube: usage.youtube } }, { merge: true }); console.log(`Note usage updated for user ${userId} for month ${month}:`, usage); } catch (error) { console.error('Error updating note usage:', error); throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function getUserChatUsage(userId: string): Promise<ChatUsageData | null> { if (!userId) throw new Error("User ID is required to fetch chat usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `chatCount_${currentMonthYear}`; if (typeof userData[usageFieldName] === 'number') { return { count: userData[usageFieldName], month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching chat usage:', error); throw new Error(`Failed to fetch chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserChatUsage(userId: string, count: number, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update chat usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); if (typeof count !== 'number' || count < 0) throw new Error("Invalid chat count."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `chatCount_${month}`; await setDoc(userRef, { [usageFieldName]: count }, { merge: true }); console.log(`Chat usage updated for user ${userId} for month ${month}: ${count}`); } catch (error) { console.error('Error updating chat usage:', error); throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

// --- AI Processing Functions ---
export async function processTextToAINoteData( text: string, apiKey: string, isSourceUrl: boolean = false ): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt' | 'userId'>> {
    if (!text.trim()) throw new Error("Input text cannot be empty.");
    if (!apiKey) throw new Error("Gemini API Key required for AI processing.");

    const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey, false);
    let title = (isSourceUrl ? "AI Processed Source" : text.split('\n')[0].slice(0, 60).trim()) || 'AI Note';
    let detailedNoteContent = 'AI processing failed or returned no content.';
    let keyPoints: string[] = [];
    let questions: NoteData['questions'] = [];
    let flashcards: NoteData['flashcards'] = [];

    try {
        console.log("Starting combined AI processing...");
        const combinedPrompt = `
Analyze the following text${isSourceUrl ? " (from a document/URL)" : ""}.
Generate the following structured outputs using Markdown:

1.  **Detailed Note:** Comprehensive note with Markdown (headings, lists, bold).
2.  **Key Points:** Exactly 10 distinct points, starting each line with '* '.
3.  **Study Questions:** Exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format:
    Question: [Q]
    A) [A]
    B) [B]
    C) [C]
    D) [D]
    Correct: [Letter]
    Explanation: [E]
4.  **Flashcards:** 10-15 flashcards. Format:
    Front: [Front Text]
    Back: [Back Text]

Separate sections clearly with '---SECTION_BREAK---'.

Text:
---
${text.slice(0, 30000)}
---

Output:
---SECTION_BREAK---
[Detailed Note Content Here]
---SECTION_BREAK---
[Key Points List Here]
---SECTION_BREAK---
[Study Questions Here, separated by newlines]
---SECTION_BREAK---
[Flashcards Here, separated by newlines]
`;
        const combinedOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: combinedPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } }) };
        const combinedResponse = await fetchWithRetry(currentGeminiEndpoint, combinedOptions);
        const rawCombinedText = await combinedResponse.text();
        const combinedText = extractCandidateText(rawCombinedText);
        if (!combinedText) throw new Error("AI processing returned empty candidate text.");

        console.log("AI response received, parsing sections...");
        const sections = combinedText.split(/---SECTION_BREAK---/i);

        if (sections.length > 1 && sections[1]) detailedNoteContent = sections[1].trim() || detailedNoteContent; else console.warn("Detailed Note section missing/empty.");
        if (sections.length > 2 && sections[2]) keyPoints = sections[2].split('\n').map(l => l.trim().replace(/^[\*\-]\s*/, '')).filter(p => p.length > 5).slice(0, 10); else console.warn("Key Points section missing/empty.");
        if (sections.length > 3 && sections[3]) { const qBlock=sections[3].trim(); const qRegex=/Question:\s*([\s\S]*?)\s*A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:\s*([A-D])\s*Explanation:\s*([\s\S]*?)(?=\nQuestion:|\n*$)/gi; let qMatch; while((qMatch=qRegex.exec(qBlock))!==null&&questions.length<10){ const qT=qMatch[1].trim(); const oL=[qMatch[2],qMatch[3],qMatch[4],qMatch[5]].map(o=>o.trim()); const cL=qMatch[6].toUpperCase(); const eT=qMatch[7].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) questions.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); else console.warn("Partial question parse."); } } else console.warn("Study Questions section missing/empty.");
        if (sections.length > 4 && sections[4]) { const fcBlock=sections[4].trim(); const fcRegex=/Front:\s*([\s\S]*?)\s*Back:\s*([\s\S]*?)(?=\nFront:|\n*$)/gi; let fcMatch; while((fcMatch=fcRegex.exec(fcBlock))!==null&&flashcards.length<15){ const front=fcMatch[1].trim(); const back=fcMatch[2].trim(); if(front&&back) flashcards.push({front,back}); else console.warn("Partial flashcard parse."); } } else console.warn("Flashcards section missing/empty.");

        const headingMatch = detailedNoteContent.match(/^#\s+(.*)/);
        if (headingMatch && headingMatch[1]) title = headingMatch[1].trim().slice(0, 100);

        console.log(`AI processing parsed: ${keyPoints.length} points, ${questions.length} questions, ${flashcards.length} flashcards.`);
        return { title, content: detailedNoteContent, keyPoints: keyPoints.length>0?keyPoints:undefined, questions: questions.length>0?questions:undefined, flashcards: flashcards.length>0?flashcards:undefined, type: 'personal', isPublic: false, tags: ['ai-processed'], };
    } catch (error) {
        console.error('Error during combined AI processing:', error);
        return { title: title || 'AI Processing Error', content: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nInput (start):\n${text.slice(0, 500)}...`, keyPoints: undefined, questions: undefined, flashcards: undefined, type: 'personal', isPublic: false, tags: ['ai-error'], };
    }
}

export async function regenerateStudyQuestions( noteId: string, content: string, apiKey: string ): Promise<NoteData['questions']> {
    if (!noteId || !content.trim()) throw new Error("Note ID/content required for regen."); if (!apiKey) throw new Error("Gemini API Key required for regen.");
    const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey, false);
    console.log(`Regenerating 10 questions for note: ${noteId}`);
    try {
        const questionsPrompt = `Based on the note content, generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nNote Content:\n---\n${content.slice(0, 15000)}\n---`;
        const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
        const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
        const qRawText = await qResponse.text();
        const qText = extractCandidateText(qRawText);
        if (!qText) throw new Error("AI response for question regen was empty.");

        let newQuestions: NoteData['questions'] = [];
        const blocks = qText.split(/---DIVIDER---/i);
        console.log(`Regen: Received ${blocks.length - 1} potential question blocks.`);
        for (const block of blocks) { if (newQuestions.length >= 10) break; const T=block.trim(); if(!T) continue; const qM=T.match(/^Question:\s*([\s\S]*?)\s*A\)/i); const oM=T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is); const cM=T.match(/Correct:\s*([A-D])\b/i); const eM=T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i); if(qM&&oM&&cM&&eM){ const qT=qM[1].trim(); const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim()); const cL=cM[1].toUpperCase(); const eT=eM[1].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) newQuestions.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); else console.warn("Partial regen Q parse - Validation failed."); } else if (T.length > 10) console.warn("Regen Q structure parse fail."); }

        if (newQuestions.length === 0) { console.error("Failed to parse ANY questions from regen response. Raw:", qRawText); throw new Error(`AI response format unusable for question regen.`); }
        console.log(`Successfully parsed ${newQuestions.length} regenerated questions for note ${noteId}.`);
        if (newQuestions.length < 10) console.warn(`Regenerated fewer than 10 questions (${newQuestions.length}).`);
        return newQuestions; // Return parsed questions; update happens in Notes.tsx
    } catch (error) { console.error(`Error during question regeneration for note ${noteId}:`, error); throw new Error(`Failed to regenerate questions: ${error instanceof Error ? error.message : 'Unknown error'}`); }
}

export async function generateImageWithImagen( prompt: string, context: string | null, apiKey: string ): Promise<ImageData | null> {
    if (!prompt.trim()) throw new Error("Image generation prompt cannot be empty.");
    if (!apiKey) throw new Error("API Key is required for image generation.");

    // *** CORRECTED PAYLOAD STRUCTURE ***
    const payload = {
        prompt: {
          text: prompt,
        },
        generationConfig: {
          num_results: 1, // Use num_results (max 4 for Imagen 3)
          aspect_ratio: "1:1" // Example aspect ratio
          // Add other config like safety_settings if needed
        }
      };

    const endpoint = getApiEndpoint(IMAGEN_3_MODEL, apiKey, true);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, }, body: JSON.stringify(payload) }; // Stringify the corrected payload

    console.log(`Generating image with Imagen 3 (${IMAGEN_3_MODEL})...`);
    try {
        const response = await fetchWithRetry(endpoint, options);
        const responseText = await response.text();
        if (!response.ok) { let errorMsg = `Imagen API Error (${response.status})`; try { const errJson = JSON.parse(responseText); errorMsg = `Imagen API Error: ${errJson?.error?.message || response.statusText}` ; if (errJson?.error?.status) errorMsg += ` (Status: ${errJson.error.status})`; if (errorMsg.includes("API key not valid")) errorMsg = "Error: Invalid API Key for Image Generation."; } catch { /* Ignore */ } console.error(errorMsg, "Raw response:", responseText); throw new Error(errorMsg); }

        const jsonResponse = JSON.parse(responseText);

        // Prefer 'generated_images' structure
        if (jsonResponse.generated_images && Array.isArray(jsonResponse.generated_images) && jsonResponse.generated_images.length > 0) {
            const imageInfo = jsonResponse.generated_images[0];
            const base64Data = imageInfo?.image?.image_bytes || imageInfo?.b64_json; // Check both possible fields
            const mimeType = imageInfo?.image?.mime_type || 'image/png';
            if (base64Data) { console.log("Image generated (parsed 'generated_images')."); const fileExtension = mimeType.split('/')[1] || 'png'; return { base64: base64Data, type: mimeType, name: `generated-image-${Date.now()}.${fileExtension}` }; }
        }
        // Fallback 'candidates' structure
        const candidate = jsonResponse?.candidates?.[0];
        if (candidate?.content?.parts?.[0]?.inline_data?.data) { const part = candidate.content.parts[0]; const base64Data = part.inline_data.data; const mimeType = part.inline_data.mime_type || 'image/png'; if(base64Data){ console.log("Image generated (parsed 'candidates')."); const fileExtension = mimeType.split('/')[1] || 'png'; return { base64: base64Data, type: mimeType, name: `generated-image-${Date.now()}.${fileExtension}` }; } }

        // Handle blocking/other errors
        if (jsonResponse?.promptFeedback?.blockReason) { const blockReason = jsonResponse.promptFeedback.blockReason; let safetyDetails = jsonResponse.promptFeedback.safetyRatings ? ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}` : ""; console.warn(`Image generation blocked: ${blockReason}.${safetyDetails}`); throw new Error(`Image generation failed due to safety settings: ${blockReason}.`); }
        const finishReason = candidate?.finishReason; if (finishReason && finishReason !== 'STOP') throw new Error(`Image generation stopped unexpectedly. Reason: ${finishReason}`);

        console.error("Image generation response OK, but no usable image data found.", jsonResponse);
        throw new Error("Image generation succeeded (API), but no image data found in response.");

    } catch (error) { console.error('Error during image generation call/parsing:', error); throw error; }
}
