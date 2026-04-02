import React from 'react';
import { cn } from '@/src/lib/utils';
import { navCountBubbleVariants } from './nav-count-bubble.styles';
import { NavCountBubbleProps } from './nav-count-bubble.types';
import './nav-count-bubble.css';

const NavCountBubble: React.FC<NavCountBubbleProps> = ({
  count,
  variant = 'default',
  className,
}) => {
  return (
    <span
      className={cn(
        navCountBubbleVariants({ variant }),
        `nav-count-bubble-${variant}`,
        className
      )}
    >
      {count}
    </span>
  );
};

export default NavCountBubble;
