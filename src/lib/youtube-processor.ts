import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { 
    getTaskMasterProxy, 
    extractCandidateText, 
    AI_CONFIGS, 
    PROMPT_TEMPLATES,
    makeParallelAICalls,
    parseTopicsResponse,
    parseQuestionsWithTopics
} from './processors';
import { API_CONFIG, EXTERNAL_APIS, FILE_CONFIG } from '../config/constants';

interface ProcessedYouTube {
    title: string;
    content: string;
    keyPoints: string[];
    questions: {
        id: string;
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
        topicId: string;
        hint?: string;
    }[];
    topics: {
        id: string;
        name: string;
        description: string;
    }[];
    flashcards?: { front: string; back: string; }[];
    sourceUrl: string;
}

const YOUTUBE_API_KEY = API_CONFIG.youtubeApiKey;

function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
async function fetchWithRetry(url: string, options: RequestInit, retries = FILE_CONFIG.retryAttempts, delayMs = FILE_CONFIG.retryDelayMs): Promise<Response> {
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
    const taskMasterProxyCallable = getTaskMasterProxy();

    if (!YOUTUBE_API_KEY || ['YOUR_YOUTUBE_API_KEY', 'YOUR_ACTUAL_YOUTUBE_API_KEY_HERE'].includes(YOUTUBE_API_KEY) ) {
        throw new Error('YouTube API Key missing/invalid. Please configure a valid key in your environment variables.');
    }

    let baseTranscriptContent = '';

    try {
        safeProgress(5);
        const videoId = getVideoId(url);
        if (!videoId) { throw new Error('Invalid YouTube URL.'); }
        const youtubeVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const videoDetailsUrl = `${EXTERNAL_APIS.youtube}/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const videoResponse = await fetchWithRetry(videoDetailsUrl, {});
        if (!videoResponse.ok) { throw new Error(`Failed to fetch video details (${videoResponse.status}).`); }
        const videoData = await videoResponse.json();
        if (!videoData.items?.[0]?.snippet) { throw new Error('Video metadata not found.'); }
        const videoInfo = videoData.items[0].snippet;
        const videoDescription = videoInfo.description || '';
        safeProgress(15);
        
        let fetchedTranscriptText = '';
        const captionsListUrl = `${EXTERNAL_APIS.youtube}/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
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
        if (!baseTranscriptContent.trim()) { 
            throw new Error('No transcript or description available for this video. Please try a different video or ensure the video has captions enabled.'); 
        }

        // Use parallel AI processing for faster note creation
        safeProgress(40);
        
        const aiCalls = [
            {
                key: 'title',
                prompt: PROMPT_TEMPLATES.TITLE_GENERATION(baseTranscriptContent.slice(0, 4000), videoInfo.title),
                config: AI_CONFIGS.TITLE_GENERATION
            },
            {
                key: 'content',
                prompt: PROMPT_TEMPLATES.NOTE_GENERATION(baseTranscriptContent, videoInfo.title),
                config: AI_CONFIGS.NOTE_GENERATION
            },
            {
                key: 'keyPoints',
                prompt: PROMPT_TEMPLATES.KEY_POINTS(baseTranscriptContent),
                config: AI_CONFIGS.KEY_POINTS
            },
            {
                key: 'flashcards',
                prompt: PROMPT_TEMPLATES.FLASHCARDS(baseTranscriptContent),
                config: AI_CONFIGS.FLASHCARDS
            },
            {
                key: 'topics',
                prompt: PROMPT_TEMPLATES.TOPICS(baseTranscriptContent),
                config: AI_CONFIGS.QUESTIONS
            },
            {
                key: 'questions',
                prompt: PROMPT_TEMPLATES.QUESTIONS(baseTranscriptContent),
                config: AI_CONFIGS.QUESTIONS
            }
        ];

        const aiResults = await makeParallelAICalls(aiCalls, (progress) => {
            safeProgress(40 + Math.round(progress * 0.5)); // 40-90% range
        });

        // Process results
        let title = aiResults.title.replace(/["']/g, "").trim() || videoInfo.title;
        
        let content = aiResults.content;
        if (content.startsWith("Error:")) { 
            content = `<p><strong>Error generating note:</strong> ${content}</p>`; 
        }

        let keyPoints = aiResults.keyPoints.split('\n')
            .map(l => l.trim().replace(/^(\*|-|\d+\.)\s*/, ''))
            .filter(p => p.length > 5 && !p.toLowerCase().includes("primary task"));
        if (keyPoints.length === 0) { 
            keyPoints.push("Key point generation failed."); 
        }

        // Process flashcards
        const fcRawText = aiResults.flashcards;
        let flashcards: ProcessedYouTube['flashcards'] = [];
        if (!fcRawText.startsWith("Error:")) {
            fcRawText.split(/---FLASHCARD_DIVIDER---/i).forEach(block => {
                const match = block.trim().match(/^(?:Front:\s*)?([\s\S]*?)\s*\nBack:\s*([\s\S]*)$/is);
                if (match && match[1] && match[2] && match[1].trim() && match[2].trim()) {
                    flashcards.push({ front: match[1].trim(), back: match[2].trim() });
                }
            });
        }
        
        // Process topics
        const topicsRawText = aiResults.topics;
        let topics: ProcessedYouTube['topics'] = [];
        if (!topicsRawText.startsWith("Error:")) {
            topics = parseTopicsResponse(topicsRawText);
        }

        // Process questions with topics and hints
        const qRawText = aiResults.questions;
        let questions: ProcessedYouTube['questions'] = [];
        if (!qRawText.startsWith("Error:")) {
            questions = parseQuestionsWithTopics(qRawText);
        }
        safeProgress(100);

        return { title, content, keyPoints, questions, topics, flashcards, sourceUrl: youtubeVideoUrl };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown YouTube processing error.';
        throw new Error(errorMessage);
    }
}
