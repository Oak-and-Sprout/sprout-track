'use client';

import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Switch } from '@/src/components/ui/switch';
import { cn } from '@/src/lib/utils';
import { AlertTriangle, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import {
  previewCountRows,
  totalPreviewCount,
  entityRows,
  logRows,
  logTotals,
  mediaRows,
  droppedRows,
} from '@/src/utils/migration-display';
import { migrationImportStyles as s } from './migration-import.styles';
import { MigrationImportProps } from './migration-import.types';
import './migration-import.css';

/**
 * MigrationImport — shared, presentational driver for both import paths
 * (sysadmin family-manager and first-run setup wizard). It renders, in order:
 * manifest preview -> mode select -> append warning + dedup toggle -> confirm ->
 * report. The wrapper owns file upload, network calls, and mode-specific fields
 * (injected via `children`); this component is dumb and fully prop-driven.
 */
const MigrationImport: React.FC<MigrationImportProps> = ({
  manifestPreview,
  mode,
  onModeChange,
  dedup,
  onDedupChange,
  onConfirm,
  report,
  allowModeSelect = true,
  confirming = false,
  confirmDisabled = false,
  children,
}) => {
  const { t } = useLocalization();

  // --- Step 3: report ------------------------------------------------------
  if (report) {
    const entities = entityRows(report);
    const logs = logRows(report);
    const totals = logTotals(report);
    const media = mediaRows(report);
    const dropped = droppedRows(report);

    return (
      <div className={s.container}>
        <div className={s.reportHeader}>
          <CheckCircle2 size={18} className="text-teal-600" aria-hidden="true" />
          {t('Import complete')}
        </div>

        <div className={s.card}>
          <div className={s.cardTitle}>{t('People & catalog')}</div>
          {entities.map((row) => (
            <div key={row.key} className={s.reportRow}>
              <span className={s.reportRowLabel}>{t(row.label)}</span>
              <span className={s.reportRowValue}>
                {t('{created} added').replace('{created}', String(row.created))}
                {report.mode === 'append' && `, ${t('{matched} matched').replace('{matched}', String(row.matched))}`}
              </span>
            </div>
          ))}
        </div>

        <div className={s.card}>
          <div className={s.cardTitle}>{t('Logs')}</div>
          {logs.length === 0 ? (
            <p className={s.reportSubtle}>{t('No log entries were imported.')}</p>
          ) : (
            logs.map((row) => (
              <div key={row.key} className={s.reportRow}>
                <span className={s.reportRowLabel}>{t(row.label)}</span>
                <span className={s.reportRowValue}>
                  {t('{inserted} added').replace('{inserted}', String(row.inserted))}
                  {row.skippedDuplicate > 0 &&
                    `, ${t('{skipped} skipped').replace('{skipped}', String(row.skippedDuplicate))}`}
                </span>
              </div>
            ))
          )}
          <div className={s.totalRow}>
            <span>{t('Total')}</span>
            <span className="tabular-nums">
              {t('{inserted} added').replace('{inserted}', String(totals.inserted))}
              {totals.skippedDuplicate > 0 &&
                `, ${t('{skipped} skipped').replace('{skipped}', String(totals.skippedDuplicate))}`}
            </span>
          </div>
        </div>

        {media.length > 0 && (
          <div className={s.card}>
            <div className={s.cardTitle}>{t('Media')}</div>
            {media.map((row) => (
              <div key={row.key} className={s.reportRow}>
                <span className={s.reportRowLabel}>{t(row.label)}</span>
                <span className={s.reportRowValue}>
                  {t('{migrated} migrated').replace('{migrated}', String(row.migrated))}
                  {row.skippedOverQuota > 0 &&
                    `, ${t('{skipped} over quota').replace('{skipped}', String(row.skippedOverQuota))}`}
                  {row.skippedDecryptError > 0 &&
                    `, ${t('{skipped} unreadable').replace('{skipped}', String(row.skippedDecryptError))}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {(dropped.length > 0 || report.warnings.length > 0) && (
          <div className={s.warnings}>
            {dropped.map((row) => (
              <p key={row.key} className={s.warningItem}>
                {t(row.label)}: {row.count}
              </p>
            ))}
            {report.warnings.map((w, i) => (
              <p key={`w-${i}`} className={s.warningItem}>{w}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Steps 1–2: preview + options ----------------------------------------
  if (!manifestPreview) return null;

  const counts = previewCountRows(manifestPreview.counts);
  const total = totalPreviewCount(manifestPreview.counts);
  const exportedAt = new Date(manifestPreview.exportedAt);

  return (
    <div className={s.container}>
      <div className={s.card}>
        <div className={s.cardTitle}>
          <Database size={16} className="inline mr-1.5 -mt-0.5 text-teal-600" aria-hidden="true" />
          {manifestPreview.family.name}
        </div>
        <div className={s.meta}>
          {t('Link')}: /{manifestPreview.family.slug}
          {' · '}
          {t('Exported')}: {isNaN(exportedAt.getTime()) ? manifestPreview.exportedAt : exportedAt.toLocaleDateString()}
          {manifestPreview.features.photos && ` · ${t('Includes photos')}`}
        </div>
        <div className={s.countGrid}>
          {counts.map((row) => (
            <div key={row.key} className={s.countRow}>
              <span className={s.countLabel}>{t(row.label)}</span>
              <span className={s.countValue}>{row.count}</span>
            </div>
          ))}
        </div>
        <div className={s.totalRow}>
          <span>{t('Total records')}</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>

      {allowModeSelect && (
        <div>
          <div className={s.sectionLabel}>{t('Where should this go?')}</div>
          <div className={cn(s.modeGroup, 'mt-2')}>
            {(['new-family', 'append'] as const).map((m) => (
              <label key={m} className={cn(s.modeOption, mode === m && s.modeOptionActive)}>
                <input
                  type="radio"
                  name="migration-import-mode"
                  className="mt-1"
                  checked={mode === m}
                  onChange={() => onModeChange(m)}
                />
                <span>
                  <span className={s.modeOptionTitle}>
                    {m === 'new-family' ? t('Create a new family') : t('Append to an existing family')}
                  </span>
                  <span className={cn(s.modeOptionDesc, 'block')}>
                    {m === 'new-family'
                      ? t('Import everything into a brand-new family.')
                      : t('Merge these records into a family that already exists.')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {children}

      {mode === 'append' && (
        <>
          <div className={s.warning}>
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{t('This imports data that may duplicate existing records in the target family.')}</span>
          </div>
          <div className={s.toggleRow}>
            <span className={s.toggleText}>
              <span className={cn(s.toggleTitle, 'block')}>{t('Skip duplicate entries')}</span>
              <span className={s.toggleDesc}>
                {dedup
                  ? t('On — entries matching an existing record by natural key are skipped.')
                  : t('Off — every entry is inserted, even if it duplicates an existing one.')}
              </span>
            </span>
            <Switch checked={dedup} onCheckedChange={onDedupChange} aria-label={t('Skip duplicate entries')} />
          </div>
        </>
      )}

      <Button
        type="button"
        onClick={onConfirm}
        disabled={confirming || confirmDisabled}
        className={s.confirmButton}
      >
        {confirming ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            {t('Importing…')}
          </>
        ) : (
          t('Import this data')
        )}
      </Button>
    </div>
  );
};

export default MigrationImport;
export { MigrationImport };
