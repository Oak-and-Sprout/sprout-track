'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Baby } from '@prisma/client';
import { Edit, ExternalLink, AlertCircle, Loader2, Plus } from 'lucide-react';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { ShareButton } from '@/src/components/ui/share-button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { useLocalization } from '@/src/context/localization';
import { Settings } from '@/app/api/types';

interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConfigTabProps {
  family: FamilyData | null;
  babies: Baby[];
  contacts: Contact[];
  loading: boolean;
  appConfig: { rootDomain: string; enableHttps: boolean } | null;
  deploymentConfig: { deploymentMode: string; enableAccounts: boolean; allowAccountRegistration: boolean; notificationsEnabled?: boolean } | null;
  settings: Settings | null;
  onSettingsChange: (updates: Partial<Settings>) => Promise<void>;
  // Family editing
  editingFamily: boolean;
  familyEditData: Partial<FamilyData>;
  slugError: string;
  checkingSlug: boolean;
  savingFamily: boolean;
  onFamilyEdit: () => void;
  onFamilyCancelEdit: () => void;
  onFamilySave: () => Promise<void>;
  onFamilyEditDataChange: (data: Partial<FamilyData>) => void;
  // Baby management
  localSelectedBabyId: string;
  onLocalSelectedBabyIdChange: (id: string) => void;
  onBabySelect?: (babyId: string) => void;
  onBabyFormOpen: (baby: Baby | null, isEditing: boolean) => void;
  // Contact management
  selectedContact: Contact | null;
  onSelectedContactChange: (contact: Contact | null) => void;
  onContactFormOpen: (isEditing: boolean) => void;
}

