'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/src/lib/utils';

interface LandingButtonProps {
  variant?: 'solid' | 'ghost';
  size?: 'default' | 'big';
  href?: string;
  external?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * The landing surface's button. Styled exclusively by the ld-btn classes in
 * landing.css — no app Button variants, so app hover/dark-mode styles can
 * never bleed into the paper-cream design. Renders a next/link Link for
 * internal hrefs, a plain anchor for external ones, else a button.
 */
export function LandingButton({
  variant = 'solid',
  size = 'default',
  href,
  external = false,
  onClick,
  className,
  style,
  children,
}: LandingButtonProps) {
  const classes = cn(
    'ld-btn',
    variant === 'ghost' && 'ld-ghost',
    size === 'big' && 'ld-big',
    className
  );

  if (href && !external && href.startsWith('/')) {
    return (
      <Link href={href} className={classes} style={style} onClick={onClick}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} rel="noopener" className={classes} style={style} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} style={style} onClick={onClick}>
      {children}
    </button>
  );
}
