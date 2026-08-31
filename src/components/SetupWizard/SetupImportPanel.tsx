'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import MigrationImport from '@/src/components/modals/MigrationImport';
import type { MigrationPreview } from '@/src/components/modals/MigrationImport/migration-import.types';
import type { MigrationReport } from '@/src/types/family-migration';

interface SetupImportPanelProps {
  /** The migration export the unified import button detected and handed off. */
  file: File;
  /** Dismiss the panel and clear the picked file in the parent. */
  onCancel: () => void;
}

/**
 * SetupImportPanel — first-run "import a hosted single-family export" flow. It no
 * longer owns a file picker: the setup wizard's single import button inspects the
 * chosen file and, when it is a family export, mounts this panel with that `file`.
 * Always new-family mode (empty instance): no dedup toggle, no family picker —
 * preview + confirm + report. Calls `POST /api/database/import-family-initial`
 * (setup-token / sysadmin auth). On success it clears any local auth and returns to
 * the login page so the user signs in to the freshly imported family.
 */
const SetupImportPanel: React.FC<SetupImportPanelProps> = ({ file, onCancel }) => {
  const { t } = useLocalization();
  const router = useRouter();

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [newFamily, setNewFamily] = useState({ name: '', slug: '' });
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Preview the handed-off file as soon as it arrives (or changes).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPreviewing(true);
      setError(null);
      setReport(null);
      setPreview(null);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('step', 'preview');
        const res = await fetch('/api/database/import-family-initial', { method: 'POST', headers: getAuthHeaders(), body: form });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setPreview(data.data.preview);
          setNewFamily({ name: data.data.preview.family.name, slug: data.data.preview.family.slug });
        } else {
          setError(data.error || t('Failed to read the migration file'));
        }
      } catch {
        if (!cancelled) setError(t('Failed to read the migration file'));
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('step', 'confirm');
      form.append('newFamily', JSON.stringify(newFamily));
      const res = await fetch('/api/database/import-family-initial', { method: 'POST', headers: getAuthHeaders(), body: form });
      const data = await res.json();
      if (data.success) {
        setReport(data.data.report);
      } else {
        setError(data.error || t('Import failed'));
      }
    } catch {
      setError(t('Import failed'));
    } finally {
      setConfirming(false);
    }
  };

  const handleFinish = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('unlockTime');
    localStorage.removeItem('caretakerId');
    router.push('/');
  };

  const confirmDisabled = !newFamily.name.trim() || !newFamily.slug.trim();

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
        {t('Family export')}: <span className="font-mono">{file.name}</span>
      </p>

      {error && (
        <div className="flex items-center p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <X className="h-4 w-4 mr-2 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {previewing && !preview && !error && (
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          {t('Reading the migration file…')}
        </div>
      )}

      <MigrationImport
        manifestPreview={preview}
        mode="new-family"
        onModeChange={() => {}}
        dedup={false}
        onDedupChange={() => {}}
        onConfirm={handleConfirm}
        report={report}
        allowModeSelect={false}
        confirming={confirming || previewing}
        confirmDisabled={confirmDisabled}
      >
        {preview && !report && (
          <div className={cn('space-y-3 rounded-md border border-gray-200 dark:border-gray-700 p-3')}>
            <div>
              <Label htmlFor="setup-import-name" className="text-sm font-medium">{t('New family name')}</Label>
              <Input id="setup-import-name" value={newFamily.name} onChange={(e) => setNewFamily((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="setup-import-slug" className="text-sm font-medium">{t('New family link')}</Label>
              <Input id="setup-import-slug" className="font-mono" value={newFamily.slug} onChange={(e) => setNewFamily((p) => ({ ...p, slug: e.target.value.toLowerCase() }))} />
            </div>
          </div>
        )}
      </MigrationImport>

      {report ? (
        <Button type="button" className="w-full" onClick={handleFinish}>
          {t('Continue to login')}
        </Button>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={confirming}>
          {t('Cancel')}
        </Button>
      )}
    </div>
  );
};

export default SetupImportPanel;
