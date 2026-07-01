/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Kitab, Bookmark, Annotation, ReadingSchedule, UserPreferences, Chapter, migrateChaptersToTree, sortChaptersByTree } from '../types';
import { dbService, DEFAULT_PREFERENCES, getLocalData, setLocalData } from '../lib/dbService';
import { defaultKitabs } from '../data/defaultKitabs';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'info' | 'warning' | 'schedule';
}

interface AppContextType {
  currentUserEmail: string;
  currentUserName: string;
  currentUserPhotoURL: string;
  loginUser: (email: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logoutUser: () => void;
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  bookmarks: Bookmark[];
  addBookmark: (kitabId: string, chapterId: string) => Promise<void>;
  removeBookmark: (kitabId: string, chapterId: string) => Promise<void>;
  annotations: Annotation[];
  saveAnnotation: (ann: Omit<Annotation, 'id' | 'email'>) => Promise<void>;
  deleteAnnotation: (annotationId: string, paragraphId?: string) => Promise<void>;
  customKitabs: Kitab[];
  saveCustomKitab: (kitab: Kitab) => Promise<void>;
  deleteCustomKitab: (kitabId: string) => Promise<void>;
  allKitabs: Kitab[];
  activeKitab: Kitab | null;
  activeChapter: Chapter | null;
  setActiveKitabId: (id: string | null) => void;
  setActiveChapterId: (id: string | null) => void;
  editingKitabId: string | null;
  setEditingKitabId: (id: string | null) => void;
  view: 'library' | 'reader' | 'writer' | 'schedule' | 'collaboration';
  setView: (v: 'library' | 'reader' | 'writer' | 'schedule' | 'collaboration') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedAuthor: string;
  setSelectedAuthor: (a: string) => void;
  activeSchedule: ReadingSchedule | null;
  saveSchedule: (goalMin: number, activeDays: string[], reminderTime: string) => Promise<void>;
  logReadingActivity: (minutes: number) => Promise<void>;
  toasts: ToastMessage[];
  addToast: (title: string, description: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Session
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => getLocalData('session_email', ''));
  const [currentUserName, setCurrentUserName] = useState<string>(() => getLocalData('session_name', 'Pembaca Tamu'));
  const [currentUserPhotoURL, setCurrentUserPhotoURL] = useState<string>(() => getLocalData('session_photo', ''));

  // App States
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const email = getLocalData('session_email', '');
    return getLocalData<UserPreferences>(`prefs_${email || 'guest'}`, DEFAULT_PREFERENCES);
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [customKitabs, setCustomKitabs] = useState<Kitab[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<ReadingSchedule | null>(null);

  // Navigation
  const [view, setView] = useState<'library' | 'reader' | 'writer' | 'schedule' | 'collaboration'>('library');
  const [activeKitabId, setActiveKitabIdState] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterIdState] = useState<string | null>(null);
  const [editingKitabId, setEditingKitabId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedAuthor, setSelectedAuthor] = useState('Semua');

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 1-to-1 Kitab mappings
  const allKitabs = useMemo(() => {
    return [...defaultKitabs, ...customKitabs].map(kitab => {
      const migratedChapters = migrateChaptersToTree(kitab.chapters || []);
      const sortedChapters = sortChaptersByTree(migratedChapters);
      return {
        ...kitab,
        chapters: sortedChapters.map(ch => ({
          ...ch,
          paragraphs: [...(ch.paragraphs || [])].sort((a, b) => (a.page || 1) - (b.page || 1))
        }))
      };
    });
  }, [customKitabs]);

  const activeKitab = useMemo(() => {
    return allKitabs.find(k => k.id === activeKitabId) || null;
  }, [allKitabs, activeKitabId]);

  const activeChapter = useMemo(() => {
    return activeKitab?.chapters.find(c => c.id === activeChapterId) || null;
  }, [activeKitab, activeChapterId]);

  const setActiveKitabId = (id: string | null) => {
    setActiveKitabIdState(id);
    if (!id) {
      setActiveChapterIdState(null);
    } else {
      const kitab = allKitabs.find(k => k.id === id);
      if (kitab && kitab.chapters.length > 0) {
        setActiveChapterIdState(kitab.chapters[0].id);
      }
    }
  };

  const setActiveChapterId = (id: string | null) => {
    setActiveChapterIdState(id);
  };

  // Toast Management
  const addToast = (title: string, description: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper: Register user profile and get JWT from Express backend
  const registerGoogleLoginAndGetJWT = async (user: any) => {
    try {
      const trimmedEmail = user.email.trim().toLowerCase();
      const cleanName = user.displayName || 'Pembaca Google';
      const photoURL = user.photoURL || '';

      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: trimmedEmail,
          uid: user.uid,
          displayName: cleanName,
          photoURL: photoURL
        })
      });

