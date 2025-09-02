// src/lib/processors.ts
// Main processors file that consolidates all AI processing functions
// All API calls go through the secure geminiProxy function

import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { processPDF, ProcessedPDF } from './pdf-processor';
import { processYouTube } from './youtube-processor';
import { processTextForPodcast, PodcastTextProcessResult, SpeakerProfileForProcessor, PodcastPlaybackSettingsForProcessor } from './podcast-processor';

// Re-export all processor types for easy importing
export type {
    ProcessedPDF,
    PodcastTextProcessResult,
    SpeakerProfileForProcessor,
    PodcastPlaybackSettingsForProcessor
};

// Re-export all processor functions
export {
    processPDF,
    processYouTube,
    processTextForPodcast
};

// Helper function to get the geminiProxy callable with rate limiting
export const getGeminiProxy = () => {
    const originalCallable = httpsCallable(getFunctions(), 'geminiProxy');
    
    // Wrap with error handling for rate limits
    return async (data: any) => {
        try {
            return await originalCallable(data);
        } catch (error: any) {
            if (error.code === 'functions/resource-exhausted') {
                // Server-side rate limit hit - this is the real protection
                throw new Error('Rate limit exceeded. Please try again in a few minutes.');
            }
            throw error;
        }
    };
};

// Utility function to extract text from Gemini API responses
export const extractCandidateText = (responseText: string): string => {
    try {
        const jsonResponse = JSON.parse(responseText);
        
        // Check for errors first
        if (jsonResponse?.error?.message) {
            return `Error: ${jsonResponse.error.message}`;
        }
        
        if (jsonResponse?.promptFeedback?.blockReason) {
            return `Error: Request blocked for reason: ${jsonResponse.promptFeedback.blockReason}`;
        }
        
        // Try to extract text from the response
        if (jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return jsonResponse.candidates[0].content.parts[0].text;
        }
        
        // Check for alternative response structures
        if (jsonResponse?.candidates?.[0]?.content?.parts) {
            const parts = jsonResponse.candidates[0].content.parts;
            for (const part of parts) {
                if (part.text && part.text.trim()) {
                    return part.text;
                }
            }
        }
        
        // Check if response has a different structure
        if (jsonResponse?.text) {
            return jsonResponse.text;
        }
        
        // Log the actual response structure for debugging
        console.error('Unexpected AI response structure:', JSON.stringify(jsonResponse, null, 2));
        
        return "Error: No text found in the expected AI response structure.";
    } catch (err) {
        console.error('Error parsing AI response:', err);
        console.error('Raw response:', responseText);
        
        if (responseText.toLowerCase().includes("api key not valid")) {
            return "Error: Invalid API Key.";
        }
        
        if (responseText.toLowerCase().includes("quota")) {
            return "Error: API quota exceeded.";
        }
        
        if (responseText.toLowerCase().includes("rate limit")) {
            return "Error: Rate limit exceeded.";
        }
        
        return "Error: Could not parse the AI response.";
    }
};

// Common AI processing configurations - Optimized for speed
export const AI_CONFIGS = {
    TITLE_GENERATION: {
        temperature: 0.3,
        maxOutputTokens: 1024  // Reduced from 8192 for faster response
    },
    NOTE_GENERATION: {
        temperature: 0.6,
        maxOutputTokens: 16384  // Reduced from 65536 for faster response
    },
    KEY_POINTS: {
        temperature: 0.4,
        maxOutputTokens: 4096   // Reduced from 65536 for faster response
    },
    FLASHCARDS: {
        temperature: 0.5,
        maxOutputTokens: 8192   // Reduced from 65536 for faster response
    },
    QUESTIONS: {
        temperature: 0.6,
        maxOutputTokens: 8192   // Reduced from 65536 for faster response
    }
} as const;

