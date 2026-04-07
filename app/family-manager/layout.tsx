'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LocalizationProvider } from '@/src/context/localization';

import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '../context/deployment';
import { ToastProvider } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { AdminCountProvider, useAdminCounts } from '@/src/components/familymanager/admin-count-context';
import { AdminSideNav } from '@/src/components/familymanager/admin-side-nav';
import { SideNavTrigger } from '@/src/components/ui/side-nav';
import Image from 'next/image';
import '../globals.css';
import './layout.css';
import { DebugSessionTimer } from '@/src/components/debugSessionTimer';
import { TimezoneDebug } from '@/src/components/debugTimezone';
import { Inter as FontSans } from 'next/font/google';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

function AppContent({ children }: { children: React.ReactNode }) {
  const { t } = useLocalization();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sideNavOpen, setSideNavOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Screen size detection
  const checkScreenWidth = useCallback(() => {
    const isWide = window.innerWidth > 600;
    setIsWideScreen(isWide);
    if (isWide) setSideNavOpen(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    checkScreenWidth();
    window.addEventListener('resize', checkScreenWidth);
    return () => window.removeEventListener('resize', checkScreenWidth);
  }, [mounted, checkScreenWidth]);

  const handleLogout = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('unlockTime');
      localStorage.removeItem('caretakerId');
      router.push('/family-manager/login');
    }
  }, [router]);

  // Auth check
  useEffect(() => {
    if (!mounted) return;
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
      const now = Date.now() / 1000;
      if (tokenPayload.exp < now) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('unlockTime');
        router.push('/family-manager/login');
        return;
      }
      if (tokenPayload.isSysAdmin) {
        setIsAuthenticated(true);
      } else {
        router.push('/family-manager/login');
        return;
      }
    } catch {
      localStorage.removeItem('authToken');
      localStorage.removeItem('unlockTime');
      router.push('/family-manager/login');
      return;
    }

    setAuthChecked(true);
  }, [mounted, pathname, router]);

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
    if (!isWideScreen) setSideNavOpen(false);
  }, [router, isWideScreen]);

  const handleAddFamily = useCallback(() => {
    // Navigate to families page first if not already there
    if (pathname !== '/family-manager/families') {
      router.push('/family-manager/families');
    }
    // Dispatch event for the families page to handle
    window.dispatchEvent(new Event('admin-add-family'));
    if (!isWideScreen) setSideNavOpen(false);
  }, [pathname, router, isWideScreen]);

  const handleSettingsClick = useCallback(() => {
    if (pathname !== '/family-manager/families') {
      router.push('/family-manager/families');
    }
    window.dispatchEvent(new Event('admin-settings'));
    if (!isWideScreen) setSideNavOpen(false);
  }, [pathname, router, isWideScreen]);

  if (!mounted || !authChecked) return null;

  // Login page - no side-nav layout
  if (pathname === '/family-manager/login') {
    return children;
  }

  if (!isAuthenticated) return null;

  return (
    <AppContentWithCounts
      sideNavOpen={sideNavOpen}
      setSideNavOpen={setSideNavOpen}
      isWideScreen={isWideScreen}
      pathname={pathname}
      handleNavigate={handleNavigate}
      handleLogout={handleLogout}
      handleAddFamily={handleAddFamily}
      handleSettingsClick={handleSettingsClick}
      t={t}
    >
      {children}
    </AppContentWithCounts>
  );
}

function AppContentWithCounts({
  children,
  sideNavOpen,
  setSideNavOpen,
  isWideScreen,
  pathname,
  handleNavigate,
  handleLogout,
  handleAddFamily,
  handleSettingsClick,
  t,
}: {
  children: React.ReactNode;
  sideNavOpen: boolean;
  setSideNavOpen: (open: boolean) => void;
  isWideScreen: boolean;
  pathname: string;
  handleNavigate: (path: string) => void;
  handleLogout: () => void;
  handleAddFamily: () => void;
  handleSettingsClick: () => void;
  t: (key: string) => string;
}) {
  const { counts } = useAdminCounts();

  return (
    <>
      <div className="family-manager-layout">
        {isWideScreen ? (
          /* Wide screen: side-nav + content side by side */
          <div className="flex h-screen">
            <div className="w-64 h-screen sticky top-0 flex-shrink-0">
              <AdminSideNav
                isOpen={true}
                onClose={() => {}}
                currentPath={pathname}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                onAddFamily={handleAddFamily}
                onSettingsClick={handleSettingsClick}
                nonModal={true}
                counts={counts}
              />
            </div>
            <main className="family-manager-main w-[calc(100%-16rem)]">
              {children}
            </main>
          </div>
        ) : (
          /* Small screen: header + modal side-nav */
          <>
            <header className="family-manager-header w-full bg-gradient-to-r from-teal-600 to-teal-700">
              <div className="mx-auto py-2">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center ml-4">
                    <SideNavTrigger
                      onClick={() => setSideNavOpen(!sideNavOpen)}
                      isOpen={sideNavOpen}
                    >
                      <Image
                        src="/sprout-128.png"
                        alt="Sprout Logo"
                        width={40}
                        height={40}
                        className="object-contain cursor-pointer"
                        priority
                      />
                    </SideNavTrigger>
                    <div className="flex flex-col ml-3">
                      <h1 className="text-white text-sm font-bold">
                        {t('Family Management')}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <AdminSideNav
              isOpen={sideNavOpen}
              onClose={() => setSideNavOpen(false)}
              currentPath={pathname}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              onAddFamily={handleAddFamily}
              onSettingsClick={handleSettingsClick}
              nonModal={false}
              counts={counts}
            />

            <main className="family-manager-main w-full">
              {children}
            </main>
          </>
        )}
      </div>

      <DebugSessionTimer />
      <TimezoneDebug />
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeploymentProvider>
      <LocalizationProvider>
        <ThemeProvider>
          <ToastProvider>
            <AdminCountProvider>
              <AppContent>{children}</AppContent>
            </AdminCountProvider>
          </ToastProvider>
        </ThemeProvider>
      </LocalizationProvider>
    </DeploymentProvider>
  );
}
