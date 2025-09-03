import { UserProfileData } from './current-paying-user';
import { UserContext } from './ai-context-firebase';
import { Memory } from './ai-memories-firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface LocalImageData { 
  base64: string; 
  type: string; 
  name: string; 
}

interface ParsedGeminiResponse {
  text: string | null;
  localImageData: LocalImageData | null;
  error: string | null;
  finishReason: string | null;
  sources?: Array<{ number: number; url: string; title: string }>;
}

interface TaskData {
  id: string;
  name: string;
  isCompleted: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

interface GoalData {
  id: string;
  name: string;
  isCompleted: boolean;
  progress?: number;
  target?: number;
}

interface EventData {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

interface FocusSessionData {
  accumulatedFocusSeconds: number;
  createdAt: Date;
  status: string;
}

interface AIGreetingContext {
  userProfile: UserProfileData | null;
  userContext: UserContext | null;
  memories: Memory[];
  tasks: TaskData[];
  goals: GoalData[];
  events: EventData[];
  recentFocusSessions: FocusSessionData[];
  currentTime: Date;
}

export interface AIGreetingResult {
  greeting: string;
  color: string;
  motivationalLine: string;
}

// Removed old template constants - now using real AI generation

// Single color for all AI greetings using theme.css variables
const GREETING_COLOR = 'text-theme-text-primary';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(currentTime: Date): TimeOfDay {
  const hour = currentTime.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// Removed unused helper functions

function truncateName(name: string, maxLength: number = 15): string {
  if (!name) return 'there';
  return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
}

const parseGeminiApiResponse = (responseText: string, isImageGenCall: boolean): ParsedGeminiResponse => {
  let textContent: string | null = null;
  let imageContent: LocalImageData | null = null;
  let errorMessage: string | null = null;
  let reason: string | null = null;
  let sources: ParsedGeminiResponse['sources'] | undefined = undefined;

  try {
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse?.promptFeedback?.blockReason) {
      errorMessage = `Request blocked: ${jsonResponse.promptFeedback.blockReason}.`;
      if(jsonResponse.promptFeedback.safetyRatings) { errorMessage += ` Safety: ${JSON.stringify(jsonResponse.promptFeedback.safetyRatings)}`; }
      return { text: null, localImageData: null, error: errorMessage, finishReason: 'BLOCKED' };
    }
    if (jsonResponse?.candidates?.[0]) {
      const candidate = jsonResponse.candidates[0];
      reason = candidate.finishReason || null;

      if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            textContent = (textContent ? textContent + "\n" : "") + part.text;
          } else if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData?.data) {
            imageContent = { base64: part.inlineData.data, type: part.inlineData.mimeType, name: "generated_image.png" };
          }
        }
      }
      
      if (candidate.citationMetadata?.citationSources) {
        sources = candidate.citationMetadata.citationSources.map((source: any, index: number) => ({
          number: index + 1,
          url: source.uri,
          title: source.title || new URL(source.uri).pathname.split('/').pop() || source.uri,
        }));
      }
      
      if (!textContent && !imageContent ) {
        if (reason === 'SAFETY') { errorMessage = "Response blocked due to safety concerns."; if (candidate.safetyRatings) { errorMessage += ` Details: ${JSON.stringify(candidate.safetyRatings)}`; } }
        else if (reason === 'MAX_TOKENS') { errorMessage = "The response was cut off as it reached the maximum length."; }
        else if (reason === 'RECITATION') { errorMessage = "Response blocked due to potential recitation issues."; }
        else if (reason) { errorMessage = `Response generation stopped: ${reason}.`; }
        else if (!candidate.content) { errorMessage = "Received an empty response candidate."; }
      }
    } else if (jsonResponse?.error?.message) {
      errorMessage = `API Error: ${jsonResponse.error.message}`;
    } else { errorMessage = "Sorry, I received an empty or non-standard response format."; }

    if (isImageGenCall && !imageContent && !errorMessage && reason !== 'SAFETY' && reason !== 'BLOCKED') {
      if (textContent && !textContent.trim()) { textContent = "(No image generated and no text explanation provided)"; }
      else if (!textContent) { errorMessage = "Image generation request processed, but no image was returned."; }
    }

    if (!textContent && !imageContent && !errorMessage) {
      textContent = `(AI did not provide a text response. Finish reason: ${reason || 'unknown'})`;
    }
    return { text: textContent, localImageData: imageContent, error: errorMessage, finishReason: reason, sources };
  } catch (err) {
    console.error("Error parsing API response:", responseText, err);
    return { text: null, localImageData: null, error: "Error: Could not process AI response (Invalid format).", finishReason: null };
  }
};

