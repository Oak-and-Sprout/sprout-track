import { Literata, Alegreya_Sans } from 'next/font/google';

export const literata = Literata({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  variable: '--font-literata',
});

export const alegreyaSans = Alegreya_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-alegreya',
});
