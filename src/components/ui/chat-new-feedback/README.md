# ChatNewFeedback

A new feedback form pane for the chat-style feedback interface. Allows users to submit a new feedback thread with subject and message.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSubmit` | `(subject: string, message: string) => Promise` | Yes | Callback to submit new feedback |
| `onCancel` | `() => void` | Yes | Callback to cancel and return to thread list |
| `onBack` | `() => void` | No | Back button callback (mobile) |
| `showBackButton` | `boolean` | No | Whether to show back chevron in header |
| `className` | `string` | No | Additional CSS classes |

## Features

- Subject input and message textarea
- Inline success banner with auto-close after 1.8s
- Reuses existing Input and Textarea components
- Send button disabled until both fields filled

## Usage

```tsx
<ChatNewFeedback
  onSubmit={sendNewFeedback}
  onCancel={() => setViewState('list')}
  onBack={() => setViewState('list')}
  showBackButton={true}
/>
```
