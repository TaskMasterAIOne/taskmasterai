import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase'; // Assuming './firebase' is correctly configured
import { v4 as uuidv4 } from 'uuid';
import { geminiApiKey } from './dashboard-firebase'; // Use imported key for the global endpoint if needed

interface ProcessingProgress { progress: number; status: string; error: string | null; }

interface ProcessedYouTube {
    title: string;
    content: string; // Detailed Markdown Note
    keyPoints: string[];
    questions: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    flashcards?: { front: string; back: string; }[];
    sourceUrl: string; // YouTube video URL
}

// Note: The global GEMINI_ENDPOINT might use the imported geminiApiKey.
// The processYouTube function uses a passed-in apiKey for its Gemini calls.
// const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;


// Helper functions
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) { // Retry on 429 or 5xx
                console.warn(`Attempt ${attempt + 1} failed for ${url}: ${response.status}. Retrying...`);
                await sleep(delayMs * (attempt + 1));
                continue;
            }
            return response;
        }
        catch (error) {
            console.error(`Attempt ${attempt + 1} fetch error for ${url}:`, error);
            if (attempt === retries - 1) throw error;
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw new Error(`Max retries reached for ${url}`);
}

const extractCandidateText = (responseText: string): string => {
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return jsonResponse.candidates[0].content.parts[0].text;
        }
        if (jsonResponse?.error?.message) {
            console.error("Gemini API Error:", jsonResponse.error.message);
            return `Error: ${jsonResponse.error.message}`;
        }
        if (jsonResponse?.candidates?.[0]?.finishReason && jsonResponse.candidates[0].finishReason !== 'STOP') {
            console.warn(`Gemini finish reason: ${jsonResponse.candidates[0].finishReason}. Content might be incomplete or missing.`);
            // If there's partial text despite a non-STOP reason, let's try to return it.
            if (jsonResponse.candidates[0]?.content?.parts?.[0]?.text) {
                 return jsonResponse.candidates[0].content.parts[0].text;
            }
            return `Error: Generation stopped (${jsonResponse.candidates[0].finishReason})`;
        }
         if (!jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text && jsonResponse.candidates[0].finishReason === 'STOP') {
            return ""; // Model finished but produced no text, treat as empty string.
        }
        return "Error: No text found in Gemini response.";
    }
    catch (err) {
        console.error('Error parsing Gemini response:', err);
        console.error('Problematic Gemini responseText for parsing:', responseText.substring(0, 500)); // Log a snippet
        return "Error: Cannot parse AI response.";
    }
};

function getVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Helper to extract text from basic XML/TTML like structure (very simplified)
function simpleXmlTextExtract(xmlString: string): string {
    let content = '';
    const regex = /<p[^>]*>(.*?)<\/p>/gs;
    let match;
    while ((match = regex.exec(xmlString)) !== null) {
        const segment = match[1]
            .replace(/<[^>]+>/g, ' ') // Remove inner tags like <span>
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        if (segment) {
            content += segment + '\n'; // Use newline as a basic separator
        }
    }

    if (!content && xmlString) { // Fallback if <p> tags are not primary or not present
        const textOnly = xmlString
            .replace(/<[^>]+>/g, ' ') // Strip all tags
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        if (textOnly.length > 0 && textOnly.length > xmlString.length * 0.1) { // Basic check if stripping tags yielded something reasonable
            // Attempt to split into meaningful lines if it looks like a block of text
            content = textOnly.split(/\s{2,}/).join('\n'); // Split by multiple spaces if it's a single blob
        } else {
            content = textOnly; // Otherwise, take the blob
        }
    }
    return content.trim().replace(/\n+/g, '\n'); // Consolidate multiple newlines
}


