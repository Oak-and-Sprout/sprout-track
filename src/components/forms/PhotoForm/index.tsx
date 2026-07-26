'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { useLocalization } from '@/src/context/localization';
import { PhotoQuotaMeter } from '@/src/components/ui/photo-quota-meter';
import { fetchPhotos } from '@/src/utils/photoClientApi';
import AddPhotoTab from './AddPhotoTab';
import PhotoLibraryTab from './PhotoLibraryTab';
import { PhotoFormProps } from './photo-form.types';
import './photo-form.css';

export default function PhotoForm({ isOpen, onClose, babyId, initialTime, activity, onSuccess, onOpenPhoto }: PhotoFormProps) {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState<string>('add');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [quota, setQuota] = useState<{ usedBytes: number; totalBytes: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('add');
    fetchPhotos({ limit: 1 })
      .then((data) => setQuota(data.quota))
      .catch(() => setQuota(null));
  }, [isOpen, refreshTrigger]);

  const handleSuccess = () => {
    setRefreshTrigger((n) => n + 1);
    onSuccess?.();
  };

  const tabs: FormPageTab[] = [
    {
      id: 'add',
      label: t('Add Photo'),
      icon: Camera,
      content: (
        <>
          {quota && <PhotoQuotaMeter usedBytes={quota.usedBytes} totalBytes={quota.totalBytes} className="mb-4" />}
          <AddPhotoTab isOpen={isOpen} babyId={babyId} initialTime={initialTime} activity={activity} onClose={onClose} onSuccess={handleSuccess} refreshTrigger={refreshTrigger} />
        </>
      ),
    },
    {
      id: 'library',
      label: t('Photo Library'),
      icon: Images,
      content: (
        <>
          {quota && <PhotoQuotaMeter usedBytes={quota.usedBytes} totalBytes={quota.totalBytes} className="mb-4" />}
          <PhotoLibraryTab babyId={babyId} onOpenPhoto={onOpenPhoto} refreshTrigger={refreshTrigger} onClose={onClose} />
        </>
      ),
    },
  ];

  return (
    <FormPage isOpen={isOpen} onClose={onClose} title={t('Photo Tracker')} tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      <FormPageFooter>
        <Button variant="outline" onClick={onClose}>
          {t('Close')}
        </Button>
      </FormPageFooter>
    </FormPage>
  );
}
