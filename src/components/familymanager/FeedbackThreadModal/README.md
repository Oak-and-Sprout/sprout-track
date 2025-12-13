# FeedbackThreadModal Component

A modal component that displays feedback threads in an email-like interface with original messages and replies.

## Features

- **Email Thread UI**: Clean, email-like interface for viewing feedback conversations
- **Mobile Responsive**: Fully responsive design that works on all screen sizes
- **Read/Unread States**: Visual distinction between read and unread messages
- **Admin Controls**: Admins can mark user messages as read, but not their own
- **Reply Functionality**: Built-in reply form for responding to feedback
- **Dark Mode Support**: Full dark mode support via CSS classes

## Props

```typescript
interface FeedbackThreadModalProps {
  feedback: FeedbackResponse | null;        // The feedback thread to display
  isOpen: boolean;                         // Whether the modal is open
  onClose: () => void;                     // Callback when modal closes
  onUpdateFeedback: (id: string, viewed: boolean) => void;  // Update feedback viewed status
  updatingFeedbackId: string | null;       // ID of feedback being updated
  formatDateTime: (dateString: string | null) => string;  // Date formatter function
  onReply?: (parentId: string, message: string) => Promise<void>;  // Reply handler
  onRefresh?: () => void;                  // Refresh callback after actions
}
```

## Usage

```tsx
import FeedbackThreadModal from '@/src/components/familymanager/FeedbackThreadModal';

<FeedbackThreadModal
  feedback={selectedFeedback}
  isOpen={isModalOpen}
  onClose={handleClose}
  onUpdateFeedback={handleUpdateFeedback}
  updatingFeedbackId={updatingId}
  formatDateTime={formatDateTime}
  onReply={handleReply}
  onRefresh={handleRefresh}
/>
```

## Component Structure

- `index.tsx` - Main component implementation
- `feedback-thread-modal.types.ts` - TypeScript type definitions
- `feedback-thread-modal.css` - Dark mode styles

## Admin Behavior

- Admins can mark user messages as read
- Admins cannot mark their own messages as read
- Admin detection is based on JWT token parsing
- Admin email is extracted from AppConfig or reply messages

## Styling

The component uses Tailwind CSS classes with dark mode support via CSS file:
- Light mode: Standard Tailwind colors
- Dark mode: Custom CSS classes for dark theme

## Mobile Responsiveness

- Responsive padding and spacing (`px-4 sm:px-6`)
- Flexible text sizes (`text-xs sm:text-sm`)
- Stacked layouts on mobile, horizontal on desktop
- Touch-friendly button sizes
- Break-words for long email addresses and text

