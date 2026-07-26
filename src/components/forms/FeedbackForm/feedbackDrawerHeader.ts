export type FeedbackDrawerView = 'list' | 'conversation' | 'new';

export interface FeedbackDrawerThread {
  subject: string;
  replies?: unknown[];
}

/**
 * Selects the storybook drawer title/subtitle for the feedback drawer views.
 * The conversation subtitle mirrors the count composition used by the
 * default FormPage branch: `${1 + replies.length} message[s]`.
 */
export function getFeedbackDrawerHeader(
  viewState: FeedbackDrawerView,
  thread: FeedbackDrawerThread | null,
  t: (key: string) => string,
): { title: string; subtitle: string } {
  if (viewState === 'conversation' && thread) {
    const replyCount = thread.replies?.length || 0;
    return {
      title: thread.subject,
      subtitle: `${1 + replyCount} ${t('message')}${replyCount > 0 ? 's' : ''}`,
    };
  }
  if (viewState === 'new') {
    return {
      title: t('New feedback.'),
      subtitle: t('Send a message to the Sprout Track team'),
    };
  }
  return {
    title: t('Send feedback.'),
    subtitle: t("It lands straight in the developer's inbox."),
  };
}
