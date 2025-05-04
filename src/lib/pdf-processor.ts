// *** Import getDocument AND pdfjs from pdfjs-dist ***
// NOTE: pdfjs-dist/build/pdf includes the workerSrc setup needed for environments like web browsers.
// If running in Node.js or similar where workerSrc isn't automatically handled, you might need manual config.
// import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf'; // Use this for explicit worker path
// import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'; // Use this for explicit worker path
import { getDocument } from 'pdfjs-dist'; // Keep this simple import if your bundler/environment handles worker loading
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase'; // Assuming firebase config is correctly set up here

// *** Uncomment and configure if needed (e.g., Vite, Webpack, Node.js) ***
// Sets up the worker source for PDF.js. Adjust the path based on your build setup.
// If using a CDN:
// import * as pdfjs from 'pdfjs-dist/build/pdf';
// pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
// If using local build:
// import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'; // Requires the pdfjsWorker import above
// import { GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
// GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Interface definitions
interface ProcessingProgress {
    progress: number;
    status: string;
    error: string | null;
}
interface ProcessedPDF {
    title: string;
    content: string; // Will hold the detailed Markdown study notes
    keyPoints: string[];
    questions: {
        question: string;
        options: string[];
        correctAnswer: number; // Index 0-3
        explanation: string;
    }[];
    sourceUrl: string;
    extractedText?: string; // Optional: for debugging
}

// Helper functions (sleep, fetchWithRetry, extractCandidateText) - No changes needed
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


