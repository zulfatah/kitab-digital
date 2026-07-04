/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeType = 'light' | 'dark' | 'sepia';
export type LineSpacingType = 'tight' | 'normal' | 'relaxed';

export interface UserPreferences {
  theme: ThemeType;
  arabicFontSize: number; // e.g. 24, 28, 32, 36, 40
  translationFontSize: number; // e.g. 14, 16, 18, 20
  explanationFontSize?: number; // e.g. 12, 14, 16, 18
  explanationItalic?: boolean; // toggle italic styling for syarah/explanation
  arabicFontFamily: string; // 'Amiri' | 'Lateef' | 'Scheherazade New'
  lineSpacing: LineSpacingType;
}

export interface Paragraph {
  id: string; // e.g., 'p-1', 'p-2'
  arabic: string; // Teks Arab
  translation?: string; // Terjemahan Indonesia
  explanation?: string; // Tafsir / Penjelasan
  page?: number; // Halaman ke-
  pageLabel?: string; // Kustom label untuk halaman
}

export interface Chapter {
  id: string;
  title: string;
  number: any; // Hierarchical number string (e.g., "1", "2.1", "2.1.1")
  isSubChapter?: boolean;
  parentId?: string; // Relasi parent_id untuk mendukung hierarki tanpa batas!
  nodeType?: string; // Jenis/label node: 'Bab', 'Fasal', 'Tanbih', 'Faidah', 'Masalah', 'Muqaddimah', dst.
  paragraphs: Paragraph[];
}

export interface Kitab {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  type?: 'artikel' | 'buku' | 'kitab'; // New type field
  content?: string; // Content field for articles
  isDefault?: boolean;
  isPublic?: boolean;
  chapters?: Chapter[];
  createdAt: string;
  createdBy: string; // User email
}

export interface Bookmark {
  id: string;
  email: string;
  kitabId: string;
  chapterId: string;
  bookmarkedAt: string;
}

export interface Annotation {
  id: string;
  email: string;
  kitabId: string;
  chapterId: string;
  paragraphId: string;
  highlightedText: string;
  note: string; // Personal note
  color: string; // e.g., 'yellow', 'green', 'blue', 'pink'
  createdAt: string;
}

