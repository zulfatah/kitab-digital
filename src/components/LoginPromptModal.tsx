/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Mail, RefreshCw, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'welcome' | 'write';
}

export default function LoginPromptModal({ isOpen, onClose, mode }: LoginPromptModalProps) {
  const {
    loginWithGoogle,
    loginUser,
    preferences
  } = useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsSyncing(true);
    try {
      await loginWithGoogle();
      onClose();
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
      onClose();
    } catch (err) {
      console.error('Manual login error:', err);
    } finally {
      setManualLoading(false);
    }
  };

  const handleSkip = () => {
    if (mode === 'welcome') {
      localStorage.setItem('kitab_reader_skip_login_prompt', 'true');
    }
    onClose();
  };

  const themeClasses = {
    light: 'bg-[#FDFBF7] text-[#333333]',
    dark: 'bg-[#121210] text-[#E5E1D8]',
    sepia: 'bg-[#F5EFE2] text-[#433422]'
  }[preferences.theme] || 'bg-[#FDFBF7] text-[#333333]';

  const modalBgClasses = {
    light: 'bg-[#F9F6F0] border-[#E5E1D8]',
    dark: 'bg-[#181814] border-[#3A3A30]',
    sepia: 'bg-[#EDE6D5] border-[#DCD3BF]'
  }[preferences.theme] || 'bg-[#F9F6F0] border-[#E5E1D8]';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={mode === 'welcome' ? handleSkip : onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className={`relative w-full max-w-md ${modalBgClasses} border rounded-2xl shadow-xl overflow-hidden z-10`}
          >
            {/* Header Motif */}
            <div className="h-1.5 bg-[#5A5A40] w-full" />

            <div className="p-6 sm:p-8 space-y-6">
              {/* Icon & Title */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#5A5A40]/10 flex items-center justify-center mb-1">
                  {mode === 'welcome' ? (
                    <Sparkles className="w-6 h-6 text-[#5A5A40]" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#5A5A40] dark:text-[#E5E1D8]">
                  {mode === 'welcome' ? 'Selamat Datang di Khazanah Digital' : 'Masuk Akun Diperlukan'}
                </h3>
                <p className="text-xs sm:text-sm text-[#777266] dark:text-[#A8A890] leading-relaxed">
                  {mode === 'welcome'
                    ? 'Gabung bersama pembaca lainnya untuk menyimpan progres membaca, target harian harian, catatan sorotan, dan karya naskah pribadi Anda di Cloud secara aman.'
                    : 'Fitur menulis dan menyunting kitab memerlukan akun aktif agar karya draf risalah Anda tersimpan aman secara real-time di database Cloud.'}
                </p>
              </div>

              {/* Action Buttons & Forms */}
              {!showManualForm ? (
                <div className="space-y-3">
                  {/* Google Login Button */}
                  <button
                    id="btn-modal-google-login"
                    onClick={handleGoogleLogin}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-white hover:bg-neutral-50 dark:bg-[#1E1E1A] dark:hover:bg-[#252520] text-neutral-800 dark:text-neutral-200 font-bold text-xs sm:text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 transition-all focus:outline-none shadow-sm cursor-pointer select-none"
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
                    id="btn-modal-toggle-manual"
                    onClick={() => setShowManualForm(true)}
                    className="w-full text-center text-xs text-[#5A5A40] dark:text-[#E5E1D8] hover:underline cursor-pointer py-1 font-semibold"
                  >
                    Gunakan Masuk Manual (Iframe-safe)
                  </button>
                </div>
              ) : (
                /* Manual Form */
                <form onSubmit={handleManualLoginSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="modal-manual-email" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                      Alamat Email
                    </label>
                    <input
                      id="modal-manual-email"
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-manual-name" className="block text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] mb-1.5">
                      Nama Pembaca
                    </label>
                    <input
                      id="modal-manual-name"
                      type="text"
                      placeholder="Contoh: Ahmad"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      id="btn-modal-manual-cancel"
                      onClick={() => setShowManualForm(false)}
                      className="flex-1 py-2 text-xs sm:text-sm border border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] dark:text-[#A8A890] rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer text-center font-medium"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      id="btn-modal-manual-submit"
                      disabled={manualLoading}
                      className="flex-1 py-2 text-xs sm:text-sm bg-[#5A5A40] text-white rounded-lg hover:bg-[#4A4A35] cursor-pointer text-center font-bold flex items-center justify-center gap-1.5"
                    >
                      {manualLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Masuk</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Secondary Close / Skip Actions */}
              {!showManualForm && (
                <div className="pt-2 border-t border-[#E5E1D8] dark:border-[#3A3A30] flex justify-center">
                  <button
                    id="btn-modal-dismiss"
                    onClick={handleSkip}
                    className="text-xs text-[#777266] dark:text-[#A8A890] hover:text-[#5A5A40] font-semibold transition-colors cursor-pointer"
                  >
                    {mode === 'welcome' ? 'Nanti Saja (Mode Tamu)' : 'Batal'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
