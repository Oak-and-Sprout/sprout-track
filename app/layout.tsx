import { Inter as FontSans } from 'next/font/google';
import { cn } from '@/src/lib/utils';
import { Metadata } from 'next';
import { LocalizationProvider } from '@/src/context/localization';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NODE_ENV === 'production' ? 'https://www.sprout-track.com' : 'http://localhost:3000'),
  title: 'Sprout Track',
  icons: {
    icon: '/sprout-128.png',
    shortcut: '/sprout-128.png',
    apple: '/sprout-128.png',
  },
  description: 'Track your baby\'s sleep, feeding, diapers, milestones, and more with our intuitive, family-friendly platform. Simple to use, privacy-focused, accessible anywhere. Start your 14 day trial today!',
  keywords: [
    'baby tracker',
    'baby tracking app', 
    'infant care',
    'baby feeding tracker',
    'baby sleep tracker',
    'diaper tracker',
    'baby milestones',
    'newborn care',
    'baby care app',
    'family tracking',
    'caretaker coordination',
    'baby activities',
    'parenting tools'
  ],
  authors: [{ name: 'Oak and Sprout' }],
  creator: 'Oak and Sprout',
  publisher: 'Oak and Sprout',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.sprout-track.com',
    title: 'Sprout Track - The Shareable Baby Tracking Solution',
    description: 'Track your baby\'s sleep, feeding, diapers, milestones, and more with our intuitive, family-friendly platform. Simple to use, privacy-focused, accessible anywhere.',
    siteName: 'Sprout Track',
    images: [
      {
        url: '/sprout-256.png',
        width: 256,
        height: 256,
        alt: 'Sprout Track Logo - Baby Tracking App',
      },
    ],
  },
  verification: {
    google: '', // Add Google Search Console verification code when available
  },
  alternates: {
    canonical: 'https://www.sprout-track.com',
  },
  category: 'technology',
};

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout is now responsible only for rendering - redirect logic moved to individual pages

  return (
    <html lang="en" className={cn('h-full', fontSans.variable)} suppressHydrationWarning>
      <body className={cn('min-h-full bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 font-sans antialiased')} suppressHydrationWarning>
        <LocalizationProvider>
          {children}
        </LocalizationProvider>
      </body>
    </html>
  );
}
