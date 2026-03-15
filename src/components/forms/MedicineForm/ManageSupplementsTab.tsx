'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { medicineFormStyles as styles } from './medicine-form.styles';
import { ManageSupplementsTabProps, MedicineWithContacts, MedicineFormData } from './medicine-form.types';
import {
  Pill,
  Loader2,
  AlertCircle,
  Edit,
  Plus,
  User,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Switch } from '@/src/components/ui/switch';
import { Label } from '@/src/components/ui/label';
import MedicineForm from './MedicineForm';
import { useLocalization } from '@/src/context/localization';

/**
 * ManageSupplementsTab Component
 *
 * Interface for managing supplements and their associations with contacts.
 * Based on ManageMedicinesTab but filtered to supplements only, without doseMinTime display.
 */
const ManageSupplementsTab: React.FC<ManageSupplementsTabProps> = ({ refreshData, onGiveSupplement }) => {
  const { t } = useLocalization();

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [supplements, setSupplements] = useState<MedicineWithContacts[]>([]);
  const [units, setUnits] = useState<{unitAbbr: string, unitName: string}[]>([]);
  const [contacts, setContacts] = useState<{id: string, name: string, role: string}[]>([]);

  // Form state
  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState<MedicineWithContacts | null>(null);

  // Accordion state
  const [expandedSupplement, setExpandedSupplement] = useState<string | null>(null);

  // State for showing inactive supplements
  const [showInactive, setShowInactive] = useState(false);

  // Filter supplements based on active status
  const filteredSupplements = useMemo(() => {
    return supplements.filter(supplement => showInactive || supplement.active);
  }, [supplements, showInactive]);

  // Fetch supplements, units, and contacts
  useEffect(() => {
    const fetchData = async () => {
      setIsFetching(true);
      setError(null);

      try {
        const authToken = localStorage.getItem('authToken');
        const fetchOptions = { headers: { 'Authorization': `Bearer ${authToken}` } };

        // Fetch supplements only
        const supplementsResponse = await fetch('/api/medicine?isSupplement=true', fetchOptions);
        if (!supplementsResponse.ok) throw new Error(t('Failed to fetch supplements'));
        const supplementsData = await supplementsResponse.json();

        // Fetch units for medicine
        const unitsResponse = await fetch('/api/units?activityType=medicine', fetchOptions);
        if (!unitsResponse.ok) throw new Error(t('Failed to fetch units'));
        const unitsData = await unitsResponse.json();

        // Fetch contacts
        const contactsResponse = await fetch('/api/contact', fetchOptions);
        if (!contactsResponse.ok) throw new Error(t('Failed to fetch contacts'));
        const contactsData = await contactsResponse.json();

        if (supplementsData.success) setSupplements(supplementsData.data);
        else setError(supplementsData.error || 'Failed to load supplements');

        if (unitsData.success) setUnits(unitsData.data);
        else setError(unitsData.error || 'Failed to load units');

        if (contactsData.success) setContacts(contactsData.data);
        else setError(contactsData.error || 'Failed to load contacts');

      } catch (err) {
        setError(err instanceof Error ? err.message : t('An unknown error occurred'));
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, []);

  const handleEditSupplement = (supplement: MedicineWithContacts) => {
    setSelectedSupplement(supplement);
    setShowSupplementForm(true);
  };

  const handleAddSupplement = () => {
    setSelectedSupplement(null);
    setShowSupplementForm(true);
  };

  const handleAccordionToggle = (supplementId: string) => {
    setExpandedSupplement(expandedSupplement === supplementId ? null : supplementId);
  };

  const handleSaveSupplement = async (formData: MedicineFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const isEditing = !!formData.id;
      const method = isEditing ? 'PUT' : 'POST';
      const url = '/api/medicine' + (isEditing ? `?id=${formData.id}` : '');

      const dataToSubmit = {
        ...formData,
        isSupplement: true,
      };

      const authToken = localStorage.getItem('authToken');
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(dataToSubmit),
      });

      const data = await response.json();

      if (data.success) {
        if (isEditing) {
          setSupplements(prev => prev.map(s =>
            s.id === formData.id ? { ...s, ...data.data } : s
          ));
        } else {
          setSupplements(prev => [...prev, data.data]);
        }
        setShowSupplementForm(false);
        setSelectedSupplement(null);
        refreshData?.();
      } else {
        setError(data.error || (isEditing ? t('Failed to update supplement') : t('Failed to create supplement')));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (formData.id ? t('Failed to update supplement') : t('Failed to create supplement')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplement = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/medicine?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const data = await response.json();

      if (data.success) {
        setSupplements(prev => prev.filter(s => s.id !== id));
        setShowSupplementForm(false);
        setSelectedSupplement(null);
        refreshData?.();
      } else {
        setError(data.error || 'Failed to delete supplement');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to delete supplement'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(styles.tabContent)}>
      {isFetching && (
        <div className="flex flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="mt-2 text-gray-600">{t('Loading supplements...')}</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center p-6">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="mt-2 text-red-500 text-center">{error}</p>
        </div>
      )}

      {!isFetching && !error && !showSupplementForm && (
        <>
          <div className={cn(styles.manageMedicinesHeader)}>
            <h3 className={cn(styles.manageMedicinesTitle, "medicine-form-manage-medicines-title")}>{t('Manage Supplements')}</h3>
            <div className={cn(styles.showInactiveContainer)}>
              <Label htmlFor="show-inactive-supplements">{t('Show Inactive')}</Label>
              <Switch
                id="show-inactive-supplements"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
            </div>
          </div>

          <div className={cn(styles.medicinesList)}>
            {filteredSupplements.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-gray-500">
                <Pill className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>{t('No supplements added yet')}</p>
              </div>
            )}
            {filteredSupplements.map(supplement => (
              <div key={supplement.id} className={cn(
                styles.medicineListItem,
                "medicine-form-medicine-list-item",
                !supplement.active && styles.medicineListItemInactive
              )}>
                <div className={cn(styles.medicineListItemHeader)} onClick={() => handleAccordionToggle(supplement.id)}>
                  <Pill className={cn(styles.medicineListIcon, "medicine-form-medicine-list-icon")} />
                  <div className={cn(styles.medicineListContent)}>
                    <p className={cn(styles.medicineListName, "medicine-form-medicine-list-name")}>{supplement.name}</p>
                    <p className={cn(styles.medicineListDose, "medicine-form-medicine-list-dose")}>
                      {t('Typical dose:')} {supplement.typicalDoseSize} {supplement.unitAbbr}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditSupplement(supplement); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                {expandedSupplement === supplement.id && (
                  <div className={cn(styles.medicineListDetails, "medicine-form-medicine-list-details")}>
                    <div className={cn(styles.medicineListDetailsContent)}>
                      {supplement.notes && <p className={cn(styles.medicineListNotes, "medicine-form-medicine-list-notes")}>{supplement.notes}</p>}
                      <div className={cn(styles.medicineListContactsContainer)}>
                        <User className={cn(styles.medicineListDetailIcon)} />
                        <div className={cn(styles.medicineListContactsList)}>
                          {supplement.contacts.length > 0 ? (
                            supplement.contacts.map(c => <Badge key={c.contact.id} variant="secondary">{c.contact.name}</Badge>)
                          ) : (
                            <span className={cn(styles.medicineListNoContacts, "medicine-form-medicine-list-no-contacts")}>{t('No associated contacts')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button className="w-full mt-4" onClick={handleAddSupplement}>
            <Plus className="mr-2 h-4 w-4" /> {t('Add New Supplement')}
          </Button>
        </>
      )}

      {showSupplementForm && (
        <MedicineForm
          isOpen={true}
          onClose={() => setShowSupplementForm(false)}
          medicine={selectedSupplement}
          units={units}
          contacts={contacts}
          onSave={handleSaveSupplement}
          isSupplement={true}
        />
      )}
    </div>
  );
};

export default ManageSupplementsTab;
