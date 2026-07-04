/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'motion/react';
import { BookOpen, Edit, Trash2, Calendar, ArrowLeft, Loader2, Sparkles, User, FileText, Bookmark, BookCopy, Shield, UserPlus, UserMinus, Mail, Info, Award, Bell, BellRing, CheckCircle, AlertTriangle } from 'lucide-react';
import { Kitab } from '../types';
import ConfirmationDialog from './ConfirmationDialog';
import { checkNotificationPermission, subscribeToPushNotifications, sendTestPushNotification } from '../lib/pushClient';

interface UserProfileData {
  profile: {
    uid?: string;
    email: string;
    displayName: string;
    photoURL?: string;
    createdAt?: string;
    lastLoginAt?: string;
    bio?: string;
    followers?: string[];
    following?: string[];
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

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Mobile navigation tab state
  const [activeMobileTab, setActiveMobileTab] = useState<'works' | 'info'>('works');

  // Native Web Push states
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [subscribingPush, setSubscribingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(isSupported);
      if (isSupported) {
        const perm = await checkNotificationPermission();
        setPushPermission(perm);
      }
    };
    checkSupport();
  }, []);

  const handleEnablePush = async () => {
    setSubscribingPush(true);
    try {
      const success = await subscribeToPushNotifications();
      if (success) {
        setPushPermission('granted');
      } else {
        alert('Gagal mengaktifkan notifikasi. Silakan izinkan notifikasi pada peramban Anda.');
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan saat mengaktifkan notifikasi.');
    } finally {
      setSubscribingPush(false);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const success = await sendTestPushNotification();
      if (!success) {
        alert('Gagal mengirimkan notifikasi uji coba.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestingPush(false);
    }
  };

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
          throw new Error('Server mengembalikan HTML, bukan JSON. Pastikan backend Node.js berjalan dengan benar dan routing /api tidak diblokir.');
        }

        const profileData = await res.json();
        setData(profileData);
        
        // Initialize edit fields
        if (profileData?.profile) {
          setEditName(profileData.profile.displayName || '');
          setEditBio(profileData.profile.bio || '');
        }
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

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('Nama tampilan tidak boleh kosong.');
      return;
    }
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/users/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: editName.trim(),
          bio: editBio.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menyimpan perubahan profil.');
      }

      // Update local state directly
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            displayName: editName.trim(),
            bio: editBio.trim()
          }
        };
      });
      setIsEditingProfile(false);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUserEmail) {
      alert('Silakan masuk log terlebih dahulu untuk mengikuti pengguna ini.');
      return;
    }
    if (!data) return;

    const isCurrentlyFollowing = data.profile.followers?.includes(currentUserEmail);
    const url = isCurrentlyFollowing
      ? `/api/users/unfollow/${encodeURIComponent(data.profile.email)}`
      : `/api/users/follow/${encodeURIComponent(data.profile.email)}`;

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal memperbarui status pengikut.');
      }

      // Update local followers list
      setData(prev => {
        if (!prev) return prev;
        const currentFollowers = prev.profile.followers || [];
        const updatedFollowers = isCurrentlyFollowing
          ? currentFollowers.filter(e => e !== currentUserEmail)
          : [...currentFollowers, currentUserEmail];
        
        return {
          ...prev,
          profile: {
            ...prev.profile,
            followers: updatedFollowers
          }
        };
      });
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan.');
    }
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

  const sortedKitabs = React.useMemo(() => {
    if (!data || !data.kitabs) return [];
    return [...data.kitabs].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [data]);

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
  const isFollowing = currentUserEmail && profile.followers?.includes(currentUserEmail);

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
      {/* Back Button & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          id="btn-profile-back"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:opacity-80 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        
        {isMe ? (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-800/30">
              Profil Anda
            </span>
            {!isEditingProfile && (
              <button
                onClick={() => {
                  setEditName(profile.displayName || '');
                  setEditBio(profile.bio || '');
                  setIsEditingProfile(true);
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#1C1C18] hover:bg-stone-50 dark:hover:bg-[#252520] transition-all flex items-center gap-1 text-[#5A5A40] dark:text-[#E5E1D8] cursor-pointer shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Profil
              </button>
            )}
          </div>
        ) : (
          currentUserEmail && (
            <button
              onClick={handleFollowToggle}
              className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isFollowing
                  ? 'bg-stone-100 dark:bg-[#3A3A30] text-stone-600 dark:text-[#E5E1D8] border border-stone-200 dark:border-[#4A4A3C] hover:bg-stone-200 dark:hover:bg-[#4A4A3C]'
                  : 'bg-[#5A5A40] hover:bg-[#484833] text-white'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Batal Mengikuti</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Ikuti Penulis</span>
                </>
              )}
            </button>
          )
        )}
      </div>

      {/* Main Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`border p-6 sm:p-8 rounded-2xl shadow-sm ${themeStyles.card} relative overflow-hidden`}
      >
        <div className="absolute right-0 top-0 w-36 h-36 bg-radial from-[#5A5A40]/10 to-transparent rounded-full -mr-8 -mt-8 opacity-70 pointer-events-none" />
        
        {isEditingProfile ? (
          <div className="relative z-10 space-y-4">
            <h3 className="text-base font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 flex items-center gap-1.5">
              <Edit className="w-4 h-4" /> Sunting Profil Anda
            </h3>
            <div className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 dark:text-stone-500">Nama Tampilan</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#1C1C18] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] text-[#333333] dark:text-[#E5E1D8]"
                  placeholder="Masukkan nama tampilan Anda"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 dark:text-stone-500">Biografi Singkat (Maks. 160 Karakter)</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#1C1C18] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] text-[#333333] dark:text-[#E5E1D8] h-20 resize-none"
                  placeholder="Ceritakan sedikit tentang diri Anda kepada halaqah khazanah..."
                  maxLength={160}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-stone-50 dark:hover:bg-[#1C1C18] text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Perubahan</span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between relative z-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 flex-1">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#5A5A40]/30 flex-shrink-0 bg-[#F5EFE2] dark:bg-[#1C1C18] flex items-center justify-center shadow-inner relative group">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-serif font-bold text-2xl text-[#5A5A40] dark:text-[#E5E1D8]">
                    {getInitials(profile.displayName)}
                  </span>
                )}
              </div>

              <div className="space-y-2 flex-1 w-full">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#333333] dark:text-[#E5E1D8] flex items-center justify-center sm:justify-start gap-1.5">
                    {profile.displayName}
                    <Award className="w-4 h-4 text-amber-500" title="Mufassir Terverifikasi" />
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                    <Mail className="w-3 h-3" /> {profile.email}
                  </p>
                </div>
                
                <p className="text-[11px] text-[#777266] dark:text-[#A8A890] flex items-center justify-center sm:justify-start gap-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>Bergabung pada {joinDate}</span>
                </p>

                {/* Biography Section */}
                <div className="pt-2.5 mt-2.5 border-t border-dashed border-[#E5E1D8]/60 dark:border-[#3A3A30]/60 max-w-xl text-center sm:text-left">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mb-0.5">Biografi Singkat</span>
                  <p className="text-xs text-stone-600 dark:text-stone-300 italic leading-relaxed">
                    "{profile.bio || (isMe ? 'Anda belum menambahkan biografi singkat. Klik "Edit Profil" untuk menyapa pembaca.' : 'Penulis belum menulis biografi singkat.')}"
                  </p>
                </div>
              </div>
            </div>

            {/* Core User Stats - Beautifully laid out grid on mobile */}
            <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:gap-6 border-t md:border-t-0 border-dashed border-[#E5E1D8]/60 dark:border-[#3A3A30]/60 pt-5 md:pt-0">
              <div className="text-center md:text-right bg-[#5A5A40]/5 dark:bg-[#E5E1D8]/5 md:bg-transparent md:dark:bg-transparent p-3 md:p-0 rounded-xl border border-[#E5E1D8]/30 md:border-none dark:border-[#3A3A30]/30">
                <span className="block text-lg sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                  {kitabs.length}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">
                  {isMe ? 'Karya Anda' : 'Karya Publik'}
                </span>
              </div>
              
              <div className="text-center md:text-right bg-[#5A5A40]/5 dark:bg-[#E5E1D8]/5 md:bg-transparent md:dark:bg-transparent p-3 md:p-0 rounded-xl border border-[#E5E1D8]/30 md:border-none dark:border-[#3A3A30]/30 md:border-l md:border-dashed md:border-[#E5E1D8] md:dark:border-[#3A3A30] md:pl-6">
                <span className="block text-lg sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                  {profile.followers?.length || 0}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">
                  Pengikut
                </span>
              </div>

              <div className="text-center md:text-right bg-[#5A5A40]/5 dark:bg-[#E5E1D8]/5 md:bg-transparent md:dark:bg-transparent p-3 md:p-0 rounded-xl border border-[#E5E1D8]/30 md:border-none dark:border-[#3A3A30]/30 md:border-l md:border-dashed md:border-[#E5E1D8] md:dark:border-[#3A3A30] md:pl-6">
                <span className="block text-lg sm:text-2xl font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                  {profile.following?.length || 0}
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-stone-400 block mt-0.5">
                  Mengikuti
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Segmented control for mobile tab switching (lg:hidden) */}
      <div className="flex lg:hidden border border-[#E5E1D8]/60 dark:border-[#3A3A30]/60 p-1 bg-stone-100/40 dark:bg-[#181814]/40 rounded-xl">
        <button
          onClick={() => setActiveMobileTab('works')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeMobileTab === 'works'
              ? 'bg-white dark:bg-[#252520] text-[#5A5A40] dark:text-[#E5E1D8] shadow-xs border border-stone-200/50 dark:border-stone-800/40'
              : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Karya Tulis ({kitabs.length})</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('info')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeMobileTab === 'info'
              ? 'bg-white dark:bg-[#252520] text-[#5A5A40] dark:text-[#E5E1D8] shadow-xs border border-stone-200/50 dark:border-stone-800/40'
              : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Info & Statistik</span>
        </button>
      </div>

      {/* Grid: Layout splitting karya and category stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Categories & Info (visible on mobile only when activeMobileTab is 'info') */}
        <div className={`lg:col-span-1 space-y-6 ${activeMobileTab === 'info' ? 'block' : 'hidden lg:block'}`}>
          {/* Sebaran Kategori Card */}
          <div className={`border p-5 rounded-xl ${themeStyles.card} space-y-4 shadow-2xs`}>
            <h3 className="font-serif font-bold text-sm border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 text-[#333333] dark:text-[#E5E1D8] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" /> Sebaran Kategori
            </h3>
            {Object.keys(categoriesCount).length === 0 ? (
              <p className="text-xs text-stone-500 italic">Belum ada kategori yang dipublikasikan.</p>
            ) : (
              <div className="space-y-3.5">
                {Object.entries(categoriesCount).map(([cat, count]) => {
                  const percentage = Math.round((Number(count) / kitabs.length) * 100);
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-stone-700 dark:text-stone-300 font-medium">{cat}</span>
                        <span className="text-stone-500 font-serif text-[11px]">{count} Kitab ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-[#252520] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#5A5A40] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Informasi Penulis Card */}
          <div className={`border p-5 rounded-xl ${themeStyles.card} space-y-3.5 shadow-2xs text-xs`}>
            <h3 className="font-serif font-bold text-sm border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 text-[#333333] dark:text-[#E5E1D8] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#5A5A40]" /> Informasi Penulis
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between py-1.5 border-b border-stone-100/50 dark:border-stone-800/40">
                <span className="text-stone-400">Kontak Publik</span>
                <span className="font-medium text-[#333333] dark:text-[#E5E1D8] font-mono text-[11px]">{profile.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100/50 dark:border-stone-800/40">
                <span className="text-stone-400">Status Akun</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Terverifikasi
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-stone-400">Tipe Lisensi</span>
                <span className="font-medium text-stone-700 dark:text-stone-300">Creative Commons</span>
              </div>
            </div>
          </div>

          {/* Web Push Native Settings Card */}
          {isMe && (
            <div className={`border p-5 rounded-xl ${themeStyles.card} space-y-4 shadow-2xs text-xs`}>
              <h3 className="font-serif font-bold text-sm border-b border-dashed border-[#E5E1D8] dark:border-[#3A3A30] pb-2 text-[#333333] dark:text-[#E5E1D8] flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> Notifikasi Perangkat
              </h3>
              
              <p className="text-stone-500 dark:text-stone-400 leading-relaxed text-[11px]">
                Aktifkan push notification native untuk menerima pengingat jadwal membaca harian, pemberitahuan pengikut baru, dan kolaborasi secara instan langsung di perangkat ini.
              </p>

              {!pushSupported ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/40">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Tidak Didukung</p>
                    <p className="text-[10px] mt-0.5">Peramban atau sistem operasi Anda saat ini tidak mendukung push notification native.</p>
                  </div>
                </div>
              ) : pushPermission === 'granted' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-800 dark:text-emerald-300">Notifikasi Aktif</p>
                      <p className="text-[10px] mt-0.5">Perangkat ini siap menerima pemberitahuan instan.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleTestPush}
                    disabled={testingPush}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#5A5A40] text-white hover:bg-[#484833] font-bold text-xs cursor-pointer transition-all disabled:opacity-50 shadow-2xs"
                  >
                    {testingPush ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mengirimkan Tes...</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-3.5 h-3.5 animate-pulse" />
                        <span>Kirim Notifikasi Uji Coba</span>
                      </>
                    )}
                  </button>
                </div>
              ) : pushPermission === 'denied' ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/40">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Izin Ditolak</p>
                    <p className="text-[10px] mt-0.5">Izin notifikasi telah ditolak sebelumnya. Silakan atur ulang izin notifikasi pada bilah alamat peramban Anda untuk mengaktifkan kembali.</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleEnablePush}
                  disabled={subscribingPush}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#5A5A40] text-white hover:bg-[#484833] font-bold text-xs cursor-pointer transition-all disabled:opacity-50 shadow-2xs"
                >
                  {subscribingPush ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengaktifkan...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>Aktifkan Notifikasi di Perangkat</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column: List of Published Works (visible on mobile only when activeMobileTab is 'works') */}
        <div className={`lg:col-span-2 space-y-4 ${activeMobileTab === 'works' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-[#333333] dark:text-[#E5E1D8] flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-[#5A5A40] dark:text-[#E5E1D8]" />
              Daftar Karya Tulis ({kitabs.length})
            </h3>
          </div>

          {kitabs.length === 0 ? (
            <div className={`border p-12 text-center rounded-xl ${themeStyles.card} border-dashed`}>
              <BookCopy className="w-10 h-10 text-stone-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300">Belum Ada Karya Tulis</p>
              <p className="text-xs text-stone-400 mt-1">Karya yang ditulis akan tampil di sini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedKitabs.map((kitab, index) => {
                const firstChapter = kitab.chapters && kitab.chapters.length > 0 ? kitab.chapters[0] : undefined;
                return (
                  <motion.div
                    key={kitab.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border p-5 rounded-xl ${themeStyles.card} shadow-2xs hover:shadow-md transition-all space-y-3.5 relative group`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5">
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
                        <p className="text-xs text-stone-400 font-serif italic">
                          Oleh {kitab.author}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-start">
                        {isMe && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingKitabId(kitab.id);
                                setView('writer');
                              }}
                              className="text-stone-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/10 p-2 rounded-lg transition-all focus:outline-none cursor-pointer"
                              title="Edit Karya"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmation({ isOpen: true, kitabId: kitab.id, title: kitab.title });
                              }}
                              className="text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg transition-all focus:outline-none cursor-pointer"
                              title="Hapus Karya"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => handleReadKitab(kitab.id, firstChapter?.id)}
                          className="px-4 py-2 rounded-lg bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Baca</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2">
                      {kitab.description || 'Tidak ada deskripsi singkat untuk naskah karya tulis ini.'}
                    </p>
                    <div className="pt-2.5 border-t border-stone-100/60 dark:border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-[#5A5A40]" />
                          {kitab.chapters?.length || 0} Bab
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
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
