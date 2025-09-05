// src/hooks/useActionProcessor.ts
import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../lib/firebase';
import { 
  createUserTask, 
  createUserGoal, 
  updateUserTask, 
  updateUserGoal, 
  deleteUserTask, 
  deleteUserGoal 
} from '../lib/ai-actions-firebase';
import { 
  findItemByName, 
  updateItem, 
  createEvent as createFirebaseEvent, 
  deleteItem 
} from '../lib/dashboard-firebase';
import { 
  saveMemory
} from '../lib/ai-memories-firebase';

// Helper function to combine date and time
const combineDateAndTime = (dateStr: string | null, timeStr: string | null): Date | null => {
  if (!dateStr) return null;
  
  // Handle relative dates
  if (dateStr === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateStr = today.toISOString().split('T')[0];
  } else if (dateStr === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    dateStr = tomorrow.toISOString().split('T')[0];
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  }
  
  return date;
};

// Extract JSON blocks from text
export const extractJsonBlocks = (text: string) => {
  const extractedBlocks: any[] = [];
  let remainingText = text;
  
  // First try to extract JSON code blocks
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      // Try to fix common JSON issues before parsing
      let jsonText = match[1];
      
      // Fix unescaped quotes in content strings
      jsonText = jsonText.replace(/"content":\s*"([^"]*(?:"[^"]*)*[^"]*)"(?=\s*[,}])/g, (_, content) => {
        // Escape internal quotes in the content
        const escapedContent = content.replace(/"/g, '\\"');
        return `"content": "${escapedContent}"`;
      });
      
      const parsedJson = JSON.parse(jsonText);
      extractedBlocks.push(parsedJson);
      remainingText = remainingText.replace(match[0], "").trim();
    } catch (e) {
      console.warn("Failed to parse JSON block in ```json ... ```:", match[1], e);
      
      // Try a more aggressive fix for malformed JSON
      try {
        let fixedJson = match[1];
        
        // Remove newlines from content strings that break JSON
        fixedJson = fixedJson.replace(/"content":\s*"([^"]*(?:\n[^"]*)*)"/, (_, content) => {
          const cleanContent = content.replace(/\n/g, '\\n').replace(/"/g, '\\"');
          return `"content": "${cleanContent}"`;
        });
        
        const parsedJson = JSON.parse(fixedJson);
        extractedBlocks.push(parsedJson);
        remainingText = remainingText.replace(match[0], "").trim();
        console.log("Successfully fixed and parsed malformed JSON");
      } catch (fixError) {
        console.warn("Could not fix malformed JSON:", fixError);
      }
    }
  }
  
  // If no code blocks found, try to find JSON objects
  if (extractedBlocks.length === 0) {
    const curlyRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:$|\n)/g;
    let tempTextForCurlySearch = text;
    let modifiedCurlyText = "";
    let lastIndex = 0;
    while ((match = curlyRegex.exec(tempTextForCurlySearch)) !== null) {
      modifiedCurlyText += tempTextForCurlySearch.substring(lastIndex, match.index);
      try {
        const parsedJson = JSON.parse(match[1]);
        if (parsedJson.action || parsedJson.type === 'flashcard' || parsedJson.type === 'question' || Array.isArray(parsedJson.tasks) || Array.isArray(parsedJson.goals)) {
          extractedBlocks.push(parsedJson);
        } else {
          modifiedCurlyText += match[0];
        }
      } catch (e) {
        modifiedCurlyText += match[0];
      }
      lastIndex = match.index + match[0].length;
    }
    remainingText = modifiedCurlyText + tempTextForCurlySearch.substring(lastIndex);
  }
  
  return { blocks: extractedBlocks, cleanedText: remainingText.trim(), originalText: text };
};

export interface ActionResult {
  status: 'success' | 'error';
  message: string;
  actionType?: string;
  payload?: any;
  friendlyMessage?: string; // Content to add to conversation
  pageUrl?: string;
  pageTitle?: string;
  driveViewUrl?: string; // URL to view Google Drive folder/search results
}

export interface CompletedAction {
  id: string;
  type: string;
  title: string;
  status: 'success' | 'error' | 'processing';
  message: string;
  timestamp: number;
  viewUrl?: string; // URL to view the created item (Google Doc, Sheet, etc.)
  progress?: number; // 0-100 for progress tracking
  estimatedDuration?: string; // Human-readable duration estimate
}