export async function generateAIGreeting(context: AIGreetingContext): Promise<AIGreetingResult> {
  const { userProfile, currentTime } = context;
  
  // Validate that we have complete userProfile data before proceeding
  if (!userProfile || userProfile.level === undefined || userProfile.overallStreakCount === undefined) {
    // Return fallback if userProfile is incomplete
    return generateFallbackGreeting('there', getTimeOfDay(currentTime), context);
  }
  
  const timeOfDay = getTimeOfDay(currentTime);
  const userName = truncateName(userProfile?.name || userProfile?.displayName || 'there', 12);
  

  try {
    // Build context data directly in the prompt like Smart Daily Brief
    const { userContext, tasks, goals, events, memories } = context;
    

    
    const allActiveItems = [...tasks.filter(t => !t.isCompleted), ...goals.filter(g => !g.isCompleted)];
    const upcomingEvents = events.filter(e => e.startDate > currentTime && e.startDate < new Date(currentTime.getTime() + 24 * 60 * 60 * 1000));
    
    // Build tasks/goals context like Smart Daily Brief
    let itemsContext = "User has no active tasks or goals.";
    if (allActiveItems.length > 0) {
      const taskItems = tasks.filter(t => !t.isCompleted).map(task => {
        let due = "";
        if (task.dueDate) {
          const isOverdue = task.dueDate < currentTime;
          due = `(Due: ${task.dueDate.toLocaleDateString('en-US', {month:'short', day:'numeric'})} ${task.dueDate.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}${isOverdue ? ' - OVERDUE' : ''})`;
        }
        return `- Task: ${task.name} ${due} [Priority: ${task.priority || 'medium'}]`;
      });
      
      const goalItems = goals.filter(g => !g.isCompleted).map(goal => {
        let progress = "";
        if (goal.progress && goal.target) {
          const progressPercent = Math.round((goal.progress / goal.target) * 100);
          progress = `[Progress: ${goal.progress}/${goal.target} - ${progressPercent}%]`;
        }
        return `- Goal: ${goal.name} ${progress}`;
      });
      
      const allItems = [...taskItems, ...goalItems];
      itemsContext = `Current Focus (${allItems.length} active items):\n` + allItems.slice(0, 5).join("\n");
    }

    // Build events context like Smart Daily Brief
    let eventsContext = "\nUser has no upcoming events.";
    if (upcomingEvents.length > 0) {
      eventsContext = `\nUpcoming Events (Next 24h - ${upcomingEvents.length} events):\n` + upcomingEvents.slice(0, 3).map(event => {
        const startDate = event.startDate;
        const eventTime = startDate ? `${startDate.toLocaleDateString('en-US', {month:'short', day:'numeric'})} ${startDate.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}` : "";
        return `- Event: ${event.name} (${eventTime})`;
      }).join("\n");
    }

    // Build user profile context like Smart Daily Brief
    const userProfileContext = userProfile ? 
      `User's Progress:\n- Level: ${userProfile.level}\n- Points: ${userProfile.points}\n- Streak: ${userProfile.overallStreakCount} days\n- Badges Earned: ${(userProfile.badges || []).length}` : 
      "User progress not available.";

    // Build memories context
    let memoriesContext = "\nUser has no saved memories.";
    if (memories && memories.length > 0) {
      memoriesContext = `\nRecent Memories (${memories.length} saved):\n` + memories.slice(0, 3).map(memory => {
        const content = memory.content.length > 80 ? memory.content.substring(0, 80) + "..." : memory.content;
        return `- Memory: ${content}`;
      }).join("\n");
    }

    // Call Gemini API to generate personalized greeting
    const functions = getFunctions();
    const taskMasterProxy = httpsCallable(functions, 'taskMasterProxy');
    


    // Build the prompt EXACTLY like Smart Daily Brief - data directly in the main prompt
    const prompt = `
    User: ${userName}
    ${userProfileContext}
    Current Date & Time: ${currentTime.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
    ${itemsContext}
    ${eventsContext}
    ${memoriesContext}
    User Context (if available):
    - Study Area: ${userContext?.workDescription || 'General Studies'}
    - Short-term Focus: ${userContext?.shortTermFocus || 'Completing current tasks'}

    Generate a personalized greeting for ${userName}.
    
    CRITICAL INSTRUCTIONS:
    1. Generate EXACTLY ONE greeting line - NO NAME REPETITION (the name is already displayed separately)
    2. Keep it SHORT and SWEET (max 6-8 words)
    3. Make it HIGHLY CONTEXTUAL - reference their actual tasks, goals, progress, or situation from the data above
    4. Be encouraging but not overly enthusiastic
    5. Use casual, friendly tone
    6. IMPORTANT: Include proper punctuation at the end (. ? !) based on the tone of your greeting
    7. ANALYZE THE DATA ABOVE and create a greeting that reflects their real situation with specific details
    8. VARY YOUR GREETING STYLE - don't always say "tackle X tasks" - be creative and diverse
    9. NEVER SAY "GENERAL STUDIES" - use specific study areas or subjects if available
    10. NEVER SAY "badge streak" THAT DOESN'T MAKE SENSE.
    11. DONT ALWAYS DO QUESTIONS - be more creative and diverse 
    12. YOU HAVE A MAX OF 56 CHARACTERS TO MAKE YOUR GREETING. NO MORE.

    Current time: ${timeOfDay}

    GREETING VARIETY EXAMPLES (adapt to their actual situation from data above):

    TASK-FOCUSED (reference specific task names, not just numbers):
    - "Ready to nail that Chemistry assignment?"
    - "Time for some serious Math progress."
    - "Let's power through those study goals!"
    - "Perfect timing for productive work."

    ACHIEVEMENT-FOCUSED (use actual streak/level/points):
    - "12-day streak champion!"
    - "Level 8 productivity hero."
    - "Building momentum like a boss!"
    - "Another win in the making."

    GOAL-FOCUSED (reference specific goal names):
    - "SAT prep warrior mode activated!"
    - "Making moves toward your goals."
    - "Progress machine in full swing!"
    - "Your future self will thank you."

    SUBJECT-SPECIFIC (use their actual study areas):
    - "Chemistry mastery session incoming?"
    - "Math wizard at your service!"
    - "Study mode fully engaged."
    - "Knowledge gains loading!"

    TIME/ENERGY-BASED:
    - "Bringing the focus energy today!"
    - "Ready to crush some milestones?"
    - "Momentum builder extraordinaire."
    - "Academic excellence awaits!"

    MOTIVATIONAL (based on context):
    - "Making every minute count."
    - "Turning plans into progress!"
    - "Building that bright future."
    - "Success mode activated!"

    EVENT-AWARE (if upcoming events):
    - "Prep time for tomorrow's event?"
    - "Getting ready for the big day!"
    - "Strategy session time."
    - "Game plan execution mode!"

    Then generate a motivational line (max 15 words) that's specific to their situation and mentions actual details from their data above, ending with proper punctuation. MOTIVATIONAL LINE HAS A MAX OF 82 CHARACTERS. NO MORE.

    Response format (JSON):
    {
      "greeting": "Ready to tackle those 3 Chemistry tasks?",
      "motivationalLine": "You've got this! Focus on tackling your tasks today to build that momentum! 🚀"
    }
    `;

    const response = await taskMasterProxy({
      contents: [{
        role: 'user',
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 200
      },
      useLiteModel: true
    });

    const responseData = response.data as any;
    const parsedResponse = parseGeminiApiResponse(JSON.stringify(responseData), false);
    
    if (parsedResponse.text) {
      try {
        // Clean the response text to handle markdown code blocks
        let cleanedText = parsedResponse.text.trim();
        
        // Remove markdown code block markers if present
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to extract JSON if it's wrapped in other text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedText = jsonMatch[0];
        }
        
        const greetingData = JSON.parse(cleanedText);
        return {
          greeting: greetingData.greeting || 'Ready to get productive',
          color: determineColorFromContext(context, timeOfDay),
          motivationalLine: greetingData.motivationalLine || 'Let\'s make today count! 🚀'
        };
      } catch (parseError) {
        console.error('Error parsing greeting JSON:', parseError);
        console.error('Raw response text:', parsedResponse.text);
      }
    }

    // Fallback if AI fails
    return generateFallbackGreeting(userName, timeOfDay, context);

  } catch (error) {
    console.error('Error generating AI greeting:', error);
    return generateFallbackGreeting(userName, timeOfDay, context);
  }
}



