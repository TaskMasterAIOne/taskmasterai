import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User as UserProfileIcon, Settings as SettingsIcon, Mail, Key, LogOut,
  Trash2, Save, X, AlertCircle, Crown as CrownIcon, Upload, Camera, Moon, Sun, Laptop,
  Loader2, Info, BrainCircuit, Star, CreditCard, Activity, Edit, Check,
  Sparkles, DatabaseBackup, Cable, Workflow, PanelLeftDashed,
  TrendingUp, Award, Flame, Trophy, Lock, Pencil, FileText, Youtube, Layers,
  Briefcase, MessageCircle, Share2, SplitSquareVertical, FolderPlus,
  Folders as FoldersIcon, FolderTree, PackagePlus, ListTodo, Play,
  BookOpen, Brain, CheckSquare as CheckSquareIcon, MessageCircle as MessageCircleIcon, Target,
  Palette, SlidersHorizontal, UserCheck, GraduationCap, BarChart3, BarChart,
  Milestone, Zap, ShieldCheck, FileQuestion, User as UserIconLucide,
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Sidebar } from './Sidebar';
import {
  updateUserProfile, signOutUser, deleteUserAccount, AuthError,
  getCurrentUser, getUserData, deleteProfilePicture,
} from '../lib/settings-firebase';
import { saveUserContext, getUserContext, UserContext } from '../lib/ai-context-firebase';
import {
  getUserTier, UserTier,
  getChatLimitForTier, getNoteLimitsForTier,
  getCurrentMonthUserChatUsage, getUserNoteUsage,
  ChatUsageData, NoteUsageData, onUserProfileSnapshot,
  UserProfileData,
} from '../lib/current-paying-user';
import {
  getMemories, updateMemory, deleteMemory, type Memory,
} from '../lib/ai-memories-firebase';
import { createPortalSession } from '../lib/stripe-client';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface UserProfileData {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    points: number;
    level: number;
    overallStreakCount: number;
    badges: string[];
    premiumAwardedUntil?: Timestamp | Date | string | null;
    stripeCustomerId?: string | null;
    notionAccessData?: any;
}

const toDateSafe = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value &&
        typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        try {
            return new Timestamp(value.seconds, value.nanoseconds).toDate();
        } catch (e) { console.warn("toDateSafe error converting object:", e); return null; }
    }
    return null;
};

const ALL_BADGES_CONFIG: { [key: string]: { name: string, description: string, icon: React.FC<any>, unlock_criteria_text: string } } = {
    firstPersonalNote: { name: "Personal Scribe", description: "Created your first personal note.", icon: Pencil, unlock_criteria_text: "Create 1 personal note" },
    firstPdfNote: { name: "PDF Powerhouse", description: "Processed your first PDF.", icon: FileText, unlock_criteria_text: "Process 1 PDF" },
    firstYoutubeNote: { name: "Video Virtuoso", description: "Summarized your first YouTube video.", icon: Youtube, unlock_criteria_text: "Summarize 1 YouTube video" },
    firstAiNote: { name: "AI Note Crafter", description: "Created your first AI-processed text note.", icon: Sparkles, unlock_criteria_text: "Create 1 AI text note" },
    fiveNotesCreated: { name: "Note Collector", description: "Created 5 notes in total.", icon: Layers, unlock_criteria_text: "Create 5 notes" },
    twentyFiveNotesCreated: { name: "Note Archivist", description: "Created 25 notes in total.", icon: Briefcase, unlock_criteria_text: "Create 25 notes" },
    firstFlashcardsFromNote: { name: "Note Card Wizard", description: "Generated or added flashcards to a note.", icon: Layers, unlock_criteria_text: "Add flashcards to a note" },
    firstChatWithNote: { name: "Note Conversationalist", description: "Used chat with a note.", icon: MessageCircle, unlock_criteria_text: "Chat with a note" },
    publicNoteSharer: { name: "Public Sharer", description: "Shared a note publicly.", icon: Share2, unlock_criteria_text: "Make a note public"},
    splitViewUser: { name: "Dual Viewer", description: "Used the split view feature.", icon: SplitSquareVertical, unlock_criteria_text: "Use Split View"},
    level5Reached: { name: "Level 5 Voyager", description: "Reached overall level 5.", icon: Award, unlock_criteria_text: "Reach Level 5" },
    level10Reached: { name: "Level 10 Expert", description: "Reached overall level 10.", icon: CrownIcon, unlock_criteria_text: "Reach Level 10" },
    level20Virtuoso: { name: "Level 20 Virtuoso", description: "Reached overall level 20.", icon: GraduationCap, unlock_criteria_text: "Reach Level 20" },
    level30Legend: { name: "Level 30 Legend", description: "Reached overall level 30.", icon: ShieldCheck, unlock_criteria_text: "Reach Level 30" },
    level50Titan: { name: "Level 50 Titan", description: "Reached overall level 50.", icon: Zap, unlock_criteria_text: "Reach Level 50" },
    points1k: { name: "Point Collector (1k)", description: "Earned 1,000 total points.", icon: TrendingUp, unlock_criteria_text: "Earn 1,000 Points" },
    points5k: { name: "Point Hoarder (5k)", description: "Earned 5,000 total points.", icon: BarChart3, unlock_criteria_text: "Earn 5,000 Points" },
    points10k: { name: "Point Magnet (10k)", description: "Earned 10,000 total points.", icon: BarChart, unlock_criteria_text: "Earn 10,000 Points" },
    points25k: { name: "Point Tycoon (25k)", description: "Earned 25,000 total points.", icon: Milestone, unlock_criteria_text: "Earn 25,000 Points" },
    overallStreak3Day: { name: "3-Day Streak", description: "Maintained a 3-day study streak.", icon: Flame, unlock_criteria_text: "3-Day Overall Streak" },
    streak7Day: { name: "7-Day Firestarter", description: "Maintained a 7-day study streak.", icon: Flame, unlock_criteria_text: "7-Day Overall Streak" },
    streak14Day: { name: "14-Day Blaze", description: "Maintained a 14-day study streak.", icon: Flame, unlock_criteria_text: "14-Day Overall Streak" },
    streak30Day: { name: "30-Day Inferno", description: "Maintained a 30-day study streak.", icon: Zap, unlock_criteria_text: "30-Day Overall Streak" },
    streak60Day: { name: "60-Day Phoenix", description: "Maintained a 60-day study streak.", icon: Zap, unlock_criteria_text: "60-Day Overall Streak" },
    firstFolderCreated: { name: "Folder Pioneer", description: "Created your first study folder.", icon: FolderPlus, unlock_criteria_text: "Create your first folder" },
    fiveFolders: { name: "Organizer", description: "Created 5 study folders.", icon: FoldersIcon, unlock_criteria_text: "Create 5 folders" },
    tenFolders: { name: "Archivist", description: "Created 10 study folders.", icon: FolderTree, unlock_criteria_text: "Create 10 folders" },
    firstFlashcard: { name: "Card Creator", description: "Created your first flashcard.", icon: Layers, unlock_criteria_text: "Create your first flashcard" },
    fiftyFlashcards: { name: "Deck Builder", description: "Created 50 flashcards.", icon: PackagePlus, unlock_criteria_text: "Create 50 flashcards" },
    firstQuestion: { name: "Question Asker", description: "Created your first question.", icon: FileQuestion, unlock_criteria_text: "Create your first question" },
    fiftyQuestions: { name: "Quiz Master", description: "Created 50 questions.", icon: ListTodo, unlock_criteria_text: "Create 50 questions" },
    firstStudySession: { name: "Initiate Learner", description: "Completed your first study session.", icon: Play, unlock_criteria_text: "Complete 1 study session" },
    tenStudySessions: { name: "Dedicated Student", description: "Completed 10 study sessions.", icon: BookOpen, unlock_criteria_text: "Complete 10 study sessions" },
    masterTenFlashcards: { name: "Memory Whiz", description: "Mastered 10 flashcards.", icon: Brain, unlock_criteria_text: "Master 10 flashcards" },
    completeFiveQuizzes: { name: "Quiz Taker", description: "Completed 5 quizzes.", icon: CheckSquareIcon, unlock_criteria_text: "Complete 5 quizzes" },
    firstAIChat: { name: "AI Conversationalist", description: "Had your first chat with the AI assistant.", icon: MessageCircleIcon, unlock_criteria_text: "Start an AI chat" },
    aiCreatedTenItems: { name: "AI Collaborator", description: "AI assistant created 10 items for you.", icon: Sparkles, unlock_criteria_text: "Have AI create 10 items" },
    goalSetter: { name: "Goal Setter", description: "Set your first study goal.", icon: Target, unlock_criteria_text: "Set a study goal" },
    importerBadge: { name: "Importer", description: "Used the import feature.", icon: Upload, unlock_criteria_text: "Import items into a folder" },
    paletteExplorer: { name: "Palette Explorer", description: "Customized a folder color.", icon: Palette, unlock_criteria_text: "Change a folder color" },
    contextualLearner: { name: "Contextual Learner", description: "Set up your AI learning context.", icon: SlidersHorizontal, unlock_criteria_text: "Set AI learning context" },
    betaTester: { name: "Early Adopter", description: "Joined during the early phases.", icon: UserCheck, unlock_criteria_text: "Awarded to early users" },
    profileComplete: { name: "Profile Polisher", description: "Completed your user profile details.", icon: UserIconLucide, unlock_criteria_text: "Complete your profile (Name, Photo)" },
};

const NotionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path className="fill-black dark:fill-white" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
  </svg>
);

const GoogleDriveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA" />
      <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335" />
      <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.673354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D" />
      <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC" />
      <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47" />
      <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00" />
    </g>
  </svg>
);

const GoogleCalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <polygon fill="#FFFFFF" points="195.368421 60.6315789 60.6315789 60.6315789 60.6315789 195.368421 195.368421 195.368421" />
      <polygon fill="#EA4335" points="195.368421 256 256 195.368421 225.684211 190.196005 195.368421 195.368421 189.835162 223.098002" />
      <path d="M1.42108547e-14,195.368421 L1.42108547e-14,235.789474 C1.42108547e-14,246.955789 9.04421053,256 20.2105263,256 L60.6315789,256 L66.8568645,225.684211 L60.6315789,195.368421 L27.5991874,190.196005 L1.42108547e-14,195.368421 Z" fill="#188038" />
      <path d="M256,60.6315789 L256,20.2105263 C256,9.04421053 246.955789,1.42108547e-14 235.789474,1.42108547e-14 L195.368421,1.42108547e-14 C191.679582,15.0358547 189.835162,26.1010948 189.835162,33.1957202 C189.835162,40.2903456 191.679582,49.4356319 195.368421,60.6315789 C208.777986,64.4714866 218.883249,66.3914404 225.684211,66.3914404 C232.485172,66.3914404 242.590435,64.4714866 256,60.6315789 Z" fill="#1967D2" />
      <polygon fill="#FBBC04" points="256 60.6315789 195.368421 60.6315789 195.368421 195.368421 256 195.368421" />
      <polygon fill="#34A853" points="195.368421 195.368421 60.6315789 195.368421 60.6315789 256 195.368421 256" />
      <path d="M195.368421,0 L20.2105263,0 C9.04421053,0 0,9.04421053 0,20.2105263 L0,195.368421 L60.6315789,195.368421 L60.6315789,60.6315789 L195.368421,60.6315789 L195.368421,0 Z" fill="#4285F4" />
      <path d="M88.2694737,165.153684 C83.2336842,161.751579 79.7473684,156.783158 77.8442105,150.214737 L89.5326316,145.397895 C90.5936842,149.44 92.4463158,152.572632 95.0905263,154.795789 C97.7178947,157.018947 100.917895,158.113684 104.656842,158.113684 C108.48,158.113684 111.764211,156.951579 114.509474,154.627368 C117.254737,152.303158 118.635789,149.338947 118.635789,145.751579 C118.635789,142.08 117.187368,139.082105 114.290526,136.757895 C111.393684,134.433684 107.755789,133.271579 103.410526,133.271579 L96.6568421,133.271579 L96.6568421,121.701053 L102.72,121.701053 C106.458947,121.701053 109.608421,120.690526 112.168421,118.669474 C114.728421,116.648421 116.008421,113.886316 116.008421,110.366316 C116.008421,107.233684 114.863158,104.741053 112.572632,102.871579 C110.282105,101.002105 107.385263,100.058947 103.865263,100.058947 C100.429474,100.058947 97.7010526,100.968421 95.68,102.804211 C93.6602819,104.644885 92.1418208,106.968942 91.2673684,109.557895 L79.6968421,104.741053 C81.2294737,100.395789 84.0421053,96.5557895 88.1684211,93.2378947 C92.2947368,89.92 97.5663158,88.2526316 103.966316,88.2526316 C108.698947,88.2526316 112.96,89.1621053 116.732632,90.9978947 C120.505263,92.8336842 123.469474,95.3768421 125.608421,98.6105263 C127.747368,101.861053 128.808421,105.498947 128.808421,109.541053 C128.808421,113.667368 127.814737,117.153684 125.827368,120.016842 C123.84,122.88 121.397895,125.069474 118.501053,126.602105 L118.501053,127.292632 C122.241568,128.834789 125.490747,131.367752 127.898947,134.618947 C130.341053,137.903158 131.570526,141.827368 131.570526,146.408421 C131.570526,150.989474 130.408421,155.082105 128.084211,158.669474 C125.76,162.256842 122.543158,165.086316 118.467368,167.141053 C114.374737,169.195789 109.776842,170.240124 104.673684,170.240124 C98.7621053,170.256842 93.3052632,168.555789 88.2694737,165.153684 L88.2694737,165.153684 Z M160.067368,107.149474 L147.233684,116.429474 L140.816842,106.694737 L163.84,90.0884211 L172.665263,90.0884211 L172.665263,168.421053 L160.067368,168.421053 L160.067368,107.149474 Z" fill="#4285F4" />
    </g>
  </svg>
);

