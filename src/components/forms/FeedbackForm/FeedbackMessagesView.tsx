'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Loader2, MessageSquare, Calendar, User, Reply } from 'lucide-react';
import { FeedbackResponse } from '@/app/api/types';
import FeedbackThreadModal from '@/src/components/familymanager/FeedbackThreadModal';
import './feedback-messages-view.css';

interface FeedbackMessagesViewProps {
  formatDateTime: (dateString: string | null) => string;
  refreshTrigger?: number; // Trigger refresh when this changes
}

export default function FeedbackMessagesView({ formatDateTime, refreshTrigger }: FeedbackMessagesViewProps) {
  const [feedbackList, setFeedbackList] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/feedback', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });

      const data = await response.json();
      if (data.success) {
        setFeedbackList(data.data || []);
      } else {
        console.error('Error fetching feedback:', data.error);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [refreshTrigger]);

  const handleCardClick = (feedback: FeedbackResponse) => {
    setSelectedFeedback(feedback);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFeedback(null);
  };

  const handleUpdateFeedback = async (id: string, viewed: boolean) => {
    setUpdatingFeedbackId(id);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/feedback?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ viewed }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setFeedbackList(prev => 
          prev.map(item => {
            if (item.id === id) {
              return { ...item, viewed: data.data.viewed };
            }
            // Also update replies
            if (item.replies) {
              return {
                ...item,
                replies: item.replies.map(reply => 
                  reply.id === id ? { ...reply, viewed: data.data.viewed } : reply
                ),
              };
            }
            return item;
          })
        );
        
        // Update selected feedback if it's the one being updated
        if (selectedFeedback && (selectedFeedback.id === id || selectedFeedback.replies?.some(r => r.id === id))) {
          const updatedFeedback = feedbackList.find(f => f.id === selectedFeedback.id);
          if (updatedFeedback) {
            setSelectedFeedback(updatedFeedback);
          }
        }
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  const handleReply = async (parentId: string, message: string) => {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify({
        subject: selectedFeedback?.subject || '',
        message: message,
        parentId: parentId,
        familyId: selectedFeedback?.familyId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send reply');
    }

    // Refresh the feedback list
    await fetchFeedback();

    // Update selected feedback to include the new reply immediately
    if (selectedFeedback) {
      const updatedFeedback = feedbackList.find(f => f.id === selectedFeedback.id);
      if (updatedFeedback) {
        setSelectedFeedback(updatedFeedback);
      }
    }

    return data.data;
  };

  const countUnreadReplies = (feedback: FeedbackResponse): number => {
    if (!feedback.replies) return 0;
    return feedback.replies.filter(reply => !reply.viewed && reply.submitterName === 'Admin').length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (feedbackList.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 feedback-messages-empty-text">No messages yet</p>
        <p className="text-sm text-gray-400 mt-2">Your feedback and replies will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 feedback-messages-container">
        {feedbackList.map((feedback) => {
          const unreadCount = countUnreadReplies(feedback);
          const hasUnread = unreadCount > 0;

          return (
            <Card
              key={feedback.id}
              className={`feedback-message-card cursor-pointer transition-all hover:shadow-md ${
                hasUnread ? 'feedback-message-card-unread' : ''
              }`}
              onClick={() => handleCardClick(feedback)}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base feedback-message-subject text-gray-900 truncate">
                          {feedback.subject}
                        </h3>
                        {hasUnread && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full feedback-message-unread-badge bg-blue-100 text-blue-800">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm feedback-message-preview text-gray-600 line-clamp-2">
                        {feedback.message}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs feedback-message-meta text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDateTime(feedback.submittedAt)}</span>
                    </div>
                    {feedback.replies && feedback.replies.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Reply className="h-3 w-3" />
                        <span>{feedback.replies.length} {feedback.replies.length === 1 ? 'reply' : 'replies'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedFeedback && (
        <FeedbackThreadModal
          feedback={selectedFeedback}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdateFeedback={handleUpdateFeedback}
          updatingFeedbackId={updatingFeedbackId}
          formatDateTime={formatDateTime}
          onReply={handleReply}
          onRefresh={fetchFeedback}
        />
      )}
    </>
  );
}

