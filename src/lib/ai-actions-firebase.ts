// src/lib/ai-actions-firebase.ts
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';

/**
 * Helper to parse a date string (YYYY-MM-DD, or relative like "tomorrow") and return a Firestore Timestamp.
 * Returns null if the date string is invalid or cannot be parsed.
 */
function parseDateToFirestoreTimestamp(dateInput: string | Date | null | undefined): Timestamp | null {
  if (!dateInput) return null;

  let dateObject: Date;

  if (typeof dateInput === 'string') {
    // Handle relative dates first
    const lowerCaseDateInput = dateInput.toLowerCase();
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    if (lowerCaseDateInput === 'today') {
      dateObject = now;
    } else if (lowerCaseDateInput === 'tomorrow') {
      dateObject = new Date(now);
      dateObject.setDate(now.getDate() + 1);
    } else if (lowerCaseDateInput.startsWith('next ')) {
        const dayOfWeek = lowerCaseDateInput.split(' ')[1];
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDayIndex = days.indexOf(dayOfWeek);
        if (targetDayIndex !== -1) {
            dateObject = new Date(now);
            let currentDayIndex = dateObject.getDay();
            let diff = targetDayIndex - currentDayIndex;
            if (diff <= 0) { // If it's today or a past day of this week, go to next week's day
                diff += 7;
            }
            dateObject.setDate(now.getDate() + diff);
        } else {
            // Try parsing as a specific date if "next X" is not a day
             try {
                dateObject = new Date(dateInput);
                if (isNaN(dateObject.getTime())) throw new Error("Invalid date string");
             } catch (e) {
                console.warn(`Could not parse date string: "${dateInput}"`);
                return null;
             }
        }
    } else if (lowerCaseDateInput.includes('in ') && (lowerCaseDateInput.includes(' week') || lowerCaseDateInput.includes(' day'))) {
        const parts = lowerCaseDateInput.split(' ');
        const amountIndex = parts.indexOf('in') + 1;
        const unitIndex = amountIndex + 1;
        if (parts.length > unitIndex && !isNaN(parseInt(parts[amountIndex]))) {
            const amount = parseInt(parts[amountIndex]);
            const unit = parts[unitIndex].replace(/s$/, ''); // remove plural 's'
            dateObject = new Date(now);
            if (unit === 'day') {
                dateObject.setDate(now.getDate() + amount);
            } else if (unit === 'week') {
                dateObject.setDate(now.getDate() + (amount * 7));
            } else {
                 try {
                    dateObject = new Date(dateInput);
                    if (isNaN(dateObject.getTime())) throw new Error("Invalid date string");
                 } catch (e) {
                    console.warn(`Could not parse relative date string: "${dateInput}"`);
                    return null;
                 }
            }
        } else {
             try {
                dateObject = new Date(dateInput);
                if (isNaN(dateObject.getTime())) throw new Error("Invalid date string");
             } catch (e) {
                console.warn(`Could not parse date string: "${dateInput}"`);
                return null;
             }
        }
    }
    // Try parsing as a specific date (YYYY-MM-DD or other Date constructor supported formats)
    else {
       try {
            dateObject = new Date(dateInput);
            // If the input was just YYYY-MM-DD, it might be parsed as UTC midnight.
            // To ensure it's local day start, if no time info was present:
            if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = dateInput.split('-').map(Number);
                dateObject = new Date(year, month - 1, day); // Local timezone day start
            }
            if (isNaN(dateObject.getTime())) {
                console.warn(`Could not parse date string: "${dateInput}" into a valid date.`);
                return null;
            }
        } catch (error) {
            console.error(`Error parsing date string "${dateInput}":`, error);
            return null;
        }
    }

  } else if (dateInput instanceof Date) {
    dateObject = dateInput;
    if (isNaN(dateObject.getTime())) {
        console.warn(`Invalid Date object provided.`);
        return null;
    }
  } else {
    console.warn(`Invalid date input type: ${typeof dateInput}`);
    return null;
  }

  // Ensure the date object is valid
  if (isNaN(dateObject.getTime())) {
     console.warn(`Could not parse date input: "${dateInput}" into a valid date.`);
     return null;
  }
  return Timestamp.fromDate(dateObject);
}


export async function createUserTask(uid: string, data: any) {
  if (!uid || !data || !data.task) {
    console.error("Missing required data for creating task:", { uid, data });
    throw new Error("Task name and user ID are required.");
  }
  const timestampDate = parseDateToFirestoreTimestamp(data.dueDate || data.targetDate || data.deadline);
  await addDoc(collection(db, 'tasks'), {
    task: data.task,
    userId: uid,
    dueDate: timestampDate,
    description: data.description || '',
    createdAt: serverTimestamp(),
    completed: false,
    priority: data.priority || 'medium',
  });
}

