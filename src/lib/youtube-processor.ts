import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { geminiApiKey } from './dashboard-firebase'; // Use imported key

interface ProcessingProgress { progress: number; status: string; error: string | null; }

interface ProcessedYouTube {
    title: string;
    content: string; // Detailed Markdown Note
    keyPoints: string[];
    questions: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    sourceUrl: string; // YouTube video URL
}

// Replace with your SECURELY loaded YouTube Data API Key
const YOUTUBE_API_KEY = 'AIzaSyCoxefrJ80LuyxLAdv0t55BN8SJ9_-orcM'; // <-- IMPORTANT: Replace this

// Use imported Gemini key
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

// Helper functions (sleep, fetchWithRetry, extractCandidateText - assumed same as before)
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> { /* ... same ... */
    for (let attempt = 0; attempt < retries; attempt++) {
        try { const response = await fetch(url, options); if (!response.ok && (response.status === 429 || response.status >= 500)) { console.warn(`Attempt ${attempt + 1} failed: ${response.status}. Retrying...`); await sleep(delayMs * (attempt + 1)); continue; } return response; }
        catch (error) { console.error(`Attempt ${attempt + 1} fetch error:`, error); if (attempt === retries - 1) throw error; await sleep(delayMs * (attempt + 1)); }
    } throw new Error(`Max retries reached: ${url}`);
}
const extractCandidateText = (responseText: string): string => { /* ... same ... */
    try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { console.error("Gemini API Error:", jsonResponse.error.message); return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.candidates?.[0]?.finishReason !== 'STOP') { console.warn(`Gemini finish reason: ${jsonResponse?.candidates?.[0]?.finishReason}`); return `Error: Generation stopped (${jsonResponse?.candidates?.[0]?.finishReason})`; } return "Error: No text found."; }
    catch (err) { console.error('Error parsing Gemini response:', err); return "Error: Cannot parse AI response."; }
};

function getVideoId(url: string): string | null { /* ... same ... */
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; const match = url.match(regex); return match ? match[1] : null;
}

// Helper function to parse SRT content
function parseSrt(srtContent: string): string {
    const lines = srtContent.split(/\r?\n/);
    const textLines: string[] = [];
    for (const line of lines) {
        // Skip empty lines, sequence numbers, and timecodes
        if (!line.trim() || /^\d+$/.test(line.trim()) || line.includes('-->')) {
            continue;
        }
        // Remove common SRT tags (like <i>, <b>, <font>) and trim
        const cleanedLine = line.replace(/<[^>]*>/g, '').trim();
        if (cleanedLine) { // Add only if there's text after cleaning
            textLines.push(cleanedLine);
        }
    }
    return textLines.join(' '); // Join lines with a space for better readability by LLM
}

// --- TypeScript interfaces for YouTube Captions API ---
interface YouTubeCaptionTrackSnippet {
    videoId: string;
    lastUpdated: string;
    trackKind: 'standard' | 'ASR' | 'forced'; // ASR is auto-generated
    language: string;
    name: string;
    audioTrackType: string;
    isCC: boolean;
    isLarge: boolean;
    isEasyReader: boolean;
    isDraft: boolean;
    isAutoSynced: boolean;
    status: string;
}

interface YouTubeCaptionTrack {
    id: string;
    snippet: YouTubeCaptionTrackSnippet;
}

interface YouTubeCaptionListResponse {
    kind: string;
    etag: string;
    items: YouTubeCaptionTrack[];
}


