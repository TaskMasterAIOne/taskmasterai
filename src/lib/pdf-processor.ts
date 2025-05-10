// src/lib/pdf-processor.ts
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
// If using a local build and not a CDN for the worker:
// import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
// GlobalWorkerOptions.workerSrc = pdfjsWorker;
// Or set it in Notes.tsx if that's preferred.

import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// Interface definitions
interface ProcessingProgress {
    progress: number;
    status: string;
    error: string | null;
}
export interface ProcessedPDF { // Make sure this is exported if used elsewhere, or keep local
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
    extractedText?: string; // This is crucial
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                console.warn(`Attempt ${attempt + 1} failed: Status ${response.status}. Retrying in ${delayMs * (attempt + 1)}ms...`);
                await sleep(delayMs * (attempt + 1));
                continue;
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${attempt + 1} fetch error:`, error);
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
            console.error("Gemini API Error:", jsonResponse.error.message);
            return `Error: ${jsonResponse.error.message}`;
        }
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = jsonResponse.candidates[0].content.parts[0].text;
            const finishReason = jsonResponse.candidates[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                console.warn(`Gemini finish reason: ${finishReason}. Output might be incomplete.`);
                if (finishReason === 'MAX_TOKENS') return text + "\n\n[Error: Output truncated due to maximum token limit]";
                if (finishReason === 'SAFETY') return text + "\n\n[Error: Output stopped due to safety settings]";
                return text + `\n\n[Warning: Generation finished due to ${finishReason}]`;
            }
            return text;
        }
        if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') {
             console.warn(`Gemini finish reason: ${jsonResponse.candidates[0].finishReason} (with no text generated).`);
             if (jsonResponse.candidates[0].finishReason === 'MAX_TOKENS') return `[Error: Output truncated due to maximum token limit (no text returned)]`;
             if (jsonResponse.candidates[0].finishReason === 'SAFETY') return `[Error: Output stopped due to safety settings (no text returned)]`;
            return `Error: Generation stopped (${jsonResponse.candidates[0].finishReason}, no text)`;
        }
        console.warn("No text found in Gemini response structure:", responseText.substring(0, 500));
        return "Error: No text found in the expected structure.";
    } catch (err) {
        console.error('Error parsing Gemini JSON response:', err);
        console.error('Problematic response text (first 500 chars):', responseText.substring(0, 500));
        if (responseText.toLowerCase().includes("api key not valid")) return "Error: Invalid API Key.";
        return "Error: Could not parse the AI response.";
    }
};

export async function processPDF(
    file: File,
    userId: string,
    geminiApiKey: string,
    onProgress: (progress: ProcessingProgress) => void
): Promise<ProcessedPDF> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};

    if (!geminiApiKey) {
        safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing.' });
        throw new Error('Gemini API Key missing.');
    }

    const GEMINI_MODEL = 'gemini-2.0-flash';
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    let extractedTextFromPdf = ''; // Renamed to avoid conflict with the return object key

    try {
        safeProgress({ progress: 0, status: 'Starting PDF processing...', error: null });
        const fileId = uuidv4();
        const fileRef = ref(storage, `pdfs/${userId}/${fileId}-${file.name}`);
        await uploadBytes(fileRef, file);
        const pdfUrl = await getDownloadURL(fileRef);
        safeProgress({ progress: 10, status: 'PDF uploaded, loading document...', error: null });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf: PDFDocumentProxy = await loadingTask.promise;
        const numPages = pdf.numPages;
        safeProgress({ progress: 15, status: 'Extracting text (method 1)...', error: null });

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();
                extractedTextFromPdf += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n';
            } catch (e) {
                console.warn(`Error extracting text from page ${pageNum} using getTextContent:`, e);
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
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 }); // Scale can be adjusted
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
                console.error('OCR processing failed:', ocrError);
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
        // At this point, extractedTextFromPdf contains the best available text from the PDF.

        safeProgress({ progress: 60, status: 'Generating comprehensive study notes...', error: null });
        const noteInputText = extractedTextFromPdf; // Use the fully extracted text

        const detailedNotePrompt = `**Objective:** Create comprehensive, detailed, and well-structured study notes in Markdown format based on the provided text from "${file.name}". These notes are intended for a student learning the subject matter covered in the document.

**Core Task:** Do not just summarize. Synthesize the information, explain concepts clearly, elaborate on key points, and structure the content logically for learning and revision. Use the provided text as the primary source of truth, but leverage your understanding of the topic to enhance clarity, add context where appropriate (without contradicting the text), and organize the material effectively for studying. Avoid simply stating "The text says...". Instead, present the information directly.

**Mandatory Instructions:**

1.  **Study Focus:** Ensure the notes are pedagogically valuable. Explain concepts, define key terms clearly, connect related ideas (even if presented separately in the text), and highlight important facts, principles, or processes.
2.  **Comprehensiveness & Depth:** Cover ALL significant topics, sub-topics, arguments, data, and examples present in the text. Go into substantial detail. Aim for lengthy and exhaustive notes that capture the nuances of the source material.
3.  **Structure & Formatting:** Utilize Markdown extensively and strategically:
    *   **Headings:** Use multiple levels (#, ##, ###) for a clear hierarchy reflecting the subject's structure.
    *   **Lists:** Use bulleted (*, -, +) and numbered (1., 2.) lists prolifically for details, steps, components, pros/cons, etc. Use nesting.
    *   **Emphasis:** Use **bold** for critical terms/concepts. Use *italics* for definitions or emphasis. Use \`\`\`inline code\`\`\` for technical terms/syntax.
    *   **Tables:** If the text presents comparative data, features, etc., construct well-formatted Markdown tables.
    *   **Code Blocks:** Use fenced code blocks (\`\`\`) for multi-line code examples or data snippets (specify language if possible).
    *   **Blockquotes:** Use > for key definitions, principles, or direct (but concise) quotes that are particularly insightful.
    *   **Diagrams/Graphs:** Describe any visuals (charts, graphs, diagrams) mentioned in the text in detail: type, purpose, key data/relationships shown, and conclusion.
4.  **Output Requirements:**
    *   Generate **only** the raw Markdown note content.
    *   **NO** introductory or concluding phrases.
    *   Start *immediately* with the first Markdown element (e.g., # Main Topic).

**Source Text Content:**
---
${noteInputText}
---

**Generated Comprehensive Study Notes (Markdown Format):**
`;
        let detailedNoteContent = 'Error: AI detailed study note generation failed.';
        try {
            const noteOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: detailedNotePrompt }] }],
                    generationConfig: { temperature: 0.65, maxOutputTokens: 8192 }
                })
            };
            const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());

            if (noteRawText.startsWith("Error:")) {
                 detailedNoteContent = noteRawText;
                 safeProgress({ progress: 75, status: 'Note generation failed.', error: noteRawText });
            } else if (noteRawText.trim().length < 100) { // Adjust threshold as needed
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
                    } else { console.warn("Skipping partially parsed study question block (PDF):", trimmedBlock.substring(0,100)); }
                } else if (trimmedBlock) { console.warn("Structure mismatch in study question block (PDF):", trimmedBlock.substring(0,100)); }
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
            extractedText: extractedTextFromPdf, // Return the extracted text
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        console.error('Overall PDF processing failed:', error);
        safeProgress({ progress: 100, status: 'Processing Failed', error: errorMessage });
        // Ensure extractedText is still returned in case of partial success before this overall catch
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            content: `Error: Processing failed. ${errorMessage}`,
            keyPoints: ['Processing failed.'],
            questions: [],
            sourceUrl: '', // Or some placeholder
            extractedText: extractedTextFromPdf || `Processing failed, no text extracted. Error: ${errorMessage}`,
        };
        // throw new Error(`PDF Processing Failed: ${errorMessage}`); // Or rethrow if you want the caller to handle it as a complete failure
    }
}
