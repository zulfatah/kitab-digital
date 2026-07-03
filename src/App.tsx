/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import KitabList from './components/KitabList';
import KitabReader from './components/KitabReader';
import KitabWriter from './components/KitabWriter';
import SchedulerPanel from './components/SchedulerPanel';
import ProfileDropdown from './components/ProfileDropdown';
import ToastContainer from './components/ToastContainer';
import CollaborativeEditor from './components/CollaborativeEditor';
import { BookOpen, Calendar, Plus, Library, Sparkles, Settings, Users } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import UserProfile from './components/UserProfile';
import LoginPromptModal from './components/LoginPromptModal';

function MainLayout() {
  const {
    view,
    setView,
    preferences,
    currentUserEmail,
    currentUserName,
    addToast,
    showLoginPrompt,
    setShowLoginPrompt,
    setEditingKitabId
  } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState(false);

  // Auto show login/welcome prompt for guest users on startup
  React.useEffect(() => {
    const skipped = localStorage.getItem('kitab_reader_skip_login_prompt');
    if (!currentUserEmail && skipped !== 'true') {
      const timer = setTimeout(() => {
        setShowLoginPrompt('welcome');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentUserEmail, setShowLoginPrompt]);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
      addToast('Aplikasi Terinstal', 'Terima kasih telah menginstal Khazanah Digital!', 'success');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [addToast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      addToast(
        'Petunjuk Instalasi',
        'Untuk menginstal: Klik tombol Menu (titik tiga) di browser Anda, lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".',
        'info'
      );
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallBtn(false);
      }
    } catch (err) {
      console.error('Error saat instalasi:', err);
    }
  };

  // Sync dark class on document.documentElement based strictly on preferences.theme
  React.useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  // Map theme variables for full viewport body
  const themeBgClasses = {
    light: 'bg-[#FDFBF7] text-[#333333]',
    dark: 'bg-[#121210] text-[#E5E1D8]',
    sepia: 'bg-[#F5EFE2] text-[#433422]'
  }[preferences.theme] || 'bg-[#FDFBF7] text-[#333333]';

  const cardBgClasses = {
    light: 'bg-[#F9F6F0] border-[#E5E1D8] text-[#333333]',
    dark: 'bg-[#181814] border-[#3A3A30] text-[#E5E1D8]',
    sepia: 'bg-[#EDE6D5] border-[#DCD3BF] text-[#433422]'
  }[preferences.theme] || 'bg-[#F9F6F0] border-[#E5E1D8] text-[#333333]';

  return (
    <div id="app-main-layout" className={`min-h-screen soft-grid-mesh ${themeBgClasses} transition-colors duration-200`}>
      {/* Dynamic Theme class injection for general nesting if needed */}
      <div className={preferences.theme === 'dark' ? 'dark' : ''}>
        {/* Navigation Header */}
        <header id="main-header" className="sticky top-0 z-40 bg-[#FDFBF7]/90 dark:bg-[#121210]/90 backdrop-blur-md border-b border-[#E5E1D8] dark:border-[#3A3A30] transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
            {/* Logo / Brand */}
            <div id="brand-container" className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group min-w-0" onClick={() => setView('library')}>
              <img 
                src="/favicon.png"
                alt="Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 transition-transform duration-300 group-hover:scale-105 active:scale-95 drop-shadow-sm rounded-md" 
              />
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm sm:text-base md:text-lg tracking-tight leading-normal group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                  Khazanah Digital
                </h1>
                <p className="text-[7px] sm:text-[9px] md:text-[10px] text-[#999488] font-medium mt-0.5 uppercase tracking-wider truncate">
                  Menghimpun Ilmu, Menyebarkan Manfaat
                </p>
              </div>
            </div>

            {/* Main Tabs Navigation - Desktop Only */}
            <nav id="main-nav-tabs" className="hidden md:flex items-center gap-1.5">
              {[
                { id: 'library', label: 'Perpustakaan', icon: Library },
                { id: 'schedule', label: 'Target Harian', icon: Calendar },
                ...(currentUserEmail ? [
                  { id: 'writer', label: 'Tulis Karya', icon: Plus },
                  { id: 'collaboration', label: 'Kolaborasi', icon: Users }
                ] : [])
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = view === tab.id || (tab.id === 'library' && view === 'reader');
                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => {
                      if (tab.id === 'writer') {
                        setEditingKitabId(null);
                      }
                      setView(tab.id as any);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer focus:outline-none ${
                      isActive
                        ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-sm'
                        : 'border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#E5E1D8] dark:hover:bg-[#181814] text-[#777266] dark:text-[#A8A890]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Profile Dropdown (Just photo profile) */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-[#5A5A40] dark:text-[#E5E1D8] hover:bg-[#E5E1D8] dark:hover:bg-[#3A3A30] rounded-full transition-colors focus:outline-none"
              >
                <Settings className="w-5 h-5" />
              </button>
              <ProfileDropdown />
            </div>
          </div>
        </header>

        {/* Main Content Stage */}
        <main id="main-content-stage" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 sm:pb-8">
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <LoginPromptModal 
            isOpen={showLoginPrompt !== null} 
            onClose={() => setShowLoginPrompt(null)} 
            mode={showLoginPrompt || 'welcome'} 
          />
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
            {/* View Port: Directory / Active Reader / Writer Form / Schedule */}
            <div className={(view === 'reader' || view === 'profile') ? "xl:col-span-4" : "xl:col-span-3"}>
              {view === 'library' && <KitabList />}
              {view === 'reader' && <KitabReader />}
              {view === 'writer' && <KitabWriter />}
              {view === 'schedule' && <SchedulerPanel />}
              {view === 'collaboration' && <CollaborativeEditor />}
              {view === 'profile' && <UserProfile />}
            </div>

            {/* Right sidebar - only show when not in reader or profile mode */}
            {view !== 'reader' && view !== 'profile' && (
              <div className="space-y-6">
                {/* Helpful Instructions box */}
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
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav id="mobile-bottom-nav" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFBF7]/95 dark:bg-[#121210]/95 backdrop-blur-md border-t border-[#E5E1D8] dark:border-[#3A3A30] py-1 px-2 flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.02)] pb-safe">
          {[
            { id: 'library', label: 'Pustaka', icon: Library },
            { id: 'schedule', label: 'Target', icon: Calendar },
            ...(currentUserEmail ? [
              { id: 'writer', label: 'Tulis', icon: Plus },
              { id: 'collaboration', label: 'Kolaborasi', icon: Users }
            ] : [])
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = view === tab.id || (tab.id === 'library' && view === 'reader');
            return (
              <button
                key={tab.id}
                id={`mobile-nav-tab-${tab.id}`}
                onClick={() => {
                  if (tab.id === 'writer') {
                    setEditingKitabId(null);
                  }
                  setView(tab.id as any);
                }}
                className={`flex flex-col items-center gap-0.5 py-0.5 px-3 rounded-xl transition-all cursor-pointer focus:outline-none ${
                  isActive
                    ? 'text-[#5A5A40] dark:text-[#E5E1D8] font-bold scale-102'
                    : 'text-[#999488] hover:text-[#777266] dark:hover:text-[#A8A890]'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8]' : ''
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Custom in-app alert/toast stacked triggers */}
        <ToastContainer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
