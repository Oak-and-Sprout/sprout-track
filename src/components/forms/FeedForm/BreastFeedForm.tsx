import React, { useState, useEffect } from 'react';
import { BreastSide } from '@prisma/client';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Play, Pause, Clock } from 'lucide-react';
import TimerInput from './TimerInput';
import './feed-form.css';

interface BreastFeedFormProps {
  side: BreastSide | '';
  leftDuration: number;
  rightDuration: number;
  activeBreast: 'LEFT' | 'RIGHT' | '';
  isTimerRunning: boolean;
  loading: boolean;
  onSideChange: (side: BreastSide | '') => void;
  onTimerStart: (breast: 'LEFT' | 'RIGHT') => void;
  onTimerStop: () => void;
  onDurationChange: (breast: 'LEFT' | 'RIGHT', seconds: number) => void;
  isEditing?: boolean; // New prop to indicate if we're editing an existing record
  validationError?: string; // Optional validation error message
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

// Extract hours, minutes, seconds from total seconds
const extractTimeComponents = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return { hours, minutes, seconds };
};

// Format time as hh:mm:ss
const formatTime = (seconds: number) => {
  const { hours, minutes, seconds: secs } = extractTimeComponents(seconds);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
};

export default function BreastFeedForm({
  side,
  leftDuration,
  rightDuration,
  activeBreast,
  isTimerRunning,
  loading,
  onSideChange,
  onTimerStart,
  onTimerStop,
  onDurationChange,
  isEditing = false, // Default to false
  notes = '',
  onNotesChange,
}: BreastFeedFormProps) {
  const [isEditingLeft, setIsEditingLeft] = useState(false);
  const [isEditingRight, setIsEditingRight] = useState(false);
  
  
  // Timer start times for calculating elapsed duration
  const [leftStartTime, setLeftStartTime] = useState<number | null>(null);
  const [rightStartTime, setRightStartTime] = useState<number | null>(null);
  
  // Base durations when timer starts (to avoid feedback loop)
  const [leftBaseDuration, setLeftBaseDuration] = useState(leftDuration);
  const [rightBaseDuration, setRightBaseDuration] = useState(rightDuration);
  
  // Current displayed durations (updated by timer)
  const [displayLeftDuration, setDisplayLeftDuration] = useState(leftDuration);
  const [displayRightDuration, setDisplayRightDuration] = useState(rightDuration);
  
  // Local state for editing
  const [leftHours, setLeftHours] = useState(0);
  const [leftMinutes, setLeftMinutes] = useState(0);
  const [leftSeconds, setLeftSeconds] = useState(0);
  
  const [rightHours, setRightHours] = useState(0);
  const [rightMinutes, setRightMinutes] = useState(0);
  const [rightSeconds, setRightSeconds] = useState(0);
  
  // Update display durations when props change (only when not timing)
  useEffect(() => {
    if (!leftStartTime) {
      setDisplayLeftDuration(leftDuration);
      setLeftBaseDuration(leftDuration);
    }
  }, [leftDuration, leftStartTime]);
  
  useEffect(() => {
    if (!rightStartTime) {
      setDisplayRightDuration(rightDuration);
      setRightBaseDuration(rightDuration);
    }
  }, [rightDuration, rightStartTime]);
  
  // Update local state when durations change
  useEffect(() => {
    if (!isEditingLeft) {
      const { hours, minutes, seconds } = extractTimeComponents(displayLeftDuration);
      setLeftHours(hours);
      setLeftMinutes(minutes);
      setLeftSeconds(seconds);
    }
  }, [displayLeftDuration, isEditingLeft]);
  
  useEffect(() => {
    if (!isEditingRight) {
      const { hours, minutes, seconds } = extractTimeComponents(displayRightDuration);
      setRightHours(hours);
      setRightMinutes(minutes);
      setRightSeconds(seconds);
    }
  }, [displayRightDuration, isEditingRight]);
  
  // Timer effect that updates display durations based on start times
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isTimerRunning && (leftStartTime || rightStartTime)) {
      interval = setInterval(() => {
        const now = Date.now();
        
        if (leftStartTime && activeBreast === 'LEFT') {
          const elapsedSeconds = Math.floor((now - leftStartTime) / 1000);
          const newDuration = leftBaseDuration + elapsedSeconds;
          setDisplayLeftDuration(newDuration);
        }
        
        if (rightStartTime && activeBreast === 'RIGHT') {
          const elapsedSeconds = Math.floor((now - rightStartTime) / 1000);
          const newDuration = rightBaseDuration + elapsedSeconds;
          setDisplayRightDuration(newDuration);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerRunning, leftStartTime, rightStartTime, activeBreast, leftBaseDuration, rightBaseDuration]);
  
  // Handle visibility change to recalculate elapsed time when returning to the app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTimerRunning) {
        const now = Date.now();
        
        if (leftStartTime && activeBreast === 'LEFT') {
          const elapsedSeconds = Math.floor((now - leftStartTime) / 1000);
          const newDuration = leftBaseDuration + elapsedSeconds;
          setDisplayLeftDuration(newDuration);
        }
        
        if (rightStartTime && activeBreast === 'RIGHT') {
          const elapsedSeconds = Math.floor((now - rightStartTime) / 1000);
          const newDuration = rightBaseDuration + elapsedSeconds;
          setDisplayRightDuration(newDuration);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTimerRunning, leftStartTime, rightStartTime, activeBreast, leftBaseDuration, rightBaseDuration]);
  
  // Handle saving edited duration
  const saveLeftDuration = () => {
    const totalSeconds = (leftHours * 3600) + (leftMinutes * 60) + leftSeconds;
    setDisplayLeftDuration(totalSeconds);
    onDurationChange('LEFT', totalSeconds);
    setIsEditingLeft(false);
  };
  
  const saveRightDuration = () => {
    const totalSeconds = (rightHours * 3600) + (rightMinutes * 60) + rightSeconds;
    setDisplayRightDuration(totalSeconds);
    onDurationChange('RIGHT', totalSeconds);
    setIsEditingRight(false);
  };
  
  // Handle timer start with timestamp tracking
  const handleTimerStart = (breast: 'LEFT' | 'RIGHT') => {
    const now = Date.now();
    
    if (breast === 'LEFT') {
      setLeftStartTime(now);
      setLeftBaseDuration(leftDuration); // Set base duration when starting
    } else {
      setRightStartTime(now);
      setRightBaseDuration(rightDuration); // Set base duration when starting
    }
    
    onTimerStart(breast);
  };
  
  // Handle timer stop
  const handleTimerStop = () => {
    // Calculate final durations before stopping
    const now = Date.now();
    
    if (leftStartTime && activeBreast === 'LEFT') {
      const elapsedSeconds = Math.floor((now - leftStartTime) / 1000);
      const finalDuration = leftBaseDuration + elapsedSeconds;
      setDisplayLeftDuration(finalDuration);
      onDurationChange('LEFT', finalDuration);
      setLeftStartTime(null);
    }
    
    if (rightStartTime && activeBreast === 'RIGHT') {
      const elapsedSeconds = Math.floor((now - rightStartTime) / 1000);
      const finalDuration = rightBaseDuration + elapsedSeconds;
      setDisplayRightDuration(finalDuration);
      onDurationChange('RIGHT', finalDuration);
      setRightStartTime(null);
    }
    
    onTimerStop();
  };
  
  


  // When editing, show only the relevant side
  if (isEditing) {
    return (
      <div className="feed-form-container">
        <Label className="form-label">Duration - {side === 'LEFT' ? 'Left' : 'Right'} Side</Label>
        <div className="flex flex-col items-center space-y-4 py-4">
          {side === 'LEFT' ? (
            <TimerInput
              hours={leftHours}
              minutes={leftMinutes}
              seconds={leftSeconds}
              onHoursChange={setLeftHours}
              onMinutesChange={setLeftMinutes}
              onSecondsChange={setLeftSeconds}
              onSave={saveLeftDuration}
              disabled={loading || isTimerRunning}
              fieldPrefix="left"
            />
          ) : (
            <TimerInput
              hours={rightHours}
              minutes={rightMinutes}
              seconds={rightSeconds}
              onHoursChange={setRightHours}
              onMinutesChange={setRightMinutes}
              onSecondsChange={setRightSeconds}
              onSave={saveRightDuration}
              disabled={loading || isTimerRunning}
              fieldPrefix="right"
            />
          )}
          <div className="flex justify-center">
            <Button 
              type="button" 
              variant={isTimerRunning && ((side === 'LEFT' && activeBreast === 'LEFT') || (side === 'RIGHT' && activeBreast === 'RIGHT')) ? 'default' : 'outline'}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (isTimerRunning && ((side === 'LEFT' && activeBreast === 'LEFT') || (side === 'RIGHT' && activeBreast === 'RIGHT'))) {
                  handleTimerStop();
                } else {
                  handleTimerStop(); // Stop any existing timer
                  setIsEditingLeft(false); // Exit edit mode if active
                  setIsEditingRight(false); // Exit edit mode if active
                  handleTimerStart(side as 'LEFT' | 'RIGHT');
                }
              }}
              disabled={loading || isEditingLeft || isEditingRight}
            >
              {isTimerRunning && ((side === 'LEFT' && activeBreast === 'LEFT') || (side === 'RIGHT' && activeBreast === 'RIGHT')) ? 
                <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {isTimerRunning && ((side === 'LEFT' && activeBreast === 'LEFT') || (side === 'RIGHT' && activeBreast === 'RIGHT')) ? 
                'Pause' : 'Start'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // When creating new entries, show both sides
  return (
    <div className="feed-form-container">
      <Label className="form-label">Duration</Label>
      <div className="flex justify-center gap-2 py-4">
        {/* Left Side */}
        <div className={`flex flex-col items-center space-y-4 p-1 flex-1 max-w-xs rounded-lg transition-all duration-300 ${
          isTimerRunning && activeBreast === 'LEFT' 
            ? 'bg-green-50 border-2 border-green-200 shadow-md timer-active-side' 
            : 'bg-transparent'
        }`}>
          <Label className="text-lg font-semibold text-gray-700 timer-label">Left Side</Label>
          <TimerInput
            hours={leftHours}
            minutes={leftMinutes}
            seconds={leftSeconds}
            onHoursChange={setLeftHours}
            onMinutesChange={setLeftMinutes}
            onSecondsChange={setLeftSeconds}
            onSave={saveLeftDuration}
            disabled={loading || isTimerRunning}
            fieldPrefix="left"
          />
          <div className="flex justify-center w-full">
            <Button 
              type="button" 
              variant={isTimerRunning && activeBreast === 'LEFT' ? 'default' : 'outline'}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (isTimerRunning && activeBreast === 'LEFT') {
                  handleTimerStop();
                } else {
                  handleTimerStop(); // Stop any existing timer
                  setIsEditingLeft(false); // Exit edit mode if active
                  handleTimerStart('LEFT');
                }
              }}
              disabled={loading || isEditingLeft}
              className="w-full"
            >
              {isTimerRunning && activeBreast === 'LEFT' ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {isTimerRunning && activeBreast === 'LEFT' ? 'Pause' : 'Start'}
            </Button>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="flex items-center justify-center">
          <div className="h-32 border-l border-gray-200"></div>
        </div>

        {/* Right Side */}
        <div className={`flex flex-col items-center space-y-4 flex-1 max-w-xs p-1 rounded-lg transition-all duration-300 ${
          isTimerRunning && activeBreast === 'RIGHT' 
            ? 'bg-green-50 border-2 border-green-200 shadow-md timer-active-side' 
            : 'bg-transparent'
        }`}>
          <Label className="text-lg font-semibold text-gray-700 timer-label">Right Side</Label>
          <TimerInput
            hours={rightHours}
            minutes={rightMinutes}
            seconds={rightSeconds}
            onHoursChange={setRightHours}
            onMinutesChange={setRightMinutes}
            onSecondsChange={setRightSeconds}
            onSave={saveRightDuration}
            disabled={loading || isTimerRunning}
            fieldPrefix="right"
          />
          <div className="flex justify-center w-full">
            <Button 
              type="button" 
              variant={isTimerRunning && activeBreast === 'RIGHT' ? 'default' : 'outline'}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                if (isTimerRunning && activeBreast === 'RIGHT') {
                  handleTimerStop();
                } else {
                  handleTimerStop(); // Stop any existing timer
                  setIsEditingRight(false); // Exit edit mode if active
                  handleTimerStart('RIGHT');
                }
              }}
              disabled={loading || isEditingRight}
              className="w-full"
            >
              {isTimerRunning && activeBreast === 'RIGHT' ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {isTimerRunning && activeBreast === 'RIGHT' ? 'Pause' : 'Start'}
            </Button>
          </div>
        </div>
      </div>
      {onNotesChange && (
        <div className="mt-6">
          <label className="form-label">Notes</label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Enter any notes about the feeding"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
