'use client';

import { DeploymentProvider } from '@/app/context/deployment';
import { LocalizationProvider } from '@/src/context/localization';
import { FamilyProvider } from '@/src/context/family';
import { BabyProvider } from '@/app/context/baby';

import { ThemeProvider } from '@/src/context/theme';
import { ToastProvider } from '@/src/components/ui/toast';

export default function NurseryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }

    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');
    localStorage.removeItem('authToken');
    localStorage.removeItem('accountUser');
    localStorage.removeItem('attempts');
    localStorage.removeItem('lockoutTime');

    window.location.href = '/';
  };

  return (
    <div style={{ background: '#0a0a1a', minHeight: '100vh' }}>
      <DeploymentProvider>
        <LocalizationProvider>
          <FamilyProvider onLogout={handleLogout}>
            <BabyProvider>
              <ThemeProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </ThemeProvider>
            </BabyProvider>
          </FamilyProvider>
        </LocalizationProvider>
      </DeploymentProvider>
    </div>
  );
}
