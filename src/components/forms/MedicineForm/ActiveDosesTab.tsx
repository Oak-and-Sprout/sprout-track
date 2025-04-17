'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { medicineFormStyles as styles } from './medicine-form.styles';
import { ActiveDosesTabProps, MedicineLogWithDetails } from './medicine-form.types';

// Enhanced ActiveDose interface
interface ActiveDose {
  id: string;
  medicineName: string;
  doseAmount: number;
  unitAbbr?: string;
  time: string;
  nextDoseTime?: string;
  isSafe: boolean;
  minutesRemaining?: number;
  totalIn24Hours: number;
  doseMinTime: string;
  hasRecentDoses: boolean; // Track if there are doses in the last 24 hours
}
import { PillBottle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useTimezone } from '@/app/context/timezone';

/**
 * ActiveDosesTab Component
 * 
 * Displays active medicine doses for a baby with countdown timers
 * showing when the next dose is safe to administer.
 */
const ActiveDosesTab: React.FC<ActiveDosesTabProps> = ({ babyId, refreshData }) => {
  const { formatDate, calculateDurationMinutes } = useTimezone();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDoses, setActiveDoses] = useState<ActiveDose[]>([]);
  
  // Function to process medicine logs into active doses
  const createActiveDoses = useCallback((logs: MedicineLogWithDetails[] | null): ActiveDose[] => {
    const doses: ActiveDose[] = [];
    
    // Return empty array if logs is null or not an array
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return doses;
    }
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Group logs by medicine
    const medicineGroups = logs.reduce((groups, log) => {
      const key = log.medicine.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
      return groups;
    }, {} as Record<string, MedicineLogWithDetails[]>);
    
    // Process each medicine group
    Object.values(medicineGroups).forEach((medicineGroup: MedicineLogWithDetails[]) => {
      if (!medicineGroup.length) return;
      
      // Sort by time, most recent first
      medicineGroup.sort((a: MedicineLogWithDetails, b: MedicineLogWithDetails) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      
      const latestLog = medicineGroup[0];
      const medicine = latestLog.medicine;
      
      // Calculate if it's safe to give another dose
      let isSafe = true;
      let nextDoseTime = "";
      let minutesRemaining = 0;
      let doseMinTime = "00:00:30"; // Default to 30 minutes if not specified
      
      if (medicine.doseMinTime) {
        doseMinTime = medicine.doseMinTime;
        
        // Validate doseMinTime format (DD:HH:MM)
        const timeRegex = /^([0-9]{1,2}):([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        if (timeRegex.test(medicine.doseMinTime)) {
          const [days, hours, minutes] = medicine.doseMinTime.split(':').map(Number);
          const minTimeMs = ((days * 24 * 60) + (hours * 60) + minutes) * 60 * 1000;
          const lastDoseTime = new Date(latestLog.time).getTime();
          
          try {
            // Log the parsed values for debugging
            console.log(`Medicine: ${medicine.name}, Days: ${days}, Hours: ${hours}, Minutes: ${minutes}`);
            console.log(`Min time in ms: ${minTimeMs}, which is ${minTimeMs / (1000 * 60 * 60 * 24)} days`);
            
            const safeTime = new Date(lastDoseTime + minTimeMs);
            
            // Log the calculated times for debugging
            console.log(`Last dose: ${new Date(lastDoseTime).toISOString()}`);
            console.log(`Safe time: ${safeTime.toISOString()}`);
            console.log(`Current time: ${now.toISOString()}`);
            
            // Check if the date is valid before calling toISOString()
            if (!isNaN(safeTime.getTime())) {
              nextDoseTime = safeTime.toISOString();
              
              // Calculate minutes remaining regardless of whether it's safe or not
              minutesRemaining = calculateDurationMinutes(now.toISOString(), safeTime.toISOString());
              // Ensure minutes remaining is never negative
              minutesRemaining = Math.max(0, minutesRemaining);
              console.log(`Minutes remaining: ${minutesRemaining}`);
              
              // Compare timestamps to determine if it's safe
              isSafe = safeTime.getTime() <= now.getTime();
              console.log(`Is safe: ${isSafe}, safeTime <= now: ${safeTime <= now}, safeTime.getTime() <= now.getTime(): ${safeTime.getTime() <= now.getTime()}`);
            } else {
              console.warn(`Invalid date calculation for medicine ${medicine.name}`);
              isSafe = true; // Default to safe if we can't calculate
            }
          } catch (error) {
            console.error(`Error calculating next dose time for ${medicine.name}:`, error);
            isSafe = true; // Default to safe if there's an error
          }
        } else {
          // Try the old HH:MM format for backward compatibility
          const oldTimeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
          if (oldTimeRegex.test(medicine.doseMinTime)) {
            const [hours, minutes] = medicine.doseMinTime.split(':').map(Number);
            const minTimeMs = (hours * 60 + minutes) * 60 * 1000;
            const lastDoseTime = new Date(latestLog.time).getTime();
            
            try {
              // Log the parsed values for debugging
              console.log(`Medicine: ${medicine.name}, Hours: ${hours}, Minutes: ${minutes}`);
              console.log(`Min time in ms: ${minTimeMs}, which is ${minTimeMs / (1000 * 60 * 60)} hours`);
              
              const safeTime = new Date(lastDoseTime + minTimeMs);
              
              // Log the calculated times for debugging
              console.log(`Last dose: ${new Date(lastDoseTime).toISOString()}`);
              console.log(`Safe time: ${safeTime.toISOString()}`);
              console.log(`Current time: ${now.toISOString()}`);
              
              // Check if the date is valid before calling toISOString()
              if (!isNaN(safeTime.getTime())) {
                nextDoseTime = safeTime.toISOString();
                
                // Calculate minutes remaining regardless of whether it's safe or not
                minutesRemaining = calculateDurationMinutes(now.toISOString(), safeTime.toISOString());
                // Ensure minutes remaining is never negative
                minutesRemaining = Math.max(0, minutesRemaining);
                console.log(`Minutes remaining: ${minutesRemaining}`);
                
                // Compare timestamps to determine if it's safe
                isSafe = safeTime.getTime() <= now.getTime();
                console.log(`Is safe: ${isSafe}, safeTime <= now: ${safeTime <= now}, safeTime.getTime() <= now.getTime(): ${safeTime.getTime() <= now.getTime()}`);
              } else {
                console.warn(`Invalid date calculation for medicine ${medicine.name}`);
                isSafe = true; // Default to safe if we can't calculate
              }
            } catch (error) {
              console.error(`Error calculating next dose time for ${medicine.name}:`, error);
              isSafe = true; // Default to safe if there's an error
            }
          } else {
            console.warn(`Invalid doseMinTime format for medicine ${medicine.name}: ${medicine.doseMinTime}`);
            isSafe = true; // Default to safe if format is invalid
          }
        }
      }
      
      // Calculate total amount given in last 24 hours
      const logsIn24Hours = medicineGroup.filter(log => 
        new Date(log.time).getTime() >= twentyFourHoursAgo.getTime()
      );
      
      const totalIn24Hours = logsIn24Hours.reduce((sum, log) => sum + log.doseAmount, 0);
      const hasRecentDoses = logsIn24Hours.length > 0;
      
      // Add to active doses
      doses.push({
        id: latestLog.id,
        medicineName: latestLog.medicine.name,
        doseAmount: latestLog.doseAmount,
        unitAbbr: latestLog.unitAbbr || latestLog.medicine.unitAbbr || undefined,
        time: typeof latestLog.time === 'string' ? latestLog.time : new Date(latestLog.time).toISOString(),
        nextDoseTime: nextDoseTime || "",
        isSafe,
        minutesRemaining, // Always include the minutes remaining, even if it's safe
        totalIn24Hours,
        doseMinTime,
        hasRecentDoses
      });
    });
    
    return doses;
  }, [calculateDurationMinutes]);
  
  // Fetch active doses data
  const fetchActiveDoses = useCallback(async () => {
    if (!babyId) return;
    
    try {
      setIsLoading(true);
      
      // Calculate date 60 days ago for filtering
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      // Fetch medicine logs for this baby from the last 60 days
      const response = await fetch(
        `/api/medicine-log?babyId=${babyId}&startDate=${sixtyDaysAgo.toISOString()}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch medicine logs');
      }
      
      const data = await response.json();
      // Check if data is in the expected format
      const logsData = data.data || data;
      const processedDoses = createActiveDoses(Array.isArray(logsData) ? logsData : []);
      
      setActiveDoses(processedDoses);
    } catch (error) {
      console.error('Error fetching active doses:', error);
      setError('Failed to load active doses');
    } finally {
      setIsLoading(false);
    }
  }, [babyId, createActiveDoses]);
  
  // Set up interval to refresh countdown timers
  useEffect(() => {
    // Initial fetch
    fetchActiveDoses();
    
    // Set up timer to update every minute
    const timer = setInterval(() => {
      if (activeDoses.some(dose => !dose.isSafe)) {
        fetchActiveDoses();
      }
    }, 60000); // 1 minute
    
    return () => clearInterval(timer);
  }, [babyId, fetchActiveDoses]);
  
  // Refresh data when requested
  const handleRefresh = useCallback(() => {
    fetchActiveDoses();
  }, [fetchActiveDoses]);
  
  // Format time remaining for display
  const formatTimeRemaining = (minutes: number, isSafe: boolean): string => {
    // Only show "Safe to administer" if it's safe AND there's no time remaining
    if (isSafe && minutes <= 0) return 'Safe to administer';
    
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = Math.floor(minutes % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${mins}m remaining`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };
  

  
  return (
    <div className={cn(styles.tabContent, "medicine-form-tab-content")}>
      {/* Loading state */}
      {isLoading && (
        <div className={cn(styles.loadingContainer, "medicine-form-loading-container")}>
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-2 text-gray-600">Loading active doses...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className={cn(styles.errorContainer, "medicine-form-error-container")}>
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-500">{error}</p>
          <Button 
            variant="outline" 
            onClick={fetchActiveDoses} 
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Empty state */}
      {!isLoading && !error && activeDoses.length === 0 && (
        <div className={cn(styles.emptyState, "medicine-form-empty-state")}>
          <PillBottle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>No medicine doses in the last 60 days</p>
        </div>
      )}
      
      {/* Active doses list */}
      {!isLoading && !error && activeDoses.length > 0 && (
        <div className={cn(styles.activeDosesContainer, "medicine-form-active-doses-container")}>
          {activeDoses.map((dose) => (
            <div key={dose.id} className={cn(
              styles.doseCard, 
              "medicine-form-dose-card",
              !dose.hasRecentDoses && "border-l-4 border-l-amber-500"
            )}>
              <div className={cn(styles.doseHeader, "medicine-form-dose-header")}>
                <div className="flex items-center">
                  <div className={cn(styles.iconContainer, "medicine-form-icon-container")}>
                    <PillBottle className="h-4 w-4" />
                  </div>
                  <h3 className={cn(styles.doseName, "medicine-form-dose-name ml-2")}>
                    {dose.medicineName}
                  </h3>
                </div>
                <span className={cn(styles.doseAmount, "medicine-form-dose-amount")}>
                  {dose.doseAmount} {dose.unitAbbr}
                </span>
              </div>
              
              {dose.hasRecentDoses && (
                <p className={cn(styles.doseTime, "medicine-form-dose-time")}>
                  Last dose: {formatDate(dose.time)}
                </p>
              )}
              
              <div className={cn(styles.doseInfo, "medicine-form-dose-info mt-3")}>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1 text-gray-500" />
                  <span className={cn(
                    dose.isSafe ? styles.countdownSafe : styles.countdownWarning,
                    dose.isSafe ? "medicine-form-countdown-safe" : "medicine-form-countdown-warning"
                  )}>
                    {formatTimeRemaining(dose.minutesRemaining || 0, dose.isSafe)}
                  </span>
                </div>
                {/* Next dose time removed as it's redundant with the countdown */}
              </div>
              
              <div className={cn(styles.totalDose, "medicine-form-total-dose mt-2")}>
                {dose.hasRecentDoses ? (
                  <>Total in last 24h: {dose.totalIn24Hours} {dose.unitAbbr}</>
                ) : (
                  <>Last Dose: {new Date(dose.time).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })} - {dose.doseAmount} {dose.unitAbbr}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActiveDosesTab;
