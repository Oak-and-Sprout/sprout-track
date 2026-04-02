export const chatConversationStyles = {
  container: "flex flex-col h-full min-w-0",
  // Header
  header: "px-5 py-3 border-b border-slate-200 flex items-center gap-2.5 bg-white flex-shrink-0",
  backButton: "bg-transparent border-none cursor-pointer p-0 text-emerald-500 flex items-center",
  headerContent: "flex-1 min-w-0",
  headerSubject: "text-sm font-medium text-gray-900 truncate",
  headerMeta: "text-[11px] text-gray-400 flex items-center gap-1.5 flex-wrap",
  headerMetaDivider: "text-gray-300",
  headerMetaName: "text-gray-500 font-medium",
  // Messages area
  messagesArea: "flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-2 bg-gray-50/50",
  dateBreak: "text-center text-[10px] text-gray-400 py-2 pb-3 font-medium tracking-wide",
  messageWrapper: "flex flex-col mb-1",
  messageWrapperMine: "items-end",
  messageWrapperTheirs: "items-start",
  // Sender label
  senderRow: "flex items-center gap-1.5 mb-1",
  senderRowMine: "flex-row-reverse pr-0.5",
  senderRowTheirs: "flex-row pl-0.5",
  avatar: "w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-semibold",
  avatarMine: "bg-emerald-100 text-emerald-800",
  avatarAdmin: "bg-blue-100 text-blue-800",
  avatarUser: "bg-amber-100 text-amber-800",
  senderName: "text-[11px] font-medium",
  senderNameMine: "text-emerald-800",
  senderNameTheirs: "text-gray-500",
  familyTag: "text-[10px] text-amber-800 bg-amber-50 px-1.5 py-px rounded font-medium",
  // Bubble
  bubbleMine: "max-w-[82%] px-3.5 py-2.5 rounded-[14px] rounded-br-[4px] bg-emerald-500 text-white text-[13px] leading-relaxed",
  bubbleTheirs: "max-w-[82%] px-3.5 py-2.5 rounded-[14px] rounded-bl-[4px] bg-white text-gray-900 text-[13px] leading-relaxed border border-slate-200 shadow-sm",
  timestamp: "text-[10px] text-gray-400 mt-0.5",
  timestampMine: "pr-0.5",
  timestampTheirs: "pl-0.5",
  // Reply input
  replyBar: "px-4 py-3 border-t border-slate-200 bg-white flex items-end gap-2 flex-shrink-0",
  replyTextarea: "flex-1 px-3 py-2 border border-slate-200 rounded-2xl text-[13px] text-gray-900 bg-gray-50 resize-none outline-none leading-normal max-h-[120px] overflow-auto",
  sendButton: "w-9 h-9 rounded-full border-none flex items-center justify-center transition-all duration-150 flex-shrink-0 cursor-pointer",
  sendButtonActive: "bg-emerald-500",
  sendButtonInactive: "bg-slate-200 cursor-default",
  // Empty state
  emptyState: "flex-1 flex flex-col items-center justify-center text-gray-400 text-[13px] gap-2",
} as const;