export default function ConfigTab({
  family,
  babies,
  contacts,
  loading,
  appConfig,
  deploymentConfig,
  settings,
  onSettingsChange,
  editingFamily,
  familyEditData,
  slugError,
  checkingSlug,
  savingFamily,
  onFamilyEdit,
  onFamilyCancelEdit,
  onFamilySave,
  onFamilyEditDataChange,
  localSelectedBabyId,
  onLocalSelectedBabyIdChange,
  onBabySelect,
  onBabyFormOpen,
  selectedContact,
  onSelectedContactChange,
  onContactFormOpen,
}: ConfigTabProps) {
  const { t } = useLocalization();
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Family Information Section */}
      <div className="space-y-4">
        <h3 className="form-label mb-4">{t('Family Information')}</h3>

        <div>
          <Label className="form-label">{t('Family Name')}</Label>
          <div className="flex gap-2">
            {editingFamily ? (
              <>
                <Input
                  value={familyEditData.name || ''}
                  onChange={(e) => onFamilyEditDataChange({ ...familyEditData, name: e.target.value })}
                  placeholder={t("Enter family name")}
                  className="flex-1"
                  disabled={savingFamily}
                />
                <Button
                  variant="outline"
                  onClick={onFamilySave}
                  disabled={savingFamily || !!slugError || checkingSlug || !familyEditData.name || !familyEditData.slug}
                >
                  {savingFamily ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('Save')
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={onFamilyCancelEdit}
                  disabled={savingFamily}
                >
                  {t('Cancel')}
                </Button>
              </>
            ) : (
              <>
                <Input
                  disabled
                  value={family?.name || ''}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={onFamilyEdit}
                  disabled={loading}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('Edit')}
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <Label className="form-label">{t('Link/Slug')}</Label>
          <div className="flex gap-2">
            {editingFamily ? (
              <div className="flex-1 space-y-1">
                <div className="relative">
                  <Input
                    value={familyEditData.slug || ''}
                    onChange={(e) => onFamilyEditDataChange({ ...familyEditData, slug: e.target.value })}
                    placeholder={t("Enter family slug")}
                    className={`w-full ${slugError ? 'border-red-500' : ''}`}
                    disabled={savingFamily}
                  />
                  {checkingSlug && (
                    <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                {slugError && (
                  <div className="flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    {slugError}
                  </div>
                )}
              </div>
            ) : (
              <>
                <Input
                  disabled
                  value={family?.slug || ''}
                  className="flex-1 font-mono"
                />
                {family?.slug && (
                  <ShareButton
                    familySlug={family.slug}
                    familyName={family.name}
                    appConfig={appConfig || undefined}
                    variant="outline"
                    size="sm"
                    showText={false}
                  />
                )}
              </>
            )}
          </div>
          {!editingFamily && (
            <p className="text-sm text-gray-500 mt-1">{t('This is your family\'s unique URL identifier')}</p>
          )}
        </div>
      </div>

      {/* Manage Babies */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="form-label mb-4">{t('Manage Babies')}</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="flex-1 min-w-[200px]">
              <Select
                value={localSelectedBabyId || ''}
                onValueChange={(babyId) => {
                  onLocalSelectedBabyIdChange(babyId);
                  onBabySelect?.(babyId);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select a baby")} />
                </SelectTrigger>
                <SelectContent>
                  {babies.map((baby) => (
                    <SelectItem key={baby.id} value={baby.id}>
                      {baby.firstName} {baby.lastName}{baby.inactive ? ' (Inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              disabled={!localSelectedBabyId}
              onClick={() => {
                const baby = babies.find(b => b.id === localSelectedBabyId);
                onBabyFormOpen(baby || null, true);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('Edit')}
            </Button>
            <Button variant="outline" onClick={() => onBabyFormOpen(null, false)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('Add')}
            </Button>
          </div>
        </div>
      </div>

      {/* Manage Contacts */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="form-label mb-4">{t('Manage Contacts')}</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="flex-1 min-w-[200px]">
              <Select
                value={selectedContact?.id || ''}
                onValueChange={(contactId) => {
                  const contact = contacts.find(c => c.id === contactId);
                  onSelectedContactChange(contact || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select a contact")} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.role ? `(${contact.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              disabled={!selectedContact}
              onClick={() => onContactFormOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('Edit')}
            </Button>
            <Button variant="outline" onClick={() => {
              onSelectedContactChange(null);
              onContactFormOpen(false);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('Add')}
            </Button>
          </div>
        </div>
      </div>

      {/* Breast Milk Tracking */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="form-label mb-4">{t('Breast Milk Tracking')}</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="form-label">{t('Enable Breast Milk Inventory Tracking')}</span>
              <p className="text-sm text-gray-500">{t('Track stored, fed, and discarded pump actions and breast milk inventory balance')}</p>
            </div>
            <Checkbox
              variant="primary"
              checked={(settings as any)?.enableBreastMilkTracking ?? true}
              onCheckedChange={(checked) => onSettingsChange({ enableBreastMilkTracking: checked } as any)}
            />
          </label>
        </div>
      </div>

      {/* Feed Timer Settings */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="form-label mb-4">{t('Feed Timer')}</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="form-label">{t('Include Solids in Feed Timer')}</span>
              <p className="text-sm text-gray-500">{t('Include solid food feedings when calculating time since last feed')}</p>
            </div>
            <Checkbox
              variant="primary"
              checked={(settings as any)?.includeSolidsInFeedTimer ?? true}
              onCheckedChange={(checked) => onSettingsChange({ includeSolidsInFeedTimer: checked } as any)}
            />
          </label>
        </div>
      </div>

      {/* System Administration - Only show in self-hosted mode */}
      {deploymentConfig?.deploymentMode !== 'saas' && (
        <div className="border-t border-slate-200 pt-6">
          <h3 className="form-label mb-4">{t('System Administration')}</h3>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => router.push('/family-manager')}
              className="w-full"
              disabled={loading}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('Open Family Manager')}
            </Button>
            <p className="text-sm text-gray-500">
              {t('Access system-wide family management and advanced settings')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
