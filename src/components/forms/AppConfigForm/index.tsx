'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Checkbox } from '@/src/components/ui/checkbox';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { Settings, Loader2, Save, X, Mail, ChevronDown, Bell, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { BackupRestore } from '@/src/components/BackupRestore';
import { AdminPasswordResetModal } from '@/src/components/BackupRestore/AdminPasswordResetModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { EmailProviderType } from '@prisma/client';
import { useLocalization } from '@/src/context/localization';

interface AppConfigFormProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppConfigData {
  id: string;
  adminPass: string;
  rootDomain: string;
  enableHttps: boolean;
  adminEmail: string | null;
  updatedAt: string;
}

interface EmailConfigData {
  id: string;
  providerType: EmailProviderType;
  sendGridApiKey?: string;
  smtp2goApiKey?: string;
  serverAddress?: string;
  port?: number;
  username?: string;
  password?: string;
  enableTls: boolean;
  allowSelfSignedCert: boolean;
  updatedAt: string;
}

interface NotificationStatusData {
  enabled: boolean;
  vapidConfigured: boolean;
  cronSecretConfigured: boolean;
  lastCronRun: {
    timestamp: string | null;
    notificationsSent: number;
    success: boolean;
  } | null;
  subscriptionCount: number;
  failedSubscriptionCount: number;
}

