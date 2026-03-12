'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecordVaccineTabProps } from './vaccine-form.types';
import { VaccineDocumentResponse } from '@/app/api/types';
import { CHILDHOOD_VACCINES } from '@/src/constants/vaccines';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import ContactSelector from '@/src/components/forms/MedicineForm/ContactSelector';
import { DateTimePicker } from '@/src/components/ui/date-time-picker';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Loader2, ChevronDown, Upload, Download, Trash2 } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useTheme } from '@/src/context/theme';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';

/**
 * RecordVaccineTab Component
 *
 * Tab for recording a new vaccine or editing an existing vaccine log entry.
 * Includes vaccine name combobox, dose number, date picker, contact selector,
 * notes, and file upload for vaccine documents.
 */
const RecordVaccineTab: React.FC<RecordVaccineTabProps> = ({
  babyId,
  initialTime,
  onSuccess,
  onClose,
  refreshData,
  activity,
  contacts: parentContacts,
  onContactsUpdated,
}) => {
  const { t } = useLocalization();
  const { toUTCString } = useTimezone();
  const { theme } = useTheme();
  const { showToast } = useToast();

  // Form state
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(() => {
    if (activity) {
      const d = new Date(activity.time);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    const d = new Date(initialTime);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const [vaccineName, setVaccineName] = useState(activity?.vaccineName || '');
  const [doseNumber, setDoseNumber] = useState<number>(activity?.doseNumber || 1);
  const [notes, setNotes] = useState(activity?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contacts state
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Documents state
  const [documents, setDocuments] = useState<VaccineDocumentResponse[]>(
    activity?.documents || []
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vaccine combobox state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filteredVaccines, setFilteredVaccines] = useState<string[]>([]);
  const [previouslyUsedVaccines, setPreviouslyUsedVaccines] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Combine CHILDHOOD_VACCINES with previously used vaccines (deduplicated)
  const allVaccines = React.useMemo(() => {
    const combined = new Set<string>([...CHILDHOOD_VACCINES, ...previouslyUsedVaccines]);
    return Array.from(combined).sort();
  }, [previouslyUsedVaccines]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch previously used vaccines
  useEffect(() => {
    const fetchPreviousVaccines = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/vaccine-log?vaccines=true', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setPreviouslyUsedVaccines(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching previous vaccines:', error);
      }
    };

    fetchPreviousVaccines();
  }, []);

  // Initialize form when editing
  useEffect(() => {
    if (activity && !isInitialized) {
      setVaccineName(activity.vaccineName);
      setDoseNumber(activity.doseNumber || 1);
      setNotes(activity.notes || '');
      setDocuments(activity.documents || []);

      const d = new Date(activity.time);
      if (!isNaN(d.getTime())) {
        setSelectedDateTime(d);
      }

      // Initialize selected contacts from activity
      if (activity.contacts && Array.isArray(activity.contacts)) {
        setSelectedContactIds(activity.contacts.map((c: any) => c.contact.id));
      }

      setIsInitialized(true);
    } else if (!activity && !isInitialized) {
      setIsInitialized(true);
    }
  }, [activity, isInitialized]);

  // Reset initialized flag when activity changes
  useEffect(() => {
    setIsInitialized(false);
  }, [activity?.id]);

  // Filter vaccines based on input
  useEffect(() => {
    if (vaccineName.trim() === '') {
      setFilteredVaccines(allVaccines);
      setDropdownOpen(false);
    } else {
      const filtered = allVaccines.filter(v =>
        v.toLowerCase().includes(vaccineName.toLowerCase())
      );
      setFilteredVaccines(filtered);
    }
  }, [vaccineName, allVaccines]);

  // Handle vaccine selection from dropdown
  const handleVaccineSelect = (vaccine: string) => {
    setVaccineName(vaccine);
    setDropdownOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleVaccineInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVaccineName(value);
    setHighlightedIndex(-1);
    if (value.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleVaccineInputFocus = () => {
    if (vaccineName.trim() !== '') {
      setDropdownOpen(true);
    }
  };

  const handleVaccineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredVaccines.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredVaccines.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredVaccines.length) {
          handleVaccineSelect(filteredVaccines[highlightedIndex]);
        } else if (vaccineName.trim() !== '') {
          handleVaccineSelect(vaccineName.trim());
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setDropdownOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
      default:
        break;
    }
  };

  // Handle date/time change
  const handleDateTimeChange = (date: Date) => {
    setSelectedDateTime(date);
  };

  // Contact handlers
  const handleContactsChange = (contactIds: string[]) => {
    setSelectedContactIds(contactIds);
  };

  const handleAddNewContact = (contact: Contact) => {
    if (!parentContacts.some(c => c.id === contact.id)) {
      onContactsUpdated([...parentContacts, contact]);
    }
  };

  const handleEditContact = (contact: Contact) => {
    onContactsUpdated(parentContacts.map(c => c.id === contact.id ? contact : c));
  };

  const handleDeleteContact = (contactId: string) => {
    onContactsUpdated(parentContacts.filter(c => c.id !== contactId));
    setSelectedContactIds(prev => prev.filter(id => id !== contactId));
  };

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadDocument = async (vaccineLogId: string) => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('vaccineLogId', vaccineLogId);

      const response = await fetch('/api/vaccine-log/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(t('Failed to upload document'));
      }

      const data = await response.json();
      if (data.success && data.data) {
        setDocuments(prev => [...prev, data.data]);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        showToast({
          variant: 'success',
          title: t('Success'),
          message: t('Document uploaded successfully'),
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to upload document'),
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/vaccine-log/file/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(t('Failed to delete document'));
      }

      setDocuments(prev => prev.filter(d => d.id !== documentId));
      showToast({
        variant: 'success',
        title: t('Success'),
        message: t('Document deleted successfully'),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to delete document'),
        duration: 5000,
      });
    }
  };

  const handleDownloadDocument = async (documentId: string, originalName: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/vaccine-log/file/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(t('Failed to download document'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Failed to download document'),
        duration: 5000,
      });
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId || !vaccineName.trim()) return;

    if (!selectedDateTime || isNaN(selectedDateTime.getTime())) {
      console.error('Required fields missing: valid date time');
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const utcTimeString = toUTCString(selectedDateTime);

      const payload = {
        babyId,
        time: utcTimeString,
        vaccineName: vaccineName.trim(),
        doseNumber: doseNumber || null,
        notes: notes || null,
        contactIds: selectedContactIds,
      };

      const url = activity
        ? `/api/vaccine-log?id=${activity.id}`
        : '/api/vaccine-log';

      const response = await fetch(url, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response,
            showToast,
            'saving vaccine record'
          );
          if (isExpirationError) return;
          if (errorData) {
            showToast({
              variant: 'error',
              title: t('Error'),
              message: errorData.error || t('Failed to save vaccine record'),
              duration: 5000,
            });
            throw new Error(errorData.error || 'Failed to save vaccine record');
          }
        }

        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: errorData.error || t('Failed to save vaccine record'),
          duration: 5000,
        });
        throw new Error(errorData.error || 'Failed to save vaccine record');
      }

      const result = await response.json();
      const savedLogId = result.data?.id || activity?.id;

      // Upload pending file if one is selected
      if (selectedFile && savedLogId) {
        await handleUploadDocument(savedLogId);
      }

      showToast({
        variant: 'success',
        title: t('Success'),
        message: activity
          ? t('Vaccine record updated successfully')
          : t('Vaccine record saved successfully'),
        duration: 3000,
      });

      // Reset form if not editing
      if (!activity) {
        setVaccineName('');
        setDoseNumber(1);
        setNotes('');
        setSelectedContactIds([]);
        setDocuments([]);
        setSelectedFile(null);
        setSelectedDateTime(new Date());
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      refreshData();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving vaccine record:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vaccine-form-tab-content">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date/Time Picker */}
        <div>
          <Label className="form-label">{t('Date & Time')}</Label>
          <DateTimePicker
            value={selectedDateTime}
            onChange={handleDateTimeChange}
            disabled={isSubmitting}
            placeholder={t("Select vaccine date...")}
          />
        </div>

        {/* Vaccine Name Combobox */}
        <div>
          <Label className="form-label">{t('Vaccine Name')}</Label>
          <div className="relative">
            <div className="relative w-full">
              <div className="flex items-center w-full">
                <Input
                  ref={inputRef}
                  value={vaccineName}
                  onChange={handleVaccineInputChange}
                  onFocus={handleVaccineInputFocus}
                  onKeyDown={handleVaccineKeyDown}
                  className="w-full pr-10 vaccine-form-dropdown-trigger"
                  placeholder={t("Enter or select a vaccine")}
                  disabled={isSubmitting}
                  required
                />
                <ChevronDown
                  className="absolute right-3 h-4 w-4 text-gray-500 vaccine-form-dropdown-icon"
                  onClick={() => {
                    setDropdownOpen(!dropdownOpen);
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}
                />
              </div>

              {dropdownOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto vaccine-dropdown-container"
                  style={{ width: inputRef.current?.offsetWidth }}
                >
                  {filteredVaccines.length > 0 ? (
                    <div className="py-1">
                      {filteredVaccines.map((vaccine, index) => (
                        <div
                          key={vaccine}
                          className={`px-3 py-2 text-sm cursor-pointer vaccine-dropdown-item ${
                            highlightedIndex === index
                              ? 'bg-gray-100 vaccine-dropdown-item-highlighted'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleVaccineSelect(vaccine)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          {vaccine}
                        </div>
                      ))}
                    </div>
                  ) : (
                    vaccineName.trim() !== '' ? (
                      <div className="px-3 py-2 text-sm text-gray-500 vaccine-dropdown-no-match">
                        {t('No matching vaccines. Press Enter to use "')}{vaccineName}".
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 vaccine-dropdown-no-vaccines">
                        {t('No vaccines found')}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dose Number */}
        <div>
          <Label className="form-label">{t('Dose Number')}</Label>
          <select
            value={doseNumber}
            onChange={(e) => setDoseNumber(parseInt(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm vaccine-form-select"
            disabled={isSubmitting}
          >
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <option key={num} value={num}>
                {t('Dose')} {num}
              </option>
            ))}
          </select>
        </div>

        {/* Contact Selector */}
        <div>
          <Label className="form-label">{t('Healthcare Provider')}</Label>
          <ContactSelector
            contacts={parentContacts}
            selectedContactIds={selectedContactIds}
            onContactsChange={handleContactsChange}
            onAddNewContact={handleAddNewContact}
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
          />
        </div>

        {/* Notes */}
        <div>
          <Label className="form-label">{t('Notes')}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full min-h-[80px]"
            placeholder={t("Optional notes about this vaccine...")}
            disabled={isSubmitting}
          />
        </div>

        {/* File Upload Section */}
        <div>
          <Label className="form-label">{t('Documents')}</Label>
          <div className="vaccine-form-upload-area rounded-md border border-dashed border-gray-300 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="flex-1 text-sm vaccine-form-file-input"
                disabled={isSubmitting || isUploading}
              />
              {selectedFile && activity && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => activity?.id && handleUploadDocument(activity.id)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 vaccine-form-upload-hint">
              {t('Accepts images and PDF files')}
            </p>
          </div>

          {/* Existing documents */}
          {documents.length > 0 && (
            <div className="mt-2 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="vaccine-form-document-item flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="truncate vaccine-form-document-name">
                    {doc.originalName}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadDocument(doc.id, doc.originalName)}
                      title={t('Download')}
                    >
                      <Download className="h-4 w-4 text-teal-600" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                      title={t('Delete')}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || !vaccineName.trim()}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {activity ? t('Update') : t('Save')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RecordVaccineTab;
