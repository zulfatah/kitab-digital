/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Kitab, Chapter, Paragraph, TreeNode, buildTree, sortChaptersByTree, migrateChaptersToTree, recalculateHierarchicalNumbers } from '../types';
import RichTextEditor from './RichTextEditor';
import { Plus, Trash2, Save, BookOpen, FileText, Sparkles, X, ArrowLeft, Layers, File, ChevronRight, ChevronDown, ArrowUp, ArrowDown, FolderPlus, RefreshCw } from 'lucide-react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
    const combinedRef = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    };

    const adjustHeight = () => {
      const textarea = internalRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const nextHeight = Math.max(textarea.scrollHeight, 40);
        textarea.style.height = `${nextHeight}px`;
      }
    };

    useEffect(() => {
      // Small timeout to ensure it runs after the DOM is fully rendered and styles applied
      const timer = setTimeout(adjustHeight, 50);
      return () => clearTimeout(timer);
    }, [value]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          adjustHeight();
        }}
        className={`${className} resize-y overflow-y-hidden`}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = 'AutoResizeTextarea';

const PRESET_CATEGORIES = ['Hadis', 'Fikih', 'Tasawuf', 'Tafsir', 'Akhlak', 'Sejarah', 'Kajian'];

export default function KitabWriter() {
  const { saveCustomKitab, currentUserEmail, setView, addToast, editingKitabId, allKitabs } = useApp();

  // Kitab metadata states
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Kajian');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Chapter structure state
  const [chapters, setChapters] = useState<Chapter[]>([
    {
      id: `ch_${Date.now()}`,
      title: 'Bab 1: Pendahuluan',
      number: 1,
      paragraphs: [
        {
          id: `p_${Date.now()}_1`,
          arabic: '',
          translation: '',
          explanation: '',
          page: 1
        }
      ]
    }
  ]);

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [activePageNumber, setActivePageNumber] = useState(1);
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [customNodes, setCustomNodes] = useState<Record<string, boolean>>({});

  // Toggle state to remember if a paragraph has translation / explanation enabled
  const [toggledFields, setToggledFields] = useState<Record<string, { trans: boolean; expl: boolean }>>({});
  const [initializedId, setInitializedId] = useState<string | null | undefined>(undefined);
  const [arabicExplanations, setArabicExplanations] = useState<Record<string, boolean>>({});
  const [mainLtrFields, setMainLtrFields] = useState<Record<string, boolean>>({});
  const [transRtlFields, setTransRtlFields] = useState<Record<string, boolean>>({});

  // Helper values to extract current chapter paragraphs and page lists
  const activeChapterParagraphs = useMemo(() => {
    return chapters[activeChapterIndex]?.paragraphs || [];
  }, [chapters, activeChapterIndex]);

  const uniquePages = useMemo(() => {
    const pages = activeChapterParagraphs.map(p => (p.page || 1) as number);
    const sortedUnique = Array.from(new Set(pages)).sort((a: any, b: any) => a - b);
    return sortedUnique.length > 0 ? sortedUnique : [1];
  }, [activeChapterParagraphs]);

  const paragraphsOnActivePage = useMemo(() => {
    return activeChapterParagraphs.filter(p => (p.page || 1) === activePageNumber);
  }, [activeChapterParagraphs, activePageNumber]);

  // Sync activePageNumber when switching chapters
  useEffect(() => {
    if (uniquePages.length > 0) {
      if (!uniquePages.includes(activePageNumber)) {
        setActivePageNumber(uniquePages[0]);
      }
    } else {
      setActivePageNumber(1);
    }
  }, [activeChapterIndex]);

  // Load existing Kitab if editingKitabId is provided
  useEffect(() => {
    if (initializedId === editingKitabId) return;

    if (editingKitabId) {
      const kitabToEdit = allKitabs.find(k => k.id === editingKitabId);
      if (kitabToEdit) {
        setTitle(kitabToEdit.title);
        setAuthor(kitabToEdit.author);
        setCategory(kitabToEdit.category);
        setIsCustomCategory(!PRESET_CATEGORIES.includes(kitabToEdit.category));
        setDescription(kitabToEdit.description);
        setIsPublic(kitabToEdit.isPublic === true || (kitabToEdit as any).isPublic === 1);
        
        // Ensure all loaded paragraphs have a page number (default to index-based page or 1)
        const normalizedChapters = (kitabToEdit.chapters || []).map(ch => ({
          ...ch,
          paragraphs: (ch.paragraphs || []).map((p, idx) => ({
            ...p,
            page: p.page || (idx + 1) // default to 1 paragraph = 1 page for legacy kitabs
          }))
        }));

        setChapters(normalizedChapters.length > 0 ? normalizedChapters : [
          {
            id: `ch_${Date.now()}`,
            title: 'Bab 1: Pendahuluan',
            number: 1,
            paragraphs: [
              {
                id: `p_${Date.now()}_1`,
                arabic: '',
                translation: '',
                explanation: '',
                page: 1
              }
            ]
          }
        ]);
        setActiveChapterIndex(0);
        
        // Setup toggle state for legacy/existing paragraphs
        const toggles: Record<string, { trans: boolean; expl: boolean }> = {};
        normalizedChapters.forEach(ch => {
          ch.paragraphs.forEach(p => {
            toggles[p.id] = {
              trans: p.translation !== undefined && p.translation !== '',
              expl: p.explanation !== undefined && p.explanation !== ''
            };
          });
        });
        setToggledFields(toggles);
        setInitializedId(editingKitabId);
      }
    } else {
      // Clear states if writing a new one
      setTitle('');
      setAuthor('');
      setCategory('Kajian');
      setIsCustomCategory(false);
      setDescription('');
      setIsPublic(false);
      setChapters([
        {
          id: `ch_${Date.now()}`,
          title: 'Bab 1: Pendahuluan',
          number: 1,
          paragraphs: [
            {
              id: `p_${Date.now()}_1`,
              arabic: '',
              translation: '',
              explanation: '',
              page: 1
            }
          ]
        }
      ]);
      setActiveChapterIndex(0);
      setActivePageNumber(1);
      setToggledFields({});
      setInitializedId(editingKitabId);
    }
  }, [editingKitabId, allKitabs, initializedId]);

  // Metadata categories list
  const categories = PRESET_CATEGORIES;

  // Chapter actions
  const addChapter = () => {
    // Legacy support, also acts as adding a root chapter node
    const roots = chapters.filter(c => !c.parentId);
    const chNum = roots.length + 1;
    let lastPage = 1;
    let maxPage = 0;
    chapters.forEach(ch => {
      ch.paragraphs?.forEach(p => {
        const pVal = typeof p.page === 'number' ? p.page : parseInt(p.page as any) || 1;
        if (pVal > maxPage) maxPage = pVal;
      });
    });
    if (maxPage > 0) lastPage = maxPage + 1;

    const newCh: Chapter = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: `Node Baru #${chNum}`,
      number: chNum,
      nodeType: 'Bab',
      paragraphs: [
        {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          arabic: '',
          translation: '',
          explanation: '',
          page: lastPage
        }
      ]
    };
    const newChapters = [...chapters, newCh];
    const updated = recalculateHierarchicalNumbers(newChapters);
    setChapters(updated);
    const newActiveIdx = updated.findIndex(c => c.id === newCh.id);
    setActiveChapterIndex(newActiveIdx >= 0 ? newActiveIdx : updated.length - 1);
    setActivePageNumber(lastPage);
  };

  const addSubChapter = () => {
    // Legacy support, also acts as adding a child node under currently selected node
    const activeCh = chapters[activeChapterIndex];
    if (!activeCh) return;

    const siblings = chapters.filter(c => c.parentId === activeCh.id);
    const subNum = siblings.length + 1;
    const chNum = `${activeCh.number}.${subNum}`;

    let lastPage = 1;
    let maxPage = 0;
    chapters.forEach(ch => {
      ch.paragraphs?.forEach(p => {
        const pVal = typeof p.page === 'number' ? p.page : parseInt(p.page as any) || 1;
        if (pVal > maxPage) maxPage = pVal;
      });
    });
    if (maxPage > 0) lastPage = maxPage + 1;

    const newCh: Chapter = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: `Sub-Node Baru #${subNum}`,
      number: chNum,
      parentId: activeCh.id,
      nodeType: 'Fasal',
      paragraphs: [
        {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          arabic: '',
          translation: '',
          explanation: '',
          page: lastPage
        }
      ]
    };

    const unsortedChapters = [...chapters, newCh];
    const updated = recalculateHierarchicalNumbers(unsortedChapters);
    setChapters(updated);
    const newActiveIdx = updated.findIndex(c => c.id === newCh.id);
    setActiveChapterIndex(newActiveIdx >= 0 ? newActiveIdx : updated.length - 1);
    setActivePageNumber(lastPage);
  };

  const removeChapter = (index: number) => {
    if (chapters.length === 1) return;
    const chToDelete = chapters[index];
    if (!chToDelete) return;

    // Find descendants recursively
    const idsToDelete = new Set<string>([chToDelete.id]);
    let checkMore = true;
    while (checkMore) {
      const startSize = idsToDelete.size;
      chapters.forEach(ch => {
        if (ch.parentId && idsToDelete.has(ch.parentId)) {
          idsToDelete.add(ch.id);
        }
      });
      if (idsToDelete.size === startSize) {
        checkMore = false;
      }
    }

    const filtered = chapters.filter(ch => !idsToDelete.has(ch.id));
    const updated = recalculateHierarchicalNumbers(filtered);
    setChapters(updated);
    setActiveChapterIndex(0);
  };

  // NEW TREE ACTIONS!
  const indentChapter = (id: string) => {
    const ch = chapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = chapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx > 0) {
      const prevSibling = siblings[idx - 1];
      const updated = chapters.map(c => {
        if (c.id === id) {
          return { ...c, parentId: prevSibling.id };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIndex(activeIdx);
    }
  };

  const outdentChapter = (id: string) => {
    const ch = chapters.find(c => c.id === id);
    if (!ch || !ch.parentId) return;
    const parentNode = chapters.find(c => c.id === ch.parentId);
    const newParentId = parentNode ? parentNode.parentId : undefined;
    const updated = chapters.map(c => {
      if (c.id === id) {
        return { ...c, parentId: newParentId };
      }
      return c;
    });
    const sorted = recalculateHierarchicalNumbers(updated);
    setChapters(sorted);
    const activeIdx = sorted.findIndex(c => c.id === id);
    if (activeIdx >= 0) setActiveChapterIndex(activeIdx);
  };

  const moveChapterUp = (id: string) => {
    const ch = chapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = chapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx > 0) {
      // Swap numbers/orders
      const prevSibling = siblings[idx - 1];
      const updated = chapters.map(c => {
        if (c.id === id) {
          return { ...c, number: prevSibling.number };
        }
        if (c.id === prevSibling.id) {
          return { ...c, number: ch.number };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIndex(activeIdx);
    }
  };

  const moveChapterDown = (id: string) => {
    const ch = chapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = chapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx < siblings.length - 1) {
      // Swap numbers/orders
      const nextSibling = siblings[idx + 1];
      const updated = chapters.map(c => {
        if (c.id === id) {
          return { ...c, number: nextSibling.number };
        }
        if (c.id === nextSibling.id) {
          return { ...c, number: ch.number };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIndex(activeIdx);
    }
  };

  const updateChapterParent = (id: string, newParentId: string | undefined) => {
    // Prevent cycle
    if (newParentId === id) return;
    const isDescendant = (targetId: string, potentialParentId: string): boolean => {
      let curr = targetId;
      while (curr) {
        const checkCh = chapters.find(c => c.id === curr);
        if (!checkCh) break;
        if (checkCh.parentId === potentialParentId) return true;
        curr = checkCh.parentId || '';
      }
      return false;
    };
    if (newParentId && isDescendant(newParentId, id)) return;

    const updated = chapters.map(c => {
      if (c.id === id) {
        return { ...c, parentId: newParentId };
      }
      return c;
    });
    const sorted = recalculateHierarchicalNumbers(updated);
    setChapters(sorted);
    const activeIdx = sorted.findIndex(c => c.id === id);
    if (activeIdx >= 0) setActiveChapterIndex(activeIdx);
  };

  const updateNodeType = (id: string, newType: string) => {
    setChapters(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, nodeType: newType };
      }
      return c;
    }));
  };

  const updateChapterTitle = (index: number, newTitle: string) => {
    setChapters(prev => prev.map((ch, idx) => {
      if (idx === index) {
        return { ...ch, title: newTitle };
      }
      return ch;
    }));
  };

  // Page Actions (Halaman) within a Chapter
  const addPageToActiveChapter = () => {
    const nextPageNum = Math.max(...uniquePages, 0) + 1;
    const pId = `p_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newParagraph: Paragraph = {
      id: pId,
      arabic: '',
      translation: '',
      explanation: '',
      page: nextPageNum
    };

    setChapters(prev => prev.map((ch, idx) => {
      // Shift page numbers of any paragraph that is equal to or greater than nextPageNum
      const updatedParagraphs = ch.paragraphs.map(p => {
        const pageVal = (p.page || 1) as number;
        if (pageVal >= nextPageNum) {
          return { ...p, page: pageVal + 1 };
        }
        return p;
      });

      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: [...updatedParagraphs, newParagraph]
        };
      }
      return {
        ...ch,
        paragraphs: updatedParagraphs
      };
    }));
    
    setActivePageNumber(nextPageNum);
  };

  const removePageFromActiveChapter = (pageToRemove: number) => {
    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter) return;
    const currentParagraphs = activeChapter.paragraphs;
    
    // Check if it's the only page left
    const otherPages = new Set(currentParagraphs.map(p => p.page || 1));
    otherPages.delete(pageToRemove);
    if (otherPages.size === 0) {
      addToast('Hapus Gagal', 'Harus ada setidaknya satu halaman di dalam Bab.', 'warning');
      return;
    }

    // Filter out paragraphs belonging to the removed page
    const filtered = currentParagraphs.filter(p => (p.page || 1) !== pageToRemove);

    setChapters(prev => prev.map((ch, idx) => {
      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: filtered
        };
      }
      return ch;
    }));

    const remainingPagesList = Array.from(otherPages).sort((a: any, b: any) => a - b);
    setActivePageNumber(remainingPagesList[0] || 1);
    addToast('Halaman Dihapus', `Halaman ${pageToRemove} telah berhasil dihapus.`, 'success');
  };

  // Paragraph Actions (Paragraf) within an active Page
  const addParagraphToActivePage = () => {
    const pId = `p_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newParagraph: Paragraph = {
      id: pId,
      arabic: '',
      translation: '',
      explanation: '',
      page: activePageNumber
    };

    setChapters(prev => prev.map((ch, idx) => {
      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: [...ch.paragraphs, newParagraph]
        };
      }
      return ch;
    }));
  };

  const removeParagraphFromActivePage = (pId: string) => {
    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter) return;
    const currentParagraphs = activeChapter.paragraphs;

    // Check if it is the last paragraph on this page
    const pageParagraphs = currentParagraphs.filter(p => (p.page || 1) === activePageNumber);
    if (pageParagraphs.length === 1) {
      addToast(
        'Gagal Menghapus',
        'Harus ada setidaknya satu paragraf di dalam halaman ini. Silakan hapus halamannya saja jika ingin menghapus seluruh halaman ini.',
        'warning'
      );
      return;
    }

    const filtered = currentParagraphs.filter(p => p.id !== pId);

    setChapters(prev => prev.map((ch, idx) => {
      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: filtered
        };
      }
      return ch;
    }));
  };

  const updateParagraphFieldById = (pId: string, field: keyof Paragraph, value: any) => {
    setChapters(prev => prev.map((ch, idx) => {
      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: ch.paragraphs.map(p => {
            if (p.id === pId) {
              return { ...p, [field]: value };
            }
            return p;
          })
        };
      }
      return ch;
    }));
  };

  const handleToggleField = (pId: string, type: 'trans' | 'expl') => {
    const currentVal = toggledFields[pId] || { 
      trans: !!activeChapterParagraphs.find(p => p.id === pId)?.translation, 
      expl: !!activeChapterParagraphs.find(p => p.id === pId)?.explanation 
    };
    
    const nextVal = {
      ...currentVal,
      [type]: !currentVal[type]
    };

    // 1. Update the toggle state
    setToggledFields(prev => ({
      ...prev,
      [pId]: nextVal
    }));

    // 2. Clear/update chapters state cleanly
    setChapters(prev => prev.map((ch, idx) => {
      if (idx === activeChapterIndex) {
        return {
          ...ch,
          paragraphs: ch.paragraphs.map(p => {
            if (p.id === pId) {
              const updatedP = { ...p };
              if (type === 'trans' && !nextVal.trans) {
                updatedP.translation = '';
              }
              if (type === 'expl' && !nextVal.expl) {
                updatedP.explanation = '';
              }
              return updatedP;
            }
            return p;
          })
        };
      }
      return ch;
    }));
  };

  const handleSaveKitab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !description.trim()) {
      addToast('Data Belum Lengkap', 'Judul, penulis, dan ringkasan kitab wajib diisi.', 'warning');
      return;
    }

    // Validate chapters and paragraphs
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.title.trim()) {
        addToast('Judul Bab Kosong', `Judul Bab ${i + 1} tidak boleh kosong.`, 'warning');
        setActiveChapterIndex(i);
        return;
      }
      if (ch.paragraphs.length === 0) {
        addToast('Paragraf Kosong', `Bab "${ch.title}" harus memiliki setidaknya satu halaman dan paragraf.`, 'warning');
        setActiveChapterIndex(i);
        return;
      }
      for (let pIdx = 0; pIdx < ch.paragraphs.length; pIdx++) {
        const p = ch.paragraphs[pIdx];
        if (!p.arabic.trim()) {
          addToast(
            'Isi Paragraf Kosong',
            `Paragraf di Bab "${ch.title}" Halaman ${p.page || 1} tidak boleh kosong. Harap isi teks Arab / paragraf utama.`,
            'warning'
          );
          setActiveChapterIndex(i);
          setActivePageNumber(p.page || 1);
          return;
        }
      }
    }

    const sortedChaptersToSave = sortChaptersByTree([...chapters])
      .map(ch => ({
        ...ch,
        paragraphs: [...ch.paragraphs].sort((a, b) => (a.page || 1) - (b.page || 1))
      }));

    const newKitab: Kitab = {
      id: editingKitabId || `kitab_custom_${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      category,
      description: description.trim(),
      isPublic,
      chapters: sortedChaptersToSave,
      createdAt: editingKitabId 
        ? (allKitabs.find(k => k.id === editingKitabId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      createdBy: currentUserEmail || 'guest'
    };

    try {
      await saveCustomKitab(newKitab);
      setView('library');
    } catch (err) {
      console.error('Gagal menyimpan kitab:', err);
      addToast('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan kitab.', 'warning');
    }
  };

  return (
    <form id="kitab-writer-form" onSubmit={handleSaveKitab} className="space-y-6">
      {/* Back to Library Navigation */}
      <div className="flex items-center justify-between">
        <button
          id="btn-writer-back"
          type="button"
          onClick={() => setView('library')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#777266] hover:text-[#5A5A40] dark:text-[#A8A890] dark:hover:text-[#E5E1D8] transition-colors focus:outline-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Pustaka
        </button>
        <span className="text-[11px] font-bold text-[#5A5A40] bg-[#5A5A40]/10 dark:text-[#E5E1D8] dark:bg-[#3A3A30] px-3 py-1.5 rounded-lg">
          {editingKitabId ? 'Mode Edit Kitab Digital' : 'Mode Menulis Kitab Digital'}
        </span>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Kitab Metadata (Title, Author, Category, Description) */}
        <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-4 h-fit">
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm flex items-center gap-2 border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-3">
            <BookOpen className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> Detail Metadata Kitab
          </h3>

          <div className="space-y-3.5">
            {/* Title */}
            <div>
              <label htmlFor="writer-title" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Judul Kitab / Buku Kajian *
              </label>
              <input
                id="writer-title"
                type="text"
                required
                placeholder="Contoh: Kitab Ringkasan Doa Harian"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all"
              />
            </div>

            {/* Author */}
            <div>
              <label htmlFor="writer-author" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Nama Penulis / Penyusun *
              </label>
              <input
                id="writer-author"
                type="text"
                required
                placeholder="Contoh: Syekh Ahmad Al-Fatih"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="writer-category" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Kategori Keagamaan *
              </label>
              {isCustomCategory ? (
                <div className="flex gap-2">
                  <input
                    id="writer-category"
                    type="text"
                    required
                    placeholder="Contoh: Aqidah / Ushuluddin"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(false);
                      setCategory('Kajian');
                    }}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] hover:bg-[#F0ECE1] text-[#777266] dark:text-[#A8A890] transition-all cursor-pointer"
                  >
                    Preset
                  </button>
                </div>
              ) : (
                <select
                  id="writer-category"
                  value={category}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__CUSTOM__') {
                      setIsCustomCategory(true);
                      setCategory('Kustom');
                    } else {
                      setCategory(val);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__CUSTOM__">🎨 Kustom...</option>
                </select>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="writer-description" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Ringkasan / Deskripsi Singkat *
              </label>
              <AutoResizeTextarea
                id="writer-description"
                rows={3}
                required
                placeholder="Tulis ulasan ringkas mengenai kitab ini, isi pokok bahasan, dan tujuannya..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all"
              />
            </div>

            {/* Status Publikasi */}
            <div className="pt-2.5 border-t border-[#E5E1D8] dark:border-[#3A3A30]">
              <label htmlFor="writer-is-public" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Status Publikasi
              </label>
              <div className="flex items-start gap-2.5 bg-[#F4F1EA]/50 dark:bg-[#1E1E1A] p-2.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30]">
                <input
                  id="writer-is-public"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-[#5A5A40] bg-[#FDFBF7] border-[#E5E1D8] rounded focus:ring-[#5A5A40] cursor-pointer mt-0.5"
                />
                <div className="flex-1 select-none cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
                  <span className="block text-[11px] font-bold text-[#333333] dark:text-[#E5E1D8]">
                    {isPublic ? 'Publik (Seluruh pengguna bisa membaca)' : 'Privat (Hanya Anda yang bisa membaca)'}
                  </span>
                  <span className="block text-[9px] text-[#777266] dark:text-[#A8A890] mt-0.5 leading-normal">
                    {isPublic ? 'Kitab kustom ini akan dipublikasikan sehingga seluruh pengguna di aplikasi ini dapat membaca karya Anda.' : 'Kitab ini bersifat pribadi dan hanya dapat diakses serta dibaca oleh akun Anda.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE & RIGHT: Chapters, Pages, and Verses Builder */}
        <div className="lg:col-span-2 space-y-5">
          {/* Chapter Directory (Bab) */}
          <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4 shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 1. Struktur Hierarki Kitab (Tanpa Batas)
              </h4>
              <div className="flex items-center gap-3">
                <button
                  id="btn-writer-add-chapter"
                  type="button"
                  onClick={addChapter}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer border border-[#E5E1D8] dark:border-[#3A3A30] px-2.5 py-1 rounded-lg bg-[#FDFBF7] dark:bg-[#121210] hover:bg-[#F0ECE1] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Node Utama
                </button>
                <button
                  id="btn-writer-add-sub-chapter"
                  type="button"
                  onClick={addSubChapter}
                  disabled={chapters.length === 0}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] disabled:opacity-40 focus:outline-none cursor-pointer border border-[#E5E1D8] dark:border-[#3A3A30] px-2.5 py-1 rounded-lg bg-[#FDFBF7] dark:bg-[#121210] hover:bg-[#F0ECE1] transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Sub Node
                </button>
              </div>
            </div>

            {/* Tree Nodes List */}
            <div 
              id="writer-chapters-tree-container" 
              className="border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-3 bg-[#FDFBF7] dark:bg-[#121210] space-y-2 max-h-[350px] overflow-y-auto relative min-h-[150px]"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId) {
                  updateChapterParent(draggedId, undefined);
                }
              }}
            >
              {buildTree(chapters).map(function renderWriterNode(node: TreeNode) {
                const ch = node.chapter;
                const idxInChapters = chapters.findIndex(c => c.id === ch.id);
                const isActive = idxInChapters === activeChapterIndex;
                const hasChildren = node.children.length > 0;
                const isCollapsed = collapsedChapters[ch.id];

                // Allowed node label presets
                const presets = ['Bab', 'Fasal', 'Muqaddimah', 'Tanbih', 'Faidah', 'Masalah', 'Sub Bab', 'Artikel'];

                return (
                  <div 
                    key={ch.id} 
                    className={`space-y-1 rounded-lg transition-all border border-transparent ${isActive ? 'bg-amber-500/5 dark:bg-[#5A5A40]/10 border-[#5A5A40]/20 p-1.5' : 'p-1 hover:border-dashed hover:border-[#5A5A40]/30'}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId && draggedId !== ch.id) {
                        updateChapterParent(draggedId, ch.id);
                      }
                    }}
                  >
                    <div 
                      className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full group"
                      style={{ paddingLeft: `${node.depth * 16}px` }}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {/* Drag Handle Indicator */}
                        <div 
                          className="text-[#999488] dark:text-[#666155] cursor-grab active:cursor-grabbing px-1.5 py-0.5 bg-[#F4F1EA] dark:bg-stone-800 hover:bg-[#E5E1D8] hover:text-[#5A5A40] rounded font-mono text-xs select-none flex items-center justify-center min-w-[20px] h-[20px]" 
                          title="Seret & taruh ke Bab lain untuk menjadikannya Sub-Bab, atau taruh di ruang kosong untuk menjadikannya Bab Utama (Root)"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', ch.id);
                          }}
                        >
                          ⋮⋮
                        </div>

                        {/* Collapse Button */}
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedChapters(prev => ({ ...prev, [ch.id]: !prev[ch.id] }));
                            }}
                            className="p-1 hover:bg-[#E5E1D8] dark:hover:bg-stone-800 rounded text-[#777266] dark:text-[#A8A890] transition-colors"
                          >
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <div className="w-5.5 flex-shrink-0" />
                        )}

                        {/* Label Type Selector Dropdown or Custom Text Input */}
                        {customNodes[ch.id] || (ch.nodeType && !presets.includes(ch.nodeType)) ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Kustom..."
                              value={ch.nodeType || ''}
                              onChange={(e) => updateNodeType(ch.id, e.target.value)}
                              className="bg-[#FDFBF7] dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-[10px] font-mono rounded px-1.5 py-0.5 text-[#5A5A40] dark:text-[#E5E1D8] focus:outline-none w-16"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateNodeType(ch.id, 'Bab');
                                setCustomNodes(prev => ({ ...prev, [ch.id]: false }));
                              }}
                              className="text-[9px] px-1 py-0.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-[#777266] dark:text-[#A8A890] font-mono cursor-pointer"
                              title="Kembali ke Pilihan Preset"
                            >
                              Preset
                            </button>
                          </div>
                        ) : (
                          <select
                            value={ch.nodeType || (ch.isSubChapter ? 'Fasal' : 'Bab')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__CUSTOM__') {
                                setCustomNodes(prev => ({ ...prev, [ch.id]: true }));
                                updateNodeType(ch.id, 'Kustom');
                              } else {
                                updateNodeType(ch.id, val);
                              }
                            }}
                            className="bg-[#FDFBF7] dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-[10px] font-mono rounded px-1.5 py-0.5 text-[#5A5A40] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                          >
                            {presets.map(p => <option key={p} value={p}>{p}</option>)}
                            <option value="__CUSTOM__">🎨 Kustom...</option>
                          </select>
                        )}

                        <span className="text-[10px] text-stone-400 font-mono">#{ch.number}</span>

                        {/* Title button */}
                        <button
                          type="button"
                          onClick={() => setActiveChapterIndex(idxInChapters)}
                          className={`truncate text-left px-2 py-1 rounded text-xs font-bold transition-all flex-1 ${
                            isActive
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-none'
                              : 'text-[#333333] dark:text-[#E5E1D8] hover:bg-[#E5E1D8] dark:hover:bg-[#121210]'
                          }`}
                        >
                          {ch.title || '(Teks Judul Kosong)'}
                        </button>
                      </div>

                      {/* Node actions (Indenting, Reordering, Moving, deleting) */}
                      <div className="flex items-center gap-1.5 self-end md:self-auto bg-[#F9F6F0]/80 dark:bg-stone-900 border border-[#E5E1D8]/40 dark:border-[#3A3A30]/40 p-1 rounded-lg">
                        {/* Indent / Outdent */}
                        <button
                          type="button"
                          onClick={() => outdentChapter(ch.id)}
                          disabled={!ch.parentId}
                          title="Geser Keluar (Outdent)"
                          className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => indentChapter(ch.id)}
                          title="Geser ke Dalam (Indent)"
                          className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30"
                        >
                          →
                        </button>

                        {/* Sibling Reordering */}
                        <button
                          type="button"
                          onClick={() => moveChapterUp(ch.id)}
                          title="Pindahkan Ke Atas"
                          className="p-1 rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveChapterDown(ch.id)}
                          title="Pindahkan Ke Bawah"
                          className="p-1 rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>

                        {/* Change parent picker dropdown to move anywhere quickly */}
                        <select
                          value={ch.parentId || ''}
                          onChange={(e) => updateChapterParent(ch.id, e.target.value || undefined)}
                          title="Pindahkan ke Parent lain"
                          className="max-w-[75px] bg-stone-100 dark:bg-stone-800 border-none text-[9px] rounded px-1.5 py-0.5 focus:outline-none text-[#777266] dark:text-stone-300"
                        >
                          <option value="">(Root)</option>
                          {chapters
                            .filter(c => c.id !== ch.id)
                            .map(c => <option key={c.id} value={c.id}>{c.nodeType || 'Node'} {c.number}: {c.title}</option>)}
                        </select>

                        {/* Recursive Delete button */}
                        {chapters.length > 1 && (
                          confirmDeleteId === ch.id ? (
                            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                              <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Yakin?</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeChapter(idxInChapters);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(ch.id);
                              }}
                              className="p-1.5 hover:bg-red-500 hover:text-white rounded text-stone-500 transition-colors cursor-pointer"
                              title="Hapus Node & Seluruh Subtree"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {hasChildren && !isCollapsed && (
                      <div className="space-y-1">
                        {node.children.map(renderWriterNode)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Page Directory (Halaman) inside the Chapter */}
          <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4 shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 2. Daftar Halaman di Bab Ini
              </h4>
              <button
                id="btn-writer-add-page"
                type="button"
                onClick={addPageToActiveChapter}
                className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
              >
                + Tambah Halaman Baru
              </button>
            </div>

            <div id="writer-pages-list" className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {uniquePages.map((pageNum) => (
                <div
                  key={pageNum}
                  id={`writer-page-tab-${pageNum}`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                    pageNum === activePageNumber
                      ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-bold shadow-none'
                      : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] dark:text-[#A8A890] hover:bg-[#F0ECE1]'
                  }`}
                  onClick={() => setActivePageNumber(pageNum)}
                >
                  <span>Halaman {pageNum}</span>
                  {uniquePages.length > 1 && (
                    <button
                      id={`btn-delete-page-tab-${pageNum}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePageFromActiveChapter(pageNum);
                      }}
                      className="text-slate-400 hover:text-red-500 focus:outline-none ml-1 p-0.5 rounded-md cursor-pointer"
                      title="Hapus Halaman"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Chapter & Page Editor Area */}
          <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-5">
            {/* Chapter Header Details */}
            <div className="border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="sm:col-span-1">
                <label htmlFor="chapter-number-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                  Nomor Bab *
                </label>
                <input
                  id="chapter-number-input"
                  type="text"
                  required
                  value={chapters[activeChapterIndex]?.number || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChapters(prev => prev.map((ch, idx) => {
                      if (idx === activeChapterIndex) {
                        return { ...ch, number: val };
                      }
                      return ch;
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>
              <div className="sm:col-span-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="chapter-title-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                    Judul {chapters[activeChapterIndex]?.isSubChapter ? 'Sub Bab (Fasal)' : 'Bab'} Aktif *
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!chapters[activeChapterIndex]?.isSubChapter}
                      onChange={(e) => {
                        setChapters(prev => prev.map((ch, idx) => {
                          if (idx === activeChapterIndex) {
                            return { ...ch, isSubChapter: e.target.checked };
                          }
                          return ch;
                        }));
                      }}
                      className="rounded border-[#E5E1D8] text-[#5A5A40] focus:ring-[#5A5A40] focus:ring-offset-0 bg-[#FDFBF7]"
                    />
                    Jadikan Sub Bab
                  </label>
                </div>
                <input
                  id="chapter-title-input"
                  type="text"
                  required
                  placeholder="Contoh: Bab 1: Keutamaan Niat di dalam Hati"
                  value={chapters[activeChapterIndex]?.title || ''}
                  onChange={(e) => updateChapterTitle(activeChapterIndex, e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>
            </div>

            {/* Page Customization Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-end bg-[#F4F1EA]/50 dark:bg-[#1C1C18]/35 p-3.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30]">
              <div className="w-full sm:w-36">
                <label htmlFor="page-number-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                  No. Halaman Aktif
                </label>
                <input
                  id="page-number-input"
                  type="number"
                  min="1"
                  required
                  value={activePageNumber}
                  onChange={(e) => {
                    const newPageVal = parseInt(e.target.value) || 1;
                    
                    // Update all paragraphs in the active chapter that currently belong to activePageNumber to the new page value
                    setChapters(prev => prev.map((ch, idx) => {
                      if (idx === activeChapterIndex) {
                        return {
                          ...ch,
                          paragraphs: ch.paragraphs.map(p => {
                            if ((p.page || 1) === activePageNumber) {
                              return { ...p, page: newPageVal };
                            }
                            return p;
                          })
                        };
                      }
                      return ch;
                    }));
                    
                    setActivePageNumber(newPageVal);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>
              <p className="text-[11px] text-[#777266] dark:text-[#A8A890] leading-normal">
                Ubah nomor halaman aktif ini untuk memindahkannya ke nomor halaman mana pun secara instan. Paragraf di halaman ini akan otomatis dipindahkan!
              </p>
            </div>

            {/* Paragraph Nodes Iterator for Active Page */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 3. Paragraf Teks Arab di Halaman {activePageNumber}
                </span>
                <span className="text-[10px] text-[#999488] font-medium">
                  {paragraphsOnActivePage.length} Paragraf di Halaman Ini
                </span>
              </div>

              {paragraphsOnActivePage.map((p, pIdx) => {
                const showTrans = toggledFields[p.id]?.trans ?? (p.translation !== undefined && p.translation !== '');
                const showExpl = toggledFields[p.id]?.expl ?? (p.explanation !== undefined && p.explanation !== '');
                const isArabicSyarah = arabicExplanations[p.id] || false;

                return (
                  <div
                    key={p.id}
                    id={`paragraph-writer-node-${p.id}`}
                    className="p-4.5 bg-[#FDFBF7] dark:bg-[#121210] rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] space-y-4 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-2">
                      <span className="text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wide">
                        Paragraf #{pIdx + 1}
                      </span>
                      {paragraphsOnActivePage.length > 1 && (
                        <button
                          id={`btn-delete-paragraph-${p.id}`}
                          type="button"
                          onClick={() => removeParagraphFromActivePage(p.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 focus:outline-none cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus Paragraf
                        </button>
                      )}
                    </div>

                    {/* Checkboxes to Toggle Translation & Explanation dynamically */}
                    <div className="flex flex-wrap gap-4 items-center bg-[#F5F2ED] dark:bg-[#1C1C18] px-3.5 py-2.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30]">
                      <span className="text-[10px] font-bold text-[#777266] uppercase tracking-wider">
                        Opsi Tampilan:
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-[#5A5A40] dark:text-[#E5E1D8] font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showTrans}
                          onChange={() => handleToggleField(p.id, 'trans')}
                          className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                        />
                        Sertakan Terjemahan
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#5A5A40] dark:text-[#E5E1D8] font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showExpl}
                          onChange={() => handleToggleField(p.id, 'expl')}
                          className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                        />
                        Sertakan Penjelasan / Syarah
                      </label>
                    </div>

                    <div className="space-y-4">
                      {/* Arabic Scripture Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor={`arabic-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                            Teks Arab / Paragraf Utama *
                          </label>
                          <button
                            type="button"
                            onClick={() => setMainLtrFields(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                              !mainLtrFields[p.id]
                                ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                : 'bg-white dark:bg-stone-900 text-[#777266] dark:text-stone-400 border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#5A5A40]/10'
                            }`}
                          >
                            {!mainLtrFields[p.id] ? 'Font Arab (RTL)' : 'Teks Biasa (LTR)'}
                          </button>
                        </div>
                        <RichTextEditor
                          id={`arabic-text-input-${p.id}`}
                          dir={!mainLtrFields[p.id] ? "rtl" : "ltr"}
                          placeholder={!mainLtrFields[p.id] ? "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ..." : "Ketik naskah utama di sini..."}
                          value={p.arabic}
                          onChange={(val) => updateParagraphFieldById(p.id, 'arabic', val)}
                          className={!mainLtrFields[p.id] ? 'font-amiri font-bold text-lg' : 'font-sans text-xs'}
                        />
                      </div>

                      {/* Indonesian Translation Input (Render only if enabled) */}
                      {showTrans && (
                        <div className="animation-fade-in">
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor={`translation-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                              Terjemahan Bahasa Indonesia
                            </label>
                            <button
                              type="button"
                              onClick={() => setTransRtlFields(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                                transRtlFields[p.id]
                                  ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                  : 'bg-white dark:bg-stone-900 text-[#777266] dark:text-stone-400 border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#5A5A40]/10'
                              }`}
                            >
                              {transRtlFields[p.id] ? 'Font Arab (RTL)' : 'Teks Biasa (LTR)'}
                            </button>
                          </div>
                          <RichTextEditor
                            id={`translation-text-input-${p.id}`}
                            dir={transRtlFields[p.id] ? "rtl" : "ltr"}
                            placeholder={transRtlFields[p.id] ? "اكتب الترجمة باللغة العربية هنا..." : "Sesungguhnya amal perbuatan itu didasarkan pada niat..."}
                            value={p.translation}
                            onChange={(val) => updateParagraphFieldById(p.id, 'translation', val)}
                            className={transRtlFields[p.id] ? 'font-amiri font-bold text-lg' : 'font-sans text-xs'}
                          />
                        </div>
                      )}

                      {/* Tafsir / Penjelasan Input (Render only if enabled) */}
                      {showExpl && (
                          <div className="animation-fade-in">
                            <div className="flex items-center justify-between mb-1.5">
                              <label htmlFor={`explanation-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                                Penjelasan Syarah / Tafsir Detail
                              </label>
                              <button
                                type="button"
                                onClick={() => setArabicExplanations(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                  isArabicSyarah
                                    ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                    : 'bg-white dark:bg-slate-900 text-[#777266] dark:text-slate-400 border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#5A5A40]/10'
                                }`}
                              >
                                {isArabicSyarah ? 'Font Arab Aktif (RTL)' : 'Aktifkan Font Arab'}
                              </button>
                            </div>
                            <RichTextEditor
                              id={`explanation-text-input-${p.id}`}
                              dir={isArabicSyarah ? 'rtl' : 'ltr'}
                              placeholder={isArabicSyarah ? "اكتب الشرح أو التفسير هنا..." : "Hadis ini dikisahkan oleh Umar bin Khattab dan dijadikan rujukan utama dalam Fiqih..."}
                              value={p.explanation || ''}
                              onChange={(val) => updateParagraphFieldById(p.id, 'explanation', val)}
                              className={isArabicSyarah ? 'font-amiri text-lg' : 'text-xs'}
                            />
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add buttons & Form Submit */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#E5E1D8] dark:border-[#3A3A30] justify-between">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  id="btn-writer-add-paragraph"
                  type="button"
                  onClick={addParagraphToActivePage}
                  className="px-4 py-2.5 bg-[#E5E1D8] hover:bg-[#D5D0C4] text-[#5A5A40] text-xs font-bold rounded-lg focus:outline-none transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Paragraf Berikutnya
                </button>
                <button
                  id="btn-writer-add-page-bottom"
                  type="button"
                  onClick={addPageToActiveChapter}
                  className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-[#5A5A40] text-xs font-bold rounded-lg focus:outline-none transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Halaman Baru
                </button>
                <button
                  id="btn-writer-add-sub-chapter-bottom"
                  type="button"
                  onClick={addSubChapter}
                  className="px-4 py-2.5 bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8] text-xs font-bold rounded-lg focus:outline-none transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Sub Bab
                </button>
                <button
                  id="btn-writer-add-chapter-bottom"
                  type="button"
                  onClick={addChapter}
                  className="px-4 py-2.5 bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 text-[#5A5A40] dark:text-[#E5E1D8] text-xs font-bold rounded-lg focus:outline-none transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Bab Baru
                </button>
              </div>
              <button
                id="btn-writer-submit-kitab"
                type="submit"
                className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#5A5A40] hover:bg-[#454530] text-white font-bold text-xs rounded-lg shadow-none focus:outline-none transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" /> {editingKitabId ? 'Simpan Perubahan Kitab' : 'Simpan dan Publikasi Kitab'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
