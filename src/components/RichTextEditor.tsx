/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  RotateCcw,
  RotateCw,
  Trash2,
  Sparkles,
  Type
} from 'lucide-react';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = 'Tulis di sini...',
  dir = 'ltr',
  className = '',
  style = {},
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef(false);

  const [editorState, setEditorState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
  });

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Sync external value to inner editor HTML
  useEffect(() => {
    if (editorRef.current && !isTypingRef.current) {
      const currentHTML = editorRef.current.innerHTML;
      if (currentHTML !== value) {
        editorRef.current.innerHTML = value || '';
        updateCounts();
      }
    }
  }, [value]);

  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || editorRef.current.textContent || '';
    const cleanText = text.trim();
    setCharCount(cleanText.length);
    setWordCount(cleanText ? cleanText.split(/\s+/).length : 0);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    isTypingRef.current = true;
    const html = editorRef.current.innerHTML;
    // Normalize empty content
    const sanitizedHTML = html === '<br>' || html === '<div><br></div>' ? '' : html;
    onChange(sanitizedHTML);
    updateCounts();
    
    // Reset typing lock
    setTimeout(() => {
      isTypingRef.current = false;
    }, 50);
  };

  const updateToolbarStates = () => {
    if (disabled) return;
    setEditorState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
      alignJustify: document.queryCommandState('justifyFull'),
    });
  };

  const executeCommand = (command: string, val: string = '') => {
    if (disabled) return;
    
    // Keep focus inside editor
    if (editorRef.current) {
      editorRef.current.focus();
    }
    
    document.execCommand(command, false, val);
    handleInput();
    updateToolbarStates();
  };

  // Color options for theological highlights or citation references
  const colors = [
    { name: 'Default', value: 'inherit', class: 'bg-stone-800 dark:bg-stone-200' },
    { name: 'Red Accent (Penting)', value: '#DC2626', class: 'bg-red-600' },
    { name: 'Green Accent (Kutipan/Ayat)', value: '#16A34A', class: 'bg-green-600' },
    { name: 'Blue Accent (Syarah)', value: '#2563EB', class: 'bg-blue-600' },
    { name: 'Gold Accent (Catatan)', value: '#D97706', class: 'bg-amber-600' },
  ];

  return (
    <div 
      className={`border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl overflow-hidden bg-white dark:bg-[#121210] flex flex-col transition-all ${
        disabled ? 'opacity-70 pointer-events-none' : 'hover:border-[#C0BAA9] dark:hover:border-stone-600 focus-within:ring-1 focus-within:ring-[#5A5A40] focus-within:border-[#5A5A40]'
      }`}
      style={style}
    >
      {/* TOOLBAR */}
      {!disabled && (
        <div 
          className="flex flex-wrap items-center gap-1 p-1.5 bg-[#FDFBF7] dark:bg-stone-950 border-b border-[#E5E1D8] dark:border-[#3A3A30] select-none"
          onMouseDown={(e) => {
            // Prevent editor from losing focus when clicking within toolbar area
            e.preventDefault();
          }}
        >
          {/* Text Style */}
          <div className="flex items-center gap-0.5 border-r border-[#E5E1D8] dark:border-stone-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('bold');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.bold ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Tebal (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('italic');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.italic ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Miring (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('underline');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.underline ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Garis Bawah (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('strikeThrough');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.strikeThrough ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Coret Teks"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 border-r border-[#E5E1D8] dark:border-stone-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyLeft');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.alignLeft ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Rata Kiri"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyCenter');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.alignCenter ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Rata Tengah"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyRight');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.alignRight ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Rata Kanan"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyFull');
              }}
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.alignJustify ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
              title="Rata Kiri Kanan"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 border-r border-[#E5E1D8] dark:border-stone-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('insertUnorderedList');
              }}
              className="p-1.5 rounded text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-stone-800 transition-all cursor-pointer"
              title="Daftar Bulatan"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('insertOrderedList');
              }}
              className="p-1.5 rounded text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-stone-800 transition-all cursor-pointer"
              title="Daftar Angka"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Highlight Presets */}
          <div className="flex items-center gap-1 border-r border-[#E5E1D8] dark:border-stone-800 pr-1.5 mr-1.5">
            <span className="text-[10px] text-stone-400 font-mono flex items-center gap-0.5">
              <Type className="w-3 h-3" /> Warna:
            </span>
            {colors.map((col) => (
              <button
                key={col.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeCommand('foreColor', col.value);
                }}
                className={`w-3.5 h-3.5 rounded-full border border-stone-200 dark:border-stone-700 hover:scale-125 transition-all cursor-pointer`}
                style={{ backgroundColor: col.value === 'inherit' ? undefined : col.value }}
                title={`Pilih Warna ${col.name}`}
              />
            ))}
          </div>

          {/* Undo / Redo & Clear Format */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('undo');
              }}
              className="p-1.5 rounded text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-stone-800 transition-all cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('redo');
              }}
              className="p-1.5 rounded text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-stone-800 transition-all cursor-pointer"
              title="Redo"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('removeFormat');
              }}
              className="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
              title="Hapus Semua Format Teks"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* EDITABLE CONTAINER */}
      <div className="relative flex-1 flex flex-col min-h-[90px] p-3 text-stone-800 dark:text-stone-100 focus-within:outline-none">
        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyUp={updateToolbarStates}
          onMouseUp={updateToolbarStates}
          dir={dir}
          className={`flex-1 focus:outline-none whitespace-pre-wrap break-words prose dark:prose-invert prose-xs max-w-none prose-p:my-0 pb-4 ${className}`}
          style={{ 
            minHeight: '80px',
            outline: 'none',
          }}
        />
        
        {/* Placeholder element for contentEditable */}
        {(!value || value === '<br>' || value === '<div><br></div>') && (
          <div 
            className={`absolute top-3 pointer-events-none text-stone-400/80 dark:text-stone-600/80 text-xs italic ${
              dir === 'rtl' ? 'right-3 text-right' : 'left-3 text-left'
            }`}
          >
            {placeholder}
          </div>
        )}

        {/* Counter footer */}
        <div className="absolute bottom-1 right-2 flex items-center gap-2 text-[9px] font-mono text-stone-400 dark:text-stone-500 pointer-events-none">
          <span>{wordCount} kata</span>
          <span>•</span>
          <span>{charCount} karakter</span>
        </div>
      </div>
    </div>
  );
}
