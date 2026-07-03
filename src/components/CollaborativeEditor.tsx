import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { dbService } from '../lib/dbService';
import { 
  Kitab, Chapter, Paragraph, CollabDraft, CollabMergeRequest, 
  CollabHistory, CollabPresence, CollabComment, CollabRole, CollabDiff,
  TreeNode, buildTree, sortChaptersByTree, migrateChaptersToTree, recalculateHierarchicalNumbers
} from '../types';
import { 
  Users, GitBranch, GitPullRequest, History, MessageSquare, 
  ArrowLeft, Check, X, ChevronRight, Plus, Trash2, Maximize2, 
  Minimize2, Columns, Eye, BookOpen, Shield, Activity, Send, 
  Undo, Redo, RefreshCw, FileText, CheckCircle, AlertTriangle, 
  CornerDownRight, UserCheck, MessageCircle, Save, Info, GitMerge,
  Edit2, Sparkles, ChevronDown, FolderPlus, Layers, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RichTextEditor from './RichTextEditor';

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

interface DiffWord {
  type: 'added' | 'deleted' | 'equal';
  text: string;
}

function computeWordDiff(oldStr: string = '', newStr: string = ''): DiffWord[] {
  const cleanOld = (oldStr || '').trim();
  const cleanNew = (newStr || '').trim();
  if (!cleanOld && !cleanNew) return [];
  if (!cleanOld) {
    return cleanNew.split(/\s+/).filter(Boolean).map(w => ({ type: 'added', text: w }));
  }
  if (!cleanNew) {
    return cleanOld.split(/\s+/).filter(Boolean).map(w => ({ type: 'deleted', text: w }));
  }

  const oldWords = cleanOld.split(/\s+/).filter(Boolean);
  const newWords = cleanNew.split(/\s+/).filter(Boolean);

  const dp: number[][] = Array.from({ length: oldWords.length + 1 }, () =>
    Array(newWords.length + 1).fill(0)
  );

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffWord[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'equal', text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'deleted', text: oldWords[i - 1] });
      i--;
    }
  }

  return result;
}

function stripHtmlTags(str: string): string {
  if (!str) return '';
  // Remove HTML tags
  let clean = str.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Normalize spacing
  return clean.replace(/\s+/g, ' ').trim();
}

interface HighlightedDiffTextProps {
  oldText?: string;
  newText?: string;
  mode: 'old' | 'new';
  isArabic?: boolean;
}

