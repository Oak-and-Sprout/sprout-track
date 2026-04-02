export interface ChatNewFeedbackProps {
  onSubmit: (subject: string, message: string) => Promise<unknown>;
  onCancel: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  /** Hide the built-in header (use when the parent provides its own header) */
  hideHeader?: boolean;
  /** Hide the built-in footer (use when the parent renders actions separately) */
  hideFooter?: boolean;
  /** Expose whether the form can be submitted */
  onCanSendChange?: (canSend: boolean) => void;
  className?: string;
}

export interface ChatNewFeedbackRef {
  submit: () => void;
}
