import { getDocument, PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

interface ProcessingProgress {
    progress: number;
    status: string;
    error: string | null;
}
export interface ProcessedPDF {
    title: string;
    content: string;
    keyPoints: string[];
    questions: {
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
    }[];
    sourceUrl: string;
    extractedText?: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                await sleep(delayMs * (attempt + 1));
                continue;
            }
            return response;
        } catch (error) {
            if (attempt === retries - 1) throw error;
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw new Error(`Max retries reached for URL: ${url}`);
}

const extractCandidateText = (responseText: string): string => {
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.error?.message) {
            return `Error: ${jsonResponse.error.message}`;
        }
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = jsonResponse.candidates[0].content.parts[0].text;
            const finishReason = jsonResponse.candidates[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                if (finishReason === 'MAX_TOKENS') return text + "\n\n[Error: Output truncated due to maximum token limit]";
                if (finishReason === 'SAFETY') return text + "\n\n[Error: Output stopped due to safety settings]";
                return text + `\n\n[Warning: Generation finished due to ${finishReason}]`;
            }
            return text;
        }
        if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') {
             if (jsonResponse.candidates[0].finishReason === 'MAX_TOKENS') return `[Error: Output truncated due to maximum token limit (no text returned)]`;
             if (jsonResponse.candidates[0].finishReason === 'SAFETY') return `[Error: Output stopped due to safety settings (no text returned)]`;
            return `Error: Generation stopped (${jsonResponse.candidates[0].finishReason}, no text)`;
        }
        return "Error: No text found in the expected structure.";
    } catch (err) {
        if (responseText.toLowerCase().includes("api key not valid")) return "Error: Invalid API Key.";
        return "Error: Could not parse the AI response.";
    }
};

export async function processPDF(
    file: File,
    userId: string,
    geminiApiKeyParam: string,
    onProgress: (progress: ProcessingProgress) => void
): Promise<ProcessedPDF> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};

    if (!geminiApiKeyParam || typeof geminiApiKeyParam !== 'string' || geminiApiKeyParam.trim() === '') {
        safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing or invalid.' });
        throw new Error('Gemini API Key missing or invalid in processPDF.');
    }

    const GEMINI_MODEL = 'gemini-2.0-flash';
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKeyParam}`;
    let extractedTextFromPdf = '';

    try {
        safeProgress({ progress: 0, status: 'Starting PDF processing...', error: null });
        const fileId = uuidv4();
        const fileRef = ref(storage, `pdfs/${userId}/${fileId}-${file.name}`);
        await uploadBytes(fileRef, file);
        const pdfUrl = await getDownloadURL(fileRef);
        safeProgress({ progress: 10, status: 'PDF uploaded, loading document...', error: null });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        safeProgress({ progress: 15, status: 'Extracting text (method 1)...', error: null });

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const content = await page.getTextContent();
                extractedTextFromPdf += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n';
            } catch (e) {
                extractedTextFromPdf += `[Text extraction failed on page ${pageNum}]\n\n`;
            }
             safeProgress({
                progress: 15 + Math.round((pageNum / numPages) * 25),
                status: `Extracting text: Page ${pageNum}/${numPages}`,
                error: null
            });
        }
        extractedTextFromPdf = extractedTextFromPdf.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const MIN_CHARS_THRESHOLD = 50 * numPages;
        if (extractedTextFromPdf.length < MIN_CHARS_THRESHOLD && numPages > 0) {
            safeProgress({ progress: 40, status: 'Low text quality, attempting OCR...', error: null });
            let ocrText = '';
            const worker = await createWorker('eng');
            try {
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context) {
                        ocrText += `[OCR failed: Canvas context unavailable page ${pageNum}]\n\n`;
                        continue;
                    }
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                    const { data: { text } } = await worker.recognize(canvas);
                    ocrText += text + '\n\n';
                    safeProgress({
                        progress: 40 + Math.round((pageNum / numPages) * 20),
                        status: `Performing OCR: Page ${pageNum}/${numPages}`,
                        error: null
                    });
                     canvas.width = 0; canvas.height = 0;
                }
                extractedTextFromPdf = ocrText.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
                safeProgress({ progress: 60, status: 'OCR complete.', error: null });
            } catch (ocrError) {
                safeProgress({
                    progress: 60,
                    status: 'OCR failed. Using initially extracted text.',
                    error: `OCR Error: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`
                });
            } finally {
                await worker.terminate();
            }
        } else {
            safeProgress({ progress: 60, status: 'Text extraction complete.', error: null });
        }

        if (!extractedTextFromPdf || extractedTextFromPdf.length < 20) {
            const finalErrorMsg = 'No usable text could be extracted from the PDF.';
            safeProgress({ progress: 100, status: 'Error', error: finalErrorMsg });
            throw new Error(finalErrorMsg);
        }

        safeProgress({ progress: 60, status: 'Generating comprehensive study notes...', error: null });
        const noteInputText = extractedTextFromPdf;

        const detailedNotePrompt = `**Objective:** Create comprehensive, detailed, and well-structured study notes in Markdown format based on the provided text from "${file.name}". These notes are intended for a student learning the subject matter covered in the document.
