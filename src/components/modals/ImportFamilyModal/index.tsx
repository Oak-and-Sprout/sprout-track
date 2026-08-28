'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Upload, Loader2, X } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { authFetch } from '@/src/components/familymanager/utils';
import MigrationImport from '@/src/components/modals/MigrationImport';
import type { MigrationPreview } from '@/src/components/modals/MigrationImport/migration-import.types';
import type { ImportMode, MigrationReport } from '@/src/types/family-migration';
import { importFamilyModalStyles as s } from './import-family-modal.styles';
import { ImportFamilyModalProps } from './import-family-modal.types';
import './import-family-modal.css';

/**
 * Sysadmin, per-family migration import (family-manager surface). Uploads a
 * migration zip, previews the manifest, lets the admin create a new family or
 * append to an existing one (with the dedup toggle), then runs the import and
 * renders the report. Calls `POST /api/database/import-family` (withSysAdminAuth).
 */
const ImportFamilyModal: React.FC<ImportFamilyModalProps> = ({ isOpen, onClose, onImported }) => {
  const { t } = useLocalization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ImportMode>('new-family');
  const [newFamily, setNewFamily] = useState({ name: '', slug: '' });
  const [families, setFamilies] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [targetFamilyId, setTargetFamilyId] = useState('');
  const [dedup, setDedup] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<MigrationReport | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    setMode('new-family');
    setNewFamily({ name: '', slug: '' });
    setTargetFamilyId('');
    setDedup(true);
    setConfirming(false);
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reset();
    // Family list for the append picker.
    authFetch('/api/family/manage')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setFamilies(d.data.map((f: { id: string; name: string; slug: string }) => ({ id: f.id, name: f.name, slug: f.slug })));
      })
      .catch(() => {});
  }, [isOpen, reset]);

  const runPreview = async (selected: File) => {
    setPreviewing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', selected);
      form.append('step', 'preview');
      const res = await authFetch('/api/database/import-family', { method: 'POST', body: form });
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
      form.append('mode', mode);
      if (mode === 'append') {
        form.append('targetFamilyId', targetFamilyId);
        form.append('dedup', dedup ? 'true' : 'false');
      } else {
        form.append('newFamily', JSON.stringify(newFamily));
      }
      const res = await authFetch('/api/database/import-family', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setReport(data.data.report);
        onImported?.();
      } else {
        setError(data.error || t('Import failed'));
      }
    } catch {
      setError(t('Import failed'));
    } finally {
      setConfirming(false);
    }
  };

  const confirmDisabled =
    mode === 'append'
      ? !targetFamilyId
      : !newFamily.name.trim() || !newFamily.slug.trim();

  return (
    <FormPage isOpen={isOpen} onClose={onClose} title={t('Import a family')} description={t('Import a family from a hosted Sprout Track export.')}>
      <FormPageContent className="space-y-5 overflow-y-auto flex-1 pb-24">
        {/* Upload */}
        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileChange} className="hidden" />
        <div className={s.uploadRow}>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={previewing || confirming}>
            {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4 mr-2" aria-hidden="true" />}
            {file ? t('Choose a different file') : t('Choose migration file')}
          </Button>
          {file && <span className={s.fileName}>{file.name}</span>}
        </div>

        {error && (
          <div className={s.error}>
            <X className="h-4 w-4 mr-2 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <MigrationImport
          manifestPreview={preview}
          mode={mode}
          onModeChange={setMode}
          dedup={dedup}
          onDedupChange={setDedup}
          onConfirm={handleConfirm}
          report={report}
          confirming={confirming}
          confirmDisabled={confirmDisabled}
        >
          {preview && !report && mode === 'new-family' && (
            <div className={s.fields}>
              <div>
                <Label htmlFor="import-new-name" className="text-sm font-medium">{t('New family name')}</Label>
                <Input id="import-new-name" value={newFamily.name} onChange={(e) => setNewFamily((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="import-new-slug" className="text-sm font-medium">{t('New family link')}</Label>
                <Input id="import-new-slug" className="font-mono" value={newFamily.slug} onChange={(e) => setNewFamily((p) => ({ ...p, slug: e.target.value.toLowerCase() }))} />
              </div>
            </div>
          )}
          {preview && !report && mode === 'append' && (
            <div className={s.fields}>
              <Label htmlFor="import-target" className="text-sm font-medium">{t('Target family')}</Label>
              <select
                id="import-target"
                className={s.select}
                value={targetFamilyId}
                onChange={(e) => setTargetFamilyId(e.target.value)}
              >
                <option value="">{t('Select a family…')}</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} (/{f.slug})</option>
                ))}
              </select>
            </div>
          )}
        </MigrationImport>
      </FormPageContent>

      <FormPageFooter>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {report ? t('Done') : t('Cancel')}
          </Button>
        </div>
      </FormPageFooter>
    </FormPage>
  );
};

export default ImportFamilyModal;
