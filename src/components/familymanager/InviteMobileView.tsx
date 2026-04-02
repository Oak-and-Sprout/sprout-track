'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/card';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { ShareButton } from '@/src/components/ui/share-button';
import type { SortDirection } from '@/src/components/ui/table';
import {
  Loader2,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import './mobile-views.css';

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
  creator: {
    id: string;
    name: string;
    loginId: string;
  } | null;
  family: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface SortOption {
  key: string;
  label: string;
}

interface InviteMobileViewProps {
  paginatedData: FamilySetupInvite[];
  onDeleteInvite: (inviteId: string) => void;
  deletingInviteId: string | null;
  appConfig: { rootDomain: string; enableHttps: boolean } | null;
  formatDateTime: (dateString: string | null) => string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  sortOptions: SortOption[];
}

function getStatusBadge(invite: FamilySetupInvite, t: (key: string) => string) {
  if (invite.isUsed) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mobile-status-badge">
        <CheckCircle className="h-3 w-3 mr-1" />
        {t('Used')}
      </span>
    );
  }
  if (invite.isExpired) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mobile-status-badge">
        <XCircle className="h-3 w-3 mr-1" />
        {t('Expired')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mobile-status-badge">
      <Clock className="h-3 w-3 mr-1" />
      {t('Active')}
    </span>
  );
}

function getStatusText(invite: FamilySetupInvite, t: (k: string) => string): string {
  if (invite.isUsed) return t('Used');
  if (invite.isExpired) return t('Expired');
  return t('Active');
}

function getSortBadgeValue(invite: FamilySetupInvite, sortColumn: string, sortDirection: SortDirection, formatDateTime: (d: string | null) => string, t: (k: string) => string): string | null {
  if (!sortColumn || !sortDirection) return null;
  switch (sortColumn) {
    case 'createdAt': return formatDateTime(invite.createdAt);
    case 'expiresAt': return formatDateTime(invite.expiresAt);
    case 'status': return getStatusText(invite, t);
    case 'family': return invite.family?.name || t('Not created yet');
    default: return null; // token and creator are already visible
  }
}

export default function InviteMobileView({
  paginatedData,
  onDeleteInvite,
  deletingInviteId,
  appConfig,
  formatDateTime,
  sortColumn,
  sortDirection,
  sortOptions,
}: InviteMobileViewProps) {
  const { t } = useLocalization();
  const [selectedInvite, setSelectedInvite] = useState<FamilySetupInvite | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const handleClose = () => {
    setSelectedInvite(null);
    setShowRevokeConfirm(false);
  };

  const handleRevoke = (inviteId: string) => {
    setShowRevokeConfirm(true);
  };

  const handleConfirmRevoke = (inviteId: string) => {
    setShowRevokeConfirm(false);
    onDeleteInvite(inviteId);
  };

  const sortLabel = sortColumn ? sortOptions.find(o => o.key === sortColumn)?.label : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {paginatedData.map((invite) => {
          const badgeValue = sortColumn ? getSortBadgeValue(invite, sortColumn, sortDirection, formatDateTime, t) : null;
          return (
            <Card
              key={invite.id}
              className="cursor-pointer active:scale-[0.98] transition-transform mobile-card"
              onClick={() => setSelectedInvite(invite)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-gray-900 mobile-card-name">{invite.token.substring(0, 16)}...</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invite, t)}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-4 text-sm text-gray-500 mobile-card-meta">
                  <span>{invite.creator?.name || t('Unknown')}</span>
                  <span>{invite.family?.name || t('Not created yet')}</span>
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

      {selectedInvite && (
        <FormPage
          isOpen={true}
          onClose={handleClose}
          title={t('Invite Details')}
          description={`${selectedInvite.token.substring(0, 16)}...`}
        >
          <FormPageContent>
            <div className="space-y-4">
              {/* Token */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Token')}</label>
                <p className="mt-1 font-mono text-sm text-gray-900 break-all select-all mobile-detail-value">{selectedInvite.token}</p>
              </div>

              {/* Created By */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Created By')}</label>
                {selectedInvite.creator ? (
                  <div className="mt-1">
                    <p className="text-gray-900 mobile-detail-value">{selectedInvite.creator.name}</p>
                    <p className="text-xs text-gray-500">{t('ID:')} {selectedInvite.creator.loginId}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-900 mobile-detail-value">{t('Unknown')}</p>
                )}
              </div>

              {/* Created */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Created')}</label>
                <p className="mt-1 text-sm text-gray-900 mobile-detail-value">{formatDateTime(selectedInvite.createdAt)}</p>
              </div>

              {/* Expires */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Expires')}</label>
                <p className="mt-1 text-sm text-gray-900 mobile-detail-value">{formatDateTime(selectedInvite.expiresAt)}</p>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Status')}</label>
                <div className="mt-1">{getStatusBadge(selectedInvite, t)}</div>
              </div>

              {/* Family */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Family')}</label>
                {selectedInvite.family ? (
                  <div className="mt-1">
                    <p className="text-gray-900 mobile-detail-value">{selectedInvite.family.name}</p>
                    <p className="text-xs text-gray-500 font-mono">/{selectedInvite.family.slug}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-900 mobile-detail-value">{t('Not created yet')}</p>
                )}
              </div>

              {/* Revoke confirmation */}
              {showRevokeConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 mobile-confirm-banner">
                  <p className="text-sm text-red-800 mb-2">{t('Are you sure you want to revoke this invite?')}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleConfirmRevoke(selectedInvite.id)}
                      disabled={deletingInviteId === selectedInvite.id}
                    >
                      {deletingInviteId === selectedInvite.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {t('Confirm')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRevokeConfirm(false)}
                    >
                      {t('Cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </FormPageContent>

          <FormPageFooter>
            {!selectedInvite.isUsed && !selectedInvite.isExpired && (
              <>
                <ShareButton
                  familySlug={`setup/${selectedInvite.token}`}
                  familyName="Family Setup Invitation"
                  appConfig={appConfig || undefined}
                  urlSuffix=""
                  variant="outline"
                  size="sm"
                  showText={true}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRevoke(selectedInvite.id)}
                  disabled={deletingInviteId === selectedInvite.id}
                >
                  {deletingInviteId === selectedInvite.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  {t('Revoke')}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              {t('Close')}
            </Button>
          </FormPageFooter>
        </FormPage>
      )}
    </>
  );
}
