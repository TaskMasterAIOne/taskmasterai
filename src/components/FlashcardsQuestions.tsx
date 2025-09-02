import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Check, X } from 'lucide-react';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topic?: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface FlashcardsQuestionsProps {
  type: 'flashcard' | 'question';
  data: Flashcard[] | Question[] | undefined; // Allow undefined for safety
  onComplete: () => void;
}

export const FlashcardsQuestions: React.FC<FlashcardsQuestionsProps> = ({
  type,
  data,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [direction, setDirection] = useState(0);

  // Reset internal state if the data prop changes externally
  useEffect(() => {
    setCurrentIndex(0);
    resetCard();
  }, [data]);

  const resetCard = () => {
    setIsFlipped(false);
    setSelectedAnswer(null);
  };

  const handleNext = () => {
    if (data && currentIndex < data.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
      resetCard();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
      resetCard();
    }
  };
  
  // Safety Check: Ensure data from the AI is valid before rendering.
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center p-4 my-2 text-xs rounded-lg" style={{backgroundColor: 'var(--status-error)', color: 'var(--text-white)', border: '1px solid var(--status-error)'}}>
        Could not display content. The AI may have provided incomplete or invalid data.
      </div>
    );
  }

  const currentItem = data[currentIndex];
  
  if (!currentItem) {
      return <div className="text-xs" style={{color: 'var(--status-error)'}}>Error: Invalid item data.</div>
  }

  const cardVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 20 : -20,
      opacity: 0,
    }),
  };

  // --- FLASHCARD MODE ---
  if (type === 'flashcard') {
    const flashcard = currentItem as Flashcard;

    return (
      <div className="w-full max-w-lg my-2 stats-text-responsive">
        {/* Header Section */}
                  <div className="study-card-width-only mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevious} disabled={currentIndex === 0} className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-interactive" style={{color: 'var(--text-secondary)'}}><ChevronLeft className="stats-icon-responsive" /></button>
              <span className="font-semibold" style={{color: 'var(--bg-accent)'}}>
                Topic: {flashcard.topic || 'General'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{color: 'var(--text-muted)'}}>
                {currentIndex + 1} / {data.length}
              </span>
              <button onClick={handleNext} disabled={currentIndex === data.length - 1} className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-interactive" style={{color: 'var(--text-secondary)'}}><ChevronRight className="stats-icon-responsive" /></button>
            </div>
          </div>
        </div>

        {/* Card Section - FIXED: Replaced h-48 with aspect-video for proper responsive height */}
        <div className="relative study-card-responsive [perspective:1000px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
              className="absolute w-full h-full"
            >
              <div 
                className={`relative w-full h-full cursor-pointer transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateX(180deg)]' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className="absolute w-full h-full p-6 flex items-center justify-center text-center rounded-xl [backface-visibility:hidden]" style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 6px -1px var(--shadow-medium)'}}>
                  <p className="study-card-text-responsive font-medium" style={{color: 'var(--text-primary)'}}>{flashcard.question}</p>
                </div>
                {/* Back */}
                <div className="absolute w-full h-full p-6 flex items-center justify-center text-center rounded-xl [backface-visibility:hidden] [transform:rotateX(180deg)]" style={{backgroundColor: 'var(--bg-accent)', border: '1px solid var(--bg-accent)', boxShadow: '0 4px 6px -1px var(--shadow-medium)'}}>
                  <p className="study-card-text-responsive" style={{color: 'var(--text-white)'}}>{flashcard.answer}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Button Section */}
        <div className="mt-4 flex justify-center" style={{width: 'clamp(280px, 90vw, 400px)'}}>
          <button onClick={() => setIsFlipped(!isFlipped)} className="px-4 py-2 stats-text-responsive font-semibold rounded-lg transition-colors flex items-center gap-1" style={{backgroundColor: 'var(--bg-accent)', color: 'var(--text-white)'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-accent-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-accent)'}><RotateCcw className="stats-text-responsive" style={{width: '1em', height: '1em'}} /> Flip</button>
        </div>
      </div>
    );
  }

  // --- QUIZ QUESTION MODE ---
  const quiz = currentItem as Question;

  return (
    <div className="w-full max-w-lg my-2 text-xs">
        <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-2">
                <button onClick={handlePrevious} disabled={currentIndex === 0} className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-interactive" style={{color: 'var(--text-secondary)'}}><ChevronLeft className="w-4 h-4" /></button>
                <span className="font-semibold" style={{color: 'var(--text-secondary)'}}>
                    Question
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span style={{color: 'var(--text-muted)'}}>
                    {currentIndex + 1} / {data.length}
                </span>
                <button onClick={handleNext} disabled={currentIndex === data.length - 1} className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-interactive" style={{color: 'var(--text-secondary)'}}><ChevronRight className="w-4 h-4" /></button>
            </div>
        </div>
        
        <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
                key={currentIndex}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'tween', ease: 'circOut', duration: 0.3 }}
                className="p-4 rounded-xl" style={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', boxShadow: '0 4px 6px -1px var(--shadow-medium)'}}
            >
                <p className="text-sm font-medium mb-4" style={{color: 'var(--text-primary)'}}>{quiz.question}</p>

                <div className="space-y-2">
                    {Array.isArray(quiz.options) ? quiz.options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = selectedAnswer !== null && index === quiz.correctAnswer;
                        const isIncorrect = isSelected && !isCorrect;

                        let buttonStyle = {
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-secondary)'
                        };
                        if (isCorrect) {
                            buttonStyle = {
                                backgroundColor: 'var(--status-success)',
                                borderColor: 'var(--status-success)',
                                color: 'var(--text-white)'
                            };
                        }
                        if (isIncorrect) {
                            buttonStyle = {
                                backgroundColor: 'var(--status-error)',
                                borderColor: 'var(--status-error)',
                                color: 'var(--text-white)'
                            };
                        }
                        
                        return (
                            <button
                                key={index}
                                onClick={() => { if (selectedAnswer === null) setSelectedAnswer(index); }}
                                disabled={selectedAnswer !== null}
                                className="w-full text-left p-2.5 rounded-lg transition-all duration-150 flex justify-between items-center text-xs font-medium border disabled:cursor-default hover:bg-theme-interactive"
                                style={buttonStyle}
                            >
                                <span>{option}</span>
                                <AnimatePresence>
                                {isCorrect && <motion.div initial={{scale: 0}} animate={{scale: 1}}><Check className="w-4 h-4" /></motion.div>}
                                {isIncorrect && <motion.div initial={{scale: 0}} animate={{scale: 1}}><X className="w-4 h-4" /></motion.div>}
                                </AnimatePresence>
                            </button>
                        );
                    }) : (
                        <p className="italic" style={{color: 'var(--status-error)'}}>Error: No options provided for this question.</p>
                    )}
                </div>

                <AnimatePresence>
                    {selectedAnswer !== null && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 rounded-lg leading-snug" style={{backgroundColor: 'var(--bg-highlight)', color: 'var(--text-secondary)'}}>
                            <strong className="font-semibold">Explanation: </strong>{quiz.explanation}
                        </div>
                    </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>


    </div>
  );
};