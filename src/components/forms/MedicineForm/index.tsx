'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MedicineFormProps, MedicineFormTab } from './medicine-form.types';
import { PillBottle, Loader2, Activity, Settings } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import ActiveDosesTab from './ActiveDosesTab';
import ManageMedicinesTab from './ManageMedicinesTab';
import GiveMedicineForm from '../GiveMedicineForm';
import { useLocalization } from '@/src/context/localization';

import './medicine-form.css';

/**
 * MedicineForm Component
 * 
 * A tabbed form for managing and administering medicines.
 * Includes tabs for viewing active doses, giving medicine, and managing medicines.
 * 
 * @example
 * ```tsx
 * <MedicineForm
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   babyId={selectedBaby?.id}
 *   initialTime={new Date().toISOString()}
 *   onSuccess={() => fetchData()}
 *   activity={medicineActivity} // Pass activity for editing
 * />
 * ```
 */
const MedicineForm: React.FC<MedicineFormProps> = ({
  isOpen,
  onClose,
  babyId,
  initialTime,
  onSuccess,
  activity,
}) => {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState<string>('active-doses');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showGiveMedicineForm, setShowGiveMedicineForm] = useState(false);
  
  // Function to refresh data in all tabs
  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  // Handle opening the Give Medicine form
  const handleOpenGiveMedicine = useCallback(() => {
    setShowGiveMedicineForm(true);
  }, []);
  
  // Handle success from GiveMedicineForm
  const handleGiveMedicineSuccess = useCallback(() => {
    setShowGiveMedicineForm(false);
    refreshData();
    
    // Call the original onSuccess if provided
    if (onSuccess) {
      onSuccess();
    }
  }, [onSuccess, refreshData]);
  
  // Set the active tab when form opens
  useEffect(() => {
    if (isOpen) {
      // If we have an activity passed in, open the Give Medicine form for editing
      if (activity) {
        setShowGiveMedicineForm(true);
      } else {
        setActiveTab('active-doses');
      }
    }
  }, [isOpen, activity]);

  // Define tabs using the form-page tabs system
  const tabs: FormPageTab[] = [
    {
      id: 'active-doses',
      label: 'Doses',
      icon: Activity,
      content: (
        <ActiveDosesTab
          babyId={babyId}
          refreshData={refreshData}
          onGiveMedicine={handleOpenGiveMedicine}
          refreshTrigger={refreshTrigger}
        />
      ),
    },
    {
      id: 'manage-medicines',
      label: 'Medicines',
      icon: Settings,
      content: (
        <ManageMedicinesTab
          refreshData={refreshData}
        />
      ),
    },
  ];
  
  return (
    <>
      <FormPage
        isOpen={isOpen}
        onClose={onClose}
        title="Medicine Tracker"
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
      
      {/* Give Medicine Form - overlays the main form */}
      <GiveMedicineForm
        isOpen={showGiveMedicineForm}
        onClose={() => setShowGiveMedicineForm(false)}
        babyId={babyId}
        initialTime={initialTime}
        onSuccess={handleGiveMedicineSuccess}
        refreshData={refreshData}
        activity={activity}
      />
    </>
  );
};

export default MedicineForm;
