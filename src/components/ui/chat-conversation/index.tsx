'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { ChevronLeft, Send, MessageSquare, X, ImagePlus } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { chatConversationStyles as styles } from './chat-conversation.styles';
import type { ChatConversationProps, ChatReplyBarProps, ChatMessage } from './chat-conversation.types';
import type { FeedbackResponse } from '@/app/api/types';
import './chat-conversation.css';

/** Fetches an image with the auth token and renders it as a blob URL. */
function AuthImage({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    const token = localStorage.getItem('authToken');
    fetch(src, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load image');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null));
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src]);

  if (!blobUrl) return <div className={cn(className, 'bg-gray-200 animate-pulse')} style={{ minHeight: 60 }} />;

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" onClick={onClick} />;
}

function flattenMessages(thread: FeedbackResponse, isAdmin: boolean): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const isAdminMsg = thread.submitterName === 'Admin';
  messages.push({
    id: thread.id,
    from: isAdminMsg ? 'admin' : 'user',
    name: thread.submitterName || 'User',
    date: thread.submittedAt,
    text: thread.message,
    viewed: thread.viewed,
    attachments: thread.attachments,
  });
  if (thread.replies) {
    for (const reply of thread.replies) {
      const isReplyAdmin = reply.submitterName === 'Admin';
      messages.push({
        id: reply.id,
        from: isReplyAdmin ? 'admin' : 'user',
        name: reply.submitterName || 'User',
        date: reply.submittedAt,
        text: reply.message,
        viewed: reply.viewed,
        attachments: reply.attachments,
      });
    }
  }
  return messages;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ChatConversation({
  thread,
  isAdmin,
  onReply,
  onDeleteAttachment,
  onBack,
  showBackButton = false,
  onMarkRead,
  formatDateTime,
  hideHeader = false,
  hideReplyBar = false,
  className,
}: ChatConversationProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markedReadRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread?.id, thread?.replies?.length]);

  // Reset reply text when thread changes
  useEffect(() => {
    setReplyText('');
    setSending(false);
    setPendingFiles([]);
  }, [thread?.id]);

  // Auto-mark unread messages as read
  useEffect(() => {
    if (!thread || !onMarkRead) return;
    if (markedReadRef.current === thread.id) return;
    markedReadRef.current = thread.id;

    const messages = flattenMessages(thread, isAdmin);
    const unreadFromOther = messages.filter(msg => {
      if (!msg.viewed) {
        if (isAdmin) return msg.from === 'user';
        return msg.from === 'admin';
      }
      return false;
    });

    unreadFromOther.forEach(msg => {
      onMarkRead(msg.id);
    });
  }, [thread, isAdmin, onMarkRead]);

  // Reset marked-read tracking when thread changes
  useEffect(() => {
    markedReadRef.current = null;
  }, [thread?.id]);

  const canSend = (replyText.trim() || pendingFiles.length > 0) && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend || !thread) return;
    setSending(true);
    try {
      await onReply(thread.id, replyText.trim(), thread.subject, thread.familyId, pendingFiles.length > 0 ? pendingFiles : undefined);
      setReplyText('');
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [canSend, replyText, thread, pendingFiles, onReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    if (!onDeleteAttachment) return;
    await onDeleteAttachment(attachmentId);
    setConfirmDeleteId(null);
  }, [onDeleteAttachment]);

  // Empty state
  if (!thread) {
    return (
      <div className={cn(styles.container, 'chat-conversation-container', className)}>
        <div className={cn(styles.emptyState, 'chat-conversation-empty')}>
          <MessageSquare className="h-8 w-8 chat-conversation-empty-icon" strokeWidth={1.5} />
          <span>{t('Select a conversation')}</span>
        </div>
      </div>
    );
  }

  const messages = flattenMessages(thread, isAdmin);
  const totalMessages = messages.length;

  return (
    <div className={cn(styles.container, 'chat-conversation-container', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={cn(styles.header, 'chat-conversation-header')}>
          {showBackButton && onBack && (
            <button onClick={onBack} className={styles.backButton} aria-label={t('Back')}>
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className={styles.headerContent}>
            <div className={cn(styles.headerSubject, 'chat-conversation-subject')}>
              {thread.subject}
            </div>
            <div className={cn(styles.headerMeta, 'chat-conversation-meta')}>
              <span>{totalMessages} {t('message')}{totalMessages > 1 ? 's' : ''}</span>
              {isAdmin && thread.submitterName && thread.submitterName !== 'Admin' && (
                <>
                  <span className={cn(styles.headerMetaDivider, 'chat-conversation-meta-divider')}>·</span>
                  <span className={cn(styles.headerMetaName, 'chat-conversation-meta-name')}>
                    {thread.submitterName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={cn(styles.messagesArea, 'chat-conversation-messages')}>
        {messages.map((msg, idx) => {
          const isMine = isAdmin ? msg.from === 'admin' : msg.from === 'user';
          const showDateBreak = idx === 0 || !isSameDay(messages[idx - 1].date, msg.date);
          const sameSenderAsPrev = idx > 0 && messages[idx - 1].from === msg.from && !showDateBreak;

          // Avatar and name styling
          let avatarClass: string;
          let avatarDarkClass: string;
          let nameClass: string;
          let nameDarkClass: string;
          let displayName: string;
          let initials: string;

          if (isMine) {
            displayName = isAdmin ? t('You (Admin)') : (msg.name || t('You'));
            initials = isAdmin ? 'A' : getInitials(msg.name || 'You');
            avatarClass = styles.avatarMine;
            avatarDarkClass = 'chat-conversation-avatar-mine';
            nameClass = styles.senderNameMine;
            nameDarkClass = 'chat-conversation-sender-mine';
          } else if (msg.from === 'user') {
            displayName = msg.name || t('User');
            initials = getInitials(displayName);
            avatarClass = styles.avatarUser;
            avatarDarkClass = 'chat-conversation-avatar-user';
            nameClass = styles.senderNameTheirs;
            nameDarkClass = 'chat-conversation-sender-theirs';
          } else {
            displayName = t('Sprout Track Team');
            initials = 'ST';
            avatarClass = styles.avatarAdmin;
            avatarDarkClass = 'chat-conversation-avatar-admin';
            nameClass = styles.senderNameTheirs;
            nameDarkClass = 'chat-conversation-sender-theirs';
          }

          return (
            <div key={msg.id}>
              {showDateBreak && (
                <div className={cn(styles.dateBreak, 'chat-conversation-date-break')}>
                  {formatDateLabel(msg.date)}
                </div>
              )}
              <div className={cn(
                styles.messageWrapper,
                isMine ? styles.messageWrapperMine : styles.messageWrapperTheirs,
              )}>
                {/* Sender label */}
                {!sameSenderAsPrev && (
                  <div className={cn(
                    styles.senderRow,
                    isMine ? styles.senderRowMine : styles.senderRowTheirs,
                  )}>
                    <div className={cn(styles.avatar, avatarClass, avatarDarkClass)}>
                      {initials}
                    </div>
                    <div className={cn(
                      'flex items-center gap-1.5',
                      isMine ? 'flex-row-reverse' : 'flex-row',
                    )}>
                      <span className={cn(nameClass, nameDarkClass)}>
                        {displayName}
                      </span>
                      {isAdmin && msg.from === 'user' && thread.familySlug && (
                        <span className={cn(styles.familyTag, 'chat-conversation-family-tag')}>
                          {thread.familySlug}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* Bubble */}
                <div className={cn(
                  isMine
                    ? cn(styles.bubbleMine, 'chat-conversation-bubble-mine')
                    : cn(styles.bubbleTheirs, 'chat-conversation-bubble-theirs'),
                )}>
                  {msg.text && <div>{msg.text}</div>}
                  {/* Inline images */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className={styles.attachmentGrid}>
                      {msg.attachments.map(att => (
                        <div key={att.id} className={styles.attachmentWrapper}>
                          <AuthImage
                            src={`/api/feedback/file/${att.id}`}
                            alt={att.originalName}
                            className={styles.attachmentImage}
                            onClick={() => {
                              const token = localStorage.getItem('authToken');
                              fetch(`/api/feedback/file/${att.id}`, {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                              })
                                .then(r => r.blob())
                                .then(blob => {
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, '_blank');
                                });
                            }}
                          />
                          {onDeleteAttachment && confirmDeleteId === att.id ? (
                            <div
                              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 rounded-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-white text-[10px] font-medium">{t('Delete?')}</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium border-none cursor-pointer"
                                >
                                  {t('Yes')}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded bg-gray-500 text-white text-[10px] font-medium border-none cursor-pointer"
                                >
                                  {t('No')}
                                </button>
                              </div>
                            </div>
                          ) : onDeleteAttachment && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(att.id);
                              }}
                              className={cn(styles.attachmentDeleteButton, 'chat-conversation-attachment-delete')}
                              aria-label={t('Remove image')}
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Timestamp */}
                <span className={cn(
                  styles.timestamp,
                  'chat-conversation-timestamp',
                  isMine ? styles.timestampMine : styles.timestampTheirs,
                )}>
                  {formatTime(msg.date)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pending file previews */}
      {!hideReplyBar && pendingFiles.length > 0 && (
        <div className={cn(styles.replyPreviewStrip, 'chat-conversation-preview-strip')}>
          {pendingFiles.map((file, idx) => (
            <div key={idx} className={styles.replyPreviewItem}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className={styles.replyPreviewImage}
              />
              <button
                onClick={() => removePendingFile(idx)}
                className={styles.replyPreviewDelete}
                aria-label={t('Remove image')}
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reply Input */}
      {!hideReplyBar && (
        <div className={cn(styles.replyBar, 'chat-conversation-reply-bar')}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(styles.replyAttachButton, 'chat-conversation-attach-button')}
            aria-label={t('Attach images')}
          >
            <ImagePlus className="h-[18px] w-[18px] text-gray-500" />
          </button>
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder={t('Type a reply...')}
            rows={1}
            disabled={sending}
            className={cn(styles.replyTextarea, 'chat-conversation-reply-textarea')}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              styles.sendButton,
              canSend
                ? styles.sendButtonActive
                : cn(styles.sendButtonInactive, 'chat-conversation-send-inactive'),
            )}
            aria-label={t('Send')}
          >
            <Send className="h-[15px] w-[15px]" color={canSend ? '#fff' : '#a3a39b'} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone reply bar for use outside ChatConversation (e.g. in a FormPageFooter).
 */
export function ChatReplyBar({
  threadId,
  subject,
  familyId,
  onReply,
  className,
}: ChatReplyBarProps) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (replyText.trim() || pendingFiles.length > 0) && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onReply(threadId, replyText.trim(), subject, familyId, pendingFiles.length > 0 ? pendingFiles : undefined);
      setReplyText('');
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  }, [canSend, replyText, threadId, subject, familyId, pendingFiles, onReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div className={cn('flex gap-2 flex-wrap mb-2', 'chat-conversation-preview-strip-inline')}>
          {pendingFiles.map((file, idx) => (
            <div key={idx} className={styles.replyPreviewItem}>
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className={styles.replyPreviewImage}
              />
              <button
                onClick={() => removePendingFile(idx)}
                className={styles.replyPreviewDelete}
                aria-label={t('Remove image')}
              >
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 w-full">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(styles.replyAttachButton, 'chat-conversation-attach-button')}
          aria-label={t('Attach images')}
        >
          <ImagePlus className="h-[18px] w-[18px] text-gray-500" />
        </button>
        <textarea
          ref={textareaRef}
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTextareaInput}
          placeholder={t('Type a reply...')}
          rows={1}
          disabled={sending}
          className={cn(styles.replyTextarea, 'chat-conversation-reply-textarea')}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            styles.sendButton,
            canSend
              ? styles.sendButtonActive
              : cn(styles.sendButtonInactive, 'chat-conversation-send-inactive'),
          )}
          aria-label={t('Send')}
        >
          <Send className="h-[15px] w-[15px]" color={canSend ? '#fff' : '#a3a39b'} />
        </button>
      </div>
    </div>
  );
}

export default ChatConversation;
