'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Upload, Loader2, X, CloudDownload } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import MigrationImport from '@/src/components/modals/MigrationImport';
import type { MigrationPreview } from '@/src/components/modals/MigrationImport/migration-import.types';
import type { MigrationReport } from '@/src/types/family-migration';

/**
 * SetupImportPanel — first-run "Import from a hosted export" option, shown beside
 * the existing restore-initial path in the setup wizard's Family stage. Always
 * new-family mode (empty instance): no dedup toggle, no family picker — upload +
 * confirm + report. Calls `POST /api/database/import-family-initial` (setup-token
 * / sysadmin auth). On success it clears any local auth and returns to the login
 * page so the user signs in to the freshly imported family.
 */
const SetupImportPanel: React.FC = () => {
  const { t } = useLocalization();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
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

  const runPreview = async (selected: File) => {
    setPreviewing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', selected);
      form.append('step', 'preview');
      const res = await fetch('/api/database/import-family-initial', { method: 'POST', headers: getAuthHeaders(), body: form });
      const data = await res.json();
      if (data.success) {
        setPreview(data.data.preview);
        setNewFamily({ name: data.data.preview.family.name, slug: data.data.preview.family.slug });
      } else {
        setError(data.error || t('Failed to read the migration file'));
      }
    } catch {
      setError(t('Failed to read the migration file'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setReport(null);
    void runPreview(selected);
  };

  const handleConfirm = async () => {
    if (!file) return;
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
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {!expanded ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => setExpanded(true)}>
          <CloudDownload className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('Import from a hosted export')}
        </Button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('Move a family here from a hosted Sprout Track account by uploading its migration file.')}
          </p>

          <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileChange} className="hidden" />
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={previewing || confirming}>
              {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4 mr-2" aria-hidden="true" />}
              {file ? t('Choose a different file') : t('Choose migration file')}
            </Button>
            {file && <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[55%]">{file.name}</span>}
          </div>

          {error && (
            <div className="flex items-center p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              <X className="h-4 w-4 mr-2 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
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
            confirming={confirming}
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
            <Button type="button" variant="outline" className="w-full" onClick={() => setExpanded(false)} disabled={confirming}>
              {t('Cancel')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SetupImportPanel;
