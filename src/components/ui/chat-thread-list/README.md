# ChatThreadList

A thread list component for the feedback chat interface. Displays feedback threads with subject, last activity, unread indicators, and a "new feedback" toggle button.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `threads` | `FeedbackResponse[]` | Yes | Array of feedback threads to display |
| `selectedThreadId` | `string \| null` | Yes | Currently selected thread ID |
| `onSelectThread` | `(id: string) => void` | Yes | Callback when a thread is selected |
| `onNewThread` | `() => void` | Yes | Callback to toggle new feedback form |
| `showNewActive` | `boolean` | Yes | Whether the "new feedback" mode is active |
| `isAdmin` | `boolean` | Yes | Whether viewing as admin (affects sender labels) |
| `formatDateTime` | `(date: string \| null) => string` | Yes | Date formatting function |
| `countUnread` | `(thread: FeedbackResponse) => number` | Yes | Function to count unread messages |
| `searchTerm` | `string` | No | Current search term (shows search input when `onSearchChange` provided) |
| `onSearchChange` | `(value: string) => void` | No | Search change callback (enables search UI) |
| `className` | `string` | No | Additional CSS classes |

## Usage

```tsx
<ChatThreadList
  threads={threads}
  selectedThreadId={selectedId}
  onSelectThread={handleSelect}
  onNewThread={handleNewToggle}
  showNewActive={showNew}
  isAdmin={false}
  formatDateTime={formatDateTime}
  countUnread={countUnreadMessages}
/>
```
