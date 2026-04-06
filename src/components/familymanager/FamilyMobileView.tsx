'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/card';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Checkbox } from '@/src/components/ui/checkbox';
import { ShareButton } from '@/src/components/ui/share-button';
import type { SortDirection } from '@/src/components/ui/table';
import {
  Edit,
  LogIn,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { authFetch } from '@/src/components/familymanager/utils';
import './mobile-views.css';

interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastEntryAt?: string | null;
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

interface SortOption {
  key: string;
  label: string;
}

interface FamilyMobileViewProps {
  families: FamilyData[];
  paginatedData: FamilyData[];
  onEdit: (family: FamilyData) => void;
  onLogin: (family: FamilyData) => void;
  onSave: (family: FamilyData) => void;
  onCancelEdit: () => void;
  editingId: string | null;
  editingData: Partial<FamilyData>;
  setEditingData: React.Dispatch<React.SetStateAction<Partial<FamilyData>>>;
  saving: boolean;
  slugError: string;
  checkingSlug: boolean;
  appConfig: { rootDomain: string; enableHttps: boolean } | null;
  formatDateTime: (dateString: string | null) => string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  sortOptions: SortOption[];
}

function getSortBadgeValue(family: FamilyData, sortColumn: string, sortDirection: SortDirection, formatDateTime: (d: string | null) => string, t: (k: string) => string): string | null {
  if (!sortColumn || !sortDirection) return null;
  switch (sortColumn) {
    case 'createdAt': return formatDateTime(family.createdAt);
    case 'lastEntryAt': return family.lastEntryAt ? formatDateTime(family.lastEntryAt) : t('No entries');
    case 'isActive': return family.isActive ? t('Active') : t('Inactive');
    case 'caretakerCount': return String(family.caretakerCount || 0);
    case 'babyCount': return String(family.babyCount || 0);
    default: return null;
  }
}

export default function FamilyMobileView({
  paginatedData,
  onEdit,
  onLogin,
  onSave,
  onCancelEdit,
  editingId,
  editingData,
  setEditingData,
  saving,
  slugError,
  checkingSlug,
  appConfig,
  formatDateTime,
  sortColumn,
  sortDirection,
  sortOptions,
}: FamilyMobileViewProps) {
  const { t } = useLocalization();
  const [selectedFamily, setSelectedFamily] = useState<FamilyData | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [caretakers, setCaretakers] = useState<CaretakerData[]>([]);
  const [loadingCaretakers, setLoadingCaretakers] = useState(false);

  const fetchCaretakers = useCallback(async (familyId: string) => {
    try {
      setLoadingCaretakers(true);
      const response = await authFetch(`/api/family/${familyId}/caretakers`);
      const data = await response.json();
      setCaretakers(data.success ? data.data : []);
    } catch (error) {
      console.error('Error fetching caretakers:', error);
      setCaretakers([]);
    } finally {
      setLoadingCaretakers(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFamily) {
      fetchCaretakers(selectedFamily.id);
    } else {
      setCaretakers([]);
    }
  }, [selectedFamily, fetchCaretakers]);

  const handleCardClick = (family: FamilyData) => {
    setSelectedFamily(family);
  };

  const handleClose = () => {
    if (editingId === selectedFamily?.id) {
      onCancelEdit();
    }
    setSelectedFamily(null);
    setShowDeactivateConfirm(false);
  };

  const handleSave = (family: FamilyData) => {
    if (editingData.isActive === false && family.isActive) {
      setShowDeactivateConfirm(true);
      return;
    }
    onSave(family);
  };

  const handleConfirmSave = (family: FamilyData) => {
    setShowDeactivateConfirm(false);
    onSave(family);
  };

  const isEditing = selectedFamily && editingId === selectedFamily.id;

  const sortLabel = sortColumn ? sortOptions.find(o => o.key === sortColumn)?.label : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {paginatedData.map((family) => {
          const badgeValue = sortColumn ? getSortBadgeValue(family, sortColumn, sortDirection, formatDateTime, t) : null;
          return (
            <Card
              key={family.id}
              className="cursor-pointer active:scale-[0.98] transition-transform mobile-card"
              onClick={() => handleCardClick(family)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base text-gray-900 mobile-card-name">{family.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        family.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      } mobile-status-badge`}
                    >
                      {family.isActive ? t('Active') : t('Inactive')}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-4 text-sm text-gray-500 mobile-card-meta">
                  <span className="font-mono">/{family.slug}</span>
                  <span>{family.lastEntryAt ? formatDateTime(family.lastEntryAt) : t('No entries')}</span>
                </div>
                {badgeValue && sortLabel && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs mobile-sort-badge">
                      {t(sortLabel)}: {badgeValue}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedFamily && (
        <FormPage
          isOpen={true}
          onClose={handleClose}
          title={isEditing ? t('Edit Family') : selectedFamily.name}
          description={isEditing ? undefined : `/${selectedFamily.slug}`}
        >
          <FormPageContent>
            <div className="space-y-4">
              {/* Family Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Family Name')}</label>
                {isEditing ? (
                  <Input
                    value={editingData.name || ''}
                    onChange={(e) => setEditingData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-gray-900 mobile-detail-value">{selectedFamily.name}</p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">Link/Slug</label>
                {isEditing ? (
                  <div className="space-y-1 mt-1">
                    <div className="relative">
                      <Input
                        value={editingData.slug || ''}
                        onChange={(e) => setEditingData(prev => ({ ...prev, slug: e.target.value }))}
                        className={slugError ? 'border-red-500' : ''}
                      />
                      {checkingSlug && (
                        <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                    {slugError && (
                      <div className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        {slugError}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 font-mono text-gray-900 mobile-detail-value">/{selectedFamily.slug}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Status')}</label>
                {isEditing ? (
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      checked={editingData.isActive !== undefined ? editingData.isActive : selectedFamily.isActive}
                      onCheckedChange={(checked) => setEditingData(prev => ({ ...prev, isActive: !!checked }))}
                    />
                    <span className="text-sm mobile-detail-value">{t('Active')}</span>
                  </div>
                ) : (
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedFamily.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      } mobile-status-badge`}
                    >
                      {selectedFamily.isActive ? t('Active') : t('Inactive')}
                    </span>
                  </div>
                )}
              </div>

              {/* Deactivation confirmation */}
              {showDeactivateConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 mobile-confirm-banner">
                  <p className="text-sm text-red-800 mb-2">{t('Are you sure you want to deactivate this family?')}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleConfirmSave(selectedFamily)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {t('Confirm')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeactivateConfirm(false)}
                    >
                      {t('Cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Created */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Created')}</label>
                <p className="mt-1 text-sm text-gray-900 mobile-detail-value">{formatDateTime(selectedFamily.createdAt)}</p>
              </div>

              {/* Last Entry */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Last Entry')}</label>
                <p className="mt-1 text-sm text-gray-900 mobile-detail-value">
                  {selectedFamily.lastEntryAt ? formatDateTime(selectedFamily.lastEntryAt) : t('No entries')}
                </p>
              </div>

              {/* Members & Babies */}
              <div className="flex gap-8">
                <div>
                  <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Members')}</label>
                  <p className="mt-1 text-gray-900 mobile-detail-value">{selectedFamily.caretakerCount || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Babies')}</label>
                  <p className="mt-1 text-gray-900 mobile-detail-value">{selectedFamily.babyCount || 0}</p>
                </div>
              </div>

              {/* Caretakers section */}
              {!isEditing && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Caretakers')}</label>
                  <div className="mt-2">
                    {loadingCaretakers ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : caretakers.length > 0 ? (
                      <div className="space-y-2">
                        {caretakers.map((caretaker) => (
                          <div
                            key={caretaker.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 p-3 mobile-caretaker-row"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 mobile-detail-value">{caretaker.name}</p>
                              <p className="text-xs text-gray-500 mobile-card-meta">
                                {t('ID:')} {caretaker.loginId} &middot; {caretaker.type || 'N/A'} &middot; {caretaker.role}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                !caretaker.inactive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              } mobile-status-badge`}
                            >
                              {!caretaker.inactive ? t('Active') : t('Inactive')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">{t('No caretakers found for this family.')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </FormPageContent>

          <FormPageFooter>
            {isEditing ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSave(selectedFamily)}
                  disabled={saving || !!slugError || checkingSlug}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {t('Save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowDeactivateConfirm(false); onCancelEdit(); }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('Cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(selectedFamily)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {t('Edit')}
                </Button>
                <ShareButton
                  familySlug={selectedFamily.slug}
                  familyName={selectedFamily.name}
                  appConfig={appConfig || undefined}
                  variant="outline"
                  size="sm"
                  showText={false}
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onLogin(selectedFamily)}
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  {t('Login')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                >
                  {t('Close')}
                </Button>
              </>
            )}
          </FormPageFooter>
        </FormPage>
      )}
    </>
  );
}
