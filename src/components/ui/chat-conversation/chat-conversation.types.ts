import { FeedbackResponse, FeedbackAttachmentResponse } from '@/app/api/types';

export interface ChatMessage {
  id: string;
  from: 'user' | 'admin';
  name: string;
  date: string;
  text: string;
  viewed: boolean;
  attachments?: FeedbackAttachmentResponse[];
}

export interface ChatConversationProps {
  thread: FeedbackResponse | null;
  isAdmin: boolean;
  onReply: (parentId: string, message: string, subject?: string, familyId?: string | null, files?: File[]) => Promise<unknown>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onBack?: () => void;
  showBackButton?: boolean;
  onMarkRead?: (id: string) => Promise<void>;
  formatDateTime: (dateString: string | null) => string;
  /** Hide the built-in header (use when the parent provides its own header) */
  hideHeader?: boolean;
  /** Hide the built-in reply bar (use when the parent renders ChatReplyBar separately) */
  hideReplyBar?: boolean;
  className?: string;
}

export interface ChatReplyBarProps {
  threadId: string;
  subject: string;
  familyId: string | null;
  onReply: (parentId: string, message: string, subject?: string, familyId?: string | null, files?: File[]) => Promise<unknown>;
  className?: string;
}
