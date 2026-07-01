/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kitab, Chapter, Bookmark, Annotation, Comment, ReadingSchedule, UserPreferences, CollabDraft, CollabMergeRequest, CollabHistory, CollabPresence, CollabComment } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Default Preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  arabicFontSize: 28,
  translationFontSize: 16,
  explanationFontSize: 14,
  explanationItalic: true,
  arabicFontFamily: 'Amiri',
  lineSpacing: 'normal'
};

// HELPER: Ambil data lokal jika cloud belum aktif
export const getLocalData = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const setLocalData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Gagal menyimpan ke localStorage', e);
  }
};

// Dynamic client HTTP requests with JWT Token
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }
  return response.json();
}

// Polling helper to simulate Firestore live streams on Express
function pollEndpoint<T>(
  url: string,
  callback: (data: T) => void,
  intervalMs = 3000,
  fallbackValue: T
): () => void {
  let active = true;
  let timerId: any = null;

  const fetchData = async () => {
    if (!active) return;
    try {
      const data = await fetchWithAuth(url);
      if (active) callback(data);
    } catch (e) {
      // If unauthorized or network error, fallback gracefully
      console.warn(`Polling failed for ${url}:`, e);
    } finally {
      if (active) {
        timerId = setTimeout(fetchData, intervalMs);
      }
    }
  };

  // Run first request immediately
  fetchData();

  return () => {
    active = false;
    if (timerId) clearTimeout(timerId);
  };
}

