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
    flashcards?: { front: string; back: string; }[]; // Added flashcards
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
                // Consider logging the specific error response here if needed for debugging
                // console.warn(`Attempt ${attempt + 1}: Request to ${url} failed with status ${response.status}. Retrying in ${delayMs * (attempt + 1)}ms...`);
                await sleep(delayMs * (attempt + 1));
                continue;
            }
            return response;
        } catch (error) {
            // console.warn(`Attempt ${attempt + 1}: Request to ${url} failed with error: ${error}. Retrying in ${delayMs * (attempt + 1)}ms...`);
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
        // Check for common API key error message in the raw response text
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

    const GEMINI_MODEL = 'gemini-2.0-flash'; // As per provided code
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
                progress: 15 + Math.round((pageNum / numPages) * 25), // Up to 40%
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
                        progress: 40 + Math.round((pageNum / numPages) * 20), // Up to 60%
                        status: `Performing OCR: Page ${pageNum}/${numPages}`,
                        error: null
                    });
                     canvas.width = 0; canvas.height = 0; // Help GC
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
const detailedNotePrompt = `**Objective:** Create comprehensive, detailed, and well-structured study notes based on the provided text from "${file.name}". These notes should match the exact formatting style shown in the reference screenshots - using emojis as section headers, bullet points for definitions, and clean visual organization.

**Core Task:** Transform the source material into visually appealing study notes that follow the reference format exactly. Use emojis to categorize sections, create clear bullet-point definitions, and maintain the professional academic presentation style shown in the examples.

**Mandatory Formatting Requirements:**
1. **Section Headers:** Use relevant emojis followed by section titles (e.g., "💡 Basic Terms for Economics", "📈 Inflation and Interest Rates")
2. **Bullet Points:** Use standard bullet points (•) for all definitions and explanations
3. **Key Terms:** Bold important terms followed by clear, concise definitions
4. **Mathematical Formulas:** Present formulas in italics when appropriate
5. **Visual Organization:** Group related concepts together under appropriate emoji headers
6. **Clean Layout:** Maintain consistent spacing and indentation as shown in screenshots

**Content Requirements:**
1. **Study Focus:** Ensure notes are pedagogically valuable with clear concept explanations and key term definitions
2. **Comprehensiveness:** Cover ALL significant topics, formulas, definitions, and examples from the source text
3. **Clarity:** Present information directly without phrases like "The text says..."
4. **Academic Tone:** Maintain professional, educational language throughout

**Output Format:** Generate the formatted study notes content exactly as shown in the reference screenshots. Start immediately with the first emoji section header.

**Source Text Content:**
---
${noteInputText}
---

**Generated Study Notes (Reference Format):**`;
        let detailedNoteContent = 'Error: AI detailed study note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 8192 } }) };
            const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) {
                 detailedNoteContent = noteRawText; // Keep error message
                 safeProgress({ progress: 75, status: 'Note generation failed.', error: noteRawText });
            } else if (noteRawText.trim().length < 100) { // Arbitrary short content check
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
            safeProgress({ progress: 80, status: `Key points generated (${keyPoints.length}).`, error: keyPoints[0].startsWith("Error:") ? keyPoints[0] : null });
        } catch (kpError) { const errorMsg = kpError instanceof Error ? kpError.message : 'Unknown key points error'; keyPoints = [`Error: Key points failed (${errorMsg})`]; safeProgress({ progress: 80, status: 'Key points generation failed.', error: errorMsg }); }

        safeProgress({ progress: 80, status: 'Generating flashcards...', error: null });
        const flashcardsInputText = extractedTextFromPdf;
        const flashcardsPrompt = `**Objective:** Generate **between 10 to 15 flashcards** for studying the provided text from "${file.name}".
**Mandatory Instructions:**
1.  **Study Relevance:** Flashcards MUST focus on key terms, definitions, concepts, or important facts from the text.
2.  **Text-Grounded:** Content for both front and back MUST be derived from the text.
3.  **Conciseness:** Keep front and back text concise and to the point for effective memorization.
4.  **Quantity:** Aim for 10-15 distinct flashcards.
5.  **Strict Formatting:** Adhere **unfailingly** to the following format for each flashcard, separated by "---FLASHCARD_DIVIDER---":
    Front: [Text for the front of the card - typically a question, term, or concept]
    Back: [Text for the back of the card - typically the answer, definition, or explanation]
    ---FLASHCARD_DIVIDER---
**Source Text:**\n---\n${flashcardsInputText}\n---\n(Context Only Key Points: ${keyPoints.join('; ')})\n**Generated Flashcards:**\nFront:`; // Start with "Front:" to guide the model
        let flashcards: ProcessedPDF['flashcards'] = [];
        try {
            const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 2048 } }) };
            const fcResponse = await fetchWithRetry(GEMINI_ENDPOINT, fcOptions);
            const fcRawText = extractCandidateText(await fcResponse.text());

            if (fcRawText.startsWith("Error:")) {
                throw new Error(`Flashcard Generation Failed: ${fcRawText}`);
            }

            const flashcardBlocks = fcRawText.split(/---FLASHCARD_DIVIDER---/i);
            for (const block of flashcardBlocks) {
                if (flashcards.length >= 15) break;
                const trimmedBlock = block.trim();
                if (trimmedBlock.length < 10) continue; // Minimal length for a block

                const frontMatch = trimmedBlock.match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);

                if (frontMatch && frontMatch[1] && frontMatch[2]) {
                    const frontText = frontMatch[1].trim();
                    const backText = frontMatch[2].trim();
                    if (frontText.length > 2 && backText.length > 2) { // Basic validity
                        flashcards.push({ front: frontText, back: backText });
                    }
                }
            }
            
            if (flashcards.length > 0) {
                 safeProgress({ progress: 85, status: `Generated ${flashcards.length} flashcards.`, error: null });
            } else if (!fcRawText.startsWith("Error:")) { // No API error, but no cards parsed
                 safeProgress({ progress: 85, status: `Generated 0 flashcards. (Possible parsing issue or no relevant content)`, error: "No flashcards parsed from AI response, or AI returned no usable cards." });
            } else { // fcRawText started with an error, handled by catch block below
                throw new Error("Flashcard generation resulted in no usable cards due to an earlier error.");
            }

        } catch (fcError) {
            const errorMsg = fcError instanceof Error ? fcError.message : 'Unknown flashcards error';
            safeProgress({ progress: 85, status: 'Flashcards generation failed.', error: errorMsg });
            flashcards = [{ front: 'Flashcard generation failed.', back: `Reason: ${errorMsg}` }]; // Provide a default error flashcard
        }


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
            if (questions.length === 0 && !qRawText.startsWith("Error:")) { // No API error, but nothing parsed
                throw new Error("No valid study questions parsed from AI response.");
            } else if (questions.length === 0 && qRawText.startsWith("Error:")) {
                // Error already captured, will be part of the thrown error message
            }
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
            flashcards, // Added
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
            flashcards: [], // Initialize as empty array on general failure
            questions: [],
            sourceUrl: '', // Potentially pdfUrl could be set if upload succeeded before failure
            extractedText: extractedTextFromPdf || `Processing failed, no text extracted. Error: ${errorMessage}`,
        };
    }
}
