import React from 'react';

export interface StorybookDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Already-localized title (Literata, 24px). */
  title: string;
  /** Already-localized subtitle line under the title. */
  subtitle?: string;
  /** When provided, a back arrow renders at the header's left. */
  onBack?: () => void;
  /** Decorative corner sprite, hidden ≤640px. */
  art?: 'butterfly' | 'star';
  /** Rendered between header and body — e.g. the tab bar. */
  headerExtras?: React.ReactNode;
  /** Sticky footer bar (paper2 background); omit for no footer. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
