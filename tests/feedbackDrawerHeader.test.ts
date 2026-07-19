import { describe, it, expect } from 'vitest';
import { getFeedbackDrawerHeader } from '@/src/components/forms/FeedbackForm/feedbackDrawerHeader';

const t = (key: string) => key;

describe('getFeedbackDrawerHeader', () => {
  it('returns the send-feedback header for the list view', () => {
    expect(getFeedbackDrawerHeader('list', null, t)).toEqual({
      title: 'Send feedback.',
      subtitle: "It lands straight in the developer's inbox.",
    });
  });

  it('returns the new-feedback header for the new view', () => {
    expect(getFeedbackDrawerHeader('new', null, t)).toEqual({
      title: 'New feedback.',
      subtitle: 'Send a message to the Sprout Track team',
    });
  });

  it('uses the thread subject and singular count for a conversation with no replies', () => {
    expect(
      getFeedbackDrawerHeader('conversation', { subject: 'Sleep chart bug', replies: [] }, t),
    ).toEqual({ title: 'Sleep chart bug', subtitle: '1 message' });
  });

  it('pluralizes the count when the thread has replies', () => {
    expect(
      getFeedbackDrawerHeader('conversation', { subject: 'Sleep chart bug', replies: [{}, {}] }, t),
    ).toEqual({ title: 'Sleep chart bug', subtitle: '3 messages' });
  });

  it('treats a missing replies array as no replies', () => {
    expect(
      getFeedbackDrawerHeader('conversation', { subject: 'Hi' }, t),
    ).toEqual({ title: 'Hi', subtitle: '1 message' });
  });

  it('falls back to the list header when the conversation view has no thread', () => {
    expect(getFeedbackDrawerHeader('conversation', null, t)).toEqual({
      title: 'Send feedback.',
      subtitle: "It lands straight in the developer's inbox.",
    });
  });
});
