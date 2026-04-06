'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Baby } from '@prisma/client';
import { Key, Plus, Copy, Check, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
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
import { Badge } from '@/src/components/ui/badge';
import { useToast } from '@/src/components/ui/toast';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { formatDateLong } from '@/src/utils/dateFormat';

interface ApiKeyDisplay {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  babyId: string | null;
  babyName: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

interface ApiKeyManagerProps {
  babies: Baby[];
  familyId?: string;
}

export default function ApiKeyManager({ babies, familyId }: ApiKeyManagerProps) {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyReadScope, setNewKeyReadScope] = useState(true);
  const [newKeyWriteScope, setNewKeyWriteScope] = useState(true);
  const [newKeyBabyId, setNewKeyBabyId] = useState<string>('all');
  const [newKeyExpiration, setNewKeyExpiration] = useState<string>('');

  // Creation success state
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const params = familyId ? `?familyId=${familyId}` : '';
      const response = await fetch(`/api/api-keys${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setApiKeys(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    if (!newKeyReadScope && !newKeyWriteScope) return;

    try {
      setCreating(true);
      const scopes: string[] = [];
      if (newKeyReadScope) scopes.push('read');
      if (newKeyWriteScope) scopes.push('write');

      const body: any = {
        name: newKeyName.trim(),
        scopes,
      };
      if (newKeyBabyId !== 'all') {
        body.babyId = newKeyBabyId;
      }
      if (newKeyExpiration) {
        body.expiresAt = new Date(newKeyExpiration).toISOString();
      }
      if (familyId) {
        body.familyId = familyId;
      }

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCreatedKey(data.data.fullKey);
          setShowCreateForm(false);
          resetCreateForm();
          await fetchApiKeys();
        }
      } else {
        const data = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Error creating API key'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Error creating API key'),
        duration: 5000,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const params = familyId ? `?familyId=${familyId}` : '';
      const response = await fetch(`/api/api-keys${params}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: keyId }),
      });

      if (response.ok) {
        showToast({
          variant: 'success',
          title: t('Success'),
          message: t('Key revoked successfully'),
          duration: 3000,
        });
        await fetchApiKeys();
      } else {
        const data = await response.json();
        showToast({
          variant: 'error',
          title: t('Error'),
          message: data.error || t('Error revoking API key'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      showToast({
        variant: 'error',
        title: t('Error'),
        message: t('Error revoking API key'),
        duration: 5000,
      });
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = createdKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetCreateForm = () => {
    setNewKeyName('');
    setNewKeyReadScope(true);
    setNewKeyWriteScope(true);
    setNewKeyBabyId('all');
    setNewKeyExpiration('');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return formatDateLong(new Date(dateStr), dateFormat);
  };

  return (
    <div>
      <h3 className="form-label mb-4">{t('Integrations')}</h3>
      <Label className="form-label">{t('API Keys')}</Label>

      {/* Created key success banner */}
      {createdKey && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm font-medium text-emerald-800 mb-2">{t('API Key Created')}</p>
          <p className="text-xs text-emerald-600 mb-3">{t('Copy this key now. It will not be shown again.')}</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={createdKey}
              className="flex-1 font-mono text-xs bg-white"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyKey}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">{copied ? t('Copied!') : t('Copy to Clipboard')}</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setCreatedKey(null)}
          >
            {t('Close')}
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="form-label">{t('Key Name')}</Label>
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Home Assistant, Nursery Button"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="form-label">{t('Scopes')}</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newKeyReadScope}
                  onChange={(e) => setNewKeyReadScope(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {t('Read')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newKeyWriteScope}
                  onChange={(e) => setNewKeyWriteScope(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {t('Write')}
              </label>
            </div>
          </div>

          <div>
            <Label className="form-label">{t('Baby Restriction')}</Label>
            <Select value={newKeyBabyId} onValueChange={setNewKeyBabyId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Babies')}</SelectItem>
                {babies.filter(b => !b.inactive).map((baby) => (
                  <SelectItem key={baby.id} value={baby.id}>
                    {baby.firstName} {baby.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="form-label">{t('Expiration')}</Label>
            <Input
              type="date"
              value={newKeyExpiration}
              onChange={(e) => setNewKeyExpiration(e.target.value)}
              className="mt-1"
              placeholder={t('Never')}
            />
            <p className="text-xs text-gray-500 mt-1">{t('Leave blank for no expiration')}</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreateKey}
              disabled={creating || !newKeyName.trim() || (!newKeyReadScope && !newKeyWriteScope)}
              size="sm"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
              {t('Create API Key')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateForm(false);
                resetCreateForm();
              }}
            >
              {t('Cancel')}
            </Button>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Key list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : apiKeys.length === 0 && !showCreateForm ? (
        <div className="text-center py-8 text-gray-500">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('No API keys yet')}</p>
          <p className="text-xs mt-1">{t('Create your first API key to enable external integrations.')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <Card
              key={key.id}
              className={key.revoked ? 'opacity-60 border-red-200 bg-red-50' : ''}
            >
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label className="form-label text-sm truncate">{key.name}</Label>
                    {key.revoked && <Badge variant="error">{t('Revoked')}</Badge>}
                  </div>
                  <p className="text-xs font-mono text-gray-500 mt-1">{key.keyPrefix}...</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope === 'read' ? t('Read') : t('Write')}
                      </Badge>
                    ))}
                    {key.babyName && (
                      <Badge variant="outline" className="text-xs">{key.babyName}</Badge>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{t('Created')}: {formatDate(key.createdAt)}</span>
                    {key.lastUsedAt && <span>{t('Last Used')}: {formatDate(key.lastUsedAt)}</span>}
                    {key.expiresAt && <span>{t('Expires')}: {formatDate(key.expiresAt)}</span>}
                  </div>
                </div>
                {!key.revoked && (
                  <div>
                    {revokingKeyId === key.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeKey(key.id)}
                        >
                          {t('Revoke')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevokingKeyId(null)}
                        >
                          {t('Cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokingKeyId(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add key button */}
      {!showCreateForm && (
        <Button
          variant="outline"
          className="w-full mt-3"
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('Create API Key')}
        </Button>
      )}
    </div>
  );
}
