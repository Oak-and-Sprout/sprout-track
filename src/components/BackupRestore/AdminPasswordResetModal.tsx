'use client';

import React from 'react';
import { Modal, ModalContent, ModalFooter } from '@/src/components/ui/modal';
import { Button } from '@/src/components/ui/button';
import { AlertCircle, KeyRound } from 'lucide-react';

interface AdminPasswordResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * AdminPasswordResetModal Component
 *
 * Displays a notification to users when their admin password has been reset
 * to the default "admin" password due to importing an older database version.
 */
export function AdminPasswordResetModal({
  open,
  onOpenChange,
  onConfirm,
}: AdminPasswordResetModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Admin Password Reset"
      description="Important security notice about your Family Manager password"
    >
      <ModalContent>
        <div className="space-y-4">
          {/* Warning Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/20 p-3">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Due to importing an older version of the database, the <strong>Family Manager admin password</strong> has been reset to the default password for security reasons.
            </p>

            {/* Password Display */}
            <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Default Password: <code className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded font-mono text-blue-700 dark:text-blue-300">admin</code>
              </span>
            </div>

            {/* Security Recommendation */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-gray-100">Security Recommendation:</strong>
                <br />
                Please change your admin password as soon as possible by logging into the Family Manager and updating it in the settings.
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can access the Family Manager at <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded">/family-manager</code>
            </p>
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          onClick={handleConfirm}
          className="w-full"
        >
          I Understand
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default AdminPasswordResetModal;
