import React, { useState } from 'react';
import SplitPane from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css';
import {
    MessageCircle, Globe, Lock, Trash2, Sparkles, BookOpen, X, SplitSquareVertical, Check
} from 'lucide-react';

interface Note {
    id: string;
    title: string;
    content: string;
    isPublic: boolean;
    keyPoints?: string[];
    questions?: { question: string; options: string[]; correctAnswer: number; explanation: string; }[];
    type: 'personal' | 'pdf' | 'youtube' | 'audio';
    tags: string[];
    sourceUrl?: string;
}

interface SplitViewProps {
    leftNote: Note | null;
    rightNote: Note | null;
    onClose: () => void;
    onTogglePublic: (noteId: string, isPublic: boolean) => Promise<void>;
    onDelete: (noteId: string) => Promise<void>;
    onChat: (note: Note) => void;
    isIlluminateEnabled: boolean;
    isBlackoutEnabled: boolean;
}

export function SplitView({
    leftNote, rightNote, onClose, onTogglePublic, onDelete, onChat, isIlluminateEnabled
}: SplitViewProps) {
    const [sizes, setSizes] = useState<(string | number)[]>([50, 50]);
    const isDarkMode = !isIlluminateEnabled;

    const renderNote = (note: Note | null) => {
        if (!note) {
            return (
                <div className={`h-full flex flex-col items-center justify-center bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 rounded-lg p-4 text-gray-700 dark:text-gray-300 text-center text-sm`}>
                    Note loading...
                </div>
            );
        }

        // This class applies Tailwind's typography styles to the rendered HTML
        const proseClass = `prose prose-sm max-w-none 
            ${isDarkMode ? 'prose-invert' : ''} 
            prose-h2:text-xl prose-h3:text-lg prose-h4:text-base 
            prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4
            prose-p:leading-relaxed 
            prose-ul:my-2 prose-ol:my-2
            prose-li:my-1
            prose-a:text-indigo-600 dark:prose-a:text-indigo-400
            prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic
            prose-img:rounded-lg prose-img:shadow-md
            prose-table:text-sm
        `;

        return (
            <div className={`h-full flex flex-col bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden shadow-sm`}>
                <div className={`p-2 md:p-3 border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-between flex-shrink-0`}>
                    <h2 className={`text-sm font-semibold text-gray-800 dark:text-gray-100 truncate pr-2`} title={note.title}>{note.title || 'Untitled'}</h2>
                    <div className={`flex items-center gap-1 border rounded-full p-0.5 border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-[#1A1D29]/50`}>
                        <button onClick={() => onChat(note)} className={`p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60`} title="Chat with this note"><MessageCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onTogglePublic(note.id, note.isPublic)} className={`p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60`} title={note.isPublic ? 'Make private' : 'Make public'}>{note.isPublic ? <Globe className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400`} /> : <Lock className="w-3.5 h-3.5" />}</button>
                        <div className={`w-px h-3 bg-gray-300 dark:bg-gray-700/50 mx-0.5`}></div>
                        <button onClick={() => { if (window.confirm(`Delete "${note.title || 'Untitled'}"?`)) { onDelete(note.id); } }} className={`p-1 rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/30`} title="Delete note"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {/* Main Content Rendered via dangerouslySetInnerHTML */}
                    <div
                        className={proseClass}
                        dangerouslySetInnerHTML={{ __html: note.content || '' }}
                    />

                    {note.keyPoints && note.keyPoints.length > 0 && (
                        <div className={`mt-6 border-t pt-4 border-gray-200 dark:border-gray-700/50`}>
                            <h3 className={`text-base font-semibold mb-2 flex items-center gap-2 text-gray-800 dark:text-gray-100`}><Sparkles className={`w-4 h-4 text-yellow-500 dark:text-yellow-400`} />Key Points</h3>
                            <ul className="space-y-2 text-sm">
                                {note.keyPoints.map((point, index) => (
                                    <li key={index} className={`flex items-start gap-2 text-gray-700 dark:text-gray-300`}>
                                        <span className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500`}></span>
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {note.questions && note.questions.length > 0 && (
                        <div className={`mt-6 border-t pt-4 border-gray-200 dark:border-gray-700/50`}>
                            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100`}><BookOpen className={`w-4 h-4 text-purple-500 dark:text-purple-400`} />Study Questions</h3>
                            <div className="space-y-3">
                                {note.questions.map((q, index) => (
                                    <div key={`${note.id}-q-${index}`} className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-sm`}>
                                        <p className={`text-gray-800 dark:text-gray-200 mb-2`}><span className="font-semibold">{index + 1}.</span> {q.question}</p>
                                        <div className="space-y-1">
                                            {q.options.map((option, optIndex) => (
                                                <div key={optIndex} className={`px-2 py-1 rounded text-xs flex items-center gap-2 ${optIndex === q.correctAnswer ? 'bg-green-100 dark:bg-green-700/30 text-green-800 dark:text-green-200 font-medium' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300'}`}>
                                                    {optIndex === q.correctAnswer && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            <div className={`mt-2 pt-2 border-t text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400`}><strong className="font-semibold">Explanation: </strong>{q.explanation}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`h-full flex flex-col bg-[#F7F8FA] dark:bg-[#0C0E1A] p-2 md:p-4`}>
            <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
                <h2 className={`text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 md:gap-2`}>
                    <SplitSquareVertical className="w-4 h-4 md:w-5 md:h-5" /> Split View
                </h2>
                <button onClick={onClose} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm flex items-center gap-1`}>
                    <X className="w-3.5 h-3.5 md:w-4 md:h-4" /> Exit
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                <style>{`
                    .split-view-container { height: 100%; }
                    .split-view-container > .split-pane { height: 100% !important; position: relative; }
                    .split-pane > .split-pane-resizer {
                        background: ${isDarkMode ? '#334155' : '#e2e8f0'};
                        opacity: 1;
                        z-index: 10;
                        box-sizing: border-box;
                        background-clip: padding-box;
                        width: 8px;
                        margin: 0 -3px;
                        border-left: 3px solid transparent;
                        border-right: 3px solid transparent;
                        cursor: col-resize;
                        transition: background-color 0.2s ease;
                    }
                    .split-pane > .split-pane-resizer:hover {
                        background-color: ${isDarkMode ? '#475569' : '#cbd5e1'};
                    }
                    .split-pane > div {
                         height: 100%;
                         overflow: hidden;
                         position: relative;
                    }
                `}</style>
                <div className="split-view-container">
                    <SplitPane split="vertical" sizes={sizes} onChange={setSizes}>
                        <div className="h-full">{renderNote(leftNote)}</div>
                        <div className="h-full">{renderNote(rightNote)}</div>
                    </SplitPane>
                </div>
            </div>
        </div>
    );
}
