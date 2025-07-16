import { getDocument, PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

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
            return jsonResponse.candidates[0].content.parts[0].text;
        }
        if (jsonResponse?.promptFeedback?.blockReason) {
            return `Error: Request blocked for reason: ${jsonResponse.promptFeedback.blockReason}`;
        }
        return "Error: No text found in the expected AI response structure.";
    } catch (err) {
        if (responseText.toLowerCase().includes("api key not valid")) return "Error: Invalid API Key.";
        return "Error: Could not parse the AI response.";
    }
};

export async function processPDF(
    file: File,
    userId: string,
    geminiApiKeyParam: string,
    onProgress: (progress: number) => void
): Promise<ProcessedPDF> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};

    if (!geminiApiKeyParam || typeof geminiApiKeyParam !== 'string' || geminiApiKeyParam.trim() === '') {
        throw new Error('Gemini API Key missing or invalid in processPDF.');
    }

    const GEMINI_MODEL = 'gemini-2.5-flash';
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKeyParam}`;
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

        const titlePrompt = `Analyze the following text extracted from a document. Your single task is to generate a concise, descriptive, and relevant title for this document. The title should be no more than 5 words. Do not add any extra text, explanation, or quotation marks. Output only the title itself. THE title cannot be "Copyright and Terms of Use" or anything like that. IT MUST BE BASED ON THE TEXT. IT MUST BE A USEFUL TITLE. NOT JUST A BUNCH OF WORDS. TEXT: """${extractedTextFromPdf.slice(0, 4000)}""" TITLE:`;
        const titleOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: titlePrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 65536 } }) };
        const titleResponse = await fetchWithRetry(GEMINI_ENDPOINT, titleOptions);
        let title = extractCandidateText(await titleResponse.text()).replace(/["']/g, "").trim() || file.name.replace(/\.pdf$/i, '');
        safeProgress(65);

const notePrompt = `🧠 ROLE:
You are a world-class academic note-writer and subject matter expert across multiple disciplines. Your job is to generate extraordinarily high-quality, university-level study notes based on the given source. These notes must be richly informative, pedagogically structured, and visually engaging — the kind of content students rely on to **truly understand** and **retain** complex material.

🏆 OUTPUT GOAL:
Produce an exhaustive, highly structured, and visually appealing set of study notes. These notes should:
- Provide complete conceptual clarity.
- Feel like premium textbook content, but better organized and more digestible.
- Be optimized for fast learning and deep understanding.
- Include visuals (emojis), structure (headings, lists, tables), and clarity-enhancing elements.

This is not summarization. This is **intelligent expansion and transformation** of the topic into gold-standard academic material.

📌 CORE RULES FOR CONTENT CREATION:

1. 🧠 USE OF SOURCE:
   - Use the input text **only** to identify the topic and subtopics.
   - Then **draw on your own extensive academic knowledge** to build comprehensive notes.
   - Do **not repeat or rephrase** the raw text. Instead, generate rich, fresh content based on the topic.
   - Assume your reader is a student looking to master the topic at a high level.
   - IF THE SOURCE TEXT IS ABOUT INSTRUCTIONS ABOUT AN EXAM OR TEST, LIKE FOR EXAMPLE, IF THE SOURCE TEXT IS SOMETHING ABOUT THE AP STATISTICS EXAM FORMAT, YOU MUST MAKE THE NOTES ABOUT AP STATISTICS THE COURSE ITSELF -> MEANING YOU MUST EXPLAIN ABOUT THE CONTENT OF THAT COURSE LIKE THE ACTUAL MATERIALS AND TERMS, NOT ANYTHING TO DO WITH THE ACTUAL STRUCTURE OF THE EXAM. THIS APPLIES NOT JUST FOR EXAMS, BUT TESTS, AND ANY OTHER MATERIAL LIKE THAT. FAILURE TO DO THIS MAY RESULT IN TERMINATION.

2. 💡 TONE AND STYLE:
   - Clear, confident, instructional tone.
   - Never vague or generic — always detailed, specific, and content-dense.
   - Use academic language, but make it engaging.
   - Do NOT include any meta-commentary, process explanation, or references to yourself, the AI, or the user. 

3. ✨ VISUAL STRUCTURE & ENGAGEMENT:
   - Use clean, hierarchical formatting.
   - **<h1>** for major sections (main concepts/themes).
   - **<h2>** and **<h3>** for subtopics, examples, methods, or related ideas.
   - Use <p> for full paragraphs of explanation.
   - Use <ul>/<ol> for steps, lists, or key points.
   - Use <blockquote> for important insights or definitions.
   - Use <table> for comparisons, categorizations, or structured data.
   - Add **bold** and *italic* formatting for emphasis and clarity.
   - Use spacing and indentation naturally to guide the eye.

4. 🌟 EMOJI USAGE:
   - Use emojis strategically and sparingly to:
     - Highlight or introduce new sections 💡
     - Mark warnings or key ideas ⚠️
     - Show processes or steps 🔁➡️
     - Represent topics visually 🧬🔢📊🌍🧪
   - DO NOT overuse emojis. They must aid reading, not distract from it.
   - DO NOT repeat the same emoji repeatedly in one section.

