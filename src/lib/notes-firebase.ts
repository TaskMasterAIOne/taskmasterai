
// src/lib/notes-firebase.ts
import { addDoc, collection, Timestamp, updateDoc, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { geminiApiKey } from './dashboard-firebase'; // Use the shared API key config

// --- Tier Definitions ---
export const PREMIUM_EMAILS = ["robinmyh@gmail.com", "oliverbeckett069420@gmail.com", "bajinsrinivasr@lexington1.net"];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

// --- Usage Limits ---
export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;

// Types
export interface ImageData { base64: string; type: string; name: string; }
export interface Flashcard { front: string; back: string; } // Added Flashcard type
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
    flashcards?: Flashcard[]; // Added Flashcards
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
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash'; // Prefer Flash 2.0 as default text model
const IMAGEN_3_MODEL = 'imagen-3.0-generate-002';
const GOOGLE_AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Updated function to get correct endpoint structure
const getApiEndpoint = (modelName: string, apiKey: string | undefined, isImageGen: boolean = false) => {
    if (!apiKey) throw new Error("API Key is missing.");
    const action = isImageGen ? ':generateContent' : ':generateContent'; // Keeping :generateContent for now based on Gemini API docs
    const keyParam = isImageGen ? '' : `?key=${apiKey}`; // Key in header for Imagen, in query for Gemini Text
    return `${GOOGLE_AI_STUDIO_BASE}${modelName}${action}${keyParam}`;
};

// --- Tier Determination Function ---
export const getUserTier = (email: string | null | undefined): UserTier => {
    if (!email) return 'basic';
    if (PREMIUM_EMAILS.includes(email)) return 'premium';
    if (PRO_EMAILS.includes(email)) return 'pro';
    return 'basic';
};


// --- Firestore Operations (with API key checks from OLD version) ---
export async function getNoteById(noteId: string): Promise<NoteData | null> { if (!noteId) throw new Error("Note ID is required."); try { const noteRef = doc(db, 'notes', noteId); const docSnap = await getDoc(noteRef); return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as NoteData : null; } catch (error) { console.error('Error fetching note by ID:', error); throw new Error(`Failed to fetch note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function saveNote(userId: string, noteData: Omit<NoteData, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> { try { const dataToSave = removeUndefinedFields(noteData); if (!dataToSave.title || !dataToSave.type) { console.error("Missing required fields:", dataToSave); throw new Error("Cannot save note: Missing required fields (title, type)."); } const docRef = await addDoc(collection(db, 'notes'), { ...dataToSave, userId: userId, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); console.log("Note saved:", docRef.id); // Return the full note object after creation
        const newDocSnap = await getDoc(docRef);
        if (!newDocSnap.exists()) throw new Error("Failed to fetch newly created note.");
        return { id: newDocSnap.id, ...newDocSnap.data() } as NoteData;
    } catch (error) { console.error('Error saving note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid data details:', noteData); throw new Error(`Firestore rejected data. Original Error: ${error.message}`); } throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function savePersonalNote(userId: string, title: string, content: string, tags: string[] = []): Promise<NoteData> { // Return NoteData
    try {
        const noteData: Omit<NoteData, 'id'|'createdAt'|'updatedAt'|'keyPoints'|'questions'|'sourceUrl'|'userId'|'flashcards'> = {
            title: title.trim() || 'Untitled',
            content: content.trim(),
            type: 'personal',
            isPublic: false,
            tags,
        };
        const docRef = await addDoc(collection(db, 'notes'), {
            ...noteData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        console.log("Personal note saved:", docRef.id);
        const newDocSnap = await getDoc(docRef);
        if (!newDocSnap.exists()) throw new Error("Failed to fetch newly created personal note.");
        return { id: newDocSnap.id, ...newDocSnap.data() } as NoteData;
    } catch (error) { console.error('Error saving personal note:', error); throw new Error(`Failed to save personal note: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateNote(noteId: string, updates: Partial<Omit<NoteData, 'id'|'userId'|'createdAt'|'type'>>) { if (!noteId) throw new Error("Note ID required."); if (Object.keys(updates).length === 0) { console.warn("updateNote called with empty updates."); return; } try { const dataToUpdate = removeUndefinedFields(updates); if (Object.keys(dataToUpdate).length === 0) { console.warn("updateNote resulted in empty object after cleaning undefined fields."); return; } await updateDoc(doc(db, 'notes', noteId), { ...dataToUpdate, updatedAt: Timestamp.now() }); console.log("Note updated:", noteId); } catch (error) { console.error('Error updating note:', error); if (error instanceof Error && error.message.includes('invalid data')) { console.error('Invalid update data:', updates); throw new Error(`Firestore rejected update data. Original Error: ${error.message}`); } throw new Error(`Failed to update note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function deleteNote(noteId: string) { if (!noteId) throw new Error("Note ID required."); try { await deleteDoc(doc(db, 'notes', noteId)); console.log("Note deleted:", noteId); } catch (error) { console.error('Error deleting note:', error); throw new Error(`Failed to delete note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function toggleNotePublicStatus(noteId: string, makePublic: boolean) { if (!noteId) throw new Error("Note ID required."); try { await updateDoc(doc(db, 'notes', noteId), { isPublic: makePublic, updatedAt: Timestamp.now() }); console.log(`Note ${noteId} public status set to:`, makePublic); } catch (error) { console.error('Error toggling public status:', error); throw new Error(`Failed to toggle public status for note ${noteId}: ${error instanceof Error ? error.message : 'Unknown error'}`); } }

// --- Usage Tracking Functions ---
export async function getUserNoteUsage(userId: string): Promise<NoteUsageData | null> { if (!userId) throw new Error("User ID is required to fetch note usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `noteCounts_${currentMonthYear}`; if (userData[usageFieldName]) { return { pdfAi: userData[usageFieldName].pdfAi || 0, youtube: userData[usageFieldName].youtube || 0, month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching note usage:', error); throw new Error(`Failed to fetch note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserNoteUsage(userId: string, usage: { pdfAi: number; youtube: number }, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update note usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `noteCounts_${month}`; await setDoc(userRef, { [usageFieldName]: { pdfAi: usage.pdfAi, youtube: usage.youtube } }, { merge: true }); console.log(`Note usage updated for user ${userId} for month ${month}:`, usage); } catch (error) { console.error('Error updating note usage:', error); throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function getUserChatUsage(userId: string): Promise<ChatUsageData | null> { if (!userId) throw new Error("User ID is required to fetch chat usage."); try { const userRef = doc(db, 'users', userId); const docSnap = await getDoc(userRef); if (docSnap.exists()) { const userData = docSnap.data(); const currentMonthYear = new Date().toISOString().slice(0, 7); const usageFieldName = `chatCount_${currentMonthYear}`; if (typeof userData[usageFieldName] === 'number') { return { count: userData[usageFieldName], month: currentMonthYear }; } } return null; } catch (error) { console.error('Error fetching chat usage:', error); throw new Error(`Failed to fetch chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }
export async function updateUserChatUsage(userId: string, count: number, month: string): Promise<void> { if (!userId) throw new Error("User ID is required to update chat usage."); if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format (YYYY-MM) required."); if (typeof count !== 'number' || count < 0) throw new Error("Invalid chat count."); try { const userRef = doc(db, 'users', userId); const usageFieldName = `chatCount_${month}`; await setDoc(userRef, { [usageFieldName]: count }, { merge: true }); console.log(`Chat usage updated for user ${userId} for month ${month}: ${count}`); } catch (error) { console.error('Error updating chat usage:', error); throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`); } }


// --- AI Processing Functions ---

// --- processTextToAINoteData (Merged Logic) ---
export async function processTextToAINoteData(
    text: string,
    apiKey: string, // Pass API key explicitly
    isSourceUrl: boolean = false // Optional flag for source type hint
): Promise<Omit<NoteData, 'id' | 'createdAt' | 'updatedAt' | 'userId'>> { // Return type excludes userId too
    if (!text.trim()) throw new Error("Input text cannot be empty.");
    if (!apiKey) throw new Error("Gemini API Key required.");

    const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey, false);
    let title = (isSourceUrl ? "AI Processed Document" : text.split('\n')[0].slice(0, 60).trim()) || 'AI Note';
    let detailedNoteContent = 'AI processing is currently unavailable or failed.';
    let keyPoints: string[] = [];
    let questions: NoteData['questions'] = [];
    let flashcards: NoteData['flashcards'] = [];

    try {
        console.log("AI processing text input...");

        // Combined prompt for multiple outputs (more efficient)
        const combinedPrompt = `
Analyze the following text${isSourceUrl ? " (from a document/URL)" : ""}.
Generate the following structured outputs using Markdown where appropriate:

1.  **Detailed Note:** Create a comprehensive, well-structured note covering the main topics. Use Markdown formatting (headings, lists, bold, etc.). Be thorough.
2.  **Key Points:** Extract exactly 10 distinct and significant key points. List only the points, one per line, starting each line with '* '.
3.  **Study Questions:** Generate exactly 10 multiple-choice questions (MCQs). Each MCQ must have 4 options (A, B, C, D), the correct letter, and a brief explanation. Format strictly as:
    Question: [Q]
    A) [A]
    B) [B]
    C) [C]
    D) [D]
    Correct: [Letter]
    Explanation: [E]
4.  **Flashcards:** Generate 10-15 flashcards covering key terms, concepts, or Q&A pairs. Format strictly as:
    Front: [Front Text]
    Back: [Back Text]

Separate each numbered section (Detailed Note, Key Points, Study Questions, Flashcards) clearly using '---SECTION_BREAK---'.

Text:
---
${text.slice(0, 30000)}
---

Output:
Provide only the generated content below, following the specified structure and separation.
---SECTION_BREAK---
[Detailed Note Content Here]
---SECTION_BREAK---
[Key Points List Here]
---SECTION_BREAK---
[Study Questions Here, separated by newlines]
---SECTION_BREAK---
[Flashcards Here, separated by newlines]
`;

        const combinedOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinedPrompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } // Increased max tokens
            })
        };

        const combinedResponse = await fetchWithRetry(currentGeminiEndpoint, combinedOptions);
        const rawCombinedText = await combinedResponse.text(); // Get raw text first
        const combinedText = extractCandidateText(rawCombinedText); // Parse out candidate text, throws on error

        if (!combinedText) {
            throw new Error("AI processing returned empty content.");
        }

        console.log("AI processing response received, parsing sections...");
        const sections = combinedText.split(/---SECTION_BREAK---/i);

        // --- Parse Sections ---
        // Detailed Note (Section 1, index 1 after first split)
        if (sections.length > 1 && sections[1]) {
            detailedNoteContent = sections[1].trim();
            if (detailedNoteContent) console.log("Parsed Detailed Note.");
            else console.warn("Detailed Note section was empty.");
        } else { console.warn("Detailed Note section not found."); }

        // Key Points (Section 2, index 2)
        if (sections.length > 2 && sections[2]) {
            keyPoints = sections[2]
                .split('\n')
                .map(l => l.trim().replace(/^[\*\-]\s*/, '')) // Remove list markers
                .filter(p => p.length > 5)
                .slice(0, 10);
            if (keyPoints.length > 0) console.log(`Parsed ${keyPoints.length} Key Points.`);
            else console.warn("Key Points section parsing yielded no points.");
        } else { console.warn("Key Points section not found."); }

        // Study Questions (Section 3, index 3)
        if (sections.length > 3 && sections[3]) {
            const questionBlock = sections[3].trim();
            const questionRegex = /Question:\s*([\s\S]*?)\s*A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:\s*([A-D])\s*Explanation:\s*([\s\S]*?)(?=\nQuestion:|\n*$)/gi;
            let match;
            while ((match = questionRegex.exec(questionBlock)) !== null && questions.length < 10) {
                const qT = match[1].trim();
                const oL = [match[2], match[3], match[4], match[5]].map(o => o.trim());
                const cL = match[6].toUpperCase();
                const eT = match[7].trim();
                if (qT && oL.length === 4 && oL.every(o => o) && ['A', 'B', 'C', 'D'].includes(cL) && eT) {
                    questions.push({ question: qT, options: oL, correctAnswer: ['A', 'B', 'C', 'D'].indexOf(cL), explanation: eT });
                } else { console.warn("Partial question parse in combined response."); }
            }
            if (questions.length > 0) console.log(`Parsed ${questions.length} Study Questions.`);
            else console.warn("Study Questions section parsing yielded no questions.");
        } else { console.warn("Study Questions section not found."); }

         // Flashcards (Section 4, index 4)
         if (sections.length > 4 && sections[4]) {
            const flashcardBlock = sections[4].trim();
            const flashcardRegex = /Front:\s*([\s\S]*?)\s*Back:\s*([\s\S]*?)(?=\nFront:|\n*$)/gi;
            let fcMatch;
            while ((fcMatch = flashcardRegex.exec(flashcardBlock)) !== null && flashcards.length < 15) {
                 const front = fcMatch[1].trim();
                 const back = fcMatch[2].trim();
                 if (front && back) {
                     flashcards.push({ front, back });
                 } else { console.warn("Partial flashcard parse in combined response."); }
            }
             if (flashcards.length > 0) console.log(`Parsed ${flashcards.length} Flashcards.`);
             else console.warn("Flashcards section parsing yielded no flashcards.");
         } else { console.warn("Flashcards section not found."); }

        // Update title if the content looks valid and isn't just the error message
        if (detailedNoteContent && !detailedNoteContent.startsWith('AI processing')) {
            // Try to extract a better title from the generated note content
             const headingMatch = detailedNoteContent.match(/^#\s+(.*)/);
             if (headingMatch && headingMatch[1]) {
                 title = headingMatch[1].trim().slice(0, 100);
             }
        }


        console.log("AI processing parse complete.");
        return {
            title,
            content: detailedNoteContent || "Processing Error: Content generation failed.", // Fallback content
            keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
            questions: questions.length > 0 ? questions : undefined,
            flashcards: flashcards.length > 0 ? flashcards: undefined,
            type: 'personal', // Default to personal, specific types (pdf, youtube) set by caller
            isPublic: false,
            tags: ['ai-processed'], // Add relevant tags
            // sourceUrl will be added by caller if applicable
        };

    } catch (error) {
        console.error('Error during combined AI processing pipeline:', error);
        return {
            title: title || 'AI Processing Error',
            content: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nInput (start):\n${text.slice(0, 500)}...`,
            keyPoints: undefined, // Explicitly undefined on error
            questions: undefined,
            flashcards: undefined,
            type: 'personal',
            isPublic: false,
            tags: ['ai-error'],
        };
    }
}

// --- regenerateStudyQuestions (Using OLD Stable Parsing Logic) ---
export async function regenerateStudyQuestions(
    noteId: string,
    content: string,
    apiKey: string
): Promise<NoteData['questions']> {
    if (!noteId || !content.trim()) throw new Error("Note ID and content are required for question regeneration.");
    if (!apiKey) throw new Error("Gemini API Key is required for question regeneration.");

    const currentGeminiEndpoint = getApiEndpoint(GEMINI_TEXT_MODEL, apiKey, false);
    console.log(`Regenerating 10 questions for note: ${noteId}`);

    try {
        const questionsPrompt = `Based on the following note content, generate exactly 10 multiple-choice study questions. Each question MUST have 4 options (labeled A, B, C, D), the correct answer letter, and a brief explanation.\n\n**VERY IMPORTANT:** Format EACH question *strictly* as follows, separated by '---DIVIDER---':\n\nQuestion: [Your question here]\nA) [Option A]\nB) [Option B]\nC) [Option C]\nD) [Option D]\nCorrect: [Correct Answer Letter (A, B, C, or D)]\nExplanation: [Brief explanation why it's correct]\n\n---DIVIDER---\n\nEnsure all 10 questions are generated and precisely follow this structure including the divider.\n\nNote Content (excerpt):\n---\n${content.slice(0, 15000)}\n---`;

        const qOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: questionsPrompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 3000 }
            })
        };
        const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
        const qRawText = await qResponse.text(); // Get raw text first
        const qText = extractCandidateText(qRawText); // Parse candidate text, throws on parsing/API error

        if (!qText) {
            throw new Error("AI response for question regeneration was empty.");
        }

        let newQuestions: NoteData['questions'] = [];
        const blocks = qText.split(/---DIVIDER---/i);
        console.log(`Received ${blocks.length - 1} potential question blocks for regeneration.`);

        for (const block of blocks) {
            if (newQuestions.length >= 10) break;
            const T = block.trim(); if (!T) continue;

            const qM = T.match(/^Question:\s*([\s\S]*?)\s*A\)/i);
            const oM = T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is);
            const cM = T.match(/Correct:\s*([A-D])\b/i);
            const eM = T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i);

            if (qM && oM && cM && eM) {
                const qT = qM[1].trim();
                const oL = [oM[1], oM[2], oM[3], oM[4]].map(o => o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is, '$1').trim());
                const cL = cM[1].toUpperCase();
                const eT = eM[1].trim();

                if (qT && oL.length === 4 && oL.every(o => o) && ['A', 'B', 'C', 'D'].includes(cL) && eT) {
                    newQuestions.push({ question: qT, options: oL, correctAnswer: ['A', 'B', 'C', 'D'].indexOf(cL), explanation: eT });
                } else {
                    console.warn("Partial regen Q parse - Data validation failed:", { qT, oL, cL, eT });
                }
            } else {
                if (T.length > 10) console.warn("Regen Q structure parse fail for block:", T.substring(0, 100) + "...");
            }
        }

        if (newQuestions.length === 0) {
            console.error("Failed to parse ANY questions from regeneration response. Raw response was:\n<<< START RAW RESPONSE >>>\n", qRawText, "\n<<< END RAW RESPONSE >>>");
            throw new Error(`AI response format was unusable for question regeneration.`);
        }

        console.log(`Successfully parsed ${newQuestions.length} regenerated questions for note ${noteId}.`);
        if (newQuestions.length < 10) console.warn(`Warning: Regenerated fewer than 10 questions (${newQuestions.length}).`);

        // Update Firestore - moved outside the parsing loop, happens only if parsing succeeds
        // await updateNote(noteId, { questions: newQuestions }); // Note: updateNote defined above handles updatedAt
        // console.log("Regenerated questions updated in Firestore.");

        return newQuestions; // Return the successfully parsed questions

    } catch (error) {
        console.error(`Error during question regeneration process for note ${noteId}:`, error);
        // Re-throw the error so the UI catch block can display feedback
        throw new Error(`Failed to regenerate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


// --- CORRECTED Image Generation Function (From NEW version - seems mostly okay) ---
export async function generateImageWithImagen(
    prompt: string,
    context: string | null, // Context is likely ignored by this specific API call structure
    apiKey: string
): Promise<ImageData | null> {
    if (!prompt.trim()) throw new Error("Image generation prompt cannot be empty.");
    if (!apiKey) throw new Error("API Key is required for image generation.");

    const endpoint = getApiEndpoint(IMAGEN_3_MODEL, apiKey, true); // Mark as image gen call

    const payload = {
        "prompt": { "text": prompt },
        "number_of_images": 1,
        "aspect_ratio": "1:1", // Or make configurable
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey, // Key MUST be in header for Imagen
        },
        body: JSON.stringify(payload)
    };

    console.log(`Generating image with Imagen 3 (${IMAGEN_3_MODEL})...`);

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

        // Try parsing using 'generated_images' structure first (seems more likely for Imagen)
        if (jsonResponse.generated_images && Array.isArray(jsonResponse.generated_images) && jsonResponse.generated_images.length > 0) {
            const imageInfo = jsonResponse.generated_images[0];
            // Adapt based on actual API response structure if needed
            const base64Data = imageInfo?.image?.image_bytes || imageInfo?.image?.data || imageInfo?.b64_json;
            const mimeType = imageInfo?.image?.mime_type || 'image/png';

            if (base64Data) {
                console.log("Image generated successfully (parsed 'generated_images').");
                const fileExtension = mimeType.split('/')[1] || 'png';
                return {
                    base64: base64Data,
                    type: mimeType,
                    name: `generated-image-${Date.now()}.${fileExtension}`
                };
            }
        }

        // Fallback: Check standard 'candidates' structure
        const candidate = jsonResponse?.candidates?.[0];
        if (candidate) {
            let base64Data: string | null = null;
            let mimeType: string = 'image/png';
            // Check multiple possible locations within candidate
            if (candidate.content?.parts?.[0]?.inline_data?.data) {
                 const part = candidate.content.parts[0];
                 base64Data = part.inline_data.data;
                 mimeType = part.inline_data.mime_type || 'image/png';
            } else if (candidate.image?.data) { // Less likely but possible
                base64Data = candidate.image.data;
            } // Add other potential paths if API structure differs

            if (base64Data) {
                 console.log("Image generated successfully (parsed 'candidates').");
                 const fileExtension = mimeType.split('/')[1] || 'png';
                 return {
                     base64: base64Data,
                     type: mimeType,
                     name: `generated-image-${Date.now()}.${fileExtension}`
                 };
            }
        }

        // Handle blocking/errors if no image found
        if (jsonResponse?.promptFeedback?.blockReason) {
             const blockReason = jsonResponse.promptFeedback.blockReason;
             let safetyDetails = jsonResponse.promptFeedback.safetyRatings ? ` Safety Details: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}` : "";
             console.warn(`Image generation blocked: ${blockReason}.${safetyDetails}`);
             throw new Error(`Image generation failed due to safety settings: ${blockReason}.`);
         }
        const finishReason = candidate?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            throw new Error(`Image generation stopped unexpectedly. Reason: ${finishReason}`);
        }

        console.error("Image generation response OK, but no usable image data found.", jsonResponse);
        throw new Error("Image generation succeeded according to API, but no image data was found in the response.");

    } catch (error) {
        console.error('Error during image generation call/parsing:', error);
        throw error; // Re-throw for the UI to handle
    }
}