function getCroppedImg(image: HTMLImageElement, crop: any, fileName: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Canvas context is not available'));
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        (blob as any).name = fileName;
        resolve(blob);
      },
      'image/jpeg',
      0.95
    );
  });
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

const LEARNING_PROFILE_START_MARKER = '--- LEARNING STYLE/PROFILE ---';
const LEARNING_PROFILE_END_MARKER = '--- END LEARNING STYLE/PROFILE ---';

type LearningProfile = {
    goal: string;
    motivation: string;
    experience: string;
    style: string;
};

const parseOtherContext = (fullContext: string | undefined | null): { learningProfile: LearningProfile | null; freeText: string } => {
    if (!fullContext) {
        return { learningProfile: null, freeText: '' };
    }

    const startIndex = fullContext.indexOf(LEARNING_PROFILE_START_MARKER);
    const endIndex = fullContext.indexOf(LEARNING_PROFILE_END_MARKER);

    if (startIndex === -1 || endIndex === -1) {
        return { learningProfile: null, freeText: fullContext };
    }

    const profileBlock = fullContext.substring(startIndex + LEARNING_PROFILE_START_MARKER.length, endIndex).trim();
    const freeText = fullContext.substring(endIndex + LEARNING_PROFILE_END_MARKER.length).trim();

    const lines = profileBlock.split('\n');
    const profileData: any = {};
    lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            if (key === 'Primary Goal') profileData.goal = value;
            if (key === 'Motivation') profileData.motivation = value;
            if (key === 'Experience Level') profileData.experience = value;
            if (key === 'Preferred Usage Style') profileData.style = value;
        }
    });

    return { learningProfile: profileData, freeText };
};

const stringifyLearningProfile = (profile: LearningProfile | null): string => {
    if (!profile) return '';
    return `${LEARNING_PROFILE_START_MARKER}
Primary Goal: ${profile.goal}
Motivation: ${profile.motivation}
Experience Level: ${profile.experience}
Preferred Usage Style: ${profile.style}
${LEARNING_PROFILE_END_MARKER}`;
};