5. 📚 CONTENT QUALITY EXPECTATIONS:
   - Define all important terms clearly and completely.
   - Explain each concept thoroughly, including background, usage, and implications.
   - Provide examples, analogies, or applications where useful.
   - Connect ideas across the topic to show relationships and frameworks.
   - If the topic is mathematical or logical, include formulas and walk through their meaning.

6. 🔣 MATH FORMAT — LaTeX ONLY:
   - Any math expressions, logic, chemistry, physics, etc. must use proper LaTeX syntax.
   - Inline math → wrap in single dollar signs: $...$
   - Block equations → wrap in double dollar signs: $$...$$
   - Do not describe math — express it cleanly in LaTeX for clarity and rendering.

7. 🧼 FORMATTING RULES (STRICT):
   ✅ ALLOWED TAGS ONLY:
     - <h1>, <h2>, <h3>, <h4>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td> 

   🚫 DO NOT USE:
     - <html>, <head>, <body>, <div>, <span>, <style>, <script>, or any inline styles like style="..." or class="..."
     - No markdown formatting. HTML only.
     - No links unless they are part of academic citation, which is rare and discouraged.
     - No embedded media — the result must be copy-pasteable into a rich text editor.
     - No <h5> or higher tags. MAX is <h4>. 

8. ❗ ABSOLUTELY PROHIBITED:
   - Do NOT refer to yourself, your process, or the original source.
   - Do NOT include commentary like “Here’s what we can learn…” or “Let’s break this down…”
   - Do NOT explain what you’re doing — just do it.
   - Do NOT wrap your output in triple backticks or any markdown syntax.

9. 📄 FINAL OUTPUT:
   - Output ONLY the HTML content. It should begin immediately with a valid HTML tag such as <h1> or <p>.
   - The entire response must be a single, continuous HTML document — clean, readable, structured, and content-rich.

🧾 SOURCE TEXT from "${file.name}":
---
${extractedTextFromPdf}
---

🔽 YOUR TASK:
Use the source text ONLY to identify the subject. Then generate a complete, exhaustive, beautifully formatted HTML study guide, entirely from your own knowledge, following all the rules above.

🚫 DO NOT EXPLAIN ANYTHING.
🚫 DO NOT PROVIDE ANY META-COMMENTARY.
🚫 OUTPUT ONLY THE RAW HTML.
🚫 NO MARKDOWN.

✅ START NOW. FIRST OUTPUT ELEMENT MUST BE AN HTML TAG (e.g. <h2>):`;

        const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: notePrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 65536 } }) };
        const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
        let content = extractCandidateText(await noteResponse.text());
        if (content.startsWith("Error:")) { content = `<p><strong>Error generating note:</strong> ${content}</p>`; }
        safeProgress(75);

        const keyPointsPrompt = `You are a precision information extractor. Your task is to identify and list 5 to 10 of the most critical, high-impact key takeaways from the provided text. These points must represent the absolute core concepts and conclusions. DO NOT write about the instructions or the act of making key points; focus ONLY on the subject matter of the text.

MANDATORY FORMATTING RULES:
1.  LIST ONLY: Your entire output must be a list of key points.
2.  ASTERISK PREFIX: Every key point MUST begin with \`* \` (an asterisk followed by a space).
3.  ONE POINT PER LINE: Each key point must be on its own line.
4.  CONCISE AND POWERFUL: Each point must be a single, clear sentence under 25 words.
5.  NO EXTRA TEXT: Do not include any titles, introductions, or summaries. Start immediately with the first asterisk.


    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWYAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${extractedTextFromPdf}
---
Your Response (Must be only a list of points starting with '* '):
* `;
        const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 65536 } }) };
        const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
        let keyPoints = (extractCandidateText(await kpResponse.text())).split('\n').map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '')).filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
        if (keyPoints.length === 0) { keyPoints.push("Key point generation failed or returned no valid points."); }
        safeProgress(80);

        const flashcardsPrompt = `You are CardCrafter, an expert system for creating 50-100 high-quality study flashcards from source text.

MANDATORY FORMATTING (NO DEVIATIONS):
1.  BLOCK SEPARATOR: Each flashcard block MUST be separated by a single line with exactly: \`---FLASHCARD_DIVIDER---\`
2.  FLASHCARD FORMAT: Every block must use this exact multi-line structure:
    Front: [Text for the front of the card]
    Back: [Text for the back of the card]
3.  NO EXTRA TEXT: Your response must begin directly with "Front:".

    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWYAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${extractedTextFromPdf}
---
Your Response (Must follow the strict "Front/Back/Divider" format):
Front:`;
        const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 65536 } }) };
        const fcResponse = await fetchWithRetry(GEMINI_ENDPOINT, fcOptions);
        // FIX: Prepend "Front: " to the raw text to ensure the first card is parsed correctly.
        const fcRawText = "Front: " + extractCandidateText(await fcResponse.text());
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

    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${extractedTextFromPdf}
---
Your Response (Must be 10 blocks in the strict 7-line format):
Question:`;
        const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 65536 } }) };
        const qResponse = await fetchWithRetry(GEMINI_ENDPOINT, qOptions);
        const qRawText = extractCandidateText(await qResponse.text());
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
