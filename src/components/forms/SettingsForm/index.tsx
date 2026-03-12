'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Baby, Unit, Caretaker } from '@prisma/client';
import { Settings } from '@/app/api/types';
import { Settings as SettingsIcon, Wrench, Shield } from 'lucide-react';
import { Contact } from '@/src/components/CalendarEvent/calendar-event.types';
import { Button } from '@/src/components/ui/button';
import {
  FormPage,
  FormPageFooter
} from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import BabyForm from '@/src/components/forms/BabyForm';
import CaretakerForm from '@/src/components/forms/CaretakerForm';
import ContactForm from '@/src/components/forms/ContactForm';
import ChangePinModal from '@/src/components/modals/ChangePinModal';
import { useToast } from '@/src/components/ui/toast';
import { handleExpirationError } from '@/src/lib/expiration-error-handler';
import { useLocalization } from '@/src/context/localization';
import UserSettingsTab from './UserSettingsTab';
import ConfigTab from './ConfigTab';
import AdminTab from './AdminTab';

interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SettingsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onBabySelect?: (babyId: string) => void;
  onBabyStatusChange?: () => void;
  selectedBabyId?: string;
  familyId?: string;
  isAdmin?: boolean;
}

export default function SettingsForm({
  isOpen,
  onClose,
  onBabySelect,
  onBabyStatusChange,
  selectedBabyId,
  familyId,
  isAdmin = false,
}: SettingsFormProps) {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('user-settings');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBabyForm, setShowBabyForm] = useState(false);
  const [showCaretakerForm, setShowCaretakerForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [selectedCaretaker, setSelectedCaretaker] = useState<Caretaker | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [localSelectedBabyId, setLocalSelectedBabyId] = useState<string>('');
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [appConfig, setAppConfig] = useState<{ rootDomain: string; enableHttps: boolean } | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<{ deploymentMode: string; enableAccounts: boolean; allowAccountRegistration: boolean; notificationsEnabled?: boolean } | null>(null);

  // Family editing state
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyEditData, setFamilyEditData] = useState<Partial<FamilyData>>({});
  const [slugError, setSlugError] = useState<string>('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);

  // Local authType state for immediate UI feedback
  const [localAuthType, setLocalAuthType] = useState<'SYSTEM' | 'CARETAKER'>('SYSTEM');

  useEffect(() => {
    setLocalSelectedBabyId(selectedBabyId || '');
  }, [selectedBabyId]);

  // Check slug uniqueness
  const checkSlugUniqueness = useCallback(async (slug: string, currentFamilyId: string) => {
    if (!slug || slug.trim() === '') {
      setSlugError('');
      return;
    }

    setCheckingSlug(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/family/by-slug/${encodeURIComponent(slug)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();

      if (data.success && data.data && data.data.id !== currentFamilyId) {
        setSlugError(t('This slug is already taken'));
      } else {
        setSlugError('');
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError(t('Error checking slug availability'));
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Debounced slug check
  useEffect(() => {
    if (familyEditData.slug && family?.id) {
      const timeoutId = setTimeout(() => {
        checkSlugUniqueness(familyEditData.slug!, family.id);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [familyEditData.slug, family?.id, checkSlugUniqueness]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = authToken ? {
        'Authorization': `Bearer ${authToken}`
      } : {};

      let isSysAdmin = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isSysAdmin = decodedPayload.isSysAdmin || false;
        } catch (error) {
          console.error('Error parsing JWT token in SettingsForm:', error);
        }
      }

      const settingsUrl = isSysAdmin && familyId ? `/api/settings?familyId=${familyId}` : '/api/settings';
      const babiesUrl = isSysAdmin && familyId ? `/api/baby?familyId=${familyId}` : '/api/baby';
      const caretakersUrl = isSysAdmin && familyId ? `/api/caretaker?includeInactive=true&familyId=${familyId}` : '/api/caretaker?includeInactive=true';
      const contactsUrl = isSysAdmin && familyId ? `/api/contact?familyId=${familyId}` : '/api/contact';
      const familyUrl = '/api/family';

      const [settingsResponse, familyResponse, babiesResponse, unitsResponse, caretakersResponse, contactsResponse, appConfigResponse, deploymentConfigResponse] = await Promise.all([
        fetch(settingsUrl, { headers }),
        fetch(familyUrl, { headers }),
        fetch(babiesUrl, { headers }),
        fetch('/api/units', { headers }),
        fetch(caretakersUrl, { headers }),
        fetch(contactsUrl, { headers }),
        fetch('/api/app-config/public', { headers }),
        fetch('/api/deployment-config', { headers })
      ]);

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.data);

        if (settingsData.data?.authType) {
          setLocalAuthType(settingsData.data.authType);
        } else {
          const willHaveCaretakers = caretakersResponse.ok;
          let caretakerData = [];
          if (willHaveCaretakers) {
            const caretakersData = await caretakersResponse.json();
            if (caretakersData.success) {
              caretakerData = caretakersData.data.filter((c: any) => c.loginId !== '00' && !c.deletedAt);
            }
          }
          setLocalAuthType(caretakerData.length > 0 ? 'CARETAKER' : 'SYSTEM');
        }
      }

      if (familyResponse.ok) {
        const familyData = await familyResponse.json();
        setFamily(familyData.data);
        setFamilyEditData({
          name: familyData.data.name,
          slug: familyData.data.slug,
        });
      }

      if (babiesResponse.ok) {
        const babiesData = await babiesResponse.json();
        setBabies(babiesData.data);
      }

      if (unitsResponse.ok) {
        const unitsData = await unitsResponse.json();
        setUnits(unitsData.data);
      }

      if (caretakersResponse.ok) {
        const caretakersData = await caretakersResponse.json();
        setCaretakers(caretakersData.data);
      }

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        setContacts(contactsData.data);
      }

      if (appConfigResponse.ok) {
        const appConfigData = await appConfigResponse.json();
        setAppConfig(appConfigData.data);
      }

      if (deploymentConfigResponse.ok) {
        const deploymentConfigData = await deploymentConfigResponse.json();
        setDeploymentConfig(deploymentConfigData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleSettingsChange = async (updates: Partial<Settings>) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      };

      let isSysAdmin = false;
      if (authToken) {
        try {
          const payload = authToken.split('.')[1];
          const decodedPayload = JSON.parse(atob(payload));
          isSysAdmin = decodedPayload.isSysAdmin || false;
        } catch (error) {
          console.error('Error parsing JWT token in handleSettingsChange:', error);
        }
      }

      const settingsUrl = isSysAdmin && familyId ? `/api/settings?familyId=${familyId}` : '/api/settings';

      const response = await fetch(settingsUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response,
            showToast,
            'updating settings'
          );
          if (isExpirationError) return;
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to update settings',
              duration: 5000,
            });
            return;
          }
        }

        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to update settings',
          duration: 5000,
        });
        return;
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      } else {
        showToast({
          variant: 'error',
          title: 'Error',
          message: data.error || 'Failed to update settings',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showToast({
        variant: 'error',
        title: 'Error',
        message: 'Failed to update settings',
        duration: 5000,
      });
    }
  };

  const handleAuthTypeChange = (newAuthType: 'SYSTEM' | 'CARETAKER') => {
    setLocalAuthType(newAuthType);
    handleSettingsChange({ authType: newAuthType });
  };

  const handleFamilyEdit = () => {
    setEditingFamily(true);
    setFamilyEditData({
      name: family?.name || '',
      slug: family?.slug || '',
    });
    setSlugError('');
  };

  const handleFamilyCancelEdit = () => {
    setEditingFamily(false);
    setFamilyEditData({
      name: family?.name || '',
      slug: family?.slug || '',
    });
    setSlugError('');
  };

  const handleFamilySave = async () => {
    if (slugError) {
      alert(t('Please fix the slug error before saving'));
      return;
    }

    if (!familyEditData.name || !familyEditData.slug) {
      alert(t('Family name and slug are required'));
      return;
    }

    try {
      setSavingFamily(true);
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/family', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: familyEditData.name,
          slug: familyEditData.slug,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const { isExpirationError, errorData } = await handleExpirationError(
            response,
            showToast,
            'updating family information'
          );
          if (isExpirationError) return;
          if (errorData) {
            showToast({
              variant: 'error',
              title: 'Error',
              message: errorData.error || 'Failed to save changes',
              duration: 5000,
            });
            return;
          }
        }

        const errorData = await response.json();
        showToast({
          variant: 'error',
          title: 'Error',
          message: errorData.error || 'Failed to save changes',
          duration: 5000,
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setFamily(data.data);
        setEditingFamily(false);
        setSlugError('');

        if (data.data.slug !== family?.slug) {
          console.log('Family slug updated successfully');
        }
      } else {
        showToast({
          variant: 'error',
          title: 'Error',
          message: data.error || 'Failed to save changes',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error saving family:', error);
      showToast({
        variant: 'error',
        title: 'Error',
        message: 'Error saving changes',
        duration: 5000,
      });
    } finally {
      setSavingFamily(false);
    }
  };

  const handleBabyFormOpen = (baby: Baby | null, editing: boolean) => {
    setSelectedBaby(baby);
    setIsEditing(editing);
    setShowBabyForm(true);
  };

  const handleCaretakerFormOpen = (editing: boolean) => {
    setIsEditing(editing);
    setShowCaretakerForm(true);
  };

  const handleContactFormOpen = (editing: boolean) => {
    setIsEditing(editing);
    setShowContactForm(true);
  };

  const handleBabyFormClose = () => {
    setShowBabyForm(false);
  };

  const handleCaretakerFormClose = async () => {
    setShowCaretakerForm(false);
    setSelectedCaretaker(null);
    await fetchData();
  };

  const handleContactFormClose = async () => {
    setShowContactForm(false);
    setSelectedContact(null);
    await fetchData();
  };

  // Build tabs array
  const tabs: FormPageTab[] = [
    {
      id: 'user-settings',
      label: t('User Settings'),
      icon: SettingsIcon,
      content: (
        <UserSettingsTab
          settings={settings}
          units={units}
          loading={loading}
          babies={babies}
          deploymentConfig={deploymentConfig}
          onSettingsChange={handleSettingsChange}
        />
      ),
    },
    ...(isAdmin ? [{
      id: 'config',
      label: t('Config'),
      icon: Wrench,
      content: (
        <ConfigTab
          family={family}
          babies={babies}
          contacts={contacts}
          loading={loading}
          appConfig={appConfig}
          deploymentConfig={deploymentConfig}
          editingFamily={editingFamily}
          familyEditData={familyEditData}
          slugError={slugError}
          checkingSlug={checkingSlug}
          savingFamily={savingFamily}
          onFamilyEdit={handleFamilyEdit}
          onFamilyCancelEdit={handleFamilyCancelEdit}
          onFamilySave={handleFamilySave}
          onFamilyEditDataChange={setFamilyEditData}
          localSelectedBabyId={localSelectedBabyId}
          onLocalSelectedBabyIdChange={setLocalSelectedBabyId}
          onBabySelect={onBabySelect}
          onBabyFormOpen={handleBabyFormOpen}
          selectedContact={selectedContact}
          onSelectedContactChange={setSelectedContact}
          onContactFormOpen={handleContactFormOpen}
        />
      ),
    }] : []),
    ...(isAdmin ? [{
      id: 'admin',
      label: t('Admin'),
      icon: Shield,
      content: (
        <AdminTab
          settings={settings}
          caretakers={caretakers}
          babies={babies}
          loading={loading}
          familyId={familyId}
          localAuthType={localAuthType}
          onSettingsChange={handleSettingsChange}
          onAuthTypeChange={handleAuthTypeChange}
          selectedCaretaker={selectedCaretaker}
          onSelectedCaretakerChange={setSelectedCaretaker}
          onCaretakerFormOpen={handleCaretakerFormOpen}
          onChangePinOpen={() => setShowChangePinModal(true)}
        />
      ),
    }] : []),
  ];

  return (
    <>
      <FormPage
        isOpen={isOpen}
        onClose={() => {
          onBabyStatusChange?.();
          onClose();
        }}
        title={t("Settings")}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <FormPageFooter>
          <Button variant="outline" onClick={onClose}>
            {t('Close')}
          </Button>
        </FormPageFooter>
      </FormPage>

      <BabyForm
        isOpen={showBabyForm}
        onClose={handleBabyFormClose}
        isEditing={isEditing}
        baby={selectedBaby}
        onBabyChange={async () => {
          await fetchData();
          onBabyStatusChange?.();
        }}
      />

      <CaretakerForm
        isOpen={showCaretakerForm}
        onClose={handleCaretakerFormClose}
        isEditing={isEditing}
        caretaker={selectedCaretaker}
        onCaretakerChange={fetchData}
      />

      <ContactForm
        isOpen={showContactForm}
        onClose={handleContactFormClose}
        contact={selectedContact || undefined}
        onSave={() => fetchData()}
        onDelete={() => fetchData()}
      />

      <ChangePinModal
        open={showChangePinModal}
        onClose={() => setShowChangePinModal(false)}
        currentPin={settings?.securityPin || '111222'}
        onPinChange={(newPin) => handleSettingsChange({ securityPin: newPin })}
      />
    </>
  );
}
