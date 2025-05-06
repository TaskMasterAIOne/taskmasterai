
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
interface NoteData {
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
    flashcards?: { front: string; back: string; }[];
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
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002'; // Correct Imagen 3 model name
const GOOGLE_AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Updated function to get correct endpoint structure
const getApiEndpoint = (modelName: string, apiKey: string | undefined) => {
    if (!apiKey) throw new Error("API Key is missing.");
    // *** IMPORTANT: Assuming Imagen 3 *still uses* the :generateContent structure for REST
    // based on public Gemini API docs, even though Python SDK has a specific method.
    // If a different specific endpoint for Imagen 3 REST is discovered, update this.
    // Example: `models/imagen-3.0-generate-002:generateImages` - this is a guess, not confirmed publicly.
    // Sticking to the known pattern for now:
    const action = modelName.startsWith('imagen') ? ':generateContent' : ':generateContent'; // Use :generateContent for both for now
    const keyParam = modelName.startsWith('imagen') ? '' : `?key=${apiKey}`; // Key goes in header for Imagen
    return `${GOOGLE_AI_STUDIO_BASE}${modelName}${action}${keyParam}`;
};


// --- Tier Determination Function ---
export const getUserTier = (email: string | null | undefined): UserTier => {
    if (!email) return 'basic';
    if (PREMIUM_EMAILS.includes(email)) return 'premium';
    if (PRO_EMAILS.includes(email)) return 'pro';
    return 'basic';
};


// --- Firestore Operations --- (No changes needed in these core operations)
export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { console.error('Error fetching note by ID:', error); throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.userId || !dataToSave.type) { console.error("Missing required fields:", dataToSave); throw new Error("Cannot save note: Missing required fields (title, userId, type)."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); console.log("Note saved:", docRef.id); return docRef.id; } catch (error) { console.error('Error saving note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid data details:', noteData); throw new Error(`Firestore rejected data. Original Error: ${error.message}`); } throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<string> { try { const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'> = { title: title.trim() || 'Untitled', content: content.trim(), type: 'personal', userId, isPublic: false, tags, }; const docRef = await addDoc(collection(db, 'notes'), { ...noteData, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); console.log("Personal note saved:", docRef.id); return docRef.id; } catch (error) { console.error('Error saving personal note:', error); throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required."); if (Object.keys(updates).length === 0) { console.warn("updateNote called with empty updates."); return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { console.warn("updateNote resulted in empty object after cleaning undefined fields."); return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); console.log("Note updated:", noteId); } catch (error) { console.error('Error updating note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid update data:', updates); throw new Error(`Firestore rejected update data. Original Error: ${error.message}`); } throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required."); try { await deleteDoc(doc(db, 'notes', noteId)); console.log("Note deleted:", noteId); } catch (error) { console.error('Error deleting note:', error); throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); console.log(`Note ${noteId} public status set to:`, makePublic); } catch (error) { console.error('Error toggling public status:', error); throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

// --- Usage Tracking Functions --- (No changes needed)
export async function getUserNoteUsage(userId: string): Promise<NoteUsageData | null> { if (!userId) throw new Error("User ID is required to fetch note usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `noteCounts_${currentMonthYear}`; if (userData[usageFieldName]) { return { pdfAi: userData[usageFieldName].pdfAi || 0, youtube: userData[usageFieldName].youtube || 0, month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching note usage:', error); throw new Error(`Failed to fetch note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserNoteUsage(userId: string, usage: { pdfAi: number; youtube: number }, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update note usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `noteCounts_${month}`; await setDoc(userRef, { [usageFieldName]: { pdfAi: usage.pdfAi, youtube: usage.youtube } }, { merge: true }); console.log(`Note usage updated for user ${userId} for month ${month}:`, usage); } catch (error) { console.error('Error updating note usage:', error); throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function getUserChatUsage(userId: string): Promise<ChatUsageData | null> { if (!userId) throw new Error("User ID is required to fetch chat usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `chatCount_${currentMonthYear}`; if (typeof userData[usageFieldName] === 'number') { return { count: userData[usageFieldName], month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching chat usage:', error); throw new Error(`Failed to fetch chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserChatUsage(userId: string, count: number, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update chat usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); if (typeof count !== 'number' || count < 0) throw new Error("Invalid chat count."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `chatCount_${month}`; await setDoc(userRef, { [usageFieldName]: count }, { merge: true }); console.log(`Chat usage updated for user ${userId} for month ${month}: ${count}`); } catch (error) { console.error('Error updating chat usage:', error); throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }


// --- AI Processing Functions ---

// --- processTextToAINoteData (No changes needed) ---
export async function processTextToAINoteData( text: string, userId: string, apiKey: string ): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt'>> {
  if (!text.trim()) throw new Error("Input text cannot be empty."); if (!apiKey) throw new Error("Gemini API Key required.");
  const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey);
  let detailedNoteContent = 'AI note generation failed.'; let keyPoints: string[] = ['Generation failed.']; let questions: NoteData['questions'] = undefined;

  try {
    console.log("AI processing text...");
    // 1. Generate Detailed Note
    const detailedNotePrompt = `Analyze the following text. Generate a detailed, structured note using Markdown (headings # ## ###, lists * -, tables, bold **, LaTeX $ $ or $$ $$). Cover main topics thoroughly, aiming for comprehensiveness, not just a summary. Text:\n---\n${text.slice(0, 30000)}\n---\nOutput:\nProvide only the generated Markdown note content below.`;
    const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) };
    const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions); const noteRawText = extractCandidateText(await noteResponse.text());
    detailedNoteContent = noteRawText.trim();
    if (!detailedNoteContent) detailedNoteContent = `Error: AI did not generate note content.\n\nOriginal Text:\n${text.slice(0, 500)}...`;
    else console.log("Detailed note content generated.");

    // 2. Generate Key Points
    const keyPointsPrompt = `Extract exactly 10 distinct key points from the following text. List only the points, one per line. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:" \nText:\n---\n${text.slice(0, 15000)}\n---\nKey Points:\n1. ...`;
    const keyPointsOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }) };
    try { const kpResponse = await fetchWithRetry(currentGeminiEndpoint, keyPointsOptions); const kpText = extractCandidateText(await kpResponse.text()); if (!kpText) { console.warn("KP generation returned empty text."); keyPoints = ['No key points generated.']; } else { const parsed = kpText.split('\n').map(l => l.trim().replace(/^\d+\.\s*/, '')).filter(p => p.length > 5).slice(0, 10); keyPoints = parsed.length > 0 ? parsed : ['No valid key points parsed.']; console.log("Key points generated."); } } catch (kpError) { console.error("KP generation/parsing error:", kpError); keyPoints = [`Key points failed: ${kpError instanceof Error ? kpError.message : 'Unknown'}`]; }

