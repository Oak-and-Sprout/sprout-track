import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';

export default function FamilySelectLayout({
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