'use client';

import React, { useEffect, useState } from 'react';
import { Baby } from '@prisma/client';
import { Settings } from '@/app/api/types';
import { Settings as SettingsIcon, Plus, Edit, Download, Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import BabyModal from '@/src/components/modals/BabyModal';
import ChangePinModal from '@/src/components/modals/ChangePinModal';

import { useLocalization } from '@/src/context/localization';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onBabySelect?: (babyId: string) => void;
  onBabyStatusChange?: () => void;
  selectedBabyId?: string;
  /**
   * Optional variant to control the modal styling
   */
  variant?: 'settings' | 'default';
}

export default function SettingsModal({
  open, 
  onClose,
  onBabySelect,
  onBabyStatusChange,
  selectedBabyId,
  variant = 'default'
}: SettingsModalProps) {
  const { t } = useLocalization();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBabyModal, setShowBabyModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
  const [localSelectedBabyId, setLocalSelectedBabyId] = useState<string | undefined>(selectedBabyId);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSelectedBabyId(selectedBabyId);
  }, [selectedBabyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, babiesResponse] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/baby')
      ]);

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.data);
      }

      if (babiesResponse.ok) {
        const babiesData = await babiesResponse.json();
        setBabies(babiesData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const handleSettingsChange = async (updates: Partial<Settings>) => {
    try {
      const response = await fetch('/api/settings', {
        method: settings ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...settings, ...updates }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const handleBabyModalClose = async () => {
    setShowBabyModal(false);
    await fetchData(); // Refresh local babies list
    onBabyStatusChange?.(); // Refresh parent's babies list
  };

  const handleBackup = async () => {
    try {
      const response = await fetch('/api/database');
      if (!response.ok) throw new Error('Backup failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1].replace(/"/g, '') || 'baby-tracker-backup.db';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Backup error:', error);
      alert('Failed to create backup');
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/database', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Restore failed');
      }

      // Refresh the page to reflect the restored data
      window.location.reload();
    } catch (error) {
      console.error('Restore error:', error);
      alert('Failed to restore backup');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".db"
        onChange={handleRestore}
        style={{ display: 'none' }}
      />
      <Dialog 
        open={open} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onBabyStatusChange?.(); // Refresh parent's babies list when settings modal closes
          }
          onClose();
        }}
      >
        <DialogContent className="dialog-content max-w-2xl w-full">
          <DialogHeader className="dialog-header">
            <DialogTitle className="dialog-title text-slate-800">{t('Settings')}</DialogTitle>
            <DialogDescription className="dialog-description">
              {t('Configure your preferences for the Baby Tracker app')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 w-full max-w-lg mx-auto">
            <div className="space-y-4">
              <div>
                <Label className="form-label">{t('Family Name')}</Label>
              <Input
                disabled={loading}
                value={settings?.familyName || ''}
                onChange={(e) => handleSettingsChange({ familyName: e.target.value })}
                placeholder="Enter family name"
                className="w-full"
              />
              </div>
              
              <div>
                <Label className="form-label">{t('Security PIN')}</Label>
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
                    {t('Change PIN')}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">{t('PIN must be between 6 and 10 digits')}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBackup}
                  className="w-full"
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('Backup Database')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  disabled={loading || isRestoring}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('Restore Database')}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="form-label mb-4">{t('Manage Babies')}</h3>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <div className="flex-1 min-w-[200px]">
                    <Select 
                      value={localSelectedBabyId} 
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
                            {baby.firstName} {baby.lastName}
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
                      setShowBabyModal(true);
                    }}
                  >
                    <Edit className="h-4 w-3 mr-2" />
                    {t('Edit')}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setSelectedBaby(null);
                    setShowBabyModal(true);
                  }}>
                    <Plus className="h-4 w-3 mr-2" />
                    {t('Add')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BabyModal
        open={showBabyModal}
        onClose={handleBabyModalClose}
        isEditing={isEditing}
        baby={selectedBaby}
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
