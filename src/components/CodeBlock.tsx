import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Download, Eye, Check } from 'lucide-react';

interface CodeBlockProps {
  children: string;
  className?: string;
  isDarkMode?: boolean;
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  isDarkMode?: boolean;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, code, language }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isPreviewable = ['html', 'css', 'javascript', 'js', 'jsx', 'tsx'].includes(language.toLowerCase());

  const renderPreview = () => {
    if (!isPreviewable) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] p-8">
          <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-highlight)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Preview Not Available</h3>
          <p className="text-center text-[var(--text-secondary)]">
            Live preview is currently supported for HTML, CSS, and JavaScript files only.
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {language.toUpperCase()} files can still be copied and downloaded.
          </p>
        </div>
      );
    }

    if (language.toLowerCase() === 'html') {
      return (
        <iframe
          srcDoc={code}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
          title="HTML Preview"
        />
      );
    }

    if (language.toLowerCase() === 'css') {
      const htmlWithCSS = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>${code}</style>
        </head>
        <body>
          <div class="demo-content">
            <h1>CSS Preview</h1>
            <p>This is a sample paragraph to demonstrate your CSS styles.</p>
            <button>Sample Button</button>
            <div class="box">Sample Box</div>
          </div>
        </body>
        </html>
      `;
      return (
        <iframe
          srcDoc={htmlWithCSS}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
          title="CSS Preview"
        />
      );
    }

    if (['javascript', 'js', 'jsx', 'tsx'].includes(language.toLowerCase())) {
      const htmlWithJS = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
            #output { margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>JavaScript Preview</h1>
          <div id="output"></div>
          <script>
            const originalLog = console.log;
            const originalError = console.error;
            const outputDiv = document.getElementById('output');
            
            console.log = function(...args) {
              outputDiv.innerHTML += '<div style="color: #333; margin: 4px 0;">' + args.join(' ') + '</div>';
              originalLog.apply(console, args);
            };
            
            console.error = function(...args) {
              outputDiv.innerHTML += '<div style="color: #d32f2f; margin: 4px 0;">Error: ' + args.join(' ') + '</div>';
              originalError.apply(console, args);
            };
            
            try {
              ${code}
            } catch (error) {
              console.error(error.message);
            }
          </script>
        </body>
        </html>
      `;
      return (
        <iframe
          srcDoc={htmlWithJS}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
          title="JavaScript Preview"
        />
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl w-full max-w-4xl h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-primary)'
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-primary)] bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] font-[var(--font-heading)] truncate">
                Live Preview - {language.toUpperCase()} Code
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-highlight)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
            title="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, isDarkMode = false }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Extract language from className (e.g., "language-javascript" -> "javascript")
  let language = className?.replace(/language-/, '') || '';
  
  // If no language is detected, try to infer from common patterns
  if (!language || language === 'text') {
    const codeContent = children.toLowerCase().trim();
    if (codeContent.includes('<!doctype html') || codeContent.includes('<html')) {
      language = 'html';
    } else if (codeContent.includes('<script') || codeContent.includes('function ') || codeContent.includes('const ') || codeContent.includes('let ')) {
      language = 'javascript';
    } else if (codeContent.includes('{') && codeContent.includes('}') && (codeContent.includes('color:') || codeContent.includes('margin:') || codeContent.includes('padding:'))) {
      language = 'css';
    } else if (codeContent.includes('def ') || codeContent.includes('import ') || codeContent.includes('print(')) {
      language = 'python';
    } else {
      language = 'text';
    }
  }
  
  const code = children.trim();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const downloadCode = () => {
    const fileExtensions: { [key: string]: string } = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      'c++': 'cpp',
      c: 'c',
      html: 'html',
      css: 'css',
      json: 'json',
      xml: 'xml',
      yaml: 'yml',
      yml: 'yml',
      markdown: 'md',
      sql: 'sql',
      php: 'php',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      shell: 'sh',
      bash: 'sh',
      powershell: 'ps1',
      jsx: 'jsx',
      tsx: 'tsx',
      vue: 'vue',
      svelte: 'svelte'
    };

    const extension = fileExtensions[language.toLowerCase()] || 'txt';
    const filename = `code.${extension}`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isPreviewable = ['html', 'css', 'javascript', 'js', 'jsx', 'tsx'].includes(language.toLowerCase());

  return (
    <>
      <div className="relative group my-4">
        {/* Header with language and buttons */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-t-lg border-b-0">
          <span className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {language === 'text' ? 'Plain Text' : language}
          </span>
          <div className="flex items-center gap-2">
            {isPreviewable && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] transition-colors"
                title="Preview code"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            )}
            <button
              onClick={downloadCode}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] transition-colors"
              title="Download code"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded bg-[var(--bg-highlight)] hover:bg-[var(--interactive-hover)] text-[var(--text-secondary)] transition-colors"
              title="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 scale-x-[-1]" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code content */}
        <div className="relative">
          <SyntaxHighlighter
            language={language}
            style={isDarkMode ? {
              ...oneDark,
              'code[class*="language-"]': {
                ...oneDark['code[class*="language-"]'],
                color: 'var(--text-primary)',
              },
              'pre[class*="language-"]': {
                ...oneDark['pre[class*="language-"]'],
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-card)',
              },
            } : {
              ...oneLight,
              'code[class*="language-"]': {
                ...oneLight['code[class*="language-"]'],
                color: 'var(--text-primary)',
              },
              'pre[class*="language-"]': {
                ...oneLight['pre[class*="language-"]'],
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-highlight)',
              },
            }}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              borderBottomLeftRadius: '0.5rem',
              borderBottomRightRadius: '0.5rem',
              border: `1px solid var(--border-primary)`,
              borderTop: 0,
              backgroundColor: isDarkMode ? 'var(--bg-card)' : 'var(--bg-highlight)',
              color: 'var(--text-primary) !important',
              fontSize: '14px',
              lineHeight: '1.5',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
            }}
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: '2.5rem',
              paddingRight: '1rem',
              color: isDarkMode ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontSize: '12px',
            }}
            wrapLines={true}
            wrapLongLines={true}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        code={code}
        language={language}
        isDarkMode={isDarkMode}
      />
    </>
  );
};

export default CodeBlock;
