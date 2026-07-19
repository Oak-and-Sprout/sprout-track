import { FeedTimerCategory } from '@/src/utils/feedTimerConfig';

export interface FeedTimerTypesFieldProps {
  /** Currently selected categories (all categories = every feed counts). */
  value: FeedTimerCategory[];
  onChange: (value: FeedTimerCategory[]) => void;
  /** Prefix for input ids/labels to keep them unique per form instance. */
  idPrefix?: string;
}
