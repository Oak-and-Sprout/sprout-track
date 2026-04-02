# ChatConversation

A chat bubble conversation view for the feedback system. Displays message history with chat bubbles and an always-visible reply input.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `thread` | `FeedbackResponse \| null` | Yes | The feedback thread to display (null shows empty state) |
| `isAdmin` | `boolean` | Yes | Whether viewing as admin (affects bubble alignment) |
| `onReply` | `(parentId, message, subject?, familyId?) => Promise` | Yes | Callback to send a reply |
| `onBack` | `() => void` | No | Back button callback |
| `showBackButton` | `boolean` | No | Whether to show back chevron in header |
| `onMarkRead` | `(id: string) => Promise<void>` | No | Callback to mark messages as read |
| `formatDateTime` | `(date: string \| null) => string` | Yes | Date formatting function |
| `className` | `string` | No | Additional CSS classes |

## Features

- Chat bubble layout (green for "mine", white for "theirs")
- Auto-scroll to bottom on new messages
- Date breaks between different days
- Sender avatar with initials, collapsed for consecutive same-sender
- Auto-growing reply textarea with Enter to send (Shift+Enter for newline)
- Auto-marks unread messages from the other side as read

## Usage

```tsx
<ChatConversation
  thread={selectedThread}
  isAdmin={false}
  onReply={sendReply}
  onBack={handleBack}
  showBackButton={true}
  onMarkRead={markAsRead}
  formatDateTime={formatDateTime}
/>
```
