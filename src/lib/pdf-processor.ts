import { getDocument, PDFDocumentProxy, GlobalWorkerOptions } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { 
    AI_CONFIGS, 
    PROMPT_TEMPLATES,
    makeParallelAICalls,
    parseTopicsResponse,
    parseQuestionsWithTopics
} from './processors';

// Use the worker from the installed pdfjs-dist package to ensure version match
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
GlobalWorkerOptions.workerSrc = workerSrc;

export interface ProcessedPDF {
    title: string;
    content: string;
    keyPoints: string[];
    questions: {
        id: string;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
        topicId: string;
        hint?: string;
    }[];
    topics: {
        id: string;
        name: string;
        description: string;
    }[];
    flashcards?: { front: string; back: string; }[];
    sourceUrl: string;
    extractedText?: string;
}



// Image preprocessing for better OCR accuracy
function preprocessImageForOCR(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const newData = new Uint8ClampedArray(data);
    
    // Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to grayscale using luminance formula
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Enhance contrast (simple contrast stretching)
        const enhanced = gray < 128 ? Math.max(0, gray * 0.8) : Math.min(255, gray * 1.2);
        
        newData[i] = enhanced;     // Red
        newData[i + 1] = enhanced; // Green
        newData[i + 2] = enhanced; // Blue
        // Alpha channel remains unchanged
    }
    
    return new ImageData(newData, width, height);
}

// Post-process OCR text to improve quality
function postProcessOCRText(text: string): string {
    return text
        // Fix common OCR mistakes
        .replace(/\b0\b/g, 'O') // Replace standalone 0 with O
        .replace(/\b1\b/g, 'I') // Replace standalone 1 with I
        .replace(/\b5\b/g, 'S') // Replace standalone 5 with S
        .replace(/\b8\b/g, 'B') // Replace standalone 8 with B
        // Fix spacing issues
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
        .replace(/([.!?])([A-Z])/g, '$1 $2') // Add space after punctuation
        // Clean up multiple spaces and newlines
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
}



