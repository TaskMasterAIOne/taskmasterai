// *** Import getDocument AND pdfjs from pdfjs-dist ***
// NOTE: pdfjs-dist/build/pdf includes the workerSrc setup needed for environments like web browsers.
// If running in Node.js or similar where workerSrc isn't automatically handled, you might need manual config.
// import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf'; // Use this for explicit worker path
// import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'; // Use this for explicit worker path
import { getDocument } from 'pdfjs-dist'; // Keep this simple import if your bundler/environment handles worker loading
import { createWorker } from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// *** Uncomment and configure if needed (e.g., Vite, Webpack, Node.js) ***
// Sets up the worker source for PDF.js. Adjust the path based on your build setup.
// If using a CDN:
// GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
// If using local build:
// GlobalWorkerOptions.workerSrc = pdfjsWorker; // Requires the pdfjsWorker import above

// Interface definitions remain the same
interface ProcessingProgress { progress: number; status: string; error: string | null; }
interface ProcessedPDF { title: string; content: string; keyPoints: string[]; questions: { question: string; options: string[]; correctAnswer: number; explanation: string; }[]; sourceUrl: string; extractedText?: string; }

// Helper functions (sleep, fetchWithRetry, extractCandidateText - remain the same)
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> { for (let attempt = 0; attempt < retries; attempt++) { try { const response = await fetch(url, options); if (!response.ok && (response.status === 429 || response.status >= 500)) { console.warn(`Attempt ${attempt + 1} failed: ${response.status}. Retrying...`); await sleep(delayMs * (attempt + 1)); continue; } return response; } catch (error) { console.error(`Attempt ${attempt + 1} fetch error:`, error); if (attempt === retries - 1) throw error; await sleep(delayMs * (attempt + 1)); } } throw new Error(`Max retries reached: ${url}`); }
const extractCandidateText = (responseText: string): string => { try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { console.error("Gemini API Error:", jsonResponse.error.message); return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') { console.warn(`Gemini finish reason: ${jsonResponse.candidates[0].finishReason}`); // Handle potential truncation or other non-stop reasons
        if (jsonResponse.candidates[0].finishReason === 'MAX_TOKENS') { return (jsonResponse.candidates[0]?.content?.parts?.[0]?.text || '') + "\n\n[Error: Output truncated due to maximum token limit]"; } return `Error: Generation stopped (${jsonResponse.candidates[0].finishReason})`; } return "Error: No text found."; } catch (err) { console.error('Error parsing Gemini response:', err); return "Error: Cannot parse AI response."; } };

