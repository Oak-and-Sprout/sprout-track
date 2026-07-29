'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TableSearch,
  TablePagination,
  TablePageSize,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import type { SortDirection } from "@/src/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Button } from "@/src/components/ui/button";
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
} from "lucide-react";
import { MobileSortButton } from '@/src/components/familymanager';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

interface GiftCodeRow {
  id: string;
  code: string;
  source: string;
  purchaserEmail: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  revokedAt: string | null;
  status: 'active' | 'redeemed' | 'revoked';
}

const giftCodeSortOptions = [
  { key: 'createdAt', label: 'Created' },
  { key: 'status', label: 'Status' },
  { key: 'purchaserEmail', label: 'Purchaser Email' },
  { key: 'redeemedAt', label: 'Redeemed' },
];

export default function GiftCodesPage() {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const { updateCount } = useAdminCounts();
  const isMobile = useIsMobile();

  const [giftCodes, setGiftCodes] = useState<GiftCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [genQuantity, setGenQuantity] = useState(1);
  const [genEmail, setGenEmail] = useState('');
  const [genSendEmail, setGenSendEmail] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: string) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  const fetchGiftCodes = useCallback(async () => {
    try {
      const response = await authFetch('/api/gift-codes');
      const data = await response.json();
      if (data.success) {
        setGiftCodes(data.data);
        updateCount('giftCodes', data.data.filter((c: GiftCodeRow) => c.status === 'active').length);
      }
    } catch (error) {
      console.error('Error fetching gift codes:', error);
    }
  }, [updateCount]);

  const generateCodes = async () => {
    setGenerating(true);
    try {
      const response = await authFetch('/api/gift-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: genQuantity,
          email: genEmail || undefined,
          sendEmail: genSendEmail,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowGenerateDialog(false);
        setGenQuantity(1);
        setGenEmail('');
        setGenSendEmail(false);
        await fetchGiftCodes();
        // Codes exist either way; say so plainly rather than reporting a clean
        // success when the provider rejected the send.
        if (data.data?.emailError) {
          showToast({
            variant: 'warning',
            title: t('Warning'),
            message: `${t('Gift codes created, but the email could not be sent.')} ${data.data.emailError}`,
            duration: 8000,
          });
        }
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to generate gift codes'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error generating gift codes:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to generate gift codes'),
        duration: 5000,
      });
    } finally {
      setGenerating(false);
    }
  };

  const revokeCode = async (id: string) => {
    if (!window.confirm(t('Revoke this gift code? It can no longer be redeemed.'))) return;
    try {
      setRevokingId(id);
      const response = await authFetch('/api/gift-codes/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchGiftCodes();
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to revoke gift code'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error revoking gift code:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to revoke gift code'),
        duration: 5000,
      });
    } finally {
      setRevokingId(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchGiftCodes();
      setLoading(false);
    };
    fetchData();
  }, [fetchGiftCodes]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return giftCodes;
    const search = searchTerm.toLowerCase();
    return giftCodes.filter(c =>
      c.code.toLowerCase().includes(search) ||
      (c.purchaserEmail || '').toLowerCase().includes(search) ||
      (c.redeemedByEmail || '').toLowerCase().includes(search) ||
      c.status.toLowerCase().includes(search)
    );
  }, [giftCodes, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortColumn) {
        case 'createdAt': aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'purchaserEmail': aVal = (a.purchaserEmail || '').toLowerCase(); bVal = (b.purchaserEmail || '').toLowerCase(); break;
        case 'redeemedAt': aVal = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0; bVal = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0; break;
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

  if (loading) {
    return (
      <div role="status" className="h-full w-full flex items-center justify-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
        <span className="sr-only">{t('Loading...')}</span>
      </div>
    );
  }

  return (
    <div className="family-manager-page">
      <div className="family-manager-search">
        <TableSearch
          value={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('Search gift codes by code, email, or status...')}
        />
        {isMobile && (
          <MobileSortButton
            options={giftCodeSortOptions}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGenerateDialog(true)}
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('Generate Codes')}
        </Button>
      </div>

      <div className="family-manager-table-area p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead variant="bold">{t('Code')}</TableHead>
                <TableHead variant="bold">{t('Source')}</TableHead>
                <TableHead variant="bold" sortable sortDirection={sortColumn === 'createdAt' ? sortDirection : null} onSort={() => handleSort('createdAt')}>{t('Created')}</TableHead>
                <TableHead variant="bold" sortable sortDirection={sortColumn === 'purchaserEmail' ? sortDirection : null} onSort={() => handleSort('purchaserEmail')}>{t('Purchaser Email')}</TableHead>
                <TableHead variant="bold">{t('Redeemed By')}</TableHead>
                <TableHead variant="bold" sortable sortDirection={sortColumn === 'redeemedAt' ? sortDirection : null} onSort={() => handleSort('redeemedAt')}>{t('Redeemed')}</TableHead>
                <TableHead variant="bold" sortable sortDirection={sortColumn === 'status' ? sortDirection : null} onSort={() => handleSort('status')}>{t('Status')}</TableHead>
                <TableHead variant="bold" className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {searchTerm ? t('No gift codes found matching your search.') : t('No gift codes found.')}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((giftCode) => (
                  <TableRow key={giftCode.id}>
                    <TableCell className="font-mono text-sm">{giftCode.code}</TableCell>
                    <TableCell className="text-sm">{giftCode.source}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(giftCode.createdAt)}</TableCell>
                    <TableCell className="text-sm">{giftCode.purchaserEmail || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{giftCode.redeemedByEmail || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(giftCode.redeemedAt)}</TableCell>
                    <TableCell>
                      {giftCode.status === 'redeemed' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                          {t('Redeemed')}
                        </span>
                      ) : giftCode.status === 'revoked' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                          {t('Revoked')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                          {t('Active')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {giftCode.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeCode(giftCode.id)}
                            disabled={revokingId === giftCode.id}
                            title={t('Revoke')}
                          >
                            {revokingId === giftCode.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <XCircle className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalItems >= 10 && (
        <div className="family-manager-pagination flex items-center justify-between">
          <TablePageSize pageSize={pageSize} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 20, 50]} />
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </div>
      )}

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Generate Gift Codes')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="gift-code-quantity" className="block text-sm font-medium mb-1">
                {t('Quantity')}
              </label>
              <Input
                id="gift-code-quantity"
                type="number"
                min={1}
                max={20}
                value={genQuantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setGenQuantity(Number.isNaN(value) ? 1 : Math.min(20, Math.max(1, value)));
                }}
              />
            </div>
            <div>
              <label htmlFor="gift-code-email" className="block text-sm font-medium mb-1">
                {t('Email')}
              </label>
              <Input
                id="gift-code-email"
                type="email"
                value={genEmail}
                onChange={(e) => setGenEmail(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gift-code-send-email"
                checked={genSendEmail}
                onCheckedChange={setGenSendEmail}
                disabled={!genEmail}
              />
              <label htmlFor="gift-code-send-email" className="text-sm">
                {t('Email the code to this address')}
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="default"
              onClick={generateCodes}
              disabled={generating || genQuantity < 1 || genQuantity > 20}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
              ) : null}
              {t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
