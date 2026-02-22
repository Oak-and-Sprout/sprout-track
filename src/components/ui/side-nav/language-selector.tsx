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
import supportedLanguagesJson from '@/src/localization/supported-languages.json';

const SUPPORTED_LANGUAGES = Array.isArray(supportedLanguagesJson)
  ? supportedLanguagesJson
  : ['en', 'es', 'fr'];

/**
 * Language code to display name mapping
 */
const LANGUAGE_NAMES: Record<string, { code: string; name: string }> = {
  en: { code: 'EN', name: 'English' },
  es: { code: 'ES', name: 'Español' },
  fr: { code: 'FR', name: 'Français' },
};

/**
 * LanguageSelector component
 * 
 * A dropdown component that allows users to select their preferred language.
 * Displays a two-letter language code and shows available languages in a dropdown.
 */
export function LanguageSelector() {
  const { language, setLanguage, t } = useLocalization();
  
  const currentLanguage = language.toLowerCase();
  const currentLanguageInfo = LANGUAGE_NAMES[currentLanguage] || { code: currentLanguage.toUpperCase(), name: currentLanguage };

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
        {currentLanguageInfo.code}
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
          {SUPPORTED_LANGUAGES.map((lang) => {
            const langInfo = LANGUAGE_NAMES[lang] || { code: lang.toUpperCase(), name: lang };
            return (
              <DropdownMenuRadioItem
                key={lang}
                value={lang}
                className="side-nav-language-item"
              >
                {langInfo.name} ({langInfo.code})
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