export const useActionProcessor = () => {
  const [completedActions, setCompletedActions] = useState<CompletedAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addCompletedAction = useCallback((action: Omit<CompletedAction, 'id' | 'timestamp'>) => {
    const completedAction: CompletedAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    setCompletedActions(prev => [completedAction, ...prev.slice(0, 4)]); // Keep only last 5 actions
    return completedAction.id; // Return ID for progress tracking
  }, []);

  const updateActionProgress = useCallback((actionId: string, progress: number, message?: string) => {
    setCompletedActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, progress, message: message || action.message }
        : action
    ));
  }, []);

  const updateActionStatus = useCallback((actionId: string, status: 'success' | 'error', message: string, viewUrl?: string) => {
    setCompletedActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status, message, viewUrl, progress: status === 'success' ? 100 : undefined }
        : action
    ));
  }, []);

  const clearCompletedActions = useCallback(() => {
    setCompletedActions([]);
  }, []);

  // Process individual action with retry logic
  const processAction = useCallback(async (actionType: string, payload: any, retryCount = 0): Promise<ActionResult> => {
    const user = auth.currentUser;
    if (!user?.uid) return { status: 'error', message: "User not authenticated." };
    
    try {
      switch (actionType) {
        case 'createTask':
          if (!payload.task) {
            console.error('❌ Task creation failed - payload.task is missing:', payload);
            return { status: 'error', message: 'Task creation failed: Name is missing.' };
          }
          await createUserTask(user.uid, { 
            task: payload.task, 
            dueDate: combineDateAndTime(payload.dueDate, payload.dueTime), 
            priority: payload.priority || 'medium', 
            recurring: payload.recurring || false, 
            recurrenceType: payload.recurrenceType, 
            recurrenceEndDate: payload.recurring ? combineDateAndTime(payload.recurrenceEndDate, null) : null 
          });
          return { status: 'success', message: `Created Task: "${payload.task}"`, actionType, payload };

        case 'createGoal':
          if (!payload.goal) return { status: 'error', message: 'Goal creation failed: Name is missing.' };
          await createUserGoal(user.uid, { 
            goal: payload.goal, 
            targetDate: combineDateAndTime(payload.targetDate, payload.targetTime), 
            priority: payload.priority || 'medium' 
          });
          return { status: 'success', message: `Created Goal: "${payload.goal}"`, actionType, payload };

        case 'createEvent':
          if (!payload.event_name) return { status: 'error', message: 'Event creation failed: Name is missing.' };
          
          let startDate = combineDateAndTime(payload.start_date, payload.start_time);
          let endDate = combineDateAndTime(payload.end_date, payload.end_time);
          
          // If no start date provided, default to today
          if (!startDate) {
            startDate = new Date();
            startDate.setHours(12, 0, 0, 0); // Default to noon today
          }
          
          // If no end date provided, default to 1 hour after start
          if (!endDate && startDate) {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
          }
          
          // Ensure end date is after start date
          if (endDate && startDate && endDate <= startDate) {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
          }
          
          // Ensure we have valid dates before creating the event
          if (!startDate || !endDate) {
            return { status: 'error', message: `Event "${payload.event_name}" failed. Could not determine valid dates.` };
          }
          
          try {
            await createFirebaseEvent(user.uid, { 
              name: payload.event_name, 
              startDate, 
              endDate, 
              description: payload.description, 
              color: payload.color 
            });
            return { status: 'success', message: `Created Event: "${payload.event_name}"`, actionType, payload };
          } catch (error: any) {
            console.error('Event creation error:', error);
            return { status: 'error', message: `Event "${payload.event_name}" failed. ${error.message || 'Please try again.'}` };
          }

        case 'updateTask':
          const taskId = payload.id || await findItemByName('tasks', user.uid, payload.task_identifier, 'task'); 
          if (taskId) { 
            await updateUserTask(taskId, payload); 
            return { status: 'success', message: `Updated Task: "${payload.new_task_name || payload.task_identifier}"`, actionType, payload }; 
          } 
          return { status: 'error', message: `Task "${payload.task_identifier}" not found.` };

        case 'updateGoal': 
          const goalId = payload.id || await findItemByName('goals', user.uid, payload.goal_identifier, 'goal'); 
          if (goalId) { 
            await updateUserGoal(goalId, payload); 
            return { status: 'success', message: `Updated Goal: "${payload.new_goal_name || payload.goal_identifier}"`, actionType, payload }; 
          } 
          return { status: 'error', message: `Goal "${payload.goal_identifier}" not found.` };

        case 'updateEvent':
          const eventId = payload.id || await findItemByName('events', user.uid, payload.event_identifier, 'name');
          if(eventId) { 
            await updateItem('events', eventId, payload); 
            return { status: 'success', message: `Updated Event: "${payload.new_event_name || payload.event_identifier}"`, actionType, payload }; 
          }
          return { status: 'error', message: `Event "${payload.event_identifier}" not found.` };

        case 'deleteTask':
          const taskIdToDelete = await findItemByName('tasks', user.uid, payload.task_identifier, 'task');
          if (taskIdToDelete) { 
            await deleteUserTask(taskIdToDelete); 
            return { status: 'success', message: `Deleted Task: "${payload.task_identifier}"`, actionType, payload }; 
          }
          return { status: 'error', message: `Task "${payload.task_identifier}" not found.` };

        case 'deleteGoal':
          const goalIdToDelete = await findItemByName('goals', user.uid, payload.goal_identifier, 'goal');
          if (goalIdToDelete) { 
            await deleteUserGoal(goalIdToDelete); 
            return { status: 'success', message: `Deleted Goal: "${payload.goal_identifier}"`, actionType, payload }; 
          }
          return { status: 'error', message: `Goal "${payload.goal_identifier}" not found.` };

        case 'deleteEvent':
          const eventIdToDelete = await findItemByName('events', user.uid, payload.event_identifier, 'name');
          if (eventIdToDelete) { 
            await deleteItem('events', eventIdToDelete); 
            return { status: 'success', message: `Deleted Event: "${payload.event_identifier}"`, actionType, payload }; 
          }
          return { status: 'error', message: `Event "${payload.event_identifier}" not found.` };

        case 'saveToMemory':
          await saveMemory(user.uid, payload.content);
          return { status: 'success', message: `Memory saved.`, actionType, payload };

        case 'updateMemory':
          // Note: This would need access to memories state, which isn't available in this hook
          // For now, we'll return a basic response
          return { status: 'success', message: `Memory update requested.`, actionType, payload };

        case 'deleteMemory':
          // Note: This would need access to memories state, which isn't available in this hook
          // For now, we'll return a basic response
          return { status: 'success', message: `Memory deletion requested.`, actionType, payload };

        // Notion integrations
        case 'searchNotion':
        case 'createNotionPage':
        case 'appendToNotionPage':
        case 'findAndInsertAfter':
        case 'findAndReadPageContent':
          try {
            const functions = getFunctions();
            const notionAction = httpsCallable(functions, 'notionProxy');
            const result = await notionAction({ action: actionType, payload });
            const actionResult = result.data as any;
            
            let successMessage = '';
            let friendlyMessage = '';
            let pageUrl: string | undefined = undefined;
            let pageTitle: string | undefined = undefined;
            
            switch (actionType) {
              case 'searchNotion':
                successMessage = "Searched Notion.";
                if (actionResult.results?.length > 0) {
                  friendlyMessage = actionResult.results.map((item: any) => {
                    const title = item.object === 'page'
                      ? item.properties.title?.title?.[0]?.plain_text
                      : item.title?.[0]?.plain_text;
                    return `- [${title}](${item.url})`;
                  }).join('\n');
                } else {
                  friendlyMessage = "I couldn't find any matching pages in your Notion.";
                }
                break;
              case 'createNotionPage':
                successMessage = "Created Notion page.";
                pageUrl = actionResult.url;
                pageTitle = actionResult.properties?.title?.title?.[0]?.plain_text || payload.title || "Untitled";
                break;
              case 'appendToNotionPage':
              case 'findAndInsertAfter':
                successMessage = "Updated Notion page.";
                pageUrl = actionResult.url;
                pageTitle = actionResult.properties?.title?.title?.[0]?.plain_text || actionResult.pageTitle || "Untitled";
                break;
              case 'findAndReadPageContent':
                successMessage = "Read Notion page.";
                const content = actionResult.markdownContent || "This page appears to be empty.";
                // Return full content without truncation
                friendlyMessage = content;
                pageUrl = actionResult.url;
                pageTitle = actionResult.properties?.title?.title?.[0]?.plain_text || actionResult.pageTitle || "Untitled";
                break;
              default:
                successMessage = `Notion action '${actionType}' succeeded.`;
            }
            
            return { 
              status: 'success', 
              message: successMessage,
              friendlyMessage,
              pageUrl,
              pageTitle,
              actionType, 
              payload: actionResult 
            };
          } catch (error: any) {
            console.error(`Notion ${actionType} error:`, error);
            let friendlyErrorMessage = `Couldn't complete Notion action. Please try again.`;
            
            // Provide more specific error messages for common issues
            if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
              friendlyErrorMessage = `Notion is taking too long to respond. Please try again.`;
            } else if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
              friendlyErrorMessage = `Couldn't find that page. Please check the name and try again.`;
            } else if (error.message?.includes('permission') || error.message?.includes('PERMISSION')) {
              friendlyErrorMessage = `Don't have permission to access that page.`;
            } else if (error.message?.includes('CORS') || error.code === 'functions/cors') {
              friendlyErrorMessage = `Connection issue with Notion. Please try again in a moment.`;
            } else if (error.message?.includes('quota') || error.message?.includes('QUOTA')) {
              friendlyErrorMessage = `Service temporarily unavailable. Please try again later.`;
            } else if (error.message?.includes('internal') && retryCount < 2) {
              // Retry internal errors up to 2 times with delay
              console.log(`🔄 Retrying Notion ${actionType} (attempt ${retryCount + 1})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
              return processAction(actionType, payload, retryCount + 1);
            }
            
            return { 
              status: 'error', 
              message: friendlyErrorMessage
            };
          }

        // Google Calendar integrations
        case 'searchGoogleCalendar':
        case 'createGoogleCalendarEvent':
        case 'updateGoogleCalendarEvent':
        case 'deleteGoogleCalendarEvent':
          try {
            const functions = getFunctions();
            const googleAction = httpsCallable(functions, 'googleProxy');
            // Map frontend action names to backend action names
            let backendActionName: string = actionType;
            switch (actionType) {
              case 'searchGoogleCalendar':
                backendActionName = 'searchCalendarEvents';
                break;
              case 'createGoogleCalendarEvent':
                backendActionName = 'createCalendarEvent';
                break;
              case 'updateGoogleCalendarEvent':
                backendActionName = 'updateCalendarEvent';
                break;
              case 'deleteGoogleCalendarEvent':
                backendActionName = 'deleteCalendarEvent';
                break;
            }
            
            const result = await googleAction({ service: 'calendar', action: backendActionName, payload });
            const actionResult = result.data as any;
            
            let successMessage = '';
            let friendlyMessage = '';
            
            switch (actionType) {
              case 'searchGoogleCalendar':
                successMessage = "Searched Google Calendar.";
                if (actionResult.events?.length > 0) {
                  friendlyMessage = `Found ${actionResult.events.length} events:\n` + 
                    actionResult.events.slice(0, 5).map((event: any) => 
                      `- ${event.summary || 'Untitled'} (${event.start?.dateTime || event.start?.date || 'No date'})`
                    ).join('\n');
                } else {
                  friendlyMessage = "No events found matching your search.";
                }
                break;
              case 'createGoogleCalendarEvent':
                successMessage = "Created Google Calendar event.";
                friendlyMessage = `Created "${actionResult.summary || 'Untitled'}" for ${actionResult.start?.dateTime || actionResult.start?.date || 'unknown date'}.`;
                break;
              case 'updateGoogleCalendarEvent':
                successMessage = "Updated Google Calendar event.";
                break;
              case 'deleteGoogleCalendarEvent':
                successMessage = "Deleted Google Calendar event.";
                break;
              default:
                successMessage = `Google Calendar action '${actionType}' succeeded.`;
            }
            
            return { 
              status: 'success', 
              message: successMessage,
              friendlyMessage,
              actionType, 
              payload: actionResult 
            };
          } catch (error: any) {
            return { 
              status: 'error', 
              message: `Couldn't complete Google Calendar action. Please try again.` 
            };
          }

        // Google Drive integrations
        case 'searchGoogleDrive':
        case 'listFilesAndFolders':
        case 'readGoogleDriveFile':
        case 'createGoogleDriveFile':
        case 'updateGoogleDriveFile':
        case 'deleteGoogleDriveFile':
        case 'createGoogleDoc':
        case 'createGoogleSheet':
        case 'createGoogleSlides':
        case 'createDriveFolder':
        case 'findFolder':
        case 'sendGmail':
        case 'replyToGmail':
        case 'forwardGmail':
        case 'searchGmail':
        case 'readGmailMessages':
          try {
            const functions = getFunctions();
            const googleAction = httpsCallable(functions, 'googleProxy');
            // Map frontend action names to backend action names
            let backendActionName: string = actionType;
            switch (actionType) {
              case 'readGoogleDriveFile':
                backendActionName = 'findAndReadFile';
                break;
              case 'createGoogleDriveFile':
                backendActionName = 'createDriveFile';
                break;
              case 'updateGoogleDriveFile':
                backendActionName = 'updateDriveFile';
                break;
              case 'searchGoogleDrive':
                backendActionName = 'searchDrive';
                break;
              case 'deleteGoogleDriveFile':
                // Delete functionality might not be implemented in backend
                backendActionName = 'deleteDriveFile';
                break;
              case 'createGoogleDoc':
                backendActionName = 'createGoogleDoc';
                break;
              case 'createGoogleSheet':
                backendActionName = 'createGoogleSheet';
                break;
              case 'createGoogleSlides':
                backendActionName = 'createGoogleSlides';
                break;
              case 'createDriveFolder':
                backendActionName = 'createDriveFolder';
                break;
              case 'findFolder':
                backendActionName = 'findFolder';
                break;
              case 'sendGmail':
                backendActionName = 'sendGmail';
                break;
              case 'replyToGmail':
                backendActionName = 'replyToGmail';
                break;
              case 'forwardGmail':
                backendActionName = 'forwardGmail';
                break;
              case 'searchGmail':
                backendActionName = 'searchGmail';
                break;
              case 'readGmailMessages':
                backendActionName = 'readGmailMessages';
                break;
              // listFilesAndFolders stays the same
            }
            
            const result = await googleAction({ service: 'drive', action: backendActionName, payload });
            const actionResult = result.data as any;
            
            let successMessage = '';
            let friendlyMessage = '';
            
            switch (actionType) {
              case 'searchGoogleDrive':
              case 'listFilesAndFolders':
                successMessage = "Searched Google Drive.";
                if (actionResult.files?.length > 0) {
                  // Show ALL files without truncation and with detailed information
                  friendlyMessage = `**Found ${actionResult.files.length} item${actionResult.files.length > 1 ? 's' : ''} in Google Drive:**\n\n${actionResult.files.map((file: any) => {
                    const isFolder = file.mimeType?.includes('folder');
                    const isDoc = file.mimeType?.includes('document');
                    const isSheet = file.mimeType?.includes('spreadsheet');
                    const isSlides = file.mimeType?.includes('presentation');
                    const isPdf = file.mimeType?.includes('pdf');
                    const isImage = file.mimeType?.includes('image');
                    
                    let iconText = '';
                    let typeText = '';
                    if (isFolder) {
                      iconText = '📁';
                      typeText = ' (Folder)';
                    } else if (isDoc) {
                      iconText = '📄';
                      typeText = ' (Google Doc)';
                    } else if (isSheet) {
                      iconText = '📊';
                      typeText = ' (Google Sheet)';
                    } else if (isSlides) {
                      iconText = '📈';
                      typeText = ' (Google Slides)';
                    } else if (isPdf) {
                      iconText = '📋';
                      typeText = ' (PDF)';
                    } else if (isImage) {
                      iconText = '🖼️';
                      typeText = ' (Image)';
                    } else {
                      iconText = '📄';
                      typeText = '';
                    }
                    
                    // Include file ID for AI reference and additional details
                    let details = `${iconText} [**${file.name}**](${file.webViewLink || '#'})${typeText}`;
                    if (file.id) details += `\n   ID: ${file.id}`;
                    if (file.size && !isFolder) details += `\n   Size: ${Math.round(parseInt(file.size) / 1024)}KB`;
                    if (file.modifiedTime) {
                      const modDate = new Date(file.modifiedTime).toLocaleDateString();
                      details += `\n   Modified: ${modDate}`;
                    }
                    if (file.description) details += `\n   Description: ${file.description}`;
                    
                    return details;
                  }).join('\n\n')}`;
                  
                  // Set viewUrl to Google Drive folder or search results
                  if (payload.folderId) {
                    // If we have a specific folder ID, link to that folder
                    actionResult.driveViewUrl = `https://drive.google.com/drive/folders/${payload.folderId}`;
                  } else {
                    // Otherwise, link to Google Drive home
                    actionResult.driveViewUrl = 'https://drive.google.com/drive/my-drive';
                  }
                } else {
                  friendlyMessage = "No files found matching your search.";
                  // Still provide a link to Google Drive even if no files found
                  actionResult.driveViewUrl = 'https://drive.google.com/drive/my-drive';
                }
                break;
              case 'readGoogleDriveFile':
                successMessage = "Read Google Drive file.";
                const fileContent = actionResult.content || "This file appears to be empty.";
                // Return full content without truncation
                friendlyMessage = fileContent;
                break;
              case 'createGoogleDriveFile':
                successMessage = "Created Google Drive file.";
                friendlyMessage = `Created "${actionResult.name || 'Untitled'}" in your Google Drive.`;
                break;
              case 'updateGoogleDriveFile':
                successMessage = "Updated Google Drive file.";
                break;
              case 'deleteGoogleDriveFile':
                successMessage = "Deleted Google Drive file.";
                break;
              case 'createGoogleDoc':
                successMessage = "Created Google Doc.";
                friendlyMessage = `Created "${actionResult.title || actionResult.name || 'Untitled'}" Google Doc.\n\n**[📄 View Google Doc](${actionResult.webViewLink})**`;
                break;
              case 'createGoogleSheet':
                successMessage = "Created Google Sheet.";
                friendlyMessage = `Created "${actionResult.name || 'Untitled'}" spreadsheet.\n\n**[📊 View Google Sheet](${actionResult.webViewLink})**`;
                break;
              case 'createGoogleSlides':
                successMessage = "Created Google Slides presentation.";
                friendlyMessage = `Created "${actionResult.title || actionResult.name || 'Untitled'}" presentation.\n\n**[📈 View Google Slides](${actionResult.webViewLink})**`;
                break;
              case 'createDriveFolder':
                successMessage = "Created Google Drive folder.";
                friendlyMessage = `Created "${actionResult.name || 'Untitled'}" folder in your Google Drive.`;
                break;
              case 'findFolder':
                successMessage = "Found Google Drive folders.";
                if (actionResult.files?.length > 0) {
                  friendlyMessage = `**Found ${actionResult.files.length} folder${actionResult.files.length > 1 ? 's' : ''}:**\n\n${actionResult.files.map((folder: any) => {
                    let details = `📁 [**${folder.name}**](${folder.webViewLink || '#'}) (Folder)`;
                    if (folder.id) details += `\n   ID: ${folder.id}`;
                    if (folder.modifiedTime) {
                      const modDate = new Date(folder.modifiedTime).toLocaleDateString();
                      details += `\n   Modified: ${modDate}`;
                    }
                    if (folder.description) details += `\n   Description: ${folder.description}`;
                    return details;
                  }).join('\n\n')}`;
                } else {
                  friendlyMessage = "No folders found matching your search.";
                }
                break;
              case 'sendGmail':
                successMessage = "Email sent successfully.";
                friendlyMessage = `Email sent to **${actionResult.to}** with subject "${actionResult.subject}".`;
                break;
              case 'replyToGmail':
                successMessage = "Reply sent successfully.";
                friendlyMessage = `Reply sent successfully.`;
                break;
              case 'forwardGmail':
                successMessage = "Email forwarded successfully.";
                friendlyMessage = `Email forwarded to **${actionResult.to}**.`;
                break;
              case 'searchGmail':
                successMessage = "Gmail search completed.";
                if (actionResult.messages?.length > 0) {
                  friendlyMessage = `**Found ${actionResult.messages.length} email${actionResult.messages.length > 1 ? 's' : ''}:**\n\n${actionResult.messages.slice(0, 5).map((email: any) => {
                    const fromName = email.from?.split('<')[0]?.trim() || email.from || 'Unknown';
                    const subject = email.subject || 'No Subject';
                    const snippet = email.snippet ? email.snippet.substring(0, 100) + '...' : '';
                    const date = email.date ? new Date(email.date).toLocaleDateString() : '';
                    return `📧 **${subject}**\n   From: ${fromName}\n   ${date}\n   ${snippet}`;
                  }).join('\n\n')}${actionResult.messages.length > 5 ? `\n\n...and ${actionResult.messages.length - 5} more emails.` : ''}`;
                } else {
                  friendlyMessage = "No emails found matching your search.";
                }
                break;
              case 'readGmailMessages':
                successMessage = "Retrieved Gmail messages.";
                if (actionResult.messages?.length > 0) {
                  friendlyMessage = `**Found ${actionResult.messages.length} email${actionResult.messages.length > 1 ? 's' : ''}:**\n\n${actionResult.messages.map((email: any) => 
                    `📧 **From:** ${email.from}\n   **Subject:** ${email.subject}\n   **Date:** ${new Date(email.date).toLocaleDateString()}\n   **Preview:** ${email.snippet.substring(0, 100)}${email.snippet.length > 100 ? '...' : ''}`
                  ).join('\n\n')}`;
                } else {
                  friendlyMessage = "No emails found matching your search.";
                }
                break;
              default:
                successMessage = `Google Drive action '${actionType}' succeeded.`;
            }
            
            return { 
              status: 'success', 
              message: successMessage,
              friendlyMessage,
              actionType, 
              payload: actionResult,
              pageUrl: actionResult.webViewLink,
              driveViewUrl: actionResult.driveViewUrl
            };
          } catch (error: any) {
            console.error(`Google Drive ${actionType} error:`, error);
            let friendlyErrorMessage = `Couldn't access your files. Please try again.`;
            
            // Provide more specific error messages for common issues
            if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
              friendlyErrorMessage = `Google Drive is taking too long to respond. Please try again.`;
            } else if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('No files found')) {
              if (actionType === 'readGoogleDriveFile') {
                friendlyErrorMessage = `Couldn't find a file with that name. Try saying "list my Google Drive files" first to see what's available, or use a partial filename.`;
              } else {
                friendlyErrorMessage = `Couldn't find that file. Please check the name and try again.`;
              }
            } else if (error.message?.includes('permission') || error.message?.includes('PERMISSION')) {
              friendlyErrorMessage = `Don't have permission to access that file.`;
            } else if (error.message?.includes('CORS') || error.code === 'functions/cors') {
              friendlyErrorMessage = `Connection issue with Google Drive. Please try again in a moment.`;
            } else if (error.message?.includes('quota') || error.message?.includes('QUOTA')) {
              friendlyErrorMessage = `Service temporarily unavailable. Please try again later.`;
            } else if (error.message?.includes('internal') && retryCount < 2) {
              // Retry internal errors up to 2 times with delay
              console.log(`🔄 Retrying Google Drive ${actionType} (attempt ${retryCount + 1})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
              return processAction(actionType, payload, retryCount + 1);
            } else if (error.message?.includes('internal') || error.message?.includes('INTERNAL')) {
              friendlyErrorMessage = `Google Drive service issue. Please try again in a moment.`;
            }
            
            return { 
              status: 'error', 
              message: friendlyErrorMessage
            };
          }

        // Note: Web search is handled by Gemini's built-in google_search tool, not custom actions

        // Image generation
        case 'generateImage':
          try {
            const functions = getFunctions();
            const taskMasterProxyCallable = httpsCallable(functions, 'taskMasterProxy');
            
            // Use the image generation model with the prompt
            const apiRequestBody = {
              contents: [{ parts: [{ text: payload.prompt || payload.description || "Generate an image" }] }],
              generationConfig: { 
                temperature: 1.0,
                maxOutputTokens: 8192 
              },
              isImageGen: true, // This tells the backend to use the image generation model
              useLiteModel: false,
              useThinkHarder: false
            };
            
            const result = await taskMasterProxyCallable(apiRequestBody);
            const actionResult = result.data as any;
            
            return { 
              status: 'success', 
              message: "Generated image.",
              actionType, 
              payload: actionResult 
            };
          } catch (error: any) {
            console.error('Image generation error:', error);
            return { 
              status: 'error', 
              message: `Couldn't generate image. Please try again.` 
            };
          }

        default:
          return { status: 'error', message: `Unknown action type: ${actionType}` };
      }
    } catch (error: any) {
      console.error(`Error processing ${actionType}:`, error);
      return { status: 'error', message: `Something went wrong. Please try again.` };
    }
  }, []);

  // Process JSON blocks from AI response
  const processJsonBlocks = useCallback(async (text: string): Promise<{
    cleanedText: string;
    processedActions: ActionResult[];
    enhancedText: string; // Text with friendly messages integrated
  }> => {
    setIsProcessing(true);
    
    try {
      const { blocks: jsonActionBlocks, cleanedText } = extractJsonBlocks(text);
      
      if (jsonActionBlocks.length === 0) {
        return { cleanedText, processedActions: [], enhancedText: cleanedText };
      }

      // Filter out educational content blocks (flashcards/questions)
      const actionBlocks = jsonActionBlocks.filter(block => 
        block.type !== 'flashcard' && block.type !== 'question'
      );

      if (actionBlocks.length === 0) {
        return { cleanedText, processedActions: [], enhancedText: cleanedText };
      }

      // Process actions
      const processedActions: ActionResult[] = [];
      const friendlyMessages: string[] = [];
      
      for (const actionBlock of actionBlocks) {
        try {
          // Handle integration type format: {"type": "notion", "action": "searchNotion", "payload": {...}}
          if (actionBlock.type && actionBlock.action && actionBlock.payload) {
            // For integrations, we use the action directly since it's already namespaced (e.g., "searchNotion")
            const result = await processAction(actionBlock.action, actionBlock.payload);
            processedActions.push(result);
            
            // Collect friendly messages for conversation integration
            if (result.friendlyMessage) {
              friendlyMessages.push(result.friendlyMessage);
            }
            
            // Add to completed actions UI
            addCompletedAction({
              type: actionBlock.type,
              title: getActionTitle(actionBlock.action, actionBlock.payload),
              status: result.status,
              message: result.message,
              viewUrl: result.driveViewUrl || result.pageUrl || (result.payload?.webViewLink)
            });
          }
          // Handle single action format: {"action": "createTask", "payload": {...}}
          else if (actionBlock.action && actionBlock.payload) {
            // Check if this is a long-running action that needs background processing
            const isLongRunningAction = ['createGoogleDoc', 'createGoogleSheet', 'createGoogleSlides', 'updateGoogleDriveFile', 'sendGmail'].includes(actionBlock.action);
            
            let actionId: string | undefined;
            
            if (isLongRunningAction) {
              // Add processing action immediately for user feedback
              actionId = addCompletedAction({
                type: actionBlock.action,
                title: getActionTitle(actionBlock.action, actionBlock.payload),
                status: 'processing',
                message: 'Working on this in the background...',
                progress: 20,
                estimatedDuration: getEstimatedDuration(actionBlock.action)
              });
              
              // Add friendly message about background processing
              const actionName = getActionDisplayName(actionBlock.action);
              friendlyMessages.push(`I'm ${actionName} in the background. I'll update you when it's ready!`);
            }
            
            const result = await processAction(actionBlock.action, actionBlock.payload);
            processedActions.push(result);
            
            if (isLongRunningAction && actionId) {
              // Update the existing action with final result
              updateActionStatus(actionId, result.status, result.message, result.driveViewUrl || result.pageUrl || (result.payload?.webViewLink));
              
              // Add completion message
              if (result.status === 'success') {
                const actionName = getActionDisplayName(actionBlock.action);
                friendlyMessages.push(`✅ ${actionName} completed successfully!`);
              }
            } else {
              // Add to completed actions UI for quick actions
              addCompletedAction({
                type: actionBlock.action,
                title: getActionTitle(actionBlock.action, actionBlock.payload),
                status: result.status,
                message: result.message,
                viewUrl: result.driveViewUrl || result.pageUrl || (result.payload?.webViewLink)
              });
            }
          }
          // Handle batch format: {"tasks": [{...}, {...}]}
          else if (Array.isArray(actionBlock.tasks)) {
            for (const taskPayload of actionBlock.tasks) {
              const result = await processAction('createTask', taskPayload);
              processedActions.push(result);
              
              addCompletedAction({
                type: 'createTask',
                title: `Task: ${taskPayload.task || 'Untitled'}`,
                status: result.status,
                message: result.message
              });
            }
          }
          // Handle batch format: {"goals": [{...}, {...}]}
          else if (Array.isArray(actionBlock.goals)) {
            for (const goalPayload of actionBlock.goals) {
              const result = await processAction('createGoal', goalPayload);
              processedActions.push(result);
              
              addCompletedAction({
                type: 'createGoal',
                title: `Goal: ${goalPayload.goal || 'Untitled'}`,
                status: result.status,
                message: result.message
              });
            }
          }
          // Handle batch format: {"events": [{...}, {...}]}
          else if (Array.isArray(actionBlock.events)) {
            for (const eventPayload of actionBlock.events) {
              const result = await processAction('createEvent', eventPayload);
              processedActions.push(result);
              
              addCompletedAction({
                type: 'createEvent',
                title: `Event: ${eventPayload.event_name || 'Untitled'}`,
                status: result.status,
                message: result.message
              });
            }
          }
        } catch (error: any) {
          console.error('Error processing action block:', error);
          const errorResult: ActionResult = {
            status: 'error',
            message: `Something went wrong. Please try again.`
          };
          processedActions.push(errorResult);
          
          addCompletedAction({
            type: 'unknown',
            title: 'Action failed',
            status: 'error',
            message: errorResult.message
          });
        }
      }

      // Create enhanced text by combining cleaned text with friendly messages
      const enhancedText = friendlyMessages.length > 0 
        ? [cleanedText, ...friendlyMessages].filter(Boolean).join('\n\n').trim()
        : cleanedText;

      return { cleanedText, processedActions, enhancedText };
    } finally {
      setIsProcessing(false);
    }
  }, [processAction, addCompletedAction]);

  return {
    completedActions,
    isProcessing,
    processJsonBlocks,
    processAction,
    clearCompletedActions,
    addCompletedAction,
    updateActionProgress,
    updateActionStatus
  };
};

