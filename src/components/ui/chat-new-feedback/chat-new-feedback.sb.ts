import { cn } from '@/src/lib/utils';
import { chatNewFeedbackStyles as s } from './chat-new-feedback.styles';

/**
 * Default class map — reproduces the exact class strings the component
 * rendered before the appearance prop existed. Do not change these values
 * without checking the side-nav and family-manager surfaces.
 */
export const chatNewFeedbackDefault = {
  container: cn(s.container, 'chat-new-feedback-container'),
  header: cn(s.header, 'chat-new-feedback-header'),
  backButton: s.backButton,
  headerContent: s.headerContent,
  headerTitle: cn(s.headerTitle, 'chat-new-feedback-title'),
  headerDescription: cn(s.headerDescription, 'chat-new-feedback-description'),
  formBody: cn(s.formBody, 'chat-new-feedback-form-body'),
  successBanner: cn(s.successBanner, 'chat-new-feedback-success'),
  successIcon: 'h-[18px] w-[18px] text-emerald-500 flex-shrink-0',
  successText: cn(s.successText, 'chat-new-feedback-success-text'),
  fieldGroup: s.fieldGroup,
  fieldLabel: cn(s.fieldLabel, 'chat-new-feedback-label'),
  fileUploadArea: s.fileUploadArea,
  fileUploadButton: cn(s.fileUploadButton, 'chat-new-feedback-upload-button'),
  filePreviewGrid: s.filePreviewGrid,
  filePreviewItem: cn(s.filePreviewItem, 'chat-new-feedback-preview-item'),
  filePreviewImage: s.filePreviewImage,
  filePreviewDelete: s.filePreviewDelete,
  footer: cn(s.footer, 'chat-new-feedback-footer'),
  sendButton: s.sendButton,
  sendButtonActive: s.sendButtonActive,
  sendButtonInactive: cn(s.sendButtonInactive, 'chat-new-feedback-send-inactive'),
  cancelButton: cn(s.cancelButton, 'chat-new-feedback-cancel'),
};

export type ChatNewFeedbackClassMap = Record<keyof typeof chatNewFeedbackDefault, string>;

/**
 * Storybook (landing drawer) class map. Light-only; no chat-* dark hooks.
 * Header and footer keys inherit defaults: those elements never render in
 * the storybook surface (hideHeader/hideFooter are set by FeedbackPage).
 */
export const chatNewFeedbackSb: ChatNewFeedbackClassMap = {
  ...chatNewFeedbackDefault,
  container: 'sb-chat-new',
  formBody: 'sb-chat-new-bd',
  successBanner: 'sb-okbox',
  successIcon: 'h-[18px] w-[18px] flex-shrink-0',
  successText: '',
  fieldLabel: 'sb-fl',
  fileUploadButton: 'sb-btn sb-ghost sb-sm',
  filePreviewItem: 'sb-chat-prev',
  filePreviewDelete: 'sb-chat-prev-del',
};
