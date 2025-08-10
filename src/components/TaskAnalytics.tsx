
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  BarChart3,
  Award,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Trash,
  Loader2,
} from "lucide-react"

import { geminiEndpoint, streamResponse, extractCandidateText } from "../lib/ai-helpers" 
import { geminiApiKey} from "../lib/dashboard-firebase"
import {
  createUserTask,
  createUserGoal,
} from "../lib/ai-actions-firebase"
import { db } from "../lib/firebase"
import { collection, addDoc, getDoc, serverTimestamp, doc } from "firebase/firestore"
import { auth } from "../lib/firebase"
import { type User, onAuthStateChanged } from "firebase/auth"

interface TaskAnalyticsProps {
  tasks: Array<{ id: string; data: any }>
  goals: Array<{ id: string; data: any }>
  geminiApiKey?: string
  onAcceptInsight?: (insightId: string, action: string) => void
  onUpdateData?: (collectionName: 'tasks' | 'goals', itemId: string, updates: any) => void
  userContext?: UserContext | null;
  triggerAnalysisSignal: number; 
}

interface Insight {
  id: string
  text: string
  type: "priority" | "deadline" | "suggestion" | "achievement"
  relatedItemId?: string
  relatedItemType?: 'tasks' | 'goals'
  action?: string
  actionJson?: string
  accepted?: boolean
  declined?: boolean
  saved?: boolean
  createdAt: Date
}

interface UserContext {
  workDescription: string;
  shortTermFocus: string;
  longTermGoals: string;
  otherContext: string;
  lastUpdated: Date;
}

