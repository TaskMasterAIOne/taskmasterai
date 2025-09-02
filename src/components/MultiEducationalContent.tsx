import React from 'react';
import { FlashcardsQuestions } from './FlashcardsQuestions';

interface FlashcardData {
  id: string;
  question: string;
  answer: string;
  topic?: string;
}

interface QuestionData {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface FlashcardMessage {
  type: 'flashcard';
  data: FlashcardData[];
}

interface QuestionMessage {
  type: 'question';
  data: QuestionData[];
}

interface MultiEducationalContentProps {
  flashcards?: FlashcardMessage;
  questions?: QuestionMessage;
  onComplete?: () => void;
}

export const MultiEducationalContent: React.FC<MultiEducationalContentProps> = ({
  flashcards,
  questions,
  onComplete = () => {}
}) => {
  const hasMultipleTypes = !!(flashcards && questions);
  
  if (!flashcards && !questions) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      {hasMultipleTypes && (
        <div className="text-center">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--bg-accent)' }}>
            📚 Study Materials Generated
          </h3>
        </div>
      )}
      
      {flashcards && (
        <div className="relative">
          {hasMultipleTypes && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" 
                   style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--text-white)' }}>
                💳
              </div>
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Flashcards ({flashcards.data.length})
              </span>
            </div>
          )}
          <div className={hasMultipleTypes ? "ml-2 border-l-2 pl-4" : ""} 
               style={hasMultipleTypes ? { borderColor: 'var(--border-secondary)' } : {}}>
            <FlashcardsQuestions 
              type="flashcard" 
              data={flashcards.data} 
              onComplete={onComplete} 
            />
          </div>
        </div>
      )}
      
      {questions && (
        <div className="relative">
          {hasMultipleTypes && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" 
                   style={{ backgroundColor: 'var(--status-success)', color: 'var(--text-white)' }}>
                ❓
              </div>
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Quiz Questions ({questions.data.length})
              </span>
            </div>
          )}
          <div className={hasMultipleTypes ? "ml-2 border-l-2 pl-4" : ""} 
               style={hasMultipleTypes ? { borderColor: 'var(--border-secondary)' } : {}}>
            <FlashcardsQuestions 
              type="question" 
              data={questions.data} 
              onComplete={onComplete} 
            />
          </div>
        </div>
      )}
      
      {hasMultipleTypes && (
        <div className="text-center mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-secondary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ✨ AI generated both flashcards and quiz questions for comprehensive study
          </p>
        </div>
      )}
    </div>
  );
};
