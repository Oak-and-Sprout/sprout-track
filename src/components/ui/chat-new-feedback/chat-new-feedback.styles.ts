export const chatNewFeedbackStyles = {
  container: "flex flex-col h-full min-w-0",
  // Header
  header: "px-5 py-3 border-b border-slate-200 flex items-center gap-2.5 bg-white flex-shrink-0",
  backButton: "bg-transparent border-none cursor-pointer p-0 text-emerald-500 flex items-center",
  headerContent: "flex-1",
  headerTitle: "text-sm font-medium text-gray-900",
  headerDescription: "text-[11px] text-gray-400",
  // Form body
  formBody: "flex-1 p-5 bg-gray-50/50 overflow-y-auto",
  successBanner: "px-4 py-3.5 rounded-xl mb-5 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200",
  successText: "text-[13px] font-medium text-emerald-800",
  fieldGroup: "mb-4",
  fieldLabel: "text-xs font-medium text-gray-500 block mb-1.5",
  // Footer
  footer: "px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between flex-shrink-0",
  sendButton: "flex items-center gap-1.5 px-[18px] py-2 rounded-lg text-[13px] font-medium border-none transition-all duration-150 cursor-pointer",
  sendButtonActive: "bg-emerald-500 text-white",
  sendButtonInactive: "bg-slate-200 text-gray-400 cursor-default",
  cancelButton: "px-3.5 py-2 bg-transparent text-gray-500 border border-slate-200 rounded-lg text-xs cursor-pointer",
} as const;
