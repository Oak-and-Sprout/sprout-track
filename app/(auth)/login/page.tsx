'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginSecurity from '@/src/components/LoginSecurity';
import { useTheme } from '@/src/context/theme';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { FamilyResponse } from '@/app/api/types';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [families, setFamilies] = useState<FamilyResponse[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Token authentication state
  const [tokenPassword, setTokenPassword] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showTokenPassword, setShowTokenPassword] = useState(false);
  
  // Check if this is a setup flow
  const setupType = searchParams.get('setup');
  const setupToken = searchParams.get('token');
  const isSetupFlow = setupType === 'true';
  const isTokenSetupFlow = setupType === 'token' && setupToken;

  // Load families for the dropdown
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/family/public-list');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setFamilies(data.data);
            
            // If only one family exists, auto-select it
            if (data.data.length === 1) {
              setSelectedFamily(data.data[0].slug);
            }
          }
        }
      } catch (error) {
        console.error('Error loading families:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only load families if not in token setup mode
    if (!isTokenSetupFlow) {
      loadFamilies();
    } else {
      setLoading(false);
    }
  }, [isTokenSetupFlow]);

  // Handle token authentication
  const handleTokenAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenPassword.trim()) {
      setTokenError('Password is required');
      return;
    }

    if (!setupToken) {
      setTokenError('Setup token not found');
      return;
    }

    try {
      setTokenLoading(true);
      setTokenError('');

      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: setupToken,
          password: tokenPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Store token auth
        localStorage.setItem('authToken', data.data.token);
        localStorage.setItem('unlockTime', Date.now().toString());
        
        // Redirect to setup page with token
        router.push(`/setup/${setupToken}`);
      } else {
        setTokenError(data.error || 'Invalid password');
        setTokenPassword('');
      }
    } catch (error) {
      console.error('Token authentication error:', error);
      setTokenError('Authentication failed. Please try again.');
      setTokenPassword('');
    } finally {
      setTokenLoading(false);
    }
  };

  // Handle successful authentication (for regular auth)
  const handleUnlock = (caretakerId?: string) => {
    if (isTokenSetupFlow) {
      // Token-based setup flow
      router.push(`/setup/${setupToken}`);
    } else if (isSetupFlow) {
      // Regular setup flow - always go to /setup regardless of family context
      router.push('/setup');
    } else {
      // Normal login - redirect to main app
      if (selectedFamily) {
        router.push(`/${selectedFamily}/log-entry`);
      } else {
        router.push('/family-select');
      }
    }
  };

  // Check if already authenticated on page load
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const unlockTime = localStorage.getItem('unlockTime');
    
    // If user is authenticated, redirect appropriately
    if (authToken && unlockTime) {
      try {
        // Basic token validation
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
        const now = Date.now() / 1000;
        
        if (tokenPayload.exp > now) {
          // Token is valid
          if (isTokenSetupFlow) {
            router.push(`/setup/${setupToken}`);
          } else if (isSetupFlow) {
            router.push('/setup');
          } else {
            if (selectedFamily) {
              router.push(`/${selectedFamily}/log-entry`);
            } else {
              router.push('/family-select');
            }
          }
        } else {
          // Token expired, clear it
          localStorage.removeItem('authToken');
          localStorage.removeItem('unlockTime');
          localStorage.removeItem('caretakerId');
        }
      } catch (error) {
        // Invalid token, clear it
        localStorage.removeItem('authToken');
        localStorage.removeItem('unlockTime');
        localStorage.removeItem('caretakerId');
      }
    }
  }, [router, selectedFamily, isSetupFlow, isTokenSetupFlow, setupToken]);

  // Handle family selection change
  const handleFamilyChange = (value: string) => {
    setSelectedFamily(value);
  };

  // Show token authentication form if we're in token setup mode
  if (isTokenSetupFlow) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Family Setup Invitation
          </h2>
          <p className="text-blue-700 dark:text-blue-300">
            Please enter the password provided with this setup invitation to continue.
          </p>
        </div>
        
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Setup Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTokenAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tokenPassword">Setup Password</Label>
                <div className="relative">
                  <Input
                    id="tokenPassword"
                    type={showTokenPassword ? 'text' : 'password'}
                    value={tokenPassword}
                    onChange={(e) => {
                      setTokenPassword(e.target.value);
                      setTokenError('');
                    }}
                    placeholder="Enter setup password"
                    disabled={tokenLoading}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowTokenPassword(!showTokenPassword)}
                    disabled={tokenLoading}
                  >
                    {showTokenPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {tokenError && (
                <div className="text-red-500 text-sm">
                  {tokenError}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full"
                disabled={tokenLoading || !tokenPassword.trim()}
              >
                {tokenLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Continue to Setup'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Show setup message if this is setup flow */}
      {isSetupFlow && (
        <div className="w-full max-w-md mx-auto mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Initial Setup Required
          </h2>
          <p className="text-blue-700 dark:text-blue-300">
            Please authenticate with the system PIN to complete the initial setup.
          </p>
        </div>
      )}
      
      {/* Only show family selector if not setup flow and multiple families exist */}
      {!isSetupFlow && families.length > 1 && (
        <div className="w-full max-w-md mx-auto mb-4 p-4">
          <label className="block text-sm font-medium mb-2">Select Family</label>
          <Select
            value={selectedFamily || ''}
            onValueChange={handleFamilyChange}
            disabled={loading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a family" />
            </SelectTrigger>
            <SelectContent>
              {families.map((f) => (
                <SelectItem key={f.id} value={f.slug}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <LoginSecurity 
        onUnlock={handleUnlock} 
        familySlug={isSetupFlow ? undefined : selectedFamily || undefined}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
