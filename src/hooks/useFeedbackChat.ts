'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FeedbackResponse } from '@/app/api/types';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

export interface SubmitterInfo {
  name: string;
  email: string;
  familyId: string | null;
  familyName: string | null;
}

export interface UseFeedbackChatReturn {
  threads: FeedbackResponse[];
  loading: boolean;
  fetchThreads: () => Promise<void>;
  sendReply: (parentId: string, message: string, subject?: string, familyId?: string | null) => Promise<FeedbackResponse>;
  sendNewFeedback: (subject: string, message: string) => Promise<FeedbackResponse>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  submitterInfo: SubmitterInfo;
  loadSubmitterInfo: () => Promise<void>;
  formatDateTime: (dateString: string | null) => string;
  countUnreadMessages: (thread: FeedbackResponse) => number;
  startPolling: () => void;
  stopPolling: () => void;
}

export function useFeedbackChat(isAdmin: boolean): UseFeedbackChatReturn {
  const [threads, setThreads] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitterInfo, setSubmitterInfo] = useState<SubmitterInfo>({
    name: '',
    email: '',
    familyId: null,
    familyName: null,
  });
  const isFetchingRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSubmitterInfo = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;

      const payload = authToken.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      let name = 'User';
      let email = '';

      if (decoded.isAccountAuth) {
        name = decoded.accountEmail ? decoded.accountEmail.split('@')[0] : 'Account User';
        email = decoded.accountEmail || '';
      } else {
        name = decoded.name || 'User';
      }

      let familyId: string | null = decoded.familyId || null;
      let familyName: string | null = null;

      if (decoded.familyId && decoded.familySlug) {
        try {
          const res = await fetch(`/api/family/by-slug/${decoded.familySlug}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              familyId = data.data.id;
              familyName = data.data.name;
            }
          }
        } catch {
          // Not critical
        }
      }

      setSubmitterInfo({ name, email, familyId, familyName });
    } catch (error) {
      console.error('Error parsing auth token:', error);
      setSubmitterInfo({ name: 'User', email: '', familyId: null, familyName: null });
    }
  }, []);

  // Shared fetch logic; showLoading controls whether the loading spinner shows
  const doFetch = useCallback(async (showLoading: boolean) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const response = await authFetch('/api/feedback');
      const data = await response.json();
      if (data.success) {
        setThreads(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      if (showLoading) setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    await doFetch(true);
  }, [doFetch]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      doFetch(false);
    }, 10000);
  }, [doFetch]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const sendReply = useCallback(async (
    parentId: string,
    message: string,
    subject?: string,
    familyId?: string | null,
  ): Promise<FeedbackResponse> => {
    const response = await authFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: subject || '',
        message,
        parentId,
        familyId: familyId ?? null,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send reply');
    }
    await fetchThreads();
    return data.data;
  }, [fetchThreads]);

  const sendNewFeedback = useCallback(async (
    subject: string,
    message: string,
  ): Promise<FeedbackResponse> => {
    const response = await authFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: subject.trim(),
        message: message.trim(),
        familyId: submitterInfo.familyId,
        submitterName: submitterInfo.name,
        submitterEmail: submitterInfo.email || null,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to submit feedback');
    }
    await fetchThreads();
    return data.data;
  }, [fetchThreads, submitterInfo]);

  const updateViewed = useCallback(async (id: string, viewed: boolean) => {
    const response = await authFetch(`/api/feedback?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewed }),
    });
    const data = await response.json();
    if (data.success) {
      setThreads(prev =>
        prev.map(item => {
          if (item.id === id) {
            return { ...item, viewed: data.data.viewed };
          }
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
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await updateViewed(id, true);
  }, [updateViewed]);

  const markAsUnread = useCallback(async (id: string) => {
    await updateViewed(id, false);
  }, [updateViewed]);

  const countUnreadMessages = useCallback((thread: FeedbackResponse): number => {
    if (isAdmin) {
      // Admin counts unread user messages
      let count = thread.viewed ? 0 : 1;
      if (thread.replies) {
        count += thread.replies.filter(r => !r.viewed && r.submitterName !== 'Admin').length;
      }
      return count;
    } else {
      // User counts unread admin replies
      if (!thread.replies) return 0;
      return thread.replies.filter(r => !r.viewed && r.submitterName === 'Admin').length;
    }
  }, [isAdmin]);

  return {
    threads,
    loading,
    fetchThreads,
    sendReply,
    sendNewFeedback,
    markAsRead,
    markAsUnread,
    submitterInfo,
    loadSubmitterInfo,
    formatDateTime,
    countUnreadMessages,
    startPolling,
    stopPolling,
  };
}
