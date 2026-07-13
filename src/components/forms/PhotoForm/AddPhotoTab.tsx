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
import { uploadPhotos, createPhotoLog, fetchPhotoLog, updatePhotoLog, deletePhotoLog, unlinkPhoto } from '@/src/utils/photoClientApi';
import { MilestoneResponse, PhotoResponse } from '@/app/api/types';

interface AddPhotoTabProps {
  babyId: string | undefined;
  initialTime: string;
  activity?: { photoLogId: string };
  onClose: () => void;
  onSuccess?: () => void;
  refreshTrigger: number;
}

export default function AddPhotoTab({ babyId, initialTime, activity, onClose, onSuccess }: AddPhotoTabProps) {
  const { t } = useLocalization();
  const { toUTCString } = useTimezone();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PhotoResponse[]>([]);
  const [takenAt, setTakenAt] = useState(initialTime);
  const [userTouchedTime, setUserTouchedTime] = useState(false);
  const [caption, setCaption] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<{ fileName: string; error: string }[]>([]);
  const takenAtDate = useMemo(() => new Date(takenAt), [takenAt]);

  // Edit mode: load the existing photo log
  useEffect(() => {
    if (!activity) return;
    fetchPhotoLog(activity.photoLogId)
      .then((log) => {
        setExistingPhotos(log.photos);
        setTakenAt(log.time);
        setCaption(log.photos[0]?.caption || '');
        setMilestoneId(log.photos[0]?.milestoneId || '');
      })
      .catch(() => setError(t('Failed to load photo entry')));
  }, [activity]);

  // Milestone options for this baby (match the endpoint MilestoneForm uses)
  useEffect(() => {
    if (!babyId) return;
    const token = localStorage.getItem('authToken');
    fetch(`/api/milestone-log?babyId=${babyId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((res) => res.json())
      .then((payload) => setMilestones(payload.success ? payload.data : []))
      .catch(() => setMilestones([]));
  }, [babyId]);

  const handleSave = async () => {
    if (!babyId) return;
    setSaving(true);
    setError(null);
    setFileErrors([]);
    try {
      let photoIds = existingPhotos.map((p) => p.id);
      if (pendingFiles.length > 0) {
        const result = await uploadPhotos(pendingFiles, {
          babyId,
          // Untouched time -> omit so server EXIF wins (spec section 4)
          ...(userTouchedTime && { takenAt }),
          caption: caption.trim() || undefined,
          milestoneId: milestoneId || undefined,
        });
        setFileErrors(result.errors);
        photoIds = [...photoIds, ...result.photos.map((p) => p.id)];
        if (photoIds.length === 0) {
          setError(result.errors[0]?.error || t('Failed to upload photos'));
          return;
        }
      }
      if (photoIds.length === 0) {
        setError(t('Add at least one photo'));
        return;
      }
      if (activity) {
        await updatePhotoLog(activity.photoLogId, { time: takenAt, photoIds });
      } else {
        await createPhotoLog({ babyId, time: userTouchedTime ? takenAt : initialTime, photoIds });
      }
      onSuccess?.();
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
          <p key={fe.fileName} className="mt-1 text-xs text-red-500">
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
            {milestones.map((m) => (
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
