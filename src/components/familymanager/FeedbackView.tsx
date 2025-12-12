'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Button } from "@/src/components/ui/button";
import { 
  Loader2,
  Eye,
  EyeOff,
  Mail,
  User,
  Calendar,
} from "lucide-react";
import { FeedbackResponse } from '@/app/api/types';
import FeedbackThreadModal from './FeedbackThreadModal';
import './FeedbackView/feedback-view.css';

interface FeedbackViewProps {
  paginatedData: FeedbackResponse[];
  onUpdateFeedback: (id: string, viewed: boolean) => void;
  updatingFeedbackId: string | null;
  formatDateTime: (dateString: string | null) => string;
  onRefresh?: () => void;
}

// Helper function to count unread messages from non-admin users
const countUnreadUserMessages = (feedback: FeedbackResponse): number => {
  if (!feedback.replies || feedback.replies.length === 0) {
    return feedback.viewed ? 0 : 1; // Original message counts if unread
  }
  
  // Count unread replies from non-admin users
  const unreadUserReplies = feedback.replies.filter(reply => {
    const isAdminMessage = reply.submitterName === 'Admin';
    return !reply.viewed && !isAdminMessage;
  });
  
  // Also count original message if unread
  const originalUnread = feedback.viewed ? 0 : 1;
  
  return unreadUserReplies.length + originalUnread;
};

export default function FeedbackView({
  paginatedData,
  onUpdateFeedback,
  updatingFeedbackId,
  formatDateTime,
  onRefresh,
}: FeedbackViewProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubjectClick = (feedback: FeedbackResponse) => {
    setSelectedFeedback(feedback);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFeedback(null);
  };

  const handleReply = async (parentId: string, message: string) => {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        subject: selectedFeedback?.subject || '', // Will be prefixed with "Re: " in API
        message: message,
        parentId: parentId,
        familyId: selectedFeedback?.familyId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send reply');
    }

    // Refresh the feedback list to get updated data
    if (onRefresh) {
      onRefresh();
    }

    // Update selected feedback to include the new reply immediately
    if (selectedFeedback) {
      const updatedFeedback = {
        ...selectedFeedback,
        replies: [...(selectedFeedback.replies || []), data.data],
      };
      setSelectedFeedback(updatedFeedback);
    }

    return data.data;
  };

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>Submitter</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Message Preview</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 feedback-view-empty-text text-gray-500">
              No feedback found.
            </TableCell>
          </TableRow>
        ) : (
          paginatedData.map((feedback) => (
            <TableRow key={feedback.id} className={!feedback.viewed ? 'feedback-view-row-unread bg-blue-50' : ''}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {!feedback.viewed && (
                    <div className="w-2 h-2 feedback-view-unread-indicator bg-blue-500 rounded-full" title="Unread" />
                  )}
                  <button
                    onClick={() => handleSubjectClick(feedback)}
                    className="feedback-view-subject-link text-left hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-2"
                    title="Click to view full message"
                  >
                    <span>{feedback.subject}</span>
                    {feedback.replies && feedback.replies.length > 0 && (
                      <span className="feedback-view-reply-badge text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {feedback.replies.length} {feedback.replies.length === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </button>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 feedback-view-icon text-gray-400" />
                    <span className="font-medium feedback-view-submitter-name">
                      {feedback.submitterName || 'Anonymous'}
                    </span>
                  </div>
                  {feedback.submitterEmail && (
                    <div className="flex items-center gap-1 text-xs feedback-view-submitter-email text-gray-500">
                      <Mail className="h-3 w-3 feedback-view-icon" />
                      {feedback.submitterEmail}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3 feedback-view-icon text-gray-400" />
                  {formatDateTime(feedback.submittedAt)}
                </div>
              </TableCell>
              <TableCell>
                {(() => {
                  const unreadCount = countUnreadUserMessages(feedback);
                  const hasUnread = unreadCount > 0;
                  
                  if (hasUnread) {
                    return (
                      <span className="feedback-view-unread-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
                      </span>
                    );
                  }
                  
                  return (
                    <span className="feedback-view-status-read inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <Eye className="h-3 w-3 mr-1" />
                      Read
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell className="max-w-xs">
                <div className="truncate text-sm feedback-view-message-preview text-gray-600">
                  {feedback.message.length > 100 
                    ? `${feedback.message.substring(0, 100)}...` 
                    : feedback.message
                  }
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateFeedback(feedback.id, !feedback.viewed)}
                    disabled={updatingFeedbackId === feedback.id}
                    title={feedback.viewed ? 'Mark as unread' : 'Mark as read'}
                  >
                    {updatingFeedbackId === feedback.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : feedback.viewed ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>

    {/* Feedback Thread Modal */}
    <FeedbackThreadModal
      feedback={selectedFeedback}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onUpdateFeedback={onUpdateFeedback}
      updatingFeedbackId={updatingFeedbackId}
      formatDateTime={formatDateTime}
      onReply={handleReply}
      onRefresh={onRefresh}
    />
    </>
  );
}
