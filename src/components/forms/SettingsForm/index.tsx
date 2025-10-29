'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Baby, Unit, Caretaker } from '@prisma/client';
import { Settings } from '@/app/api/types';
import { Settings as SettingsIcon, Edit, ExternalLink, AlertCircle, Loader2, Plus } from 'lucide-react';
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
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { ShareButton } from '@/src/components/ui/share-button';
import { Switch } from '@/src/components/ui/switch';
import BabyForm from '@/src/components/forms/BabyForm';
import CaretakerForm from '@/src/components/forms/CaretakerForm';
import ContactForm from '@/src/components/forms/ContactForm';
import ChangePinModal from '@/src/components/modals/ChangePinModal';

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
}

export default function SettingsForm({ 
  isOpen, 
  onClose,
  onBabySelect,
  onBabyStatusChange,
  selectedBabyId,
  familyId,
}: SettingsFormProps) {
  const router = useRouter();
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
  const [deploymentConfig, setDeploymentConfig] = useState<{ deploymentMode: string; enableAccounts: boolean; allowAccountRegistration: boolean } | null>(null);

  // Family editing state
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyEditData, setFamilyEditData] = useState<Partial<FamilyData>>({});
  const [slugError, setSlugError] = useState<string>('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);

  // Local authType state for immediate UI feedback
  const [localAuthType, setLocalAuthType] = useState<'SYSTEM' | 'CARETAKER'>('SYSTEM');

  useEffect(() => {
    // Only set the selected baby ID if explicitly provided
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
        setSlugError('This slug is already taken');
      } else {
        setSlugError('');
      }
    } catch (error) {
      console.error('Error checking slug:', error);
      setSlugError('Error checking slug availability');
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
      
      // Get auth token for all requests
      const authToken = localStorage.getItem('authToken');
      const headers: HeadersInit = authToken ? {
        'Authorization': `Bearer ${authToken}`
      } : {};
      
      // Check if user is system administrator and build query params
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
      
      // Build URLs with familyId parameter for system administrators
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

        // Set local authType from settings, auto-detect if not set
        if (settingsData.data?.authType) {
          setLocalAuthType(settingsData.data.authType);
        } else {
          // Auto-detect based on caretakers
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
        // Initialize family edit data
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

  // Fetch data when form opens
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

      // Check if user is system administrator and build URL with familyId parameter
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

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
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
    // Don't save if there's a slug error
    if (slugError) {
      alert('Please fix the slug error before saving');
      return;
    }

    if (!familyEditData.name || !familyEditData.slug) {
      alert('Family name and slug are required');
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

      const data = await response.json();
      
      if (data.success) {
        setFamily(data.data);
        setEditingFamily(false);
        setSlugError('');
        
        // If slug changed, we should refresh or redirect
        if (data.data.slug !== family?.slug) {
          // Optionally refresh the page or show a message about the URL change
          console.log('Family slug updated successfully');
        }
      } else {
        console.error('Failed to save family:', data.error);
        alert('Failed to save changes: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving family:', error);
      alert('Error saving changes');
    } finally {
      setSavingFamily(false);
    }
  };

  const handleOpenFamilyManager = () => {
    router.push('/family-manager');
  };

  const handleBabyFormClose = () => {
    setShowBabyForm(false);
  };

  const handleCaretakerFormClose = async () => {
    setShowCaretakerForm(false);
    setSelectedCaretaker(null); // Clear selected caretaker to avoid stale data
    await fetchData(); // Refresh local caretakers list
  };

  const handleContactFormClose = async () => {
    setShowContactForm(false);
    setSelectedContact(null); // Reset selected contact when form closes
    await fetchData(); // Refresh local contacts list
  };



  return (
    <>
      <FormPage
        isOpen={isOpen}
        onClose={() => {
          onBabyStatusChange?.(); // Refresh parent's babies list when settings form closes
          onClose();
        }}
        title="Settings"
        description="Configure your preferences for the Baby Tracker app"
      >
        <FormPageContent>
          <div className="space-y-6">
            {/* Family Information Section */}
            <div className="space-y-4">
              <h3 className="form-label mb-4">Family Information</h3>
              
              <div>
                <Label className="form-label">Family Name</Label>
                <div className="flex gap-2">
                  {editingFamily ? (
                    <>
                      <Input
                        value={familyEditData.name || ''}
                        onChange={(e) => setFamilyEditData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter family name"
                        className="flex-1"
                        disabled={savingFamily}
                      />
                      <Button
                        variant="outline"
                        onClick={handleFamilySave}
                        disabled={savingFamily || !!slugError || checkingSlug || !familyEditData.name || !familyEditData.slug}
                      >
                        {savingFamily ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleFamilyCancelEdit}
                        disabled={savingFamily}
                      >
                        Cancel
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
                        onClick={handleFamilyEdit}
                        disabled={loading}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="form-label">Link/Slug</Label>
                <div className="flex gap-2">
                  {editingFamily ? (
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <Input
                          value={familyEditData.slug || ''}
                          onChange={(e) => setFamilyEditData(prev => ({ ...prev, slug: e.target.value }))}
                          placeholder="Enter family slug"
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
                  <p className="text-sm text-gray-500 mt-1">This is your family's unique URL identifier</p>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">Authentication Settings</h3>

              <div className="space-y-4">
              <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">System PIN</span>
                  <Switch
                    checked={localAuthType === 'CARETAKER'}
                    onCheckedChange={(checked) => handleAuthTypeChange(checked ? 'CARETAKER' : 'SYSTEM')}
                    disabled={loading}
                    variant="green"
                  />
                  <span className="text-sm text-gray-500">Caretaker IDs</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {localAuthType === 'CARETAKER'
                      ? 'Use individual caretaker login IDs and PINs'
                      : 'Use shared system PIN for all users'
                    }
                  </p>
                </div>
                
              </div>

              <div>
                <Label className="form-label">Security PIN</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    disabled
                    value="••••••"
                    className="w-full font-mono"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowChangePinModal(true)}
                    disabled={loading}
                  >
                    Change PIN
                  </Button>
                </div>
                {localAuthType === 'CARETAKER' ? (
                  <p className="text-sm text-red-500 mt-1">System PIN is disabled when using caretaker authentication.</p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">PIN must be between 6 and 10 digits</p>
                )}
              </div>

              {/* Caretaker Management Section */}
              <div className="mb-4">
                <Label className="form-label">Manage Caretakers</Label>
                {localAuthType === 'SYSTEM' && (
                  <p className="text-sm text-red-500 mt-1">Caretaker logins are disabled in System PIN mode</p>
                )}
              </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 w-full">
                    <div className="flex-1 min-w-[200px]">
                      <Select
                        value={selectedCaretaker?.id || ''}
                        onValueChange={(caretakerId) => {
                          const caretaker = caretakers.find(c => c.id === caretakerId);
                          setSelectedCaretaker(caretaker || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a caretaker" />
                        </SelectTrigger>
                        <SelectContent>
                          {caretakers.map((caretaker) => (
                            <SelectItem key={caretaker.id} value={caretaker.id}>
                              {caretaker.name} {caretaker.type ? `(${caretaker.type})` : ''}{caretaker.inactive ? ' (Inactive)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!selectedCaretaker}
                      onClick={() => {
                        setIsEditing(true);
                        setShowCaretakerForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setSelectedCaretaker(null);
                      setShowCaretakerForm(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">Manage Babies</h3>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <div className="flex-1 min-w-[200px]">
                    <Select 
                      value={localSelectedBabyId || ''} 
                      onValueChange={(babyId) => {
                        setLocalSelectedBabyId(babyId);
                        onBabySelect?.(babyId);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a baby" />
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
                      setSelectedBaby(baby || null);
                      setIsEditing(true);
                      setShowBabyForm(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setSelectedBaby(null);
                    setShowBabyForm(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </div>


            <div className="border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">Manage Contacts</h3>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <div className="flex-1 min-w-[200px]">
                    <Select 
                      value={selectedContact?.id || ''} 
                      onValueChange={(contactId) => {
                        const contact = contacts.find(c => c.id === contactId);
                        setSelectedContact(contact || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact" />
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
                    onClick={() => {
                      setIsEditing(true);
                      setShowContactForm(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setSelectedContact(null);
                    setShowContactForm(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">Debug Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="form-label">Enable Debug Session Timer</Label>
                    <p className="text-sm text-gray-500">Shows JWT token expiration and user idle time</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableDebugTimer"
                      checked={(settings as any)?.enableDebugTimer || false}
                      onChange={(e) => handleSettingsChange({ enableDebugTimer: e.target.checked } as any)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="form-label">Enable Debug Timezone Tool</Label>
                    <p className="text-sm text-gray-500">Shows timezone information and DST status</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableDebugTimezone"
                      checked={(settings as any)?.enableDebugTimezone || false}
                      onChange={(e) => handleSettingsChange({ enableDebugTimezone: e.target.checked } as any)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">Default Units</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bottle Feeding Unit */}
                  <div>
                    <Label className="form-label">Bottle Feeding</Label>
                    <Select
                      value={settings?.defaultBottleUnit || 'OZ'}
                      onValueChange={(value) => handleSettingsChange({ defaultBottleUnit: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter(unit => ['OZ', 'ML'].includes(unit.unitAbbr))
                          .map((unit) => (
                            <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                              {unit.unitName} ({unit.unitAbbr})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Solid Feeding Unit */}
                  <div>
                    <Label className="form-label">Solid Feeding</Label>
                    <Select
                      value={settings?.defaultSolidsUnit || 'TBSP'}
                      onValueChange={(value) => handleSettingsChange({ defaultSolidsUnit: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter(unit => ['TBSP', 'G'].includes(unit.unitAbbr))
                          .map((unit) => (
                            <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                              {unit.unitName} ({unit.unitAbbr})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Height Unit */}
                  <div>
                    <Label className="form-label">Height</Label>
                    <Select
                      value={settings?.defaultHeightUnit || 'IN'}
                      onValueChange={(value) => handleSettingsChange({ defaultHeightUnit: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter(unit => ['IN', 'CM'].includes(unit.unitAbbr))
                          .map((unit) => (
                            <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                              {unit.unitName} ({unit.unitAbbr})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Weight Unit */}
                  <div>
                    <Label className="form-label">Weight</Label>
                    <Select
                      value={settings?.defaultWeightUnit || 'LB'}
                      onValueChange={(value) => handleSettingsChange({ defaultWeightUnit: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter(unit => ['LB', 'KG', 'G'].includes(unit.unitAbbr))
                          .map((unit) => (
                            <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                              {unit.unitName} ({unit.unitAbbr})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temperature Unit */}
                  <div>
                    <Label className="form-label">Temperature</Label>
                    <Select
                      value={settings?.defaultTempUnit || 'F'}
                      onValueChange={(value) => handleSettingsChange({ defaultTempUnit: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units
                          .filter(unit => ['F', 'C'].includes(unit.unitAbbr))
                          .map((unit) => (
                            <SelectItem key={unit.unitAbbr} value={unit.unitAbbr}>
                              {unit.unitName} ({unit.unitAbbr})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Only show System Administration section in self-hosted mode */}
            {deploymentConfig?.deploymentMode !== 'saas' && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="form-label mb-4">System Administration</h3>
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={handleOpenFamilyManager}
                    className="w-full"
                    disabled={loading}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Family Manager
                  </Button>
                  <p className="text-sm text-gray-500">
                    Access system-wide family management and advanced settings
                  </p>
                </div>
              </div>
            )}
          </div>
        </FormPageContent>
        
        <FormPageFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </FormPageFooter>
      </FormPage>

      <BabyForm
        isOpen={showBabyForm}
        onClose={handleBabyFormClose}
        isEditing={isEditing}
        baby={selectedBaby}
        onBabyChange={async () => {
          await fetchData(); // Refresh local babies list
          onBabyStatusChange?.(); // Refresh parent's babies list
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