// --- Main Processing Function ---
export async function processYouTube(
    url: string,
    userId: string,
    apiKey: string, // Explicitly pass Gemini key
    onProgress: (progress: ProcessingProgress) => void
): Promise<ProcessedYouTube> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const currentGeminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    if (!apiKey) { safeProgress({ progress: 0, status: 'Error', error: 'Gemini API Key missing.' }); throw new Error('Gemini API Key missing.'); }
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY' || YOUTUBE_API_KEY === 'AIzaSyCoxefrJ80LuyxLAdv0t55BN8SJ9_-orcM') { // Added the placeholder check
        safeProgress({ progress: 0, status: 'Error', error: 'YouTube API Key missing/invalid. Please replace the placeholder key.' });
        throw new Error('YouTube API Key missing/invalid. Please replace the placeholder key.');
    }

    let baseTranscriptContent = ''; // Store transcript or description

    try {
        safeProgress({ progress: 0, status: 'Starting YouTube processing...', error: null });
        const videoId = getVideoId(url);
        if (!videoId) {
            safeProgress({ progress: 0, status: 'Error', error: 'Invalid YouTube URL.' });
            throw new Error('Invalid YouTube URL.');
        }
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        safeProgress({ progress: 5, status: 'Fetching video metadata...', error: null });
        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const videoResponse = await fetchWithRetry(videoDetailsUrl, {});
        if (!videoResponse.ok) { const errorText = await videoResponse.text(); console.error("YT API Error (Video Details):", errorText); throw new Error(`Failed to fetch video details (${videoResponse.status}). Check API Key/Video ID.`); }
        const videoData = await videoResponse.json();
        if (!videoData.items?.[0]?.snippet) { throw new Error('Video metadata not found (private/deleted?).'); }
        const videoInfo = videoData.items[0].snippet;
        const videoTitle = videoInfo.title || 'Untitled Video';
        const videoDescription = videoInfo.description || '';

        safeProgress({ progress: 10, status: 'Fetching caption tracks list...', error: null });
        let fetchedTranscriptText = '';
        const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
        try {
            const captionsListResponse = await fetchWithRetry(captionsListUrl, {});
            if (captionsListResponse.ok) {
                const captionsData: YouTubeCaptionListResponse = await captionsListResponse.json();
                if (captionsData.items && captionsData.items.length > 0) {
                    let captionTrack: YouTubeCaptionTrack | undefined;

                    // Priority 1: English, not 'forced'
                    captionTrack = captionsData.items.find(
                        track => track.snippet.language.startsWith('en') && track.snippet.trackKind !== 'forced'
                    );

                    // Priority 2: Any language, ASR or standard, not 'forced'
                    if (!captionTrack) {
                        captionTrack = captionsData.items.find(
                            track => (track.snippet.trackKind === 'ASR' || track.snippet.trackKind === 'standard') && track.snippet.trackKind !== 'forced'
                        );
                    }
                    
                    // Priority 3: First available track that is not 'forced'
                    if (!captionTrack) {
                        captionTrack = captionsData.items.find(track => track.snippet.trackKind !== 'forced');
                    }


                    if (captionTrack) {
                        safeProgress({ progress: 20, status: `Fetching transcript (${captionTrack.snippet.language}, ${captionTrack.snippet.name || 'default'})...`, error: null });
                        const captionId = captionTrack.id;
                        // Request SRT format as it's text-based and easy to parse
                        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${YOUTUBE_API_KEY}&tfmt=srt`;
                        const transcriptResponse = await fetchWithRetry(downloadUrl, {});
                        if (transcriptResponse.ok) {
                            const srtContent = await transcriptResponse.text();
                            fetchedTranscriptText = parseSrt(srtContent);
                            if (fetchedTranscriptText) {
                                safeProgress({ progress: 30, status: 'Transcript successfully processed.', error: null });
                            } else {
                                 safeProgress({ progress: 30, status: 'Transcript parsed but empty. Using description.', error: 'Parsed transcript was empty.' });
                            }
                        } else {
                            console.warn(`Failed to download transcript for track ${captionId}: ${transcriptResponse.status}`);
                            safeProgress({ progress: 30, status: 'Transcript download failed. Using description.', error: `Transcript download failed (${transcriptResponse.status})` });
                        }
                    } else {
                        console.warn(`No suitable (non-forced) caption track found for ${videoId}.`);
                        safeProgress({ progress: 30, status: 'No suitable transcript found. Using description.', error: 'No suitable transcript track' });
                    }
                } else {
                    console.warn(`No caption tracks listed for ${videoId}.`);
                    safeProgress({ progress: 30, status: 'No caption tracks available. Using description.', error: 'No caption tracks listed' });
                }
            } else {
                const errorText = await captionsListResponse.text();
                console.warn(`Failed to fetch caption list for ${videoId}: ${captionsListResponse.status}. Error: ${errorText}`);
                safeProgress({ progress: 30, status: 'Failed to fetch caption list. Using description.', error: `Caption list fetch failed (${captionsListResponse.status})` });
            }
        } catch (captionError) {
            console.error('Error during caption fetching process:', captionError);
            safeProgress({ progress: 30, status: 'Error fetching transcript. Using description.', error: captionError instanceof Error ? captionError.message : 'Unknown caption error' });
        }

        // Use fetched transcript if available and non-empty, otherwise fallback to description
        baseTranscriptContent = fetchedTranscriptText.trim() ? fetchedTranscriptText : videoDescription;
        if (!baseTranscriptContent.trim()) {
            baseTranscriptContent = "No transcript or description available.";
            console.warn(`No transcript or description ultimately available for ${videoId}.`);
        }

        safeProgress({ progress: 30, status: 'Generating detailed note...', error: null }); // Progress updated after transcript logic
          // --- Detailed Note Generation (YouTube Video) ---
        // (PROMPT IS KEPT THE SAME AS PER INSTRUCTIONS)
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
3.  **Structure & Formatting:** Utilize Markdown extensively and strategically: Headings (#, ##, ###), Lists (*, -, +, 1., 2.), Emphasis (**bold**, *italics*, \`inline code\`), Tables, Code Blocks (\`\`\`), Blockquotes (>), Describe visuals.
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
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192 } }) }; // Increased maxOutputTokens for potentially longer notes from full transcripts
            const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) { throw new Error(noteRawText); }
            detailedNoteContent = noteRawText.trim();
        } catch (noteError) {
            console.error('Detailed note generation error (YT):', noteError);
            // Update progress only if it hasn't reached key points generation stage
            safeProgress({ progress: 55, status: 'Note generation failed. Generating points...', error: noteError instanceof Error ? noteError.message : 'Unknown note gen error' });
        }

        safeProgress({ progress: 55, status: 'Generating key points...', error: null });

        // --- Key Points Generation ---
        const keyPointsPrompt = `Extract exactly 10 distinct key points from the following YouTube video info/transcript. List only the points. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:" \n\nTitle: ${videoTitle}\nText:\n---\n${baseTranscriptContent.slice(0, 25000)}\n---\n\nKey Points:\n1. ...`; // Increased slice to 25000 for better context
        let keyPoints: string[] = ['Key points generation failed.'];
         try {
             const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } }) }; // Increased maxOutputTokens
             const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
             const kpText = extractCandidateText(await kpResponse.text());
             if (kpText.startsWith("Error:")) { console.error("KP Error:", kpText); }
             else { const parsed = kpText.split('\n').map(l=>l.trim().replace(/^\d+\.\s*/,'')).filter(p=>p.length > 5).slice(0,10); if (parsed.length > 0) keyPoints = parsed; }
         } catch (kpError) { console.error('KP fetch error (YT):', kpError); }

        safeProgress({ progress: 75, status: 'Generating study questions...', error: null });

        // --- Study Questions Generation ---
        const questionsPrompt = `Based on YouTube video "${videoTitle}" (transcript/desc provided), generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nGenerate 10.\n\nText:\n---\n${baseTranscriptContent.slice(0, 25000)}\n---`; // Increased slice to 25000 for better context
        let questions: ProcessedYouTube['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) }; // Increased maxOutputTokens
            const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
            const qText = extractCandidateText(await qResponse.text());
             if (qText.startsWith("Error:")) { console.error("Questions Error:", qText); }
             else { /* ... (same parsing logic as in pdf-processor) ... */
                const blocks = qText.split(/---DIVIDER---/i); let parsed = [];
                for (const block of blocks) {
                    if (parsed.length >= 10) break; const T = block.trim(); if (!T) continue;
                    const qM = T.match(/^Question:\s*([\s\S]*?)\s*A\)/i); const oM = T.match(/A\)\s*(.*?)\s*B\)\s*(.*?)\s*C\)\s*(.*?)\s*D\)\s*(.*?)\s*Correct:/is); const cM = T.match(/Correct:\s*([A-D])\b/i); const eM = T.match(/Explanation:\s*([\s\S]*?)(?:---DIVIDER---|$)/i);
                    if (qM&&oM&&cM&&eM) { const qT=qM[1].trim(); const oL=[oM[1],oM[2],oM[3],oM[4]].map(o=>o.replace(/^(.*?)\s*(?:B\)|C\)|D\)|Correct:).*$/is,'$1').trim()); const cL=cM[1].toUpperCase(); const eT=eM[1].trim(); if(qT&&oL.length===4&&oL.every(o=>o)&&['A','B','C','D'].includes(cL)&&eT) parsed.push({question:qT,options:oL,correctAnswer:['A','B','C','D'].indexOf(cL),explanation:eT}); else console.warn("Partial question parse (YT)"); } else console.warn("Question structure parse fail (YT)");
                } if (parsed.length > 0) questions = parsed;
             }
        } catch (qError) { console.error('Questions fetch error (YT):', qError); }

        safeProgress({ progress: 100, status: 'Processing complete!', error: null });
        return {
            title: videoTitle,
            content: detailedNoteContent, // The detailed note
            keyPoints,
            questions,
            sourceUrl: youtubeVideoUrl,
        };

    } catch (error) {
        console.error('Overall YouTube processing failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown YouTube processing error.';
        safeProgress({ progress: 0, status: 'Error', error: errorMessage }); // Reset progress to 0 on total failure
        // Ensure the function re-throws the error so the caller knows it failed.
        if (error instanceof Error) throw error;
        else throw new Error(errorMessage);
    }
}