export interface Comment {
  id: string;
  kitabId: string;
  chapterId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

export interface ReadingSchedule {
  id: string;
  email: string;
  dailyGoalMinutes: number;
  activeDays: string[]; // e.g., ['Monday', 'Tuesday']
  reminderTime: string; // e.g., '19:00'
  currentStreak: number;
  lastReadDate?: string; // YYYY-MM-DD
}

// COLLABORATION TYPES
export type CollabRole = 'admin' | 'editor' | 'reviewer' | 'contributor' | 'reader';

export interface CollabDraft {
  id: string;
  kitabId: string;
  kitabTitle: string;
  title: string;
  authorEmail: string;
  authorName: string;
  chapters: Chapter[];
  type?: 'artikel' | 'buku' | 'kitab';
  content?: string;
  createdAt: string;
  updatedAt: string;
  status: 'open' | 'merged' | 'abandoned';
}

export interface CollabDiff {
  type: 'added' | 'deleted' | 'modified';
  chapterId: string;
  chapterTitle: string;
  paragraphId: string;
  oldArabic?: string;
  newArabic?: string;
  oldTranslation?: string;
  newTranslation?: string;
  oldContent?: string;
  newContent?: string;
}

export interface CollabMergeRequest {
  id: string;
  draftId: string;
  kitabId: string;
  kitabTitle: string;
  title: string;
  description: string;
  authorEmail: string;
  authorName: string;
  type?: 'artikel' | 'buku' | 'kitab';
  oldContent?: string;
  newContent?: string;
  status: 'open' | 'review' | 'approved' | 'rejected' | 'merged' | 'closed';
  createdAt: string;
  updatedAt: string;
  diffs: CollabDiff[];
  reviewerEmail?: string;
  reviewerName?: string;
  reviewFeedback?: string;
}

export interface CollabHistory {
  id: string;
  kitabId: string;
  kitabTitle: string;
  userEmail: string;
  userName: string;
  message: string;
  timestamp: string;
  previousChapters: Chapter[];
  mergedChapters: Chapter[];
  type?: 'artikel' | 'buku' | 'kitab';
  previousContent?: string;
  mergedContent?: string;
}

export interface CollabPresence {
  id: string; // userEmail
  userEmail: string;
  userName: string;
  activeKitabId: string;
  activeDraftId?: string;
  editingParagraphId?: string;
  lastActive: string; // ISO string
}

export interface CollabComment {
  id: string;
  mrId?: string;
  kitabId: string;
  draftId?: string;
  chapterId?: string;
  paragraphId?: string;
  authorEmail: string;
  authorName: string;
  content: string;
  parentId?: string; // Threaded replies
  createdAt: string;
}

export interface TreeNode {
  id: string;
  chapter: Chapter;
  children: TreeNode[];
  depth: number;
}

export function buildTree(chapters: Chapter[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Initialize nodes
  chapters.forEach(ch => {
    if (ch && ch.id) {
      map.set(ch.id, {
        id: ch.id,
        chapter: ch,
        children: [],
        depth: 0
      });
    }
  });

  // Link children to parents
  chapters.forEach(ch => {
    if (ch && ch.id) {
      const node = map.get(ch.id)!;
      if (ch.parentId && map.has(ch.parentId)) {
        const parent = map.get(ch.parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  // Calculate depths
  function calculateDepth(node: TreeNode, depth: number) {
    node.depth = depth;
    node.children.forEach(child => calculateDepth(child, depth + 1));
  }
  roots.forEach(r => calculateDepth(r, 0));

  return roots;
}

export function compareHierarchicalNumbers(aStr: string | number, bStr: string | number): number {
  const aParts = String(aStr).split(/[.,]/).map(x => parseInt(x) || 0);
  const bParts = String(bStr).split(/[.,]/).map(x => parseInt(x) || 0);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
}

export function sortChaptersByTree(chapters: Chapter[]): Chapter[] {
  const map = new Map<string, Chapter>();
  const childrenMap = new Map<string, Chapter[]>();
  const roots: Chapter[] = [];

  chapters.forEach(ch => {
    if (ch && ch.id) {
      map.set(ch.id, ch);
      if (ch.parentId) {
        if (!childrenMap.has(ch.parentId)) {
          childrenMap.set(ch.parentId, []);
        }
        childrenMap.get(ch.parentId)!.push(ch);
      } else {
        roots.push(ch);
      }
    }
  });

  // Sort roots and children by hierarchical segment-by-segment values
  roots.sort((a, b) => compareHierarchicalNumbers(a.number, b.number));
  childrenMap.forEach((list) => {
    list.sort((a, b) => compareHierarchicalNumbers(a.number, b.number));
  });

  const result: Chapter[] = [];
  function traverse(ch: Chapter) {
    result.push(ch);
    const children = childrenMap.get(ch.id);
    if (children) {
      children.forEach(traverse);
    }
  }

  roots.forEach(traverse);

  // If there are orphaned nodes (nodes with parentId not existing in the list), append them
  chapters.forEach(ch => {
    if (ch && ch.id && !result.find(r => r.id === ch.id)) {
      result.push(ch);
    }
  });

  return result;
}

export function recalculateHierarchicalNumbers(chapters: Chapter[]): Chapter[] {
  const sorted = sortChaptersByTree(chapters);
  const map = new Map<string, Chapter>();
  const childrenMap = new Map<string, Chapter[]>();
  const roots: Chapter[] = [];

  sorted.forEach(ch => {
    if (ch && ch.id) {
      map.set(ch.id, ch);
      if (ch.parentId) {
        if (!childrenMap.has(ch.parentId)) {
          childrenMap.set(ch.parentId, []);
        }
        childrenMap.get(ch.parentId)!.push(ch);
      } else {
        roots.push(ch);
      }
    }
  });

  const result: Chapter[] = [];

  function assign(ch: Chapter, parentNumStr?: string, index?: number) {
    let numStr = "";
    if (parentNumStr) {
      numStr = `${parentNumStr}.${(index ?? 0) + 1}`;
    } else {
      numStr = `${(index ?? 0) + 1}`;
    }

    const updated = {
      ...ch,
      number: numStr,
      isSubChapter: !!ch.parentId,
      nodeType: ch.nodeType || ""
    };
    result.push(updated);

    const children = childrenMap.get(ch.id);
    if (children) {
      children.forEach((child, idx) => {
        assign(child, numStr, idx);
      });
    }
  }

  roots.forEach((r, idx) => {
    assign(r, undefined, idx);
  });

  // Append any orphaned nodes if they exist
  sorted.forEach(ch => {
    if (ch && ch.id && !result.find(r => r.id === ch.id)) {
      result.push(ch);
    }
  });

  return result;
}

export function migrateChaptersToTree(chapters: Chapter[]): Chapter[] {
  let latestParentId: string | undefined = undefined;
  return (chapters || []).map(ch => {
    const migrated = { ...ch };
    if (!migrated.nodeType) {
      migrated.nodeType = "";
    }
    if (migrated.isSubChapter) {
      if (latestParentId && !migrated.parentId) {
        migrated.parentId = latestParentId;
      }
    } else {
      latestParentId = migrated.id;
    }
    return migrated;
  });
}

