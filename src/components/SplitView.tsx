import React, { useState, useMemo } from 'react';
import SplitPane from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css';
import {
    MessageCircle, Globe, Lock, Trash2, Sparkles, BadgeCheck, BookOpen, X, SplitSquareVertical, Check
} from 'lucide-react';
import katex from 'katex';
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

// Reusable component to render plain text strings that may contain LaTeX
const RenderWithLatex: React.FC<{ text: string | undefined }> = ({ text }) => {
    const renderedHtml = useMemo(() => {
        if (!text) return '';
        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        return text.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false,
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                return match;
            }
        });
    }, [text]);

    return <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
};

// Reusable component to render larger HTML blocks that may contain LaTeX
const KatexRenderer: React.FC<{ htmlContent: string | undefined }> = ({ htmlContent }) => {
    const renderedContent = useMemo(() => {
        if (!htmlContent) return '';
        const regex = /\$\$\s*([\s\S]*?)\s*\$\$|\$(.*?)\$/g;
        return htmlContent.replace(regex, (match, displayMath, inlineMath) => {
            const contentToRender = displayMath || inlineMath;
            const isDisplayMode = !!displayMath;
            try {
                return katex.renderToString(contentToRender, {
                    throwOnError: false,
                    displayMode: isDisplayMode,
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                return match;
            }
        });
    }, [htmlContent]);
    
    return <div dangerouslySetInnerHTML={{ __html: renderedContent }} />;
};


export function SplitView({
    leftNote, rightNote, onClose, onTogglePublic, onDelete, onChat, isIlluminateEnabled
}: SplitViewProps) {
    const [sizes, setSizes] = useState<(string | number)[]>([50, 50]);
    const isDarkMode = !isIlluminateEnabled;

    const renderNote = (note: Note | null) => {
        if (!note) {
            return (
                <div className={`h-full flex flex-col items-center justify-center bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-4 text-[var(--text-secondary)] text-center text-sm`}>
                    Note loading...
                </div>
            );
        }

        const proseClass = `prose prose-sm max-w-none 
            ${isDarkMode ? 'prose-invert' : ''} 
            prose-h2:text-xl prose-h3:text-lg prose-h4:text-base 
            prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4
            prose-p:leading-relaxed 
            prose-ul:my-2 prose-ol:my-2
            prose-li:my-1
            prose-a:text-[var(--bg-accent)]
            prose-blockquote:border-l-4 prose-blockquote:border-[var(--border-primary)] prose-blockquote:pl-4 prose-blockquote:italic
            prose-img:rounded-lg prose-img:shadow-md
            prose-table:text-sm
        `;

        return (
            <div className={`h-full flex flex-col bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg overflow-hidden shadow-sm`}>
                <div className={`p-2 md:p-3 border-b border-[var(--border-primary)] flex items-center justify-between flex-shrink-0`}>
                    <h2 className={`text-sm font-semibold text-[var(--text-primary)] truncate pr-2`} title={note.title}>{note.title || 'Untitled'}</h2>
                    <div className={`flex items-center gap-1 border rounded-full p-0.5 border-[var(--border-primary)] bg-[var(--bg-highlight)]`}>
                        <button onClick={() => onChat(note)} className={`p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title="Chat with this note"><MessageCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onTogglePublic(note.id, note.isPublic)} className={`p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--interactive-hover)]`} title={note.isPublic ? 'Make private' : 'Make public'}>{note.isPublic ? <Globe className={`w-3.5 h-3.5 text-[var(--bg-accent)]`} /> : <Lock className="w-3.5 h-3.5" />}</button>
                        <div className={`w-px h-3 bg-[var(--border-primary)] mx-0.5`}></div>
                        <button onClick={() => { if (window.confirm(`Delete "${note.title || 'Untitled'}"?`)) { onDelete(note.id); } }} className={`p-1 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30`} title="Delete note"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4 scrollbar-thin scrollbar-thumb-[var(--border-primary)] scrollbar-track-transparent">
                    {/* --- FIX: Main Content Rendered via KatexRenderer --- */}
                    <div className={proseClass}>
                        <KatexRenderer htmlContent={note.content} />
                    </div>

                    {note.keyPoints && note.keyPoints.length > 0 && (
                        <div className={`mt-6 border-t pt-4 border-[var(--border-primary)]`}>
                            <h3 className={`text-base font-semibold mb-2 flex items-center gap-2 text-[var(--text-primary)]`}><BadgeCheck className={`w-4 h-4 text-[var(--text-primary)]`} />Key Points</h3>
                            <ul className="space-y-2 text-sm">
                                {note.keyPoints.map((point, index) => (
                                    <li key={index} className={`flex items-start gap-2 text-[var(--text-secondary)]`}>
                                        <span className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--bg-accent)]`}></span>
                                        {/* --- FIX: Render Key Points with LaTeX --- */}
                                        <RenderWithLatex text={point} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {note.questions && note.questions.length > 0 && (
                        <div className={`mt-6 border-t pt-4 border-[var(--border-primary)]`}>
                            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 text-[var(--text-primary)]`}><BookOpen className={`w-4 h-4 text-[var(--bg-accent)]`} />Study Questions</h3>
                            <div className="space-y-3">
                                {note.questions.map((q, index) => (
                                    <div key={`${note.id}-q-${index}`} className={`p-3 rounded-lg bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-sm`}>
                                        {/* --- FIX: Render Question with LaTeX --- */}
                                        <p className={`text-[var(--text-primary)] mb-2`}><span className="font-semibold">{index + 1}.</span> <RenderWithLatex text={q.question} /></p>
                                        <div className="space-y-1">
                                            {q.options.map((option, optIndex) => (
                                                <div key={optIndex} className={`px-2 py-1 rounded text-xs flex items-center gap-2 ${optIndex === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-medium' : 'bg-[var(--bg-highlight)] text-[var(--text-secondary)]'}`}>
                                                    {optIndex === q.correctAnswer && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                                    {/* --- FIX: Render Options with LaTeX --- */}
                                                    <RenderWithLatex text={option} />
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            /* --- FIX: Render Explanation with LaTeX --- */
                                            <div className={`mt-2 pt-2 border-t text-xs border-[var(--border-primary)] text-[var(--text-muted)]`}><strong className="font-semibold">Explanation: </strong><RenderWithLatex text={q.explanation} /></div>
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
        <div className={`h-full flex flex-col bg-[var(--bg-primary)] p-2 md:p-4`}>
            <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
                <h2 className={`text-base md:text-lg font-semibold text-[var(--text-primary)] flex items-center gap-1.5 md:gap-2`}>
                    <SplitSquareVertical className="w-4 h-4 md:w-5 md:h-5" /> Split View
                </h2>
                <button onClick={onClose} className={`bg-[var(--bg-card)] hover:bg-[var(--interactive-hover)] text-[var(--text-primary)] px-2.5 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm flex items-center gap-1`}>
                    <X className="w-3.5 h-3.5 md:w-4 md:h-4" /> Exit
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                <style>{`
                    .split-view-container { height: 100%; }
                    .split-view-container > .split-pane { height: 100% !important; position: relative; }
                    .split-pane > .split-pane-resizer {
                        background: var(--border-primary);
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
                        background-color: var(--interactive-hover);
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
