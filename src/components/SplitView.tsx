import React, { useState } from 'react';
import SplitPane from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css';
import {
MessageCircle, Globe, Lock, Trash2, Sparkles, BookOpen, X, SplitSquareVertical, Check, CheckSquare, Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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
leftNote, rightNote, onClose, onTogglePublic, onDelete, onChat, isIlluminateEnabled, isBlackoutEnabled
}: SplitViewProps) {
const [sizes, setSizes] = useState<(string | number)[]>([50, 50]);
const isDarkMode = !isIlluminateEnabled;


const renderNote = (note: Note | null) => {
    if (!note) {
        return ( <div className={`h-full flex flex-col items-center justify-center bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 rounded-lg p-4 text-gray-700 dark:text-gray-300 text-center text-sm`}> Note loading... </div> );
    }

    const proseClassPanel = `prose prose-xs sm:prose-sm max-w-none ${isDarkMode ? 'prose-invert' : ''} 
    prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-100 
    prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-1.5 
    prose-ul:list-disc prose-ul:my-1 prose-ul:ml-3 dark:prose-ul:text-gray-300 
    prose-ol:list-decimal prose-ol:my-1 prose-ol:ml-3 dark:prose-ol:text-gray-300 
    prose-li:my-0.5 prose-li:ml-1.5 dark:prose-li:text-gray-300 
    prose-a:text-indigo-600 dark:prose-a:text-indigo-400 hover:prose-a:text-indigo-700 dark:hover:prose-a:text-indigo-300 
    prose-blockquote:border-l-2 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-2 prose-blockquote:italic prose-blockquote:text-xs prose-blockquote:my-1 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 
    prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-gray-800/70 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px] prose-code:text-pink-600 dark:prose-code:text-pink-400
    prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800/70 prose-pre:rounded-md prose-pre:p-2 prose-pre:text-gray-700 dark:prose-pre:text-gray-200 
    prose-img:rounded-lg prose-img:shadow-sm prose-img:max-w-full 
    prose-table:my-2 prose-table:w-full prose-table:text-xs prose-table:border-collapse prose-table:border prose-table:border-gray-300 dark:prose-table:border-gray-600
    prose-thead:border-b prose-thead:border-gray-300 dark:prose-thead:border-gray-600 prose-th:bg-gray-50 dark:prose-th:bg-gray-700/60 prose-th:px-1.5 prose-th:py-0.5 prose-th:font-medium prose-th:text-left prose-th:text-gray-700 dark:prose-th:text-gray-200
    prose-tbody:divide-y prose-tbody:divide-gray-200 dark:prose-tbody:divide-gray-700 prose-td:px-1.5 prose-td:py-0.5 prose-td:text-gray-600 dark:prose-td:text-gray-300`;


    return (
        <div className={`h-full flex flex-col bg-white dark:bg-[#161922] border border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden shadow-sm`}>
            <div className={`p-2 md:p-3 border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-between flex-shrink-0`}>
                <h2 className={`text-sm font-semibold text-gray-800 dark:text-gray-100 truncate pr-2`} title={note.title}>{note.title || 'Untitled'}</h2>
                <div className={`flex items-center gap-1 border rounded-full p-0.5 border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-[#1A1D29]/50`}>
                    <button onClick={() => onChat(note)} className={`p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60`} title="Chat with this note"><MessageCircle className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onTogglePublic(note.id, note.isPublic)} className={`p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 ${note.isPublic ? 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30' : ''}`} title={note.isPublic ? 'Make private' : 'Make public'}>{note.isPublic ? <Globe className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400`} /> : <Lock className="w-3.5 h-3.5" />}</button>
                    <div className={`w-px h-3 bg-gray-300 dark:bg-gray-700/50 mx-0.5`}></div>
                    <button onClick={async () => {
                        if (window.confirm(`Delete "${note.title || 'Untitled'}"?`)) {
                            await onDelete(note.id);
                        }
                        }} className={`p-1 rounded-full text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/30`} title="Delete note"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                <div className={`${proseClassPanel} mb-4`}>
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}
                     components={{
                        img: ({node, ...props}) => <img className="max-w-full h-auto rounded-md my-2 shadow-sm" {...props} alt={props.alt || 'Note image'}/>,
                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                        li: ({ node, children, ...props }) => {
                            const isTaskListItem = typeof (node?.children?.[0] as any)?.checked === 'boolean';
                            if (isTaskListItem) {
                                const checked = (node!.children[0] as any).checked;
                                const restOfChildren = React.Children.toArray(children).slice(1);
                                return ( <li className="flex items-start mb-0.5 text-xs list-none -ml-3" {...props}> <span className="mr-1 mt-0.5 flex-shrink-0"> {checked ? <CheckSquare className="w-3 h-3 text-green-500" /> : <Square className="w-3 h-3 text-gray-400" />} </span> <div className="flex-grow">{restOfChildren}</div> </li> );
                            }
                            return <li className="mb-0" {...props}>{children}</li>;
                        },
                     }}
                    >{note.content || ''}</ReactMarkdown>
                </div>
                {note.keyPoints && note.keyPoints.length > 0 && ( <div className={`mt-4 border-t pt-3 border-gray-200 dark:border-gray-700/50`}> <h3 className={`text-xs font-semibold mb-1.5 flex items-center gap-1 text-gray-800 dark:text-gray-100`}><Sparkles className={`w-3 h-3 text-yellow-500 dark:text-yellow-400`} />Key Points</h3> <ul className="space-y-1 text-xs"> {note.keyPoints.map((point, index) => ( <li key={index} className={`flex items-start gap-1.5 text-gray-700 dark:text-gray-300`}><span className={`flex-shrink-0 mt-1 w-1 h-1 rounded-full bg-indigo-500 dark:bg-indigo-400`}></span>{point}</li> ))} </ul> </div> )}
                {note.questions && note.questions.length > 0 && ( <div className={`mt-4 border-t pt-3 border-gray-200 dark:border-gray-700/50`}> <h3 className={`text-xs font-semibold mb-2 flex items-center gap-1 text-gray-800 dark:text-gray-100`}><BookOpen className={`w-3 h-3 text-purple-500 dark:text-purple-400`} />Study Questions</h3> <div className="space-y-2"> {note.questions.map((q, index) => ( <div key={`${note.id}-q-${index}`} className={`p-1.5 rounded bg-gray-50/50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-[10px]`}> <p className={`text-gray-700 dark:text-gray-200 mb-1`}><span className="font-medium">{index + 1}.</span> {q.question}</p> <div className="space-y-0.5"> {q.options.map((option, optIndex) => ( <div key={optIndex} className={`px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1 ${optIndex === q.correctAnswer ? 'bg-green-100 dark:bg-green-700/30 text-green-800 dark:text-green-200 font-medium border border-green-200 dark:border-green-600' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300'}`}> {optIndex === q.correctAnswer && <Check className="w-2.5 h-2.5 flex-shrink-0" />} {option} </div> ))} </div> {q.explanation && ( <div className={`mt-1 pt-1 border-t text-[9px] border-gray-200/70 dark:border-gray-600/40 text-gray-600 dark:text-gray-400`}><span className="font-medium">Explanation: </span>{q.explanation}</div> )} </div> ))} </div> </div> )}
            </div>
        </div>
    );
};

return (
    <div className={`h-full flex flex-col bg-[#F7F8FA] dark:bg-[#0C0E1A] p-2 md:p-4`}>
        <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
            <h2 className={`text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 md:gap-2`}> <SplitSquareVertical className="w-4 h-4 md:w-5 md:h-5" /> Split View </h2>
            <button onClick={onClose} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm flex items-center gap-1`} > <X className="w-3.5 h-3.5 md:w-4 md:h-4" /> Exit </button>
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
