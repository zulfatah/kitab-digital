/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'motion/react';
import { BookOpen, Edit, Trash2, Calendar, ArrowLeft, Loader2, Sparkles, User, FileText, Bookmark, BookCopy, Shield } from 'lucide-react';
import { Kitab } from '../types';
import ConfirmationDialog from './ConfirmationDialog';

interface UserProfileData {
  profile: {
    uid?: string;
    email: string;
    displayName: string;
    photoURL?: string;
    createdAt?: string;
    lastLoginAt?: string;
  };
  kitabs: Kitab[];
}

export default function UserProfile() {
  const [editingKitabId, setEditingKitabId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; kitabId: string; title: string } | null>(null);

  const {
    profileUserEmail,
    setProfileUserEmail,
    setView,
    setActiveKitabId,
    setActiveChapterId,
    currentUserEmail,
    preferences,
    setEditingKitabId: setAppEditingKitabId,
    deleteCustomKitab
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserProfileData | null>(null);

  useEffect(() => {
    if (!profileUserEmail) {
      setError('Email pengguna tidak valid');
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`/api/users/profile/${encodeURIComponent(profileUserEmail)}`, {
          headers
        });

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Profil pengguna belum terdaftar atau tidak memiliki karya publik.');
          }
          throw new Error('Gagal mengambil informasi profil pengguna.');
        }

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          throw new Error('Server mengembalikan HTML, bukan JSON. Pastikan backend Node.js berjalan dengan benar di VPS Anda dan routing /api tidak diblokir oleh Nginx/server statis.');
        }

        const profileData = await res.json();
        setData(profileData);
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat memuat profil.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [profileUserEmail]);

  const handleBack = () => {
    setProfileUserEmail(null);
    setView('library');
  };

  const handleReadKitab = (kitabId: string, firstChapterId?: string) => {
    setActiveKitabId(kitabId);
    if (firstChapterId) {
      setActiveChapterId(firstChapterId);
    } else {
      setActiveChapterId(null);
    }
    setView('reader');
  };

  // Theme matching styles
  const isDark = preferences.theme === 'dark';
  const isSepia = preferences.theme === 'sepia';

  const themeStyles = {
    card: isDark 
      ? 'bg-[#181814] border-[#3A3A30] text-[#E5E1D8]' 
      : isSepia 
        ? 'bg-[#F4ECD8] border-[#DCD0B4] text-[#433422]' 
        : 'bg-white border-[#E5E1D8] text-[#333333]',
    accentText: isDark 
      ? 'text-[#E5E1D8]' 
      : 'text-[#5A5A40]',
    secondaryText: isDark 
      ? 'text-stone-400' 
      : 'text-stone-600',
    titleFont: 'font-serif font-bold',
    badge: isDark
      ? 'bg-[#3A3A30] text-[#E5E1D8]'
      : 'bg-[#F5EFE2] text-[#5A5A40]'
  };

  if (loading) {
    return (
      <div id="profile-loading" className="flex flex-col items-center justify-center min-h-[60vh] py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40] dark:text-[#E5E1D8] mb-3" />
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Memuat profil penulis...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div id="profile-error" className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className={`p-8 rounded-xl border border-dashed ${themeStyles.card} space-y-4`}>
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto">
            <User className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-base font-bold">Gagal Memuat Profil</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">{error || 'Data profil tidak tersedia.'}</p>
          <button
            id="btn-error-back"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#5A5A40] text-white hover:bg-[#484833] text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Perpustakaan
          </button>
        </div>
      </div>
    );
  }

  const { profile, kitabs } = data;
  const isMe = currentUserEmail && currentUserEmail.toLowerCase() === profile.email.toLowerCase();

  // Extract initials for avatar placeholder
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Group kitabs by category
  const categoriesCount = kitabs.reduce((acc: Record<string, number>, k) => {
    acc[k.category] = (acc[k.category] || 0) + 1;
    return acc;
  }, {});

  const joinDate = profile.createdAt 
    ? new Date(profile.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Anggota Baru';

  return (
    <div id="user-profile-view" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          id="btn-profile-back"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:underline focus:outline-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        {isMe && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-800/30">
            Profil Anda
          </span>
        )}
      </div>

      {/* Main Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`border p-6 sm:p-8 rounded-2xl shadow-xs ${themeStyles.card} relative overflow-hidden`}
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-radial from-[#5A5A40]/10 to-transparent rounded-full -mr-8 -mt-8 opacity-60 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#5A5A40]/20 flex-shrink-0 bg-[#F5EFE2] dark:bg-[#1E1E1A] flex items-center justify-center">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-serif font-bold text-lg sm:text-2xl text-[#5A5A40] dark:text-[#E5E1D8]">
                  {getInitials(profile.displayName)}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#333333] dark:text-[#E5E1D8] flex items-center gap-1.5">
                {profile.displayName}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {profile.email}
              </p>
              <p className="text-[11px] text-[#777266] dark:text-[#A8A890] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Bergabung pada {joinDate}</span>
              </p>
            </div>
          </div>

          {/* Core User Stats */}
          <div className="flex gap-4 sm:gap-6 border-t md:border-t-0 border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pt-4 md:pt-0">
            <div className="text-center md:text-right">
              <span className="block text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                {kitabs.length}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                {isMe ? 'Karya Anda' : 'Karya Publik'}
              </span>
            </div>
            <div className="text-center md:text-right border-l border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pl-4 sm:pl-6">
              <span className="block text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                {kitabs.reduce((acc: number, k) => acc + (k.chapters?.length || 0), 0)}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                Total Bab
              </span>
            </div>
            <div className="text-center md:text-right border-l border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pl-4 sm:pl-6">
              <span className="block text-xl sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                {Object.keys(categoriesCount).length}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                Kategori
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid: Layout splitting karya and category stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Categories & Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`border p-5 rounded-xl ${themeStyles.card} space-y-4 shadow-xs`}>
            <h3 className="font-serif font-bold text-sm border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 text-[#333333] dark:text-[#E5E1D8]">
              Sebaran Kategori
            </h3>
            {Object.keys(categoriesCount).length === 0 ? (
              <p className="text-xs text-stone-500 italic">Belum ada kategori yang dipublikasikan.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(categoriesCount).map(([cat, count]) => {
                  const percentage = Math.round((Number(count) / kitabs.length) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-stone-700 dark:text-stone-300">{cat}</span>
                        <span className="text-stone-500 font-serif">{count} Kitab ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-[#252520] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#5A5A40] h-full rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`border p-5 rounded-xl ${themeStyles.card} space-y-3.5 shadow-xs text-xs`}>
            <h3 className="font-serif font-bold text-sm border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 text-[#333333] dark:text-[#E5E1D8]">
              Informasi Penulis
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-1 border-b border-stone-100/50 dark:border-stone-800/40">
                <span className="text-stone-400">Kontak Publik</span>
                <span className="font-medium text-[#333333] dark:text-[#E5E1D8]">{profile.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-100/50 dark:border-stone-800/40">
                <span className="text-stone-400">Status Akun</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Terverifikasi
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-stone-400">Tipe Lisensi</span>
                <span className="font-medium text-stone-700 dark:text-stone-300">Creative Commons</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: List of Published Works */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-[#333333] dark:text-[#E5E1D8] flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-[#5A5A40] dark:text-[#E5E1D8]" />
              Daftar Karya Tulis ({kitabs.length})
            </h3>
          </div>

          {kitabs.length === 0 ? (
            <div className={`border p-12 text-center rounded-xl ${themeStyles.card} border-dashed`}>
              <BookCopy className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300">Belum Ada Karya Tulis</p>
              <p className="text-xs text-stone-400 mt-1">Karya yang ditulis akan tampil di sini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {kitabs.map((kitab, index) => {
                const firstChapter = kitab.chapters && kitab.chapters.length > 0 ? kitab.chapters[0] : undefined;
                return (
                  <motion.div
                    key={kitab.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border p-5 rounded-xl ${themeStyles.card} shadow-xs hover:shadow-md transition-all space-y-3 relative group`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${themeStyles.badge}`}>
                            {kitab.category}
                          </span>
                          {isMe && (
                            <>
                              {kitab.isPublic ? (
                                <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                                  Publik
                                </span>
                              ) : (
                                <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                                  Privat
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <h4 className="font-serif font-bold text-[#333333] dark:text-[#E5E1D8] text-base group-hover:text-[#5A5A40] dark:group-hover:text-[#FDFBF7] transition-colors mt-1.5">
                          {kitab.title}
                        </h4>
                        <p className="text-xs text-stone-400 font-serif italic mt-0.5">
                          Oleh {kitab.author}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        {isMe && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingKitabId(kitab.id);
                                setView('writer');
                              }}
                              className="text-stone-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/10 p-1.5 rounded-lg transition-all focus:outline-none cursor-pointer"
                              title="Edit Karya"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmation({ isOpen: true, kitabId: kitab.id, title: kitab.title });
                              }}
                              className="text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg transition-all focus:outline-none cursor-pointer"
                              title="Hapus Karya"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => handleReadKitab(kitab.id, firstChapter?.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer w-full sm:w-auto mt-2 sm:mt-0"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Baca</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2">
                      {kitab.description || 'Tidak ada deskripsi singkat untuk naskah karya tulis ini.'}
                    </p>
                    <div className="pt-2 border-t border-stone-100/60 dark:border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {kitab.chapters?.length || 0} Bab
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          {kitab.collaborators?.length || 0} Kolaborator
                        </span>
                      </div>
                      <span>Dibuat: {kitab.createdAt ? new Date(kitab.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' }) : '-'}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ConfirmationDialog
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        onConfirm={() => {
          if (deleteConfirmation) {
            deleteCustomKitab(deleteConfirmation.kitabId).then(() => {
              // Refresh local state if needed
              setData(prev => prev ? { ...prev, kitabs: prev.kitabs.filter(k => k.id !== deleteConfirmation.kitabId) } : prev);
            });
          }
        }}
        title="Hapus Karya Tulis"
        message={`Apakah Anda yakin ingin menghapus karya tulis "${deleteConfirmation?.title}"?`}
      />
    </div>
  );
}