async function fetchTranscriptAndTitleUnofficially(
    videoId: string,
    onProgress: (progressUpdate: ProcessingProgress) => void
): Promise<{ transcriptText: string | null; videoTitle: string; error?: string }> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en&persist_hl=1`; // Request English page
    let pageHtml = '';
    let scrapedTitle = `Video ID: ${videoId}`; // Default title

    try {
        onProgress({ progress: 5, status: 'Fetching video page data (unofficial)...', error: null });
        const response = await fetchWithRetry(watchUrl, {
            headers: { // Emulate a browser
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            return { transcriptText: null, videoTitle: scrapedTitle, error: `Failed to fetch video page: ${response.status} ${response.statusText}` };
        }
        pageHtml = await response.text();
        onProgress({ progress: 10, status: 'Video page fetched. Parsing for title & transcript data...', error: null });

    } catch (e: any) {
        console.error("Error fetching video page HTML:", e);
        return { transcriptText: null, videoTitle: scrapedTitle, error: `Error fetching video page: ${e.message}` };
    }

    // Try to scrape title from HTML first
    try {
        const titleMatch = pageHtml.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            scrapedTitle = titleMatch[1].replace(/- YouTube$/, '').trim();
        }
    } catch (e) { /* ignore title parsing error, use default */ }


    try {
        // Look for ytInitialPlayerResponse, common place for caption data
        let playerResponseJson = null;
        const playerResponseMatch = pageHtml.match(/var ytInitialPlayerResponse\s*=\s*({.+?});(?:<\/script>|\s*var meta|window\.ytcfg)/s);


        if (playerResponseMatch && playerResponseMatch[1]) {
            playerResponseJson = playerResponseMatch[1];
        } else {
            // Fallback for another common pattern
            const alternativeMatch = pageHtml.match(/window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/s);
            if (alternativeMatch && alternativeMatch[1]) {
                playerResponseJson = alternativeMatch[1];
            }
        }

        if (!playerResponseJson) {
            console.warn('Could not find ytInitialPlayerResponse in page HTML for transcript data.');
            return { transcriptText: null, videoTitle: scrapedTitle, error: 'Could not find player response for transcripts.' };
        }

        const playerResponse = JSON.parse(playerResponseJson);

        // Update title from playerResponse if available and more specific
        if (playerResponse?.videoDetails?.title) {
            scrapedTitle = playerResponse.videoDetails.title;
        }
        onProgress({ progress: 15, status: `Title: ${scrapedTitle.substring(0,50)}... Found player response.`, error: null });

        const captionsRenderer = playerResponse?.captions?.playerCaptionsTracklistRenderer;
        if (!captionsRenderer || !captionsRenderer.captionTracks || captionsRenderer.captionTracks.length === 0) {
            onProgress({ progress: 20, status: 'No caption tracks found in player response.', error: 'No caption tracks listed in player data.' });
            return { transcriptText: null, videoTitle: scrapedTitle, error: 'No caption tracks found for this video in player data.' };
        }

        const captionTracks = captionsRenderer.captionTracks;
        let track = captionTracks.find((t: any) => t.languageCode === 'en' || t.languageCode.startsWith('en-')); // Prefer English
        if (!track) { // Fallback to auto-generated (often has .asr in vssId) or first available
            track = captionTracks.find((t: any) => t.vssId && (t.vssId.includes('.asr') || t.vssId.startsWith('.')));
        }
        if (!track) track = captionTracks[0]; // Absolute fallback to the first track listed

        if (!track || !track.baseUrl) {
            onProgress({ progress: 20, status: 'Suitable caption track or its URL not found.', error: 'No suitable caption track URL.' });
            return { transcriptText: null, videoTitle: scrapedTitle, error: 'Could not find a suitable caption track URL.' };
        }

        onProgress({ progress: 20, status: `Fetching transcript (lang: ${track.languageCode || 'unknown'})...`, error: null });
        const transcriptDataResponse = await fetchWithRetry(track.baseUrl, {});
        if (!transcriptDataResponse.ok) {
            return { transcriptText: null, videoTitle: scrapedTitle, error: `Failed to fetch transcript XML/data: ${transcriptDataResponse.status}` };
        }
        const transcriptXmlOrText = await transcriptDataResponse.text();
        
        onProgress({ progress: 25, status: 'Transcript data fetched. Parsing content...', error: null });
        const extractedText = simpleXmlTextExtract(transcriptXmlOrText);

        if (!extractedText) {
             onProgress({ progress: 30, status: 'Parsed transcript is empty.', error: 'Parsed transcript was empty.' });
             return { transcriptText: null, videoTitle: scrapedTitle, error: 'Parsed transcript was empty.' };
        }
        onProgress({ progress: 30, status: 'Transcript processed (unofficial).', error: null });
        return { transcriptText: extractedText, videoTitle: scrapedTitle };

    } catch (e: any) {
        console.error("Error processing unofficial transcript:", e);
        onProgress({ progress: 30, status: 'Error processing unofficial transcript.', error: e.message });
        return { transcriptText: null, videoTitle: scrapedTitle, error: `Error processing transcript: ${e.message}` };
    }
}


export async function processYouTube(
    url: string,
    userId: string, // userId is passed but not currently used in this function's logic
    apiKey: string, // This is the Gemini API Key
    onProgress: (progress: ProcessingProgress) => void
): Promise<ProcessedYouTube> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    // Ensure currentGeminiEndpoint uses the apiKey passed to this function for Gemini
    const currentGeminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    if (!apiKey) { // Gemini API Key check
        const errorMsg = 'Gemini API Key missing.';
        safeProgress({ progress: 0, status: 'Error', error: errorMsg });
        return { // Return an error object
            title: url, content: `Error: ${errorMsg}`, keyPoints: [`Processing failed: ${errorMsg}`],
            questions: [], flashcards: [{ front: 'Processing failed', back: errorMsg }], sourceUrl: url,
        };
    }

    let baseTranscriptContent = '';
    let videoTitle = url; // Default title to URL

    try {
        safeProgress({ progress: 0, status: 'Starting YouTube processing (unofficial transcript method)...', error: null });
        const videoId = getVideoId(url);
        if (!videoId) {
            const errorMsg = 'Invalid YouTube URL.';
            safeProgress({ progress: 0, status: 'Error', error: errorMsg });
            throw new Error(errorMsg);
        }
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        videoTitle = youtubeVideoUrl; // Update title to specific video URL

        // Fetch transcript and title using the unofficial method
        const unofficialResult = await fetchTranscriptAndTitleUnofficially(videoId, safeProgress);

        if (unofficialResult.error || !unofficialResult.transcriptText) {
            const transcriptError = unofficialResult.error || 'No transcript content retrieved by unofficial method.';
            console.warn(`Unofficial transcript fetching failed: ${transcriptError}`);
            safeProgress({ progress: 30, status: 'Transcript fetching failed (unofficial). Using fallback.', error: transcriptError });
            baseTranscriptContent = "No transcript could be retrieved for this video.";
            // Use scraped title if available, even if transcript fails
            if (unofficialResult.videoTitle) videoTitle = unofficialResult.videoTitle;
        } else {
            baseTranscriptContent = unofficialResult.transcriptText;
            videoTitle = unofficialResult.videoTitle; // This will be the scraped title
            safeProgress({ progress: 30, status: 'Transcript fetched (unofficial). Proceeding with AI.', error: null });
        }
        
        // Max length for baseTranscriptContent to avoid overly large Gemini requests
        const MAX_TRANSCRIPT_LENGTH = 60000; // Adjust as needed (Gemini has token limits)
        if (baseTranscriptContent.length > MAX_TRANSCRIPT_LENGTH) {
            console.warn(`Transcript content is very long (${baseTranscriptContent.length} chars), truncating to ${MAX_TRANSCRIPT_LENGTH} for AI processing.`);
            baseTranscriptContent = baseTranscriptContent.substring(0, MAX_TRANSCRIPT_LENGTH);
        }


        // --- Start of AI Processing (same as before, using baseTranscriptContent and videoTitle) ---

        safeProgress({ progress: 35, status: 'Generating detailed note...', error: null });
        const detailedNotePrompt = `Analyze the following YouTube video information (title, description/transcript). Generate a detailed, well-structured note using Markdown.

