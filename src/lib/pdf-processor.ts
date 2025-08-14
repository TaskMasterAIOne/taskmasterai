import { getDocument, PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { 
    getGeminiProxy, 
    extractCandidateText, 
    AI_CONFIGS, 
    PROMPT_TEMPLATES 
} from './processors';

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
    flashcards?: { front: string; back: string; }[];
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

export async function processPDF(
    file: File,
    userId: string,
    onProgress: (progress: number) => void
): Promise<ProcessedPDF> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const geminiProxyCallable = getGeminiProxy();
    let extractedTextFromPdf = '';

    try {
        safeProgress(5);
        const fileId = uuidv4();
        const fileRef = ref(storage, `pdfs/${userId}/${fileId}-${file.name}`);
        await uploadBytes(fileRef, file);
        const pdfUrl = await getDownloadURL(fileRef);
        safeProgress(10);

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        
        const textExtractionProgressStart = 10;
        const textExtractionProgressEnd = 40;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const content = await page.getTextContent();
                extractedTextFromPdf += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n';
            } catch (e) {
                extractedTextFromPdf += `[Text extraction failed on page ${pageNum}]\n\n`;
            }
            safeProgress(textExtractionProgressStart + Math.round((pageNum / numPages) * (textExtractionProgressEnd - textExtractionProgressStart)));
        }
        extractedTextFromPdf = extractedTextFromPdf.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const MIN_CHARS_THRESHOLD = 50 * numPages;
        if (extractedTextFromPdf.length < MIN_CHARS_THRESHOLD && numPages > 0) {
            const ocrProgressStart = 40;
            const ocrProgressEnd = 60;
            let ocrText = '';
            const worker = await createWorker('eng');
            try {
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context) continue;
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                    const { data: { text } } = await worker.recognize(canvas);
                    ocrText += text + '\n\n';
                    safeProgress(ocrProgressStart + Math.round((pageNum / numPages) * (ocrProgressEnd - ocrProgressStart)));
                    canvas.width = 0; canvas.height = 0;
                }
                extractedTextFromPdf = ocrText.replace(/(\s*\n\s*){3,}/g, ' ').trim();
            } catch (ocrError) {
            } finally {
                await worker.terminate();
            }
        }
        safeProgress(60);

        if (!extractedTextFromPdf || extractedTextFromPdf.length < 20) {
            throw new Error('No usable text could be extracted from the PDF.');
        }

        // Use centralized prompt templates and AI configs
        const titlePrompt = PROMPT_TEMPLATES.TITLE_GENERATION(extractedTextFromPdf.slice(0, 4000), file.name);
        const titleResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: titlePrompt }] }], 
            generationConfig: AI_CONFIGS.TITLE_GENERATION 
        });
        let title = extractCandidateText(JSON.stringify(titleResult.data)).replace(/["']/g, "").trim() || file.name.replace(/\.pdf$/i, '');
        safeProgress(65);

        const notePrompt = PROMPT_TEMPLATES.NOTE_GENERATION(extractedTextFromPdf, file.name);
        const noteResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: notePrompt }] }], 
            generationConfig: AI_CONFIGS.NOTE_GENERATION 
        });
        let content = extractCandidateText(JSON.stringify(noteResult.data));
        if (content.startsWith("Error:")) { content = `<p><strong>Error generating note:</strong> ${content}</p>`; }
        safeProgress(75);

        const keyPointsPrompt = PROMPT_TEMPLATES.KEY_POINTS(extractedTextFromPdf, content);
        const kpResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: keyPointsPrompt }] }], 
            generationConfig: AI_CONFIGS.KEY_POINTS 
        });
        let keyPoints = (extractCandidateText(JSON.stringify(kpResult.data))).split('\n').map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '')).filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
        if (keyPoints.length === 0) { keyPoints.push("Key point generation failed or returned no valid points."); }
        safeProgress(80);

        const flashcardsPrompt = PROMPT_TEMPLATES.FLASHCARDS(extractedTextFromPdf, content);
        const fcResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: flashcardsPrompt }] }], 
            generationConfig: AI_CONFIGS.FLASHCARDS 
        });
        // FIX: Prepend "Front: " to the raw text to ensure the first card is parsed correctly.
        const fcRawText = "Front: " + extractCandidateText(JSON.stringify(fcResult.data));
        let flashcards: ProcessedPDF['flashcards'] = [];
        if (!fcRawText.startsWith("Error:")) {
            fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
                // FIX: Use a more robust regex that assumes the "Front: ... Back: ..." structure.
                const match = block.trim().match(/^Front:\s*([\s\S]+?)\s*Back:\s*([\s\S]+)$/is);
                if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
                    flashcards.push({ front: match[1].trim(), back: match[2].trim() });
                }
            });
        }
        safeProgress(90);
        
        const questionsPrompt = PROMPT_TEMPLATES.QUESTIONS(extractedTextFromPdf, content);
        const qResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: questionsPrompt }] }], 
            generationConfig: AI_CONFIGS.QUESTIONS 
        });
        const qRawText = extractCandidateText(JSON.stringify(qResult.data));
        let questions: ProcessedPDF['questions'] = [];
        if (!qRawText.startsWith("Error:")) {
            qRawText.split(/---DIVIDER---/i).forEach(block => {
                // FIX: Use a single, more robust regex to parse the entire question block at once.
                const pattern = /Question:\s*([\s\S]+?)\s*A\)\s*([\s\S]+?)\s*B\)\s*([\s\S]+?)\s*C\)\s*([\s\S]+?)\s*D\)\s*([\s\S]+?)\s*Correct:\s*([A-D])\s*Explanation:\s*([\s\S]+)/is;
                const match = block.trim().match(pattern);

                if (match) {
                    const questionText = match[1].trim();
                    const options = [match[2].trim(), match[3].trim(), match[4].trim(), match[5].trim()];
                    const correctLetter = match[6].trim().toUpperCase();
                    const explanationText = match[7].trim();

                    if (questionText && explanationText && options.every(o => o)) {
                        questions.push({
                            question: questionText,
                            options: options,
                            correctAnswer: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
                            explanation: explanationText
                        });
                    }
                }
            });
        }

        safeProgress(100);
        return { title, content, keyPoints, flashcards, questions, sourceUrl: pdfUrl, extractedText: extractedTextFromPdf };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        throw new Error(errorMessage);
    }
}
