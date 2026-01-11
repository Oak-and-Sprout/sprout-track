'use client';

import React, { useState, useEffect } from 'react';
import { Baby } from '@prisma/client';
import FormPage, { FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { Loader2, Bell, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './baby-quick-info.styles';
import { BabyQuickInfoProps } from './baby-quick-info.types';
import NotificationsTab from './NotificationsTab';
import ContactsTab from './ContactsTab';
import { useLocalization } from '@/src/context/localization';

import './baby-quick-info.css';

/**
 * BabyQuickInfo Component
 * 
 * A tabbed component that displays information about a baby, including
 * notifications, contacts, and quick stats.
 * 
 * @example
 * ```tsx
 * <BabyQuickInfo
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   selectedBaby={selectedBaby}
 *   calculateAge={calculateAge}
 * />
 * ```
 */
const BabyQuickInfo: React.FC<BabyQuickInfoProps> = ({
  isOpen,
  onClose,
  selectedBaby,
  calculateAge
}) => {
  const { t } = useLocalization();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [lastActivities, setLastActivities] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  // Fetch data when the component opens or the baby changes
  useEffect(() => {
    if (isOpen && selectedBaby) {
      fetchData();
    }
  }, [isOpen, selectedBaby]);
  
  // Fetch all necessary data
  const fetchData = async () => {
    if (!selectedBaby) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('authToken');
      const fetchOptions = authToken ? {
        headers: { 'Authorization': `Bearer ${authToken}` }
      } : {};
      
      // Fetch data in parallel
      const [lastActivitiesRes, upcomingEventsRes, contactsRes, activitiesRes] = await Promise.all([
        fetch(`/api/baby-last-activities?babyId=${selectedBaby.id}`, fetchOptions),
        fetch(`/api/baby-upcoming-events?babyId=${selectedBaby.id}&limit=5`, fetchOptions),
        fetch(`/api/contact`, fetchOptions),
        fetch(`/api/timeline?babyId=${selectedBaby.id}&limit=30`, fetchOptions)
      ]);
      
      // Process responses
      if (lastActivitiesRes.ok) {
        const data = await lastActivitiesRes.json();
        setLastActivities(data.success ? data.data : null);
      } else {
        console.error('Failed to fetch last activities:', await lastActivitiesRes.text());
      }
      
      if (upcomingEventsRes.ok) {
        const data = await upcomingEventsRes.json();
        setUpcomingEvents(data.success ? data.data : []);
      } else {
        console.error('Failed to fetch upcoming events:', await upcomingEventsRes.text());
      }
      
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.success ? data.data : []);
      } else {
        console.error('Failed to fetch contacts:', await contactsRes.text());
      }
      
      if (activitiesRes.ok) {
        const data = await activitiesRes.json();
        setActivities(data.success ? data.data : []);
      } else {
        console.error('Failed to fetch activities:', await activitiesRes.text());
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create tabs configuration
  const tabs: FormPageTab[] = [
    {
      id: 'notifications',
      label: t('Notifications'),
      icon: Bell,
      content: (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className={cn(styles.loadingContainer, "baby-quick-info-loading-container")}>
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className={cn("mt-2 text-gray-600", "baby-quick-info-loading-text")}>{t('Loading...')}</p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className={cn(styles.errorContainer, "baby-quick-info-error-container")}>
              <p className={cn("text-red-500", "baby-quick-info-error-text")}>{error}</p>
              <Button 
                variant="outline" 
                onClick={fetchData} 
                className="mt-2"
              >
                {t('Retry')}
              </Button>
            </div>
          )}
          
          {/* Tab content */}
          {!isLoading && !error && selectedBaby && (
            <NotificationsTab
              lastActivities={lastActivities}
              upcomingEvents={upcomingEvents}
              selectedBaby={selectedBaby}
            />
          )}
        </>
      )
    },
    {
      id: 'contacts',
      label: t('Contacts'),
      icon: Users,
      content: (
        <>
          {/* Loading state */}
          {isLoading && (
            <div className={cn(styles.loadingContainer, "baby-quick-info-loading-container")}>
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className={cn("mt-2 text-gray-600", "baby-quick-info-loading-text")}>{t('Loading...')}</p>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className={cn(styles.errorContainer, "baby-quick-info-error-container")}>
              <p className={cn("text-red-500", "baby-quick-info-error-text")}>{error}</p>
              <Button 
                variant="outline" 
                onClick={fetchData} 
                className="mt-2"
              >
                {t('Retry')}
              </Button>
            </div>
          )}
          
          {/* Tab content */}
          {!isLoading && !error && selectedBaby && (
            <ContactsTab
              contacts={contacts}
              selectedBaby={selectedBaby}
            />
          )}
        </>
      )
    }
  ];
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={selectedBaby ? `${selectedBaby.firstName}${t("'s Information")}` : t('Baby Information')}
      tabs={tabs}
      defaultActiveTab="notifications"
    >
      <FormPageFooter>
        <div className={cn(styles.footerContainer, "baby-quick-info-footer-container")}>
          <Button onClick={onClose} variant="outline">
            {t('Close')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default BabyQuickInfo;
