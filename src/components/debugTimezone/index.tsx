'use client';

import React, { useState, useEffect } from 'react';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';

export function TimezoneDebug() {
  const { t } = useLocalization();

  // Get timezone context first to avoid hook order issues
  const { 
    userTimezone, 
    getTimezoneInfo, 
    formatDateTime, 
    isDaylightSavingTime, 
    isLoading: tzLoading, 
    isDST,
    refreshTimezone 
  } = useTimezone();
  
  // All state hooks must be defined before any conditional returns
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [info, setInfo] = useState({
    userTimezone,
    serverTimezone: 'Loading...',
    currentTime: new Date().toISOString(),
    currentOffset: new Date().getTimezoneOffset(),
    isDST: false,
    formattedCurrentTime: '',
    isMobile: typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    isLoading: tzLoading,
    initTime: new Date().toISOString()
  });
  
  // Fetch settings to check if debug timezone tool is enabled
  const fetchSettings = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch('/api/settings', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Only enable if explicitly enabled in settings
          setIsEnabled(!!data.data.enableDebugTimezone);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Default to disabled if there's an error
      setIsEnabled(false);
    }
    setIsInitialized(true);
  };
  
  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);
  
  const fetchServerTimezone = async () => {
    try {
      // Use the new system-timezone endpoint that directly gets the system timezone
      const response = await fetch('/api/system-timezone');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.systemTimezone) {
          setInfo(prev => ({
            ...prev,
            serverTimezone: data.data.systemTimezone
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching server timezone:', error);
      setInfo(prev => ({
        ...prev,
        serverTimezone: 'Error fetching'
      }));
    }
  };
  
  // Update info when timezone context changes
  useEffect(() => {
    if (!tzLoading) {
      refreshInfo();
    }
  }, [tzLoading, userTimezone, isDST]);
  
  const refreshInfo = () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const tzInfo = getTimezoneInfo();
    
    // Get timezone name with abbreviation
    const formattedTime = formatDateTime(nowIso) + ' ' + 
      new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        timeZoneName: 'short'
      }).format(now).split(', ')[1];
    
    setInfo(prev => ({
      ...prev,
      userTimezone,
      currentTime: nowIso,
      currentOffset: tzInfo.currentOffset,
      isDST: tzInfo.isDST,
      formattedCurrentTime: formattedTime,
      isMobile: tzInfo.isMobile,
      isLoading: tzInfo.isLoading
    }));
    
    // Fetch server timezone info
    fetchServerTimezone();
    
    // Force refresh timezone context
    refreshTimezone();
    
    // Log detailed timezone information
    console.log('Timezone debug info:', {
      userTimezone,
      isDST,
      offset: now.getTimezoneOffset(),
      formattedWithTimezoneName: new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        timeZoneName: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(now)
    });
  };
  
  // Fetch server timezone when component mounts or when debug panel is opened
  useEffect(() => {
    if (showDebug) {
      refreshInfo();
    }
  }, [showDebug]);
  
  // Don't render if not initialized or not enabled
  if (!isInitialized || !isEnabled) {
    return null;
  }
  
  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        className={`fixed bottom-4 right-4 ${isDST ? 'bg-green-600' : 'bg-red-600'} text-white p-2 rounded-full z-50 opacity-50 hover:opacity-100`}
      >
        {t('TZ')}
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 max-w-xs w-full text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">{t('Timezone Debug')}</h3>
        <div className="flex items-center">
          {tzLoading && (
            <span className="text-yellow-500 mr-2">{t('Loading...')}</span>
          )}
          <button 
            onClick={() => setShowDebug(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            {t('Close')}
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div>
          <span className="font-semibold">{t('User Timezone:')}</span> {info.userTimezone}
        </div>
        <div>
          <span className="font-semibold">{t('Server Timezone:')}</span> {info.serverTimezone}
        </div>
        <div>
          <span className="font-semibold">{t('Current Time (ISO):')}</span> {info.currentTime}
        </div>
        <div>
          <span className="font-semibold">{t('Current Time (Formatted):')}</span> {info.formattedCurrentTime}
        </div>
        <div>
          <span className="font-semibold">{t('Timezone Offset:')}</span> {info.currentOffset} {t('minutes (UTC')}{info.currentOffset > 0 ? '-' : '+'}{Math.abs(info.currentOffset / 60)})
        </div>
        <div className={info.isDST ? "font-bold text-green-600" : "font-bold text-red-600"}>
          <span className="font-semibold">{t('Is DST Active:')}</span> {info.isDST ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="font-semibold">{t('Is Mobile:')}</span> {info.isMobile ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="font-semibold">{t('Context Loading:')}</span> {info.isLoading ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="font-semibold">{t('Init Time:')}</span> {new Date(info.initTime).toLocaleTimeString()}
        </div>
        <div className="text-xs overflow-hidden text-ellipsis">
          <span className="font-semibold">{t('Browser Info:')}</span> {navigator.userAgent}
        </div>
        
        <div className="pt-2 flex space-x-2">
          <button 
            onClick={refreshInfo}
            className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
          >
            {t('Refresh Info')}
          </button>
          <button 
            onClick={refreshTimezone}
            className="bg-green-500 text-white px-2 py-1 rounded text-xs"
          >
            {t('Force Refresh Timezone')}
          </button>
        </div>
      </div>
    </div>
  );
}
