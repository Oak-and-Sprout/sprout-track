'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';

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
  const [showConfirm, setShowConfirm] = useState(false);

  const getAuthHeaders = (): HeadersInit => {
    const authToken = localStorage.getItem('authToken');
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
  };

  const checkForUpdates = async () => {
    try {
      setChecking(true);
      setShowConfirm(false);

      // Check guardian status and version in parallel
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
        // Guardian reachable but version check failed (maybe GitHub rate limited)
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
      setShowConfirm(false);

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
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <RefreshCw className="h-5 w-5 text-teal-600" />
        <Label className="text-lg font-semibold">
          {t('System Updates')}
        </Label>
      </div>

      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Initial state — not checked yet */}
        {guardianReachable === null ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Checking...')}
                </>
              ) : (
                t('Check for Updates')
              )}
            </Button>
          </div>
        ) : guardianReachable ? (
          <>
            {/* Version info */}
            {versionInfo && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500 dark:text-gray-400">{t('Installed Version')}</div>
                  <div className="font-medium">v{versionInfo.currentVersion}</div>
                  <div className="text-gray-500 dark:text-gray-400">{t('Latest Version')}</div>
                  <div className="font-medium">
                    {versionInfo.latestVersion
                      ? `v${versionInfo.latestVersion}`
                      : t('Unable to check')}
                  </div>
                </div>

                {/* Update available banner */}
                {versionInfo.updateAvailable === true && (
                  <div className="flex items-center space-x-2 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                    <ArrowUpCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                        {t('Update available!')}
                      </p>
                      <p className="text-xs text-teal-700 dark:text-teal-400">
                        v{versionInfo.currentVersion} → v{versionInfo.latestVersion}
                      </p>
                    </div>
                  </div>
                )}

                {/* Already up to date */}
                {versionInfo.updateAvailable === false && (
                  <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      {t('You are running the latest version')}
                    </p>
                  </div>
                )}

                {/* Could not check GitHub */}
                {versionInfo.updateAvailable === null && versionInfo.latestVersion === null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('Could not reach GitHub to check for updates. You can still trigger a manual update.')}
                  </p>
                )}
              </div>
            )}

            {/* Docker mode warning */}
            {dockerMode ? (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                {t('Updates are managed by Docker and cannot be triggered from the admin panel.')}
              </p>
            ) : !showConfirm ? (
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${
                    versionInfo?.updateAvailable
                      ? 'border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/20'
                      : 'border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20'
                  }`}
                  onClick={() => setShowConfirm(true)}
                  disabled={updating || isLoading || isSaving}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {versionInfo?.updateAvailable ? t('Update Now') : t('Force Update')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={checkForUpdates}
                  disabled={checking}
                >
                  <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            ) : (
              /* Confirmation dialog */
              <div className="space-y-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                      {t('Are you sure?')}
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                      {t('This will restart the application. All users will be temporarily disconnected while the update is applied.')}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                    disabled={updating}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                    onClick={triggerUpdate}
                    disabled={updating}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('Updating...')}
                      </>
                    ) : (
                      t('Confirm Update')
                    )}
                  </Button>
                </div>
              </div>
            )}

            {updating && (
              <p className="text-sm text-teal-600 dark:text-teal-400 text-center animate-pulse">
                {t('Update triggered. Redirecting to maintenance page...')}
              </p>
            )}
          </>
        ) : (
          /* Guardian not reachable */
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('Update service not available')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
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
          </div>
        )}
      </div>
    </div>
  );
}
