import { cn } from '@/src/lib/utils';
import { chatConversationStyles as s } from './chat-conversation.styles';

/**
 * Default class map — reproduces the exact class strings the component
 * rendered before the appearance prop existed (CVA styles + dark hooks +
 * inline literals). Do not change these values without checking the
 * side-nav and family-manager surfaces.
 */
export const chatConversationDefault = {
  container: cn(s.container, 'chat-conversation-container'),
  emptyState: cn(s.emptyState, 'chat-conversation-empty'),
  emptyIcon: 'h-8 w-8 chat-conversation-empty-icon',
  header: cn(s.header, 'chat-conversation-header'),
  backButton: s.backButton,
  headerContent: s.headerContent,
  headerSubject: cn(s.headerSubject, 'chat-conversation-subject'),
  headerMeta: cn(s.headerMeta, 'chat-conversation-meta'),
  headerMetaDivider: cn(s.headerMetaDivider, 'chat-conversation-meta-divider'),
  headerMetaName: cn(s.headerMetaName, 'chat-conversation-meta-name'),
  messagesArea: cn(s.messagesArea, 'chat-conversation-messages'),
  dateBreak: cn(s.dateBreak, 'chat-conversation-date-break'),
  messageWrapper: s.messageWrapper,
  messageWrapperMine: s.messageWrapperMine,
  messageWrapperTheirs: s.messageWrapperTheirs,
  senderRow: s.senderRow,
  senderRowMine: s.senderRowMine,
  senderRowTheirs: s.senderRowTheirs,
  avatar: s.avatar,
  avatarMine: cn(s.avatarMine, 'chat-conversation-avatar-mine'),
  avatarAdmin: cn(s.avatarAdmin, 'chat-conversation-avatar-admin'),
  avatarUser: cn(s.avatarUser, 'chat-conversation-avatar-user'),
  senderNameMine: cn(s.senderNameMine, 'chat-conversation-sender-mine'),
  senderNameTheirs: cn(s.senderNameTheirs, 'chat-conversation-sender-theirs'),
  familyTag: cn(s.familyTag, 'chat-conversation-family-tag'),
  bubbleMine: cn(s.bubbleMine, 'chat-conversation-bubble-mine'),
  bubbleTheirs: cn(s.bubbleTheirs, 'chat-conversation-bubble-theirs'),
  timestamp: cn(s.timestamp, 'chat-conversation-timestamp'),
  timestampMine: s.timestampMine,
  timestampTheirs: s.timestampTheirs,
  attachmentGrid: s.attachmentGrid,
  attachmentWrapper: s.attachmentWrapper,
  attachmentImage: s.attachmentImage,
  attachmentDeleteButton: cn(s.attachmentDeleteButton, 'chat-conversation-attachment-delete'),
  confirmOverlay: 'absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 rounded-lg',
  confirmLabel: 'text-white text-[10px] font-medium',
  confirmYes: 'px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium border-none cursor-pointer',
  confirmNo: 'px-2 py-0.5 rounded bg-gray-500 text-white text-[10px] font-medium border-none cursor-pointer',
  replyPreviewStrip: cn(s.replyPreviewStrip, 'chat-conversation-preview-strip'),
  replyPreviewStripInline: cn('flex gap-2 flex-wrap mb-2', 'chat-conversation-preview-strip-inline'),
  replyPreviewItem: s.replyPreviewItem,
  replyPreviewImage: s.replyPreviewImage,
  replyPreviewDelete: s.replyPreviewDelete,
  replyBar: cn(s.replyBar, 'chat-conversation-reply-bar'),
  replyAttachButton: cn(s.replyAttachButton, 'chat-conversation-attach-button'),
  attachIcon: 'h-[18px] w-[18px] text-gray-500',
  replyTextarea: cn(s.replyTextarea, 'chat-conversation-reply-textarea'),
  sendButton: s.sendButton,
  sendButtonActive: s.sendButtonActive,
  sendButtonInactive: cn(s.sendButtonInactive, 'chat-conversation-send-inactive'),
  sendIconColorOn: '#fff',
  sendIconColorOff: '#a3a39b',
};

export type ChatConversationClassMap = Record<keyof typeof chatConversationDefault, string>;

/**
 * Storybook (landing drawer) class map. Light-only; no chat-* dark hooks.
 * Header keys inherit defaults: the header never renders in the storybook
 * surface (hideHeader is set; the drawer provides the title).
 */
export const chatConversationSb: ChatConversationClassMap = {
  ...chatConversationDefault,
  container: 'sb-chat-conv',
  emptyState: 'sb-empty sb-chat-empty',
  emptyIcon: 'h-8 w-8',
  messagesArea: 'sb-chat-msgs',
  dateBreak: 'sb-chat-date',
  avatar: 'sb-chat-av',
  avatarMine: 'sb-chat-av-mine',
  avatarAdmin: 'sb-chat-av-team',
  avatarUser: 'sb-chat-av-user',
  senderNameMine: 'sb-chat-sender',
  senderNameTheirs: 'sb-chat-sender',
  bubbleMine: 'sb-chat-bub sb-chat-bub-mine',
  bubbleTheirs: 'sb-chat-bub sb-chat-bub-theirs',
  timestamp: 'sb-chat-time',
  attachmentImage: 'sb-chat-att-img',
  attachmentDeleteButton: 'sb-chat-att-del',
  confirmOverlay: 'sb-chat-conf',
  confirmLabel: '',
  confirmYes: 'sb-chat-conf-yes',
  confirmNo: 'sb-chat-conf-no',
  replyPreviewStripInline: 'flex gap-2 flex-wrap mb-2',
  replyPreviewItem: 'sb-chat-prev',
  replyPreviewImage: 'w-full h-full object-cover',
  replyPreviewDelete: 'sb-chat-prev-del',
  replyAttachButton: 'sb-chat-attach',
  attachIcon: 'h-[18px] w-[18px]',
  replyTextarea: 'sb-chat-reply-ta',
  sendButton: 'sb-chat-send',
  sendButtonActive: 'sb-chat-send-on',
  sendButtonInactive: 'sb-chat-send-off',
  sendIconColorOn: '#fffdf6',
  sendIconColorOff: '#6b7a6c',
};
