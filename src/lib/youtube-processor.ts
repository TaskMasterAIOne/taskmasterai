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
const YOUTUBE_API_KEY = 'AIzaSyD4iosX8Y1X4bOThSGhYyUfCmWKBEkc6x4'; // <-- IMPORTANT: Replace this

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
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') { safeProgress({ progress: 0, status: 'Error', error: 'YouTube API Key missing/invalid.' }); throw new Error('YouTube API Key missing/invalid.'); }

    let transcript = ''; // Store transcript/description

    try {
        safeProgress({ progress: 0, status: 'Starting YouTube processing...', error: null });
        const videoId = getVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL.');
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        safeProgress({ progress: 10, status: 'Fetching video metadata...', error: null });
        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const videoResponse = await fetchWithRetry(videoDetailsUrl, {});
        if (!videoResponse.ok) { const errorText = await videoResponse.text(); console.error("YT API Error:", errorText); throw new Error(`Failed to fetch video details (${videoResponse.status}). Check API Key/Video ID.`); }
        const videoData = await videoResponse.json();
        if (!videoData.items?.[0]?.snippet) { throw new Error('Video metadata not found (private/deleted?).'); }
        const videoInfo = videoData.items[0].snippet;
        const videoTitle = videoInfo.title || 'Untitled Video';

        safeProgress({ progress: 25, status: 'Fetching transcript/description...', error: null });
        // --- Transcript Placeholder ---
        // Using description only. Replace with a real transcript solution if possible.
        transcript = videoInfo.description || '';
        if (!transcript.trim()) { transcript = "No transcript or description available."; console.warn(`No transcript/description for ${videoId}.`); }
        else { console.log(`Using description for ${videoId}. Length: ${transcript.length}`); }

        safeProgress({ progress: 40, status: 'Generating detailed note...', error: null });

        // --- Detailed Note Generation ---
const detailedNotePrompt = `Analyze the following **YouTube video information** (Title and Transcript/Description) provided below. Your task is to generate an **exceptionally detailed, comprehensive, and well-structured set of notes *derived directly from this video's content*** using Markdown format. Aim for significant length and depth, reproducing the level of detail found in a study guide or detailed lecture notes, focusing *only* on the information present in the provided video title and transcript/description.

**Instructions:**

1.  **Source Focus:** Base your analysis and note generation **strictly and solely** on the content within the provided \`Video Information\` section below (Title and Transcript/Description). Do not introduce outside information, interpretations, or general knowledge about the video's topic *not explicitly mentioned* in the provided text.
2.  **Structure:** Use Markdown extensively to organize the information logically based on the **video's apparent flow and topics** as revealed by the transcript/description. Employ the following Markdown elements:
    *   **Headings:** Use \`# Main Topics/Sections\`, \`## Sub-Topics\`, and \`### Specific Points\` to create a clear hierarchical structure reflecting the video's likely organization. Use the Video Title possibly as a main heading (\`#\`) or part of it.
    *   **Lists:** Utilize \`*\`, \`-\`, or \`+\` for bullet points and numbered lists (\`1.\`, \`2.\`, etc.) where appropriate to present key ideas, steps, arguments, examples, or sequences *mentioned in the video*.
    *   **Emphasis:** Use \`**bold**\` for key terms, concepts, speakers (if mentioned), important figures/data *highlighted in the video's content*, \`*italics*\` for emphasis or definitions *from the video*, \`***bold italics***\` for strong emphasis, and \`\`\`inline code\`\`\` for short code snippets or technical terms *shown or spoken in the video*. Use \`~~strikethrough~~\` if the transcript indicates corrected or retracted statements.
    *   **Tables:** If the **video's transcript/description presents data** (e.g., comparisons, results, feature lists) that can be effectively presented in a tabular format, reproduce it using Markdown tables based on the information given. Ensure clear headers and well-organized rows/columns. Use colons (:) for alignment. Example:
        \`\`\`markdown
        | Feature/Aspect | Detail 1 (from video) | Detail 2 (from video) |
        |:---------------|:----------------------|:----------------------|
        | Topic A        | Point X               | Point Y               |
        | Topic B        | Point Z               | ...                   |
        \`\`\`
    *   **Code Blocks:** Use fenced code blocks (\`\`\`) for multi-line code examples **shown or dictated in the video**. Specify the language if apparent from the transcript (e.g., \`\`\`python\`).
    *   **Blockquotes:** Use \`>\` for direct, significant quotes **spoken by speakers in the video** or important statements highlighted in the description.
    *   **Horizontal Rules:** Use \`---\`, \`***\`, or \`___\` to visually separate distinct sections or topic shifts *apparent in the transcript*.
    *   **Footnotes:** Use footnotes (\`[^label]\` and \`[^label]: Explanation from video...\`) sparingly for tangential points or specific references *mentioned explicitly* in the video content.
    *   **Definition Lists:** If the **video explicitly defines terms**, use definition lists:
        \`\`\`markdown
        Term Mentioned in Video
        : Definition given in the Video.
        \`\`\`
    *   **Task Lists (Checkboxes):** Only if the **video itself outlines steps as a checklist** or actionable tasks.
        \`\`\`markdown
        - [ ] Step 1 mentioned in video.
        - [ ] Step 2 mentioned in video.
        \`\`\`
    *   **Emoji:** Avoid unless part of the actual transcript/description text.
    *   **Subscript/Superscript:** Use HTML tags (\`<sub>\`, \`<sup>\`) if the transcript includes formulas or notation requiring them (e.g., chemical formulas, math).
    *   **Highlighting:** Use \`==highlighted text==\` only if the transcript *itself* denotes emphasis in a way that suggests highlighting (rare).
    *   **LaTeX:** Use LaTeX (\`$\` \`$\` for inline, \`$$\` \`$$\` for display) **only if the video transcript contains complex mathematical/scientific notation** requiring it for accurate representation.
3.  **Comprehensiveness & Detail:** Do **NOT** summarize briefly. Your goal is to **extract and meticulously present** the key concepts, arguments, explanations, examples, steps, data, visuals described, and supporting details **conveyed in the video's title and transcript/description**. Go into substantial detail for each point.
4.  **Length:** Generate a **lengthy and exhaustive** output. Capture as much specific information **from the video's content (as represented by the transcript/description)** as possible. Err on the side of including more detail. The length should reflect the detail available in the source material.
5.  **Visuals Mentioned:** If the **transcript explicitly mentions or describes visuals** (e.g., "As you can see on this slide...", "This graph shows...", "Look at this diagram..."), *describe* these visuals based *only* on the information provided in the transcript. Note what is being shown and its purpose according to the speaker.
6.  **Output Format:** Provide **only** the generated Markdown note content below. Do not include any introductory phrases (like "Here are the notes:") or concluding remarks. Start directly with the first Markdown heading or point derived from the video information.

**Video Information:**

**Title:** ${videoTitle}

**Transcript/Description:**
---
${transcript.slice(0, 25000)}
---

**Generated Markdown Notes:**
`; // No trailing characters or comments after this line
        let detailedNoteContent = 'AI detailed note generation failed.';
        try {
            const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: detailedNotePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 4096 } }) };
            const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
            const noteRawText = extractCandidateText(await noteResponse.text());
            if (noteRawText.startsWith("Error:")) { throw new Error(noteRawText); }
            detailedNoteContent = noteRawText.trim();
        } catch (noteError) {
            console.error('Detailed note generation error (YT):', noteError);
            safeProgress({ progress: 60, status: 'Note generation failed. Generating points...', error: noteError instanceof Error ? noteError.message : 'Unknown note gen error' });
        }

        safeProgress({ progress: 60, status: 'Generating key points...', error: null });

        // --- Key Points Generation ---
        const keyPointsPrompt = `Extract exactly 10 distinct key points from the following YouTube video info/transcript. List only the points. In your output, NEVER SAY: "Here are 10 distinct and significant key points from the provided text:" \n\nTitle: ${videoTitle}\nText:\n---\n${transcript.slice(0, 15000)}\n---\n\nKey Points:\n1. ...`;
        let keyPoints: string[] = ['Key points generation failed.'];
         try {
             const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 800 } }) };
             const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
             const kpText = extractCandidateText(await kpResponse.text());
             if (kpText.startsWith("Error:")) { console.error("KP Error:", kpText); }
             else { const parsed = kpText.split('\n').map(l=>l.trim().replace(/^\d+\.\s*/,'')).filter(p=>p.length > 5).slice(0,10); if (parsed.length > 0) keyPoints = parsed; }
         } catch (kpError) { console.error('KP fetch error (YT):', kpError); }

        safeProgress({ progress: 80, status: 'Generating study questions...', error: null });

        // --- Study Questions Generation ---
        const questionsPrompt = `Based on YouTube video "${videoTitle}" (transcript/desc provided), generate exactly 10 MCQs (4 options A,B,C,D), correct letter, explanation. Format strictly:\n\nQuestion: [Q]\nA) [A]\nB) [B]\nC) [C]\nD) [D]\nCorrect: [Letter]\nExplanation: [E]\n\n---DIVIDER---\n\nGenerate 10.\n\nText:\n---\n${transcript.slice(0, 15000)}\n---`;
        let questions: ProcessedYouTube['questions'] = [];
        try {
            const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 3000 } }) };
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
                console.log(`Generated ${parsed.length} questions (YT)`);
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
        safeProgress({ progress: 0, status: 'Error', error: errorMessage });
        throw new Error(errorMessage);
    }
}
