import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useScrollLock } from '../hooks/useScrollLock';
import {
  User as UserProfileIcon, Settings as SettingsIcon, LogOut,
  Trash2, AlertCircle, Crown as CrownIcon, Upload, Camera,
  Loader2, Info, CreditCard, Activity, Check,
  Sparkles, Lock, FileText, Youtube, Notebook, Podcast,
  Brain, ShieldCheck, Gift, MessageCircle, X,
  Sun, Moon, Laptop, Edit, Pencil, Layers, Briefcase, Share2, SplitSquareVertical, Award, GraduationCap, Zap, TrendingUp, BarChart3, BarChart, Milestone, Flame, FolderPlus, Folders as FoldersIcon, FolderTree, PackagePlus, FileQuestion, ListTodo, Play, BookOpen, CheckSquare as CheckSquareIcon, MessageCircle as MessageCircleIcon, Target, Palette, SlidersHorizontal, UserCheck, User as UserIconLucide, Trophy, BrainCircuit, DatabaseBackup, Workflow
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Sidebar } from './Sidebar';
import {
  updateUserProfile, signOutUser, deleteUserAccount, AuthError,
  getUserData, deleteProfilePicture, getDefaultChatStyle,
  getThinkHarderEnabled, setThinkHarderEnabled,
} from '../lib/settings-firebase';
import { saveUserContext, getUserContext, UserContext } from '../lib/ai-context-firebase';
import { createCustomStyle, updateCustomStyle, deleteCustomStyle, onCustomStylesSnapshot, type CustomStyle } from '../lib/chat-controls-firebase';
import {
  getUserTier, UserTier,
  getChatLimitForTier, getNoteLimitsForTier,
  getCurrentMonthUserChatUsage, getUserNoteUsage,
  ChatUsageData, NoteUsageData, onUserProfileSnapshot,
  POINTS_FOR_FREE_PREMIUM,
  getCurrentMonthLocal,
} from '../lib/current-paying-user';
import {
  getMemories, updateMemory, deleteMemory, type Memory,
} from '../lib/ai-memories-firebase';
import { createPortalSession } from '../lib/stripe-client';

import { Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

// Error Boundary Component for Badges Section
class BadgesErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Badges section error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[var(--status-error)]" />
            <span className="text-sm font-medium text-[var(--status-error)]">Badges Section Error</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            There was an issue loading the badges. Please refresh the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-highlight)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface UserProfileData {
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
    googleDriveConnected?: boolean;
    googleCalendarConnected?: boolean;
    googleTokens?: any;
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

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg version="1.1" viewBox="0 0 268.1522 273.8827" overflow="hidden" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="a">
        <stop offset="0" stopColor="#0fbc5c"/>
        <stop offset="1" stopColor="#0cba65"/>
      </linearGradient>
      <linearGradient id="g">
        <stop offset=".2312727" stopColor="#0fbc5f"/>
        <stop offset=".3115468" stopColor="#0fbc5f"/>
        <stop offset=".3660131" stopColor="#0fbc5e"/>
        <stop offset=".4575163" stopColor="#0fbc5d"/>
        <stop offset=".540305" stopColor="#12bc58"/>
        <stop offset=".6993464" stopColor="#28bf3c"/>
        <stop offset=".7712418" stopColor="#38c02b"/>
        <stop offset=".8605665" stopColor="#52c218"/>
        <stop offset=".9150327" stopColor="#67c30f"/>
        <stop offset="1" stopColor="#86c504"/>
      </linearGradient>
      <linearGradient id="h">
        <stop offset=".1416122" stopColor="#1abd4d"/>
        <stop offset=".2475151" stopColor="#6ec30d"/>
        <stop offset=".3115468" stopColor="#8ac502"/>
        <stop offset=".3660131" stopColor="#a2c600"/>
        <stop offset=".4456735" stopColor="#c8c903"/>
        <stop offset=".540305" stopColor="#ebcb03"/>
        <stop offset=".6156363" stopColor="#f7cd07"/>
        <stop offset=".6993454" stopColor="#fdcd04"/>
        <stop offset=".7712418" stopColor="#fdce05"/>
        <stop offset=".8605661" stopColor="#ffce0a"/>
      </linearGradient>
      <linearGradient id="f">
        <stop offset=".3159041" stopColor="#ff4c3c"/>
        <stop offset=".6038179" stopColor="#ff692c"/>
        <stop offset=".7268366" stopColor="#ff7825"/>
        <stop offset=".884534" stopColor="#ff8d1b"/>
        <stop offset="1" stopColor="#ff9f13"/>
      </linearGradient>
      <linearGradient id="b">
        <stop offset=".2312727" stopColor="#ff4541"/>
        <stop offset=".3115468" stopColor="#ff4540"/>
        <stop offset=".4575163" stopColor="#ff4640"/>
        <stop offset=".540305" stopColor="#ff473f"/>
        <stop offset=".6993464" stopColor="#ff5138"/>
        <stop offset=".7712418" stopColor="#ff5b33"/>
        <stop offset=".8605665" stopColor="#ff6c29"/>
        <stop offset="1" stopColor="#ff8c18"/>
      </linearGradient>
      <linearGradient id="d">
        <stop offset=".4084578" stopColor="#fb4e5a"/>
        <stop offset="1" stopColor="#ff4540"/>
      </linearGradient>
      <linearGradient id="c">
        <stop offset=".1315461" stopColor="#0cba65"/>
        <stop offset=".2097843" stopColor="#0bb86d"/>
        <stop offset=".2972969" stopColor="#09b479"/>
        <stop offset=".3962575" stopColor="#08ad93"/>
        <stop offset=".4771242" stopColor="#0aa6a9"/>
        <stop offset=".5684245" stopColor="#0d9cc6"/>
        <stop offset=".667385" stopColor="#1893dd"/>
        <stop offset=".7687273" stopColor="#258bf1"/>
        <stop offset=".8585063" stopColor="#3086ff"/>
      </linearGradient>
      <linearGradient id="e">
        <stop offset=".3660131" stopColor="#ff4e3a"/>
        <stop offset=".4575163" stopColor="#ff8a1b"/>
        <stop offset=".540305" stopColor="#ffa312"/>
        <stop offset=".6156363" stopColor="#ffb60c"/>
        <stop offset=".7712418" stopColor="#ffcd0a"/>
        <stop offset=".8605665" stopColor="#fecf0a"/>
        <stop offset=".9150327" stopColor="#fecf08"/>
        <stop offset="1" stopColor="#fdcd01"/>
      </linearGradient>
      <linearGradient xlinkHref="#a" id="s" x1="219.6997" y1="329.5351" x2="254.4673" y2="329.5351" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#b" id="m" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,1.043001,1.455731,2.555422,290.5254,-400.6338)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
      <radialGradient xlinkHref="#c" id="n" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-3.512595,-4.45809,-1.692547,1.260616,870.8006,191.554)" cx="45.25866" cy="279.2738" fx="45.25866" fy="279.2738" r="71.46001"/>
      <radialGradient xlinkHref="#d" id="l" cx="304.0166" cy="118.0089" fx="304.0166" fy="118.0089" r="47.85445" gradientTransform="matrix(2.064353,-4.926832e-6,-2.901531e-6,2.592041,-297.6788,-151.7469)" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#e" id="o" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.2485783,2.083138,2.962486,0.3341668,-255.1463,-331.1636)" cx="181.001" cy="177.2013" fx="181.001" fy="177.2013" r="71.46001"/>
      <radialGradient xlinkHref="#f" id="p" cx="207.6733" cy="108.0972" fx="207.6733" fy="108.0972" r="41.1025" gradientTransform="matrix(-1.249206,1.343263,-3.896837,-3.425693,880.5011,194.9051)" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#g" id="r" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,-1.043001,1.455731,-2.555422,290.5254,838.6834)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
      <radialGradient xlinkHref="#h" id="j" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.081402,-1.93722,2.926737,-0.1162508,-215.1345,632.8606)" cx="154.8697" cy="145.9691" fx="154.8697" fy="145.9691" r="71.46001"/>
      <filter id="q" x="-.04842873" y="-.0582241" width="1.096857" height="1.116448" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.700914"/>
      </filter>
      <filter id="k" x="-.01670084" y="-.01009856" width="1.033402" height="1.020197" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".2419367"/>
      </filter>
      <clipPath clipPathUnits="userSpaceOnUse" id="i">
        <path d="M371.3784 193.2406H237.0825v53.4375h77.167c-1.2405 7.5627-4.0259 15.0024-8.1049 21.7862-4.6734 7.7723-10.4511 13.6895-16.373 18.1957-17.7389 13.4983-38.42 16.2584-52.7828 16.2584-36.2824 0-67.2833-23.2865-79.2844-54.9287-.4843-1.1482-.8059-2.3344-1.1975-3.5068-2.652-8.0533-4.101-16.5825-4.101-25.4474 0-9.226 1.5691-18.0575 4.4301-26.3985 11.2851-32.8967 42.9849-57.4674 80.1789-57.4674 7.4811 0 14.6854.8843 21.5173 2.6481 15.6135 4.0309 26.6578 11.9698 33.4252 18.2494l40.834-39.7111c-24.839-22.616-57.2194-36.3201-95.8444-36.3201-30.8782-.00066-59.3863 9.55308-82.7477 25.6992-18.9454 13.0941-34.4833 30.6254-44.9695 50.9861-9.75366 18.8785-15.09441 39.7994-15.09441 62.2934 0 22.495 5.34891 43.6334 15.10261 62.3374v.126c10.3023 19.8567 25.3678 36.9537 43.6783 49.9878 15.9962 11.3866 44.6789 26.5516 84.0307 26.5516 22.6301 0 42.6867-4.0517 60.3748-11.6447 12.76-5.4775 24.0655-12.6217 34.3012-21.8036 13.5247-12.1323 24.1168-27.1388 31.3465-44.4041 7.2297-17.2654 11.097-36.7895 11.097-57.957 0-9.858-.9971-19.8694-2.6881-28.9684Z" fill="#000"/>
      </clipPath>
    </defs>
    <g transform="matrix(0.957922,0,0,0.985255,-90.17436,-78.85577)">
      <g clipPath="url(#i)">
        <path d="M92.07563 219.9585c.14844 22.14 6.5014 44.983 16.11767 63.4234v.1269c6.9482 13.3919 16.4444 23.9704 27.2604 34.4518l65.326-23.67c-12.3593-6.2344-14.2452-10.0546-23.1048-17.0253-9.0537-9.0658-15.8015-19.4735-20.0038-31.677h-.1693l.1693-.1269c-2.7646-8.0587-3.0373-16.6129-3.1393-25.5029Z" fill="url(#j)" filter="url(#k)"/>
        <path d="M237.0835 79.02491c-6.4568 22.52569-3.988 44.42139 0 57.16129 7.4561.0055 14.6388.8881 21.4494 2.6464 15.6135 4.0309 26.6566 11.97 33.424 18.2496l41.8794-40.7256c-24.8094-22.58904-54.6663-37.2961-96.7528-37.33169Z" fill="url(#l)" filter="url(#k)"/>
        <path d="M236.9434 78.84678c-31.6709-.00068-60.9107 9.79833-84.8718 26.35902-8.8968 6.149-17.0612 13.2521-24.3311 21.1509-1.9045 17.7429 14.2569 39.5507 46.2615 39.3702 15.5284-17.9373 38.4946-29.5427 64.0561-29.5427.0233 0 .046.0019.0693.002l-1.0439-57.33536c-.0472-.00003-.0929-.00406-.1401-.00406Z" fill="url(#m)" filter="url(#k)"/>
        <path d="m341.4751 226.3788-28.2685 19.2848c-1.2405 7.5627-4.0278 15.0023-8.1068 21.7861-4.6734 7.7723-10.4506 13.6898-16.3725 18.196-17.7022 13.4704-38.3286 16.2439-52.6877 16.2553-14.8415 25.1018-17.4435 37.6749 1.0439 57.9342 22.8762-.0167 43.157-4.1174 61.0458-11.7965 12.9312-5.551 24.3879-12.7913 34.7609-22.0964 13.7061-12.295 24.4421-27.5034 31.7688-45.0003 7.3267-17.497 11.2446-37.2822 11.2446-58.7336Z" fill="url(#n)" filter="url(#k)"/>
        <path d="M234.9956 191.2104v57.4981h136.0062c1.1962-7.8745 5.1523-18.0644 5.1523-26.5001 0-9.858-.9963-21.899-2.6873-30.998Z" fill="#3086ff" filter="url(#k)"/>
        <path d="M128.3894 124.3268c-8.393 9.1191-15.5632 19.326-21.2483 30.3646-9.75351 18.8785-15.09402 41.8295-15.09402 64.3235 0 .317.02642.6271.02855.9436 4.31953 8.2244 59.66647 6.6495 62.45617 0-.0035-.3103-.0387-.6128-.0387-.9238 0-9.226 1.5696-16.0262 4.4306-24.3672 3.5294-10.2885 9.0557-19.7628 16.1223-27.9257 1.6019-2.0309 5.8748-6.3969 7.1214-9.0157.4749-.9975-.8621-1.5574-.9369-1.9085-.0836-.3927-1.8762-.0769-2.2778-.3694-1.2751-.9288-3.8001-1.4138-5.3334-1.8449-3.2772-.9215-8.7085-2.9536-11.7252-5.0601-9.5357-6.6586-24.417-14.6122-33.5047-24.2164Z" fill="url(#o)" filter="url(#k)"/>
        <path d="M162.0989 155.8569c22.1123 13.3013 28.4714-6.7139 43.173-12.9771L179.698 90.21568c-9.4075 3.92642-18.2957 8.80465-26.5426 14.50442-12.316 8.5122-23.192 18.8995-32.1763 30.7204Z" fill="url(#p)" filter="url(#q)"/>
        <path d="M171.0987 290.222c-29.6829 10.6413-34.3299 11.023-37.0622 29.2903 5.2213 5.0597 10.8312 9.74 16.7926 13.9835 15.9962 11.3867 46.766 26.5517 86.1178 26.5517.0462 0 .0904-.004.1366-.004v-59.1574c-.0298.0001-.064.002-.0938.002-14.7359 0-26.5113-3.8435-38.5848-10.5273-2.9768-1.6479-8.3775 2.7772-11.1229.799-3.7865-2.7284-12.8991 2.3508-16.1833-.9378Z" fill="url(#r)" filter="url(#k)"/>
        <path d="M219.6997 299.0227v59.9959c5.506.6402 11.2361 1.0289 17.2472 1.0289 6.0259 0 11.8556-.3073 17.5204-.8723v-59.7481c-6.3482 1.0777-12.3272 1.461-17.4776 1.461-5.9318 0-11.7005-.6858-17.29-1.8654Z" opacity=".5" fill="url(#s)" filter="url(#k)"/>
      </g>
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
  const { user, loading: authLoading } = useAuth(); // Use the useAuth hook instead of local state
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
  const [usageError] = useState<string | null>(null);
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
  const [isProfileImageValid, setIsProfileImageValid] = useState(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');

  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isNotionConnecting, setIsNotionConnecting] = useState(false);
  const [isNotionDisconnecting, setIsNotionDisconnecting] = useState(false); // ADD THIS LINE
  
  // Google integrations state
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isGoogleDisconnecting, setIsGoogleDisconnecting] = useState(false);
  
  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState<{ 
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    iconType?: 'profile' | 'style' | 'memory' | 'notion' | 'delete',
    actionType?: 'positive' | 'destructive'
  } | null>(null);
  
  // Chat Style Settings
  const [defaultChatStyle, setDefaultChatStyle] = useState<string>('Normal');
  const [originalDefaultChatStyle, setOriginalDefaultChatStyle] = useState<string>('Normal');
  const [isSavingDefaultStyle, setIsSavingDefaultStyle] = useState(false);
  const [defaultStyleSaved, setDefaultStyleSaved] = useState(false);

  // Reasoning Settings
  const [reasoningEnabled, setReasoningEnabledState] = useState<boolean>(false);
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [isCustomStyleModalOpen, setIsCustomStyleModalOpen] = useState(false);

  // Lock body scroll when any modal is open
  useScrollLock(isCustomStyleModalOpen || showDeleteConfirm || isCropModalOpen || !!confirmAction);
  const [editingCustomStyle, setEditingCustomStyle] = useState<CustomStyle | null>(null);
  const [customStyleFormData, setCustomStyleFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    color: 'bg-[var(--bg-solid-button)]',
    hoverColor: 'hover:bg-[var(--interactive-hover)]',
    lightBg: 'bg-[var(--bg-highlight)]',
    textColor: 'text-[var(--bg-accent)]'
  });
  const functions = getFunctions();

  // Function to validate profile picture URL
  const validateProfilePicture = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      
      // Timeout after 3 seconds to prevent hanging
      setTimeout(() => resolve(false), 3000);
    });
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
  }, [user, authLoading, navigate]);

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


   // --- OAuth redirect handler for Notion and Google ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    // Only run if there's a code, a user, and we aren't already handling it.
    if (code && user && !isHandlingRedirect) {
        setIsHandlingRedirect(true); // Set the flag immediately to prevent re-runs
        
        // Scroll to connectors section to show "Connecting..." status
        setTimeout(() => {
            const connectorsElement = document.getElementById('connectors-section');
            if (connectorsElement) {
                connectorsElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 100);

        const isProduction = window.location.hostname === 'www.taskmaster.one';
        const redirectUri = isProduction
            ? 'https://www.taskmaster.one/settings'
            : 'http://localhost:5173/settings';

        const processRedirect = async () => {
            try {
                // Check if this is a Google OAuth redirect (has state parameter)
                if (state) {
                    setIsGoogleConnecting(true);
                    const googleConnect = httpsCallable(functions, 'googleOAuthCallback');
                    const result = await googleConnect({ code: code, state: state });
                    
                    // Verify the connection was actually successful
                    if (result.data && (result.data as any).success) {
                        setIsGoogleDriveConnected(true);
                        setIsGoogleCalendarConnected(true);
                        
                        // Test the connection by making a simple API call
                        try {
                            const testConnection = httpsCallable(functions, 'googleProxy');
                            await testConnection({
                                service: 'drive',
                                action: 'listFilesAndFolders',
                                payload: {}
                            });
                            console.log('Google Drive connection verified successfully');
                        } catch (testError: any) {
                            console.warn('Google connection test failed:', testError.message);
                            // Don't fail the whole process, just warn
                        }
                    } else {
                        throw new Error('Google connection was not successful');
                    }
                    navigate('/settings', { replace: true }); // Clean URL
                } else {
                    // This is a Notion OAuth redirect
                    setIsNotionConnecting(true);
                const notionConnect = httpsCallable(functions, 'notionOAuthCallback');
                await notionConnect({ code: code, redirectUri: redirectUri });
                
                setIsNotionConnected(true);
                navigate('/settings', { replace: true }); // Clean URL
                }
                
                // Scroll to connectors section after navigation
                setTimeout(() => {
                    const connectorsElement = document.getElementById('connectors-section');
                    if (connectorsElement) {
                        connectorsElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                    }
                }, 100); // Small delay to ensure DOM is updated

            } catch (error: any) {
                console.error("Error connecting to service. Full error:", error);
                const detailedMessage = error.details ? `Details: ${JSON.stringify(error.details)}` : "No further details.";
                const serviceName = state ? 'Google' : 'Notion';
                setError(`Failed to connect to ${serviceName}: ${error.message}. ${detailedMessage}`);
            } finally {
                setIsNotionConnecting(false);
                setIsGoogleConnecting(false);
            }
        };

        processRedirect();
    }
  }, [navigate, functions, isHandlingRedirect, user]); // Add user to dependencies


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
    if (!user) return; // Don't run if user is not available yet
    
    setIsLoading(true);
    setIsLoadingAiContext(true);
    setUserCurrentTier('loading');
    setIsLoadingUsage(true);
    setIsLoadingMemories(true);

    const checkConnections = async () => {
        if (user) {
            const fetchedUserData = await getUserData(user.uid);
            if (fetchedUserData) {
                // Check Notion connection
                if (fetchedUserData.notionAccessData) {
                setIsNotionConnected(true);
                }
                
                // Check Google connections - verify tokens exist
                const hasGoogleTokens = (fetchedUserData as any).googleTokens?.access_token;
                if ((fetchedUserData as any).googleDriveConnected && hasGoogleTokens) {
                    setIsGoogleDriveConnected(true);
                } else if ((fetchedUserData as any).googleDriveConnected && !hasGoogleTokens) {
                    // Connection flag is true but no tokens - mark as disconnected
                    setIsGoogleDriveConnected(false);
                }
                if ((fetchedUserData as any).googleCalendarConnected && hasGoogleTokens) {
                    setIsGoogleCalendarConnected(true);
                } else if ((fetchedUserData as any).googleCalendarConnected && !hasGoogleTokens) {
                    // Connection flag is true but no tokens - mark as disconnected
                    setIsGoogleCalendarConnected(false);
                }
            }
        }
    };
    checkConnections();

    const googleFlag = user.providerData?.some((p: any) => p.providerId === 'google.com');
    setIsGoogleUser(!!googleFlag);

    const unsubscribeProfile = onUserProfileSnapshot(user.uid, (profileDoc) => {
      if (profileDoc) {
        setUserProfileData(profileDoc as UserProfileData);
        const updatedName = profileDoc.displayName || userData.name;
        const updatedPhoto = profileDoc.photoURL || ''; // Use empty string if photoURL is null/undefined
        
        setUserData(prev => ({ ...prev, name: updatedName, photoURL: updatedPhoto }));
        setFormData(prev => ({ ...prev, name: updatedName }));
        
        // Update profile picture validation when data changes
        if (updatedPhoto) {
          validateProfilePicture(updatedPhoto).then((isValid) => {
            if (isValid) {
              setProfileImageUrl(updatedPhoto);
              setIsProfileImageValid(true);
            } else {
              setProfileImageUrl('');
              setIsProfileImageValid(false);
            }
          });
        } else {
          setProfileImageUrl('');
          setIsProfileImageValid(false);
        }
      }
      setIsLoading(false);
    });

    const fetchInitialData = async () => {
      const currentMonthStr = getCurrentMonthLocal();
      try {
        const [tier, firestoreData, fetchedChatUsage, fetchedNoteUsage, fetchedMemories, context] = await Promise.all([
          getUserTier(user.uid, user.email),
          getUserData(user.uid),
          getCurrentMonthUserChatUsage(user.uid, currentMonthStr),
          getUserNoteUsage(user.uid),
          getMemories(user.uid, 50),
          getUserContext(user.uid)
        ]);
        
        const initialName = firestoreData?.name || user.displayName || '';
        const initialEmail = user.email || '';
        const initialPhotoURL = firestoreData?.photoURL || ''; // Only use Firestore data for photo
        
        // Validate the profile picture URL before setting it
        if (initialPhotoURL) {
          validateProfilePicture(initialPhotoURL).then((isValid) => {
            if (isValid) {
              setUserData({ name: initialName, email: initialEmail, photoURL: initialPhotoURL });
              setProfileImageUrl(initialPhotoURL);
              setIsProfileImageValid(true);
            } else {
              setUserData({ name: initialName, email: initialEmail, photoURL: '' });
              setProfileImageUrl('');
              setIsProfileImageValid(false);
            }
          });
        } else {
          setUserData({ name: initialName, email: initialEmail, photoURL: '' });
          setProfileImageUrl('');
          setIsProfileImageValid(false);
        }
        
        setFormData(prev => ({ ...prev, name: initialName, email: initialEmail, currentPassword: '', newPassword: '', confirmPassword: '' }));

        setStripeCustomerId(firestoreData?.stripeCustomerId || null);
        
        setUserCurrentTier(tier);
        setChatUsage(fetchedChatUsage);
        // Ensure we always have valid note usage data with fallbacks
        const safeNoteUsage = fetchedNoteUsage || { pdfAi: 0, youtube: 0, month: currentMonthStr };
        setNoteUsage(safeNoteUsage);
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
  }, [user]); // Only depend on user, remove navigate and functions

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Load default chat style and custom styles
  useEffect(() => {
    if (!user?.uid) return;
    
    const loadChatStyleSettings = async () => {
      try {
        const defaultStyle = await getDefaultChatStyle(user.uid);
        if (defaultStyle) {
          setDefaultChatStyle(defaultStyle);
          setOriginalDefaultChatStyle(defaultStyle);
        }
      } catch (error) {
        console.error('Error loading default chat style:', error);
      }
    };

    const loadReasoningSettings = async () => {
      try {
        const reasoningSetting = await getThinkHarderEnabled(user.uid);
        setReasoningEnabledState(reasoningSetting);
      } catch (error) {
        console.error('Error loading Reasoning settings:', error);
      }
    };

    loadChatStyleSettings();
    loadReasoningSettings();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribe = onCustomStylesSnapshot(user.uid, setCustomStyles);
    return () => unsubscribe();
  }, [user?.uid]);

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
      await updateUserProfile(user.uid, { photoFile: croppedImageFile });
      const refreshedFirestoreData = await getUserData(user.uid);
      
      // Update both the userData and the validated image URL  
      const finalPhotoURL = refreshedFirestoreData?.photoURL || '';
      setUserData(prev => ({ ...prev, photoURL: finalPhotoURL, name: refreshedFirestoreData?.name || prev.name }));
      
      // Validate and set the new profile picture URL
      if (finalPhotoURL) {
        validateProfilePicture(finalPhotoURL).then((isValid) => {
          if (isValid) {
            setProfileImageUrl(finalPhotoURL);
            setIsProfileImageValid(true);
          } else {
            setProfileImageUrl('');
            setIsProfileImageValid(false);
          }
        });
      } else {
        setProfileImageUrl('');
        setIsProfileImageValid(false);
      }
    } catch (err) {
      console.error("Crop/Upload Error:", err);
      setError('Failed to upload cropped image.');
    } finally {
      setIsUploading(false);
      setImgSrcForCrop('');
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!user || !userData.photoURL) return; 
    
    setConfirmAction({
      message: 'Are you sure you want to remove your profile picture?',
      onConfirm: () => {
        setConfirmAction(null);
        executeRemoveProfilePicture();
      },
      onCancel: () => setConfirmAction(null),
      iconType: 'profile',
      actionType: 'destructive'
    });
  };

  const executeRemoveProfilePicture = async () => {
    if (!user) return;
    
    setIsUploading(true); 
    setError(null);
    
    try {
        await deleteProfilePicture(user.uid);
        
        // Force reload the user to get the updated auth state
        await user.reload();
        
        // Clear the photoURL immediately to show the default icon
        setUserData(prev => ({ 
          ...prev, 
          photoURL: '' 
        }));
        
        // Clear the validated image URL
        setProfileImageUrl('');
        // Reset the image validity state
        setIsProfileImageValid(false);
        
        // Also update form data to reflect the removal
        setFormData(prev => ({ 
          ...prev, 
          photoURL: ''
        }));
        
    } catch (err) { 
        console.error("Remove Pic Error:", err); 
        setError(err instanceof AuthError ? err.message : 'Failed to remove.'); 
    } finally { 
        setIsUploading(false); 
    }
  };

  // Chat Style Handlers
  const handleDefaultStyleChange = async (styleName: string) => {
    if (!user?.uid) return;
    setIsSavingDefaultStyle(true);
    try {
      await setDefaultChatStyle(styleName);
      setOriginalDefaultChatStyle(styleName);
      setDefaultStyleSaved(true);
      setTimeout(() => setDefaultStyleSaved(false), 3000); // Hide success message after 3 seconds
    } catch (error) {
      console.error('Error setting default chat style:', error);
      setError('Failed to set default chat style');
    } finally {
      setIsSavingDefaultStyle(false);
    }
  };

  const handleReasoningChange = async (enabled: boolean) => {
    if (!user?.uid) return;
    try {
      await setThinkHarderEnabled(user.uid, enabled);
    } catch (error) {
      console.error('Error saving Reasoning setting:', error);
      setError('Failed to save Reasoning setting');
      // Revert the UI state if save failed
      setReasoningEnabledState(!enabled);
    }
  };

  const handleEditCustomStyle = (style: CustomStyle) => {
    setEditingCustomStyle(style);
    setCustomStyleFormData({
      name: style.name,
      description: style.description,
      prompt: style.prompt,
      color: style.color || 'bg-[var(--bg-solid-button)]',
      hoverColor: style.hoverColor || 'hover:bg-[var(--interactive-hover)]',
      lightBg: style.lightBg || 'bg-[var(--bg-highlight)]',
      textColor: style.textColor || 'text-[var(--bg-accent)]'
    });
    setIsCustomStyleModalOpen(true);
  };

  const handleDeleteCustomStyle = async (styleId: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this chat style? This action cannot be undone.',
      onConfirm: () => {
        setConfirmAction(null);
        executeDeleteCustomStyle(styleId);
      },
      onCancel: () => setConfirmAction(null),
      iconType: 'style',
      actionType: 'destructive'
    });
  };

  const executeDeleteCustomStyle = async (styleId: string) => {
    try {
      await deleteCustomStyle(styleId);
    } catch (error) {
      console.error('Error deleting custom style:', error);
      setError('Failed to delete custom style');
    }
  };

  const handleSaveCustomStyle = async () => {
    if (!user?.uid || !customStyleFormData.name || !customStyleFormData.description || !customStyleFormData.prompt) return;
    
    try {
      if (editingCustomStyle) {
        await updateCustomStyle(editingCustomStyle.id, customStyleFormData);
      } else {
        await createCustomStyle(user.uid, customStyleFormData);
      }
      
      setIsCustomStyleModalOpen(false);
      setEditingCustomStyle(null);
      setCustomStyleFormData({
        name: '',
        description: '',
        prompt: '',
        color: 'bg-[var(--bg-solid-button)]',
        hoverColor: 'hover:bg-[var(--interactive-hover)]',
        lightBg: 'bg-[var(--bg-highlight)]',
        textColor: 'text-[var(--bg-accent)]'
      });
    } catch (error) {
      console.error('Error saving custom style:', error);
      setError('Failed to save custom style');
    }
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
          await updateUserProfile(user.uid, updateData);
          const refreshedFirestoreData = await getUserData(user.uid);
          const newName = refreshedFirestoreData?.name || user?.displayName || userData.name;
          const newEmail = user?.email || userData.email;
          const newPhotoURL = refreshedFirestoreData?.photoURL || '';
          setUserData({ name: newName, email: newEmail, photoURL: newPhotoURL });
          setFormData(prev => ({ ...prev, name: newName, email: newEmail, currentPassword: '', newPassword: '', confirmPassword: '' }));
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
    if (!user) return;
    
    setConfirmAction({
      message: 'Are you sure you want to delete this memory? This action cannot be undone.',
      onConfirm: () => {
        setConfirmAction(null);
        executeDeleteMemory(memoryId);
      },
      onCancel: () => setConfirmAction(null),
      iconType: 'memory',
      actionType: 'destructive'
    });
  };

  const executeDeleteMemory = async (memoryId: string) => {
    if (!user) return;
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

// Google Connect function
const handleGoogleConnect = async () => {
    setIsGoogleConnecting(true);
    
    try {
        // Dynamically determine the redirect URI based on the browser's current location
        const isProduction = window.location.hostname === 'www.taskmaster.one';
        const redirectUri = isProduction 
            ? 'https://www.taskmaster.one/settings'
            : 'http://localhost:5173/settings';

        const getGoogleAuthUrl = httpsCallable(functions, 'getGoogleAuthUrl');
        const result = await getGoogleAuthUrl({ redirectUri });
        
        window.location.href = (result.data as any).url;
    } catch (error: any) {
        console.error("Error getting Google auth URL:", error);
        setError(`Failed to connect to Google: ${error.message}`);
        setIsGoogleConnecting(false);
    }
};

// Google Disconnect function
const handleGoogleDisconnect = async () => {
    setIsGoogleDisconnecting(true);
    
    try {
        // Note: We could disconnect both Drive and Calendar, but since they use the same OAuth token,
        // we'll just disconnect both at once
        const disconnectGoogle = httpsCallable(functions, 'disconnectGoogleService');
        await disconnectGoogle({ service: 'drive' }); // This will disconnect both since they share tokens
        
        setIsGoogleDriveConnected(false);
        setIsGoogleCalendarConnected(false);
    } catch (error: any) {
        console.error("Error disconnecting Google:", error);
        setError(`Failed to disconnect Google: ${error.message}`);
    } finally {
        setIsGoogleDisconnecting(false);
    }
};



  const handleNotionDisconnect = async () => {
    // Prevent function from running if user is not set or if it's already running
    if (!user || isNotionDisconnecting) return;
    
    setConfirmAction({
      message: 'Are you sure you want to disconnect from Notion? This will revoke access to your Notion workspace.',
      onConfirm: () => {
        setConfirmAction(null);
        executeNotionDisconnect();
      },
      onCancel: () => setConfirmAction(null),
      iconType: 'notion',
      actionType: 'destructive'
    });
  };

  const executeNotionDisconnect = async () => {
    if (!user || isNotionDisconnecting) return;

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
    let barColorClass = 'bg-[var(--bg-accent)]';
    if (percentage > 85 && total !== Infinity) barColorClass = 'bg-[var(--status-error)]';
    else if (percentage > 60 && total !== Infinity) barColorClass = 'bg-[var(--status-warning)]';
    else if (total === Infinity) barColorClass = 'bg-[var(--status-success)]';

    return (
      <div className='flex-1'>
        <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
            <p className="text-xs text-[var(--text-secondary)]">{current} / {displayTotal}</p>
        </div>
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-[var(--border-primary)]">
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
    <div className="min-h-screen font-clarika bg-theme-primary text-theme-text-primary selection:bg-[var(--bg-accent)] selection:text-white">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev: boolean) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        userName={userData.name || 'Learner'}
        userProfile={userData}
      />
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--overlay-dark)] backdrop-blur-sm">
          <div className="bg-theme-card border border-theme-border-secondary shadow-xl rounded-xl p-5 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3 text-theme-text-primary">Delete Account</h3>
            <p className="mb-4 text-sm text-theme-text-secondary">
                Are you sure? This permanently deletes your account and all associated data. Cannot be undone.
            </p>
            {!isGoogleUser && (
              <div className="mb-4">
                <label htmlFor="deleteConfirmPassword" className="block text-xs font-medium mb-1 text-theme-text-secondary">Enter Current Password</label>
                <input id="deleteConfirmPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} placeholder="Required to delete" className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--status-error)] text-[var(--text-primary)] placeholder-theme" disabled={isDeleting}/>
              </div>
            )}
            {error && showDeleteConfirm && (
              <div className="mb-4 p-2 rounded-md flex items-start gap-2 text-xs bg-[var(--status-error)]/10 text-[var(--status-error)]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button onClick={closeDeleteModal} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]" disabled={isDeleting}>Cancel</button>
              <button onClick={handleDeleteAccount} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[var(--status-error)] text-[var(--text-white)] hover:bg-[var(--status-error)]/80 flex items-center justify-center min-w-[100px]" disabled={isDeleting || (!isGoogleUser && !formData.currentPassword)}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isCropModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--overlay-dark)] backdrop-blur-sm">
              <div className="bg-[var(--bg-highlight)] border border-[var(--border-primary)] shadow-xl rounded-xl p-5 sm:p-6 max-w-lg w-full">
                  <h3 className="text-lg font-semibold mb-3 text-[var(--text-primary)]">Crop Profile Picture</h3>
                  {imgSrcForCrop && (
                    <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)} aspect={1}>
                        <img ref={imgRef} alt="Crop me" src={imgSrcForCrop} onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                    </ReactCrop>
                  )}
                  <div className="flex gap-2 sm:gap-3 justify-end mt-4">
                      <button onClick={() => setIsCropModalOpen(false)} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">Cancel</button>
                      <button onClick={handleCropImage} className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-header)] hover:bg-[var(--interactive-hover)] text-[var(--text-white)]">Crop & Save</button>
                  </div>
              </div>
          </div>
      )}
      <main className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-6`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />Settings
              </h1>
              <p className="text-theme-text-secondary mt-1 text-sm">Manage your account settings and preferences</p>
            </div>
            {error && !showDeleteConfirm && ( 
              <div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-[var(--status-error)]/10 text-[var(--status-error)]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <p className="text-xs sm:text-sm">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
               <div className="flex flex-col gap-6">
                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                   <h2 className="text-base sm:text-lg font-semibold mb-4 text-[var(--text-primary)]">Profile Picture</h2>
                   <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                     <div className="relative group flex-shrink-0">
                       <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2 border-[var(--border-primary)] bg-[var(--bg-highlight)]">
                         {isUploading ? (
                           <div className="absolute inset-0 flex items-center justify-center bg-[var(--overlay-dark)] rounded-full">
                             <Loader2 className="w-5 h-5 animate-spin text-[var(--text-white)]" />
                           </div>
                         ) : (profileImageUrl && isProfileImageValid) ? (
                           <img 
                             src={profileImageUrl} 
                             alt="Profile" 
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <UserProfileIcon className="w-10 h-10 text-[var(--text-muted)]" />
                         )}
                       </div>
                       {!isUploading && (
                         <button onClick={handleProfilePictureClick} className="absolute inset-0 flex items-center justify-center bg-[var(--overlay-dark)] opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer" title="Change picture" aria-label="Change profile picture">
                           <Camera className="w-5 h-5 text-[var(--text-white)]" />
                         </button>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                     </div>
                     <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto justify-center sm:justify-start">
                       <button onClick={handleProfilePictureClick} disabled={isUploading} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">
                         <Upload className="w-4 h-4" /> {isUploading ? 'Uploading...' : 'Upload'}
                       </button>
                       {(profileImageUrl && isProfileImageValid) && !isUploading && (
                         <button onClick={handleRemoveProfilePicture} disabled={isUploading} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--status-error)] border border-[var(--status-error)] hover:bg-[var(--status-error)]/80 text-white">
                           <Trash2 className="w-4 h-4" /> Remove
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Profile Details</h2>
                      {!isEditing && (<button type="button" onClick={() => { setIsEditing(true); setError(null); }} disabled={isLoading || isSaving} className="px-3 py-1 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">Edit</button>)}
                    </div>
                    <form onSubmit={handleSave}>
                       <div className="space-y-4">
                          <div>
                            <label htmlFor="name" className="block text-xs font-medium mb-1 text-theme-text-secondary">Name</label>
                            <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} disabled={!isEditing || isSaving || isLoading} className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 disabled:cursor-not-allowed text-[var(--text-primary)]" required/>
                          </div>
                          <div>
                            <label htmlFor="email" className="flex items-center text-xs font-medium mb-1 text-theme-text-secondary">Email {isGoogleUser && <span className="ml-1.5 text-[10px] text-[var(--text-muted)]"></span>}</label>
                            <input id="email" type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={!isEditing || isSaving || isGoogleUser || isLoading} className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 disabled:cursor-not-allowed text-[var(--text-primary)]" required/>
                          </div>
                          {isEditing && !isGoogleUser && (
                              <>
                                  <hr className="my-3 border-[var(--border-primary)]" />
                                  <p className="text-sm font-medium -mb-1 text-[var(--text-primary)]">Change Password</p>
                                  <div>
                                      <label htmlFor="currentPassword" className="block text-xs font-medium mb-1 text-theme-text-secondary">Current Password</label>
                                      <input id="currentPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Required to change email or password" className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 text-[var(--text-primary)] placeholder-theme" />
                                  </div>
                                  <div>
                                      <label htmlFor="newPassword" className="block text-xs font-medium mb-1 text-theme-text-secondary">New Password</label>
                                      <input id="newPassword" type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Leave blank to keep current (min 6 chars)" className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 text-[var(--text-primary)] placeholder-theme" />
                                  </div>
                                  <div>
                                      <label htmlFor="confirmPassword" className="block text-xs font-medium mb-1 text-theme-text-secondary">Confirm New Password</label>
                                      <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Confirm if changing" className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 text-[var(--text-primary)] placeholder-theme" />
                                  </div>
                              </>
                          )}
                      </div>
                      {isEditing && (
                        <div className="flex justify-end gap-2 mt-5">
                          <button type="button" onClick={() => { setIsEditing(false); setError(null); setFormData({name: userData.name, email: userData.email, currentPassword: '', newPassword: '', confirmPassword: ''}); }} disabled={isSaving} className="px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] min-w-[80px]">Cancel</button>
                          <button type="submit" disabled={isSaving || isLoading} className="px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--status-success)] hover:bg-[var(--status-success)]/80 text-white flex items-center justify-center min-w-[80px]">
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      )}
                    </form>
                 </div>
                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 text-[var(--text-primary)]">Account Actions</h2>
                    <div className="space-y-3">
                        <Link to="/contact" className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">
                            <Info className="w-4 h-4" /> Help
                        </Link>
                        <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]"><LogOut className="w-4 h-4" /> Sign Out</button>
                        <button onClick={() => { setShowDeleteConfirm(true); setFormData(prev => ({ ...prev, currentPassword: '' })); setError(null); }} className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg bg-[var(--status-error)] border border-[var(--status-error)] hover:bg-[var(--status-error)]/80 text-white"><Trash2 className="w-4 h-4" /> Delete Account</button>
                    </div>
                 </div>
               </div>
               <div className="flex flex-col gap-6">
                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 text-[var(--text-primary)]">Appearance</h2>
                     <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           {themeModes.map(mode => (
                               <button
                                   key={mode.name}
                                   onClick={mode.handler}
                                   className={`p-3 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-2 text-sm font-medium bg-[var(--bg-highlight)] ${
                                       currentThemeMode === mode.name 
                                       ? 'border-[var(--bg-accent)]' 
                                       : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                                   }`}
                               >
                                   <mode.icon className={`w-5 h-5 ${
                                     mode.name === 'light' ? 'text-yellow-500' : 
                                     mode.name === 'dark' ? 'text-[var(--bg-accent)]' : 'text-[var(--text-secondary)]'
                                   }`} />
                                   <span className="capitalize text-theme-text-primary">{mode.name}</span>
                               </button>
                           ))}
                        </div>
                     </div>
                 </div>
                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5 flex flex-col flex-grow">
                   <div className="flex items-center justify-between mb-4">
                     <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                       Subscription
                     </h2>
                     {userCurrentTier === 'loading' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Checking...</span>}
                     {userCurrentTier === 'premium' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-br from-[var(--bg-header)] to-[var(--bg-accent)] text-white shadow-sm">Premium</span>)}
                     {userCurrentTier === 'pro' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-teal-400 to-cyan-500 text-white shadow-sm">Pro</span>)}
                     {userCurrentTier === 'basic' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[var(--bg-highlight)] border border-[var(--border-primary)]" style={{ color: 'var(--text-secondary)' }}>Basic</span>)}
                   </div>



                   <div className="flex flex-col flex-grow">
                      <div className="space-y-3">

                        <div className="space-y-2.5">
                          {userCurrentTier === 'basic' && (
                            <>
                              <div className="flex items-center gap-3">
                                <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>5 PDF/Text Notes per month</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Youtube className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>3 YouTube Notes per month</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>25 Chat Messages per month</span>
                              </div>
                            </>
                          )}
                          {userCurrentTier === 'pro' && (
                            <>
                              <div className="flex items-center gap-3">
                                <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>25 PDF/Text Notes per month</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Youtube className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>15 YouTube Notes per month</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>500 Chat Messages per month</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Limited access to Smart Daily Brief</span>
                              </div>
                            </>
                          )}
                          {userCurrentTier === 'premium' && (
                            <>
                              <div className="flex items-center gap-3">
                                <Notebook className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited PDF & Text Notes</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Youtube className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited YouTube Notes</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited Chat Messages</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Brain className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited Smarter AI Responses</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited Smart Daily Brief</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Podcast className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Unlimited Podcasts</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Priority Support</span>
                              </div>
                            </>
                          )}
                        </div>


                      </div>

                      <div className="mt-auto space-y-3">
                        {/* Free Premium Days Display */}
                        {userProfileData?.premiumAwardedUntil && (toDateSafe(userProfileData.premiumAwardedUntil) || new Date(0)) > new Date() && (() => {
                          const premiumUntil = toDateSafe(userProfileData.premiumAwardedUntil);
                          const daysRemaining = premiumUntil ? Math.max(0, Math.ceil((premiumUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                          return (
                            <div className="p-3 rounded-lg bg-[var(--status-success)] border border-[var(--status-success)] text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <CrownIcon className="w-4 h-4 text-white" />
                                <span className="text-sm font-semibold text-white">Free Premium Active!</span>
                              </div>
                              <p className="text-xs text-white/90">
                                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining • Expires: {premiumUntil?.toLocaleDateString()}
                              </p>
                            </div>
                          );
                        })()}

                        {/* Points Needed for Free Premium Display */}
                        {(userCurrentTier === 'basic' || userCurrentTier === 'pro') && userProfileData && (() => {
                          const pointsNeededForPremium = Math.max(0, POINTS_FOR_FREE_PREMIUM - (userProfileData.points || 0));
                          const hasActivePremium = userProfileData.premiumAwardedUntil && (toDateSafe(userProfileData.premiumAwardedUntil) || new Date(0)) > new Date();
                          return pointsNeededForPremium > 0 && !hasActivePremium ? (
                            <div className="p-3 rounded-lg bg-[var(--bg-accent)] border border-[var(--bg-accent)] text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <Gift className="w-4 h-4 text-white" />
                                <span className="text-sm font-semibold text-white">Earn Free Premium!</span>
                              </div>
                              <p className="text-xs text-white/90">
                                Collect {pointsNeededForPremium} more points to earn <span className="font-semibold text-white">1 FREE week of Premium</span>!
                              </p>
                            </div>
                          ) : null;
                        })()}

                        {(userCurrentTier === 'pro' || userCurrentTier === 'premium') && stripeCustomerId && (
                          <div className="pt-4 border-t border-[var(--border-primary)]">
                            {portalError && (<p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--status-error)' }}><AlertCircle size={14} /> {portalError}</p>)}
                            <button onClick={handleManageSubscription} disabled={isManagingSubscription} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] disabled:opacity-70" style={{ color: 'var(--text-primary)' }}>
                              {isManagingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                              {isManagingSubscription ? 'Loading Portal...' : 'Manage Billing'}
                            </button>
                          </div>
                        )}
                        {userCurrentTier !== 'premium' && (
                          <Link to="/pricing" className="block w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] rounded-lg" style={{ color: 'var(--text-primary)' }}>
                            <span className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium">Upgrade Plan</span>
                          </Link>
                        )}
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            {isLoading ? (<div className="mt-6 flex justify-center items-center h-48 bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl"><Loader2 className="w-8 h-8 animate-spin text-[var(--bg-accent)]" /></div>)
            : userProfileData && (
                <div className="mt-6 bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                                                 My Progress
                    </h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                        {[
                            { label: 'Points', value: userProfileData.points ?? 0, icon: TrendingUp, color: 'text-[var(--text-primary)]', gradient: 'from-[var(--text-primary)] to-[var(--text-primary)]' },
                            { label: 'Level', value: userProfileData.level ?? 0, icon: Award, color: 'text-[var(--text-primary)]', gradient: 'from-[var(--text-primary)] to-[var(--text-primary)]' },
                            { label: 'Streak', value: userProfileData.overallStreakCount ?? 0, icon: Flame, color: 'text-[var(--text-primary)]', gradient: 'from-[var(--text-primary)] to-[var(--text-primary)]' },
                            { label: 'Badges', value: (userProfileData.badges || []).length, icon: Trophy, color: 'text-[var(--text-primary)]', gradient: 'from-[var(--text-primary)] to-[var(--text-primary)]' },
                        ].map(stat => (
                            <div
                                key={stat.label}
                                className="bg-[var(--bg-highlight)] p-2.5 rounded-lg text-center shadow-sm border border-[var(--border-primary)]"
                            >
                                <stat.icon className={`w-5 h-5 mx-auto mb-0.5 ${stat.color}`} />
                                <p className={`text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`}>{stat.value}</p>
                                <p className="text-[11px] text-theme-text-secondary uppercase tracking-wider">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <h3 className="text-md font-semibold mb-3 text-theme-text-primary">Badges Earned</h3>

                    <BadgesErrorBoundary>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2 sm:gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)]">
                            {Object.entries(ALL_BADGES_CONFIG)
                                .map(([badgeKey, badgeConfig]) => {
                                    try {
                                        const isUnlocked = (userProfileData.badges || []).includes(badgeKey);
                                        const Icon = badgeConfig.icon;
                                        
                                        // Temporarily remove validation to debug
                                        // if (!Icon) {
                                        //     console.warn(`Missing icon for badge: ${badgeKey}`);
                                        //     return null;
                                        // }
                                        
                                        return (
                                            <div
                                                key={badgeKey}
                                                title={isUnlocked ? `${badgeConfig.name}: ${badgeConfig.description}` : `${badgeConfig.name} (Locked) - Unlock: ${badgeConfig.unlock_criteria_text}`}
                                                className={`group relative flex flex-col items-center justify-center p-2 sm:p-2.5 aspect-square bg-[var(--bg-highlight)] rounded-lg shadow-sm border border-[var(--border-primary)] text-center transition-all duration-200 ${!isUnlocked ? 'opacity-40 grayscale' : 'hover:border-[var(--border-secondary)]'}`}
                                            >
                                                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-1 ${isUnlocked ? 'text-[var(--bg-accent)]' : 'text-[var(--text-muted)]'}`} />
                                                <span className={`text-[8px] sm:text-[9px] leading-tight font-medium ${isUnlocked ? 'text-theme-text-primary' : 'text-theme-text-secondary'}`}>{badgeConfig.name}</span>
                                                
                                                {/* Lock/Check indicators */}
                                                {!isUnlocked && (
                                                    <div className="absolute top-1 right-1 bg-[var(--text-muted)]/20 p-0.5 rounded-full">
                                                        <Lock className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[var(--text-muted)]" />
                                                    </div>
                                                )}
                                                {isUnlocked && (
                                                    <div className="absolute top-1 right-1 bg-[var(--status-success)]/20 p-0.5 rounded-full">
                                                        <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[var(--status-success)]" />
                                                    </div>
                                                )}
                                                
                                                {/* Desktop-only tooltip - hidden on mobile to prevent crashes */}
                                                {!isUnlocked && (
                                                    <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[180px] p-1.5 bg-black/80 text-white text-[10px] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                                                        <b>Unlock:</b> {badgeConfig.unlock_criteria_text}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } catch (error) {
                                        console.error(`Error rendering badge ${badgeKey}:`, error);
                                        // Return a fallback badge to prevent the entire section from crashing
                                        return (
                                            <div
                                                key={badgeKey}
                                                className="flex flex-col items-center justify-center p-2 sm:p-2.5 aspect-square bg-[var(--bg-highlight)] rounded-lg shadow-sm border border-[var(--border-primary)] text-center opacity-60"
                                            >
                                                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 mb-1 text-[var(--text-muted)]" />
                                                <span className="text-[8px] sm:text-[9px] leading-tight font-medium text-[var(--text-muted)]">Error</span>
                                            </div>
                                        );
                                    }
                                })
                            }
                        </div>
                    </BadgesErrorBoundary>
                </div>
            )}

            {userCurrentTier !== 'premium' && (
                <div className="mt-6 bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
                        <Activity className="w-5 h-5 text-[var(--text-primary)]" /> Monthly Usage
                    </h2>
                    {isLoadingUsage ? (<div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[var(--bg-accent)]" /></div>)
                    : usageError ? (<div className="p-3 rounded-md flex items-start gap-2 text-xs bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 text-[var(--status-error)]"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>{usageError}</span></div>)
                    : (<>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ProgressBar label="Chat Messages" current={chatUsage?.count || 0} total={getChatLimitForTier(userCurrentTier)} />
                            <ProgressBar label="PDF/Text Notes" current={noteUsage?.pdfAi || 0} total={getNoteLimitsForTier(userCurrentTier).pdfAi} />
                            <ProgressBar label="YouTube Notes" current={noteUsage?.youtube || 0} total={getNoteLimitsForTier(userCurrentTier).youtube} />
                        </div>
                        <p className="mt-5 pt-3 border-t text-center text-xs text-theme-text-secondary border-[var(--border-primary)]">
                            Usage limits reset on {getNextMonthResetDate()}.
                        </p>
                        </>
                    )}
                </div>
            )}
             <div className="mt-6 bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                        Learning Style
                    </h2>
                    <button onClick={() => navigate('/onboarding')} className="px-3 py-1 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">
                        Retake Onboarding
                    </button>
                </div>
                {isLoadingAiContext ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[var(--bg-accent)]" /></div>
                ) : learningProfile ? (
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-theme-text-secondary flex-shrink-0">Primary Goal:</span>
                            <span className="font-medium text-[var(--text-primary)] text-right truncate">{learningProfile.goal}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-theme-text-secondary flex-shrink-0">Motivation:</span>
                            <span className="font-medium text-[var(--text-primary)] text-right truncate">{learningProfile.motivation}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-theme-text-secondary flex-shrink-0">Experience Level:</span>
                            <span className="font-medium text-[var(--text-primary)] text-right truncate">{learningProfile.experience}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-theme-text-secondary flex-shrink-0">Preferred Style:</span>
                            <span className="font-medium text-[var(--text-primary)] text-right truncate">{learningProfile.style}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-sm text-theme-text-secondary">No learning style set.</p>
                        <button onClick={() => navigate('/onboarding')} className="mt-2 text-sm font-semibold text-[var(--bg-accent)] hover:underline">
                            Set up now
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-6 bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                        Chat Styles
                    </h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                            Default Chat Style
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <select 
                                    value={defaultChatStyle || 'Normal'} 
                                    onChange={(e) => setDefaultChatStyle(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--interactive-focus)] text-[var(--text-primary)]"
                                >
                                <option value="Normal">Normal</option>
                                <option value="Formal & Professional">Formal & Professional</option>
                                <option value="Educational & Motivational">Educational & Motivational</option>
                                <option value="Casual & Friendly">Casual & Friendly</option>
                                {customStyles.map(style => (
                                    <option key={style.id} value={style.name}>{style.name}</option>
                                ))}
                            </select>
                            {defaultChatStyle !== originalDefaultChatStyle && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                </div>
                            )}
                        </div>
                            <button
                                onClick={() => handleDefaultStyleChange(defaultChatStyle || 'Normal')}
                                disabled={isSavingDefaultStyle || defaultChatStyle === originalDefaultChatStyle}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                                    isSavingDefaultStyle || defaultChatStyle === originalDefaultChatStyle
                                        ? 'bg-[var(--bg-highlight)] border border-[var(--border-primary)] cursor-not-allowed text-[var(--text-muted)]'
                                        : 'bg-[var(--bg-accent)] text-white'
                                }`}
                            >
                                {isSavingDefaultStyle ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        <p className="text-xs text-theme-text-secondary mt-1">
                            This style will be automatically applied when starting new conversations.
                        </p>
                        {defaultStyleSaved && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                                ✓ Default chat style saved successfully!
                            </p>
                        )}
                    </div>

                    <div className="border-t border-[var(--border-primary)] pt-4">
                        <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                            Reasoning
                        </label>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)]">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-[var(--bg-accent)]" />
                                    <h4 className="text-sm font-medium text-[var(--text-primary)]">Use Reasoning Model</h4>
                                    {(userCurrentTier === 'basic' || userCurrentTier === 'pro') && (
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--bg-accent)] text-[var(--text-white)]">
                                            Premium Only
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    Enables advanced reasoning for complex tasks. Uses a more powerful AI model with detailed thinking process.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={reasoningEnabled}
                                        onChange={(e) => {
                                            const newValue = e.target.checked;
                                            setReasoningEnabledState(newValue);
                                            handleReasoningChange(newValue);
                                        }}
                                        disabled={userCurrentTier !== 'premium'}
                                        className="sr-only peer"
                                    />
                                    <div className={`relative w-11 h-6 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-5 after:w-5 after:transition-all ${
                                        userCurrentTier !== 'premium' 
                                            ? 'bg-[var(--border-secondary)] cursor-not-allowed after:bg-[var(--bg-primary)] after:border-[var(--border-secondary)] after:border after:opacity-60' 
                                            : reasoningEnabled 
                                                ? 'bg-[var(--bg-accent)] after:bg-white after:border-white after:border' 
                                                : 'bg-[var(--bg-card)] after:bg-white after:border-[var(--border-primary)] after:border'
                                    }`}></div>
                                </label>
                            </div>
                        </div>

                    </div>
                    
                    <div className="border-t border-[var(--border-primary)] pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Custom Styles</h3>
                            <button 
                                onClick={() => setIsCustomStyleModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-accent)] text-white"
                            >
                                Create New Style
                            </button>
                        </div>
                        {customStyles.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {customStyles.map(style => (
                                    <div key={style.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)]">
                                        <div className="flex-1">
                                            <h4 className="text-sm font-medium text-[var(--text-primary)]">{style.name}</h4>
                                            <p className="text-xs text-theme-text-secondary">{style.description}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleEditCustomStyle(style)}
                                                className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] rounded-md"
                                            >
                                                <Edit className="w-3.5 h-3.5"/>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteCustomStyle(style.id)}
                                                className="p-1.5 text-[var(--status-error)] hover:bg-[var(--status-error)]/10 rounded-md"
                                            >
                                                <Trash2 className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-theme-text-secondary py-4 italic">
                                No custom styles created yet. Create your first custom chat style!
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] p-4 sm:p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]"><BrainCircuit className="w-5 h-5 text-[var(--text-primary)]" /> Universal Context</h2>
                        {!isEditingAiContext && (<button type="button" onClick={() => { setIsEditingAiContext(true); setAiContextError(null); }} disabled={isLoadingAiContext || isSavingAiContext} className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">Edit</button>)}
                    </div>
                    <p className="text-xs sm:text-sm text-theme-text-secondary mb-4">Provide background information that TaskMaster can always access to personalize its responses and suggestions for you.</p>
                    {aiContextError && (<div className="mb-4 p-3 rounded-lg flex items-start gap-2 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"><AlertCircle className="w-4 h-4 shrink-0 mt-px" /><p className="text-xs sm:text-sm">{aiContextError}</p></div>)}
                    {isLoadingAiContext ? (<div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[var(--bg-accent)]" /></div>)
                      : (<div className="space-y-4">
                          <div><label htmlFor="workDescription" className="block text-xs font-medium mb-1 text-theme-text-secondary">Your Role / Primary Area of Study</label><textarea id="workDescription" name="workDescription" rows={2} value={aiContextData.workDescription} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Computer Science Student at University of..." className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 resize-y text-[var(--text-primary)] placeholder-theme"/></div>
                          <div><label htmlFor="shortTermFocus" className="block text-xs font-medium mb-1 text-theme-text-secondary">Current Short-Term Focus (Next 1-4 Weeks)</label><textarea id="shortTermFocus" name="shortTermFocus" rows={2} value={aiContextData.shortTermFocus} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Preparing for mid-term exams in Algorithms and Data Structures." className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 resize-y text-[var(--text-primary)] placeholder-theme"/></div>
                          <div><label htmlFor="longTermGoals" className="block text-xs font-medium mb-1 text-theme-text-secondary">Main Long-Term Ambitions or Goals</label><textarea id="longTermGoals" name="longTermGoals" rows={2} value={aiContextData.longTermGoals} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Secure a software engineering internship for next summer, build a portfolio project." className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 resize-y text-[var(--text-primary)] placeholder-theme"/></div>
                          <div><label htmlFor="otherContext" className="block text-xs font-medium mb-1 text-theme-text-secondary">Other (Additional preferences, communication style, etc.)</label><textarea id="otherContext" name="otherContext" rows={2} value={aiContextData.otherContext} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., My preferred communication style is concise and direct. I enjoy learning through examples." className="w-full bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--interactive-focus)] disabled:opacity-60 resize-y text-[var(--text-primary)] placeholder-theme"/></div>
                                                     {isEditingAiContext && (<div className="flex justify-end gap-2 mt-5"><button type="button" onClick={handleCancelAiContextEdit} disabled={isSavingAiContext} className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">Cancel</button><button type="button" onClick={handleSaveAiContext} disabled={isSavingAiContext} className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--status-success)] text-white hover:bg-[var(--status-success)]/80 flex items-center gap-1">{isSavingAiContext ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}</button></div>)}
                      </div>)}
                </div>
            </div>
            <div className="mt-6">
                                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]"><DatabaseBackup className="w-5 h-5 text-[var(--text-primary)]" /> Memories</h2>
                    <p className="text-xs sm:text-sm text-theme-text-secondary mt-1 mb-4">Manage specific facts TaskMaster has saved from your conversations.</p>
                    {isLoadingMemories ? (<div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-[var(--bg-accent)]" /></div>)
                    : memories.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)] dark:scrollbar-thumb-[var(--scrollbar-thumb-dark)]">
                            {memories.map(memory => (
                                <div key={memory.id} className="p-3 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)]">
                                    {editingMemoryId === memory.id ? (
                                        <div className="space-y-2">
                                                                                         <textarea value={editingMemoryContent} onChange={(e) => setEditingMemoryContent(e.target.value)} className="w-full text-sm bg-[var(--bg-highlight)] border border-[var(--bg-highlight)] rounded-md p-2 focus:outline-none focus:border-[var(--bg-highlight)] text-[var(--text-primary)] selection:bg-[var(--bg-accent)] selection:text-white" rows={3} />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={handleCancelEditMemory} className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]">Cancel</button>
                                                <button onClick={handleUpdateMemory} disabled={isSavingMemory} className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--status-success)] text-white hover:bg-[var(--status-success)]/80 flex items-center gap-1">
                                                    {isSavingMemory ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="text-sm text-[var(--text-secondary)] flex-1 break-words">{memory.content}</p>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => handleEditMemory(memory)} className="p-1.5 text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)] rounded-md"><Edit className="w-3.5 h-3.5"/></button>
                                                <button onClick={() => handleDeleteMemory(memory.id)} disabled={isDeletingMemory === memory.id} className="p-1.5 text-[var(--status-error)] hover:bg-[var(--status-error)]/10 rounded-md">
                                                    {isDeletingMemory === memory.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (<p className="text-center text-sm text-theme-text-secondary py-4 italic">No memories saved yet. TaskMaster will learn as you interact.</p>)}
                </div>
            </div>
            <div className="mt-6" id="connectors-section">
                                 <div className="bg-[var(--bg-card)] shadow-lg border border-[var(--border-primary)] p-4 sm:p-5 rounded-xl">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                        Connectors
                    </h2>
                    <p className="text-xs sm:text-sm text-theme-text-secondary mt-1 mb-4">Connect your favorite apps to supercharge your learning.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)]">
                            <div className="flex items-center gap-3">
                                <NotionIcon className="w-8 h-8"/>
                                <span className="font-medium text-theme-text-primary">Notion</span>
                            </div>
                            {isNotionConnected ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--status-success)]/10 text-[var(--status-success)]">Connected</span>
                                    <button onClick={handleNotionDisconnect} disabled={isNotionDisconnecting} className="text-xs font-medium px-2 py-1 rounded-lg bg-[var(--status-error)] text-[var(--text-white)] hover:bg-[var(--status-error)]/80 disabled:opacity-50">
                                        {isNotionDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={handleNotionConnect} disabled={isNotionConnecting} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--bg-accent)] text-[var(--text-white)] hover:bg-[var(--interactive-hover)] disabled:opacity-50">
                                    {isNotionConnecting ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)]">
                                <div className="flex items-center gap-3">
                                <GoogleIcon className="w-8 h-8"/>
                                <div>
                                    <span className="font-medium text-theme-text-primary">Google</span>
                                </div>
                            </div>
                            {(isGoogleDriveConnected && isGoogleCalendarConnected) ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-[var(--status-success)]/20 text-[var(--status-success)]">Connected</span>
                                    <button onClick={handleGoogleDisconnect} disabled={isGoogleDisconnecting} className="text-xs font-medium px-2 py-1 rounded-lg bg-[var(--status-error)] text-[var(--text-white)] hover:bg-[var(--status-error)]/80 disabled:opacity-50">
                                        {isGoogleDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={handleGoogleConnect} disabled={isGoogleConnecting} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--bg-accent)] text-[var(--text-white)] hover:bg-[var(--interactive-hover)] disabled:opacity-50">
                                    {isGoogleConnecting ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </main>

      {/* Custom Style Modal */}
      {isCustomStyleModalOpen && (
        <div className="fixed inset-0 bg-theme-overlay-dark z-[90] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-[var(--bg-card)] p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-primary)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingCustomStyle ? 'Edit Custom Style' : 'Create Custom Style'}
              </h3>
              <button 
                onClick={() => {
                  setIsCustomStyleModalOpen(false);
                  setEditingCustomStyle(null);
                  setCustomStyleFormData({
                    name: '',
                    description: '',
                    prompt: '',
                    color: 'bg-[var(--bg-accent)]',
                    hoverColor: 'hover:bg-[var(--interactive-hover)]',
                    lightBg: 'bg-[var(--interactive-hover)]',
                    textColor: 'text-[var(--text-primary)]'
                  });
                }}
                className="p-1 rounded-md hover:bg-[var(--interactive-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                  Style Name 
                </label>
                <input
                  type="text"
                  value={customStyleFormData.name}
                  onChange={(e) => setCustomStyleFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--interactive-focus)] text-[var(--text-primary)] placeholder-theme"
                  placeholder="e.g., Academic Writing, Creative Writing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                  Description
                </label>
                <input
                  type="text"
                  value={customStyleFormData.description}
                  onChange={(e) => setCustomStyleFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--interactive-focus)] text-[var(--text-primary)] placeholder-theme"
                  placeholder="Brief description of this style"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                  Style Instructions
                </label>
                <textarea
                  value={customStyleFormData.prompt}
                  onChange={(e) => setCustomStyleFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--interactive-focus)] resize-y text-[var(--text-primary)] placeholder-theme"
                  placeholder="Detailed instructions for how the AI should behave with this style..."
                />
                <p className="text-xs text-theme-text-secondary mt-1">
                  Be specific about tone, language, structure, and any special requirements.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsCustomStyleModalOpen(false);
                    setEditingCustomStyle(null);
                    setCustomStyleFormData({
                      name: '',
                      description: '',
                      prompt: '',
                      color: 'bg-[var(--bg-accent)]',
                      hoverColor: 'hover:bg-[var(--interactive-hover)]',
                      lightBg: 'bg-[var(--interactive-hover)]',
                      textColor: 'text-[var(--text-primary)]'
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomStyle}
                  disabled={!customStyleFormData.name || !customStyleFormData.description || !customStyleFormData.prompt}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--bg-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingCustomStyle ? 'Update Style' : 'Create Style'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-[var(--overlay-dark)] z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-xl rounded-xl p-5 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3 text-[var(--text-primary)] flex items-center gap-2">
              {confirmAction.iconType === 'profile' && <UserProfileIcon className="w-5 h-5" />}
              {confirmAction.iconType === 'style' && <Palette className="w-5 h-5" />}
              {confirmAction.iconType === 'memory' && <DatabaseBackup className="w-5 h-5" />}
              {confirmAction.iconType === 'notion' && <NotionIcon className="w-5 h-5" />}
              {confirmAction.iconType === 'delete' && <Trash2 className="w-5 h-5" />}
              Confirm Action
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { 
                  confirmAction.onCancel?.(); 
                  setConfirmAction(null); 
                }} 
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  confirmAction.onConfirm(); 
                  setConfirmAction(null);
                }} 
                className={`px-4 py-2 text-sm font-medium rounded-lg text-[var(--text-white)] ${
                  confirmAction.actionType === 'positive' 
                    ? 'bg-[var(--status-success)] hover:bg-[var(--status-success)]/80' 
                    : 'bg-[var(--status-error)] hover:bg-[var(--status-error)]/80'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