      if (!res.ok) throw new Error('Failed to register/get JWT on server');
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      return data;
    } catch (e) {
      console.error('Error on JWT registration:', e);
      throw e;
    }
  };

  const registerManualLoginAndGetJWT = async (email: string, name: string) => {
    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          uid: `manual_${email}`,
          displayName: name,
          photoURL: ''
        })
      });

      if (!res.ok) throw new Error('Failed to register/get JWT on server');
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      return data;
    } catch (e) {
      console.error('Error on manual JWT registration:', e);
      throw e;
    }
  };

  // Login dengan Google menggunakan Firebase Auth Popup
  const loginWithGoogle = async () => {
    // Detect if running inside an iframe (like AI Studio preview)
    if (window.self !== window.top) {
      addToast('Peringatan Iframe', 'Login Google mungkin gagal di dalam panel preview. Harap buka aplikasi di tab baru (ikon ↗ di kanan atas) untuk menggunakan login Google.', 'warning');
    }

    addToast('Menghubungkan Google...', 'Membuka jendela masuk Google...', 'info');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user && user.email) {
        const trimmedEmail = user.email.trim().toLowerCase();
        const cleanName = user.displayName || 'Pembaca Google';

        addToast('Menyimpan Profil', 'Mendaftarkan akun dan menyelaraskan data...', 'info');
        
        // Register user and retrieve JWT token
        await registerGoogleLoginAndGetJWT(user);

        // Sinkronkan data lokal tamu ke cloud sebelum beralih profil
        if (!currentUserEmail) {
          await dbService.syncLocalToCloud(trimmedEmail);
        }

        setCurrentUserEmail(trimmedEmail);
        setCurrentUserName(cleanName);
        setCurrentUserPhotoURL(user.photoURL || '');
        setLocalData('session_email', trimmedEmail);
        setLocalData('session_name', cleanName);
        setLocalData('session_photo', user.photoURL || '');

        addToast('Login Berhasil!', `Selamat datang kembali, ${cleanName}!`, 'success');
      }
    } catch (error: any) {
      console.error('Error Google Sign-in:', error);
      addToast('Gagal Login', error.message || 'Proses masuk Google dibatalkan atau gagal.', 'warning');
      throw error;
    }
  };

  // Login / Switch Device Sync (Fallback email login manual)
  const loginUser = async (email: string, name: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || 'Pembaca';

    addToast('Menghubungkan Profil', `Menyelaraskan data lokal ke cloud untuk ${trimmedEmail}...`, 'info');

    try {
      await registerManualLoginAndGetJWT(trimmedEmail, cleanName);

      // Sinkronkan data lokal tamu ke cloud sebelum beralih profil
      if (!currentUserEmail) {
        await dbService.syncLocalToCloud(trimmedEmail);
      }

      setCurrentUserEmail(trimmedEmail);
      setCurrentUserName(cleanName);
      setLocalData('session_email', trimmedEmail);
      setLocalData('session_name', cleanName);

      addToast('Sinkronisasi Sukses', 'Semua kitab kustom, catatan, dan penanda Anda telah disinkronkan otomatis antar perangkat!', 'success');
    } catch (error: any) {
      console.error('Gagal masuk manual:', error);
      addToast('Gagal Sinkronisasi', 'Tidak dapat menghubungkan profil ke server.', 'warning');
    }
  };

  const logoutUser = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out from Firebase Auth:', e);
    }
    setCurrentUserEmail('');
    setCurrentUserName('Pembaca Tamu');
    setCurrentUserPhotoURL('');
    localStorage.removeItem('session_email');
    localStorage.removeItem('session_name');
    localStorage.removeItem('session_photo');
    localStorage.removeItem('auth_token'); // Clear token
    addToast('Profil Terputus', 'Kembali ke mode offline lokal.', 'info');
  };

  // Preferences Update
  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    await dbService.savePreferences(currentUserEmail, updated);
  };

  // Bookmark Actions
  const addBookmark = async (kitabId: string, chapterId: string) => {
    await dbService.addBookmark(currentUserEmail, {
      kitabId,
      chapterId,
      bookmarkedAt: new Date().toISOString()
    });
    addToast('Penanda Ditambahkan', 'Bab berhasil ditambahkan ke daftar bacaan Anda.', 'success');
  };

  const removeBookmark = async (kitabId: string, chapterId: string) => {
    await dbService.removeBookmark(currentUserEmail, kitabId, chapterId);
    addToast('Penanda Dihapus', 'Bab dihapus dari daftar bacaan Anda.', 'info');
  };

  // Annotation (Highlight & Personal Notes) Actions
  const saveAnnotation = async (ann: Omit<Annotation, 'id' | 'email'>) => {
    await dbService.saveAnnotation(currentUserEmail, {
      ...ann,
      createdAt: new Date().toISOString()
    });
    addToast('Catatan Disimpan', 'Sorotan ayat dan catatan pribadi tersimpan aman di cloud.', 'success');
  };

  const deleteAnnotation = async (annotationId: string, paragraphId?: string) => {
    await dbService.deleteAnnotation(
      currentUserEmail,
      annotationId,
      activeKitabId || undefined,
      activeChapterId || undefined,
      paragraphId
    );
    addToast('Catatan Dihapus', 'Catatan pribadi berhasil dihapus.', 'info');
  };

  // Custom Kitab Writer Actions
  const saveCustomKitab = async (kitab: Kitab) => {
    await dbService.saveCustomKitab(currentUserEmail, kitab);
    addToast('Kitab Tersimpan', `"${kitab.title}" berhasil disimpan ke pustaka cloud Anda.`, 'success');
  };

  const deleteCustomKitab = async (kitabId: string) => {
    await dbService.deleteCustomKitab(currentUserEmail, kitabId);
    addToast('Kitab Dihapus', 'Kitab berhasil dihapus dari pustaka.', 'info');
    if (activeKitabId === kitabId) {
      setActiveKitabId(null);
      setView('library');
    }
  };

  // Reading Goals & Streaks Tracker
  const saveSchedule = async (goalMin: number, activeDays: string[], reminderTime: string) => {
    const defaultSch: ReadingSchedule = {
      id: currentUserEmail ? `sch_${currentUserEmail}` : 'sch_guest',
      email: currentUserEmail || 'guest',
      dailyGoalMinutes: goalMin,
      activeDays,
      reminderTime,
      currentStreak: activeSchedule?.currentStreak || 0,
      lastReadDate: activeSchedule?.lastReadDate
    };
    setActiveSchedule(defaultSch);
    await dbService.saveSchedule(currentUserEmail, defaultSch);
    addToast('Jadwal Diperbarui', 'Pengingat membaca harian personal Anda berhasil diaktifkan.', 'schedule');
  };

  // Logging Reading Activity & Updating Streak
  const logReadingActivity = async (minutes: number) => {
    if (!activeSchedule) return;
    const today = new Date().toISOString().split('T')[0];

    let currentStreak = activeSchedule.currentStreak;
    let lastReadDate = activeSchedule.lastReadDate;

    if (lastReadDate !== today) {
      if (lastReadDate) {
        const lastRead = new Date(lastReadDate);
        const diffTime = Math.abs(new Date(today).getTime() - lastRead.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Berurutan
          currentStreak += 1;
        } else if (diffDays > 1) {
          // Putus streak
          currentStreak = 1;
        }
      } else {
        // Pertama kali membaca
        currentStreak = 1;
      }
      lastReadDate = today;

      addToast('Target Membaca Tercapai!', `Luar biasa! Anda mencetak ${currentStreak} hari beruntun membaca kitab suci!`, 'success');
    }

    const updatedSchedule: ReadingSchedule = {
      ...activeSchedule,
      currentStreak,
      lastReadDate
    };

    setActiveSchedule(updatedSchedule);
    await dbService.saveSchedule(currentUserEmail, updatedSchedule);
  };

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // REAL-TIME SUBSCRIBERS ATTACHMENT
  useEffect(() => {
    if (isAuthLoading) return;

    // Preferences Listener
    const unsubPrefs = dbService.subscribePreferences(currentUserEmail, (prefs) => {
      setPreferences(prefs);
    });

    // Bookmarks Listener
    const unsubBookmarks = dbService.subscribeBookmarks(currentUserEmail, (bms) => {
      setBookmarks(bms);
    });

    // Annotations Listener
    const unsubAnns = dbService.subscribeAnnotations(currentUserEmail, (anns) => {
      setAnnotations(anns);
    });

    // Custom Kitabs Listener
    const unsubKitabs = dbService.subscribeCustomKitabs(currentUserEmail, (ktbs) => {
      setCustomKitabs(ktbs);
    });

    // Schedules Listener
    const unsubSchedule = dbService.subscribeSchedule(currentUserEmail, (sch) => {
      setActiveSchedule(sch);
    });

    return () => {
      unsubPrefs();
      unsubBookmarks();
      unsubAnns();
      unsubKitabs();
      unsubSchedule();
    };
  }, [currentUserEmail, isAuthLoading]);

  // Firebase Auth State Observer to restore active session automatically
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const trimmedEmail = user.email.trim().toLowerCase();
        const cleanName = user.displayName || 'Pembaca Google';
        
        try {
          // Register / refresh our backend JWT session automatically
          await registerGoogleLoginAndGetJWT(user);
          
          setCurrentUserEmail(trimmedEmail);
          setCurrentUserName(cleanName);
          setCurrentUserPhotoURL(user.photoURL || '');
          setLocalData('session_email', trimmedEmail);
          setLocalData('session_name', cleanName);
          setLocalData('session_photo', user.photoURL || '');
        } catch (e) {
          console.error('Failed to auto-refresh JWT on load:', e);
        }
      } else {
        setCurrentUserEmail('');
        setCurrentUserName('Pembaca Tamu');
        setCurrentUserPhotoURL('');
        localStorage.removeItem('session_email');
        localStorage.removeItem('session_name');
        localStorage.removeItem('session_photo');
        localStorage.removeItem('auth_token');
      }
      setIsAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // DAILY SCHEDULE REMINDER POLL
  useEffect(() => {
    if (!activeSchedule) return;

    // Check if user should be reminded right now
    const checkReminder = () => {
      const now = new Date();
      const currentDayName = now.toLocaleDateString('id-ID', { weekday: 'long' }); // e.g., 'Senin'
      const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // e.g., '19:00'

      if (
        activeSchedule.activeDays.includes(currentDayName) &&
        activeSchedule.reminderTime === currentTimeStr
      ) {
        // Trigger pengingat harian
        addToast(
          'Waktunya Membaca Kitab 📖',
          `Pengingat Jadwal: Mari luangkan waktu ${activeSchedule.dailyGoalMinutes} menit hari ini untuk mendalami ilmu suci.`,
          'schedule'
        );
      }
    };

    const interval = setInterval(checkReminder, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [activeSchedule]);

  return (
    <AppContext.Provider
      value={{
        currentUserEmail,
        currentUserName,
        currentUserPhotoURL,
        loginUser,
        loginWithGoogle,
        logoutUser,
        preferences,
        updatePreferences,
        bookmarks,
        addBookmark,
        removeBookmark,
        annotations,
        saveAnnotation,
        deleteAnnotation,
        customKitabs,
        saveCustomKitab,
        deleteCustomKitab,
        allKitabs,
        activeKitab,
        activeChapter,
        setActiveKitabId,
        setActiveChapterId,
        editingKitabId,
        setEditingKitabId,
        view,
        setView,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        selectedAuthor,
        setSelectedAuthor,
        activeSchedule,
        saveSchedule,
        logReadingActivity,
        toasts,
        addToast,
        removeToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
