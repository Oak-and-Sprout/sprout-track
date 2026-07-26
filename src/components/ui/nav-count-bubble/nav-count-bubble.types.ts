export interface NavCountBubbleProps {
  count: number;
  variant?: 'default' | 'accent';
  className?: string;
  /** Translated context word for screen readers (e.g. t('unread')); announced as "{count} {label}" */
  label?: string;
}
