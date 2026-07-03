/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Hapus',
  cancelLabel = 'Batal'
}: ConfirmationDialogProps) {
  const { preferences } = useApp();

  const modalBgClasses = {
    light: 'bg-[#F9F6F0] border-[#E5E1D8]',
    dark: 'bg-[#181814] border-[#3A3A30]',
    sepia: 'bg-[#EDE6D5] border-[#DCD3BF]'
  }[preferences.theme] || 'bg-[#F9F6F0] border-[#E5E1D8]';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className={`relative w-full max-w-sm ${modalBgClasses} border rounded-2xl shadow-xl overflow-hidden z-10 p-6 space-y-4`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-serif font-bold text-lg text-[#5A5A40] dark:text-[#E5E1D8]">
                  {title}
                </h3>
                <p className="text-sm text-[#777266] dark:text-[#A8A890] leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#777266] dark:text-[#A8A890] hover:text-[#5A5A40] cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
