import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  label: string;
  value: string;
}

interface CustomComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  className = ""
}: CustomComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current && options.length > 10) {
      inputRef.current.focus();
    } else {
      setSearch('');
    }
  }, [isOpen, options.length]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef} id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-[10px] sm:text-xs px-2 py-1 rounded-md sm:rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#F5F2ED] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] truncate transition-all cursor-pointer min-h-[26px] sm:min-h-[28px]"
      >
        <span className="truncate pr-2">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 text-[#999488] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 left-0 right-0 sm:min-w-[180px] bg-white dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-lg shadow-lg overflow-hidden flex flex-col"
          >
            {options.length > 10 && (
              <div className="p-1.5 border-b border-[#E5E1D8] dark:border-[#3A3A30] flex items-center gap-1.5 bg-[#FDFBF7] dark:bg-[#121210]">
                <Search className="w-3 h-3 text-[#999488]" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Cari..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-[10px] sm:text-xs bg-transparent border-none focus:outline-none text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488]"
                />
              </div>
            )}
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-2 text-[10px] sm:text-xs text-[#999488] text-center">
                  Tidak ditemukan
                </div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2 py-1.5 text-left text-[10px] sm:text-xs rounded-md transition-colors cursor-pointer ${
                      value === opt.value
                        ? 'bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8] font-medium'
                        : 'text-[#777266] dark:text-[#A8A890] hover:bg-[#F5F2ED] dark:hover:bg-[#2A2A22]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <Check className="w-3 h-3 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
