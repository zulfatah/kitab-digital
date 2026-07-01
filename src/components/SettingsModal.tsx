import React from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Moon, Sun, BookOpen, Sliders } from 'lucide-react';
import { ThemeType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { preferences, updatePreferences } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#FDFBF7] dark:bg-[#121210] border border-[#E5E1D8] dark:border-[#3A3A30] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
          <h2 className="text-lg font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] flex items-center gap-2">
            <Sliders className="w-5 h-5" /> Pengaturan
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#E5E1D8] dark:hover:bg-[#3A3A30] rounded-full transition-colors">
            <X className="w-5 h-5 text-[#5A5A40] dark:text-[#E5E1D8]" />
          </button>
        </div>
        
        <div className="p-5 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Theme */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wider">Tema</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'sepia'] as ThemeType[]).map(t => (
                <button
                  key={t}
                  onClick={() => updatePreferences({ theme: t })}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    preferences.theme === t 
                      ? 'border-[#5A5A40] bg-[#F9F6F0] dark:bg-[#181814]' 
                      : 'border-[#E5E1D8] dark:border-[#3A3A30] hover:border-[#5A5A40]/50'
                  }`}
                >
                  {t === 'light' && <Sun className="w-5 h-5 mb-1" />}
                  {t === 'dark' && <Moon className="w-5 h-5 mb-1" />}
                  {t === 'sepia' && <BookOpen className="w-5 h-5 mb-1" />}
                  <span className="text-xs font-medium capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reading Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#5A5A40] dark:text-[#E5E1D8] uppercase tracking-wider">Pengaturan Membaca Default</h3>
            
            <div className="space-y-2">
              <label className="text-xs text-[#777266] dark:text-[#A8A890]">Ukuran Font Arab</label>
              <input 
                type="range" 
                min="10" 
                max="44" 
                step="2" 
                value={preferences.arabicFontSize}
                onChange={(e) => updatePreferences({ arabicFontSize: parseInt(e.target.value) })}
                className="w-full accent-[#5A5A40]"
              />
              <span className="text-xs font-mono">{preferences.arabicFontSize}px</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#777266] dark:text-[#A8A890]">Ukuran Font Terjemahan</label>
              <input 
                type="range" 
                min="13" 
                max="22" 
                step="1" 
                value={preferences.translationFontSize}
                onChange={(e) => updatePreferences({ translationFontSize: parseInt(e.target.value) })}
                className="w-full accent-[#5A5A40]"
              />
              <span className="text-xs font-mono">{preferences.translationFontSize}px</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#777266] dark:text-[#A8A890]">Ukuran Font Syarah / Penjelasan</label>
              <input 
                type="range" 
                min="11" 
                max="24" 
                step="1" 
                value={preferences.explanationFontSize || 14}
                onChange={(e) => updatePreferences({ explanationFontSize: parseInt(e.target.value) })}
                className="w-full accent-[#5A5A40]"
              />
              <span className="text-xs font-mono">{preferences.explanationFontSize || 14}px</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E5E1D8]/60 dark:border-[#3A3A30]/60">
              <div className="space-y-0.5">
                <label className="text-xs text-[#777266] dark:text-[#A8A890] font-medium">Format Syarah Miring (Italic)</label>
                <p className="text-[10px] text-stone-400">Gunakan gaya teks miring untuk teks syarah/penjelasan</p>
              </div>
              <button 
                id="toggle-explanation-italic"
                type="button"
                onClick={() => updatePreferences({ explanationItalic: preferences.explanationItalic !== false ? false : true })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  preferences.explanationItalic !== false ? 'bg-[#5A5A40]' : 'bg-stone-300 dark:bg-stone-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.explanationItalic !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
