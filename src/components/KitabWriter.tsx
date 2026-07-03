/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Kitab, Chapter, Paragraph, TreeNode, buildTree, sortChaptersByTree, migrateChaptersToTree, recalculateHierarchicalNumbers } from '../types';
import RichTextEditor from './RichTextEditor';
import { Plus, Trash2, Save, BookOpen, FileText, Sparkles, X, ArrowLeft, Layers, File, ChevronRight, ChevronDown, ArrowUp, ArrowDown, FolderPlus, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [type, setType] = useState<'artikel' | 'buku' | 'kitab'>('kitab');
  const [content, setContent] = useState('');

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
        setType(kitabToEdit.type || 'kitab');
        setContent(kitabToEdit.content || '');
        
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
      setType('kitab');
      setContent('');
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
      nodeType: "",
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
      nodeType: "",
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
      addToast('Data Belum Lengkap', 'Judul, penulis, dan ringkasan karya wajib diisi.', 'warning');
      return;
    }

    // Validate chapters and paragraphs
    if (type !== 'artikel') {
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
    } else {
      if (!content.trim()) {
        addToast(
          'Gagal Menyimpan',
          'Harap isi konten artikel sebelum menyimpan.',
          'warning'
        );
        return;
      }
    }

    const sortedChaptersToSave = type !== 'artikel'
      ? sortChaptersByTree([...chapters])
          .map(ch => ({
            ...ch,
            paragraphs: [...ch.paragraphs].sort((a, b) => (a.page || 1) - (b.page || 1))
          }))
      : [];

    const newKitab: Kitab = {
      id: editingKitabId || `kitab_custom_${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      category,
      description: description.trim(),
      isPublic,
      type,
      content: type === 'artikel' ? content.trim() : '',
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
      addToast('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan karya.', 'warning');
    }
  };

  // Helper bindings for hierarchical tree rendering
  const handleMoveNodeUp = (id: string) => moveChapterUp(id);
  const handleMoveNodeDown = (id: string) => moveChapterDown(id);
  const handleAddSubNode = (id: string) => {
    const parentCh = chapters.find(c => c.id === id);
    if (!parentCh) return;
    const siblings = chapters.filter(c => c.parentId === id);
    const subNum = siblings.length + 1;
    const chNum = `${parentCh.number}.${subNum}`;
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
      parentId: id,
      nodeType: "",
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
    const updated = recalculateHierarchicalNumbers([...chapters, newCh]);
    setChapters(updated);
    const newActiveIdx = updated.findIndex(c => c.id === newCh.id);
    if (newActiveIdx >= 0) setActiveChapterIndex(newActiveIdx);
  };
  const handleDeleteNode = (id: string) => {
    const idx = chapters.findIndex(c => c.id === id);
    if (idx >= 0) {
      removeChapter(idx);
    }
  };
  const handleDeletePage = (pageNum: number) => {
    removePageFromActiveChapter(pageNum);
  };
  const handleDeleteParagraph = (pId: string) => {
    removeParagraphFromActivePage(pId);
  };
  const handleParagraphChange = (pId: string, field: keyof Paragraph, val: any) => {
    updateParagraphFieldById(pId, field, val);
  };

  return (
    <>
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
          {editingKitabId ? 'Mode Edit Khazanah Digital' : 'Mode Menulis Khazanah Digital'}
        </span>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Kitab Metadata (Title, Author, Category, Description) */}
        <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-4 h-fit">
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm flex items-center gap-2 border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-3">
            <BookOpen className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> Detail Metadata Karya
          </h3>

          <div className="space-y-3.5">
            {/* Tipe Karya */}
            <div>
              <label className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                Tipe Karya *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'artikel', label: '✍️ Artikel', desc: 'Satu halaman' },
                  { value: 'buku', label: '📖 Buku', desc: 'Bab & Subbab LTR' },
                  { value: 'kitab', label: '📜 Kitab', desc: 'Bab & Subbab RTL' }
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    disabled={!!editingKitabId}
                    onClick={() => {
                      setType(t.value as any);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      type === t.value
                        ? 'border-[#5A5A40] bg-[#5A5A40]/10 dark:border-[#E5E1D8] text-[#5A5A40] dark:text-[#E5E1D8]'
                        : 'border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] hover:border-[#5A5A40]/50 text-stone-600 dark:text-stone-400'
                    } ${editingKitabId ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[8px] text-[#999488] dark:text-[#888373] mt-0.5 leading-tight">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="writer-title" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                {type === 'artikel' ? 'Judul Artikel / Blog / Opini *' : type === 'buku' ? 'Judul Buku Digital / Modul *' : 'Judul Naskah Klasik *'}
              </label>
              <input
                id="writer-title"
                type="text"
                required
                placeholder="Contoh: Ringkasan Doa Harian"
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
                placeholder="Tulis ulasan ringkas mengenai karya ini, isi pokok bahasan, dan tujuannya..."
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
                    {isPublic ? 'Karya kustom ini akan dipublikasikan sehingga seluruh pengguna di aplikasi ini dapat membaca karya Anda.' : 'Karya ini bersifat pribadi dan hanya dapat diakses serta dibaca oleh akun Anda.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE & RIGHT: Chapters, Pages, and Verses Builder OR Article Editor */}
        <div className="lg:col-span-2 space-y-5">
          {type === 'artikel' ? (
            /* Article Writing Mode */
            <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-5 animate-fade-in">
              <div className="border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#5A5A40] dark:text-[#E5E1D8]" />
                  <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm">
                    Halaman Editor Artikel
                  </h4>
                </div>
                <h2 className="font-serif font-bold text-lg text-[#333333] dark:text-[#E5E1D8] pt-1">
                  {title || '(Belum Ada Judul Artikel)'}
                </h2>
              </div>

              <div className="space-y-2">
                <label htmlFor="article-editor-body" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                  Konten Lengkap Artikel / Blog *
                </label>
                <RichTextEditor
                  id="article-editor-body"
                  placeholder="Tulis draf lengkap artikel, pemikiran, blog, atau opini keagamaan Anda di sini..."
                  value={content}
                  onChange={(val) => setContent(val)}
                  className="min-h-[450px] text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E5E1D8] dark:border-[#3A3A30]">
                <p className="text-[10px] text-[#999488] italic">
                  * Isi artikel akan disimpan secara penuh ke pustaka digital.
                </p>
                <button
                  id="btn-writer-submit-article"
                  type="submit"
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#5A5A40] hover:bg-[#454530] text-white font-bold text-xs rounded-lg shadow-none focus:outline-none transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Simpan
                </button>
              </div>
            </div>
          ) : (
            /* Classical Chapters & Pages Builder Mode */
            <>
              {/* Chapter Directory (Bab) */}
              <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4 shadow-none">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 1. Struktur Hierarki Karya (Tanpa Batas)
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      id="btn-writer-add-chapter"
                      type="button"
                      onClick={addChapter}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                    >
                      + Node
                    </button>
                    <button
                      id="btn-writer-recalc-hierarchy"
                      type="button"
                      onClick={() => setChapters(recalculateHierarchicalNumbers(chapters))}
                      className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 focus:outline-none cursor-pointer"
                      title="Urutkan & hitung ulang nomor segmen hierarki otomatis"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Rapikan Nomor
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto p-1 bg-[#F4F1EA] dark:bg-stone-900/40 rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30]">
                  {buildTree(chapters).map(function renderNode(node) {
                    const ch = node.chapter;
                    const isActive = ch.id === chapters[activeChapterIndex]?.id;
                    const isCollapsed = collapsedChapters[ch.id];
                    const siblings = chapters.filter(c => c.parentId === ch.parentId);
                    const isFirstSibling = siblings[0]?.id === ch.id;
                    const isLastSibling = siblings[siblings.length - 1]?.id === ch.id;
                    const childNodes = chapters.filter(c => c.parentId === ch.id);
                    const hasChildren = childNodes.length > 0;

                    return (
                      <div 
                        key={ch.id} 
                        className={`p-2.5 rounded-lg border transition-all relative ${
                          isActive 
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white' 
                            : 'bg-white dark:bg-stone-950/60 border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] dark:text-[#A8A890]'
                        }`}
                        style={{ marginLeft: `${node.depth * 14}px` }}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() => setCollapsedChapters(prev => ({ ...prev, [ch.id]: !prev[ch.id] }))}
                                className={`p-0.5 rounded transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-[#E5E1D8]'}`}
                              >
                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              id={`chapter-select-btn-${ch.id}`}
                              type="button"
                              onClick={() => {
                                const idx = chapters.findIndex(c => c.id === ch.id);
                                if (idx >= 0) {
                                  setActiveChapterIndex(idx);
                                  const chParagraphs = chapters[idx]?.paragraphs || [];
                                  if (chParagraphs.length > 0) {
                                    setActivePageNumber(chParagraphs[0].page || 1);
                                  } else {
                                    setActivePageNumber(1);
                                  }
                                }
                              }}
                              className="text-left font-serif font-bold text-xs truncate cursor-pointer"
                            >
                              <span className="font-mono text-[10px] opacity-75 mr-1 bg-stone-500/10 dark:bg-stone-500/20 px-1 py-0.5 rounded">
                                {ch.number}
                              </span>
                              {ch.title || '(Tanpa Judul)'}
                            </button>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveNodeUp(ch.id)}
                              disabled={isFirstSibling}
                              className={`p-1 rounded transition-colors disabled:opacity-20 ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-[#E5E1D8] text-neutral-500'}`}
                              title="Pindahkan ke atas"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveNodeDown(ch.id)}
                              disabled={isLastSibling}
                              className={`p-1 rounded transition-colors disabled:opacity-20 ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-[#E5E1D8] text-neutral-500'}`}
                              title="Pindahkan ke bawah"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddSubNode(ch.id)}
                              className={`p-1 rounded transition-colors ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-[#E5E1D8] text-neutral-500'}`}
                              title="Tambah Sub-Node (Fasal)"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                            {chapters.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(ch.id);
                                }}
                                className={`p-1 rounded transition-colors ${
                                  isActive ? 'hover:bg-red-700/30 text-red-200' : 'hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600'
                                }`}
                                title="Hapus Node Ini beserta sub-nya"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Confirmation dialog embedded inside node list to look clean */}
                        {confirmDeleteId === ch.id && (
                          <div className="absolute inset-0 bg-stone-100 dark:bg-stone-900 p-2 rounded-lg flex items-center justify-between z-10 animate-fade-in border border-red-200 dark:border-red-900/30">
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">Yakin hapus node?</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(ch.id)}
                                className="px-2 py-1 bg-red-600 text-white font-bold rounded text-[9px] hover:bg-red-700"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded text-[9px]"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}

                        {!isCollapsed && node.children.length > 0 && (
                          <div className="mt-2 space-y-1.5 border-t border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pt-2">
                            {node.children.map(renderNode)}
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
                    <FileText className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 2. Daftar Halaman di Node Ini
                  </h4>
                  <button
                    id="btn-writer-add-page"
                    type="button"
                    onClick={addPageToActiveChapter}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                  >
                    + Halaman
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1 bg-[#F4F1EA] dark:bg-stone-900/40 rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30]">
                  {uniquePages.map((pageNum) => {
                    const isActive = pageNum === activePageNumber;
                    const pageParagraphs = activeChapterParagraphs.filter(p => (p.page || 1) === pageNum);
                    const isEmpty = pageParagraphs.every(p => !p.arabic.trim());

                    return (
                      <div key={pageNum} className="relative group">
                        <button
                          id={`page-select-btn-${pageNum}`}
                          type="button"
                          onClick={() => setActivePageNumber(pageNum)}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                            isActive
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-none'
                              : isEmpty
                              ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-950/20 text-amber-700/60 hover:bg-[#E5E1D8]'
                              : 'bg-white dark:bg-stone-950 border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] hover:bg-[#E5E1D8] dark:hover:bg-[#121210]'
                          }`}
                        >
                          Hlm. {pageParagraphs[0]?.pageLabel || pageNum}
                          {isEmpty && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" title="Halaman kosong" />}
                        </button>
                        {uniquePages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeletePage(pageNum)}
                            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                            title="Hapus Halaman ini"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Chapter & Page Editor Area */}
              <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-5">
                {/* Chapter Header Details */}
                <div className="border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="sm:col-span-1">
                    <label htmlFor="chapter-number-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                      Nomor Node saat ini *
                    </label>
                    <input
                      id="chapter-number-input"
                      type="text"
                      required
                      value={chapters[activeChapterIndex]?.number || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = [...chapters];
                        if (updated[activeChapterIndex]) {
                          updated[activeChapterIndex].number = val;
                          setChapters(updated);
                        }
                      }}
                      className="w-full bg-white dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-xs rounded-lg px-3 py-2 text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="chapter-title-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                      Judul Bab / Fasal / Bagian ini *
                    </label>
                    <input
                      id="chapter-title-input"
                      type="text"
                      required
                      value={chapters[activeChapterIndex]?.title || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = [...chapters];
                        if (updated[activeChapterIndex]) {
                          updated[activeChapterIndex].title = val;
                          setChapters(updated);
                        }
                      }}
                      className="w-full bg-white dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-xs rounded-lg px-3 py-2 text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] font-serif font-bold"
                    />
                  </div>
                </div>

                {/* Page Label Edit */}
                <div className="border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-4">
                  <label htmlFor="page-label-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                    Nomor Halaman saat ini *
                  </label>
                  <input
                    id="page-label-input"
                    type="number"
                    min="1"
                    placeholder={`${activePageNumber}`}
                    value={paragraphsOnActivePage[0]?.pageLabel || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = [...chapters];
                      const ch = updated[activeChapterIndex];
                      if (ch) {
                        ch.paragraphs.forEach(pObj => {
                          if ((pObj.page || 1) === activePageNumber) {
                            pObj.pageLabel = val;
                          }
                        });
                        setChapters(updated);
                      }
                    }}
                    className="w-full sm:w-1/2 bg-white dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-xs rounded-lg px-3 py-2 text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] font-sans"
                  />
                </div>

                {/* Paragraph List Editor */}
                <div className="space-y-4">
                  {paragraphsOnActivePage.map((p, pIdx) => {
                    const hasTrans = !!p.translation;
                    const hasExpl = !!p.explanation;
                    const toggleState = toggledFields[p.id] || { trans: hasTrans, expl: hasExpl };
                    const isArabicExplanations = arabicExplanations[p.id] || false;
                    const isMainLtr = mainLtrFields[p.id] !== undefined ? mainLtrFields[p.id] : (type === 'buku' || type === 'artikel');
                    const isTransRtl = transRtlFields[p.id] || false;

                    return (
                      <div
                        key={p.id}
                        id={`paragraph-editor-item-${p.id}`}
                        className="p-4 bg-white dark:bg-[#121210] rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30] space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-2.5">
                          <span className="text-[10px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wider">
                            Blok Teks #{pIdx + 1} di Hlm. {p.pageLabel || activePageNumber}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Direction Controls */}
                            <button
                              type="button"
                              onClick={() => setMainLtrFields(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${
                                isMainLtr
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-stone-50 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
                              }`}
                              title="Ganti arah input teks utama ke kiri-ke-kanan (LTR) untuk buku latin"
                            >
                              {isMainLtr ? 'Arah LTR (Latin)' : 'Arah RTL (Arab)'}
                            </button>
                            
                            {type === 'kitab' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setTransRtlFields(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                  className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${
                                    isTransRtl
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-stone-50 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
                                  }`}
                                  title="Ganti arah input terjemahan ke kanan-ke-kiri (RTL) jika diisi bahasa arab"
                                >
                                  {isTransRtl ? 'Terjemah RTL (Arab)' : 'Terjemah LTR (Latin)'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArabicExplanations(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                  className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${
                                    isArabicExplanations
                                      ? 'bg-amber-600 text-white border-amber-600'
                                      : 'bg-stone-50 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
                                  }`}
                                  title="Ganti arah penjelasan ke kanan-ke-kiri (RTL)"
                                >
                                  {isArabicExplanations ? 'Syarah RTL' : 'Syarah LTR'}
                                </button>

                                {/* Feature toggles */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleField(p.id, 'trans')}
                                  className={`px-2.5 py-1 rounded text-[9px] font-bold transition-all border ${
                                    toggleState.trans
                                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                      : 'bg-stone-50 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
                                  }`}
                                >
                                  {toggleState.trans ? '✓ Ada Terjemah' : '+ Terjemah'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleField(p.id, 'expl')}
                                  className={`px-2.5 py-1 rounded text-[9px] font-bold transition-all border ${
                                    toggleState.expl
                                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                      : 'bg-stone-50 dark:bg-stone-900 text-stone-500 border-stone-200 dark:border-stone-800'
                                  }`}
                                >
                                  {toggleState.expl ? '✓ Ada Syarah' : '+ Syarah'}
                                </button>
                              </>
                            )}
                            {paragraphsOnActivePage.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteParagraph(p.id)}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                title="Hapus Blok Teks"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Input Fields */}
                        <div className="space-y-3.5">
                          <div>
                            <label htmlFor={`arabic-editor-${p.id}`} className="block text-[10px] font-bold text-stone-400 dark:text-[#999488] uppercase mb-1.5">
                              {type === 'kitab' ? 'Naskah Asli Arab *' : 'Teks Utama *'}
                            </label>
                            <RichTextEditor
                              id={`arabic-editor-${p.id}`}
                              placeholder={isMainLtr ? "Tulis teks utama paragraf Latin di sini..." : "اكتب النص العربي هنا..."}
                              value={p.arabic}
                              onChange={(val) => handleParagraphChange(p.id, 'arabic', val)}
                              dir={isMainLtr ? 'ltr' : 'rtl'}
                              className="min-h-[140px]"
                            />
                          </div>

                          {toggleState.trans && (
                            <div>
                              <label htmlFor={`translation-editor-${p.id}`} className="block text-[10px] font-bold text-stone-400 dark:text-[#999488] uppercase mb-1.5">
                                {type === 'kitab' ? 'Terjemahan Indonesia' : 'Teks Penjelas Kedua'}
                              </label>
                              <RichTextEditor
                                id={`translation-editor-${p.id}`}
                                placeholder={isTransRtl ? "اكتب ترجمة النص باللغة العربية هنا..." : "Tulis terjemahan Indonesia atau teks penjelas Latin di sini..."}
                                value={p.translation || ''}
                                onChange={(val) => handleParagraphChange(p.id, 'translation', val)}
                                dir={isTransRtl ? 'rtl' : 'ltr'}
                                className="min-h-[100px]"
                              />
                            </div>
                          )}

                          {toggleState.expl && (
                            <div>
                              <label htmlFor={`explanation-editor-${p.id}`} className="block text-[10px] font-bold text-stone-400 dark:text-[#999488] uppercase mb-1.5">
                                Tafsir / Syarah / Analisis Teologis
                              </label>
                              <RichTextEditor
                                id={`explanation-editor-${p.id}`}
                                placeholder={isArabicExplanations ? "اكتب تفسيرا أو تحليلا عقائديا هنا..." : "Tulis tafsir, syarah, analisis tata bahasa, atau catatan kontekstual di sini..."}
                                value={p.explanation || ''}
                                onChange={(val) => handleParagraphChange(p.id, 'explanation', val)}
                                dir={isArabicExplanations ? 'rtl' : 'ltr'}
                                className="min-h-[120px]"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls for Chapter Editing */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#E5E1D8] dark:border-[#3A3A30] pt-4">
                  <button
                    type="button"
                    onClick={addParagraphToActivePage}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-[#1A1A14] dark:hover:bg-[#2A2A24] text-[#5A5A40] dark:text-[#E5E1D8] font-bold text-xs rounded-lg border border-stone-200 dark:border-[#3A3A30] focus:outline-none transition-all cursor-pointer w-full sm:w-auto order-2 sm:order-1"
                  >
                    <Plus className="w-4 h-4" /> Tambah Blok Teks
                  </button>
                  <button
                    id="btn-writer-submit-kitab"
                    type="submit"
                    className="flex items-center justify-center gap-1.5 px-6 py-3 sm:py-2.5 bg-[#5A5A40] hover:bg-[#454530] text-white font-bold text-xs rounded-lg shadow-none focus:outline-none transition-all cursor-pointer w-full sm:w-auto order-1 sm:order-2"
                  >
                    <Save className="w-4 h-4" /> Simpan
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  </>
);
}