export function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userData, setUserData] = useState({ name: '', email: '', photoURL: '' });
  const [aiContextData, setAiContextData] = useState<Partial<UserContext>>({});
  const [initialAiContextData, setInitialAiContextData] = useState<Partial<UserContext>>({});
  const [isLoadingAiContext, setIsLoadingAiContext] = useState(true);
  const [isSavingAiContext, setIsSavingAiContext] = useState(false);
  const [isEditingAiContext, setIsEditingAiContext] = useState(false);
  const [aiContextError, setAiContextError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [formData, setFormData] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isGoogleUser, setIsGoogleUser] = useState<boolean>(false);
  const [userCurrentTier, setUserCurrentTier] = useState<UserTier>('loading');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [chatUsage, setChatUsage] = useState<ChatUsageData | null>(null);
  const [noteUsage, setNoteUsage] = useState<NoteUsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [isDeletingMemory, setIsDeletingMemory] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imgSrcForCrop, setImgSrcForCrop] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<any>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
    const [isHandlingRedirect, setIsHandlingRedirect] = useState(false);

  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isNotionConnecting, setIsNotionConnecting] = useState(false);
  const [isNotionDisconnecting, setIsNotionDisconnecting] = useState(false); // ADD THIS LINE
  const functions = getFunctions();

  useEffect(() => {
    const root = document.documentElement;

    if (isIlluminateEnabled) {
      root.classList.remove('dark');
    } else if (isBlackoutEnabled) {
      root.classList.add('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    
    localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled));
    localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled));
  }, [isIlluminateEnabled, isBlackoutEnabled]);


   // --- FIX 2: Create a NEW, DEDICATED useEffect just for the Notion redirect ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const currentUser = getCurrentUser(); // Get user directly

    // Only run if there's a code, a user, and we aren't already handling it.
    if (code && currentUser && !isHandlingRedirect) {
        setIsHandlingRedirect(true); // Set the flag immediately to prevent re-runs
        setIsNotionConnecting(true);

        const isProduction = window.location.hostname === 'www.taskmaster.one';
        const redirectUri = isProduction
            ? 'https://www.taskmaster.one/settings'
            : 'http://localhost:5173/settings';

        console.log("handleNotionRedirect: Detected auth code. Calling cloud function once with:", {
            code,
            redirectUri
        });

        const processRedirect = async () => {
            try {
                const notionConnect = httpsCallable(functions, 'notionOAuthCallback');
                await notionConnect({ code: code, redirectUri: redirectUri });
                
                console.log("Successfully connected to Notion.");
                setIsNotionConnected(true);
                navigate('/settings', { replace: true }); // Clean URL

            } catch (error: any) {
                console.error("Error connecting to Notion. Full error:", error);
                const detailedMessage = error.details ? `Details: ${JSON.stringify(error.details)}` : "No further details.";
                setError(`Failed to connect to Notion: ${error.message}. ${detailedMessage}`);
            } finally {
                setIsNotionConnecting(false);
            }
        };

        processRedirect();
    }
  }, [navigate, functions, isHandlingRedirect]); // Minimal dependencies


  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (!isIlluminateEnabled && !isBlackoutEnabled) {
            if (e.matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [isIlluminateEnabled, isBlackoutEnabled]);

  useEffect(() => {
    setIsLoading(true);
    setIsLoadingAiContext(true);
    setUserCurrentTier('loading');
    setIsLoadingUsage(true);
    setIsLoadingMemories(true);

    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setUser(currentUser);

    const checkNotionConnection = async () => {
        if (currentUser) {
            const fetchedUserData = await getUserData(currentUser.uid);
            if (fetchedUserData && fetchedUserData.notionAccessData) {
                setIsNotionConnected(true);
            }
        }
    };
    checkNotionConnection();


    const googleFlag = currentUser.providerData?.some((p) => p.providerId === 'google.com');
    setIsGoogleUser(!!googleFlag);

    const unsubscribeProfile = onUserProfileSnapshot(currentUser.uid, (profileDoc) => {
      if (profileDoc) {
        setUserProfileData(profileDoc as UserProfileData);
        const updatedName = profileDoc.displayName || userData.name;
        const updatedPhoto = profileDoc.photoURL || userData.photoURL;
        setUserData(prev => ({ ...prev, name: updatedName, photoURL: updatedPhoto }));
        setFormData(prev => ({ ...prev, name: updatedName }));
      }
      setIsLoading(false);
    });

    const fetchInitialData = async () => {
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      try {
        const [tier, firestoreData, fetchedChatUsage, fetchedNoteUsage, fetchedMemories, context] = await Promise.all([
          getUserTier(currentUser.uid, currentUser.email),
          getUserData(currentUser.uid),
          getCurrentMonthUserChatUsage(currentUser.uid, currentMonthStr),
          getUserNoteUsage(currentUser.uid),
          getMemories(currentUser.uid, 50),
          getUserContext(currentUser.uid)
        ]);
        
        const initialName = firestoreData?.name || currentUser.displayName || '';
        const initialEmail = currentUser.email || '';
        const initialPhotoURL = firestoreData?.photoURL || currentUser.photoURL || '';
        setUserData({ name: initialName, email: initialEmail, photoURL: initialPhotoURL });
        setFormData(prev => ({ ...prev, name: initialName, email: initialEmail, currentPassword: '', newPassword: '', confirmPassword: '' }));

        setStripeCustomerId(firestoreData?.stripeCustomerId || null);
        
        setUserCurrentTier(tier);
        setChatUsage(fetchedChatUsage);
        setNoteUsage(fetchedNoteUsage?.month === currentMonthStr ? fetchedNoteUsage : { pdfAi: 0, youtube: 0, month: currentMonthStr });
        setMemories(fetchedMemories);
        
        const { learningProfile: parsedProfile, freeText } = parseOtherContext(context?.otherContext);
        setLearningProfile(parsedProfile);

        const loadedContext = {
          workDescription: context?.workDescription || '',
          shortTermFocus: context?.shortTermFocus || '',
          longTermGoals: context?.longTermGoals || '',
          otherContext: freeText,
        };
        setAiContextData(loadedContext);
        setInitialAiContextData(loadedContext);

      } catch (error) {
        console.error("Error fetching ancillary settings data:", error);
        setError("Failed to load some settings details.");
      } finally {
        setIsLoadingUsage(false);
        setIsLoadingMemories(false);
        setIsLoadingAiContext(false);
      }
    };

    fetchInitialData();

    return () => {
      unsubscribeProfile();
    };
  }, [navigate, functions, user]);

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleToggleIlluminate = (checked: boolean) => {
    setIsIlluminateEnabled(checked);
    if (checked) {
        setIsBlackoutEnabled(false);
    }
  };
  const handleToggleBlackout = (checked: boolean) => {
    setIsBlackoutEnabled(checked);
    if (checked) {
        setIsIlluminateEnabled(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setError(null); setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleAiContextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setAiContextError(null); setAiContextData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleProfilePictureClick = () => { if (!isUploading) fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrcForCrop(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setIsCropModalOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1 / 1));
  };
  
  const handleCropImage = async () => {
    if (!completedCrop || !imgRef.current || !user) return;
    setIsUploading(true);
    setIsCropModalOpen(false);
    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop, 'profile.jpg');
      const croppedImageFile = new File([croppedImageBlob], "profile.jpg", { type: "image/jpeg" });
      const updatedProfile = await updateUserProfile({ photoFile: croppedImageFile }, user.uid);
      const newPhotoURL = updatedProfile?.photoURL || getCurrentUser()?.photoURL || '';
      const refreshedFirestoreData = await getUserData(user.uid);
      setUserData(prev => ({ ...prev, photoURL: refreshedFirestoreData?.photoURL || newPhotoURL, name: refreshedFirestoreData?.name || prev.name }));
      const refreshedUser = getCurrentUser(); if (refreshedUser) setUser(refreshedUser);
    } catch (err) {
      console.error("Crop/Upload Error:", err);
      setError('Failed to upload cropped image.');
    } finally {
      setIsUploading(false);
      setImgSrcForCrop('');
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!user || !userData.photoURL) return; if (!window.confirm('Remove profile picture?')) return;
    setIsUploading(true); setError(null);
    try {
        await deleteProfilePicture(user.uid);
        setUserData(prev => ({ ...prev, photoURL: '' }));
        const refreshedUser = getCurrentUser(); if (refreshedUser) setUser(refreshedUser);
    }
    catch (err) { console.error("Remove Pic Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to remove.'); }
    finally { setIsUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setIsSaving(true);
    try {
      if (!user) throw new AuthError('Auth session expired.');
      const updateData: { name?: string; email?: string; currentPassword?: string; newPassword?: string } = {};
      let requiresPassword = false;
      const trimmedName = formData.name.trim();
      if (trimmedName !== userData.name) { if (!trimmedName) throw new AuthError('Name cannot be empty.'); updateData.name = trimmedName; }
      if (!isGoogleUser) {
          const trimmedEmail = formData.email.trim();
          if (trimmedEmail !== userData.email) { if (!trimmedEmail) throw new AuthError('Email cannot be empty.'); updateData.email = trimmedEmail; requiresPassword = true; }
          if (formData.newPassword) {
              if (formData.newPassword.length < 6) throw new AuthError('New password min 6 chars.');
              if (formData.newPassword !== formData.confirmPassword) throw new AuthError('New passwords do not match.');
              updateData.newPassword = formData.newPassword; requiresPassword = true;
          }
          if (requiresPassword && !formData.currentPassword) throw new AuthError('Current password required.');
          if (requiresPassword && formData.currentPassword) updateData.currentPassword = formData.currentPassword;
      }
      if (Object.keys(updateData).length > 0 || (updateData.newPassword && !isGoogleUser)) {
          await updateUserProfile(updateData, user.uid);
          const refreshedUser = getCurrentUser();
          const refreshedFirestoreData = await getUserData(user.uid);
          const newName = refreshedFirestoreData?.name || refreshedUser?.displayName || userData.name;
          const newEmail = refreshedUser?.email || userData.email;
          const newPhotoURL = refreshedFirestoreData?.photoURL || refreshedUser?.photoURL || userData.photoURL;
          setUserData({ name: newName, email: newEmail, photoURL: newPhotoURL });
          setFormData(prev => ({ ...prev, name: newName, email: newEmail, currentPassword: '', newPassword: '', confirmPassword: '' }));
          if(refreshedUser) setUser(refreshedUser);
          setIsEditing(false);
      } else {
          setIsEditing(false); setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) { console.error("Save Error:", err); setError(err instanceof AuthError ? err.message : 'Error saving.'); }
    finally { setIsSaving(false); }
  };

  const handleSaveAiContext = async () => {
    if (!user?.uid) { setAiContextError("User not authenticated."); return; }
    setIsSavingAiContext(true); setAiContextError(null);
    try {
        const learningProfileString = stringifyLearningProfile(learningProfile);
        const freeText = aiContextData.otherContext?.trim() || '';

        const finalOtherContext = [learningProfileString, freeText].filter(Boolean).join('\n\n');

        const dataToSave: Partial<UserContext> = {
            workDescription: aiContextData.workDescription?.trim() || '',
            shortTermFocus: aiContextData.shortTermFocus?.trim() || '',
            longTermGoals: aiContextData.longTermGoals?.trim() || '',
            otherContext: finalOtherContext
        };
        
        await saveUserContext(user.uid, dataToSave);
        
        const { learningProfile: newProfile, freeText: newFreeText } = parseOtherContext(finalOtherContext);
        setLearningProfile(newProfile);
        
        const newContextData = { ...dataToSave, otherContext: newFreeText };
        delete (newContextData as any).otherContext;
        newContextData.otherContext = newFreeText;

        setAiContextData(newContextData);
        setInitialAiContextData(newContextData);
        setIsEditingAiContext(false);

    } catch (err) { console.error("AI Context Save Error:", err); setAiContextError("Failed to save AI context."); }
    finally { setIsSavingAiContext(false); }
  };

  const handleCancelAiContextEdit = () => { setAiContextData(initialAiContextData); setIsEditingAiContext(false); setAiContextError(null); };
  const handleSignOut = async () => { setError(null); try { await signOutUser(); navigate('/login'); } catch (err) { console.error("Sign Out Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to sign out.'); } };
  const handleDeleteAccount = async () => { setError(null); setIsDeleting(true); try { if (!user) throw new AuthError('Auth session expired.'); if (!isGoogleUser && !formData.currentPassword) { throw new AuthError('Current password required.'); } await deleteUserAccount(isGoogleUser ? undefined : formData.currentPassword); navigate('/login'); } catch (err) { console.error("Delete Account Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to delete account.'); } finally { setIsDeleting(false); } };
  const closeDeleteModal = () => { setShowDeleteConfirm(false); setError(null); setFormData(prev => ({...prev, currentPassword: ''})); };
  const handleManageSubscription = async () => {
    setIsManagingSubscription(true); setPortalError(null); setError(null);
    if (!stripeCustomerId) { setPortalError("Subscription details not found."); setIsManagingSubscription(false); return; }
    try { const { portalUrl } = await createPortalSession(); window.location.href = portalUrl; } 
    catch (err: any) { console.error("Manage Subscription Error:", err); setPortalError(err.message || "Could not load billing page."); setIsManagingSubscription(false); }
  };
  const handleEditMemory = (memory: Memory) => { setEditingMemoryId(memory.id); setEditingMemoryContent(memory.content); };
  const handleCancelEditMemory = () => { setEditingMemoryId(null); setEditingMemoryContent(''); };
  const handleUpdateMemory = async () => {
    if (!user || !editingMemoryId || !editingMemoryContent.trim()) return;
    setIsSavingMemory(true);
    try {
      await updateMemory(user.uid, editingMemoryId, editingMemoryContent);
      setMemories(memories.map(m => m.id === editingMemoryId ? { ...m, content: editingMemoryContent } : m));
      handleCancelEditMemory();
    } catch (error) { console.error("Error updating memory:", error); } finally { setIsSavingMemory(false); }
  };
  const handleDeleteMemory = async (memoryId: string) => {
    if (!user || !window.confirm("Are you sure you want to delete this memory? This cannot be undone.")) return;
    setIsDeletingMemory(memoryId);
    try {
      await deleteMemory(user.uid, memoryId);
      setMemories(memories.filter(m => m.id !== memoryId));
    } catch (error) { console.error("Error deleting memory:", error); } finally { setIsDeletingMemory(null); }
  };
  const getNextMonthResetDate = () => {
    const now = new Date(); const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return firstDayNextMonth.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  };
  
// src/components/Settings.tsx

// Replace the existing handleNotionConnect function with this one
const handleNotionConnect = () => {
    setIsNotionConnecting(true);
    
    // Dynamically determine the redirect URI based on the browser's current location
    const isProduction = window.location.hostname === 'www.taskmaster.one';
    const redirectUri = isProduction 
        ? 'https://www.taskmaster.one/settings'
        : 'http://localhost:5173/settings';

    // This public client ID is fine to have in the frontend
    const notionClientId = '230d872b-594c-80bd-b9f0-00373ca942fd';
    
    // Construct the URL with the correct, URL-encoded redirect URI
    const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${notionClientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    window.location.href = notionAuthUrl;
};

  const handleNotionDisconnect = async () => {
    // Prevent function from running if user is not set or if it's already running
    if (!user || isNotionDisconnecting) return;
    
    // Ask for user confirmation before proceeding
    if (!window.confirm("Are you sure you want to disconnect from Notion? This will revoke access.")) return;

    // Set loading state ON and clear any previous errors
    setIsNotionDisconnecting(true); 
    setError(null);

    try {
        // Call the backend cloud function
        const disconnectNotion = httpsCallable(functions, 'disconnectNotion');
        await disconnectNotion();
        
        // Update the UI to show that Notion is no longer connected
        setIsNotionConnected(false); 
    } catch (error) {
        console.error("Error disconnecting from Notion:", error);
        setError("Failed to disconnect from Notion. Please try again.");
    } finally {
        // IMPORTANT: Always set loading state OFF when the process is complete
        setIsNotionDisconnecting(false); 
    }
  };
  
  const ProgressBar = ({ current, total, label }: { current: number; total: number; label: string }) => {
    const displayTotal = total === Infinity ? '∞' : total;
    const percentage = total > 0 && total !== Infinity ? Math.min((current / total) * 100, 100) : total === Infinity ? 100 : 0;
    let barColorClass = 'bg-blue-500 dark:bg-blue-400';
    if (percentage > 85 && total !== Infinity) barColorClass = 'bg-red-500 dark:bg-red-400';
    else if (percentage > 60 && total !== Infinity) barColorClass = 'bg-yellow-500 dark:bg-yellow-400';
    else if (total === Infinity) barColorClass = 'bg-green-500 dark:bg-green-400';

    return (
      <div className='flex-1'>
        <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
            <p className="text-xs text-gray-500 dark:text-gray-400">{current} / {displayTotal}</p>
        </div>
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <div className={`h-full ${barColorClass} transition-all duration-500 ease-out`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  };
  
  const themeModes = [
    { name: 'light', icon: Sun, handler: () => handleToggleIlluminate(true) },
    { name: 'dark', icon: Moon, handler: () => handleToggleBlackout(true) },
    { name: 'system', icon: Laptop, handler: () => { handleToggleIlluminate(false); handleToggleBlackout(false); } },
  ];

  let currentThemeMode = 'system';
  if (isIlluminateEnabled) currentThemeMode = 'light';
  else if (isBlackoutEnabled) currentThemeMode = 'dark';
  
  return (
    <div className="min-h-screen font-poppins bg-[#F7F8FA] dark:bg-[#0C0E1A] text-gray-900 dark:text-gray-200">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        userName={userData.name || 'Learner'}
        userProfile={{ photoURL: userData.photoURL } as any}
        isIlluminateEnabled={isIlluminateEnabled}
        isBlackoutEnabled={isBlackoutEnabled}
      />
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 shadow-xl rounded-xl p-5 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Delete Account</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                Are you sure? This permanently deletes your account and all associated data. Cannot be undone.
            </p>
            {!isGoogleUser && (
              <div className="mb-4">
                <label htmlFor="deleteConfirmPassword" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Enter Current Password</label>
                <input id="deleteConfirmPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} placeholder="Required to delete" className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500" disabled={isDeleting}/>
              </div>
            )}
            {error && showDeleteConfirm && (
              <div className="mb-4 p-2 rounded-md flex items-start gap-2 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button onClick={closeDeleteModal} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200" disabled={isDeleting}>Cancel</button>
              <button onClick={handleDeleteAccount} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center justify-center min-w-[100px]" disabled={isDeleting || (!isGoogleUser && !formData.currentPassword)}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isCropModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 shadow-xl rounded-xl p-5 sm:p-6 max-w-lg w-full">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Crop Profile Picture</h3>
                  {imgSrcForCrop && (
                    <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)} aspect={1}>
                        <img ref={imgRef} alt="Crop me" src={imgSrcForCrop} onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                    </ReactCrop>
                  )}
                  <div className="flex gap-2 sm:gap-3 justify-end mt-4">
                      <button onClick={() => setIsCropModalOpen(false)} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Cancel</button>
                      <button onClick={handleCropImage} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-gradient-to-r from-[#635BFF] to-[#8A85FF] text-white hover:opacity-90">Crop & Save</button>
                  </div>
              </div>
          </div>
      )}
      <main className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-6`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#635BFF]" />Settings
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage your account settings and preferences</p>
            </div>
            {error && !showDeleteConfirm && ( 
              <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <p className="text-xs sm:text-sm">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
               <div className="flex flex-col gap-6">
                 <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5">
                   <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Profile Picture</h2>
                   <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                     <div className="relative group flex-shrink-0">
                       <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                         {isUploading ? (<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>)
                          : userData.photoURL ? (<img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />)
                          : (<UserProfileIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />)}
                       </div>
                       {!isUploading && (
                         <button onClick={handleProfilePictureClick} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer" title="Change picture" aria-label="Change profile picture">
                           <Camera className="w-5 h-5 text-white" />
                         </button>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                     </div>
                     <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto justify-center sm:justify-start">
                       <button onClick={handleProfilePictureClick} disabled={isUploading} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                         <Upload className="w-4 h-4" /> {isUploading ? 'Uploading...' : 'Upload'}
                       </button>
                       {userData.photoURL && !isUploading && (
                         <button onClick={handleRemoveProfilePicture} disabled={isUploading} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-800/60 text-red-700 dark:text-red-400">
                           <Trash2 className="w-4 h-4" /> Remove
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
                 <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">Profile Details</h2>
                      {!isEditing && (<button type="button" onClick={() => { setIsEditing(true); setError(null); }} disabled={isLoading || isSaving} className="px-3 py-1 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Edit</button>)}
                    </div>
                    <form onSubmit={handleSave}>
                       <div className="space-y-4">
                          <div>
                            <label htmlFor="name" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Name</label>
                            <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} disabled={!isEditing || isSaving || isLoading} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 disabled:cursor-not-allowed" required/>
                          </div>
                          <div>
                            <label htmlFor="email" className="flex items-center text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Email {isGoogleUser && <span className="ml-1.5 text-[10px] text-gray-500">(Managed by Google)</span>}</label>
                            <input id="email" type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={!isEditing || isSaving || isGoogleUser || isLoading} className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 disabled:cursor-not-allowed" required/>
                          </div>
                          {isEditing && !isGoogleUser && (
                              <>
                                  <hr className="my-3 border-gray-200 dark:border-gray-700/50" />
                                  <p className="text-sm font-medium -mb-1 text-gray-800 dark:text-gray-100">Change Password</p>
                                  <div>
                                      <label htmlFor="currentPassword" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Current Password</label>
                                      <input id="currentPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Required to change email or password" className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60" />
                                  </div>
                                  <div>
                                      <label htmlFor="newPassword" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">New Password</label>
                                      <input id="newPassword" type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Leave blank to keep current (min 6 chars)" className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60" />
                                  </div>
                                  <div>
                                      <label htmlFor="confirmPassword" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Confirm New Password</label>
                                      <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Confirm if changing" className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60" />
                                  </div>
                              </>
                          )}
                      </div>
                      {isEditing && (
                        <div className="flex justify-end gap-2 mt-5">
                          <button type="button" onClick={() => { setIsEditing(false); setError(null); setFormData({name: userData.name, email: userData.email, currentPassword: '', newPassword: '', confirmPassword: ''}); }} disabled={isSaving} className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Cancel</button>
                          <button type="submit" disabled={isSaving || isLoading} className="px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gradient-to-r from-[#635BFF] to-[#8A85FF] text-white hover:opacity-90 flex items-center justify-center min-w-[80px]">
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save</>}
                          </button>
                        </div>
                      )}
                    </form>
                 </div>
                 <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Account Actions</h2>
                    <div className="space-y-3">
                        <Link to="/contact" className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                            <Info className="w-4 h-4" /> Help
                        </Link>
                        <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"><LogOut className="w-4 h-4" /> Sign Out</button>
                        <button onClick={() => { setShowDeleteConfirm(true); setFormData(prev => ({ ...prev, currentPassword: '' })); setError(null); }} className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-800/60 text-red-700 dark:text-red-400"><Trash2 className="w-4 h-4" /> Delete Account</button>
                    </div>
                 </div>
               </div>
               <div className="flex flex-col gap-6">
                 <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Appearance</h2>
                     <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           {themeModes.map(mode => (
                               <button
                                   key={mode.name}
                                   onClick={mode.handler}
                                   className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 text-sm font-medium ${
                                       currentThemeMode === mode.name 
                                       ? 'border-[#635BFF] bg-indigo-50 dark:bg-indigo-500/10' 
                                       : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                   }`}
                               >
                                   <mode.icon className={`w-5 h-5 ${
                                     mode.name === 'light' ? 'text-yellow-500' : 
                                     mode.name === 'dark' ? 'text-indigo-400' : 'text-gray-500'
                                   }`} />
                                   <span className="capitalize text-gray-700 dark:text-gray-200">{mode.name}</span>
                               </button>
                           ))}
                        </div>
                     </div>
                 </div>
                 <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5 flex flex-col flex-grow">
                   <div className="flex items-center justify-between mb-4">
                     <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                       <CreditCard className="w-5 h-5 text-green-500 dark:text-green-400"/>
                       Subscription
                     </h2>
                     {userCurrentTier === 'loading' && <span className="text-xs text-gray-500">Checking...</span>}
                     {userCurrentTier === 'premium' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-br from-[#635BFF] to-[#8A85FF] text-white shadow-sm">Premium</span>)}
                     {userCurrentTier === 'pro' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-teal-400 to-cyan-500 text-white shadow-sm">Pro</span>)}
                     {userCurrentTier === 'basic' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200">Basic</span>)}
                   </div>
                   <div className="flex flex-col flex-grow">
                      <div className="space-y-3">
                        {userCurrentTier === 'premium' && (<p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your premium plan includes unlimited access to all features.</p>)}
                        {userCurrentTier === 'pro' && (<p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your pro plan includes increased limits and access to advanced features.</p>)}
                        {userCurrentTier === 'basic' && (<p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your free plan includes basic access to core features.</p>)}

                        <ul className="list-disc list-outside pl-5 space-y-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {userCurrentTier === 'basic' && (<><li>2 PDF/Text Notes per month</li><li>1 YouTube Note per month</li><li>10 AI Chat Interactions per month</li></>)}
                          {userCurrentTier === 'pro' && (<><li>10 PDF/Text Notes per month</li><li>5 YouTube Notes per month</li><li>200 AI Chat Interactions per month</li><li>Limited access to Smart Daily Brief</li></>)}
                          {userCurrentTier === 'premium' && (<><li>Unlimited PDF & Text Notes</li><li>Unlimited YouTube Notes</li><li>Unlimited AI Chat Interactions</li><li>Unlimited Smart Daily Brief</li><li>Unlimited Podcasts</li><li>Priority Support</li></>)}
                        </ul>
                      </div>

                      <div className="mt-auto space-y-3">
                        {(userCurrentTier === 'pro' || userCurrentTier === 'premium') && stripeCustomerId && (
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
                            {portalError && (<p className="text-xs text-red-500 dark:text-red-400 mb-2 flex items-center gap-1"><AlertCircle size={14} /> {portalError}</p>)}
                            <button onClick={handleManageSubscription} disabled={isManagingSubscription} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-70">
                              {isManagingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                              {isManagingSubscription ? 'Loading Portal...' : 'Manage Billing'}
                            </button>
                          </div>
                        )}
                        {userCurrentTier !== 'premium' && (
                          <Link to="/pricing" className="block w-full bg-gradient-to-r from-[#635BFF] to-[#8A85FF] text-white hover:opacity-90 rounded-lg">
                            <span className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium"><Star className="w-4 h-4" /> Upgrade Plan</span>
                          </Link>
                        )}
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            {isLoading ? (<div className="mt-6 flex justify-center items-center h-48 bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl"><Loader2 className="w-8 h-8 animate-spin text-[#635BFF]" /></div>)
            : userProfileData && (
                <div className="mt-6 bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Trophy className="w-5 h-5 text-amber-400" /> My Progress & Achievements
                    </h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                        {[
                            { label: 'Points', value: userProfileData.points, icon: TrendingUp, color: 'text-indigo-500 dark:text-indigo-400', gradient: 'from-indigo-400 to-purple-500' },
                            { label: 'Level', value: userProfileData.level, icon: Award, color: 'text-green-500 dark:text-green-400', gradient: 'from-green-400 to-emerald-500' },
                            { label: 'Streak', value: userProfileData.overallStreakCount, icon: Flame, color: 'text-orange-500 dark:text-orange-400', gradient: 'from-orange-400 to-amber-500' },
                            { label: 'Badges', value: (userProfileData.badges || []).length, icon: Trophy, color: 'text-yellow-500 dark:text-yellow-400', gradient: 'from-yellow-400 to-amber-500' },
                        ].map(stat => (
                            <div
                                key={stat.label}
                                className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg text-center shadow-sm border border-gray-200 dark:border-gray-700/50"
                            >
                                <stat.icon className={`w-5 h-5 mx-auto mb-0.5 ${stat.color}`} />
                                <p className={`text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`}>{stat.value}</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <h3 className="text-md font-semibold mb-3 text-gray-700 dark:text-gray-200">Badges Earned</h3>
                    <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-9 gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        {Object.entries(ALL_BADGES_CONFIG).map(([badgeKey, badgeConfig]) => {
                            const isUnlocked = (userProfileData.badges || []).includes(badgeKey);
                            const Icon = badgeConfig.icon;
                            return (
                                <div
                                    key={badgeKey}
                                    title={isUnlocked ? `${badgeConfig.name}: ${badgeConfig.description}` : `${badgeConfig.name} (Locked) - Unlock: ${badgeConfig.unlock_criteria_text}`}
                                    className={`group relative flex flex-col items-center justify-center p-2.5 aspect-square bg-slate-50 dark:bg-slate-800/50 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700/60 text-center transition-all duration-200 ${!isUnlocked ? 'opacity-40 grayscale' : 'hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                                >
                                    <Icon className={`w-6 h-6 mb-1 ${isUnlocked ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                    <span className={`text-[9px] leading-tight font-medium ${isUnlocked ? 'text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>{badgeConfig.name}</span>
                                    {!isUnlocked && ( <div className="absolute top-1 right-1 bg-gray-500/20 dark:bg-gray-900/40 p-0.5 rounded-full"> <Lock className="w-2.5 h-2.5 text-white dark:text-gray-300" /> </div> )}
                                    {isUnlocked && ( <div className="absolute top-1 right-1 bg-green-500/20 dark:bg-green-900/40 p-0.5 rounded-full"> <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-300" /> </div> )}
                                    {!isUnlocked && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[180px] p-1.5 bg-black/80 text-white text-[10px] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20">
                                            <b>Unlock:</b> {badgeConfig.unlock_criteria_text}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {userCurrentTier !== 'premium' && (
                <div className="mt-6 bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Activity className="w-5 h-5 text-indigo-400" /> Monthly Usage
                    </h2>
                    {isLoadingUsage ? (<div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>)
                    : usageError ? (<div className="p-3 rounded-md flex items-start gap-2 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>{usageError}</span></div>)
                    : (<>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ProgressBar label="AI Chat" current={chatUsage?.count || 0} total={getChatLimitForTier(userCurrentTier)} />
                            <ProgressBar label="PDF/Text Notes" current={noteUsage?.pdfAi || 0} total={getNoteLimitsForTier(userCurrentTier).pdfAi} />
                            <ProgressBar label="YouTube Notes" current={noteUsage?.youtube || 0} total={getNoteLimitsForTier(userCurrentTier).youtube} />
                        </div>
                        <p className="mt-5 pt-3 border-t text-center text-xs text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700/50">
                            Usage limits reset on {getNextMonthResetDate()}.
                        </p>
                        </>
                    )}
                </div>
            )}
             <div className="mt-6 bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <SlidersHorizontal className="w-5 h-5 text-teal-500 dark:text-teal-400"/>
                        Learning Style
                    </h2>
                    <button onClick={() => navigate('/onboarding')} className="px-3 py-1 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                        Retake Onboarding
                    </button>
                </div>
                {isLoadingAiContext ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>
                ) : learningProfile ? (
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Primary Goal:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200 text-right truncate">{learningProfile.goal}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Motivation:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200 text-right truncate">{learningProfile.motivation}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Experience Level:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200 text-right truncate">{learningProfile.experience}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Preferred Style:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200 text-right truncate">{learningProfile.style}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No learning style set.</p>
                        <button onClick={() => navigate('/onboarding')} className="mt-2 text-sm font-semibold text-[#635BFF] hover:underline">
                            Set up now
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-6">
                <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100"><BrainCircuit className="w-5 h-5 text-purple-400" /> Universal Context</h2>
                        {!isEditingAiContext && (<button type="button" onClick={() => { setIsEditingAiContext(true); setAiContextError(null); }} disabled={isLoadingAiContext || isSavingAiContext} className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Edit</button>)}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">Provide background information that TaskMaster can always access to personalize its responses and suggestions for you.</p>
                    {aiContextError && (<div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><p className="text-xs sm:text-sm">{aiContextError}</p></div>)}
                    {isLoadingAiContext ? (<div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>)
                      : (<div className="space-y-4">
                          <div><label htmlFor="workDescription" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Your Role / Primary Area of Study</label><textarea id="workDescription" name="workDescription" rows={2} value={aiContextData.workDescription} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Computer Science Student at University of..." className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 resize-y"/></div>
                          <div><label htmlFor="shortTermFocus" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Current Short-Term Focus (Next 1-4 Weeks)</label><textarea id="shortTermFocus" name="shortTermFocus" rows={2} value={aiContextData.shortTermFocus} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Preparing for mid-term exams in Algorithms and Data Structures." className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 resize-y"/></div>
                          <div><label htmlFor="longTermGoals" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Main Long-Term Ambitions or Goals</label><textarea id="longTermGoals" name="longTermGoals" rows={2} value={aiContextData.longTermGoals} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Secure a software engineering internship for next summer, build a portfolio project." className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 resize-y"/></div>
                          <div><label htmlFor="otherContext" className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Other (Additional preferences, communication style, etc.)</label><textarea id="otherContext" name="otherContext" rows={2} value={aiContextData.otherContext} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., My preferred communication style is concise and direct. I enjoy learning through examples." className="w-full bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#635BFF] disabled:opacity-60 resize-y"/></div>
                          {isEditingAiContext && (<div className="flex justify-end gap-2 mt-5"><button type="button" onClick={handleCancelAiContextEdit} disabled={isSavingAiContext} className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Cancel</button><button type="button" onClick={handleSaveAiContext} disabled={isSavingAiContext} className="px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gradient-to-r from-[#635BFF] to-[#8A85FF] text-white hover:opacity-90 flex items-center justify-center min-w-[80px]">{isSavingAiContext ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save Context</>}</button></div>)}
                      </div>)}
                </div>
            </div>
            <div className="mt-6">
                <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100"><DatabaseBackup className="w-5 h-5 text-purple-400" /> Memories</h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Manage specific facts TaskMaster has saved from your conversations.</p>
                    {isLoadingMemories ? (<div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[#635BFF]" /></div>)
                    : memories.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {memories.map(memory => (
                                <div key={memory.id} className="p-3 rounded-lg bg-gray-50 dark:bg-[#1A1D29] border border-gray-100 dark:border-gray-700/70">
                                    {editingMemoryId === memory.id ? (
                                        <div className="space-y-2">
                                            <textarea value={editingMemoryContent} onChange={(e) => setEditingMemoryContent(e.target.value)} className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-1 focus:ring-[#635BFF]" rows={3} />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleCancelEditMemory} className="text-xs font-medium px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                                                <button onClick={handleUpdateMemory} disabled={isSavingMemory} className="text-xs font-medium px-2 py-1 rounded-md bg-green-500 text-white flex items-center gap-1">
                                                    {isSavingMemory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 break-words">{memory.content}</p>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => handleEditMemory(memory)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><Edit className="w-3.5 h-3.5"/></button>
                                                <button onClick={() => handleDeleteMemory(memory.id)} disabled={isDeletingMemory === memory.id} className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md">
                                                    {isDeletingMemory === memory.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (<p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 italic">No memories saved yet. TaskMaster will learn as you interact.</p>)}
                </div>
            </div>
            <div className="mt-6">
                <div className="bg-white dark:bg-[#161922] shadow-lg border border-gray-200 dark:border-gray-700/50 p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <Workflow className="w-5 h-5 text-amber-500 dark:text-amber-400"/> Integrations
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Connect your favorite apps to supercharge your learning.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-[#1A1D29] border border-gray-100 dark:border-gray-700/70">
                            <div className="flex items-center gap-3">
                                <NotionIcon className="w-8 h-8"/>
                                <span className="font-medium text-gray-700 dark:text-gray-200">Notion</span>
                            </div>
                            {isNotionConnected ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">Connected</span>
                                    <button onClick={handleNotionDisconnect} className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">Disconnect</button>
                                </div>
                            ) : (
                                <button onClick={handleNotionConnect} disabled={isNotionConnecting} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#635BFF] text-white hover:opacity-90 disabled:opacity-50">
                                    {isNotionConnecting ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>
                        {[
                            { name: 'Google Drive', icon: GoogleDriveIcon },
                            { name: 'Google Calendar', icon: GoogleCalendarIcon },
                        ].map(integration => (
                            <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-[#1A1D29] border border-gray-100 dark:border-gray-700/70">
                                <div className="flex items-center gap-3">
                                    <integration.icon className="w-8 h-8"/>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{integration.name}</span>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Coming Soon</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
      </main>
    </div>
  );
}

export default Settings;
