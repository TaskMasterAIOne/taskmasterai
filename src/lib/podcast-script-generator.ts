import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { PodcastSettings, validatePodcastSettings } from './notes-firebase';

export interface PodcastSpeakerProfile {
    id: string;
    name: string;
    description: string;
    avatarUrl: string;
    elevenLabsVoiceId: string;
    sampleAudioUrl: string;
}

export interface PodcastTextObjects {
    title: string;
    contentHtml: string;
    keyPoints: string[];
}

export interface ScriptGenerationResult {
    success: boolean;
    script?: string;
    error?: string;
}

// Predefined podcast speakers (moved from Notes.tsx)
export const PREDEFINED_PODCAST_SPEAKERS: PodcastSpeakerProfile[] = [
    {
        id: 'felicity', 
        name: 'Felicity', 
        description: 'Polished, articulate, and easy on the ears.',
        avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/girl%20-%20felicity.jpg?alt=media&token=2515318d-1917-4561-9abb-400285733ef4',
        elevenLabsVoiceId: 'aTbnroHRGIomiKpqAQR8',
        sampleAudioUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/felicity_sample_voice.mp3?alt=media&token=d7c5bef0-cb45-491e-8e36-e792e63133e0'
    },
    {
        id: 'christopher', 
        name: 'Christopher', 
        description: 'Lifelike, expressive, and professionally tuned.',
        avatarUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/boy%20-%20christopher.jpg?alt=media&token=92d53b92-48a7-4b04-826e-bca0a8f0507f',
        elevenLabsVoiceId: 'G17SuINrv2H9FC6nvetn',
        sampleAudioUrl: 'https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/christopher_sample_voice.mp3?alt=media&token=fd0d094a-dbbb-40b3-8019-b8bd1b6c17aa'
    },
];

// Helper function to safely get speaker by ID
export const getSpeakerById = (speakerId: string | null): PodcastSpeakerProfile | null => {
    if (!speakerId) return null;
    return PREDEFINED_PODCAST_SPEAKERS.find(s => s.id === speakerId) || null;
};

// Helper function to get speaker display name
export const getSpeakerDisplayName = (speakerId: string | null | undefined): string => {
    if (!speakerId) return 'Unknown Speaker';
    const speaker = getSpeakerById(speakerId);
    return speaker?.name || 'Unknown Speaker';
};

// Helper function to get podcast speakers display text
export const getPodcastSpeakersText = (settings: any): string => {
    const validatedSettings = validatePodcastSettings(settings);
    
    if (!validatedSettings.speaker1Id) {
        return 'No speakers configured';
    }
    
    const speaker1Name = getSpeakerDisplayName(validatedSettings.speaker1Id);
    
    if (validatedSettings.speaker2Id && validatedSettings.speaker2Id !== validatedSettings.speaker1Id) {
        const speaker2Name = getSpeakerDisplayName(validatedSettings.speaker2Id);
        return `${speaker1Name} & ${speaker2Name}`;
    }
    
    return speaker1Name;
};

