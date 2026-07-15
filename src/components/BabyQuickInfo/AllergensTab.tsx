import React, { useMemo, useState, useId } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './baby-quick-info.styles';
import { AllergensTabProps } from './baby-quick-info.types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { useFamily } from '@/src/context/family';
import { formatDateShort } from '@/src/utils/dateFormat';
import {
  mergeAllergens,
  buildLogEntryLink,
  normalizeFoodName,
  ALLERGEN_TYPE_VALUES,
  ALLERGEN_TYPE_LABELS,
  AllergenTypeValue,
} from '@/src/utils/foodLogUtils';

/**
 * AllergensTab Component
 *
 * Shows the combined allergen list for a baby: entries derived from
 * reaction-flagged food/feed logs (read-only, linked to the originating day
 * in the log timeline) merged with manually recorded allergens, which can be
 * added inline and soft-deleted.
 */
const AllergensTab: React.FC<AllergensTabProps> = ({
  selectedBaby,
  derivedAllergens,
  feedAllergens,
  manualAllergens,
  onAllergensChanged,
  onNavigate,
}) => {
  const { t } = useLocalization();
  const { formatDate, dateFormat } = useTimezone();
  const { family } = useFamily();
  const uid = useId();
  const nameId = `${uid}-allergen-name`;
  const typeId = `${uid}-allergen-type`;
  const reactionId = `${uid}-allergen-reaction`;

  // Add form state
  const [name, setName] = useState('');
  const [allergenType, setAllergenType] = useState<AllergenTypeValue>('FOOD');
  const [reactionDescription, setReactionDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const merged = useMemo(
    () => mergeAllergens(derivedAllergens, manualAllergens, feedAllergens),
    [derivedAllergens, manualAllergens, feedAllergens]
  );

  const authHeaders = (): Record<string, string> => {
    const authToken = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeFoodName(name)) return;

    setIsSaving(true);
    setFormError(null);
    try {
      const response = await fetch('/api/baby-allergen', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          babyId: selectedBaby.id,
          name,
          allergenType,
          reactionDescription: reactionDescription.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setFormError(data.error || t('Failed to save allergen'));
        return;
      }
      setName('');
      setAllergenType('FOOD');
      setReactionDescription('');
      onAllergensChanged();
    } catch {
      setFormError(t('Failed to save allergen'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setFormError(null);
    try {
      const response = await fetch(`/api/baby-allergen?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setFormError(data.error || t('Failed to delete allergen'));
        return;
      }
      onAllergensChanged();
    } catch {
      setFormError(t('Failed to delete allergen'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={cn(styles.allergensContainer, 'baby-quick-info-allergens-container')}>
      <h3 className={cn(styles.sectionTitle, 'baby-quick-info-section-title')}>
        {selectedBaby.firstName}{t('\'s Allergens')}
      </h3>

      {merged.length > 0 ? (
        <div className="space-y-2">
          {merged.map((entry) => {
            const isDerived = entry.sources.includes('food-log') || entry.sources.includes('feed');
            const logLink = entry.reactions.length > 0 && family?.slug
              ? buildLogEntryLink(family.slug, entry.reactions[0].time, selectedBaby.id)
              : null;
            return (
              <div
                key={`${entry.name ?? 'generic-feed'}-${entry.manualId ?? 'derived'}`}
                className={cn(styles.allergenItem, 'baby-quick-info-allergen-item')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className={cn(styles.allergenName, 'baby-quick-info-allergen-name')}>
                      {entry.name ?? t('Formula / bottle feed')}
                    </span>
                    {entry.manualId && (
                      <span className={cn(styles.allergenTypeBadge, 'baby-quick-info-allergen-type-badge')}>
                        {t(ALLERGEN_TYPE_LABELS[entry.allergenType])}
                      </span>
                    )}
                    {entry.commonAllergen && (
                      <span className={cn(styles.allergenBadge, 'baby-quick-info-allergen-badge')}>
                        {t('Common allergen')}
                      </span>
                    )}
                    {isDerived && (
                      <span className={cn(styles.allergenSourceTag, 'baby-quick-info-allergen-source-tag')}>
                        {entry.sources.includes('food-log') ? t('From food log') : t('From feed log')}
                      </span>
                    )}
                  </div>
                  {entry.manualId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0 text-gray-400 hover:text-red-600"
                      onClick={() => handleDelete(entry.manualId!)}
                      disabled={deletingId === entry.manualId}
                      aria-label={t('Delete allergen')}
                    >
                      {deletingId === entry.manualId ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                </div>

                {entry.reactions.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {entry.reactions.map((reaction, index) => (
                      <div key={index} className={cn(styles.allergenReaction, 'baby-quick-info-allergen-reaction')}>
                        {formatDate(reaction.time)}
                        {reaction.description ? ` — ${reaction.description}` : ''}
                      </div>
                    ))}
                  </div>
                ) : (
                  entry.reactionDescriptions.length > 0 && (
                    <div className={cn('mt-1', styles.allergenReaction, 'baby-quick-info-allergen-reaction')}>
                      {entry.reactionDescriptions.join(' • ')}
                    </div>
                  )
                )}

                {entry.notes && (
                  <div className={cn('mt-1', styles.allergenNotes, 'baby-quick-info-allergen-notes')}>
                    {entry.notes}
                  </div>
                )}

                <div className={cn('mt-1 flex items-center gap-2', styles.allergenMeta, 'baby-quick-info-allergen-meta')}>
                  <span>{t('Added')} {formatDateShort(new Date(entry.dateAdded), dateFormat)}</span>
                  {isDerived && logLink && (
                    <Link
                      href={logLink}
                      // Close the modal so the timeline underneath is visible
                      // when navigating within the log-entry page itself
                      onClick={onNavigate}
                      className="text-teal-600 hover:text-teal-700 hover:underline baby-quick-info-allergen-link"
                    >
                      {t('View in log')}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn(styles.emptyMessage, 'baby-quick-info-empty-message')}>
          {t('No known allergens')}
        </div>
      )}

      {/* Inline add form */}
      <form onSubmit={handleAdd} className={cn(styles.allergenForm, 'baby-quick-info-allergen-form')}>
        <h4 className={cn(styles.allergenFormTitle, 'baby-quick-info-allergen-form-title')}>
          {t('Add allergen')}
        </h4>
        <div>
          <Label className="form-label" htmlFor={nameId}>{t('Name')}</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Enter allergen name')}
            disabled={isSaving}
            required
          />
        </div>
        <div>
          <Label className="form-label" htmlFor={typeId}>{t('Type')}</Label>
          <Select
            value={allergenType}
            onValueChange={(value: AllergenTypeValue) => setAllergenType(value)}
            disabled={isSaving}
          >
            <SelectTrigger id={typeId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLERGEN_TYPE_VALUES.map((value) => (
                <SelectItem key={value} value={value}>{t(ALLERGEN_TYPE_LABELS[value])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="form-label" htmlFor={reactionId}>{t('Reaction description (optional)')}</Label>
          <Textarea
            id={reactionId}
            value={reactionDescription}
            onChange={(e) => setReactionDescription(e.target.value)}
            className="w-full min-h-[60px]"
            placeholder={t('Redness, swelling, hives...')}
            disabled={isSaving}
          />
        </div>
        {formError && (
          <p className={cn(styles.allergenFormError, 'baby-quick-info-allergen-form-error')} role="alert">
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 inline-block mr-1 align-text-bottom" />
            {formError}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || !normalizeFoodName(name)}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            {t('Add allergen')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AllergensTab;
