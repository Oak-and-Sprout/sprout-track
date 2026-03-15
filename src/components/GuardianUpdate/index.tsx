'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/src/components/ui/dialog';
import { Card, CardContent } from '@/src/components/ui/card';
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { cn } from '@/src/lib/utils';
import { guardianUpdateStyles } from './guardian-update.styles';

interface GuardianUpdateProps {
  isLoading: boolean;
  isSaving: boolean;
  onError: (error: string) => void;
}

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  repository: string;
}

export function GuardianUpdate({ isLoading, isSaving, onError }: GuardianUpdateProps) {
  const { t } = useLocalization();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [guardianReachable, setGuardianReachable] = useState<boolean | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dockerMode, setDockerMode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const getAuthHeaders = (): HeadersInit => {
    const authToken = localStorage.getItem('authToken');
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
  };

  const checkForUpdates = async () => {
    try {
      setChecking(true);

      const [statusRes, versionRes] = await Promise.all([
        fetch('/api/guardian/update?endpoint=status', { headers: getAuthHeaders() }),
        fetch('/api/guardian/update?endpoint=version', { headers: getAuthHeaders() }),
      ]);

      const statusResult = await statusRes.json();
      const versionResult = await versionRes.json();

      if (!statusResult.success) {
        setGuardianReachable(false);
        if (statusResult.error) onError(statusResult.error);
        return;
      }

      setGuardianReachable(true);
      setDockerMode(statusResult.data?.dockerMode || false);

      if (versionResult.success && versionResult.data) {
        setVersionInfo(versionResult.data);
      } else {
        setVersionInfo({
          currentVersion: statusResult.data?.version || 'unknown',
          latestVersion: null,
          updateAvailable: null,
          repository: 'https://github.com/Oak-and-Sprout/sprout-track',
        });
      }
    } catch {
      setGuardianReachable(false);
    } finally {
      setChecking(false);
    }
  };

  const triggerUpdate = async () => {
    try {
      setUpdating(true);
      setShowConfirmDialog(false);

      const response = await fetch('/api/guardian/update', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (result.success) {
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        onError(result.error || t('Failed to trigger update'));
        setUpdating(false);
      }
    } catch {
      onError(t('Failed to connect to update service'));
      setUpdating(false);
    }
  };

  return (
    <div className={guardianUpdateStyles.container}>
      {/* Section Header */}
      <div className={guardianUpdateStyles.header.container}>
        <RefreshCw className={guardianUpdateStyles.header.icon} />
        <Label className={guardianUpdateStyles.header.title}>
          {t('System Updates')}
        </Label>
      </div>

      {/* Content */}
      <Card className="shadow-none">
        <CardContent className="p-4 space-y-3">
        {/* Initial state */}
        {guardianReachable === null && (
          <div className={guardianUpdateStyles.row}>
            <span className={guardianUpdateStyles.helpText}>
              {t('Check for available updates from GitHub')}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={checkForUpdates}
              disabled={checking || isLoading || isSaving}
            >
              {checking ? (
                <>
                  <Loader2 className={cn(guardianUpdateStyles.icon, 'animate-spin')} />
                  {t('Checking...')}
                </>
              ) : (
                t('Check for Updates')
              )}
            </Button>
          </div>
        )}

        {/* Guardian reachable — show version info */}
        {guardianReachable === true && (
          <>
            {/* Version grid */}
            {versionInfo && (
              <div className={guardianUpdateStyles.versionGrid}>
                <Label className={guardianUpdateStyles.versionLabel}>
                  {t('Installed Version')}
                </Label>
                <Badge variant="outline">v{versionInfo.currentVersion}</Badge>

                <Label className={guardianUpdateStyles.versionLabel}>
                  {t('Latest Version')}
                </Label>
                {versionInfo.latestVersion ? (
                  <Badge variant={versionInfo.updateAvailable ? 'default' : 'outline'}>
                    v{versionInfo.latestVersion}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t('Unable to check')}</Badge>
                )}
              </div>
            )}

            {/* Update available */}
            {versionInfo?.updateAvailable === true && (
              <div className={guardianUpdateStyles.banner.row}>
                <ArrowUpCircle className="h-4 w-4 text-teal-600 flex-shrink-0" />
                <div>
                  <p className={guardianUpdateStyles.banner.text}>
                    {t('Update available!')}
                  </p>
                  <p className={guardianUpdateStyles.banner.subtext}>
                    v{versionInfo.currentVersion} → v{versionInfo.latestVersion}
                  </p>
                </div>
              </div>
            )}

            {/* Up to date */}
            {versionInfo?.updateAvailable === false && (
              <div className={guardianUpdateStyles.banner.row}>
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className={guardianUpdateStyles.banner.text}>
                  {t('You are running the latest version')}
                </p>
              </div>
            )}

            {/* GitHub unreachable */}
            {versionInfo?.updateAvailable === null && versionInfo?.latestVersion === null && (
              <div className={guardianUpdateStyles.banner.row}>
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className={guardianUpdateStyles.banner.text}>
                  {t('Could not reach GitHub to check for updates. You can still trigger a manual update.')}
                </p>
              </div>
            )}

            {/* Docker mode warning */}
            {dockerMode ? (
              <div className={guardianUpdateStyles.banner.row}>
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className={guardianUpdateStyles.banner.text}>
                  {t('Updates are managed by Docker and cannot be triggered from the admin panel.')}
                </p>
              </div>
            ) : (
              <div className={guardianUpdateStyles.buttonRow}>
                <Button
                  type="button"
                  variant={versionInfo?.updateAvailable ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={updating || isLoading || isSaving}
                >
                  <RefreshCw className={guardianUpdateStyles.icon} />
                  {versionInfo?.updateAvailable ? t('Update Now') : t('Force Update')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={checkForUpdates}
                  disabled={checking}
                >
                  <RefreshCw className={cn('h-3 w-3', checking && 'animate-spin')} />
                </Button>
              </div>
            )}

            {/* Updating redirect message */}
            {updating && (
              <div className={guardianUpdateStyles.banner.row}>
                <Loader2 className="h-4 w-4 text-teal-600 flex-shrink-0 animate-spin" />
                <p className={guardianUpdateStyles.banner.text}>
                  {t('Update triggered. Redirecting to maintenance page...')}
                </p>
              </div>
            )}
          </>
        )}

        {/* Guardian not reachable */}
        {guardianReachable === false && (
          <>
            <div className={guardianUpdateStyles.row}>
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-gray-400" />
                <span className={guardianUpdateStyles.helpText}>
                  {t('Update service not available')}
                </span>
              </div>
            </div>
            <p className={guardianUpdateStyles.helpText}>
              {t('ST-Guardian is not running or not configured. Updates must be performed manually via the command line.')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={checkForUpdates}
              disabled={checking}
            >
              {t('Retry')}
            </Button>
          </>
        )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('Confirm Application Update')}
            </DialogTitle>
            <DialogDescription>
              {versionInfo?.updateAvailable
                ? `${t('This will update Sprout Track from')} v${versionInfo.currentVersion} ${t('to')} v${versionInfo.latestVersion}.`
                : t('This will pull the latest code and rebuild the application.')
              }
            </DialogDescription>
          </DialogHeader>
          <div className={guardianUpdateStyles.dialog.warningBox}>
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <p className={guardianUpdateStyles.dialog.warningText}>
              {t('The application will restart during the update. All active users will be temporarily disconnected and redirected to a maintenance page.')}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={updating}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={triggerUpdate}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className={cn(guardianUpdateStyles.icon, 'animate-spin')} />
                  {t('Updating...')}
                </>
              ) : (
                <>
                  <RefreshCw className={guardianUpdateStyles.icon} />
                  {t('Update Now')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
