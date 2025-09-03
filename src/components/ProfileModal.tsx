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
import { useScrollLock } from '../hooks/useScrollLock';

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
    // Always call useScrollLock to follow rules of hooks
    useScrollLock(isOpen);

    // Early return if no profile
    if (!userProfile) {
        return null;
    }

    const statCardAnimation = {
        whileHover: { scale: 1.05, y: -2 },
        transition: { type: "spring" as const, stiffness: 300, damping: 15 }
    };
    const badgeItemAnimation = {
        whileHover: { scale: 1.08, boxShadow: "0px 4px 12px rgba(0,0,0,0.08)" },
        transition: { type: "spring" as const, stiffness: 400, damping: 10 }
    };

    return (
    <AnimatePresence>
    {isOpen && (
        <motion.div
            key="profile-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--overlay-dark)] backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <motion.div
                key="profile-modal-content"
                initial={{ scale: 0.9, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 15, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative bg-[var(--bg-card)] p-4 sm:p-5 rounded-xl shadow-2xl max-w-4xl w-full border border-[var(--border-primary)] max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--scrollbar-thumb)]"
                style={{ color: 'var(--text-primary)' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 rounded-full hover:bg-[var(--interactive-hover)] transition-colors z-10"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label="Close profile modal"
                >
                    <X className="w-4 h-4" />
                </button>

                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.3 }}
                    className="flex flex-col sm:flex-row items-center mb-5 pb-3 border-b border-[var(--border-primary)]"
                >
                    {userProfile.photoURL ? (
                        <motion.img
                            src={userProfile.photoURL} alt="Profile"
                            className="w-16 h-16 rounded-full mr-0 sm:mr-3 mb-2 sm:mb-0 shadow-sm"
                            whileHover={{ scale: 1.03, rotate: 1 }}
                        />
                    ) : (
                        <motion.div whileHover={{ scale: 1.03 }}>
                           <UserIconLucide className="w-16 h-16 rounded-full mr-0 sm:mr-3 mb-2 sm:mb-0 p-3 bg-[var(--bg-highlight)] shadow-sm" style={{ color: 'var(--text-primary)' }}/>
                        </motion.div>
                    )}
                    <div className="text-center sm:text-left">
                        <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{userProfile.displayName || userName}</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{userProfile.email}</p>
                    </div>
                </motion.div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                    {[
                        { label: 'Points', value: userProfile.points ?? 0, icon: TrendingUp, color: 'var(--text-primary)', textColor: 'var(--text-primary)' },
                        { label: 'Level', value: userProfile.level ?? 0, icon: Award, color: 'var(--text-primary)', textColor: 'var(--text-primary)' },
                        { label: 'Streak', value: userProfile.overallStreakCount ?? 0, icon: Flame, color: 'var(--text-primary)', textColor: 'var(--text-primary)' },
                        { label: 'Badges', value: (userProfile.badges || []).length, icon: Trophy, color: 'var(--text-primary)', textColor: 'var(--text-primary)' },
                    ].map(stat => {
                        const StatIcon = stat.icon;
                        return (
                            <motion.div
                                key={stat.label}
                                className="bg-[var(--bg-highlight)] p-2.5 rounded-lg text-center shadow-sm border border-[var(--border-primary)]"
                                {...statCardAnimation}
                            >
                                <StatIcon className="w-5 h-5 mx-auto mb-0.5" style={{ color: stat.color }} />
                                <p className="text-xl font-semibold" style={{ color: stat.textColor }}>{stat.value}</p>
                                <p className="text-[9px] sm:text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                            </motion.div>
                        );
                    })}
                </div>

                {userProfile.premiumAwardedUntil && (toDateSafe(userProfile.premiumAwardedUntil) || new Date(0)) > new Date() && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                        className="mb-5 p-2.5 bg-[var(--status-success)] border border-[var(--status-success)] rounded-lg text-center shadow-md"
                    >
                        <Crown className="w-6 h-6 mx-auto mb-0.5 text-white"/>
                        <p className="text-xs font-semibold text-white">
                            Free Premium Active!
                        </p>
                        <p className="text-[10px] text-white/90">Expires: {(toDateSafe(userProfile.premiumAwardedUntil) || new Date(0)).toLocaleDateString()}</p>
                    </motion.div>
                )}

                <h4 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>My Achievements</h4>
                <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-3 mb-3">
                    {Object.entries(ALL_BADGES_CONFIG).map(([badgeKey, badgeConfig]) => {
                        const isUnlocked = (userProfile.badges || []).includes(badgeKey);
                        const IconComponent = badgeConfig.icon;
                        return (
                            <motion.div
                                key={badgeKey}
                                title={isUnlocked ? `${badgeConfig.name}: ${badgeConfig.description}` : `${badgeConfig.name} (Locked) - Unlock: ${badgeConfig.unlock_criteria_text}`}
                                className={`group relative flex flex-col items-center p-2 ${isUnlocked ? 'bg-[var(--bg-highlight)]' : 'bg-[var(--bg-card)]'} rounded-md shadow-sm border border-[var(--border-primary)] text-center transition-all duration-200 ${!isUnlocked ? 'opacity-50 grayscale filter' : 'hover:border-[var(--bg-accent)]'}`}
                                {...badgeItemAnimation}
                            >
                                <IconComponent className="w-5 h-5 mb-1" style={{ color: isUnlocked ? 'var(--bg-accent)' : 'var(--text-muted)' }} />
                                <span className="text-[9px] leading-snug font-medium" style={{ color: isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{badgeConfig.name}</span>

                                {!isUnlocked ? (
                                    <div className="absolute top-0.5 right-0.5 bg-[var(--text-muted)]/20 p-0.5 rounded-full">
                                        <Lock className="w-2 h-2 text-white" />
                                    </div>
                                ) : (
                                    <div className="absolute top-0.5 right-0.5 bg-[var(--status-success)]/20 p-0.5 rounded-full">
                                        <Check className="w-2 h-2 text-white" />
                                    </div>
                                )}
                                {!isUnlocked && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[180px] p-1.5 bg-[var(--overlay-dark)] text-white text-[9px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20">
                                      {badgeConfig.unlock_criteria_text}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
                 {Object.keys(ALL_BADGES_CONFIG).length === 0 && (
                    <p className="text-xs italic mt-1" style={{ color: 'var(--text-muted)' }}>Badges are being polished. Check back soon!</p>
                )}
            </motion.div>
        </motion.div>
    )}
    </AnimatePresence>
  );
}
