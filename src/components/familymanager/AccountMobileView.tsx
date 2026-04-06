'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/card';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { SortDirection } from '@/src/components/ui/table';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import './mobile-views.css';

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

interface AccountMobileViewProps {
  paginatedData: AccountData[];
  onUpdateAccount: (id: string, closed: boolean) => void;
  updatingAccountId: string | null;
  formatDateTime: (dateString: string | null) => string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  sortOptions: SortOption[];
}

function getSortBadgeValue(account: AccountData, sortColumn: string, sortDirection: SortDirection, formatDateTime: (d: string | null) => string, t: (k: string) => string): string | null {
  if (!sortColumn || !sortDirection) return null;
  switch (sortColumn) {
    case 'createdAt': return formatDateTime(account.createdAt);
    case 'family': return account.family?.name || t('No family');
    case 'verified': return account.verified ? t('Verified') : t('Unverified');
    case 'closed': return account.closed ? t('Closed') : t('Active');
    default: return null; // email and name are already visible
  }
}

export default function AccountMobileView({
  paginatedData,
  onUpdateAccount,
  updatingAccountId,
  formatDateTime,
  sortColumn,
  sortDirection,
  sortOptions,
}: AccountMobileViewProps) {
  const { t } = useLocalization();
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const getFullName = (account: AccountData) => {
    if (account.firstName || account.lastName) {
      return `${account.firstName || ''} ${account.lastName || ''}`.trim();
    }
    return 'N/A';
  };

  const handleClose = () => {
    setSelectedAccount(null);
    setShowConfirm(false);
  };

  const handleAction = (account: AccountData) => {
    setShowConfirm(true);
  };

  const handleConfirmAction = (account: AccountData) => {
    setShowConfirm(false);
    onUpdateAccount(account.id, !account.closed);
  };

  const sortLabel = sortColumn ? sortOptions.find(o => o.key === sortColumn)?.label : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {paginatedData.map((account) => {
          const badgeValue = sortColumn ? getSortBadgeValue(account, sortColumn, sortDirection, formatDateTime, t) : null;
          return (
            <Card
              key={account.id}
              className="cursor-pointer active:scale-[0.98] transition-transform mobile-card"
              onClick={() => setSelectedAccount(account)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate mr-2 mobile-card-name">{account.email}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        !account.closed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      } mobile-status-badge`}
                    >
                      {!account.closed ? t('Active') : t('Closed')}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-4 text-sm text-gray-500 mobile-card-meta">
                  <span>{getFullName(account)}</span>
                  <span className="inline-flex items-center gap-1">
                    {account.family ? (
                      <>
                        {account.family.name}
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </>
                    ) : (
                      t('No family')
                    )}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 ${account.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                    {account.verified ? (
                      <><ShieldCheck className="h-3 w-3" /> {t('Verified')}</>
                    ) : (
                      <><Shield className="h-3 w-3" /> {t('Unverified')}</>
                    )}
                  </span>
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

      {selectedAccount && (
        <FormPage
          isOpen={true}
          onClose={handleClose}
          title={selectedAccount.email}
          description={getFullName(selectedAccount)}
        >
          <FormPageContent>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Email')}</label>
                <p className="mt-1 text-gray-900 mobile-detail-value">{selectedAccount.email}</p>
              </div>

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Name')}</label>
                <p className="mt-1 text-gray-900 mobile-detail-value">{getFullName(selectedAccount)}</p>
              </div>

              {/* Created */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Created')}</label>
                <p className="mt-1 text-sm text-gray-900 mobile-detail-value">{formatDateTime(selectedAccount.createdAt)}</p>
              </div>

              {/* Family */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Family')}</label>
                {selectedAccount.family ? (
                  <div className="mt-1">
                    <p className="text-gray-900 mobile-detail-value">{selectedAccount.family.name}</p>
                    <p className="text-xs text-gray-500 font-mono">/{selectedAccount.family.slug}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-900 mobile-detail-value">{t('No family')}</p>
                )}
              </div>

              {/* Verified */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Verified')}</label>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedAccount.verified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    } mobile-status-badge`}
                  >
                    {selectedAccount.verified ? (
                      <>
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {t('Verified')}
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3 mr-1" />
                        {t('Unverified')}
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700 mobile-detail-label">{t('Status')}</label>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      !selectedAccount.closed
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    } mobile-status-badge`}
                  >
                    {!selectedAccount.closed ? t('Active') : t('Closed')}
                  </span>
                  {selectedAccount.closedAt && (
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(selectedAccount.closedAt)}</p>
                  )}
                </div>
              </div>

              {/* Confirmation */}
              {showConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 mobile-confirm-banner">
                  <p className="text-sm text-red-800 mb-2">
                    {selectedAccount.closed
                      ? t('Are you sure you want to reinstate this account?')
                      : t('Are you sure you want to close this account?')
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleConfirmAction(selectedAccount)}
                      disabled={updatingAccountId === selectedAccount.id}
                    >
                      {updatingAccountId === selectedAccount.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {t('Confirm')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirm(false)}
                    >
                      {t('Cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </FormPageContent>

          <FormPageFooter>
            <Button
              variant={selectedAccount.closed ? 'default' : 'destructive'}
              size="sm"
              onClick={() => handleAction(selectedAccount)}
              disabled={updatingAccountId === selectedAccount.id}
            >
              {updatingAccountId === selectedAccount.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : selectedAccount.closed ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              {selectedAccount.closed ? t('Reinstate Account') : t('Close Account')}
            </Button>
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
