'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authFetch } from './utils';
import { useDeployment } from '@/app/context/deployment';

interface AdminCounts {
  families: number;
  invites: number;
  accounts: number;
  feedback: number;
}

interface AdminCountContextType {
  counts: AdminCounts;
  refreshCounts: () => Promise<void>;
  updateCount: (key: keyof AdminCounts, value: number) => void;
}

const AdminCountContext = createContext<AdminCountContextType | undefined>(undefined);

export function AdminCountProvider({ children }: { children: React.ReactNode }) {
  const { isSaasMode } = useDeployment();
  const [counts, setCounts] = useState<AdminCounts>({
    families: 0,
    invites: 0,
    accounts: 0,
    feedback: 0,
  });

  const updateCount = useCallback((key: keyof AdminCounts, value: number) => {
    setCounts(prev => ({ ...prev, [key]: value }));
  }, []);

  const refreshCounts = useCallback(async () => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;

    try {
      const [familiesRes, invitesRes] = await Promise.all([
        authFetch('/api/family/manage'),
        authFetch('/api/family/setup-invites'),
      ]);

      const [familiesData, invitesData] = await Promise.all([
        familiesRes.json(),
        invitesRes.json(),
      ]);

      const newCounts: Partial<AdminCounts> = {};
      if (familiesData.success) newCounts.families = familiesData.data.length;
      if (invitesData.success) {
        newCounts.invites = invitesData.data.filter(
          (inv: { isExpired: boolean; isUsed: boolean }) => !inv.isExpired && !inv.isUsed
        ).length;
      }

      if (isSaasMode) {
        const [accountsRes, feedbackRes] = await Promise.all([
          authFetch('/api/accounts/manage'),
          authFetch('/api/feedback'),
        ]);

        const [accountsData, feedbackData] = await Promise.all([
          accountsRes.json(),
          feedbackRes.json(),
        ]);

        if (accountsData.success) newCounts.accounts = accountsData.data.length;
        if (feedbackData.success) {
          newCounts.feedback = feedbackData.data.filter(
            (item: { viewed: boolean }) => !item.viewed
          ).length;
        }
      }

      setCounts(prev => ({ ...prev, ...newCounts }));
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, [isSaasMode]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return (
    <AdminCountContext.Provider value={{ counts, refreshCounts, updateCount }}>
      {children}
    </AdminCountContext.Provider>
  );
}

export function useAdminCounts() {
  const context = useContext(AdminCountContext);
  if (!context) {
    throw new Error('useAdminCounts must be used within an AdminCountProvider');
  }
  return context;
}
