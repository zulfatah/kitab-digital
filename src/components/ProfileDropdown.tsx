/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, User, RefreshCw, Mail, Key, ArrowRight } from 'lucide-react';

export default function ProfileDropdown() {
  const {
    currentUserEmail,
    currentUserName,
    currentUserPhotoURL,
    loginWithGoogle,
    loginUser,
    logoutUser,
    setView,
    setProfileUserEmail
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoogleLogin = async () => {
    setIsSyncing(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) return;
    setManualLoading(true);
    try {
      await loginUser(manualEmail, manualName || 'Pembaca');
      setShowManualForm(false);
      setManualEmail('');
      setManualName('');
    } catch (err) {
      console.error('Manual login error:', err);
    } finally {
      setManualLoading(false);
    }
  };

  // Generate initials for placeholder avatar
  const getInitials = () => {
    if (!currentUserName) return 'P';
    return currentUserName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div id="profile-dropdown-container" className="relative" ref={dropdownRef}>
      {/* Trigger Button - Just the circular profile picture/avatar */}
      <button
        id="btn-profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-full overflow-hidden border border-[#E5E1D8] dark:border-[#3A3A30] hover:ring-2 hover:ring-[#5A5A40]/40 transition-all cursor-pointer flex items-center justify-center bg-[#F5EFE2] dark:bg-[#1E1E1A] focus:outline-none"
        title="Menu Profil"
      >
        {currentUserPhotoURL ? (
          <img
            id="profile-avatar-img"
            src={currentUserPhotoURL}
            alt={currentUserName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-serif font-bold text-xs text-[#5A5A40] dark:text-[#E5E1D8]">
            {getInitials()}
          </div>
        )}
      </button>

      {/* Dropdown Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="profile-dropdown-card"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2.5 w-72 sm:w-80 bg-[#FDFBF7] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl shadow-lg z-50 p-4 space-y-4"
          >
            {currentUserEmail ? (
              /* Signed In Profile View */
              <div id="profile-card-signed-in" className="space-y-3.5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-[#E5E1D8] dark:border-[#3A3A30] flex-shrink-0 bg-[#F5EFE2] dark:bg-[#1E1E1A] flex items-center justify-center">
                    {currentUserPhotoURL ? (
                      <img
                        src={currentUserPhotoURL}
                        alt={currentUserName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-serif font-bold text-sm text-[#5A5A40] dark:text-[#E5E1D8]">
                        {getInitials()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[#333333] dark:text-[#E5E1D8] truncate leading-tight">
                      {currentUserName}
                    </h4>
                    <p className="text-xs text-[#777266] dark:text-[#A8A890] truncate flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 flex-shrink-0 text-[#999488]" />
                      {currentUserEmail}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-[#777266] dark:text-[#A8A890] leading-relaxed">
                  Perpustakaan kitab, catatan sorotan, penanda bab, dan target harian Anda tersinkronisasi otomatis di Cloud.
                </div>

                <div className="pt-1 flex flex-col gap-1.5">
                  <button
                    id="btn-dropdown-my-profile"
                    onClick={() => {
                      setProfileUserEmail(currentUserEmail);
                      setView('profile');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-start gap-2.5 px-3 py-2 text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-[#E5E1D8] dark:hover:bg-[#3A3A30] rounded-lg transition-all cursor-pointer border border-[#E5E1D8]/40 dark:border-[#3A3A30]/40"
                  >
                    <User className="w-3.5 h-3.5 text-[#5A5A40] dark:text-[#E5E1D8]" />
                    <span>Profil Saya & Karya</span>
                  </button>

                  <button
                    id="btn-dropdown-logout"
                    onClick={() => {
                      logoutUser();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/50 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-200/50 dark:border-red-900/30 rounded-lg transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Signed Out/Guest Profile View */
              <div id="profile-card-guest" className="space-y-3.5">
                <div className="pb-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
                  <h4 className="text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wider">
                    Profil Pembaca Tamu
                  </h4>
                  <p className="text-[11px] text-[#777266] dark:text-[#A8A890] mt-1 leading-normal">
                    Masuk untuk menyimpan catatan, target streak, dan karya kitab pribadi Anda di cloud.
                  </p>
                </div>

                {!showManualForm ? (
                  <div className="space-y-2.5">
                    {/* Google Login Button */}
                    <button
                      id="btn-dropdown-google-login"
                      onClick={handleGoogleLogin}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 bg-white hover:bg-neutral-50 dark:bg-[#1E1E1A] dark:hover:bg-[#252520] text-neutral-800 dark:text-neutral-200 font-bold text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 transition-all focus:outline-none shadow-sm cursor-pointer select-none"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#5A5A40]" />
                      ) : (
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                      <span>{isSyncing ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                    </button>

                    <button
                      id="btn-dropdown-toggle-manual"
                      onClick={() => setShowManualForm(true)}
                      className="w-full text-center text-[10px] text-[#5A5A40] dark:text-[#E5E1D8] hover:underline cursor-pointer py-1 font-medium"
                    >
                      Gunakan Masuk Manual (Iframe-safe)
                    </button>
                  </div>
                ) : (
                  /* Manual Login Form as Fallback */
                  <form onSubmit={handleManualLoginSubmit} className="space-y-2.5">
                    <div>
                      <label htmlFor="manual-email-input" className="block text-[10px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1">
                        Alamat Email
                      </label>
                      <input
                        id="manual-email-input"
                        type="email"
                        required
                        placeholder="nama@email.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-name-input" className="block text-[10px] font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1">
                        Nama Pembaca
                      </label>
                      <input
                        id="manual-name-input"
                        type="text"
                        placeholder="Contoh: Ahmad"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        id="btn-manual-cancel"
                        onClick={() => setShowManualForm(false)}
                        className="flex-1 py-1.5 text-xs border border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] dark:text-[#A8A890] rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer text-center font-medium"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        id="btn-manual-submit"
                        disabled={manualLoading}
                        className="flex-1 py-1.5 text-xs bg-[#5A5A40] text-white rounded-md hover:bg-[#4A4A35] cursor-pointer text-center font-bold flex items-center justify-center gap-1"
                      >
                        {manualLoading ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <span>Masuk</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