export async function createUserGoal(uid: string, data: any) {
  if (!uid || !data || !data.goal) {
    console.error("Missing required data for creating goal:", { uid, data });
    throw new Error("Goal name and user ID are required.");
  }
  const timestampDate = parseDateToFirestoreTimestamp(data.targetDate || data.dueDate || data.deadline);
  await addDoc(collection(db, 'goals'), {
    goal: data.goal,
    userId: uid,
    targetDate: timestampDate,
    description: data.description || '',
    createdAt: serverTimestamp(),
    completed: false,
    priority: data.priority || 'medium',
  });
}

export async function createUserPlan(uid: string, data: any) {
  if (!uid || !data || !data.plan) {
    console.error("Missing required data for creating plan:", { uid, data });
    throw new Error("Plan name and user ID are required.");
  }
  const timestampStartDate = parseDateToFirestoreTimestamp(data.startDate);
  const timestampEndDate = parseDateToFirestoreTimestamp(data.endDate || data.dueDate); // Also check dueDate as a fallback
  await addDoc(collection(db, 'plans'), {
    plan: data.plan,
    userId: uid,
    startDate: timestampStartDate,
    endDate: timestampEndDate,
    description: data.description || '',
    createdAt: serverTimestamp(),
    completed: false,
    priority: data.priority || 'medium',
  });
}

export async function createUserProject(uid: string, data: any) {
  if (!uid || !data || !data.project) {
    console.error("Missing required data for creating project:", { uid, data });
    throw new Error("Project name and user ID are required.");
  }
  const timestampDate = parseDateToFirestoreTimestamp(data.deadline || data.dueDate || data.targetDate);
  await addDoc(collection(db, 'projects'), {
    project: data.project,
    userId: uid,
    deadline: timestampDate,
    description: data.description || '',
    createdAt: serverTimestamp(),
    completed: false,
    priority: data.priority || 'medium',
  });
}

export async function updateUserTask(docId: string, data: any) {
  const taskRef = doc(db, 'tasks', docId);
  const updateData: any = {};
  if (data.task !== undefined) updateData.task = data.task;
  if (data.dueDate !== undefined || data.targetDate !== undefined || data.deadline !== undefined) {
      updateData.dueDate = parseDateToFirestoreTimestamp(data.dueDate || data.targetDate || data.deadline);
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.completed !== undefined) updateData.completed = data.completed;
  if (data.description !== undefined) updateData.description = data.description;

  if (Object.keys(updateData).length > 0) {
      await updateDoc(taskRef, updateData);
  }
}

export async function deleteUserTask(docId: string) {
  const taskRef = doc(db, 'tasks', docId);
  await deleteDoc(taskRef);
}

export async function updateUserGoal(docId: string, data: any) {
  const goalRef = doc(db, 'goals', docId);
  const updateData: any = {};
  if (data.goal !== undefined) updateData.goal = data.goal;
  if (data.targetDate !== undefined || data.dueDate !== undefined || data.deadline !== undefined) {
      updateData.targetDate = parseDateToFirestoreTimestamp(data.targetDate || data.dueDate || data.deadline);
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.completed !== undefined) updateData.completed = data.completed;
  if (data.description !== undefined) updateData.description = data.description;

  if (Object.keys(updateData).length > 0) {
      await updateDoc(goalRef, updateData);
  }
}

export async function deleteUserGoal(docId: string) {
  const goalRef = doc(db, 'goals', docId);
  await deleteDoc(goalRef);
}

export async function updateUserPlan(docId: string, data: any) {
  const planRef = doc(db, 'plans', docId);
   const updateData: any = {};
   if (data.plan !== undefined) updateData.plan = data.plan;
   if (data.startDate !== undefined) updateData.startDate = parseDateToFirestoreTimestamp(data.startDate);
   if (data.endDate !== undefined || data.dueDate !== undefined) {
       updateData.endDate = parseDateToFirestoreTimestamp(data.endDate || data.dueDate);
   }
   if (data.priority !== undefined) updateData.priority = data.priority;
   if (data.completed !== undefined) updateData.completed = data.completed;
   if (data.description !== undefined) updateData.description = data.description;

   if (Object.keys(updateData).length > 0) {
      await updateDoc(planRef, updateData);
   }
}

export async function deleteUserPlan(docId: string) {
  const planRef = doc(db, 'plans', docId);
  await deleteDoc(planRef);
}

export async function updateUserProject(docId: string, data: any) {
  const projectRef = doc(db, 'projects', docId);
  const updateData: any = {};
  if (data.project !== undefined) updateData.project = data.project;
  if (data.deadline !== undefined || data.dueDate !== undefined || data.targetDate !== undefined) {
      updateData.deadline = parseDateToFirestoreTimestamp(data.deadline || data.dueDate || data.targetDate);
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.completed !== undefined) updateData.completed = data.completed;
  if (data.description !== undefined) updateData.description = data.description;

  if (Object.keys(updateData).length > 0) {
      await updateDoc(projectRef, updateData);
  }
}

export async function deleteUserProject(docId: string) {
  const projectRef = doc(db, 'projects', docId);
  await deleteDoc(projectRef);
}
