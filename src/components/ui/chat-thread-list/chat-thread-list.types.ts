import { FeedbackResponse } from '@/app/api/types';

export interface ChatThreadListProps {
  threads: FeedbackResponse[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread?: () => void;
  showNewActive?: boolean;
  hideNewButton?: boolean;
  hideHeader?: boolean;
  isAdmin: boolean;
  formatDateTime: (dateString: string | null) => string;
  countUnread: (thread: FeedbackResponse) => number;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}
