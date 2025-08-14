import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { 
    getGeminiProxy, 
    extractCandidateText, 
    AI_CONFIGS, 
    PROMPT_TEMPLATES 
} from './processors';

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
        } catch (error) {
            if (attempt === retries - 1) throw error;
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw new Error(`Max retries reached for ${url}`);
}

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
    onProgress: (progress: number) => void
): Promise<ProcessedYouTube> {
    const safeProgress = typeof onProgress === 'function' ? onProgress : () => {};
    const geminiProxyCallable = getGeminiProxy();

    if (!YOUTUBE_API_KEY || ['YOUR_YOUTUBE_API_KEY', 'YOUR_ACTUAL_YOUTUBE_API_KEY_HERE'].includes(YOUTUBE_API_KEY) ) {
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

        // Use centralized prompt templates and AI configs
        const titlePrompt = PROMPT_TEMPLATES.TITLE_GENERATION(baseTranscriptContent.slice(0, 4000), videoInfo.title);
        const titleResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: titlePrompt }] }], 
            generationConfig: AI_CONFIGS.TITLE_GENERATION 
        });
        let title = extractCandidateText(JSON.stringify(titleResult.data)).replace(/["']/g, "").trim() || videoInfo.title;
        safeProgress(40);
        
        const notePrompt = PROMPT_TEMPLATES.NOTE_GENERATION(baseTranscriptContent, videoInfo.title);
        const noteResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: notePrompt }] }], 
            generationConfig: AI_CONFIGS.NOTE_GENERATION 
        });
        let content = extractCandidateText(JSON.stringify(noteResult.data));
        if (content.startsWith("Error:")) { content = `<p><strong>Error generating note:</strong> ${content}</p>`; }
        safeProgress(60);

        const keyPointsPrompt = PROMPT_TEMPLATES.KEY_POINTS(baseTranscriptContent, content);
        const kpResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: keyPointsPrompt }] }], 
            generationConfig: AI_CONFIGS.KEY_POINTS 
        });
        let keyPoints = (extractCandidateText(JSON.stringify(kpResult.data))).split('\n').map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, '')).filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
        if (keyPoints.length === 0) { keyPoints.push("Key point generation failed."); }
        safeProgress(75);

        const flashcardsPrompt = PROMPT_TEMPLATES.FLASHCARDS(baseTranscriptContent, content);
        const fcResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: flashcardsPrompt }] }], 
            generationConfig: AI_CONFIGS.FLASHCARDS 
        });
        const fcRawText = extractCandidateText(JSON.stringify(fcResult.data));
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

        const questionsPrompt = PROMPT_TEMPLATES.QUESTIONS(baseTranscriptContent, content);
        const qResult = await geminiProxyCallable({ 
            contents: [{ parts: [{ text: questionsPrompt }] }], 
            generationConfig: AI_CONFIGS.QUESTIONS 
        });
        const qRawText = extractCandidateText(JSON.stringify(qResult.data));
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
