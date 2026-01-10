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
import { 
  Loader2,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { ShareButton } from '@/src/components/ui/share-button';
import { useLocalization } from '@/src/context/localization';

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

interface ActiveInviteViewProps {
  paginatedData: FamilySetupInvite[];
  onDeleteInvite: (inviteId: string) => void;
  deletingInviteId: string | null;
  appConfig: { rootDomain: string; enableHttps: boolean } | null;
  formatDateTime: (dateString: string | null) => string;
}

export default function ActiveInviteView({
  paginatedData,
  onDeleteInvite,
  deletingInviteId,
  appConfig,
  formatDateTime,
}: ActiveInviteViewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Token')}</TableHead>
          <TableHead>{t('Created By')}</TableHead>
          <TableHead>{t('Created')}</TableHead>
          <TableHead>{t('Expires')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Family')}</TableHead>
          <TableHead className="text-right">{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
              {t('No invites found.')}
            </TableCell>
          </TableRow>
        ) : (
          paginatedData.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="font-mono text-sm">
                {invite.token.substring(0, 16)}...
              </TableCell>
              <TableCell>
                {invite.creator ? (
                  <div>
                    <div className="font-medium">{invite.creator.name}</div>
                    <div className="text-xs text-gray-500">{t('ID:')} {invite.creator.loginId}</div>
                  </div>
                ) : (
                  'Unknown'
                )}
              </TableCell>
              <TableCell className="text-sm">{formatDateTime(invite.createdAt)}</TableCell>
              <TableCell className="text-sm">{formatDateTime(invite.expiresAt)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {invite.isUsed ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('Used')}
                    </span>
                  ) : invite.isExpired ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('Expired')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('Active')}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {invite.family ? (
                  <div>
                    <div className="font-medium">{invite.family.name}</div>
                    <div className="text-xs text-gray-500">/{invite.family.slug}</div>
                  </div>
                ) : (
                  'Not created yet'
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {!invite.isUsed && (
                    <>
                      <ShareButton
                        familySlug={`setup/${invite.token}`}
                        familyName="Family Setup Invitation"
                        appConfig={appConfig || undefined}
                        urlSuffix=""
                        variant="outline"
                        size="sm"
                        showText={false}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteInvite(invite.id)}
                        disabled={deletingInviteId === invite.id}
                        title="Revoke invite"
                      >
                        {deletingInviteId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