// Generate podcast script using Firebase function
export async function generatePodcastScript(
    podcastTextObjects: PodcastTextObjects,
    settings: PodcastSettings
): Promise<ScriptGenerationResult> {
    try {
        // Validate settings
        const validatedSettings = validatePodcastSettings(settings);
        
        // Get speaker profiles
        const speaker1Profile = getSpeakerById(validatedSettings.speaker1Id);
        const speaker2Profile = validatedSettings.speaker2Id ? getSpeakerById(validatedSettings.speaker2Id) : null;
        
        if (!speaker1Profile) {
            return {
                success: false,
                error: "Speaker 1 must be selected for podcast generation."
            };
        }
        
        // Build speaker instructions
        let speakerInstructions = `There is one speaker: [SPEAKER_1].
- **Name**: ${speaker1Profile.name}
- **Persona**: "${speaker1Profile.description}"
- **Role**: They are the sole narrator and host. They must embody their persona fully, making the script sound like a captivating monologue or story, not a dry reading.`;

        if (speaker2Profile) {
            speakerInstructions = `There are two speakers: [SPEAKER_1] and [SPEAKER_2].

[SPEAKER_1]:
- **Name**: ${speaker1Profile.name}
- **Persona**: "${speaker1Profile.description}"
- **Role**: To be the primary host and guide. They must lead the conversation, introduce topics, and steer the discussion. Their tone should be authoritative yet approachable.

[SPEAKER_2]:
- **Name**: ${speaker2Profile.name}
- **Persona**: "${speaker2Profile.description}"
- **Role**: To be the voice of the listener. They must actively interject with clarifying questions ("So, what you're saying is..."), provide real-world examples, challenge assumptions ("But does that always hold true?"), and offer alternative viewpoints to create a rich, multi-faceted dialogue.`;
        }

        // Build length instruction
        const lengthInstruction = {
            short: "The target length is 'short' (approx. 5-15 minutes). Every line must serve a purpose. Be ruthless in cutting fluff. The goal is maximum impact in minimum time.",
        }[validatedSettings.length || 'short'];

        // Build the complete script generation prompt
        const scriptGenPrompt = `You are a world-class podcast scriptwriter and narrative designer. Your job is not to summarize text, but to transmute it into a deeply engaging and authentic audio experience. You will adhere to every single rule in this prompt with absolute fidelity.

**Your Secret Raw Material (Source Note Content):**
"""
${podcastTextObjects.contentHtml}
"""

**Key Points to Weave In:**
${podcastTextObjects.keyPoints.map(point => `- ${point}`).join('\n')}

**DIRECTIVE 1: SPEAKER CONFIGURATION**
${speakerInstructions}

**DIRECTIVE 2: SCRIPT FORMAT**
You must format the script exactly like this:
[SPEAKER_1]: "Dialogue here..."
[SPEAKER_2]: "Response here..." (only if two speakers)

**DIRECTIVE 3: AUTHENTICITY RULES**
1. **Natural Speech Patterns:** People don't speak in essays. Use contractions, incomplete sentences, and natural hesitations.
2. **Conversational Flow:** Each speaker must respond to what the other just said, not deliver prepared monologues.
3. **Personality Consistency:** Each speaker must maintain their unique voice and perspective throughout.

**DIRECTIVE 4: ENGAGEMENT TECHNIQUES**
1. **Hook from the Start:** Open with intrigue, a surprising fact, or a compelling question.
2. **Maintain Momentum:** Use cliffhangers, callbacks, and smooth transitions between topics.
3. **The Landing (The Conclusion):** Don't just stop. Bring the conversation to a satisfying close. Have the speakers summarize the one or two most important takeaways. Leave the listener with a clear, memorable final thought.

**DIRECTIVE 5: CONTENT TRANSFORMATION**
- Transform facts into stories
- Turn abstract concepts into relatable analogies
- Convert bullet points into natural discoveries during conversation

**DIRECTIVE 6: LENGTH, PACE, AND USER INSTRUCTIONS**
- **Adhere to Length:** ${lengthInstruction}
- **Pacing is Key:** The script should feel energetic. Vary sentence length. Short, punchy lines create speed; longer, more thoughtful sentences can be used for emphasis.
- **Custom Instructions:** ${validatedSettings.instructions || 'None provided. Adhere to the core directives above.'}

**FINAL MANDATE:** Review all directives. Your mission is to produce a flawless script. The formatting must be perfect. The conversation must be authentic. The illusion must not be broken. Generate only the script. Begin now.
`;
        
        // Call Firebase function to generate script
        const functions = getFunctions(app);
        const generateScriptFn = httpsCallable(functions, 'generateAIResponse');
        
        const scriptResult = await generateScriptFn({
            prompt: scriptGenPrompt,
            model: "gemini-2.5-flash"
        });
        
        const parsedResult = scriptResult.data as { text?: string; error?: string };
        
        if (parsedResult.error || !parsedResult.text) {
            return {
                success: false,
                error: parsedResult.error || "Failed to generate podcast script."
            };
        }
        
        return {
            success: true,
            script: parsedResult.text
        };
        
    } catch (error: any) {
        console.error('Error generating podcast script:', error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred while generating the script."
        };
    }
}