// processPDF function starts here...
export async function processPDF( file: File, userId: string, geminiApiKey: string, onProgress: (progress: ProcessingProgress) => void ): Promise<ProcessedPDF> {
  const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
  if (!geminiApiKey) { safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing.' }); throw new Error('Gemini API Key missing.'); }

  // Use a Gemini 1.5 model for larger context and potentially better long-form generation.
  // Use flash for speed/cost, or consider 'gemini-1.5-pro-latest' for potentially higher quality at higher cost.
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

  let extractedText = '';

  try {
    safeProgress({ progress: 0, status: 'Starting PDF processing...', error: null });
    const fileId = uuidv4(); const fileRef = ref(storage, `pdfs/${userId}/${fileId}-${file.name}`); await uploadBytes(fileRef, file); const pdfUrl = await getDownloadURL(fileRef);
    safeProgress({ progress: 10, status: 'PDF uploaded, loading...', error: null });


    const arrayBuffer = await file.arrayBuffer();
    // Ensure PDF worker is configured if necessary (see comments at top)
    const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    safeProgress({ progress: 15, status: 'Extracting text...', error: null }); const numPages = pdf.numPages;
    for (let pageNum = 1; pageNum <= numPages; pageNum++) { try { const page = await pdf.getPage(pageNum); const content = await page.getTextContent(); extractedText += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n'; } catch (e) { console.warn(`Error extracting text page ${pageNum}:`, e); extractedText += `[Text extraction failed page ${pageNum}]\n\n`; } safeProgress({ progress: 15 + Math.round((pageNum / numPages) * 25), status: `Extracting text: Page ${pageNum}/${numPages}`, error: null }); }
    extractedText = extractedText.replace(/\s{3,}/g, ' ').trim();

    // Consider increasing the OCR threshold if standard text extraction often yields poor results
    const MIN_CHARS_PER_PAGE_BEFORE_OCR = 50; // Adjusted lower
    if (extractedText.length < MIN_CHARS_PER_PAGE_BEFORE_OCR * numPages && numPages > 0) {
      safeProgress({ progress: 40, status: 'Low text quality detected, attempting OCR...', error: null }); let ocrText = ''; const worker = await createWorker('eng');
      try { for (let pageNum = 1; pageNum <= numPages; pageNum++) { const page = await pdf.getPage(pageNum); const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 is good for OCR
                 const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas context creation failed'); canvas.height = viewport.height; canvas.width = viewport.width; await page.render({ canvasContext: context, viewport }).promise; const { data: { text } } = await worker.recognize(canvas); ocrText += text + '\n\n'; safeProgress({ progress: 40 + Math.round((pageNum / numPages) * 20), status: `Performing OCR: Page ${pageNum}/${numPages}`, error: null }); } extractedText = ocrText.replace(/\s{3,}/g, ' ').trim(); } catch (ocrError) { console.error('OCR processing failed:', ocrError); safeProgress({ progress: 60, status: 'OCR failed. Using initially extracted text (if any).', error: `OCR Error: ${ocrError instanceof Error ? ocrError.message : 'Unknown OCR error'}` }); // Report OCR error
            } finally { await worker.terminate(); }
    } else { safeProgress({ progress: 40, status: 'Text extraction complete.', error: null }); }

    if (!extractedText.trim()) {
        // Even after potential OCR, if there's no text, fail gracefully.
        safeProgress({ progress: 100, status: 'Error', error: 'No text could be extracted from the PDF, even after attempting OCR.' });
        throw new Error("Could not extract any text from PDF.");
    }

    // --- Detailed Note Generation ---
    safeProgress({ progress: 60, status: 'Generating detailed note...', error: null });

    // INCREASED INPUT SLICE: Use a larger portion (or potentially all) of the text for the main note.
    // Gemini 1.5 models have very large context windows (1M tokens for flash/pro).
    // Be mindful of potential API costs and processing time with very large inputs.
    // 150,000 chars is roughly ~37.5k tokens, well within 1.5's capability. Adjust as needed.
    const MAX_INPUT_CHARS_NOTE = 150000;
    const noteInputText = extractedText.slice(0, MAX_INPUT_CHARS_NOTE);
    if (extractedText.length > MAX_INPUT_CHARS_NOTE) {
        console.warn(`Note generation using first ${MAX_INPUT_CHARS_NOTE} characters due to input limit.`);
        // Optionally inform the user via progress update
        safeProgress({ progress: 61, status: `Generating detailed note (using first ${MAX_INPUT_CHARS_NOTE} chars)...`, error: null });
    }

   // REVISED PROMPT for exceptionally detailed and long notes, mirroring the example structure,
    // explicitly instructing on various Markdown formats including extended features, tables, and checking for diagram/graph support.
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
    *   **Diagrams/Graphs (Textual Representation):** Describe any diagrams, charts, or graphs mentioned in the text in **thorough detail**. Include: title, type (bar, line, pie, flow), axes labels, key data points, trends, relationships shown, and the overall conclusion or purpose of the visual as stated or implied by the text. **Do not** use placeholder language like "A graph shows...". *Describe* the graph's content and meaning. If the text provides data suitable for a simple textual chart (e.g., using characters or tables), attempt to create one.
    *   **Highlighting:** Use \`==highlighted text==\` *only* if the source text uses explicit visual highlighting (e.g., yellow marker) or extremely strong emphasis that needs special distinction beyond bold/italics.

3.  **Output Requirements:**
    *   Generate **only** the raw Markdown note content.
    *   **ABSOLUTELY NO** introductory sentences (e.g., "Here are the notes...") or concluding remarks.
    *   Begin the output *immediately* with the first Markdown element (likely a `# Heading`).
    *   Ensure the entire output is syntactically correct, highly structured, and information-rich Markdown.

**Input Text Content:**
---
${noteInputText}
---

**Generated Exhaustive Markdown Notes (Adhering Strictly to ALL Instructions):**
`; // No trailing characters

    let detailedNoteContent = 'AI detailed note generation failed.'; // Fallback content
    try {
        const noteOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: detailedNotePrompt }] }],
                generationConfig: {
                    temperature: 0.6, // Slightly higher temp might encourage more elaborate generation
                    // INCREASED MAX OUTPUT TOKENS: Set to a high value for the model.
                    // Gemini 1.5 models often support up to 8192 output tokens in a single turn.
                    // This allows for the very long notes requested.
                    maxOutputTokens: 8192
                }
            })
        };
        const noteResponse = await fetchWithRetry(GEMINI_ENDPOINT, noteOptions);
        const noteRawText = extractCandidateText(await noteResponse.text());

        if (noteRawText.startsWith("Error:")) {
             // Specific handling for errors from extractCandidateText
             if (noteRawText.includes("Output truncated due to maximum token limit")) {
                 detailedNoteContent = noteRawText; // Keep the truncated content and the error message
                 safeProgress({ progress: 75, status: 'Note generation partially complete (truncated).', error: 'Output may be incomplete due to token limit.' });
             } else {
                 throw new Error(noteRawText); // Throw other errors
             }
        } else if (noteRawText.trim().length < 50) { // Check if the response is suspiciously short
            console.warn("Generated note seems very short:", noteRawText);
            throw new Error("AI generated an unexpectedly short or empty note.");
        } else {
            detailedNoteContent = noteRawText.trim(); // Use the successfully generated long note
        }

    } catch (noteError) {
        console.error('Detailed note generation failed:', noteError);
        // Update progress but keep the fallback content
        safeProgress({
            progress: 75, // Still advance progress state
            status: 'Detailed note generation failed. Proceeding...',
            error: noteError instanceof Error ? noteError.message : 'Unknown detailed note generation error'
        });
        // Keep detailedNoteContent = 'AI detailed note generation failed.';
    }


    // --- Key Points Generation ---
    safeProgress({ progress: 75, status: 'Generating key points...', error: null });
    // Use a smaller slice for key points - focus on overall themes
    const MAX_INPUT_CHARS_KP = 20000; // ~5k tokens
    const keyPointsPrompt = `From the following text (extracted from PDF "${file.name}"), identify and list exactly 10 distinct and significant key points or main takeaways. Focus on the most crucial concepts, findings, or conclusions. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:". List only the points, one per line, starting each line with '* '.

Text Excerpt:
---
${extractedText.slice(0, MAX_INPUT_CHARS_KP)}
---

Key Points:
* ...`;
    let keyPoints: string[] = ['Key points generation failed.']; // Fallback
    try {
        const kpOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: keyPointsPrompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 1000 } // More tokens for potentially longer points
            })
        };
        const kpResponse = await fetchWithRetry(GEMINI_ENDPOINT, kpOptions);
        const kpText = extractCandidateText(await kpResponse.text());
        if (kpText.startsWith("Error:")) {
            console.error("Key Points Generation Error:", kpText);
            // Keep fallback
        } else {
            // Improved parsing: look for lines starting with common list markers, remove them, filter empty/short lines
            const parsed = kpText.split('\n')
                                .map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '').trim()) // Remove markers *, -, 1. etc.
                                .filter(p => p.length > 10); // Filter out very short lines/artifacts
            if (parsed.length > 0) {
                 keyPoints = parsed.slice(0, 10); // Take up to 10 valid points
                 if (keyPoints.length < 5) { // Warn if significantly fewer than 10 points were generated/parsed
                     console.warn(`Generated only ${keyPoints.length} key points.`);
                 }
            } else {
                 keyPoints = ['Could not parse valid key points from AI response.']; // More informative fallback
                 console.warn("No valid key points parsed from response:", kpText);
            }
        }
    } catch (kpError) {
        console.error('Key points fetch/processing error:', kpError);
        safeProgress({ progress: 85, status: 'Key points generation failed.', error: kpError instanceof Error ? kpError.message : 'Unknown key points error' });
        // Keep fallback: keyPoints = ['Key points generation failed.'];
    }


    // --- Question Generation (Using Reverted Logic) ---
    safeProgress({ progress: 85, status: 'Generating study questions...', error: null });
    // Use a moderate slice for questions - enough context but not overwhelming
    const MAX_INPUT_CHARS_QUESTIONS = 25000; // ~6k tokens

    const questionsPrompt = `Objective: Generate **ten (10) high-depth, intellectually stimulating multiple-choice questions (MCQs)** rigorously designed for effective studying and knowledge assessment. These questions MUST be based *exclusively* on the provided text content. They are required to probe deep understanding, critical analysis, and application of the material, extending significantly beyond elementary recall.

Input Text:
---
${extractedText.slice(0, MAX_INPUT_CHARS_QUESTIONS)}
---
(Context Only - Do Not Base Questions Solely Here: ${keyPoints.join('\n')})

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
    *   **Required Question Types:** Focus exclusively on questions demanding:
        *   **Analysis:** Break down information, identify relationships, differentiate components (e.g., "According to the text, what is the primary *relationship* between X and Y?").
        *   **Application:** Apply concepts or principles from the text to a related hypothetical situation (must remain solvable *solely* from the text, e.g., "Based on the criteria described, which of the following would qualify as Z?").
        *   **Interpretation:** Determine implications, meaning, or consequences suggested by the text (e.g., "The author implies that the main challenge is...?").
        *   **Evaluation/Critique (if text supports):** Assess the validity of an argument or compare methods *as presented within the text* (e.g., "Based on the text, a key limitation of Method A compared to Method B is...?").
    *   **Strictly Prohibited:** Generate **ZERO** questions that:
        *   Merely ask for a definition already stated verbatim.
        *   Are simple fill-in-the-blanks from text sentences.
        *   Test isolated, trivial facts devoid of conceptual context.
        *   Can be answered without genuinely understanding the text's core arguments or information.
    *   **Distractor Design:** Incorrect options MUST be sophisticated. They must be relevant to the topic and plausibly confusable with the correct answer, representing common misunderstandings or subtle misreadings of the provided text. Avoid obviously wrong or irrelevant options.
    *   **Text-Bound:** All elements (question stem, options, answer, explanation) MUST be derivable *solely and exclusively* from the provided text excerpt. **ABSOLUTELY NO external knowledge** is permitted. Explanations must pinpoint textual evidence.
    *   **Clarity & Precision:** Ensure flawless grammar, unambiguous wording, and precise terminology as used in the text.

Generate **exactly 10** MCQs fulfilling **all** these stringent requirements. Prioritize cognitive depth and textual accuracy above all else. Produce a substantial and challenging set of study questions.`;

    const questionsOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: questionsPrompt }] }],
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 5000 // Increased slightly for potentially more complex explanations/questions
        }
      })
    };

    let questions: ProcessedPDF['questions'] = []; // Initialize as empty
    try {
      const questionsResponse = await fetchWithRetry(GEMINI_ENDPOINT, questionsOptions);
      const questionsResponseText = await questionsResponse.text();
      const questionsRawText = extractCandidateText(questionsResponseText);

       if (questionsRawText.startsWith("Error:")) {
          throw new Error(questionsRawText); // Let the catch block handle it
      }

      // Parsing logic (kept from provided 'working version')
      const questionBlocks = questionsRawText.split(/---DIVIDER---/i);
      console.log(`Attempting to parse ${questionBlocks.length} question blocks.`); // Debugging

      for (const block of questionBlocks) {
        if (questions.length >= 10) break; // Stop after finding 10 valid questions

        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue; // Skip empty blocks resulting from split

        // Refined Regex for more robust parsing, handling potential extra whitespace and case variations
        const questionMatch = trimmedBlock.match(/^Question:\s*([\s\S]*?)\s*A\)/i);
        // Match options more carefully, stopping before the next letter or 'Correct:'
        const optionsMatch = trimmedBlock.match(/A\)\s*([\s\S]*?)\s*B\)\s*([\s\S]*?)\s*C\)\s*([\s\S]*?)\s*D\)\s*([\s\S]*?)\s*Correct:/is);
        const correctMatch = trimmedBlock.match(/Correct:\s*([A-D])\b/i); // \b ensures it's a single letter
        const explanationMatch = trimmedBlock.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i); // Match until next divider or end

        if (questionMatch && optionsMatch && correctMatch && explanationMatch) {
            const questionText = questionMatch[1].trim();
            // Clean up options more thoroughly
            const optionsList = [
                optionsMatch[1],
                optionsMatch[2],
                optionsMatch[3],
                optionsMatch[4]
            ].map(opt => opt.replace(/\s*(B\)|C\)|D\)|Correct:).*$/is, '').trim()); // Remove trailing labels/text

            const correctLetter = correctMatch[1].toUpperCase();
            const explanationText = explanationMatch[1].trim();

             // Add stronger validation before pushing
            if (questionText &&
                optionsList.length === 4 &&
                optionsList.every(o => o && o.length > 0) && // Ensure options are not empty
                ['A', 'B', 'C', 'D'].includes(correctLetter) &&
                explanationText && explanationText.length > 5) // Ensure explanation has some substance
            {
                questions.push({
                  question: questionText,
                  options: optionsList,
                  correctAnswer: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
                  explanation: explanationText,
                });
            } else {
                 console.warn("Partially parsed/invalid question block data:", { questionText, optionsList, correctLetter, explanationText, block: trimmedBlock.substring(0, 200) + '...' }); // Log truncated block
            }
        } else {
             // Log specific parsing failures if possible
             if (!questionMatch) console.warn("Could not parse 'Question:' part.", trimmedBlock.substring(0, 100));
             else if (!optionsMatch) console.warn("Could not parse Options A-D.", trimmedBlock.substring(0, 200));
             else if (!correctMatch) console.warn("Could not parse 'Correct:' part.", trimmedBlock);
             else if (!explanationMatch) console.warn("Could not parse 'Explanation:' part.", trimmedBlock);
             else console.warn("General structure mismatch in question block:", trimmedBlock.substring(0, 200) + '...');
        }
      } // End parsing loop

      console.log(`Successfully parsed ${questions.length} valid questions.`); // Debugging

      if (questions.length === 0) {
           // If parsing yielded nothing valid, treat it as an error
           throw new Error("No valid questions could be parsed from the AI response. Check response format.");
      } else if (questions.length < 10) {
          // Log a warning but proceed with the questions obtained
          console.warn(`Successfully parsed only ${questions.length} out of 10 requested questions. The AI might not have generated all 10, or some failed parsing.`);
          safeProgress({ progress: 95, status: `Generated ${questions.length}/10 questions. Finalizing...`, error: `Only ${questions.length} questions generated/parsed.` }); // Inform user
      }

    } catch (questionsError) {
      console.error('Questions generation or parsing error:', questionsError);
      safeProgress({
        progress: 95, // Still move to finalize
        status: 'Questions generation/parsing failed.',
        error: questionsError instanceof Error ? questionsError.message : 'Unknown questions error'
      });
      // Provide a fallback question only if the array is completely empty
      if (questions.length === 0) {
          questions = [{
            question: 'Study questions could not be generated or parsed for this document.',
            options: ['Ok', 'Understood', 'Review Manually', 'N/A'],
            correctAnswer: 0,
            explanation: 'The AI failed to generate questions in the expected format, or another error occurred during generation.'
          }];
      }
    }
    // --- End Question Generation ---


    safeProgress({ progress: 98, status: 'Finalizing results...', error: null }); // Adjusted progress

    // 7. Return Processed Data
    safeProgress({ progress: 100, status: 'Processing complete!', error: null });
    return {
      title: file.name.replace(/\.pdf$/i, ''),
      content: detailedNoteContent, // Use the potentially very long, detailed note
      keyPoints,
      questions, // Contains questions generated by the reverted logic
      sourceUrl: pdfUrl,
      // extractedText: extractedText // Optionally return the full extracted text for debugging or other uses
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF processing error.';
    console.error('Overall PDF processing failed:', error); // Log the full error object
    // Ensure progress indicates failure clearly
    safeProgress({ progress: 100, status: 'Processing Failed', error: errorMessage });
    // Re-throw a new error to ensure the promise rejects correctly
    throw new Error(`PDF Processing Failed: ${errorMessage}`);
  }
}
