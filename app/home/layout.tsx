import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '@/app/context/deployment';
import PageviewBeacon from '@/src/components/analytics/PageviewBeacon';

export default function SaaSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <DeploymentProvider>
          <PageviewBeacon />
        </DeploymentProvider>
        {children}
      </ThemeProvider>
    </LocalizationProvider>
  );
}
