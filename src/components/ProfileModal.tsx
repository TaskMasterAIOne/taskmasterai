import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User as UserIconLucide, TrendingUp, Award, Flame, Trophy,
    Crown, Lock, Check, Pencil, FileText, Youtube, Sparkles, Layers,
    Briefcase, MessageCircle, Share2, SplitSquareVertical, FolderPlus,
    Folders as FoldersIcon, FolderTree, PackagePlus, ListTodo, Play,
    BookOpen, Brain, CheckSquare as CheckSquareIcon, MessageCircle as MessageCircleIcon, Target, Upload,
    Palette, SlidersHorizontal, UserCheck, GraduationCap, BarChart3, BarChart,
    Milestone, Zap, ShieldCheck, FileQuestion
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { UserProfileData } from '../lib/current-paying-user';

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
    level10Reached: { name: "Level 10 Expert", description: "Reached overall level 10.", icon: Crown, unlock_criteria_text: "Reach Level 10" },
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

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: UserProfileData | null;
    userName: string;
}

export const ProfileModal = ({ isOpen, onClose, userProfile, userName }: ProfileModalProps) => {
    if (!userProfile) return null;

    const statCardAnimation = {
        whileHover: { scale: 1.05, y: -2 },
        transition: { type: "spring", stiffness: 300, damping: 15 }
    };
    const badgeItemAnimation = {
        whileHover: { scale: 1.08, boxShadow: "0px 4px 12px rgba(0,0,0,0.08)" },
        transition: { type: "spring", stiffness: 400, damping: 10 }
    };

    return (
    <AnimatePresence>
    {isOpen && (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 15, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative bg-gradient-to-br from-slate-50 to-gray-100 dark:from-[#10121c] dark:to-[#131520] p-4 sm:p-5 rounded-xl shadow-2xl max-w-4xl w-full text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors z-10"
                    aria-label="Close profile modal"
                >
                    <X className="w-4 h-4" />
                </button>

                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.3 }}
                    className="flex flex-col sm:flex-row items-center mb-5 pb-3 border-b border-gray-200 dark:border-gray-700/50"
                >
                    {userProfile.photoURL ? (
                        <motion.img
                            src={userProfile.photoURL} alt="Profile"
                            className="w-16 h-16 rounded-full mr-0 sm:mr-3 mb-2 sm:mb-0 border-2 border-indigo-500/60 dark:border-indigo-400/60 shadow-sm"
                            whileHover={{ scale: 1.03, rotate: 1 }}
                        />
                    ) : (
                        <motion.div whileHover={{ scale: 1.03 }}>
                           <UserIconLucide className="w-16 h-16 rounded-full mr-0 sm:mr-3 mb-2 sm:mb-0 p-3 bg-indigo-100 dark:bg-indigo-800/40 text-indigo-500 dark:text-indigo-300 border-2 border-indigo-500/60 dark:border-indigo-400/60 shadow-sm"/>
                        </motion.div>
                    )}
                    <div className="text-center sm:text-left">
                        <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500 bg-clip-text text-transparent">{userProfile.displayName || userName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{userProfile.email}</p>
                    </div>
                </motion.div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                    {[
                        { label: 'Points', value: userProfile.points, icon: TrendingUp, color: 'text-indigo-500 dark:text-indigo-400', gradient: 'from-indigo-400 to-purple-500' },
                        { label: 'Level', value: userProfile.level, icon: Award, color: 'text-green-500 dark:text-green-400', gradient: 'from-green-400 to-emerald-500' },
                        { label: 'Streak', value: userProfile.overallStreakCount, icon: Flame, color: 'text-orange-500 dark:text-orange-400', gradient: 'from-orange-400 to-amber-500' },
                        { label: 'Badges', value: (userProfile.badges || []).length, icon: Trophy, color: 'text-yellow-500 dark:text-yellow-400', gradient: 'from-yellow-400 to-amber-500' },
                    ].map(stat => (
                        <motion.div
                            key={stat.label}
                            className="bg-white dark:bg-slate-800/50 p-2.5 rounded-lg text-center shadow-sm border border-gray-200 dark:border-gray-700/50"
                            {...statCardAnimation}
                        >
                            <stat.icon className={`w-5 h-5 mx-auto mb-0.5 ${stat.color}`} />
                            <p className={`text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`}>{stat.value}</p>
                            <p className="text-[9px] sm:text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {userProfile.premiumAwardedUntil && (toDateSafe(userProfile.premiumAwardedUntil) || new Date(0)) > new Date() && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                        className="mb-5 p-2.5 bg-gradient-to-r from-green-400 to-emerald-500 dark:from-green-600 dark:to-emerald-700 border border-green-500 dark:border-green-600 rounded-lg text-center shadow-md text-white"
                    >
                        <Crown className="w-6 h-6 mx-auto mb-0.5"/>
                        <p className="text-xs font-semibold">
                            Free Premium Active!
                        </p>
                        <p className="text-[10px]">Expires: {(toDateSafe(userProfile.premiumAwardedUntil) || new Date(0)).toLocaleDateString()}</p>
                    </motion.div>
                )}

                <h4 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-200">My Achievements</h4>
                <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-3 mb-3">
                    {Object.entries(ALL_BADGES_CONFIG).map(([badgeKey, badgeConfig]) => {
                        const isUnlocked = (userProfile.badges || []).includes(badgeKey);
                        const Icon = badgeConfig.icon;
                        return (
                            <motion.div
                                key={badgeKey}
                                title={isUnlocked ? `${badgeConfig.name}: ${badgeConfig.description}` : `${badgeConfig.name} (Locked) - Unlock: ${badgeConfig.unlock_criteria_text}`}
                                className={`group relative flex flex-col items-center p-2 bg-white dark:bg-slate-800/50 rounded-md shadow-sm border border-gray-200 dark:border-gray-700/60 text-center transition-all duration-200 ${!isUnlocked ? 'opacity-50 grayscale filter' : 'hover:border-indigo-300 dark:hover:border-indigo-500'}`}
                                {...badgeItemAnimation}
                                layout
                            >
                                <Icon className={`w-5 h-5 mb-1 ${isUnlocked ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                <span className={`text-[9px] leading-snug font-medium ${isUnlocked ? 'text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>{badgeConfig.name}</span>

                                {!isUnlocked && ( <div className="absolute top-0.5 right-0.5 bg-gray-500/20 dark:bg-gray-900/40 p-0.5 rounded-full"> <Lock className="w-2 h-2 text-white dark:text-gray-300" /> </div> )}
                                 {isUnlocked && ( <div className="absolute top-0.5 right-0.5 bg-green-500/20 dark:bg-green-900/40 p-0.5 rounded-full"> <Check className="w-2 h-2 text-white dark:text-green-300" /> </div> )}
                                <AnimatePresence>
                                  {!isUnlocked && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 8 }}
                                      exit={{ opacity: 0, y: 8, transition: { duration: 0.1 } }}
                                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[180px] p-1.5 bg-black/75 text-white text-[9px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20"
                                    >
                                      {badgeConfig.unlock_criteria_text}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
                 {Object.keys(ALL_BADGES_CONFIG).length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">Badges are being polished. Check back soon!</p>
                )}
            </motion.div>
        </motion.div>
    )}
    </AnimatePresence>
  );
}