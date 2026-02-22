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
  Mail,
  UserX,
} from "lucide-react";
import { BetaSubscriberResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';

interface BetaSubscriberViewProps {
  paginatedData: BetaSubscriberResponse[];
  onUpdateSubscriber: (id: string, isOptedIn: boolean) => void;
  onDeleteSubscriber: (id: string) => void;
  updatingSubscriberId: string | null;
  deletingSubscriberId: string | null;
  formatDateTime: (dateString: string | null) => string;
}

export default function BetaSubscriberView({
  paginatedData,
  onUpdateSubscriber,
  onDeleteSubscriber,
  updatingSubscriberId,
  deletingSubscriberId,
  formatDateTime,
}: BetaSubscriberViewProps) {
  const { t } = useLocalization();
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Email')}</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>{t('Signed Up')}</TableHead>
          <TableHead>{t('Source')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead className="text-right">{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
              {t('No data found.')}
            </TableCell>
          </TableRow>
        ) : (
          paginatedData.map((subscriber) => (
            <TableRow key={subscriber.id}>
              <TableCell className="font-medium">{subscriber.email}</TableCell>
              <TableCell>{subscriber.firstName} {subscriber.lastName}</TableCell>
              <TableCell className="text-sm">{formatDateTime(subscriber.createdAt)}</TableCell>
              <TableCell>{subscriber.source}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscriber.isOptedIn
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {subscriber.isOptedIn ? 'Subscribed' : 'Opted Out'}
                </span>
                {subscriber.optedOutAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateTime(subscriber.optedOutAt)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateSubscriber(subscriber.id, !subscriber.isOptedIn)}
                    disabled={updatingSubscriberId === subscriber.id}
                    title={subscriber.isOptedIn ? 'Opt-out subscriber' : 'Opt-in subscriber'}
                  >
                    {updatingSubscriberId === subscriber.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : subscriber.isOptedIn ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteSubscriber(subscriber.id)}
                    disabled={deletingSubscriberId === subscriber.id}
                    title="Delete subscriber"
                  >
                    {deletingSubscriberId === subscriber.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
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