// processPDF function starts here...
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

    // Using Gemini 1.5 Flash - chosen for its large context window suitable for entire documents.
    const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17'; // Using 1.5 for large context
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    let extractedText = '';

    try {
        safeProgress({ progress: 0, status: 'Starting PDF processing...', error: null });
        const fileId = uuidv4();
        const fileRef = ref(storage, `pdfs/${userId}/${fileId}-${file.name}`);
        await uploadBytes(fileRef, file);
        const pdfUrl = await getDownloadURL(fileRef);
        safeProgress({ progress: 10, status: 'PDF uploaded, loading document...', error: null });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        safeProgress({ progress: 15, status: 'Extracting text (method 1)...', error: null });

        // --- Text Extraction (Method 1: pdf.js getTextContent) ---
        // Attempt to get text from all pages
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();
                extractedText += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n';
            } catch (e) {
                console.warn(`Error extracting text from page ${pageNum} using getTextContent:`, e);
                extractedText += `[Text extraction failed on page ${pageNum}]\n\n`;
            }
             safeProgress({
                progress: 15 + Math.round((pageNum / numPages) * 25),
                status: `Extracting text: Page ${pageNum}/${numPages}`,
                error: null
            });
        }
        extractedText = extractedText.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();


        // --- OCR Fallback Logic ---
        // Trigger OCR if initial extraction yields very little text overall
        const MIN_CHARS_THRESHOLD = 50 * numPages;
        if (extractedText.length < MIN_CHARS_THRESHOLD && numPages > 0) {
            safeProgress({ progress: 40, status: 'Low text quality detected, attempting OCR...', error: null });
            let ocrText = '';
            const worker = await createWorker('eng');
            try {
                // No need to load/initialize separately in Tesseract.js v4+
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.5 }); // Increased scale for potentially better OCR
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context) {
                        console.warn(`Could not get 2D context for page ${pageNum} canvas.`);
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
                     canvas.width = 0; // Attempt to release memory
                     canvas.height = 0;
                }
                extractedText = ocrText.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
                safeProgress({ progress: 60, status: 'OCR complete.', error: null });
            } catch (ocrError) {
                console.error('OCR processing failed:', ocrError);
                safeProgress({
                    progress: 60,
                    status: 'OCR failed. Using initially extracted text (if any).',
                    error: `OCR Error: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`
                });
            } finally {
                await worker.terminate();
            }
        } else {
            safeProgress({ progress: 60, status: 'Text extraction complete.', error: null });
        }

        // Final check if *any* text was obtained
        if (!extractedText || extractedText.length < 20) { // Slightly higher threshold
            const finalErrorMsg = 'No usable text could be extracted from the PDF, even after attempting OCR.';
            safeProgress({ progress: 100, status: 'Error', error: finalErrorMsg });
            throw new Error(finalErrorMsg);
        }


        // --- Detailed Note Generation ---
        safeProgress({ progress: 60, status: 'Generating comprehensive study notes...', error: null });
        // ***** REMOVED INPUT LIMIT *****
        // Use the *entire* extracted text for note generation.
        // Be mindful that very large documents might exceed practical limits or incur higher costs.
        const noteInputText = extractedText;
        console.log(`Generating notes using full extracted text (${noteInputText.length} chars).`);


        // ***** REVISED DETAILED STUDY NOTE PROMPT *****
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
    *   **Other Elements (Use as appropriate):** Definition lists, footnotes ([^tag]), HTML sub/superscript (<sub>, <sup>), horizontal rules (--- sparingly).
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
`; // END OF REVISED NOTE PROMPT

        let detailedNoteContent = 'Error: AI detailed study note generation failed.'; // Default fallback
        try {
            const noteOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: detailedNotePrompt }] }],
                    generationConfig: {
                        temperature: 0.65, // Slightly increased temperature for more elaborative/explanatory style
                        maxOutputTokens: 65536, // Keep high for potentially very long notes
                        // topP: 0.95,
                        // topK: 40
                    }
                    // Consider safety settings if needed
                })
            };
            const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());

            if (noteRawText.startsWith("Error:")) {
                 detailedNoteContent = noteRawText; // Keep error message
                 safeProgress({ progress: 75, status: 'Note generation failed or was blocked/truncated.', error: noteRawText });
                 console.error("Detailed Study Note Generation Error:", noteRawText);
            } else if (noteRawText.trim().length < 250) { // Higher threshold for detailed notes
                 const shortNoteError = "AI generated unexpectedly short study notes. They might be incomplete or the source text was very brief/unsuitable.";
                 console.warn("Generated study notes seem very short:", noteRawText.substring(0, 300));
                 detailedNoteContent = noteRawText.trim() + `\n\n[Warning: ${shortNoteError}]`;
                 safeProgress({ progress: 75, status: 'Note generation resulted in short content.', error: shortNoteError });
            } else {
                 detailedNoteContent = noteRawText.trim();
                 safeProgress({ progress: 75, status: 'Comprehensive study notes generated.', error: null });
            }

        } catch (noteError) {
            const errorMsg = noteError instanceof Error ? noteError.message : 'Unknown detailed note generation error';
            console.error('Detailed study note fetch/processing error:', noteError);
            detailedNoteContent = `Error: Detailed study note generation failed. Reason: ${errorMsg}`;
            safeProgress({ progress: 75, status: 'Detailed study note generation failed. Proceeding...', error: errorMsg });
        }


        // --- Key Points Generation ---
        // Keep key points focused on extracting main ideas *from the text*
        safeProgress({ progress: 75, status: 'Generating key points...', error: null });
        // ***** REMOVED INPUT LIMIT FOR KEY POINTS TOO *****
        // Allows key points to be derived from the entire document context.
        const keyPointsInputText = extractedText;
        console.log(`Generating key points using full extracted text (${keyPointsInputText.length} chars).`);

        const keyPointsPrompt = `From the following text (extracted from PDF "${file.name}"), identify and list up to 10 distinct and highly significant key points, main takeaways, or core arguments presented *in the text*. Focus on the most crucial concepts, findings, or conclusions stated.

Instructions:
- Output ONLY the key points.
- Each point MUST start with '* ' (asterisk followed by a space).
- Do NOT include any introductory or concluding phrases.
- Prioritize points central to the document's message.

Text Excerpt:
---
${keyPointsInputText}
---

