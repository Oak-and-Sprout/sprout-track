'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import enTranslations from '@/src/localization/translations/en.json';
import supportedLanguagesJson from '@/src/localization/supported-languages.json';

/**
 * Interface for the localization context
 */
interface LocalizationContextType {
  /**
   * Current language code (ISO 639-1, e.g., 'en', 'es', 'fr')
   */
  language: string;
  
  /**
   * Whether the context is loading the language preference from the API
   */
  isLoading: boolean;
  
  /**
   * Set the language preference (updates both API and localStorage)
   */
  setLanguage: (lang: string) => Promise<void>;
  
  /**
   * Translation function - returns translated string for the given key
   */
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const SUPPORTED_LANGUAGES = Array.isArray(supportedLanguagesJson)
  ? supportedLanguagesJson
  : ['en', 'es', 'fr'];

/**
 * Provider component for localization context
 */
export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => {
    // Initialize from localStorage for SSR compatibility
    if (typeof window === 'undefined') return 'en';
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'en';
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [translations, setTranslations] = useState<Record<string, string>>(
    enTranslations as Record<string, string>
  );

  const loadTranslationsForLanguage = useCallback(async (lang: string) => {
    if (lang === 'en') {
      setTranslations(enTranslations as Record<string, string>);
      return;
    }

    // NOTE: keep these as explicit imports so Next can bundle them.
    const loaders: Record<string, () => Promise<Record<string, string>>> = {
      es: async () => (await import('@/src/localization/translations/es.json')).default as Record<string, string>,
      fr: async () => (await import('@/src/localization/translations/fr.json')).default as Record<string, string>
    };

    const supported = SUPPORTED_LANGUAGES.includes(lang);
    const loader = supported ? loaders[lang] : undefined;
    if (!loader) {
      // Unknown language: fallback to English
      setTranslations(enTranslations as Record<string, string>);
      return;
    }

    try {
      const loaded = await loader();
      setTranslations(loaded);
    } catch (error) {
      console.error('Error loading translations for language:', lang, error);
      setTranslations(enTranslations as Record<string, string>);
    }
  }, []);

  /**
   * Fetch language preference from API for authenticated users
   */
  const fetchLanguageFromAPI = useCallback(async () => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        // Not authenticated, use localStorage
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/localization', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.language) {
          const apiLanguage = data.data.language;
          setLanguageState(apiLanguage);
          // Sync to localStorage as backup
          localStorage.setItem('language', apiLanguage);
        }
      } else {
        // API call failed, use localStorage
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage) {
          setLanguageState(savedLanguage);
        }
      }
    } catch (error) {
      console.error('Error fetching language from API:', error);
      // Fallback to localStorage on error
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage) {
        setLanguageState(savedLanguage);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch language from API on mount
  useEffect(() => {
    fetchLanguageFromAPI();
  }, [fetchLanguageFromAPI]);

  // Load translations when language changes (lazy-load non-English languages)
  useEffect(() => {
    loadTranslationsForLanguage(language);
  }, [language, loadTranslationsForLanguage]);

  /**
   * Set language preference (updates both API and localStorage)
   */
  const setLanguage = useCallback(async (lang: string): Promise<void> => {
    // Validate language code (basic check for ISO 639-1 format)
    if (!lang || typeof lang !== 'string' || lang.length !== 2) {
      console.error('Invalid language code:', lang);
      return;
    }

    // Update state immediately (optimistic update)
    setLanguageState(lang);
    localStorage.setItem('language', lang);

    // Try to update via API if authenticated
    if (typeof window !== 'undefined') {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          const response = await fetch('/api/localization', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ language: lang })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error updating language via API:', errorData.error || 'Unknown error');
            // State and localStorage already updated, so we continue
          }
        }
      } catch (error) {
        console.error('Error updating language via API:', error);
        // State and localStorage already updated, so we continue
      }
    }
  }, []);

  /**
   * Translation function - returns translated string for the given key
   */
  const t = useCallback((key: string): string => {
    // Look up the key in current language, fallback to English, then to key.
    const current = translations[key];
    if (current) return current;

    const fallback = (enTranslations as Record<string, string>)[key];
    if (fallback) return fallback;

    if (process.env.NODE_ENV === 'development') {
      console.warn(`Translation key not found: ${key}`);
    }
    return key;
  }, [translations]);

  const value = useMemo(() => ({
    language,
    isLoading,
    setLanguage,
    t
  }), [language, isLoading, setLanguage, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

/**
 * Hook to use the localization context
 */
export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
