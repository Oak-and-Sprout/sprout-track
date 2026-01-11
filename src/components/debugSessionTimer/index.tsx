'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Position, DebugSessionTimerProps } from './debug-session-timer.types';
import { useLocalization } from '@/src/context/localization';

import {
  debugTimerContainer,
  debugTimerHeader,
  debugTimerCloseButton,
  debugTimerContent,
  debugTimerRow,
  debugTimerLabel,
  debugTimerValue
} from './debug-session-timer.styles';

/**
 * DebugSessionTimer Component
 * 
 * A draggable debug timer that displays JWT token expiration and user idle time.
 * This component is only visible in development mode and helps developers
 * monitor authentication state and user activity.
 * 
 * @example
 * ```tsx
 * <DebugSessionTimer />
 * ```
 */
const DebugSessionTimer: React.FC<DebugSessionTimerProps> = () => {
  const { t } = useLocalization();
  
  // State for visibility and settings
  const [isVisible, setIsVisible] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // State for token expiration and idle time
  const [tokenExpiration, setTokenExpiration] = useState<Date | null>(null);
  const [idleTime, setIdleTime] = useState(0);
  const [authLifeSeconds, setAuthLifeSeconds] = useState<number | null>(null);
  const [idleTimeSeconds, setIdleTimeSeconds] = useState<number | null>(null);
  
  // Refs
  const timerRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const positionRef = useRef<Position>({ x: 20, y: 20 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });

  /**
   * Formats the time remaining until token expiration
   * 
   * @param date - The expiration date of the token
   * @returns A formatted string in HH:MM:SS format
   */
  const formatTimeRemaining = (date: Date | null): string => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Formats the idle time
   * 
   * @param seconds - The number of seconds of idle time
   * @returns A formatted string in MM:SS format
   */
  const formatIdleTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * Extracts the token expiration date from the JWT token in localStorage
   * 
   * @returns The expiration date or null if not found
   */
  const getTokenExpiration = (): Date | null => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      
      // JWT tokens are in format: header.payload.signature
      // We need the payload part (index 1)
      const payload = token.split('.')[1];
      // The payload is base64 encoded, so we need to decode it
      const decodedPayload = JSON.parse(atob(payload));
      
      // exp is in seconds since epoch
      if (decodedPayload.exp) {
        return new Date(decodedPayload.exp * 1000);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return null;
    }
  };

  /**
   * Resets the idle time counter
   */
  const resetIdleTime = () => {
    lastActivityRef.current = Date.now();
    setIdleTime(0);
  };

  // Fetch settings to check if debug timer is enabled
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
          setIsEnabled(!!data.data.enableDebugTimer);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Default to disabled if there's an error
      setIsEnabled(false);
    }
    setIsInitialized(true);
  };
  
  // Effect for fetching settings, auth life, and idle time
  useEffect(() => {
    fetchSettings();
    
    // Get AUTH_LIFE from localStorage if available
    const storedAuthLife = localStorage.getItem('authLifeSeconds');
    if (storedAuthLife) {
      setAuthLifeSeconds(parseInt(storedAuthLife, 10));
    } else {
      // Fetch from API if not in localStorage
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      fetch('/api/settings/auth-life', { headers })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setAuthLifeSeconds(data.data);
          }
        })
        .catch(error => {
          console.error('Error fetching AUTH_LIFE:', error);
        });
    }
    
    // Get IDLE_TIME from localStorage if available
    const storedIdleTime = localStorage.getItem('idleTimeSeconds');
    if (storedIdleTime) {
      setIdleTimeSeconds(parseInt(storedIdleTime, 10));
    } else {
      // Fetch from API if not in localStorage
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      fetch('/api/settings/idle-time', { headers })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setIdleTimeSeconds(data.data);
          }
        })
        .catch(error => {
          console.error('Error fetching IDLE_TIME:', error);
        });
    }
  }, []);
  
  // Initialize and set up event listeners for token and idle time
  useEffect(() => {
    // If not initialized yet or not enabled, don't set up listeners
    if (!isInitialized || !isEnabled) {
      return;
    }

    // Get initial token expiration
    setTokenExpiration(getTokenExpiration());

    // Set up interval to update token expiration and idle time
    const tokenInterval = setInterval(() => {
      setTokenExpiration(getTokenExpiration());
      
      // Update idle time
      const now = Date.now();
      const idleSeconds = Math.floor((now - lastActivityRef.current) / 1000);
      setIdleTime(idleSeconds);
    }, 1000);

    // Set up event listeners for user activity
    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'touchstart'];
    
    const handleUserActivity = () => {
      resetIdleTime();
    };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Clean up
    return () => {
      clearInterval(tokenInterval);
      
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
    };
  }, [isInitialized, isEnabled]);

  // Set up dragging functionality
  useEffect(() => {
    // Position the timer in the bottom right corner initially
    if (typeof window !== 'undefined') {
      positionRef.current = {
        x: window.innerWidth - 240,
        y: window.innerHeight - 160
      };
      
      // Force a re-render to apply the initial position
      if (timerRef.current) {
        timerRef.current.style.left = `${positionRef.current.x}px`;
        timerRef.current.style.top = `${positionRef.current.y}px`;
      }
    }
    
    // Handle mouse down event to start dragging
    const handleMouseDown = (e: MouseEvent) => {
      // Only start dragging if the click is on the header
      if (e.target instanceof HTMLElement && 
          (e.target.classList.contains('drag-handle') || 
           e.target.closest('.drag-handle'))) {
        
        isDraggingRef.current = true;
        
        // Calculate the offset from the mouse position to the top-left corner of the element
        if (timerRef.current) {
          const rect = timerRef.current.getBoundingClientRect();
          dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
          
          // Change cursor to grabbing
          timerRef.current.style.cursor = 'grabbing';
          if (e.target.classList.contains('drag-handle')) {
            e.target.style.cursor = 'grabbing';
          }
        }
        
        // Prevent text selection during drag
        e.preventDefault();
      }
    };
    
    // Handle mouse move event to update position during dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current && timerRef.current) {
        // Calculate new position based on mouse position and drag offset
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        
        // Ensure the element stays within the viewport
        const rect = timerRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        positionRef.current = {
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        };
        
        // Apply the new position directly to the element
        timerRef.current.style.left = `${positionRef.current.x}px`;
        timerRef.current.style.top = `${positionRef.current.y}px`;
      }
    };
    
    // Handle mouse up event to stop dragging
    const handleMouseUp = () => {
      if (isDraggingRef.current && timerRef.current) {
        isDraggingRef.current = false;
        
        // Change cursor back to grab
        timerRef.current.style.cursor = 'default';
        const dragHandle = timerRef.current.querySelector('.drag-handle');
        if (dragHandle instanceof HTMLElement) {
          dragHandle.style.cursor = 'grab';
        }
      }
    };
    
    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Empty dependency array to ensure this only runs once

  // In development mode, always show the timer
  const showInDevelopment = process.env.NODE_ENV === 'development';
  
  // Don't render anything if not visible or not enabled (unless in development mode)
  if (!isVisible || (!isEnabled && !showInDevelopment)) {
    return null;
  }

  return (
    <div 
      ref={timerRef}
      className={debugTimerContainer(isDraggingRef.current, positionRef.current.x, positionRef.current.y)}
      style={{ 
        position: 'fixed',
        zIndex: 9999,
        left: `${positionRef.current.x}px`, 
        top: `${positionRef.current.y}px`
      }}
    >
      <div 
        className={`${debugTimerHeader()} drag-handle`}
        style={{ cursor: 'grab' }}
      >
        <div>{t('Debug Session Timer')}</div>
        <button 
          className={debugTimerCloseButton()} 
          onClick={() => setIsVisible(false)}
          aria-label="Close debug timer"
        >
          <X size={16} />
        </button>
      </div>
      <div className={debugTimerContent()}>
        <div className={debugTimerRow()}>
          <span className={debugTimerLabel()}>{t('JWT Expires:')}</span>
          <span className={debugTimerValue()}>{formatTimeRemaining(tokenExpiration)}</span>
        </div>
        <div className={debugTimerRow()}>
          <span className={debugTimerLabel()}>{t('Idle Time:')}</span>
          <span className={debugTimerValue()}>{formatIdleTime(idleTime)}</span>
        </div>
        <div className={debugTimerRow()}>
          <span className={debugTimerLabel()}>{t('Auth Life:')}</span>
          <span className={debugTimerValue()}>
            {authLifeSeconds ? `${Math.floor(authLifeSeconds / 3600)}h ${Math.floor((authLifeSeconds % 3600) / 60)}m` : 'Unknown'}
          </span>
        </div>
        <div className={debugTimerRow(true)}>
          <span className={debugTimerLabel()}>{t('Idle Timeout:')}</span>
          <span className={debugTimerValue()}>
            {idleTimeSeconds ? `${Math.floor(idleTimeSeconds / 3600)}h ${Math.floor((idleTimeSeconds % 3600) / 60)}m` : 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  );
};

export { DebugSessionTimer };
