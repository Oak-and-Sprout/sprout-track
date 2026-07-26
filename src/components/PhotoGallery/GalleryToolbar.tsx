'use client';

import React from 'react';
import { Search, Heart, Trash2 } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { useLocalization } from '@/src/context/localization';
import { GalleryTypeFilter } from '@/src/utils/photoGalleryUtils';
import { GalleryGrouping, GalleryToolbarProps } from './photo-gallery.types';

const GROUPINGS: { value: GalleryGrouping; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'milestone', label: 'Milestone' },
];

const TYPE_CHIPS: { value: GalleryTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'feed', label: 'Feeds' },
  { value: 'bath', label: 'Bath' },
  { value: 'milestone', label: 'Milestones' },
];

/**
 * Gallery controls: grouping segmented control, search, type/favorites
 * chips, captions toggle, select mode toggle, and a trash indicator.
 * Purely controlled — all state lives in the `PhotoGallery` container.
 */
export default function GalleryToolbar({ state, onStateChange, trashCount }: GalleryToolbarProps) {
  const { t } = useLocalization();

  return (
    <div className="flex flex-col gap-3 photo-gallery-toolbar">
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input
          type="search"
          value={state.query}
          onChange={(e) => onStateChange({ query: e.target.value })}
          placeholder={t('Search captions, milestones…')}
          aria-label={t('Search captions, milestones…')}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('Group by')} className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5 photo-gallery-seg">
          {GROUPINGS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={state.grouping === g.value}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors photo-gallery-seg-btn ${
                state.grouping === g.value ? 'bg-teal-600 text-white active' : 'text-gray-600'
              }`}
              onClick={() => onStateChange({ grouping: g.value })}
            >
              {t(g.label)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 photo-gallery-chip"
            onClick={() => onStateChange({ selectMode: !state.selectMode, selectedIds: new Set() })}
          >
            {state.selectMode ? t('Cancel') : t('Select')}
          </button>

          <button
            type="button"
            title={t('Trash')}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 photo-gallery-chip"
            onClick={() => onStateChange({ view: 'trash', selectMode: false, selectedIds: new Set() })}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Trash')}
            {trashCount > 0 && (
              <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-700 photo-gallery-trash-badge">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 photo-gallery-filter-label">{t('Filter:')}</span>
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={state.typeFilter === chip.value}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors photo-gallery-chip ${
              state.typeFilter === chip.value
                ? 'border-teal-600 bg-teal-600 text-white active'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => onStateChange({ typeFilter: chip.value })}
          >
            {t(chip.label)}
          </button>
        ))}

        <button
          type="button"
          aria-pressed={state.favoritesOnly}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors photo-gallery-chip ${
            state.favoritesOnly
              ? 'border-teal-600 bg-teal-600 text-white active'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => onStateChange({ favoritesOnly: !state.favoritesOnly })}
        >
          <Heart className="h-3 w-3" fill={state.favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
          {t('Favorites')}
        </button>

        <button
          type="button"
          aria-pressed={state.showCaptions}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors photo-gallery-chip ${
            state.showCaptions
              ? 'border-teal-600 bg-teal-600 text-white active'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => onStateChange({ showCaptions: !state.showCaptions })}
        >
          {t('Captions')}
        </button>
      </div>
    </div>
  );
}
