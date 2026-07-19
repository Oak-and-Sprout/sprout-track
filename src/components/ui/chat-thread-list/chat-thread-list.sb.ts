import { cn } from '@/src/lib/utils';
import { chatThreadListStyles as s } from './chat-thread-list.styles';

/**
 * Default class map — reproduces the exact class strings the component
 * rendered before the appearance prop existed (CVA styles + dark hooks).
 * Do not change these values without checking the side-nav and
 * family-manager surfaces.
 */
export const chatThreadListDefault = {
  container: cn(s.container, 'chat-thread-list-container'),
  header: cn(s.header, 'chat-thread-list-header'),
  headerTitle: cn(s.headerTitle, 'chat-thread-list-header-title'),
  toggleButton: s.toggleButton,
  toggleButtonActive: cn(s.toggleButtonActive, 'chat-thread-list-toggle-active'),
  toggleButtonInactive: cn(s.toggleButtonInactive, 'chat-thread-list-toggle-inactive'),
  searchContainer: cn('chat-thread-list-search', s.searchContainer),
  searchInput: cn(s.searchInput, 'chat-thread-list-search-input'),
  list: s.list,
  emptyState: cn(s.emptyState, 'chat-thread-list-empty'),
  threadItem: cn(s.threadItem, 'chat-thread-list-item'),
  threadItemActive: cn(s.threadItemActive, 'chat-thread-list-item-active'),
  threadItemInactive: s.threadItemInactive,
  threadSubject: cn(s.threadSubject, 'chat-thread-list-subject'),
  threadSubjectUnread: s.threadSubjectUnread,
  threadSubjectRead: s.threadSubjectRead,
  unreadDot: s.unreadDot,
  threadMeta: cn(s.threadMeta, 'chat-thread-list-meta'),
  threadMetaLeft: s.threadMetaLeft,
  threadMetaRight: cn(s.threadMetaRight, 'chat-thread-list-meta-right'),
};

export type ChatThreadListClassMap = Record<keyof typeof chatThreadListDefault, string>;

/**
 * Storybook (landing drawer) class map. Light-only; no chat-* dark hooks.
 * The header/search keys inherit default values: those elements never render
 * in the storybook surface (hideHeader is set and search is admin-only).
 */
export const chatThreadListSb: ChatThreadListClassMap = {
  ...chatThreadListDefault,
  container: 'sb-chat-list',
  list: 'sb-chat-rows',
  emptyState: 'sb-empty sb-chat-empty',
  threadItem: 'sb-chat-row',
  threadItemActive: 'sb-chat-row-on',
  threadItemInactive: '',
  threadSubject: 'sb-chat-row-subj',
  threadSubjectUnread: 'sb-chat-unread',
  threadSubjectRead: '',
  unreadDot: 'sb-chat-dot',
  threadMeta: 'sb-chat-row-meta',
  threadMetaLeft: 'truncate',
  threadMetaRight: 'sb-chat-row-time',
};