Key Points (max 10):
* `;

        let keyPoints: string[] = ['Error: Key points generation failed.']; // Fallback
        try {
            const kpOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: keyPointsPrompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
                })
            };
            const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
            const kpText = extractCandidateText(await kpResponse.text());

            if (kpText.startsWith("Error:")) {
                console.error("Key Points Generation Error:", kpText);
                keyPoints = [`Error: Key points generation failed (${kpText})`];
            } else {
                // Parsing logic remains similar
                const parsed = kpText.split('\n')
                                    .map(l => l.trim().match(/^(\*|-|\d+\.)\s*(.+)/))
                                    .filter(match => match && match[2] && match[2].trim().length > 5)
                                    // @ts-ignore
                                    .map(match => match[2].trim());

                if (parsed.length > 0) {
                     keyPoints = parsed.slice(0, 10); // Take up to 10
                     safeProgress({ progress: 85, status: `Key points generated (${keyPoints.length}).`, error: null });
                } else {
                     keyPoints = ['Error: Could not parse valid key points from AI response.'];
                     console.warn("No valid key points parsed from AI response:", kpText.substring(0, 300));
                     safeProgress({ progress: 85, status: 'Key points parsing failed.', error: 'Could not parse key points.' });
                }
            }
        } catch (kpError) {
            const errorMsg = kpError instanceof Error ? kpError.message : 'Unknown key points error';
            console.error('Key points fetch/processing error:', kpError);
            keyPoints = [`Error: Key points generation failed (${errorMsg})`];
            safeProgress({ progress: 85, status: 'Key points generation failed.', error: errorMsg });
        }


        // --- Question Generation ---
        safeProgress({ progress: 85, status: 'Generating relevant study questions...', error: null });
        // ***** REMOVED INPUT LIMIT *****
        // Use the *entire* extracted text for question generation context.
        const questionsInputText = extractedText;
        console.log(`Generating questions using full extracted text (${questionsInputText.length} chars).`);


        // ***** REVISED STUDY QUESTION PROMPT *****
        const questionsPrompt = `**Objective:** Generate **exactly 10 multiple-choice questions (MCQs)** designed to test a student's understanding of the core subject matter presented in the provided text from "${file.name}". These questions should be relevant for someone studying this topic.

**Core Task:** Create questions that assess knowledge of the key concepts, principles, facts, methods, or implications discussed in the text. Use the provided text as the primary source for question content and correct answers. You can leverage your general knowledge to formulate realistic and relevant questions/distractors *about the subject*, but ensure the *correct* answer is supported by the text.

**Mandatory Instructions:**

1.  **Study Relevance:** Questions MUST focus on the *actual subject matter*. **AVOID** questions *about* the document itself (e.g., "What is the main purpose of this document?", "According to the text, why do students take this exam?"). Focus on testing understanding of the topics *covered within* the document (e.g., "What statistical test is appropriate for comparing means between two independent groups?", "What is the significance of [Concept X] in [Context Y]?").
2.  **Text-Grounded:** While you can use broader knowledge for phrasing and distractors, the **correct answer and the premise of the question must be derivable from or directly supported by the provided text.**
3.  **Quantity & Scope:** Generate **exactly 10** distinct MCQs covering a good range of important topics discussed throughout the text.
4.  **Strict Formatting:** Adhere **unfailingly** to the following format for *each* question, separated by '---DIVIDER---'. No extra text before the first question or after the last divider.
    Question: [Your relevant study question about the subject matter]
    A) [Option A - Plausible distractor relevant to the topic]
    B) [Option B - Plausible distractor relevant to the topic]
    C) [Option C - The correct answer, supported by the text]
    D) [Option D - Plausible distractor relevant to the topic]
    Correct: [Correct Answer Letter (A, B, C, or D)]
    Explanation: [Clear explanation justifying the correct answer based on concepts or facts in the text, AND briefly stating why the main distractors are incorrect according to the text/topic.]
5.  **Quality:** Ensure questions require comprehension, analysis, or application of the concepts. Distractors should be plausible but incorrect based on the text's content. Use clear and precise language.

**Source Text Content:**
---
${questionsInputText}
---
(Context Only Key Points: ${keyPoints.join('; ')})

