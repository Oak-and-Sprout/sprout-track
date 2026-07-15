'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/src/lib/utils';
import { TimeEntryProps } from './time-entry.types';
import { timeEntryStyles as styles } from './time-entry.styles';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';

import './time-entry.css';

// Letter-spacing (in em) of the header time display — must stay in sync with the
// Tailwind `tracking-wider` class on styles.timeDisplay (0.05em). The hour/minute
// inputs inherit it, so their width calc must include it per character or the
// content box is too narrow and the text overflows instead of centering.
const HEADER_TRACKING_EM = 0.05;

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
  const { t } = useLocalization();
  const { timeFormat } = useTimezone();
  const is24h = timeFormat === '24h';

  // Extract initial time values
  const getInitialValues = () => {
    // Ensure value is a valid Date object
    const date = value instanceof Date && !isNaN(value.getTime())
      ? value
      : new Date();

    const hours = date.getHours();
    const minutes = date.getMinutes();

    return {
      hours: is24h ? hours : (hours > 12 ? hours - 12 : hours === 0 ? 12 : hours),
      minutes,
      isPM: is24h ? false : hours >= 12,
      mode: 'hours' as 'hours' | 'minutes',
    };
  };
  
  const [state, setState] = useState(getInitialValues);
  // Raw text being typed into the hour/minute spinbutton inputs (null = not editing)
  const [hourInput, setHourInput] = useState<string | null>(null);
  const [minuteInput, setMinuteInput] = useState<string | null>(null);
  // True while focus is arriving via pointer (mouse/touch) — suppresses the
  // select-all that keyboard focus performs, so pointer users see no highlight flash
  const hourFocusFromPointerRef = useRef(false);
  const minuteFocusFromPointerRef = useRef(false);
  const clockFaceRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const accumulatedAngleRef = useRef<number | null>(null);
  const prevModeRef = useRef<'hours' | 'minutes'>(state.mode);
  
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

  // Build a Date from the given time parts (mirrors the Date-construction used
  // by all selection paths) and, if valid, propagate it via onChange
  const commitTime = (hours: number, minutes: number, isPM: boolean) => {
    const baseDate = value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
    const newHours24 = is24h
      ? hours
      : isPM
        ? (hours === 12 ? 12 : hours + 12)
        : (hours === 12 ? 0 : hours);
    baseDate.setHours(newHours24);
    baseDate.setMinutes(minutes);
    baseDate.setSeconds(0);
    baseDate.setMilliseconds(0);

    if (isTimeValid(baseDate)) {
      onChange(baseDate);
    }
  };
  
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
        hours: is24h ? hours : (hours > 12 ? hours - 12 : hours === 0 ? 12 : hours),
        minutes,
        isPM: is24h ? false : hours >= 12,
        mode: prevState.mode, // Preserve the current mode
      };
    });
   }, [value, is24h]);
   
   // Set up dragging functionality
   useEffect(() => {
    if (disabled || !clockFaceRef.current || !handRef.current) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Only start dragging if the click is on the hand
      if (e.target === handRef.current || 
          (handRef.current && e.target instanceof Node && handRef.current.contains(e.target as Node))) {
        e.preventDefault();
        // preventDefault suppresses the blur that would resync the header
        // inputs, so discard any in-progress typed text before dragging
        setHourInput(null);
        setMinuteInput(null);
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
        if (is24h) {
          // 24h mode: determine inner/outer ring by distance from center
          const dist = Math.sqrt(x * x + y * y);
          const ringThreshold = Math.min(rect.width, rect.height) / 2 * 0.65;
          let hour = Math.round(angle / 30);
          if (hour === 0 || hour > 12) hour = 12;

          if (dist <= ringThreshold) {
            // Inner ring: 13-23, 0
            hour = hour === 12 ? 0 : hour + 12;
          }

          setState(prev => ({ ...prev, hours: hour }));
          baseDate.setHours(hour);
          baseDate.setMinutes(state.minutes);
        } else {
          // 12h mode: original logic
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
            const crossed12Line = (
              (prevHourNormalized === 11 && hour === 12) ||
              (prevHourNormalized === 1 && hour === 12) ||
              (prevHourNormalized === 12 && hour === 11) ||
              (prevHourNormalized === 12 && hour === 1)
            );

            if (crossed12Line) {
              if (normalizedDiff > 0) {
                if (!state.isPM) shouldFlipAmPm = true;
              } else if (normalizedDiff < 0) {
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
        }
      } else {
        // Convert angle to minute (each minute is 6 degrees)
        const minute = Math.round(angle / 6) % 60;
        
        setState(prev => ({ ...prev, minutes: minute }));
        setExactMinute(minute);
        
        const newHours24 = is24h
          ? state.hours
          : state.isPM
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
   }, [disabled, state.mode, state.isPM, state.hours, state.minutes, onChange, isTimeValid, value, is24h]);
   
   // Handle hour selection
   const handleHourSelect = (hour: number) => {
     if (disabled) return;

     const newState = {
       ...state,
       hours: hour,
       // Automatically switch to minutes mode after hour selection
       mode: 'minutes' as 'hours' | 'minutes',
     };

     // Update state, then commit the date calculated from the *intended* state
     setState(newState);
     commitTime(newState.hours, newState.minutes, newState.isPM);
   };

   // Handle minute selection
   const handleMinuteSelect = (minute: number) => {
     if (disabled) return;

     const newState = {
       ...state,
       minutes: minute,
       mode: 'minutes' as 'hours' | 'minutes', // Explicitly keep in minutes mode
     };

     setState(newState);
     commitTime(newState.hours, newState.minutes, newState.isPM);
   };

   // Handle AM/PM toggle
   const handlePeriodToggle = (isPM: boolean) => {
     if (disabled) return;

     const newState = {
       ...state,
       isPM: isPM,
     };

     setState(newState);
     commitTime(newState.hours, newState.minutes, newState.isPM);
   };

   // ----- Keyboard (spinbutton) fallback for the hour/minute header inputs -----

   const hourMin = is24h ? 0 : 1;
   const hourMax = is24h ? 23 : 12;

   // Step the hour up/down, wrapping at the bounds
   const stepHours = (delta: number) => {
     if (disabled) return;
     const range = hourMax - hourMin + 1;
     const next = ((state.hours - hourMin + delta + range) % range) + hourMin;
     setHourInput(null);
     setState(prev => ({ ...prev, hours: next }));
     commitTime(next, state.minutes, state.isPM);
   };

   // Step the minutes up/down, wrapping at the bounds
   const stepMinutes = (delta: number) => {
     if (disabled) return;
     const next = (state.minutes + delta + 60) % 60;
     setMinuteInput(null);
     setState(prev => ({ ...prev, minutes: next }));
     commitTime(state.hours, next, state.isPM);
   };

   // Set an exact hour typed into the input, clamped to the valid range.
   // The displayed text is normalized to the committed value on every keystroke
   // so display, state, and aria-valuenow never diverge (a briefly cleared
   // field stays empty and commits nothing until a digit is typed or blur).
   const setTypedHours = (raw: string) => {
     const digits = raw.replace(/\D/g, '').slice(0, 2);
     if (digits === '') {
       setHourInput('');
       return;
     }
     const clamped = Math.min(Math.max(parseInt(digits, 10), hourMin), hourMax);
     setHourInput(clamped.toString());
     setState(prev => ({ ...prev, hours: clamped }));
     commitTime(clamped, state.minutes, state.isPM);
   };

   // Set an exact minute typed into the input, clamped to the valid range.
   // Displayed text is normalized to the committed value (see setTypedHours).
   const setTypedMinutes = (raw: string) => {
     const digits = raw.replace(/\D/g, '').slice(0, 2);
     if (digits === '') {
       setMinuteInput('');
       return;
     }
     const clamped = Math.min(Math.max(parseInt(digits, 10), 0), 59);
     setMinuteInput(clamped.toString());
     setState(prev => ({ ...prev, minutes: clamped }));
     commitTime(state.hours, clamped, state.isPM);
   };

   const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'ArrowUp') { e.preventDefault(); stepHours(1); }
     else if (e.key === 'ArrowDown') { e.preventDefault(); stepHours(-1); }
     else if (e.key === 'Home') { e.preventDefault(); stepHours(hourMin - state.hours); }
     else if (e.key === 'End') { e.preventDefault(); stepHours(hourMax - state.hours); }
   };

   const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'ArrowUp') { e.preventDefault(); stepMinutes(1); }
     else if (e.key === 'ArrowDown') { e.preventDefault(); stepMinutes(-1); }
     else if (e.key === 'Home') { e.preventDefault(); stepMinutes(-state.minutes); }
     else if (e.key === 'End') { e.preventDefault(); stepMinutes(59 - state.minutes); }
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

       if (is24h) {
         // Determine inner/outer ring by distance from center
         const dist = Math.sqrt(x * x + y * y);
         const ringThreshold = Math.min(rect.width, rect.height) / 2 * 0.65;
         if (dist <= ringThreshold) {
           hour = hour === 12 ? 0 : hour + 12;
         }
         newState = { ...state, hours: hour, mode: 'minutes' };
         newHours24 = hour;
       } else {
         newState = { ...state, hours: hour, mode: 'minutes' };
         newHours24 = newState.isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
       }
       baseDate.setHours(newHours24);
       baseDate.setMinutes(newState.minutes);
     } else {
       const minute = Math.round(angle / 6) % 60;
       newState = { ...state, minutes: minute, mode: 'minutes' };
       newHours24 = is24h
         ? newState.hours
         : newState.isPM
           ? (newState.hours === 12 ? 12 : newState.hours + 12)
           : (newState.hours === 12 ? 0 : newState.hours);
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
 
   // Calculate hand angle for CSS rotation, using accumulated rotation to avoid
   // jumps at the 0°/360° boundary (e.g., hour 5→6, minute 29→30).
   // Instead of snapping to an absolute 0-360 angle, we track the total rotation
   // and always take the shortest path (±180°) so CSS transitions animate smoothly.
   const getHandAngle = () => {
     let targetAngle: number;
     if (state.mode === 'hours') {
       const hour = state.hours % 12;
       targetAngle = ((hour * 30) + 180) % 360;
     } else {
       targetAngle = (state.minutes * 6 + 180) % 360;
     }

     // Reset accumulated angle on mode switch so the hand jumps directly
     // to the new position rather than spinning across modes
     if (prevModeRef.current !== state.mode) {
       prevModeRef.current = state.mode;
       accumulatedAngleRef.current = targetAngle;
       return targetAngle;
     }

     if (accumulatedAngleRef.current === null) {
       accumulatedAngleRef.current = targetAngle;
       return targetAngle;
     }

     // Calculate shortest angular delta to avoid the long way around
     const currentNormalized = ((accumulatedAngleRef.current % 360) + 360) % 360;
     let delta = targetAngle - currentNormalized;
     if (delta > 180) delta -= 360;
     if (delta < -180) delta += 360;

     accumulatedAngleRef.current += delta;
     return accumulatedAngleRef.current;
   };
  
  // Calculate hand length - shorter for inner ring in 24h mode
  const getHandLength = () => {
    if (is24h && state.mode === 'hours') {
      const isInnerRing = state.hours === 0 || state.hours > 12;
      return isInnerRing ? 50 : 80;
    }
    return 80;
  };

  // Get the selection circle radius (matches hand length positioning)
  const getSelectionRadius = () => {
    if (is24h && state.mode === 'hours') {
      const isInnerRing = state.hours === 0 || state.hours > 12;
      return isInnerRing ? 65 : 100;
    }
    return 100;
  };
  
  // Generate clock markers based on mode (hours or minutes)
  const renderClockMarkers = () => {
    if (state.mode === 'hours') {
      // Generate outer ring hour markers (1-12)
      const outerHours = Array.from({ length: 12 }, (_, i) => i + 1);
      const markers = outerHours.map(hour => {
        const angle = ((hour % 12) * 30) - 90;
        const radius = 100;
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

      // In 24h mode, add inner ring (13-23 and 0)
      if (is24h) {
        const innerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
        innerHours.forEach(hour => {
          // 0 goes at 12-o'clock position, 13 at 1-o'clock, etc.
          const clockPos = hour === 0 ? 0 : hour - 12;
          const angle = ((clockPos % 12) * 30) - 90;
          const radius = 65;
          const x = Math.cos(angle * (Math.PI / 180)) * radius;
          const y = Math.sin(angle * (Math.PI / 180)) * radius;

          markers.push(
            <div
              key={`inner-${hour}`}
              className={cn(
                styles.hourMarkerInner,
                'time-entry-hour-marker-inner'
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
      }

      return markers;
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
  
  // Text shown in the header inputs: raw text while typing, formatted value otherwise
  const hourDisplay = hourInput !== null
    ? hourInput
    : (is24h ? state.hours.toString().padStart(2, '0') : state.hours.toString());
  const minuteDisplay = minuteInput !== null
    ? minuteInput
    : state.minutes.toString().padStart(2, '0');

  // Width of each header input: per-character advance is 1ch plus the inherited
  // tracking-wider letter-spacing (HEADER_TRACKING_EM), plus px-1 padding (0.5rem).
  // While a typed override is active, length is clamped to a minimum of 2 so a briefly
  // cleared field doesn't reflow the header; steady state matches the old span width.
  const hourLen = hourInput !== null ? Math.max(hourDisplay.length, 2) : hourDisplay.length;
  const minuteLen = minuteInput !== null ? Math.max(minuteDisplay.length, 2) : minuteDisplay.length;
  const hourWidth = `calc(${hourLen}ch + ${hourLen * HEADER_TRACKING_EM}em + 0.5rem)`;
  const minuteWidth = `calc(${minuteLen}ch + ${minuteLen * HEADER_TRACKING_EM}em + 0.5rem)`;

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
          {/* Hour spinbutton (keyboard-accessible fallback for the dial) */}
          <input
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-label={t('Hours')}
            aria-valuemin={hourMin}
            aria-valuemax={hourMax}
            aria-valuenow={state.hours}
            disabled={disabled}
            className={cn(
              "cursor-pointer px-1 rounded text-center caret-white",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              state.mode === 'hours' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/10"
            )}
            style={{ width: hourWidth }}
            value={hourDisplay}
            onChange={(e) => setTypedHours(e.target.value)}
            onKeyDown={handleHourKeyDown}
            onPointerDown={() => { hourFocusFromPointerRef.current = true; }}
            onFocus={(e) => {
              setState(prev => ({ ...prev, mode: 'hours' }));
              // Select-all only for keyboard focus — pointer users never saw
              // a highlight flash on the original spans
              if (!hourFocusFromPointerRef.current) e.target.select();
            }}
            onBlur={() => {
              setHourInput(null);
              hourFocusFromPointerRef.current = false;
            }}
          />
          :
          {/* Minute spinbutton (keyboard-accessible fallback for the dial) */}
          <input
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-label={t('Minutes')}
            aria-valuemin={0}
            aria-valuemax={59}
            aria-valuenow={state.minutes}
            disabled={disabled}
            className={cn(
              "cursor-pointer px-1 rounded text-center caret-white",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
              state.mode === 'minutes' ? "bg-white/20 font-semibold" : "bg-transparent hover:bg-white/10"
            )}
            style={{ width: minuteWidth }}
            value={minuteDisplay}
            onChange={(e) => setTypedMinutes(e.target.value)}
            onKeyDown={handleMinuteKeyDown}
            onPointerDown={() => { minuteFocusFromPointerRef.current = true; }}
            onFocus={(e) => {
              setState(prev => ({ ...prev, mode: 'minutes' }));
              // Select-all only for keyboard focus (see hour input)
              if (!minuteFocusFromPointerRef.current) e.target.select();
            }}
            onBlur={() => {
              setMinuteInput(null);
              minuteFocusFromPointerRef.current = false;
            }}
          />
        </div>
        {!is24h && (
          <div className={cn(styles.amPmDisplay, 'time-entry-ampm-display')}>
            <button
              type="button"
              aria-pressed={!state.isPM}
              disabled={disabled}
              className={cn(
                styles.amPmButton,
                !state.isPM && styles.amPmButtonSelected,
                'time-entry-ampm-button text-left',
                !state.isPM && 'time-entry-ampm-button-selected'
              )}
              onClick={() => handlePeriodToggle(false)}
            >
              {t('AM')}
            </button>
            <button
              type="button"
              aria-pressed={state.isPM}
              disabled={disabled}
              className={cn(
                styles.amPmButton,
                state.isPM && styles.amPmButtonSelected,
                'time-entry-ampm-button text-left',
                state.isPM && 'time-entry-ampm-button-selected'
              )}
              onClick={() => handlePeriodToggle(true)}
            >
              {t('PM')}
            </button>
          </div>
        )}
      </div>
      
      {/* Clock face — pointer-only; hidden from assistive tech (the header
          spinbutton inputs are the non-visual path for setting the time) */}
      <div aria-hidden="true" className={cn(styles.clockContainer, 'time-entry-clock-container')}>
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
               // preventDefault suppresses the blur that would resync the
               // header inputs, so discard any in-progress typed text
               setHourInput(null);
               setMinuteInput(null);
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
                 left: `calc(50% + ${Math.cos((getHandAngle() - 270) * (Math.PI / 180)) * getSelectionRadius()}px)`,
                 top: `calc(50% + ${Math.sin((getHandAngle() - 270) * (Math.PI / 180)) * getSelectionRadius()}px)`,
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
               {state.mode === 'hours'
                 ? (is24h ? state.hours.toString().padStart(2, '0') : state.hours)
                 : exactMinute !== null ? exactMinute : state.minutes}
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
