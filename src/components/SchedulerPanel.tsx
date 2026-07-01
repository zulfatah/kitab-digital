/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Clock, Calendar, Flame, AlertCircle, Save, CheckCircle, BellRing, Target } from 'lucide-react';

export default function SchedulerPanel() {
  const { activeSchedule, saveSchedule, addToast } = useApp();

  const [dailyGoal, setDailyGoal] = useState(15);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState('19:00');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with active schedule when loaded
  useEffect(() => {
    if (activeSchedule) {
      setDailyGoal(activeSchedule.dailyGoalMinutes);
      setSelectedDays(activeSchedule.activeDays);
      setReminderTime(activeSchedule.reminderTime);
    }
  }, [activeSchedule]);

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      addToast('Hari Kosong', 'Silakan pilih minimal satu hari untuk pengingat membaca harian.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await saveSchedule(dailyGoal, selectedDays, reminderTime);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
  const isTodayScheduled = selectedDays.includes(today);

  return (
    <div id="scheduler-panel-container" className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-[#5A5A40] text-[#F9F6F0] rounded-xl p-6 relative overflow-hidden shadow-none">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent)]"></div>
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-white/10 border border-white/10 text-[#FDFBF7] uppercase tracking-wider mb-3">
            <BellRing className="w-3.5 h-3.5" /> Pengingat Harian Personal
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight mb-2">
            Bangun Kebiasaan Membaca Setiap Hari
          </h2>
          <p className="text-xs text-[#E5E1D8] leading-relaxed">
            Atur target membaca harian Anda, pilih jadwal hari mengkaji, dan aktifkan notifikasi suara serta visual otomatis agar Anda tetap konsisten dalam meraih keberkahan ilmu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2. Streak Dashboard Status (Left) */}
        <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-5">
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> Statistik Konsistensi
          </h3>

          {/* Current Streak Indicator */}
          <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/15 p-4 rounded-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#5A5A40] text-[#FDFBF7] flex items-center justify-center flex-shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-[#5A5A40] dark:text-[#A8A890] font-bold uppercase tracking-wider">
                Hari Beruntun (Streak)
              </p>
              <p className="text-xl font-bold text-[#333333] dark:text-[#E5E1D8] mt-0.5">
                {activeSchedule?.currentStreak || 0} Hari 🔥
              </p>
            </div>
          </div>

          {/* Daily Status details */}
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
              <span className="text-[#777266] dark:text-[#A8A890]">Status Membaca Hari Ini ({today}):</span>
              {activeSchedule?.lastReadDate === new Date().toISOString().split('T')[0] ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Selesai ✓
                </span>
              ) : isTodayScheduled ? (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Belum Membaca
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#E5E1D8] dark:bg-[#3A3A30] text-[#777266] dark:text-[#A8A890]">
                  Libur Belajar
                </span>
              )}
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#E5E1D8] dark:border-[#3A3A30]">
              <span className="text-[#777266] dark:text-[#A8A890]">Target Harian:</span>
              <span className="font-bold text-[#333333] dark:text-[#E5E1D8]">{dailyGoal} Menit</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-[#777266] dark:text-[#A8A890]">Waktu Pengingat:</span>
              <span className="font-bold text-[#333333] dark:text-[#E5E1D8]">{reminderTime} WIB</span>
            </div>
          </div>
        </div>

        {/* 3. Scheduler Form Configuration (Middle & Right) */}
        <div className="md:col-span-2 bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-5 shadow-none space-y-6">
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" /> Konfigurasi Jadwal
          </h3>

          {/* 3.1. Minutes Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label htmlFor="input-range-daily-goal" className="text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8]">
                Target Membaca Harian (Menit)
              </label>
              <span className="text-xs font-bold bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8] px-2.5 py-1 rounded-lg">
                {dailyGoal} Menit / Hari
              </span>
            </div>
            <input
              id="input-range-daily-goal"
              type="range"
              min="5"
              max="60"
              step="5"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(parseInt(e.target.value))}
              className="w-full accent-[#5A5A40] cursor-pointer"
            />
            <p className="text-[10px] text-[#999488]">
              Pilih waktu minimal membaca. Sedikit namun konsisten (istiqomah) lebih dicintai oleh Allah SWT daripada banyak namun terputus.
            </p>
          </div>

          {/* 3.2. Alarm Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label htmlFor="input-reminder-time" className="text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] block">
                Pilih Jam Pengingat Harian
              </label>
              <input
                id="input-reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] w-full"
              />
            </div>
            <div className="bg-[#FDFBF7] dark:bg-[#121210] p-3 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] flex items-start gap-2 text-[10px] text-[#999488]">
              <AlertCircle className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8] flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Setiap hari pada pukul <strong className="text-[#333333] dark:text-[#E5E1D8]">{reminderTime}</strong>, aplikasi akan memunculkan spanduk audio visual secara halus di layar Anda untuk mengajak mulai beribadah membaca kitab.
              </p>
            </div>
          </div>

          {/* 3.3. Active Days Checklist */}
          <div className="space-y-2.5 pt-2">
            <span className="text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] block">
              Pilih Hari Membaca Kitab
            </span>
            <div id="days-selector-grid" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    id={`day-btn-${day.toLowerCase()}`}
                    onClick={() => toggleDay(day)}
                    className={`text-xs py-2 rounded-lg font-bold border text-center transition-all focus:outline-none cursor-pointer ${
                      isSelected
                        ? 'bg-[#5A5A40] border-[#5A5A40] text-white font-bold shadow-none'
                        : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#777266] dark:text-[#A8A890] hover:bg-[#F0ECE1]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3.4. Save Button */}
          <div className="border-t border-[#E5E1D8] dark:border-[#3A3A30] pt-4 flex justify-end">
            <button
              id="btn-save-schedule"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#454530] disabled:bg-slate-400 text-white font-bold text-xs rounded-lg shadow-none focus:outline-none transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Jadwal Membaca'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
