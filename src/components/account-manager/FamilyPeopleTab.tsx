import React, { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { styles } from './account-manager.styles';
import { FamilyPeopleTabProps, BabyData, CaretakerData, ContactData } from './account-manager.types';
import { Button } from '@/src/components/ui/button';
import {
  Baby,
  Users,
  Phone,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import BabyForm from '@/src/components/forms/BabyForm';
import CaretakerForm from '@/src/components/forms/CaretakerForm';
import ContactForm from '@/src/components/forms/ContactForm';
import { useLocalization } from '@/src/context/localization';
import { genderChip, caretakerChips, nudgeShort } from '@/src/utils/accountPresentation';

/**
 * FamilyPeopleTab Component
 * 
 * Second tab of the account manager that handles family people management
 */
const FamilyPeopleTab: React.FC<FamilyPeopleTabProps> = ({
  familyData,
  onDataRefresh,
}) => {
  const { t } = useLocalization();
  
  // Data states
  const [babies, setBabies] = useState<BabyData[]>([]);
  const [caretakers, setCaretakers] = useState<CaretakerData[]>([]);
  const [contacts, setContacts] = useState<ContactData[]>([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [showBabyForm, setShowBabyForm] = useState(false);
  const [showCaretakerForm, setShowCaretakerForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  
  // Selected items for editing
  const [selectedBaby, setSelectedBaby] = useState<BabyData | null>(null);
  const [selectedCaretaker, setSelectedCaretaker] = useState<CaretakerData | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactData | null>(null);
  
  // Form editing states
  const [isEditingBaby, setIsEditingBaby] = useState(false);
  const [isEditingCaretaker, setIsEditingCaretaker] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Fetch family people data
  useEffect(() => {
    fetchFamilyPeople();
  }, []);

  const fetchFamilyPeople = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
      
      const fetchOptions = {
        headers: { 'Authorization': `Bearer ${authToken}` }
      };
      
      // Fetch data in parallel
      const [babiesRes, caretakersRes, contactsRes] = await Promise.all([
        fetch('/api/baby', fetchOptions),
        fetch('/api/caretaker?includeInactive=true', fetchOptions),
        fetch('/api/contact', fetchOptions)
      ]);
      
      // Process babies response
      if (babiesRes.ok) {
        const data = await babiesRes.json();
        if (data.success) {
          const babiesWithAge = data.data.map((baby: any) => ({
            ...baby,
            age: calculateAge(new Date(baby.birthDate))
          }));
          setBabies(babiesWithAge);
        }
      }
      
      // Process caretakers response
      if (caretakersRes.ok) {
        const data = await caretakersRes.json();
        if (data.success) {
          setCaretakers(data.data);
        }
      }
      
      // Process contacts response
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        if (data.success) {
          setContacts(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching family people:', err);
      setError(err instanceof Error ? err.message : 'Failed to load family people data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate age from birth date
  const calculateAge = (birthDate: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - birthDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days old`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} old`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} year${years > 1 ? 's' : ''} ${remainingMonths > 0 ? `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''} old`.trim();
    }
  };

  // Handle baby form actions
  const handleAddBaby = () => {
    setSelectedBaby(null);
    setIsEditingBaby(false);
    setShowBabyForm(true);
  };

  const handleEditBaby = (baby: BabyData) => {
    setSelectedBaby(baby);
    setIsEditingBaby(true);
    setShowBabyForm(true);
  };

  const handleBabyFormClose = () => {
    setShowBabyForm(false);
    setSelectedBaby(null);
    // Only refresh data if the form was actually used for editing/creating
    if (isEditingBaby || selectedBaby) {
      fetchFamilyPeople();
    }
  };

  // Handle caretaker form actions
  const handleAddCaretaker = () => {
    setSelectedCaretaker(null);
    setIsEditingCaretaker(false);
    setShowCaretakerForm(true);
  };

  const handleEditCaretaker = (caretaker: CaretakerData) => {
    setSelectedCaretaker(caretaker);
    setIsEditingCaretaker(true);
    setShowCaretakerForm(true);
  };

  const handleCaretakerFormClose = () => {
    setShowCaretakerForm(false);
    setSelectedCaretaker(null);
    // Only refresh data if the form was actually used for editing/creating
    if (isEditingCaretaker || selectedCaretaker) {
      fetchFamilyPeople();
    }
  };

  // Handle contact form actions
  const handleAddContact = () => {
    setSelectedContact(null);
    setIsEditingContact(false);
    setShowContactForm(true);
  };

  const handleEditContact = (contact: ContactData) => {
    setSelectedContact(contact);
    setIsEditingContact(true);
    setShowContactForm(true);
  };

  const handleContactFormClose = () => {
    setShowContactForm(false);
    setSelectedContact(null);
    // Only refresh data if the form was actually used for editing/creating
    if (isEditingContact || selectedContact) {
      fetchFamilyPeople();
    }
  };

  const handleContactSave = () => {
    fetchFamilyPeople(); // Refresh data
  };

  const handleContactDelete = () => {
    fetchFamilyPeople(); // Refresh data
  };

  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "account-manager-loading-container")}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden="true" />
        <p className={cn("mt-2 text-gray-600", "account-manager-loading-text")}>{t('Loading family people...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(styles.errorContainer, "account-manager-error-container")}>
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p className="font-medium">{t('Error')}</p>
        </div>
        <p className={cn("text-red-500 mb-4", "account-manager-error-text")}>{error}</p>
        <Button 
          variant="outline" 
          onClick={fetchFamilyPeople} 
          className="mt-2"
        >
          {t('Retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Babies Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <Baby size={20} strokeWidth={1.8} />
          <h3>{t('Babies')}</h3>
          <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleAddBaby}>
            <Plus size={15} strokeWidth={1.8} />{t('Add baby')}
          </button>
        </div>
        {babies.length === 0 ? (
          <div className="sb-empty">
            <Baby size={30} strokeWidth={1.8} />
            <b>{t('No babies yet')}</b>
            {t('Add your first baby to start tracking.')}
          </div>
        ) : (
          babies.map((baby) => {
            const chip = genderChip(baby.gender);
            const meta = [
              baby.age,
              `${t('feed nudge')} ${nudgeShort(baby.feedWarningTime)}`,
              `${t('diaper nudge')} ${nudgeShort(baby.diaperWarningTime)}`,
            ].filter(Boolean).join(' · ');
            return (
              <div className="sb-prow" key={baby.id}>
                <span className="sb-nm">{baby.firstName} {baby.lastName}</span>
                {chip && <span className={`sb-chip sb-c-${chip.variant}`}>{t(chip.label)}</span>}
                {baby.inactive && <span className="sb-chip sb-c-red">{t('Inactive')}</span>}
                <span className="sb-meta">{meta}</span>
                <span className="sb-sp" />
                <button type="button" className="sb-edit" onClick={() => handleEditBaby(baby)}>{t('Edit')}</button>
              </div>
            );
          })
        )}
      </div>

      {/* Caretakers Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <Users size={20} strokeWidth={1.8} />
          <h3>{t('Caretakers')}</h3>
          <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleAddCaretaker}>
            <Plus size={15} strokeWidth={1.8} />{t('Add caretaker')}
          </button>
        </div>
        {caretakers.length === 0 ? (
          <div className="sb-empty">
            <Users size={30} strokeWidth={1.8} />
            <b>{t('No caretakers yet')}</b>
            {t('Add the other people who help with the days.')}
          </div>
        ) : (
          caretakers.map((ct) => (
            <div className="sb-prow" key={ct.id}>
              <span className="sb-nm">{ct.name}</span>
              {caretakerChips(ct.role, ct.inactive).map((chip) => (
                <span key={chip.label} className={`sb-chip sb-c-${chip.variant}`}>{t(chip.label)}</span>
              ))}
              <span className="sb-meta">
                {t('Signs in with ID {id}').replace('{id}', ct.loginId)}
                {ct.type ? ` · ${ct.type}` : ''}
              </span>
              <span className="sb-sp" />
              <button type="button" className="sb-edit" onClick={() => handleEditCaretaker(ct)}>{t('Edit')}</button>
            </div>
          ))
        )}
      </div>

      {/* Contacts Section */}
      <div className="sb-sect">
        <div className="sb-sect-hd">
          <Phone size={20} strokeWidth={1.8} />
          <h3>{t('Contacts')}</h3>
          <button type="button" className="sb-btn sb-ghost sb-sm" onClick={handleAddContact}>
            <Plus size={15} strokeWidth={1.8} />{t('Add contact')}
          </button>
        </div>
        {contacts.length === 0 ? (
          <div className="sb-empty">
            <Phone size={30} strokeWidth={1.8} />
            <b>{t('No contacts yet')}</b>
            {t('The pediatrician, grandma, the sitter — the numbers you dig for at 2 am.')}
          </div>
        ) : (
          contacts.map((contact) => {
            const meta = [contact.role, contact.phone, contact.email].filter(Boolean).join(' · ');
            return (
              <div className="sb-prow" key={contact.id}>
                <span className="sb-nm">{contact.name}</span>
                <span className="sb-meta">{meta}</span>
                <span className="sb-sp" />
                <button type="button" className="sb-edit" onClick={() => handleEditContact(contact)}>{t('Edit')}</button>
              </div>
            );
          })
        )}
      </div>

      {/* Forms */}
      <BabyForm
        isOpen={showBabyForm}
        onClose={handleBabyFormClose}
        isEditing={isEditingBaby}
        baby={selectedBaby ? {
          ...selectedBaby,
          birthDate: new Date(selectedBaby.birthDate),
          gender: selectedBaby.gender as any,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          familyId: familyData.id,
          feedTimerFrom: (selectedBaby as any).feedTimerFrom || 'start',
          feedTimerTypes: selectedBaby.feedTimerTypes ?? null,
        } : null}
        onBabyChange={handleBabyFormClose}
        appearance="storybook"
      />

      <CaretakerForm
        isOpen={showCaretakerForm}
        onClose={handleCaretakerFormClose}
        isEditing={isEditingCaretaker}
        caretaker={selectedCaretaker ? {
          ...selectedCaretaker,
          type: selectedCaretaker.type || null,
          role: selectedCaretaker.role as any,
          language: (selectedCaretaker as any).language || 'en',
          lastSeenVersion: (selectedCaretaker as any).lastSeenVersion || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          familyId: familyData.id,
          securityPin: selectedCaretaker.securityPin || '',
          accountId: null
        } : null}
        onCaretakerChange={handleCaretakerFormClose}
        appearance="storybook"
      />

      <ContactForm
        isOpen={showContactForm}
        onClose={handleContactFormClose}
        contact={selectedContact ? {
          ...selectedContact,
          phone: selectedContact.phone || null,
          email: selectedContact.email || null,
          address: selectedContact.address || null,
          notes: selectedContact.notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null
        } : undefined}
        onSave={handleContactSave}
        onDelete={handleContactDelete}
        appearance="storybook"
      />
    </div>
  );
};

export default FamilyPeopleTab;
