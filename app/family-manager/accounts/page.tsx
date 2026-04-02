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
import { AccountView } from '@/src/components/familymanager';
import { useLocalization } from '@/src/context/localization';
import { useDeployment } from '@/app/context/deployment';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

interface AccountData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  verified: boolean;
  betaparticipant: boolean;
  closed: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  familyId: string | null;
  family: { id: string; name: string; slug: string } | null;
}

export default function AccountsPage() {
  const { t } = useLocalization();
  const { isSaasMode } = useDeployment();
  const router = useRouter();
  const { updateCount } = useAdminCounts();

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);

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

  // Redirect if not SaaS mode
  useEffect(() => {
    if (!isSaasMode) {
      router.replace('/family-manager/families');
    }
  }, [isSaasMode, router]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await authFetch('/api/accounts/manage');
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data);
        updateCount('accounts', data.data.length);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [updateCount]);

  const updateAccount = async (id: string, closed: boolean) => {
    try {
      setUpdatingAccountId(id);
      const response = await authFetch('/api/accounts/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, closed }),
      });
      const data = await response.json();
      if (data.success) {
        fetchAccounts();
      } else {
        alert('Failed to update account: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Error updating account');
    } finally {
      setUpdatingAccountId(null);
    }
  };

  useEffect(() => {
    if (!isSaasMode) return;
    const fetchData = async () => {
      setLoading(true);
      await fetchAccounts();
      setLoading(false);
    };
    fetchData();
  }, [isSaasMode, fetchAccounts]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return accounts;
    const search = searchTerm.toLowerCase();
    return accounts.filter(account =>
      account.email.toLowerCase().includes(search) ||
      account.firstName?.toLowerCase().includes(search) ||
      account.lastName?.toLowerCase().includes(search) ||
      account.family?.name.toLowerCase().includes(search)
    );
  }, [accounts, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortColumn) {
        case 'email': aVal = a.email.toLowerCase(); bVal = b.email.toLowerCase(); break;
        case 'name': aVal = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase(); bVal = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase(); break;
        case 'createdAt': aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
        case 'family': aVal = (a.family?.name || '').toLowerCase(); bVal = (b.family?.name || '').toLowerCase(); break;
        case 'verified': aVal = a.verified ? 1 : 0; bVal = b.verified ? 1 : 0; break;
        case 'closed': aVal = a.closed ? 1 : 0; bVal = b.closed ? 1 : 0; break;
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
          placeholder={t('Search accounts by email, name, or family...')}
        />
      </div>

      <div className="family-manager-table-area p-4">
        <AccountView
          paginatedData={paginatedData}
          onUpdateAccount={updateAccount}
          updatingAccountId={updatingAccountId}
          formatDateTime={formatDateTime}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {paginatedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? t('No accounts found matching your search.') : t('No accounts found.')}
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