export default function AppConfigForm({
  isOpen, 
  onClose 
}: AppConfigFormProps) {
  const { t } = useLocalization();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfigData | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigData | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatusData | null>(null);
  const [notificationStatusLoading, setNotificationStatusLoading] = useState(false);
  const [formData, setFormData] = useState({
    adminPass: '',
    rootDomain: '',
    enableHttps: false,
    adminEmail: '',
  });
  const [emailFormData, setEmailFormData] = useState({
    providerType: 'SENDGRID' as EmailProviderType,
    sendGridApiKey: '',
    smtp2goApiKey: '',
    serverAddress: '',
    port: 587,
    username: '',
    password: '',
    enableTls: true,
    allowSelfSignedCert: false,
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'verify' | 'new' | 'confirm'>('verify');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [originalPassword, setOriginalPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const adminResetResolverRef = React.useRef<(() => void) | null>(null);

  // Handle admin password reset notification
  const handleAdminPasswordReset = () => {
    console.log('Admin password was reset to default during restore');
    setShowPasswordResetModal(true);
  };

  // Handle modal confirmation
  const handlePasswordResetConfirm = () => {
    console.log('User acknowledged password reset notification');
    // Resolve the promise to allow BackupRestore to proceed
    if (adminResetResolverRef.current) {
      adminResetResolverRef.current();
      adminResetResolverRef.current = null;
    }
  };

  // Promise that resolves when user acknowledges the password reset
  const handleAdminResetAcknowledged = () => {
    return new Promise<void>((resolve) => {
      adminResetResolverRef.current = resolve;
    });
  };

  // Fetch app config data
  const fetchAppConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/app-config', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      
      if (response.status === 401 || response.status === 403) {
        setError(t('Authentication required. Please ensure you are logged in as a system administrator.'));
        return;
      }
      
      if (data.success) {
        setAppConfig(data.data.appConfig);
        setEmailConfig(data.data.emailConfig);
        setOriginalPassword(data.data.appConfig?.adminPass || '');
        setFormData({
          adminPass: data.data.appConfig?.adminPass || '',
          rootDomain: data.data.appConfig?.rootDomain || '',
          enableHttps: data.data.appConfig?.enableHttps || false,
          adminEmail: data.data.appConfig?.adminEmail || '',
        });
        setEmailFormData({
          providerType: data.data.emailConfig?.providerType || 'SENDGRID',
          sendGridApiKey: data.data.emailConfig?.sendGridApiKey || '',
          smtp2goApiKey: data.data.emailConfig?.smtp2goApiKey || '',
          serverAddress: data.data.emailConfig?.serverAddress || '',
          port: data.data.emailConfig?.port || 587,
          username: data.data.emailConfig?.username || '',
          password: data.data.emailConfig?.password || '',
          enableTls: data.data.emailConfig?.enableTls !== false,
          allowSelfSignedCert: data.data.emailConfig?.allowSelfSignedCert || false,
        });
        setShowPasswordChange(false);
        setPasswordStep('verify');
        setVerifyPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to fetch app configuration');
      }
    } catch (error) {
      console.error('Error fetching app config:', error);
        setError(t('Failed to fetch app configuration'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch notification system status
  const fetchNotificationStatus = async () => {
    try {
      setNotificationStatusLoading(true);
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/notifications/status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setNotificationStatus(data.data);
      }
      // Don't show error if status fails - it's optional info
    } catch (error) {
      console.error('Error fetching notification status:', error);
    } finally {
      setNotificationStatusLoading(false);
    }
  };

  // Load data when form opens
  useEffect(() => {
    if (isOpen) {
      fetchAppConfig();
      fetchNotificationStatus();
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  // Handle checkbox changes
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
    setError(null);
    setSuccess(null);
  };

  // Handle email input changes
  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setEmailFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
    setError(null);
    setSuccess(null);
  };

  // Handle email checkbox changes
  const handleEmailCheckboxChange = (name: string, checked: boolean) => {
    setEmailFormData(prev => ({ ...prev, [name]: checked }));
    setError(null);
    setSuccess(null);
  };
  
  // Handle email provider change
  const handleProviderChange = (provider: EmailProviderType) => {
    setEmailFormData(prev => ({ ...prev, providerType: provider }));
  };

  // Handle password step changes
  const handleVerifyPassword = () => {
    if (verifyPassword === originalPassword) {
      setPasswordStep('new');
      setError(null);
    } else {
      setError('Incorrect current password');
      setVerifyPassword('');
    }
  };

  const handleNewPassword = () => {
    if (newPassword.length < 6) {
      setError(t('Password must be at least 6 characters'));
      return;
    }
    setPasswordStep('confirm');
    setError(null);
  };

  const handleConfirmPassword = async () => {
    if (newPassword === confirmPassword) {
      try {
        setSaving(true);
        setError(null);

        // Update password in database immediately
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/app-config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            appConfigData: { adminPass: newPassword }
          }),
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          setError(t('Authentication required. Please ensure you are logged in as a system administrator.'));
          return;
        }

        if (data.success) {
          // Update local state with new password data
          setAppConfig(data.data.appConfig);
          setFormData(prev => ({ ...prev, adminPass: data.data.appConfig.adminPass }));
          setOriginalPassword(data.data.appConfig.adminPass);
          
          // Reset password form for potential next change
          setShowPasswordChange(false);
          setPasswordStep('verify');
          setVerifyPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setError(null);
          setSuccess(t('Password changed successfully'));
          scheduleAutoClose();
        } else {
          setError(data.error || t('Failed to update password'));
        }
      } catch (error) {
        console.error('Error updating password:', error);
          setError(t('Failed to update password'));
      } finally {
        setSaving(false);
      }
    } else {
      setError(t('Passwords do not match'));
      setConfirmPassword('');
    }
  };

  const resetPasswordForm = () => {
    setShowPasswordChange(false);
    setPasswordStep('verify');
    setVerifyPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.adminPass.trim()) {
      setError(t('Admin password is required'));
      return false;
    }

    if (!formData.rootDomain.trim()) {
      setError(t('Root domain is required'));
      return false;
    }

    // Flexible domain/IP validation - allows domain, IP, localhost, with optional port
    const domainOrIpRegex = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|localhost)(?::[1-9][0-9]{0,4})?$/;
    if (!domainOrIpRegex.test(formData.rootDomain)) {
      setError('Please enter a valid domain, IP address, or localhost (with optional port)');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const payload = {
      appConfigData: formData,
      emailConfigData: emailFormData,
    };

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/app-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        setError(t('Authentication required. Please ensure you are logged in as a system administrator.'));
        return;
      }

      if (data.success) {
        setAppConfig(data.data.appConfig);
        setEmailConfig(data.data.emailConfig);
        setSuccess(t('App configuration updated successfully'));
        scheduleAutoClose();
      } else {
        setError(data.error || t('Failed to update app configuration'));
      }
    } catch (error) {
      console.error('Error updating app config:', error);
        setError(t('Failed to update app configuration'));
    } finally {
      setSaving(false);
    }
  };



  // Auto-close form after successful save
  const scheduleAutoClose = () => {
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    // Schedule auto-close after 500ms
    closeTimeoutRef.current = setTimeout(() => {
      handleClose();
    }, 500);
  };

  // Handle form close
  const handleClose = () => {
    // Clear any pending auto-close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    
    setError(null);
    setSuccess(null);
    resetPasswordForm();
    onClose();
  };

  return (
    <FormPage 
      isOpen={isOpen} 
      onClose={handleClose}
      title={t("App Configuration")}
      description={t("Manage global application settings")}
    >
      <form onSubmit={handleSubmit} className="h-full flex flex-col overflow-hidden">
        <FormPageContent className="space-y-6 overflow-y-auto flex-1 pb-24">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <span className="ml-2 text-gray-600">{t('Loading configuration...')}</span>
            </div>
          ) : (
            <>
              {/* System Settings Section */}
              <div className="space-y-4">
                                 <div className="flex items-center space-x-2">
                   <Settings className="h-5 w-5 text-teal-600" />
                   <Label className="text-lg font-semibold">
                     {t('System Settings')}
                   </Label>
                 </div>

                <div className="space-y-4">
                  {/* Password Change Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      {t('Admin Password')}
                    </Label>
                    
                    {!showPasswordChange ? (
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          disabled
                          value="••••••"
                          className="flex-1 font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPasswordChange(true)}
                          disabled={loading}
                        >
                          {t('Change Password')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-sm font-medium">
                            {t('Change Admin Password')}
                          </Label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={resetPasswordForm}
                          >
                            {t('Cancel')}
                          </Button>
                        </div>

                        {passwordStep === 'verify' && (
                          <div className="space-y-2">
                            <Label htmlFor="verifyPassword" className="text-sm">
                              {t('Current Password')}
                            </Label>
                            <div className="flex space-x-2">
                              <Input
                                type="password"
                                id="verifyPassword"
                                value={verifyPassword}
                                onChange={(e) => {
                                  setVerifyPassword(e.target.value);
                                  setError(null);
                                  setSuccess(null);
                                }}
                                placeholder={t("Enter current password")}
                                autoComplete="current-password"
                              />
                              <Button 
                                type="button" 
                                onClick={handleVerifyPassword}
                                disabled={!verifyPassword.trim()}
                              >
                                Continue
                              </Button>
                            </div>
                          </div>
                        )}

                        {passwordStep === 'new' && (
                          <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-sm">
                              {t('New Password')}
                            </Label>
                            <div className="flex space-x-2">
                              <Input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => {
                                  setNewPassword(e.target.value);
                                  setError(null);
                                  setSuccess(null);
                                }}
                                placeholder={t("Enter new password")}
                                autoComplete="new-password"
                              />
                              <Button 
                                type="button" 
                                onClick={handleNewPassword}
                                disabled={!newPassword.trim()}
                              >
                                Continue
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                              {t('Password must be at least 6 characters')}
                            </p>
                          </div>
                        )}

                        {passwordStep === 'confirm' && (
                          <div className="space-y-2">
                            <Label htmlFor="confirmNewPassword" className="text-sm">
                              {t('Confirm New Password')}
                            </Label>
                            <div className="flex space-x-2">
                              <Input
                                type="password"
                                id="confirmNewPassword"
                                value={confirmPassword}
                                onChange={(e) => {
                                  setConfirmPassword(e.target.value);
                                  setError(null);
                                  setSuccess(null);
                                }}
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                              />
                              <Button 
                                type="button" 
                                onClick={handleConfirmPassword}
                                disabled={!confirmPassword.trim() || saving}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('Updating...')}
                                  </>
                                ) : (
                                  t('Update')
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      {t('This password is used for system-wide administrative access')}
                    </p>
                  </div>

                  {/* Root Domain */}
                  <div className="space-y-2">
                    <Label htmlFor="rootDomain" className="text-sm font-medium">
                      {t('Root Domain')}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="rootDomain"
                      name="rootDomain"
                      value={formData.rootDomain}
                      onChange={handleInputChange}
                      placeholder="example.com"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      {t('The primary domain for this application instance')}
                    </p>
                  </div>

                  {/* HTTPS Setting */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableHttps"
                        checked={formData.enableHttps}
                        onCheckedChange={(checked) => 
                          handleCheckboxChange('enableHttps', checked as boolean)
                        }
                      />
                      <Label htmlFor="enableHttps" className="text-sm font-medium cursor-pointer">
                        {t('Enable HTTPS')}
                      </Label>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">
                      {t('Enable secure HTTPS connections for the application')}
                    </p>
                  </div>

                  {/* Admin Email */}
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail" className="text-sm font-medium">
                      {t('Admin Email')}
                    </Label>
                    <Input
                      type="email"
                      id="adminEmail"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleInputChange}
                      placeholder={t("admin@example.com")}
                    />
                    <p className="text-xs text-gray-500">
                      {t('Email address used for admin replies to feedback submissions')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Configuration Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-teal-600" />
                  <Label className="text-lg font-semibold">
                    {t('Email Configuration')}
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Email Provider Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="providerType" className="text-sm font-medium">
                      {t('Email Provider')}
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span>{emailFormData.providerType.replace('_', ' ')}</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        <DropdownMenuItem onSelect={() => handleProviderChange('SENDGRID')}>
                          {t('SendGrid')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleProviderChange('SMTP2GO')}>
                          {t('SMTP2GO')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleProviderChange('MANUAL_SFTP')}>
                          {t('Manual SMTP')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* SendGrid API Key */}
                  {emailFormData.providerType === 'SENDGRID' && (
                    <div className="space-y-2">
                      <Label htmlFor="sendGridApiKey" className="text-sm font-medium">
                        {t('SendGrid API Key')}
                      </Label>
                      <Input
                        type="password"
                        id="sendGridApiKey"
                        name="sendGridApiKey"
                        value={emailFormData.sendGridApiKey}
                        onChange={handleEmailInputChange}
                        placeholder={t("Enter SendGrid API Key")}
                      />
                    </div>
                  )}

                  {/* SMTP2GO API Key */}
                  {emailFormData.providerType === 'SMTP2GO' && (
                    <div className="space-y-2">
                      <Label htmlFor="smtp2goApiKey" className="text-sm font-medium">
                        {t('SMTP2GO API Key')}
                      </Label>
                      <Input
                        type="password"
                        id="smtp2goApiKey"
                        name="smtp2goApiKey"
                        value={emailFormData.smtp2goApiKey}
                        onChange={handleEmailInputChange}
                        placeholder="Enter SMTP2GO API Key"
                      />
                    </div>
                  )}

                  {/* Manual SMTP Settings */}
                  {emailFormData.providerType === 'MANUAL_SFTP' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="serverAddress" className="text-sm font-medium">
                          {t('Server Address')}
                        </Label>
                        <Input
                          type="text"
                          id="serverAddress"
                          name="serverAddress"
                          value={emailFormData.serverAddress}
                          onChange={handleEmailInputChange}
                          placeholder={t("smtp.example.com")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port" className="text-sm font-medium">
                          {t('Port')}
                        </Label>
                        <Input
                          type="number"
                          id="port"
                          name="port"
                          value={emailFormData.port}
                          onChange={handleEmailInputChange}
                          placeholder={t("587")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-sm font-medium">
                          {t('Username')}
                        </Label>
                        <Input
                          type="text"
                          id="username"
                          name="username"
                          value={emailFormData.username}
                          onChange={handleEmailInputChange}
                          autoComplete="username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">
                          {t('Password')}
                        </Label>
                        <Input
                          type="password"
                          id="password"
                          name="password"
                          value={emailFormData.password}
                          onChange={handleEmailInputChange}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enableTls"
                          checked={emailFormData.enableTls}
                          onCheckedChange={(checked) => handleEmailCheckboxChange('enableTls', checked as boolean)}
                        />
                        <Label htmlFor="enableTls" className="text-sm font-medium cursor-pointer">
                          {t('Enable TLS')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="allowSelfSignedCert"
                          checked={emailFormData.allowSelfSignedCert}
                          onCheckedChange={(checked) => handleEmailCheckboxChange('allowSelfSignedCert', checked as boolean)}
                        />
                        <Label htmlFor="allowSelfSignedCert" className="text-sm font-medium cursor-pointer">
                          {t('Allow Self-Signed Cert')}
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notification System Status Section */}
              {notificationStatus && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-teal-600" />
                    <Label className="text-lg font-semibold">
                      {t('Notification System Status')}
                    </Label>
                  </div>
                  <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {notificationStatusLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                        <span className="ml-2 text-sm text-gray-600">{t('Loading...')}</span>
                      </div>
                    ) : (
                      <>
                        {/* Feature Enabled */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Feature Enabled')}</span>
                          <div className="flex items-center">
                            {notificationStatus.enabled ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-sm text-green-600">{t('Enabled')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                                <span className="text-sm text-red-600">{t('Disabled')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* VAPID Keys */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('VAPID Keys')}</span>
                          <div className="flex items-center">
                            {notificationStatus.vapidConfigured ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-sm text-green-600">{t('Configured')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                                <span className="text-sm text-red-600">{t('Not Configured')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Cron Secret */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Cron Secret')}</span>
                          <div className="flex items-center">
                            {notificationStatus.cronSecretConfigured ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-sm text-green-600">{t('Configured')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                                <span className="text-sm text-red-600">{t('Not Configured')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Subscriptions */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Active Subscriptions')}</span>
                          <div className="flex items-center">
                            {notificationStatus.subscriptionCount > 0 ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-sm text-green-600">
                                  {notificationStatus.subscriptionCount}
                                  {notificationStatus.failedSubscriptionCount > 0 && (
                                    <span className="text-yellow-600 ml-1">
                                      ({notificationStatus.failedSubscriptionCount} {t('with failures')})
                                    </span>
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 text-yellow-500 mr-1" />
                                <span className="text-sm text-yellow-600">{t('None')}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Last Cron Run */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Last Cron Run')}</span>
                          <div className="flex items-center">
                            {notificationStatus.lastCronRun ? (
                              <>
                                {notificationStatus.lastCronRun.success ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500 mr-1" />
                                )}
                                <span className={`text-sm ${notificationStatus.lastCronRun.success ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {new Date(notificationStatus.lastCronRun.timestamp!).toLocaleString()}
                                  {notificationStatus.lastCronRun.notificationsSent > 0 && (
                                    <span className="ml-1">
                                      ({notificationStatus.lastCronRun.notificationsSent} {t('sent')})
                                    </span>
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 text-yellow-500 mr-1" />
                                <span className="text-sm text-yellow-600">{t('Never')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Database Management Section */}
              <BackupRestore
                isLoading={loading}
                isSaving={saving}
                onBackupError={(error) => setError(error)}
                onRestoreError={(error) => setError(error)}
                onAdminPasswordReset={handleAdminPasswordReset}
                onAdminResetAcknowledged={handleAdminResetAcknowledged}
              />

              {/* Status Messages */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center">
                    <X className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="flex items-center">
                    <Save className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
                  </div>
                </div>
              )}

              {/* Last Updated Info */}
              {appConfig && (
                <div className="text-xs text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {t('Last updated:')} {new Date(appConfig.updatedAt).toLocaleString()}
                </div>
              )}
            </>
          )}
        </FormPageContent>
        
        <FormPageFooter>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700"
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Saving...')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('Save Configuration')}
                </>
              )}
            </Button>
          </div>
        </FormPageFooter>
      </form>

      {/* Admin Password Reset Modal */}
      <AdminPasswordResetModal
        open={showPasswordResetModal}
        onOpenChange={setShowPasswordResetModal}
        onConfirm={handlePasswordResetConfirm}
      />
    </FormPage>
  );
} 