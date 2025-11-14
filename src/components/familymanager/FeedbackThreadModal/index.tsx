'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { 
  Loader2,
  Eye,
  EyeOff,
  Reply,
  MessageSquare,
  Calendar,
  User,
} from "lucide-react";
import { FeedbackThreadModalProps } from "./feedback-thread-modal.types";
import "./feedback-thread-modal.css";

/**
 * FeedbackThreadModal Component
 * 
 * Displays a feedback thread in an email-like interface with original message and replies.
 * Follows the project's component pattern with separated types and CSS for dark mode.
 * 
 * Features:
 * - Email thread-like UI
 * - Mobile responsive design
 * - Admin cannot mark their own messages as read
 * - Visual distinction between read/unread replies
 * - Reply functionality
 */
export default function FeedbackThreadModal({
  feedback,
  isOpen,
  onClose,
  onUpdateFeedback,
  updatingFeedbackId,
  formatDateTime,
  onReply,
  onRefresh,
}: FeedbackThreadModalProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Check if current user is admin and get admin email
  useEffect(() => {
    if (isOpen) {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          const isAccountAdmin = decodedPayload.isAccountAuth && decodedPayload.role === 'OWNER';
          const isRegularAdmin = decodedPayload.role === 'ADMIN';
          const isSysAdmin = decodedPayload.isSysAdmin === true;
          setIsAdmin(isAccountAdmin || isRegularAdmin || isSysAdmin);
          
          // Get admin email from AppConfig if available
          // For now, we'll check if submitterEmail matches admin email pattern
          // In a real scenario, you might want to fetch this from an API
          if (isSysAdmin || isRegularAdmin) {
            // Admin email will be set when we check replies
            setAdminEmail(decodedPayload.accountEmail || null);
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
      }
    }
  }, [isOpen]);

  // Extract admin email from replies if available
  useEffect(() => {
    if (feedback?.replies) {
      const adminReply = feedback.replies.find(r => r.submitterName === 'Admin');
      if (adminReply?.submitterEmail) {
        setAdminEmail(adminReply.submitterEmail);
      }
    }
  }, [feedback]);

  const handleClose = () => {
    setShowReplyForm(false);
    setReplyMessage('');
    onClose();
  };

  const handleReply = async () => {
    if (!feedback || !replyMessage.trim() || !onReply) {
      return;
    }

    setSendingReply(true);
    try {
      await onReply(feedback.id, replyMessage.trim());
      setReplyMessage('');
      setShowReplyForm(false);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const isAdminMessage = (submitterEmail: string | null, submitterName: string | null) => {
    if (!adminEmail) return false;
    return submitterEmail === adminEmail || submitterName === 'Admin';
  };

  if (!feedback) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="feedback-thread-modal-content max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b-[1px]">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            Feedback Thread
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Original Message */}
          <div className="feedback-thread-original-message border rounded-lg p-3 sm:p-4 bg-white">
            <div className="space-y-2 sm:space-y-3">
              {/* Subject */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Subject</div>
                <div className="feedback-thread-subject-text text-sm sm:text-base font-semibold text-gray-900 break-words">
                  {feedback.subject}
                </div>
              </div>

              {/* From */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-3 w-3 sm:h-4 sm:w-4 feedback-thread-replies-icon text-gray-400 flex-shrink-0" />
                  <span className="font-medium feedback-thread-submitter-name text-gray-900">
                    {feedback.submitterName || 'Anonymous'}
                  </span>
                  {feedback.submitterEmail && (
                    <span className="feedback-thread-submitter-email-text feedback-thread-meta-text text-gray-500 break-all">
                      &lt;{feedback.submitterEmail}&gt;
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 feedback-thread-date-text feedback-thread-meta-text text-gray-500">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 feedback-thread-replies-icon flex-shrink-0" />
                  <span className="break-words">{formatDateTime(feedback.submittedAt)}</span>
                </div>
              </div>

              {/* Message Body */}
              <div className="pt-2 feedback-thread-divider border-t">
                <div className="feedback-thread-message-text text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {feedback.message}
                </div>
              </div>
            </div>
          </div>

          {/* Replies Section */}
          {feedback.replies && feedback.replies.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 px-1 sm:px-2">
                <Reply className="h-3 w-3 sm:h-4 sm:w-4 feedback-thread-replies-icon text-gray-500 flex-shrink-0" />
                <h3 className="text-xs sm:text-sm font-semibold feedback-thread-replies-header text-gray-700">
                  Replies ({feedback.replies.length})
                </h3>
              </div>
              {feedback.replies.map((reply) => {
                const isRead = reply.viewed;
                const isAdminMsg = isAdminMessage(reply.submitterEmail, reply.submitterName);
                const canMarkAsRead = isAdmin && !isAdminMsg; // Admin can only mark user messages as read

                return (
                  <div
                    key={reply.id}
                    className={`feedback-thread-reply border-l-4 pl-3 sm:pl-4 py-2 sm:py-3 rounded-r ${
                      isRead 
                        ? 'feedback-thread-reply-read bg-gray-50 border-gray-300' 
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <span className="font-medium feedback-thread-reply-name text-gray-900">
                            {reply.submitterName || 'Admin'}
                          </span>
                          {reply.submitterEmail && (
                            <span className="feedback-thread-submitter-email-text feedback-thread-meta-text text-xs text-gray-500 break-all">
                              &lt;{reply.submitterEmail}&gt;
                            </span>
                          )}
                          <span className="feedback-thread-reply-date feedback-thread-meta-text text-xs text-gray-500 whitespace-nowrap">
                            {formatDateTime(reply.submittedAt)}
                          </span>
                        </div>
                        {!isRead && canMarkAsRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onUpdateFeedback(reply.id, true);
                            }}
                            disabled={updatingFeedbackId === reply.id}
                            title="Mark as read"
                            className="h-7 text-xs self-start sm:self-auto"
                          >
                            {updatingFeedbackId === reply.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className={`feedback-thread-message-text text-xs sm:text-sm whitespace-pre-wrap break-words ${
                        isRead 
                          ? 'feedback-thread-reply-message-read text-gray-600' 
                          : 'feedback-thread-reply-message-unread text-gray-700'
                      }`}>
                        {reply.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply Form */}
          {showReplyForm ? (
            <div className="feedback-thread-reply-form border rounded-lg p-3 sm:p-4 bg-gray-50">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-medium feedback-thread-form-label text-gray-700">Reply</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyMessage('');
                    }}
                    className="text-xs sm:text-sm"
                  >
                    Cancel
                  </Button>
                </div>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={5}
                  className="bg-white text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleReply}
                    disabled={!replyMessage.trim() || sendingReply}
                    className="text-xs sm:text-sm"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                        <span className="hidden sm:inline">Sending...</span>
                        <span className="sm:hidden">Sending</span>
                      </>
                    ) : (
                      <>
                        <Reply className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Send Reply</span>
                        <span className="sm:hidden">Send</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowReplyForm(true)}
              className="w-full text-xs sm:text-sm"
            >
              <Reply className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Reply
            </Button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t-[1px] flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onUpdateFeedback(feedback.id, !feedback.viewed);
            }}
            disabled={updatingFeedbackId === feedback.id}
            className="text-xs sm:text-sm flex-1 sm:flex-initial"
          >
            {updatingFeedbackId === feedback.id ? (
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
            ) : feedback.viewed ? (
              <EyeOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            ) : (
              <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Mark as {feedback.viewed ? 'Unread' : 'Read'}</span>
            <span className="sm:hidden">{feedback.viewed ? 'Unread' : 'Read'}</span>
          </Button>
          
          <Button onClick={handleClose} className="text-xs sm:text-sm flex-1 sm:flex-initial">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