// Common prompt templates that can be reused
export const PROMPT_TEMPLATES = {
    TITLE_GENERATION: (text: string, sourceName?: string) => 
        `Analyze the following ${sourceName ? `text from ${sourceName}` : 'text'}. Your single task is to generate a concise, descriptive, and relevant title for this document. The title should be no more than 5 words. Do not add any extra text, explanation, or quotation marks. Output only the title itself. TEXT: """${text.slice(0, 4000)}""" TITLE:`,
    
    NOTE_GENERATION: (text: string, sourceName?: string) => 
        `🧠 ROLE:
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
   - DESCRIPTIONS/EXPLAINATIONS FOR EACH TERM OR CONCEPT MUST BE SHORT! THE USER SHOULDN'T HAVE TO READ SO MUCH JUST TO UNDERSTAND ONE THING. AGAIN, LIKE REAL NOTES, EXPLANATIONS/DESCRIPTIONS MUST BE SHORT AND TO THE POINT.
   - HEADERS TITLE NAMING MUST BE SHORT, NOT VERY LONG. FAILURE TO COMPLY WILL RESULT IN TERMINATION. EXAMPLE OF A BAD HEADING TITLE: "The Encomienda System: Exploitation and Resistance in Colonial America". EXAMPLE OF A GOOD HEADING TITLE: "The Encomienda System".

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
     - No links unless they are part of an academic citation, which is rare and discouraged.
     - No embedded media — the result must be copy-pasteable into a rich text editor.
     - No <h3> or higher tags. MAX is <h2>.  USING <h3> TAGS WILL RESULT IN TERMINATION. IF A SECTION NEEDS A HEADING, BUT ALSO HAS SUBSECTIONS, THEN YOU NEED TO USE <h1> FOR THAT MAIN SECTION HEADING, AND <h2> FOR THOSE SUBSECTIONS HEADING. BUT USING <h3> WILL GET YOU BANNED.

8. ❗ ABSOLUTELY PROHIBITED:
   - Do NOT refer to yourself, your process, or the original source.
   - Do NOT include commentary like "Here's what we can learn…" or "Let's break this down…"
   - Do NOT explain what you're doing — just do it.
   - Do NOT wrap your output in triple backticks or any markdown syntax.
   - USING <h3> TAGS WILL RESULT IN TERMINATION. IF A SECTION NEEDS A HEADING, BUT ALSO HAS SUBSECTIONS, THEN YOU NEED TO USE <h1> FOR THAT MAIN SECTION HEADING, AND <h2> FOR THOSE SUBSECTIONS HEADING. BUT USING <h3> WILL GET YOU BANNED.
   - NO EXCESSIVE COMMENTARY. DO NOT SAY SOMETHING LIKE "Welcome to this in-depth study guide...." DONT CALL IT A STUDY GUIDE. JUST START WITH THE NOTES! DO NOT GIVE A BLURB BEFORE THE NOTES CONTENT. THE USER IS NOT TALKING WITH YOU. THE USER JUST NEEDS NOTES TO STUDY, NOT YOUR EXCESSIVE COMMENTARY. DO NOT CREATE RANDOM SYMBOLS OR WORDING LIKE :  "ปัจจัย ที่ มี ผล ต่อ การ ออม". EXAMPLE OF A BLURB AT THE TOP OF THE NOTES THAT YOU MUST NOT REPLICATE: "The Encomienda System was a labor and tribute system implemented by the Spanish Crown in its American colonies during the 16th century. It was a cornerstone of colonial administration and economic exploitation, profoundly shaping the early interactions between European colonizers and indigenous populations. While theoretically designed to protect and Christianize Native Americans, in practice, it became a brutal mechanism for forced labor and wealth extraction, leading to catastrophic demographic decline and widespread suffering."  THIS IS NOT NEEDED.
   - DO NOT ADD A BLURB AT THE END OF THE NOTES EITHER., AGAIN, THE USER IS NOT TALKING TO YOU AND YOU ARE NOT TALKING TO THE USER. YOU JOB IS TO ONLY CREATE NOTES, NOT CHAT WITH THE USER. THIS IS HIGHLY STRICT AND IMPORTANT. FAILURE TO COMPLY WILL RESULT IN TERMINATION. 
   

9. 📄 FINAL OUTPUT:
   - Output ONLY the HTML content. It should begin immediately with a valid HTML tag such as <h1> or <p>.
   - The entire response must be a single, continuous HTML document — clean, readable, structured, and content-rich.

🧾 SOURCE TEXT ${sourceName ? `from "${sourceName}"` : ''}:
---
${text}
---

🔽 YOUR TASK:
Use the source text ONLY to identify the subject. Then generate a complete, exhaustive, beautifully formatted HTML study guide, entirely from your own knowledge, following all the rules above.

🚫 DO NOT EXPLAIN ANYTHING.
🚫 DO NOT PROVIDE ANY META-COMMENTARY.
🚫 OUTPUT ONLY THE RAW HTML.
🚫 NO MARKDOWN.

✅ START NOW. FIRST OUTPUT ELEMENT MUST BE AN HTML TAG (e.g. <h2>):`,

    KEY_POINTS: (text: string, content?: string) => 
        `You are a precision information extractor. Your task is to identify and list 5 to 10 of the most critical, high-impact key takeaways from the provided text. These points must represent the absolute core concepts and conclusions. DO NOT write about the instructions or the act of making key points; focus ONLY on the subject matter of the text.

MANDATORY FORMATTING RULES:
1.  LIST ONLY: Your entire output must be a list of key points.
2.  ASTERISK PREFIX: Every key point MUST begin with \`* \` (an asterisk followed by a space).
3.  ONE POINT PER LINE: Each key point must be on its own line.
4.  CONCISE AND POWERFUL: Each point must be a single, clear sentence under 25 words.
5.  NO EXTRA TEXT: Do not include any titles, introductions, or summaries. Start immediately with the first asterisk.

    FOR MATH USE THIS:
Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${text}
---${content ? `

Note Content:
---
${content.slice(0, 30000)}
---` : ''}

Your Response (Must be only a list of points starting with '* '):
* `,

    FLASHCARDS: (text: string, content?: string) => 
        `You are CardCrafter, an expert system for creating 50-100 high-quality study flashcards from source text.

MANDATORY FORMATTING (NO DEVIATIONS):
1.  BLOCK SEPARATOR: Each flashcard block MUST be separated by a single line with exactly: \`---FLASHCARD_DIVIDER---\`
2.  FLASHCARD FORMAT: Every block must use this exact multi-line structure:
    Front: [Text for the front of the card]
    Back: [Text for the back of the card]
3.  NO EXTRA TEXT: Your response must begin directly with "Front:".

    FOR MATH USE THIS:
Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${text}
---${content ? `

Note Content:
---
${content.slice(0, 30000)}
---` : ''}

Your Response (Must follow the strict "Front/Back/Divider" format):
Front:`,

    TOPICS: (text: string, content?: string) => 
        `**AI Persona:** You are "TopicMaster Pro," an expert in content analysis and educational organization. Your specialty is identifying and organizing the key topics and themes within educational content to create a comprehensive learning structure.

**Core Objective:** Generate **exactly 5** distinct, well-defined topics that comprehensively cover the main themes and concepts in the provided text.

**CRITICAL FORMATTING RULES:**
1. **BLOCK DIVIDER:** Each of the 5 topic blocks MUST be separated by a single line containing exactly this text: \`---DIVIDER---\`. This is mandatory.
2. **FIXED 3-LINE STRUCTURE:** Every single block MUST adhere to the following rigid 3-line format:
   Line 1: \`Topic: [Clear, concise topic name (max 60 characters)]\`
   Line 2: \`ID: [topic-id-using-kebab-case]\`
   Line 3: \`Description: [Brief description explaining what this topic covers (max 200 characters)]\`

**CONTENT GUIDELINES:**
- **Comprehensive Coverage:** The 5 topics should collectively cover all major themes in the content
- **Distinct and Non-Overlapping:** Each topic should be clearly distinct from the others
- **Balanced Distribution:** Topics should represent roughly equal amounts of content
- **Educational Value:** Focus on topics that would be valuable for student learning and assessment
- **Clear Naming:** Use clear, descriptive names that students will understand

**Example of a PERFECT First Block:**
Topic: Fundamental Programming Concepts
ID: fundamental-programming
Description: Basic programming principles including variables, data types, control structures, and basic algorithms

Source Text:
---
${text}${content ? `\n\nProcessed Content:\n${content}` : ''}
---

Generate exactly 5 topics following the format above:`,

    QUESTIONS: (text: string, content?: string, topics?: string) => 
        `**AI Persona:** You are "QuizMaster Pro," an expert in pedagogical assessment. Your specialty is creating high-quality, unambiguous multiple-choice questions (MCQs) that accurately test a student's understanding of source material. You are precise, methodical, and your output is flawlessly formatted.

**Core Objective:** Generate **exactly 10** distinct, high-quality multiple-choice questions based on the core subject matter of the provided text${topics ? '. Distribute questions evenly across the provided topics.' : ''}.

**CRITICAL, NON-NEGOTIABLE, AND EXTREMELY STRICT FORMATTING RULES:**
Your entire output must consist of **exactly 10** question blocks. You must not fail to provide 10 blocks.
1.  **BLOCK DIVIDER:** Each of the 10 question blocks MUST be separated by a single line containing exactly this text: \`---DIVIDER---\`. This is mandatory.
2.  **FIXED 9-LINE STRUCTURE:** Every single block MUST adhere to the following rigid 9-line format without any deviation. Each item must be on a new line.
    Line 1: \`Question: [The full text of the question]\`
    Line 2: \`A) [Text for option A]\`
    Line 3: \`B) [Text for option B]\`
    Line 4: \`C) [Text for option C]\`
    Line 5: \`D) [Text for option D]\`
    Line 6: \`Correct: [A single uppercase letter: A, B, C, or D]\`
    Line 7: \`Explanation: [A clear and concise explanation for why the correct answer is right, and bonus points if you explain why others are wrong.]\`
    Line 8: \`TopicID: [The topic ID this question relates to${topics ? ' from the provided topics' : ' or "general" if no specific topic'}]\`
    Line 9: \`Hint: [A helpful hint that guides toward the correct answer without giving it away directly]\`
3.  **NO EXTRA TEXT or DEVIATION:**
    - Do NOT number the questions (e.g., "1. Question:").
    - Do NOT add any introductory text, titles, or concluding summaries.
    - Your response must start immediately with \`Question:\` on the first line of the first block.
    - Do NOT ever deviate from the 9-line structure.

**CONTENT GUIDELINES:**
- **Relevance:** Questions MUST test the actual subject matter. AVOID "meta" questions about the document itself (e.g., "What did the author say on page 3?").
- **Clarity:** The question and options must be clear and unambiguous. There should be only one single best answer.
- **Plausible Distractors:** The incorrect options (distractors) should be plausible but clearly wrong based on the source material's concepts.
- **NEVER SAY:** "According to the text...." AND FOR THE EXPLAINATION, NEVER SAY "The text states..." 
- **BE RANDOM!:** DO NOT ALWAYS PICK C OR B AS THE CORRECT ANSWERS. THE EXAMPLE MIGHT SAY C, BUT YOU MUST NOT PICK C OR B ALL THE TIME. AGAIN, ITS VERY PREDICTIABLE FOR THE USER WHEN YOU CHOOSE B OR C AS THE ANSWER CHOICES ALL THE TIME! YOU CAN PICK B OR C, BUT YOU MUST ALSO PICK A AND D AS WELL. WHEN CHOOSING THE CORRECT ANSWER CHOICE FOR THE QUESTION, ESNURE THAT ITS IN RANDOM SPOTS, LIKE WHEN CREATING THE QUESTIONS, DONT ALWAYS PUT THE CORERCT ANSWER IN THE SAME "C" OR "B" SPOT, PUT IT IN "A" OR "D" AS WELL. IT NEEDS TO BE RANDOM.
- **HARD QUESTIONS:** MAKE THE QUESTIONS HARD AND NOT BASIC OR TOO EASY. ENSURE THAT YOU HAVE A MIX OF MEDIUM TO HARD QUESTIONS ONLY. NO EASY QUESTIONS. EASY QUESTIONS DONT CHALLENGE THE USER AND CAN EVEN HINDER THIER LEARNING, SO ALWAYS ENSURE THE QUESTIONS ARE MEDIUM TO HARD DIFFICULTY. 

**Example of a PERFECT First Block:**
Question: What is the primary purpose of the legislative branch of the U.S. government?
A) To enforce the laws of the country
B) To interpret the constitutionality of laws
C) To create and enact laws
D) To command the armed forces
Correct: C
Explanation: The legislative branch, consisting of the Senate and House of Representatives, is responsible for writing, debating, and passing bills to become laws. Enforcing laws is the executive branch, and interpreting them is the judicial branch.
TopicID: government-structure
Hint: Think about what Congress does when they meet in session - what is their primary job function?

    FOR MATH USE THIS:
Equations → LaTeX $…$ inline, $$…$$ display).  
   - ALL mathematics, logic, etc. that can be written in LaTeX, must be written in LaTeX.

YOU MUST ALWAYS USE THAT LATEX FOR MATH ONLY.

Source Text:
---
${text}
---${content ? `

Note Content:
---
${content.slice(0, 30000)}
---` : ''}

${topics ? `Available Topics:
---
${topics}
---

` : ''}Your Response (Must be 10 blocks in the strict 9-line format):
Question:`
} as const;

