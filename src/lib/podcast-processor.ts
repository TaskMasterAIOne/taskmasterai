// src/lib/podcast-processor.ts

// This interface should match or be compatible with what Notes.tsx uses for speaker profiles
export interface SpeakerProfileForProcessor {
    id: string; // e.g., 'felicity', 'christopher' - your internal ID
    elevenLabsVoiceId: string; // The actual ElevenLabs Voice ID
    // Add other fields if your processor needs them, like 'name' for debugging
    name?: string;
}

// This interface should match what Notes.tsx uses for podcast settings
export interface PodcastPlaybackSettingsForProcessor {
    language: string; // May still be useful for ElevenLabs context or future features
    speaker1Id: string | null; // Your internal ID for speaker 1 (e.g., 'felicity')
    speaker2Id: string | null; // Your internal ID for speaker 2 (e.g., 'christopher')
    length: 'short' | 'medium' | 'long' | null; // For potential future summarization
    instructions: string; // For potential future content focusing
}

export interface ProcessedPodcastSegment {
    speakerId: string | null; // Your internal speaker ID (e.g., 'felicity')
    text: string;
    elevenLabsVoiceId: string | null; // The crucial ElevenLabs Voice ID for this segment
}

export interface PodcastTextProcessResult {
    processedSegments?: ProcessedPodcastSegment[];
    error?: string;
    originalTextLength?: number;
    processedTextLength?: number;
}


// This function will now process a pre-written script with speaker tags.
export async function processTextForPodcast(
    _title: string, // No longer used, but kept for signature compatibility
    podcastScript: string, // This is the full script from the AI with speaker tags
    _keyPoints: string[] | undefined, // No longer used
    settings: PodcastPlaybackSettingsForProcessor,
    // This array comes from PREDEFINED_PODCAST_SPEAKERS in Notes.tsx
    availableSpeakerProfiles: SpeakerProfileForProcessor[]
): Promise<PodcastTextProcessResult> {
    if (!settings.speaker1Id) {
        return { error: "Speaker 1 must be selected for the podcast." };
    }

    const speaker1Profile = availableSpeakerProfiles.find(p => p.id === settings.speaker1Id);
    if (!speaker1Profile || !speaker1Profile.elevenLabsVoiceId) {
        return { error: `Configuration error: Speaker 1 ('${settings.speaker1Id}') profile or its ElevenLabs Voice ID is missing.` };
    }

    let speaker2Profile: SpeakerProfileForProcessor | undefined;
    if (settings.speaker2Id && settings.speaker2Id !== settings.speaker1Id) {
        speaker2Profile = availableSpeakerProfiles.find(p => p.id === settings.speaker2Id);
        if (!speaker2Profile || !speaker2Profile.elevenLabsVoiceId) {
            return { error: `Configuration error: Speaker 2 ('${settings.speaker2Id}') profile or its ElevenLabs Voice ID is missing.` };
        }
    }

    const rawScript = podcastScript.trim();
    if (!rawScript) {
        return { error: "No script content found to process for a podcast." };
    }

    const lines = rawScript.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        return { error: "Script content is empty after processing." };
    }

    const processedSegments: ProcessedPodcastSegment[] = [];
    let currentSegmentText = '';
    let currentSpeakerProfile: SpeakerProfileForProcessor | null = null;

    for (const line of lines) {
        let identifiedProfile: SpeakerProfileForProcessor | undefined;
        let cleanLine = line;

        if (line.trim().toUpperCase().startsWith('[SPEAKER_1]:')) {
            identifiedProfile = speaker1Profile;
            cleanLine = line.substring(line.indexOf(':') + 1).trim();
        } else if (speaker2Profile && line.trim().toUpperCase().startsWith('[SPEAKER_2]:')) {
            identifiedProfile = speaker2Profile;
            cleanLine = line.substring(line.indexOf(':') + 1).trim();
        } else if (!speaker2Profile && line.trim().toUpperCase().startsWith('[SPEAKER_2]:')) {
            // If a SPEAKER_2 tag exists but no profile is set, assign it to SPEAKER_1
            identifiedProfile = speaker1Profile;
            cleanLine = line.substring(line.indexOf(':') + 1).trim();
        }

        if (identifiedProfile) {
            // We have a line with a speaker tag
            if (currentSpeakerProfile && currentSpeakerProfile.id !== identifiedProfile.id) {
                // Speaker has changed, push the previous segment if it exists
                if (currentSegmentText.trim()) {
                    processedSegments.push({
                        speakerId: currentSpeakerProfile.id,
                        text: currentSegmentText.trim(),
                        elevenLabsVoiceId: currentSpeakerProfile.elevenLabsVoiceId,
                    });
                }
                // Start a new segment with the new speaker and line
                currentSegmentText = cleanLine;
                currentSpeakerProfile = identifiedProfile;
            } else {
                // Same speaker as before, or this is the very first line.
                if (!currentSpeakerProfile) {
                    currentSpeakerProfile = identifiedProfile;
                }
                // Append text to the current segment.
                currentSegmentText += ` ${cleanLine}`;
            }
        } else {
            // This line does not have a speaker tag. It's part of the previous speaker's dialogue.
            if (currentSpeakerProfile) {
                currentSegmentText += ` ${line.trim()}`;
            } else {
                 // No speaker has been identified yet. This is likely an intro before the first tag.
                 // Assign it to speaker 1 by default.
                 currentSpeakerProfile = speaker1Profile;
                 currentSegmentText = line.trim();
            }
        }
    }

    // After the loop, push the last remaining segment
    if (currentSpeakerProfile && currentSegmentText.trim()) {
        processedSegments.push({
            speakerId: currentSpeakerProfile.id,
            text: currentSegmentText.trim(),
            elevenLabsVoiceId: currentSpeakerProfile.elevenLabsVoiceId,
        });
    }

    if (processedSegments.length === 0) {
         return { error: "No valid text segments with speaker tags were created after processing the script." };
    }

    return {
        processedSegments,
        originalTextLength: rawScript.length,
        processedTextLength: processedSegments.reduce((sum, seg) => sum + (seg.text?.length || 0), 0),
    };
}
