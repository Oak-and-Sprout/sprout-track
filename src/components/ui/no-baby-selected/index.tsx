import React from 'react';
import { Baby } from 'lucide-react';
import { labelVariants } from '@/src/components/ui/label/label.styles';
import { useLocalization } from '@/src/context/localization';
import { useTheme } from '@/src/context/theme';
import { cn } from '@/src/lib/utils';
import { noBabySelectedStyles } from './no-baby-selected.styles';
import { NoBabySelectedProps } from './no-baby-selected.types';
import './no-baby-selected.css';

/**
 * NoBabySelected component
 * 
 * A reusable component that displays a message when no baby is selected.
 * Includes an icon, title, and description with proper light/dark mode support.
 */
export const NoBabySelected: React.FC<NoBabySelectedProps> = ({
  title,
  description,
  className,
}) => {
  const { theme } = useTheme();
  const { t } = useLocalization();
  const resolvedTitle = title ?? t('No Baby Selected');
  const resolvedDescription = description ?? t('Please select a baby from the dropdown menu above.');

  return (
    <div className={cn(noBabySelectedStyles.container, className, "no-baby-selected-container")}>
      <div className={cn(noBabySelectedStyles.iconContainer, "no-baby-selected-icon-container")}>
        <Baby className={cn(noBabySelectedStyles.icon, "no-baby-selected-icon")} aria-hidden="true" />
      </div>
      
      <div className={noBabySelectedStyles.textContainer}>
        <h2 className={cn(labelVariants(), noBabySelectedStyles.title, "no-baby-selected-title")}>
          {resolvedTitle}
        </h2>
        <p className={cn(labelVariants(), noBabySelectedStyles.description, "no-baby-selected-description")}>
          {resolvedDescription}
        </p>
      </div>
    </div>
  );
};

export default NoBabySelected; 