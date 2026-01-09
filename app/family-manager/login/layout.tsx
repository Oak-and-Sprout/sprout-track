import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';

export default function FamilyManagerLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </LocalizationProvider>
  );
} 