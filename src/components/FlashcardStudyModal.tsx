// FlashcardStudyModal.tsx
import React, { useState, useEffect } from 'react';
import { Flashcard } from './Notes'; // Assuming Flashcard type is exported from Notes.tsx
import { X, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

interface FlashcardStudyModalProps {
    isOpen: boolean;
    onClose: () => void;
    flashcards: Flashcard[]; // Expect an array of flashcards
    isIlluminateEnabled: boolean; // Pass theme state
}

export const FlashcardStudyModal: React.FC<FlashcardStudyModalProps> = ({
    isOpen,
    onClose,
    flashcards = [], // Default to empty array to prevent errors
    isIlluminateEnabled,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);

    // Shuffle cards when the modal opens or cards change
    useEffect(() => {
        if (isOpen && flashcards.length > 0) {
            // Fisher-Yates (Knuth) Shuffle algorithm
            const array = [...flashcards];
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            setShuffledCards(array);
            setCurrentIndex(0); // Start from the beginning of the shuffled deck
            setIsFlipped(false); // Start with the front side
        }
    }, [isOpen, flashcards]);

    // Close modal if cards array becomes empty while open
    useEffect(() => {
        if (isOpen && shuffledCards.length === 0 && flashcards.length > 0) {
             // This condition might occur if the original `flashcards` prop updates to empty
             // while the modal is open *after* initial shuffle.
             // For simplicity, we just close. A more robust solution might handle this differently.
             console.warn("Flashcards became empty while study modal was open. Closing.");
             onClose();
        }
    }, [isOpen, shuffledCards, flashcards, onClose]);


    if (!isOpen || shuffledCards.length === 0) {
        // Don't render if not open or if there are no cards after shuffling
        return null;
    }

    const currentCard = shuffledCards[currentIndex];

    const goToNext = () => {
        setIsFlipped(false); // Show front of next card
        setCurrentIndex((prevIndex) => (prevIndex + 1) % shuffledCards.length);
    };

    const goToPrevious = () => {
        setIsFlipped(false); // Show front of previous card
        setCurrentIndex((prevIndex) => (prevIndex - 1 + shuffledCards.length) % shuffledCards.length);
    };

    const flipCard = () => {
        setIsFlipped((prev) => !prev);
    };

    // Theme Styles
    const modalBg = isIlluminateEnabled ? "bg-white" : "bg-gray-800";
    const textColor = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";
    const cardBg = isIlluminateEnabled ? "bg-gray-50 border-gray-200" : "bg-gray-700 border-gray-600";
    const buttonSecondaryClass = isIlluminateEnabled ? "bg-gray-200 hover:bg-gray-300 text-gray-700" : "bg-gray-600 hover:bg-gray-500 text-gray-300";
    const iconColor = isIlluminateEnabled ? "text-gray-500 hover:text-gray-700" : "text-gray-400 hover:text-gray-200";


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            {/* Stop propagation to prevent closing when clicking inside modal */}
            <div
                className={`${modalBg} rounded-lg shadow-xl w-full max-w-lg flex flex-col overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex justify-between items-center p-3 border-b ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>Study Flashcards</h2>
                    <button onClick={onClose} className={`${iconColor} p-1 rounded-full hover:bg-gray-500/10`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Card Area - Perspective container */}
                <div className="p-4 flex-grow flex flex-col items-center justify-center min-h-[250px] [perspective:1000px]">
                    {/* Flippable Card */}
                    <div
                        onClick={flipCard}
                        className={`relative w-full h-48 md:h-56 rounded-lg border cursor-pointer transition-transform duration-500 ease-in-out ${cardBg} ${textColor}`}
                        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                        title="Click to flip"
                    >
                         {/* Front Side */}
                         <div className={`absolute inset-0 p-4 flex items-center justify-center text-center break-words overflow-y-auto [backface-visibility:hidden]`}>
                            <p className="text-lg">{currentCard.front}</p>
                        </div>
                         {/* Back Side */}
                         <div className={`absolute inset-0 p-4 flex items-center justify-center text-center break-words overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
                             <p className="text-lg">{currentCard.back}</p>
                         </div>
                    </div>
                    <p className={`mt-3 text-sm font-medium ${isIlluminateEnabled ? 'text-gray-600' : 'text-gray-400'}`}>
                        Card {currentIndex + 1} of {shuffledCards.length}
                    </p>
                </div>

                {/* Controls */}
                <div className={`flex justify-between items-center p-3 border-t ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700'}`}>
                    <button onClick={goToPrevious} className={`${buttonSecondaryClass} p-2 rounded-full`} title="Previous Card">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button onClick={flipCard} className={`${buttonSecondaryClass} px-4 py-2 rounded-md text-sm flex items-center gap-1.5`} title="Flip Card">
                        <RefreshCw className="w-4 h-4" /> Flip
                    </button>
                    <button onClick={goToNext} className={`${buttonSecondaryClass} p-2 rounded-full`} title="Next Card">
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
