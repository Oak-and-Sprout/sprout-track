import { FeedbackResponse } from '@/app/api/types';

/**
 * Props for the FeedbackThreadModal component
 */
export interface FeedbackThreadModalProps {
  feedback: FeedbackResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateFeedback: (id: string, viewed: boolean) => void;
  updatingFeedbackId: string | null;
  formatDateTime: (dateString: string | null) => string;
  onReply?: (parentId: string, message: string) => Promise<void>;
  onRefresh?: () => void;
}

