/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import {
  ArrowLeft,
  Settings,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Highlighter,
  Trash2,
  Save,
  Check,
  Clock,
  BookOpen,
  Eye,
  Type,
  Edit,
  Sparkles,
  Search,
  X,
  Share2
} from 'lucide-react';
import DiscussionPanel from './DiscussionPanel';
import { motion, AnimatePresence } from 'motion/react';
import { Chapter, Paragraph, TreeNode, buildTree } from '../types';



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

export default function KitabReader() {
  const {
    activeKitab,
    activeChapter,
    bookmarks,
    addBookmark,
    removeBookmark,
    annotations,
    saveAnnotation,
    deleteAnnotation,
    preferences,
    updatePreferences,
    setActiveKitabId,
    setActiveChapterId,
    logReadingActivity,
    setView,
    setEditingKitabId,
    setProfileUserEmail,
    currentUserEmail,
    addToast
  } = useApp();

  const [showSettings, setShowSettings] = useState(false);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [activeParagraphChapterId, setActiveParagraphChapterId] = useState<string | null>(null);

  // Edit State for annotations/highlights
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [forceArabicFont, setForceArabicFont] = useState(false);

  // Time tracked on this page
  const [secondsRead, setSecondsRead] = useState(0);

  // Active sub-tab on mobile layout ('text' for reader canvas, 'index' for table of contents, 'discussion' for comments)
  const [activeTab, setActiveTab] = useState<'text' | 'index' | 'discussion'>('text');

  // Search state inside active kitab
  const [searchQuery, setSearchQuery] = useState('');

  const typeLabel = activeKitab?.type === 'artikel' ? 'Artikel' : activeKitab?.type === 'buku' ? 'Buku' : 'Kitab';
  const indexLabel = activeKitab?.type === 'artikel' ? 'Detail' : 'Daftar Isi';

  // Strip Arabic diacritics helper
  const stripArabicDiacritics = (text: string): string => {
    if (!text) return '';
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  };

  // Extract snippet helper
  const getSnippet = (text: string, query: string, isArabic = false): { before: string; match: string; after: string } => {
    const normalizedText = isArabic ? stripArabicDiacritics(text).toLowerCase() : text.toLowerCase();
    const normalizedQuery = isArabic ? stripArabicDiacritics(query).toLowerCase() : query.toLowerCase();
    
    const index = normalizedText.indexOf(normalizedQuery);
    if (index === -1) {
      return { before: '', match: text.slice(0, 15) + '...', after: '' };
    }
    
    const directIdx = text.toLowerCase().indexOf(query.toLowerCase());
    if (directIdx !== -1) {
      const start = Math.max(0, directIdx - 30);
      const end = Math.min(text.length, directIdx + query.length + 30);
      return {
        before: (start > 0 ? '...' : '') + text.slice(start, directIdx),
        match: text.slice(directIdx, directIdx + query.length),
        after: text.slice(directIdx + query.length, end) + (end < text.length ? '...' : '')
      };
    }
    
    const words = text.split(/\s+/);
    let matchWordIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (stripArabicDiacritics(words[i]).toLowerCase().includes(normalizedQuery)) {
        matchWordIndex = i;
        break;
      }
    }
    
    if (matchWordIndex !== -1) {
      const startWord = Math.max(0, matchWordIndex - 3);
      const endWord = Math.min(words.length, matchWordIndex + 4);
      const beforeStr = words.slice(startWord, matchWordIndex).join(' ');
      const matchStr = words[matchWordIndex];
      const afterStr = words.slice(matchWordIndex + 1, endWord).join(' ');
      
      return {
        before: (startWord > 0 ? '... ' : '') + beforeStr + ' ',
        match: matchStr,
        after: ' ' + afterStr + (endWord < words.length ? ' ...' : '')
      };
    }
    
    return {
      before: '',
      match: text.slice(0, 40) + '...',
      after: ''
    };
  };

  // Memoized search results
  const searchResults = useMemo(() => {
    if (!activeKitab || !searchQuery.trim()) return [];
    
    const query = searchQuery.trim().toLowerCase();
    const isQueryArabic = /[\u0600-\u06FF]/.test(query);
    const queryNormalized = isQueryArabic ? stripArabicDiacritics(query) : query;
    
    const results: Array<{
      chapter: Chapter;
      paragraph?: Paragraph;
      fieldName: 'chapter_title' | 'arabic' | 'translation' | 'explanation';
      snippet: { before: string; match: string; after: string };
    }> = [];
    
    for (const ch of activeKitab.chapters) {
      const normalizedTitle = isQueryArabic ? stripArabicDiacritics(ch.title).toLowerCase() : ch.title.toLowerCase();
      if (normalizedTitle.includes(queryNormalized)) {
        results.push({
          chapter: ch,
          fieldName: 'chapter_title',
          snippet: getSnippet(ch.title, query, isQueryArabic)
        });
      }
      
      for (const p of ch.paragraphs) {
        if (p.arabic) {
          const normalizedArabic = stripArabicDiacritics(p.arabic).toLowerCase();
          if (normalizedArabic.includes(queryNormalized)) {
            results.push({
              chapter: ch,
              paragraph: p,
              fieldName: 'arabic',
              snippet: getSnippet(p.arabic, query, true)
            });
            continue;
          }
        }
        
        if (p.translation) {
          const normalizedTrans = p.translation.toLowerCase();
          if (normalizedTrans.includes(queryNormalized)) {
            results.push({
              chapter: ch,
              paragraph: p,
              fieldName: 'translation',
              snippet: getSnippet(p.translation, query, false)
            });
            continue;
          }
        }
        
        if (p.explanation) {
          const normalizedExpl = p.explanation.toLowerCase();
          if (normalizedExpl.includes(queryNormalized)) {
            results.push({
              chapter: ch,
              paragraph: p,
              fieldName: 'explanation',
              snippet: getSnippet(p.explanation, query, false)
            });
          }
        }
      }
    }
    
    return results;
  }, [activeKitab, searchQuery]);

  const handleSearchResultClick = (result: any) => {
    setActiveChapterId(result.chapter.id);
    
    if (result.paragraph) {
      setActiveParagraphId(result.paragraph.id);
      setActiveParagraphChapterId(result.chapter.id);
      
      setTimeout(() => {
        const el = document.getElementById(`paragraph-block-${result.paragraph.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
          setTimeout(() => {
            if (el) {
              el.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
            }
          }, 2000);
        }
      }, 300);
      
      if (isPageMode && result.paragraph.page !== undefined) {
        const pageNum = result.paragraph.page;
        const targetChapter = result.chapter;
        
        let targetGroupChapters = [targetChapter];
        if (!isTreeStyle) {
          const group = chapterGroups.find(g => 
            g.parent?.id === targetChapter.id || g.children.some(c => c.id === targetChapter.id)
          );
          if (group) {
            targetGroupChapters = [];
            if (group.parent) targetGroupChapters.push(group.parent);
            targetGroupChapters.push(...group.children);
          }
        }
        
        const chPages = targetGroupChapters.flatMap(c => c.paragraphs.map(p => (p.page || 1) as number));
        const uniqueChPages = Array.from(new Set(chPages)).sort((a: any, b: any) => a - b);
        const pgIdx = uniqueChPages.indexOf(pageNum);
        if (pgIdx !== -1) {
          setCurrentPageIndex(pgIdx);
        }
      } else if (isPageMode) {
        const targetChapter = result.chapter;
        const pIdx = targetChapter.paragraphs.findIndex((p: any) => p.id === result.paragraph.id);
        if (pIdx !== -1) {
          setCurrentPageIndex(pIdx);
        }
      }
    } else {
      setActiveParagraphId(null);
    }
    
    setActiveTab('text');
  };

  // Page mode settings for classical books
  const [isPageMode, setIsPageMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('kitab_reader_page_mode');
    if (saved !== null) return saved === 'true';
    return activeKitab?.category === 'Full Arab';
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hideTranslation, setHideTranslation] = useState<boolean>(() => {
    const saved = localStorage.getItem('kitab_reader_hide_translation');
    if (saved !== null) return saved === 'true';
    return activeKitab?.category === 'Full Arab';
  });

  const handleSetPageMode = (val: boolean) => {
    setIsPageMode(val);
    localStorage.setItem('kitab_reader_page_mode', String(val));
  };

  const handleSetHideTranslation = (val: boolean) => {
    setHideTranslation(val);
    localStorage.setItem('kitab_reader_hide_translation', String(val));
  };

  const [combineSections, setCombineSections] = useState<boolean>(() => {
    const saved = localStorage.getItem('kitab_reader_combine_sections');
    return saved === 'true';
  });

  const handleSetCombineSections = (val: boolean) => {
    setCombineSections(val);
    localStorage.setItem('kitab_reader_combine_sections', String(val));
  };

  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const isTreeStyle = useMemo(() => {
    if (!activeKitab) return false;
    return activeKitab.chapters.some(ch => ch.parentId !== undefined);
  }, [activeKitab]);

  const treeNodes = useMemo(() => {
    if (!activeKitab) return [];
    return buildTree(activeKitab.chapters);
  }, [activeKitab]);

  const chapterGroups = useMemo(() => {
    if (!activeKitab) return [];
    const groups: { parent: Chapter | null; children: Chapter[] }[] = [];
    
    for (const ch of activeKitab.chapters) {
      if (ch.isSubChapter) {
        if (groups.length > 0) {
          groups[groups.length - 1].children.push(ch);
        } else {
          groups.push({ parent: null, children: [ch] });
        }
      } else {
        groups.push({ parent: ch, children: [] });
      }
    }
    return groups;
  }, [activeKitab]);

  const activeGroup = useMemo(() => {
    if (!activeKitab || !activeChapter) return null;
    return chapterGroups.find(g => 
      g.parent?.id === activeChapter.id || g.children.some(c => c.id === activeChapter.id)
    ) || null;
  }, [chapterGroups, activeChapter, activeKitab]);

  const activeGroupChapters = useMemo(() => {
    if (!activeKitab || !activeChapter) return [];
    if (isTreeStyle) {
      if (combineSections) {
        // Find the parent chapter if activeChapter is a sub-chapter, otherwise activeChapter itself is the parent
        const parentCh = activeChapter.parentId
          ? (activeKitab.chapters.find(c => c.id === activeChapter.parentId) || activeChapter)
          : activeChapter;
        
        // Find all child chapters belonging to this parent
        const children = activeKitab.chapters.filter(c => c.parentId === parentCh.id);
        
        return [parentCh, ...children];
      }
      return [activeChapter];
    }
    if (!activeGroup) return [];
    const chapters = [];
    if (activeGroup.parent) chapters.push(activeGroup.parent);
    chapters.push(...activeGroup.children);
    return chapters;
  }, [activeGroup, isTreeStyle, activeChapter, activeKitab, combineSections]);

  // Compute pages for the active chapter
  const uniquePages = useMemo(() => {
    if (activeGroupChapters.length === 0) return [1];
    const pages = activeGroupChapters.flatMap(ch => ch.paragraphs.map(p => (p.page || 1) as number));
    return Array.from(new Set(pages)).sort((a: any, b: any) => a - b);
  }, [activeGroupChapters]);

  // Paragraphs on the current page
  const paragraphsOnCurrentPage = useMemo(() => {
    if (activeGroupChapters.length === 0) return [];
    
    const allParagraphs = activeGroupChapters.flatMap(ch => 
      ch.paragraphs.map(p => ({ chapter: ch, paragraph: p }))
    );

    if (!isPageMode) return allParagraphs;
    
    // Check if any paragraph has an explicit page number (meaning it was created by the writer)
    const hasExplicitPages = allParagraphs.some(item => item.paragraph.page !== undefined);
    if (!hasExplicitPages) {
      // Classical book fallback: 1 paragraph = 1 page
      return [allParagraphs[currentPageIndex]].filter(Boolean);
    }
    
    const activePageNum = uniquePages[currentPageIndex] || 1;
    return allParagraphs.filter(item => (item.paragraph.page || 1) === activePageNum);
  }, [activeGroupChapters, isPageMode, currentPageIndex, uniquePages]);

  // Scroll to active chapter or chapter header when it changes
  useEffect(() => {
    if (activeChapter?.id) {
      if (combineSections && isTreeStyle) {
        // Find if there is a header for the active chapter
        const el = document.getElementById(`chapter-header-${activeChapter.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeChapter?.id, combineSections, isTreeStyle]);

  // Adjust page index when page list size changes
  useEffect(() => {
    if (currentPageIndex >= uniquePages.length) {
      setCurrentPageIndex(0);
    }
  }, [uniquePages.length]);

  // Automatically adapt/reset layout modes when book or chapter changes
  useEffect(() => {
    const savedPageMode = localStorage.getItem('kitab_reader_page_mode');
    const savedHideTrans = localStorage.getItem('kitab_reader_hide_translation');

    if (activeKitab) {
      const isFullArab = activeKitab.category === 'Full Arab';
      if (savedPageMode !== null) {
        setIsPageMode(savedPageMode === 'true');
      } else {
        setIsPageMode(isFullArab || activeKitab.chapters.some(ch => ch.paragraphs.some(p => p.page !== undefined)));
      }

      if (savedHideTrans !== null) {
        setHideTranslation(savedHideTrans === 'true');
      } else {
        setHideTranslation(isFullArab);
      }
    }
    setCurrentPageIndex(0);
  }, [activeKitab?.id, activeChapter?.id]);

  // Auto-log a reading minute every 60 seconds
  useEffect(() => {
    setSecondsRead(0);
    const interval = setInterval(() => {
      setSecondsRead(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeChapter?.id]);

  useEffect(() => {
    if (secondsRead > 0 && secondsRead % 60 === 0) {
      logReadingActivity(1);
    }
  }, [secondsRead]);

  // Handle bookmarked status
  const isBookmarked = useMemo(() => {
    if (!activeKitab) return false;
    if (activeKitab.type === 'artikel') {
      return bookmarks.some(b => b.kitabId === activeKitab.id && !b.chapterId);
    }
    if (!activeChapter) return false;
    return bookmarks.some(b => b.kitabId === activeKitab.id && b.chapterId === activeChapter.id);
  }, [bookmarks, activeKitab, activeChapter]);

  const toggleBookmark = async () => {
    if (!activeKitab) return;
    if (activeKitab.type === 'artikel') {
      if (isBookmarked) {
        await removeBookmark(activeKitab.id, '');
      } else {
        await addBookmark(activeKitab.id, '');
      }
      return;
    }
    if (!activeChapter) return;
    if (isBookmarked) {
      await removeBookmark(activeKitab.id, activeChapter.id);
    } else {
      await addBookmark(activeKitab.id, activeChapter.id);
    }
  };

  const handleShare = () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('view', 'reader');
    url.searchParams.set('kitabId', activeKitab.id);
    if (activeChapter) {
      url.searchParams.set('chapterId', activeChapter.id);
    }
    
    if (navigator.share) {
      navigator.share({
        title: `Membaca ${activeKitab.title}`,
        text: `Cek kitab/artikel ini: ${activeKitab.title}`,
        url: url.toString()
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url.toString());
      addToast('Link Disalin', 'Link telah disalin ke papan klip.', 'info');
    }
  };

  if (!activeKitab || (!activeChapter && activeKitab.type !== 'artikel')) {
    return (
      <div className="text-center py-16 bg-[#FDFBF7] dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] rounded-2xl">
        <p className="text-stone-500 font-serif">Pilih kitab atau artikel untuk mulai membaca.</p>
        <button
          onClick={() => setView('library')}
          className="mt-4 px-4 py-2 bg-[#5A5A40] text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-[#454530]"
        >
          Kembali ke Pustaka
        </button>
      </div>
    );
  }

  // Chapter navigation indices
  const currentChapterIdx = (activeKitab && activeChapter) ? activeKitab.chapters.findIndex(ch => ch.id === activeChapter.id) : -1;
  const currentGroupIndex = chapterGroups.findIndex(g => g === activeGroup);

  const hasPrevChapter = isTreeStyle ? (currentChapterIdx > 0) : (currentGroupIndex > 0);
  const hasNextChapter = isTreeStyle ? (activeKitab && currentChapterIdx < activeKitab.chapters.length - 1) : (currentGroupIndex < chapterGroups.length - 1);

  const navigatePrev = () => {
    if (isTreeStyle) {
      if (currentChapterIdx > 0 && activeKitab) {
        const prevCh = activeKitab.chapters[currentChapterIdx - 1];
        setActiveChapterId(prevCh.id);
        setActiveParagraphId(null);
      }
    } else {
      if (hasPrevChapter) {
        const prevGroup = chapterGroups[currentGroupIndex - 1];
        setActiveChapterId(prevGroup.parent ? prevGroup.parent.id : prevGroup.children[0].id);
        setActiveParagraphId(null);
      }
    }
  };

  const navigateNext = () => {
    if (isTreeStyle) {
      if (activeKitab && currentChapterIdx < activeKitab.chapters.length - 1) {
        const nextCh = activeKitab.chapters[currentChapterIdx + 1];
        setActiveChapterId(nextCh.id);
        setActiveParagraphId(null);
      }
    } else {
      if (hasNextChapter) {
        const nextGroup = chapterGroups[currentGroupIndex + 1];
        setActiveChapterId(nextGroup.parent ? nextGroup.parent.id : nextGroup.children[0].id);
        setActiveParagraphId(null);
      }
    }
  };

  // Open the highlight editor for a paragraph
  const handleParagraphClick = (pId: string, chapterId: string) => {
    if (!currentUserEmail) return;
    
    const existingAnn = annotations.find(
      a => a.kitabId === activeKitab.id && a.chapterId === chapterId && a.paragraphId === pId
    );

    setActiveParagraphId(pId);
    setActiveParagraphChapterId(chapterId);
    if (existingAnn) {
      setNoteText(existingAnn.note);
      setSelectedColor(existingAnn.color);
      setForceArabicFont(false);
    } else {
      setNoteText('');
      setSelectedColor('yellow');
      setForceArabicFont(false);
    }
  };

  const handleSaveAnnotation = async (pId: string, originalText: string) => {
    await saveAnnotation({
      kitabId: activeKitab.id,
      chapterId: activeParagraphChapterId || activeChapter.id,
      paragraphId: pId,
      highlightedText: originalText,
      note: noteText,
      color: selectedColor
    });
    setActiveParagraphId(null);
    setActiveParagraphChapterId(null);
  };

  const handleDeleteAnnotation = async (annotationId: string, pId: string) => {
    await deleteAnnotation(annotationId, pId);
    setActiveParagraphId(null);
  };

  // Maps spacing key to tailwind class
  const spacingClass = {
    tight: 'space-y-4',
    normal: 'space-y-6',
    relaxed: 'space-y-9'
  }[preferences.lineSpacing];

  // Font families lookup
  const arabicFontFamilyClass = {
    Amiri: 'font-amiri',
    Lateef: 'font-lateef',
    'Scheherazade New': 'font-scheherazade'
  }[preferences.arabicFontFamily] || 'font-amiri';

  // Highlight color mapping
  const colorBgMap: Record<string, string> = {
    yellow: 'bg-yellow-100/80 dark:bg-yellow-950/40 border-l-4 border-yellow-500',
    green: 'bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500',
    pink: 'bg-pink-50 dark:bg-pink-950/30 border-l-4 border-pink-500'
  };

  const colorBadgeMap: Record<string, string> = {
    yellow: 'bg-yellow-400',
    green: 'bg-emerald-400',
    blue: 'bg-blue-400',
    pink: 'bg-pink-400'
  };

  const themeStyles = {
    light: {
      canvas: 'bg-[#FDFBF7] text-[#1A1A17] border-[#E5E1D8]',
      arabic: 'text-[#1A1A17]',
      translation: 'text-[#444440]',
      explanation: 'text-[#777266] border-[#E5E1D8]',
      explanationLabel: 'text-[#5A5A40]',
      annotationBg: 'bg-[#F9F6F0] border-[#E5E1D8]',
      annotationLabel: 'text-[#5A5A40]',
      annotationText: 'text-[#333333]',
      stampLabel: 'text-[#5A5A40]',
      stampTitle: 'text-[#333333]',
      stampAuthor: 'text-[#777266]',
      stampBorder: 'border-[#E5E1D8]'
    },
    sepia: {
      canvas: 'bg-[#F5EFE2] text-[#433422] border-[#DCD3BF]',
      arabic: 'text-[#433422]',
      translation: 'text-[#5c4a37]',
      explanation: 'text-[#705c46] border-[#DCD3BF]',
      explanationLabel: 'text-[#845e35]',
      annotationBg: 'bg-[#EFE7D5] border-[#DCD3BF]',
      annotationLabel: 'text-[#845e35]',
      annotationText: 'text-[#433422]',
      stampLabel: 'text-[#845e35]',
      stampTitle: 'text-[#433422]',
      stampAuthor: 'text-[#705c46]',
      stampBorder: 'border-[#DCD3BF]'
    },
    dark: {
      canvas: 'bg-[#121210] text-[#E5E1D8] border-[#3A3A30]',
      arabic: 'text-[#E5E1D8]',
      translation: 'text-[#A8A890]',
      explanation: 'text-[#999488] border-[#3A3A30]',
      explanationLabel: 'text-[#D9D4C5]',
      annotationBg: 'bg-[#181814] border-[#3A3A30]',
      annotationLabel: 'text-[#D9D4C5]',
      annotationText: 'text-[#E5E1D8]',
      stampLabel: 'text-[#D9D4C5]',
      stampTitle: 'text-[#E5E1D8]',
      stampAuthor: 'text-[#999488]',
      stampBorder: 'border-[#3A3A30]'
    }
  }[preferences.theme] || {
    canvas: 'bg-[#FDFBF7] text-[#1A1A17] border-[#E5E1D8]',
    arabic: 'text-[#1A1A17]',
    translation: 'text-[#444440]',
    explanation: 'text-[#777266] border-[#E5E1D8]',
    explanationLabel: 'text-[#5A5A40]',
    annotationBg: 'bg-[#F9F6F0] border-[#E5E1D8]',
    annotationLabel: 'text-[#5A5A40]',
    annotationText: 'text-[#333333]',
    stampLabel: 'text-[#5A5A40]',
    stampTitle: 'text-[#333333]',
    stampAuthor: 'text-[#777266]',
    stampBorder: 'border-[#E5E1D8]'
  };

  const formattedMinutes = Math.floor(secondsRead / 60);
  const formattedSeconds = secondsRead % 60;

  return (
    <div id="kitab-reader-container" className="space-y-4">
      {/* 1. persistent header for navigation and actions */}
      <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-3 sm:p-4 shadow-none flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            id="btn-reader-back"
            onClick={() => {
              setActiveKitabId(null);
              setView('library');
            }}
            className="p-2 hover:bg-[#E5E1D8] dark:hover:bg-[#121210] rounded-lg text-[#777266] dark:text-[#A8A890] transition-colors focus:outline-none cursor-pointer flex-shrink-0"
            title="Kembali ke Pustaka"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-serif font-bold text-[#333333] dark:text-[#E5E1D8] text-xs sm:text-sm truncate">
              {activeKitab.title}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#999488] font-medium truncate mt-0.5 uppercase tracking-wider">
              {activeKitab.type === 'artikel' ? 'Artikel' : (activeChapter?.title || '')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Reading Timer - visible on both mobile and desktop with compact display */}
          <div className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-[#5A5A40]/10 border border-[#5A5A40]/20 rounded-lg text-[#5A5A40] dark:text-[#E5E1D8] text-[10px] sm:text-xs font-bold">
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
            <span>{formattedMinutes}:{formattedSeconds < 10 ? `0${formattedSeconds}` : formattedSeconds}m</span>
          </div>

          {/* Bookmark button */}
          {currentUserEmail && (
            <button
              id="btn-toggle-bookmark"
              onClick={toggleBookmark}
              className={`p-2 sm:p-2.5 rounded-lg border transition-all focus:outline-none cursor-pointer ${
                isBookmarked
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-700'
                  : 'bg-white dark:bg-slate-900 border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] hover:text-[#5A5A40] dark:hover:text-[#E5E1D8]'
              }`}
              title={isBookmarked ? 'Hapus dari Penanda' : 'Simpan ke Penanda'}
            >
              {isBookmarked ? <BookmarkCheck className="w-4 h-4 fill-amber-600 text-amber-600" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}

          {/* Share button */}
          <button
            id="btn-share-kitab"
            onClick={handleShare}
            className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded-lg text-[#777266] hover:text-[#5A5A40] dark:hover:text-[#E5E1D8] transition-all focus:outline-none cursor-pointer"
            title="Bagikan Halaman Ini"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Settings button */}
          <button
            id="btn-toggle-settings"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 sm:p-2.5 rounded-lg border transition-all focus:outline-none cursor-pointer ${
              showSettings
                ? 'bg-[#5A5A40]/10 border-[#5A5A40]/20 text-[#5A5A40] dark:text-[#E5E1D8]'
                : 'bg-white dark:bg-slate-900 border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] hover:text-[#5A5A40] dark:hover:text-[#E5E1D8]'
            }`}
            title="Sesuaikan Format Teks"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Edit Custom Kitab button */}
          {!activeKitab.isDefault && activeKitab.createdBy === currentUserEmail && (
            <button
              id="btn-reader-edit-kitab"
              onClick={() => {
                setEditingKitabId(activeKitab.id);
                setView('writer');
              }}
              className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded-lg text-[#777266] hover:text-[#5A5A40] dark:hover:text-[#E5E1D8] transition-all focus:outline-none cursor-pointer"
              title="Edit Kitab Ini"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Responsive Tabs for Mobile Reader View (Hidden on Desktop) */}
      <div id="mobile-reader-tabs" className="lg:hidden flex border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#F9F6F0] dark:bg-[#181814] p-1 rounded-lg gap-1">
        {[
          { id: 'text', label: `Teks ${typeLabel}`, icon: BookOpen },
          { id: 'index', label: indexLabel, icon: BookmarkCheck },
          { id: 'discussion', label: 'Diskusi', icon: MessageSquare }
        ].map((tab) => {
          const Icon = tab.icon;
          const isTabActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`reader-mobile-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-bold transition-all focus:outline-none cursor-pointer ${
                isTabActive
                  ? 'bg-[#5A5A40] text-white shadow-none'
                  : 'text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8]/50 dark:hover:bg-[#121210]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Grid layout split dynamically */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT & CENTER: Reading Area (Always shown on desktop, conditionally on mobile) */}
        <div className={`lg:col-span-2 space-y-5 ${activeTab === 'text' ? 'block' : 'hidden lg:block'}`}>
        <AnimatePresence>
          {showSettings && (
            <motion.div
              id="text-settings-panel"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-2">
                <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-[#5A5A40]" /> Pengaturan Kenyamanan Membaca
                </h4>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-xs text-[#777266] hover:text-[#5A5A40] dark:hover:text-white focus:outline-none cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Theme Picker */}
                <div>
                  <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                    Tema Warna Latar
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: 'Terang', value: 'light', bg: 'bg-[#FDFBF7] text-[#333333] border-[#E5E1D8]' },
                      { name: 'Sépia', value: 'sepia', bg: 'bg-[#F5EFE2] text-[#433422] border-[#DCD3BF]' },
                      { name: 'Malam', value: 'dark', bg: 'bg-[#121210] text-[#E5E1D8] border-[#3A3A30]' }
                    ].map(t => (
                      <button
                        key={t.value}
                        id={`theme-btn-${t.value}`}
                        onClick={() => updatePreferences({ theme: t.value as any })}
                        className={`text-xs font-semibold py-2 rounded-lg border text-center cursor-pointer transition-all ${t.bg} ${
                          preferences.theme === t.value ? 'ring-2 ring-[#5A5A40]' : 'opacity-80'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Arabic Font Family */}
                <div>
                  <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                    Jenis Huruf Arab
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {['Amiri', 'Lateef', 'Scheherazade New'].map(font => (
                      <button
                        key={font}
                        id={`font-family-btn-${font.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => updatePreferences({ arabicFontFamily: font })}
                        className={`text-xs py-2 rounded-lg border text-center cursor-pointer transition-all ${
                          preferences.arabicFontFamily === font
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-semibold'
                            : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8]'
                        }`}
                      >
                        {font.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Font Sizes */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider">
                        Ukuran Huruf Arab
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          id="btn-dec-arabic-size"
                          onClick={() => updatePreferences({ arabicFontSize: Math.max(10, preferences.arabicFontSize - 2) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          -
                        </button>
                        <span className="font-mono text-[#333333] dark:text-[#E5E1D8] font-bold text-xs min-w-[32px] text-center">{preferences.arabicFontSize}px</span>
                        <button
                          id="btn-inc-arabic-size"
                          onClick={() => updatePreferences({ arabicFontSize: Math.min(44, preferences.arabicFontSize + 2) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      id="range-arabic-font-size"
                      type="range"
                      min="10"
                      max="44"
                      step="2"
                      value={preferences.arabicFontSize}
                      onChange={(e) => updatePreferences({ arabicFontSize: parseInt(e.target.value) })}
                      className="w-full accent-[#5A5A40]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider">
                        Ukuran Terjemahan
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          id="btn-dec-trans-size"
                          onClick={() => updatePreferences({ translationFontSize: Math.max(13, preferences.translationFontSize - 1) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          -
                        </button>
                        <span className="font-mono text-[#333333] dark:text-[#E5E1D8] font-bold text-xs min-w-[32px] text-center">{preferences.translationFontSize}px</span>
                        <button
                          id="btn-inc-trans-size"
                          onClick={() => updatePreferences({ translationFontSize: Math.min(22, preferences.translationFontSize + 1) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      id="range-translation-font-size"
                      type="range"
                      min="13"
                      max="22"
                      step="1"
                      value={preferences.translationFontSize}
                      onChange={(e) => updatePreferences({ translationFontSize: parseInt(e.target.value) })}
                      className="w-full accent-[#5A5A40]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider">
                        Ukuran Syarah / Penjelasan
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          id="btn-dec-expl-size"
                          onClick={() => updatePreferences({ explanationFontSize: Math.max(11, (preferences.explanationFontSize || 14) - 1) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          -
                        </button>
                        <span className="font-mono text-[#333333] dark:text-[#E5E1D8] font-bold text-xs min-w-[32px] text-center">{preferences.explanationFontSize || 14}px</span>
                        <button
                          id="btn-inc-expl-size"
                          onClick={() => updatePreferences({ explanationFontSize: Math.min(24, (preferences.explanationFontSize || 14) + 1) })}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-900 border border-[#E5E1D8] dark:border-[#3A3A30] rounded text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      id="range-explanation-font-size"
                      type="range"
                      min="11"
                      max="24"
                      step="1"
                      value={preferences.explanationFontSize || 14}
                      onChange={(e) => updatePreferences({ explanationFontSize: parseInt(e.target.value) })}
                      className="w-full accent-[#5A5A40]"
                    />
                  </div>
                </div>

                {/* 4. Spacing */}
                <div>
                  <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                    Kerapatan Paragraf
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Rapat', value: 'tight' },
                      { label: 'Normal', value: 'normal' },
                      { label: 'Renggang', value: 'relaxed' }
                    ].map(sp => (
                      <button
                        key={sp.value}
                        id={`spacing-btn-${sp.value}`}
                        onClick={() => updatePreferences({ lineSpacing: sp.value as any })}
                        className={`text-xs py-2 rounded-lg border text-center cursor-pointer transition-all ${
                          preferences.lineSpacing === sp.value
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-semibold'
                            : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8]'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Navigation Mode (Scroll vs Page) */}
                <div>
                  <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                    Metode Navigasi Bab
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Seluruh Bab (Skrol)', value: false },
                      { label: 'Halaman demi Halaman', value: true }
                    ].map(mode => (
                      <button
                        key={mode.label}
                        id={`nav-mode-btn-${mode.value}`}
                        onClick={() => handleSetPageMode(mode.value)}
                        className={`text-xs py-2 rounded-lg border text-center cursor-pointer transition-all ${
                          isPageMode === mode.value
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-semibold'
                            : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8]'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Translation Toggle */}
                <div>
                  <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                    Teks Pendukung (Terjemahan)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tampilkan Terjemah', value: false },
                      { label: 'Sembunyikan (Arab Saja)', value: true }
                    ].map(hide => (
                      <button
                        key={hide.label}
                        id={`hide-translation-btn-${hide.value}`}
                        onClick={() => handleSetHideTranslation(hide.value)}
                        className={`text-xs py-2 rounded-lg border text-center cursor-pointer transition-all ${
                          hideTranslation === hide.value
                            ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-semibold'
                            : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8]'
                        }`}
                      >
                        {hide.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 7. Combine Sections Toggle */}
                {isTreeStyle && (
                  <div>
                    <span className="text-[11px] font-bold text-[#999488] uppercase tracking-wider block mb-2">
                      Penggabungan Bab & Fasal
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Gabungkan Struktur', value: true },
                        { label: 'Pisahkan Bab & Fasal', value: false }
                      ].map(opt => (
                        <button
                          key={opt.label}
                          id={`combine-sections-btn-${opt.value}`}
                          onClick={() => handleSetCombineSections(opt.value)}
                          className={`text-xs py-2 rounded-lg border text-center cursor-pointer transition-all ${
                            combineSections === opt.value
                              ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-semibold'
                              : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Scripture Display Area */}
        <div
          id="scripture-reader-canvas"
          className={`rounded-xl p-4 sm:p-8 shadow-none border transition-colors duration-200 ${themeStyles.canvas}`}
        >
          {activeKitab.type === 'artikel' ? (
            /* Elegant layout for full article */
            <div className="space-y-6">
              {/* Kitab Stamp Info for Article */}
              <div className={`text-center mb-6 border-b border-dashed pb-5 ${themeStyles.stampBorder}`}>
                <span className={`text-[10px] uppercase tracking-widest font-bold ${themeStyles.stampLabel}`}>
                  {activeKitab.category}
                </span>
                <h1 className="font-serif text-lg sm:text-2xl font-bold mt-1">
                  {activeKitab.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-x-2 text-[11px] mt-1.5 text-stone-500 dark:text-stone-400">
                  <p>
                    Ditulis oleh: <strong className={themeStyles.stampAuthor}>{activeKitab.author}</strong>
                  </p>
                  {activeKitab.createdBy && (
                    <>
                      <span className="text-stone-300 dark:text-[#3A3A30] select-none">•</span>
                      <p>
                        Kontributor:{' '}
                        <span 
                          onClick={() => {
                            setProfileUserEmail(activeKitab.createdBy!);
                            setView('profile');
                          }}
                          className="font-bold underline cursor-pointer hover:text-stone-900 dark:hover:text-amber-400 transition-colors"
                          title="Lihat Profil Akun Kontributor"
                        >
                          {activeKitab.createdBy.split('@')[0]}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Full Article Content */}
              <div 
                className={`leading-relaxed whitespace-pre-wrap break-words prose dark:prose-invert max-w-none text-justify`}
                style={{ fontSize: `${preferences.translationFontSize}px` }}
                dangerouslySetInnerHTML={{ __html: activeKitab.content || '' }}
              />
            </div>
          ) : (
            <>

          {/* Kitab Stamp Info */}
          <div className={`text-center mb-6 border-b border-dashed pb-5 ${themeStyles.stampBorder}`}>
            <span className={`text-[10px] uppercase tracking-widest font-bold ${themeStyles.stampLabel}`}>
              {activeKitab.category === 'default-arbain-nawawi' ? 'Hadis' : activeKitab.category}
            </span>
            <h1 className="font-serif text-lg sm:text-2xl font-bold mt-1">
              {activeChapter.title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-2 text-[11px] mt-1.5 text-stone-500 dark:text-stone-400">
              <p>
                Ditulis oleh: <strong className={themeStyles.stampAuthor}>{activeKitab.author}</strong>
              </p>
              {activeKitab.createdBy && (
                <>
                  <span className="text-stone-300 dark:text-[#3A3A30] select-none">•</span>
                  <p>
                    Kontributor:{' '}
                    <span 
                      onClick={() => {
                        setProfileUserEmail(activeKitab.createdBy!);
                        setView('profile');
                      }}
                      className="font-bold underline cursor-pointer hover:text-stone-900 dark:hover:text-amber-400 transition-colors"
                      title="Lihat Profil Akun Kontributor"
                    >
                      {activeKitab.createdBy.split('@')[0]}
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Page-by-Page Reading Navigation (Halaman demi Halaman) */}
          {isPageMode && uniquePages.length > 0 && (
            <div className="mb-6 space-y-2.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between bg-neutral-100/10 dark:bg-neutral-800/20 p-2 rounded-lg border border-neutral-300/30 text-xs">
                <button
                  id="btn-prev-page"
                  disabled={currentPageIndex === 0}
                  onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                  className="p-1 px-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 disabled:opacity-30 rounded transition-all cursor-pointer font-bold flex items-center gap-1 select-none text-[#5A5A40] dark:text-[#E5E1D8]"
                >
                  <ChevronLeft className="w-4 h-4" /> Hal. Sebelumnnya
                </button>
                <span className="font-serif font-bold">
                  Halaman {currentPageIndex + 1} dari {uniquePages.length}
                </span>
                <button
                  id="btn-next-page"
                  disabled={currentPageIndex === uniquePages.length - 1}
                  onClick={() => setCurrentPageIndex(prev => Math.min(uniquePages.length - 1, prev + 1))}
                  className="p-1 px-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 disabled:opacity-30 rounded transition-all cursor-pointer font-bold flex items-center gap-1 select-none text-[#5A5A40] dark:text-[#E5E1D8]"
                >
                  Hal. Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {uniquePages.length > 1 && (
                <div className="px-1 py-1">
                  <input
                     id="reader-page-slider"
                     type="range"
                     min="0"
                     max={uniquePages.length - 1}
                     value={currentPageIndex}
                     onChange={(e) => setCurrentPageIndex(parseInt(e.target.value))}
                     className="w-full h-1 bg-[#5A5A40]/10 dark:bg-[#E5E1D8]/10 rounded-lg appearance-none cursor-pointer accent-[#5A5A40] dark:accent-[#E5E1D8]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Paragraph node iteration */}
          <div className={spacingClass}>
            {paragraphsOnCurrentPage.map(({ chapter, paragraph: p }, mapIndex) => {
              const annotation = annotations.find(
                a => a.kitabId === activeKitab.id && a.chapterId === chapter.id && a.paragraphId === p.id
              );
              const isEditingThis = activeParagraphId === p.id;

              const currentPageNum = p.page || 1;
              const nextItem = mapIndex < paragraphsOnCurrentPage.length - 1 ? paragraphsOnCurrentPage[mapIndex + 1] : null;
              const nextPageNum = nextItem ? (nextItem.paragraph.page || 1) : null;
              const showPageDividerBelow = !isPageMode && (nextPageNum !== null && currentPageNum !== nextPageNum);
              const showLastPageDividerBelow = !isPageMode && (mapIndex === paragraphsOnCurrentPage.length - 1);
              
              const prevItem = mapIndex > 0 ? paragraphsOnCurrentPage[mapIndex - 1] : null;
              const showChapterTitle = combineSections
                ? (!prevItem ? chapter.id !== activeChapter.id : prevItem.chapter.id !== chapter.id)
                : (chapter.isSubChapter && (!prevItem || prevItem.chapter.id !== chapter.id));

              return (
                <React.Fragment key={p.id}>
                  {showChapterTitle && (
                    <div id={`chapter-header-${chapter.id}`} className="mt-8 mb-4">
                      <h3 className="font-serif text-lg font-bold text-center text-[#5A5A40] dark:text-[#E5E1D8]">
                        {chapter.title}
                      </h3>
                    </div>
                  )}
                  <div
                    id={`paragraph-block-${p.id}`}
                    onClick={() => handleParagraphClick(p.id, chapter.id)}
                    className={`relative p-4 rounded-lg cursor-pointer hover:bg-[#5A5A40]/5 transition-all group border border-transparent ${
                      annotation ? colorBgMap[annotation.color] : ''
                    }`}
                  >
                  {/* 1. Arabic Text (Align Right) */}
                  <div
                    id={`arabic-text-${p.id}`}
                    dir="auto"
                    className={`arabic-text mb-4 leading-loose whitespace-pre-wrap break-words ${arabicFontFamilyClass} ${themeStyles.arabic}`}
                    style={{ fontSize: `${preferences.arabicFontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: p.arabic }}
                  />

                  {/* 2. Indonesian Translation */}
                  {!hideTranslation && p.translation && (
                    <div
                      id={`translation-text-${p.id}`}
                      dir="auto"
                      className={`font-medium leading-relaxed whitespace-pre-wrap break-words ${themeStyles.translation}`}
                      style={{ fontSize: `${preferences.translationFontSize}px` }}
                      dangerouslySetInnerHTML={{ __html: p.translation }}
                    />
                  )}

                  {/* 3. Explanation (Tafsir/Syarah) if present */}
                  {!hideTranslation && p.explanation && (
                    <div
                      id={`explanation-text-${p.id}`}
                      className={`mt-3.5 pt-3.5 border-t leading-relaxed ${themeStyles.explanation}`}
                    >
                      <strong className={`not-italic text-[10px] uppercase font-bold block mb-1 ${themeStyles.explanationLabel}`}>
                        Penjelasan / Syarah:
                      </strong>
                      <div 
                        className={`whitespace-pre-wrap break-words ${preferences.explanationItalic !== false ? 'italic' : 'not-italic'}`}
                        dir="auto"
                        style={{ fontSize: `${preferences.explanationFontSize || 14}px` }}
                        dangerouslySetInnerHTML={{ __html: p.explanation }}
                      />
                    </div>
                  )}

                  {/* 4. Display Existing Personal Annotation Note */}
                  {annotation && annotation.note && (
                    <div
                      id={`annotation-note-display-${p.id}`}
                      className={`mt-3.5 p-3 rounded-lg shadow-none text-xs ${themeStyles.annotationBg}`}
                    >
                      <p className={`font-semibold mb-1 flex items-center gap-1 ${themeStyles.annotationLabel}`}>
                        <BookmarkCheck className="w-3.5 h-3.5" /> Catatan Pribadi Anda:
                      </p>
                      <div 
                        className={`font-medium leading-relaxed ${themeStyles.annotationText} whitespace-pre-wrap break-words text-xs`}
                        dir="ltr"
                      >
                        {annotation.note}
                      </div>
                    </div>
                  )}

                  {/* Hint indicator on hover */}
                  {!annotation && !isEditingThis && currentUserEmail && (
                    <span className="absolute bottom-2 right-2 text-[9px] text-[#5A5A40] dark:text-[#E5E1D8] opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
                      <Highlighter className="w-2.5 h-2.5" /> Klik untuk menyorot / memberi catatan
                    </span>
                  )}

                  {/* 5. Interactive Highlight Editor Widget (Inline menu) */}
                  <AnimatePresence>
                    {isEditingThis && (
                      <motion.div
                        id={`paragraph-editor-widget-${p.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={(e) => e.stopPropagation()} // Prevent clicking parent again
                        className="mt-4 bg-[#F5F2ED] dark:bg-[#121210] p-4 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] space-y-3 cursor-default"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-2">
                          <span className="text-xs font-semibold text-[#333333] dark:text-[#E5E1D8] flex items-center gap-1">
                            <Highlighter className="w-3.5 h-3.5 text-[#5A5A40]" /> Atur Catatan Ayat / Paragraf
                          </span>
                          <div className="flex gap-1.5 items-center">
                            <span className="text-[10px] text-[#777266] dark:text-[#A8A890] font-semibold mr-1">Warna Sorotan:</span>
                            {['yellow', 'green', 'blue', 'pink'].map((col) => (
                              <button
                                key={col}
                                id={`btn-color-picker-${col}`}
                                onClick={() => setSelectedColor(col)}
                                className={`w-5 h-5 rounded-full transition-all border ${colorBadgeMap[col]} ${
                                  selectedColor === col ? 'ring-2 ring-[#5A5A40] scale-110' : 'opacity-70 hover:opacity-100'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[#777266] dark:text-[#A8A890] font-semibold">Teks Syarah/Catatan:</span>
                            <button
                              type="button"
                              onClick={() => setForceArabicFont(!forceArabicFont)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                forceArabicFont
                                  ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                  : 'bg-white dark:bg-slate-900 text-[#777266] dark:text-slate-400 border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#5A5A40]/10'
                              }`}
                            >
                              {forceArabicFont ? 'Font Arab Aktif (RTL)' : 'Aktifkan Font Arab'}
                            </button>
                          </div>
                          <AutoResizeTextarea
                            id={`textarea-annotation-note-${p.id}`}
                            rows={3}
                            dir={forceArabicFont ? 'rtl' : 'ltr'}
                            placeholder={forceArabicFont ? "اكتب الشرح أو الملاحظة هنا..." : "Tulis opini, penjelasan penting, atau hafalan Anda di sini..."}
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-slate-900 text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all ${
                              forceArabicFont
                                ? 'font-amiri text-lg text-right leading-loose'
                                : 'text-xs'
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          {annotation ? (
                            <button
                              id={`btn-delete-annotation-${p.id}`}
                              onClick={() => handleDeleteAnnotation(annotation.id, p.id)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 focus:outline-none cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Sorotan
                            </button>
                          ) : (
                            <div />
                          )}
                          <div className="flex gap-2">
                            <button
                              id={`btn-cancel-annotation-edit-${p.id}`}
                              onClick={() => setActiveParagraphId(null)}
                              className="px-3 py-1.5 bg-[#E5E1D8] dark:bg-slate-800 text-[#777266] dark:text-slate-300 rounded-lg text-[11px] font-semibold hover:bg-opacity-80 focus:outline-none cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              id={`btn-save-annotation-edit-${p.id}`}
                              onClick={() => handleSaveAnnotation(p.id, p.translation)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#5A5A40] hover:bg-[#454530] text-white rounded-lg text-[11px] font-semibold shadow-none focus:outline-none cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" /> Simpan Catatan
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Beautiful, Compact Page Divider below each page in Scrolling Mode */}
                {(showPageDividerBelow || showLastPageDividerBelow) && (
                  <div className="py-10 flex items-center justify-center w-full col-span-full opacity-70 select-none" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center w-full max-w-[85%] mx-auto">
                      
                      {/* Left Ornament */}
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                        <div className="h-[1.5px] w-1 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                        <div className="w-[1.5px] h-3 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                      </div>
                      
                      {/* Left Line */}
                      <div className="h-[1.5px] flex-1 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                      
                      {/* Center Page Number */}
                      <div className="px-6 font-serif text-[15px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] bg-transparent">
                        {p.pageLabel || currentPageNum}
                      </div>
                      
                      {/* Right Line */}
                      <div className="h-[1.5px] flex-1 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                      
                      {/* Right Ornament */}
                      <div className="flex items-center">
                        <div className="w-[1.5px] h-3 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                        <div className="h-[1.5px] w-1 bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                        <div className="w-2 h-2 rounded-full bg-[#5A5A40] dark:bg-[#E5E1D8]"></div>
                      </div>
                      
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          </div>
            </>
          )}
        </div>

        {/* Chapters Footer Navigation bar */}
        {activeKitab.type !== 'artikel' && (
        <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-3 sm:p-4 shadow-none flex items-center justify-between gap-1.5 sm:gap-4">
          <button
            id="btn-nav-prev-chapter"
            onClick={navigatePrev}
            disabled={!hasPrevChapter}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] disabled:opacity-40 text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-[#121210] transition-all focus:outline-none cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Bab </span>Sebelumnya
          </button>
          <span className="text-[10px] sm:text-xs font-bold text-[#999488] whitespace-nowrap px-1">
            {isTreeStyle ? (
              <span>{currentChapterIdx + 1} / {activeKitab.chapters.length}</span>
            ) : (
              <span>{currentGroupIndex + 1} / {chapterGroups.length}</span>
            )}
          </span>
          <button
            id="btn-nav-next-chapter"
            onClick={navigateNext}
            disabled={!hasNextChapter}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] disabled:opacity-40 text-[#777266] dark:text-[#A8A890] hover:bg-[#E5E1D8] dark:hover:bg-[#121210] transition-all focus:outline-none cursor-pointer whitespace-nowrap"
          >
            <span className="hidden sm:inline">Bab </span>Selanjutnya <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
        )}
      </div>

      {/* RIGHT COLUMN: Chapter Directory & Discussion Comments Panel (Always shown on desktop, conditionally on mobile) */}
      <div className={`space-y-6 lg:block ${activeTab !== 'text' ? 'block' : 'hidden lg:block'}`}>
        {/* Chapter Directory Panel & Search */}
        <div className={`bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4.5 shadow-none ${activeTab === 'index' ? 'block' : 'hidden lg:block'}`}>
          {activeKitab.type === 'artikel' ? (
            /* Elegant Metadata Card for Articles */
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm mb-3 flex items-center justify-between pb-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#5A5A40]" /> Detail Artikel
                </span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#999488] uppercase tracking-wider block mb-0.5">
                    Judul
                  </span>
                  <p className="font-serif font-bold text-sm text-neutral-800 dark:text-[#E5E1D8]">
                    {activeKitab.title}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#999488] uppercase tracking-wider block mb-0.5">
                    Penulis
                  </span>
                  <p className="font-semibold text-neutral-700 dark:text-[#A8A890]">
                    {activeKitab.author}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#999488] uppercase tracking-wider block mb-0.5">
                    Kategori
                  </span>
                  <p className="font-medium text-amber-700 dark:text-amber-400 capitalize">
                    {activeKitab.category}
                  </p>
                </div>

                {activeKitab.description && (
                  <div>
                    <span className="text-[10px] font-bold text-[#999488] uppercase tracking-wider block mb-0.5">
                      Ringkasan / Abstrak
                    </span>
                    <p className="text-[#777266] dark:text-[#A8A890] leading-relaxed">
                      {activeKitab.description}
                    </p>
                  </div>
                )}

                {activeKitab.createdAt && (
                  <div>
                    <span className="text-[10px] font-bold text-[#999488] uppercase tracking-wider block mb-0.5">
                      Tanggal Publikasi
                    </span>
                    <p className="text-[#777266] dark:text-[#A8A890]">
                      {new Date(activeKitab.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm mb-3 flex items-center justify-between pb-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#5A5A40]" /> {indexLabel} & Pencarian
            </span>
          </h3>

          {/* Search Input Bar */}
          <div className="mb-4 relative">
            <div className="relative">
              <input
                id="kitab-search-input"
                type="text"
                placeholder="Cari bab, hadis, kata..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-xs rounded-lg pl-8 pr-8 py-2 text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
              <Search className="w-3.5 h-3.5 text-[#999488] absolute left-2.5 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  id="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-[#999488] hover:text-[#5A5A40] dark:hover:text-[#E5E1D8] focus:outline-none"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[10px] text-[#999488] mt-1.5 flex justify-between items-center px-0.5">
              <span>Cari di teks Arab, terjemah & syarah</span>
              {searchQuery && (
                <span className="font-bold text-[#5A5A40] dark:text-amber-400">
                  {searchResults.length} ditemukan
                </span>
              )}
            </div>
          </div>

          {searchQuery.trim() ? (
            /* SEARCH RESULTS */
            <div id="search-results-list" className="space-y-2 max-h-[350px] lg:max-h-56 overflow-y-auto pr-1">
              {searchResults.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-[#999488]">Tidak ada hasil untuk "{searchQuery}"</p>
                </div>
              ) : (
                searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchResultClick(result)}
                    className="w-full text-left p-2.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-stone-900/20 hover:bg-[#E5E1D8]/40 dark:hover:bg-stone-900 transition-all text-xs flex flex-col gap-1 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate max-w-[130px]">
                        {result.chapter.title}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F4F1EA] dark:bg-stone-800 text-[#777266] dark:text-stone-400 font-mono capitalize">
                        {result.fieldName === 'chapter_title' ? 'Judul Bab' : result.fieldName === 'arabic' ? 'Arab' : result.fieldName === 'translation' ? 'Terjemah' : 'Syarah'}
                      </span>
                    </div>
                    
                    <p 
                      className="text-[11px] text-[#777266] dark:text-[#A8A890] line-clamp-2 leading-relaxed" 
                      dir={result.fieldName === 'arabic' ? 'rtl' : 'ltr'}
                    >
                      {result.snippet.before}
                      <mark className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-100 font-bold px-0.5 rounded">
                        {result.snippet.match}
                      </mark>
                      {result.snippet.after}
                    </p>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* ORIGINAL CHAPTER LIST */
            <div id="chapters-directory-list" className="space-y-1.5 max-h-[350px] lg:max-h-56 overflow-y-auto pr-1">
              {isTreeStyle ? (
                <div className="space-y-1.5">
                  {treeNodes.map(function renderNode(node: TreeNode) {
                    const ch = node.chapter;
                    const isActive = ch.id === activeChapter.id;
                    const hasChBookmark = bookmarks.some(b => b.kitabId === activeKitab.id && b.chapterId === ch.id);
                    const hasChildren = node.children.length > 0;
                    const isCollapsed = collapsedChapters[ch.id];

                    return (
                      <div key={ch.id} className="space-y-1">
                        <div 
                          className="flex items-center gap-1 w-full"
                          style={{ paddingLeft: `${node.depth * 12}px` }}
                        >
                          {hasChildren ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollapsedChapters(prev => ({
                                  ...prev,
                                  [ch.id]: !prev[ch.id]
                                }));
                              }}
                              className="p-1 hover:bg-[#E5E1D8] dark:hover:bg-slate-800 rounded text-[#777266] dark:text-[#A8A890] transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <div className="w-5.5 flex-shrink-0" />
                          )}

                          <button
                            id={`chapter-item-${ch.id}`}
                            onClick={() => {
                              setActiveChapterId(ch.id);
                              setActiveParagraphId(null);
                              setActiveTab('text');
                            }}
                            className={`flex-1 text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#5A5A40] text-white font-semibold shadow-none'
                                : 'hover:bg-[#E5E1D8] dark:hover:bg-[#121210] text-[#777266] dark:text-[#A8A890]'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              <span className="text-[10px] text-stone-400 dark:text-[#999488] font-mono mr-1">
                                {ch.number}
                              </span>
                              <span>{ch.title}</span>
                            </span>
                            {hasChBookmark && (
                              <Bookmark className={`w-3 h-3 ml-2 flex-shrink-0 ${isActive ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'}`} />
                            )}
                          </button>
                        </div>

                        {hasChildren && !isCollapsed && (
                          <div className="space-y-1">
                            {node.children.map(renderNode)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                chapterGroups.map((group, gIdx) => {
                  const renderChapterBtn = (ch: Chapter, isSub: boolean) => {
                    const isActive = ch.id === activeChapter.id;
                    const hasChBookmark = bookmarks.some(b => b.kitabId === activeKitab.id && b.chapterId === ch.id);
                    const hasChildren = !isSub && group.children.length > 0;
                    const isCollapsed = collapsedChapters[ch.id];

                    return (
                      <div key={ch.id} className={isSub ? 'ml-4' : ''}>
                        <div className="flex items-center gap-1 w-full">
                          <button
                            id={`chapter-item-${ch.id}`}
                            onClick={() => {
                              setActiveChapterId(ch.id);
                              setActiveParagraphId(null);
                              setActiveTab('text');
                            }}
                            className={`flex-1 text-left px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#5A5A40] text-white font-semibold shadow-none'
                                : 'hover:bg-[#E5E1D8] dark:hover:bg-[#121210] text-[#777266] dark:text-[#A8A890]'
                            } ${isSub ? 'border-l-2 border-[#5A5A40]/30 rounded-l-none' : ''}`}
                          >
                            <span className="truncate">{ch.title}</span>
                            {hasChBookmark && (
                              <Bookmark className={`w-3.5 h-3.5 ml-2 flex-shrink-0 ${isActive ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'}`} />
                            )}
                          </button>
                          {hasChildren && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollapsedChapters(prev => ({
                                  ...prev,
                                  [ch.id]: !prev[ch.id]
                                }));
                              }}
                              className="p-1.5 hover:bg-[#E5E1D8] dark:hover:bg-[#121210] rounded text-[#777266] dark:text-[#A8A890] transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={group.parent ? group.parent.id : `group-${gIdx}`} className="space-y-1.5">
                      {group.parent && renderChapterBtn(group.parent, false)}
                      {(!group.parent || !collapsedChapters[group.parent.id]) && group.children.map(ch => renderChapterBtn(ch, true))}
                    </div>
                  );
                })
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* Public Discussion Board (Real-time live comments) */}
        <div className={activeTab === 'discussion' ? 'block' : 'hidden lg:block'}>
          <DiscussionPanel kitabId={activeKitab.id} chapterId={activeChapter?.id || ''} />
          
          {/* Helpful Instructions box under Discussion Panel for Desktop/Tablet */}
          <div className="hidden lg:block mt-6">
            <div id="instructions-box" className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none text-xs space-y-3.5 leading-relaxed text-[#333333] dark:text-[#E5E1D8]">
              <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm flex items-center gap-1.5 pb-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
                <Sparkles className="w-4 h-4 text-[#5A5A40]" /> Panduan Khazanah Digital
              </h4>
              <ul className="list-disc pl-4 space-y-2 text-[#777266] dark:text-[#A8A890]">
                <li>
                  <strong>Membaca Nyaman:</strong> Buka karya pilihan, klik ikon gerigi (<Settings className="w-3.5 h-3.5 inline text-[#5A5A40]" />) untuk menyesuaikan ukuran teks, spasi, dan latar belakang malam.
                </li>
                <li>
                  <strong>Sorotan & Catatan:</strong> Ketuk baris atau terjemahan saat membaca untuk menyoroti warna dan menulis ulasan pribadi Anda.
                </li>
                <li>
                  <strong>Pengingat Harian:</strong> Tentukan jadwal harian Anda pada menu <em>Target Harian</em> untuk melacak keaktifan harian Anda.
                </li>
                <li>
                  <strong>Diskusi Terbuka:</strong> Bertukar pendapat mengenai kandungan karya melalui papan komentar secara langsung.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
