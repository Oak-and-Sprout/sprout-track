'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { ChevronLeft, Send, CheckCircle, ImagePlus, X } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { chatNewFeedbackStyles as styles } from './chat-new-feedback.styles';
import type { ChatNewFeedbackProps, ChatNewFeedbackRef } from './chat-new-feedback.types';
import './chat-new-feedback.css';

export const ChatNewFeedback = forwardRef<ChatNewFeedbackRef, ChatNewFeedbackProps>(function ChatNewFeedback({
  onSubmit,
  onCancel,
  onBack,
  showBackButton = false,
  hideHeader = false,
  hideFooter = false,
  onCanSendChange,
  className,
}, ref) {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = !!(subject.trim() && (message.trim() || selectedFiles.length > 0) && !sending && !sent);

  useEffect(() => {
    onCanSendChange?.(canSend);
  }, [canSend, onCanSendChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSubmit(subject.trim(), message.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSubject('');
        setMessage('');
        setSelectedFiles([]);
        onCancel();
      }, 1800);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSending(false);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: handleSend,
  }));

  return (
    <div className={cn(styles.container, 'chat-new-feedback-container', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={cn(styles.header, 'chat-new-feedback-header')}>
          {showBackButton && onBack && (
            <button onClick={onBack} className={styles.backButton} aria-label={t('Back')}>
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className={styles.headerContent}>
            <div className={cn(styles.headerTitle, 'chat-new-feedback-title')}>
              {t('New feedback')}
            </div>
            <div className={cn(styles.headerDescription, 'chat-new-feedback-description')}>
              {t('Send a message to the Sprout Track team')}
            </div>
          </div>
        </div>
      )}

      {/* Form Body */}
      <div className={cn(styles.formBody, 'chat-new-feedback-form-body')}>
        {sent && (
          <div className={cn(styles.successBanner, 'chat-new-feedback-success')}>
            <CheckCircle className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" />
            <span className={cn(styles.successText, 'chat-new-feedback-success-text')}>
              {t("Sent! We'll get back to you soon.")}
            </span>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label className={cn(styles.fieldLabel, 'chat-new-feedback-label')}>
            {t('Subject')}
          </label>
          <Input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={t("What's on your mind?")}
            disabled={sending || sent}
          />
        </div>

        <div>
          <label className={cn(styles.fieldLabel, 'chat-new-feedback-label')}>
            {t('Message')}
          </label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('Share your feedback, suggestions, or report any issues...')}
            rows={8}
            disabled={sending || sent}
            className="min-h-[160px]"
          />
        </div>

        {/* File upload */}
        <div className={styles.fileUploadArea}>
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
            disabled={sending || sent}
            className={cn(styles.fileUploadButton, 'chat-new-feedback-upload-button')}
          >
            <ImagePlus className="h-4 w-4" />
            {t('Attach images')}
          </button>

          {selectedFiles.length > 0 && (
            <div className={styles.filePreviewGrid}>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className={cn(styles.filePreviewItem, 'chat-new-feedback-preview-item')}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className={styles.filePreviewImage}
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    className={styles.filePreviewDelete}
                    aria-label={t('Remove image')}
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className={cn(styles.footer, 'chat-new-feedback-footer')}>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              styles.sendButton,
              canSend
                ? styles.sendButtonActive
                : cn(styles.sendButtonInactive, 'chat-new-feedback-send-inactive'),
            )}
          >
            <Send className="h-3.5 w-3.5" color={canSend ? '#fff' : '#a3a39b'} />
            {sending ? t('Sending...') : t('Send feedback')}
          </button>
          <button
            onClick={onCancel}
            className={cn(styles.cancelButton, 'chat-new-feedback-cancel')}
          >
            {t('Cancel')}
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatNewFeedback;
