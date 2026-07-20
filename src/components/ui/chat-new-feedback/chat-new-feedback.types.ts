export interface ChatNewFeedbackProps {
  onSubmit: (subject: string, message: string, files?: File[]) => Promise<unknown>;
  onCancel: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  /** Hide the built-in header (use when the parent provides its own header) */
  hideHeader?: boolean;
  /** Hide the built-in footer (use when the parent renders actions separately) */
  hideFooter?: boolean;
  /** Visual skin: 'storybook' renders sb-* classes (landing drawer), 'default' keeps the in-app look */
  appearance?: 'default' | 'storybook';
  /** Expose whether the form can be submitted */
  onCanSendChange?: (canSend: boolean) => void;
  className?: string;
}

export interface ChatNewFeedbackRef {
  submit: () => void;
}