function determineColorFromContext(context: AIGreetingContext, timeOfDay: string): string {
  // Always return the single theme color
  return GREETING_COLOR;
}

function generateFallbackGreeting(_userName: string, timeOfDay: string, context: AIGreetingContext): AIGreetingResult {
  const { tasks, goals, userProfile, userContext } = context;
  
  // If userProfile is incomplete, wait for it to load properly
  if (!userProfile || userProfile.level === undefined) {
    return {
      greeting: "Getting ready for productivity!",
      color: determineColorFromContext(context, timeOfDay),
      motivationalLine: "Loading your personalized experience... 🚀"
    };
  }
  
  // More contextual fallback greetings
  const pendingTasks = tasks.filter(t => !t.isCompleted);
  const activeGoals = goals.filter(g => !g.isCompleted);
  const pendingCount = pendingTasks.length;
  const goalsCount = activeGoals.length;
  
  let greeting = "Ready to get productive";
  let motivationalLine = "Let's make today count! 🚀";
  
  // Context-based greeting selection with variety
  if (pendingCount > 0) {
    const taskGreetings = [
      "Time to crush those tasks!",
      "Ready for some progress?",
      "Let's make things happen!",
      "Productivity mode activated!",
      "Focus energy incoming!"
    ];
    greeting = taskGreetings[Math.floor(Math.random() * taskGreetings.length)];
    motivationalLine = `You have ${pendingCount} task${pendingCount === 1 ? '' : 's'} ready to conquer! 💪`;
  } else if (goalsCount > 0) {
    const goalGreetings = [
      "Goal crusher mode activated!",
      "Making moves toward success!",
      "Progress machine in action!",
      "Future self will thank you!",
      "Building that bright future!"
    ];
    greeting = goalGreetings[Math.floor(Math.random() * goalGreetings.length)];
    motivationalLine = `Your goals are waiting for your attention! 🎯`;
  } else if (userProfile?.overallStreakCount && userProfile.overallStreakCount > 0) {
    if (userProfile.overallStreakCount >= 7) {
      const streakGreetings = [
        `${userProfile.overallStreakCount}-day streak champion!`,
        "Momentum master at work!",
        "Consistency king in action!",
        "Building unstoppable habits!"
      ];
      greeting = streakGreetings[Math.floor(Math.random() * streakGreetings.length)];
    } else {
      greeting = "Streak building in progress!";
    }
    motivationalLine = `Keep that ${userProfile.overallStreakCount}-day streak alive! 🔥`;
  } else if (userProfile?.level && userProfile.level >= 3) {
    const levelGreetings = [
      `Level ${userProfile.level} academic warrior!`,
      "Productivity hero activated!",
      "Success mode engaged!",
      "Excellence engine running!"
    ];
    greeting = levelGreetings[Math.floor(Math.random() * levelGreetings.length)];
    motivationalLine = `Time to level up even more! 🚀`;
  } else if (userContext?.shortTermFocus) {
    const focusGreetings = [
      "Study wizard at your service!",
      "Knowledge gains incoming!",
      "Academic excellence awaits!",
      "Learning mode activated!"
    ];
    greeting = focusGreetings[Math.floor(Math.random() * focusGreetings.length)];
    motivationalLine = `Time to dive into your studies! 📚`;
  } else {
    // Varied default fallbacks
    const defaultGreetings = [
      "Ready to make things happen!",
      "Bringing the focus energy!",
      "Momentum builder activated!",
      "Success mode engaged!",
      "Excellence awaits your action!",
      "Time to build something great!"
    ];
    greeting = defaultGreetings[Math.floor(Math.random() * defaultGreetings.length)];
  }
  
  return {
    greeting,
    color: determineColorFromContext(context, timeOfDay),
    motivationalLine
  };
}
