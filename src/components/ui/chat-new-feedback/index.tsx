'use client';

import React, { useState, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { Camera, ChevronLeft, Send, CheckCircle, ImagePlus, X } from 'lucide-react';
import { CameraCaptureModal, useTakePhoto } from '@/src/components/ui/camera-capture';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { useTheme } from '@/src/context/theme';
import { useLocalization } from '@/src/context/localization';
import { chatNewFeedbackDefault, chatNewFeedbackSb } from './chat-new-feedback.sb';
import type { ChatNewFeedbackProps, ChatNewFeedbackRef } from './chat-new-feedback.types';
import './chat-new-feedback.css';

export const ChatNewFeedback = forwardRef<ChatNewFeedbackRef, ChatNewFeedbackProps>(function ChatNewFeedback({
  onSubmit,
  onCancel,
  onBack,
  showBackButton = false,
  hideHeader = false,
  hideFooter = false,
  appearance = 'default',
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
  const c = appearance === 'storybook' ? chatNewFeedbackSb : chatNewFeedbackDefault;
  const sb = appearance === 'storybook';

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

  const camera = useTakePhoto(useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  }, []));

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
    <div className={cn(c.container, className)}>
      {/* Header */}
      {!hideHeader && (
        <div className={c.header}>
          {showBackButton && onBack && (
            <button onClick={onBack} className={c.backButton} aria-label={t('Back')}>
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
          <div className={c.headerContent}>
            <div className={c.headerTitle}>
              {t('New feedback')}
            </div>
            <div className={c.headerDescription}>
              {t('Send a message to the Sprout Track team')}
            </div>
          </div>
        </div>
      )}

      {/* Form Body */}
      <div className={c.formBody}>
        {sent && (
          <div className={c.successBanner}>
            <CheckCircle className={c.successIcon} aria-hidden="true" />
            <span className={c.successText}>
              {t("Sent! We'll get back to you soon.")}
            </span>
          </div>
        )}

        <div className={c.fieldGroup}>
          <label className={c.fieldLabel} htmlFor={sb ? 'sb-fb-subject' : undefined}>
            {t('Subject')}
          </label>
          {sb ? (
            <input
              id="sb-fb-subject"
              type="text"
              className="sb-fi"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={t("What's on your mind?")}
              disabled={sending || sent}
            />
          ) : (
            <Input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={t("What's on your mind?")}
              disabled={sending || sent}
            />
          )}
        </div>

        <div>
          <label className={c.fieldLabel} htmlFor={sb ? 'sb-fb-message' : undefined}>
            {t('Message')}
          </label>
          {sb ? (
            <textarea
              id="sb-fb-message"
              className="sb-fi min-h-[160px]"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('Share your feedback, suggestions, or report any issues...')}
              rows={8}
              disabled={sending || sent}
            />
          ) : (
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('Share your feedback, suggestions, or report any issues...')}
              rows={8}
              disabled={sending || sent}
              className="min-h-[160px]"
            />
          )}
        </div>

        {/* File upload */}
        <div className={c.fileUploadArea}>
          <input
            ref={camera.libraryInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={camera.captureInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={camera.takePhoto}
              disabled={sending || sent}
              className={c.fileUploadButton}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {t('Take Photo')}
            </button>
            <button
              onClick={() => camera.libraryInputRef.current?.click()}
              disabled={sending || sent}
              className={c.fileUploadButton}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {t('Attach images')}
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className={c.filePreviewGrid}>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className={c.filePreviewItem}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className={c.filePreviewImage}
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    className={c.filePreviewDelete}
                    aria-label={t('Remove image')}
                  >
                    <X className="h-2.5 w-2.5 text-white" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className={c.footer}>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(c.sendButton, canSend ? c.sendButtonActive : c.sendButtonInactive)}
          >
            <Send className="h-3.5 w-3.5" color={canSend ? '#fff' : '#a3a39b'} aria-hidden="true" />
            {sending ? t('Sending...') : t('Send feedback')}
          </button>
          <button
            onClick={onCancel}
            className={c.cancelButton}
          >
            {t('Cancel')}
          </button>
        </div>
      )}
      <CameraCaptureModal open={camera.cameraOpen} onClose={camera.closeCamera} onCapture={camera.handleCapture} />
    </div>
  );
});

export default ChatNewFeedback;
