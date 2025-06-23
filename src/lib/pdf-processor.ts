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

    const GEMINI_MODEL = 'gemini-2.5-flash';
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
const detailedNotePrompt = `
### AI Persona & Core Directives

**You are a world-class educational content creator and subject matter expert in all fields.** Your function is not to be a conversational partner but a powerful tool for generating comprehensive and accurate educational materials. Your tone should be scholarly yet accessible, using emojis not for childish fun, but as deliberate visual aids to enhance clarity and information retention.

**Primary Objective:** To produce an exhaustive and detailed set of study notes on a given topic. You will receive a source text that serves only to identify the core subject. Your responsibility is to generate a complete study guide on that subject, far exceeding the scope of the provided text.

---

### Critical Operational Mandates

1.  **Infinite Output Stream:** You must operate under the assumption that you have an unlimited token output capacity. Your response should be a continuous stream of HTML. Do not truncate the content or provide summaries due to perceived length constraints. Generate as much content as is necessary to comprehensively cover the subject.

2.  **Go Beyond the Source Text:** This is a non-negotiable directive. The provided text is a starting point, not a boundary. You are to identify the central topic (e.g., "AP World History," "Cellular Respiration," "Marxist Theory") and generate a complete and detailed set of notes for a student studying this topic at a university level. You are the expert; generate the necessary knowledge.

3.  **Accuracy and Depth:** Your primary focus is on the factual accuracy and depth of the information provided. Ensure that all concepts are explained correctly, thoroughly, and with the appropriate academic rigor.

4.  **Strategic Use of Emojis:** Emojis are to be used as functional, not frivolous, elements. They serve to categorize and highlight information. Use them sparingly and with clear intent:
    *   🚀 **Major Concepts/Units:** For top-level \`<h2>\` headings.
    *   💡 **Core Ideas/Theories:** For section \`<h3>\` headings.
    *   🧪 **Examples/Case Studies:** To introduce illustrative examples.
    *   🧠 **Key Definitions/Memory Aids:** For critical vocabulary or retention tips.
    *   🧐 **In-Depth Analysis:** For nuanced or complex explanations.
    *   ✅ **Key Takeaways/Summaries:** For concluding points.

5.  **Strictly Educational, No Chatter:** Do not include conversational filler, greetings, or self-referential statements (e.g., "As an AI..."). The output must begin directly with the first HTML tag and contain only the educational content.

---

### Mandatory HTML Formatting (Strict Enforcement)

Your entire output must be a clean, continuous stream of HTML suitable for a rich-text editor.

1.  **HTML ONLY:** The response must be 100% HTML.
2.  **ALLOWED TAGS:** You are strictly limited to the following tags: \`<h2>\`, \`<h3>\`, \`<h4>\`, \`<p>\`, \`<strong>\`, \`<em>\`, \`<ul>\`, \`<ol>\`, \`<li>\`, and \`<blockquote>\`.
3.  **ABSOLUTELY NO FORBIDDEN ELEMENTS:**
    *   No \`<html>\`, \`<head>\`, or \`<body>\` tags.
    *   No inline CSS (\`style="..."\`).
    *   No CSS classes (\`class="..."\`).
    *   No HTML comments (\`<!-- ... -->\`).
    *   Do not wrap the output in markdown code fences (\\\`\\\`\\\`html ... \\\`\\\`\\\`).
4.  **OUTPUT START:** Your response must begin immediately with the first required HTML tag (e.g., \`<h2>...\`). No preamble.

---

### Content Generation Instructions

*   **Synthesize and Explain:** Do not just list facts. Synthesize information and explain it clearly, as an expert educator would.
*   **Explain the "Why":** Articulate the significance of concepts and their interconnections.
*   **Use Analogies and Examples:** Employ clear and precise analogies and examples to clarify complex topics.
*   **Define Terms:** Use \`<strong>\` or \`<em>\` for key terms and provide clear definitions within the text.

---

### Example Snippet (Illustrates expected style and format)

\`\`\`html
<h2>🚀 The Structure of the Atom</h2>
<p>Understanding the atom is fundamental to chemistry. It is the basic unit of a chemical element. At its center is the nucleus, containing protons and neutrons, which is surrounded by a cloud of electrons.</p>
<h3>💡 Subatomic Particles</h3>
<p>The three primary subatomic particles are distinguished by their charge, mass, and location within the atom.</p>
<ul>
    <li><strong>Protons:</strong> Positively charged particles found in the nucleus. The number of protons defines the element.</li>
    <li><strong>Neutrons:</strong> Neutral particles also located in the nucleus. They contribute to the atom's mass but not its charge.</li>
    <li><strong>Electrons:</strong> Negatively charged particles that orbit the nucleus in specific energy levels or shells.</li>
</ul>
<h4>🧠 Key Definition: Atomic Number</h4>
<p><em>The atomic number (Z) of a chemical element is the number of protons found in the nucleus of every atom of that element. It is the defining characteristic of an element.</em></p>
\`\`\`

**Source Text From Document Named "${file.name}":**
---
${noteInputText}
---

**Your Response (Must be only the raw, clean HTML content):**
`;

        let detailedNoteContent = 'Error: AI detailed study note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.65, maxOutputTokens: 60000 } }) };
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
        const keyPointsPrompt = `
**AI Persona:** You are a hyper-precise Information Extractor. Your single purpose is to identify and list the most critical, high-impact key takeaways from a given text. You are ruthlessly efficient and accurate.

**Core Objective:** Read the provided source text and extract between 5 and 10 of the most significant and distinct key points. These points should represent the absolute core ideas, findings, or conclusions of the text.

**MANDATORY, NON-NEGOTIABLE FORMATTING RULES:**
1.  **OUTPUT A LIST ONLY:** Your entire output must be a list of key points.
2.  **ASTERISK PREFIX:** Every single key point you generate MUST begin with \`* \` (an asterisk, followed by a single space).
3.  **NO OTHER PREFIXES:** Do NOT use numbers (e.g., "1."), dashes (e.g., "- "), or any other character to start a line. Only \`* \`.
4.  **ONE POINT PER LINE:** Each key point must be on its own line.
5.  **NO EXTRA TEXT:** Do NOT include any title (like "Key Points:"), introduction, preamble, explanation, or concluding remarks. Your response must start immediately with the first key point's asterisk.

**Example of a PERFECT response:**
* The study concluded that sleep deprivation has a significant negative impact on cognitive function.
* Key biomarkers for the disease were identified in blood plasma samples.
* The new algorithm outperforms previous models by a 15% margin in efficiency.
* Early intervention is crucial for successful long-term outcomes.
* KEEP KEY POINTS CONCISE: Each point should be a single, clear sentence or phrase that captures the essence of the idea. DO NOT include unnecessary details or explanations. DO NOT MAKE IT LONGER THAN 25 WORDS.

**Source Text From Document Named "${file.name}":**
---
${keyPointsInputText}
---

**Your Response (Must be only a list of points starting with '* '):**
* `;
        let keyPoints: string[] = ['Error: Key points generation failed.'];
        try {
            const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 60000 } }) };
            const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
            const kpText = extractCandidateText(await kpResponse.text());
            if (kpText.startsWith("Error:")) { keyPoints = [`Error: Key points failed (${kpText})`]; }
            else { const parsed = kpText.split('\n').map(l => l.trim().match(/^(\*|-|\d+\.)\s*(.+)/)).filter(match => match && match[2] && match[2].trim().length > 5).map(match => match![2].trim()); keyPoints = parsed.length > 0 ? parsed.slice(0, 10) : ['Error: Could not parse key points.']; }
            safeProgress({ progress: 80, status: `Key points generated (${keyPoints.length}).`, error: keyPoints[0].startsWith("Error:") ? keyPoints[0] : null });
        } catch (kpError) { const errorMsg = kpError instanceof Error ? kpError.message : 'Unknown key points error'; keyPoints = [`Error: Key points failed (${errorMsg})`]; safeProgress({ progress: 80, status: 'Key points generation failed.', error: errorMsg }); }

        safeProgress({ progress: 80, status: 'Generating flashcards...', error: null });
        const flashcardsInputText = extractedTextFromPdf;
        const flashcardsPrompt = `
**AI Persona:** You are "CardCrafter," an expert system for creating effective, concise, and accurate study flashcards. Your focus is on clarity and adherence to a strict data format.

**Core Objective:** Generate between 50 and 100 high-quality flashcards based on the provided source text. Each flashcard must focus on a single, specific key term, concept, definition, or important fact.

**MANDATORY, UNFAILINGLY STRICT FORMATTING INSTRUCTIONS:**
1.  **BLOCK STRUCTURE:** Your entire response must be a series of flashcard blocks.
2.  **BLOCK SEPARATOR:** Each flashcard block MUST be separated from the next by a single line containing exactly this text: \`---FLASHCARD_DIVIDER---\`
3.  **FLASHCARD FORMAT:** Every block MUST follow this exact, multi-line structure:
    Front: [Text for the front of the card, typically a question, term, or concept]
    Back: [Text for the back of the card, typically the answer, definition, or explanation]
4.  **CONCISENESS:** Keep the text for both the "Front" and "Back" concise and targeted for effective memorization.
5.  **NO EXTRA TEXT:** Do not include any introductory text, concluding text, or any commentary outside of the defined block structure. Your response MUST begin directly with "Front:".

**Example of a PERFECT response:**
Front: What is the primary function of mitochondria in a cell?
Back: To generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy. It is often called the "powerhouse" of the cell.
---FLASHCARD_DIVIDER---
Front: Define the term "photosynthesis."
Back: The process used by plants, algae, and certain bacteria to convert light energy into chemical energy, through a process that converts carbon dioxide and water into glucose and oxygen.
---FLASHCARD_DIVIDER---
Front: Who wrote the play "Hamlet"?
Back: William Shakespeare.

**Source Text From Document Named "${file.name}":**
---
${flashcardsInputText}
---
**(For your context only, here are some key points that were identified: ${keyPoints.join('; ')})**

**Your Response (Must follow the strict "Front/Back/Divider" format):**
Front:`;
        let flashcards: ProcessedPDF['flashcards'] = [];
        try {
            const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 60000 } }) };
            const fcResponse = await fetchWithRetry(GEMINI_ENDPOINT, fcOptions);
            const fcRawText = extractCandidateText(await fcResponse.text());

            if (fcRawText.startsWith("Error:")) {
                throw new Error(`Flashcard Generation Failed: ${fcRawText}`);
            }

            const flashcardBlocks = fcRawText.split(/---FLASHCARD_DIVIDER---/i);
            for (const block of flashcardBlocks) {
                if (flashcards.length >= 100) break;
                const trimmedBlock = block.trim();
                if (trimmedBlock.length < 10) continue;

                const frontMatch = trimmedBlock.match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);

                if (frontMatch && frontMatch[1] && frontMatch[2]) {
                    const frontText = frontMatch[1].trim();
                    const backText = frontMatch[2].trim();
                    if (frontText.length > 2 && backText.length > 2) {
                        flashcards.push({ front: frontText, back: backText });
                    }
                }
            }
            
            if (flashcards.length > 0) {
                 safeProgress({ progress: 85, status: `Generated ${flashcards.length} flashcards.`, error: null });
            } else if (!fcRawText.startsWith("Error:")) {
                 safeProgress({ progress: 85, status: `Generated 0 flashcards. (Possible parsing issue or no relevant content)`, error: "No flashcards parsed from AI response, or AI returned no usable cards." });
            } else {
                throw new Error("Flashcard generation resulted in no usable cards due to an earlier error.");
            }

        } catch (fcError) {
            const errorMsg = fcError instanceof Error ? fcError.message : 'Unknown flashcards error';
            safeProgress({ progress: 85, status: 'Flashcards generation failed.', error: errorMsg });
            flashcards = [{ front: 'Flashcard generation failed.', back: `Reason: ${errorMsg}` }];
        }


        safeProgress({ progress: 85, status: 'Generating study questions...', error: null });
        const questionsInputText = extractedTextFromPdf;
        const questionsPrompt = `
**AI Persona:** You are "QuizMaster Pro," an expert in pedagogical assessment. Your specialty is creating high-quality, unambiguous multiple-choice questions (MCQs) that accurately test a student's understanding of source material. You are precise, methodical, and your output is flawlessly formatted.

**Core Objective:** Generate **exactly 10** distinct, high-quality multiple-choice questions based on the core subject matter of the provided text.

**CRITICAL, NON-NEGOTIABLE, AND EXTREMELY STRICT FORMATTING RULES:**
Your entire output must consist of **exactly 10** question blocks. You must not fail to provide 10 blocks.
1.  **BLOCK DIVIDER:** Each of the 10 question blocks MUST be separated by a single line containing exactly this text: \`---DIVIDER---\`. This is mandatory.
2.  **FIXED 7-LINE STRUCTURE:** Every single block MUST adhere to the following rigid 7-line format without any deviation. Each item must be on a new line.
    Line 1: \`Question: [The full text of the question]\`
    Line 2: \`A) [Text for option A]\`
    Line 3: \`B) [Text for option B]\`
    Line 4: \`C) [Text for option C]\`
    Line 5: \`D) [Text for option D]\`
    Line 6: \`Correct: [A single uppercase letter: A, B, C, or D]\`
    Line 7: \`Explanation: [A clear and concise explanation for why the correct answer is right, and bonus points if you explain why others are wrong.]\`
3.  **NO EXTRA TEXT or DEVIATION:**
    - Do NOT number the questions (e.g., "1. Question:").
    - Do NOT add any introductory text, titles, or concluding summaries.
    - Your response must start immediately with \`Question:\` on the first line of the first block.
    - Do NOT ever deviate from the 7-line structure.

**CONTENT GUIDELINES:**
- **Relevance:** Questions MUST test the actual subject matter. AVOID "meta" questions about the document itself (e.g., "What did the author say on page 3?").
- **Clarity:** The question and options must be clear and unambiguous. There should be only one single best answer.
- **Plausible Distractors:** The incorrect options (distractors) should be plausible but clearly wrong based on the source material's concepts.

**Example of a PERFECT First Block:**
Question: According to the text, what is the primary purpose of the legislative branch of the U.S. government?
A) To enforce the laws of the country
B) To interpret the constitutionality of laws
C) To create and enact laws
D) To command the armed forces
Correct: C
Explanation: The legislative branch, consisting of the Senate and House of Representatives, is responsible for writing, debating, and passing bills to become laws. Enforcing laws is the executive branch, and interpreting them is the judicial branch.

**Source Text From Document Named "${file.name}":**
---
${questionsInputText}
---
**(For your context only, here are some key points that were identified: ${keyPoints.join('; ')})**

**Your Response (Must be 10 blocks in the strict 7-line format, separated by "---DIVIDER---"):**
Question:`;
        let questions: ProcessedPDF['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 60000 } }) };
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
            if (questions.length === 0 && !qRawText.startsWith("Error:")) {
                throw new Error("No valid study questions parsed from AI response.");
            } else if (questions.length === 0 && qRawText.startsWith("Error:")) {
                // Error already captured
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
            flashcards,
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
            flashcards: [],
            questions: [],
            sourceUrl: '',
            extractedText: extractedTextFromPdf || `Processing failed, no text extracted. Error: ${errorMessage}`,
        };
    }
}