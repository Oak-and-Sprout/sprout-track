'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, GitMerge, Trash2, Loader2 } from 'lucide-react';
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
import { FoodResponse } from '@/app/api/types';
import { getFoodDuplicateSuggestions } from '@/src/utils/foodLogUtils';
import './settings-managers.css';

type RowAction =
  | { id: string; type: 'rename'; value: string }
  | { id: string; type: 'merge'; targetId: string }
  | { id: string; type: 'delete' };

const authHeaders = (): Record<string, string> => {
  const authToken = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': authToken ? `Bearer ${authToken}` : '',
  };
};

export default function FoodManager() {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [foods, setFoods] = useState<FoodResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<RowAction | null>(null);

  const fetchFoods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/food', { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error);
      }
      setFoods(data.data);
    } catch (err) {
      console.error('Error fetching foods:', err);
      setError(t('Failed to load foods'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const duplicateOf = useMemo(
    () => new Map(
      getFoodDuplicateSuggestions(
        foods.map((f) => ({ id: f.id, name: f.name, count: f.foodLogCount ?? 0 })),
      ).map((s) => [s.id, s.mergeIntoId]),
    ),
    [foods],
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
        await fetchFoods();
      } else {
        errorToast(data.error, 'Failed to update foods');
      }
    } catch (err) {
      console.error('Error updating foods:', err);
      errorToast(undefined, 'Failed to update foods');
    } finally {
      setBusy(false);
    }
  };

  const renameFood = (id: string, name: string) => {
    mutate(
      () => fetch(`/api/food?id=${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      }),
      () => setAction(null),
    );
  };

  const mergeFood = (sourceFoodId: string, targetFoodId: string) => {
    mutate(
      () => fetch('/api/food/merge', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sourceFoodId, targetFoodId }),
      }),
      (data) => {
        setAction(null);
        if (data.movedCount > 0) {
          showToast({
            variant: 'success',
            message: `${t('Updated')} ${data.movedCount} ${t('food entries')}`,
            duration: 5000,
          });
        }
      },
    );
  };

  const deleteFood = (id: string) => {
    mutate(
      () => fetch(`/api/food?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
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
        <Button variant="outline" size="sm" onClick={fetchFoods}>{t('Retry')}</Button>
      </div>
    );
  }

  if (foods.length === 0) {
    return <p className="text-sm text-gray-500 py-2">{t('No foods logged yet')}</p>;
  }

  return (
    <ul className="rounded-xl border-2 border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {foods.map((food) => (
        <FoodRow
          key={food.id}
          food={food}
          allFoods={foods}
          duplicateTargetId={duplicateOf.get(food.id)}
          action={action?.id === food.id ? action : null}
          setAction={setAction}
          busy={busy}
          onRename={renameFood}
          onMerge={mergeFood}
          onDelete={deleteFood}
          t={t}
        />
      ))}
    </ul>
  );
}

interface FoodRowProps {
  food: FoodResponse;
  allFoods: FoodResponse[];
  duplicateTargetId: string | undefined;
  action: RowAction | null;
  setAction: (action: RowAction | null) => void;
  busy: boolean;
  onRename: (id: string, name: string) => void;
  onMerge: (sourceFoodId: string, targetFoodId: string) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}

function FoodRow({
  food, allFoods, duplicateTargetId, action, setAction, busy,
  onRename, onMerge, onDelete, t,
}: FoodRowProps) {
  const { id, name, commonAllergen } = food;
  const count = food.foodLogCount ?? 0;
  const mergeTargets = allFoods.filter((f) => f.id !== id);
  const iconButton = 'h-7 w-7 p-0';

  return (
    <li className="px-3 py-1.5">
      <div className="flex items-center gap-2 min-h-7">
        <span className="text-sm text-gray-900 settings-manager-item-name truncate">{name}</span>
        {count > 0 && <span className="text-xs text-gray-500 whitespace-nowrap">{count} {t('tries')}</span>}
        {commonAllergen && <Badge variant="warning" className="text-xs">{t('Common allergen')}</Badge>}
        {duplicateTargetId !== undefined && (
          <Badge variant="error" className="text-xs">{t('Possible duplicate')}</Badge>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={iconButton}
          disabled={busy}
          onClick={() => setAction({ id, type: 'rename', value: name })}
          aria-label={`${t('Rename food')}: ${name}`}
          title={t('Rename food')}
        >
          <Pencil className="h-4 w-4 text-gray-600" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={iconButton}
          disabled={busy}
          onClick={() => setAction({ id, type: 'merge', targetId: duplicateTargetId ?? '' })}
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
            onClick={() => setAction({ id, type: 'delete' })}
            aria-label={`${t('Delete unused food')}: ${name}`}
            title={t('Delete unused food')}
          >
            <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
          </Button>
        )}
      </div>

      {action?.type === 'rename' && (
        <div className="flex items-center gap-2 pb-1">
          <Input
            value={action.value}
            onChange={(e) => setAction({ ...action, value: e.target.value })}
            aria-label={t('New food name')}
            className="h-8 max-w-xs"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busy || action.value.trim() === '' || action.value.trim() === name}
            onClick={() => onRename(id, action.value)}
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
            value={action.targetId}
            onValueChange={(targetId) => setAction({ ...action, targetId })}
          >
            <SelectTrigger className="h-8 max-w-xs" aria-label={t('Merge into')}>
              <SelectValue placeholder={t('Merge into…')} />
            </SelectTrigger>
            <SelectContent>
              {mergeTargets.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {action.targetId !== '' && count > 0 && (
            <span className="text-xs text-gray-500">
              {t('This will update')} {count} {t('food entries')}
            </span>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            disabled={busy || action.targetId === ''}
            onClick={() => onMerge(id, action.targetId)}
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
          <span className="text-xs text-gray-500">{t('Delete unused food')}?</span>
          <Button variant="destructive" size="sm" className="h-8" disabled={busy} onClick={() => onDelete(id)}>
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
