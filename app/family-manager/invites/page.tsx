'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TableSearch,
  TablePagination,
  TablePageSize,
} from "@/src/components/ui/table";
import { Loader2 } from "lucide-react";
import { ActiveInviteView } from '@/src/components/familymanager';
import { useLocalization } from '@/src/context/localization';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

interface FamilySetupInvite {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
  isUsed: boolean;
  familyId: string | null;
  createdBy: string;
  creator: { id: string; name: string; loginId: string } | null;
  family: { id: string; name: string; slug: string } | null;
}

export default function InvitesPage() {
  const { t } = useLocalization();
  const { updateCount } = useAdminCounts();

  const [invites, setInvites] = useState<FamilySetupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<{ rootDomain: string; enableHttps: boolean } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchAppConfig = async () => {
    try {
      const response = await fetch('/api/app-config/public');
      const data = await response.json();
      if (data.success) setAppConfig(data.data);
    } catch (error) {
      console.error('Error fetching app config:', error);
    }
  };

  const fetchInvites = useCallback(async () => {
    try {
      const response = await authFetch('/api/family/setup-invites');
      const data = await response.json();
      if (data.success) {
        setInvites(data.data);
        updateCount('invites', data.data.filter((inv: FamilySetupInvite) => !inv.isExpired && !inv.isUsed).length);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  }, [updateCount]);

  const deleteInvite = async (inviteId: string) => {
    try {
      setDeletingInviteId(inviteId);
      const response = await authFetch(`/api/family/setup-invites?id=${inviteId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        await fetchInvites();
      } else {
        alert('Failed to delete invite: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting invite:', error);
      alert('Error deleting invite');
    } finally {
      setDeletingInviteId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchInvites(), fetchAppConfig()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchInvites]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return invites;
    const search = searchTerm.toLowerCase();
    return invites.filter(invite =>
      invite.token.toLowerCase().includes(search) ||
      invite.creator?.name.toLowerCase().includes(search) ||
      invite.family?.name.toLowerCase().includes(search)
    );
  }, [invites, searchTerm]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, pageSize]);

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
          placeholder={t('Search invites by token, creator, or family...')}
        />
      </div>

      <div className="family-manager-table-area p-4">
        <ActiveInviteView
          paginatedData={paginatedData}
          onDeleteInvite={deleteInvite}
          deletingInviteId={deletingInviteId}
          appConfig={appConfig}
          formatDateTime={formatDateTime}
        />

        {paginatedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? t('No invites found matching your search.') : t('No invites found.')}
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