// Topic parsing function
export const parseTopicsResponse = (responseText: string): Array<{id: string, name: string, description: string}> => {
    const topics: Array<{id: string, name: string, description: string}> = [];
    
    if (responseText.startsWith("Error:")) {
        return topics;
    }
    
    responseText.split(/---DIVIDER---/i).forEach(block => {
        const topicMatch = block.match(/Topic:\s*([\s\S]*?)\s*ID:/i);
        const idMatch = block.match(/ID:\s*([\s\S]*?)\s*Description:/i);
        const descMatch = block.match(/Description:\s*([\s\S]*)$/i);
        
        if (topicMatch && idMatch && descMatch) {
            const name = topicMatch[1].trim();
            const id = idMatch[1].trim();
            const description = descMatch[1].trim();
            
            if (name && id && description) {
                topics.push({ id, name, description });
            }
        }
    });
    
    return topics;
};

// Enhanced question parsing function with topic and hint support
export const parseQuestionsWithTopics = (responseText: string): Array<{
    id: string,
    question: string,
    options: string[],
    correctAnswer: number,
    explanation: string,
    topicId: string,
    hint?: string
}> => {
    const questions: Array<{
        id: string,
        question: string,
        options: string[],
        correctAnswer: number,
        explanation: string,
        topicId: string,
        hint?: string
    }> = [];
    
    if (responseText.startsWith("Error:")) {
        return questions;
    }
    
    responseText.split(/---DIVIDER---/i).forEach((block, index) => {
        const qM = block.match(/Question:\s*([\s\S]*?)\s*A\)/i);
        const oM = block.match(/A\)\s*([\s\S]*?)\s*B\)\s*([\s\S]*?)\s*C\)\s*([\s\S]*?)\s*D\)\s*([\s\S]*?)\s*Correct:/is);
        const cM = block.match(/Correct:\s*([A-D])/i);
        const eM = block.match(/Explanation:\s*([\s\S]*?)\s*TopicID:/i);
        const tM = block.match(/TopicID:\s*([\s\S]*?)\s*Hint:/i);
        const hM = block.match(/Hint:\s*([\s\S]*)$/i);
        
        if (qM && oM && cM && eM && tM) {
            const question = qM[1].trim();
            const options = [oM[1], oM[2], oM[3], oM[4]].map(opt => opt.trim());
            const correctLetter = cM[1].toUpperCase();
            const correctAnswer = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
            const explanation = eM[1].trim();
            const topicId = tM[1].trim();
            const hint = hM ? hM[1].trim() : undefined;
            
            if (question && options.every(opt => opt) && correctAnswer !== -1 && explanation && topicId) {
                questions.push({
                    id: `q-${index + 1}`,
                    question,
                    options,
                    correctAnswer,
                    explanation,
                    topicId,
                    hint
                });
            }
        }
    });
    
    return questions;
};

