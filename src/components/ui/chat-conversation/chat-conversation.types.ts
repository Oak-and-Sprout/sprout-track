import { FeedbackResponse, FeedbackAttachmentResponse } from '@/app/api/types';

export interface ChatMessage {
  id: string;
  from: 'user' | 'admin';
  name: string;
  date: string;
  text: string;
  viewed: boolean;
  accountId?: string | null;
  caretakerId?: string | null;
  attachments?: FeedbackAttachmentResponse[];
}

export interface ChatConversationProps {
  thread: FeedbackResponse | null;
  isAdmin: boolean;
  viewerAccountId?: string | null;
  viewerCaretakerId?: string | null;
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
  /** Visual skin: 'storybook' renders sb-* classes (landing drawer), 'default' keeps the in-app look */
  appearance?: 'default' | 'storybook';
  className?: string;
}

export interface ChatReplyBarProps {
  threadId: string;
  subject: string;
  familyId: string | null;
  onReply: (parentId: string, message: string, subject?: string, familyId?: string | null, files?: File[]) => Promise<unknown>;
  /** Visual skin: 'storybook' renders sb-* classes (landing drawer), 'default' keeps the in-app look */
  appearance?: 'default' | 'storybook';
  className?: string;
}
