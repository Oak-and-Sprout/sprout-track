'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useBaby } from '../context/baby';
import { useTimezone } from '../context/timezone';
import FullLogTimeline from '@/src/components/FullLogTimeline';

function FullLogPage() {
  const { selectedBaby } = useBaby();
  const { userTimezone } = useTimezone();
  const [activities, setActivities] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to last 7 days
    return date;
  });
  const [endDate, setEndDate] = useState(() => new Date());

  const refreshActivities = useCallback(async () => {
    if (!selectedBaby?.id) return;

    try {
      // Set start date to beginning of day (00:00:00) and end date to end of day (23:59:59)
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setHours(0, 0, 0, 0);
      
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const response = await fetch(
        `/api/timeline?babyId=${selectedBaby.id}&startDate=${adjustedStartDate.toISOString()}&endDate=${adjustedEndDate.toISOString()}&timezone=${encodeURIComponent(userTimezone)}`
      );
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [selectedBaby?.id, startDate, endDate, userTimezone]);

  // Initial load
  React.useEffect(() => {
    refreshActivities();
  }, [refreshActivities]);

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // Update unlock timer on any activity
  const updateUnlockTimer = () => {
    const unlockTime = localStorage.getItem('unlockTime');
    if (unlockTime) {
      localStorage.setItem('unlockTime', Date.now().toString());
    }
  };

  // Add activity tracking
  useEffect(() => {
    // Add listeners for user activity
    window.addEventListener('click', updateUnlockTimer);
    window.addEventListener('keydown', updateUnlockTimer);
    window.addEventListener('mousemove', updateUnlockTimer);
    window.addEventListener('touchstart', updateUnlockTimer);

    return () => {
      // Clean up event listeners
      window.removeEventListener('click', updateUnlockTimer);
      window.removeEventListener('keydown', updateUnlockTimer);
      window.removeEventListener('mousemove', updateUnlockTimer);
      window.removeEventListener('touchstart', updateUnlockTimer);
    };
  }, []);

  return (
    <div className="h-full relative isolate">
      {selectedBaby ? (
          <div className="relative z-0">
            <FullLogTimeline
          activities={activities}
          onActivityDeleted={refreshActivities}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={handleDateRangeChange}
            />
          </div>
      ) : (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">No Baby Selected</h2>
          <p className="mt-2 text-gray-500">Please select a baby from the dropdown menu above.</p>
        </div>
      )}
    </div>
  );
}

export default FullLogPage;
