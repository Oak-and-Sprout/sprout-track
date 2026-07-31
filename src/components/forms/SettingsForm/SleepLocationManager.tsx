'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Pencil, GitMerge, Trash2, Eye, EyeOff, Loader2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
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
import { getDuplicateSuggestions, moveLocation, localizeSleepLocation } from '@/src/utils/sleepLocationUtils';
import './settings-managers.css';

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

  // `silent` skips the loading toggle so a post-mutation resync doesn't unmount
  // the list: the spinner branch would replace the optimistic reorder with a
  // flash and destroy the arrow button the keyboard user is standing on.
  const fetchLocations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, [t]);

  // Only the initial mount fetch shows the spinner; every refetch below is silent.
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Arrow buttons keyed `${name}:up` / `${name}:down`, so focus can be restored
  // after a reorder re-renders the list rows in their new positions.
  const moveButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingMoveFocusRef = useRef<string | null>(null);

  // Restore focus to the arrow that was pressed. Deferred until `busy` clears,
  // because the arrows are disabled while the save is in flight and a disabled
  // button cannot take focus.
  useEffect(() => {
    if (busy) return;
    const key = pendingMoveFocusRef.current;
    if (!key) return;
    pendingMoveFocusRef.current = null;
    const button = moveButtonRefs.current[key];
    if (button && !button.disabled) {
      button.focus();
      return;
    }
    // The row reached a boundary and this arrow became disabled; move focus to
    // the opposite-direction arrow on the same row. Split from the right so a
    // location name containing ':' still resolves.
    const separator = key.lastIndexOf(':');
    const name = key.slice(0, separator);
    const direction = key.slice(separator + 1);
    moveButtonRefs.current[`${name}:${direction === 'up' ? 'down' : 'up'}`]?.focus();
  }, [locations, busy]);

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
        await fetchLocations(true);
      } else {
        errorToast(data.error, 'Failed to update sleep locations');
        // Resync from the server so any optimistic local update (e.g. reorder)
        // rolls back. A harmless redundant fetch for the non-optimistic callers.
        await fetchLocations(true);
      }
    } catch (err) {
      console.error('Error updating sleep locations:', err);
      errorToast(undefined, 'Failed to update sleep locations');
      await fetchLocations(true);
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

  const reorder = (name: string, direction: -1 | 1) => {
    // The row this button sits on is about to move; remember which arrow was
    // pressed so the effect above can put focus back on it afterwards.
    pendingMoveFocusRef.current = `${name}:${direction === -1 ? 'up' : 'down'}`;
    // Send the full resolved list — including hidden rows, since ordering is
    // independent of visibility. The first press materializes an order for a
    // family that has never reordered; later presses permute it.
    const locationOrder = moveLocation(locations.map((l) => l.name), name, direction);
    // Optimistic: a round trip per press is sluggish when moving a row several
    // slots. mutate() refetches on both success and failure, so a failed save
    // rolls this back to the server's order.
    // The non-null assertion is safe: names are unique within `locations`, and
    // moveLocation returns a permutation of the very names mapped out of it.
    setLocations(locationOrder.map((n) => locations.find((l) => l.name === n)!));
    mutate(
      () => fetch('/api/sleep-location-settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ locationOrder }),
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
        <Button variant="outline" size="sm" onClick={() => fetchLocations()}>{t('Retry')}</Button>
      </div>
    );
  }

  return (
    <div>
      <ul className="settings-manager-list rounded-xl border-2 border-slate-200 divide-y divide-gray-200 overflow-hidden">
        {locations.map((location, index) => (
          <LocationRow
            key={location.name}
            location={location}
            allLocations={locations}
            duplicateTarget={duplicateOf.get(location.name)}
            action={action?.name === location.name ? action : null}
            setAction={setAction}
            busy={busy}
            isFirst={index === 0}
            isLast={index === locations.length - 1}
            moveButtonRefs={moveButtonRefs}
            onReorder={reorder}
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
  isFirst: boolean;
  isLast: boolean;
  moveButtonRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onReorder: (name: string, direction: -1 | 1) => void;
  onToggleHidden: (location: SleepLocationSummary) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
  t: (key: string) => string;
}

function LocationRow({
  location, allLocations, duplicateTarget, action, setAction, busy,
  isFirst, isLast, moveButtonRefs, onReorder, onToggleHidden, onRename, onDelete, t,
}: LocationRowProps) {
  const { name, count, isDefault, hidden } = location;
  // Default names are translation keys; custom names are user data shown as
  // typed. Quote values with leading/trailing whitespace so "Crib " is
  // visibly distinct from "Crib".
  const label = localizeSleepLocation(name, t);
  const displayName = name !== name.trim() ? `"${label}"` : label;
  const mergeTargets = allLocations.filter((l) => l.name !== name);
  const iconButton = 'h-7 w-7 p-0';

  return (
    <li className="px-3 py-1.5">
      <div className="flex items-center gap-2 min-h-7">
        <span className={`text-sm truncate ${name !== name.trim() ? 'font-mono' : ''} ${hidden ? 'text-gray-400 line-through' : 'text-gray-900 settings-manager-item-name'}`}>
          {displayName}
        </span>
        {count > 0 && <span className="text-xs text-gray-500 whitespace-nowrap">{count} {t('uses')}</span>}
        {isDefault && <Badge variant="outline" className="text-xs">{t('Default')}</Badge>}
        {duplicateTarget !== undefined && (
          <Badge variant="error" className="text-xs">{t('Possible duplicate')}</Badge>
        )}
        <span className="flex-1" />
        {/* aria-label uses the unquoted label: the quotes around a
            whitespace-padded name are a visual cue, and a screen reader would
            otherwise announce the literal quote marks. */}
        <Button
          ref={(el) => { moveButtonRefs.current[`${name}:up`] = el; }}
          variant="ghost"
          size="sm"
          className={iconButton}
          disabled={busy || isFirst}
          onClick={() => onReorder(name, -1)}
          aria-label={`${t('Move up')}: ${label}`}
          title={t('Move up')}
        >
          <ChevronUp className="h-4 w-4 text-gray-600" aria-hidden="true" />
        </Button>
        <Button
          ref={(el) => { moveButtonRefs.current[`${name}:down`] = el; }}
          variant="ghost"
          size="sm"
          className={iconButton}
          disabled={busy || isLast}
          onClick={() => onReorder(name, 1)}
          aria-label={`${t('Move down')}: ${label}`}
          title={t('Move down')}
        >
          <ChevronDown className="h-4 w-4 text-gray-600" aria-hidden="true" />
        </Button>
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
                  {l.name !== l.name.trim()
                    ? `"${localizeSleepLocation(l.name, t)}"`
                    : localizeSleepLocation(l.name, t)}
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
