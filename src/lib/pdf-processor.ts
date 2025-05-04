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
    content: string; // Will hold the detailed Markdown note
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

// Helper functions (sleep, fetchWithRetry, extractCandidateText)
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            // Retry on 429 (Too Many Requests) or 5xx Server Errors
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                console.warn(`Attempt ${attempt + 1} failed: Status ${response.status}. Retrying in ${delayMs * (attempt + 1)}ms...`);
                await sleep(delayMs * (attempt + 1));
                continue; // Go to the next iteration
            }
            return response; // Success or non-retriable error
        } catch (error) {
            console.error(`Attempt ${attempt + 1} fetch error:`, error);
            if (attempt === retries - 1) throw error; // Throw error on last attempt
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw new Error(`Max retries reached for URL: ${url}`);
}

// Extracts text, handles errors including finishReason and parsing issues.
const extractCandidateText = (responseText: string): string => {
    try {
        const jsonResponse = JSON.parse(responseText);

        // Check for explicit error message from the API
        if (jsonResponse?.error?.message) {
            console.error("Gemini API Error:", jsonResponse.error.message);
            return `Error: ${jsonResponse.error.message}`;
        }

        // Check if candidates array exists and has content
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const text = jsonResponse.candidates[0].content.parts[0].text;
            // Additionally check the finish reason
            const finishReason = jsonResponse.candidates[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                console.warn(`Gemini finish reason: ${finishReason}. Output might be incomplete.`);
                if (finishReason === 'MAX_TOKENS') {
                    return text + "\n\n[Error: Output truncated due to maximum token limit]";
                }
                 if (finishReason === 'SAFETY') {
                    return text + "\n\n[Error: Output stopped due to safety settings]";
                }
                // Append a generic warning for other non-STOP reasons
                 return text + `\n\n[Warning: Generation finished due to ${finishReason}]`;
            }
            // If finishReason is STOP or not present, return the text
            return text;
        }

        // Handle cases where generation stopped prematurely without text but with a reason
        if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') {
            console.warn(`Gemini finish reason: ${jsonResponse.candidates[0].finishReason} (with no text generated).`);
             if (jsonResponse.candidates[0].finishReason === 'MAX_TOKENS') {
                 return `[Error: Output truncated due to maximum token limit (no text returned)]`;
             }
             if (jsonResponse.candidates[0].finishReason === 'SAFETY') {
                 return `[Error: Output stopped due to safety settings (no text returned)]`;
             }
            return `Error: Generation stopped (${jsonResponse.candidates[0].finishReason}, no text)`;
        }

        // Fallback if no text and no specific error/reason is found
        console.warn("No text found in Gemini response structure:", responseText.substring(0, 500));
        return "Error: No text found in the expected structure.";

    } catch (err) {
        console.error('Error parsing Gemini JSON response:', err);
        console.error('Problematic response text (first 500 chars):', responseText.substring(0, 500));
        // Try to return a useful error message if possible, otherwise generic
        if (responseText.toLowerCase().includes("api key not valid")) {
             return "Error: Invalid API Key.";
        }
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
    // Ensure onProgress is always callable
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};

    if (!geminiApiKey) {
        safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing.' });
        throw new Error('Gemini API Key missing.');
    }

    // Using Gemini 1.5 Flash - balances speed, cost, and large context.
    const GEMINI_MODEL = 'gemini-1.5-flash-latest'; // Use 'latest' tag
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
        // Ensure PDF worker is configured if necessary (see comments at top of file)
        const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        safeProgress({ progress: 15, status: 'Extracting text (method 1)...', error: null });

        // --- Text Extraction (Method 1: pdf.js getTextContent) ---
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();
                // Join items, handling potential non-'str' items gracefully
                extractedText += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n'; // Add space and double newline
            } catch (e) {
                console.warn(`Error extracting text from page ${pageNum} using getTextContent:`, e);
                extractedText += `[Text extraction failed on page ${pageNum}]\n\n`; // Mark failure
            }
             // Update progress more frequently during text extraction
             safeProgress({
                progress: 15 + Math.round((pageNum / numPages) * 25), // Allocate 25% progress to initial extraction
                status: `Extracting text: Page ${pageNum}/${numPages}`,
                error: null
            });
        }
        // Basic cleanup: reduce excessive whitespace/newlines
        extractedText = extractedText.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();


        // --- OCR Fallback Logic ---
        const MIN_CHARS_THRESHOLD = 50 * numPages; // Heuristic: Avg 50 chars per page needed
        if (extractedText.length < MIN_CHARS_THRESHOLD && numPages > 0) {
            safeProgress({ progress: 40, status: 'Low text quality detected, attempting OCR...', error: null });
            let ocrText = '';
            const worker = await createWorker('eng'); // Consider adding more languages if needed: await createWorker('eng+fra+spa');
            try {
                await worker.load();
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    // Increased scale for potentially better OCR accuracy on dense text
                    const viewport = page.getViewport({ scale: 2.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d', { alpha: false }); // alpha: false might improve perf
                    if (!context) {
                        console.warn(`Could not get 2D context for page ${pageNum} canvas.`);
                        ocrText += `[OCR failed: Canvas context unavailable page ${pageNum}]\n\n`;
                        continue; // Skip this page for OCR
                    }
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;
                    // Enhance contrast slightly - experimental, may or may not help significantly
                    // context.globalCompositeOperation = 'luminosity';
                    // context.fillStyle = 'white';
                    // context.fillRect(0,0,canvas.width, canvas.height);
                    // context.globalCompositeOperation = 'source-over';
                    // context.drawImage(canvas, 0, 0);
                    const { data: { text } } = await worker.recognize(canvas);
                    ocrText += text + '\n\n';
                    safeProgress({
                        progress: 40 + Math.round((pageNum / numPages) * 20), // Allocate 20% progress to OCR
                        status: `Performing OCR: Page ${pageNum}/${numPages}`,
                        error: null
                    });
                     // Clean up canvas to potentially free memory
                     canvas.width = 0;
                     canvas.height = 0;
                }
                // Apply similar cleanup to OCR text
                extractedText = ocrText.replace(/(\s*\n\s*){3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
                safeProgress({ progress: 60, status: 'OCR complete. Proceeding...', error: null });
            } catch (ocrError) {
                console.error('OCR processing failed:', ocrError);
                safeProgress({
                    progress: 60, // Still mark OCR stage as passed
                    status: 'OCR failed. Using initially extracted text (if any).',
                    // Provide more specific error if available
                    error: `OCR Error: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`
                });
                // Fallback to the text extracted by the first method (even if it was short)
            } finally {
                await worker.terminate(); // Ensure worker is always terminated
            }
        } else {
            // If initial extraction was good enough, skip OCR progress stage
            safeProgress({ progress: 60, status: 'Text extraction complete.', error: null });
        }

        // Final check if any text was obtained
        if (!extractedText || extractedText.length < 10) { // Stricter check
            const finalErrorMsg = 'No usable text could be extracted from the PDF, even after attempting OCR.';
            safeProgress({ progress: 100, status: 'Error', error: finalErrorMsg });
            throw new Error(finalErrorMsg);
        }


        // --- Detailed Note Generation ---
        safeProgress({ progress: 60, status: 'Generating detailed note...', error: null });
        const MAX_INPUT_CHARS_NOTE = 150000; // Keep large for notes (adjust based on model/cost)
        const noteInputText = extractedText.slice(0, MAX_INPUT_CHARS_NOTE);
        if (extractedText.length > MAX_INPUT_CHARS_NOTE) {
            console.warn(`Note generation using first ${MAX_INPUT_CHARS_NOTE} characters due to input limit.`);
            safeProgress({ progress: 61, status: `Generating detailed note (using first ${MAX_INPUT_CHARS_NOTE} chars)...`, error: 'Input truncated for note generation.' });
        }

        // ***** REVISED DETAILED NOTE PROMPT *****
        const detailedNotePrompt = `Analyze the following text extracted from the PDF "${file.name}". Your task is to generate **exceptionally detailed, exhaustive, and meticulously structured study notes** in Markdown format. The output MUST be **significantly lengthy**, capturing the full depth, nuance, specifics, and structure of the source material. Treat this as creating a comprehensive reference guide based *only* on the provided text.

**Mandatory Instructions:**

1.  **Depth, Detail, and Length (Paramount):**
    *   Produce notes that are **substantially long and dense with information**. This is NOT a summary.
    *   Extract and **elaborate in detail** on ALL key facts, concepts, definitions, arguments, processes, examples, data points, findings, dates, figures, and supporting details mentioned.
    *   Capture **nuance and subtleties**. If the text makes distinctions, comparisons, or qualifications, reflect these precisely and thoroughly in the notes.
    *   Ensure **complete coverage** of ALL topics, sub-topics, and sections presented in the source text. Omit nothing significant. Actively seek out all pieces of information.
    *   Include **all examples** provided in the text to illustrate concepts.

2.  **Strict & Sophisticated Markdown Formatting:** Utilize the following Markdown elements **extensively, appropriately, and strategically throughout the entire output** to maximize clarity, structure, and information density:
    *   **Headings:** Employ multiple levels (\`#\`, \`##\`, \`###\`, etc.) to create a deep hierarchical structure accurately reflecting the text's organization.
    *   **Lists:** Use bulleted (\`*\`, \`-\`, \`+\`) and numbered (\`1.\`, \`2.\`) lists prolifically for sequences, components, features, pros/cons, etc. Utilize nested lists for sub-details.
    *   **Emphasis:** Use \`**bold**\` for critical terms, key concepts, names, results. Use \`*italics*\` for definitions, titles, or nuanced emphasis. Use \`\`\`inline code\`\`\` for technical syntax, filenames, code elements. Use other emphasis (\`***\`, \`~~\`) *only* if the text's meaning dictates it.
    *   **Tables:** Identify *any* data suitable for tabulation (comparisons, feature sets, structured data) and **construct** clear, well-formatted Markdown tables with headers and correct alignment (\`:--\`, \`:-:\`, \`--:\`).
    *   **Code Blocks:** For *any* multi-line code, configuration snippets, or textual data examples, use fenced code blocks (\`\`\`) and specify the language (e.g., \`\`\`python\`) if known from context.
    *   **Blockquotes:** Use \`>\` to set apart direct quotes, key definitions, important principles, or significant passages extracted verbatim.
    *   **Horizontal Rules:** Use \`---\` *very sparingly* only to denote major thematic shifts if headings alone are insufficient for clarity across large sections.
    *   **Definition Lists:** When the text defines multiple terms, systematically use the definition list format:
        \`\`\`markdown
        Term Being Defined
        : Detailed definition or explanation derived from the text.
        \`\`\`
    *   **Task Lists:** Use \`- [ ]\` / \`- [x]\` *only if* the source text explicitly describes actionable steps or checklists.
    *   **Mathematical/Scientific Notation:** When the text contains formulas or specific notation, represent them using HTML tags: \`<sub>subscript</sub>\` (e.g., \`H<sub>2</sub>O\`) and \`<sup>superscript</sup>\` (e.g., \`E=mc<sup>2</sup>\`).
    *   **Footnotes:** If the text includes citations or asides that function like footnotes, replicate them using Markdown footnotes: \`[^tag]\` in the text and \`[^tag]: Full note content.\` at the end of a section or document.
    *   **Diagrams/Graphs (Textual Representation):** Describe any diagrams, charts, or graphs mentioned in the text in **thorough detail**. Include: title, type (bar, line, pie, flow), axes labels, key data points, trends, relationships shown, and the overall conclusion or purpose of the visual as stated or implied by the text. **Describe** the graph's content and meaning. If the text provides data suitable for a simple textual chart (e.g., using characters or tables), attempt to create one.
    *   **Highlighting:** Use \`==highlighted text==\` *only* if the source text uses explicit visual highlighting (e.g., yellow marker) or extremely strong emphasis that needs special distinction beyond bold/italics.

3.  **Output Requirements:**
    *   Generate **only** the raw Markdown note content.
    *   **ABSOLUTELY NO** introductory sentences (e.g., "Here are the notes...") or concluding remarks.
    *   Begin the output *immediately* with the first Markdown element (likely a \`# Heading\`).
    *   Ensure the entire output is syntactically correct, highly structured, and information-rich Markdown.

**Input Text Content:**
---
${noteInputText}
---

**Generated Exhaustive Markdown Notes (Adhering Strictly to ALL Instructions):**
`; // END OF DETAILED NOTE PROMPT

        let detailedNoteContent = 'Error: AI detailed note generation failed.'; // Default fallback
        try {
            const noteOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: detailedNotePrompt }] }],
                    generationConfig: {
                        temperature: 0.6, // Balanced temperature for detailed but creative text
                        // Max output tokens set high for Gemini 1.5 Flash capability
                        maxOutputTokens: 8192,
                        // topP and topK can also be adjusted if needed, but often temp is sufficient
                        // topP: 0.95,
                        // topK: 40
                    },
                    // Optional Safety Settings (adjust if needed, defaults are usually reasonable)
                    // safetySettings: [
                    //    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    //    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    //    // etc.
                    // ]
                })
            };
            const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());

            // Check for errors returned by extractCandidateText or very short responses
            if (noteRawText.startsWith("Error:")) {
                 detailedNoteContent = noteRawText; // Keep the error message as the content
                 safeProgress({ progress: 75, status: 'Note generation failed or was blocked/truncated.', error: noteRawText });
                 console.error("Detailed Note Generation Error:", noteRawText);
                 // Decide if this is a fatal error for the whole process
                 // throw new Error(`Note Generation Failed: ${noteRawText}`); // Option: Stop processing here
            } else if (noteRawText.trim().length < 200) { // Increased threshold for "suspiciously short"
                 const shortNoteError = "AI generated an unexpectedly short note. It might be incomplete or the source text was very brief.";
                 console.warn("Generated note seems very short:", noteRawText.substring(0, 300));
                 detailedNoteContent = noteRawText.trim() + `\n\n[Warning: ${shortNoteError}]`; // Append warning
                 safeProgress({ progress: 75, status: 'Note generation resulted in very short content.', error: shortNoteError });
            } else {
                 detailedNoteContent = noteRawText.trim(); // Success! Use the generated note.
                 safeProgress({ progress: 75, status: 'Detailed note generated.', error: null }); // Clear previous potential error
            }

        } catch (noteError) {
            const errorMsg = noteError instanceof Error ? noteError.message : 'Unknown detailed note generation error';
            console.error('Detailed note fetch/processing error:', noteError);
            detailedNoteContent = `Error: Detailed note generation failed. Reason: ${errorMsg}`; // Include reason in fallback
            safeProgress({ progress: 75, status: 'Detailed note generation failed. Proceeding...', error: errorMsg });
            // Keep the error content in detailedNoteContent
        }


        // --- Key Points Generation ---
        safeProgress({ progress: 75, status: 'Generating key points...', error: null });
        const MAX_INPUT_CHARS_KP = 30000; // Increased slightly
        const keyPointsInputText = extractedText.slice(0, MAX_INPUT_CHARS_KP);
        const keyPointsPrompt = `From the following text (extracted from PDF "${file.name}"), identify and list exactly 10 distinct and highly significant key points, main takeaways, or core arguments. Prioritize conciseness while retaining crucial meaning. Focus on the absolute most important concepts/findings.

Instructions:
- Output ONLY the 10 key points.
- Each point MUST start with '* ' (asterisk followed by a space).
- Do NOT include any introductory or concluding phrases like "Here are the points:".
- Ensure points are distinct and cover central themes of the text excerpt provided.

Text Excerpt:
---
${keyPointsInputText}
---

Key Points:
* `; // Prompt AI to start the list correctly

        let keyPoints: string[] = ['Error: Key points generation failed.']; // Fallback
        try {
            const kpOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: keyPointsPrompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 } // Increased tokens slightly
                })
            };
            const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
            const kpText = extractCandidateText(await kpResponse.text());

            if (kpText.startsWith("Error:")) {
                console.error("Key Points Generation Error:", kpText);
                keyPoints = [`Error: Key points generation failed (${kpText})`]; // Include error detail
            } else {
                // Improved parsing: Split by newline, find lines starting with list markers, clean them up
                const parsed = kpText.split('\n')
                                    // Match lines starting with '* ', '- ', or digits+dot+space
                                    .map(l => l.trim().match(/^(\*|-|\d+\.)\s*(.+)/))
                                    .filter(match => match && match[2] && match[2].trim().length > 5) // Ensure valid match and reasonable length
                                    // @ts-ignore - filter ensures match is not null
                                    .map(match => match[2].trim()); // Extract the actual point text

                if (parsed.length > 0) {
                     keyPoints = parsed.slice(0, 10); // Take up to 10 valid points
                     if (keyPoints.length < 7) { // Warn if fewer than 7 generated
                         console.warn(`Generated only ${keyPoints.length} valid key points.`);
                         safeProgress({ progress: 85, status: `Key points generated (${keyPoints.length}/10).`, error: `Only ${keyPoints.length} key points parsed.` });
                     } else {
                         safeProgress({ progress: 85, status: 'Key points generated.', error: null }); // Clear previous potential error
                     }
                } else {
                     keyPoints = ['Error: Could not parse valid key points from AI response.']; // More informative fallback
                     console.warn("No valid key points parsed from AI response:", kpText.substring(0, 300));
                     safeProgress({ progress: 85, status: 'Key points parsing failed.', error: 'Could not parse key points.' });
                }
            }
        } catch (kpError) {
            const errorMsg = kpError instanceof Error ? kpError.message : 'Unknown key points error';
            console.error('Key points fetch/processing error:', kpError);
            keyPoints = [`Error: Key points generation failed (${errorMsg})`]; // Include error detail
            safeProgress({ progress: 85, status: 'Key points generation failed.', error: errorMsg });
        }


        // --- Question Generation ---
        safeProgress({ progress: 85, status: 'Generating study questions...', error: null });
        const MAX_INPUT_CHARS_QUESTIONS = 40000; // Increased context for better questions

        // ***** REVISED HIGH-DEPTH QUESTION PROMPT *****
        const questionsPrompt = `Objective: Generate **ten (10) high-depth, intellectually stimulating multiple-choice questions (MCQs)** rigorously designed for effective studying and knowledge assessment. These questions MUST be based *exclusively* on the provided text content. They are required to probe deep understanding, critical analysis, and application of the material, extending significantly beyond elementary recall.

Input Text (excerpt for question generation):
---
${extractedText.slice(0, MAX_INPUT_CHARS_QUESTIONS)}
---
(Context Only Key Points: ${keyPoints.join('; ')})

**Mandatory Instructions:**

1.  **Quantity & Scope:** Generate **exactly 10** distinct MCQs. Collectively, these 10 questions MUST cover a **broad range** of the core concepts, arguments, and significant details presented throughout the *entire* provided text excerpt. Do not concentrate all questions on a single paragraph or idea.
2.  **Strict Formatting:** Adhere **unfailingly** to the following format for *each* of the 10 questions. Separate each complete question block *only* with '---DIVIDER---'. No extra text before the first question or after the last divider.
    Question: [Your insightful question requiring analysis, application, or interpretation of the text]
    A) [Option A - Highly plausible distractor, incorrect based *only* on the text]
    B) [Option B - Highly plausible distractor, incorrect based *only* on the text]
    C) [Option C - The single, unambiguously correct answer, directly supported or inferred *only* from the text]
    D) [Option D - Highly plausible distractor, incorrect based *only* on the text]
    Correct: [Correct Answer Letter (A, B, C, or D)]
    Explanation: [Detailed explanation justifying the correct answer by referencing specific evidence or logic within the text, AND concisely explaining why *each* distractor is textually incorrect.]
3.  **Cognitive Depth & Quality (Non-Negotiable):**
    *   **Required Question Types:** Focus exclusively on questions demanding: Analysis, Application, Interpretation, Evaluation/Critique (if text supports).
    *   **Strictly Prohibited:** Generate ZERO questions that are simple definitions, fill-in-the-blanks, trivial facts, or answerable without understanding core concepts.
    *   **Distractor Design:** Incorrect options MUST be sophisticated, relevant, plausibly confusable, representing common misunderstandings based *only* on the provided text. Avoid obviously wrong options.
    *   **Text-Bound:** All elements MUST be derivable *solely and exclusively* from the provided text excerpt. NO external knowledge. Explanations must pinpoint textual evidence.
    *   **Clarity & Precision:** Ensure flawless grammar, unambiguous wording, and precise terminology as used in the text.

Generate **exactly 10** MCQs fulfilling **all** these stringent requirements using the '---DIVIDER---' separator. Focus on cognitive depth and textual accuracy. Produce a challenging set of study questions.
---DIVIDER---
`; // END OF QUESTION PROMPT

        const questionsOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: questionsPrompt }] }],
                generationConfig: {
                    temperature: 0.5, // Balanced temperature for plausible options/explanations
                    maxOutputTokens: 4096 // Increased tokens for 10 detailed questions + explanations
                }
                // Add safety settings if needed
            })
        };

        let questions: ProcessedPDF['questions'] = []; // Initialize as empty
        try {
            const questionsResponse = await fetchWithRetry(GEMINI_ENDPOINT, questionsOptions);
            const questionsResponseText = await questionsResponse.text();
            const questionsRawText = extractCandidateText(questionsResponseText);

            if (questionsRawText.startsWith("Error:")) {
                // Let the main catch block handle this to provide a fallback question
                 throw new Error(`Question Generation Failed: ${questionsRawText}`);
            }

            // Improved Parsing Logic for the strict format
            const questionBlocks = questionsRawText.split(/---DIVIDER---/i);
            console.log(`Attempting to parse ${questionBlocks.length -1} potential question blocks (split result).`); // Debugging

            for (const block of questionBlocks) {
                if (questions.length >= 10) break; // Stop if we have 10 valid questions

                const trimmedBlock = block.trim();
                if (trimmedBlock.length < 50) continue; // Skip empty or very short blocks

                // More precise Regex based on the required format
                const questionMatch = trimmedBlock.match(/^Question:\s*([\s\S]*?)\s*\nA\)\s/i);
                const optionsMatch = trimmedBlock.match(/\nA\)\s*([\s\S]*?)\s*\nB\)\s*([\s\S]*?)\s*\nC\)\s*([\s\S]*?)\s*\nD\)\s*([\s\S]*?)\s*\nCorrect:/is);
                const correctMatch = trimmedBlock.match(/\nCorrect:\s*([A-D])\s*\nExplanation:/i);
                const explanationMatch = trimmedBlock.match(/\nExplanation:\s*([\s\S]*)$/i); // Match to the end of the block

                if (questionMatch?.[1] && optionsMatch?.[1] && optionsMatch?.[2] && optionsMatch?.[3] && optionsMatch?.[4] && correctMatch?.[1] && explanationMatch?.[1]) {
                    const questionText = questionMatch[1].trim();
                    // Trim options individually and ensure they don't accidentally include the next label
                    const optionsList = [
                        optionsMatch[1], optionsMatch[2], optionsMatch[3], optionsMatch[4]
                    ].map(opt => opt.trim());

                    const correctLetter = correctMatch[1].toUpperCase() as ('A' | 'B' | 'C' | 'D'); // Type assertion
                    const explanationText = explanationMatch[1].trim();

                    // Add stronger validation before pushing
                    if (questionText.length > 5 &&
                        optionsList.length === 4 &&
                        optionsList.every(o => o && o.length > 0) && // Ensure options are not empty
                        ['A', 'B', 'C', 'D'].includes(correctLetter) &&
                        explanationText.length > 10) // Ensure explanation has some substance
                    {
                        questions.push({
                            question: questionText,
                            options: optionsList,
                            correctAnswer: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
                            explanation: explanationText,
                        });
                    } else {
                         console.warn("Skipping partially parsed/invalid question block:", { blockStart: trimmedBlock.substring(0, 100) + '...' }); // Log start of invalid block
                    }
                } else {
                     if(trimmedBlock) { // Only warn if the block wasn't just whitespace
                        console.warn("Structure mismatch in question block, skipping:", trimmedBlock.substring(0, 150) + '...');
                     }
                }
            } // End parsing loop

            console.log(`Successfully parsed ${questions.length} valid questions.`);

            if (questions.length === 0) {
                 throw new Error("No valid questions could be parsed from the AI response. The format might be incorrect.");
            } else if (questions.length < 10) {
                 const errMsg = `Successfully parsed only ${questions.length}/10 requested questions.`;
                 console.warn(errMsg);
                 safeProgress({ progress: 95, status: `Generated ${questions.length}/10 questions. Finalizing...`, error: errMsg });
            } else {
                 safeProgress({ progress: 95, status: 'Study questions generated.', error: null }); // Clear previous error
            }

        } catch (questionsError) {
            const errorMsg = questionsError instanceof Error ? questionsError.message : 'Unknown questions error';
            console.error('Questions generation or parsing error:', questionsError);
            safeProgress({ progress: 95, status: 'Questions generation/parsing failed.', error: errorMsg });
            // Provide a fallback question only if the array is completely empty after the attempt
            if (questions.length === 0) {
                questions = [{
                    question: 'Study questions could not be generated or parsed for this document.',
                    options: ['Ok', 'Understood', 'Review Manually', 'N/A'],
                    correctAnswer: 0,
                    explanation: `An error occurred during question generation or parsing: ${errorMsg}`
                }];
            }
        }
        // --- End Question Generation ---


        safeProgress({ progress: 98, status: 'Finalizing results...', error: null });

        // --- Return Processed Data ---
        safeProgress({ progress: 100, status: 'Processing complete!', error: null });
        return {
            title: file.name.replace(/\.pdf$/i, ''),
            content: detailedNoteContent, // Use the detailed note content (or error message)
            keyPoints, // Use generated key points (or error message)
            questions, // Use generated questions (or fallback)
            sourceUrl: pdfUrl,
            // extractedText: extractedText // Uncomment to include full text in the result for debugging
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
        console.error('Overall PDF processing failed:', error);
        // Ensure progress indicates failure clearly, even if it reached 100 momentarily before throwing
        safeProgress({ progress: 100, status: 'Processing Failed', error: errorMessage });
        // Re-throw the error to ensure the calling function knows the promise rejected
        throw new Error(`PDF Processing Failed: ${errorMessage}`);
    }
}
