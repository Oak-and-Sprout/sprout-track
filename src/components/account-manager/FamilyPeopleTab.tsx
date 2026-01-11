import React, { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { styles } from './account-manager.styles';
import { FamilyPeopleTabProps, BabyData, CaretakerData, ContactData } from './account-manager.types';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { 
  Baby, 
  Users, 
  Phone, 
  Plus, 
  Edit, 
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  Shield,
  UserCheck,
  UserX,
  Mail,
  MapPin
} from 'lucide-react';
import BabyForm from '@/src/components/forms/BabyForm';
import CaretakerForm from '@/src/components/forms/CaretakerForm';
import ContactForm from '@/src/components/forms/ContactForm';
import { useLocalization } from '@/src/context/localization';

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
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn("mt-2 text-gray-600", "account-manager-loading-text")}>{t('Loading family people...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(styles.errorContainer, "account-manager-error-container")}>
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertTriangle className="h-5 w-5" />
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
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-teal-600" />
            <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
              {t('Babies')}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddBaby}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('Add Baby')}
          </Button>
        </div>

        {babies.length > 0 ? (
          <div className={cn(styles.cardContainer, "account-manager-card-container")}>
            {babies.map((baby) => (
              <div key={baby.id} className={cn(styles.card, "account-manager-card")}>
                <div className={cn(styles.cardHeader, "account-manager-card-header")}>
                  <div>
                    <h4 className={cn(styles.cardTitle, "account-manager-card-title")}>
                      {baby.firstName} {baby.lastName}
                    </h4>
                    <p className={cn(styles.cardSubtitle, "account-manager-card-subtitle")}>
                      {baby.age}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {baby.inactive && (
                      <span className={cn(styles.badge, styles.badgeInactive, "account-manager-badge-inactive")}>
                        {t('Inactive')}
                      </span>
                    )}
                    {baby.gender && (
                      <span className={cn(styles.badge, styles.badgeRole, "account-manager-badge-role")}>
                        {baby.gender}
                      </span>
                    )}
                  </div>
                </div>
                <div className={cn(styles.cardContent, "account-manager-card-content")}>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{t('Feed:')} {baby.feedWarningTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{t('Diaper:')} {baby.diaperWarningTime}</span>
                    </div>
                  </div>
                </div>
                <div className={cn(styles.cardActions, "account-manager-card-actions")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditBaby(baby)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('Edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(styles.emptyState, "account-manager-empty-state")}>
            <Baby className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>{t('No babies added yet')}</p>
            <p className="text-sm">{t('Add your first baby to start tracking')}</p>
          </div>
        )}
      </div>

      {/* Caretakers Section */}
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
              {t('Caretakers')}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCaretaker}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('Add Caretaker')}
          </Button>
        </div>

        {caretakers.length > 0 ? (
          <div className={cn(styles.cardContainer, "account-manager-card-container")}>
            {caretakers.map((caretaker) => (
              <div key={caretaker.id} className={cn(styles.card, "account-manager-card")}>
                <div className={cn(styles.cardHeader, "account-manager-card-header")}>
                  <div>
                    <h4 className={cn(styles.cardTitle, "account-manager-card-title")}>
                      {caretaker.name}
                    </h4>
                    <p className={cn(styles.cardSubtitle, "account-manager-card-subtitle")}>
                      {t('ID:')} {caretaker.loginId} {caretaker.type && `• ${caretaker.type}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {caretaker.inactive ? (
                      <span className={cn(styles.badge, styles.badgeInactive, "account-manager-badge-inactive")}>
                        <UserX className="h-3 w-3 mr-1" />
                        {t('Inactive')}
                      </span>
                    ) : (
                      <span className={cn(styles.badge, styles.badgeActive, "account-manager-badge-active")}>
                        <UserCheck className="h-3 w-3 mr-1" />
                        {t('Active')}
                      </span>
                    )}
                    <span className={cn(styles.badge, styles.badgeRole, "account-manager-badge-role")}>
                      <Shield className="h-3 w-3 mr-1" />
                      {caretaker.role}
                    </span>
                  </div>
                </div>
                <div className={cn(styles.cardActions, "account-manager-card-actions")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCaretaker(caretaker)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('Edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(styles.emptyState, "account-manager-empty-state")}>
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>{t('No caretakers added yet')}</p>
            <p className="text-sm">{t('Add caretakers to help manage your family')}</p>
          </div>
        )}
      </div>

      {/* Contacts Section */}
      <div className={cn(styles.sectionBorder, "account-manager-section-border")}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            <h3 className={cn(styles.sectionTitle, "account-manager-section-title")}>
              {t('Contacts')}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddContact}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('Add Contact')}
          </Button>
        </div>

        {contacts.length > 0 ? (
          <div className={cn(styles.cardContainer, "account-manager-card-container")}>
            {contacts.map((contact) => (
              <div key={contact.id} className={cn(styles.card, "account-manager-card")}>
                <div className={cn(styles.cardHeader, "account-manager-card-header")}>
                  <div>
                    <h4 className={cn(styles.cardTitle, "account-manager-card-title")}>
                      {contact.name}
                    </h4>
                    <p className={cn(styles.cardSubtitle, "account-manager-card-subtitle")}>
                      {contact.role}
                    </p>
                  </div>
                </div>
                <div className={cn(styles.cardContent, "account-manager-card-content")}>
                  <div className="space-y-1 text-sm">
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <a 
                          href={`tel:${contact.phone.replace(/\D/g, '')}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <a 
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">{contact.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={cn(styles.cardActions, "account-manager-card-actions")}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditContact(contact)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {t('Edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(styles.emptyState, "account-manager-empty-state")}>
            <Phone className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>{t('No contacts added yet')}</p>
            <p className="text-sm">{t('Add contacts like doctors, family members, or caregivers')}</p>
          </div>
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
          familyId: familyData.id
        } : null}
        onBabyChange={handleBabyFormClose}
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
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          familyId: familyData.id,
          securityPin: selectedCaretaker.securityPin || '',
          accountId: null
        } : null}
        onCaretakerChange={handleCaretakerFormClose}
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
      />
    </div>
  );
};

export default FamilyPeopleTab;
