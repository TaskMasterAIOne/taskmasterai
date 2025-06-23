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
      <div className="text-center p-4 my-2 text-xs rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-600/50">
        Could not display content. The AI may have provided incomplete or invalid data.
      </div>
    );
  }

  const currentItem = data[currentIndex];
  
  if (!currentItem) {
      return <div className="text-red-500 dark:text-red-400 text-xs">Error: Invalid item data.</div>
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
      <div className="w-full max-w-lg mx-auto my-2 text-xs">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Topic: {flashcard.topic || 'General'}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {data.length}
          </span>
        </div>

        <div className="relative h-48 [perspective:1000px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              // UPDATED: Made slide transition smoother
              transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
              className="absolute w-full h-full"
            >
              <div 
                // UPDATED: Changed flip animation to vertical and made it more fluid
                className={`relative w-full h-full cursor-pointer transition-transform duration-500 ease-in-out [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateX(180deg)]' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className="absolute w-full h-full p-4 flex items-center justify-center text-center rounded-xl shadow-md bg-gray-100 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600/50 [backface-visibility:hidden]">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{flashcard.question}</p>
                </div>
                {/* Back */}
                {/* UPDATED: Changed to rotateX to match vertical flip */}
                <div className="absolute w-full h-full p-4 flex items-center justify-center text-center rounded-xl shadow-md bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600/50 [backface-visibility:hidden] [transform:rotateX(180deg)]">
                  <p className="text-sm text-gray-800 dark:text-gray-100">{flashcard.answer}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-3 flex justify-between items-center">
          <button onClick={handlePrevious} disabled={currentIndex === 0} className="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setIsFlipped(!isFlipped)} className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Flip</button>
          <button onClick={handleNext} disabled={currentIndex === data.length - 1} className="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  // --- QUIZ QUESTION MODE ---
  const quiz = currentItem as Question;

  return (
    <div className="w-full max-w-lg mx-auto my-2 text-xs">
        <div className="flex justify-between items-center mb-2 px-1">
            <span className="font-semibold text-gray-500 dark:text-gray-400">
                Question
            </span>
            <span className="text-gray-500 dark:text-gray-400">
                {currentIndex + 1} / {data.length}
            </span>
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
                className="p-4 rounded-xl shadow-md bg-gray-100 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600/50"
            >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4">{quiz.question}</p>

                <div className="space-y-2">
                    {Array.isArray(quiz.options) ? quiz.options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = selectedAnswer !== null && index === quiz.correctAnswer;
                        const isIncorrect = isSelected && !isCorrect;

                        let buttonClass = 'bg-white dark:bg-gray-800/80 hover:bg-gray-200/70 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-600';
                        if (isCorrect) buttonClass = 'bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300';
                        if (isIncorrect) buttonClass = 'bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300';
                        
                        return (
                            <button
                                key={index}
                                onClick={() => { if (selectedAnswer === null) setSelectedAnswer(index); }}
                                disabled={selectedAnswer !== null}
                                className={`w-full text-left p-2.5 rounded-lg transition-all duration-150 flex justify-between items-center text-xs font-medium border ${buttonClass} disabled:cursor-default`}
                            >
                                <span>{option}</span>
                                <AnimatePresence>
                                {isCorrect && <motion.div initial={{scale: 0}} animate={{scale: 1}}><Check className="w-4 h-4" /></motion.div>}
                                {isIncorrect && <motion.div initial={{scale: 0}} animate={{scale: 1}}><X className="w-4 h-4" /></motion.div>}
                                </AnimatePresence>
                            </button>
                        );
                    }) : (
                        <p className="text-red-500 dark:text-red-400 italic">Error: No options provided for this question.</p>
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
                        <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 leading-snug">
                            <strong className="font-semibold">Explanation: </strong>{quiz.explanation}
                        </div>
                    </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>

        <div className="mt-3 flex justify-between items-center">
            <button onClick={handlePrevious} disabled={currentIndex === 0} className="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={resetCard} className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex items-center gap-1 disabled:opacity-50" disabled={selectedAnswer === null}><RotateCcw className="w-3 h-3" /> Try Again</button>
            <button onClick={handleNext} disabled={currentIndex === data.length - 1} className="p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
        </div>
    </div>
  );
};