const HighlightedDiffText: React.FC<HighlightedDiffTextProps> = ({ oldText = '', newText = '', mode, isArabic = false }) => {
  const cleanedOld = useMemo(() => stripHtmlTags(oldText), [oldText]);
  const cleanedNew = useMemo(() => stripHtmlTags(newText), [newText]);

  const diffs = useMemo(() => {
    return computeWordDiff(cleanedOld, cleanedNew);
  }, [cleanedOld, cleanedNew]);

  const elements: React.ReactNode[] = [];
  diffs.forEach((word, idx) => {
    if (mode === 'old') {
      if (word.type === 'added') return;
      if (word.type === 'deleted') {
        elements.push(
          <span 
            key={`del-${idx}`} 
            className="px-1 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 line-through rounded font-medium border-b border-red-300 dark:border-red-900 break-words"
          >
            {word.text}
          </span>
        );
      } else {
        elements.push(<span key={`eq-${idx}`} className="break-words">{word.text}</span>);
      }
    } else {
      if (word.type === 'deleted') return;
      if (word.type === 'added') {
        elements.push(
          <span 
            key={`add-${idx}`} 
            className="px-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold underline rounded decoration-emerald-500 decoration-2 border-b border-emerald-300 dark:border-emerald-900 break-words"
          >
            {word.text}
          </span>
        );
      } else {
        elements.push(<span key={`eq-${idx}`} className="break-words">{word.text}</span>);
      }
    }
    // Tambahkan spasi antar kata agar pembungkusan baris (word-wrap) berjalan alami di layar kecil
    elements.push(<span key={`sp-${idx}`} className="select-none"> </span>);
  });

  return (
    <div 
      className={`block w-full break-words whitespace-pre-wrap ${
        isArabic 
          ? 'text-right font-serif text-sm sm:text-base md:text-lg leading-loose' 
          : 'text-left text-[10px] sm:text-[11px] md:text-xs leading-relaxed'
      }`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {elements}
    </div>
  );
};

export default function CollaborativeEditor() {
  const { 
    customKitabs, 
    currentUserEmail, 
    currentUserName, 
    addToast, 
    preferences 
  } = useApp();

  // Mode & navigation states
  // 'dashboard' | 'kitab_hub' | 'editor' | 'mr_viewer' | 'history_viewer'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kitab_hub' | 'mr_list' | 'history_list'>('dashboard');
  
  // Selected Active Entities
  const [selectedKitab, setSelectedKitab] = useState<Kitab | null>(null);
  const [activeDraft, setActiveDraft] = useState<CollabDraft | null>(null);
  const [activeMR, setActiveMR] = useState<CollabMergeRequest | null>(null);

  // Metadata editing states (similar to KitabWriter)
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAuthor, setMetaAuthor] = useState('');
  const [metaCategory, setMetaCategory] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaIsPublic, setMetaIsPublic] = useState(true);

  const categoriesPreset = ['Hadits', 'Fiqih', 'Tafsir', 'Aqidah', 'Akhlak', 'Tasawuf', 'Sejarah', 'Bahasa Arab', 'Lainnya'];

  // Synchronize metadata inputs when selectedKitab is loaded or changed
  useEffect(() => {
    if (selectedKitab) {
      setMetaTitle(selectedKitab.title);
      setMetaAuthor(selectedKitab.author);
      setMetaCategory(selectedKitab.category);
      setMetaDescription(selectedKitab.description || '');
      setMetaIsPublic(selectedKitab.isPublic !== false);
    }
  }, [selectedKitab?.id]);

  const handleSaveMetadata = async () => {
    if (!selectedKitab) return;
    if (!metaTitle.trim() || !metaAuthor.trim() || !metaDescription.trim()) {
      addToast('Data Belum Lengkap', 'Judul, penulis, dan ringkasan kitab wajib diisi.', 'warning');
      return;
    }

    const updatedKitab: Kitab = {
      ...selectedKitab,
      title: metaTitle.trim(),
      author: metaAuthor.trim(),
      category: metaCategory,
      description: metaDescription.trim(),
      isPublic: metaIsPublic
    };

    try {
      await dbService.saveCustomKitab(selectedKitab.createdBy, updatedKitab);
      setSelectedKitab(updatedKitab);
      setIsEditingMetadata(false);
      addToast('Metadata Diperbarui', 'Metadata naskah kitab induk berhasil diperbarui.', 'success');
    } catch (e) {
      addToast('Error', 'Gagal memperbarui metadata kitab.', 'warning');
    }
  };

  // Determine the maximum authorized role for the current user
  const maxRole = useMemo<CollabRole>(() => {
    if (!selectedKitab) return 'admin';
    
    // Guest (non-logged-in user) only gets reader access
    if (!currentUserEmail) {
      return 'reader';
    }

    if (selectedKitab.createdBy?.toLowerCase() === currentUserEmail.toLowerCase()) return 'admin';
    
    const collabList = selectedKitab.collaborators || [];
    const assigned = collabList.find(c => c.email.toLowerCase() === currentUserEmail?.toLowerCase());
    
    if (assigned) {
      return assigned.role;
    }
    
    // Registered / Logged-in users default to Contributor
    return 'contributor';
  }, [selectedKitab, currentUserEmail]);

  // RBAC Role Selection (for testing & full flexibility within authorized limits)
  const [myRole, setMyRole] = useState<CollabRole>('reader');

  // Synchronize active role when maxRole changes
  useEffect(() => {
    setMyRole(maxRole);
  }, [maxRole]);

  // Synchronize selectedKitab with latest customKitabs from context in real-time
  useEffect(() => {
    if (selectedKitab) {
      const latest = customKitabs.find(k => k.id === selectedKitab.id);
      if (latest) {
        setSelectedKitab(latest);
      }
    }
  }, [customKitabs, selectedKitab?.id]);

  const getRolePriority = (role: CollabRole): number => {
    switch (role) {
      case 'admin': return 4;
      case 'reviewer': return 3;
      case 'contributor': return 2;
      case 'editor': return 2;
      case 'reader': return 1;
      default: return 0;
    }
  };

  // Collaborator Management Actions (Only for owners)
  const handleAddCollaborator = async (email: string, role: CollabRole) => {
    if (!selectedKitab) return;
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;

    if (targetEmail === selectedKitab.createdBy.toLowerCase()) {
      addToast('Pemilik Kitab', 'Pemilik kitab secara otomatis adalah Admin utama.', 'warning');
      return;
    }

    const existingCollabs = selectedKitab.collaborators || [];
    if (existingCollabs.some(c => c.email.toLowerCase() === targetEmail)) {
      addToast('Sudah Terdaftar', 'Email tersebut sudah menjadi kolaborator.', 'warning');
      return;
    }

    const updatedCollabs = [...existingCollabs, { email: targetEmail, role }];
    const updatedKitab: Kitab = {
      ...selectedKitab,
      collaborators: updatedCollabs
    };

    try {
      await dbService.saveCustomKitab(currentUserEmail, updatedKitab);
      setSelectedKitab(updatedKitab);
      addToast('Kolaborator Ditambahkan', `Kolaborator ${targetEmail} berhasil didaftarkan sebagai ${role.toUpperCase()}.`, 'success');
    } catch (e) {
      addToast('Error', 'Gagal menambahkan kolaborator.', 'warning');
    }
  };

  const handleUpdateCollaboratorRole = async (email: string, role: CollabRole) => {
    if (!selectedKitab) return;
    const targetEmail = email.trim().toLowerCase();

    const existingCollabs = selectedKitab.collaborators || [];
    const updatedCollabs = existingCollabs.map(c => 
      c.email.toLowerCase() === targetEmail ? { ...c, role } : c
    );

    const updatedKitab: Kitab = {
      ...selectedKitab,
      collaborators: updatedCollabs
    };

    try {
      await dbService.saveCustomKitab(currentUserEmail, updatedKitab);
      setSelectedKitab(updatedKitab);
      addToast('Hak Akses Diperbarui', `Hak akses ${targetEmail} diubah menjadi ${role.toUpperCase()}.`, 'success');
    } catch (e) {
      addToast('Error', 'Gagal memperbarui hak akses.', 'warning');
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!selectedKitab) return;
    const targetEmail = email.trim().toLowerCase();

    const existingCollabs = selectedKitab.collaborators || [];
    const updatedCollabs = existingCollabs.filter(c => c.email.toLowerCase() !== targetEmail);

    const updatedKitab: Kitab = {
      ...selectedKitab,
      collaborators: updatedCollabs
    };

    try {
      await dbService.saveCustomKitab(currentUserEmail, updatedKitab);
      setSelectedKitab(updatedKitab);
      addToast('Kolaborator Dihapus', `Akses kolaborator ${targetEmail} berhasil dicabut.`, 'info');
    } catch (e) {
      addToast('Error', 'Gagal mencabut hak akses kolaborator.', 'warning');
    }
  };

  // Firestore Real-time Collections States
  const [allDrafts, setAllDrafts] = useState<CollabDraft[]>([]);
  const [allMRs, setAllMRs] = useState<CollabMergeRequest[]>([]);
  const [presenceList, setPresenceList] = useState<CollabPresence[]>([]);
  const [collabComments, setCollabComments] = useState<CollabComment[]>([]);
  const [collabHistory, setCollabHistory] = useState<CollabHistory[]>([]);

  // Editor specific states
  const [editorChapters, setEditorChapters] = useState<Chapter[]>([]);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [activePageNumber, setActivePageNumber] = useState<number>(1);
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [customNodes, setCustomNodes] = useState<Record<string, boolean>>({});
  const [toggledFields, setToggledFields] = useState<Record<string, { trans: boolean; expl: boolean }>>({});
  const [arabicExplanations, setArabicExplanations] = useState<Record<string, boolean>>({});
  const [mainLtrFields, setMainLtrFields] = useState<Record<string, boolean>>({});
  const [transRtlFields, setTransRtlFields] = useState<Record<string, boolean>>({});
  
  const handleToggleField = (pId: string, field: 'trans' | 'expl') => {
    setToggledFields(prev => {
      const curr = prev[pId] || { trans: false, expl: false };
      return {
        ...prev,
        [pId]: {
          ...curr,
          [field]: !curr[field]
        }
      };
    });
  };

  const isContributorEnabled = true; // contributor has writer privileges
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [splitView, setSplitView] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [isEditingChapterTitle, setIsEditingChapterTitle] = useState(false);
  const [tempChapterTitle, setTempChapterTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Undo/Redo stack for the current chapter paragraph edits
  const [historyStack, setHistoryStack] = useState<Chapter[][]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

  // Threaded Comments state inside MR or Editor
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [commentReplyText, setCommentReplyText] = useState('');

  // Creation dialogs
  const [showCreateDraftModal, setShowCreateDraftModal] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  
  const [showCreateMRModal, setShowCreateMRModal] = useState(false);
  const [mrTitle, setMrTitle] = useState('');
  const [mrDescription, setMrDescription] = useState('');

  // States for custom reviewer review modal (avoiding browser prompt iframe blockage)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewActionType, setReviewActionType] = useState<'approve' | 'reject' | 'changes' | null>(null);
  const [reviewFeedbackInput, setReviewFeedbackInput] = useState('');

  // Filter & Search inside collaboration
  const [collabSearch, setCollabSearch] = useState('');

  // Custom non-blocking confirmation dialog (avoiding browser alert/confirm iframe blockage)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Yakin',
    cancelText: 'Batal',
    onConfirm: () => {}
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Yakin',
    cancelText = 'Batal'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTIONS
  // ----------------------------------------------------
  useEffect(() => {
    if (!currentUserEmail) return;

    // 1. Subscribe to drafts
    const unsubDrafts = dbService.subscribeCollabDrafts((drafts) => {
      setAllDrafts(drafts);
    });

    // 2. Subscribe to Merge Requests
    const unsubMRs = dbService.subscribeMergeRequests((mrs) => {
      setAllMRs(mrs);
    });

    return () => {
      unsubDrafts();
      unsubMRs();
    };
  }, [currentUserEmail]);

  // Subscribe to details when a kitab is selected
  useEffect(() => {
    if (!selectedKitab) return;

    // 1. Subscribe to Presence
    const unsubPresence = dbService.subscribeCollabPresence(selectedKitab.id, (presences) => {
      setPresenceList(presences);
    });

    // 2. Subscribe to Comments
    const unsubCollabComments = dbService.subscribeCollabComments(selectedKitab.id, (comments) => {
      setCollabComments(comments);
    });

    // 3. Subscribe to History
    const unsubCollabHistory = dbService.subscribeCollabHistory(selectedKitab.id, (history) => {
      setCollabHistory(history);
    });

    return () => {
      unsubPresence();
      unsubCollabComments();
      unsubCollabHistory();
    };
  }, [selectedKitab]);

  // ----------------------------------------------------
  // REAL-TIME PRESENCE TICKER
  // ----------------------------------------------------
  useEffect(() => {
    if (!currentUserEmail || !selectedKitab) return;

    // Heartbeat ticker to update presence in cloud every 15 seconds
    const updateMyPresence = () => {
      const presence: CollabPresence = {
        id: currentUserEmail,
        userEmail: currentUserEmail,
        userName: currentUserName || 'Kolaborator',
        activeKitabId: selectedKitab.id,
        activeDraftId: activeDraft?.id || undefined,
        editingParagraphId: editingParagraphId || undefined,
        lastActive: new Date().toISOString()
      };
      dbService.updateCollabPresence(presence);
    };

    updateMyPresence();
    const interval = setInterval(updateMyPresence, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [currentUserEmail, selectedKitab, activeDraft, editingParagraphId, currentUserName]);

  // Keyboard Shortcuts for Editor (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDraft) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDraft, historyStack, historyPointer]);

  // Page tracking & memoization
  const activeChapterParagraphs = useMemo(() => {
    return editorChapters[activeChapterIdx]?.paragraphs || [];
  }, [editorChapters, activeChapterIdx]);

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
  }, [activeChapterIdx, uniquePages, activePageNumber]);

  // ----------------------------------------------------
  // STATISTICS & METRICS
  // ----------------------------------------------------
  const stats = useMemo(() => {
    return {
      totalKitabs: customKitabs.length,
      totalDrafts: allDrafts.length,
      myDrafts: allDrafts.filter(d => d.authorEmail === currentUserEmail).length,
      openMRs: allMRs.filter(m => m.status === 'open' || m.status === 'review').length,
      mergedMRs: allMRs.filter(m => m.status === 'merged').length,
      contributors: Array.from(new Set([
        ...allDrafts.map(d => d.authorEmail),
        ...allMRs.map(m => m.authorEmail)
      ])).filter(Boolean).length,
      totalHistory: collabHistory.length
    };
  }, [customKitabs, allDrafts, allMRs, currentUserEmail, collabHistory]);

  // ----------------------------------------------------
  // DRAFT LOGIC
  // ----------------------------------------------------
  const handleCreateDraft = async () => {
    if (!selectedKitab || !newDraftTitle.trim()) return;

    const draftId = `draft_${Date.now()}`;
    const newDraft: CollabDraft = {
      id: draftId,
      kitabId: selectedKitab.id,
      kitabTitle: selectedKitab.title,
      title: newDraftTitle.trim(),
      authorEmail: currentUserEmail,
      authorName: currentUserName || 'Kolaborator',
      chapters: JSON.parse(JSON.stringify(selectedKitab.chapters)), // deep copy
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'open'
    };

    try {
      await dbService.saveCollabDraft(newDraft);
      setActiveDraft(newDraft);
      setEditorChapters(newDraft.chapters);
      setHistoryStack([JSON.parse(JSON.stringify(newDraft.chapters))]);
      setHistoryPointer(0);
      setActiveChapterIdx(0);
      setShowCreateDraftModal(false);
      setNewDraftTitle('');
      addToast('Draft Dibuat', `Draft "${newDraft.title}" berhasil diinisialisasi.`, 'success');
    } catch (e) {
      addToast('Error', 'Gagal membuat draft kolaborasi.', 'warning');
    }
  };

  // Auto-save debounced implementation
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const saveDraftToCloud = (updatedChapters: Chapter[]) => {
    if (!activeDraft) return;

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedDraft: CollabDraft = {
          ...activeDraft,
          chapters: updatedChapters,
          updatedAt: new Date().toISOString()
        };
        await dbService.saveCollabDraft(updatedDraft);
        setActiveDraft(updatedDraft);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1500);
  };

  // ----------------------------------------------------
  // UNDO / REDO
  // ----------------------------------------------------
  const pushToUndoStack = (newChapters: Chapter[]) => {
    const freshCopy = JSON.parse(JSON.stringify(newChapters));
    const nextStack = historyStack.slice(0, historyPointer + 1);
    nextStack.push(freshCopy);
    setHistoryStack(nextStack);
    setHistoryPointer(nextStack.length - 1);
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      const prevPointer = historyPointer - 1;
      const prevChapters = JSON.parse(JSON.stringify(historyStack[prevPointer]));
      setHistoryPointer(prevPointer);
      setEditorChapters(prevChapters);
      saveDraftToCloud(prevChapters);
      addToast('Undo', 'Perubahan dibatalkan.', 'info');
    }
  };

  const handleRedo = () => {
    if (historyPointer < historyStack.length - 1) {
      const nextPointer = historyPointer + 1;
      const nextChapters = JSON.parse(JSON.stringify(historyStack[nextPointer]));
      setHistoryPointer(nextPointer);
      setEditorChapters(nextChapters);
      saveDraftToCloud(nextChapters);
      addToast('Redo', 'Perubahan diterapkan kembali.', 'info');
    }
  };

  // ----------------------------------------------------
  // EDITOR INTERACTIONS
  // ----------------------------------------------------
  const updateParagraphFieldById = (pId: string, field: keyof Paragraph, value: any) => {
    if (!activeDraft) return;

    const newChapters = [...editorChapters];
    const ch = newChapters[activeChapterIdx];
    if (!ch) return;

    ch.paragraphs = ch.paragraphs.map(p => {
      if (p.id === pId) {
        return { ...p, [field]: value };
      }
      return p;
    });

    setEditorChapters(newChapters);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
  };

  const addChapter = () => {
    if (!activeDraft) return;

    const roots = editorChapters.filter(c => !c.parentId);
    const chNum = roots.length + 1;
    let lastPage = 1;
    let maxPage = 0;
    editorChapters.forEach(ch => {
      ch.paragraphs?.forEach(p => {
        const pVal = typeof p.page === 'number' ? p.page : parseInt(p.page as any) || 1;
        if (pVal > maxPage) maxPage = pVal;
      });
    });
    if (maxPage > 0) lastPage = maxPage + 1;

    const newCh: Chapter = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: `Node Utama Baru #${chNum}`,
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
    const finalChapters = recalculateHierarchicalNumbers([...editorChapters, newCh]);
    setEditorChapters(finalChapters);
    const newActiveIdx = finalChapters.findIndex(c => c.id === newCh.id);
    setActiveChapterIdx(newActiveIdx >= 0 ? newActiveIdx : finalChapters.length - 1);
    setActivePageNumber(lastPage);
    pushToUndoStack(finalChapters);
    saveDraftToCloud(finalChapters);
    addToast('Bab Ditambahkan', 'Bab baru berhasil ditambahkan.', 'success');
  };

  const addSubChapter = () => {
    if (!activeDraft) return;
    const activeCh = editorChapters[activeChapterIdx];
    if (!activeCh) return;

    const siblings = editorChapters.filter(c => c.parentId === activeCh.id);
    const subNum = siblings.length + 1;
    const chNum = `${activeCh.number}.${subNum}`;

    let lastPage = 1;
    let maxPage = 0;
    editorChapters.forEach(ch => {
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

    const finalChapters = recalculateHierarchicalNumbers([...editorChapters, newCh]);
    setEditorChapters(finalChapters);
    const newActiveIdx = finalChapters.findIndex(c => c.id === newCh.id);
    setActiveChapterIdx(newActiveIdx >= 0 ? newActiveIdx : finalChapters.length - 1);
    setActivePageNumber(lastPage);
    pushToUndoStack(finalChapters);
    saveDraftToCloud(finalChapters);
    addToast('Sub-Bab Ditambahkan', 'Sub-Bab baru berhasil ditambahkan.', 'success');
  };

  const deleteChapter = (idx: number) => {
    if (!activeDraft) return;
    if (editorChapters.length <= 1) {
      addToast('Gagal Menghapus', 'Harus ada setidaknya satu Bab di dalam kitab.', 'warning');
      return;
    }

    const chToDelete = editorChapters[idx];
    if (!chToDelete) return;

    // Find descendants recursively
    const idsToDelete = new Set<string>([chToDelete.id]);
    let checkMore = true;
    while (checkMore) {
      const startSize = idsToDelete.size;
      editorChapters.forEach(ch => {
        if (ch.parentId && idsToDelete.has(ch.parentId)) {
          idsToDelete.add(ch.id);
        }
      });
      if (idsToDelete.size === startSize) {
        checkMore = false;
      }
    }

    const filtered = editorChapters.filter(ch => !idsToDelete.has(ch.id));
    if (filtered.length === 0) {
      addToast('Gagal Menghapus', 'Harus ada setidaknya satu Bab di dalam kitab.', 'warning');
      return;
    }
    const finalChapters = recalculateHierarchicalNumbers(filtered);

    setEditorChapters(finalChapters);
    setActiveChapterIdx(0);
    setActivePageNumber(1);
    pushToUndoStack(finalChapters);
    saveDraftToCloud(finalChapters);
    addToast('Bab Dihapus', 'Bab dan seluruh sub-bab di bawahnya berhasil dihapus.', 'info');
  };

  const indentChapter = (id: string) => {
    const ch = editorChapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = editorChapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx > 0) {
      const prevSibling = siblings[idx - 1];
      const updated = editorChapters.map(c => {
        if (c.id === id) {
          return { ...c, parentId: prevSibling.id };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setEditorChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIdx(activeIdx);
      pushToUndoStack(sorted);
      saveDraftToCloud(sorted);
    }
  };

  const outdentChapter = (id: string) => {
    const ch = editorChapters.find(c => c.id === id);
    if (!ch || !ch.parentId) return;
    const parentNode = editorChapters.find(c => c.id === ch.parentId);
    const newParentId = parentNode ? parentNode.parentId : undefined;
    const updated = editorChapters.map(c => {
      if (c.id === id) {
        return { ...c, parentId: newParentId };
      }
      return c;
    });
    const sorted = recalculateHierarchicalNumbers(updated);
    setEditorChapters(sorted);
    const activeIdx = sorted.findIndex(c => c.id === id);
    if (activeIdx >= 0) setActiveChapterIdx(activeIdx);
    pushToUndoStack(sorted);
    saveDraftToCloud(sorted);
  };

  const moveChapterUp = (id: string) => {
    const ch = editorChapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = editorChapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx > 0) {
      const prevSibling = siblings[idx - 1];
      const updated = editorChapters.map(c => {
        if (c.id === id) {
          return { ...c, number: prevSibling.number };
        }
        if (c.id === prevSibling.id) {
          return { ...c, number: ch.number };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setEditorChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIdx(activeIdx);
      pushToUndoStack(sorted);
      saveDraftToCloud(sorted);
    }
  };

  const moveChapterDown = (id: string) => {
    const ch = editorChapters.find(c => c.id === id);
    if (!ch) return;
    const siblings = editorChapters.filter(c => c.parentId === ch.parentId);
    const idx = siblings.findIndex(c => c.id === id);
    if (idx < siblings.length - 1) {
      const nextSibling = siblings[idx + 1];
      const updated = editorChapters.map(c => {
        if (c.id === id) {
          return { ...c, number: nextSibling.number };
        }
        if (c.id === nextSibling.id) {
          return { ...c, number: ch.number };
        }
        return c;
      });
      const sorted = recalculateHierarchicalNumbers(updated);
      setEditorChapters(sorted);
      const activeIdx = sorted.findIndex(c => c.id === id);
      if (activeIdx >= 0) setActiveChapterIdx(activeIdx);
      pushToUndoStack(sorted);
      saveDraftToCloud(sorted);
    }
  };

  const updateChapterParent = (id: string, newParentId: string | undefined) => {
    if (newParentId === id) return;
    const isDescendant = (targetId: string, potentialParentId: string): boolean => {
      let curr = targetId;
      while (curr) {
        const checkCh = editorChapters.find(c => c.id === curr);
        if (!checkCh) break;
        if (checkCh.parentId === potentialParentId) return true;
        curr = checkCh.parentId || '';
      }
      return false;
    };
    if (newParentId && isDescendant(newParentId, id)) return;

    const updated = editorChapters.map(c => {
      if (c.id === id) {
        return { ...c, parentId: newParentId };
      }
      return c;
    });
    const sorted = recalculateHierarchicalNumbers(updated);
    setEditorChapters(sorted);
    const activeIdx = sorted.findIndex(c => c.id === id);
    if (activeIdx >= 0) setActiveChapterIdx(activeIdx);
    pushToUndoStack(sorted);
    saveDraftToCloud(sorted);
  };

  const updateNodeType = (id: string, newType: string) => {
    const updated = editorChapters.map(c => {
      if (c.id === id) {
        return { ...c, nodeType: newType };
      }
      return c;
    });
    setEditorChapters(updated);
    pushToUndoStack(updated);
    saveDraftToCloud(updated);
  };

  const editChapterTitle = (idx: number, newTitle: string) => {
    if (!activeDraft) return;

    const newChapters = [...editorChapters];
    newChapters[idx] = {
      ...newChapters[idx],
      title: newTitle
    };

    setEditorChapters(newChapters);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
  };

  const toggleSubChapter = (idx: number) => {
    if (!activeDraft) return;

    const ch = editorChapters[idx];
    if (!ch) return;

    const updated = editorChapters.map((c, i) => {
      if (i === idx) {
        // Toggle: if it has parentId, remove it. If not, set parentId to the preceding root node if possible
        if (c.parentId) {
          return { ...c, parentId: undefined };
        } else {
          // Find preceding root node
          let precedingRoot: Chapter | undefined;
          for (let k = idx - 1; k >= 0; k--) {
            if (!editorChapters[k].parentId) {
              precedingRoot = editorChapters[k];
              break;
            }
          }
          return { ...c, parentId: precedingRoot?.id };
        }
      }
      return c;
    });

    const finalChapters = recalculateHierarchicalNumbers(updated);
    setEditorChapters(finalChapters);
    pushToUndoStack(finalChapters);
    saveDraftToCloud(finalChapters);
    addToast('Struktur Diubah', 'Struktur bab berhasil disesuaikan.', 'info');
  };

  const addPageToActiveChapter = () => {
    if (!activeDraft) return;

    const nextPageNum = Math.max(...uniquePages, 0) + 1;
    const pId = `p_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newParagraph: Paragraph = {
      id: pId,
      arabic: '',
      translation: '',
      explanation: '',
      page: nextPageNum
    };

    const newChapters = editorChapters.map((ch, idx) => {
      // Shift page numbers of any paragraph that is equal to or greater than nextPageNum
      const updatedParagraphs = ch.paragraphs.map(p => {
        const pageVal = (p.page || 1) as number;
        if (pageVal >= nextPageNum) {
          return { ...p, page: pageVal + 1 };
        }
        return p;
      });

      if (idx === activeChapterIdx) {
        return {
          ...ch,
          paragraphs: [...updatedParagraphs, newParagraph]
        };
      }
      return {
        ...ch,
        paragraphs: updatedParagraphs
      };
    });

    setEditorChapters(newChapters);
    setActivePageNumber(nextPageNum);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
    addToast('Halaman Baru', `Halaman ${nextPageNum} ditambahkan.`, 'success');
  };

  const removePageFromActiveChapter = (pageToRemove: number) => {
    if (!activeDraft) return;

    const activeChapter = editorChapters[activeChapterIdx];
    if (!activeChapter) return;
    const currentParagraphs = activeChapter.paragraphs;
    
    const otherPages = new Set(currentParagraphs.map(p => p.page || 1));
    otherPages.delete(pageToRemove);
    if (otherPages.size === 0) {
      addToast('Hapus Gagal', 'Harus ada setidaknya satu halaman di dalam Bab.', 'warning');
      return;
    }

    const filtered = currentParagraphs.filter(p => (p.page || 1) !== pageToRemove);

    const newChapters = [...editorChapters];
    newChapters[activeChapterIdx] = {
      ...newChapters[activeChapterIdx],
      paragraphs: filtered
    };

    setEditorChapters(newChapters);
    const remainingPagesList = Array.from(otherPages).sort((a: any, b: any) => a - b);
    setActivePageNumber(remainingPagesList[0] || 1);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
    addToast('Halaman Dihapus', `Halaman ${pageToRemove} telah berhasil dihapus.`, 'success');
  };

  const addParagraph = () => {
    if (!activeDraft) return;

    const pId = `p_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newParagraph: Paragraph = {
      id: pId,
      arabic: '',
      translation: '',
      explanation: '',
      page: activePageNumber
    };

    const newChapters = [...editorChapters];
    newChapters[activeChapterIdx] = {
      ...newChapters[activeChapterIdx],
      paragraphs: [...newChapters[activeChapterIdx].paragraphs, newParagraph]
    };

    setEditorChapters(newChapters);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
    addToast('Paragraf Baru', 'Paragraf baru ditambahkan pada halaman aktif.', 'info');
  };

  const deleteParagraph = (pId: string) => {
    if (!activeDraft) return;

    const activeChapter = editorChapters[activeChapterIdx];
    if (!activeChapter) return;
    const currentParagraphs = activeChapter.paragraphs;

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
    const newChapters = [...editorChapters];
    newChapters[activeChapterIdx] = {
      ...newChapters[activeChapterIdx],
      paragraphs: filtered
    };

    setEditorChapters(newChapters);
    pushToUndoStack(newChapters);
    saveDraftToCloud(newChapters);
    addToast('Paragraf Dihapus', 'Paragraf berhasil dihapus.', 'info');
  };

  // ----------------------------------------------------
  // MERGE REQUESTS (PULL REQUESTS)
  // ----------------------------------------------------
  const handleCreateMR = async () => {
    if (!activeDraft || !selectedKitab || !mrTitle.trim()) return;

    // Compute diffs
    const diffs: CollabDiff[] = [];
    const mainKitab = selectedKitab;
    const draftChapters = activeDraft.chapters;

    draftChapters.forEach(draftCh => {
      const mainCh = mainKitab.chapters.find(c => c.id === draftCh.id);
      if (!mainCh) {
        // Entire chapter added
        draftCh.paragraphs.forEach(p => {
          diffs.push({
            type: 'added',
            chapterId: draftCh.id,
            chapterTitle: draftCh.title,
            paragraphId: p.id,
            newArabic: p.arabic,
            newTranslation: p.translation
          });
        });
      } else {
        // Compare paragraphs
        draftCh.paragraphs.forEach(p => {
          const mainP = mainCh.paragraphs.find(x => x.id === p.id);
          if (!mainP) {
            diffs.push({
              type: 'added',
              chapterId: draftCh.id,
              chapterTitle: draftCh.title,
              paragraphId: p.id,
              newArabic: p.arabic,
              newTranslation: p.translation
            });
          } else if (mainP.arabic !== p.arabic || mainP.translation !== p.translation) {
            diffs.push({
              type: 'modified',
              chapterId: draftCh.id,
              chapterTitle: draftCh.title,
              paragraphId: p.id,
              oldArabic: mainP.arabic,
              newArabic: p.arabic,
              oldTranslation: mainP.translation,
              newTranslation: p.translation
            });
          }
        });

        // Check for deleted paragraphs
        mainCh.paragraphs.forEach(mainP => {
          const draftP = draftCh.paragraphs.find(x => x.id === mainP.id);
          if (!draftP) {
            diffs.push({
              type: 'deleted',
              chapterId: draftCh.id,
              chapterTitle: draftCh.title,
              paragraphId: mainP.id,
              oldArabic: mainP.arabic,
              oldTranslation: mainP.translation
            });
          }
        });
      }
    });

    const mrId = `mr_${Date.now()}`;
    const newMR: CollabMergeRequest = {
      id: mrId,
      draftId: activeDraft.id,
      kitabId: selectedKitab.id,
      kitabTitle: selectedKitab.title,
      title: mrTitle.trim(),
      description: mrDescription.trim(),
      authorEmail: currentUserEmail,
      authorName: currentUserName || 'Kolaborator',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      diffs
    };

    try {
      await dbService.saveMergeRequest(newMR);
      setShowCreateMRModal(false);
      setMrTitle('');
      setMrDescription('');
      setActiveMR(newMR);
      setActiveTab('mr_list');
      addToast('Usulan Tashih Diajukan', `Usulan Tashih "${newMR.title}" telah dikirim ke pemeriksa.`, 'success');
    } catch (e) {
      addToast('Gagal', 'Gagal mengajukan usulan tashih.', 'warning');
    }
  };

  const triggerReviewAction = (action: 'approve' | 'reject' | 'changes') => {
    setReviewActionType(action);
    setReviewFeedbackInput('');
    setShowReviewModal(true);
  };

  const handleConfirmReview = async () => {
    if (!activeMR || !selectedKitab || !reviewActionType) return;

    const feedback = reviewFeedbackInput.trim();
    const action = reviewActionType;
    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'review';

    const updatedMR: CollabMergeRequest = {
      ...activeMR,
      status: newStatus as any,
      reviewerEmail: currentUserEmail,
      reviewerName: currentUserName || 'Reviewer',
      reviewFeedback: feedback || undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      await dbService.saveMergeRequest(updatedMR);
      setActiveMR(updatedMR);
      
      // Auto-save threaded notification comment
      const systemComment: CollabComment = {
        id: `com_sys_${Date.now()}`,
        mrId: activeMR.id,
        kitabId: selectedKitab.id,
        authorEmail: 'system@khazanahdigital.org',
        authorName: 'Sistem Tashih',
        content: `**Mushahhih (${currentUserName})** menandai usulan sebagai **${action.toUpperCase()}**.\n\n*Catatan:* ${feedback || 'Tidak ada catatan tambahan.'}`,
        createdAt: new Date().toISOString()
      };
      await dbService.saveCollabComment(systemComment);

      addToast('Ulasan Dikirim', `Status usulan tashih berhasil diperbarui ke ${newStatus.toUpperCase()}.`, 'success');
      setShowReviewModal(false);
      setReviewActionType(null);
      setReviewFeedbackInput('');
    } catch (e) {
      addToast('Gagal', 'Gagal memproses ulasan tashih.', 'warning');
    }
  };

  const handleMergeToMain = async () => {
    if (!activeMR || !selectedKitab) return;

    const draft = allDrafts.find(d => d.id === activeMR.draftId);
    if (!draft) {
      addToast('Gagal', 'Draft rancangan asal tidak ditemukan untuk digabungkan.', 'warning');
      return;
    }

    try {
      // Create rollback checkpoint
      const historyId = `hist_${Date.now()}`;
      const commitMessage = `Penyatuan Usulan #${activeMR.id.substr(3, 4)}: ${activeMR.title}`;
      
      const collabHist: CollabHistory = {
        id: historyId,
        kitabId: selectedKitab.id,
        kitabTitle: selectedKitab.title,
        userEmail: activeMR.authorEmail,
        userName: activeMR.authorName,
        message: commitMessage,
        timestamp: new Date().toISOString(),
        previousChapters: JSON.parse(JSON.stringify(selectedKitab.chapters)),
        mergedChapters: JSON.parse(JSON.stringify(draft.chapters))
      };

      // 1. Save history commit
      await dbService.saveCollabHistory(collabHist);

      // 2. Update Custom Kitab Main Branch
      await dbService.updateCustomKitabChapters(selectedKitab.id, draft.chapters);

      // 3. Mark Merge Request as MERGED
      const updatedMR: CollabMergeRequest = {
        ...activeMR,
        status: 'merged',
        updatedAt: new Date().toISOString()
      };
      await dbService.saveMergeRequest(updatedMR);
      setActiveMR(updatedMR);

      // 4. Mark Draft as MERGED
      const updatedDraft: CollabDraft = {
        ...draft,
        status: 'merged',
        updatedAt: new Date().toISOString()
      };
      await dbService.saveCollabDraft(updatedDraft);

      addToast('Penggabungan Berhasil!', 'Draft telah resmi dipublikasikan ke naskah utama (Main Branch)!', 'success');
    } catch (e) {
      addToast('Error', 'Gagal melakukan penggabungan ke naskah utama.', 'warning');
    }
  };

  // ----------------------------------------------------
  // ROLLBACK IMPLEMENTATION
  // ----------------------------------------------------
  const handleRollback = (history: CollabHistory) => {
    if (!selectedKitab) return;
    
    if (myRole !== 'admin') {
      addToast('Akses Ditolak', 'Hanya Mudir (Administrator) yang dapat melakukan rollback.', 'warning');
      return;
    }

    triggerConfirm(
      'Konfirmasi Rollback',
      `Apakah Anda yakin ingin mengembalikan karya tulis "${selectedKitab.title}" ke versi sebelum commit "${history.message}"?`,
      async () => {
        try {
          const targetChapters = history.previousChapters;
          if (!targetChapters || targetChapters.length === 0) {
            addToast('Gagal', 'Data bab versi sebelumnya tidak ditemukan.', 'warning');
            return;
          }

          // 1. Apply old chapters back to Main Custom Kitab
          await dbService.updateCustomKitabChapters(selectedKitab.id, targetChapters);

          // 2. Append new rollback commit to history
          const rollbackHistId = `hist_rb_${Date.now()}`;
          const rollbackHist: CollabHistory = {
            id: rollbackHistId,
            kitabId: selectedKitab.id,
            kitabTitle: selectedKitab.title,
            userEmail: currentUserEmail,
            userName: currentUserName || 'Admin',
            message: `🔄 ROLLBACK: Mengembalikan perubahan dari "${history.message}"`,
            timestamp: new Date().toISOString(),
            previousChapters: JSON.parse(JSON.stringify(selectedKitab.chapters)),
            mergedChapters: JSON.parse(JSON.stringify(targetChapters))
          };

          await dbService.saveCollabHistory(rollbackHist);

          // 3. Update local selectedKitab state instantly
          const updatedKitab = {
            ...selectedKitab,
            chapters: JSON.parse(JSON.stringify(targetChapters))
          };
          setSelectedKitab(updatedKitab);

          // 4. Synchronize current editor with rolled-back state
          setEditorChapters(targetChapters);
          pushToUndoStack(targetChapters);

          // 5. If we are currently editing an active draft, sync the activeDraft chapters & database too!
          if (activeDraft) {
            const updatedDraft: CollabDraft = {
              ...activeDraft,
              chapters: JSON.parse(JSON.stringify(targetChapters)),
              updatedAt: new Date().toISOString()
            };
            await dbService.saveCollabDraft(updatedDraft);
            setActiveDraft(updatedDraft);
          }

          setActivePageNumber(1);
          addToast('Rollback Berhasil', 'Karya berhasil dikembalikan ke versi sebelumnya.', 'success');
        } catch (e) {
          addToast('Error', 'Gagal melakukan rollback.', 'warning');
        }
      },
      'Restore Versi Ini',
      'Batal'
    );
  };

  // ----------------------------------------------------
  // REVIEW COMMENTS (THREADED)
  // ----------------------------------------------------
  const handleAddComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!selectedKitab) return;
    
    const text = parentId ? commentReplyText : newCommentText;
    if (!text.trim()) return;

    const commentId = `collab_com_${Date.now()}`;
    const comment: CollabComment = {
      id: commentId,
      kitabId: selectedKitab.id,
      mrId: activeMR?.id || undefined,
      draftId: activeDraft?.id || undefined,
      chapterId: editorChapters[activeChapterIdx]?.id || undefined,
      authorEmail: currentUserEmail,
      authorName: currentUserName || 'Kolaborator',
      content: text.trim(),
      parentId: parentId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await dbService.saveCollabComment(comment);
      if (parentId) {
        setCommentReplyText('');
        setReplyingCommentId(null);
      } else {
        setNewCommentText('');
      }
      addToast('Komentar Dikirim', 'Komentar diskusi berhasil ditambahkan.', 'success');
    } catch (e) {
      addToast('Error', 'Gagal mengirim komentar.', 'warning');
    }
  };

  // Organize comments hierarchically
  const threadedCommentsGroup = useMemo(() => {
    const roots = collabComments.filter(c => !c.parentId && (!activeMR || c.mrId === activeMR.id));
    const repliesMap = new Map<string, CollabComment[]>();
    
    collabComments.forEach(c => {
      if (c.parentId) {
        const list = repliesMap.get(c.parentId) || [];
        list.push(c);
        repliesMap.set(c.parentId, list);
      }
    });

    return { roots, repliesMap };
  }, [collabComments, activeMR]);

  // Filter Custom Kitabs for Hub
  const filteredCustomKitabs = useMemo(() => {
    return customKitabs.filter(k => 
      k.title.toLowerCase().includes(collabSearch.toLowerCase()) || 
      k.author.toLowerCase().includes(collabSearch.toLowerCase())
    );
  }, [customKitabs, collabSearch]);

  return (
    <div className="space-y-6">
      {/* HEADER BAR AND ROLE BASED ACCESS SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#5A5A40] text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
              Sistem Kolaborasi Khazanah Digital (RBAC)
            </h2>
            <p className="text-xs text-[#999488]">
              Tulis, tinjau, diskusikan, dan selaraskan karya ilmiah bersama kontributor lain.
            </p>
          </div>
        </div>

        {/* Simulated RBAC Role Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-[#F9F6F0] dark:bg-[#121210] p-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] w-full sm:w-auto">
          <span className="text-[10px] font-bold text-[#5A5A40] dark:text-[#A8A890] px-2 uppercase tracking-wide flex items-center gap-1 shrink-0">
            <Shield className="w-3.5 h-3.5" /> Hak Akses:
          </span>
          <select 
            id="role-rbac-selector"
            value={myRole} 
            onChange={(e) => {
              const targetRole = e.target.value as CollabRole;
              if (getRolePriority(targetRole) > getRolePriority(maxRole)) {
                addToast('Akses Terbatas', `Anda tidak memiliki izin untuk menjadi ${targetRole.toUpperCase()}`, 'warning');
                return;
              }
              setMyRole(targetRole);
              addToast('Hak Akses Diperbarui', `Anda sekarang bertindak sebagai: ${targetRole.toUpperCase()}`, 'info');
            }}
            className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] text-xs font-semibold rounded px-2 py-1 focus:outline-none text-[#5A5A40] dark:text-[#E5E1D8] flex-1 sm:flex-initial min-w-0 max-w-full"
          >
            <option value="reader" disabled={getRolePriority('reader') > getRolePriority(maxRole)}>Qari (Pembaca)</option>
            <option value="contributor" disabled={getRolePriority('contributor') > getRolePriority(maxRole)}>Katib (Penyusun)</option>
            <option value="reviewer" disabled={getRolePriority('reviewer') > getRolePriority(maxRole)}>Mushahhih (Pemeriksa)</option>
            <option value="admin" disabled={getRolePriority('admin') > getRolePriority(maxRole)}>Mudir (Pengelola)</option>
          </select>
        </div>
      </div>

      {/* INNER COLLABORATION TABS */}
      {!selectedKitab ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-stone-100 dark:bg-[#121210] p-1 rounded-xl">
          {[
            { id: 'dashboard', label: 'Beranda & Statistik', icon: Activity },
            { id: 'kitab_hub', label: 'Majelis Karya', icon: BookOpen },
            { id: 'mr_list', label: 'Usulan Tashih', icon: GitPullRequest },
            { id: 'history_list', label: 'Riwayat & Pemulihan', icon: History }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`collab-tab-btn-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSelectedKitab(null);
                  setActiveDraft(null);
                  setActiveMR(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all focus:outline-none cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-white dark:bg-[#181814] text-[#5A5A40] dark:text-[#E5E1D8] shadow-sm border border-stone-200 dark:border-stone-800' 
                    : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ACTIVE KITAB BANNER / CONTROL BAR */
        <div className="flex items-center justify-between bg-stone-100 dark:bg-[#181814] p-3 rounded-xl border border-stone-200 dark:border-[#3A3A30]">
          <div className="flex items-center gap-3">
            <button 
              id="btn-back-to-hub"
              onClick={() => {
                setSelectedKitab(null);
                setActiveDraft(null);
                setActiveMR(null);
              }}
              className="p-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 focus:outline-none cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Karya yang Dipilih</span>
              <h3 className="text-sm font-serif font-bold text-stone-800 dark:text-[#E5E1D8]">
                {selectedKitab.title} <span className="font-mono text-[10px] text-stone-400">({selectedKitab.author})</span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live Presence Icons */}
            <div className="flex -space-x-1 overflow-hidden mr-3">
              {presenceList.map((p) => (
                <div 
                  key={p.id}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-stone-950 bg-stone-300 flex items-center justify-center text-[10px] font-bold text-stone-700"
                  title={`${p.userName} (${p.userEmail}) - Sedang ${p.activeDraftId ? 'mengedit draft' : 'membaca'}`}
                >
                  {p.userName.substr(0, 2).toUpperCase()}
                </div>
              ))}
              {presenceList.length === 0 && (
                <span className="text-[11px] text-stone-500 italic">Hanya Anda di sini</span>
              )}
            </div>
            {activeDraft && (
              <span className="text-xs bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/30 px-2 py-1 rounded-md font-bold flex items-center gap-1 animate-pulse">
                <GitBranch className="w-3.5 h-3.5" /> Musawwadah: {activeDraft.title}
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 1. DASHBOARD */}
      {activeTab === 'dashboard' && !selectedKitab && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Karya Terdaftar', value: stats.totalKitabs, icon: BookOpen, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' },
              { label: 'Musawwadah (Draft)', value: stats.totalDrafts, icon: GitBranch, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
              { label: 'Usulan Tashih Aktif', value: stats.openMRs, icon: GitPullRequest, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20' },
              { label: 'Selesai Tashih & Penyatuan', value: stats.mergedMRs, icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white dark:bg-[#181814] p-5 rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30] shadow-xs space-y-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div className="text-2xl font-bold text-stone-800 dark:text-[#E5E1D8]">{stat.value}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Today's Activity Timeline / Guide */}
            <div className="md:col-span-2 bg-white dark:bg-[#181814] p-5 rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30] space-y-4">
              <h3 className="text-sm font-bold text-stone-800 dark:text-[#E5E1D8] flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
                <Activity className="w-4 h-4 text-[#5A5A40]" /> Panduan Alur Kolaborasi Khazanah Digital
              </h3>
              
              <div className="space-y-4 text-xs text-stone-600 dark:text-stone-300">
                <div className="relative pl-6 pb-2 border-l border-stone-200 dark:border-stone-800">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <strong className="text-stone-800 dark:text-white">1. Pilih Karya & Buat Musawwadah (Rancangan)</strong>
                  <p className="mt-1">Pilih karya tulis yang ingin Anda sunting pada tab 'Majelis Karya'. Buat Musawwadah kerja pribadi Anda untuk mulai menulis secara aman tanpa memengaruhi naskah induk utama.</p>
                </div>
                
                <div className="relative pl-6 pb-2 border-l border-stone-200 dark:border-stone-800">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <strong className="text-stone-800 dark:text-white">2. Sunting & Auto-Save Real-time</strong>
                  <p className="mt-1">Gunakan editor Arab khusus kami (mendukung Harakat, orientasi Kanan-ke-Kiri/RTL, serta riwayat undo/redo). Tulisan Anda akan otomatis tersimpan di cloud secara berkala.</p>
                </div>

                <div className="relative pl-6 pb-2 border-l border-stone-200 dark:border-stone-800">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <strong className="text-stone-800 dark:text-white">3. Ajukan Usulan Tashih (Penyatuan)</strong>
                  <p className="mt-1">Setelah selesai menulis atau menyempurnakan naskah, ajukan Usulan Tashih (Penyatuan Teks). Sistem kami akan melacak perbedaan kalimat (Muqabalah) kata demi kata secara otomatis.</p>
                </div>

                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <strong className="text-stone-800 dark:text-white">4. Pemeriksaan (Tashih) & Penggabungan Resmi</strong>
                  <p className="mt-1">Para Mushahhih atau Mudir akan meneliti naskah Anda (Muqabalah / Perbandingan Teks), memberikan ulasan/catatan, menyetujui, dan akhirnya menggabungkan perubahan Anda ke naskah induk utama.</p>
                </div>
              </div>
            </div>

             {/* Simulated Live Notifications or Statuses */}
            <div className="bg-[#F9F6F0] dark:bg-[#121210] p-5 rounded-xl border border-[#E5E1D8] dark:border-[#3A3A30] space-y-4">
              <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E5E1D8] flex items-center gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
                <Info className="w-4 h-4" /> Informasi Halaqah
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="bg-white dark:bg-[#181814] p-3 rounded-lg border border-stone-200 dark:border-stone-800 space-y-1">
                  <div className="font-bold text-stone-700 dark:text-stone-300">Statistik Khidmat Anda:</div>
                  <div className="text-stone-500">Musawwadah aktif: <strong>{stats.myDrafts} buah</strong></div>
                  <div className="text-stone-500">Peran: <strong>Khadim Karya (Aktif)</strong></div>
                </div>

                <div className="bg-white dark:bg-[#181814] p-3 rounded-lg border border-stone-200 dark:border-stone-800 space-y-2">
                  <div className="font-bold text-stone-700 dark:text-stone-300">Kabar Halaqah & Sistem:</div>
                  <div className="flex items-start gap-1.5 text-[11px] text-stone-600 dark:text-stone-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                    <span>Sinkronisasi real-time naskah aktif.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-stone-600 dark:text-stone-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5" />
                    <span>Usulan Tashih siap diulas langsung oleh para Mushahhih.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. COLLABORATION KITAB HUB */}
      {activeTab === 'kitab_hub' && !selectedKitab && (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <input
              id="collab-search-input"
              type="text"
              placeholder="Cari naskah karya kustom untuk dikembangkan..."
              value={collabSearch}
              onChange={(e) => setCollabSearch(e.target.value)}
              className="w-full bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl px-4 py-2.5 pl-10 text-xs focus:ring-1 focus:ring-[#5A5A40] focus:outline-none text-[#333333] dark:text-[#E5E1D8]"
            />
            <Eye className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          </div>

          {filteredCustomKitabs.length === 0 ? (
            <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-12 rounded-xl text-center text-xs space-y-2 text-stone-500">
              <BookOpen className="w-8 h-8 mx-auto text-stone-300" />
              <p className="font-bold">Belum ada Karya Tulis Kustom yang tersedia</p>
              <p>Silakan buat naskah karya kustom terlebih dahulu pada menu "Tulis Karya" untuk memulai kolaborasi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCustomKitabs.map((kitab) => {
                const kitabDrafts = allDrafts.filter(d => d.kitabId === kitab.id);
                return (
                  <div 
                    key={kitab.id} 
                    className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-serif font-bold text-stone-800 dark:text-[#E5E1D8] text-sm">
                          {kitab.title}
                        </h4>
                        <span className="text-[10px] font-medium bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded-md">
                          {kitab.chapters.length} Bab
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                        Ditulis oleh: {kitab.author}
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">
                        {kitab.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-stone-500">
                        {kitabDrafts.length > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {kitabDrafts.length} Musawwadah Aktif
                          </span>
                        ) : (
                          <span>Belum ada musawwadah</span>
                        )}
                      </div>

                      <button
                        id={`btn-collab-with-${kitab.id}`}
                        onClick={() => {
                          setSelectedKitab(kitab);
                          // Check if user already has an open draft for this kitab
                          const existingDraft = allDrafts.find(d => d.kitabId === kitab.id && d.authorEmail === currentUserEmail && d.status === 'open');
                          if (existingDraft) {
                            setActiveDraft(existingDraft);
                            setEditorChapters(existingDraft.chapters);
                            setHistoryStack([JSON.parse(JSON.stringify(existingDraft.chapters))]);
                            setHistoryPointer(0);
                            addToast('Memuat Musawwadah', `Melanjutkan musawwadah kerja: "${existingDraft.title}"`, 'success');
                          } else {
                            setShowCreateDraftModal(true);
                          }
                        }}
                        className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors focus:outline-none"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Mudzakarah</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 3. MERGE REQUESTS LIST */}
      {activeTab === 'mr_list' && !activeMR && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800 dark:text-[#E5E1D8]">
              Daftar Usulan Penggabungan & Penyempurnaan (Tashih)
            </h3>
          </div>

          {allMRs.length === 0 ? (
            <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-12 rounded-xl text-center text-xs text-stone-500">
              <GitPullRequest className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="font-bold">Tidak ada usulan tashih yang terbuka</p>
              <p>Minta katib (penyusun) untuk membuat musawwadah dan mengajukan usulan tashih.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allMRs.map((mr) => (
                <div 
                  key={mr.id}
                  id={`mr-card-${mr.id}`}
                  onClick={() => {
                    setActiveMR(mr);
                    const associatedKitab = customKitabs.find(k => k.id === mr.kitabId);
                    if (associatedKitab) setSelectedKitab(associatedKitab);
                  }}
                  className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-4 rounded-xl shadow-xs flex items-center justify-between gap-4 cursor-pointer hover:border-[#5A5A40] transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                        mr.status === 'open' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                        mr.status === 'review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                        mr.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        mr.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400'
                      }`}>
                        {mr.status === 'open' ? 'Terbuka' :
                         mr.status === 'review' ? 'Ditinjau' :
                         mr.status === 'approved' ? 'Disetujui' :
                         mr.status === 'rejected' ? 'Ditolak' :
                         mr.status === 'merged' ? 'Selesai Gabung' :
                         mr.status}
                      </span>
                      <h4 className="text-xs font-bold text-stone-800 dark:text-[#E5E1D8]">
                        {mr.title}
                      </h4>
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">
                      Diajukan oleh: <strong className="text-stone-700 dark:text-stone-200">{mr.authorName}</strong> • Karya: <em>{mr.kitabTitle}</em>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-1">
                      {mr.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-stone-400">
                    <span className="text-[10px] font-mono">{mr.diffs.length} perubahan</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 4. HISTORY / MERGE TIMELINE & ROLLBACK */}
      {activeTab === 'history_list' && !selectedKitab && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800 dark:text-[#E5E1D8]">
              Pilih Karya Tulis Kolaborasi untuk Melihat Histori
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customKitabs.map((kitab) => (
              <div 
                key={kitab.id}
                onClick={() => {
                  setSelectedKitab(kitab);
                  setActiveTab('history_list');
                }}
                className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-4 rounded-xl shadow-xs hover:border-[#5A5A40] cursor-pointer transition-colors space-y-2"
              >
                <h4 className="font-serif font-bold text-stone-800 dark:text-[#E5E1D8] text-sm">
                  {kitab.title}
                </h4>
                <p className="text-xs text-stone-500">Kategori: {kitab.category}</p>
                <div className="flex items-center gap-1 text-[11px] text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <History className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat Perubahan & Rollback</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE SUB-VIEW: REAL-TIME ACTIVE EDITOR (FOR ACTIVE DRAFT) */}
      {selectedKitab && activeDraft && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-3">
              <button 
                id="btn-quit-editor"
                onClick={() => {
                  setActiveDraft(null);
                  setSelectedKitab(null);
                }}
                className="text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 p-1.5 rounded-lg focus:outline-none cursor-pointer transition-colors"
                title="Keluar Editor"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#5A5A40]" /> Editor Musawwadah: {activeDraft.title}
                </h4>
                {/* Auto-save cloud sync indicator */}
                <div className="text-[10px] font-medium flex items-center gap-1 mt-0.5">
                  {saveStatus === 'saving' && <span className="text-amber-500 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Sinkronisasi ke Cloud...</span>}
                  {saveStatus === 'saved' && <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Tersimpan aman di Cloud</span>}
                  {saveStatus === 'error' && <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Gagal Sync (Offline)</span>}
                </div>
              </div>
            </div>

            {/* Editor Control Utilities */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-undo"
                onClick={handleUndo}
                disabled={historyPointer <= 0}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 focus:outline-none cursor-pointer transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                id="btn-redo"
                onClick={handleRedo}
                disabled={historyPointer >= historyStack.length - 1}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 focus:outline-none cursor-pointer transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
              
              {myRole !== 'reader' && (
                <button
                  id="btn-submit-mr-trigger"
                  onClick={() => setShowCreateMRModal(true)}
                  className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 focus:outline-none cursor-pointer transition-colors"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Ajukan Tashih</span>
                </button>
              )}

              <span className="text-[11px] font-bold text-[#5A5A40] bg-[#5A5A40]/10 dark:text-[#E5E1D8] dark:bg-[#3A3A30] px-3 py-1.5 rounded-lg">
                Mode Edit Kolaboratif
              </span>
            </div>
          </div>

          {/* Main Grid: Left Column for Metadata/Presence/Comments, Right for Page Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Sidebar Info Area */}
            <div className="space-y-6">
              
              {/* Draft Info Card */}
              <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4">
                <div className="border-b border-stone-100 dark:border-stone-800 pb-2 flex items-center justify-between">
                  <h4 className="font-serif font-bold text-stone-800 dark:text-white text-sm">
                    Detail Naskah Induk
                  </h4>
                  {(selectedKitab.createdBy === currentUserEmail || myRole === 'admin') && (
                    <button
                      id="btn-edit-metadata-toggle"
                      onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                      className="text-xs text-[#5A5A40] dark:text-[#E5E1D8] hover:underline font-bold flex items-center gap-1 focus:outline-none cursor-pointer"
                    >
                      {isEditingMetadata ? 'Batal' : (
                        <>
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isEditingMetadata ? (
                  <div className="space-y-3.5 text-xs">
                    {/* Title */}
                    <div>
                      <label htmlFor="meta-title-input" className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Judul Karya *</label>
                      <input
                        id="meta-title-input"
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>

                    {/* Author */}
                    <div>
                      <label htmlFor="meta-author-input" className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Penulis *</label>
                      <input
                        id="meta-author-input"
                        type="text"
                        value={metaAuthor}
                        onChange={(e) => setMetaAuthor(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label htmlFor="meta-category-select" className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Kategori *</label>
                      <select
                        id="meta-category-select"
                        value={metaCategory}
                        onChange={(e) => setMetaCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer"
                      >
                        {categoriesPreset.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label htmlFor="meta-description-input" className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Deskripsi *</label>
                      <textarea
                        id="meta-description-input"
                        rows={2}
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-white dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>

                    {/* Public Status */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="meta-public-checkbox"
                        type="checkbox"
                        checked={metaIsPublic}
                        onChange={(e) => setMetaIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40] border-[#E5E1D8] dark:border-[#3A3A30] cursor-pointer"
                      />
                      <label htmlFor="meta-public-checkbox" className="text-[11px] font-bold text-stone-600 dark:text-stone-300 select-none cursor-pointer">
                        Publikasikan secara umum
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <button
                        id="btn-save-metadata"
                        onClick={handleSaveMetadata}
                        className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 focus:outline-none cursor-pointer transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs text-stone-600 dark:text-stone-300">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Judul Karya</label>
                      <p className="font-serif font-bold text-stone-800 dark:text-stone-100 text-sm bg-white dark:bg-stone-900/40 px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg">
                        {selectedKitab.title}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Penulis</label>
                      <p className="bg-white dark:bg-stone-900/40 px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg">
                        {selectedKitab.author}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Kategori</label>
                      <p className="bg-white dark:bg-stone-900/40 px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg">
                        {selectedKitab.category}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">Penyusun Musawwadah</label>
                      <p className="bg-white dark:bg-stone-900/40 px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg">
                        {activeDraft.authorName} ({activeDraft.authorEmail})
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Kelola Kolaborator (Only visible to the owner of the kitab) */}
              {selectedKitab.createdBy === currentUserEmail && (
                <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4">
                  <div className="pb-2 border-b border-stone-100 dark:border-stone-800">
                    <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#5A5A40]" /> Kelola Kolaborator
                    </h4>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      Hanya pemilik karya tulis yang dapat mengatur hak akses.
                    </p>
                  </div>

                  {/* Inline form to add collaborator */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const emailInput = form.elements.namedItem('collabEmail') as HTMLInputElement;
                      const roleSelect = form.elements.namedItem('collabRole') as HTMLSelectElement;
                      if (emailInput && roleSelect) {
                        handleAddCollaborator(emailInput.value, roleSelect.value as CollabRole);
                        emailInput.value = '';
                      }
                    }}
                    className="space-y-2"
                  >
                    <input
                      name="collabEmail"
                      type="email"
                      placeholder="Email kolaborator..."
                      required
                      className="w-full bg-stone-50 dark:bg-[#121210] border border-stone-200 dark:border-stone-800 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-[#5A5A40] focus:outline-none text-stone-800 dark:text-stone-200"
                    />
                    <div className="flex gap-2">
                      <select
                        name="collabRole"
                        className="flex-1 bg-stone-50 dark:bg-[#121210] border border-stone-200 dark:border-stone-800 rounded px-2 py-1 text-xs focus:outline-none text-stone-700 dark:text-stone-300"
                      >
                        <option value="contributor">Contributor</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                        <option value="reader">Reader</option>
                      </select>
                      <button
                        type="submit"
                        className="bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs px-3.5 py-1 rounded cursor-pointer transition-colors"
                      >
                        Tambah
                      </button>
                    </div>
                  </form>

                  {/* List of current collaborators */}
                  <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800 max-h-[180px] overflow-y-auto">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Daftar Kolaborator ({(selectedKitab.collaborators || []).length}):
                    </div>
                    {(selectedKitab.collaborators || []).length === 0 ? (
                      <div className="text-[11px] text-stone-400 italic">
                        Belum ada kolaborator yang terdaftar.
                      </div>
                    ) : (
                      (selectedKitab.collaborators || []).map((collab) => (
                        <div 
                          key={collab.email} 
                          className="flex flex-col gap-1.5 p-2 bg-stone-50 dark:bg-[#121210] rounded-lg border border-stone-200/60 dark:border-stone-800"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate max-w-[120px]" title={collab.email}>
                              {collab.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCollaborator(collab.email)}
                              className="text-stone-400 hover:text-red-500 p-0.5 cursor-pointer"
                              title="Hapus Akses"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <select
                            value={collab.role}
                            onChange={(e) => handleUpdateCollaboratorRole(collab.email, e.target.value as CollabRole)}
                            className="bg-white dark:bg-[#181814] border border-stone-200 dark:border-stone-800 rounded px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300 focus:outline-none"
                          >
                            <option value="contributor">Contributor</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="admin">Admin</option>
                            <option value="reader">Reader</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Presensi Kolaborator Real-time */}
              <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 dark:border-stone-800 pb-2">
                  <Users className="w-4 h-4 text-[#5A5A40]" /> Kolaborator Aktif ({presenceList.length})
                </h4>
                <div className="space-y-2.5">
                  {presenceList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-stone-50 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white font-bold flex items-center justify-center text-[10px]">
                            {p.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                        </div>
                        <div>
                          <p className="font-semibold text-stone-800 dark:text-stone-100">{p.userName}</p>
                          <p className="text-[10px] text-stone-400">{p.userEmail === currentUserEmail ? 'Anda' : 'Kolaborator'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 italic">
                        {p.editingParagraphId ? 'Mengetik...' : 'Membaca'}
                      </span>
                    </div>
                  ))}
                  {presenceList.length === 0 && (
                    <p className="text-xs text-stone-400 italic text-center py-2">Hanya Anda yang berada di editor ini saat ini.</p>
                  )}
                </div>
              </div>

              {/* Threaded Discussion Hub */}
              <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 dark:border-stone-800 pb-2">
                  <MessageSquare className="w-4 h-4 text-[#5A5A40]" /> Diskusi & Ulasan Bab
                </h4>
                
                {/* Threaded comments list */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {threadedCommentsGroup.roots.filter(c => c.chapterId === editorChapters[activeChapterIdx]?.id).map((root) => {
                    const replies = threadedCommentsGroup.repliesMap.get(root.id) || [];
                    return (
                      <div key={root.id} className="bg-stone-50 dark:bg-stone-900/40 p-3 rounded-lg space-y-2 border border-stone-100 dark:border-stone-900">
                        <div className="flex justify-between items-start gap-1">
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-bold text-stone-800 dark:text-stone-100">{root.authorName}</div>
                            <div className="text-[9px] text-stone-400">{new Date(root.createdAt).toLocaleDateString()} {new Date(root.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                        </div>
                        <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{root.content}</p>

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="pl-3 border-l border-stone-200 dark:border-stone-800 space-y-2 mt-2">
                            {replies.map((reply) => (
                              <div key={reply.id} className="space-y-1">
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="font-bold text-stone-700 dark:text-stone-300">{reply.authorName}</span>
                                  <span className="text-stone-400">• {new Date(reply.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-stone-600 dark:text-stone-400 whitespace-pre-wrap">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply control */}
                        <div className="pt-1 flex items-center gap-2">
                          {replyingCommentId === root.id ? (
                            <form onSubmit={(e) => handleAddComment(e, root.id)} className="w-full flex gap-1.5">
                              <input
                                id={`reply-input-${root.id}`}
                                type="text"
                                placeholder="Ketik balasan..."
                                value={commentReplyText}
                                onChange={(e) => setCommentReplyText(e.target.value)}
                                className="flex-1 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1 text-xs focus:outline-none"
                              />
                              <button type="submit" className="bg-[#5A5A40] text-white px-2 rounded-md focus:outline-none"><Send className="w-3 h-3" /></button>
                              <button type="button" onClick={() => setReplyingCommentId(null)} className="text-stone-400"><X className="w-3.5 h-3.5" /></button>
                            </form>
                          ) : (
                            <button
                              id={`reply-btn-${root.id}`}
                              onClick={() => {
                                setReplyingCommentId(root.id);
                                setCommentReplyText('');
                              }}
                              className="text-[9px] text-stone-500 hover:text-[#5A5A40] font-semibold flex items-center gap-1 focus:outline-none"
                            >
                              <CornerDownRight className="w-2.5 h-2.5" /> Balas Diskusi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {threadedCommentsGroup.roots.filter(c => c.chapterId === editorChapters[activeChapterIdx]?.id).length === 0 && (
                    <p className="text-[11px] text-stone-400 italic text-center py-4">Belum ada ulasan ilmiah untuk bab ini.</p>
                  )}
                </div>

                {/* Comment input form */}
                <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <input
                    id="new-comment-input"
                    type="text"
                    placeholder="Tulis ulasan ilmiah atau perbaikan..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 bg-stone-50/50 dark:bg-stone-950 border border-stone-200/50 dark:border-stone-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-stone-800 dark:text-stone-100"
                  />
                  <button
                    type="submit"
                    className="bg-[#5A5A40] text-white px-3 py-1.5 rounded-lg font-bold text-xs focus:outline-none"
                  >
                    Kirim
                  </button>
                </form>
              </div>

            </div>

            {/* Right Main Column: Canvas Editor matches KitabWriter mode edit */}
            <div className="lg:col-span-2 space-y-6">

              {/* 1. Struktur Bab Kitab (Tab navigation) */}
              <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4 shadow-none space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 1. Silsilah / Struktur Bab Karya
                  </h4>
                  {myRole !== 'reader' && (
                    <div className="flex items-center gap-3">
                      <button
                        id="btn-writer-add-sub-chapter"
                        type="button"
                        onClick={addSubChapter}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                      >
                        + Tambah Sub Bab
                      </button>
                      <button
                        id="btn-writer-add-chapter"
                        type="button"
                        onClick={addChapter}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                      >
                        + Tambah Bab Baru
                      </button>
                    </div>
                  )}
                </div>

                <div 
                  id="writer-chapters-tree-container" 
                  className="border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-3 bg-[#FDFBF7] dark:bg-[#121210] space-y-2 max-h-[350px] overflow-y-auto relative min-h-[150px]"
                  onDragOver={(e) => {
                    if (myRole !== 'reader') e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (myRole !== 'reader') {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId) {
                        updateChapterParent(draggedId, undefined);
                      }
                    }
                  }}
                >
                  {buildTree(editorChapters).map(function renderWriterNode(node: TreeNode) {
                    const ch = node.chapter;
                    const idxInChapters = editorChapters.findIndex(c => c.id === ch.id);
                    const isActive = idxInChapters === activeChapterIdx;
                    const hasChildren = node.children.length > 0;
                    const isCollapsed = collapsedChapters[ch.id];

                    // Allowed node label presets
                    const presets = ['Bab', 'Fasal', 'Muqaddimah', 'Tanbih', 'Faidah', 'Masalah', 'Sub Bab', 'Artikel'];

                    return (
                      <div 
                        key={ch.id} 
                        className={`space-y-1 rounded-lg transition-all border border-transparent ${isActive ? 'bg-amber-500/5 dark:bg-[#5A5A40]/10 border-[#5A5A40]/20 p-1.5' : 'p-1 hover:border-dashed hover:border-[#5A5A40]/30'}`}
                        onDragOver={(e) => {
                          if (myRole !== 'reader') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        onDrop={(e) => {
                          if (myRole !== 'reader') {
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId && draggedId !== ch.id) {
                              updateChapterParent(draggedId, ch.id);
                            }
                          }
                        }}
                      >
                        <div 
                          className="flex flex-col md:flex-row md:items-center justify-between gap-2 w-full group"
                          style={{ paddingLeft: `${node.depth * 16}px` }}
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {/* Drag Handle Indicator */}
                            {myRole !== 'reader' && (
                              <div 
                                className="text-[#999488] dark:text-[#666155] cursor-grab active:cursor-grabbing px-1.5 py-0.5 bg-[#F4F1EA] dark:bg-stone-800 hover:bg-[#E5E1D8] hover:text-[#5A5A40] rounded font-mono text-[10px] select-none flex items-center justify-center min-w-[18px] h-[18px]" 
                                title="Seret ke Bab lain untuk menjadikannya Sub-Bab, atau taruh di ruang kosong untuk menjadikannya Bab Utama (Root)"
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData('text/plain', ch.id);
                                }}
                              >
                                ⋮⋮
                              </div>
                            )}

                            {/* Collapse Button */}
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCollapsedChapters(prev => ({ ...prev, [ch.id]: !prev[ch.id] }));
                                }}
                                className="p-1 hover:bg-[#E5E1D8] dark:hover:bg-stone-800 rounded text-[#777266] dark:text-[#A8A890] transition-colors cursor-pointer"
                              >
                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <div className="w-5.5 flex-shrink-0" />
                            )}

                            {/* Label Type Selector Dropdown or Custom Text Input */}
                            {myRole !== 'reader' ? (
                              customNodes[ch.id] || (ch.nodeType && !presets.includes(ch.nodeType)) ? (
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
                                  value={ch.nodeType}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '__CUSTOM__') {
                                      setCustomNodes(prev => ({ ...prev, [ch.id]: true }));
                                      updateNodeType(ch.id, 'Kustom');
                                    } else {
                                      updateNodeType(ch.id, val);
                                    }
                                  }}
                                  className="bg-[#FDFBF7] dark:bg-stone-950 border border-[#E5E1D8] dark:border-[#3A3A30] text-[10px] font-mono rounded px-1 py-0.5 text-[#5A5A40] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                                >
                                  {presets.map(p => <option key={p} value={p}>{p}</option>)}
                                  <option value="__CUSTOM__">🎨 Kustom...</option>
                                </select>
                              )
                            ) : (
                              <span className="text-[10px] font-mono text-[#5A5A40] dark:text-[#E5E1D8] bg-[#F4F1EA] dark:bg-stone-800 px-1 py-0.5 rounded">
                                {ch.nodeType}
                              </span>
                            )}

                            <span className="text-[10px] text-stone-400 font-mono">#{ch.number}</span>

                            {/* Title button */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveChapterIdx(idxInChapters);
                                setEditingParagraphId(null);
                              }}
                              className={`truncate text-left px-2 py-1 rounded text-xs font-bold transition-all flex-1 cursor-pointer ${
                                isActive
                                  ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-none'
                                  : 'text-[#333333] dark:text-[#E5E1D8] hover:bg-[#E5E1D8] dark:hover:bg-[#121210]'
                              }`}
                            >
                              {ch.title || '(Teks Judul Kosong)'}
                            </button>
                          </div>

                          {/* Node actions (Indenting, Reordering, Moving, deleting) */}
                          {myRole !== 'reader' && (
                            <div className="flex items-center gap-1.5 self-end md:self-auto bg-[#F9F6F0]/80 dark:bg-stone-900 border border-[#E5E1D8]/40 dark:border-[#3A3A30]/40 p-1 rounded-lg">
                              {/* Indent / Outdent */}
                              <button
                                type="button"
                                onClick={() => outdentChapter(ch.id)}
                                disabled={!ch.parentId}
                                title="Geser Keluar (Outdent)"
                                className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30 cursor-pointer"
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                onClick={() => indentChapter(ch.id)}
                                title="Geser ke Dalam (Indent)"
                                className="px-1.5 py-0.5 text-xs font-bold rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 disabled:opacity-30 cursor-pointer"
                              >
                                →
                              </button>

                              {/* Sibling Reordering */}
                              <button
                                type="button"
                                onClick={() => moveChapterUp(ch.id)}
                                title="Pindahkan Ke Atas"
                                className="p-1 rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChapterDown(ch.id)}
                                title="Pindahkan Ke Bawah"
                                className="p-1 rounded hover:bg-[#E5E1D8] dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>

                              {/* Change parent picker dropdown to move anywhere quickly */}
                              <select
                                value={ch.parentId || ''}
                                onChange={(e) => updateChapterParent(ch.id, e.target.value || undefined)}
                                title="Pindahkan ke Parent lain"
                                className="max-w-[75px] bg-stone-100 dark:bg-stone-800 border-none text-[9px] rounded px-1.5 py-0.5 focus:outline-none text-[#777266] dark:text-stone-300 cursor-pointer"
                              >
                                <option value="">(Root)</option>
                                {editorChapters
                                  .filter(c => c.id !== ch.id)
                                  .map(c => <option key={c.id} value={c.id}>{c.nodeType || 'Node'} {c.number}: {c.title}</option>)}
                              </select>

                              {/* Recursive Delete button */}
                              {editorChapters.length > 1 && (
                                confirmDeleteId === ch.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Yakin?</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChapter(idxInChapters);
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
                          )}
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

              {/* 2. Daftar Halaman di Node Ini */}
              <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4 shadow-none space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> 2. Daftar Halaman di Node Ini
                  </h4>
                  {myRole !== 'reader' && (
                    <button
                      id="btn-writer-add-page"
                      type="button"
                      onClick={addPageToActiveChapter}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:text-[#454530] dark:text-[#E5E1D8] focus:outline-none cursor-pointer"
                    >
                      + Tambah Halaman Baru
                    </button>
                  )}
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
                      {myRole !== 'reader' && uniquePages.length > 1 && (
                        <button
                          id={`btn-delete-page-tab-${pageNum}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerConfirm(
                              'Hapus Halaman',
                              `Hapus seluruh halaman ${pageNum} ini beserta seluruh baris paragrafnya?`,
                              () => removePageFromActiveChapter(pageNum),
                              'Hapus',
                              'Batal'
                            );
                          }}
                          className="text-stone-400 hover:text-red-500 focus:outline-none ml-1 p-0.5 rounded-md cursor-pointer"
                          title="Hapus Halaman"
                        >
                          <X className="w-3 h-3 pointer-events-none" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Active Chapter & Page Editor Area */}
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
                      disabled={myRole === 'reader'}
                      value={editorChapters[activeChapterIdx]?.number || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newChapters = [...editorChapters];
                        if (newChapters[activeChapterIdx]) {
                          newChapters[activeChapterIdx].number = val;
                          setEditorChapters(newChapters);
                          pushToUndoStack(newChapters);
                          saveDraftToCloud(newChapters);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label htmlFor="chapter-title-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                        Judul {editorChapters[activeChapterIdx]?.isSubChapter ? 'Sub Bab (Fasal)' : 'Bab'} Aktif *
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={myRole === 'reader'}
                          checked={!!editorChapters[activeChapterIdx]?.isSubChapter}
                          onChange={() => toggleSubChapter(activeChapterIdx)}
                          className="rounded border-[#E5E1D8] text-[#5A5A40] focus:ring-[#5A5A40] focus:ring-offset-0 bg-[#FDFBF7]"
                        />
                        Jadikan Sub Bab
                      </label>
                    </div>
                    <input
                      id="chapter-title-input"
                      type="text"
                      required
                      disabled={myRole === 'reader'}
                      placeholder="Contoh: Bab 1: Keutamaan Niat di dalam Hati"
                      value={editorChapters[activeChapterIdx]?.title || ''}
                      onChange={(e) => editChapterTitle(activeChapterIdx, e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                {/* Page Customization Section */}
                <div className="flex flex-col sm:flex-row gap-4 items-end bg-[#F4F1EA]/50 dark:bg-[#1C1C18]/35 p-3.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30]">
                  <div className="w-full sm:w-36">
                    <label htmlFor="page-number-input" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                      Nomor Halaman saat ini *
                    </label>
                    <input
                      id="page-number-input"
                      type="number"
                      min="1"
                      required
                      disabled={myRole === 'reader'}
                      value={activePageNumber}
                      onChange={(e) => {
                        const newPageVal = parseInt(e.target.value) || 1;
                        const newChapters = [...editorChapters];
                        if (newChapters[activeChapterIdx]) {
                          newChapters[activeChapterIdx].paragraphs = newChapters[activeChapterIdx].paragraphs.map(p => {
                            if ((p.page || 1) === activePageNumber) {
                              return { ...p, page: newPageVal };
                            }
                            return p;
                          });
                          setEditorChapters(newChapters);
                          pushToUndoStack(newChapters);
                          saveDraftToCloud(newChapters);
                        }
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
                        onFocus={() => setEditingParagraphId(p.id)}
                        className={`p-4.5 bg-[#FDFBF7] dark:bg-[#121210] rounded-lg border transition-all space-y-4 relative group ${
                          editingParagraphId === p.id 
                            ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]' 
                            : 'border-[#E5E1D8] dark:border-[#3A3A30]'
                        }`}
                      >
                        {/* Presence indicator inside editor if someone is editing this paragraph */}
                        {presenceList.filter(pr => pr.editingParagraphId === p.id && pr.userEmail !== currentUserEmail).map(pr => (
                          <div key={pr.id} className="absolute -top-2.5 right-4 bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>{pr.userName} sedang mengedit...</span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-2">
                          <span className="text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wide">
                            Paragraf #{pIdx + 1}
                          </span>
                          {myRole !== 'reader' && paragraphsOnActivePage.length > 1 && (
                            <button
                              id={`btn-delete-paragraph-${p.id}`}
                              type="button"
                              onClick={() => deleteParagraph(p.id)}
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
                              disabled={myRole === 'reader'}
                              checked={showTrans}
                              onChange={() => handleToggleField(p.id, 'trans')}
                              className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                            />
                            Sertakan Terjemahan
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-[#5A5A40] dark:text-[#E5E1D8] font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={myRole === 'reader'}
                              checked={showExpl}
                              onChange={() => handleToggleField(p.id, 'expl')}
                              className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                            />
                            Sertakan Penjelasan / Syarah
                          </label>
                        </div>

                        <div className="space-y-3.5">
                          {/* Arabic Scripture Input */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label htmlFor={`arabic-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                                Teks Arab / Paragraf Utama *
                              </label>
                              <button
                                type="button"
                                disabled={myRole === 'reader'}
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
                              disabled={myRole === 'reader'}
                              placeholder={!mainLtrFields[p.id] ? "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ..." : "Ketik naskah utama di sini..."}
                              value={p.arabic}
                              onChange={(val) => updateParagraphFieldById(p.id, 'arabic', val)}
                              className={!mainLtrFields[p.id] ? 'font-amiri font-bold text-lg' : 'font-sans text-xs'}
                              style={!mainLtrFields[p.id] ? { fontFamily: preferences.arabicFontFamily || 'Amiri' } : {}}
                            />
                          </div>

                          {/* Indonesian Translation Input (Render only if enabled) */}
                          {showTrans && (
                            <div className="animation-fade-in">
                              <div className="flex items-center justify-between mb-1">
                                <label htmlFor={`translation-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                                  Terjemahan Bahasa Indonesia
                                </label>
                                <button
                                  type="button"
                                  disabled={myRole === 'reader'}
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
                                disabled={myRole === 'reader'}
                                dir={transRtlFields[p.id] ? "rtl" : "ltr"}
                                placeholder={transRtlFields[p.id] ? "اكتب الترجمة باللغة العربية هنا..." : "Sesungguhnya amal perbuatan itu didasarkan pada niat..."}
                                value={p.translation}
                                onChange={(val) => updateParagraphFieldById(p.id, 'translation', val)}
                                className={transRtlFields[p.id] ? 'font-amiri font-bold text-lg' : 'font-sans text-xs'}
                                style={transRtlFields[p.id] ? { fontFamily: preferences.arabicFontFamily || 'Amiri' } : {}}
                              />
                            </div>
                          )}

                          {/* Tafsir / Penjelasan Input (Render only if enabled) */}
                          {showExpl && (
                            <div className="animation-fade-in">
                              <div className="flex items-center justify-between mb-1">
                                <label htmlFor={`explanation-text-input-${p.id}`} className="block text-[11px] font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                                  Penjelasan Syarah / Tafsir Detail
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setArabicExplanations(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                    isArabicSyarah
                                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                      : 'bg-white dark:bg-[#181814] text-[#777266] dark:text-slate-400 border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#5A5A40]/10'
                                  }`}
                                >
                                  {isArabicSyarah ? 'Font Arab RTL' : 'Aktifkan Font Arab'}
                                </button>
                              </div>
                              <RichTextEditor
                                id={`explanation-text-input-${p.id}`}
                                disabled={myRole === 'reader'}
                                dir={isArabicSyarah ? 'rtl' : 'ltr'}
                                placeholder={isArabicSyarah ? "اكتب الشرح أو التفسير هنا..." : "Hadis ini dikisahkan..."}
                                value={p.explanation || ''}
                                onChange={(val) => updateParagraphFieldById(p.id, 'explanation', val)}
                                className={isArabicSyarah ? 'font-amiri text-lg' : 'text-xs'}
                                style={isArabicSyarah ? { fontFamily: preferences.arabicFontFamily || 'Amiri' } : {}}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Actions Row */}
                {myRole !== 'reader' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#E5E1D8] dark:border-[#3A3A30] justify-between">
                    <div className="flex flex-wrap gap-2">
                      <button
                        id="btn-writer-add-paragraph"
                        type="button"
                        onClick={addParagraph}
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
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SUB-VIEW: MERGE REQUESTS REVIEWER (DIFF VIEWER) */}
      {selectedKitab && activeMR && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-5 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  activeMR.status === 'open' ? 'bg-blue-100 text-blue-700' :
                  activeMR.status === 'review' ? 'bg-amber-100 text-amber-700' :
                  activeMR.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  activeMR.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-stone-100 text-stone-600'
                }`}>
                  {activeMR.status}
                </span>
                <h3 className="text-sm font-serif font-bold text-stone-800 dark:text-[#E5E1D8]">
                  #{activeMR.id.substr(3, 4)}: {activeMR.title}
                </h3>
              </div>

              <button 
                id="btn-close-mr"
                onClick={() => {
                  setActiveMR(null);
                  setSelectedKitab(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 bg-stone-50 dark:bg-stone-800 rounded-lg focus:outline-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-400 space-y-2">
              <p>Diajukan oleh: <strong className="text-stone-800 dark:text-white">{activeMR.authorName} ({activeMR.authorEmail})</strong> • {new Date(activeMR.createdAt).toLocaleDateString()}</p>
              <div className="bg-stone-50 dark:bg-stone-900/60 p-4 rounded-xl border border-stone-100 dark:border-stone-900">
                <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Deskripsi Usulan:</span>
                <p className="text-stone-800 dark:text-stone-200">{activeMR.description || 'Tidak ada deskripsi.'}</p>
              </div>
            </div>

            {/* REVIEW FEEDBACK & ACTION BUTTONS FOR REVIEWER/ADMIN */}
            {activeMR.status !== 'merged' && (
              <div className="p-4 bg-[#F9F6F0] dark:bg-[#121210] rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#5A5A40]" /> Tinjauan Mushahhih
                  </h4>
                  <p className="text-[11px] text-stone-500">Gunakan tombol di kanan untuk menyetujui, menolak, atau meminta revisi perbaikan pada musawwadah ini.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                  {(myRole === 'reviewer' || myRole === 'admin') && (
                    <>
                      <button
                        id="btn-mr-changes"
                        onClick={() => triggerReviewAction('changes')}
                        className="w-full sm:w-auto justify-center flex items-center bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                      >
                        Minta Revisi
                      </button>
                      <button
                        id="btn-mr-reject"
                        onClick={() => triggerReviewAction('reject')}
                        className="w-full sm:w-auto justify-center flex items-center bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                      >
                        Tolak Musawwadah
                      </button>
                      <button
                        id="btn-mr-approve"
                        onClick={() => triggerReviewAction('approve')}
                        className="w-full sm:w-auto justify-center flex items-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                      >
                        Sahkan & Setujui
                      </button>
                    </>
                  )}

                  {/* MERGE BUTTON (ACCESSIBLE BY ADMINS & REVIEWERS IF APPROVED/OPEN/REVIEW) */}
                  {(myRole === 'admin' || myRole === 'reviewer') && (activeMR.status === 'approved' || activeMR.status === 'open' || activeMR.status === 'review') && (
                    <button
                      id="btn-mr-merge"
                      onClick={handleMergeToMain}
                      className="w-full sm:w-auto justify-center bg-[#5A5A40] hover:bg-[#484833] text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm focus:outline-none cursor-pointer flex items-center gap-1.5"
                    >
                      <GitMerge className="w-4 h-4" />
                      <span>Satukan ke Naskah Utama</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* DEVIATIONS (DIFF VIEWER) */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider">
                🔬 Muqabalah Naskah (Perbandingan Teks) — {activeMR.diffs.length} Perubahan
              </h4>

              <div className="space-y-4 max-h-[450px] overflow-y-auto">
                {activeMR.diffs.map((diff, idx) => (
                  <div 
                    key={idx} 
                    className={`border rounded-xl p-4 space-y-3 ${
                      diff.type === 'added' ? 'border-emerald-200 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10' :
                      diff.type === 'deleted' ? 'border-red-200 dark:border-red-950 bg-red-50/20 dark:bg-red-950/10' :
                      'border-amber-200 dark:border-amber-950 bg-amber-50/20 dark:bg-amber-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-stone-500">
                        {diff.chapterTitle} • Paragraf ID: {diff.paragraphId.substr(0, 6)}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        diff.type === 'added' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        diff.type === 'deleted' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                        'bg-amber-100 text-amber-800 dark:bg-[#251A0A] dark:text-amber-300'
                      }`}>
                        {diff.type === 'added' ? '+ TAMBAHAN' : diff.type === 'deleted' ? '- DIHAPUS' : '± DIUBAH'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Old Content (if deleted or modified) */}
                      {(diff.type === 'deleted' || diff.type === 'modified') && (
                        <div className="space-y-2 p-3 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/60 text-right">
                          <span className="text-[9px] font-bold text-red-600 block text-left">Naskah Asli (Lama):</span>
                          {diff.oldArabic && (
                            <div className="text-red-800 dark:text-red-300">
                              <HighlightedDiffText 
                                oldText={diff.oldArabic} 
                                newText={diff.newArabic || ''} 
                                mode="old" 
                                isArabic={true} 
                              />
                            </div>
                          )}
                          {diff.oldTranslation && (
                            <div className="text-stone-500 dark:text-stone-400 text-left pt-2 border-t border-red-100 dark:border-red-900/30">
                              <HighlightedDiffText 
                                oldText={diff.oldTranslation} 
                                newText={diff.newTranslation || ''} 
                                mode="old" 
                                isArabic={false} 
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* New Content (if added or modified) */}
                      {(diff.type === 'added' || diff.type === 'modified') && (
                        <div className="space-y-2 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/60 text-right">
                          <span className="text-[9px] font-bold text-emerald-600 block text-left">Usulan Perubahan (Baru):</span>
                          {diff.newArabic && (
                            <div className="text-emerald-800 dark:text-emerald-300">
                              <HighlightedDiffText 
                                oldText={diff.oldArabic || ''} 
                                newText={diff.newArabic} 
                                mode="new" 
                                isArabic={true} 
                              />
                            </div>
                          )}
                          {diff.newTranslation && (
                            <div className="text-stone-500 dark:text-stone-400 text-left pt-2 border-t border-emerald-100 dark:border-emerald-900/30">
                              <HighlightedDiffText 
                                oldText={diff.oldTranslation || ''} 
                                newText={diff.newTranslation} 
                                mode="new" 
                                isArabic={false} 
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {activeMR.diffs.length === 0 && (
                  <p className="text-xs text-stone-400 italic text-center py-6">Tidak ada perbedaan isi terdeteksi antara draft dan karya utama.</p>
                )}
              </div>
            </div>

            {/* Threaded Discussion for this Merge Request */}
            <div className="border-t border-stone-100 dark:border-stone-800 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-stone-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#5A5A40]" /> Majelis Diskusi Usulan Tashih
              </h4>

              <div className="space-y-3.5">
                {threadedCommentsGroup.roots.map((root) => {
                  const replies = threadedCommentsGroup.repliesMap.get(root.id) || [];
                  return (
                    <div key={root.id} className="bg-stone-50 dark:bg-stone-900/40 p-4 rounded-xl space-y-3 border border-stone-100 dark:border-stone-900">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-stone-800 dark:text-stone-100">{root.authorName}</div>
                          <div className="text-[10px] text-stone-400">{new Date(root.createdAt).toLocaleDateString()} {new Date(root.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </div>
                      <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{root.content}</p>

                      {/* Replies */}
                      {replies.length > 0 && (
                        <div className="pl-4 border-l border-stone-200 dark:border-stone-800 space-y-3 mt-3">
                          {replies.map((reply) => (
                            <div key={reply.id} className="space-y-1">
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="font-bold text-stone-700 dark:text-stone-300">{reply.authorName}</span>
                                <span className="text-stone-400">• {new Date(reply.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-xs text-stone-600 dark:text-stone-400 whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply input control */}
                      <div className="pt-1 flex items-center gap-2">
                        {replyingCommentId === root.id ? (
                          <form onSubmit={(e) => handleAddComment(e, root.id)} className="w-full flex gap-2">
                            <input
                              id={`mr-reply-input-${root.id}`}
                              type="text"
                              placeholder="Ketik balasan ulasan..."
                              value={commentReplyText}
                              onChange={(e) => setCommentReplyText(e.target.value)}
                              className="flex-1 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none text-stone-850 dark:text-stone-150"
                            />
                            <button type="submit" className="bg-[#5A5A40] text-white p-1.5 rounded-lg focus:outline-none"><Send className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setReplyingCommentId(null)} className="text-stone-400"><X className="w-4 h-4" /></button>
                          </form>
                        ) : (
                          <button
                            id={`mr-reply-btn-${root.id}`}
                            onClick={() => {
                              setReplyingCommentId(root.id);
                              setCommentReplyText('');
                            }}
                            className="text-[10px] text-stone-500 hover:text-[#5A5A40] font-semibold flex items-center gap-1 focus:outline-none"
                          >
                            <CornerDownRight className="w-3 h-3" /> Balas Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {threadedCommentsGroup.roots.length === 0 && (
                  <p className="text-xs text-stone-400 italic text-center py-4">Belum ada diskusi untuk usulan ini. Berikan ulasan atau komentar pertama!</p>
                )}
              </div>

              {/* Comment submission form */}
              <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <input
                  id="mr-new-comment-input"
                  type="text"
                  placeholder="Berikan tanggapan review mengenai naskah atau perbaikan..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 bg-stone-50/50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-2 text-xs focus:outline-none text-stone-800 dark:text-stone-100"
                />
                <button
                  type="submit"
                  className="bg-[#5A5A40] text-white px-3 py-2 rounded-xl flex items-center justify-center font-bold text-xs focus:outline-none"
                >
                  Kirim Diskusi
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SUB-VIEW: HISTORY & ROLLBACK LIST FOR SINGLE BOOK */}
      {selectedKitab && activeTab === 'history_list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <h3 className="text-sm font-serif font-bold text-stone-800 dark:text-[#E5E1D8]">
              Garis Waktu Riwayat & Pemulihan: {selectedKitab.title}
            </h3>
            <button
              id="btn-back-history-tab"
              onClick={() => {
                setSelectedKitab(null);
              }}
              className="text-xs text-[#5A5A40] font-bold flex items-center gap-1 focus:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Pilih Karya Lain
            </button>
          </div>

          {collabHistory.length === 0 ? (
            <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-12 rounded-xl text-center text-xs text-stone-500">
              <History className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="font-bold">Belum ada riwayat penggabungan (Tashih)</p>
              <p>Riwayat perubahan akan dicatat setelah Anda berhasil menyetujui dan menyatukan sebuah Usulan Tashih.</p>
            </div>
          ) : (
            <div className="relative border-l border-stone-200 dark:border-stone-800 pl-6 ml-3 space-y-6 py-2">
              {collabHistory.map((history) => (
                <div key={history.id} className="relative group">
                  {/* Timeline dot */}
                  <span className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#5A5A40] ring-4 ring-white dark:ring-stone-950 flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" />
                  </span>

                  <div className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-stone-800 dark:text-white flex items-center gap-1.5">
                        {history.message}
                      </h4>
                      <p className="text-[10px] text-stone-400">
                        Commit ID: {history.id} • Oleh: <strong>{history.userName}</strong> • {new Date(history.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {/* Admin Rollback Action */}
                    {(myRole === 'admin') && (
                      <button
                        id={`btn-rollback-${history.id}`}
                        onClick={() => handleRollback(history)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] px-3 py-1 rounded-md transition-colors focus:outline-none cursor-pointer"
                        title="Kembalikan karya utama ke versi sebelum merge ini"
                      >
                        Restore Versi Ini
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- CREATE DRAFT MODAL --- */}
      <AnimatePresence>
        {showCreateDraftModal && selectedKitab && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateDraftModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-6 rounded-xl max-w-md w-full shadow-lg relative z-10 space-y-4"
            >
              <h3 className="font-serif font-bold text-stone-800 dark:text-white text-base">
                Inisialisasi Musawwadah (Naskah Kerja)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                Buat salinan musawwadah baru dari karya **"{selectedKitab.title}"**. Anda dapat mengedit teks, menerjemahkan, atau menambahkan penjelasan secara offline/online tanpa merusak karya utama.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="draft-title" className="block text-[10px] font-bold text-stone-400 uppercase">
                  Nama Musawwadah Kerja
                </label>
                <input
                  id="draft-title"
                  type="text"
                  placeholder="contoh: Koreksi Nahwu & Tafsir - Ahmad"
                  value={newDraftTitle}
                  onChange={(e) => setNewDraftTitle(e.target.value)}
                  className="w-full bg-stone-50/50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg p-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="btn-cancel-create-draft"
                  onClick={() => setShowCreateDraftModal(false)}
                  className="text-stone-500 hover:bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-create-draft"
                  onClick={handleCreateDraft}
                  disabled={!newDraftTitle.trim()}
                  className="bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Mulai Menulis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CREATE MERGE REQUEST MODAL --- */}
      <AnimatePresence>
        {showCreateMRModal && activeDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateMRModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-6 rounded-xl max-w-md w-full shadow-lg relative z-10 space-y-4"
            >
              <h3 className="font-serif font-bold text-stone-800 dark:text-white text-base flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-emerald-600" /> Ajukan Penyatuan & Tashih
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                Ajukan musawwadah perbaikan Anda ke Mushahhih/Mudir untuk disatukan ke naskah induk utama karya kustom.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="mr-title" className="block text-[10px] font-bold text-stone-400 uppercase">
                    Judul Usulan Tashih
                  </label>
                  <input
                    id="mr-title"
                    type="text"
                    placeholder="contoh: Penyelarasan Harakat Surah Al-Fatihah"
                    value={mrTitle}
                    onChange={(e) => setMrTitle(e.target.value)}
                    className="w-full bg-stone-50/50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg p-2.5 text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mr-desc" className="block text-[10px] font-bold text-stone-400 uppercase">
                    Deskripsi Ringkas Perubahan
                  </label>
                  <textarea
                    id="mr-desc"
                    placeholder="Sebutkan bab atau baris yang Anda perbaiki, serta alasan perbaikan naskah tersebut..."
                    value={mrDescription}
                    onChange={(e) => setMrDescription(e.target.value)}
                    className="w-full bg-stone-50/50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg p-2.5 text-xs focus:outline-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="btn-cancel-mr"
                  onClick={() => setShowCreateMRModal(false)}
                  className="text-stone-500 hover:bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-mr"
                  onClick={handleCreateMR}
                  disabled={!mrTitle.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Ajukan Usulan Tashih
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- REVIEW ASSESSMENT MODAL --- */}
      <AnimatePresence>
        {showReviewModal && reviewActionType && activeMR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowReviewModal(false);
                setReviewActionType(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-6 rounded-xl max-w-md w-full shadow-lg relative z-10 space-y-4"
            >
              <h3 className="font-serif font-bold text-stone-800 dark:text-white text-base flex items-center gap-2">
                <UserCheck className={`w-5 h-5 ${
                  reviewActionType === 'approve' ? 'text-emerald-600' :
                  reviewActionType === 'reject' ? 'text-red-600' :
                  'text-amber-500'
                }`} />
                {reviewActionType === 'approve' && 'Sahkan & Setujui Perubahan'}
                {reviewActionType === 'reject' && 'Tolak Usulan Perubahan'}
                {reviewActionType === 'changes' && 'Minta Revisi Perbaikan'}
              </h3>
              
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {reviewActionType === 'approve' && 'Anda akan mensahkan musawwadah ini agar siap disatukan ke naskah utama.'}
                {reviewActionType === 'reject' && 'Anda akan menolak usulan naskah ini secara permanen.'}
                {reviewActionType === 'changes' && 'Berikan catatan bagian mana saja yang perlu diperbaiki oleh kontributor.'}
              </p>

              <div className="space-y-1.5">
                <label htmlFor="review-feedback" className="block text-[10px] font-bold text-stone-400 uppercase">
                  Catatan Evaluasi / Feedback
                </label>
                <textarea
                  id="review-feedback"
                  placeholder="Tuliskan catatan detail review Anda di sini..."
                  value={reviewFeedbackInput}
                  onChange={(e) => setReviewFeedbackInput(e.target.value)}
                  className="w-full bg-stone-50/50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg p-2.5 text-xs focus:outline-none text-stone-800 dark:text-stone-100"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="btn-cancel-review"
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewActionType(null);
                  }}
                  className="text-stone-500 hover:bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-review"
                  onClick={handleConfirmReview}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer text-white transition-colors ${
                    reviewActionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    reviewActionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  Kirim Penilaian
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CUSTOM CONFIRMATION DIALOG --- */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] p-6 rounded-xl max-w-sm w-full shadow-lg relative z-10 space-y-4"
            >
              <h3 className="font-serif font-bold text-stone-800 dark:text-white text-base">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="btn-cancel-custom-confirm"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-900 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {confirmDialog.cancelText || 'Batal'}
                </button>
                <button
                  id="btn-confirm-custom-confirm"
                  onClick={confirmDialog.onConfirm}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold focus:outline-none cursor-pointer text-white transition-colors ${
                    confirmDialog.title.toLowerCase().includes('hapus') 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-[#5A5A40] hover:bg-[#484833]'
                  }`}
                >
                  {confirmDialog.confirmText || 'Yakin'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
