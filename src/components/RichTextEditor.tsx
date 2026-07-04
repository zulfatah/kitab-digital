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
  Type,
  Loader2,
  Eraser
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

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
  const { addToast } = useApp();
  const [isAiCorrecting, setIsAiCorrecting] = useState(false);
  const [lastEditorState, setLastEditorState] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const [editorState, setEditorState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    unorderedList: false,
    orderedList: false,
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

  const handleAiRequest = async (customInstruction?: string, mode?: string) => {
    if (!editorRef.current) return;
    const currentHTML = editorRef.current.innerHTML;
    setLastEditorState(currentHTML);
    const plainText = editorRef.current.innerText || '';
    
    if (!plainText.trim() && !customInstruction) {
      addToast('Teks Kosong', 'Silakan tulis sesuatu sebelum menggunakan asisten AI.', 'info');
      return;
    }

    setIsAiCorrecting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/gemini/fix-text', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          text: currentHTML,
          instruction: customInstruction,
          mode
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal memproses teks dengan AI');
      }

      const data = await res.json();
      if (data.fixedText) {
        editorRef.current.innerHTML = data.fixedText;
        handleInput();
        addToast('Penyuntingan AI Berhasil', 'Tulisan Anda telah disempurnakan dengan bantuan asisten AI.', 'success');
      } else {
        throw new Error('Hasil perbaikan AI kosong.');
      }
    } catch (error: any) {
      console.error('AI Request error:', error);
      addToast('Gagal Memproses Teks', error.message || 'Terjadi kesalahan saat memproses perbaikan AI.', 'error');
    } finally {
      setIsAiCorrecting(false);
    }
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
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
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

  const cleanSelectedHtml = () => {
    if (!editorRef.current || disabled) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      addToast('Pilih Teks Terlebih Dahulu', 'Silakan seleksi (blok) bagian teks yang ingin dibersihkan dari tag tersembunyi (seperti br, p, div, dll).', 'info');
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      
      // Clone selection contents to a temporary div to parse HTML
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());
      
      // Convert break tags and block paragraph endings to newlines/spaces
      let htmlContent = container.innerHTML;
      htmlContent = htmlContent.replace(/<br\s*\/?>/gi, ' ');
      htmlContent = htmlContent.replace(/<\/p>/gi, '\n');
      htmlContent = htmlContent.replace(/<\/div>/gi, '\n');
      
      // Create a temporary element to extract clean text without other hidden tags
      const tempElement = document.createElement('div');
      tempElement.innerHTML = htmlContent;
      
      // Get the stripped content
      const cleanText = tempElement.innerText || tempElement.textContent || '';
      
      // Delete selection
      range.deleteContents();
      
      // Insert clean text
      const textNode = document.createTextNode(cleanText);
      range.insertNode(textNode);
      
      // Refocus editor and select the new node
      if (editorRef.current) {
        editorRef.current.focus();
      }
      
      // Trigger change and recalculate
      handleInput();
      
      addToast('Teks Diperbaiki', 'Berhasil membersihkan tag HTML tersembunyi (seperti br, p, div, dll) dari teks terpilih.', 'success');
    } catch (error) {
      console.error('Error cleaning selection tags:', error);
      addToast('Gagal Memperbaiki Teks', 'Terjadi kesalahan saat membersihkan tag tersembunyi.', 'error');
    }
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
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.unorderedList ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
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
              className={`p-1.5 rounded transition-all cursor-pointer hover:bg-[#E5E1D8] dark:hover:bg-stone-800 ${
                editorState.orderedList ? 'bg-[#5A5A40] text-white hover:bg-[#454530]' : 'text-[#777266] dark:text-[#A8A890]'
              }`}
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

          {/* AI Assistant */}
          <div className="flex items-center gap-1.5 ml-auto border-r border-[#E5E1D8] dark:border-stone-800 pr-2 mr-1">
            <button
              id="btn-ai-fix-text"
              type="button"
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`px-2 py-1 rounded-md flex items-center gap-1 text-[11px] font-medium transition-all cursor-pointer border ${
                showAiPanel || isAiCorrecting
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/60' 
                  : 'bg-amber-50 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30'
              }`}
              title="Gunakan Asisten Penulisan AI"
            >
              {isAiCorrecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              )}
              <span>Asisten AI</span>
            </button>
          </div>

          {/* Undo / Redo & Clear Format */}
          <div className="flex items-center gap-0.5">
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
                cleanSelectedHtml();
              }}
              className="p-1.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer flex items-center gap-1"
              title="Perbaiki Teks Seleksi (Hapus tag HTML tersembunyi seperti br, p, div, dll)"
            >
              <Eraser className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline font-semibold text-[10px] uppercase tracking-wider">Bersihkan Tag</span>
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

      {/* AI PANEL */}
      {showAiPanel && !disabled && (
        <div className="bg-amber-50/75 dark:bg-amber-950/15 border-b border-[#E5E1D8] dark:border-[#3A3A30] p-3 text-stone-800 dark:text-stone-200 select-none animate-fade-in">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Asisten Penulisan AI Khazanah
              </span>
              <button 
                type="button"
                onClick={() => setShowAiPanel(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs focus:outline-none cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {/* Prompt Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customAiPrompt}
                onChange={(e) => setCustomAiPrompt(e.target.value)}
                placeholder="Perintahkan AI... (misal: 'Tambahkan pohon struktur/hierarki', 'Ringkas tulisan ini', 'Buat lebih formal')"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#E5E1D8] dark:border-stone-800 bg-white dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAiRequest(customAiPrompt);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleAiRequest(customAiPrompt)}
                disabled={isAiCorrecting}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 shrink-0"
              >
                {isAiCorrecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Kirim</span>
              </button>
              {lastEditorState && (
                <button
                  type="button"
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = lastEditorState;
                      setLastEditorState(null);
                      handleInput();
                      addToast('Penyuntingan Dibatalkan', 'Teks telah dikembalikan ke kondisi sebelumnya.', 'info');
                    }
                  }}
                  disabled={isAiCorrecting}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 shrink-0"
                >
                  <span>Undo</span>
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px]">
              <span className="text-stone-400 dark:text-stone-500 font-medium">Pilihan Cepat:</span>
              <button
                type="button"
                onClick={() => handleAiRequest(undefined, 'typo')}
                disabled={isAiCorrecting}
                className="px-2 py-1 rounded bg-white dark:bg-stone-900 border border-[#E5E1D8] dark:border-stone-800 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer text-[#5A5A40] dark:text-[#A8A890]"
              >
                ✨ Perbaiki Ejaan & Typo
              </button>
              <button
                type="button"
                onClick={() => handleAiRequest(undefined, 'structure')}
                disabled={isAiCorrecting}
                className="px-2 py-1 rounded bg-white dark:bg-stone-900 border border-[#E5E1D8] dark:border-stone-800 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer text-[#5A5A40] dark:text-[#A8A890]"
              >
                📋 Rapikan Struktur & Tanda Baca
              </button>
              <button
                type="button"
                onClick={() => handleAiRequest('Ubah gaya penulisan teks ini agar terlihat sangat formal, akademis, dan bernada ilmiah tanpa mengubah maknanya.')}
                disabled={isAiCorrecting}
                className="px-2 py-1 rounded bg-white dark:bg-stone-900 border border-[#E5E1D8] dark:border-stone-800 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer text-[#5A5A40] dark:text-[#A8A890]"
              >
                🎓 Ubah ke Akademis/Formal
              </button>
              <button
                type="button"
                onClick={() => handleAiRequest('Ubah gaya bahasa agar lebih mengalir indah, estetis, dan kaya akan tata bahasa sastra yang memukau.')}
                disabled={isAiCorrecting}
                className="px-2 py-1 rounded bg-white dark:bg-stone-900 border border-[#E5E1D8] dark:border-stone-800 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer text-[#5A5A40] dark:text-[#A8A890]"
              >
                📖 Sastra & Kreatif
              </button>
            </div>
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
