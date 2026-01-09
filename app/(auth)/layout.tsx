import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '@/app/context/deployment';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <DeploymentProvider>
          {children}
        </DeploymentProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