export async function processPDF(
    file: File,
    userId: string,
    onProgress: (progress: number) => void
): Promise<ProcessedPDF> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
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
            
            try {
                // Create worker with optimized settings
                const worker = await createWorker('eng', 1, {
                    logger: () => {}, // Disable logging for better performance
                    gzip: false,
                });
                
                // Configure worker for better accuracy
                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[]{}\'"-+=*/%$@#&|\\<>~`^_',
                    tessedit_pageseg_mode: 1, // Automatic page segmentation with OSD
                    tessedit_ocr_engine_mode: 3, // Default, based on what is available
                } as any);

                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    try {
                        const page = await pdfDoc.getPage(pageNum);
                        // Use higher scale for better OCR accuracy
                        const viewport = page.getViewport({ scale: 3.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d', { alpha: false });
                        if (!context) continue;
                        
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        // Render page to canvas
                        await page.render({ canvasContext: context, viewport, canvas }).promise;
                        
                        // Image preprocessing for better OCR
                        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                        const processedImageData = preprocessImageForOCR(imageData);
                        context.putImageData(processedImageData, 0, 0);
                        
                        // Perform OCR with retry mechanism
                        let pageText = '';
                        let retryCount = 0;
                        const maxRetries = 2;
                        
                        while (retryCount <= maxRetries && !pageText.trim()) {
                            try {
                                const { data: { text } } = await worker.recognize(canvas);
                                pageText = text || '';
                                
                                // If text is too short or seems like garbage, retry with different settings
                                if (pageText.length < 10 && retryCount < maxRetries) {
                                    await worker.setParameters({
                                        tessedit_pageseg_mode: retryCount === 0 ? 6 : 8, // Try different segmentation modes
                                    } as any);
                                }
                            } catch (ocrError) {
                                console.error(`OCR failed for page ${pageNum}, attempt ${retryCount + 1}:`, ocrError);
                            }
                            retryCount++;
                        }
                        
                        if (pageText.trim()) {
                            ocrText += pageText + '\n\n';
                        } else {
                            console.warn(`No text extracted from page ${pageNum} after ${maxRetries + 1} attempts`);
                        }
                        
                        safeProgress(ocrProgressStart + Math.round((pageNum / numPages) * (ocrProgressEnd - ocrProgressStart)));
                        
                        // Clean up canvas
                        canvas.width = 0; 
                        canvas.height = 0;
                    } catch (pageError) {
                        console.error(`Error processing page ${pageNum}:`, pageError);
                        continue;
                    }
                }
                
                // Clean up worker
                await worker.terminate();
                
                // Post-process OCR text
                if (ocrText.trim()) {
                    extractedTextFromPdf = postProcessOCRText(ocrText);
                }
                
            } catch (ocrError) {
                console.error('OCR processing failed:', ocrError);
                // Don't throw error, just continue with whatever text we have
            }
        }
        safeProgress(60);

        if (!extractedTextFromPdf || extractedTextFromPdf.length < 20) {
            throw new Error('No usable text could be extracted from the PDF. Please ensure the PDF contains readable text or try a different file.');
        }

        // Use parallel AI processing for faster note creation
        safeProgress(65);
        
        const aiCalls = [
            {
                key: 'title',
                prompt: PROMPT_TEMPLATES.TITLE_GENERATION(extractedTextFromPdf.slice(0, 4000), file.name),
                config: AI_CONFIGS.TITLE_GENERATION
            },
            {
                key: 'content',
                prompt: PROMPT_TEMPLATES.NOTE_GENERATION(extractedTextFromPdf, file.name),
                config: AI_CONFIGS.NOTE_GENERATION
            },
            {
                key: 'keyPoints',
                prompt: PROMPT_TEMPLATES.KEY_POINTS(extractedTextFromPdf),
                config: AI_CONFIGS.KEY_POINTS
            },
            {
                key: 'flashcards',
                prompt: PROMPT_TEMPLATES.FLASHCARDS(extractedTextFromPdf),
                config: AI_CONFIGS.FLASHCARDS
            },
            {
                key: 'topics',
                prompt: PROMPT_TEMPLATES.TOPICS(extractedTextFromPdf),
                config: AI_CONFIGS.QUESTIONS
            },
            {
                key: 'questions',
                prompt: PROMPT_TEMPLATES.QUESTIONS(extractedTextFromPdf),
                config: AI_CONFIGS.QUESTIONS
            }
        ];

        const aiResults = await makeParallelAICalls(aiCalls, (progress) => {
            safeProgress(65 + Math.round(progress * 0.3)); // 65-95% range
        });

        // Process results
        let title = aiResults.title.replace(/["']/g, "").trim() || file.name.replace(/\.pdf$/i, '');
        
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
        const fcRawText = "Front: " + aiResults.flashcards;
        let flashcards: ProcessedPDF['flashcards'] = [];
        if (!fcRawText.startsWith("Error:")) {
            fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
                const match = block.trim().match(/^Front:\s*([\s\S]+?)\s*Back:\s*([\s\S]+)$/is);
                if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
                    flashcards.push({ front: match[1].trim(), back: match[2].trim() });
                }
            });
        }
        
        // Process topics
        const topicsRawText = aiResults.topics;
        let topics: ProcessedPDF['topics'] = [];
        if (!topicsRawText.startsWith("Error:")) {
            topics = parseTopicsResponse(topicsRawText);
        }

        // Process questions with topics and hints
        const qRawText = aiResults.questions;
        let questions: ProcessedPDF['questions'] = [];
        if (!qRawText.startsWith("Error:")) {
            questions = parseQuestionsWithTopics(qRawText);
        }

        safeProgress(100);
        return { title, content, keyPoints, flashcards, questions, topics, sourceUrl: pdfUrl, extractedText: extractedTextFromPdf };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        throw new Error(errorMessage);
    }
}