export function TaskAnalytics({
  tasks,
  goals,
  geminiApiKey,
  onAcceptInsight,
  onUpdateData,
  userContext,
  triggerAnalysisSignal,
}: TaskAnalyticsProps) {
  const effectiveGeminiApiKey = geminiApiKey || defaultGeminiApiKey

  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [acceptedInsights, setAcceptedInsights] = useState<Insight[]>([]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsubscribe()
  }, [])

  const typeColors = {
    priority: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/20",
    deadline: "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/20",
    suggestion: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/20",
    achievement: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-500/20",
  }
  const typeIcons = {
    priority: <AlertTriangle className="w-3.5 h-3.5" />,
    deadline: <Calendar className="w-3.5 h-3.5" />,
    suggestion: <Lightbulb className="w-3.5 h-3.5" />,
    achievement: <Award className="w-3.5 h-3.5" />,
  }

  const generateInsights = useCallback(async () => {
    if (!effectiveGeminiApiKey || !currentUser || isLoading) {
      return
    }
    setIsLoading(true)
    try {
      const formatItems = (items: Array<{ id: string; data: any }>, type: string) => {
        return items.map((item) => ({
          id: item.id,
          type,
          title: item.data[type.toLowerCase()] || "Untitled",
          completed: Boolean(item.data.completed),
          dueDate: item.data.dueDate?.toDate ? item.data.dueDate.toDate() : item.data.dueDate ? new Date(item.data.dueDate) : null,
          priority: item.data.priority || "medium",
          createdAt: item.data.createdAt?.toDate ? item.data.createdAt.toDate() : item.data.createdAt ? new Date(item.data.createdAt) : new Date(),
        }))
      }

      const formattedTasks = formatItems(tasks, "Task")
      const formattedGoals = formatItems(goals, "Goal")
      const allItems = [...formattedTasks, ...formattedGoals]

      const itemsText = allItems.length > 0 ? allItems.map(item => {
        return `${item.type}: ${item.title} [Completed: ${item.completed ? 'Yes' : 'No'}]${item.dueDate ? ` (Due: ${new Date(item.dueDate).toLocaleDateString()})` : ''} [Priority: ${item.priority}]`
      }).join('\n') : "No active tasks or goals."

      const currentDateTime = {
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString(),
      }
      const contextText = userContext
        ? `\nUser Context:\n- Study Area: ${userContext.workDescription || 'N/A'}\n- Short-term Focus: ${userContext.shortTermFocus || 'N/A'}\n- Long-term Goals: ${userContext.longTermGoals || 'N/A'}`
        : ""

      const prompt = `
[INST] <<SYS>>
Current Date: ${currentDateTime.date}
User: ${currentUser?.displayName || currentUser?.email || "Learner"}
${contextText}
User Items (Tasks and Goals):
${itemsText}

You are TaskMaster AI, an insightful learning coach. Analyze the user's current tasks and goals.
Generate 2-3 concise, actionable insights focused on improving their learning productivity and well-being.
Prioritize identifying critical deadlines, suggesting task breakdowns for large goals, or celebrating progress.

Allowed actions: "createTask", "createGoal".
For "createTask", payload requires: "task" (string), optional "dueDate" (string YYYY-MM-DD), optional "priority" ('high', 'medium', 'low').
For "createGoal", payload requires: "goal" (string), optional "targetDate" (string YYYY-MM-DD), optional "priority".

Each insight MUST be a JSON object:
{
  "text": "Insightful and encouraging text for the user (max 2 sentences).",
  "type": "priority | deadline | suggestion | achievement",
  "relatedItemId": "ID of the item, or null.",
  "relatedItemType": "tasks | goals, or null.",
  "actionJson": "Optional. A triple-backtick JSON block for ONE AI-creatable action if highly relevant, else null. Example:
  json
  {
    "action": "createTask",
    "payload": { "task": \\"Review Chapter 3 Notes\\", \\"dueDate\\": \\"${new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}\\", \\"priority\\": \\"high\\" }
  }
  \\\`\`\`"
}
Return an array of these JSON objects. Ensure valid JSON.
<</SYS>>[/INST]
`
      const geminiOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }

      const resultResponse = await streamResponse(`${geminiEndpoint}?key=${effectiveGeminiApiKey}`, geminiOptions, () => {}, 45000)

      if (!resultResponse) {
        generateFallbackInsights(allItems)
        setIsLoading(false)
        return
      }
      let rawText = extractCandidateText(resultResponse) || ""
      rawText = rawText.replace(/[\u0000-\u001F]+/g, "")
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*?\}\s*\]/s)
      if (jsonMatch) {
        try {
          const insightsData = JSON.parse(jsonMatch[0]) as any[]
          const processedInsights = insightsData.map((obj) => ({
            ...obj,
            id: Math.random().toString(36).substring(2, 11),
            createdAt: new Date(),
            actionJson: obj.actionJson && typeof obj.actionJson === 'string' && obj.actionJson.includes('```json') ? obj.actionJson.match(/```json([\s\S]*?)```/i)?.[1].trim().replace(/\\"/g, '"') : (obj.actionJson && typeof obj.actionJson === 'object' ? JSON.stringify(obj.actionJson) : ""),
            relatedItemType: obj.relatedItemType === 'task' ? 'tasks' : obj.relatedItemType === 'goal' ? 'goals' : undefined,
          } as Insight)).filter(i => i.text && i.type);
          setInsights(processedInsights)
        } catch (error) {
          console.error("Failed to parse insights JSON:", error, "Raw text:", rawText)
          generateFallbackInsights(allItems)
        }
      } else {
        generateFallbackInsights(allItems)
      }
    } catch (error: any) {
      console.error("Error generating insights:", error)
      generateFallbackInsights([])
    } finally {
      setIsLoading(false)
    }
  }, [effectiveGeminiApiKey, tasks, goals, currentUser, userContext, isLoading]);

  useEffect(() => {
    if (triggerAnalysisSignal > 0 && !isLoading && currentUser) { // triggerAnalysisSignal changes to trigger
      generateInsights();
    }
  }, [triggerAnalysisSignal, isLoading, currentUser, generateInsights]);


  const generateFallbackInsights = (items: any[]) => {
    const fallbackInsights: Insight[] = [{
      id: Math.random().toString(36).substring(2, 11),
      text: "Review your current tasks and goals. Are they aligned with your main learning objectives for the week?",
      type: "suggestion",
      createdAt: new Date(),
    }]
    setInsights(fallbackInsights)
  }

  async function storeAcceptedInsight(insight: Insight) {
    if (!currentUser?.uid) return
    try {
      await addDoc(collection(db, "acceptedInsights"), { userId: currentUser.uid, ...insight, acceptedAt: serverTimestamp() })
    } catch (error) { console.error("Error saving accepted insight:", error) }
  }

  const handleAcceptInsight = async (insight: Insight) => {
    setInsights((prev) => prev.map((i) => (i.id === insight.id ? { ...i, accepted: true, declined: false } : i)))
    setAcceptedInsights((prev) => [...prev, { ...insight, accepted: true }])
    if (!currentUser?.uid) return

    if (insight.actionJson) {
      try {
        const parsedAction = JSON.parse(insight.actionJson)
        if (parsedAction.action && parsedAction.payload) {
          const { action, payload } = parsedAction;
          const dateFields = ['dueDate', 'targetDate'];
          dateFields.forEach(field => {
            if (payload[field] && typeof payload[field] === 'string') {
                payload[field] = new Date(payload[field]); // Ensure conversion to Date
            }
          });

          if (action === "createTask") {
            await createUserTask(currentUser.uid, payload.task, payload.dueDate, payload.priority);
          } else if (action === "createGoal") {
            await createUserGoal(currentUser.uid, payload.goal, payload.targetDate, payload.priority);
          }
        }
      } catch (err) { console.error("Error processing actionJson:", err) }
    }
    if (insight.action && insight.relatedItemType && insight.relatedItemId && onUpdateData) {
        const updates: Record<string, any> = {};
        if (insight.action === "set_high_priority") updates.priority = "high";
        if (Object.keys(updates).length > 0) onUpdateData(insight.relatedItemType, insight.relatedItemId, updates);
    }

    if (onAcceptInsight) onAcceptInsight(insight.id, insight.action || "")
    await storeAcceptedInsight(insight)
  }

  const handleDeclineInsight = (insight: Insight) => {
    setInsights((prev) => prev.map((i) => (i.id === insight.id ? { ...i, accepted: false, declined: true } : i)))
  }
  
  if (!currentUser) {
    return (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 italic">
            Loading user data...
        </div>
    );
  }




  return (
    <div className="space-y-2.5">
        {isLoading && insights.length === 0 ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="animate-pulse p-3 rounded-lg bg-gray-200 dark:bg-gray-800/70">
              <div className="h-3.5 w-3/4 rounded bg-gray-300 dark:bg-gray-700 mb-1.5"></div>
              <div className="h-3 w-1/2 rounded bg-gray-300 dark:bg-gray-700"></div>
            </div>
          ))
        ) : insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/70 transition-all duration-300 hover:shadow-md
                ${insight.accepted ? "border-l-2 border-green-500 dark:border-green-400" : ""}
                ${insight.declined ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${typeColors[insight.type]}`}>
                  {typeIcons[insight.type]}
                  {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                </span>
              </div>
              <p className="text-xs sm:text-sm mb-2 text-gray-700 dark:text-gray-300">{insight.text}</p>
              <div className="flex items-center justify-end mt-1.5 gap-1.5">
                  {!insight.accepted && !insight.declined && (
                    <>
                      <button onClick={() => handleAcceptInsight(insight)} className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors" title="Accept">
                        <ThumbsUp className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                      </button>
                      <button onClick={() => handleDeclineInsight(insight)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors" title="Decline">
                        <ThumbsDown className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                      </button>
                    </>
                  )}
                  {insight.accepted && <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center font-medium"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</span>}
                  {insight.declined && <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center font-medium"><XCircle className="w-3 h-3 mr-1" /> Declined</span>}
              </div>
            </div>
          ))}
    </div>
  )
}
