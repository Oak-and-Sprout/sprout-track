'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TimezoneProvider } from '../context/timezone';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '../context/deployment';
import { ToastProvider } from '@/src/components/ui/toast';
import Image from 'next/image';
import '../globals.css';
import './layout.css';
import SettingsForm from '@/src/components/forms/SettingsForm';
import { DebugSessionTimer } from '@/src/components/debugSessionTimer';
import { TimezoneDebug } from '@/src/components/debugTimezone';
import ThemeToggle from '@/src/components/ui/theme-toggle';
import { LogOut } from 'lucide-react';
import { Inter as FontSans } from 'next/font/google';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

function AppContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle logout functionality (similar to side-nav)
  const handleLogout = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      
      // Call logout API to invalidate the token
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        }
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear all authentication data
      localStorage.removeItem('authToken');
      localStorage.removeItem('unlockTime');
      localStorage.removeItem('caretakerId');
      
      // Redirect to login
      router.push('/family-manager/login');
    }
  }, [router]);

  // Check for sysadmin authentication
  useEffect(() => {
    if (!mounted) return;
    
    // Skip auth check for login page
    if (pathname === '/family-manager/login') {
      setAuthChecked(true);
      return;
    }

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      router.push('/family-manager/login');
      return;
    }

    try {
      const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
      
      // Check if token is expired
      const now = Date.now() / 1000;
      if (tokenPayload.exp < now) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('unlockTime');
        router.push('/family-manager/login');
        return;
      }

      // Check if user is system admin
      if (tokenPayload.isSysAdmin) {
        setIsAuthenticated(true);
      } else {
        router.push('/family-manager/login');
        return;
      }
    } catch (error) {
      // Invalid token
      localStorage.removeItem('authToken');
      localStorage.removeItem('unlockTime');
      router.push('/family-manager/login');
      return;
    }
    
    setAuthChecked(true);
  }, [mounted, pathname, router]);

  if (!mounted || !authChecked) return null;
  
  // Show login page content if on login route
  if (pathname === '/family-manager/login') {
    return children;
  }
  
  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="family-manager-layout">
        {/* Header */}
        <header className="family-manager-header w-full bg-gradient-to-r from-teal-600 to-teal-700">
          <div className="mx-auto py-2">
            <div className="flex justify-between items-center h-16"> {/* Fixed height for consistency */}
              <div className="flex items-center ml-4 sm:ml-6 lg:ml-8">
                <Image
                  src="/sprout-128.png"
                  alt="Sprout Logo"
                  width={64}
                  height={64}
                  className="object-contain mr-4"
                  priority
                />
                <div className="flex flex-col">
                  <h1 className="text-white text-lg font-bold">
                    Family Management
                  </h1>
                  <p className="text-white/80 text-xs">
                    View and manage all families in Sprout Track
                  </p>
                </div>
              </div>
              <div className="flex items-center mr-4 sm:mr-6 lg:mr-8">
                <ThemeToggle variant="light" />
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content area - scrollable */}
        <main className="family-manager-main bg-gray-200">
          {children}
        </main>
        
        {/* Fixed footer with logout button */}
        <footer className="family-manager-footer">
          <button
            onClick={handleLogout}
            className="family-manager-logout-button"
            aria-label="Logout from family manager"
          >
            <LogOut className="family-manager-logout-icon" />
            Logout
          </button>
        </footer>
      </div>

      <SettingsForm
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onBabyStatusChange={() => {}} // No special handling needed
      />
      
      {/* Debug components - only visible in development mode */}
      <DebugSessionTimer />
      <TimezoneDebug />
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DeploymentProvider>
      <TimezoneProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent>{children}</AppContent>
          </ToastProvider>
        </ThemeProvider>
      </TimezoneProvider>
    </DeploymentProvider>
  );
}
