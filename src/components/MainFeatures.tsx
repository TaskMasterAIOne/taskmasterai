
import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
  useMotionValue,
} from "framer-motion";
import {
  LayoutDashboard,
  NotebookPen,
  Settings,
  Users,
  Users2,
  Bot,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Share2,
  BrainCircuit,
  CalendarDays,
  Sparkles,
  Send,
  Plus,
  Search,
  X,
  Upload,
  Youtube,
  Mic,
  Filter,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Edit2,
  Save,
  Tag,
  Paperclip,
  Smile,
  MoreVertical,
  Globe,
  CircleUserRound,
  Coins,
  FileJson,
  Presentation,
  Folder as FolderIcon,
  Lightbulb,
  Layers,
  BookOpen,
  GraduationCap,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const GlowingBorder = ({ children, className = "" }) => (
  <div className={`relative rounded-xl overflow-hidden ${className}`}>
    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 opacity-75 blur-lg" />
    <div className="relative bg-gray-900/95 h-full rounded-xl p-[1px] overflow-hidden">
      {children}
    </div>
  </div>
);

const FloatingElements = ({ children, count = 10, className = "" }) => {
  const elements = Array.from({ length: count }).map((_, i) => {
    const size = Math.random() * 10 + 5;
    const initialX = Math.random() * 100;
    const initialY = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;

    return (
      <motion.div
        key={i}
        className="absolute rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-sm opacity-80"
        style={{
          width: size,
          height: size,
          left: `${initialX}%`,
          top: `${initialY}%`,
        }}
        animate={{
          x: [0, Math.random() * 100 - 50, 0],
          y: [0, Math.random() * 100 - 50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration,
          repeat: Infinity,
          delay,
          ease: "easeInOut",
        }}
      />
    );
  });

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {elements}
      {children}
    </div>
  );
};

const ParallaxText = ({ children, baseVelocity = 100 }) => {
  const baseX = useMotionValue(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const directionChangeInterval = setInterval(() => {
      setDirection((prev) => prev * -1);
    }, 10000);
    return () => clearInterval(directionChangeInterval);
  }, []);

  useEffect(() => {
    let animationFrameId;
    let lastTimestamp = performance.now();
    const update = (timestamp) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animationFrameId = requestAnimationFrame(update);
        return;
      }
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const moveBy = (baseVelocity / 60) * (elapsed / 16.67) * direction;
      const currentX = baseX.get();
      let newX = currentX + moveBy;
      const wrapThreshold = -1000;
      if (direction === -1 && newX < wrapThreshold) {
        newX -= wrapThreshold;
      } else if (direction === 1 && newX > 0) {

      }
      baseX.set(newX);
      animationFrameId = requestAnimationFrame(update);
    };
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);

  }, [baseVelocity, direction, baseX]);

  const x = useTransform(baseX, (v) => `${(v % 100)}%`);

  return (
    <div className="overflow-hidden whitespace-nowrap flex items-center my-8 w-full">
      <motion.div
        className="flex whitespace-nowrap text-4xl font-bold text-gray-800/5"
        style={{ x }}
      >
        {[...Array(8)].map((_, i) => (
          <span key={i} className="block mr-8">
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

export default function MainFeatures() {
  return (
    <>
      <DashboardSection />
      <NotesSection />
      <FoldersSection />
      <StudyGroupsSection />
      <StudentHubSection />
      <AIAssistantSection />
      <CalendarSection />
      <StudentTestimonialsSection />
      <StudentCTASection />
    </>
  );
}

function useParallax(value, distance) {
  return useTransform(value, [0, 1], [-distance, distance]);
}

function DashboardSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useParallax(scrollYProgress, 100);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);

  const springY = useSpring(y, { stiffness: 100, damping: 30 });
  const springOpacity = useSpring(opacity, { stiffness: 100, damping: 30 });
  const springScale = useSpring(scale, { stiffness: 100, damping: 30 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
    },
  };

  const featureItems = [
    { icon: Clock, text: "Customizable study timers with Pomodoro technique" },
    { icon: CheckCircle, text: "Assignment & task tracking with smart reminders" },
    { icon: CalendarDays, text: "Calendar sync for classes, exams, and deadlines" },
    { icon: FileText, text: "Track your study progress and learning goals" },
  ];

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={5}>DASHBOARD STUDY ORGANIZATION FOCUS</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm mb-6"
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400 mr-2" />
              <span className="text-sm text-indigo-300">
                Your Ultimate Study Hub
              </span>
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              Ace Your Studies: All-in-One Dashboard
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-300 mb-8 leading-relaxed"
            >
              Organize your courses, track assignments, manage your study schedule, and conquer your exams. Everything you need to succeed, all in one place.
            </motion.p>

            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              {featureItems.map((item, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex items-start gap-4"
                >
                  <div className="p-2 rounded-lg bg-indigo-500/10 flex-shrink-0">
                    <item.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-gray-300">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants}>
              <motion.a
                href="/dashboard"
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Explore Your Dashboard</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>

          <motion.div
            className="lg:w-1/2"
            style={{
              y: springY,
              opacity: springOpacity,
              scale: springScale,
            }}
          >
            <GlowingBorder className="shadow-2xl shadow-indigo-500/20">
              <div className="relative bg-gray-900 rounded-xl overflow-hidden p-1">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 opacity-50" />
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/Screenshot%202025-02-17%20at%202.41.40%E2%80%AFPM.png?alt=media&token=cb886770-2359-46e2-8469-e2447d13dba4"
                  alt="Student Dashboard"
                  className="rounded-lg relative z-10 w-full"
                />
                <motion.div
                  className="absolute top-6 right-6 bg-indigo-500/30 backdrop-blur-md rounded-lg p-3 border border-indigo-500/40 z-20 shadow-lg"
                  animate={{
                    y: [0, -8, 0],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Clock className="w-5 h-5 text-indigo-200" />
                </motion.div>
                <motion.div
                  className="absolute bottom-6 left-6 bg-purple-500/30 backdrop-blur-md rounded-lg p-3 border border-purple-500/40 z-20 shadow-lg"
                  animate={{
                    y: [0, 8, 0],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                >
                  <CheckCircle className="w-5 h-5 text-purple-200" />
                </motion.div>
              </div>
            </GlowingBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function NotesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const springX = useSpring(x, { stiffness: 100, damping: 30 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
    },
  };

  const noteTypes = [
    { title: "Lecture Notes", icon: FileText, color: "from-indigo-500 to-blue-500" },
    { title: "Video Summaries", icon: Youtube, color: "from-purple-500 to-pink-500" },
    { title: "PDF Highlights", icon: FileJson, color: "from-pink-500 to-red-500" },
    { title: "Audio Transcripts", icon: Mic, color: "from-blue-500 to-cyan-500" },
  ];

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notes, setNotes] = useState([
    {
      id: 1,
      title: "Biology 101 - Mitosis Lecture",
      content:
        "### Key Concepts\n\n*   Phases of Mitosis: Prophase, Metaphase, Anaphase, Telophase\n*   Importance of checkpoints\n*   Cytokinesis process\n\n### To Review\n\n- [ ] Diagram of spindle fibers\n- [ ] Role of cyclins and CDKs",
      type: "text",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ["biology", "mitosis", "lecture"],
    },
    {
      id: 2,
      title: "History Ch.5 - The Renaissance",
      content:
        "## Key Figures of the Renaissance\n\n1.  **Leonardo da Vinci:** Artist, inventor (Mona Lisa, Last Supper).\n2.  **Michelangelo:** Sculptor, painter (David, Sistine Chapel).\n3.  **Raphael:** Painter (School of Athens).",
      type: "pdf",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      tags: ["history", "renaissance", "summary"],
    },
    {
      id: 3,
      title: "Calculus - Integration Techniques",
      content:
        "*   Integration by Parts Formula: ∫u dv = uv - ∫v du\n*   Trigonometric Substitution\n*   Partial Fractions",
      type: "text",
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      tags: ["calculus", "integration", "formulas"],
    },
  ]);
  const [selectedNote, setSelectedNote] = useState(notes[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openModalForCreate = () => {
    setNoteTitle("");
    setNoteContent("");
    setIsEditing(false);
    setSelectedNote(null);
    setShowNoteModal(true);
  };

  const openModalForEdit = (note) => {
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setSelectedNote(note);
    setIsEditing(true);
    setShowNoteModal(true);
  };

  const handleSaveNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    if (isEditing && selectedNote) {
      const updatedNotes = notes.map((note) =>
        note.id === selectedNote.id
          ? {
              ...note,
              title: noteTitle,
              content: noteContent,
              updatedAt: new Date().toISOString(),
            }
          : note
      );
      setNotes(updatedNotes);
      const newlyUpdatedNote = updatedNotes.find(n => n.id === selectedNote.id);
      setSelectedNote(newlyUpdatedNote || null);
    } else {
      const newNote = {
        id: Date.now(),
        title: noteTitle,
        content: noteContent,
        type: "text",
        createdAt: new Date().toISOString(),
        tags: [],
      };
      setNotes([newNote, ...notes]);
      setSelectedNote(newNote);
    }
    setShowNoteModal(false);
  };

  const handleDeleteNote = (id) => {
    setNotes(notes.filter((note) => note.id !== id));
    if (selectedNote?.id === id) {
       const newSelected = filteredNotes.find(n => n.id !== id);
       setSelectedNote(newSelected || (filteredNotes.length > 1 ? filteredNotes[0] : null) );
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  };

  return (
    <section
      ref={ref}
      className="relative py-32 overflow-hidden bg-gray-900/90 backdrop-blur-sm"
    >
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={-5}>NOTES KNOWLEDGE CAPTURE AI-ASSIST</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm mb-6"
            >
              <Pencil className="w-4 h-4 text-purple-400 mr-2" />
              <span className="text-sm text-purple-300">
                Smarter Note-Taking
              </span>
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent"
            >
              Smarter Notes, Better Grades
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-300 mb-4 leading-relaxed"
            >
              Capture everything from lectures, textbooks, videos, and PDFs. Our AI helps you understand, summarize, and organize your study material effectively.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="p-4 rounded-lg bg-gray-800/50 border border-purple-500/30 mb-8"
            >
              <div className="flex items-start gap-3">
                <Bot className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-purple-300 mb-1">Your AI Note-Taking Assistant</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Beyond summaries, our AI acts like a helpful study buddy. Ask it to <strong>create tables from your text, reformat sections for clarity, add examples to concepts, or even explain complex parts directly within your notes!</strong> It actively works with you to make your study materials powerful.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={containerVariants}
              className="grid grid-cols-2 gap-4 mb-8"
            >
              {noteTypes.map((note, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className={`p-4 rounded-xl bg-gradient-to-br ${note.color} bg-opacity-10 border border-purple-500/20 backdrop-blur-sm shadow-md`}
                  whileHover={{
                    scale: 1.05,
                    y: -5,
                    boxShadow:
                      "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <note.icon className="w-5 h-5 text-white/80" />
                    <h3 className="text-white font-medium text-center">
                      {note.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="flex gap-4">
              <motion.button
                onClick={openModalForCreate}
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-5 h-5 mr-2" />
                <span>Create New Note</span>
              </motion.button>
            </motion.div>
          </motion.div>

          <motion.div
            className="lg:w-1/2 w-full"
            style={{ x: isInView ? springX : 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 30 }}
          >
            <GlowingBorder className="shadow-2xl shadow-purple-500/20">
              <div className="bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl flex flex-col lg:flex-row gap-4 min-h-[500px]">
                <div className="w-full lg:w-1/3 flex flex-col border-r border-gray-700/50 lg:pr-4">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-white">
                      Your Study Notes
                    </h3>
                    <button
                      onClick={openModalForCreate}
                      className="p-1.5 text-purple-400 hover:text-purple-300 rounded-full hover:bg-gray-700/50 transition-colors"
                      title="Create New Note"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="relative mb-4 flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-gray-700/60 text-gray-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/70 border border-transparent focus:border-purple-500/50 text-sm"
                    />
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-grow pr-1">
                    {filteredNotes.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">
                        No notes found. Start studying!
                      </p>
                    ) : (
                      filteredNotes.map((note) => (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className={`p-3 rounded-lg transition-colors cursor-pointer border ${
                            selectedNote?.id === note.id
                              ? "bg-gray-700 border-purple-500/50"
                              : "bg-gray-700/40 border-transparent hover:bg-gray-600/60"
                          }`}
                          onClick={() => setSelectedNote(note)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-white font-medium text-sm truncate pr-2">
                              {note.title}
                            </h4>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModalForEdit(note);
                                }}
                                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-500/30 transition-colors"
                                title="Edit Note"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-500/30 transition-colors"
                                title="Delete Note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-300/80 text-xs mt-1 line-clamp-2">
                            {note.content.substring(0, 100)}...
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full capitalize flex items-center gap-1">
                              {note.type === "text" ? (
                                <FileText size={12} />
                              ) : (
                                <FileJson size={12} />
                              )}
                              {note.type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(note.createdAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="w-full lg:w-2/3 flex flex-col">
                  <AnimatePresence mode="wait">
                    {selectedNote ? (
                      <motion.div
                        key={selectedNote.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="bg-gray-700/30 rounded-lg p-4 sm:p-6 flex-grow flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-600/50 flex-shrink-0">
                          <h3 className="text-xl font-semibold text-white">
                            {selectedNote.title}
                          </h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openModalForEdit(selectedNote)}
                              className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-600/50"
                              title="Edit Note"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(selectedNote.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-600/50"
                              title="Delete Note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none overflow-y-auto flex-grow text-gray-200">
                          <ReactMarkdown
                            components={{
                              h1: ({ node, ...props }) => (
                                <h1 className="text-xl font-semibold text-white" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-lg font-medium text-white mt-4 mb-2" {...props} />
                              ),
                            }}
                          >
                            {selectedNote.content}
                          </ReactMarkdown>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty-preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-6 bg-gray-700/20 rounded-lg flex-grow"
                      >
                        <NotebookPen size={48} className="mb-4 opacity-50" />
                        <p>Select a note to view or create a new one!</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </GlowingBorder>

            <motion.div
              className="absolute top-10 right-10 sm:top-20 sm:-right-5 z-0"
              initial={{ rotate: -3, scale: 0.9 }}
              animate={{ rotate: [-3, 3, -3], scale: [0.9, 1, 0.9] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            >
              <div className="p-1 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-pink-600">
                <div className="bg-gray-900 p-3 rounded-full">
                  <Pencil className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showNoteModal && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <motion.div
              className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full shadow-xl"
              variants={modalVariants}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  {isEditing ? "Edit Note" : "Create New Study Note"}
                </h3>
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                    placeholder="e.g., Chapter 1 Summary, Lab Report Ideas..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Content (Markdown supported)
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[250px] placeholder-gray-500 resize-y"
                    placeholder="Start typing your notes, formulas, or ideas..."
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 text-gray-400 hover:text-purple-400 rounded-full hover:bg-gray-700/50 transition-colors"
                      title="Add Tags (Coming Soon)"
                    >
                      <Tag className="w-5 h-5" />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-400 rounded-full hover:bg-gray-700/50 transition-colors"
                      title="Attach File (Coming Soon)"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowNoteModal(false)}
                      className="px-4 py-2 text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={!noteTitle.trim() || !noteContent.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      {isEditing ? "Save Changes" : "Create Note"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function FoldersSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useParallax(scrollYProgress, 100);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  };

  const features = [
    { icon: Layers, text: "Dedicated folders for every subject or course." },
    { icon: Lightbulb, text: "Easily create and organize digital flashcards." },
    { icon: Pencil, text: "Generate practice questions to test your knowledge." },
  ];

  const [folders, setFolders] = useState([
    { id: 1, name: "Biology 101", icon: FolderIcon, items: 25, selected: true, color: "text-green-400", bgColor: "bg-green-500/20" },
    { id: 2, name: "Calculus II", icon: FolderIcon, items: 15, selected: false, color: "text-blue-400", bgColor: "bg-blue-500/20" },
    { id: 3, name: "History Midterm Prep", icon: FolderIcon, items: 40, selected: false, color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
    { id: 4, name: "Literature Essays", icon: FolderIcon, items: 8, selected: false, color: "text-purple-400", bgColor: "bg-purple-500/20" },
  ]);
  const [selectedFolderData, setSelectedFolderData] = useState({
    name: "Biology 101",
    flashcards: [
      { id: 'f1', term: "Mitochondria", definition: "Powerhouse of the cell. Site of cellular respiration." },
      { id: 'f2', term: "Photosynthesis", definition: "Process plants use to convert light energy into chemical energy." },
      { id: 'f3', term: "Cell Membrane", definition: "Selectively permeable barrier enclosing the cell." },
    ],
    questions: [
      { id: 'q1', question: "What are the four main stages of mitosis?" },
      { id: 'q2', question: "Explain the difference between active and passive transport." },
    ]
  });

  const handleSelectFolder = (id) => {
    setFolders(folders.map(f => ({ ...f, selected: f.id === id })));
    const folder = folders.find(f => f.id === id);
    if (folder) {
      setSelectedFolderData({
        name: folder.name,
        flashcards: folder.name.includes("Bio") ?
          [
            { id: 'f1', term: "Mitochondria", definition: "Powerhouse of the cell. Site of cellular respiration." },
            { id: 'f2', term: "Ribosome", definition: "Site of protein synthesis." }
          ] : folder.name.includes("Calc") ?
          [
            { id: 'f1', term: "Derivative", definition: "Instantaneous rate of change of a function." },
            { id: 'f2', term: "Integral", definition: "Area under the curve of a function." }
          ] :
          [
            { id: 'f1', term: "Primary Source", definition: "Original document or artifact created at the time under study." },
          ],
        questions: folder.name.includes("History") ?
          [
            { id: 'q1', question: "What were the main causes of World War I?" },
            { id: 'q2', question: "Describe the impact of the Printing Press." }
          ] : folder.name.includes("Literature") ?
          [
            { id: 'q1', question: "What is a common theme in Shakespearean tragedies?" }
          ] :
          [
            { id: 'q1', question: "What is the significance of the 'p-value' in statistics?" }
          ],
      });
    }
  };

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={5}>FOLDERS STUDY-TOOLS ORGANIZE LEARN-AI</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-sm mb-6"
            >
              <FolderIcon className="w-4 h-4 text-green-400 mr-2" />
              <span className="text-sm text-green-300">Your Study Library</span>
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-400 via-teal-400 to-blue-400 bg-clip-text text-transparent"
            >
              Organize Your Courses, Master Your Subjects
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-300 mb-4 leading-relaxed"
            >
              Create dedicated folders for each course or topic. Fill them with your notes, and then let our AI help you generate custom flashcards and practice questions to supercharge your revision!
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="p-4 rounded-lg bg-gray-800/50 border border-green-500/30 mb-8"
            >
              <div className="flex items-start gap-3">
                <Bot className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-green-300 mb-1">AI Study Tool Generator</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Don't just organize – optimize! Ask our AI to <strong>automatically create flashcards or quiz questions for specific folders</strong> based on your notes or by simply telling it the topic. It’s like having a personal teaching assistant for every subject.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {features.map((feature, index) => (
                <motion.div key={index} variants={itemVariants} className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-gray-300">{feature.text}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants}>
              <motion.a
                href="/folders"
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Organize Your Studies</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>

          <motion.div className="lg:w-1/2 w-full" style={{ y: springY }}>
            <GlowingBorder className="shadow-2xl shadow-green-500/20">
              <div className="bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl flex flex-col md:flex-row gap-4 min-h-[480px]">
                <div className="md:w-1/3 border-r border-gray-700/50 md:pr-4 space-y-2 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold text-sm">Your Subjects</h4>
                    <button className="p-1 text-green-400 hover:text-green-300 rounded-full hover:bg-gray-700/50 transition-colors" title="New Subject Folder">
                      <FolderIcon size={16} strokeWidth={2.5}/>
                    </button>
                  </div>
                  <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
                  {folders.map(folder => (
                    <motion.div
                      key={folder.id}
                      onClick={() => handleSelectFolder(folder.id)}
                      className={`p-2 rounded-md flex items-center gap-2 cursor-pointer transition-colors border ${folder.selected ? "bg-gray-700 border-green-500/50" : "bg-gray-700/40 hover:bg-gray-600/60 border-transparent"}`}
                      whileHover={{ scale: folder.selected ? 1 : 1.03 }}
                      layout
                    >
                      <folder.icon className={`w-4 h-4 flex-shrink-0 ${folder.selected ? 'text-green-400' : 'text-gray-400'}`} />
                      <span className={`text-xs truncate ${folder.selected ? 'text-white font-medium' : 'text-gray-300'}`}>{folder.name}</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${folder.selected ? 'bg-green-500/20 text-green-300' : 'bg-gray-600 text-gray-400'}`}>{folder.items}</span>
                    </motion.div>
                  ))}
                  </div>
                   <button className="w-full mt-auto p-1.5 text-xs bg-gray-700/60 hover:bg-gray-600/80 text-gray-300 rounded-md flex items-center justify-center gap-1">
                    <Plus size={12}/> Add New Subject
                  </button>
                </div>

                <div className="md:w-2/3 flex-grow flex flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedFolderData.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold text-lg truncate">{selectedFolderData.name}</h3>
                        <div className="flex gap-1.5">
                            <button className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50" title="Folder Settings"><Settings size={14}/></button>
                            <button className="p-1 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50" title="Delete Folder"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <button className="flex-1 text-xs bg-green-500/80 hover:bg-green-500 text-white px-3 py-1.5 rounded-md flex items-center justify-center gap-1"><Lightbulb size={12}/> New Flashcards</button>
                        <button className="flex-1 text-xs bg-purple-500/80 hover:bg-purple-500 text-white px-3 py-1.5 rounded-md flex items-center justify-center gap-1"><Pencil size={12}/> New Questions</button>
                      </div>
                       <div className="flex-1 space-y-1.5 overflow-y-auto p-2 bg-gray-900/30 rounded-md min-h-[200px] max-h-[250px] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                        {selectedFolderData.flashcards.map(fc => (
                          <div key={fc.id} className="p-1.5 bg-gray-700/50 rounded text-xs text-gray-300 flex justify-between items-center">
                            <span><strong>{fc.term}:</strong> {fc.definition.substring(0,25)}...</span>
                            <Edit2 size={10} className="text-gray-500 hover:text-white cursor-pointer"/>
                          </div>
                        ))}
                        {selectedFolderData.questions.map(q => (
                          <div key={q.id} className="p-1.5 bg-gray-700/50 rounded text-xs text-gray-300 flex justify-between items-center">
                            <span><strong>Q:</strong> {q.question.substring(0,30)}...</span>
                            <Edit2 size={10} className="text-gray-500 hover:text-white cursor-pointer"/>
                          </div>
                        ))}
                        {selectedFolderData.flashcards.length === 0 && selectedFolderData.questions.length === 0 && (
                            <p className="text-xs text-gray-500 text-center pt-10">No study tools yet for {selectedFolderData.name}. Let's create some!</p>
                        )}
                      </div>
                      <button className="w-full mt-auto p-1.5 text-xs bg-indigo-500/80 hover:bg-indigo-500 text-white rounded-md flex items-center justify-center gap-1">
                        <Bot size={12}/> AI: Generate Study Set for "{selectedFolderData.name.substring(0,15)}..."
                      </button>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </GlowingBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StudyGroupsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  };

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Sarah (Bio Buddy)", message: "Hey, did anyone understand the Krebs cycle from today's lecture?", time: "10:24 AM", avatar: "https://i.pravatar.cc/80?img=5" },
    { id: 2, user: "You", message: "Kinda, I took some notes, I can share them!", time: "10:26 AM", avatar: "https://www.elevenforum.com/data/attachments/82/82529-ade63e4209709292183f654907b168f5.jpg?hash=reY-Qglwkp" },
    { id: 3, user: "Mike (Calculus Crew)", message: "Anyone up for a group study session for the midterm?", time: "10:30 AM", avatar: "https://i.pravatar.cc/80?img=11" },
  ]);
  const [studyBuddies, setStudyBuddies] = useState([
    { id: 1, name: "Sarah (Bio Buddy)", status: "online", avatar: "https://i.pravatar.cc/80?img=5" },
    { id: 2, name: "Mike (Calculus Crew)", status: "online", avatar: "https://i.pravatar.cc/80?img=11" },
    { id: 3, name: "Emily (History Buff)", status: "offline", avatar: "https://i.pravatar.cc/40?img=9" },
    { id: 4, name: "Alex P.", status: "away", avatar: "https://i.pravatar.cc/80?img=28"},
  ]);
  const [requests, setRequests] = useState([
    { id: 1, name: "Jordan S.", avatar: "https://i.pravatar.cc/80?img=7" },
  ]);
  const [activeTab, setActiveTab] = useState("chats");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    const newMessage = {
      id: Date.now(), user: "You", message: message, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      avatar: "https://www.elevenforum.com/data/attachments/82/82529-ade63e4209709292183f654907b168f5.jpg?hash=reY-Qglwkp",
    };
    setChatMessages([...chatMessages, newMessage]);
    setMessage("");
    setIsTyping(true);
    setTimeout(() => {
      const response = {
        id: Date.now() + 1, user: studyBuddies[Math.floor(Math.random()*studyBuddies.length)].name, message: "Got it, thanks!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), avatar: studyBuddies[Math.floor(Math.random()*studyBuddies.length)].avatar,
      };
      setChatMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 1500);
  };

  const handleAcceptRequest = (id) => {
    const request = requests.find((req) => req.id === id);
    if (request) {
      setStudyBuddies([...studyBuddies, { id: Date.now(), name: request.name, status: "online", avatar: request.avatar }]);
      setRequests(requests.filter((req) => req.id !== id));
    }
  };

  const handleRejectRequest = (id) => {
    setRequests(requests.filter((req) => req.id !== id));
  };


  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={5}>STUDY-GROUPS COLLABORATE CONNECT LEARN</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm mb-6"
            >
              <Users className="w-4 h-4 text-blue-400 mr-2" />
              <span className="text-sm text-blue-300">
                Connect & Learn Together
              </span>
            </motion.div>
            <motion.h2
              variants={itemVariants}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent"
            >
              Study Together, Succeed Together
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-300 mb-8 leading-relaxed"
            >
              Share notes, discuss tough concepts, and motivate each other. Form study groups for specific courses or chat one-on-one with your classmates.
            </motion.p>
            <motion.div variants={containerVariants} className="space-y-4 mb-8">
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0"><MessageSquare className="w-5 h-5 text-blue-400" /></div>
                <p className="text-gray-300">Real-time chat with classmates and study groups.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0"><Share2 className="w-5 h-5 text-blue-400" /></div>
                <p className="text-gray-300">Share notes and study materials easily.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0"><Users2 className="w-5 h-5 text-blue-400" /></div>
                <p className="text-gray-300">Organize study sessions and group discussions.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <motion.a
                href="/study-groups"
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
                whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
              >
                <span>Find Your Study Crew</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>
          <motion.div
            className="lg:w-1/2 w-full"
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <GlowingBorder className="shadow-2xl shadow-blue-500/20">
              <div className="bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl min-h-[500px] flex flex-col">
                <div className="flex border-b border-gray-700/50 mb-4 flex-shrink-0">
                  {["chats", "buddies", "requests"].map((tab) => (
                    <button
                      key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${activeTab === tab ? "border-blue-500 text-blue-300" : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600/50"} relative capitalize flex items-center justify-center gap-1`}
                    >
                      {tab === "buddies" ? "Study Buddies" : tab}
                      {tab === "requests" && requests.length > 0 && (
                        <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{requests.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-grow overflow-hidden flex flex-col">
                  {activeTab === "chats" && (
                    <>
                      <div className="space-y-4 mb-4 flex-grow overflow-y-auto pr-1">
                        {chatMessages.map((msg) => (
                          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.user === "You" ? "justify-end" : "justify-start"}`}>
                            <div className={`flex ${msg.user === "You" ? "flex-row-reverse" : ""} gap-2.5 max-w-[80%]`}>
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1"><img src={msg.avatar} alt={msg.user} className="w-full h-full object-cover" /></div>
                              <div className="flex flex-col">
                                <div className={`flex items-baseline gap-2 mb-1 text-xs ${msg.user === "You" ? "justify-end" : ""}`}><span className="font-medium text-white/90">{msg.user === "You" ? "You" : msg.user}</span><span className="text-gray-400/80">{msg.time}</span></div>
                                <div className={`p-3 rounded-lg ${msg.user === "You" ? "bg-gradient-to-br from-indigo-500/40 to-blue-500/40 text-indigo-100 rounded-br-none" : "bg-gray-700/60 text-gray-200 rounded-bl-none"}`}>{msg.message}</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        {isTyping && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="flex items-end gap-2.5 max-w-[80%]">
                              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"><img src={studyBuddies[0].avatar} alt={studyBuddies[0].name} className="w-full h-full object-cover" /></div>
                              <div className="p-3 rounded-lg rounded-bl-none bg-gray-700/60 text-gray-200"><div className="flex items-center gap-1.5"><div className="flex space-x-1 items-center h-4">{[0, 0.2, 0.4].map((delay) => (<motion.div key={delay} className="w-1.5 h-1.5 rounded-full bg-blue-400" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay, ease: "easeInOut" }} />))}</div></div></div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      <form onSubmit={handleSendMessage} className="relative mt-auto flex-shrink-0">
                        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="w-full bg-gray-700/60 border border-gray-600/50 rounded-full py-2.5 px-5 pr-24 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-transparent placeholder-gray-400/70" />
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                          <button type="button" className="p-1.5 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-600/50 transition-colors"><Paperclip className="w-5 h-5" /></button>
                          <button type="submit" className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-full disabled:opacity-50" disabled={!message.trim()}><Send className="w-5 h-5 text-white" /></button>
                        </div>
                      </form>
                    </>
                  )}
                  {activeTab === "buddies" && (
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                      {studyBuddies.map((buddy) => (
                        <motion.div key={buddy.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-700/40 hover:bg-gray-600/60 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-600/50"><img src={buddy.avatar} alt={buddy.name} className="w-full h-full object-cover" /></div>
                              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700/80 ${buddy.status === "online" ? "bg-green-500" : buddy.status === "away" ? "bg-yellow-500" : "bg-gray-500"}`} />
                            </div>
                            <div><h3 className="text-white font-medium text-sm">{buddy.name}</h3><p className="text-xs text-gray-400 capitalize">{buddy.status}</p></div>
                          </div>
                          <div className="flex gap-1.5">
                            <button className="p-2 text-blue-400 hover:text-blue-300 rounded-full hover:bg-gray-500/30 transition-colors" title="Send Message"><MessageSquare className="w-4 h-4" /></button>
                            <button className="p-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-500/30 transition-colors" title="More Options"><MoreVertical className="w-4 h-4" /></button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {activeTab === "requests" && (
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                      {requests.length === 0 ? (<p className="text-center text-gray-400/80 py-10 text-sm">No pending requests.</p>) : (
                        requests.map((request) => (
                          <motion.div key={request.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/40">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-600/50 flex-shrink-0"><img src={request.avatar} alt={request.name} className="w-full h-full object-cover" /></div>
                              <div><h3 className="text-white font-medium text-sm">{request.name}</h3><p className="text-xs text-gray-400">Wants to be your study buddy</p></div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAcceptRequest(request.id)} className="p-1.5 text-green-400 hover:text-green-300 rounded-full hover:bg-gray-600/50 transition-colors" title="Accept Request"><CheckCircle className="w-5 h-5" /></button>
                              <button onClick={() => handleRejectRequest(request.id)} className="p-1.5 text-red-400 hover:text-red-300 rounded-full hover:bg-gray-600/50 transition-colors" title="Reject Request"><X className="w-5 h-5" /></button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </GlowingBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StudentHubSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const springRotate = useSpring(rotate, { stiffness: 80, damping: 30 });

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } } };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [studyCredits, setStudyCredits] = useState(350);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [communityFiles, setCommunityFiles] = useState([
    { id: 1, fileName: "CHEM 101 Midterm Review.pdf", uploadedAt: new Date().toISOString(), userName: "ChemistryWhiz", userAvatar: "https://i.pravatar.cc/40?img=11", cost: 50, type: "pdf" },
    { id: 2, fileName: "Calculus Practice Problems.docx", uploadedAt: new Date(Date.now() - 86400000).toISOString(), userName: "MathGuru99", userAvatar: "https://i.pravatar.cc/32?img=9", cost: 30, type: "docx" },
    { id: 3, fileName: "History Essay Outline - 1800s.pdf", uploadedAt: new Date(Date.now() - 172800000).toISOString(), userName: "Historian2B", userAvatar: "https://i.pravatar.cc/80?img=7", cost: 25, type: "pdf" },
    { id: 6, fileName: "Psychology Study Guide Ch 1-3.pptx", uploadedAt: new Date(Date.now() - 400000000).toISOString(), userName: "PsyStudent", userAvatar: "https://i.pravatar.cc/40?img=5", cost: 60, type: "pptx" },
  ]);
  const [yourFiles, setYourFiles] = useState([
    { id: 4, fileName: "My Biology Notes - Cell Div.docx", uploadedAt: new Date(Date.now() - 259200000).toISOString(), type: "docx" },
    { id: 5, fileName: "Stats Formula Sheet.pdf", uploadedAt: new Date(Date.now() - 345600000).toISOString(), type: "pdf" },
  ]);
  const [unlockedFiles, setUnlockedFiles] = useState([]);

  const handleUnlockFile = (file) => {
    if (studyCredits >= file.cost && !unlockedFiles.includes(file.id)) {
      setStudyCredits(studyCredits - file.cost);
      setUnlockedFiles([...unlockedFiles, file.id]);
    } else if (unlockedFiles.includes(file.id)) { alert("You have already unlocked this file."); }
    else { alert("Not enough study credits to unlock this file."); }
  };
  const handleUploadFile = () => {
    const newFile = { id: Date.now(), fileName: `My Study Material ${yourFiles.length + 1}.pdf`, uploadedAt: new Date().toISOString(), type: "pdf" };
    setYourFiles([newFile, ...yourFiles]);
    setStudyCredits(studyCredits + 20);
    setShowUploadModal(false);
  };
  const getFileIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "pdf": return <FileJson className="w-5 h-5 text-red-400" />;
      case "docx": return <FileText className="w-5 h-5 text-blue-400" />;
      case "pptx": return <Presentation className="w-5 h-5 text-orange-400" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };
  const getDisplayName = (fileName) => fileName.replace(/\.[^/.]+$/, "");
  const getFileExtension = (fileName) => fileName.split(".").pop()?.toUpperCase();
  const filteredCommunityFiles = communityFiles
    .filter((file) => filterType === "All" || file.type === filterType)
    .filter((file) => file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) || file.userName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900/90 backdrop-blur-sm">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={-5}>STUDENT-HUB RESOURCES SHARE-STUDY</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="inline-flex items-center px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 backdrop-blur-sm mb-6">
              <Globe className="w-4 h-4 text-pink-400 mr-2" />
              <span className="text-sm text-pink-300">Share & Discover</span>
            </motion.div>
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Access a World of Study Resources
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-300 mb-8 leading-relaxed">
              Share your notes, flashcards, and practice questions with fellow students. Discover helpful materials and earn study credits for contributing to the community!
            </motion.p>
            <motion.div variants={containerVariants} className="grid grid-cols-2 gap-4 mb-8">
              <motion.div variants={itemVariants} className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-gray-700/50 backdrop-blur-sm" whileHover={{ scale: 1.05, y: -5 }}>
                <p className="text-gray-300 text-sm mb-1">Shared Study Materials</p>
                <h3 className="text-white font-bold text-2xl">{communityFiles.length + yourFiles.length}+</h3>
              </motion.div>
              <motion.div variants={itemVariants} className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-gray-700/50 backdrop-blur-sm" whileHover={{ scale: 1.05, y: -5 }}>
                <p className="text-gray-300 text-sm mb-1">Active Students</p>
                <h3 className="text-white font-bold text-2xl">500+</h3>
              </motion.div>
            </motion.div>
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-gray-200 bg-gray-800/60 border border-gray-700/50 px-4 py-2 rounded-full">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-semibold">Your Study Credits:</span>
                <motion.span key={studyCredits} initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="text-lg font-bold text-yellow-300">
                  {studyCredits}
                </motion.span>
              </div>
              <motion.button onClick={() => setShowUploadModal(true)} className="group inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full text-base font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-pink-500/25" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Upload className="w-4 h-4 mr-2" /><span>Share & Earn Credits</span>
              </motion.button>
              <motion.a href="/student-hub" className="group inline-flex items-center px-5 py-2.5 bg-gray-800/80 border border-gray-700/50 text-white rounded-full text-base font-semibold transition-all transform hover:scale-105 hover:bg-gray-700/80" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <span>Explore the Hub</span><ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>
          <motion.div className="lg:w-1/2 w-full relative">
            <motion.div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 rounded-full blur-[120px] opacity-60" style={{ rotate: springRotate }} transition={{ type: "spring", stiffness: 80, damping: 30 }} />
            <GlowingBorder className="shadow-2xl shadow-purple-500/10">
              <div className="relative bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl min-h-[500px] flex flex-col">
                <div className="mb-5 flex flex-col sm:flex-row gap-3 flex-shrink-0">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search notes, guides..." className="w-full bg-gray-700/60 text-gray-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/70 border border-transparent focus:border-purple-500/50 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="relative flex-shrink-0">
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="appearance-none w-full sm:w-auto bg-gray-700/60 text-gray-200 pl-3 pr-8 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/70 border border-transparent focus:border-purple-500/50 text-sm">
                      <option value="All">All Types</option><option value="pdf">PDF Notes</option><option value="docx">DOCX Guides</option><option value="pptx">PPTX Slides</option>
                    </select>
                    <ChevronRight className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 transform -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto space-y-6 pr-1">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Shared by Students</h2>
                    <div className="space-y-3">
                      {filteredCommunityFiles.length === 0 ? (<p className="text-gray-400/80 text-sm text-center py-4">No matching materials found.</p>) : (
                        filteredCommunityFiles.map((file) => (
                          <motion.div key={file.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-gray-700/40 border border-gray-600/30 hover:border-gray-500/50 transition-all">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">{getFileIcon(file.type)}</div>
                              <div className="flex-grow">
                                <div className="flex items-center justify-between mb-1"><span className="font-medium text-indigo-300 text-sm truncate pr-2">{getDisplayName(file.fileName)}</span><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${file.type === "pdf" ? "bg-red-500/20 text-red-300" : file.type === "docx" ? "bg-blue-500/20 text-blue-300" : file.type === "pptx" ? "bg-orange-500/20 text-orange-300" : "bg-gray-600/50 text-gray-300"}`}>{getFileExtension(file.fileName)}</span></div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2"><img src={file.userAvatar} alt={file.userName} className="w-4 h-4 rounded-full" /><span>{file.userName}</span><span>•</span><span>{new Date(file.uploadedAt).toLocaleDateString()}</span></div>
                              </div>
                              <div className="flex-shrink-0">
                                {unlockedFiles.includes(file.id) ? (<button className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs transition-all flex items-center gap-1 cursor-default"><CheckCircle size={14} /> Unlocked</button>) : (
                                  <motion.button onClick={() => handleUnlockFile(file)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-xs transition-all transform hover:shadow-md hover:shadow-purple-500/30 flex items-center gap-1" disabled={studyCredits < file.cost}>
                                    <Coins className="w-3.5 h-3.5 text-yellow-300" /><span>{file.cost}</span>
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Your Shared Materials</h2>
                    <div className="space-y-3">
                      {yourFiles.length === 0 ? (<p className="text-gray-400/80 text-sm text-center py-4">You haven't shared anything yet. Upload to earn credits!</p>) : (
                        yourFiles.map((file) => (
                          <motion.div key={file.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-gray-700/30 border border-gray-600/20">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">{getFileIcon(file.type)}</div>
                              <div className="flex-grow">
                                <div className="flex items-center justify-between mb-1"><span className="font-medium text-indigo-300 text-sm truncate pr-2">{getDisplayName(file.fileName)}</span><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${file.type === "pdf" ? "bg-red-500/20 text-red-300" : file.type === "docx" ? "bg-blue-500/20 text-blue-300" : file.type === "pptx" ? "bg-orange-500/20 text-orange-300" : "bg-gray-600/50 text-gray-300"}`}>{getFileExtension(file.fileName)}</span></div>
                                <span className="block text-xs text-gray-400">Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-1.5">
                                <button className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-600/50 transition-colors" title="Edit (Coming Soon)"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-600/50 transition-colors" title="Delete (Coming Soon)"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </GlowingBorder>
            <AnimatePresence>
              {showUploadModal && (
                <motion.div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-xl">
                    <div className="flex items-center justify-between mb-5"><h3 className="text-xl font-semibold text-white">Share Study Material</h3><button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"><X className="w-5 h-5" /></button></div>
                    <div className="space-y-5">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer"><Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" /><p className="text-gray-300 mb-1 text-sm">Drag and drop your file here</p><p className="text-gray-500 text-xs mb-3">or</p><button className="px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm">Browse Files</button><p className="text-xs text-gray-500 mt-3">(Max 10MB, PDF, DOCX, PPTX)</p></div>
                      <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-gray-300 text-sm"><span>Earn</span><div className="flex items-center text-yellow-400 font-medium"><Coins className="w-4 h-4 mr-1" /><span>+20 Study Credits</span></div></div>
                        <button onClick={handleUploadFile} className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-colors font-medium text-sm flex items-center gap-1.5"><Upload size={16} /> Upload & Share</button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AIAssistantSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } } };

  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "assistant", content: "Hey there! I'm your AI Study Partner. Ask me to explain a concept, summarize text, or even quiz you!" },
    { role: "user", content: "Can you explain the concept of 'cognitive dissonance'?"},
    { role: "assistant", content: "Sure! Cognitive dissonance is the mental discomfort experienced by a person who holds two or more contradictory beliefs, ideas, or values, or when their beliefs and actions contradict one another. For example, if someone believes smoking is bad for them but continues to smoke, they might experience cognitive dissonance. Want me to give you another example or quiz you on it?" },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const newChatHistory = [...chatHistory, { role: "user", content: chatMessage }];
    setChatHistory(newChatHistory);
    const currentMessage = chatMessage;
    setChatMessage("");
    setIsTyping(true);
    setTimeout(() => {
      let response = "";
      const lowerCaseMsg = currentMessage.toLowerCase();
      if (lowerCaseMsg.includes("summarize")) { response = "Okay, paste the text you want me to summarize!"; }
      else if (lowerCaseMsg.includes("explain") || lowerCaseMsg.includes("what is")) { response = "That's a great question! Let me break that down for you..."; }
      else if (lowerCaseMsg.includes("quiz me") || lowerCaseMsg.includes("question")) { response = "Alright, let's test your knowledge! Here's your first question..."; }
      else { response = "I can help with that! Tell me more about what you need for your studies."; }
      setChatHistory((prev) => [...prev, { role: "assistant", content: response }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={5}>AI-TUTOR EXPLAIN SUMMARIZE QUIZ-ME</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm mb-6">
              <Bot className="w-4 h-4 text-cyan-400 mr-2" />
              <span className="text-sm text-cyan-300">Your Personal AI Study Partner</span>
            </motion.div>
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Unlock Deeper Understanding with AI
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-300 mb-8 leading-relaxed">
              Stuck on a concept? Need a quick summary or practice questions? Our AI is here to help you learn smarter, 24/7.
            </motion.p>
            <motion.div variants={containerVariants} className="space-y-4 mb-8">
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-cyan-500/10 flex-shrink-0"><BrainCircuit className="w-5 h-5 text-cyan-400" /></div>
                <p className="text-gray-300">Instant explanations for complex topics.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-cyan-500/10 flex-shrink-0"><FileText className="w-5 h-5 text-cyan-400" /></div>
                <p className="text-gray-300">Summarize long texts, articles, or lecture notes.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-cyan-500/10 flex-shrink-0"><Lightbulb className="w-5 h-5 text-cyan-400" /></div>
                <p className="text-gray-300">Generate practice questions and quizzes on any subject.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <motion.a href="/ai-study-tool" className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <span>Ask Your AI Tutor</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>
          <motion.div
            className="lg:w-1/2 w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <GlowingBorder className="shadow-2xl shadow-cyan-500/20">
              <div className="bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl min-h-[500px] flex flex-col">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-700/50 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-inner"><Bot className="w-6 h-6 text-white/90" /></div>
                  <div><h3 className="text-white font-semibold">AI Study Partner</h3><p className="text-gray-400 text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>Online - Ready to help!</p></div>
                </div>
                <div className="space-y-4 mb-4 flex-grow overflow-y-auto pr-1">
                  {chatHistory.map((message, index) => (
                    <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm ${message.role === "user" ? "bg-gradient-to-br from-blue-500/40 to-cyan-500/40 text-blue-100 rounded-br-none" : "bg-gray-700/60 text-gray-200 rounded-bl-none"}`}>
                        <ReactMarkdown components={{ p: ({ node, ...props }) => (<p className="mb-0" {...props} />),}}>{message.content}</ReactMarkdown>
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="bg-gray-700/60 text-gray-200 p-3 rounded-lg rounded-bl-none max-w-[85%]"><div className="flex items-center gap-1.5 h-4">{[0, 0.2, 0.4].map((delay) => (<motion.div key={delay} className="w-1.5 h-1.5 rounded-full bg-cyan-400" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay, ease: "easeInOut" }} />))}</div></div>
                    </motion.div>
                  )}
                </div>
                <form onSubmit={handleSendMessage} className="relative mt-auto flex-shrink-0">
                  <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Ask about a topic, get a summary..." className="w-full bg-gray-700/60 border border-gray-600/50 rounded-full py-2.5 px-5 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/70 focus:border-transparent placeholder-gray-400/70" />
                  <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 p-2 rounded-full disabled:opacity-50 transition-opacity duration-200" disabled={!chatMessage.trim() || isTyping}><Send className="w-5 h-5 text-white" /></button>
                </form>
                <motion.div className="absolute -bottom-8 -right-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -z-10" animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
              </div>
            </GlowingBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CalendarSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useParallax(scrollYProgress, 80);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } } };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyStartDays = Array.from({ length: startOffset });
  const totalSlots = emptyStartDays.length + days.length;
  const emptyEndDaysCount = (7 - (totalSlots % 7)) % 7;
  const emptyEndDays = Array.from({ length: emptyEndDaysCount });
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const currentMonthName = monthNames[month];
  const events = {
    5: [{ id: 1, title: "Bio Lab Report Due", color: "bg-blue-500" }],
    12: [{ id: 2, title: "Math Midterm", color: "bg-red-500" }, { id: 3, title: "Study Group: History", color: "bg-pink-500" }],
    [today]: [{ id: 4, title: "CS Lecture", color: "bg-green-500" }],
    18: [{ id: 4, title: "Project Proposal", color: "bg-yellow-500" }],
    25: [{ id: 5, title: "English Essay Draft", color: "bg-purple-500" }],
  };

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900/90 backdrop-blur-sm">
      <FloatingElements count={15} className="opacity-50" />
      <ParallaxText baseVelocity={-5}>CALENDAR SCHEDULE DEADLINES PLAN</ParallaxText>
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <motion.div
            className="lg:w-1/2"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-sm mb-6">
              <Calendar className="w-4 h-4 text-green-400 mr-2" />
              <span className="text-sm text-green-300">Plan Your Success</span>
            </motion.div>
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Never Miss a Deadline Again
            </motion.h2>
            <motion.p variants={itemVariants} className="text-xl text-gray-300 mb-8 leading-relaxed">
              Keep track of all your important academic dates. Sync your classes, get reminders for assignments and exams, and plan your study sessions effectively.
            </motion.p>
            <motion.div variants={containerVariants} className="space-y-4 mb-8">
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0"><CalendarDays className="w-5 h-5 text-green-400" /></div>
                <p className="text-gray-300">Track assignment due dates and exam schedules.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0"><Clock className="w-5 h-5 text-green-400" /></div>
                <p className="text-gray-300">Plan your study blocks and personal events.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0"><Sparkles className="w-5 h-5 text-green-400" /></div>
                <p className="text-gray-300">Get smart reminders so you're always prepared.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <motion.a href="/calendar" className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full text-lg font-semibold transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <span>View Your Schedule</span>
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </motion.a>
            </motion.div>
          </motion.div>
          <motion.div className="lg:w-1/2 w-full" style={{ y: springY }} transition={{ type: "spring", stiffness: 100, damping: 30 }}>
            <GlowingBorder className="shadow-2xl shadow-green-500/20">
              <div className="bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl">
                <div className="flex items-center justify-between mb-5">
                  <div><h3 className="text-white font-semibold text-lg">{currentMonthName} {year}</h3><p className="text-gray-400 text-xs">Your academic schedule at a glance</p></div>
                  <div className="flex gap-1.5">
                    <button className="p-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 text-gray-400 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                    <button className="p-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 text-gray-400 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (<div key={day} className="text-center text-gray-400 text-xs font-medium py-1">{day}</div>))}</div>
                <div className="grid grid-cols-7 gap-1">
                  {emptyStartDays.map((_, index) => (<div key={`empty-start-${index}`} className="aspect-square rounded-lg"></div>))}
                  {days.map((day) => {
                    const dayEvents = events[day] || [];
                    const isToday = day === today;
                    return (
                      <motion.div key={day} className={`aspect-square rounded-lg flex flex-col items-center justify-start p-1.5 cursor-pointer relative transition-colors duration-200 ${isToday ? "bg-gradient-to-br from-green-500/80 to-teal-500/80" : "bg-gray-700/40 hover:bg-gray-600/60"} ${isToday ? "text-white" : "text-gray-200 hover:text-white"}`} whileHover={{ scale: 1.03, zIndex: 10 }} whileTap={{ scale: 0.97 }}>
                        <span className={`text-xs mb-1 ${isToday ? "font-bold" : ""}`}>{day}</span>
                        <div className="flex flex-wrap justify-center gap-0.5 mt-auto">
                          {dayEvents.slice(0, 3).map((event) => (<div key={event.id} className={`w-1.5 h-1.5 rounded-full ${event.color}`}></div>))}
                          {dayEvents.length > 3 && (<div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>)}
                        </div>
                      </motion.div>
                    );
                  })}
                  {emptyEndDays.map((_, index) => (<div key={`empty-end-${index}`} className="aspect-square rounded-lg"></div>))}
                </div>
                <div className="mt-5 pt-4 border-t border-gray-700/50">
                  <h4 className="text-sm font-medium text-white mb-2">Today's Focus:</h4>
                  <div className="space-y-2">
                    {(events[today] || []).length > 0 ? ((events[today] || []).map((event) => (
                      <div key={event.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-700/50 text-xs"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${event.color}`}></div><p className="text-gray-200 truncate">{event.title}</p></div>
                    ))) : (<p className="text-xs text-gray-400/80">No major deadlines or events today. Catch up or get ahead!</p>)}
                  </div>
                </div>
              </div>
            </GlowingBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StudentTestimonialsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.2 });

  const testimonials = [
    {
      name: "Kevin Su",
      role: "Economics Major",
      university: "Yale University",
      logoUrl: "https://brand.yale.edu/sites/default/files/inline-images/YALE_SHIELD_BLUE.svg",
      logoAlt: "Yale University logo",
      text: "TaskMaster AI transformed my approach to economic theory research. The smart summarization tool condensed dense academic papers into actionable insights, saving me 15+ hours weekly. The citation manager automatically formatted my references in Chicago style, which was a lifesaver for my thesis. My GPA improved from 3.7 to 3.9 after just one semester of using TaskMaster.",
      rating: 5,
    },
    {
      name: "Mohana Dayyam",
      role: "Premed Student",
      university: "Rice University",
      logoUrl: "https://brand.rice.edu/sites/g/files/bxs3516/files/2023-09/Rice_PrimaryLogo_FullColor_RGB.svg",
      logoAlt: "Rice University logo",
      text: "As a premed student juggling organic chemistry, biology, and physics, TaskMaster AI's study schedule optimizer has been revolutionary. It analyzes my learning patterns and creates personalized study blocks that maximized my retention. The flashcard system with spaced repetition algorithms helped me memorize complex biochemical pathways effortlessly. I scored in the 95th percentile on my MCAT, and I credit TaskMaster for making that possible.",
      rating: 5,
    },
    {
      name: "Hrishi Chintakuntla",
      role: "Premed Student",
      university: "Johns Hopkins University",
      logoUrl: "https://brand.jhu.edu/assets/uploads/sites/5/2020/04/university.shield.blue_.svg",
      logoAlt: "Johns Hopkins University logo",
      text: "The collaborative study feature in TaskMaster AI completely changed my medical school preparation. I connected with classmates to share annotated lecture notes and created group study guides that synced automatically. The AI-powered question generator helped identify weak areas in my understanding before exams. My professors have commented on the notable improvement in my critical thinking skills since I started using TaskMaster for my studies.",
      rating: 5,
    },
  ];

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } } };
  const itemVariants = { hidden: { y: 30, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } } };

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={15} className="opacity-50" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={containerVariants}
        >
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Hear From Students Like You
          </motion.h2>
          <motion.p variants={itemVariants} className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover how TaskMaster AI is helping students improve their academic performance and productivity.
          </motion.p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={containerVariants}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative h-full testimonial-card"
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
            >
              <GlowingBorder className="h-full">
                <div className="bg-gray-800/70 backdrop-blur-sm p-6 rounded-xl h-full flex flex-col shadow-lg">
                  <div className="mb-4 flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <motion.svg key={i} className={`w-5 h-5 ${i < testimonial.rating ? "text-yellow-400" : "text-gray-600"}`} fill="currentColor" viewBox="0 0 24 24" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.1 }}>
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </motion.svg>
                    ))}
                  </div>
                  <p className="text-gray-200 italic flex-grow mb-5 text-base leading-relaxed">"{testimonial.text}"</p>
                  <div className="mt-auto flex items-center gap-3 pt-4 border-t border-gray-700/50">
                    <img
                      src={testimonial.logoUrl}
                      alt={testimonial.logoAlt}
                      className="university-logo flex-shrink-0"
                    />
                    <div>
                      <h3 className="text-white font-semibold">{testimonial.name}</h3>
                      <p className="text-gray-400 text-sm">{testimonial.role}, <span className="font-medium">{testimonial.university}</span></p>
                    </div>
                  </div>
                </div>
              </GlowingBorder>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


function StudentCTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.3 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } } };

  return (
    <section ref={ref} className="relative py-32 overflow-hidden bg-gray-900">
      <FloatingElements count={20} className="opacity-60" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm mb-6">
            <GraduationCap className="w-5 h-5 text-indigo-400 mr-2" />
            <span className="text-sm text-indigo-300">Ready to Boost Your Grades?</span>
          </motion.div>
          <motion.h2 variants={itemVariants} className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent !leading-tight">
            Start Learning Smarter, Not Harder!
          </motion.h2>
          <motion.p variants={itemVariants} className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of students simplifying their studies and achieving academic success with our AI-powered tools. Sign up for free and transform your learning experience.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <motion.a
              href="/signup"
              whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-lg font-semibold transition-all duration-300 ease-out transform hover:shadow-lg hover:shadow-indigo-500/30 w-full sm:w-auto"
            >
              <span className="relative z-10">Get Started for Free</span>
              <ArrowRight className="w-5 h-5 ml-2 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 blur-md opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
            </motion.a>
            <motion.a
              href="/features-tour"
              whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-gray-800/60 text-white rounded-full text-lg font-semibold border border-gray-700/60 backdrop-blur-sm transition-all duration-300 hover:bg-gray-700/70 hover:border-gray-600/70 w-full sm:w-auto"
            >
              See How It Works
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
