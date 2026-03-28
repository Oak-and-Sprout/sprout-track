'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/src/components/ui/dropdown-menu';
import { sideNavStyles } from './side-nav.styles';
import { cn } from '@/src/lib/utils';
import {
  supportedLanguages,
  getSupportedLanguage,
} from '@/src/localization/supported-languages-config';

/**
 * LanguageSelector component
 *
 * A dropdown component that allows users to select their preferred language.
 * Displays a two-letter language code and shows available languages in a dropdown.
 */
export function LanguageSelector() {
  const { language, setLanguage, t } = useLocalization();

  const currentLanguage = language.toLowerCase();
  const currentLanguageInfo = getSupportedLanguage(currentLanguage) ?? {
    code: currentLanguage,
    name: currentLanguage,
    abbreviation: currentLanguage.toUpperCase(),
  };

  const handleLanguageChange = async (newLanguage: string) => {
    await setLanguage(newLanguage);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          sideNavStyles.languageTrigger,
          "side-nav-language-trigger"
        )}
        aria-label={t('Select language')}
      >
        {currentLanguageInfo.abbreviation}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-h-[200px] overflow-y-auto side-nav-language-selector"
        side="top"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuRadioGroup
          value={currentLanguage}
          onValueChange={handleLanguageChange}
        >
          {supportedLanguages.map((lang) => (
            <DropdownMenuRadioItem
              key={lang.code}
              value={lang.code}
              className="side-nav-language-item"
            >
              {lang.name} ({lang.abbreviation})
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
