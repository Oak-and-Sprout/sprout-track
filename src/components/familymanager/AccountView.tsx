'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Button } from "@/src/components/ui/button";
import { useLocalization } from '@/src/context/localization';

import { 
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  ShieldCheck,
} from "lucide-react";

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

interface AccountViewProps {
  paginatedData: AccountData[];
  onUpdateAccount: (id: string, closed: boolean) => void;
  updatingAccountId: string | null;
  formatDateTime: (dateString: string | null) => string;
}

export default function AccountView({
  paginatedData,
  onUpdateAccount,
  updatingAccountId,
  formatDateTime,
}: AccountViewProps) {
  const { t } = useLocalization();
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Email')}</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>{t('Created')}</TableHead>
          <TableHead>{t('Family')}</TableHead>
          <TableHead>{t('Verified')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead className="text-right">{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
              {t('No accounts found.')}
            </TableCell>
          </TableRow>
        ) : (
          paginatedData.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.email}</TableCell>
              <TableCell>
                {account.firstName || account.lastName ? 
                  `${account.firstName || ''} ${account.lastName || ''}`.trim() : 
                  'N/A'
                }
              </TableCell>
              <TableCell className="text-sm">{formatDateTime(account.createdAt)}</TableCell>
              <TableCell>
                {account.family ? (
                  <div>
                    <div className="font-medium">{account.family.name}</div>
                    <div className="text-xs text-gray-500">/{account.family.slug}</div>
                  </div>
                ) : (
                  'No family'
                )}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    account.verified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {account.verified ? (
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
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    !account.closed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {!account.closed ? 'Active' : 'Closed'}
                </span>
                {account.closedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateTime(account.closedAt)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateAccount(account.id, !account.closed)}
                    disabled={updatingAccountId === account.id}
                    title={account.closed ? 'Reinstate account' : 'Close account'}
                  >
                    {updatingAccountId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : account.closed ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
