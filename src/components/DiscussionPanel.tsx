/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { MessageSquare, Send, User, Calendar } from 'lucide-react';
import { Comment } from '../types';
import { dbService } from '../lib/dbService';

interface DiscussionPanelProps {
  kitabId: string;
  chapterId: string;
}

export default function DiscussionPanel({ kitabId, chapterId }: DiscussionPanelProps) {
  const { currentUserEmail, currentUserName, addToast } = useApp();
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time comments for this chapter
  useEffect(() => {
    const unsubscribe = dbService.subscribeComments(kitabId, chapterId, (list) => {
      setComments(list);
    });

    return () => unsubscribe();
  }, [kitabId, chapterId]);

  // Scroll inner container to bottom when comments change without shifting the main page layout
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const authorName = currentUserEmail ? currentUserName : guestName.trim() || 'Pembaca Anonim';
    const authorEmail = currentUserEmail ? currentUserEmail : guestEmail.trim() || 'guest@kitabdigital.com';

    setIsSubmitting(true);
    try {
      await dbService.addComment({
        kitabId,
        chapterId,
        authorName,
        authorEmail,
        content: inputText.trim()
      });
      setInputText('');
      addToast('Komentar Dikirim', 'Pendapat Anda berhasil diunggah ke diskusi publik.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Gagal Mengirim', 'Komentar tidak dapat dikirim ke cloud.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div id="discussion-panel" className="bg-[#F9F6F0] dark:bg-[#181814] border border-[#E5E1D8] dark:border-[#3A3A30] rounded-xl p-4.5 shadow-none flex flex-col h-[400px]">
      {/* Panel Header */}
      <div className="flex items-center gap-2 border-b border-[#E5E1D8] dark:border-[#3A3A30] pb-3 mb-3 flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-[#5A5A40] dark:text-[#E5E1D8]" />
        <h3 className="font-serif font-bold text-[#5A5A40] dark:text-[#E5E1D8] text-sm">
          Diskusi Publik Bab Ini
        </h3>
        <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#E5E1D8] font-bold px-2 py-0.5 rounded-lg">
          {comments.length} Opini
        </span>
      </div>

      {/* Comments List Container */}
      <div id="comments-feed-container" ref={containerRef} className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-3.5">
        {comments.length === 0 ? (
          <div id="empty-comments-state" className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
            <MessageSquare className="w-8 h-8 text-[#999488] mb-2" />
            <p className="text-xs font-bold text-[#777266] dark:text-[#A8A890]">Belum Ada Pendapat</p>
            <p className="text-[10px] text-[#999488] mt-1 max-w-[200px]">
              Jadilah yang pertama untuk bertukar pendapat mengenai bab kajian ini!
            </p>
          </div>
        ) : (
          comments.map((comm) => {
            const isMe = currentUserEmail
              ? comm.authorEmail === currentUserEmail
              : comm.authorEmail === guestEmail;

            return (
              <div
                key={comm.id}
                id={`comment-card-${comm.id}`}
                className={`p-3 rounded-lg border text-xs leading-relaxed max-w-[90%] ${
                  isMe
                    ? 'bg-[#5A5A40]/10 border-[#5A5A40]/25 text-[#333333] dark:text-[#E5E1D8] ml-auto'
                    : 'bg-[#FDFBF7] dark:bg-[#121210] border-[#E5E1D8] dark:border-[#3A3A30] text-[#333333] dark:text-[#E5E1D8] mr-auto'
                }`}
              >
                {/* Author Info */}
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#999488] font-medium">
                  <div className="w-4 h-4 rounded-full bg-[#E5E1D8] dark:bg-[#3A3A30] flex items-center justify-center text-[8px] font-bold text-[#777266]">
                    {comm.authorName.charAt(0).toUpperCase()}
                  </div>
                  <strong className="text-[#777266] dark:text-[#A8A890] font-bold truncate max-w-[100px]">
                    {comm.authorName}
                  </strong>
                  <span className="text-[8px] opacity-75">• {formatDate(comm.createdAt)}</span>
                </div>

                {/* Content */}
                <p className="text-[#333333] dark:text-[#E5E1D8] font-medium whitespace-pre-wrap">{comm.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form Footer */}
      <form id="comment-submit-form" onSubmit={handleSubmit} className="border-t border-[#E5E1D8] dark:border-[#3A3A30] pt-3 flex-shrink-0 space-y-2">
        {/* Guest credentials required if no email profile exists */}
        {!currentUserEmail && (
          <div className="grid grid-cols-2 gap-2">
            <input
              id="comment-guest-name"
              type="text"
              required
              placeholder="Nama Anda"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="px-2 py-1.5 text-[10px] rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
            <input
              id="comment-guest-email"
              type="email"
              placeholder="Email (Opsional)"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="px-2 py-1.5 text-[10px] rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>
        )}

        <div className="relative">
          <input
            id="comment-message-input"
            type="text"
            required
            placeholder="Ketik pendapat atau pertanyaan Anda..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full pl-3 pr-10 py-2 text-xs rounded-lg border border-[#E5E1D8] dark:border-[#3A3A30] bg-[#FDFBF7] dark:bg-[#121210] text-[#333333] dark:text-[#E5E1D8] placeholder-[#999488] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-all"
          />
          <button
            id="comment-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-[#5A5A40] hover:bg-[#454530] disabled:bg-slate-300 text-white rounded-lg transition-all focus:outline-none shadow-none cursor-pointer"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  );
}
