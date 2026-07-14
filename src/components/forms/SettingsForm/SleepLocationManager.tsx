'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, GitMerge, Trash2, Eye, EyeOff, Loader2, Plus } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { SleepLocationSummary } from '@/app/api/types';
import { getDuplicateSuggestions } from '@/src/utils/sleepLocationUtils';

type RowAction =
  | { name: string; type: 'rename'; value: string }
  | { name: string; type: 'merge'; target: string }
  | { name: string; type: 'delete' };

const authHeaders = (): Record<string, string> => {
  const authToken = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': authToken ? `Bearer ${authToken}` : '',
  };
};

export default function SleepLocationManager() {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [locations, setLocations] = useState<SleepLocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<RowAction | null>(null);
  const [newName, setNewName] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/sleep-locations', { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error);
      }
      setLocations(data.data);
    } catch (err) {
      console.error('Error fetching sleep locations:', err);
      setError(t('Failed to load sleep locations'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const duplicateOf = useMemo(
    () => new Map(getDuplicateSuggestions(locations).map((s) => [s.name, s.mergeInto])),
    [locations],
  );

  const errorToast = (serverError: string | undefined, fallback: string) => {
    showToast({
      variant: 'error',
      title: t('Error'),
      message: serverError ? t(serverError) : t(fallback),
      duration: 5000,
    });
  };

  const mutate = async (
    doRequest: () => Promise<Response>,
    onSuccess: (data: any) => void,
  ) => {
    try {
      setBusy(true);
      const response = await doRequest();
      const data = await response.json();
      if (response.ok && data.success) {
        onSuccess(data.data);
        await fetchLocations();
      } else {
        errorToast(data.error, 'Failed to update sleep locations');
      }
    } catch (err) {
      console.error('Error updating sleep locations:', err);
      errorToast(undefined, 'Failed to update sleep locations');
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = (location: SleepLocationSummary) => {
    const hidden = locations.filter((l) => l.hidden).map((l) => l.name);
    const hiddenLocations = location.hidden
      ? hidden.filter((h) => h !== location.name)
      : [...hidden, location.name];
    mutate(
      () => fetch('/api/sleep-location-settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ hiddenLocations }),
      }),
      () => {},
    );
  };

  const addLocation = (name: string) => {
    mutate(
      () => fetch('/api/sleep-locations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      }),
      () => setNewName(null),
    );
  };

  const renameLocation = (from: string, to: string) => {
    mutate(
      () => fetch('/api/sleep-locations', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ from, to }),
      }),
      (data) => {
        setAction(null);
        if (data.updatedCount > 0) {
          showToast({
            variant: 'success',
            message: `${t('Updated')} ${data.updatedCount} ${t('sleep entries')}`,
            duration: 5000,
          });
        }
      },
    );
  };

  const deleteLocation = (name: string) => {
    mutate(
      () => fetch('/api/sleep-locations', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      }),
      () => setAction(null),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('Loading...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 py-2">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchLocations}>{t('Retry')}</Button>
      </div>
    );
  }

  return (
    <div>
      <ul className="rounded-xl border-2 border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {locations.map((location) => (
          <LocationRow
            key={location.name}
            location={location}
            allLocations={locations}
            duplicateTarget={duplicateOf.get(location.name)}
            action={action?.name === location.name ? action : null}
            setAction={setAction}
            busy={busy}
            onToggleHidden={toggleHidden}
            onRename={renameLocation}
            onDelete={deleteLocation}
            t={t}
          />
        ))}
      </ul>
      {newName === null ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={busy}
          onClick={() => setNewName('')}
        >
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('Add location')}
        </Button>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('New location name')}
            aria-label={t('New location name')}
            className="h-8 max-w-xs"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy || newName.trim() === ''}
            onClick={() => addLocation(newName.trim())}
          >
            {t('Save')}
          </Button>
          <Button variant="ghost" size="sm" className="h-8" disabled={busy} onClick={() => setNewName(null)}>
            {t('Cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

interface LocationRowProps {
  location: SleepLocationSummary;
  allLocations: SleepLocationSummary[];
  duplicateTarget: string | undefined;
  action: RowAction | null;
  setAction: (action: RowAction | null) => void;
  busy: boolean;
  onToggleHidden: (location: SleepLocationSummary) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
  t: (key: string) => string;
}

function LocationRow({
  location, allLocations, duplicateTarget, action, setAction, busy,
  onToggleHidden, onRename, onDelete, t,
}: LocationRowProps) {
  const { name, count, isDefault, hidden } = location;
  // Quote values with leading/trailing whitespace so "Crib " is visibly distinct from "Crib"
  const displayName = name !== name.trim() ? `"${name}"` : name;
  const mergeTargets = allLocations.filter((l) => l.name !== name);
  const iconButton = 'h-7 w-7 p-0';

  return (
    <li className="px-3 py-1.5">
      <div className="flex items-center gap-2 min-h-7">
        <span className={`text-sm truncate ${name !== name.trim() ? 'font-mono' : ''} ${hidden ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {displayName}
        </span>
        {count > 0 && <span className="text-xs text-gray-500 whitespace-nowrap">{count} {t('uses')}</span>}
        {isDefault && <Badge variant="outline" className="text-xs">{t('Default')}</Badge>}
        {duplicateTarget !== undefined && (
          <Badge variant="error" className="text-xs">{t('Possible duplicate')}</Badge>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={iconButton}
          disabled={busy}
          onClick={() => onToggleHidden(location)}
          aria-label={`${hidden ? t('Show') : t('Hide')} ${name}`}
          title={hidden ? t('Show') : t('Hide')}
        >
          {hidden
            ? <EyeOff className="h-4 w-4 text-gray-400" aria-hidden="true" />
            : <Eye className="h-4 w-4 text-gray-600" aria-hidden="true" />}
        </Button>
        {!isDefault && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={iconButton}
              disabled={busy}
              onClick={() => setAction({ name, type: 'rename', value: name.trim() })}
              aria-label={`${t('Rename location')}: ${name}`}
              title={t('Rename location')}
            >
              <Pencil className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={iconButton}
              disabled={busy}
              onClick={() => setAction({ name, type: 'merge', target: duplicateTarget ?? '' })}
              aria-label={`${t('Merge into')}: ${name}`}
              title={t('Merge into')}
            >
              <GitMerge className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </Button>
            {count === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={iconButton}
                disabled={busy}
                onClick={() => setAction({ name, type: 'delete' })}
                aria-label={`${t('Delete unused location')}: ${name}`}
                title={t('Delete unused location')}
              >
                <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
              </Button>
            )}
          </>
        )}
      </div>

      {action?.type === 'rename' && (
        <div className="flex items-center gap-2 pb-1">
          <Input
            value={action.value}
            onChange={(e) => setAction({ ...action, value: e.target.value })}
            aria-label={t('New location name')}
            className="h-8 max-w-xs"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy || action.value.trim() === '' || action.value.trim() === name}
            onClick={() => onRename(name, action.value)}
          >
            {t('Save')}
          </Button>
          <Button variant="ghost" size="sm" className="h-8" disabled={busy} onClick={() => setAction(null)}>
            {t('Cancel')}
          </Button>
        </div>
      )}

      {action?.type === 'merge' && (
        <div className="flex items-center gap-2 flex-wrap pb-1">
          <Select
            value={action.target}
            onValueChange={(target) => setAction({ ...action, target })}
          >
            <SelectTrigger className="h-8 max-w-xs" aria-label={t('Merge into')}>
              <SelectValue placeholder={t('Merge into…')} />
            </SelectTrigger>
            <SelectContent>
              {mergeTargets.map((l) => (
                <SelectItem key={l.name} value={l.name}>
                  {l.name !== l.name.trim() ? `"${l.name}"` : l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {action.target !== '' && count > 0 && (
            <span className="text-xs text-gray-500">
              {t('This will update')} {count} {t('sleep entries')}
            </span>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            disabled={busy || action.target === ''}
            onClick={() => onRename(name, action.target)}
          >
            {t('Merge')}
          </Button>
          <Button variant="ghost" size="sm" className="h-8" disabled={busy} onClick={() => setAction(null)}>
            {t('Cancel')}
          </Button>
        </div>
      )}

      {action?.type === 'delete' && (
        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs text-gray-500">{t('Delete unused location')}?</span>
          <Button variant="destructive" size="sm" className="h-8" disabled={busy} onClick={() => onDelete(name)}>
            {t('Delete')}
          </Button>
          <Button variant="ghost" size="sm" className="h-8" disabled={busy} onClick={() => setAction(null)}>
            {t('Cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}
