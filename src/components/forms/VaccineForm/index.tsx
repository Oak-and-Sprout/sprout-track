'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { VaccineFormProps, VaccineFormTab } from './vaccine-form.types';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import { Syringe, ClipboardList } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import RecordVaccineTab from './RecordVaccineTab';
import VaccineHistoryTab from './VaccineHistoryTab';
import { useLocalization } from '@/src/context/localization';

import './vaccine-form.css';

/**
 * VaccineForm Component
 *
 * A tabbed form for recording and viewing vaccine history.
 * Includes tabs for recording a vaccine and viewing vaccine history.
 *
 * @example
 * ```tsx
 * <VaccineForm
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   babyId={selectedBaby?.id}
 *   initialTime={new Date().toISOString()}
 *   onSuccess={() => fetchData()}
 *   activity={vaccineActivity}
 * />
 * ```
 */
const VaccineForm: React.FC<VaccineFormProps> = ({
  isOpen,
  onClose,
  babyId,
  initialTime,
  onSuccess,
  activity,
}) => {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState<string>('record');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Fetch contacts once when form opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchContacts = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/contact', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            setContacts(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };
    fetchContacts();
  }, [isOpen]);

  // Function to refresh data in all tabs
  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle success from RecordVaccineTab
  const handleRecordSuccess = useCallback(() => {
    refreshData();
    if (onSuccess) {
      onSuccess();
    }
  }, [onSuccess, refreshData]);

  // Set the active tab when form opens
  useEffect(() => {
    if (isOpen) {
      if (activity) {
        // If editing, go directly to record tab
        setActiveTab('record');
      } else {
        setActiveTab('record');
      }
    }
  }, [isOpen, activity]);

  // Define tabs using the form-page tabs system
  const tabs: FormPageTab[] = [
    {
      id: 'record',
      label: t('Record Vaccine'),
      icon: Syringe,
      content: (
        <RecordVaccineTab
          babyId={babyId}
          initialTime={initialTime}
          onSuccess={handleRecordSuccess}
          onClose={onClose}
          refreshData={refreshData}
          activity={activity}
          contacts={contacts}
          onContactsUpdated={setContacts}
        />
      ),
    },
    {
      id: 'history',
      label: t('Vaccine History'),
      icon: ClipboardList,
      content: (
        <VaccineHistoryTab
          babyId={babyId}
          refreshTrigger={refreshTrigger}
        />
      ),
    },
  ];

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={t("Vaccine Tracker")}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <FormPageFooter>
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            {t('Close')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default VaccineForm;
