// src/components/FullscreenVoiceChat.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  X,
  Settings2,
  Loader2,
  AlertCircle,
  MessageCircle,
  User,
  Lock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Zap,
  Keyboard,
  ArrowUp,
  Volume2,
  VolumeX,
  Target,
  Calendar,
  Palette,
  Plus,
  Check,
  Trash2,
  Edit2
} from 'lucide-react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useTaskMasterLive, type TaskMasterLiveConfig } from '../hooks/useTaskMasterLive';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { saveChatMessage } from '../lib/ai-chat-firebase';
import { Timestamp } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { createCustomStyle, deleteCustomStyle, updateCustomStyle, onCustomStylesSnapshot, type CustomStyle } from '../lib/chat-controls-firebase';
import { CHAT_STYLES } from '../lib/chat-styles';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';

// Integration Icons
const NotionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path className="fill-black dark:fill-white" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
  </svg>
);




const GoogleDriveIcon = (props: any) => (
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

const GoogleCalendarIcon = (props: any) => (
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

// Google Service Icons
const GoogleDocsIcon = (props: any) => (
  <svg viewBox="0 0 64 88" {...props}>
    <path fill="#3086F6" d="M58,88H6c-3.3,0-6-2.7-6-6V6c0-3.3,2.7-6,6-6h36l22,22v60C64,85.3,61.3,88,58,88z"/>
    <path fill="#0C67D6" d="M42,0l22,22H42V0z"/>
    <path fill="#FDFFFF" d="M50,39H14v-5h36V39z M50,46H14v5h36V46z M40,58H14v5h26V58z"/>
  </svg>
);

const GoogleSheetsIcon = (props: any) => (
  <svg viewBox="0 0 49 67" {...props}>
    <path fill="#0F9D58" d="M29.5833333,0 L4.4375,0 C1.996875,0 0,1.996875 0,4.4375 L0,60.6458333 C0,63.0864583 1.996875,65.0833333 4.4375,65.0833333 L42.8958333,65.0833333 C45.3364583,65.0833333 47.3333333,63.0864583 47.3333333,60.6458333 L47.3333333,17.75 L36.9791667,10.3541667 L29.5833333,0 Z"/>
    <path fill="#87CEAC" d="M29.5833333,0 L47.3333333,17.75 L34.0208333,17.75 C31.5691146,17.75 29.5833333,15.7642188 29.5833333,13.3125 L29.5833333,0 Z"/>
    <path fill="#F1F1F1" d="M11.8333333,31.8020833 L11.8333333,53.25 L35.5,53.25 L35.5,31.8020833 L11.8333333,31.8020833 Z M22.1875,50.2916667 L14.7916667,50.2916667 L14.7916667,46.59375 L22.1875,46.59375 L22.1875,50.2916667 Z M22.1875,44.375 L14.7916667,44.375 L14.7916667,40.6770833 L22.1875,40.6770833 L22.1875,44.375 Z M22.1875,38.4583333 L14.7916667,38.4583333 L14.7916667,34.7604167 L22.1875,34.7604167 L22.1875,38.4583333 Z M32.5416667,50.2916667 L25.1458333,50.2916667 L25.1458333,46.59375 L32.5416667,46.59375 L32.5416667,50.2916667 Z M32.5416667,44.375 L25.1458333,44.375 L25.1458333,40.6770833 L32.5416667,40.6770833 L32.5416667,44.375 Z M32.5416667,38.4583333 L25.1458333,38.4583333 L25.1458333,34.7604167 L32.5416667,34.7604167 L32.5416667,38.4583333 Z"/>
  </svg>
);

const GmailIcon = (props: any) => (
  <svg viewBox="52 42 88 66" {...props}>
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
  </svg>
);

// Helper function to get the appropriate icon for each action type
const getActionIcon = (actionType: string) => {
  switch (actionType) {
    // Notion actions (including tool call actions)
    case 'notion':
    case 'searchNotion':
    case 'readNotionPage':
    case 'createNotionPage':
    case 'appendToNotionPage':
    case 'findAndInsertAfter':
    case 'findAndReadPageContent':
      return <NotionIcon className="w-3 h-3 flex-shrink-0" />;
    
    // Google Calendar actions
    case 'googleCalendar':
    case 'searchGoogleCalendar':
    case 'createGoogleCalendarEvent':
    case 'updateGoogleCalendarEvent':
    case 'deleteGoogleCalendarEvent':
      return <GoogleCalendarIcon className="w-3 h-3 flex-shrink-0" />;
    
    // Google Drive actions (including tool call actions)
    case 'googleDrive':
    case 'searchGoogleDrive':
    case 'listGoogleDriveFiles':
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
    case 'readGmailMessages':
      return <GoogleDriveIcon className="w-3 h-3 flex-shrink-0" />;
    
    // Note: Web search uses built-in Google Search tool
    
    // Image generation
    case 'generateImage':
      return <Zap className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--bg-accent)' }} />;
    
    // Task actions
    case 'createTask':
    case 'updateTask':
    case 'deleteTask':
      return <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--status-success)' }} />;
    
    // Goal actions
    case 'createGoal':
    case 'updateGoal':
    case 'deleteGoal':
      return <Target className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />;
    
    // Event actions
    case 'createEvent':
    case 'updateEvent':
    case 'deleteEvent':
      return <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent-secondary)' }} />;
    
    // Memory actions
    case 'saveToMemory':
    case 'updateMemory':
    case 'deleteMemory':
      return <User className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />;
    
    // Default actions
    default:
      return <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--status-success)' }} />;
  }
};

// File upload constants and interfaces (from AI-Chat.tsx)
const SUPPORTED_FILE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,text/plain,.md,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.rtf";
const MAX_FILE_SIZE_MB = 20;

// Chat styles constants
const chatStyles = CHAT_STYLES;

