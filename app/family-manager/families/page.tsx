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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import FamilyForm from '@/src/components/forms/FamilyForm';
import AppConfigForm from '@/src/components/forms/AppConfigForm';
import { FamilyView } from '@/src/components/familymanager';
import { useLocalization } from '@/src/context/localization';
import { useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { authFetch, formatDateTime } from '@/src/components/familymanager/utils';

interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  caretakerCount?: number;
  babyCount?: number;
}

interface CaretakerData {
  id: string;
  loginId: string;
  name: string;
  type: string | null;
  role: string;
  inactive: boolean;
}

export default function FamiliesPage() {
  const { t } = useLocalization();
  const router = useRouter();
  const { updateCount } = useAdminCounts();

  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<FamilyData>>({});
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<FamilyData | null>(null);
  const [isEditingFamily, setIsEditingFamily] = useState(false);
  const [showAppConfigForm, setShowAppConfigForm] = useState(false);
  const [appConfig, setAppConfig] = useState<{ rootDomain: string; enableHttps: boolean } | null>(null);
  const [caretakersDialogOpen, setCaretakersDialogOpen] = useState(false);
  const [selectedFamilyCaretakers, setSelectedFamilyCaretakers] = useState<CaretakerData[]>([]);
  const [loadingCaretakers, setLoadingCaretakers] = useState(false);

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

  const fetchFamilies = useCallback(async () => {
    try {
      const response = await authFetch('/api/family/manage');
      const data = await response.json();
      if (data.success) {
        setFamilies(data.data);
        updateCount('families', data.data.length);
      }
    } catch (error) {
      console.error('Error fetching families:', error);
    }
  }, [updateCount]);

  const fetchInvites = async () => {
    try {
      const response = await authFetch('/api/family/setup-invites');
      const data = await response.json();
      if (data.success) {
        updateCount('invites', data.data.filter((inv: { isExpired: boolean; isUsed: boolean }) => !inv.isExpired && !inv.isUsed).length);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    }
  };

  const checkSlugUniqueness = useCallback(async (slug: string, currentFamilyId: string) => {
    if (!slug || slug.trim() === '') {
      setSlugError('');
      return;
    }
    setCheckingSlug(true);
    try {
      const response = await authFetch(`/api/family/by-slug/${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (data.success && data.data && data.data.id !== currentFamilyId) {
        setSlugError('This slug is already taken');
      } else {
        setSlugError('');
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError('Error checking slug availability');
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  useEffect(() => {
    if (editingData.slug && editingId) {
      const timeoutId = setTimeout(() => {
        checkSlugUniqueness(editingData.slug!, editingId);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [editingData.slug, editingId, checkSlugUniqueness]);

  const fetchCaretakers = async (familyId: string) => {
    try {
      setLoadingCaretakers(true);
      const response = await authFetch(`/api/family/${familyId}/caretakers`);
      const data = await response.json();
      setSelectedFamilyCaretakers(data.success ? data.data : []);
    } catch (error) {
      console.error('Error fetching caretakers:', error);
      setSelectedFamilyCaretakers([]);
    } finally {
      setLoadingCaretakers(false);
    }
  };

  const saveFamily = async (family: FamilyData) => {
    if (slugError) {
      alert('Please fix the slug error before saving');
      return;
    }
    try {
      setSaving(true);
      const response = await authFetch('/api/family/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: family.id,
          name: editingData.name || family.name,
          slug: editingData.slug || family.slug,
          isActive: editingData.isActive !== undefined ? editingData.isActive : family.isActive,
        }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchFamilies();
        setEditingId(null);
        setEditingData({});
        setSlugError('');
      } else {
        alert('Failed to save changes: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving family:', error);
      alert('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (family: FamilyData) => {
    setEditingId(family.id);
    setEditingData({ name: family.name, slug: family.slug, isActive: family.isActive });
    setSlugError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
    setSlugError('');
  };

  const handleViewCaretakers = async (family: FamilyData) => {
    setCaretakersDialogOpen(true);
    await fetchCaretakers(family.id);
  };

  const handleLogin = (family: FamilyData) => {
    router.push(`/${family.slug}`);
  };

  const handleFamilyFormSuccess = () => {
    fetchFamilies();
    fetchInvites();
  };

  // Listen for add-family and settings events from the layout/side-nav
  useEffect(() => {
    const handleAddFamily = () => {
      setSelectedFamily(null);
      setIsEditingFamily(false);
      setShowFamilyForm(true);
    };
    const handleSettings = () => setShowAppConfigForm(true);

    window.addEventListener('admin-add-family', handleAddFamily);
    window.addEventListener('admin-settings', handleSettings);
    return () => {
      window.removeEventListener('admin-add-family', handleAddFamily);
      window.removeEventListener('admin-settings', handleSettings);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchFamilies(), fetchAppConfig()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchFamilies]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return families;
    const search = searchTerm.toLowerCase();
    return families.filter(f =>
      f.name.toLowerCase().includes(search) || f.slug.toLowerCase().includes(search)
    );
  }, [families, searchTerm]);

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
          placeholder={t('Search families by name or slug...')}
        />
      </div>

      <div className="family-manager-table-area p-4">
        <FamilyView
          families={families}
          paginatedData={paginatedData}
          onEdit={handleEdit}
          onViewCaretakers={handleViewCaretakers}
          onLogin={handleLogin}
          onSave={saveFamily}
          onCancelEdit={handleCancelEdit}
          editingId={editingId}
          editingData={editingData}
          setEditingData={setEditingData}
          saving={saving}
          slugError={slugError}
          checkingSlug={checkingSlug}
          appConfig={appConfig}
          formatDateTime={formatDateTime}
        />

        {paginatedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? t('No families found matching your search.') : t('No families found.')}
          </div>
        )}
      </div>

      {totalItems >= 10 && (
        <div className="family-manager-pagination flex items-center justify-between">
          <TablePageSize pageSize={pageSize} onPageSizeChange={setPageSize} pageSizeOptions={[5, 10, 20, 50]} />
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Caretakers Dialog */}
      <Dialog open={caretakersDialogOpen} onOpenChange={setCaretakersDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('Family Caretakers')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingCaretakers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : selectedFamilyCaretakers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead variant="bold">{t('Login ID')}</TableHead>
                    <TableHead variant="bold">{t('Name')}</TableHead>
                    <TableHead variant="bold">{t('Type')}</TableHead>
                    <TableHead variant="bold">{t('Role')}</TableHead>
                    <TableHead variant="bold">{t('Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedFamilyCaretakers.map((caretaker) => (
                    <TableRow key={caretaker.id}>
                      <TableCell className="font-mono">{caretaker.loginId}</TableCell>
                      <TableCell>{caretaker.name}</TableCell>
                      <TableCell>{caretaker.type || 'N/A'}</TableCell>
                      <TableCell>{caretaker.role}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          !caretaker.inactive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {!caretaker.inactive ? t('Active') : t('Inactive')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-gray-500">{t('No caretakers found for this family.')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FamilyForm
        isOpen={showFamilyForm}
        onClose={() => { setShowFamilyForm(false); setSelectedFamily(null); setIsEditingFamily(false); }}
        isEditing={isEditingFamily}
        family={selectedFamily}
        onFamilyChange={handleFamilyFormSuccess}
      />

      <AppConfigForm
        isOpen={showAppConfigForm}
        onClose={() => setShowAppConfigForm(false)}
      />
    </div>
  );
}
