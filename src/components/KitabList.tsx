/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { BookOpen, Search, Filter, Bookmark, Sparkles, Plus, BookOpenCheck, ChevronRight, LayoutGrid, List, Trash2, Edit } from 'lucide-react';
import { motion } from 'motion/react';
import CustomCombobox from './CustomCombobox';
import ConfirmationDialog from './ConfirmationDialog';

export default function KitabList() {
  const {
    allKitabs,
    bookmarks,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedAuthor,
    setSelectedAuthor,
    setActiveKitabId,
    setView,
    deleteCustomKitab,
    setEditingKitabId,
    setProfileUserEmail,
    currentUserEmail,
    preferences,
    setShowLoginPrompt
  } = useApp();

  const [selectedType, setSelectedType] = useState<string>('Semua');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; kitabId: string; title: string } | null>(null);

  // Layout mode: 'grid' or 'list'
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('kitab_layout_mode') as 'grid' | 'list') || 'grid';
  });

  const toggleLayoutMode = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('kitab_layout_mode', mode);
  };

  // Get unique categories and authors
  const types = ['Semua', 'kitab', 'buku', 'artikel'];

  const categories = useMemo(() => {
    const list = new Set<string>();
    allKitabs.forEach(k => {
      if (selectedType === 'Semua' || (k.type || 'kitab') === selectedType) {
        if (k.category) list.add(k.category);
      }
    });
    return ['Semua', ...Array.from(list)];
  }, [allKitabs, selectedType]);

  const authors = useMemo(() => {
    const list = new Set<string>();
    allKitabs.forEach(k => {
      if (selectedType === 'Semua' || (k.type || 'kitab') === selectedType) {
        if (k.author) list.add(k.author);
      }
    });
    return ['Semua', ...Array.from(list)];
  }, [allKitabs, selectedType]);

  // Deep search logic across titles, authors, description, and paragraph text
  const filteredAndSearchedKitabs = useMemo(() => {
    return allKitabs.map(kitab => {
      // Filter by Type
      if (selectedType !== 'Semua' && (kitab.type || 'kitab') !== selectedType) {
        return null;
      }
      // Filter by Category
      if (selectedCategory !== 'Semua' && kitab.category !== selectedCategory) {
        return null;
      }
      // Filter by Author
      if (selectedAuthor !== 'Semua' && kitab.author !== selectedAuthor) {
        return null;
      }

      // Check if Search matches title, author, or description
      const q = searchQuery.toLowerCase().trim();
      if (!q) return { kitab, matches: [] as { chNumber: number, chTitle: string, text: string }[] };

      const titleMatch = (kitab.title || '').toLowerCase().includes(q);
      const authorMatch = (kitab.author || '').toLowerCase().includes(q);
      const descMatch = (kitab.description || '').toLowerCase().includes(q);

      // Helper to strip HTML tags for clean text matching
      const stripHtml = (html: string): string => {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '');
      };

      // Search inside chapter contents
      const matches: { chNumber: number; chTitle: string; text: string }[] = [];
      if (kitab.chapters) {
        kitab.chapters.forEach(ch => {
          if (!ch.paragraphs) return;
          ch.paragraphs.forEach(p => {
            const cleanArabic = stripHtml(p.arabic).toLowerCase();
            const cleanTranslation = stripHtml(p.translation).toLowerCase();
            const cleanExplanation = p.explanation ? stripHtml(p.explanation).toLowerCase() : '';

            if (
              cleanArabic.includes(q) ||
              cleanTranslation.includes(q) ||
              cleanExplanation.includes(q)
            ) {
              // Extract a clean snippet
              const strippedTrans = stripHtml(p.translation);
              const snippet = strippedTrans.length > 100
                ? strippedTrans.substring(0, 100) + '...'
                : strippedTrans;
              matches.push({
                chNumber: ch.number,
                chTitle: ch.title,
                text: snippet
              });
            }
          });
        });
      }
      
      // Also check content for articles
      if (kitab.content) {
        const cleanContent = stripHtml(kitab.content).toLowerCase();
        if (cleanContent.includes(q)) {
          const strippedContent = stripHtml(kitab.content);
          matches.push({
            chNumber: 0,
            chTitle: 'Isi Konten',
            text: strippedContent.substring(0, 100) + '...'
          });
        }
      }

      if (titleMatch || authorMatch || descMatch || matches.length > 0) {
        return { kitab, matches };
      }

      return null;
    }).filter((item): item is { kitab: typeof allKitabs[0], matches: { chNumber: number, chTitle: string, text: string }[] } => item !== null);
  }, [allKitabs, selectedCategory, selectedAuthor, searchQuery]);

  return (
    <div id="kitab-list-container" className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-[#F9F6F0] border border-[#E5E1D8] dark:bg-[#181814] dark:border-[#3A3A30] rounded-xl p-4 sm:p-8 text-[#333333] dark:text-[#E5E1D8] relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-[#5A5A40]/10 border border-[#5A5A40]/20 text-[#5A5A40] dark:text-[#E5E1D8] mb-2 sm:mb-4">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Pustaka Karya Tulis & Kajian
          </span>
          <h1 className="font-serif text-base sm:text-3xl font-bold tracking-tight text-[#5A5A40] dark:text-[#E5E1D8] mb-1 sm:mb-3">
            Khazanah Karya Tulis Digital
          </h1>
          <p className="text-[11px] sm:text-sm text-[#777266] dark:text-[#A8A890] leading-relaxed">
            Tulis risalah pribadi Anda atau telusuri koleksi artikel, buku, dan kitab klasik lengkap dengan teks kustom, penjelasan detail, serta sinkronisasi cloud Anda.
          </p>
        </div>
        <div className="relative z-10 hidden md:flex items-center justify-center flex-shrink-0 bg-white/5 dark:bg-black/5 p-2 rounded-2xl border border-dashed border-[#E5E1D8] dark:border-[#3A3A30]/60">
          <img 
            src="/favicon.png"
            alt="Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 transform hover:rotate-3 hover:scale-105 transition-all duration-300 drop-shadow-md rounded-2xl"
          />
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-3 sm:p-4 shadow-none space-y-3 sm:space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#999488] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
          <input
            id="search-kitab-input"
            type="text"
            placeholder="Cari judul, penulis, terjemahan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 text-xs sm:text-sm rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#F5F2ED] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all"
          />
        </div>

        {/* Filters Selects */}
        <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-[#777266] dark:text-[#A8A890] mr-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#777266]" />
              <span>Kategori:</span>
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mb-1 flex-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  id={`filter-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg border transition-all focus:outline-none whitespace-nowrap flex-shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-sm'
                      : 'border-[#E5E1D8] dark:border-[#3A3A30] hover:bg-[#E5E1D8] dark:hover:bg-[#121210] text-[#777266] dark:text-[#A8A890]'
                  }`}
                >
                  {cat === 'default-arbain-nawawi' ? 'Hadis' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3.5 border-t md:border-t-0 md:border-l border-[#E5E1D8] dark:border-[#3A3A30] pt-2.5 md:pt-0 md:pl-4 min-w-0 flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-shrink-0">
              <span className="text-[10px] sm:text-xs font-medium text-[#777266] dark:text-[#A8A890] flex-shrink-0">Tipe:</span>
              <CustomCombobox
                id="filter-type-select"
                value={selectedType}
                onChange={(val) => {
                  setSelectedType(val);
                  setSelectedCategory('Semua');
                  setSelectedAuthor('Semua');
                }}
                options={types.map(t => ({
                  value: t,
                  label: t === 'kitab' ? 'Kitab' : t === 'buku' ? 'Buku' : t === 'artikel' ? 'Artikel' : t
                }))}
                className="w-[70px] sm:w-[90px] md:w-[100px] flex-shrink-0"
              />
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-shrink sm:flex-shrink-0">
              <span className="text-[10px] sm:text-xs font-medium text-[#777266] dark:text-[#A8A890] flex-shrink-0">Penulis:</span>
              <CustomCombobox
                id="filter-author-select"
                value={selectedAuthor}
                onChange={(val) => setSelectedAuthor(val)}
                options={authors.map(auth => ({
                  value: auth,
                  label: auth
                }))}
                className="w-[80px] sm:w-[120px] md:w-[150px] min-w-[70px] flex-shrink"
              />
            </div>

            {/* Layout Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-[#F5F2ED] dark:bg-[#121210] border border-[#E5E1D8] dark:border-[#3A3A30] p-1 rounded-lg flex-shrink-0">
              <button
                id="layout-grid-btn"
                onClick={() => toggleLayoutMode('grid')}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-[#5A5A40] text-white shadow-xs'
                    : 'text-[#999488] hover:text-[#777266] dark:hover:text-[#E5E1D8]'
                }`}
                title="Tampilan Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                id="layout-list-btn"
                onClick={() => toggleLayoutMode('list')}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'list'
                    ? 'bg-[#5A5A40] text-white shadow-xs'
                    : 'text-[#999488] hover:text-[#777266] dark:hover:text-[#E5E1D8]'
                }`}
                title="Tampilan List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid List or Search Results */}
      {filteredAndSearchedKitabs.length === 0 ? (
        <div id="empty-kitab-state" className="text-center py-12 bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl">
          <BookOpenCheck className="w-10 h-10 text-[#999488] mx-auto mb-2" />
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm mb-1">Karya Tulis Tidak Ditemukan</h3>
          <p className="text-[11px] sm:text-sm text-[#777266] dark:text-[#A8A890] max-w-sm mx-auto px-4">
            Coba sesuaikan kata kunci pencarian Anda atau bersihkan filter.
          </p>
        </div>
      ) : (
        <div 
          id="kitab-cards-grid" 
          className={
            layoutMode === 'grid' 
              ? "grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5" 
              : "flex flex-col gap-3.5"
          }
        >
          {filteredAndSearchedKitabs.map(({ kitab, matches }) => {
            // Count chapters bookmarked for this kitab
            const bookmarkedChaptersCount = bookmarks.filter(b => b.kitabId === kitab.id).length;
            const isOwner = Boolean(currentUserEmail && kitab.createdBy === currentUserEmail);

            let totalPages = 0;
            if (kitab.chapters) {
              const uniquePages = new Set<number>();
              kitab.chapters.forEach(ch => {
                if (ch.paragraphs) {
                  ch.paragraphs.forEach(p => {
                    const pg = typeof p.page === 'number' ? p.page : parseInt(p.page as any) || 1;
                    uniquePages.add(pg);
                  });
                }
              });
              totalPages = uniquePages.size;
            }

            return (
              <motion.div
                key={kitab.id}
                id={`kitab-card-${kitab.id}`}
                layout
                onClick={() => {
                  setActiveKitabId(kitab.id);
                  setView('reader');
                }}
                className={`group relative flex ${
                  layoutMode === 'grid' 
                    ? 'flex-col justify-between h-full' 
                    : 'flex-col md:flex-row md:items-center justify-between gap-4 w-full'
                } bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] hover:border-[#5A5A40] dark:hover:border-[#E5E1D8] rounded-xl p-3 sm:p-5 shadow-none hover:shadow-sm cursor-pointer transition-all`}
              >
                <div className={layoutMode === 'grid' ? '' : 'flex-1 min-w-0'}>
                  {/* Card Header Tags */}
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-2 sm:mb-3.5">
                    <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8] border border-[#5A5A40]/20">
                      {kitab.category === 'default-arbain-nawawi' ? 'Hadis' : kitab.category}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {bookmarkedChaptersCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[8px] sm:text-[11px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded-md border border-amber-200">
                          <Bookmark className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                          {bookmarkedChaptersCount} Bab
                        </span>
                      )}
                      {kitab.isDefault ? (
                        <span className="text-[8px] sm:text-[10px] font-medium bg-[#E5E1D8] dark:bg-[#3A3A30] text-[#777266] dark:text-[#A8A890] px-1 py-0.5 rounded-md">
                          Bawaan
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isOwner && (
                            <>
                              {kitab.isPublic ? (
                                <span className="text-[8px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-200/50">
                                  Publik
                                </span>
                              ) : (
                                <span className="text-[8px] sm:text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-200/50">
                                  Privat
                                </span>
                              )}
                              <button
                                id={`btn-edit-kitab-${kitab.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingKitabId(kitab.id);
                                  setView('writer');
                                }}
                                className="text-stone-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/10 p-1 rounded-md transition-all focus:outline-none cursor-pointer"
                                title="Edit Karya"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`btn-delete-kitab-${kitab.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmation({ isOpen: true, kitabId: kitab.id, title: kitab.title });
                                }}
                                className="text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1 rounded-md transition-all focus:outline-none cursor-pointer"
                                title="Hapus Karya"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Author */}
                  <h3 className="font-serif font-bold text-[#333333] dark:text-[#E5E1D8] text-xs sm:text-base group-hover:text-[#5A5A40] dark:group-hover:text-white transition-colors line-clamp-2 sm:line-clamp-1 leading-snug">
                    {kitab.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] sm:text-xs text-[#999488] mb-1.5 sm:mb-2">
                    <p className="font-medium">
                      Oleh: <span className="text-[#777266] dark:text-[#A8A890] font-semibold">{kitab.author}</span>
                    </p>
                    {kitab.createdBy && (
                      <>
                        <span className="text-stone-300 dark:text-[#3A3A30] select-none">•</span>
                        <p className="text-[10px] sm:text-xs">
                          Kontributor: <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfileUserEmail(kitab.createdBy!);
                              setView('profile');
                            }}
                            className="text-[#5A5A40] dark:text-amber-400 font-bold hover:underline cursor-pointer transition-colors"
                            title="Lihat Profil Akun Kontributor"
                          >
                            {kitab.createdBy.split('@')[0]}
                          </span>
                        </p>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-[10px] sm:text-xs text-[#777266] dark:text-[#A8A890] leading-relaxed line-clamp-2 mb-2 sm:mb-3">
                    {kitab.description}
                  </p>
                </div>

                {/* Sub contents matches (Dynamic global search snippets) */}
                {matches && matches.length > 0 && (
                  <div className={`mt-2 mb-3 bg-[#F5F2ED] dark:bg-[#121210] p-2.5 rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] text-[11px] ${
                    layoutMode === 'grid' ? 'hidden sm:block' : 'w-full md:max-w-md md:mb-0 md:mt-0 md:mx-4'
                  }`}>
                    <p className="text-[#5A5A40] dark:text-[#E5E1D8] font-bold mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Cocok di {matches[0].chTitle}:
                    </p>
                    <p className="text-[#777266] dark:text-[#A8A890] italic line-clamp-2">
                      "...{matches[0].text}..."
                    </p>
                    {matches.length > 1 && (
                      <p className="text-[10px] text-[#999488] mt-1 font-medium">
                        + {matches.length - 1} kecocokan bab lainnya
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Action */}
                <div className={`pt-2 sm:pt-3 ${
                  layoutMode === 'grid' 
                    ? 'border-t border-[#E5E1D8] dark:border-[#3A3A30] w-full flex items-center justify-between' 
                    : 'md:pt-0 md:border-t-0 md:border-l md:border-[#E5E1D8] md:dark:border-[#3A3A30] md:pl-6 md:h-12 md:w-32 flex-shrink-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1 border-t border-[#E5E1D8] dark:border-[#3A3A30] pt-2 w-full'
                }`}>
                  <span className="text-[9px] sm:text-xs text-[#999488] font-medium">
                    {kitab.type === 'artikel' 
                      ? 'Artikel' 
                      : kitab.type === 'buku' 
                        ? `Buku • ${totalPages} hlm` 
                        : `Kitab • ${totalPages} hlm`
                    }
                  </span>
                  <span className="text-[9px] sm:text-xs font-bold text-[#5A5A40] dark:text-[#E5E1D8] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Buka <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Option to write a custom book */}
      <div className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
        <div>
          <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm mb-1">
            Ingin Menulis Risalah, Artikel, atau Mengunggah Buku Sendiri?
          </h3>
          <p className="text-xs text-[#777266] dark:text-[#A8A890] leading-relaxed">
            Tulis artikel, buku kajian pribadi, atau karya terjemahan baru dengan format dwibahasa secara intuitif.
          </p>
        </div>
        <button
          id="btn-goto-writer"
          onClick={() => {
            if (!currentUserEmail) {
              setShowLoginPrompt('write');
            } else {
              setEditingKitabId(null);
              setView('writer');
            }
          }}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#5A5A40] hover:bg-[#454530] text-white font-medium text-xs rounded-lg transition-all shadow-none focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Mulai Menulis
        </button>
      </div>
      <ConfirmationDialog
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        onConfirm={() => {
          if (deleteConfirmation) {
            deleteCustomKitab(deleteConfirmation.kitabId);
          }
        }}
        title="Hapus Karya Tulis"
        message={`Apakah Anda yakin ingin menghapus karya tulis "${deleteConfirmation?.title}" dari pustaka?`}
      />
    </div>
  );
}
