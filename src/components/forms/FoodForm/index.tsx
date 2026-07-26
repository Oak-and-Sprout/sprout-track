'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { FoodFormProps, LogFoodFormState } from './food-form.types';
import { FoodResponse } from '@/app/api/types';
import { Apple, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import LogFoodTab from './LogFoodTab';
import ProgressTab from './ProgressTab';
import { useLocalization } from '@/src/context/localization';

import './food-form.css';

/**
 * FoodForm Component
 *
 * A tabbed form for the food tracker (issue #203): log foods tried
 * (with enjoyment, allergen, and reaction data) and view "100 foods
 * before 1" progress, per-food history, and the allergen profile.
 *
 * @example
 * ```tsx
 * <FoodForm
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   babyId={selectedBaby?.id}
 *   initialTime={new Date().toISOString()}
 *   onSuccess={() => fetchData()}
 *   activity={foodLogActivity}
 * />
 * ```
 */
const FoodForm: React.FC<FoodFormProps> = ({
  isOpen,
  onClose,
  babyId,
  initialTime,
  onSuccess,
  activity,
}) => {
  const { t } = useLocalization();
  const logFormId = useId();
  const [activeTab, setActiveTab] = useState<string>('log');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [foods, setFoods] = useState<FoodResponse[]>([]);
  const [logFormState, setLogFormState] = useState<LogFoodFormState>({ isSubmitting: false, canSubmit: false });

  // Fetch the family food catalog once when the form opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchFoods = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/food', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            setFoods(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching foods:', error);
      }
    };
    fetchFoods();
  }, [isOpen]);

  // Function to refresh data in all tabs
  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle success from LogFoodTab
  const handleLogSuccess = useCallback(() => {
    refreshData();
    if (onSuccess) {
      onSuccess();
    }
  }, [onSuccess, refreshData]);

  // Always start on the log tab when the form opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('log');
    }
  }, [isOpen, activity]);

  // Define tabs using the form-page tabs system
  const tabs: FormPageTab[] = [
    {
      id: 'log',
      label: t('Log Food'),
      icon: Apple,
      content: (
        <LogFoodTab
          babyId={babyId}
          initialTime={initialTime}
          onSuccess={handleLogSuccess}
          refreshData={refreshData}
          activity={activity}
          foods={foods}
          onFoodsUpdated={setFoods}
          formId={logFormId}
          onFormStateChange={setLogFormState}
        />
      ),
    },
    {
      id: 'progress',
      label: t('Progress'),
      icon: TrendingUp,
      content: (
        <ProgressTab
          babyId={babyId}
          refreshTrigger={refreshTrigger}
          onNavigate={onClose}
        />
      ),
    },
  ];

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={t('Food Tracker')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <FormPageFooter>
        <div className="flex justify-end space-x-2">
          {activeTab === 'log' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={logFormState.isSubmitting}
              >
                {t('Cancel')}
              </Button>
              {/* Submits the LogFoodTab form via the HTML form attribute */}
              <Button
                type="submit"
                form={logFormId}
                disabled={logFormState.isSubmitting || !logFormState.canSubmit}
              >
                {logFormState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                ) : null}
                {activity ? t('Update') : t('Save')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              {t('Close')}
            </Button>
          )}
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default FoodForm;
