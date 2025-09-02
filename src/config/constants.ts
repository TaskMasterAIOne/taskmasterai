// Central Configuration File
// =================================================================================================
// This file contains all hardcoded values, configurations, and constants
// to ensure consistency, maintainability, and easy updates across the codebase
// =================================================================================================

// Firebase Configuration
// Using environment variables with fallbacks for security and flexibility
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDaMAlQRMXiDsZ4P0b06P18id3y5xBiZ1k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "deepworkai-c3419.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "deepworkai-c3419",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "deepworkai-c3419.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "367439182644",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:367439182644:web:304216430df97eff68c361",
} as const;

// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  youtubeApiKey: import.meta.env.VITE_YOUTUBE_API_KEY || '', // No fallback for security
} as const;

// Stripe Configuration
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '', // No fallback for security
} as const;

// AI Model Configurations - ONLY using allowed Gemini 2.5 models
export const AI_MODELS = {
  // ONLY allowed models: gemini-2.5 variants
  default: "gemini-2.5-flash",
  lite: "gemini-2.5-flash-lite", 
  imageGeneration: "gemini-2.5-flash-image-preview",
  
  // Fallback models (only allowed 2.5 models)
  fallback: "gemini-2.5-flash",
} as const;

// User Tier Configurations
export const USER_TIERS = {
  basic: 'basic',
  pro: 'pro', 
  premium: 'premium',
  loading: 'loading'
} as const;

// Premium/Pro User Lists (centralized for consistency)
export const PREMIUM_EMAILS = [
  "bajinsrinivasr@lexington1.net",
  "1cosmic20@gmail.com", 
  "amlitha@gmail.com",
  "suryar9108@gmail.com",
  "poojarameshkumar789@gmail.com",
  "achallapureddy@gmail.com",
  "ali.ahsan.a214@gmail.com",
  "amrish.naranappa@gmail.com",
  "navaneeth.ravindranath@gmail.com",
  "Goduwin_Ravi@yahoo.com",
  "gautham.paddu@outlook.com",
  "draco77654@gmail.com",
  "Isha.kandhaluram@gmail.com",
  "learner@example.com",
  "draco77654@gmail.com",
  "rithikrt1@gmail.com",
  "Mithun.kutuva@gmail.com",
  "rickmrreddy@gmail.com",
  "shankartkraj@gmail.com",
  "akaash.chirravuri@gmail.com"
] as const;

export const PRO_EMAILS = [
  "srinibaj10@gmail.com"
] as const;

export const DEV_EMAILS = [
  "bajinsrinivasr@lexington1.net", "draco77654@gmail.com"
] as const;

export const INTERN_EMAILS = [
  "poojarameshkumar789@gmail.com",
  "srinibaj10@gmail.com", 
  "ali.ahsan.a214@gmail.com",
  "amrish.naranappa@gmail.com",
  "navaneeth.ravindranath@gmail.com",
  "Goduwin_Ravi@yahoo.com",
  "gautham.paddu@outlook.com",
  "Isha.kandhaluram@gmail.com",
  "rithikrt1@gmail.com",
  "Mithun.kutuva@gmail.com",
  "rickmrreddy@gmail.com", 
  "shankartkraj@gmail.com",
  "akaash.chirravuri@gmail.com"
] as const;

// Chat Limits by Tier
export const CHAT_LIMITS = {
  [USER_TIERS.basic]: 25,
  [USER_TIERS.pro]: 100,
  [USER_TIERS.premium]: Infinity,
  [USER_TIERS.loading]: 0
} as const;