**Core Task:** Do not just summarize. Synthesize the information, explain concepts clearly, elaborate on key points, and structure the content logically for learning and revision. Use the provided text as the primary source of truth, but leverage your understanding of the topic to enhance clarity, add context where appropriate (without contradicting the text), and organize the material effectively for studying. Avoid simply stating "The text says...". Instead, present the information directly.
**Mandatory Instructions:**
1.  **Study Focus:** Ensure the notes are pedagogically valuable. Explain concepts, define key terms clearly, connect related ideas (even if presented separately in the text), and highlight important facts, principles, or processes.
2.  **Comprehensiveness & Depth:** Cover ALL significant topics, sub-topics, arguments, data, and examples present in the text. Go into substantial detail. Aim for lengthy and exhaustive notes that capture the nuances of the source material.
3.  **Structure & Formatting:** Utilize Markdown extensively and strategically: Headings (#, ##, ###), Lists (*, -, +, 1., 2.), Emphasis (**bold**, *italics*, \`\`\`inline code\`\`\`), Tables, Code Blocks (\`\`\`), Blockquotes (>), Describe visuals.
4.  **Output Requirements:** Generate **only** the raw Markdown note content. **NO** introductory or concluding phrases. Start *immediately* with the first Markdown element.
**Source Text Content:**\n---\n${noteInputText}\n---\n**Generated Comprehensive Study Notes (Markdown Format):**`;
        let detailedNoteContent = 'Error: AI detailed study note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 8192 } }) };
            const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) {
                 detailedNoteContent = noteRawText;
                 safeProgress({ progress: 75, status: 'Note generation failed.', error: noteRawText });
            } else if (noteRawText.trim().length < 100) {
                 const shortNoteError = "AI generated unexpectedly short study notes.";
                 detailedNoteContent = noteRawText.trim() + `\n\n[Warning: ${shortNoteError}]`;
                 safeProgress({ progress: 75, status: 'Note generation resulted in short content.', error: shortNoteError });
            } else {
                 detailedNoteContent = noteRawText.trim();
                 safeProgress({ progress: 75, status: 'Comprehensive study notes generated.', error: null });
            }
        } catch (noteError) {
            const errorMsg = noteError instanceof Error ? noteError.message : 'Unknown note generation error';
            detailedNoteContent = `Error: Detailed study note generation failed. Reason: ${errorMsg}`;
            safeProgress({ progress: 75, status: 'Detailed note generation failed.', error: errorMsg });
        }

        safeProgress({ progress: 75, status: 'Generating key points...', error: null });
        const keyPointsInputText = extractedTextFromPdf;
        const keyPointsPrompt = `From the text (from PDF "${file.name}"), list up to 10 distinct and significant key points. Output ONLY the key points, each starting with '* '. No intro/conclusion. Text:\n---\n${keyPointsInputText}\n---\nKey Points (max 10):\n* `;
        let keyPoints: string[] = ['Error: Key points generation failed.'];
        try {
            const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1500 } }) };
            const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
            const kpText = extractCandidateText(await kpResponse.text());
            if (kpText.startsWith("Error:")) { keyPoints = [`Error: Key points failed (${kpText})`]; }
            else { const parsed = kpText.split('\n').map(l => l.trim().match(/^(\*|-|\d+\.)\s*(.+)/)).filter(match => match && match[2] && match[2].trim().length > 5).map(match => match![2].trim()); keyPoints = parsed.length > 0 ? parsed.slice(0, 10) : ['Error: Could not parse key points.']; }
            safeProgress({ progress: 85, status: `Key points generated (${keyPoints.length}).`, error: keyPoints[0].startsWith("Error:") ? keyPoints[0] : null });
        } catch (kpError) { const errorMsg = kpError instanceof Error ? kpError.message : 'Unknown key points error'; keyPoints = [`Error: Key points failed (${errorMsg})`]; safeProgress({ progress: 85, status: 'Key points generation failed.', error: errorMsg }); }

        safeProgress({ progress: 85, status: 'Generating study questions...', error: null });
        const questionsInputText = extractedTextFromPdf;
        const questionsPrompt = `**Objective:** Generate **exactly 10 multiple-choice questions (MCQs)** for studying the provided text from "${file.name}".
**Mandatory Instructions:**
1.  **Study Relevance:** Questions MUST focus on the *actual subject matter*. **AVOID** questions *about* the document.
2.  **Text-Grounded:** Correct answer and premise MUST be derivable from the text.
3.  **Quantity & Scope:** Generate **exactly 10** distinct MCQs.
4.  **Strict Formatting:** Adhere **unfailingly** to:
    Question: [Question]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Correct: [Letter (A-D)]
    Explanation: [Explanation]
    ---DIVIDER---
**Source Text:**\n---\n${questionsInputText}\n---\n(Context Only Key Points: ${keyPoints.join('; ')})\n**Generated Study Questions:**\n---DIVIDER---`;
        let questions: ProcessedPDF['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 4096 } }) };
            const qResponse = await fetchWithRetry(GEMINI_ENDPOINT, qOptions);
            const qRawText = extractCandidateText(await qResponse.text());
            if (qRawText.startsWith("Error:")) { throw new Error(`Question Generation Failed: ${qRawText}`); }

            const questionBlocks = qRawText.split(/---DIVIDER---/i);
            for (const block of questionBlocks) {
                if (questions.length >= 10) break;
                const trimmedBlock = block.trim(); if (trimmedBlock.length < 50) continue;
                const qM = trimmedBlock.match(/^Question:\s*([\s\S]*?)\s*\nA\)\s/i);
                const oM = trimmedBlock.match(/\nA\)\s*([\s\S]*?)\s*\nB\)\s*([\s\S]*?)\s*\nC\)\s*([\s\S]*?)\s*\nD\)\s*([\s\S]*?)\s*\nCorrect:/is);
                const cM = trimmedBlock.match(/\nCorrect:\s*([A-D])\s*\nExplanation:/i);
                const eM = trimmedBlock.match(/\nExplanation:\s*([\s\S]*)$/i);
                if (qM?.[1] && oM && cM?.[1] && eM?.[1]) {
                    const qT = qM[1].trim(); const oL = [oM[1], oM[2], oM[3], oM[4]].map(opt => opt.trim()); const cL = cM[1].toUpperCase() as ('A'|'B'|'C'|'D'); const eT = eM[1].trim();
                    if (qT.length > 10 && oL.every(o => o) && ['A','B','C','D'].includes(cL) && eT.length > 10) {
                        questions.push({ question: qT, options: oL, correctAnswer: ['A','B','C','D'].indexOf(cL), explanation: eT });
                    }
                }
            }
            if (questions.length === 0) { throw new Error("No valid study questions parsed."); }
            safeProgress({ progress: 95, status: `Generated ${questions.length} study questions.`, error: questions.length < 10 ? `Generated only ${questions.length}/10 questions.` : null });
        } catch (qError) {
            const errorMsg = qError instanceof Error ? qError.message : 'Unknown questions error';
            safeProgress({ progress: 95, status: 'Study questions failed.', error: errorMsg });
            if (questions.length === 0) questions = [{ question: 'Study questions failed.', options:['Ok','Error','N/A','N/A'], correctAnswer:1, explanation: `Reason: ${errorMsg}` }];
        }

        safeProgress({ progress: 98, status: 'Finalizing results...', error: null });
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            content: detailedNoteContent,
            keyPoints,
            questions,
            sourceUrl: pdfUrl,
            extractedText: extractedTextFromPdf,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        safeProgress({ progress: 100, status: 'Processing Failed', error: errorMessage });
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            content: `Error: Processing failed. ${errorMessage}`,
            keyPoints: ['Processing failed.'],
            questions: [],
            sourceUrl: '',
            extractedText: extractedTextFromPdf || `Processing failed, no text extracted. Error: ${errorMessage}`,
        };
    }
}
```

**`youtube-processor.ts` (Cleaned - Ensure YOUTUBE_API_KEY is set correctly)**
```typescript
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

interface ProcessingProgress { progress: number; status: string; error: string | null; }

export interface ProcessedYouTube { // Exported for Notes.tsx
    title: string;
    content: string;
    keyPoints: string[];
    questions: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    sourceUrl: string;
}

const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE'; // IMPORTANT: Replace this or load securely

function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try { const response = await fetch(url, options); if (!response.ok && (response.status === 429 || response.status >= 500)) { await sleep(delayMs * (attempt + 1)); continue; } return response; }
        catch (error) { if (attempt === retries - 1) throw error; await sleep(delayMs * (attempt + 1)); }
    } throw new Error(`Max retries reached: ${url}`);
}
const extractCandidateText = (responseText: string): string => {
    try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.candidates?.[0]?.finishReason !== 'STOP') { return `Error: Generation stopped (${jsonResponse?.candidates?.[0]?.finishReason})`; } return "Error: No text found."; }
    catch (err) { return "Error: Cannot parse AI response."; }
};

function getVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; const match = url.match(regex); return match ? match[1] : null;
}

export async function processYouTube(
    url: string,
    userId: string, // Added userId, though not directly used in this simplified version
    geminiApiKey: string,
    onProgress: (progressState: { progress: number; status: string; error: string | null; }) => void // Corrected type
): Promise<ProcessedYouTube> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const currentGeminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    if (!geminiApiKey || typeof geminiApiKey !== 'string' || geminiApiKey.trim() === '') {
        safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing or invalid.' });
        throw new Error('Gemini API Key missing or invalid.');
    }
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        safeProgress({ progress: 0, status: 'Error', error: 'YouTube API Key missing/invalid.' });
        throw new Error('YouTube API Key missing/invalid.');
    }

    let transcriptText = '';

    try {
        safeProgress({ progress: 0, status: 'Starting YouTube processing...', error: null });
        const videoId = getVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL.');
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        safeProgress({ progress: 10, status: 'Fetching video metadata...', error: null });
        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const videoResponse = await fetchWithRetry(videoDetailsUrl, {});
        if (!videoResponse.ok) { const errorText = await videoResponse.text(); throw new Error(`Failed to fetch video details (${videoResponse.status}). Error: ${errorText}`); }
        const videoData = await videoResponse.json();
        if (!videoData.items?.[0]?.snippet) { throw new Error('Video metadata not found.'); }
        const videoInfo = videoData.items[0].snippet;
        const videoTitle = videoInfo.title || 'Untitled Video';

        safeProgress({ progress: 25, status: 'Fetching transcript/description...', error: null });
        transcriptText = videoInfo.description || ''; // Using description as placeholder
        if (!transcriptText.trim()) { transcriptText = "No transcript or description available."; }

        safeProgress({ progress: 40, status: 'Generating detailed note...', error: null });
        const detailedNotePrompt = `Analyze the YouTube video (title, description/transcript): "${videoTitle}". Generate a detailed, structured Markdown note. Cover main topics, use headings, lists, bold. Aim for comprehensiveness. Video Info:\n---\n${transcriptText.slice(0, 25000)}\n---\nOutput only Markdown content.`;
        let detailedNoteContent = 'AI detailed note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) };
            const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) { throw new Error(noteRawText); }
            detailedNoteContent = noteRawText.trim();
        } catch (noteError) {
            safeProgress({ progress: 60, status: 'Note generation failed. Generating points...', error: noteError instanceof Error ? noteError.message : 'Unknown note gen error' });
        }

        safeProgress({ progress: 60, status: 'Generating key points...', error: null });
        const keyPointsPrompt = `Extract 10 key points from YouTube video: "${videoTitle}". Text:\n---\n${transcriptText.slice(0, 15000)}\n---\nKey Points (list only):\n1. ...`;
        let keyPoints: string[] = ['Key points generation failed.'];
         try {
             const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }) };
             const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
             const kpText = extractCandidateText(await kpResponse.text());
             if (!kpText.startsWith("Error:")) { const parsed = kpText.split('\n').map(l=>l.trim().replace(/^\d+\.\s*/,'')).filter(p=>p.length > 5).slice(0,10); if (parsed.length > 0) keyPoints = parsed; }
         } catch (kpError) { /* empty */ }

        safeProgress({ progress: 80, status: 'Generating study questions...', error: null });
        const questionsPrompt = `For YouTube video "${videoTitle}" (text: ${transcriptText.slice(0,100)}...), generate 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nGenerate 10.\n\nText:\n---\n${transcriptText.slice(0, 15000)}\n---`;
        let questions: ProcessedYouTube['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
            const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
            const qText = extractCandidateText(await qResponse.text());
             if (!qText.startsWith("Error:")) {
                const blocks = qText.split(/---DIVIDER---/i); let parsed = [];
                for (const block of blocks) {
                    if (parsed.length >= 10) break; const T = block.trim(); if (!T) continue;
                    const qM = T.match(/^Question:\s*([\s\S]*?)\s*A\)/i); const oM = T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is); const cM = T.match(/Correct:\s*([A-D])\b/i); const eM = T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i);
                    if (qM&&oM&&cM&&eM) { const qT=qM[1].trim(); const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim()); const cL=cM[1].toUpperCase(); const eT=eM[1].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) parsed.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); }
                } if (parsed.length > 0) questions = parsed;
             }
        } catch (qError) { /* empty */ }

        safeProgress({ progress: 100, status: 'Processing complete!', error: null });
        return {
            title: videoTitle,
            content: detailedNoteContent,
            keyPoints,
            questions,
            sourceUrl: youtubeVideoUrl,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown YouTube processing error.';
        safeProgress({ progress: 0, status: 'Error', error: errorMessage });
        throw new Error(errorMessage);
    }
}
