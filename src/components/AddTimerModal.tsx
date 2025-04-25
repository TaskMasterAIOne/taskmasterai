import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';

interface AddTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTimer: (name: string, durationMinutes: number) => Promise<void>; // Make async if needed
  isIlluminateEnabled: boolean;
}

const AddTimerModal: React.FC<AddTimerModalProps> = ({ isOpen, onClose, onAddTimer, isIlluminateEnabled }) => {
  const [name, setName] = useState("Focus Block");
  const [minutes, setMinutes] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const durationNum = parseInt(minutes, 10);

    if (!name.trim()) {
      setError("Please enter a timer name.");
      return;
    }
    if (isNaN(durationNum) || durationNum <= 0) {
      setError("Please enter a valid positive number for minutes.");
      return;
    }

    setIsAdding(true);
    try {
      await onAddTimer(name.trim(), durationNum);
      // onClose(); // Let the parent handle closing on success via onAddTimer completion
    } catch (err) {
      setError("Failed to add timer. Please try again.");
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  // Basic styling, adapt as needed using isIlluminateEnabled for themes
  const modalBg = isIlluminateEnabled ? 'bg-white' : 'bg-gray-800';
  const textClass = isIlluminateEnabled ? 'text-gray-900' : 'text-gray-100';
  const inputBg = isIlluminateEnabled ? 'bg-gray-100 border-gray-300' : 'bg-gray-700 border-gray-600';
  const buttonClass = `w-full flex justify-center items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors transform hover:scale-[1.02] active:scale-100 shadow-md ${isAdding ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
      <div className={`${modalBg} ${textClass} rounded-xl shadow-2xl p-6 w-full max-w-sm`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add Custom Timer</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-500/20">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="timerName" className="block text-sm font-medium mb-1">Name</label>
            <input
              id="timerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${inputBg} focus:ring-indigo-500 focus:border-indigo-500`}
              required
            />
          </div>
          <div>
            <label htmlFor="timerDuration" className="block text-sm font-medium mb-1">Duration (Minutes)</label>
            <input
              id="timerDuration"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${inputBg} focus:ring-indigo-500 focus:border-indigo-500`}
              min="1"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={isAdding} className={buttonClass}>
            {isAdding ? 'Adding...' : 'Add Timer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTimerModal;