// Express + MySQL DB Service (with JWT security)
export const dbService = {
  // --- USER PREFERENCES ---
  async savePreferences(email: string, prefs: UserPreferences): Promise<void> {
    setLocalData(`prefs_${email || 'guest'}`, prefs);
    if (!email) return;
    try {
      await fetchWithAuth('/api/preferences', {
        method: 'POST',
        body: JSON.stringify(prefs)
      });
    } catch (e) {
      console.error('Gagal sinkronisasi preferences ke server', e);
    }
  },

  subscribePreferences(email: string, callback: (prefs: UserPreferences) => void) {
    if (!email) {
      const local = getLocalData<UserPreferences>('prefs_guest', DEFAULT_PREFERENCES);
      callback(local);
      return () => {};
    }

    return pollEndpoint<UserPreferences>(
      '/api/preferences',
      (data) => {
        setLocalData(`prefs_${email}`, data);
        callback(data);
      },
      4000,
      getLocalData<UserPreferences>(`prefs_${email}`, DEFAULT_PREFERENCES)
    );
  },

  // --- BOOKMARKS ---
  async addBookmark(email: string, bookmark: Omit<Bookmark, 'id' | 'email'>): Promise<string> {
    const localId = `bm_${Date.now()}`;
    const fullBookmark: Bookmark = { ...bookmark, email: email || 'guest', id: localId };

    const localBookmarks = getLocalData<Bookmark[]>(`bookmarks_${email || 'guest'}`, []);
    const exists = localBookmarks.some(b => b.kitabId === bookmark.kitabId && b.chapterId === bookmark.chapterId);
    if (!exists) {
      localBookmarks.push(fullBookmark);
      setLocalData(`bookmarks_${email || 'guest'}`, localBookmarks);
    }

    if (!email) return localId;

    try {
      const res = await fetchWithAuth('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify(fullBookmark)
      });
      return res.bookmark.id;
    } catch (e) {
      console.error('Gagal tambah bookmark ke server', e);
      return localId;
    }
  },

  async removeBookmark(email: string, kitabId: string, chapterId: string): Promise<void> {
    const localBookmarks = getLocalData<Bookmark[]>(`bookmarks_${email || 'guest'}`, []);
    const filtered = localBookmarks.filter(b => !(b.kitabId === kitabId && b.chapterId === chapterId));
    setLocalData(`bookmarks_${email || 'guest'}`, filtered);

    if (!email) return;

    try {
      await fetchWithAuth(`/api/bookmarks?kitabId=${encodeURIComponent(kitabId)}&chapterId=${encodeURIComponent(chapterId)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Gagal hapus bookmark di server', e);
    }
  },

  subscribeBookmarks(email: string, callback: (bookmarks: Bookmark[]) => void) {
    if (!email) {
      const local = getLocalData<Bookmark[]>('bookmarks_guest', []);
      callback(local);
      return () => {};
    }

    return pollEndpoint<Bookmark[]>(
      '/api/bookmarks',
      (data) => {
        setLocalData(`bookmarks_${email}`, data);
        callback(data);
      },
      4000,
      getLocalData<Bookmark[]>(`bookmarks_${email}`, [])
    );
  },

  // --- ANNOTATIONS ---
  async saveAnnotation(email: string, ann: Omit<Annotation, 'id' | 'email'>): Promise<string> {
    const localId = `ann_${Date.now()}`;
    const fullAnn: Annotation = { ...ann, email: email || 'guest', id: localId };

    const localAnns = getLocalData<Annotation[]>(`annotations_${email || 'guest'}`, []);
    const index = localAnns.findIndex(a => a.kitabId === ann.kitabId && a.chapterId === ann.chapterId && a.paragraphId === ann.paragraphId);
    if (index > -1) {
      localAnns[index] = fullAnn;
    } else {
      localAnns.push(fullAnn);
    }
    setLocalData(`annotations_${email || 'guest'}`, localAnns);

    if (!email) return localId;

    try {
      const res = await fetchWithAuth('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(fullAnn)
      });
      return res.annotation.id;
    } catch (e) {
      console.error('Gagal simpan anotasi ke server', e);
      return localId;
    }
  },

  async deleteAnnotation(email: string, annotationId: string, kitabId?: string, chapterId?: string, paragraphId?: string): Promise<void> {
    const localAnns = getLocalData<Annotation[]>(`annotations_${email || 'guest'}`, []);
    let filtered: Annotation[] = [];
    if (annotationId.startsWith('ann_')) {
      filtered = localAnns.filter(a => a.id !== annotationId);
    } else {
      filtered = localAnns.filter(a => !(a.kitabId === kitabId && a.chapterId === chapterId && a.paragraphId === paragraphId));
    }
    setLocalData(`annotations_${email || 'guest'}`, filtered);

    if (!email) return;

    try {
      if (annotationId && !annotationId.startsWith('ann_')) {
        await fetchWithAuth(`/api/annotations/${annotationId}`, {
          method: 'DELETE'
        });
      } else if (kitabId && chapterId && paragraphId) {
        // If it's a guest ID, find the real cloud one from annotations
        const cloudAnns: Annotation[] = await fetchWithAuth('/api/annotations');
        const match = cloudAnns.find(a => a.kitabId === kitabId && a.chapterId === chapterId && a.paragraphId === paragraphId);
        if (match) {
          await fetchWithAuth(`/api/annotations/${match.id}`, {
            method: 'DELETE'
          });
        }
      }
    } catch (e) {
      console.error('Gagal hapus anotasi di server', e);
    }
  },

  subscribeAnnotations(email: string, callback: (anns: Annotation[]) => void) {
    if (!email) {
      const local = getLocalData<Annotation[]>('annotations_guest', []);
      callback(local);
      return () => {};
    }

    return pollEndpoint<Annotation[]>(
      '/api/annotations',
      (data) => {
        setLocalData(`annotations_${email}`, data);
        callback(data);
      },
      4000,
      getLocalData<Annotation[]>(`annotations_${email}`, [])
    );
  },

  // --- WRITE CUSTOM KITABS ---
  async saveCustomKitab(email: string, kitab: Kitab): Promise<void> {
    const localKitabs = getLocalData<Kitab[]>(`custom_kitabs_${email || 'guest'}`, []);
    const index = localKitabs.findIndex(k => k.id === kitab.id);
    if (index > -1) {
      localKitabs[index] = kitab;
    } else {
      localKitabs.push(kitab);
    }
    setLocalData(`custom_kitabs_${email || 'guest'}`, localKitabs);

    if (!email) return;

    try {
      await fetchWithAuth('/api/custom_kitabs', {
        method: 'POST',
        body: JSON.stringify(kitab)
      });
    } catch (e) {
      console.error('Gagal simpan kitab kustom ke server', e);
    }
  },

  async deleteCustomKitab(email: string, kitabId: string): Promise<void> {
    const localKitabs = getLocalData<Kitab[]>(`custom_kitabs_${email || 'guest'}`, []);
    const filtered = localKitabs.filter(k => k.id !== kitabId);
    setLocalData(`custom_kitabs_${email || 'guest'}`, filtered);

    if (!email) return;

    try {
      await fetchWithAuth(`/api/custom_kitabs/${kitabId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Gagal hapus kitab kustom di server', e);
    }
  },

  subscribeCustomKitabs(email: string, callback: (kitabs: Kitab[]) => void) {
    const userEmail = email || "";
    return pollEndpoint<Kitab[]>(
      '/api/custom_kitabs',
      (data) => {
        setLocalData(`custom_kitabs_${userEmail}`, data);
        callback(data);
      },
      5000,
      getLocalData<Kitab[]>(`custom_kitabs_${userEmail}`, [])
    );
  },

  // --- PUBLIC DISCUSSION COMMENTS ---
  async addComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<string> {
    try {
      const res = await fetchWithAuth('/api/comments', {
        method: 'POST',
        body: JSON.stringify(comment)
      });
      return res.comment.id;
    } catch (e) {
      console.error('Gagal menambah komentar ke server', e);
      return `c_${Date.now()}`;
    }
  },

  subscribeComments(kitabId: string, chapterId: string, callback: (comments: Comment[]) => void) {
    return pollEndpoint<Comment[]>(
      `/api/comments?kitabId=${encodeURIComponent(kitabId)}&chapterId=${encodeURIComponent(chapterId)}`,
      (data) => {
        callback(data);
      },
      4000,
      []
    );
  },

  // --- READING SCHEDULES ---
  async saveSchedule(email: string, schedule: ReadingSchedule): Promise<void> {
    setLocalData(`schedule_${email || 'guest'}`, schedule);
    if (!email) return;

    try {
      await fetchWithAuth('/api/reading_schedules', {
        method: 'POST',
        body: JSON.stringify(schedule)
      });
    } catch (e) {
      console.error('Gagal simpan jadwal ke server', e);
    }
  },

  subscribeSchedule(email: string, callback: (schedule: ReadingSchedule | null) => void) {
    const defaultSchedule: ReadingSchedule = {
      id: email ? `sch_${email}` : 'sch_guest',
      email: email || 'guest',
      dailyGoalMinutes: 15,
      activeDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
      reminderTime: '19:00',
      currentStreak: 0
    };

    if (!email) {
      const local = getLocalData<ReadingSchedule>('schedule_guest', defaultSchedule);
      callback(local);
      return () => {};
    }

    return pollEndpoint<ReadingSchedule>(
      '/api/reading_schedules',
      (data) => {
        setLocalData(`schedule_${email}`, data);
        callback(data);
      },
      5000,
      defaultSchedule
    );
  },

  // SINKRONISASI DATA LOKAL KE SERVER SAAT LOGIN
  async syncLocalToCloud(email: string): Promise<void> {
    if (!email) return;

    // 1. Preferences
    const guestPrefs = getLocalData<UserPreferences>('prefs_guest', DEFAULT_PREFERENCES);
    if (JSON.stringify(guestPrefs) !== JSON.stringify(DEFAULT_PREFERENCES)) {
      await this.savePreferences(email, guestPrefs);
    }

    // 2. Bookmarks
    const guestBookmarks = getLocalData<Bookmark[]>('bookmarks_guest', []);
    for (const bm of guestBookmarks) {
      await this.addBookmark(email, {
        kitabId: bm.kitabId,
        chapterId: bm.chapterId,
        bookmarkedAt: bm.bookmarkedAt
      });
    }
    localStorage.removeItem('bookmarks_guest');

    // 3. Annotations
    const guestAnns = getLocalData<Annotation[]>('annotations_guest', []);
    for (const ann of guestAnns) {
      await this.saveAnnotation(email, {
        kitabId: ann.kitabId,
        chapterId: ann.chapterId,
        paragraphId: ann.paragraphId,
        highlightedText: ann.highlightedText,
        note: ann.note,
        color: ann.color,
        createdAt: ann.createdAt
      });
    }
    localStorage.removeItem('annotations_guest');

    // 4. Custom Kitabs
    const guestKitabs = getLocalData<Kitab[]>('custom_kitabs_guest', []);
    for (const k of guestKitabs) {
      await this.saveCustomKitab(email, { ...k, createdBy: email });
    }
    localStorage.removeItem('custom_kitabs_guest');

    // 5. Schedules
    const guestSchedule = localStorage.getItem('schedule_guest');
    if (guestSchedule) {
      try {
        const sch = JSON.parse(guestSchedule) as ReadingSchedule;
        await this.saveSchedule(email, { ...sch, email, id: `sch_${email}` });
        localStorage.removeItem('schedule_guest');
      } catch (e) {}
    }
  },

  // === COLLABORATION API CALLS ===

  async saveCollabDraft(draft: CollabDraft): Promise<void> {
    try {
      await fetchWithAuth('/api/collab/drafts', {
        method: 'POST',
        body: JSON.stringify(draft)
      });
    } catch (e) {
      console.error('Gagal simpan draft kolaborasi ke server', e);
    }
  },

  async deleteCollabDraft(draftId: string): Promise<void> {
    try {
      await fetchWithAuth(`/api/collab/drafts/${draftId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Gagal hapus draft kolaborasi di server', e);
    }
  },

  subscribeCollabDrafts(callback: (drafts: CollabDraft[]) => void) {
    return pollEndpoint<CollabDraft[]>(
      '/api/collab/drafts',
      (data) => {
        callback(data);
      },
      3000,
      []
    );
  },

  async saveMergeRequest(mr: CollabMergeRequest): Promise<void> {
    try {
      await fetchWithAuth('/api/collab/merge_requests', {
        method: 'POST',
        body: JSON.stringify(mr)
      });
    } catch (e) {
      console.error('Gagal simpan merge request ke server', e);
    }
  },

  subscribeMergeRequests(callback: (mrs: CollabMergeRequest[]) => void) {
    return pollEndpoint<CollabMergeRequest[]>(
      '/api/collab/merge_requests',
      (data) => {
        callback(data);
      },
      3000,
      []
    );
  },

  async saveCollabHistory(history: CollabHistory): Promise<void> {
    try {
      await fetchWithAuth('/api/collab/history', {
        method: 'POST',
        body: JSON.stringify(history)
      });
    } catch (e) {
      console.error('Gagal simpan histori kolaborasi ke server', e);
    }
  },

  subscribeCollabHistory(kitabId: string, callback: (history: CollabHistory[]) => void) {
    return pollEndpoint<CollabHistory[]>(
      `/api/collab/history?kitabId=${encodeURIComponent(kitabId)}`,
      (data) => {
        callback(data);
      },
      4000,
      []
    );
  },

  async updateCollabPresence(presence: CollabPresence): Promise<void> {
    try {
      await fetchWithAuth('/api/collab/presence', {
        method: 'POST',
        body: JSON.stringify({
          activeKitabId: presence.activeKitabId,
          activeDraftId: presence.activeDraftId,
          editingParagraphId: presence.editingParagraphId
        })
      });
    } catch (e) {
      console.error('Gagal update kehadiran kolaborasi', e);
    }
  },

  subscribeCollabPresence(kitabId: string, callback: (presences: CollabPresence[]) => void) {
    return pollEndpoint<CollabPresence[]>(
      '/api/collab/presence',
      (data) => {
        // Filter in client by activeKitabId
        const filtered = data.filter(p => p.activeKitabId === kitabId);
        callback(filtered);
      },
      3000,
      []
    );
  },

  async saveCollabComment(comment: CollabComment): Promise<void> {
    try {
      await fetchWithAuth('/api/collab/comments', {
        method: 'POST',
        body: JSON.stringify(comment)
      });
    } catch (e) {
      console.error('Gagal simpan komentar kolaborasi', e);
    }
  },

  subscribeCollabComments(kitabId: string, callback: (comments: CollabComment[]) => void) {
    return pollEndpoint<CollabComment[]>(
      `/api/collab/comments?kitabId=${encodeURIComponent(kitabId)}`,
      (data) => {
        callback(data);
      },
      3000,
      []
    );
  },

  async updateCustomKitabChapters(kitabId: string, chapters: Chapter[]): Promise<void> {
    try {
      // Fetch existing kitab details, then update chapters
      const localKitabs = getLocalData<Kitab[]>('custom_kitabs_guest', []);
      const index = localKitabs.findIndex(k => k.id === kitabId);
      if (index > -1) {
        localKitabs[index].chapters = chapters;
        setLocalData('custom_kitabs_guest', localKitabs);
      }

      const token = localStorage.getItem('auth_token');
      if (token) {
        const kitabs: Kitab[] = await fetchWithAuth('/api/custom_kitabs');
        const kitab = kitabs.find(k => k.id === kitabId);
        if (kitab) {
          kitab.chapters = chapters;
          await fetchWithAuth('/api/custom_kitabs', {
            method: 'POST',
            body: JSON.stringify(kitab)
          });
        }
      }
    } catch (e) {
      console.error('Gagal update bab kitab utama kustom', e);
    }
  }
};