const CUSTOM_STYLE_COLORS = [
  { name: 'Rose', color: 'bg-rose-600', hoverColor: 'hover:bg-rose-700', lightBg: 'bg-rose-100 dark:bg-rose-500/20', textColor: 'text-rose-700 dark:text-rose-300' },
  { name: 'Sky', color: 'bg-sky-600', hoverColor: 'hover:bg-sky-700', lightBg: 'bg-sky-100 dark:bg-sky-500/20', textColor: 'text-sky-700 dark:text-sky-300' },
  { name: 'Purple', color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700', lightBg: 'bg-purple-100 dark:bg-purple-500/20', textColor: 'text-purple-700 dark:text-purple-300' },
  { name: 'Teal', color: 'bg-teal-600', hoverColor: 'hover:bg-teal-700', lightBg: 'bg-teal-100 dark:bg-teal-500/20', textColor: 'text-teal-700 dark:text-teal-300' },
  { name: 'Fuchsia', color: 'bg-fuchsia-600', hoverColor: 'hover:bg-fuchsia-700', lightBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', textColor: 'text-fuchsia-700 dark:text-fuchsia-300' },
  { name: 'Lime', color: 'bg-lime-600', hoverColor: 'hover:bg-lime-700', lightBg: 'bg-lime-100 dark:bg-lime-500/20', textColor: 'text-lime-700 dark:text-lime-300' },
  { name: 'Orange', color: 'bg-orange-600', hoverColor: 'hover:bg-orange-700', lightBg: 'bg-orange-100 dark:bg-orange-500/20', textColor: 'text-orange-700 dark:text-orange-300' },
  { name: 'Pink', color: 'bg-pink-600', hoverColor: 'hover:bg-pink-700', lightBg: 'bg-pink-100 dark:bg-pink-500/20', textColor: 'text-pink-700 dark:text-pink-300' },
  { name: 'Stone', color: 'bg-stone-600', hoverColor: 'hover:bg-stone-700', lightBg: 'bg-stone-100 dark:bg-stone-500/20', textColor: 'text-stone-700 dark:text-stone-300' },
  { name: 'Yellow', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600', lightBg: 'bg-yellow-100 dark:bg-yellow-500/20', textColor: 'text-yellow-700 dark:text-yellow-300' },
  { name: 'Green', color: 'bg-green-600', hoverColor: 'hover:bg-green-700', lightBg: 'bg-green-100 dark:bg-green-500/20', textColor: 'text-green-700 dark:text-green-300' },
  { name: 'Blue', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700', lightBg: 'bg-blue-100 dark:bg-blue-500/20', textColor: 'text-blue-700 dark:text-blue-300' },
];

const { name: _name, ...defaultColorProps } = CUSTOM_STYLE_COLORS[0];
const DEFAULT_CUSTOM_COLOR_PROPS = defaultColorProps;

interface SelectedFile { 
  name: string; 
  type: string; 
  size: number; 
  base64Data: string; 
  fileObject: File; 
  localPreviewUrl: string; 
}

// File reading function (from AI-Chat.tsx)
const readFileAsSelectedFile = (file: File): Promise<SelectedFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const localPreviewUrl = URL.createObjectURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data: base64String,
        fileObject: file,
        localPreviewUrl
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

// Utility functions (copied from AI-Chat.tsx)
const toDateSafe = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    try {
      return new Timestamp(value.seconds, value.nanoseconds).toDate();
    } catch (e) { console.warn("toDateSafe error converting object:", e); return null; }
  }
  return null;
};

const calculatePriority = (itemInput: any): 'high' | 'medium' | 'low' => {
  const itemData = itemInput?.data || itemInput;
  if (!itemData) return 'low';
  if (itemData.priority) return itemData.priority;
  if (!itemData.dueDate && !itemData.targetDate) return 'low';
  let itemDateToConsider: Date | Timestamp | null = itemData.dueDate || itemData.targetDate;
  let dueDate: Date | null = null;
  if (itemDateToConsider && typeof itemDateToConsider === 'object' && 'toDate' in itemDateToConsider) { 
    dueDate = (itemDateToConsider as Timestamp).toDate(); 
  }
  else if (itemDateToConsider instanceof Date) { dueDate = itemDateToConsider; }
  else if (typeof itemDateToConsider === 'string' || typeof itemDateToConsider === 'number') {
    try { dueDate = new Date(itemDateToConsider); if (isNaN(dueDate.getTime())) dueDate = null; }
    catch (e) { dueDate = null; }
  }
  if (!dueDate) return 'low';
  const now = new Date();
  const dueDateNormalized = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const nowDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = dueDateNormalized.getTime() - nowDateNormalized.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'high';
  if (diffDays <= 1) return 'high';
  if (diffDays <= 3) return 'medium';
  return 'low';
};

interface FullscreenVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  conversationId?: string;
  onMessage?: (message: any) => void;
  onTranscription?: (text: string, isUser: boolean) => void;
  // User contextual data for voice mode
  userProfile?: any;
  userContext?: any;
  tasks?: any[];
  goals?: any[];
  events?: any[];
  memories?: any[];
  activePrompt?: string;
  isNotionConnected?: boolean;
  isGoogleConnected?: boolean;
  isForceSearchModeActive?: boolean;
  isNotionSearchModeActive?: boolean;
  isImageGenModeActive?: boolean;
  // Chat history context for voice mode
  chatHistory?: any[];
}

export const FullscreenVoiceChat: React.FC<FullscreenVoiceChatProps> = ({
  isOpen,
  onClose,
  user,
  conversationId,
  onMessage,
  onTranscription,
  // User contextual data
  userProfile,
  userContext,
  tasks = [],
  goals = [],
  events = [],
  memories = [],
  activePrompt,
  isNotionConnected = false,
  isGoogleConnected = false,
  isForceSearchModeActive = false,
  isNotionSearchModeActive = false,
  isImageGenModeActive = false,
  chatHistory = []
}) => {
  const {
    isConnected,
    isConnecting,
    isRecording,
    isAISpeaking,
    messages,
    error,
    completedActions,
    isProcessingActions,
    connect,
    disconnect,
    sendText,
    startRecording,
    stopRecording,
    stopAudio,
    clearMessages,
    clearCompletedActions,
    createVoiceSample
  } = useTaskMasterLive();

  // Speech recognition hook (same as AI-Chat.tsx)
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isTextProcessing, setIsTextProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [isLoadingOnboardingStatus, setIsLoadingOnboardingStatus] = useState(true);
  const [showVoiceSelection, setShowVoiceSelection] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAutoReactivating, setIsAutoReactivating] = useState(false);
  const [isSettingsVoiceSelection, setIsSettingsVoiceSelection] = useState(false);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(2); // Start with Kore (warm and engaging voice)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [activeNotionPage, setActiveNotionPage] = useState<{ id: string; title: string } | null>(null);
  const [playingVoiceSample, setPlayingVoiceSample] = useState<string | null>(null);
  const [completionNotification, setCompletionNotification] = useState<{id: string, message: string} | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [currentActivePrompt, setCurrentActivePrompt] = useState<string>(activePrompt || '');
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<CustomStyle | null>(null);
  const [styleFormData, setStyleFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    ...DEFAULT_CUSTOM_COLOR_PROPS,
  });
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);

  const voicePreferenceSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoReconnectAttempts, setAutoReconnectAttempts] = useState(0);
  const autoReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [config, setConfig] = useState<TaskMasterLiveConfig>({
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Kore'
        }
      }
    },
    systemInstruction: '', // Will be set when connecting
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        silenceDurationMs: 800
      }
    }
  });

  const animationRef = useRef<number>();

  // Helper function to format user items for voice chat context
  const formatItemsForVoiceChat = (): string => {
    if (!user) return "User data not available.";
    const truncatedName = user.displayName?.split(' ')[0] || 'User';
    const lines: string[] = [`Current items for ${truncatedName}:\n`];
    
    const formatLine = (item: any, type: string, nameField: string, dateField: string, colorField?: string) => {
      const name = item.data[nameField] || 'Untitled';
      const dateValue = item.data[dateField];
      let itemDate: Date | null = toDateSafe(dateValue);
      let detailsString = '';
      
      if (itemDate && !isNaN(itemDate.getTime())) {
        const dateStr = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = (itemDate.getHours() === 0 && itemDate.getMinutes() === 0) ? '' : ' ' + itemDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        detailsString += ` (${type === 'Event' ? 'Starts' : 'Due'}: ${dateStr}${timeStr})`;
      }
      
      if (type === 'Event' && item.data.endDate) {
        let endDateVal: Date | null = toDateSafe(item.data.endDate);
        if (endDateVal && !isNaN(endDateVal.getTime())) {
          const endDateStr = endDateVal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endTimeStr = (endDateVal.getHours() === 0 && endDateVal.getMinutes() === 0 && endDateVal.toLocaleDateString() === itemDate?.toLocaleDateString()) ? '' : ' ' + endDateVal.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          detailsString += ` to ${endDateStr}${endTimeStr}`;
        }
      }
      
      if (type !== 'Event') { 
        detailsString += ` [Priority: ${calculatePriority(item)}]`; 
      }
      if (item.data.recurring) { 
        detailsString += ` [Recurs ${item.data.recurrenceType}]`; 
      }
      
      const completed = item.data.completed ? '[Completed]' : '[Pending]';
      detailsString += ` ${completed}`;
      
      if (type === 'Event' && colorField && item.data[colorField]) { 
        detailsString += ` [Color: ${item.data[colorField]}]`; 
      }
      
      return `${type}: ${name}${detailsString}`;
    };

    [...tasks.map(t => ({ item: t, type: 'Task' })), ...goals.map(g => ({ item: g, type: 'Goal' })), ...events.map(e => ({ item: e, type: 'Event' }))]
      .filter(({ item, type }) => {
        if (type === 'Event') {
          const endDate = item.data.endDate instanceof Date ? item.data.endDate : (item.data.endDate?.toDate ? item.data.endDate.toDate() : new Date(item.data.endDate || 0));
          return endDate >= new Date() && !item.data.completed;
        }
        return !item.data.completed;
      })
      .forEach(({ item, type }) => {
        if (type === 'Task') lines.push(formatLine(item, 'Task', 'task', 'dueDate'));
        else if (type === 'Goal') lines.push(formatLine(item, 'Goal', 'goal', 'targetDate'));
        else if (type === 'Event') lines.push(formatLine(item, 'Event', 'name', 'startDate', 'color'));
      });
    
    if (lines.length === 1) return `No active tasks, goals, or upcoming non-completed events found for ${truncatedName}.`;
    return lines.join('\n');
  };

  // Build comprehensive voice mode system instruction
  const buildVoiceSystemInstruction = (): string => {
    const truncatedName = user?.displayName?.split(' ')[0] || 'User';
    const memoryContext = memories.length > 0 ? `User's Memories:\n${memories.map(m => `- [ID: ${m.id}] ${m.content}`).join('\n')}` : 'User has no saved memories.';
    
    // Format recent chat history for context (exclude voice chat ended messages and limit to last 10 messages)
    const recentChatHistory = chatHistory
      .filter(msg => !msg.isVoiceChatEnded && msg.content?.trim()) // Filter out voice chat ended messages and empty content
      .slice(-10) // Get last 10 messages
      .map(msg => `${msg.role === 'user' ? truncatedName : 'Assistant'}: ${msg.content?.substring(0, 500) || ''}`) // Truncate long messages
      .join('\n');
    
    const chatHistoryContext = recentChatHistory ? 
      `\n// =================================================================================================\n// [RECENT CONVERSATION CONTEXT]\n// =================================================================================================\nHere's the recent conversation history from our text chat before switching to voice mode:\n\n${recentChatHistory}\n\nContinue this conversation naturally in voice mode. Reference previous topics and context as appropriate.` : 
      '';
    
    return `// =================================================================================================
// [CORE IDENTITY & MISSION - VOICE MODE]
// =================================================================================================
You are TaskMaster, a friendly, encouraging, and highly intelligent productivity and learning assistant.
Your primary mission is to help ${truncatedName} manage their tasks, goals, learning, and general productivity with precision and empathy through NATURAL VOICE CONVERSATION.

THIS IS VOICE MODE - YOU ARE SPEAKING TO THE USER, NOT TYPING TO THEM.

${currentActivePrompt || 'Respond in a standard, helpful manner.'}

If asked who made you, say: "I was created by a team of developers at TaskMaster Inc."
You are an AGENT that can take action: creating and updating tasks, goals, events, flashcards, quizzes, folders, focus sessions, and notes.

    // =================================================================================================
// [CRITICAL VOICE MODE RULES]
    // =================================================================================================

**MOST IMPORTANT RULE - VOICE RESPONSE FORMAT:**
THIS IS CRITICAL: YOU ARE IN VOICE MODE. THE USER CAN ONLY HEAR YOUR WORDS, NOT SEE TEXT.

When the user asks you to take an action (create task, goal, event, search, generate image, etc.), you MUST:

**REQUIRED FORMAT**: Conversational response + JSON action block
User: "Add a task to study for my math exam tomorrow"  
Your Response: "Got it, I'll add that task for you.

\`\`\`json
{"action": "createTask", "payload": {"task": "Study for math exam", "dueDate": "2024-01-16"}}
\`\`\`"

**ULTRA-CRITICAL**: End your spoken response BEFORE the JSON block. The JSON should be completely separate from your voice.

**ABSOLUTE VOICE TERMINATION RULES**:
- STOP SPEAKING completely before writing ANY JSON
- NEVER say "JSON", "action", "payload", or any technical terms
- NEVER read curly braces { } aloud
- NEVER read quotation marks aloud
- NEVER read backslashes aloud
- NEVER say "let me create this" or "here's the JSON"
- COMPLETE your sentence, THEN write JSON silently
- If you say you'll do something, you MUST include the corresponding JSON

**ABSOLUTE RULE**: VOICE STOPS → JSON STARTS. These are SEPARATE processes.
    
    // =================================================================================================
// [VOICE CONVERSATION STYLE]
    // =================================================================================================
- Keep spoken responses SHORT and NATURAL (1-3 sentences maximum)
- Sound like you're having a friendly conversation, not reading a manual
- Use contractions ("I'll", "you're", "let's") to sound more natural
- Confirm actions briefly: "Got it", "Sure thing", "I'll take care of that"
- Be encouraging: "Great choice!", "You've got this!", "That sounds like a solid plan"
- Never read out lists or data dumps - summarize naturally
- For memory saves: "I'll remember that" or "Got it, saved"
    
// [A. USER & SESSION CONTEXT]
- User's Name: ${truncatedName}
- User's Progress: Level ${userProfile?.level || 1}, Points: ${userProfile?.points || 0}, Streak: ${userProfile?.overallStreakCount || 0} days. Badges: ${(userProfile?.badges || []).length}.
- Current Date & Time: ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
- User's General Profile (if provided):
  - Work/Study Area: ${userContext?.workDescription || 'Not specified'}
  - Short-term Focus: ${userContext?.shortTermFocus || 'Not specified'}
  - Long-term Learning Goals: ${userContext?.longTermGoals || 'Not specified'}
  - Additional Notes: ${userContext?.otherContext || 'Not specified'}
  - Notion Integration: ${isNotionConnected ? 'Connected' : 'Not Connected'}
  - Google Workspace Integration: ${isGoogleConnected ? 'Connected' : 'Not Connected'}

${isForceSearchModeActive ? '\n**🔍 SEARCH MODE ACTIVE**: The user has enabled search mode. You MUST perform web searches for this query regardless of whether you think it\'s necessary. Always search when this mode is active.' : ''}${isNotionSearchModeActive ? '\n**📝 NOTION SEARCH MODE ACTIVE**: The user has enabled Notion search mode. Focus on searching and interacting with their Notion workspace.' : ''}${isImageGenModeActive ? '\n**🎨 IMAGE GENERATION MODE ACTIVE**: The user has enabled image generation mode. Focus on creating, editing, or describing images. REMEMBER: You cannot generate images directly - delegate to the image service via JSON actions.' : ''}${chatHistoryContext}
    
Dashboard Items:
    ${formatItemsForVoiceChat()}  
    
Private Memories (context only - don't reveal unless asked):
    ${memoryContext}
    
    // =================================================================================================
// [ACTION DECISION FLOW]
    // =================================================================================================
1. **Search/Information Requests** → Use built-in Google Search or code execution naturally
2. **Notion Content Requests**: ${isNotionConnected ? 'Use searchNotion() or readNotionPage() function calls' : 'Tell user to connect in Settings'}
3. **Google Workspace Requests**: ${isGoogleConnected ? 'Use Google Calendar and Drive function calls' : 'Tell user to connect in Settings'}
4. **Task/Goal/Event Management** → Use JSON actions (createTask, createGoal, etc.)
5. **Memory Management** → Use JSON actions (saveToMemory, etc.)
6. **General Chat** → Natural conversational response only


FOR NOTION:

Notion createNotionPage error: FirebaseError: A 'title' is required. TO ENSURE THIS ERROR DOENST SHOW UP, ALWAYS INCLUDE A TITLE. IF THEY ASK YOU TO CREATE A PAGE, ALWAYS INCLUDE A TITLE.



**CRITICAL**: Use function calls for content access, JSON actions for data management!

**GOOGLE DRIVE FOLDER OPERATIONS - STEP BY STEP**:
1. **User gives folder URL**: Extract folder ID from URL (the part after "folders/")
2. **User mentions folder name**: Use findFolder to get the folder ID first
3. **Then use folder ID**: With listFilesAndFolders or searchGoogleDrive
4. **NEVER say you can't access folders** - you CAN with the right workflow!

**EXAMPLE**: User says "search for police report in https://drive.google.com/folders/ABC123"
- Extract folder ID: ABC123
- Use: searchGoogleDrive with folderId: "ABC123" and query: "police report"
    
    // =================================================================================================
// [WEB SEARCH PROTOCOL - VOICE MODE]
    // =================================================================================================
**CORE PRINCIPLE**: You have continuous access to web search with both automatic intelligence and user force options.

**SEARCH MODES**:
1. **AUTO-SEARCH (Default)**: Use your intelligent judgment to determine when fresh information would benefit the user
2. **SEARCH MODE**: When the user has explicitly enabled search mode, ALWAYS perform web searches regardless of your judgment

**INTELLIGENT DECISION MAKING (Auto-Search Mode)**:
- **ALWAYS SEARCH** for: Current events, recent news, real-time data, trending topics, specific facts you're unsure about, recent technology/product updates, location-based queries
- **CONSIDER SEARCHING** for: Definitions of new terms, specific statistics, academic research, product reviews, troubleshooting guides
- **DON'T SEARCH** for: General knowledge questions you can answer confidently, philosophical discussions, personal advice, creative writing, coding help (unless about very recent frameworks)

**SEARCH MODE**: When search is enabled, you MUST perform web searches for ANY user query, even if you could answer from existing knowledge.

**SEARCH EXECUTION**:
- Automatically use your search tool when determined necessary - no need to ask permission
- For voice mode: Give conversational response first, then search if needed
- Example: "Let me check the latest information for you." → [performs search] → "Based on the latest data..."

**ERROR HANDLING FOR INTEGRATIONS**:
- If Notion/Google actions fail due to technical issues, acknowledge the failure gracefully
- Example: "I'm having trouble connecting to your Notion right now. Please try again in a moment."
- Don't keep retrying failed actions - inform user and suggest alternatives
    
    // =================================================================================================
// [AVAILABLE TOOLS & CAPABILITIES]
    // =================================================================================================

**Built-in Tools (use naturally):**
- **Google Search**: For current information, facts, news - just search when needed
- **Code Execution**: For calculations, data analysis - just ask for computations

**Function Calls Available:**
${isNotionConnected ? `- **searchNotion(query)**: Search user's Notion workspace - returns full page listings (DO NOT use for calendar queries)
- **readNotionPage(pageTitle)**: Read complete Notion page content (NO TRUNCATION, DO NOT use for calendar queries)` : `- Notion functions not available (not connected)`}
${isGoogleConnected ? `- **listGoogleDriveFiles(query)**: List files in Google Drive with search (includes folders)
- **readGoogleDriveFile(fileName)**: Read Google Drive file content by name (searches automatically)
- **FOLDER NAVIGATION**: You can search within specific folders and navigate the folder structure` : `- Google Workspace functions not available (not connected)`}

**Manual Actions (use JSON for productivity management):**
- createTask: {"action": "createTask", "payload": {"task": "string", "dueDate": "YYYY-MM-DD", "priority": "low|medium|high"}}
- createGoal: {"action": "createGoal", "payload": {"goal": "string", "targetDate": "YYYY-MM-DD", "priority": "low|medium|high"}}
- createEvent: {"action": "createEvent", "payload": {"event_name": "string", "start_date": "YYYY-MM-DD", "start_time": "HH:MM", "end_date": "YYYY-MM-DD", "end_time": "HH:MM", "description": "string"}}
  * SMART DEFAULTS: If no dates/times provided, uses today at noon for 1 hour duration
  * FLEXIBLE: Accepts partial date/time info and fills in reasonable defaults
- saveToMemory: {"action": "saveToMemory", "payload": {"content": "string"}}
- generateImage: {"action": "generateImage", "payload": {"prompt": "detailed image description"}}
${isGoogleConnected ? `
**Google Workspace Creation & Editing (use JSON):**
- createGoogleDoc: {"action": "createGoogleDoc", "payload": {"title": "string", "content": "full document content in markdown or plain text"}}
- updateGoogleDoc: {"action": "updateGoogleDriveFile", "payload": {"fileName": "document name", "content": "new content to replace existing", "fileId": "optional file ID"}}
- createGoogleSheet: {"action": "createGoogleSheet", "payload": {"name": "string", "initialData": [["Header1", "Header2"], ["Data1", "Data2"]], "worksheetTitle": "optional sheet name"}}
- updateGoogleSheet: {"action": "updateGoogleDriveFile", "payload": {"fileName": "sheet name", "sheetData": [["new", "data"], ["row2", "col2"]], "worksheetTitle": "optional sheet to update"}}
- createGoogleSlides: {"action": "createGoogleSlides", "payload": {"title": "string", "slides": [{"title": "Slide 1", "content": "slide content"}, {"title": "Slide 2", "content": "more content"}]}}
- updateGoogleSlides: {"action": "updateGoogleDriveFile", "payload": {"fileName": "presentation name", "slides": [{"title": "Updated Slide", "content": "new content"}]}}
- createDriveFolder: {"action": "createDriveFolder", "payload": {"name": "string", "parentId": "optional parent folder ID"}}

**Google Drive Folder Operations (use JSON):**
- findFolder: {"action": "findFolder", "payload": {"query": "folder name to search for"}}
- searchGoogleDrive: {"action": "searchGoogleDrive", "payload": {"query": "search term", "folderId": "optional folder ID to search within"}}
- listFilesAndFolders: {"action": "listFilesAndFolders", "payload": {"folderId": "optional folder ID to browse"}}

**Gmail Operations (use JSON):**
- sendGmail: {"action": "sendGmail", "payload": {"to": "email@example.com", "subject": "subject", "body": "full email content with formatting", "cc": "optional", "bcc": "optional", "attachments": "optional file IDs"}}
- replyToGmail: {"action": "replyToGmail", "payload": {"messageId": "message ID to reply to", "body": "reply content", "replyAll": false}}
- forwardGmail: {"action": "forwardGmail", "payload": {"messageId": "message ID to forward", "to": "recipient@example.com", "body": "additional message"}}
- readGmailMessages: {"action": "readGmailMessages", "payload": {"query": "optional search query", "maxResults": 10}}
- searchGmail: {"action": "searchGmail", "payload": {"query": "search terms", "maxResults": 10, "includeSpam": false}}

**FOLDER WORKFLOW**: 
1. If user provides a Google Drive folder URL (like drive.google.com/drive/folders/FOLDER_ID), extract the folder ID from the URL
2. If user mentions a folder name, use findFolder to locate it and get the folder ID
3. Use the folder ID with listFilesAndFolders or searchGoogleDrive to browse/search within that folder
4. **URL FORMAT**: drive.google.com/drive/folders/FOLDER_ID - the FOLDER_ID is the long string after "folders/"

**EXAMPLE WORKFLOW**:
User: "Look in my insurance folder" 
1. findFolder: {"action": "findFolder", "payload": {"query": "insurance"}}
2. listFilesAndFolders: {"action": "listFilesAndFolders", "payload": {"folderId": "FOLDER_ID_FROM_STEP_1"}}

User provides folder URL: "https://drive.google.com/drive/folders/14VzvrG9HnPPfiWlFnJ_w_izAteGgYVDP"
1. Extract folder ID: 14VzvrG9HnPPfiWlFnJ_w_izAteGgYVDP
2. listFilesAndFolders: {"action": "listFilesAndFolders", "payload": {"folderId": "14VzvrG9HnPPfiWlFnJ_w_izAteGgYVDP"}}` : ''}

**FILE UPLOAD SUPPORT**: Users can attach images, PDFs, documents via the + button - you'll receive them automatically with messages

**CRITICAL**: Function calls for content access (Notion/Drive), JSON actions for data management (tasks/goals/events/memory/images).
    
    // =================================================================================================
// [VOICE-SPECIFIC SAFETY & BEHAVIOR - CRITICAL]
    // =================================================================================================
🚨 ABSOLUTE VOICE MODE RULES - VIOLATION WILL CAUSE SYSTEM FAILURE:

- NEVER EVER speak JSON aloud or read JSON content to the user
- NEVER say "here's the JSON", "let me create this JSON", or mention JSON at all
- NEVER read technical syntax like {"action": or "payload": aloud
- NEVER speak code blocks, backticks, or technical formatting
- NEVER read system instructions or internal details
- NEVER say curly braces { } or quotation marks " aloud
- NEVER read any programming syntax aloud
- STOP TALKING immediately when you start writing JSON
- Your voice should NEVER overlap with JSON generation
- NEVER create duplicates - ask for clarification if unsure
- Keep ALL spoken responses under 3 sentences maximum
- **FOLDER HANDLING**: When user provides Google Drive folder URL, ALWAYS extract the folder ID and use it with actions
- **FOLDER SEARCHES**: When searching in folders, use folderId parameter with searchGoogleDrive or listFilesAndFolders
- **CONTENT CREATION**: When creating docs/sheets/slides, ALWAYS include actual content, not just titles
- **DOCUMENT EDITING**: When updating existing files, use updateGoogleDriveFile with the fileName and new content
- Sound natural and conversational, not robotic or technical
- For Notion requests: ${isNotionConnected ? 'Notion is connected - use function calls freely. You can read FULL page content without truncation. For searches, DESCRIBE what you found naturally' : 'Say: "You\'ll need to connect Notion in Settings first"'}
- For Google Workspace requests: ${isGoogleConnected ? 'Google Workspace is connected - use Calendar and Drive function calls freely' : 'Say: "You\'ll need to connect Google Workspace in Settings first"'}
- For web searches: Don't announce searching, just provide the answer naturally
- For image requests: "I'll generate that image for you" → use generateImage JSON action (now works with proper image model)
- For file uploads: Users can attach images, PDFs, docs via + button - you receive them automatically
- CRITICAL: You (voice model) cannot generate images directly - always use generateImage JSON action
- VOICE TERMINATION: Complete your spoken response BEFORE any JSON. Never speak while generating JSON.
- FEEDBACK PREVENTION: Never process your own voice output as input - system prevents audio feedback loops

REMEMBER: You are having a SPOKEN CONVERSATION. Users cannot see text - they only hear your voice.

// =================================================================================================
// [RESPONSE EXAMPLES - VOICE MODE]
// =================================================================================================

**NEW CAPABILITIES EXAMPLES:**

*Event Creation with Smart Defaults:*
User: "Create an event called Friends Hangout"
You: "I'll create that event for you."
(System automatically uses today at noon for 1 hour duration)

*Notion Content Reading (Full Content):*
User: "Read my AP Environmental Science notes"
You: "I'll pull up those notes for you."
(Uses readNotionPage function call - returns complete content without truncation)

*Google Drive File Access:*
User: "Read my meeting notes document"  
You: "Let me find and read that document for you."
(Uses readGoogleDriveFile function call - automatically searches by filename)

*File Upload Processing:*
User: [uploads image] "What's in this picture?"
You: "I can see the image you uploaded. Let me analyze it for you."
(System automatically receives uploaded files with messages)

*Image Generation:*
User: "Generate an image of a sunset over mountains"
You: "I'll create that image for you."
(Uses generateImage JSON action with proper image model)

*Google Workspace Creation:*
User: "Create a Google Doc for my essay"
You: "I'll create that Google Doc for you."
(Uses createGoogleDoc JSON action)

User: "Make a spreadsheet for my budget"
You: "I'll create that spreadsheet for you."
(Uses createGoogleSheet JSON action)

User: "Create a presentation for my project"
You: "I'll create that presentation for you."
(Uses createGoogleSlides JSON action)

User: "Create a folder called School Work"
You: "I'll create that folder for you."
(Uses createDriveFolder JSON action)

User: "Find my Documents folder"
You: "Let me search for that folder."
(Uses findFolder JSON action)

User: "Send an email to john@example.com about the meeting"
You: "I'll send that email for you."
(Uses sendGmail JSON action)

User: "Check my recent emails"
You: "Let me check your recent emails."
(Uses readGmailMessages JSON action)

User: "List files in my Projects folder"
You: "I'll show you what's in your Projects folder."
(First uses findFolder to get folder ID, then listFilesAndFolders with folderId)

User: "Search for police report in this folder: https://drive.google.com/drive/folders/ABC123"
You: "I'll search for the police report in that folder."
(Extracts folder ID ABC123, then uses searchGoogleDrive with folderId and query)

User: "What's in my insurance folder?"
You: "Let me see what's in your insurance folder."
(Uses findFolder for "insurance", then listFilesAndFolders with the found folder ID)

User: "Search for my resume in the Documents folder"
You: "Let me look for your resume in the Documents folder."
(Uses enhanced searchDrive with folder-specific search)

**CONTENT CREATION & EDITING EXAMPLES:**

User: "Create a Google Doc with my meeting notes from today"
You: "I'll create that document with your meeting notes."
(Uses createGoogleDoc with title and full content)

User: "Update my project plan document with the new timeline"
You: "I'll update your project plan with the new information."
(Uses updateGoogleDriveFile to edit existing document content)

User: "Make a spreadsheet tracking my expenses with categories"
You: "I'll create that expense tracking spreadsheet for you."
(Uses createGoogleSheet with headers and initial data structure)

User: "Add this week's data to my budget spreadsheet"
You: "I'll add the new data to your budget spreadsheet."
(Uses updateGoogleDriveFile to append data to existing sheet)

User: "Create a presentation about our Q4 results with 5 slides"
You: "I'll create that presentation with your Q4 results."
(Uses createGoogleSlides with multiple slides and content)

User: "Send an email to the team about tomorrow's meeting with the agenda"
You: "I'll send that email with the meeting agenda."
(Uses sendGmail with detailed body content and proper formatting)

✅ CORRECT VOICE RESPONSES:

User: "Create a task to call mom tomorrow"
Response: "I'll add that task for you."
[VOICE STOPS HERE - JSON BELOW IS SILENT]
\`\`\`json
{"action": "createTask", "payload": {"task": "Call mom", "dueDate": "2024-01-16"}}
\`\`\`
(User hears: "I'll add that task for you." - JSON processed silently)

User: "Remember that I have piano lessons on Wednesdays"  
Response: "Got it, I'll remember that."
[VOICE STOPS HERE - JSON BELOW IS SILENT]
\`\`\`json
{"action": "saveToMemory", "payload": {"content": "Piano lessons on Wednesdays"}}
\`\`\`
(User hears: "Got it, I'll remember that." - JSON processed silently)

User: "Search for the latest news about AI"
Response: "Based on the latest information, here are the key AI developments..." 
(Uses built-in Google Search automatically - no JSON needed)

User: "Search my Notion for meeting notes"
Response: "I found 3 pages in your Notion workspace related to meeting notes: Weekly Team Meeting, Client Strategy Meeting, and Project Kickoff Meeting."
[VOICE STOPS HERE - JSON BELOW IS SILENT]
\`\`\`json
{"type": "notion", "action": "searchNotion", "payload": {"query": "meeting notes"}}
\`\`\`
(User hears the description of results - JSON processed silently)

User: "Create an image of a sunset over mountains"
Response: "I'll generate that image for you."
[VOICE STOPS HERE - JSON BELOW IS SILENT]
\`\`\`json
{"action": "generateImage", "payload": {"prompt": "sunset over mountains", "style": "photorealistic"}}
\`\`\`
(User hears: "I'll generate that image for you." - JSON processed silently)

User: "How's the weather today?"
Response: "It's looking like a sunny day with temperatures around 72 degrees."
(No action needed - just conversational response, no JSON required)

❌ WRONG - NEVER DO THIS:
User: "Create a task"
WRONG Response: "I'll create a task. Here's the JSON: action create task payload..."
WRONG Response: "Let me generate the JSON for you..."
WRONG Response: Reading any technical syntax aloud
WRONG Response: "I'll add that task for you." (WITHOUT the JSON block - this won't work!)

🚨 CRITICAL: If you say you'll perform an action, you MUST include the JSON block or the action won't happen!

Your goal is to be ${truncatedName}'s perfect voice assistant - natural, helpful, and action-oriented.`;
  };    

  // Firestore functions for voice onboarding status
  const getVoiceOnboardingStatus = async (userId: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.hasUsedVoiceMode || false;
      }
      return false;
    } catch (error) {
      console.error('Error fetching voice onboarding status:', error);
      // Fallback to localStorage
      return !!localStorage.getItem('hasUsedVoiceMode');
    }
  };

  const setVoiceOnboardingStatus = async (userId: string, hasUsed: boolean): Promise<void> => {
    try {
      const userDocRef = doc(db, 'users', userId);
      // Use setDoc with merge to handle race conditions gracefully
      await setDoc(userDocRef, {
        hasUsedVoiceMode: hasUsed,
        voiceModeFirstUsedAt: hasUsed ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Also update localStorage as backup
      if (hasUsed) {
        localStorage.setItem('hasUsedVoiceMode', 'true');
      } else {
        localStorage.removeItem('hasUsedVoiceMode');
      }
    } catch (error) {
      console.error('Error setting voice onboarding status:', error);
      // Fallback to localStorage only
      if (hasUsed) {
        localStorage.setItem('hasUsedVoiceMode', 'true');
      } else {
        localStorage.removeItem('hasUsedVoiceMode');
      }
    }
  };

  // Functions for managing voice preference
  const getUserVoicePreference = async (userId: string): Promise<string | null> => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.preferredVoice || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching voice preference:', error);
      // Fallback to localStorage
      return localStorage.getItem('preferredVoice');
    }
  };

  const saveUserVoicePreference = async (userId: string, voiceName: string, retryCount = 0): Promise<void> => {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        preferredVoice: voiceName,
        voicePreferenceUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Also update localStorage as backup
      localStorage.setItem('preferredVoice', voiceName);
    } catch (error: any) {
      // Handle Firestore conflicts with retry logic
      if (error.code === 'failed-precondition' && retryCount < 3) {
        // Wait a bit and retry (exponential backoff)
        const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
        setTimeout(async () => {
          await saveUserVoicePreference(userId, voiceName, retryCount + 1);
        }, delay);
        return;
      }
      
      console.error('Error saving voice preference:', error);
      // Fallback to localStorage only
      localStorage.setItem('preferredVoice', voiceName);
    }
  };

  // Debounced voice preference saver to prevent conflicts
  const debouncedSaveVoicePreference = (userId: string, voiceName: string) => {
    // Clear existing timer
    if (voicePreferenceSaveTimerRef.current) {
      clearTimeout(voicePreferenceSaveTimerRef.current);
    }
    
    // Update localStorage immediately for responsive UI
    localStorage.setItem('preferredVoice', voiceName);
    
    // Debounce Firestore save by 1 second
    voicePreferenceSaveTimerRef.current = setTimeout(async () => {
      await saveUserVoicePreference(userId, voiceName);
    }, 1000);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Load onboarding status and voice preference when user changes
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (currentUser) {
        setIsLoadingOnboardingStatus(true);
        try {
          // Load onboarding status
          const hasUsed = await getVoiceOnboardingStatus(currentUser.uid);
          setIsFirstTimeUser(!hasUsed);

          // Load voice preference
          const savedVoice = await getUserVoicePreference(currentUser.uid);
          if (savedVoice) {
            const voices = getOnboardingVoices();
            const voiceIndex = voices.findIndex(voice => voice.id === savedVoice);
            if (voiceIndex !== -1) {
              setSelectedVoiceIndex(voiceIndex);
              updateVoice(savedVoice);
            }
          }
        } catch (error) {
          console.error('Error loading user preferences:', error);
          // Fallback to localStorage
          setIsFirstTimeUser(!localStorage.getItem('hasUsedVoiceMode'));
          const savedVoice = localStorage.getItem('preferredVoice');
          if (savedVoice) {
            const voices = getOnboardingVoices();
            const voiceIndex = voices.findIndex(voice => voice.id === savedVoice);
            if (voiceIndex !== -1) {
              setSelectedVoiceIndex(voiceIndex);
              updateVoice(savedVoice);
            }
          }
        } finally {
          setIsLoadingOnboardingStatus(false);
        }
      } else {
        // No user, fallback to localStorage
        setIsFirstTimeUser(!localStorage.getItem('hasUsedVoiceMode'));
        const savedVoice = localStorage.getItem('preferredVoice');
        if (savedVoice) {
          const voices = getOnboardingVoices();
          const voiceIndex = voices.findIndex(voice => voice.id === savedVoice);
          if (voiceIndex !== -1) {
            setSelectedVoiceIndex(voiceIndex);
            updateVoice(savedVoice);
          }
        }
        setIsLoadingOnboardingStatus(false);
      }
    };

    loadUserPreferences();
  }, [currentUser]);

  // Sync currentActivePrompt with prop changes
  useEffect(() => {
    if (activePrompt !== undefined) {
      setCurrentActivePrompt(activePrompt);
    }
  }, [activePrompt]);

  // Style management useEffects
  useEffect(() => {
    if (activeStyle === null) {
      handleStyleSelect('Normal', chatStyles.Normal.prompt);
    }
  }, [activeStyle]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = onCustomStylesSnapshot(currentUser.uid, setCustomStyles);
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Sync selected voice index with current config
  useEffect(() => {
    const currentVoiceName = config.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName;
    const voices = getOnboardingVoices();
    const voiceIndex = voices.findIndex(voice => voice.id === currentVoiceName);
    if (voiceIndex !== -1) {
      setSelectedVoiceIndex(voiceIndex);
    }
  }, [config]);

  // Initialize voice chat when opened
  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      handleConnect();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Cleanup speech recognition and timers
      if (listening) {
        SpeechRecognition.stopListening();
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      

    };
  }, [isOpen]); // Remove isConnected and isConnecting from dependencies to prevent infinite loop

  // Cleanup effect - no longer saves voice chat ended message (handled in handleEndSession)
  useEffect(() => {
    return () => {
      // This runs when the component unmounts
      // Cleanup timers and disconnect
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
      }
      if (voicePreferenceSaveTimerRef.current) {
        clearTimeout(voicePreferenceSaveTimerRef.current);
      }
      disconnect();
    };
  }, []); // Empty deps - only runs on unmount

  // Handle TaskMaster Live messages and save to conversation (with debouncing to prevent fragmentation)
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      if (latestMessage.type === 'output' && latestMessage.content) {
        // Check if this message was already processed to prevent duplicates
        const messageKey = `${latestMessage.content?.substring(0, 50)}-${latestMessage.timestamp}`;
        const processedMessagesKey = 'voice-processed-messages';
        const processedMessages = JSON.parse(sessionStorage.getItem(processedMessagesKey) || '[]');
        
        if (processedMessages.includes(messageKey)) {
          return;
        }
        
        // Mark this message as processed
        processedMessages.push(messageKey);
        sessionStorage.setItem(processedMessagesKey, JSON.stringify(processedMessages.slice(-10))); // Keep last 10
        
        // Handle AI response - save to conversation and notify AI-Chat immediately
        const aiMessage = {
          role: 'assistant',
          content: latestMessage.content,
          audioUrl: latestMessage.audio ? URL.createObjectURL(new Blob([latestMessage.audio])) : undefined,
          audioDuration: latestMessage.audio ? undefined : undefined, // Calculate if needed
          isVoiceMessage: true,
          transcription: latestMessage.content,
          // Include completed actions so AI-Chat can show what was done
          completedActions: completedActions.length > 0 ? completedActions : undefined
        };
        
        // Reset text processing state when AI responds
        setIsTextProcessing(false);
        
        // Save to Firestore if we have a conversation
        if (conversationId && user) {
          saveChatMessage(conversationId, {
            role: 'assistant',
            content: latestMessage.content,
            isVoiceMessage: true
          }).catch(console.error);
        }
        
        // Notify AI-Chat component
        if (onMessage) {
          onMessage(aiMessage);
        }
        
      } else if (latestMessage.type === 'input' && latestMessage.content) {
        // Handle user input - save to conversation and notify AI-Chat
        const userMessage = {
          role: 'user',
          content: latestMessage.content,
          isVoiceMessage: true,
          transcription: latestMessage.content
        };
        
        // Save to Firestore if we have a conversation
        if (conversationId && user) {
          saveChatMessage(conversationId, {
            role: 'user',
            content: latestMessage.content,
            isVoiceMessage: true
          }).catch(console.error);
        }
        
        // Notify AI-Chat component
        if (onMessage) {
          onMessage(userMessage);
        }
      }
    }
  }, [messages, conversationId, user, onMessage]);

  // Auto-reactivate microphone ONLY after AI completely finishes speaking (not during)
  useEffect(() => {
    // Only reactivate when AI stops speaking AND we have a recent output message
    if (!isAISpeaking && messages.length > 0 && !isMicMuted && !listening) {
      const latestMessage = messages[messages.length - 1];
      
      // If we have a recent AI output message and AI is no longer speaking
      if (latestMessage.type === 'output' && (latestMessage.audio || latestMessage.content) && isConnected) {
        // Small delay to ensure audio system is fully ready
        const reactivateTimer = setTimeout(() => {
          // Final check - make sure AI is still not speaking and conditions are met
          if (!isAISpeaking && !listening && isConnected && browserSupportsSpeechRecognition && isMicrophoneAvailable && !isMicMuted && isOpen && !isAutoReactivating) {
            setIsAutoReactivating(true);
            
            try {
              resetTranscript();
              SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
              
              // Reset auto-reactivating flag after successful start
              setTimeout(() => setIsAutoReactivating(false), 500);
            } catch (error) {
              console.error('🎤 Failed to reactivate microphone:', error);
              setIsAutoReactivating(false);
              
              // Try again after a short delay
              setTimeout(() => {
                if (!isAISpeaking && !listening && isConnected && !isMicMuted && isOpen) {
                  try {
                    SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
                  } catch (retryError) {
                    console.error('🎤 Retry failed:', retryError);
                  }
                }
              }, 1000);
            }
          }
        }, 500); // Small 500ms delay to ensure audio system is ready
        
        // Return cleanup function
        return () => {
          clearTimeout(reactivateTimer);
        };
      }
    }
  }, [isAISpeaking, messages, isConnected, listening, browserSupportsSpeechRecognition, isMicrophoneAvailable, resetTranscript, isMicMuted, isOpen, isAutoReactivating]);

  // Auto-send after silence detection (only if not muted)
  useEffect(() => {
    if (listening && transcript.trim() && !isMicMuted) {
      // Clear existing timer
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      
      // Set new timer to auto-send after 2 seconds of silence
      const timer = setTimeout(() => {
        if (transcript.trim() && isConnected && !isMicMuted) {

          SpeechRecognition.stopListening();
          
          // Convert selectedFiles to the format expected by sendText
          const filesForSending = selectedFiles.map(file => ({
            type: file.type,
            base64Data: file.base64Data,
            name: file.name
          }));
          
          sendText(transcript.trim(), filesForSending.length > 0 ? filesForSending : undefined);
          resetTranscript();
          if (filesForSending.length > 0) {
            setSelectedFiles([]); // Clear files after sending
          }
        }
      }, 2000); // 2 seconds of silence
      
      setSilenceTimer(timer);
    }
    
    // Cleanup timer on unmount or when stopping
    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [transcript, listening, isConnected, sendText, resetTranscript, isMicMuted]); // Added isMicMuted to deps

  // Auto-start microphone ONLY for FullscreenVoiceChat (not AI-Chat) and only if not muted
  useEffect(() => {
    // Only auto-start if we're in the main voice chat (not onboarding/selection) and component is open and not muted
    if (isOpen && !listening && browserSupportsSpeechRecognition && isMicrophoneAvailable && !isFirstTimeUser && !showVoiceSelection && !isMicMuted && !isAutoReactivating) {
      const timer = setTimeout(() => {
        // Double-check we're still in the right state and this component is still mounted/open
        if (isOpen && !listening && browserSupportsSpeechRecognition && isMicrophoneAvailable && !isFirstTimeUser && !showVoiceSelection && !isMicMuted && !isAutoReactivating) {

          resetTranscript();
          SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, browserSupportsSpeechRecognition, isMicrophoneAvailable, isFirstTimeUser, showVoiceSelection, resetTranscript, isMicMuted, isAutoReactivating]);

  // Separate effect to handle cleanup when component closes - only runs on isOpen change
  useEffect(() => {
    // Stop microphone when FullscreenVoiceChat closes (but only if it was listening)
    if (!isOpen && listening) {
      SpeechRecognition.stopListening();
      resetTranscript();
    }
  }, [isOpen]); // Only depend on isOpen, not listening, to avoid interfering with other components

  // Watch for action completions and show notifications
  useEffect(() => {
    const recentlyCompletedActions = completedActions.filter(action => 
      action.status === 'success' && 
      Date.now() - action.timestamp < 5000 && // Completed in last 5 seconds
      ['createGoogleDoc', 'createGoogleSheet', 'createGoogleSlides', 'updateGoogleDriveFile', 'sendGmail'].includes(action.type)
    );
    
    if (recentlyCompletedActions.length > 0) {
      const latestAction = recentlyCompletedActions[0];
      const actionName = getActionDisplayName(latestAction.type);
      setCompletionNotification({
        id: latestAction.id,
        message: `✅ ${actionName.charAt(0).toUpperCase() + actionName.slice(1)} completed!`
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setCompletionNotification(null);
      }, 3000);
    }
  }, [completedActions]);

  // Helper function for completion notifications
  const getActionDisplayName = (actionType: string): string => {
    switch (actionType) {
      case 'createGoogleDoc':
        return 'google doc creation';
      case 'createGoogleSheet':
        return 'google sheet creation';
      case 'createGoogleSlides':
        return 'google slides creation';
      case 'updateGoogleDriveFile':
        return 'document update';
      case 'sendGmail':
        return 'email sending';
      default:
        return 'action';
    }
  };


  // Auto-reconnect function with exponential backoff
  const attemptAutoReconnect = () => {
    if (autoReconnectAttempts >= 3) {
      // Max attempts reached, stop auto-reconnecting
      return;
    }

    const delay = Math.pow(2, autoReconnectAttempts) * 2000; // 2s, 4s, 8s
    setAutoReconnectAttempts(prev => prev + 1);

    autoReconnectTimerRef.current = setTimeout(() => {
      handleConnect();
    }, delay);
  };

  // Handle connection
  const handleConnect = async () => {
    try {
      // Clear any auto-reconnect timer
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
        autoReconnectTimerRef.current = null;
      }

      // Build comprehensive system instruction with user data
      const voiceSystemInstruction = buildVoiceSystemInstruction();
      
      // Update config with the built system instruction
      const configWithSystemInstruction = {
        ...config,
        systemInstruction: voiceSystemInstruction
      };
      
      await connect(configWithSystemInstruction);
      setSessionStartTime(new Date());
      
      // Start voice recording after successful connection (if not muted)
      if (!isMicMuted) {
        try {
          await startRecording();
        } catch (recordingError) {
          console.error('Failed to start recording after connection:', recordingError);
        }
      }
      
      // Reset auto-reconnect attempts on successful connection
      setAutoReconnectAttempts(0);
    } catch (error) {
      console.error('Failed to connect to voice chat:', error);
      
      // Attempt auto-reconnect if this wasn't a manual retry
      if (autoReconnectAttempts < 3) {
        attemptAutoReconnect();
      }
    }
  };

  // Manual retry function
  const handleRetry = () => {
    // Reset auto-reconnect attempts for manual retry
    setAutoReconnectAttempts(0);
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    clearMessages();
    handleConnect();
  };

  // Calculate session duration
  const calculateSessionDuration = (startTime: Date, endTime: Date): string => {
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle disconnection
  const handleDisconnect = async () => {
    // Calculate session duration if we have a start time
    let sessionDuration = '0:00';
    if (sessionStartTime) {
      sessionDuration = calculateSessionDuration(sessionStartTime, new Date());
    }

    // Save voice chat ended message to Firebase if we have a conversation
    if (conversationId && user && sessionStartTime) {
      try {
        await saveChatMessage(conversationId, {
          role: 'system',
          content: '',
          isVoiceChatEnded: true,
          voiceChatDuration: sessionDuration
        });

        // Also notify AI-Chat component
        if (onMessage) {
          onMessage({
            role: 'system',
            content: '',
            isVoiceChatEnded: true,
            voiceChatDuration: sessionDuration,
            id: `voice-ended-${Date.now()}`,
            createdAt: new Date()
          });
        }
      } catch (error) {
        console.error('Failed to save voice chat ended message:', error);
      }
    }

    disconnect();
    onClose();
  };

  // Toggle microphone mute/unmute (without auto-sending)
  const handleToggleRecording = async () => {
    if (!browserSupportsSpeechRecognition) {
      alert("This browser does not support speech recognition. Please try Google Chrome.");
      return;
    }
    if (!isMicrophoneAvailable) {
      alert("Microphone is not available. Please check your hardware and browser permissions.");
      return;
    }

    if (listening || isRecording) {
      // Mute microphone - stop BOTH speech recognition AND voice chat recording
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        setSilenceTimer(null);
      }
      
      // Stop speech recognition
      SpeechRecognition.stopListening();
      
      // Stop voice chat recording
      stopRecording();
      
      setIsMicMuted(true);
      // Don't reset transcript - keep it for when they unmute
    } else {
      // Unmute microphone - start BOTH speech recognition AND voice chat recording
      setIsMicMuted(false);
      
      // Start speech recognition
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      
      // Start voice chat recording
      try {
        await startRecording();
      } catch (error) {
        console.error('Failed to start voice chat recording:', error);
      }
    }
  };

  // Manual send function for sending transcript when user wants to
  const handleManualSend = () => {
    const finalTranscriptText = transcript.trim();
    if (finalTranscriptText && isConnected) {
      // Convert selectedFiles to the format expected by sendText
      const filesForSending = selectedFiles.map(file => ({
        type: file.type,
        base64Data: file.base64Data,
        name: file.name
      }));
      
      sendText(finalTranscriptText, filesForSending.length > 0 ? filesForSending : undefined);
      if (filesForSending.length > 0) {
        setSelectedFiles([]); // Clear files after sending
      }
      resetTranscript();
    }
  };

  // Voice selection options for onboarding - Using Gemini Live API voice names
  // Note: Half-cascade models (basic/pro users) support: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
  // Native audio models (premium users) support a longer list of voices
  const getOnboardingVoices = () => {
    return [
      { id: 'Puck', name: 'Puck', description: 'Bright and energetic', gender: 'Male' },
      { id: 'Charon', name: 'Charon', description: 'Deep and authoritative', gender: 'Male' },
      { id: 'Kore', name: 'Kore', description: 'Warm and engaging', gender: 'Female' },
      { id: 'Fenrir', name: 'Fenrir', description: 'Strong and confident', gender: 'Male' },
      { id: 'Aoede', name: 'Aoede', description: 'Melodic and expressive', gender: 'Female' },
      { id: 'Leda', name: 'Leda', description: 'Clear and professional', gender: 'Female' },
      { id: 'Orus', name: 'Orus', description: 'Calm and thoughtful', gender: 'Male' },
      { id: 'Zephyr', name: 'Zephyr', description: 'Gentle and soothing', gender: 'Male' }
    ];
  };

  // Voice sample functionality using the hook
  const playVoiceSample = async (voiceId: string) => {
    if (playingVoiceSample === voiceId) {
      // Stop current sample
      setPlayingVoiceSample(null);
      return;
    }

    try {
      setPlayingVoiceSample(voiceId);
      
      // Use the hook to create voice sample
      const audioBuffer = await createVoiceSample(voiceId);
      
      if (audioBuffer) {
        // Create audio context for sample playback
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        // Convert to AudioBuffer and play
        const arrayBuffer = audioBuffer instanceof ArrayBuffer 
          ? audioBuffer 
          : (audioBuffer as Uint8Array).buffer.slice((audioBuffer as Uint8Array).byteOffset, (audioBuffer as Uint8Array).byteOffset + (audioBuffer as Uint8Array).byteLength);
        const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = decodedAudio;
        source.connect(audioContext.destination);
        source.start();
        
        // Stop tracking when audio ends
        source.onended = () => {
          setPlayingVoiceSample(null);
          audioContext.close();
        };
      } else {
        setPlayingVoiceSample(null);
      }
      
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setPlayingVoiceSample(null);
    }
  };



  // Update voice configuration
  const updateVoice = async (voiceName: string, shouldSave: boolean = false) => {
    // Update the config state
    setConfig(prev => ({
      ...prev,
      speechConfig: {
        ...prev.speechConfig,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    }));

    // Save to Firebase if requested (debounced to prevent conflicts)
    if (shouldSave && currentUser) {
      debouncedSaveVoicePreference(currentUser.uid, voiceName);
    }

    // For real-time voice switching, we don't need to reconnect
    // The voice config is updated in state and will be used in future connections
    // Current session will continue with the old voice until next natural reconnection
  };

  // Handle text input send
  const handleSendText = () => {
    if ((textInput.trim() || selectedFiles.length > 0) && isConnected && !isTextProcessing) {
      setIsTextProcessing(true);
      
      // Convert selectedFiles to the format expected by sendText
      const filesForSending = selectedFiles.map(file => ({
        type: file.type,
        base64Data: file.base64Data,
        name: file.name
      }));
      
      sendText(textInput.trim() || "Please analyze the attached files.", filesForSending);
      setTextInput('');
      setSelectedFiles([]); // Clear selected files after sending
    }
  };

  // Handle stopping text generation
  const handleStopTextGeneration = () => {
    setIsTextProcessing(false);
    // Also stop any audio that might be playing from text responses
    stopAudio();
  };

  // File handling functions (from AI-Chat.tsx)
  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const filesArray = Array.from(event.target.files);
    const newSelectedFiles: SelectedFile[] = [];
    
    for (const file of filesArray) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { 
        alert(`File ${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB).`); 
        continue; 
      }
      
      // Check if file type is supported
      const isSupported = SUPPORTED_FILE_TYPES.split(',').some(supportedType => {
        const trimmedType = supportedType.trim();
        if (trimmedType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(trimmedType);
        }
        return file.type === trimmedType;
      });

      if (!isSupported) {
        alert(`File type for ${file.name} (${file.type || 'unknown'}) is not supported.`);
        continue;
      }
      
      try { 
        newSelectedFiles.push(await readFileAsSelectedFile(file)); 
      } catch (error) { 
        console.error("Error reading file:", file.name, error); 
        alert(`Error reading file ${file.name}.`); 
      }
    }
    
    setSelectedFiles(prev => [...prev, ...newSelectedFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = (fileName: string) => { 
    setSelectedFiles(prev => prev.filter(f => { 
      if (f.name === fileName && f.localPreviewUrl) { 
        URL.revokeObjectURL(f.localPreviewUrl); 
      } 
      return f.name !== fileName; 
    })); 
  };

  // Handle text input key press
  const handleTextKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Handle completing onboarding
  const handleCompleteOnboarding = async () => {
    setIsFirstTimeUser(false);
    setShowVoiceSelection(true);
  };

  // Handle style selection
  const handleStyleSelect = async (style: string, prompt: string) => {
    setActiveStyle(style);
    setCurrentActivePrompt(prompt);
    
    // If we're currently connected, reconnect with the new prompt
    if (isConnected) {
      try {
        // Disconnect first
        disconnect();
        
        // Wait a moment for clean disconnect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reconnect with new system instruction
        await handleConnect();
      } catch (error) {
        console.error('Failed to reconnect with new style:', error);
      }
    }
    
  };

  // Style dialog handlers
  const handleOpenStyleDialog = (style?: CustomStyle) => {
    if (style) {
      setEditingStyle(style);
      setStyleFormData({
        name: style.name,
        description: style.description,
        prompt: style.prompt,
        color: style.color || DEFAULT_CUSTOM_COLOR_PROPS.color,
        hoverColor: style.hoverColor || DEFAULT_CUSTOM_COLOR_PROPS.hoverColor,
        lightBg: style.lightBg || DEFAULT_CUSTOM_COLOR_PROPS.lightBg,
        textColor: style.textColor || DEFAULT_CUSTOM_COLOR_PROPS.textColor,
      });
    } else {
      setEditingStyle(null);
      const randomColorIndex = Math.floor(Math.random() * CUSTOM_STYLE_COLORS.length);
      const { name: _name, ...randomColorProps } = CUSTOM_STYLE_COLORS[randomColorIndex];
      setStyleFormData({
        name: '',
        description: '',
        prompt: '',
        ...randomColorProps,
      });
    }
    setIsStyleDialogOpen(true);
  };

  const handleCloseStyleDialog = () => setIsStyleDialogOpen(false);

  const handleSaveStyle = async () => {
    if (!currentUser || !styleFormData.name || !styleFormData.description || !styleFormData.prompt) return;
    try {
      const dataToSave = { ...styleFormData };
      if (editingStyle) {
        await updateCustomStyle(editingStyle.id, dataToSave);
      } else {
        await createCustomStyle(currentUser.uid, dataToSave);
      }
      handleCloseStyleDialog();
    } catch (error) {
      console.error('Error saving style:', error);
    }
  };

  const handleDeleteStyle = async (styleId: string) => {
    try {
      await deleteCustomStyle(styleId);
    } catch (error) {
      console.error('Error deleting style:', error);
    }
  };

  // Get active style details
  const getActiveStyleDetails = () => {
    if (!activeStyle || activeStyle === 'Normal') return null;
    if (activeStyle in chatStyles) {
      return (chatStyles as any)[activeStyle];
    }
    return customStyles.find(s => s.name === activeStyle) || null;
  };

  // Get active style button colors
  const getActiveStyleButtonColors = () => {
    if (!activeStyle || activeStyle === 'Normal') {
      return {
        bg: 'bg-[var(--bg-highlight)]',
        hover: 'hover:bg-[var(--interactive-hover)]',
        text: 'text-[var(--text-secondary)]'
      };
    }
    
    if (activeStyle in chatStyles) {
      const style = (chatStyles as any)[activeStyle];
      return {
        bg: style.color || 'bg-[var(--bg-highlight)]',
        hover: style.hoverColor || 'hover:bg-[var(--interactive-hover)]',
        text: 'text-white'
      };
    }
    
    // Check custom styles
    const customStyle = customStyles.find(style => style.name === activeStyle);
    if (customStyle) {
      return {
        bg: customStyle.color || 'bg-[var(--bg-highlight)]',
        hover: customStyle.hoverColor || 'hover:bg-[var(--interactive-hover)]',
        text: 'text-white'
      };
    }
    
    return {
      bg: 'bg-[var(--bg-highlight)]',
      hover: 'hover:bg-[var(--interactive-hover)]',
      text: 'text-[var(--text-secondary)]'
    };
  };

  // Handle voice selection completion
  const handleStartNewChat = async () => {
    const voices = getOnboardingVoices();
    const selectedVoice = voices[selectedVoiceIndex];
    
    // Update voice configuration and save preference
    await updateVoice(selectedVoice.id, true);
    
    // Save onboarding completion to Firestore/localStorage
    if (currentUser) {
      await setVoiceOnboardingStatus(currentUser.uid, true);
    } else {
      localStorage.setItem('hasUsedVoiceMode', 'true');
    }
    
    setShowVoiceSelection(false);
  };

  // Handle voice selection cancel
  const handleCancelVoiceSelection = () => {
    setShowVoiceSelection(false);
    // Only go back to onboarding if this was part of the onboarding flow
    if (!isSettingsVoiceSelection) {
      setIsFirstTimeUser(true); // Go back to onboarding
    }
    setIsSettingsVoiceSelection(false);
  };

  // Handle settings voice selection apply
  const handleApplyVoiceSettings = async () => {
    const voices = getOnboardingVoices();
    const selectedVoice = voices[selectedVoiceIndex];
    
    // Update voice configuration and save preference (voice will take effect on next connection)
    await updateVoice(selectedVoice.id, true);
    
    setShowVoiceSelection(false);
    setIsSettingsVoiceSelection(false);
  };

  // Voice navigation functions
  const nextVoice = async () => {
    const voices = getOnboardingVoices();
    const newIndex = (selectedVoiceIndex + 1) % voices.length;
    setSelectedVoiceIndex(newIndex);
    
    // If we're in settings mode, update voice preference (but don't reconnect)
    if (isSettingsVoiceSelection) {
      const selectedVoice = voices[newIndex];
      await updateVoice(selectedVoice.id, true);
    }
  };

  const prevVoice = async () => {
    const voices = getOnboardingVoices();
    const newIndex = (selectedVoiceIndex - 1 + voices.length) % voices.length;
    setSelectedVoiceIndex(newIndex);
    
    // If we're in settings mode, update voice preference (but don't reconnect)
    if (isSettingsVoiceSelection) {
      const selectedVoice = voices[newIndex];
      await updateVoice(selectedVoice.id, true);
    }
  };

  // For testing: reset onboarding status (accessible via console)
  if (typeof window !== 'undefined') {
    (window as any).resetVoiceOnboarding = async () => {
      if (currentUser) {
        await setVoiceOnboardingStatus(currentUser.uid, false);
        setIsFirstTimeUser(true);
        setShowVoiceSelection(false);
        setIsSettingsVoiceSelection(false);

      } else {
        localStorage.removeItem('hasUsedVoiceMode');
        setIsFirstTimeUser(true);
        setShowVoiceSelection(false);
        setIsSettingsVoiceSelection(false);

      }
    };
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center"
        style={{ 
          background: 'var(--bg-primary)',
          fontFamily: 'var(--font-body)',
          zIndex: 9999
        }}
      >


        {/* Header */}
        {!isFirstTimeUser && !showVoiceSelection && (
          <div className="absolute top-0 right-0 p-6" style={{ zIndex: 10 }}>
            <button
              onClick={() => {
                setIsSettingsVoiceSelection(true);
                setShowVoiceSelection(true);
              }}
              className="p-3 rounded-full transition-all duration-200 hover:scale-105"
              style={{ 
                background: 'transparent',
                color: 'var(--text-primary)' 
              }}
            >
              <Settings2 className="w-5 h-5" style={{ transform: 'scaleX(-1)' }} />
            </button>
          </div>
        )}



        {/* Error Display */}
        {error && (
          <div 
            className="absolute top-32 left-6 right-6 p-4 rounded-xl max-w-md mx-auto"
            style={{ 
              zIndex: 15,
              background: 'var(--status-error)',
              color: 'var(--text-white)'
            }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <AlertCircle className="w-6 h-6" />
              <div className="flex-1">
                <div className="text-sm mb-1">{error}</div>
                {autoReconnectAttempts > 0 && autoReconnectAttempts < 3 && (
                  <div className="text-xs opacity-80">
                    Auto-reconnecting... (Attempt {autoReconnectAttempts}/3)
                  </div>
                )}
              </div>
            </div>
            {/* Show Try Again button for connection errors or when auto-reconnect attempts are exhausted */}
            {(error.toLowerCase().includes('connection') || 
              error.toLowerCase().includes('lost') || 
              autoReconnectAttempts >= 3 ||
              error.includes('Please try again')) && (
              <button
                onClick={handleRetry}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{
                  background: 'var(--text-white)',
                  color: 'var(--status-error)'
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}





        

        {/* Close button for onboarding only */}
        {isFirstTimeUser && !showVoiceSelection && (
          <div className="absolute top-6 right-6" style={{ zIndex: 10 }}>
            <button
              onClick={onClose}
              className="p-3 rounded-full transition-all duration-200 hover:scale-105"
              style={{ 
                background: 'transparent',
                color: 'var(--text-primary)' 
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Main Content */}
        {isLoadingOnboardingStatus ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center space-y-4" style={{ zIndex: 10 }}>
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--text-primary)' }} />
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              Loading...
            </p>
          </div>
        ) : showVoiceSelection ? (
          /* Voice Selection Screen */
          <div className="flex flex-col items-center justify-center px-4 sm:px-8 w-full max-w-4xl mx-auto text-center" style={{ zIndex: 10 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 sm:space-y-8 w-full"
            >
              {/* Title */}
              <h1 
                className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12"
                style={{ color: 'var(--text-primary)' }}
              >
                Choose a voice
              </h1>

              {/* Voice Display */}
              <div className="flex flex-col items-center space-y-8 sm:space-y-12">
                {/* Voice Image */}
                <div
                  className="w-32 h-32 sm:w-44 md:w-52 sm:h-44 md:h-52 rounded-full overflow-hidden flex items-center justify-center"
                  style={{
                    boxShadow: 'var(--shadow-heavy)'
                  }}
                >
                  <img
                    src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/TaskMaster%20-%20Voice%20Mode.png?alt=media&token=e00ca923-7a54-4240-8f2e-7b51e699e734"
                    alt="TaskMaster Voice Mode"
                    className="w-full h-full object-cover"
                  />
                </div>

                                  {/* Voice Carousel */}
                  <div className="text-center w-full px-4">
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={selectedVoiceIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="flex items-center justify-center w-full max-w-4xl mx-auto"
                      >
                        {/* Previous Voice - Hidden on mobile */}
                        <div className="hidden sm:flex flex-1 text-center opacity-40 min-w-0 px-2">
                          <div className="w-full">
                            <h3 
                              className="text-base lg:text-xl font-semibold mb-2 flex items-center justify-center gap-2 flex-wrap"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <span className="truncate">
                                {getOnboardingVoices()[(selectedVoiceIndex - 1 + getOnboardingVoices().length) % getOnboardingVoices().length].name}
                              </span>
                              <span 
                                className="text-xs px-1 rounded-full font-normal inline-flex items-center flex-shrink-0"
                                style={{ 
                                  background: 'var(--bg-secondary)', 
                                  color: 'var(--text-secondary)',
                                  fontSize: '0.7rem',
                                  lineHeight: '1',
                                  paddingTop: '0.2rem',
                                  paddingBottom: '0.2rem',
                                  transform: 'translateY(5px)'
                                }}
                              >
                                {getOnboardingVoices()[(selectedVoiceIndex - 1 + getOnboardingVoices().length) % getOnboardingVoices().length].gender}
                              </span>
                            </h3>
                            <p 
                              className="text-xs lg:text-sm text-center px-1"
                              style={{ 
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                lineHeight: '1.3'
                              }}
                            >
                              {getOnboardingVoices()[(selectedVoiceIndex - 1 + getOnboardingVoices().length) % getOnboardingVoices().length].description}
                            </p>
                          </div>
                        </div>

                        {/* Previous Button */}
                        <button
                          onClick={prevVoice}
                          className="p-2 mx-2 lg:mx-4 rounded-full transition-all duration-200 hover:scale-110 flex-shrink-0"
                          style={{ 
                            background: 'transparent',
                            color: 'var(--text-secondary)' 
                          }}
                        >
                          <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
                        </button>

                        {/* Current Voice */}
                        <div className="flex-1 text-center min-w-0 max-w-xs px-2">
                          <h3 
                            className="text-xl lg:text-2xl font-semibold mb-2 flex items-center justify-center gap-2 flex-wrap"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {/* Voice Sample Button - Inline with name */}
                            <button
                              onClick={() => playVoiceSample(getOnboardingVoices()[selectedVoiceIndex].id)}
                              disabled={false} // Allow voice samples during selection
                              className="inline-flex items-center p-2 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative z-20"
                              style={{
                                background: playingVoiceSample === getOnboardingVoices()[selectedVoiceIndex].id 
                                  ? 'var(--status-error)' 
                                  : 'var(--bg-accent)',
                                color: 'var(--text-white)',
                                border: 'none',
                                boxShadow: '0 2px 4px -1px var(--shadow-medium)',
                                minWidth: '32px',
                                minHeight: '32px'
                              }}
                              title={playingVoiceSample === getOnboardingVoices()[selectedVoiceIndex].id ? "Stop sample" : "Play voice sample"}
                            >
                              {playingVoiceSample === getOnboardingVoices()[selectedVoiceIndex].id ? (
                                <VolumeX className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>

                            <span className="truncate">
                              {getOnboardingVoices()[selectedVoiceIndex].name}
                            </span>
                            <span 
                              className="text-xs px-1 rounded-full font-normal inline-flex items-center flex-shrink-0"
                              style={{ 
                                background: 'var(--bg-secondary)', 
                                color: 'var(--text-secondary)',
                                fontSize: '0.7rem',
                                lineHeight: '1',
                                paddingTop: '0.2rem',
                                paddingBottom: '0.2rem',
                                transform: 'translateY(5px)'
                              }}
                            >
                              {getOnboardingVoices()[selectedVoiceIndex].gender}
                            </span>
                          </h3>
                          <p 
                            className="text-sm lg:text-base text-center px-2"
                            style={{ 
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.4'
                            }}
                          >
                            {getOnboardingVoices()[selectedVoiceIndex].description}
                          </p>
                        </div>

                        {/* Next Button */}
                        <button
                          onClick={nextVoice}
                          className="p-2 mx-2 lg:mx-4 rounded-full transition-all duration-200 hover:scale-110 flex-shrink-0"
                          style={{ 
                            background: 'transparent',
                            color: 'var(--text-secondary)' 
                          }}
                        >
                          <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                        </button>

                        {/* Next Voice - Hidden on mobile */}
                        <div className="hidden sm:flex flex-1 text-center opacity-40 min-w-0 px-2">
                          <div className="w-full">
                            <h3 
                              className="text-base lg:text-xl font-semibold mb-2 flex items-center justify-center gap-2 flex-wrap"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              <span className="truncate">
                                {getOnboardingVoices()[(selectedVoiceIndex + 1) % getOnboardingVoices().length].name}
                              </span>
                              <span 
                                className="text-xs px-1 rounded-full font-normal inline-flex items-center flex-shrink-0"
                                style={{ 
                                  background: 'var(--bg-secondary)', 
                                  color: 'var(--text-secondary)',
                                  fontSize: '0.7rem',
                                  lineHeight: '1',
                                  paddingTop: '0.2rem',
                                  paddingBottom: '0.2rem',
                                  transform: 'translateY(5px)'
                                }}
                              >
                                {getOnboardingVoices()[(selectedVoiceIndex + 1) % getOnboardingVoices().length].gender}
                              </span>
                            </h3>
                            <p 
                              className="text-xs lg:text-sm text-center px-1"
                              style={{ 
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                lineHeight: '1.3'
                              }}
                            >
                              {getOnboardingVoices()[(selectedVoiceIndex + 1) % getOnboardingVoices().length].description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mt-4 sm:mt-6 w-full max-w-sm mx-auto">
                {/* Primary Action Button */}
                <motion.button
                  onClick={isSettingsVoiceSelection ? handleApplyVoiceSettings : handleStartNewChat}
                  className="w-full sm:w-auto py-3 px-8 rounded-full text-white font-medium text-base transition-all duration-200 mx-auto block"
                  style={{
                    background: 'var(--text-primary)',
                    color: 'var(--bg-primary)',
                    minWidth: '180px'
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSettingsVoiceSelection ? 'Done' : 'Start new chat'}
                </motion.button>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelVoiceSelection}
                  className="w-full py-2 px-5 text-base font-medium transition-colors"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {isSettingsVoiceSelection ? 'Cancel' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        ) : isFirstTimeUser ? (
          /* Onboarding Screen */
          <div className="flex flex-col items-center justify-center px-4 sm:px-8 w-full max-w-lg mx-auto text-center" style={{ zIndex: 10 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 sm:space-y-8 w-full"
            >
              {/* Title */}
              <div className="space-y-4">
                <h1 
                  className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Say hello to advanced voice mode
                </h1>
              </div>

              {/* Features List */}
              <div className="space-y-4 sm:space-y-6 text-left w-full">
                {/* Natural Conversations */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-highlight)' }}
                  >
                    <MessageCircle 
                      className="w-5 h-5 sm:w-6 sm:h-6" 
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-semibold text-base sm:text-lg mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Natural conversations
                    </h3>
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Senses and responds to interruptions, humor, and more.
                    </p>
                  </div>
                </div>

                {/* Multiple Voices */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-highlight)' }}
                  >
                    <Settings2 
                      className="w-5 h-5 sm:w-6 sm:h-6" 
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-semibold text-base sm:text-lg mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Multiple voices
                    </h3>
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Offers an expanded set of voices to choose from.
                    </p>
                  </div>
                </div>

                {/* Personalized to You */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-highlight)' }}
                  >
                    <User 
                      className="w-5 h-5 sm:w-6 sm:h-6" 
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-semibold text-base sm:text-lg mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Personalized to you
                    </h3>
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Can use memory and custom instructions to shape responses.
                    </p>
                  </div>
                </div>

                {/* You're in Control */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-highlight)' }}
                  >
                    <Lock 
                      className="w-5 h-5 sm:w-6 sm:h-6" 
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-semibold text-base sm:text-lg mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      You're in control
                    </h3>
                    <p 
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Audio recordings are saved, and you can delete them at any time.{' '}
                    </p>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-center space-y-2">
                <p 
                  className="text-xs underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Voice mode can make mistakes — check important info.
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Usage limits may change.
                </p>
              </div>

              {/* Continue Button */}
              <motion.button
                onClick={handleCompleteOnboarding}
                className="w-full max-w-sm mx-auto py-3 sm:py-4 px-6 rounded-full text-white font-medium text-base sm:text-lg transition-all duration-200 hover:scale-105 block"
                style={{
                  background: 'var(--text-primary)',
                  color: 'var(--bg-primary)'
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Continue
              </motion.button>
            </motion.div>
          </div>
        ) : (
          /* Regular Voice Chat Interface */
          <div className="flex flex-col items-center justify-center min-h-screen px-6 relative" style={{ zIndex: 10 }}>
            
            {/* Central AI Orb */}
            <div className="relative mb-8">


              {/* Main Orb */}
              <motion.img
                src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/TaskMaster%20-%20Voice%20Mode.png?alt=media&token=e00ca923-7a54-4240-8f2e-7b51e699e734"
                alt="TaskMaster Voice Mode"
                className="w-44 h-44 object-cover rounded-full"
                style={{ 
                  border: 'none', 
                  outline: 'none',
                  boxShadow: isAISpeaking 
                    ? '0 0 25px rgba(59, 130, 246, 0.3), var(--shadow-heavy)'
                    : isConnected 
                      ? 'var(--shadow-heavy)' 
                      : 'var(--shadow-medium)'
                }}
                animate={
                  isAISpeaking 
                    ? {
                        // Clean pulsating animation when AI is speaking
                        scale: [1, 1.05, 1],
                      }
                    : {
                        // Gentle idle animation when not speaking
                        scale: [1, 1.01, 1],
                      }
                }
                transition={
                  isAISpeaking
                    ? {
                        duration: 1.2,
                        repeat: Infinity,
                        ease: [0.4, 0.0, 0.6, 1.0] // Custom cubic-bezier for smoother animation
                      }
                    : {
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }
                }
              />


            </div>

            {/* Action Status Display */}
            <AnimatePresence>
              {(completedActions.length > 0 || isProcessingActions) && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mt-8 w-full max-w-md mx-auto"
                >
                  <div 
                    className="rounded-2xl p-4"
                    style={{ 
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-primary)',
                      boxShadow: 'var(--shadow-medium)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span 
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Actions
                        </span>
                      </div>
                      {completedActions.length > 0 && (
                        <button
                          onClick={clearCompletedActions}
                          className="text-xs px-2 py-1 rounded-full transition-colors"
                          style={{
                            background: 'var(--bg-highlight)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {isProcessingActions && (
                      <div className="flex items-center space-x-2 mb-2">
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                        <span 
                          className="text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Processing actions...
                        </span>
                      </div>
                    )}

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {completedActions.map((action) => (
                        <motion.div
                          key={action.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center space-x-2 p-2 rounded-lg"
                          style={{ 
                            background: action.status === 'success' 
                              ? 'var(--status-success-bg)' 
                              : action.status === 'processing'
                              ? 'var(--bg-highlight)'
                              : 'var(--status-error-bg)'
                          }}
                        >
                          {action.status === 'success' ? (
                            getActionIcon(action.type)
                          ) : action.status === 'processing' ? (
                            <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                          ) : (
                            <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--status-error)' }} />
                          )}
                          <div className="min-w-0 flex-1 pr-2">
                            <div 
                              className="text-xs font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {action.title}
                            </div>
                            {(action.status === 'error' || action.status === 'processing') && action.message && (
                              <div 
                                className="text-xs truncate"
                                style={{ color: action.status === 'processing' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                              >
                                {action.message}
                              </div>
                            )}
                            {action.status === 'processing' && action.estimatedDuration && (
                              <div 
                                className="text-xs truncate"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                ETA: {action.estimatedDuration}
                              </div>
                            )}
                            {action.status === 'processing' && action.progress !== undefined && (
                              <div className="mt-1">
                                <div 
                                  className="w-full bg-gray-200 rounded-full h-1"
                                  style={{ background: 'var(--bg-secondary)' }}
                                >
                                  <div 
                                    className="h-1 rounded-full transition-all duration-300"
                                    style={{ 
                                      background: 'var(--accent-primary)',
                                      width: `${action.progress}%`
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {action.viewUrl && action.status !== 'processing' && (
                              <button
                                onClick={() => window.open(action.viewUrl, '_blank')}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-highlight)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--interactive-hover)] transition-colors flex-shrink-0"
                              >
                                View
                              </button>
                            )}
                            {action.status === 'processing' && (
                              <div className="text-xs text-[var(--accent-primary)] font-medium flex-shrink-0">
                                Processing...
                              </div>
                            )}
                            <div className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {new Date(action.timestamp).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* Text Input - AI-Chat Style */}
        <AnimatePresence>
        {!isFirstTimeUser && !showVoiceSelection && showTextInput && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute bottom-32 left-6 right-6 max-w-sm mx-auto"
              style={{ zIndex: 15 }}
            >
                            <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-sm transition-all duration-200 flex flex-col w-full min-w-0 max-w-full overflow-hidden">
                {/* Header */}


                {/* Attached Files Display - Integrated within input container */}
                {selectedFiles.length > 0 && (
                  <div className="px-3 pt-3 pb-2 border-b border-[var(--bg-card)]">
                    <div className="flex flex-wrap gap-2">
                      {selectedFiles.map(file => (
                        <div key={file.name} className="group relative">
                          {file.type.startsWith("image/") && file.localPreviewUrl ? (
                            <div className="relative">
                              <img 
                                src={file.localPreviewUrl} 
                                alt={file.name} 
                                className="w-16 h-16 rounded-lg object-cover border border-[var(--border-primary)]" 
                              />
                              <button 
                                type="button" 
                                onClick={() => handleRemoveFile(file.name)} 
                                className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--status-error)] hover:bg-[var(--status-error)]/80 text-white rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex items-center gap-2 bg-[var(--bg-highlight)] border border-[var(--border-primary)] rounded-lg p-2 pr-8 max-w-48">
                              <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                                {file.name}
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveFile(file.name)} 
                                className="absolute top-1 right-1 w-4 h-4 bg-[var(--status-error)] hover:bg-[var(--status-error)]/80 text-white rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
                                title="Remove"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                                {/* Input Area - Inline layout with perfect alignment */}
                <div className="flex items-end gap-2 p-2.5">
                  {/* Hidden file input */}
                <input
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    multiple 
                    accept={SUPPORTED_FILE_TYPES} 
                    className="hidden" 
                    disabled={isTextProcessing || !isConnected} 
                  />
                  
                  {/* Style Controls */}
                  <div className="flex items-center pb-3.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          type="button" 
                          disabled={isTextProcessing || !isConnected} 
                          className={`p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm hover:shadow-md ${getActiveStyleButtonColors().bg} ${getActiveStyleButtonColors().hover} ${getActiveStyleButtonColors().text}`}
                          title="Change Chat Style"
                        >
                          <Palette className="w-5 h-5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72 p-0 bg-[var(--bg-primary)] shadow-xl rounded-lg border border-[var(--border-primary)] font-clarika z-[10000]"
                        align="start"
                        side="top"
                        sideOffset={8}
                      >
                        <div className="flex flex-col max-h-[400px]">
                          <div className="p-3 border-b border-[var(--border-primary)]">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-[var(--text-primary)]">Chat Styles</h4>
                              {currentUser && (
                                  <button
                                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]"
                                      onClick={() => handleOpenStyleDialog()}
                                      title="Create Custom Style"
                                  >
                                      <Plus className="h-4 w-4" />
                                  </button>
                              )}
                            </div>
                          </div>

                          <div className="overflow-y-auto flex-1 p-2 scrollbar-thin scrollbar-thumb-[var(--border-secondary)]">
                            <div className="space-y-1 mb-2">
                              {Object.entries(chatStyles).map(([styleName, { description, prompt, color }]) => (
                                <button
                                  key={styleName}
                                  className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 ${
                                    activeStyle === styleName
                                      ? (styleName === 'Normal' ? `bg-[var(--bg-highlight)] text-[var(--text-primary)] font-semibold` : `${color} text-white font-semibold`)
                                      : `text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]`
                                  }`}
                                  onClick={() => handleStyleSelect(styleName, prompt)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-medium">{styleName}</div>
                                    {activeStyle === styleName && <Check className="h-4 w-4" />}
                                  </div>
                                  <p className={`text-xs mt-0.5 font-normal ${activeStyle === styleName && styleName !== 'Normal' ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                    {description}
                                  </p>
                                </button>
                              ))}
                            </div>

                            {customStyles.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold uppercase text-[var(--text-muted)] px-2.5 pt-2 pb-1.5">Custom Styles</h5>
                                <div className="space-y-1">
                                  {customStyles.map((style) => (
                                    <div
                                      key={style.id}
                                      className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 group cursor-pointer ${
                                        activeStyle === style.name
                                          ? `${style.color || DEFAULT_CUSTOM_COLOR_PROPS.color} text-white font-semibold`
                                          : `text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]`
                                      }`}
                                      onClick={() => handleStyleSelect(style.name, style.prompt)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium truncate pr-2">{style.name}</span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1.5 rounded-full hover:bg-[var(--overlay-dark)]" onClick={(e) => { e.stopPropagation(); handleOpenStyleDialog(style); }} title="Edit Style"><Edit2 className="h-3.5 w-3.5" /></button>
                                            <button className="p-1.5 rounded-full hover:bg-[var(--overlay-dark)]" onClick={(e) => { e.stopPropagation(); handleDeleteStyle(style.id); }} title="Delete Style"><Trash2 className="h-3.5 w-3.5" /></button>
                                          </div>
                                          {activeStyle === style.name && <Check className="h-4 w-4 ml-1" />}
                                        </div>
                                      </div>
                                      <p className={`text-xs mt-0.5 font-normal text-left ${activeStyle === style.name ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{style.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Textarea - Centered with buttons */}
                  <div className="flex items-center flex-1 pb-2.5">
                    <textarea
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                      rows={1}
                  value={textInput}
                      onChange={(e) => {
                        setTextInput(e.target.value);
                        // Auto-resize like AI-Chat
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          if (isTextProcessing) {
                            handleStopTextGeneration();
                          } else {
                            handleSendText();
                          }
                        } 
                      }}
                      placeholder="Ask anything..."
                      className="w-full min-w-0 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-[15px] focus:ring-0 focus:outline-none border-0 resize-none overflow-y-auto max-h-44 leading-relaxed box-border py-2.5"
                      disabled={isTextProcessing || !isConnected}
                      autoFocus
                    />
                  </div>

                  {/* Send/Stop Button */}
                  <div className="flex items-center pb-3">
                <button
                      type="button" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (isTextProcessing) {
                          handleStopTextGeneration();
                        } else {
                          handleSendText();
                        }
                      }}
                      disabled={!isConnected || ((!textInput.trim() && selectedFiles.length === 0) && !isTextProcessing)}
                      className={`p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm hover:shadow-md ${isTextProcessing ? 'bg-[var(--interactive-hover)] text-[var(--text-primary)] hover:bg-[var(--interactive-hover)]' : 'bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)]'}`}
                      title={isTextProcessing ? "Stop" : "Send"}
                      aria-label={isTextProcessing ? "Stop generating" : "Send chat message"}
                    >
                      {isTextProcessing ? (
                        <svg viewBox="-0.5 0 25 25" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17 3.42004H7C4.79086 3.42004 3 5.2109 3 7.42004V17.42C3 19.6292 4.79086 21.42 7 21.42H17C19.2091 21.42 21 19.6292 21 17.42V7.42004C21 5.2109 19.2091 3.42004 17 3.42004Z" fill="var(--text-primary)" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <ArrowUp className="w-5 h-5" />
                      )}
                </button>
              </div>
            </div>
          </div>
            </motion.div>
        )}
        </AnimatePresence>

    

        {/* Bottom Controls */}
        {!isFirstTimeUser && !showVoiceSelection && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8" style={{ zIndex: 20 }}>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleToggleRecording}
                disabled={!browserSupportsSpeechRecognition || !isMicrophoneAvailable}
                className="rounded-full transition-all duration-200 hover:scale-105"
                style={{
                  padding: '18px',
                  background: listening ? 'var(--text-primary)' : 'var(--status-error)',
                  color: listening ? 'var(--bg-primary)' : 'var(--text-white)',
                  border: '1px solid var(--border-primary)',
                  opacity: (!browserSupportsSpeechRecognition || !isMicrophoneAvailable) ? 0.5 : 1
                }}
                title={!browserSupportsSpeechRecognition ? "Browser not supported" : !isMicrophoneAvailable ? "Microphone not available" : listening ? "Mute Microphone" : "Unmute Microphone"}
              >
                {listening ? <Mic className="w-6 h-6" style={{ width: '26px', height: '26px' }} /> : <MicOff className="w-6 h-6" style={{ width: '26px', height: '26px' }} />}
              </button>

              <button
                onClick={() => setShowTextInput(!showTextInput)}
                className="rounded-full transition-all duration-200 hover:scale-105"
                style={{
                  padding: '18px',
                  background: showTextInput ? 'var(--text-primary)' : 'var(--bg-highlight)',
                  color: showTextInput ? 'var(--bg-primary)' : 'var(--text-primary)',
                  border: '1px solid var(--border-primary)'
                }}
                title={showTextInput ? "Hide Text Input" : "Show Text Input"}
              >
                <Keyboard className="w-6 h-6" style={{ width: '26px', height: '26px' }} />
              </button>

              {/* Stop Button - show when AI is speaking or processing text */}
              {(isAISpeaking || isTextProcessing) && (
                <button
                  onClick={() => {
                    if (isAISpeaking) {
                      stopAudio();
                    }
                    if (isTextProcessing) {
                      handleStopTextGeneration();
                    }
                  }}
                  className="rounded-full transition-all duration-200 hover:scale-105"
                  style={{
                    padding: '18px',
                    background: 'var(--status-error)',
                    color: 'var(--text-white)',
                    border: '1px solid var(--border-primary)'
                  }}
                  title={isAISpeaking ? "Stop AI Voice" : "Stop AI Response"}
                >
                  <svg viewBox="-0.5 0 25 25" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '26px', height: '26px' }}>
                    <path d="M17 3.42004H7C4.79086 3.42004 3 5.2109 3 7.42004V17.42C3 19.6292 4.79086 21.42 7 21.42H17C19.2091 21.42 21 19.6292 21 17.42V7.42004C21 5.2109 19.2091 3.42004 17 3.42004Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              <button
                onClick={handleDisconnect}
                className="rounded-full transition-all duration-200 hover:scale-105"
                style={{
                  padding: '18px',
                  background: 'var(--bg-highlight)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)'
                }}
              >
                <X className="w-6 h-6" style={{ width: '26px', height: '26px' }} />
              </button>
            </div>
          </div>
        )}

        {/* Completion Notification */}
        <AnimatePresence>
          {completionNotification && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div 
                className="rounded-xl p-3 shadow-lg border"
                style={{ 
                  background: 'var(--status-success-bg)',
                  borderColor: 'var(--status-success)',
                  color: 'var(--text-primary)'
                }}
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-success)' }} />
                  <span className="text-sm font-medium">{completionNotification.message}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Style Dialog */}
        <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
          <DialogContent className="sm:max-w-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 rounded-lg shadow-xl font-clarika z-[10001]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
                {editingStyle ? 'Edit Custom Style' : 'Create Custom Style'}
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--text-muted)]">
                Create a new personality for TaskMaster to use in your conversations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="style-name" className="text-sm font-medium text-[var(--text-secondary)]">Style Name</label>
                <input id="style-name" value={styleFormData.name} onChange={(e) => setStyleFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition" placeholder="e.g., Chem Tutor"/>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Style Color</label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {CUSTOM_STYLE_COLORS.map((color) => {
                      const { name, ...colorData } = color;
                      return (
                          <button
                              key={color.color}
                              type="button"
                              onClick={() => setStyleFormData(prev => ({ ...prev, ...colorData }))}
                              className={`w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center ${color.color} ${
                              styleFormData.color === color.color
                                  ? ''
                                  : 'hover:opacity-80'
                              }`}
                              title={name}
                          >
                              {styleFormData.color === color.color && <Check className="w-5 h-5 text-white" />}
                          </button>
                      );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="style-description" className="text-sm font-medium text-[var(--text-secondary)]">Description</label>
                <textarea id="style-description" value={styleFormData.description} onChange={(e) => setStyleFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition min-h-[60px] resize-none" placeholder="A brief description of this style." rows={2}/>
              </div>

              <div className="space-y-2">
                <label htmlFor="style-prompt" className="text-sm font-medium text-[var(--text-secondary)]">AI's Instructions</label>
                <textarea id="style-prompt" value={styleFormData.prompt} onChange={(e) => setStyleFormData(prev => ({ ...prev, prompt: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition min-h-[120px] resize-none" placeholder="Instruct TaskMaster on how to behave. For example: 'You're my chill chem tutor who makes hard stuff easy to get.'" rows={5}/>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseStyleDialog} className="px-4 py-2 text-sm rounded-md bg-transparent border-[var(--border-secondary)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]">Cancel</Button>
              <Button
                type="button"
                onClick={handleSaveStyle}
                className={`px-4 py-2 text-sm rounded-md text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${styleFormData.color} ${styleFormData.hoverColor}`}
                disabled={!styleFormData.name || !styleFormData.description || !styleFormData.prompt}
              >
                {editingStyle ? 'Update Style' : 'Create Style'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
};