**Generated Study Questions (MCQ Format):**
---DIVIDER---
`; // END OF REVISED QUESTION PROMPT

        const questionsOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: questionsPrompt }] }],
                generationConfig: {
                    temperature: 0.6, // Slightly higher temp may help create more varied/realistic questions
                    maxOutputTokens: 4096 // Keep high for 10 detailed questions
                }
            })
        };

        let questions: ProcessedPDF['questions'] = []; // Initialize as empty
        try {
            const questionsResponse = await fetchWithRetry(GEMINI_ENDPOINT, questionsOptions);
            const questionsResponseText = await questionsResponse.text();
            const questionsRawText = extractCandidateText(questionsResponseText);

            if (questionsRawText.startsWith("Error:")) {
                 throw new Error(`Question Generation Failed: ${questionsRawText}`);
            }

            // Parsing Logic (should still work with the strict format requested)
            const questionBlocks = questionsRawText.split(/---DIVIDER---/i);
            console.log(`Attempting to parse ${questionBlocks.length -1} potential question blocks.`);

            for (const block of questionBlocks) {
                if (questions.length >= 10) break;

                const trimmedBlock = block.trim();
                if (trimmedBlock.length < 50) continue;

                // Regex remains the same as it targets the specific structure
                const questionMatch = trimmedBlock.match(/^Question:\s*([\s\S]*?)\s*\nA\)\s/i);
                const optionsMatch = trimmedBlock.match(/\nA\)\s*([\s\S]*?)\s*\nB\)\s*([\s\S]*?)\s*\nC\)\s*([\s\S]*?)\s*\nD\)\s*([\s\S]*?)\s*\nCorrect:/is);
                const correctMatch = trimmedBlock.match(/\nCorrect:\s*([A-D])\s*\nExplanation:/i);
                const explanationMatch = trimmedBlock.match(/\nExplanation:\s*([\s\S]*)$/i);

                if (questionMatch?.[1] && optionsMatch?.[1] && optionsMatch?.[2] && optionsMatch?.[3] && optionsMatch?.[4] && correctMatch?.[1] && explanationMatch?.[1]) {
                    const questionText = questionMatch[1].trim();
                    const optionsList = [
                        optionsMatch[1], optionsMatch[2], optionsMatch[3], optionsMatch[4]
                    ].map(opt => opt.trim());
                    const correctLetter = correctMatch[1].toUpperCase() as ('A' | 'B' | 'C' | 'D');
                    const explanationText = explanationMatch[1].trim();

                    if (questionText.length > 10 && // Slightly more stringent check
                        optionsList.length === 4 &&
                        optionsList.every(o => o && o.length > 0) &&
                        ['A', 'B', 'C', 'D'].includes(correctLetter) &&
                        explanationText.length > 15) // Explanation should be reasonably detailed
                    {
                        questions.push({
                            question: questionText,
                            options: optionsList,
                            correctAnswer: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
                            explanation: explanationText,
                        });
                    } else {
                         console.warn("Skipping partially parsed/invalid study question block:", { blockStart: trimmedBlock.substring(0, 100) + '...' });
                    }
                } else {
                     if(trimmedBlock) {
                        console.warn("Structure mismatch in study question block, skipping:", trimmedBlock.substring(0, 150) + '...');
                     }
                }
            } // End parsing loop

            console.log(`Successfully parsed ${questions.length} valid study questions.`);

            if (questions.length === 0) {
                 throw new Error("No valid study questions could be parsed from the AI response. Check format.");
            } else if (questions.length < 10) {
                 const errMsg = `Successfully parsed only ${questions.length}/10 requested study questions.`;
                 console.warn(errMsg);
                 // Report this as a potential issue, but not necessarily a failure
                 safeProgress({ progress: 95, status: `Generated ${questions.length}/10 questions. Finalizing...`, error: errMsg });
            } else {
                 safeProgress({ progress: 95, status: 'Relevant study questions generated.', error: null });
            }

        } catch (questionsError) {
            const errorMsg = questionsError instanceof Error ? questionsError.message : 'Unknown questions error';
            console.error('Study questions generation or parsing error:', questionsError);
            safeProgress({ progress: 95, status: 'Study questions generation/parsing failed.', error: errorMsg });
            if (questions.length === 0) {
                questions = [{ // Provide a fallback explaining the failure
                    question: 'Relevant study questions could not be generated or parsed.',
                    options: ['Ok', 'Error', 'Retry Later', 'N/A'],
                    correctAnswer: 1,
                    explanation: `Failed to generate/parse study questions. Reason: ${errorMsg}`
                }];
            }
        }
        // --- End Question Generation ---


        safeProgress({ progress: 98, status: 'Finalizing results...', error: null });

        // --- Return Processed Data ---
        safeProgress({ progress: 100, status: 'Processing complete!', error: null });
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            content: detailedNoteContent, // Comprehensive study notes (or error)
            keyPoints, // Key points from text (or error)
            questions, // Relevant study questions (or fallback)
            sourceUrl: pdfUrl,
            // extractedText: extractedText // Keep commented unless needed for debugging
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        console.error('Overall PDF processing failed:', error);
        safeProgress({ progress: 100, status: 'Processing Failed', error: errorMessage });
        throw new Error(`PDF Processing Failed: ${errorMessage}`);
    }
}
