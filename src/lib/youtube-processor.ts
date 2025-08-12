import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

interface ProcessedYouTube {
    title: string;
    content: string;
    keyPoints: string[];
    questions: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    flashcards?: { front: string; back: string; }[];
    sourceUrl: string;
}

const YOUTUBE_API_KEY = 'AIzaSyCoxefrJ80LuyxLAdv0t55BN8SJ9_-orcM';

function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 3000): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                await sleep(delayMs * (attempt + 1));
                continue;
            }
            return response;
        }
        catch (error) {
            if (attempt === retries - 1) throw error;
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw new Error(`Max retries reached for ${url}`);
}

const extractCandidateText = (responseText: string): string => {
    try { const jsonResponse = JSON.parse(responseText); if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) { return jsonResponse.candidates[0].content.parts[0].text; } if (jsonResponse?.error?.message) { return `Error: ${jsonResponse.error.message}`; } if (jsonResponse?.promptFeedback?.blockReason) { return `Error: Request blocked for reason: ${jsonResponse.promptFeedback.blockReason}`;} return "Error: No text found in AI response."; }
    catch (err) { if (responseText.toLowerCase().includes("api key not valid")) return "Error: Invalid API Key."; return "Error: Could not parse AI response."; }
};

function getVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; const match = url.match(regex); return match ? match[1] : null;
}

