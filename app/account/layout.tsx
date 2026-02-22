import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import './account.css';

export default function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <div className="accounts-layout">
          {children}
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