    // 3. Generate Questions
    const questionsPrompt = `Based on the text, generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nGenerate 10.\n\nText:\n---\n${text.slice(0, 15000)}\n---`;
    const questionsOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
    try { const qResponse = await fetchWithRetry(currentGeminiEndpoint, questionsOptions); const qText = extractCandidateText(await qResponse.text()); let parsedQs: NoteData['questions'] = []; if (!qText) { console.warn("Questions generation returned empty text."); } else { const blocks = qText.split(/---DIVIDER---/i); for (const block of blocks) { if (parsedQs.length >= 10) break; const T = block.trim(); if (!T) continue; const qM=T.match(/^Question:\s*([\s\S]*?)\s*A\)/i); const oM=T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is); const cM=T.match(/Correct:\s*([A-D])\b/i); const eM=T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i); if (qM&&oM&&cM&&eM) { const qT=qM[1].trim(); const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim()); const cL=cM[1].toUpperCase(); const eT=eM[1].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) parsedQs.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); else console.warn("Partial Q parse (text)"); } else console.warn("Q structure parse fail (text)"); } if (parsedQs.length > 0) questions = parsedQs; console.log(`Generated ${parsedQs.length} questions (text).`); } } catch (qError) { console.error("Questions generation/parsing error (text):", qError); }

    // 4. Format result
    const processedNoteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'> = { title: text.split('\n')[0].slice(0, 60).trim() || 'AI Note', content: detailedNoteContent, keyPoints: keyPoints, questions: questions, type: 'personal', userId, isPublic: false, tags: ['ai-processed'], };
    console.log("AI processing complete for text."); return processedNoteData;
  } catch (error) {
    console.error('Error during AI text processing pipeline:', error);
    return { title: text.split('\n')[0].slice(0, 60).trim() || 'AI Processing Error', content: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nInput (start):\n${text.slice(0,500)}...`, keyPoints: ["Failed."], type: 'personal', userId, isPublic: false, tags: ['ai-error'] };
  }
}

// --- regenerateStudyQuestions (No changes needed) ---
export async function regenerateStudyQuestions( noteId: string, content: string, apiKey: string ): Promise<NoteData['questions']> {
   if (!noteId || !content.trim()) throw new Error("Note ID/content required for question regeneration."); if (!apiKey) throw new Error("Gemini API Key required for question regeneration.");
   const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey);
   console.log(`Regenerating 10 questions for note: ${noteId}`);
  try {
    const questionsPrompt = `Based on the following note content, generate exactly 10 multiple-choice study questions. Each question MUST have 4 options (labeled A, B, C, D), the correct answer letter, and a brief explanation.\n\n**VERY IMPORTANT:** Format EACH question *strictly* as follows, separated by '---DIVIDER---':\n\nQuestion: [Your question here]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nCorrect: [Correct Answer Letter (A, B, C, or D)]\nExplanation: [Brief explanation why it's correct]\n\n---DIVIDER---\n\nEnsure all 10 questions are generated and precisely follow this structure including the divider.\n\nNote Content (excerpt):\n---\n${content.slice(0, 15000)}\n---`;
    const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
    const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
    const qText = extractCandidateText(await qResponse.text());

    let newQuestions: NoteData['questions'] = [];
    const blocks = qText.split(/---DIVIDER---/i);
    console.log(`Received ${blocks.length -1} potential question blocks for regeneration.`);

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
            } else { console.warn("Partial regen Q parse - Data validation failed:", {qT, oL, cL, eT}); }
        } else { if(T.length > 10) console.warn("Regen Q structure parse fail for block:", T.substring(0, 100) + "..."); }
    }

    if (newQuestions.length === 0) {
        console.error("Failed to parse ANY questions from regeneration response. Raw response was:\n<<< START RAW RESPONSE >>>\n", qText, "\n<<< END RAW RESPONSE >>>");
        throw new Error(`AI response format was unusable for question regeneration.`);
    }

    console.log(`Successfully parsed ${newQuestions.length} regenerated questions for note ${noteId}.`);
    if (newQuestions.length < 10) console.warn(`Warning: Regenerated fewer than 10 questions (${newQuestions.length}).`)

    await updateNote(noteId, { questions: newQuestions });
    console.log("Regenerated questions updated in Firestore.");
    return newQuestions;

  } catch (error) {
    console.error(`Error during question regeneration process for note ${noteId}:`, error);
    throw new Error(`Failed to regenerate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


// --- CORRECTED Image Generation Function ---
/**
 * Generates an image using Imagen 3 via the Gemini API (REST).
 * Adapts request/response based on Python SDK example structure.
 * @param prompt The text description for the image.
 * @param context Optional context (e.g., note snippet). Ignored by Imagen 3 API currently.
 * @param apiKey The Google AI Studio API key.
 * @returns An ImageData object { base64, type, name } or null if generation fails.
 */
export async function generateImageWithImagen(
    prompt: string,
    context: string | null, // Context is likely ignored by this specific API call structure
    apiKey: string
): Promise<ImageData | null> {
    if (!prompt.trim()) throw new Error("Image generation prompt cannot be empty.");
    if (!apiKey) throw new Error("API Key is required for image generation.");

    // Still use the :generateContent endpoint as primary documented REST method
    const endpoint = getApiEndpoint(IMAGEN_3_MODEL, apiKey);

    // *** ADJUSTED PAYLOAD based on Python SDK structure ***
    // We send the core parameters expected by the `generate_images` SDK method.
    // The REST API might accept these top-level or nested. Sending top-level first.
    // Note: The Python SDK might abstract away some details of the REST call.
    // This structure is an *educated guess* for the REST equivalent.
    const payload = {
        // Instead of 'contents', use 'prompt' directly (or nested if API requires)
        "prompt": { // Wrapping prompt in an object, common in APIs
             "text": prompt // Pass only the core prompt here
         },
        // Add config parameters based on Python SDK example
        "number_of_images": 1, // Requesting 1 image
        "aspect_ratio": "1:1", // Defaulting to 1:1, can be made configurable
        // "safety_filter_level": "BLOCK_MEDIUM_AND_ABOVE", // Example
        // "person_generation": "ALLOW_ADULT" // Example
    };
    // If the above structure fails, the next attempt would be:
    // const payload_alt = {
    //    prompt: prompt, // Direct string
    //    config: { number_of_images: 1, aspect_ratio: "1:1"}
    // };
    // Or even back to `contents` if the API requires it but parses differently for Imagen models.

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey, // Key MUST be in header for Imagen models via AI Studio API
        },
        body: JSON.stringify(payload)
    };

    console.log(`Generating image with Imagen 3 (${IMAGEN_3_MODEL})...`);
    // console.log("Request Payload:", JSON.stringify(payload, null, 2)); // Debug

    try {
        const response = await fetchWithRetry(endpoint, options);
        const responseText = await response.text();

        if (!response.ok) {
             let errorMsg = `Imagen API Error (${response.status})`;
             try {
                 const errJson = JSON.parse(responseText);
                 errorMsg = `Imagen API Error: ${errJson?.error?.message || response.statusText}` ;
                 if (errJson?.error?.status) errorMsg += ` (Status: ${errJson.error.status})`;
                 if (errorMsg.includes("API key not valid")) errorMsg = "Error: Invalid API Key for Image Generation.";
             } catch { /* Ignore parsing error */ }
            console.error(errorMsg, "Raw response:", responseText);
            throw new Error(errorMsg);
        }

        const jsonResponse = JSON.parse(responseText);
        // console.log("Imagen Raw Response JSON:", JSON.stringify(jsonResponse, null, 2)); // Debug

        // ** ADJUSTED RESPONSE PARSING based on Python SDK **
        // Look for `generated_images` array first
        if (jsonResponse.generated_images && Array.isArray(jsonResponse.generated_images) && jsonResponse.generated_images.length > 0) {
            const imageInfo = jsonResponse.generated_images[0]; // Get the first generated image info

            // Look for image bytes (assuming base64) and mime type
            // The Python SDK uses `image.image_bytes`, REST might use `image_bytes` or `data` nested under `image`
            const base64Data = imageInfo?.image?.image_bytes || imageInfo?.image?.data; // Adapt based on actual response
            const mimeType = imageInfo?.image?.mime_type || 'image/png'; // Default to PNG if not specified

            if (base64Data) {
                console.log("Image generated successfully (using generated_images structure).");
                const fileExtension = mimeType.split('/')[1] || 'png';
                return {
                    base64: base64Data,
                    type: mimeType,
                    name: `generated-image-${Date.now()}.${fileExtension}`
                };
            }
        }

        // ** Fallback: Check 'candidates' structure (standard Gemini response) **
        // This might occur if Imagen 3 still uses the standard structure via :generateContent
        const candidate = jsonResponse?.candidates?.[0];
        if (candidate) {
            let base64Data: string | null = null;
            let mimeType: string = 'image/png';

            if (candidate.image?.data) { // Direct image data in candidate
                base64Data = candidate.image.data;
                mimeType = 'image/png'; // Assume PNG
            } else if (candidate.content?.parts?.[0]?.inline_data?.data) { // Image data within parts
                const part = candidate.content.parts[0];
                base64Data = part.inline_data.data;
                mimeType = part.inline_data.mime_type || 'image/png';
            }

            if (base64Data) {
                 console.log("Image generated successfully (using candidates structure).");
                 const fileExtension = mimeType.split('/')[1] || 'png';
                 return {
                     base64: base64Data,
                     type: mimeType,
                     name: `generated-image-${Date.now()}.${fileExtension}`
                 };
            }
        }

        // If neither structure yielded image data:
        // Check for safety blocks specifically if no image found
        if (jsonResponse?.promptFeedback?.blockReason) {
             const blockReason = jsonResponse.promptFeedback.blockReason;
             let safetyDetails = "";
             if (jsonResponse.promptFeedback.safetyRatings) { safetyDetails = ` Safety Details: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
             console.warn(`Image generation blocked: ${blockReason}.${safetyDetails}`);
             throw new Error(`Image generation failed due to safety settings: ${blockReason}.`);
         }

        // General failure if no image and no specific block reason found
        const finishReason = candidate?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            throw new Error(`Image generation stopped unexpectedly. Reason: ${finishReason}`);
        } else {
            console.error("Image generation response OK, but no usable image data found in known structures.", jsonResponse);
            throw new Error("Image generation succeeded according to API, but no image data was found in the response.");
        }

    } catch (error) {
        console.error('Error during image generation call/parsing:', error);
        throw error; // Re-throw the error
    }
}
