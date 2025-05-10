import { addDoc, collection, Timestamp, updateDoc, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const PREMIUM_EMAILS = ["robinmyh@gmail.com", "oliverbeckett069420@gmail.com", "bajinsrinivasr@lexington1.net"];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;

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
const extractCandidateText = (responseText: string): string => { try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') { return `Error: Generation stopped due to ${jsonResponse.candidates[0].finishReason}`; } return "Error: No text content found in AI response."; } catch (err) { return "Error: Could not parse AI response."; } };

const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';
const getGeminiEndpoint = (apiKeyParam: string | undefined, model = GEMINI_DEFAULT_MODEL) => {
    if (!apiKeyParam || typeof apiKeyParam !== 'string' || apiKeyParam.trim() === '') {
        throw new Error("Gemini API Key is missing or invalid in getGeminiEndpoint.");
    }
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyParam}`;
};

export const getUserTier = (email: string | null | undefined): UserTier => {
    if (!email) return 'basic';
    if (PREMIUM_EMAILS.includes(email)) return 'premium';
    if (PRO_EMAILS.includes(email)) return 'pro';
    return 'basic';
};

export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.content || !dataToSave.userId || !dataToSave.type) { throw new Error("Cannot save note: Missing required fields."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { if (error instanceof Error && error.message.includes('invalid data')) { throw new Error(`Firestore rejected data. Original Error: ${error.message}`); } throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<string> { try { const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'> = { title: title.trim() || 'Untitled', content: content.trim(), type: 'personal', userId, isPublic: false, tags, }; const docRef = await addDoc(collection(db, 'notes'), { ...noteData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); return docRef.id; } catch (error) { throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required."); if (Object.keys(updates).length === 0) { return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); } catch (error) { if (error instanceof Error && error.message.includes('invalid data')) { throw new Error(`Firestore rejected update data. Original Error: ${error.message}`); } throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required."); try { await deleteDoc(doc(db, 'notes', noteId)); } catch (error) { throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); } catch (error) { throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

export async function getUserNoteUsage(userId: string): Promise<NoteUsageData | null> {
    if (!userId) throw new Error("User ID is required to fetch note usage.");
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            const usageFieldName = `noteCounts_${currentMonthYear}`;
            if (userData[usageFieldName]) {
                return {
                    pdfAi: userData[usageFieldName].pdfAi || 0,
                    youtube: userData[usageFieldName].youtube || 0,
                    month: currentMonthYear
                };
            }
        }
        return null;
    } catch (error) {
        throw new Error(`Failed to fetch note usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function updateUserNoteUsage(userId: string, usage: { pdfAi: number; youtube: number }, month: string): Promise<void> {
    if (!userId) throw new Error("User ID is required to update note usage.");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required.");
    try {
        const userRef = doc(db, 'users', userId);
        const usageFieldName = `noteCounts_${month}`;
        await setDoc(userRef, {
            [usageFieldName]: {
                pdfAi: usage.pdfAi,
                youtube: usage.youtube
            }
        }, { merge: true });
    } catch (error) {
        throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getUserChatUsage(userId: string): Promise<ChatUsageData | null> {
    if (!userId) throw new Error("User ID is required to fetch chat usage.");
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            const usageFieldName = `chatCount_${currentMonthYear}`;
            if (typeof userData[usageFieldName] === 'number') {
                return {
                    count: userData[usageFieldName],
                    month: currentMonthYear
                };
            }
        }
        return null;
    } catch (error) {
        throw new Error(`Failed to fetch chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function updateUserChatUsage(userId: string, count: number, month: string): Promise<void> {
    if (!userId) throw new Error("User ID is required to update chat usage.");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required.");
    if (typeof count !== 'number' || count < 0) throw new Error("Invalid chat count.");
    try {
        const userRef = doc(db, 'users', userId);
        const usageFieldName = `chatCount_${month}`;
        await setDoc(userRef, {
            [usageFieldName]: count
        }, { merge: true });
    } catch (error) {
        throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function processTextToAINoteData( text: string, userId: string, apiKey: string ): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>> {
  if (!text.trim()) throw new Error("Input text cannot be empty.");
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error("Gemini API Key required for processTextToAINoteData and must be a valid string.");
  }
  const currentGeminiEndpoint = getGeminiEndpoint(apiKey);
  let detailedNoteContent = 'AI note generation failed.'; let keyPoints: string[] = ['Generation failed.']; let questions: NoteData['questions'] = undefined;

  try {
    // --- Detailed Note Generation (Generic Text) ---
    const detailedNotePrompt = `Analyze the following text. Generate a detailed, well-structured note using Markdown.

**Instructions:**
*   **Structure:** Use Markdown elements extensively: headings (#, ##, ###), bullet points (* or -), numbered lists, and tables where appropriate.
*   **Formatting:** Use bold text (**bold**) for emphasis. Use inline code (\`code\`) for terms or snippets.
*   **Math:** Use LaTeX for mathematical expressions ($inline$ or $$block$$).
*   **Content:** Cover main topics, sub-topics, arguments, and important details thoroughly. Aim for comprehensiveness and generate extensive, detailed notes.
*   **Length:** Produce a detailed and lengthy note, not just a summary. The goal is to be exhaustive based on the provided input text.

**Objective:** Create comprehensive, detailed, and well-structured study notes in Markdown format based on the provided text. These notes are intended for understanding and learning the subject matter.

**Core Task:** Do not just summarize. Synthesize the information, explain concepts clearly, elaborate on key points, and structure the content logically for learning and revision. Use the provided text as the primary source. **Crucially, present the information directly as study notes.** Avoid meta-commentary or phrases that refer to the source document itself, such as "The text says...", "This document explains...", "The provided material mentions...", "According to the author...", or "The passage states...". The notes should *be* the information, not a discussion *about* where the information came from.

**Mandatory Instructions for Output:**
1.  **Direct Information Style:** The notes must present information directly as if they are standalone study material. **Do NOT use phrases that refer back to the source text** (e.g., "The text discusses...", "In this section, it is mentioned...", "The author explains that..."). All content should be stated as factual information derived from the source, without attributing it back to the source within the note itself.
2.  **Raw Markdown Only:** Generate **only** the raw Markdown note content.
3.  **No Extra Text:** **NO** introductory or concluding phrases (e.g., "Here are your notes:", "This concludes the notes.").
4.  **Immediate Start:** Start *immediately* with the first Markdown element (e.g., a heading like '# Title' or a bullet point like '* Item').
5.  **No Code Block Wrapping:** **Crucially, do NOT wrap the entire output in a Markdown code block. This means your response should NOT start with \`\`\`markdown or \`\`\` and should NOT end with \`\`\`. The output itself should be the pure Markdown text, ready to be rendered.**

**Text to Analyze:**
---
${text} // For more extensive notes, ensure this 'text' variable contains the full content. If you previously used text.slice(0, 30000), consider removing or increasing the slice limit, being mindful of your LLM's context window capacity.
---

**Output:**
Provide *only* the generated raw Markdown note content below. Do not include any explanatory text before or after the Markdown.
`;
      const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) };
    const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions); const noteRawText = extractCandidateText(await noteResponse.text());
    if (noteRawText.startsWith("Error:")) { detailedNoteContent = `Error generating note: ${noteRawText}\n\nOriginal Text:\n${text.slice(0, 500)}...`; } else { detailedNoteContent = noteRawText.trim(); }

    const keyPointsPrompt = `Extract exactly 10 distinct key points from the following text. List only the points, one per line. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:" \nText:\n---\n${text.slice(0, 15000)}\n---\nKey Points:\n1. ...`;
    const keyPointsOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }) };
    try { const kpResponse = await fetchWithRetry(currentGeminiEndpoint, keyPointsOptions); const kpText = extractCandidateText(await kpResponse.text()); if (kpText.startsWith("Error:")) { keyPoints = ['Key points generation failed.']; } else { const parsed = kpText.split('\n').map(l => l.trim().replace(/^\d+\.\s*/, '')).filter(p => p.length > 5).slice(0, 10); keyPoints = parsed.length > 0 ? parsed : ['No valid key points parsed.']; } } catch (kpError) { keyPoints = ['Key points generation fetch error.']; }

    const questionsPrompt = `Based on the text, generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nGenerate 10.\n\nText:\n---\n${text.slice(0, 15000)}\n---`;
    const questionsOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
    try { const qResponse = await fetchWithRetry(currentGeminiEndpoint, questionsOptions); const qText = extractCandidateText(await qResponse.text()); let parsedQs: NoteData['questions'] = []; if (!qText.startsWith("Error:")) { const blocks = qText.split(/---DIVIDER---/i); for (const block of blocks) { if (parsedQs.length >= 10) break; const T = block.trim(); if (!T) continue; const qM=T.match(/^Question:\s*([\s\S]*?)\s*A\)/i); const oM=T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is); const cM=T.match(/Correct:\s*([A-D])\b/i); const eM=T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i); if (qM&&oM&&cM&&eM) { const qT=qM[1].trim(); const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim()); const cL=cM[1].toUpperCase(); const eT=eM[1].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) parsedQs.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); } } if (parsedQs.length > 0) questions = parsedQs; } } catch (qError) { /* empty */ }

    return { title: text.split('\n')[0].slice(0, 60).trim() || 'AI Note', content: detailedNoteContent, keyPoints: keyPoints, questions: questions, type: 'personal', userId, isPublic: false, tags: ['ai-processed'], };
  } catch (error) {
    return { title: text.split('\n')[0].slice(0, 60).trim() || 'AI Fail', content: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown'}\n\nInput:\n${text.slice(0,500)}...`, keyPoints: ["Failed."], type: 'personal', userId, isPublic: false, tags: ['ai-error'] };
  }
}

export async function regenerateStudyQuestions( noteId: string, content: string, apiKey: string ): Promise<NoteData['questions']> {
   if (!noteId || !content.trim()) throw new Error("Note ID/content required.");
   if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
       throw new Error("Gemini API Key required for regenerateStudyQuestions and must be a valid string.");
   }
   const currentGeminiEndpoint = getGeminiEndpoint(apiKey);
  try {
    const questionsPrompt = `Based on the following note content, generate exactly 10 multiple-choice study questions. Each question MUST have 4 options (labeled A, B, C, D), the correct answer letter, and a brief explanation.

**VERY IMPORTANT:** Format EACH question *strictly* as follows, separated by '---DIVIDER---':

Question: [Your question here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct: [Correct Answer Letter (A, B, C, or D)]
Explanation: [Brief explanation why it's correct]

---DIVIDER---

Ensure all 10 questions are generated and precisely follow this structure including the divider.

Note Content (excerpt):
---
${content.slice(0, 15000)}
---`;

    const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
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