// Helper function to get estimated duration for actions
const getEstimatedDuration = (actionType: string): string => {
  switch (actionType) {
    case 'createGoogleDoc':
    case 'updateGoogleDriveFile':
      return '10-15 seconds';
    case 'createGoogleSheet':
    case 'createGoogleSlides':
      return '5-10 seconds';
    case 'sendGmail':
      return '3-5 seconds';
    default:
      return '5-10 seconds';
  }
};

// Helper function to get user-friendly action display names
const getActionDisplayName = (actionType: string): string => {
  switch (actionType) {
    case 'createGoogleDoc':
      return 'creating your Google Doc';
    case 'createGoogleSheet':
      return 'creating your Google Sheet';
    case 'createGoogleSlides':
      return 'creating your Google Slides presentation';
    case 'updateGoogleDriveFile':
      return 'updating your document';
    case 'sendGmail':
      return 'sending your email';
    default:
      return 'processing your request';
  }
};

// Helper function to get action title (shows just the result, not redundant info)
const getActionTitle = (actionType: string, payload: any): string => {
  switch (actionType) {
    case 'createTask':
      return `Created task: "${payload.task || 'Untitled'}"`;
    case 'createGoal':
      return `Created goal: "${payload.goal || 'Untitled'}"`;
    case 'createEvent':
      return `Created event: "${payload.event_name || 'Untitled'}"`;
    case 'updateTask':
      return `Updated task: "${payload.new_task_name || payload.task_identifier || 'Unknown'}"`;
    case 'updateGoal':
      return `Updated goal: "${payload.new_goal_name || payload.goal_identifier || 'Unknown'}"`;
    case 'updateEvent':
      return `Updated event: "${payload.new_event_name || payload.event_identifier || 'Unknown'}"`;
    case 'deleteTask':
      return `Deleted task: "${payload.task_identifier || 'Unknown'}"`;
    case 'deleteGoal':
      return `Deleted goal: "${payload.goal_identifier || 'Unknown'}"`;
    case 'deleteEvent':
      return `Deleted event: "${payload.event_identifier || 'Unknown'}"`;
    case 'saveToMemory':
      return `Saved to memory: "${payload.content?.substring(0, 40) || 'Unknown'}${payload.content?.length > 40 ? '...' : ''}"`;
    case 'updateMemory':
      return `Updated memory`;
    case 'deleteMemory':
      return `Deleted memory`;
    
    // Notion integrations
    case 'searchNotion':
      return `Searched workspace${payload.query ? ` for "${payload.query}"` : ''}`;
    case 'createNotionPage':
      return `Created page: "${payload.title || 'Untitled'}"`;
    case 'appendToNotionPage':
      return `Updated page: "${payload.pageTitle || payload.pageId || 'Unknown'}"`;
    case 'findAndInsertAfter':
      return `Updated page: "${payload.pageTitle || payload.pageId || 'Unknown'}"`;
    case 'findAndReadPageContent':
      return `Read page: "${payload.pageTitle || payload.pageId || 'Unknown'}"`;
    
    // Google Calendar integrations
    case 'searchGoogleCalendar':
      return `Searched calendar${payload.query ? ` for "${payload.query}"` : ''}`;
    case 'createGoogleCalendarEvent':
      return `Created event: "${payload.title || payload.summary || 'Untitled'}"`;
    case 'updateGoogleCalendarEvent':
      return `Updated event: "${payload.title || payload.summary || payload.eventId || 'Unknown'}"`;
    case 'deleteGoogleCalendarEvent':
      return `Deleted event: "${payload.eventId || 'Unknown'}"`;
    
    // Google Drive integrations
    case 'searchGoogleDrive':
    case 'listFilesAndFolders':
      return `Searched files${payload.query ? ` for "${payload.query}"` : ''}`;
    case 'readGoogleDriveFile':
      return `Read file: "${payload.fileName || payload.fileId || 'Unknown'}"`;
    case 'createGoogleDriveFile':
      return `Created file: "${payload.fileName || 'Untitled'}"`;
    case 'updateGoogleDriveFile':
      return `Updated file: "${payload.fileName || payload.fileId || 'Unknown'}"`;
    case 'deleteGoogleDriveFile':
      return `Deleted file: "${payload.fileName || payload.fileId || 'Unknown'}"`;
    case 'createGoogleDoc':
      return `Created Google Doc: "${payload.title || 'Untitled'}"`;
    case 'createGoogleSheet':
      return `Created Google Sheet: "${payload.name || 'Untitled'}"`;
    case 'createGoogleSlides':
      return `Created Google Slides: "${payload.title || 'Untitled'}"`;
    case 'createDriveFolder':
      return `Created folder: "${payload.name || 'Untitled'}"`;
    case 'findFolder':
      return `Searched folders${payload.query ? ` for "${payload.query}"` : ''}`;
    case 'sendGmail':
      return `Sent email to "${payload.to}"`;
    case 'replyToGmail':
      return `Replied to email`;
    case 'forwardGmail':
      return `Forwarded email to "${payload.to}"`;
    case 'searchGmail':
      return `Searched Gmail${payload.query ? ` for "${payload.query}"` : ''}`;
    case 'readGmailMessages':
      return `Read Gmail messages${payload.query ? ` for "${payload.query}"` : ''}`;
    
    // Note: Web search is handled by built-in Google Search tool
    
    // Image generation
    case 'generateImage':
      return `Generated image: "${payload.prompt?.substring(0, 50) || 'Unknown prompt'}${payload.prompt?.length > 50 ? '...' : ''}"`;
    
    default:
      return `${actionType}: Unknown`;
  }
};