function parseSrt(srtContent: string): string {
    return srtContent
        .replace(/(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .join(' ');
}

interface YouTubeCaptionTrackSnippet { videoId: string; lastUpdated: string; trackKind: 'standard' | 'ASR' | 'forced'; language: string; name: string; audioTrackType: string; isCC: boolean; isLarge: boolean; isEasyReader: boolean; isDraft: boolean; isAutoSynced: boolean; status: string; }
interface YouTubeCaptionTrack { id: string; snippet: YouTubeCaptionTrackSnippet; }
interface YouTubeCaptionListResponse { kind: string; etag: string; items: YouTubeCaptionTrack[]; }

export async function processYouTube(
    url: string,
    userId: string,
    apiKey: string,
    onProgress: (progress: number) => void
): Promise<ProcessedYouTube> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const currentGeminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    if (!apiKey) { throw new Error('Gemini API Key missing.'); }
    const placeholderKeys = ['YOUR_YOUTUBE_API_KEY', 'YOUR_ACTUAL_YOUTUBE_API_KEY_HERE'];
    if (!YOUTUBE_API_KEY || placeholderKeys.includes(YOUTUBE_API_KEY) ) {
        throw new Error('YouTube API Key missing/invalid. Please set a valid key in youtube-processor.ts.');
    }

    let baseTranscriptContent = '';

    try {
        safeProgress(5);
        const videoId = getVideoId(url);
        if (!videoId) { throw new Error('Invalid YouTube URL.'); }
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const videoResponse = await fetchWithRetry(videoDetailsUrl, {});
        if (!videoResponse.ok) { throw new Error(`Failed to fetch video details (${videoResponse.status}).`); }
        const videoData = await videoResponse.json();
        if (!videoData.items?.[0]?.snippet) { throw new Error('Video metadata not found.'); }
        const videoInfo = videoData.items[0].snippet;
        const videoDescription = videoInfo.description || '';
        safeProgress(15);
        
        let fetchedTranscriptText = '';
        const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
        try {
            const captionsListResponse = await fetchWithRetry(captionsListUrl, {});
            if (captionsListResponse.ok) {
                const captionsData: YouTubeCaptionListResponse = await captionsListResponse.json();
                if (captionsData.items && captionsData.items.length > 0) {
                    const track = captionsData.items.find(t => t.snippet.language.startsWith('en')) || captionsData.items[0];
                    if (track) {
                        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${track.id}?key=${YOUTUBE_API_KEY}&tfmt=srt`;
                        const transcriptResponse = await fetchWithRetry(downloadUrl, {});
                        if (transcriptResponse.ok) { fetchedTranscriptText = parseSrt(await transcriptResponse.text()); }
                    }
                }
            }
        } catch (captionError) {}
        safeProgress(30);

        baseTranscriptContent = fetchedTranscriptText.trim() ? fetchedTranscriptText : videoDescription;
        if (!baseTranscriptContent.trim()) { baseTranscriptContent = "No transcript or description available."; }

        const titlePrompt = `Analyze the following video transcript. Generate a concise, descriptive title for the video. The title should be no more than 5 words. Do not add any extra text or quotation marks. TRANSCRIPT: """${baseTranscriptContent.slice(0, 4000)}""" TITLE:`;
        const titleOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: titlePrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 8192 } }) };
        const titleResponse = await fetchWithRetry(currentGeminiEndpoint, titleOptions);
        let title = extractCandidateText(await titleResponse.text()).replace(/["']/g, "").trim() || videoInfo.title;
        safeProgress(40);
        
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
   - **<h2>** for subtopics, examples, methods, or related ideas.
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
     - <h1>, <h2>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td> 

   🚫 DO NOT USE:
     - <html>, <head>, <body>, <div>, <span>, <style>, <script>, or any inline styles like style="..." or class="..."
     - No markdown formatting. HTML only.
     - No links unless they are part of academic citation, which is rare and discouraged.
     - No embedded media — the result must be copy-pasteable into a rich text editor.
     - No <h3> or higher tags. MAX is <h2>. 

8. ❗ ABSOLUTELY PROHIBITED:
   - Do NOT refer to yourself, your process, or the original source.
   - Do NOT include commentary like “Here’s what we can learn…” or “Let’s break this down…”
   - Do NOT explain what you’re doing — just do it.
   - Do NOT wrap your output in triple backticks or any markdown syntax.

9. 📄 FINAL OUTPUT:
   - Output ONLY the HTML content. It should begin immediately with a valid HTML tag such as <h1> or <p>.
   - The entire response must be a single, continuous HTML document — clean, readable, structured, and content-rich.

Transcript from "${videoInfo.title}":
---
${baseTranscriptContent}
---
Your Response (Raw, clean HTML):`;
        const noteOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: notePrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 65536 } }) };
        const noteResponse = await fetchWithRetry(currentGeminiEndpoint, noteOptions);
        let content = extractCandidateText(await noteResponse.text());
        if (content.startsWith("Error:")) { content = `<p><strong>Error generating note:</strong> ${content}</p>`; }
        safeProgress(60);

        const keyPointsPrompt = `You are a precision extractor. List 5-10 of the most critical takeaways from the text. DO NOT write about the instructions; focus ONLY on the subject matter.

RULES:
1.  Output a list only.
2.  Every point MUST begin with \`* \`.
3.  One point per line, under 25 words.
4.  No extra text. Start with the first asterisk.

    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWYAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${baseTranscriptContent}
---
Your Response:
* `;
        const kpOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: keyPointsPrompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 65536 } }) };
        const kpResponse = await fetchWithRetry(currentGeminiEndpoint, kpOptions);
        let keyPoints = (extractCandidateText(await kpResponse.text())).split('\n').map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '')).filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
        if (keyPoints.length === 0) { keyPoints.push("Key point generation failed."); }
        safeProgress(75);

        const flashcardsPrompt = `Generate 10-15 high-quality flashcards from the transcript.

RULES:
1.  Use this block structure:
    Front: [Front text]
    Back: [Back text]
2.  Separate each block with a line containing only: \`---FLASHCARD_DIVIDER---\`
3.  No extra text. Start with "Front:".


    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWYAYS USE THAT LATEX FOR MATH ONLY.

Transcript:
---
${baseTranscriptContent}
---
Your Response:
Front:`;
        const fcOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: flashcardsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 65536 } }) };
        const fcResponse = await fetchWithRetry(currentGeminiEndpoint, fcOptions);
        const fcRawText = extractCandidateText(await fcResponse.text());
        let flashcards: ProcessedYouTube['flashcards'] = [];
        if (!fcRawText.startsWith("Error:")) {
             fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
                const match = block.trim().match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);
                if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
                    flashcards.push({ front: match[1].trim(), back: match[2].trim() });
                }
            });
        }
        safeProgress(85);

        const questionsPrompt = `Generate exactly 10 MCQs from the transcript.

RULES:
1.  Use this 7-line block structure:
    Question: [Question]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Correct: [Letter]
    Explanation: [Explanation]
2.  Separate each block with a line containing only: \`---DIVIDER---\`
3.  No extra text. Start with "Question:".

    FOR MATH USE THIS:

Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWYAYS USE THAT LATEX FOR MATH ONLY.

Transcript:
---
${baseTranscriptContent}
---
Your Response:
Question:`;
        const qOptions = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: questionsPrompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 65536 } }) };
        const qResponse = await fetchWithRetry(currentGeminiEndpoint, qOptions);
        const qRawText = extractCandidateText(await qResponse.text());
        let questions: ProcessedYouTube['questions'] = [];
        if (!qRawText.startsWith("Error:")) {
            qRawText.split(/---DIVIDER---/i).forEach(block => {
                const qM = block.match(/Question:\s*([\s\S]*?)\s*A\)/i);
                const oM = block.match(/A\)\s*([\s\S]*?)\s*B\)\s*([\s\S]*?)\s*C\)\s*([\s\S]*?)\s*D\)\s*([\s\S]*?)\s*Correct:/is);
                const cM = block.match(/Correct:\s*([A-D])/i);
                const eM = block.match(/Explanation:\s*([\s\S]*)$/i);
                if (qM && oM && cM && eM) {
                    const oL = [oM[1], oM[2], oM[3], oM[4]].map(o => o.trim());
                    const cL = cM[1].toUpperCase();
                    if (oL.every(o => o) && ['A', 'B', 'C', 'D'].includes(cL)) {
                        questions.push({ question: qM[1].trim(), options: oL, correctAnswer: ['A', 'B', 'C', 'D'].indexOf(cL), explanation: eM[1].trim() });
                    }
                }
            });
        }
        safeProgress(100);

        return { title, content, keyPoints, questions, flashcards, sourceUrl: youtubeVideoUrl };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown YouTube processing error.';
        throw new Error(errorMessage);
    }
}
