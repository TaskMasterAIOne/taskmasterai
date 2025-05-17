import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Brain, Save } from 'lucide-react';
import type { UserContext } from '../lib/ai-context-firebase';

interface ContextDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (context: Partial<UserContext>) => void;
  initialContext?: UserContext | null;
  isBlackoutEnabled: boolean;
  isIlluminateEnabled: boolean;
}

export function ContextDialog({
  isOpen,
  onClose,
  onSave,
  initialContext,
  isBlackoutEnabled,
  isIlluminateEnabled
}: ContextDialogProps) {
  const [context, setContext] = useState<Partial<UserContext>>({
    workDescription: '',
    shortTermFocus: '',
    longTermGoals: '',
    otherContext: ''
  });

  useEffect(() => {
    if (initialContext) {
      setContext(initialContext);
    } else {
      setContext({
        workDescription: '',
        shortTermFocus: '',
        longTermGoals: '',
        otherContext: ''
      });
    }
  }, [initialContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(context);
    onClose();
  };

  const dialogContentClass = [
    'sm:max-w-xl', // Made slightly wider
    'p-6',
    isIlluminateEnabled
      ? 'bg-white border-gray-300 text-gray-900'
      : isBlackoutEnabled
      ? 'bg-black border-gray-700 text-gray-200'
      : 'bg-gray-800 border-gray-700 text-gray-200',
    'rounded-lg' // Added rounded corners to the dialog itself
  ].join(' ');

  const titleClass = isIlluminateEnabled ? 'text-gray-800' : 'text-gray-100';

  const labelClass = [
    'text-sm font-medium',
    isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'
  ].join(' ');

  const textareaClass = [
    'flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors', // min-h slightly reduced, rounded-lg
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500',
    isIlluminateEnabled
      ? 'bg-gray-50 border-gray-300 text-gray-800 placeholder:text-gray-400 hover:bg-gray-100'
      : isBlackoutEnabled
      ? 'bg-gray-850 border-gray-700 text-gray-200 placeholder:text-gray-500 hover:bg-gray-800'
      : 'bg-gray-700 border-gray-600 text-gray-200 placeholder:text-gray-500 hover:bg-gray-650'
  ].join(' ');
  
  const saveButtonStyle = [
    'text-white',
    isIlluminateEnabled
      ? 'bg-blue-500 hover:bg-blue-600'
      : 'bg-blue-600 hover:bg-blue-700'
  ].join(' ');


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={dialogContentClass}>
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <Brain className={`w-6 h-6 ${isIlluminateEnabled ? 'text-blue-500' : 'text-blue-400'}`} />
            <h2 className={`text-lg font-semibold ${titleClass}`}>
              Context Settings
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="workDescription" className={labelClass}>
                Study/Work Overview
              </label>
              <textarea
                id="workDescription"
                value={context.workDescription || ''}
                onChange={(e) => setContext(prev => ({ ...prev, workDescription: e.target.value }))}
                className={`mt-1 ${textareaClass}`}
                placeholder="e.g., 2nd Year CS Student @ XYZ University; Focus: Web Dev, AI"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="shortTermFocus" className={labelClass}>
                Short-Term Focus & Priorities
              </label>
              <textarea
                id="shortTermFocus"
                value={context.shortTermFocus || ''}
                onChange={(e) => setContext(prev => ({ ...prev, shortTermFocus: e.target.value }))}
                className={`mt-1 ${textareaClass}`}
                placeholder="e.g., Midterms (Calculus, Data Structures), Project for History class, Finish online Python course"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="longTermGoals" className={labelClass}>
                Long-Term Goals & Aspirations
              </label>
              <textarea
                id="longTermGoals"
                value={context.longTermGoals || ''}
                onChange={(e) => setContext(prev => ({ ...prev, longTermGoals: e.target.value }))}
                className={`mt-1 ${textareaClass}`}
                placeholder="e.g., Graduate with Honors, Internship in Software Eng., Master's degree in AI, Personal project on mobile apps"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="otherContext" className={labelClass}>
                Additional Notes or Preferences
              </label>
              <textarea
                id="otherContext"
                value={context.otherContext || ''}
                onChange={(e) => setContext(prev => ({ ...prev, otherContext: e.target.value }))}
                className={`mt-1 ${textareaClass}`}
                placeholder="e.g., Involved in Coding Club, prefer examples in JavaScript, learning about quantum computing"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className={`rounded-lg px-4 py-2 ${isIlluminateEnabled 
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50' 
                    : 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'}`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={`rounded-lg px-4 py-2 ${saveButtonStyle}`}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Context
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
