/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../contexts/AppContext';
import { X, CheckCircle, Info, AlertTriangle, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div id="toast-container" className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-2 sm:gap-3 max-w-none sm:max-w-sm w-auto sm:w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          const bgColors = {
            success: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-800 dark:text-emerald-200',
            info: 'bg-[#5A5A40]/10 border-[#5A5A40]/20 text-[#5A5A40] dark:text-[#E5E1D8]',
            warning: 'bg-amber-500/15 border-amber-500/25 text-amber-800 dark:text-amber-200',
            schedule: 'bg-[#F9F6F0] border-[#E5E1D8] text-[#5A5A40] dark:bg-[#181814] dark:border-[#3A3A30] dark:text-[#E5E1D8]'
          };

          const Icons = {
            success: CheckCircle,
            info: Info,
            warning: AlertTriangle,
            schedule: Clock
          };

          const IconComponent = Icons[toast.type] || Info;

          return (
            <motion.div
              key={toast.id}
              id={`toast-${toast.id}`}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`flex items-start p-3 sm:p-4 rounded-lg border shadow-sm backdrop-blur-md transition-all ${bgColors[toast.type]}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="ml-2.5 sm:ml-3 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold leading-tight sm:leading-5 truncate-none">{toast.title}</p>
                <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs opacity-90 leading-normal">{toast.description}</p>
              </div>
              <button
                id={`close-toast-${toast.id}`}
                onClick={() => removeToast(toast.id)}
                className="ml-3 sm:ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors focus:outline-none"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
