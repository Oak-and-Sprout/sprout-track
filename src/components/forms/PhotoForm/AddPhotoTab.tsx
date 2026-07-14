'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { PhotoAttachments } from '@/src/components/ui/photo-attachments';
import { uploadPhotos, createPhotoLog, fetchPhotoLog, updatePhotoLog, updatePhoto, deletePhotoLog } from '@/src/utils/photoClientApi';
import { filterTaggableMilestones } from '@/src/utils/photoUtils';
import { MilestoneResponse, PhotoResponse } from '@/app/api/types';

interface AddPhotoTabProps {
  isOpen: boolean;
  babyId: string | undefined;
  initialTime: string;
  activity?: { photoLogId: string };
  onClose: () => void;
  onSuccess?: () => void;
  refreshTrigger: number;
}

export default function AddPhotoTab({ isOpen, babyId, initialTime, activity, onClose, onSuccess }: AddPhotoTabProps) {
  const { t } = useLocalization();
  const { toUTCString } = useTimezone();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PhotoResponse[]>([]);
  const [takenAt, setTakenAt] = useState(initialTime);
  const [userTouchedTime, setUserTouchedTime] = useState(false);
  const [caption, setCaption] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [initialCaption, setInitialCaption] = useState('');
  const [initialMilestoneId, setInitialMilestoneId] = useState('');
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<{ fileName: string; error: string; index: number }[]>([]);
  // Tracks a log created mid-retry (NEW mode only) so a subsequent Save
  // after a partial upload failure updates the same log instead of
  // creating a duplicate. Reset whenever the drawer opens/resets.
  const [savedLogId, setSavedLogId] = useState<string | null>(null);
  const takenAtDate = useMemo(() => new Date(takenAt), [takenAt]);

  // Reset/load state whenever the drawer opens, for both new and edit mode.
  // FormPage keeps this tree mounted, so without this the previous open's
  // state (pending files, caption, etc.) would leak into the next open.
  useEffect(() => {
    if (!isOpen) return;
    if (activity) {
      fetchPhotoLog(activity.photoLogId)
        .then((log) => {
          setExistingPhotos(log.photos);
          setTakenAt(log.time);
          setUserTouchedTime(false);
          const loadedCaption = (log.photos[0]?.caption || '').trim();
          const loadedMilestoneId = log.photos[0]?.milestoneId || '';
          setCaption(loadedCaption);
          setMilestoneId(loadedMilestoneId);
          setInitialCaption(loadedCaption);
          setInitialMilestoneId(loadedMilestoneId);
          setPendingFiles([]);
          setFileErrors([]);
          setError(null);
          setSaving(false);
          setSavedLogId(null);
        })
        .catch(() => setError(t('Failed to load photo entry')));
    } else {
      setPendingFiles([]);
      setExistingPhotos([]);
      setTakenAt(initialTime);
      setUserTouchedTime(false);
      setCaption('');
      setMilestoneId('');
      setInitialCaption('');
      setInitialMilestoneId('');
      setFileErrors([]);
      setError(null);
      setSavedLogId(null);
    }
  }, [isOpen, activity?.photoLogId]);

  // Milestone options for this baby (match the endpoint MilestoneForm uses)
  useEffect(() => {
    if (!babyId) return;
    const token = localStorage.getItem('authToken');
    fetch(`/api/milestone-log?babyId=${babyId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((res) => res.json())
      .then((payload) => setMilestones(payload.success ? payload.data : []))
      .catch(() => setMilestones([]));
  }, [babyId]);

  // Only offer recent milestones (±10 days), but keep an already-tagged
  // older one visible so editing doesn't silently drop it.
  const taggableMilestones = useMemo(
    () => filterTaggableMilestones(milestones, new Date(), milestoneId || undefined),
    [milestones, milestoneId]
  );

  const handleSave = async () => {
    if (!babyId) return;
    setSaving(true);
    setError(null);
    setFileErrors([]);
    try {
      let photoIds = existingPhotos.map((p) => p.id);
      let uploadErrors: { fileName: string; error: string; index: number }[] = [];
      if (pendingFiles.length > 0) {
        const result = await uploadPhotos(pendingFiles, {
          babyId,
          // Untouched time -> omit so server EXIF wins (spec section 4)
          ...(userTouchedTime && { takenAt }),
          caption: caption.trim() || undefined,
          milestoneId: milestoneId || undefined,
        });
        uploadErrors = result.errors;
        setFileErrors(result.errors);
        photoIds = [...photoIds, ...result.photos.map((p) => p.id)];
        // Fold succeeded uploads into existing-photo state so a retry after
        // a partial failure doesn't re-upload them (duplicate Photo rows)
        // and only the failed files remain pending.
        if (result.photos.length > 0) {
          setExistingPhotos((prev) => [...prev, ...result.photos]);
        }
        if (result.errors.length > 0) {
          const failedIndices = new Set(result.errors.map((e) => e.index));
          setPendingFiles((prev) => prev.filter((_, i) => failedIndices.has(i)));
        } else {
          setPendingFiles([]);
        }
        if (photoIds.length === 0) {
          setError(result.errors[0]?.error || t('Failed to upload photos'));
          return;
        }
      }
      if (photoIds.length === 0) {
        setError(t('Add at least one photo'));
        return;
      }
      let patchError: string | null = null;
      // Target the same log across retries: edit mode always has one, and
      // NEW mode remembers the log created by a prior (partially failed)
      // save attempt so we update it instead of creating a duplicate.
      const logId = activity?.photoLogId ?? savedLogId;
      if (logId) {
        await updatePhotoLog(logId, { time: takenAt, photoIds });
        // updatePhotoLog only carries time/photoIds, so caption/milestone
        // edits on pre-existing photos must be patched separately. Newly
        // uploaded photos already got the caption/milestone at upload time.
        if (activity) {
          const trimmedCaption = caption.trim();
          if (trimmedCaption !== initialCaption || milestoneId !== initialMilestoneId) {
            try {
              await Promise.all(
                existingPhotos.map((p) =>
                  updatePhoto(p.id, { caption: trimmedCaption || null, milestoneId: milestoneId || null })
                )
              );
            } catch (err) {
              patchError = err instanceof Error ? err.message : t('Failed to update photo details');
            }
          }
        }
      } else {
        const created = await createPhotoLog({ babyId, time: userTouchedTime ? takenAt : initialTime, photoIds });
        setSavedLogId(created.id);
      }
      onSuccess?.();
      if (uploadErrors.length > 0 || patchError) {
        setError(
          [
            uploadErrors.length > 0 ? t('Saved, but some photos failed to upload') : null,
            patchError,
          ]
            .filter(Boolean)
            .join(' ')
        );
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to save photo entry'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    setSaving(true);
    try {
      await deletePhotoLog(activity.photoLogId);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to delete photo entry'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">{t('Photo')}</label>
        <PhotoAttachments
          pendingFiles={pendingFiles}
          onPendingFilesChange={setPendingFiles}
          existingPhotos={existingPhotos.map((p) => ({ id: p.id, caption: p.caption }))}
          onRemoveExisting={(photoId) => setExistingPhotos(existingPhotos.filter((p) => p.id !== photoId))}
        />
        {fileErrors.map((fe) => (
          <p key={`${fe.fileName}-${fe.index}`} className="mt-1 text-xs text-red-500">
            {fe.fileName}: {fe.error}
          </p>
        ))}
      </div>

      <div>
        <label className="form-label">{t('Taken — Date & Time')}</label>
        <DateTimePicker
          value={takenAtDate}
          onChange={(date) => {
            setTakenAt(toUTCString(date) || date.toISOString());
            setUserTouchedTime(true);
          }}
          disabled={saving}
          placeholder={t('Select date & time...')}
        />
      </div>

      <div>
        <label className="form-label">{t('Caption')}</label>
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("What's happening in this photo?")} />
      </div>

      <div>
        <label className="form-label">{t('Tag a Milestone')}</label>
        <Select
          value={milestoneId || 'null'}
          onValueChange={(value) => setMilestoneId(value === 'null' ? '' : value)}
          disabled={saving}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('No milestone')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">{t('No milestone')}</SelectItem>
            {taggableMilestones.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-gray-400 photo-form-hint">{t("Photos save to this day's log and to the Photos gallery.")}</p>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2">
        {activity && (
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            {t('Delete')}
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('Cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving || (pendingFiles.length === 0 && existingPhotos.length === 0)}>
          {saving ? t('Saving...') : t('Save Photo')}
        </Button>
      </div>
    </div>
  );
}