// Helper function to make AI calls with proper error handling
export const makeAICall = async (
    prompt: string, 
    config: typeof AI_CONFIGS[keyof typeof AI_CONFIGS]
) => {
    const geminiProxy = getGeminiProxy();
    
    try {
        const result = await geminiProxy({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: config
        });
        
        const extractedText = extractCandidateText(JSON.stringify(result.data));
        
        if (extractedText.startsWith("Error:")) {
            throw new Error(extractedText);
        }
        
        return extractedText;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown AI processing error';
        throw new Error(errorMessage);
    }
};

// Fallback content for when AI calls fail
const getFallbackContent = (key: string): string => {
    switch (key) {
        case 'title':
            return 'Untitled Note';
        case 'content':
            return '<p>Content generation failed. Please try again or contact support.</p>';
        case 'keyPoints':
            return '* Content processing failed\n* Please try again\n* Contact support if issue persists';
        case 'flashcards':
            return 'Front: Content processing failed\nBack: Please try again or contact support';
        case 'questions':
            return 'Question: Content processing failed\nA) Try again\nB) Contact support\nC) Check your connection\nD) Verify your account\nCorrect: A\nExplanation: Please try processing the content again.';
        default:
            return 'Processing failed. Please try again.';
    }
};

// Parallel AI processing for faster note creation
export const makeParallelAICalls = async (
    calls: Array<{
        prompt: string;
        config: typeof AI_CONFIGS[keyof typeof AI_CONFIGS];
        key: string;
    }>,
    onProgress?: (progress: number) => void
) => {
    const geminiProxy = getGeminiProxy();
    const results: Record<string, string> = {};
    const DEBUG_MODE = false; // Set to true for debugging
    
    try {
        // Execute all AI calls in parallel with individual error handling
        const promises = calls.map(async (call) => {
            try {
                const result = await geminiProxy({
                    contents: [{ parts: [{ text: call.prompt }] }],
                    generationConfig: call.config
                });
                
                // Debug logging for troubleshooting
                if (DEBUG_MODE) {
                    console.log(`AI call result for ${call.key}:`, result);
                }
                
                const extractedText = extractCandidateText(JSON.stringify(result.data));
                
                if (extractedText.startsWith("Error:")) {
                    console.error(`AI call failed for ${call.key}:`, extractedText);
                    // Return a fallback value instead of throwing
                    return { key: call.key, result: getFallbackContent(call.key) };
                }
                
                if (!extractedText || extractedText.trim().length === 0) {
                    console.error(`Empty response for ${call.key}:`, result);
                    // Return a fallback value instead of throwing
                    return { key: call.key, result: getFallbackContent(call.key) };
                }
                
                return { key: call.key, result: extractedText };
            } catch (callError) {
                console.error(`Error in AI call for ${call.key}:`, callError);
                // Return a fallback value instead of throwing
                return { key: call.key, result: getFallbackContent(call.key) };
            }
        });
        
        // Wait for all calls to complete (some may return fallback values)
        const responses = await Promise.all(promises);
        
        // Update progress as calls complete
        if (onProgress) {
            responses.forEach((_, index) => {
                onProgress(Math.round(((index + 1) / responses.length) * 100));
            });
        }
        
        // Organize results by key
        responses.forEach(({ key, result }) => {
            results[key] = result;
        });
        
        return results;
    } catch (error) {
        console.error('Parallel AI processing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown parallel AI processing error';
        throw new Error(errorMessage);
    }
};

// Export a default object with all the main functions
export default {
    // Core processor functions
    processPDF,
    processYouTube,
    processTextForPodcast,
    
    // Utility functions
    getGeminiProxy,
    extractCandidateText,
    makeAICall,
    makeParallelAICalls,
    
    // Constants
    AI_CONFIGS,
    PROMPT_TEMPLATES
};
