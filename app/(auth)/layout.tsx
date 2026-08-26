import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '@/app/context/deployment';
import PageviewBeacon from '@/src/components/analytics/PageviewBeacon';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <DeploymentProvider>
          <PageviewBeacon />
          {children}
        </DeploymentProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
