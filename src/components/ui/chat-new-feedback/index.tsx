'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { ChevronLeft, Send, CheckCircle } from 'lucide-react';
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = !!(subject.trim() && message.trim() && !sending && !sent);

  useEffect(() => {
    onCanSendChange?.(canSend);
  }, [canSend, onCanSendChange]);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSubmit(subject.trim(), message.trim());
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSubject('');
        setMessage('');
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
