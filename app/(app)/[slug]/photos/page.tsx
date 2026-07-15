'use client';

import React, { useEffect, useState } from 'react';
import { useBaby } from '../../../context/baby';
import { useLocalization } from '@/src/context/localization';
import PhotoGallery from '@/src/components/PhotoGallery';
import { fetchPhotosEnabled } from '@/src/utils/photoClientApi';
import { ImageOff } from 'lucide-react';

function PhotosPage() {
  const { selectedBaby } = useBaby();
  const { t } = useLocalization();
  const [photosEnabled, setPhotosEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetchPhotosEnabled().then(setPhotosEnabled);
  }, []);

  // Update unlock timer on any activity
  const updateUnlockTimer = () => {
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
  };

  // Add activity tracking
  useEffect(() => {
    window.addEventListener('click', updateUnlockTimer);
    window.addEventListener('keydown', updateUnlockTimer);
    window.addEventListener('mousemove', updateUnlockTimer);
    window.addEventListener('touchstart', updateUnlockTimer);

    return () => {
      window.removeEventListener('click', updateUnlockTimer);
      window.removeEventListener('keydown', updateUnlockTimer);
      window.removeEventListener('mousemove', updateUnlockTimer);
      window.removeEventListener('touchstart', updateUnlockTimer);
    };
  }, []);

  if (photosEnabled === null) {
    return (
      <div className="flex h-[calc(100vh-192px)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" aria-hidden="true" />
        <span className="sr-only">{t('Loading')}...</span>
      </div>
    );
  }

  if (photosEnabled === false) {
    return (
      <div className="flex h-[calc(100vh-192px)] flex-col items-center justify-center text-center bg-white border-t border-gray-200">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ImageOff className="h-8 w-8 text-gray-400" aria-hidden="true" />
        </div>
        <p className="text-sm text-gray-500">{t('Photos are not enabled')}</p>
      </div>
    );
  }

  return (
    <div className="h-full relative isolate">
      <PhotoGallery babyId={selectedBaby?.id} />
    </div>
  );
}

export default PhotosPage;
