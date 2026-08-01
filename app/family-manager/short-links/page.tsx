'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from "@/src/components/ui/textarea";
import { Button } from "@/src/components/ui/button";
import {
  Loader2,
  Plus,
  Copy,
  QrCode,
  Pencil,
  Power,
  Trash2,
  Link2,
} from "lucide-react";
import { MobileSortButton } from '@/src/components/familymanager';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { useIsMobile } from '@/src/hooks/useIsMobile';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

interface ShortLinkRow {
  id: string;
  slug: string;
  url: string;
  name: string;
  description: string | null;
  tag: string | null;
  enabled: boolean;
  clickCount: number;
  clicks7d: number;
  createdAt: string;
  updatedAt: string;
}

const shortLinkSortOptions = [
  { key: 'name', label: 'Name' },
  { key: 'tag', label: 'Tag' },
  { key: 'clickCount', label: 'Clicks' },
  { key: 'clicks7d', label: 'Last 7 Days' },
  { key: 'createdAt', label: 'Created' },
  { key: 'enabled', label: 'Status' },
];

interface LinkFormState {
  name: string;
  url: string;
  description: string;
  tag: string;
}

const emptyForm: LinkFormState = { name: '', url: '', description: '', tag: '' };

export default function ShortLinksPage() {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const { updateCount } = useAdminCounts();
  const isMobile = useIsMobile();
  const router = useRouter();

  const [links, setLinks] = useState<ShortLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<ShortLinkRow | null>(null);
  const [form, setForm] = useState<LinkFormState>(emptyForm);
  const [formSaving, setFormSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ShortLinkRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const shortUrlFor = (slug: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/go/${slug}` : `/go/${slug}`;

  const fetchLinks = useCallback(async () => {
    try {
      const response = await authFetch('/api/short-links');
      const data = await response.json();
      if (data.success) {
        setLinks(data.data);
        updateCount('shortLinks', data.data.filter((l: ShortLinkRow) => l.enabled).length);
      }
    } catch (error) {
      console.error('Error fetching short links:', error);
    }
  }, [updateCount]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchLinks();
      setLoading(false);
    };
    fetchData();
  }, [fetchLinks]);

  const openAddDialog = () => {
    setEditingLink(null);
    setForm(emptyForm);
    setShowFormDialog(true);
  };

  const openEditDialog = (link: ShortLinkRow) => {
    setEditingLink(link);
    setForm({
      name: link.name,
      url: link.url,
      description: link.description || '',
      tag: link.tag || '',
    });
    setShowFormDialog(true);
  };

  const closeFormDialog = () => {
    setShowFormDialog(false);
    setEditingLink(null);
    setForm(emptyForm);
  };

  const submitForm = async () => {
    setFormSaving(true);
    try {
      const body = {
        name: form.name,
        url: form.url,
        description: form.description || undefined,
        tag: form.tag || undefined,
      };
      const response = editingLink
        ? await authFetch(`/api/short-links/${editingLink.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await authFetch('/api/short-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      const data = await response.json();
      if (data.success) {
        closeFormDialog();
        await fetchLinks();
        if (!editingLink) {
          showToast({
            variant: 'success',
            title: t('Success'),
            message: `${t('Short link created:')} ${shortUrlFor(data.data.slug)}`,
            duration: 6000,
          });
        }
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || (editingLink ? t('Failed to update short link') : t('Failed to create short link')),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error saving short link:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: editingLink ? t('Failed to update short link') : t('Failed to create short link'),
        duration: 5000,
      });
    } finally {
      setFormSaving(false);
    }
  };

  const toggleEnabled = async (link: ShortLinkRow) => {
    try {
      setTogglingId(link.id);
      const response = await authFetch(`/api/short-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !link.enabled }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchLinks();
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to update short link'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error updating short link status:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to update short link'),
        duration: 5000,
      });
    } finally {
      setTogglingId(null);
    }
  };

  const copyShortUrl = async (link: ShortLinkRow) => {
    try {
      await navigator.clipboard.writeText(shortUrlFor(link.slug));
      showToast({
        variant: 'success',
        title: t('Copied!'),
        message: t('Short URL copied to clipboard'),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error copying short URL:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to copy short URL'),
        duration: 5000,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await authFetch(`/api/short-links/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setDeleteTarget(null);
        await fetchLinks();
      } else {
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Failed to delete short link'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error deleting short link:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to delete short link'),
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return links;
    const search = searchTerm.toLowerCase();
    const statusLabel = (link: ShortLinkRow) => (link.enabled ? t('Active') : t('Paused'));
    return links.filter(link =>
      link.slug.toLowerCase().includes(search) ||
      link.name.toLowerCase().includes(search) ||
      link.url.toLowerCase().includes(search) ||
      (link.description || '').toLowerCase().includes(search) ||
      (link.tag || '').toLowerCase().includes(search) ||
      statusLabel(link).toLowerCase().includes(search) ||
      formatDateTime(link.createdAt).toLowerCase().includes(search)
    );
  }, [links, searchTerm, t]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortColumn) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'tag': aVal = (a.tag || '').toLowerCase(); bVal = (b.tag || '').toLowerCase(); break;
        case 'clickCount': aVal = a.clickCount; bVal = b.clickCount; break;
        case 'clicks7d': aVal = a.clicks7d; bVal = b.clicks7d; break;
        case 'createdAt': aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
        case 'enabled': aVal = a.enabled ? 1 : 0; bVal = b.enabled ? 1 : 0; break;
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

  const formValid = form.name.trim().length > 0 && form.url.trim().length > 0;

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
          placeholder={t('Search short links by name, URL, tag, or status...')}
        />
        {isMobile && (
          <MobileSortButton
            options={shortLinkSortOptions}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={openAddDialog}
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('Add Link')}
        </Button>
      </div>

      <div className="family-manager-table-area p-4">
        {paginatedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <Link2 className="h-10 w-10 text-gray-300" aria-hidden="true" />
            {searchTerm ? (
              <p className="text-gray-500">{t('No short links found matching your search.')}</p>
            ) : (
              <>
                <p className="text-gray-500 max-w-sm">
                  {t('No short links yet. Create one to start tracking clicks on a link you share.')}
                </p>
                <Button variant="outline" size="sm" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  {t('Add Link')}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead variant="bold">{t('Short URL')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'name' ? sortDirection : null} onSort={() => handleSort('name')}>{t('Name')}</TableHead>
                  <TableHead variant="bold">{t('Destination')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'tag' ? sortDirection : null} onSort={() => handleSort('tag')}>{t('Tag')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'enabled' ? sortDirection : null} onSort={() => handleSort('enabled')}>{t('Status')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'clickCount' ? sortDirection : null} onSort={() => handleSort('clickCount')}>{t('Clicks')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'clicks7d' ? sortDirection : null} onSort={() => handleSort('clicks7d')}>{t('Last 7 Days')}</TableHead>
                  <TableHead variant="bold" sortable sortDirection={sortColumn === 'createdAt' ? sortDirection : null} onSort={() => handleSort('createdAt')}>{t('Created')}</TableHead>
                  <TableHead variant="bold" className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((link) => (
                  <TableRow
                    key={link.id}
                    onClick={() => router.push(`/family-manager/short-links/${link.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        router.push(`/family-manager/short-links/${link.id}`);
                      } else if (e.key === ' ') {
                        e.preventDefault();
                        router.push(`/family-manager/short-links/${link.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t('Details')}: ${link.name}`}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-sm">/go/{link.slug}</TableCell>
                    <TableCell className="text-sm">{link.name}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={link.url}>{link.url}</TableCell>
                    <TableCell className="text-sm">{link.tag || t('N/A')}</TableCell>
                    <TableCell>
                      {link.enabled ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t('Active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {t('Paused')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{link.clickCount}</TableCell>
                    <TableCell className="text-sm">{link.clicks7d}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(link.createdAt)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyShortUrl(link)}
                          title={t('Copy short URL')}
                          aria-label={t('Copy short URL')}
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {/* TODO(task-8): ShortLinkQrDialog mounts here */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { /* TODO(task-8): open ShortLinkQrDialog for this link */ }}
                          title={t('View QR code')}
                          aria-label={t('View QR code')}
                        >
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(link)}
                          title={t('Edit short link')}
                          aria-label={t('Edit short link')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleEnabled(link)}
                          disabled={togglingId === link.id}
                          title={link.enabled ? t('Disable short link') : t('Enable short link')}
                          aria-label={link.enabled ? t('Disable short link') : t('Enable short link')}
                        >
                          {togglingId === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Power className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(link)}
                          title={t('Delete short link')}
                          aria-label={t('Delete short link')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalItems >= 10 && (
        <div className="family-manager-pagination flex items-center justify-between">
          <TablePageSize pageSize={pageSize} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 20, 50]} />
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </div>
      )}

      <Dialog open={showFormDialog} onOpenChange={(open) => { if (!open) closeFormDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLink ? t('Edit Short Link') : t('Add Short Link')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="short-link-name" className="block text-sm font-medium mb-1">
                {t('Name')}
              </label>
              <Input
                id="short-link-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="short-link-url" className="block text-sm font-medium mb-1">
                {t('Destination URL')}
              </label>
              <Input
                id="short-link-url"
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/page"
              />
            </div>
            <div>
              <label htmlFor="short-link-description" className="block text-sm font-medium mb-1">
                {t('Description')}
              </label>
              <Textarea
                id="short-link-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label htmlFor="short-link-tag" className="block text-sm font-medium mb-1">
                {t('Tag')}
              </label>
              <Input
                id="short-link-tag"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="default"
              onClick={submitForm}
              disabled={formSaving || !formValid}
            >
              {formSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
              ) : null}
              {editingLink ? t('Save Changes') : t('Add Link')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Delete Short Link')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              {t('This will permanently delete the short link and all of its click history. This cannot be undone.')}
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
              ) : null}
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
