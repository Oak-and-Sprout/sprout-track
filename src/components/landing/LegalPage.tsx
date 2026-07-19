'use client';

import React, { useState, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';
import { renderMarkdown } from '@/src/utils/landing-markdown';

interface LegalPageProps {
  file: string; // e.g. '/terms_of_use.md'
}

/** Fetches a legal markdown file from public/ and renders it page-styled. */
export function LegalPage({ file }: LegalPageProps) {
  const { t } = useLocalization();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(file)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch legal content');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching legal content:', error);
        if (!cancelled) {
          setContent(t('Failed to load content.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file, t]);

  return (
    <main className="ld-legal">
      {loading ? <p>{t('Loading...')}</p> : renderMarkdown(content)}
    </main>
  );
}
