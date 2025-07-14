import React, { useState, useEffect } from 'react';
import { Palette, Plus, Check, Trash2, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { createCustomStyle, deleteCustomStyle, updateCustomStyle, onCustomStylesSnapshot, type CustomStyle } from '../lib/chat-controls-firebase';
import { auth } from '../lib/firebase';

// --- Color Definitions ---

// Updated chatStyles with new prompts and descriptions
const chatStyles = {
  'Normal': {
    description: 'Default conversation',
    prompt: '',
    color: '',
    hoverColor: '',
    lightBg: '',
    textColor: '',
  },
  'Formal & Professional': {
    description: 'Clear and professional communication',
    prompt: `[STRICT INSTRUCTION]
You are now operating in Formal & Professional Mode. You MUST follow these guidelines without exception:

1. Communication Style:
   - Directly address the user with clear, formal language.
   - Provide accurate, evidence-based results for all queries.
   - Ensure clarity, conciseness, and professionalism in every response.
   - Use industry-standard terminology when addressing complex issues.

2. Response Structure:
   - Begin with a clear introduction to the subject matter.
   - Organize content using bullet points or numbered lists for clarity.
   - Provide detailed analysis and data-driven insights for complex problems.
   - Conclude with actionable recommendations and a succinct summary.

3. Tone Requirements:
   - Maintain an objective, neutral, and respectful tone at all times.
   - Focus exclusively on facts, verifiable data, and logical reasoning.
   - Avoid colloquial language, personal anecdotes, or emotional expressions.

4. Prohibited Elements:
   - NO casual or informal language.
   - NO unnecessary verbosity or digressions from the topic.
   - NO humor, sarcasm, or personal opinions.

5. Format:
   - Adhere to strict business formatting with clear section headings.
   - Present information in a structured, logical hierarchy.
   - Ensure all responses are precise, data-driven, and tailored to address complex problems directly.

CRITICAL: Any deviation from these guidelines is NOT permitted. You must directly communicate with the user, providing professional, accurate, and comprehensive guidance at all times.`,
    color: 'bg-indigo-600',
    hoverColor: 'hover:bg-indigo-700',
    lightBg: 'bg-indigo-50 dark:bg-indigo-500/20',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  'Educational & Motivational': {
    description: 'Teaching focused, just like a tutor',
    prompt: `[STRICT INSTRUCTION]
You are now operating in Educational & Motivational Mode. You MUST follow these guidelines without exception:

1. Role as Educator:
   - Assume the role of a teacher/tutor specifically fine-tuned for educational guidance.
   - Understand and address the user's learning needs with tailored, accurate responses.
   - Encourage curiosity and foster a deeper understanding of complex topics.

2. Teaching Approach:
   - Break down complex concepts into clear, digestible parts.
   - Use concrete examples, analogies, and step-by-step explanations.
   - Emphasize clear learning objectives and ensure thorough comprehension.
   - Provide evidence-based information to address any knowledge gaps.

3. Motivational Elements:
   - Offer specific, encouraging feedback aligned with the user's progress.
   - Promote a growth mindset and celebrate learning milestones.
   - Provide actionable next steps to facilitate continuous learning and improvement.

4. Response Structure:
   - Begin with clearly stated learning objectives.
   - Organize content logically using bullet points, numbered steps, or subheadings.
   - Summarize key points and conclude with practical recommendations for further study.

5. Tone Requirements:
   - Maintain a supportive, engaging, and authoritative tone.
   - Use clear, accessible language that is tailored to the user’s level of understanding.
   - Balance detailed explanations with concise, focused instruction.

CRITICAL: Any deviation from these guidelines is NOT permitted. You must serve as an expert teacher and tutor, directly addressing the user's educational needs with precise, accurate, and comprehensible guidance.`,
    color: 'bg-emerald-600',
    hoverColor: 'hover:bg-emerald-700',
    lightBg: 'bg-emerald-50 dark:bg-emerald-500/20',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  'Casual & Friendly': {
    description: 'Warm and approachable conversation',
    prompt: `[STRICT INSTRUCTION]
You are now operating in Casual & Friendly Mode. You MUST follow these guidelines without exception:

1. Conversational Style:
   - Use natural, everyday language.
   - Maintain a warm, approachable tone.
   - Include appropriate conversational markers and personal touches.
   - Keep responses relatable and engaging.

2. Interaction Requirements:
   - Show active listening by referencing the user's input.
   - Use smooth conversational transitions.
   - Offer friendly acknowledgments and maintain personal connection.

3. Language Guidelines:
   - Use contractions naturally.
   - Incorporate conversational phrases and a relaxed tone.
   - Limit technical jargon and express ideas simply.

4. Tone Elements:
   - Maintain consistent warmth and genuine interest.
   - Express empathy appropriately.
   - Keep the overall energy positive and supportive.

5. Response Structure:
   - Begin with a friendly acknowledgment.
   - Follow a natural conversational flow.
   - Conclude with an encouraging closure.

CRITICAL: While maintaining casualness, you must still be professional and helpful. Never compromise accuracy or helpfulness for friendliness.`,
    color: 'bg-amber-600',
    hoverColor: 'hover:bg-amber-700',
    lightBg: 'bg-amber-50 dark:bg-amber-500/20',
    textColor: 'text-amber-700 dark:text-amber-300',
  }
};

// Refactored for consistent property names (`color`, `hoverColor`, etc.)
const CUSTOM_STYLE_COLORS = [
  { name: 'Rose', color: 'bg-rose-600', hoverColor: 'hover:bg-rose-700', lightBg: 'bg-rose-100 dark:bg-rose-500/20', textColor: 'text-rose-700 dark:text-rose-300' },
  { name: 'Sky', color: 'bg-sky-600', hoverColor: 'hover:bg-sky-700', lightBg: 'bg-sky-100 dark:bg-sky-500/20', textColor: 'text-sky-700 dark:text-sky-300' },
  { name: 'Purple', color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700', lightBg: 'bg-purple-100 dark:bg-purple-500/20', textColor: 'text-purple-700 dark:text-purple-300' },
  { name: 'Teal', color: 'bg-teal-600', hoverColor: 'hover:bg-teal-700', lightBg: 'bg-teal-100 dark:bg-teal-500/20', textColor: 'text-teal-700 dark:text-teal-300' },
  { name: 'Fuchsia', color: 'bg-fuchsia-600', hoverColor: 'hover:bg-fuchsia-700', lightBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', textColor: 'text-fuchsia-700 dark:text-fuchsia-300' },
  { name: 'Cyan', color: 'bg-cyan-600', hoverColor: 'hover:bg-cyan-700', lightBg: 'bg-cyan-100 dark:bg-cyan-500/20', textColor: 'text-cyan-700 dark:text-cyan-300' },
];

const { name: _name, ...defaultColorProps } = CUSTOM_STYLE_COLORS[0];
const DEFAULT_CUSTOM_COLOR_PROPS = defaultColorProps;

// --- Component ---

interface ChatControlsProps {
  onStyleSelect: (style: string, prompt: string) => void;
  activeStyle: string | null;
}

export function ChatControls({
  onStyleSelect,
  activeStyle,
}: ChatControlsProps) {
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<CustomStyle | null>(null);
  const [styleFormData, setStyleFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    ...DEFAULT_CUSTOM_COLOR_PROPS,
  });
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    if (activeStyle === null) {
      onStyleSelect('Normal', chatStyles.Normal.prompt);
    }
  }, [activeStyle, onStyleSelect]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((newUser) => {
      setUser(newUser);
      if (!newUser) {
        setCustomStyles([]); // Clear styles on logout
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onCustomStylesSnapshot(user.uid, setCustomStyles);
    return () => unsubscribe();
  }, [user?.uid]);

  const handleOpenStyleDialog = (style?: CustomStyle) => {
    if (style) {
      setEditingStyle(style);
      setStyleFormData({
        name: style.name,
        description: style.description,
        prompt: style.prompt,
        color: style.color || DEFAULT_CUSTOM_COLOR_PROPS.color,
        hoverColor: style.hoverColor || DEFAULT_CUSTOM_COLOR_PROPS.hoverColor,
        lightBg: style.lightBg || DEFAULT_CUSTOM_COLOR_PROPS.lightBg,
        textColor: style.textColor || DEFAULT_CUSTOM_COLOR_PROPS.textColor,
      });
    } else {
      setEditingStyle(null);
      setStyleFormData({
        name: '',
        description: '',
        prompt: '',
        ...DEFAULT_CUSTOM_COLOR_PROPS,
      });
    }
    setIsStyleDialogOpen(true);
  };

  const handleCloseStyleDialog = () => setIsStyleDialogOpen(false);

  const handleSaveStyle = async () => {
    if (!user || !styleFormData.name || !styleFormData.description || !styleFormData.prompt) return;
    try {
      const dataToSave = { ...styleFormData };
      if (editingStyle) {
        await updateCustomStyle(editingStyle.id, dataToSave);
      } else {
        await createCustomStyle(user.uid, dataToSave);
      }
      handleCloseStyleDialog();
    } catch (error) {
      console.error('Error saving style:', error);
    }
  };

  const handleDeleteStyle = async (styleId: string) => {
    try {
      await deleteCustomStyle(styleId);
    } catch (error) {
      console.error('Error deleting style:', error);
    }
  };

  const getActiveStyleDetails = () => {
    if (!activeStyle || activeStyle === 'Normal') return null;
    if (chatStyles[activeStyle]) {
      return chatStyles[activeStyle];
    }
    return customStyles.find(s => s.name === activeStyle) || null;
  };

  const activeStyleDetails = getActiveStyleDetails();

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
              activeStyleDetails
                ? `${activeStyleDetails.lightBg} ${activeStyleDetails.textColor}`
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-gray-700/80'
            }`}
            title="Change Chat Style"
          >
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Style</span>
          </button>
        </PopoverTrigger>
<PopoverContent 
  className="w-72 p-0 bg-white dark:bg-[#161922] shadow-xl rounded-lg border border-gray-200/80 dark:border-gray-700/60 font-poppins z-[99]" // <-- ADD THIS CLASS
  align="start"
  side="top"
  sideOffset={8}
>
          <div className="flex flex-col max-h-[400px]">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">Chat Styles</h4>
                {user && (
                    <button
                        className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/80"
                        onClick={() => handleOpenStyleDialog()}
                        title="Create Custom Style"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              <div className="space-y-1 mb-2">
                {Object.entries(chatStyles).map(([styleName, { description, prompt, color }]) => (
                  <button
                    key={styleName}
                    className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 ${
                      activeStyle === styleName
                        ? (styleName === 'Normal' ? `bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold` : `${color} text-white font-semibold`)
                        : `text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60`
                    }`}
                    onClick={() => onStyleSelect(styleName, prompt)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">{styleName}</div>
                      {activeStyle === styleName && <Check className="h-4 w-4" />}
                    </div>
                    <p className={`text-xs mt-0.5 font-normal ${activeStyle === styleName && styleName !== 'Normal' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                      {description}
                    </p>
                  </button>
                ))}
              </div>

{customStyles.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 px-2.5 pt-2 pb-1.5">Custom Styles</h5>
                  <div className="space-y-1">
                    {customStyles.map((style) => (
                      <div // <-- CHANGED from <button> to <div>
                        key={style.id}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 group cursor-pointer ${ // <-- ADDED cursor-pointer
                          activeStyle === style.name
                            ? `${style.color || DEFAULT_CUSTOM_COLOR_PROPS.color} text-white font-semibold`
                            : `text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60`
                        }`}
                        onClick={() => onStyleSelect(style.name, style.prompt)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate pr-2">{style.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); handleOpenStyleDialog(style); }} title="Edit Style"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10" onClick={(e) => { e.stopPropagation(); handleDeleteStyle(style.id); }} title="Delete Style"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                            {activeStyle === style.name && <Check className="h-4 w-4 ml-1" />}
                          </div>
                        </div>
                        <p className={`text-xs mt-0.5 font-normal text-left ${activeStyle === style.name ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{style.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
<DialogContent className="sm:max-w-xl bg-white dark:bg-[#161922] border border-gray-200/80 dark:border-gray-700/60 p-6 rounded-lg shadow-xl font-poppins z-[100]">          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingStyle ? 'Edit Custom Style' : 'Create Custom Style'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Create a new personality for TaskMaster to use in your conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="style-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Style Name</label>
              <input id="style-name" value={styleFormData.name} onChange={(e) => setStyleFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/80 rounded-lg text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" placeholder="e.g., Socratic Tutor"/>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Style Color</label>
              <div className="flex flex-wrap gap-3 pt-1">
                {CUSTOM_STYLE_COLORS.map((color) => {
                    const { name, ...colorData } = color;
                    return (
                        <button
                            key={color.color}
                            type="button"
                            onClick={() => setStyleFormData(prev => ({ ...prev, ...colorData }))}
                            className={`w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center ${color.color} ${
                            styleFormData.color === color.color 
                                ? '' 
                                : 'hover:opacity-80'
                            }`}
                            title={name}
                        >
                            {styleFormData.color === color.color && <Check className="w-5 h-5 text-white" />}
                        </button>
                    );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="style-description" className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="style-description" value={styleFormData.description} onChange={(e) => setStyleFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/80 rounded-lg text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition min-h-[60px] resize-none" placeholder="A brief description of this style." rows={2}/>
            </div>

            <div className="space-y-2">
              <label htmlFor="style-prompt" className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Prompt (System Instructions)</label>
              <textarea id="style-prompt" value={styleFormData.prompt} onChange={(e) => setStyleFormData(prev => ({ ...prev, prompt: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/80 rounded-lg text-sm text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition min-h-[120px] resize-none" placeholder="Instruct the AI on how to behave. For example: 'You are a helpful pirate who says Arrr!'" rows={5}/>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseStyleDialog} className="px-4 py-2 text-sm rounded-md bg-transparent dark:bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200">Cancel</Button>
            <Button 
              type="button"
              onClick={handleSaveStyle}
              className={`px-4 py-2 text-sm rounded-md text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${styleFormData.color} ${styleFormData.hoverColor}`}
              disabled={!styleFormData.name || !styleFormData.description || !styleFormData.prompt}
            >
              {editingStyle ? 'Update Style' : 'Create Style'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
