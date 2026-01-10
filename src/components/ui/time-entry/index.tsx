'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { TimeEntryProps } from './time-entry.types';
import { timeEntryStyles as styles } from './time-entry.styles';import { useLocalization } from '@/src/context/localization';

import './time-entry.css';

/**
 * TimeEntry Component
 * 
 * A clock wheel interface for time selection with an intuitive UI.
 * 
 * @param value - The currently selected time
 * @param onChange - Callback function when time changes
 * @param className - Optional class name for additional styling
 * @param disabled - Whether the component is disabled
 * @param minTime - Optional minimum time allowed
 * @param maxTime - Optional maximum time allowed
 */
export function TimeEntry({
  value,
  onChange,
  className,
  disabled = false,
  minTime,
  maxTime,
}: TimeEntryProps) {
  // Extract initial time values
  const getInitialValues = () => {
    // Ensure value is a valid Date object
    const date = value instanceof Date && !isNaN(value.getTime()) 
      ? value 
      : new Date();
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    return {
      hours: hours > 12 ? hours - 12 : hours === 0 ? 12 : hours,
      minutes,
      isPM: hours >= 12,
      mode: 'hours' as 'hours' | 'minutes',
    };
  };
  
  const [state, setState] = useState(getInitialValues);
  const clockFaceRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [exactMinute, setExactMinute] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const [previousAngle, setPreviousAngle] = useState<number | null>(null);
  
  // Check if a time is valid based on min/max constraints
  const isTimeValid = useCallback((date: Date): boolean => {
    if (minTime && date < minTime) return false;
    if (maxTime && date > maxTime) return false;
    return true;
  }, [minTime, maxTime]);
  
  // Update state when value prop changes, but preserve the current mode
  useEffect(() => {
    if (!value) return;
    
    setState(prevState => {
      const date = value instanceof Date && !isNaN(value.getTime()) 
        ? value 
        : new Date();
      
      const hours = date.getHours();
      const minutes = date.getMinutes();
      
      return {
        hours: hours > 12 ? hours - 12 : hours === 0 ? 12 : hours,
        minutes,
        isPM: hours >= 12,
        mode: prevState.mode, // Preserve the current mode
      };
    });
   }, [value]);
   
   // Set up dragging functionality
   useEffect(() => {
    if (disabled || !clockFaceRef.current || !handRef.current) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Only start dragging if the click is on the hand
      if (e.target === handRef.current || 
          (handRef.current && e.target instanceof Node && handRef.current.contains(e.target as Node))) {
        e.preventDefault();
        setIsDragging(true);
        isDraggingRef.current = true;
        // Initialize previous angle with current angle when starting to drag
        setPreviousAngle(null);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !clockFaceRef.current) return;
      
      const rect = clockFaceRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = e.clientX - centerX;
      const y = e.clientY - centerY;
      
      // Calculate angle from center to mouse position
      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      
      // Store the angle for next comparison
      if (previousAngle === null) {
        setPreviousAngle(angle);
      }
      
      const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
      
      if (state.mode === 'hours') {
        // Convert angle to hour (each hour is 30 degrees)
        let hour = Math.round(angle / 30);
        if (hour === 0 || hour > 12) hour = 12;

        // Detect crossing 12 o'clock and auto-flip AM/PM
        let shouldFlipAmPm = false;

        if (previousAngle !== null) {
          const prevHour = Math.round(previousAngle / 30);
          const prevHourNormalized = prevHour === 0 || prevHour > 12 ? 12 : prevHour;

          // Calculate angle difference with proper wraparound handling
          const angleDiff = angle - previousAngle;
          let normalizedDiff = angleDiff;

          // Handle angle wraparound (crossing 0/360 degrees)
          if (normalizedDiff > 180) normalizedDiff -= 360;
          if (normalizedDiff < -180) normalizedDiff += 360;

          // Check if we crossed the 12 o'clock line (0 degrees)
          // This happens when we cross from 11-12 or 12-1 zones
          const crossed12Line = (
            // Going from 11 to 12 (clockwise)
            (prevHourNormalized === 11 && hour === 12) ||
            // Going from 1 to 12 (counter-clockwise)
            (prevHourNormalized === 1 && hour === 12) ||
            // Going from 12 to 11 (counter-clockwise)
            (prevHourNormalized === 12 && hour === 11) ||
            // Going from 12 to 1 (clockwise)
            (prevHourNormalized === 12 && hour === 1)
          );

          if (crossed12Line) {
            // Determine if we should flip based on direction and current AM/PM
            if (normalizedDiff > 0) {
              // Clockwise movement: if AM, switch to PM
              if (!state.isPM) shouldFlipAmPm = true;
            } else if (normalizedDiff < 0) {
              // Counter-clockwise movement: if PM, switch to AM
              if (state.isPM) shouldFlipAmPm = true;
            }
          }
        }

        const newIsPM = shouldFlipAmPm ? !state.isPM : state.isPM;

        setState(prev => ({
          ...prev,
          hours: hour,
          isPM: newIsPM
        }));

        const newHours24 = newIsPM
          ? (hour === 12 ? 12 : hour + 12)
          : (hour === 12 ? 0 : hour);
        baseDate.setHours(newHours24);
        baseDate.setMinutes(state.minutes);
      } else {
        // Convert angle to minute (each minute is 6 degrees)
        const minute = Math.round(angle / 6) % 60;
        
        setState(prev => ({ ...prev, minutes: minute }));
        setExactMinute(minute);
        
        const newHours24 = state.isPM
          ? (state.hours === 12 ? 12 : state.hours + 12)
          : (state.hours === 12 ? 0 : state.hours);
        baseDate.setHours(newHours24);
        baseDate.setMinutes(minute);
      }
      
      baseDate.setSeconds(0);
      baseDate.setMilliseconds(0);

      if (isTimeValid(baseDate)) {
        onChange(baseDate);
      }

      // Store current angle for next comparison
      setPreviousAngle(angle);
    };
    
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        setIsDragging(false);
        isDraggingRef.current = false;

        // Reset previous angle when done dragging
        setPreviousAngle(null);

        // Automatically switch to minutes mode after finishing drag in hours mode
        if (state.mode === 'hours') {
          setState(prev => ({ ...prev, mode: 'minutes' }));
        }

        // Clear exact minute after a short delay to allow the UI to update
        setTimeout(() => {
          setExactMinute(null);
        }, 1000);
      }
    };
    
    // Simple touch start handler - minimal interference
    const handleTouchStart = (e: TouchEvent) => {
      // Only prevent default on the clock face itself to prevent pull-to-refresh
      // Don't interfere with draggable elements
      if (e.target === clockFaceRef.current && !isDraggingRef.current) {
        e.preventDefault();
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // Only prevent default during active dragging to avoid browser refresh
        if (isDraggingRef.current) {
          e.preventDefault();
        }
        
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        handleMouseMove(mouseEvent);
      }
    };
    
    const handleTouchEnd = () => {
      handleMouseUp();
    };
    
    // Add mouse and touch event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Touch events with passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
   }, [disabled, state.mode, state.isPM, state.hours, state.minutes, onChange, isTimeValid, value]);
   
   // Handle hour selection
   const handleHourSelect = (hour: number) => {
     if (disabled) return;
 
     const newState = {
       ...state,
       hours: hour,
       // Automatically switch to minutes mode after hour selection
       mode: 'minutes' as 'hours' | 'minutes',
     };
 
     // Calculate new date based on the *intended* state
     const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
     const newHours24 = newState.isPM
       ? (newState.hours === 12 ? 12 : newState.hours + 12)
       : (newState.hours === 12 ? 0 : newState.hours);
     baseDate.setHours(newHours24);
     baseDate.setMinutes(newState.minutes); // Use existing minutes from newState
     baseDate.setSeconds(0);
     baseDate.setMilliseconds(0);
 
     // Update state *after* calculating the date
     setState(newState);
 
     if (isTimeValid(baseDate)) {
       onChange(baseDate);
     }
   };
 
   // Handle minute selection
   const handleMinuteSelect = (minute: number) => {
     if (disabled) return;
 
     const newState = {
       ...state,
       minutes: minute,
       mode: 'minutes' as 'hours' | 'minutes', // Explicitly keep in minutes mode
     };
 
     // Calculate new date based on the *intended* state
     const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
     const newHours24 = newState.isPM
       ? (newState.hours === 12 ? 12 : newState.hours + 12)
       : (newState.hours === 12 ? 0 : newState.hours); // Use existing hours from newState
     baseDate.setHours(newHours24);
     baseDate.setMinutes(newState.minutes);
     baseDate.setSeconds(0);
     baseDate.setMilliseconds(0);
 
     // Update state *after* calculating the date
     setState(newState);
 
     if (isTimeValid(baseDate)) {
       onChange(baseDate);
     }
   };
 
   // Handle AM/PM toggle
   const handlePeriodToggle = (isPM: boolean) => {
     if (disabled) return;
 
     const newState = {
       ...state,
       isPM: isPM,
     };
 
     // Calculate new date based on the *intended* state
     const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
     const newHours24 = newState.isPM
       ? (newState.hours === 12 ? 12 : newState.hours + 12)
       : (newState.hours === 12 ? 0 : newState.hours);
     baseDate.setHours(newHours24);
     baseDate.setMinutes(newState.minutes); // Use existing minutes from newState
     baseDate.setSeconds(0);
     baseDate.setMilliseconds(0);
 
     // Update state *after* calculating the date
     setState(newState);
 
     if (isTimeValid(baseDate)) {
       onChange(baseDate);
     }
   };
 
   // Handle click on the clock face
   const handleClockClick = (e: React.MouseEvent<HTMLDivElement>) => {
     if (disabled || !clockFaceRef.current) return;
 
     const rect = clockFaceRef.current.getBoundingClientRect();
     const centerX = rect.left + rect.width / 2;
     const centerY = rect.top + rect.height / 2;
     const x = e.clientX - centerX;
     const y = e.clientY - centerY;
     let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
     if (angle < 0) angle += 360;
 
     const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
     let newState = { ...state };
     let newHours24 = 0;
 
     if (state.mode === 'hours') {
       let hour = Math.round(angle / 30);
       if (hour === 0 || hour > 12) hour = 12;
       // Automatically switch to minutes mode after hour selection
       newState = { ...state, hours: hour, mode: 'minutes' };
       newHours24 = newState.isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
       baseDate.setHours(newHours24);
       baseDate.setMinutes(newState.minutes); // Use existing minutes from newState
     } else {
       const minute = Math.round(angle / 6) % 60;
       // Keep the mode as 'minutes' when in minute mode
       newState = { ...state, minutes: minute, mode: 'minutes' };
       newHours24 = newState.isPM ? (newState.hours === 12 ? 12 : newState.hours + 12) : (newState.hours === 12 ? 0 : newState.hours); // Use existing hours from newState
       baseDate.setHours(newHours24);
       baseDate.setMinutes(minute);
     }
 
     baseDate.setSeconds(0);
     baseDate.setMilliseconds(0);
 
     // Update state *after* calculating the date
     setState(newState);
 
     if (isTimeValid(baseDate)) {
       onChange(baseDate); // Call onChange with the calculated date
     }
   };
 
   // Calculate hand angle for CSS rotation (0deg points up, 90deg points right)
   const getHandAngle = () => {
     if (state.mode === 'hours') {
       // For hours: each hour is 30 degrees (360/12)
       // Convert hours to 0-11 range
       const hour = state.hours % 12;
       
       // Calculate hour angle with minute precision for smoother movement
       // Formula adapted from standard clock drawing: (hour * 30) + (minutes / 2)
       // This makes the hour hand gradually move between hour marks based on the minute value
       // Add 180 degrees to correct the orientation (hand was pointing opposite)
       const hourAngle = ((hour * 30) + 180) % 360;
       
       return hourAngle;
     } else {
       // For minutes: each minute is 6 degrees (360/60)
       // Add 180 degrees to correct the orientation (hand was pointing opposite)
       const minuteAngle = (state.minutes * 6 + 180) % 360;
       
       return minuteAngle;
     }
   };
  
  // Calculate hand length - make both hands the same length
  const getHandLength = () => {
    return 80; // Same length for both hour and minute hands
  };
  
  // Generate clock markers based on mode (hours or minutes)
  const renderClockMarkers = () => {
    if (state.mode === 'hours') {
      // Generate hour markers (1-12)
      const hours = Array.from({ length: 12 }, (_, i) => i + 1);
      return hours.map(hour => {
        const angle = ((hour % 12) * 30) - 90;
        // Calculate position on the clock face
        const radius = 100; // Distance from center (in pixels)
        const x = Math.cos(angle * (Math.PI / 180)) * radius;
        const y = Math.sin(angle * (Math.PI / 180)) * radius;
        
        return (
          <div
            key={hour}
            className={cn(
              styles.hourMarker,
              'time-entry-hour-marker'
            )}
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            onClick={(e) => { e.stopPropagation(); handleHourSelect(hour); }}
          >
            {hour}
          </div>
        );
      });
    } else {
      // Generate minute markers (in 5-minute increments)
      const minuteMarkers = [];
      
      // Add major markers (0, 5, 10, ..., 55)
      for (let i = 0; i < 12; i++) {
        const minute = i * 5;
        const angle = (minute * 6) - 90; // 6 degrees per minute
        
        // Calculate position on the clock face
        const radius = 100; // Distance from center (in pixels)
        const x = Math.cos(angle * (Math.PI / 180)) * radius;
        const y = Math.sin(angle * (Math.PI / 180)) * radius;
        
        minuteMarkers.push(
          <div
            key={minute}
            className={cn(
              styles.minuteMarker,
              'time-entry-minute-marker',
              state.minutes === minute && styles.minuteMarkerSelected,
              state.minutes === minute && 'time-entry-minute-marker-selected'
            )}
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            onClick={(e) => { e.stopPropagation(); handleMinuteSelect(minute); }}
          >
            {/* Display '00' for the 0 minute marker */}
            {minute === 0 ? '00' : minute} 
          </div>
        );
      }
      
      // Removed minor tick markers as per requirement
      
      return minuteMarkers;
    }
  };
  
  return (
    <div 
      className={cn(
        styles.container,
        'time-entry-container',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Time display header */}
      <div className={cn(styles.header, 'time-entry-header')}>
        <div className={cn(styles.timeDisplay, 'time-entry-time-display')}>
          {/* Clickable Hour */}
          <span 
            className={cn(
              "cursor-pointer px-1 rounded", 
              state.mode === 'hours' ? "bg-white/20 font-semibold" : "hover:bg-white/10"
            )}
            onClick={() => setState(prev => ({ ...prev, mode: 'hours' }))}
          >
            {state.hours}
          </span>
          :
          {/* Clickable Minute */}
          <span 
            className={cn(
              "cursor-pointer px-1 rounded", 
              state.mode === 'minutes' ? "bg-white/20 font-semibold" : "hover:bg-white/10"
            )}
            onClick={() => setState(prev => ({ ...prev, mode: 'minutes' }))}
          >
            {state.minutes.toString().padStart(2, '0')}
          </span>
        </div>
        <div className={cn(styles.amPmDisplay, 'time-entry-ampm-display')}>
          <div 
            className={cn(
              styles.amPmButton, 
              !state.isPM && styles.amPmButtonSelected,
              'time-entry-ampm-button',
              !state.isPM && 'time-entry-ampm-button-selected'
            )}
            onClick={() => handlePeriodToggle(false)}
          >
            {t('AM')}
          </div>
          <div 
            className={cn(
              styles.amPmButton, 
              state.isPM && styles.amPmButtonSelected,
              'time-entry-ampm-button',
              state.isPM && 'time-entry-ampm-button-selected'
            )}
            onClick={() => handlePeriodToggle(true)}
          >
            {t('PM')}
          </div>
        </div>
      </div>
      
      {/* Clock face */}
      <div className={cn(styles.clockContainer, 'time-entry-clock-container')}>
        <div 
          ref={clockFaceRef}
          className={cn(styles.clockFace, 'time-entry-clock-face')}
          onClick={handleClockClick}
          onTouchStart={(e) => {
            // Only prevent default for non-interactive parts to avoid pull-to-refresh
            const isInteractiveElement = e.target !== clockFaceRef.current;
            if (!isInteractiveElement) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // Only prevent default during active dragging
            if (isDragging) {
              e.preventDefault();
            }
          }}
        >
          {/* Clock markers (hours or minutes) */}
          {renderClockMarkers()}
          
          {/* Clock hand */}
          <div 
             ref={handRef}
             className={cn(
               styles.clockHand, 
               'time-entry-clock-hand',
               isDragging && 'cursor-grabbing'
             )}
             style={{
               height: `${getHandLength()}px`, // Dynamic height based on mode
               transform: `translateX(-50%) rotate(${getHandAngle()}deg)`, // Use corrected angle calculation
               transformOrigin: 'top center', // Rotate around the bottom center
               position: 'absolute',
               bottom: '50%', // Position bottom edge at vertical center
               left: '50%', // Position left edge at horizontal center
               width: '4px', // Make hand slightly thicker for visibility
               cursor: 'grab',
               // Use the background color defined in styles directly if possible, else fallback
               backgroundColor: styles.clockHand.includes('bg-teal-600') ? '#0d9488' : '#14b8a6', // Updated to teal colors
               zIndex: 20, // Ensure hand is above other elements,
               // Use a very short transition during dragging for smoothness while preventing unwanted rotation
               transition: isDragging ? 'transform 0.05s linear' : 'transform 0.2s ease'
             }}
             onMouseDown={(e) => {
               e.preventDefault();
               e.stopPropagation();
               setIsDragging(true);
               isDraggingRef.current = true;
               setPreviousAngle(null);
             }}
             onTouchStart={() => {
               // Don't prevent default here - let the global handler manage it
               setIsDragging(true);
               isDraggingRef.current = true;
               setPreviousAngle(null);
             }}
           />
           
           {/* Selection circle at the same level as numbers */}
           {(
             <div
               className={cn(
                 'time-entry-selection-circle',
                 isDragging && 'scale-110'
               )}
               style={{
                 position: 'absolute',
                 width: '36px',
                 height: '36px',
                 borderRadius: '50%',
                 backgroundColor: styles.clockHand.includes('bg-teal-600') ? '#0d9488' : '#14b8a6',
                 color: 'white',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 fontWeight: 'bold',
                 // Position the selection bubble at the same distance from center as clock numbers
                 // and follow the same positioning logic as the clock hand
                 left: `calc(50% + ${Math.cos((getHandAngle() - 270) * (Math.PI / 180)) * 100}px)`,
                 top: `calc(50% + ${Math.sin((getHandAngle() - 270) * (Math.PI / 180)) * 100}px)`,
                 transform: 'translate(-50%, -50%)',
                 zIndex: 25,
                 boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                 // Use a very short transition during dragging for smoothness while preventing unwanted rotation
                 transition: isDragging ? 'all 0.05s linear' : 'all 0.2s ease',
                 cursor: 'grab',
               }}
               onMouseDown={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 setIsDragging(true);
                 isDraggingRef.current = true;
                 setPreviousAngle(null);
               }}
               onTouchStart={() => {
                 // Don't prevent default here - let the global handler manage it
                 setIsDragging(true);
                 isDraggingRef.current = true;
                 setPreviousAngle(null);
               }}
             >
               {state.mode === 'hours' ? state.hours : exactMinute !== null ? exactMinute : state.minutes}
             </div>
           )}
          
          {/* Center dot */}
          <div className={cn(styles.clockCenter, 'time-entry-clock-center')} />
        </div>
      </div>
      
      {/* No footer buttons as requested */}
    </div>
  );
}

export default TimeEntry;