// Rate Limiting Configuration by Tier
export const RATE_LIMITS = {
  // API calls per minute
  api: {
    [USER_TIERS.basic]: 20,     // 20 API calls per minute
    [USER_TIERS.pro]: 60,       // 60 API calls per minute  
    [USER_TIERS.premium]: 120,  // 120 API calls per minute
    [USER_TIERS.loading]: 5     // Very limited for loading state
  },
  // Chat messages per minute
  chat: {
    [USER_TIERS.basic]: 10,     // 10 chats per minute
    [USER_TIERS.pro]: 30,       // 30 chats per minute
    [USER_TIERS.premium]: 60,   // 60 chats per minute
    [USER_TIERS.loading]: 2     // Very limited for loading state
  },
  // Note processing per hour
  notes: {
    [USER_TIERS.basic]: 5,      // 5 notes per hour
    [USER_TIERS.pro]: 20,       // 20 notes per hour
    [USER_TIERS.premium]: 100,  // 100 notes per hour
    [USER_TIERS.loading]: 1     // Very limited for loading state
  },
  // File uploads per hour
  uploads: {
    [USER_TIERS.basic]: 10,     // 10 uploads per hour
    [USER_TIERS.pro]: 50,       // 50 uploads per hour
    [USER_TIERS.premium]: 200,  // 200 uploads per hour
    [USER_TIERS.loading]: 2     // Very limited for loading state
  },
  // Image generation per day
  imageGen: {
    [USER_TIERS.basic]: 5,      // 5 images per day
    [USER_TIERS.pro]: 25,       // 25 images per day
    [USER_TIERS.premium]: 100,  // 100 images per day
    [USER_TIERS.loading]: 1     // Very limited for loading state
  }
} as const;

// Note Limits by Tier
export const NOTE_LIMITS = {
  pdfAi: {
    [USER_TIERS.basic]: 5,
    [USER_TIERS.pro]: 15, 
    [USER_TIERS.premium]: Infinity
  },
  youtube: {
    [USER_TIERS.basic]: 3,
    [USER_TIERS.pro]: 10,
    [USER_TIERS.premium]: Infinity
  }
} as const;

// Allowed Origins for CORS
export const ALLOWED_ORIGINS = [
  "https://www.taskmaster.one",
  "https://taskmaster.one", 
  "http://localhost:5173"
] as const;

// Google OAuth Scopes
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar"
] as const;

// File Processing Configurations
export const FILE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  supportedDocumentTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ] as const,
  retryAttempts: 3,
  retryDelayMs: 3000
} as const;

// UI Configuration
export const UI_CONFIG = {
  defaultFontSize: '16px',
  sidebarBreakpoint: 768, // px
  mobileBreakpoint: 640, // px
  animationDuration: 300, // ms
  toastDuration: 5000, // ms
} as const;

// Performance Configurations
export const PERFORMANCE_CONFIG = {
  debounceDelay: 300, // ms
  throttleDelay: 100, // ms
  virtualScrollThreshold: 100, // items
  lazyLoadOffset: 200, // px
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxConcurrentRequests: 3, // max parallel API calls
  imageCompressionQuality: 0.8, // 80% quality
  memoryTimeout: 10 * 60 * 1000, // 10 minutes for memory cleanup
} as const;

// Large Import Optimizations
export const LAZY_COMPONENTS = {
  // Components that should be lazy loaded
  sunEditor: () => import('suneditor'),
  speechRecognition: () => import('react-speech-recognition'),
  reactCrop: () => import('react-image-crop'),
} as const;

// External API URLs
export const EXTERNAL_APIS = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  youtube: "https://www.googleapis.com/youtube/v3",
  elevenlabs: "https://api.elevenlabs.io/v1",
  notion: "https://api.notion.com/v1",
  stripe: "https://api.stripe.com/v1"
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  auth: {
    required: "Authentication is required",
    expired: "Session has expired, please log in again",
    invalid: "Invalid credentials"
  },
  file: {
    tooLarge: "File size exceeds the maximum limit",
    unsupported: "File type is not supported",
    corrupted: "File appears to be corrupted"
  },
  network: {
    offline: "You appear to be offline",
    timeout: "Request timed out, please try again",
    server: "Server error, please try again later"
  },
  limits: {
    chatExceeded: "Chat limit exceeded for your tier",
    noteExceeded: "Note limit exceeded for your tier"
  }
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  saved: "Successfully saved",
  updated: "Successfully updated", 
  deleted: "Successfully deleted",
  uploaded: "Successfully uploaded",
  connected: "Successfully connected"
} as const;

// Type definitions for better TypeScript support
export type UserTier = keyof typeof CHAT_LIMITS;
export type SupportedImageType = typeof FILE_CONFIG.supportedImageTypes[number];
export type SupportedDocumentType = typeof FILE_CONFIG.supportedDocumentTypes[number];
export type AllowedOrigin = typeof ALLOWED_ORIGINS[number];