**Instructions:**
*   **Structure:** Use headings (#, ##), bullet points (* or -), numbered lists.
*   **Formatting:** Use bold text (**bold**) for emphasis. Create Markdown tables if suitable.
*   **Content:** Cover main topics and important details thoroughly. Aim for comprehensiveness and generate extensive, detailed notes.
*   **Length:** Produce a detailed and lengthy note, not just a summary. The goal is to be exhaustive based on the provided input.
*   **Math:** Use LaTeX ($inline$ or $$block$$).

**Objective:** Create comprehensive, detailed, and well-structured study notes in Markdown format based on the provided text from the YouTube video. These notes are intended for a student learning the subject matter covered in the document.

**Core Task:** Do not just summarize. Synthesize the information, explain concepts clearly, elaborate on key points, and structure the content logically for learning and revision. Use the provided transcript/description as the primary source of truth. **Crucially, present the information directly as study notes.** Avoid meta-commentary or phrases that refer to the source document itself, such as "The transcript says...", "This video explains...", "The document mentions...", "According to the video...", or "The speaker states...". The notes should *be* the information, not a discussion *about* where the information came from.

**Mandatory Instructions:**
1.  **Study Focus:** Ensure the notes are pedagogically valuable. Explain concepts, define key terms clearly, connect related ideas (even if presented separately in the text), and highlight important facts, principles, or processes.
2.  **Comprehensiveness & Depth:** Cover ALL significant topics, sub-topics, arguments, data, and examples present in the text. Go into substantial detail. Aim for lengthy and exhaustive notes that capture the nuances of the source material.
3.  **Structure & Formatting:** Utilize Markdown extensively and strategically: Headings (#, ##, ###), Lists (*, -, +, 1., 2.), Emphasis (**bold**, *italics*, \`inline code\`), Tables, Code Blocks (\`\`\`), Blockquotes (>), Describe visuals if mentioned.
4.  **Direct Information Style:** The notes must present information directly as if they are standalone study material. **Do NOT use phrases that refer back to the source video or transcript** (e.g., "The video discusses...", "In the transcript, it is mentioned...", "The creator explains that..."). All content should be stated as factual information derived from the source, without attributing it back to the source within the note itself.
5.  **Output Requirements:**
    *   Generate **only** the raw Markdown note content.
    *   **NO** introductory or concluding phrases like "Here are the notes:" or "This concludes the notes."
    *   Start *immediately* with the first Markdown element (e.g., a heading like '# Title' or a bullet point like '* Item').
    *   **Crucially, do NOT wrap the entire output in a Markdown code block. This means your response should NOT start with \`\`\`markdown or \`\`\` and should NOT end with \`\`\`. The output itself should be the pure Markdown text, ready to be rendered.**

**Video Title:** ${videoTitle}
**Transcript/Description (provide the full transcript if possible, or a significant portion, to enable detailed note generation):**
---
${baseTranscriptContent}
---

**Output:**
Provide *only* the generated raw Markdown note content below. Do not include any explanatory text before or after the Markdown.
`;
        let detailedNoteContent = 'AI detailed note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } }) };
            const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
            if (!noteResponse.ok) {
                const errorText = await noteResponse.text();
                throw new Error(`Gemini API request failed for notes: ${noteResponse.status} ${errorText.substring(0,200)}`);
            }
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) { throw new Error(noteRawText); }
            detailedNoteContent = noteRawText.trim();
        } catch (noteError) {
            const errorMsg = noteError instanceof Error ? noteError.message : 'Unknown note gen error';
            console.error('Detailed note generation error (YT):', noteError);
            detailedNoteContent = `Error: Detailed note generation failed. Reason: ${errorMsg}`;
            // Progress update for this specific failure
            safeProgress({ progress: detailedNoteContent.length > 50000 ? 55: 45, status: 'Note generation failed. Proceeding...', error: errorMsg });
        }
        safeProgress({ progress: 55, status: 'Detailed note processed. Generating key points...', error: null });

        const keyPointsPrompt = `Extract exactly 10 distinct key points from the following YouTube video info/transcript. List only the points. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:" \n\nTitle: ${videoTitle}\nText:\n---\n${baseTranscriptContent.slice(0, 25000)}\n---\n\nKey Points:\n1. ...`;
        let keyPoints: string[] = ['Key points generation failed.'];
         try {
            const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }) };
            const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
            if (!kpResponse.ok) {
                const errorText = await kpResponse.text();
                throw new Error(`Gemini API request failed for key points: ${kpResponse.status} ${errorText.substring(0,200)}`);
            }
            const kpText = extractCandidateText(await kpResponse.text());
            if (kpText.startsWith("Error:")) {
                console.error("KP Error (AI):", kpText);
                keyPoints = [`Key points generation failed: ${kpText}`];
            } else {
                const parsed = kpText.split('\n').map(l=>l.trim().replace(/^\d+\.\s*/,'')).filter(p=>p.length > 5).slice(0,10);
                if (parsed.length > 0) keyPoints = parsed;
                else keyPoints = ['No key points extracted from AI response.'];
            }
        } catch (kpError) {
            console.error('KP fetch/generation error (YT):', kpError);
            keyPoints = [`Key points generation failed: ${kpError instanceof Error ? kpError.message : String(kpError)}`];
        }
        safeProgress({ progress: 65, status: 'Key points processed. Generating flashcards...', error: null });


        const flashcardsPrompt = `**Objective:** Generate **between 10 to 15 flashcards** for studying the YouTube video titled "${videoTitle}", based on its transcript/description.
**Mandatory Instructions:**
1.  **Study Relevance:** Flashcards MUST focus on key terms, definitions, concepts, or important facts from the video content.
2.  **Text-Grounded:** Content for both front and back MUST be derived from the provided transcript/description.
3.  **Conciseness:** Keep front and back text concise and to the point for effective memorization.
4.  **Quantity:** Aim for 10-15 distinct flashcards.
5.  **Strict Formatting:** Adhere **unfailingly** to the following format for each flashcard, separated by "---FLASHCARD_DIVIDER---":
    Front: [Text for the front of the card - typically a question, term, or concept]
    Back: [Text for the back of the card - typically the answer, definition, or explanation]
    ---FLASHCARD_DIVIDER---
**Video Transcript/Description:**\n---\n${baseTranscriptContent.slice(0, 30000)}\n---\n**Generated Flashcards:**\nFront:`;
        let flashcards: ProcessedYouTube['flashcards'] = [];
        try {
            const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 2048 } }) };
            const fcResponse = await fetchWithRetry(currentGeminiEndpoint, fcOptions);
            if (!fcResponse.ok) {
                const errorText = await fcResponse.text();
                throw new Error(`Gemini API request failed for flashcards: ${fcResponse.status} ${errorText.substring(0,200)}`);
            }
            const fcRawText = extractCandidateText(await fcResponse.text());

            if (fcRawText.startsWith("Error:")) {
                throw new Error(`Flashcard Generation Failed (AI): ${fcRawText}`);
            }

            const textToParse = fcRawText.trim().startsWith("Front:") ? fcRawText.trim() : "Front: " + fcRawText.trim();
            const flashcardBlocks = textToParse.split(/---FLASHCARD_DIVIDER---/i);
            flashcards = []; // Reset before parsing

            for (const block of flashcardBlocks) {
                if (flashcards.length >= 15) break;
                const trimmedBlock = block.trim();
                if (trimmedBlock.length < 10) continue;

                const frontMatch = trimmedBlock.match(/^(?:Front:\s*)?([\s\S]*?)\s*\n(?:Back:\s*)?([\s\S]*)$/is);
                if (frontMatch && frontMatch[1] && frontMatch[2]) {
                    const frontText = frontMatch[1].trim();
                    const backText = frontMatch[2].trim();
                    if (frontText.length > 2 && backText.length > 2) {
                        flashcards.push({ front: frontText, back: backText });
                    }
                } else {
                     console.warn("Could not parse flashcard block with regex:", trimmedBlock.substring(0,100));
                }
            }

            if (flashcards.length === 0 && !fcRawText.startsWith("Error:")) { // If parsing yielded nothing but AI didn't report an error
                 flashcards = [{front: "No flashcards generated.", back: "The AI response did not contain usable flashcard data, or the content was not suitable."}];
                 safeProgress({ progress: 80, status: `Generated 0 flashcards. (Possible parsing issue or no relevant content)`, error: "No flashcards parsed from AI response." });
            } else if (flashcards.length > 0) {
                 safeProgress({ progress: 80, status: `Generated ${flashcards.length} flashcards.`, error: null });
            }
            // If fcRawText started with "Error:", it's caught by the throw above.

        } catch (fcError) {
            const errorMsg = fcError instanceof Error ? fcError.message : 'Unknown flashcards error';
            console.error('Flashcards generation error (YT):', fcError);
            safeProgress({ progress: 80, status: 'Flashcards generation failed.', error: errorMsg });
            flashcards = [{ front: 'Flashcard generation failed.', back: `Reason: ${errorMsg}` }];
        }
        safeProgress({ progress: 85, status: 'Flashcards processed. Generating study questions...', error: null });


        const questionsPrompt = `Based on YouTube video "${videoTitle}" (transcript/desc provided), generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nRepeat this structure for 10 questions.\n\nText:\n---\n${baseTranscriptContent.slice(0, 25000)}\n---`;
        let questions: ProcessedYouTube['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) };
            const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
             if (!qResponse.ok) {
                const errorText = await qResponse.text();
                throw new Error(`Gemini API request failed for questions: ${qResponse.status} ${errorText.substring(0,200)}`);
            }
            const qText = extractCandidateText(await qResponse.text());
            if (qText.startsWith("Error:")) {
                console.error("Questions Error (AI):", qText);
                questions = [{ question: `Questions generation failed: ${qText}`, options: ['N/A'], correctAnswer: 0, explanation: 'AI error during generation.' }];
            } else {
                const blocks = qText.split(/---DIVIDER---/i);
                let parsedQs = [];
                for (const block of blocks) {
                    if (parsedQs.length >= 10) break;
                    const T = block.trim();
                    if (!T) continue;
                    const qM = T.match(/^Question:\s*([\s\S]*?)\s*A\)/i);
                    const oM = T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D)\s*(.*?)\s*Correct:/is);
                    const cM = T.match(/Correct:\s*([A-D])\b/i);
                    const eM = T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i);

                    if (qM && oM && cM && eM) {
                        const qT=qM[1].trim();
                        const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim());
                        const cL=cM[1].toUpperCase();
                        const eT=eM[1].trim();
                        if(qT && oL.length===4 && oL.every(o=>o.length > 0) && ['A','B','C','D'].includes(cL) && eT.length > 0) {
                            parsedQs.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT});
                        } else {
                            console.warn("Partial question parse (YT): Malformed fields.", {qT_len:qT.length, oL_every: oL.every(o=>o.length>0), cL, eT_len:eT.length});
                        }
                    } else {
                        console.warn("Question structure parse fail (YT): Regex mismatch on block.", block.substring(0,100));
                    }
                }
                if (parsedQs.length > 0) questions = parsedQs;
                else questions = [{ question: 'No questions parsed from AI response.', options: ['N/A'], correctAnswer: 0, explanation: 'AI response might be malformed, empty, or not match expected structure.' }];
            }
        } catch (qError) {
            console.error('Questions fetch/generation error (YT):', qError);
            questions = [{ question: `Questions generation failed: ${qError instanceof Error ? qError.message : String(qError)}`, options: ['N/A'], correctAnswer: 0, explanation: 'Error during API call or processing for questions.' }];
        }

        const qErrorMsg = questions.length === 0 || (questions[0] && questions[0].question.includes("failed")) ? `Generated ${questions.length} questions (check errors).` : null;
        safeProgress({ progress: 95, status: 'Study questions processed.', error: qErrorMsg });


        safeProgress({ progress: 100, status: 'Processing complete!', error: null });
        return {
            title: videoTitle,
            content: detailedNoteContent,
            keyPoints,
            questions,
            flashcards,
            sourceUrl: youtubeVideoUrl, // Original YouTube URL
        };

    } catch (error) { // Overall catch block for processYouTube
        console.error('Overall YouTube processing failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown YouTube processing error.';
        safeProgress({ progress: 100, status: 'Error', error: errorMessage });
        return {
            title: videoTitle, // Use whatever title was determined
            content: `Error processing YouTube video: ${errorMessage}`,
            keyPoints: [`Processing failed: ${errorMessage}`],
            questions: [{ question: `Processing failed: ${errorMessage}`, options: ['N/A'], correctAnswer: 0, explanation: 'Overall error.' }],
            flashcards: [{ front: 'Processing failed', back: errorMessage }],
            sourceUrl: url, // Original URL
        };
    }
}
