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
import { CHAT_STYLES } from '../lib/chat-styles';
import { auth } from '../lib/firebase';

const chatStyles = CHAT_STYLES;

const CUSTOM_STYLE_COLORS = [
  { name: 'Rose', color: 'bg-rose-600', hoverColor: 'hover:bg-rose-700', lightBg: 'bg-rose-100 dark:bg-rose-500/20', textColor: 'text-rose-700 dark:text-rose-300' },
  { name: 'Sky', color: 'bg-sky-600', hoverColor: 'hover:bg-sky-700', lightBg: 'bg-sky-100 dark:bg-sky-500/20', textColor: 'text-sky-700 dark:text-sky-300' },
  { name: 'Purple', color: 'bg-purple-600', hoverColor: 'hover:bg-purple-700', lightBg: 'bg-purple-100 dark:bg-purple-500/20', textColor: 'text-purple-700 dark:text-purple-300' },
  { name: 'Teal', color: 'bg-teal-600', hoverColor: 'hover:bg-teal-700', lightBg: 'bg-teal-100 dark:bg-teal-500/20', textColor: 'text-teal-700 dark:text-teal-300' },
  { name: 'Fuchsia', color: 'bg-fuchsia-600', hoverColor: 'hover:bg-fuchsia-700', lightBg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', textColor: 'text-fuchsia-700 dark:text-fuchsia-300' },
  { name: 'Lime', color: 'bg-lime-600', hoverColor: 'hover:bg-lime-700', lightBg: 'bg-lime-100 dark:bg-lime-500/20', textColor: 'text-lime-700 dark:text-lime-300' },
  { name: 'Orange', color: 'bg-orange-600', hoverColor: 'hover:bg-orange-700', lightBg: 'bg-orange-100 dark:bg-orange-500/20', textColor: 'text-orange-700 dark:text-orange-300' },
  { name: 'Pink', color: 'bg-pink-600', hoverColor: 'hover:bg-pink-700', lightBg: 'bg-pink-100 dark:bg-pink-500/20', textColor: 'text-pink-700 dark:text-pink-300' },
  { name: 'Stone', color: 'bg-stone-600', hoverColor: 'hover:bg-stone-700', lightBg: 'bg-stone-100 dark:bg-stone-500/20', textColor: 'text-stone-700 dark:text-stone-300' },
  { name: 'Yellow', color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600', lightBg: 'bg-yellow-100 dark:bg-yellow-500/20', textColor: 'text-yellow-700 dark:text-yellow-300' },
  { name: 'Green', color: 'bg-green-600', hoverColor: 'hover:bg-green-700', lightBg: 'bg-green-100 dark:bg-green-500/20', textColor: 'text-green-700 dark:text-green-300' },
  { name: 'Blue', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-700', lightBg: 'bg-blue-100 dark:bg-blue-500/20', textColor: 'text-blue-700 dark:text-blue-300' },
];

const { name: _name, ...defaultColorProps } = CUSTOM_STYLE_COLORS[0];
const DEFAULT_CUSTOM_COLOR_PROPS = defaultColorProps;

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
        setCustomStyles([]);
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
      const randomColorIndex = Math.floor(Math.random() * CUSTOM_STYLE_COLORS.length);
      const { name: _name, ...randomColorProps } = CUSTOM_STYLE_COLORS[randomColorIndex];
      setStyleFormData({
        name: '',
        description: '',
        prompt: '',
        ...randomColorProps,
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[15px] font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
              activeStyleDetails
                ? `${activeStyleDetails.lightBg} ${activeStyleDetails.textColor}`
                : 'text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]'
            }`}
            title="Change Chat Style"
          >
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Style</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-0 bg-[var(--bg-primary)] shadow-xl rounded-lg border border-[var(--border-primary)] font-clarika z-[99]"
          align="start"
          side="top"
          sideOffset={8}
        >
          <div className="flex flex-col max-h-[400px]">
            <div className="p-3 border-b border-[var(--border-primary)]">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-[var(--text-primary)]">Chat Styles</h4>
                {user && (
                    <button
                        className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]"
                        onClick={() => handleOpenStyleDialog()}
                        title="Create Custom Style"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 scrollbar-thin scrollbar-thumb-[var(--border-secondary)]">
              <div className="space-y-1 mb-2">
                {Object.entries(chatStyles).map(([styleName, { description, prompt, color }]) => (
                  <button
                    key={styleName}
                    className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 ${
                      activeStyle === styleName
                        ? (styleName === 'Normal' ? `bg-[var(--bg-highlight)] text-[var(--text-primary)] font-semibold` : `${color} text-white font-semibold`)
                        : `text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]`
                    }`}
                    onClick={() => onStyleSelect(styleName, prompt)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium">{styleName}</div>
                      {activeStyle === styleName && <Check className="h-4 w-4" />}
                    </div>
                    <p className={`text-xs mt-0.5 font-normal ${activeStyle === styleName && styleName !== 'Normal' ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                      {description}
                    </p>
                  </button>
                ))}
              </div>

              {customStyles.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold uppercase text-[var(--text-muted)] px-2.5 pt-2 pb-1.5">Custom Styles</h5>
                  <div className="space-y-1">
                    {customStyles.map((style) => (
                      <div
                        key={style.id}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-all duration-200 group cursor-pointer ${
                          activeStyle === style.name
                            ? `${style.color || DEFAULT_CUSTOM_COLOR_PROPS.color} text-white font-semibold`
                            : `text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]`
                        }`}
                        onClick={() => onStyleSelect(style.name, style.prompt)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate pr-2">{style.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1.5 rounded-full hover:bg-[var(--overlay-dark)]" onClick={(e) => { e.stopPropagation(); handleOpenStyleDialog(style); }} title="Edit Style"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button className="p-1.5 rounded-full hover:bg-[var(--overlay-dark)]" onClick={(e) => { e.stopPropagation(); handleDeleteStyle(style.id); }} title="Delete Style"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                            {activeStyle === style.name && <Check className="h-4 w-4 ml-1" />}
                          </div>
                        </div>
                        <p className={`text-xs mt-0.5 font-normal text-left ${activeStyle === style.name ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{style.description}</p>
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
        <DialogContent className="sm:max-w-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 rounded-lg shadow-xl font-clarika z-[100]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
              {editingStyle ? 'Edit Custom Style' : 'Create Custom Style'}
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-muted)]">
              Create a new personality for TaskMaster to use in your conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="style-name" className="text-sm font-medium text-[var(--text-secondary)]">Style Name</label>
              <input id="style-name" value={styleFormData.name} onChange={(e) => setStyleFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition" placeholder="e.g., Chem Tutor"/>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Style Color</label>
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
              <label htmlFor="style-description" className="text-sm font-medium text-[var(--text-secondary)]">Description</label>
              <textarea id="style-description" value={styleFormData.description} onChange={(e) => setStyleFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition min-h-[60px] resize-none" placeholder="A brief description of this style." rows={2}/>
            </div>

            <div className="space-y-2">
              <label htmlFor="style-prompt" className="text-sm font-medium text-[var(--text-secondary)]">AI's Instructions</label>
              <textarea id="style-prompt" value={styleFormData.prompt} onChange={(e) => setStyleFormData(prev => ({ ...prev, prompt: e.target.value }))} className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--bg-accent)] focus:border-[var(--bg-accent)] outline-none transition min-h-[120px] resize-none" placeholder="Instruct TaskMaster on how to behave. For example: 'You're my chill chem tutor who makes hard stuff easy to get.'" rows={5}/>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseStyleDialog} className="px-4 py-2 text-sm rounded-md bg-transparent border-[var(--border-secondary)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)]">Cancel</Button>
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
