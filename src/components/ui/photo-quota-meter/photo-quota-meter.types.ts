export interface PhotoQuotaMeterProps {
  usedBytes: number;
  totalBytes: number;
  /** 'dark' renders light-on-dark for the gallery hero header */
  variant?: 'light' | 'dark';
  className?: string;
}
