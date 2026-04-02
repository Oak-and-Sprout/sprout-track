'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TableSearch,
  TablePagination,
  TablePageSize,
} from "@/src/components/ui/table";
import type { SortDirection } from "@/src/components/ui/table";
import { Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { FeedbackView } from '@/src/components/familymanager';
import { FeedbackResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';
import { useDeployment } from '@/app/context/deployment';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

export default function FeedbackPage() {
  const { t } = useLocalization();
  const { isSaasMode } = useDeployment();
  const router = useRouter();
  const { updateCount } = useAdminCounts();

  const [feedback, setFeedback] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: string) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  useEffect(() => {
    if (!isSaasMode) {
      router.replace('/family-manager/families');
    }
  }, [isSaasMode, router]);

  const countUnreadUserMessages = useCallback((item: FeedbackResponse): number => {
    if (!item.replies || item.replies.length === 0) {
      return item.viewed ? 0 : 1;
    }
    const unreadUserReplies = item.replies.filter(reply => {
      const isAdminMessage = reply.submitterName === 'Admin';
      return !reply.viewed && !isAdminMessage;
    });
    const originalUnread = item.viewed ? 0 : 1;
    return unreadUserReplies.length + originalUnread;
  }, []);

  const fetchFeedback = useCallback(async () => {
    try {
      const response = await authFetch('/api/feedback');
      const data = await response.json();
      if (data.success) {
        setFeedback(data.data);
        updateCount('feedback', data.data.filter((item: FeedbackResponse) => !item.viewed).length);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  }, [updateCount]);

  const updateFeedback = async (id: string, viewed: boolean) => {
    try {
      setUpdatingFeedbackId(id);
      const response = await authFetch(`/api/feedback?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewed }),
      });
      const data = await response.json();
      if (data.success) {
        fetchFeedback();
      } else {
        alert('Failed to update feedback: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Error updating feedback');
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  useEffect(() => {
    if (!isSaasMode) return;
    const fetchData = async () => {
      setLoading(true);
      await fetchFeedback();
      setLoading(false);
    };
    fetchData();
  }, [isSaasMode, fetchFeedback]);

  const defaultSortedData = useMemo(() => {
    return [...feedback].sort((a, b) => {
      const aUnread = countUnreadUserMessages(a);
      const bUnread = countUnreadUserMessages(b);
      if (aUnread !== bUnread) return bUnread - aUnread;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [feedback, countUnreadUserMessages]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return defaultSortedData;
    const search = searchTerm.toLowerCase();
    return defaultSortedData.filter(item =>
      item.subject.toLowerCase().includes(search) ||
      item.message.toLowerCase().includes(search) ||
      item.submitterName?.toLowerCase().includes(search) ||
      item.submitterEmail?.toLowerCase().includes(search)
    );
  }, [defaultSortedData, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortColumn) {
        case 'subject': aVal = a.subject.toLowerCase(); bVal = b.subject.toLowerCase(); break;
        case 'submitterName': aVal = (a.submitterName || '').toLowerCase(); bVal = (b.submitterName || '').toLowerCase(); break;
        case 'submittedAt': aVal = new Date(a.submittedAt).getTime(); bVal = new Date(b.submittedAt).getTime(); break;
        case 'viewed': aVal = a.viewed ? 1 : 0; bVal = b.viewed ? 1 : 0; break;
        default: return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, pageSize, sortColumn, sortDirection]);

  if (!isSaasMode) return null;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="family-manager-page">
      <div className="family-manager-search">
        <TableSearch
          value={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('Search feedback by subject, message, or submitter...')}
        />
      </div>

      <div className="family-manager-table-area p-4">
        <FeedbackView
          paginatedData={paginatedData}
          onUpdateFeedback={updateFeedback}
          updatingFeedbackId={updatingFeedbackId}
          formatDateTime={formatDateTime}
          onRefresh={fetchFeedback}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {paginatedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? t('No feedback found matching your search.') : t('No feedback found.')}
          </div>
        )}
      </div>

      {totalItems >= 10 && (
        <div className="family-manager-pagination flex items-center justify-between">
          <TablePageSize pageSize={pageSize} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 20, 50]} />
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
