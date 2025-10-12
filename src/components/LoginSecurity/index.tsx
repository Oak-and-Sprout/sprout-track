'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { X, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/src/context/theme';
import { useDeployment } from '@/app/context/deployment';
import { ShareButton } from '@/src/components/ui/share-button';
import ExpiredAccountMessage from '@/src/components/ExpiredAccountMessage';
import './login-security.css';
import { ApiResponse } from '@/app/api/types';

interface LoginSecurityProps {
  onUnlock: (caretakerId?: string) => void;
  familySlug?: string;
  familyName?: string;
}

export default function LoginSecurity({ onUnlock, familySlug, familyName }: LoginSecurityProps) {
  const { theme } = useTheme();
  const { isSaasMode } = useDeployment();
  const router = useRouter();
  const [loginId, setLoginId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [authType, setAuthType] = useState<'SYSTEM' | 'CARETAKER'>('SYSTEM');
  const [activeInput, setActiveInput] = useState<'loginId' | 'pin'>('loginId');
  const [isMounted, setIsMounted] = useState(false);
  
  // Admin mode state
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [goButtonClicks, setGoButtonClicks] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Account status for SAAS mode
  const [accountStatus, setAccountStatus] = useState<{
    isExpired: boolean;
    isTrialExpired: boolean;
    expirationDate?: string;
    betaparticipant: boolean;
  } | null>(null);
  const [checkingAccountStatus, setCheckingAccountStatus] = useState(false);

  // Track when component has mounted to prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset form when component mounts and check for server-side IP lockout
  useEffect(() => {
    setPin('');
    setLoginId('');
    setError('');
    
    // Check for server-side IP lockout
    const checkIpLockout = async () => {
      try {
        const response = await fetch('/api/auth/ip-lockout');
        const data = await response.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
        
        if (data.success && data.data && data.data.locked) {
          const remainingTime = data.data.remainingTime || 300000; // Default to 5 minutes if not provided
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          setLockoutTime(Date.now() + remainingTime);
          setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        }
      } catch (error) {
        console.error('Error checking IP lockout:', error);
      }
    };
    
    checkIpLockout();
  }, []);

  // Update lockout timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTime) {
      timer = setInterval(() => {
        if (Date.now() >= lockoutTime) {
          setLockoutTime(null);
          setAttempts(0);
          localStorage.removeItem('lockoutTime');
          localStorage.removeItem('attempts');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  // Check authentication type and caretakers
  useEffect(() => {
    const checkAuthSettings = async () => {
      try {
        // Check caretakers and authType in one call
        let caretakerUrl = '/api/auth/caretaker-exists';
        if (familySlug) {
          caretakerUrl += `?familySlug=${encodeURIComponent(familySlug)}`;
        }

        const caretakerResponse = await fetch(caretakerUrl);
        if (caretakerResponse.ok) {
          const caretakerData = await caretakerResponse.json();
          if (caretakerData.success && caretakerData.data) {
            const caretakersExist = caretakerData.data.exists;
            const familyAuthType = caretakerData.data.authType || (caretakersExist ? 'CARETAKER' : 'SYSTEM');

            setAuthType(familyAuthType);

            // Set initial active input based on auth type
            if (familyAuthType === 'CARETAKER') {
              setActiveInput('loginId');
            } else {
              setActiveInput('pin');
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth settings:', error);
      }
    };

    checkAuthSettings();
  }, [familySlug]);

  // Check account status in SAAS mode
  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!isSaasMode || !familySlug) return;

      setCheckingAccountStatus(true);
      try {
        // Get family info with account status
        const familyResponse = await fetch(`/api/family/by-slug/${encodeURIComponent(familySlug)}`);
        const familyData = await familyResponse.json();

        if (!familyData.success || !familyData.data) {
          // Family doesn't exist - allow the normal flow to handle this
          setAccountStatus(null);
          return;
        }

        // Check if family has account status data
        if (familyData.data.accountStatus) {
          setAccountStatus(familyData.data.accountStatus);
        } else {
          // No account associated with family - allow access (legacy families)
          setAccountStatus(null);
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        // On error, don't block access
        setAccountStatus(null);
      } finally {
        setCheckingAccountStatus(false);
      }
    };

    if (isMounted) {
      checkAccountStatus();
    }
  }, [isSaasMode, familySlug, isMounted]);

  const handleLoginIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 2) {
      setLoginId(value);
      setError('');
    }
    if (value.length === 2) {
      setActiveInput('pin');
      // Focus the PIN input after state update
      setTimeout(() => {
        const pinInput = document.querySelector('input[placeholder="PIN"]') as HTMLInputElement;
        if (pinInput) {
          pinInput.focus();
        }
      }, 0);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setPin(value);
      setError('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Determine which field is actually focused based on the target element
    const target = e.target as HTMLInputElement;
    const isLoginIdField = target.placeholder === 'ID';
    const isPinField = target.placeholder === 'PIN';

    // Allow only numbers, backspace, delete, arrow keys, tab, and enter
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter'];
    const isNumber = /^[0-9]$/.test(e.key);

    if (!isNumber && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }

    // Handle number input based on which field is focused
    if (isNumber) {
      e.preventDefault();
      if (isLoginIdField && loginId.length < 2) {
        const newLoginId = loginId + e.key;
        setLoginId(newLoginId);
        setError('');
        setActiveInput('loginId');

        // Auto-switch to PIN when login ID is complete
        if (newLoginId.length === 2) {
          setActiveInput('pin');
          setTimeout(() => {
            const pinInput = document.querySelector('input[placeholder="PIN"]') as HTMLInputElement;
            if (pinInput) {
              pinInput.focus();
            }
          }, 0);
        }
      } else if (isPinField && pin.length < 10) {
        setPin(pin + e.key);
        setError('');
        setActiveInput('pin');
      }
    }

    // Handle backspace and delete for removing characters
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (isLoginIdField && loginId.length > 0) {
        setLoginId(loginId.slice(0, -1));
        setError('');
        setActiveInput('loginId');
      } else if (isPinField && pin.length > 0) {
        setPin(pin.slice(0, -1));
        setError('');
        setActiveInput('pin');
      } else if (isPinField && pin.length === 0 && loginId.length > 0 && authType === 'CARETAKER') {
        // Switch back to login ID if PIN is empty and there's content in login ID
        setActiveInput('loginId');
        setTimeout(() => {
          const loginInput = document.querySelector('input[placeholder="ID"]') as HTMLInputElement;
          if (loginInput) {
            loginInput.focus();
          }
        }, 0);
      }
    }

    // Handle tab and arrow key navigation between fields
    if ((e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && authType === 'CARETAKER') {
      e.preventDefault();
      if (isLoginIdField) {
        setActiveInput('pin');
        setTimeout(() => {
          const pinInput = document.querySelector('input[placeholder="PIN"]') as HTMLInputElement;
          if (pinInput) {
            pinInput.focus();
          }
        }, 0);
      } else if (isPinField) {
        setActiveInput('loginId');
        setTimeout(() => {
          const loginInput = document.querySelector('input[placeholder="ID"]') as HTMLInputElement;
          if (loginInput) {
            loginInput.focus();
          }
        }, 0);
      }
    }

    // Handle enter key for authentication
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAuthenticate();
    }
  };

  // Handle number pad input for either login ID or PIN
  const handleNumberClick = (number: string) => {
    if (lockoutTime) return; // Prevent input during lockout

    if (activeInput === 'loginId') {
      // Handle login ID input
      if (loginId.length < 2) {
        const newLoginId = loginId + number;
        setLoginId(newLoginId);
        setError('');
        
        // Automatically switch to PIN input when login ID is complete
        if (newLoginId.length === 2) {
          setActiveInput('pin');
          // Focus the PIN input after state update
          setTimeout(() => {
            const pinInput = document.querySelector('input[placeholder="PIN"]') as HTMLInputElement;
            if (pinInput) {
              pinInput.focus();
            }
          }, 0);
        }
      }
    } else {
      // Handle PIN input
      const newPin = pin + number;
      if (newPin.length <= 10) {
        setPin(newPin);
        setError('');
      }
    }
  };

  const handleAdminAuthenticate = async () => {
    if (!adminPassword.trim()) {
      setError('Admin password is required');
      return;
    }

    try {
      // Check for server-side IP lockout first
      const ipCheckResponse = await fetch('/api/auth/ip-lockout');
      const ipCheckData = await ipCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
      
      if (ipCheckData.success && ipCheckData.data && ipCheckData.data.locked) {
        const remainingTime = ipCheckData.data.remainingTime || 300000;
        const remainingMinutes = Math.ceil(remainingTime / 60000);
        setLockoutTime(Date.now() + remainingTime);
        setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        return;
      }
      
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.isSysAdmin) {
        // Store sysadmin authentication  
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('unlockTime', Date.now().toString());
        
        // Clear any existing caretaker auth
        localStorage.removeItem('caretakerId');
        
        // Call the onUnlock callback
        onUnlock('sysadmin');
      } else {
        setError('Invalid admin password');
        setAdminPassword('');
        
        // Check if we're now locked out
        const lockoutCheckResponse = await fetch('/api/auth/ip-lockout');
        const lockoutCheckData = await lockoutCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
        
        if (lockoutCheckData.success && lockoutCheckData.data && lockoutCheckData.data.locked) {
          const remainingTime = lockoutCheckData.data.remainingTime || 300000;
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          setLockoutTime(Date.now() + remainingTime);
          setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        }
      }
    } catch (error) {
      console.error('Admin authentication error:', error);
      setError('Authentication failed. Please try again.');
      setAdminPassword('');
    }
  };

  const handleAuthenticate = async () => {
    // Handle admin mode authentication
    if (adminMode) {
      await handleAdminAuthenticate();
      return;
    }

    // Don't attempt authentication if login ID is required but not complete (for CARETAKER auth type)
    if (authType === 'CARETAKER' && loginId.length !== 2) {
      setError('Please enter a valid 2-character login ID first');
      setActiveInput('loginId');
      return;
    }

    // Don't attempt authentication if PIN is too short
    if (pin.length < 6) {
      setError('Please enter a PIN with at least 6 digits');
      setActiveInput('pin');
      return;
    }

    try {
      // Check for server-side IP lockout first
      const ipCheckResponse = await fetch('/api/auth/ip-lockout');
      const ipCheckData = await ipCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
      
      if (ipCheckData.success && ipCheckData.data && ipCheckData.data.locked) {
        const remainingTime = ipCheckData.data.remainingTime || 300000; // Default to 5 minutes if not provided
        const remainingMinutes = Math.ceil(remainingTime / 60000);
        setLockoutTime(Date.now() + remainingTime);
        setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        return;
      }
      
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginId: authType === 'CARETAKER' ? loginId : undefined,
          securityPin: pin,
          familySlug: familySlug,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store unlock time, token, and caretaker ID
        localStorage.setItem('unlockTime', Date.now().toString());
        localStorage.setItem('caretakerId', data.data.id);
        localStorage.setItem('authToken', data.data.token);
        
        // Get the AUTH_LIFE and IDLE_TIME values for client-side timeout checks
        const authLifeResponse = await fetch('/api/settings/auth-life');
        const authLifeData = await authLifeResponse.json();
        if (authLifeData.success) {
          localStorage.setItem('authLifeSeconds', authLifeData.data.toString());
        }
        
        // Get the IDLE_TIME value
        const idleTimeResponse = await fetch('/api/settings/idle-time');
        const idleTimeData = await idleTimeResponse.json();
        if (idleTimeData.success) {
          localStorage.setItem('idleTimeSeconds', idleTimeData.data.toString());
        }
        // Call the onUnlock callback
        onUnlock(data.data.id);
      } else {
        // Failed authentication attempt - the server will handle counting attempts
        setError('Invalid credentials');
        setPin('');
        
        // Check if we're now locked out
        const lockoutCheckResponse = await fetch('/api/auth/ip-lockout');
        const lockoutCheckData = await lockoutCheckResponse.json() as ApiResponse<{ locked: boolean; remainingTime: number }>;
        
        if (lockoutCheckData.success && lockoutCheckData.data && lockoutCheckData.data.locked) {
          const remainingTime = lockoutCheckData.data.remainingTime || 300000; // Default to 5 minutes if not provided
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          setLockoutTime(Date.now() + remainingTime);
          setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed. Please try again.');
      setPin('');
    }
  };

  const handleDelete = () => {
    if (!lockoutTime) {
      if (activeInput === 'pin' && pin.length > 0) {
        setPin(pin.slice(0, -1));
      } else if (activeInput === 'loginId' && loginId.length > 0) {
        setLoginId(loginId.slice(0, -1));
      } else if (activeInput === 'pin' && pin.length === 0 && loginId.length > 0) {
        // Switch back to login ID if PIN is empty
        setActiveInput('loginId');
      }
      setError('');
    }
  };

  const handleFocusLoginId = () => {
    setActiveInput('loginId');
  };

  const handleFocusPin = () => {
    setActiveInput('pin');
  };

  // Handle secret admin mode activation
  const handleGoButtonClick = () => {
    // If button is enabled, perform normal authentication
    const isButtonDisabled = !!lockoutTime || (authType === 'CARETAKER' && loginId.length !== 2) || (pin.length < 6 && !adminMode) || (adminMode && !adminPassword.trim());
    
    if (!isButtonDisabled) {
      handleAuthenticate();
      return;
    }

    // Secret admin mode: count clicks on disabled button
    setGoButtonClicks(prev => prev + 1);
    
    // Reset timer if it exists
    if (clickTimer) {
      clearTimeout(clickTimer);
    }
    
    // Set new timer for 5 seconds
    const newTimer = setTimeout(() => {
      setGoButtonClicks(0);
    }, 5000);
    setClickTimer(newTimer);
    
    // Check if we've reached 10 clicks
    if (goButtonClicks + 1 >= 10) {
      setAdminMode(true);
      setGoButtonClicks(0);
      setError('');
      if (clickTimer) {
        clearTimeout(clickTimer);
        setClickTimer(null);
      }
    }
  };

  // Reset admin mode
  const resetToNormalMode = () => {
    setAdminMode(false);
    setAdminPassword('');
    setShowAdminPassword(false);
    setGoButtonClicks(0);
    setError('');
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  // Handle logo click - redirect to home in SaaS mode
  const handleLogoClick = () => {
    if (isSaasMode) {
      router.push('/');
    }
  };

  const formatTimeRemaining = (lockoutTime: number) => {
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show expired account message if account is expired in SAAS mode
  if (isSaasMode && accountStatus?.isExpired && !checkingAccountStatus) {
    return (
      <ExpiredAccountMessage
        familyName={familyName}
        familySlug={familySlug}
        isTrialExpired={accountStatus.isTrialExpired}
        expirationDate={accountStatus.expirationDate}
      />
    );
  }

  // Show loading or normal login if account is valid or not in SAAS mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white login-container">
      <div className="w-full max-w-md mx-auto p-6">
        <div className="text-center mt-2 mb-4">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-semibold login-title">
              {adminMode 
                ? 'System Administrator'
                : (isMounted && familyName ? familyName : 'Security Check')
              }
            </h2>
            {!adminMode && familySlug && familyName && (
              <ShareButton 
                familySlug={familySlug} 
                familyName={familyName}
                variant="ghost"
                size="sm"
              />
            )}
          </div>
          <p id="pin-description" className="text-sm text-gray-500 login-description">
            {adminMode
              ? 'Please enter the system administrator password'
              : (authType === 'SYSTEM'
                ? 'Please enter your system security PIN'
                : 'Please enter your login ID and security PIN')
            }
          </p>
          {adminMode && (
            <button
              onClick={resetToNormalMode}
              className="text-xs text-blue-500 hover:text-blue-700 mt-1"
            >
              Back to normal login
            </button>
          )}
        </div>
        <div className="flex flex-col items-center space-y-4 pb-6 pl-6 pr-6">
          <div 
            className={`w-24 h-24 p-1 flex items-center justify-center ${isSaasMode ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={handleLogoClick}
          >
            <Image
              src="/sprout-128.png"
              alt="Sprout Logo"
              width={128}
              height={128}
              className="object-contain"
              priority
            />
          </div>
          
          <div className="w-full max-w-[240px] space-y-6">
            {adminMode ? (
              /* Admin Password Section */
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 text-center login-card-title">Administrator Password</h2>
                <div className="relative">
                  <Input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setError('');
                    }}
                    className="text-center text-lg font-semibold login-input pr-10"
                    placeholder="Enter admin password"
                    disabled={!!lockoutTime}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    disabled={!!lockoutTime}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Login ID section - only show if authType is CARETAKER */}
                {authType === 'CARETAKER' && (
                  <div className={`space-y-2 p-1rounded-lg transition-all duration-200 ${activeInput === 'loginId' ? 'login-field-active' : 'login-field-inactive'}`}>
                    <h2 className="text-lg font-semibold text-gray-900 text-center login-card-title">Login ID</h2>

                    {/* Login ID Display */}
                    <div
                      className="flex gap-2 justify-center my-2 cursor-pointer"
                      onClick={handleFocusLoginId}
                    >
                      {loginId.length === 0 ? (
                        // Show 2 placeholder dots when no input
                        Array.from({ length: 2 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full ${activeInput === 'loginId' ? 'bg-gray-300 security-dot-focus' : 'bg-gray-200/50 security-dot-placeholder'}`}
                          />
                        ))
                      ) : (
                        // Show actual characters for entered login ID
                        Array.from({ length: 2 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full ${i < loginId.length ? 'bg-teal-600 security-dot-active' : 'bg-gray-200/50 security-dot-placeholder'}`}
                          />
                        ))
                      )}
                    </div>
                    <Input
                      value={loginId}
                      onChange={handleLoginIdChange}
                      onKeyDown={handleKeyDown}
                      className="text-center text-xl font-semibold sr-only login-input"
                      placeholder="ID"
                      maxLength={2}
                      autoFocus={activeInput === 'loginId'}
                      onFocus={handleFocusLoginId}
                      disabled={!!lockoutTime}
                    />
                  </div>
                )}
                
                {/* PIN input section */}
                <div className={`space-y-2 p-1 rounded-lg transition-all duration-200 ${activeInput === 'pin' ? 'login-field-active' : 'login-field-inactive'}`}>
                  <h2 className="text-lg font-semibold text-gray-900 text-center login-card-title">Security PIN</h2>

                  {/* PIN Display */}
                  <div
                    className="flex gap-2 justify-center my-2 cursor-pointer"
                    onClick={handleFocusPin}
                  >
                    {pin.length === 0 ? (
                      // Show 6 placeholder dots when no input
                      Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${activeInput === 'pin' ? 'bg-gray-300 security-dot-focus' : 'bg-gray-200/50 security-dot-placeholder'}`}
                        />
                      ))
                    ) : (
                      // Show actual number of dots for entered digits
                      Array.from({ length: Math.max(pin.length, 6) }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${i < pin.length ? 'bg-teal-600 security-dot-active' : 'bg-gray-200/50 security-dot-placeholder'}`}
                        />
                      ))
                    )}
                  </div>
                  <Input
                    type="password"
                    value={pin}
                    onChange={handlePinChange}
                    onKeyDown={handleKeyDown}
                    className="text-center text-xl font-semibold sr-only login-input"
                    placeholder="PIN"
                    maxLength={10}
                    autoFocus={activeInput === 'pin'}
                    onFocus={handleFocusPin}
                    disabled={!!lockoutTime}
                  />
                </div>
              </>
            )}
          </div>
          
          {error && (
            <p className="text-red-500 text-sm login-error">
              {error}
              {lockoutTime && ` (${formatTimeRemaining(lockoutTime)})`}
            </p>
          )}

          {/* Number Pad - only show in normal mode */}
          {!adminMode && (
            <div className="grid grid-cols-3 gap-4 w-full max-w-[240px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                <Button
                  key={number}
                  variant="outline"
                  className="w-14 h-14 text-xl font-semibold rounded-xl hover:bg-teal-50 disabled:opacity-50 security-numpad-button"
                  onClick={() => handleNumberClick(number.toString())}
                  disabled={!!lockoutTime}
                >
                  {number}
                </Button>
              ))}
              <Button
                key="0"
                variant="outline"
                className="w-14 h-14 text-xl font-semibold rounded-xl hover:bg-teal-50 disabled:opacity-50 security-numpad-button"
                onClick={() => handleNumberClick("0")}
                disabled={!!lockoutTime}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="w-14 h-14 text-xl font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50 security-delete-button"
                onClick={handleDelete}
                disabled={!!lockoutTime}
              >
                <X className="h-6 w-6" />
              </Button>
              {/* Go Button integrated into keypad */}
              <Button
                variant="default"
                className="w-14 h-14 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 security-go-button"
                onClick={handleGoButtonClick}
                disabled={false} // Never disable for secret click detection
              >
                Go
              </Button>
            </div>
          )}
          
          {/* Admin mode Go button */}
          {adminMode && (
            <div className="w-full max-w-[240px]">
              <Button
                variant="default"
                className="w-full py-3 text-lg font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                onClick={handleAuthenticate}
                disabled={!!lockoutTime || !adminPassword.trim()}
              >
                Login as Administrator
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
